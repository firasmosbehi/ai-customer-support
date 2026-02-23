"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const FILE_SOURCE_TYPES = ["pdf", "docx", "csv"] as const;

type SourceType = "pdf" | "docx" | "csv" | "url" | "text" | "faq";

interface LiveIngestionStatus {
  documentId: string;
  title: string;
  status: string;
  stage: string;
  progressPercent: number;
  message: string;
}

const isTerminalStatus = (status: string): boolean => {
  return status === "ready" || status === "error";
};

const createClientDocumentId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // RFC4122-ish fallback for environments without crypto.randomUUID.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

/**
 * Upload form for files, URLs, FAQs, and plain text sources.
 */
export const KnowledgeBaseUploader = () => {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<SourceType>("pdf");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveIngestionStatus | null>(null);

  const pollingControllerRef = useRef<{
    stop: () => void;
  } | null>(null);

  const ingestAbortControllerRef = useRef<AbortController | null>(null);

  const progressWidth = useMemo(() => {
    if (!liveStatus) {
      return 0;
    }

    return Math.max(0, Math.min(100, liveStatus.progressPercent));
  }, [liveStatus]);

  const stopPolling = (): void => {
    if (pollingControllerRef.current) {
      pollingControllerRef.current.stop();
      pollingControllerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopPolling();
      ingestAbortControllerRef.current?.abort();
      ingestAbortControllerRef.current = null;
    };
  }, []);

  const beginPolling = (documentId: string, title: string): void => {
    stopPolling();

    let cancelled = false;

    const poll = async () => {
      if (cancelled) {
        return;
      }

      try {
        const response = await fetch(`/api/ingest/${documentId}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const body = (await response.json().catch(() => null)) as
          | {
              data?: {
                document?: {
                  status: string;
                  metadata?: {
                    ingestion?: {
                      stage?: string;
                      progressPercent?: number;
                      message?: string;
                    };
                  } | null;
                };
              };
            }
          | null;

        const document = body?.data?.document;

        if (!document) {
          return;
        }

        const stage = document.metadata?.ingestion?.stage ?? "processing";
        const progressPercent = document.metadata?.ingestion?.progressPercent ?? 0;
        const message = document.metadata?.ingestion?.message ?? "Processing";

        setLiveStatus({
          documentId,
          title,
          status: document.status,
          stage,
          progressPercent,
          message,
        });

        if (isTerminalStatus(document.status)) {
          stopPolling();
          router.refresh();
        }
      } catch {
        // Continue polling on transient failures.
      }
    };

    void poll();

    const intervalId = window.setInterval(() => {
      void poll();
    }, 1500);

    pollingControllerRef.current = {
      stop: () => {
        cancelled = true;
        window.clearInterval(intervalId);
      },
    };
  };

  const onStop = async (): Promise<void> => {
    if (!liveStatus || isTerminalStatus(liveStatus.status)) {
      return;
    }

    setIsCancelling(true);
    setError(null);
    setSuccess(null);

    setLiveStatus((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        message: "Cancellation requested",
      };
    });

    ingestAbortControllerRef.current?.abort();

    try {
      const response = await fetch(`/api/ingest/${liveStatus.documentId}`, {
        method: "POST",
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(body?.error ?? "Failed to request cancellation");
        return;
      }

      setSuccess("Cancellation requested. Waiting for ingestion to stop.");
    } catch {
      setError("Failed to request cancellation");
    } finally {
      setIsCancelling(false);
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    const form = event.currentTarget;
    const payload = new FormData(form);
    const documentId = createClientDocumentId();
    const title = String(payload.get("title") ?? "Untitled");

    payload.set("documentId", documentId);

    setLiveStatus({
      documentId,
      title,
      status: "processing",
      stage: "queued",
      progressPercent: 0,
      message: "Queued for ingestion",
    });

    beginPolling(documentId, title);

    const controller = new AbortController();
    ingestAbortControllerRef.current = controller;

    try {
      const response = await fetch("/api/ingest", {
        method: "POST",
        body: payload,
        signal: controller.signal,
      });

      const body = (await response.json().catch(() => null)) as
        | { data?: { chunkCount: number }; error?: string; code?: string }
        | null;

      if (!response.ok) {
        if (body?.code === "INGESTION_CANCELLED") {
          setSuccess("Ingestion cancelled.");
        } else {
          setError(body?.error ?? "Failed to ingest source");
        }

        return;
      }

      setSuccess(`Ingestion completed with ${body?.data?.chunkCount ?? 0} chunks.`);
      form.reset();
      setSourceType("pdf");
      router.refresh();
    } catch (submitError) {
      const isAbort = submitError instanceof DOMException && submitError.name === "AbortError";

      if (isAbort) {
        setSuccess("Cancellation requested. Waiting for ingestion to stop.");
      } else {
        setError("Failed to ingest source");
      }
    } finally {
      setIsSubmitting(false);
      ingestAbortControllerRef.current = null;
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Add Knowledge Source</h2>
      <p className="mt-1 text-sm text-slate-600">Upload docs or URLs to power retrieval and support answers.</p>

      <form className="mt-4 space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="sourceType">
            Source type
          </label>
          <select
            id="sourceType"
            name="sourceType"
            value={sourceType}
            onChange={(event) => setSourceType(event.target.value as SourceType)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="pdf">PDF</option>
            <option value="docx">DOCX</option>
            <option value="csv">CSV</option>
            <option value="url">Website URL</option>
            <option value="text">Plain Text</option>
            <option value="faq">FAQ Pair</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="title">
            Title
          </label>
          <input
            required
            id="title"
            name="title"
            type="text"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Refund policy"
          />
        </div>

        {FILE_SOURCE_TYPES.includes(sourceType as (typeof FILE_SOURCE_TYPES)[number]) ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="file">
              File
            </label>
            <input required id="file" name="file" type="file" className="w-full text-sm" />
          </div>
        ) : null}

        {sourceType === "url" ? (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="url">
                Website URL
              </label>
              <input
                required
                id="url"
                name="url"
                type="url"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="https://example.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="allowed_paths">
                Allowed paths (optional)
              </label>
              <textarea
                id="allowed_paths"
                name="allowed_paths"
                rows={2}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="/help\n/pricing"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="disallowed_paths">
                Disallowed paths (optional)
              </label>
              <textarea
                id="disallowed_paths"
                name="disallowed_paths"
                rows={2}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="/blog\n/legal"
              />
            </div>
          </>
        ) : null}

        {sourceType === "text" ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="text">
              Text content
            </label>
            <textarea
              required
              id="text"
              name="text"
              rows={6}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Paste support documentation text"
            />
          </div>
        ) : null}

        {sourceType === "faq" ? (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="faq_question">
                Question
              </label>
              <input
                required
                id="faq_question"
                name="faq_question"
                type="text"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="What are your support hours?"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="faq_answer">
                Answer
              </label>
              <textarea
                required
                id="faq_answer"
                name="faq_answer"
                rows={4}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="Our team is available Monday-Friday from 9am to 5pm."
              />
            </div>
          </>
        ) : null}

        {liveStatus ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Live Ingestion</p>
            <p className="mt-1 text-sm font-medium text-slate-800">{liveStatus.title}</p>
            <p className="text-xs text-slate-600">
              {liveStatus.stage} • {liveStatus.status}
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-slate-800 transition-all" style={{ width: `${progressWidth}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-600">{progressWidth}% • {liveStatus.message}</p>
          </div>
        ) : null}

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-700">{success}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button disabled={isSubmitting || isCancelling} type="submit">
            {isSubmitting ? "Ingesting..." : "Ingest source"}
          </Button>

          {liveStatus && !isTerminalStatus(liveStatus.status) ? (
            <Button disabled={isCancelling} type="button" variant="outline" onClick={() => void onStop()}>
              {isCancelling ? "Stopping..." : "Stop ingestion"}
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
};
