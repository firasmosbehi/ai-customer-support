import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { getRequiredEnv } from "@/lib/env";

let anthropicClient: Anthropic | null = null;

/**
 * Returns a singleton Anthropic SDK client.
 */
export const getAnthropicClient = (): Anthropic => {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: getRequiredEnv("ANTHROPIC_API_KEY"),
    });
  }

  return anthropicClient;
};

/**
 * Streams text completion from Anthropic via Vercel AI SDK.
 */
export const streamAnthropicResponse = (
  prompt: string,
  model: "claude-sonnet-4-5-20250514" | "claude-haiku-4-5-20251001" = "claude-sonnet-4-5-20250514"
 ) => {
  return streamText({
    model: anthropic(model),
    prompt,
  });
};
