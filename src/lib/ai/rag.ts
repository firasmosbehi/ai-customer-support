import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { CHAT_SYSTEM_PROMPT } from "@/lib/ai/prompts";

export interface RetrievedChunk {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

/**
 * Looks up top matching document chunks using pgvector similarity.
 */
export const retrieveRelevantChunks = async (
  supabase: SupabaseClient,
  params: {
    orgId: string;
    query: string;
    matchThreshold?: number;
    matchCount?: number;
  }
): Promise<RetrievedChunk[]> => {
  const queryEmbedding = await generateEmbedding(params.query);

  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: queryEmbedding,
    match_org_id: params.orgId,
    match_threshold: params.matchThreshold ?? 0.7,
    match_count: params.matchCount ?? 5,
  });

  if (error) {
    throw new Error(`match_documents RPC failed: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    content: string;
    metadata: Record<string, unknown> | null;
    similarity: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    metadata: row.metadata ?? {},
    similarity: row.similarity,
  }));
};

/**
 * Formats retrieved chunks into a prompt-ready context block.
 */
export const buildRetrievedContext = (chunks: RetrievedChunk[]): string => {
  return chunks
    .map((chunk, index) => {
      return `Chunk ${index + 1} (similarity: ${chunk.similarity.toFixed(3)}):\n${chunk.content}`;
    })
    .join("\n\n");
};

/**
 * Generates a grounded response using retrieved context and Claude Sonnet.
 */
export const generateRagAnswer = async (params: {
  businessName: string;
  toneSetting: string;
  userMessage: string;
  conversationHistory: string;
  chunks: RetrievedChunk[];
}): Promise<string> => {
  const context = buildRetrievedContext(params.chunks);

  const systemPrompt = CHAT_SYSTEM_PROMPT.replace("{business_name}", params.businessName)
    .replace("{tone_setting}", params.toneSetting)
    .replace("{retrieved_chunks}", context)
    .replace("{conversation_history}", params.conversationHistory);

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-5-20250514"),
    system: systemPrompt,
    prompt: params.userMessage,
  });

  return text;
};
