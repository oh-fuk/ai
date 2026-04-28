/**
 * Default LLM for all Genkit flows (Google Gemini via @genkit-ai/google-genai).
 * Override with GEMINI_MODEL (e.g. googleai/gemini-2.5-flash-lite).
 */
export const GEMINI_MODEL: string =
  process.env.GEMINI_MODEL?.trim() || 'googleai/gemini-2.5-flash';
