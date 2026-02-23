import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const terminalStatuses = new Set(["ready", "error"]);

const resolveScopedDocument = async (params: { id: string }) => {
  const parsedParams = paramsSchema.safeParse(params);

  if (!parsedParams.success) {
    return {
      errorResponse: NextResponse.json({ error: "Invalid document id", code: "VALIDATION_ERROR" }, { status: 400 }),
      supabase: null,
      documentId: null,
      orgId: null,
    };
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 }),
      supabase: null,
      documentId: null,
      orgId: null,
    };
  }

  const membershipResult = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipResult.error) {
    console.error("Failed to resolve org membership", membershipResult.error);
    return {
      errorResponse: NextResponse.json({ error: "Failed to load organization", code: "ORG_LOOKUP_FAILED" }, { status: 500 }),
      supabase: null,
      documentId: null,
      orgId: null,
    };
  }

  if (!membershipResult.data) {
    return {
      errorResponse: NextResponse.json({ error: "Organization membership required", code: "ORG_REQUIRED" }, { status: 403 }),
      supabase: null,
      documentId: null,
      orgId: null,
    };
  }

  return {
    errorResponse: null,
    supabase,
    documentId: parsedParams.data.id,
    orgId: membershipResult.data.org_id,
  };
};

/**
 * Returns ingestion status metadata for one document in the current organization.
 */
export const GET = async (
  _request: Request,
  context: { params: { id: string } }
) => {
  try {
    const scoped = await resolveScopedDocument(context.params);

    if (scoped.errorResponse) {
      return scoped.errorResponse;
    }

    if (!scoped.supabase || !scoped.documentId || !scoped.orgId) {
      return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
    }

    const { data: document, error: documentError } = await scoped.supabase
      .from("documents")
      .select("id,title,status,source_type,chunk_count,metadata,created_at,updated_at")
      .eq("id", scoped.documentId)
      .eq("org_id", scoped.orgId)
      .maybeSingle();

    if (documentError) {
      console.error("Failed to load document status", documentError);
      return NextResponse.json({ error: "Failed to load document", code: "DOCUMENT_LOOKUP_FAILED" }, { status: 500 });
    }

    if (!document) {
      return NextResponse.json({ error: "Document not found", code: "DOCUMENT_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ data: { document } }, { status: 200 });
  } catch (error) {
    console.error("Unhandled ingest status route error", error);
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
};

/**
 * Requests cancellation for an in-flight ingestion document.
 */
export const POST = async (
  _request: Request,
  context: { params: { id: string } }
) => {
  try {
    const scoped = await resolveScopedDocument(context.params);

    if (scoped.errorResponse) {
      return scoped.errorResponse;
    }

    if (!scoped.supabase || !scoped.documentId || !scoped.orgId) {
      return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
    }

    const { data: document, error: documentError } = await scoped.supabase
      .from("documents")
      .select("id,status,metadata")
      .eq("id", scoped.documentId)
      .eq("org_id", scoped.orgId)
      .maybeSingle();

    if (documentError) {
      console.error("Failed to load document before cancel", documentError);
      return NextResponse.json({ error: "Failed to cancel ingestion", code: "CANCEL_FAILED" }, { status: 500 });
    }

    if (!document) {
      return NextResponse.json({ error: "Document not found", code: "DOCUMENT_NOT_FOUND" }, { status: 404 });
    }

    if (terminalStatuses.has(document.status)) {
      return NextResponse.json(
        { error: "Ingestion is already finished", code: "INGESTION_ALREADY_FINISHED" },
        { status: 409 }
      );
    }

    const metadata = (document.metadata as Record<string, unknown> | null) ?? {};
    const currentIngestion = (metadata.ingestion as Record<string, unknown> | undefined) ?? {};

    const nextMetadata = {
      ...metadata,
      ingestion: {
        ...currentIngestion,
        cancelRequested: true,
        cancelRequestedAt: new Date().toISOString(),
        message: "Cancellation requested",
      },
    };

    const { error: updateError } = await scoped.supabase
      .from("documents")
      .update({ metadata: nextMetadata })
      .eq("id", scoped.documentId)
      .eq("org_id", scoped.orgId);

    if (updateError) {
      console.error("Failed to update cancellation state", updateError);
      return NextResponse.json({ error: "Failed to cancel ingestion", code: "CANCEL_FAILED" }, { status: 500 });
    }

    return NextResponse.json(
      {
        data: {
          id: scoped.documentId,
          cancelRequested: true,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unhandled cancel route error", error);
    return NextResponse.json({ error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
};
