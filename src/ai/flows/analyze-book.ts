
'use server';
/**
 * @fileOverview An AI agent that analyzes an uploaded textbook.
 *
 * - analyzeBook - A function that processes a textbook PDF.
 * - AnalyzeBookInput - The input type for the function.
 * - AnalyzeBookOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const AnalyzeBookInputSchema = z.object({
  bookPdfDataUri: z.string().describe("The textbook PDF as a data URI."),
  subjectName: z.string().describe("The name of the subject this book is for."),
});
export type AnalyzeBookInput = z.infer<typeof AnalyzeBookInputSchema>;

const AnalyzeBookOutputSchema = z.object({
  analysisSummary: z.string().describe("A concise summary of the book's main topics and structure."),
  extractedText: z.string().describe("The full text extracted from the PDF."),
  keyConcepts: z.array(z.string()).describe("A list of the most important concepts or keywords found in the book."),
});
export type AnalyzeBookOutput = z.infer<typeof AnalyzeBookOutputSchema>;


export async function analyzeBook(input: AnalyzeBookInput): Promise<AnalyzeBookOutput> {
  return analyzeBookFlow(input);
}


const prompt = ai.definePrompt({
  name: 'analyzeBookPrompt',
  model: 'googleai/gemini-2.5-pro',
  input: { schema: AnalyzeBookInputSchema },
  output: { schema: AnalyzeBookOutputSchema },
  prompt: `You are an expert academic analyst. Your task is to process a textbook PDF for a specific subject, extract its content, and provide a structured analysis.

**Subject:** {{{subjectName}}}

**Textbook PDF:**
{{media url=bookPdfDataUri}}

**Instructions:**

1.  **Extract Full Text:** Carefully extract all text content from the provided PDF document. Preserve as much of the original structure (paragraphs, headings) as possible.
2.  **Summarize the Book:** Based on the extracted text, write a concise summary of the book's main purpose, key themes, and overall structure.
3.  **Identify Key Concepts:** Identify a list of the most important keywords, topics, and concepts covered in the book.
3.  **Notes according to book;**If book si uploaded then notes must be according to book pattern.

Generate your analysis now.`,
});

const analyzeBookFlow = ai.defineFlow(
  {
    name: 'analyzeBookFlow',
    inputSchema: AnalyzeBookInputSchema,
    outputSchema: AnalyzeBookOutputSchema,
  },
  async (input: any) => {
    const { output } = await prompt(input);
    return output!;
  }
);

