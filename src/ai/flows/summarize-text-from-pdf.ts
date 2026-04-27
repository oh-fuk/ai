'use server';
/**
 * @fileOverview Summarizes text from a PDF or text input using AI.
 *
 * - summarizeText - A function that summarizes text.
 * - SummarizeTextInput - The input type for the summarizeText function.
 * - SummarizeTextOutput - The return type for the summarizeText function.
 */

import { ai } from '@/ai/genkit';
import { ANTHROPIC_MODEL } from '@/ai/model';
import { z } from 'genkit';

const SummarizeTextInputSchema = z.object({
  text: z.string().optional().describe('The text to summarize.'),
  pdfDataUri: z
    .string()
    .optional()
    .describe(
      "The PDF document as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  specificTopic: z.string().optional().describe('A specific chapter or topic within the PDF to focus on.'),
  pageRange: z.string().optional().describe('A page range to focus on, e.g., "5-10".')
});
export type SummarizeTextInput = z.infer<typeof SummarizeTextInputSchema>;

const SummarizeTextOutputSchema = z.object({
  summary: z.string().describe('The summary of the text.'),
  progress: z.string().describe('Progress of the flow'),
});
export type SummarizeTextOutput = z.infer<typeof SummarizeTextOutputSchema>;

export async function summarizeText(input: SummarizeTextInput): Promise<SummarizeTextOutput> {
  return summarizeTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeTextPrompt',
  model: ANTHROPIC_MODEL,
  input: { schema: SummarizeTextInputSchema },
  output: { schema: SummarizeTextOutputSchema },
  prompt: `Summarize the following content. IMPORTANT: Do not use any special characters or symbols in your response.
{{#if text}}
Text to summarize:
{{{text}}}
{{/if}}

{{#if pdfDataUri}}
PDF Content to summarize:
{{media url=pdfDataUri}}

{{#if specificTopic}}
Please focus on the chapter or topic: {{{specificTopic}}}.
{{/if}}
{{#if pageRange}}
Please focus on pages: {{{pageRange}}}.
{{/if}}

If both a specific topic and page range are provided, use them to narrow down the relevant content in the PDF for summarization.
{{/if}}
`,
});

const summarizeTextFlow = ai.defineFlow(
  {
    name: 'summarizeTextFlow',
    inputSchema: SummarizeTextInputSchema,
    outputSchema: SummarizeTextOutputSchema,
  },
  async (input: any) => {
    if (!input.text && !input.pdfDataUri) {
      throw new Error('Either text or a PDF must be provided for summarization.');
    }
    const { output } = await prompt(input);
    output!.progress = 'Text summarization completed.';
    return output!;
  }
);
