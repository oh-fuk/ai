
'use server';

/**
 * @fileOverview An AI agent for generating exam papers from a prompt.
 *
 * - generatePaperFromPrompt - A function that handles the paper generation process.
 * - GeneratePaperInput - The input type for the generatePaperFromPrompt function.
 * - GeneratePaperOutput - The return type for the generatePaperFromPrompt function.
 */

import { ai } from '@/ai/genkit';
import { ANTHROPIC_MODEL } from '@/ai/model';
import { z } from 'genkit';
import { analyzeBook } from './analyze-book';

const GeneratePaperInputSchema = z.object({
  prompt: z.string().describe('The prompt, topic, or book name for the paper.'),
  subject: z.string().optional().describe('The subject of the paper.'),
  pdfDataUri: z
    .string()
    .optional()
    .describe(
      "The PDF document as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  mcqCount: z.number().describe('Number of multiple choice questions'),
  shortCount: z.number().describe('Number of short answer questions'),
  longCount: z.number().describe('Number of long answer questions'),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().describe('Difficulty level: easy | medium | hard'),
  specificTopic: z.string().optional().describe('A specific chapter or topic within the PDF to focus on.'),
  pageRange: z.string().optional().describe('A page range to focus on, e.g., "5-10".')
});
export type GeneratePaperInput = z.infer<typeof GeneratePaperInputSchema>;

const GeneratePaperOutputSchema = z.object({
  bookIntro: z.string().optional().describe("A 4-6 line introduction to the book if a book name was provided in the prompt."),
  paper: z
    .object({
      questions: z.array(
        z.object({
          question: z.string(),
          type: z.enum(['mcq', 'short', 'long']),
          options: z.array(z.string()).optional(),
          correctAnswer: z.string(),
        })
      ),
    })
    .describe(
      'The generated exam paper. It should have a "questions" property which is an array of objects.'
    ),
  progress: z.string().describe('The progress of the generation.'),
});
export type GeneratePaperOutput = z.infer<typeof GeneratePaperOutputSchema>;

export async function generatePaperFromPrompt(
  input: GeneratePaperInput
): Promise<GeneratePaperOutput> {
  return generatePaperFromPromptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePaperPrompt',
  model: ANTHROPIC_MODEL,
  input: {
    schema: z.object({
      ...GeneratePaperInputSchema.shape,
      // The prompt will receive raw text, not the PDF URI
      pdfDataUri: z.string().optional(),
      extractedText: z.string().optional(),
    })
  },
  output: { schema: GeneratePaperOutputSchema },
  prompt: `You are an expert exam paper creator. Your task is to generate a well-structured exam paper based on the user's topic and question counts.

**Instructions:**
1.  **Analyze the Prompt:** The user will provide a topic or a full book name.
2.  **Book Introduction (If Applicable):** If the prompt is a recognizable book title, you MUST first generate a concise 4-6 line introduction about the book, including its author and key themes. This introduction should be placed in the 'bookIntro' field. If the prompt is a general topic and not a specific book, leave the 'bookIntro' field empty.
3.  **Generate Paper:** Create an exam paper based on the provided topic or the content of the identified book.

**Output Requirements:**
The output MUST be a JSON object.
- "bookIntro": A 4-6 line introduction if a book is identified. Otherwise, it should be null or an empty string.
- "paper": a JSON object containing a "questions" array.
- Each question object must have:
  - "question": A string containing the question text.
  - "type": One of 'mcq', 'short', 'long'.
  - "options": An array of exactly 4 strings (ONLY for 'mcq' type questions).
  - "correctAnswer": A string representing the correct answer. For 'mcq', it must match one of the options. For 'short' and 'long', provide a model answer.

IMPORTANT: Do not use any special characters or symbols in your response.

Topic/Book: {{{prompt}}}
Number of MCQs: {{{mcqCount}}}
Number of Short Answer Questions: {{{shortCount}}}
Number of Long Answer Questions: {{{longCount}}}
Requested Difficulty: {{{difficulty}}}

{{#if extractedText}}
Reference Material (from PDF):
---
{{{extractedText}}}
---

{{#if specificTopic}}
Please focus on the chapter or topic: {{{specificTopic}}}.
{{/if}}
{{#if pageRange}}
Please focus on pages: {{{pageRange}}}.
{{/if}}

If both a specific topic and page range are provided, use them to narrow down the relevant content in the PDF.
{{/if}}

Generate the response now.`,
});

const generatePaperFromPromptFlow = ai.defineFlow(
  {
    name: 'generatePaperFromPromptFlow',
    inputSchema: GeneratePaperInputSchema,
    outputSchema: GeneratePaperOutputSchema,
  },
  async (input: any) => {
    let extractedText: string | undefined;

    if (input.pdfDataUri) {
      // Use the robust analyzeBook flow to handle large PDFs
      const textExtractionResult = await analyzeBook({ bookPdfDataUri: input.pdfDataUri, subjectName: input.subject || 'general' });
      extractedText = textExtractionResult.extractedText;
    }

    const { output } = await prompt({
      ...input,
      extractedText: extractedText,
      pdfDataUri: undefined, // Prevent passing the large file to the final prompt
    });

    return {
      ...output!,
      progress: `Generated a ${input.difficulty || 'medium'} exam paper based on the user-provided prompt.`,
    };
  }
);
