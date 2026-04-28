/** Server-only: Gemini API key check for Genkit routes and flows. */

export { GEMINI_MODEL } from '@/ai/model';

export function hasGeminiApiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function geminiConfigErrorMessage(): string {
  return 'AI is not configured. Add GEMINI_API_KEY in Vercel (Environment Variables) from https://aistudio.google.com/apikey. Optional: GEMINI_MODEL (default googleai/gemini-2.5-flash).';
}
