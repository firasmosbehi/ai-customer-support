"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

interface MatchItem {
  id: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "what",
  "when",
  "where",
  "your",
  "from",
  "about",
  "have",
  "will",
  "would",
  "could",
  "should",
  "does",
  "into",
  "then",
  "them",
  "they",
]);

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const getHighlightTerms = (question: string): string[] => {
  const parts = question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !STOP_WORDS.has(part));

  return Array.from(new Set(parts)).slice(0, 8);
};

const renderHighlighted = (content: string, terms: string[]) => {
  if (terms.length === 0) {
    return content;
  }

  const regex = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const parts = content.split(regex);

  return parts.map((part, index) => {
    const lower = part.toLowerCase();

    if (terms.includes(lower)) {
      return (
        <mark key={`${part}-${index}`} className="rounded bg-amber-200 px-0.5 text-slate-900">
          {part}
        </mark>
      );
    }

    return <span key={`${part}-${index}`}>{part}</span>;
  });
};

/**
 * Sends a test question and shows retrieved chunks with similarity scores.
 */
export const KnowledgeBaseTester = () => {
  const [question, setQuestion] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);

  const highlightTerms = useMemo(() => getHighlightTerms(lastQuestion), [lastQuestion]);

  const onTest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsLoading(true);
    setError(null);

    const response = await fetch("/api/knowledge-base/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question,
        limit: 5,
        threshold: 0.5,
      }),
    });

    const body = (await response.json().catch(() => null)) as
      | { data?: { matches: MatchItem[] }; error?: string }
      | null;

    if (!response.ok) {
      setError(body?.error ?? "Failed to test retrieval");
      setMatches([]);
      setIsLoading(false);
      return;
    }

    setLastQuestion(question);
    setMatches(body?.data?.matches ?? []);
    setIsLoading(false);
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Test Knowledge Retrieval</h2>
      <p className="mt-1 text-sm text-slate-600">Ask a question to inspect which chunks the RAG pipeline retrieves.</p>

      <form onSubmit={onTest} className="mt-4 flex flex-col gap-3">
        <textarea
          required
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={3}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="What is your cancellation policy?"
        />
        <Button disabled={isLoading} type="submit">
          {isLoading ? "Testing..." : "Run retrieval test"}
        </Button>
      </form>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      {matches.length > 0 ? (
        <div className="mt-4 space-y-3">
          {matches.map((match, index) => {
            const source = typeof match.metadata.sourceUrl === "string" ? match.metadata.sourceUrl : null;
            const fileName = typeof match.metadata.fileName === "string" ? match.metadata.fileName : null;
            const chunkIndex = typeof match.metadata.chunkIndex === "number" ? match.metadata.chunkIndex : null;

            return (
              <article key={match.id} className="rounded-md border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Match {index + 1} • Similarity {match.similarity.toFixed(3)}
                </p>

                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                  {source ? <span className="rounded bg-slate-100 px-2 py-1">Source URL: {source}</span> : null}
                  {fileName ? <span className="rounded bg-slate-100 px-2 py-1">File: {fileName}</span> : null}
                  {chunkIndex !== null ? <span className="rounded bg-slate-100 px-2 py-1">Chunk: {chunkIndex}</span> : null}
                </div>

                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{renderHighlighted(match.content, highlightTerms)}</p>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
};
