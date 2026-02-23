"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface DocumentListItem {
  id: string;
  title: string;
  source_type: string;
  status: string;
  chunk_count: number;
  created_at: string;
  metadata?: {
    ingestion?: {
      stage?: string;
      progressPercent?: number;
      message?: string;
      cancelRequested?: boolean;
      retries?: {
        extraction?: number;
        embedding?: number;
        storeChunks?: number;
      };
    };
  } | null;
}

interface DocumentListProps {
  documents: DocumentListItem[];
}

const isTerminalStatus = (status: string): boolean => {
  return status === "ready" || status === "error";
};

/**
 * Displays ingested knowledge base documents with status, progress, and deletion.
 */
export const DocumentList = ({ documents }: DocumentListProps) => {
  const router = useRouter();
  const [rows, setRows] = useState<DocumentListItem[]>(documents);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const [cancellingIds, setCancellingIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setRows(documents);
  }, [documents]);

  const processingIds = useMemo(() => {
    return rows.filter((row) => !isTerminalStatus(row.status)).map((row) => row.id);
  }, [rows]);

  useEffect(() => {
    if (processingIds.length === 0) {
      return;
    }

    let cancelled = false;

    const pollStatuses = async () => {
      try {
        const responses = await Promise.all(
          processingIds.map(async (id) => {
            const response = await fetch(`/api/ingest/${id}`, {
              method: "GET",
              cache: "no-store",
            });

            if (!response.ok) {
              return null;
            }

            const body = (await response.json().catch(() => null)) as
              | {
                  data?: {
                    document?: DocumentListItem;
                  };
                }
              | null;

            return body?.data?.document ?? null;
          })
        );

        if (cancelled) {
          return;
        }

        const byId = new Map<string, DocumentListItem>();

        responses.forEach((document) => {
          if (document) {
            byId.set(document.id, document);
          }
        });

        if (byId.size === 0) {
          return;
        }

        setRows((previous) => {
          return previous.map((row) => {
            const updated = byId.get(row.id);
            return updated ?? row;
          });
        });
      } catch {
        // Keep polling silently; transient failures are expected.
      }
    };

    void pollStatuses();

    const intervalId = setInterval(() => {
      void pollStatuses();
    }, 1500);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [processingIds]);

  const onDelete = async (id: string): Promise<void> => {
    setActionError(null);
    setDeletingIds((previous) => ({ ...previous, [id]: true }));

    try {
      const response = await fetch(`/api/knowledge-base/documents/${id}`, {
        method: "DELETE",
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setActionError(body?.error ?? "Failed to delete document");
        return;
      }

      setRows((previous) => previous.filter((row) => row.id !== id));
      router.refresh();
    } catch {
      setActionError("Failed to delete document");
    } finally {
      setDeletingIds((previous) => ({ ...previous, [id]: false }));
    }
  };

  const onCancel = async (id: string): Promise<void> => {
    setActionError(null);
    setCancellingIds((previous) => ({ ...previous, [id]: true }));

    try {
      const response = await fetch(`/api/ingest/${id}`, {
        method: "POST",
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setActionError(body?.error ?? "Failed to cancel ingestion");
        return;
      }

      setRows((previous) =>
        previous.map((row) => {
          if (row.id !== id) {
            return row;
          }

          return {
            ...row,
            metadata: {
              ...(row.metadata ?? {}),
              ingestion: {
                ...(row.metadata?.ingestion ?? {}),
                cancelRequested: true,
                message: "Cancellation requested",
              },
            },
          };
        })
      );
    } catch {
      setActionError("Failed to cancel ingestion");
    } finally {
      setCancellingIds((previous) => ({ ...previous, [id]: false }));
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Documents</h2>
      <p className="mt-1 text-sm text-slate-600">Track upload status, progress, and chunk counts for each source.</p>

      {actionError ? <p className="mt-3 text-sm text-rose-600">{actionError}</p> : null}

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No documents yet. Upload your first source above.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="py-2 pr-4 font-medium">Title</th>
                <th className="py-2 pr-4 font-medium">Source</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Progress</th>
                <th className="py-2 pr-4 font-medium">Chunks</th>
                <th className="py-2 pr-4 font-medium">Uploaded</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((document) => {
                const progressPercent = document.metadata?.ingestion?.progressPercent;
                const stage = document.metadata?.ingestion?.stage;
                const message = document.metadata?.ingestion?.message;
                const cancelRequested = Boolean(document.metadata?.ingestion?.cancelRequested);
                const progress = typeof progressPercent === "number" ? Math.max(0, Math.min(100, progressPercent)) : 0;

                return (
                  <tr key={document.id} className="border-b border-slate-100 text-slate-700">
                    <td className="py-3 pr-4">{document.title}</td>
                    <td className="py-3 pr-4 uppercase">{document.source_type}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          document.status === "ready"
                            ? "bg-emerald-100 text-emerald-700"
                            : document.status === "error"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {document.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase text-slate-600">
                          {typeof progressPercent === "number" ? `${progress}%` : "-"}
                        </p>
                        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-slate-700 transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="text-xs text-slate-500">{stage ?? "-"}</p>
                        {message ? <p className="text-xs text-slate-500">{message}</p> : null}
                      </div>
                    </td>
                    <td className="py-3 pr-4">{document.chunk_count}</td>
                    <td className="py-3 pr-4">{new Date(document.created_at).toLocaleString()}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {!isTerminalStatus(document.status) ? (
                          <button
                            type="button"
                            disabled={Boolean(cancellingIds[document.id]) || cancelRequested}
                            onClick={() => {
                              void onCancel(document.id);
                            }}
                            className="rounded-md border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {cancellingIds[document.id] ? "Stopping..." : cancelRequested ? "Stop Requested" : "Stop"}
                          </button>
                        ) : null}

                        <button
                          type="button"
                          disabled={Boolean(deletingIds[document.id]) || !isTerminalStatus(document.status)}
                          onClick={() => {
                            void onDelete(document.id);
                          }}
                          className="rounded-md border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingIds[document.id] ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
