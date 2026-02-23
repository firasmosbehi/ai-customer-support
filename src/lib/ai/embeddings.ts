import OpenAI from "openai";
import { getRequiredEnv } from "@/lib/env";

const EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_BATCH_SIZE = 100;

let openAIClient: OpenAI | null = null;

/**
 * Returns a singleton OpenAI client for embeddings.
 */
export const getOpenAIClient = (): OpenAI => {
  if (!openAIClient) {
    openAIClient = new OpenAI({
      apiKey: getRequiredEnv("OPENAI_API_KEY"),
    });
  }

  return openAIClient;
};

/**
 * Generates one embedding vector for the provided text input.
 */
export const generateEmbedding = async (input: string): Promise<number[]> => {
  const client = getOpenAIClient();

  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  });

  return response.data[0]?.embedding ?? [];
};

/**
 * Generates embeddings for many texts in OpenAI-safe batch sizes.
 */
export const generateEmbeddingsBatch = async (
  inputs: string[],
  options: EmbeddingBatchOptions = {}
): Promise<number[][]> => {
  if (inputs.length === 0) {
    return [];
  }

  const client = getOpenAIClient();
  const vectors: number[][] = [];

  for (let index = 0; index < inputs.length; index += MAX_BATCH_SIZE) {
    if (options.shouldStop && (await options.shouldStop())) {
      throw new Error("Ingestion cancelled by user");
    }

    const batch = inputs.slice(index, index + MAX_BATCH_SIZE);

    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });

    response.data.forEach((item) => {
      vectors.push(item.embedding);
    });
  }

  return vectors;
};
export interface EmbeddingBatchOptions {
  shouldStop?: () => Promise<boolean>;
}
