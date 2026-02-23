import { NextResponse } from "next/server";
import { z } from "zod";
import {
  chunkDocumentContent,
  cleanText,
  crawlWebsiteForContent,
  extractTextFromUploadedFile,
  type IngestSourceType,
} from "@/lib/ai/chunker";
import { generateEmbeddingsBatch } from "@/lib/ai/embeddings";
import { withRetry } from "@/lib/ai/retry";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const sourceTypeSchema = z.enum(["pdf", "docx", "csv", "url", "text", "faq"]);

const baseRequestSchema = z.object({
  sourceType: sourceTypeSchema,
  title: z.string().min(2).max(200),
});

const urlSchema = z.string().url();
const uuidSchema = z.string().uuid();

const MAX_INGEST_CONTENT_CHARS = 500_000;

type IngestionStage =
  | "queued"
  | "extracting"
  | "chunking"
  | "embedding"
  | "storing"
  | "finalizing"
  | "completed"
  | "failed"
  | "cancelled";

interface IngestionSnapshot {
  stage: IngestionStage;
  progressPercent: number;
  updatedAt: string;
  message?: string;
  cancelRequested: boolean;
  retries: {
    extraction: number;
    embedding: number;
    storeChunks: number;
  };
}

class IngestionCancelledError extends Error {
  constructor(message = "Ingestion cancelled by user") {
    super(message);
    this.name = "IngestionCancelledError";
  }
}

const parsePathRules = (input: FormDataEntryValue | null): string[] => {
  if (typeof input !== "string") {
    return [];
  }

  return input
    .split(/[\n,]/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map((segment) => (segment.startsWith("/") ? segment : `/${segment}`));
};

const isCancellationError = (error: unknown): boolean => {
  if (error instanceof IngestionCancelledError) {
    return true;
  }

  return error instanceof Error && error.message.toLowerCase().includes("cancelled");
};

const isRetryableError = (error: unknown): boolean => {
  if (isCancellationError(error)) {
    return false;
  }

  if (!(error instanceof Error)) {
    return true;
  }

  const message = error.message.toLowerCase();

  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("socket") ||
    message.includes("econn") ||
    message.includes("429") ||
    /(^|\D)5\d\d(\D|$)/.test(message)
  );
};

const trimContentForIngestion = (content: string): { value: string; truncated: boolean } => {
  if (content.length <= MAX_INGEST_CONTENT_CHARS) {
    return {
      value: content,
      truncated: false,
    };
  }

  return {
    value: content.slice(0, MAX_INGEST_CONTENT_CHARS),
    truncated: true,
  };
};

const getContentFromRequest = async (
  sourceType: IngestSourceType,
  formData: FormData,
  options: {
    shouldStop?: () => Promise<boolean>;
  } = {}
): Promise<{ content: string; metadata: Record<string, unknown> }> => {
  if (sourceType === "url") {
    const urlInput = String(formData.get("url") ?? "").trim();
    const validatedUrl = urlSchema.safeParse(urlInput);

    if (!validatedUrl.success) {
      throw new Error("A valid URL is required");
    }

    const allowedPathPrefixes = parsePathRules(formData.get("allowed_paths"));
    const disallowedPathPrefixes = parsePathRules(formData.get("disallowed_paths"));

    const crawled = await crawlWebsiteForContent(validatedUrl.data, 50, "SupportPilotBot/1.0", {
      allowedPathPrefixes,
      disallowedPathPrefixes,
      shouldStop: options.shouldStop,
    });

    return {
      content: crawled.content,
      metadata: {
        sourceUrl: validatedUrl.data,
        allowedPathPrefixes,
        disallowedPathPrefixes,
        pagesCrawled: crawled.pagesCrawled,
        pagesWithContent: crawled.pagesWithContent,
        visitedUrls: crawled.visitedUrls,
        crawlDelayMs: crawled.crawlDelayMs,
        crawlSkipped: crawled.skipped,
        crawlTruncated: crawled.truncated,
        crawlCharacters: crawled.totalCharacters,
      },
    };
  }

  if (sourceType === "faq") {
    const question = String(formData.get("faq_question") ?? "").trim();
    const answer = String(formData.get("faq_answer") ?? "").trim();

    if (question.length < 3 || answer.length < 3) {
      throw new Error("FAQ question and answer are required");
    }

    return {
      content: cleanText(`Question: ${question}\nAnswer: ${answer}`),
      metadata: { faqQuestion: question },
    };
  }

  if (sourceType === "text") {
    const text = cleanText(String(formData.get("text") ?? "").trim());

    if (text.length < 10) {
      throw new Error("Text content is too short");
    }

    return {
      content: text,
      metadata: {},
    };
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("File upload is required");
  }

  if (options.shouldStop && (await options.shouldStop())) {
    throw new IngestionCancelledError();
  }

  const extracted = await extractTextFromUploadedFile(file);

  return {
    content: extracted,
    metadata: {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    },
  };
};

/**
 * Ingests one knowledge source, chunks it, embeds it, and stores vectors.
 */
export const POST = async (request: Request) => {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const membershipResult = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membershipResult.error) {
      console.error("Failed to resolve org membership", membershipResult.error);
      return NextResponse.json({ error: "Failed to load organization", code: "ORG_LOOKUP_FAILED" }, { status: 500 });
    }

    if (!membershipResult.data) {
      return NextResponse.json({ error: "Organization membership required", code: "ORG_REQUIRED" }, { status: 403 });
    }

    const formData = await request.formData();

    const baseValidation = baseRequestSchema.safeParse({
      sourceType: String(formData.get("sourceType") ?? ""),
      title: String(formData.get("title") ?? "").trim(),
    });

    if (!baseValidation.success) {
      return NextResponse.json(
        { error: baseValidation.error.issues[0]?.message ?? "Invalid request", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const { sourceType, title } = baseValidation.data;
    const orgId = membershipResult.data.org_id;
    const requestedDocumentId = String(formData.get("documentId") ?? "").trim();

    if (requestedDocumentId.length > 0) {
      const parsedDocumentId = uuidSchema.safeParse(requestedDocumentId);

      if (!parsedDocumentId.success) {
        return NextResponse.json({ error: "Invalid document id", code: "VALIDATION_ERROR" }, { status: 400 });
      }
    }

    let metadataState: Record<string, unknown> = {};

    let retryCounts = {
      extraction: 1,
      embedding: 1,
      storeChunks: 1,
    };

    const buildIngestionState = (
      stage: IngestionStage,
      progressPercent: number,
      message: string | undefined,
      cancelRequested: boolean
    ): IngestionSnapshot => ({
      stage,
      progressPercent,
      updatedAt: new Date().toISOString(),
      message,
      cancelRequested,
      retries: retryCounts,
    });

    const { data: documentRow, error: documentInsertError } = await supabase
      .from("documents")
      .insert({
        ...(requestedDocumentId.length > 0 ? { id: requestedDocumentId } : {}),
        org_id: orgId,
        title,
        source_type: sourceType,
        status: "processing",
        metadata: {
          ingestion: buildIngestionState("queued", 0, "Queued for ingestion", false),
        },
      })
      .select("id")
      .single();

    if (documentInsertError || !documentRow) {
      console.error("Failed to create document row", documentInsertError);
      return NextResponse.json({ error: "Failed to create document", code: "DOCUMENT_CREATE_FAILED" }, { status: 500 });
    }

    const documentId = documentRow.id;

    const readCurrentDocument = async (): Promise<{ status: string; metadata: Record<string, unknown> }> => {
      const { data, error } = await supabase
        .from("documents")
        .select("status,metadata")
        .eq("id", documentId)
        .eq("org_id", orgId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to read ingestion state: ${error.message}`);
      }

      if (!data) {
        throw new Error("Document no longer exists");
      }

      return {
        status: data.status,
        metadata: (data.metadata as Record<string, unknown> | null) ?? {},
      };
    };

    const assertNotCancelled = async (): Promise<void> => {
      const current = await readCurrentDocument();
      const ingestion = (current.metadata.ingestion as { cancelRequested?: boolean } | undefined) ?? {};

      if (ingestion.cancelRequested) {
        throw new IngestionCancelledError();
      }
    };

    const updateDocumentProgress = async (
      stage: IngestionStage,
      progressPercent: number,
      message?: string,
      patch: {
        status?: "processing" | "ready" | "error";
        content?: string;
        chunkCount?: number;
        metadataPatch?: Record<string, unknown>;
      } = {}
    ): Promise<void> => {
      let cancelRequested = false;
      let persistedMetadata: Record<string, unknown> = {};

      try {
        const current = await readCurrentDocument();
        persistedMetadata = current.metadata;
        const ingestion = (persistedMetadata.ingestion as { cancelRequested?: boolean } | undefined) ?? {};
        cancelRequested = Boolean(ingestion.cancelRequested);
      } catch {
        // Fall back to in-memory metadata if read fails.
      }

      const nextIngestion = buildIngestionState(stage, progressPercent, message, cancelRequested || stage === "cancelled");

      metadataState = {
        ...persistedMetadata,
        ...metadataState,
        ...(patch.metadataPatch ?? {}),
        ingestion: nextIngestion,
      };

      const updatePayload: {
        status?: "processing" | "ready" | "error";
        content?: string;
        chunk_count?: number;
        metadata: Record<string, unknown>;
      } = {
        metadata: metadataState,
      };

      if (patch.status) {
        updatePayload.status = patch.status;
      }

      if (typeof patch.content === "string") {
        updatePayload.content = patch.content;
      }

      if (typeof patch.chunkCount === "number") {
        updatePayload.chunk_count = patch.chunkCount;
      }

      const { error: updateError } = await supabase.from("documents").update(updatePayload).eq("id", documentId).eq("org_id", orgId);

      if (updateError) {
        console.error("Failed to update ingestion progress", {
          documentId,
          stage,
          updateError,
        });
      }
    };

    try {
      await assertNotCancelled();
      await updateDocumentProgress("extracting", 15, "Extracting source content", {
        status: "processing",
      });

      const extracted = await withRetry(
        async (attempt) => {
          retryCounts = {
            ...retryCounts,
            extraction: attempt,
          };

          await assertNotCancelled();

          return getContentFromRequest(sourceType, formData, {
            shouldStop: async () => {
              try {
                await assertNotCancelled();
                return false;
              } catch (error) {
                if (isCancellationError(error)) {
                  return true;
                }

                throw error;
              }
            },
          });
        },
        {
          retries: 2,
          shouldRetry: (error) => {
            if (isCancellationError(error)) {
              return false;
            }

            if (!(error instanceof Error)) {
              return true;
            }

            const message = error.message.toLowerCase();

            if (
              message.includes("required") ||
              message.includes("unsupported") ||
              message.includes("valid url") ||
              message.includes("too short")
            ) {
              return false;
            }

            return isRetryableError(error);
          },
        }
      );

      if (!extracted.content || extracted.content.length < 10) {
        throw new Error("No usable content could be extracted from this source");
      }

      await assertNotCancelled();

      const trimmed = trimContentForIngestion(extracted.content);

      await updateDocumentProgress("chunking", 35, "Chunking document content", {
        metadataPatch: {
          ...extracted.metadata,
          contentTruncated: trimmed.truncated,
          contentCharacters: trimmed.value.length,
        },
      });

      const chunks = await chunkDocumentContent(trimmed.value, sourceType, extracted.metadata);

      if (chunks.length === 0) {
        throw new Error("No chunks were generated for this document");
      }

      await assertNotCancelled();

      await updateDocumentProgress("embedding", 55, "Generating embeddings", {
        metadataPatch: {
          generatedChunkCount: chunks.length,
        },
      });

      const embeddings = await withRetry(
        async (attempt) => {
          retryCounts = {
            ...retryCounts,
            embedding: attempt,
          };

          await assertNotCancelled();

          return generateEmbeddingsBatch(chunks.map((chunk) => chunk.content), {
            shouldStop: async () => {
              try {
                await assertNotCancelled();
                return false;
              } catch (error) {
                if (isCancellationError(error)) {
                  return true;
                }

                throw error;
              }
            },
          });
        },
        {
          retries: 2,
          shouldRetry: isRetryableError,
        }
      );

      if (embeddings.length !== chunks.length) {
        throw new Error("Embedding count does not match chunk count");
      }

      await assertNotCancelled();

      await updateDocumentProgress("storing", 78, "Persisting vector chunks");

      const rows = chunks.map((chunk, index) => {
        return {
          document_id: documentId,
          org_id: orgId,
          content: chunk.content,
          token_count: chunk.tokenCount,
          embedding: embeddings[index],
          metadata: chunk.metadata,
        };
      });

      await withRetry(
        async (attempt) => {
          retryCounts = {
            ...retryCounts,
            storeChunks: attempt,
          };

          await assertNotCancelled();

          const { error: chunkInsertError } = await supabase.from("document_chunks").insert(rows);

          if (chunkInsertError) {
            throw new Error(chunkInsertError.message);
          }
        },
        {
          retries: 2,
          shouldRetry: isRetryableError,
        }
      );

      await assertNotCancelled();

      await updateDocumentProgress("finalizing", 92, "Finalizing document");

      await updateDocumentProgress("completed", 100, "Ingestion completed", {
        status: "ready",
        content: trimmed.value,
        chunkCount: chunks.length,
        metadataPatch: {
          ingestionCompletedAt: new Date().toISOString(),
        },
      });

      console.info("Document ingestion completed", {
        documentId,
        orgId,
        chunkCount: chunks.length,
        retryCounts,
      });

      return NextResponse.json(
        {
          data: {
            documentId,
            chunkCount: chunks.length,
            sourceType,
            retries: retryCounts,
          },
        },
        { status: 200 }
      );
    } catch (ingestError) {
      const cancellationRequested = isCancellationError(ingestError);
      const message = cancellationRequested
        ? "Ingestion cancelled by user"
        : ingestError instanceof Error
          ? ingestError.message
          : "Unknown ingestion error";

      console.error("Document ingestion failed", {
        documentId,
        message,
      });

      await updateDocumentProgress(cancellationRequested ? "cancelled" : "failed", 100, message, {
        status: "error",
        metadataPatch: {
          error: message,
          ingestionFailedAt: new Date().toISOString(),
          cancelled: cancellationRequested,
        },
      });

      return NextResponse.json(
        { error: message, code: cancellationRequested ? "INGESTION_CANCELLED" : "INGESTION_FAILED" },
        { status: cancellationRequested ? 409 : 400 }
      );
    }
  } catch (error) {
    console.error("Unhandled ingestion route error", error);
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
};
