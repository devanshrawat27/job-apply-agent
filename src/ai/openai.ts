import OpenAI from "openai";

/** Server-only client. Profile and job text are sent only when an API key is explicitly configured. */
export function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
