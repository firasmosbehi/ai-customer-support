import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { CLASSIFIER_PROMPT } from "@/lib/ai/prompts";

export const CLASSIFIER_CATEGORIES = [
  "SUPPORT_QUESTION",
  "GREETING",
  "ESCALATION_REQUEST",
  "COMPLAINT",
  "SPAM",
  "OTHER",
] as const;

export type ClassifierCategory = (typeof CLASSIFIER_CATEGORIES)[number];

/**
 * Classifies a user message into one predefined intent category.
 */
export const classifyMessageIntent = async (message: string): Promise<ClassifierCategory> => {
  const prompt = CLASSIFIER_PROMPT.replace("{message}", message);

  const { text } = await generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    prompt,
  });

  const normalized = text.trim().toUpperCase();

  if (CLASSIFIER_CATEGORIES.includes(normalized as ClassifierCategory)) {
    return normalized as ClassifierCategory;
  }

  return "OTHER";
};
