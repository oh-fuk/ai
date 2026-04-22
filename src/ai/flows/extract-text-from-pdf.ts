
'use server';
/**
 * @fileOverview An AI agent that extracts text from a PDF document.
 *
 * - extractTextFromPdf - A function that handles the text extraction process.
 * - PdfToTextInput - The input type for the extractTextFromPdf function.
 * - PdfToTextOutput - The return type for the extractTextFromPdf function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const PdfToTextInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      "A PDF document, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:application/pdf;base64,<encoded_data>'."
    ),
});
export type PdfToTextInput = z.infer<typeof PdfToTextInputSchema>;

const PdfToTextOutputSchema = z.object({
  extractedText: z
    .string()
    .describe(
      'All text extracted from the PDF, preserving formatting as much as possible.'
    ),
});
export type PdfToTextOutput = z.infer<typeof PdfToTextOutputSchema>;

export async function extractTextFromPdf(
  input: PdfToTextInput
): Promise<PdfToTextOutput> {
  return extractTextFromPdfFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractTextFromPdfPrompt',
  model: 'googleai/gemini-2.0-flash',
  input: { schema: PdfToTextInputSchema },
  output: { schema: PdfToTextOutputSchema },
  prompt: `You are an expert data extractor. Your task is to extract all the text content from the provided PDF document.

Preserve the original formatting, including paragraphs, headings, and line breaks, as accurately as possible.

IMPORTANT: Do not use any special characters or symbols in your response.

PDF to analyze:
{{media url=pdfDataUri}}
`,
});

const extractTextFromPdfFlow = ai.defineFlow(
  {
    name: 'extractTextFromPdfFlow',
    inputSchema: PdfToTextInputSchema,
    outputSchema: PdfToTextOutputSchema,
  },
  async (input: any) => {
    const { output } = await prompt(input);
    return output!;
  }
);
