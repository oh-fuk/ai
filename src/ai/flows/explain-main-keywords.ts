
'use server';
/**
 * @fileOverview An AI agent that identifies and explains main keywords in a given text.
 *
 * - explainMainKeywords - A function that handles the keyword explanation process.
 * - ExplainMainKeywordsInput - The input type for the explainMainKeywords function.
 * - ExplainMainKeywordsOutput - The return type for the explainMainKeywords function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExplainMainKeywordsInputSchema = z.object({
  text: z.string().describe('The text containing keywords that need explanation.'),
  keywords: z.array(z.string()).describe('A list of main keywords identified from the text.'),
});
export type ExplainMainKeywordsInput = z.infer<typeof ExplainMainKeywordsInputSchema>;

const KeywordExplanationSchema = z.object({
  keyword: z.string().describe('The key term identified from the text.'),
  explanation: z
    .string()
    .describe('A detailed explanation of the keyword.'),
});

const ExplainMainKeywordsOutputSchema = z.object({
  explanations: z.array(KeywordExplanationSchema).describe('An array of keywords and their detailed explanations.'),
});
export type ExplainMainKeywordsOutput = z.infer<typeof ExplainMainKeywordsOutputSchema>;
export type KeywordExplanation = z.infer<typeof KeywordExplanationSchema>;


export async function explainMainKeywords(input: ExplainMainKeywordsInput): Promise<ExplainMainKeywordsOutput> {
  return explainMainKeywordsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'explainMainKeywordsPrompt',
  model: 'googleai/gemini-2.5-pro',
  input: { schema: ExplainMainKeywordsInputSchema },
  output: { schema: ExplainMainKeywordsOutputSchema },
  prompt: `You are an expert lexicographer. Your goal is to provide a detailed explanation for each of the provided main keywords based on the full text.

For each keyword, provide a clear and comprehensive definition.

IMPORTANT: Do not use any special characters or symbols in your response.

**Full Text:**
---
{{{text}}}
---

**Keywords to Explain:**
{{#each keywords}}
- {{{this}}}
{{/each}}

Provide your detailed explanations for each keyword now.`,
});

const explainMainKeywordsFlow = ai.defineFlow(
  {
    name: 'explainMainKeywordsFlow',
    inputSchema: ExplainMainKeywordsInputSchema,
    outputSchema: ExplainMainKeywordsOutputSchema,
  },
  async (input: any) => {
    const { output } = await prompt(input);
    return output!;
  }
);
