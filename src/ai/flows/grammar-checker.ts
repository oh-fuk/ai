
'use server';
/**
 * @fileOverview An AI agent that checks text for grammar mistakes and provides corrections.
 *
 * - checkGrammar - A function that handles the grammar checking process.
 * - GrammarCheckerInput - The input type for the function.
 * - GrammarCheckerOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GrammarCheckerInputSchema = z.object({
  text: z.string().describe('The text to be checked for grammatical errors.'),
});
export type GrammarCheckerInput = z.infer<typeof GrammarCheckerInputSchema>;

const CorrectionSchema = z.object({
  original: z.string().describe('The original phrase or sentence with the mistake.'),
  corrected: z.string().describe('The corrected version of the phrase or sentence.'),
  explanation: z.string().describe('A clear and simple explanation of the grammatical error and the reason for the correction.'),
});
export type Correction = z.infer<typeof CorrectionSchema>;

const GrammarCheckerOutputSchema = z.object({
  corrections: z.array(CorrectionSchema).describe('An array of corrections for the provided text. If no errors are found, this array will be empty.'),
});
export type GrammarCheckerOutput = z.infer<typeof GrammarCheckerOutputSchema>;

export async function checkGrammar(input: GrammarCheckerInput): Promise<GrammarCheckerOutput> {
  return grammarCheckerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'grammarCheckerPrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: GrammarCheckerInputSchema },
  output: { schema: GrammarCheckerOutputSchema },
  prompt: `You are an expert grammar and proofreading assistant. Your task is to analyze the following text, identify any grammatical errors, and provide clear corrections and explanations.

**Instructions:**
1.  Read the entire text carefully.
2.  For each error you find (including spelling, punctuation, syntax, and style issues), create a correction object.
3.  In the 'original' field, put the specific phrase or sentence containing the error.
4.  In the 'corrected' field, provide the corrected version.
5.  In the 'explanation' field, write a simple and easy-to-understand explanation of what was wrong and why the correction is better.
6.  If the text has no errors, return an empty 'corrections' array.

**Text to Analyze:**
---
{{{text}}}
---

Now, generate your analysis and provide the corrections.`,
});

const grammarCheckerFlow = ai.defineFlow(
  {
    name: 'grammarCheckerFlow',
    inputSchema: GrammarCheckerInputSchema,
    outputSchema: GrammarCheckerOutputSchema,
  },
  async (input: any) => {
    const { output } = await prompt(input);
    return output!;
  }
);
