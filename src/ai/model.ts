/**
 * Single Claude model id for every Genkit text / structured flow.
 * Set ANTHROPIC_MODEL in env to override (e.g. anthropic/claude-3-5-sonnet-20241022).
 */
export const ANTHROPIC_MODEL: string =
  process.env.ANTHROPIC_MODEL?.trim() || "anthropic/claude-3-5-haiku";
