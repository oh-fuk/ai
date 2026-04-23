
'use server';

/**
 * @fileOverview Generates a quiz from a PDF document.
 *
 * - generateQuizFromPdf - A function that generates a quiz from a PDF document.
 * - GenerateQuizFromPdfInput - The input type for the generateQuizFromPdf function.
 * - GenerateQuizFromPdfOutput - The return type for the generateQuizFromPdf function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateQuizFromPdfInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      "The PDF document as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  topic: z.string().describe('The topic of the quiz.'),
  numberOfQuestions: z.number().describe('The number of questions to generate.'),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().describe('Difficulty level: easy | medium | hard'),
  specificTopic: z.string().optional().describe('A specific chapter or topic within the PDF to focus on.'),
  pageRange: z.string().optional().describe('A page range to focus on, e.g., "5-10".')
});

export type GenerateQuizFromPdfInput = z.infer<typeof GenerateQuizFromPdfInputSchema>;

const GenerateQuizFromPdfOutputSchema = z.object({
  quiz: z.string().describe('A JSON string representing the generated quiz. It should have a "questions" property which is an array of objects, each with "question", "options" (an array of 4 strings), and "correctAnswer" properties.'),
  progress: z.string().describe('A short summary of the quiz generation process.'),
});

export type GenerateQuizFromPdfOutput = z.infer<typeof GenerateQuizFromPdfOutputSchema>;

export async function generateQuizFromPdf(input: GenerateQuizFromPdfInput): Promise<GenerateQuizFromPdfOutput> {
  return generateQuizFromPdfFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateQuizFromPdfPrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: GenerateQuizFromPdfInputSchema },
  output: { schema: GenerateQuizFromPdfOutputSchema },
  prompt: `You are a quiz generator. Given a PDF document and a topic, generate a quiz with the specified number of questions.

The output MUST be a JSON string. The JSON object should have a single key "questions".
The value of "questions" should be an array of question objects.
Each question object must have the following properties:
- "question": A string containing the question text.
- "options": An array of exactly 4 strings representing the multiple-choice options.
- "correctAnswer": A string that exactly matches one of the provided options.

IMPORTANT: Do not use any special characters or symbols in your response.

Topic: {{{topic}}}
Number of Questions: {{{numberOfQuestions}}}
Requested Difficulty: {{{difficulty}}}
PDF Content: {{media url=pdfDataUri}}

{{#if specificTopic}}
Please focus on the chapter or topic: {{{specificTopic}}}.
{{/if}}
{{#if pageRange}}
Please focus on pages: {{{pageRange}}}.
{{/if}}

If both a specific topic and page range are provided, use them to narrow down the relevant content in the PDF.

Generate the quiz now.`,
});

const generateQuizFromPdfFlow = ai.defineFlow(
  {
    name: 'generateQuizFromPdfFlow',
    inputSchema: GenerateQuizFromPdfInputSchema,
    outputSchema: GenerateQuizFromPdfOutputSchema,
  },
  async (input: any) => {
    try {
      const { output } = await prompt(input);
      return {
        ...output!,
        progress: `Generated a ${input.difficulty || 'medium'} quiz with ${input.numberOfQuestions} questions based on the uploaded PDF.`,
      };
    } catch (error: any) {
      console.error('Error in generateQuizFromPdfFlow:', error);
      throw new Error(
        `Failed to generate quiz from PDF: ${error?.message || 'API request failed'}. Please check your internet connection and API configuration.`
      );
    }
  }
);
