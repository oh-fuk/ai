/** Server-only helpers for Claude (Anthropic) via Genkit. */

export { ANTHROPIC_MODEL } from "@/ai/model";

export function hasAnthropicApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function anthropicConfigErrorMessage(): string {
  return "AI is not configured. Add ANTHROPIC_API_KEY to your environment (e.g. .env) so Claude-powered features work. Optional: set ANTHROPIC_MODEL to override the default Claude model id.";
}
