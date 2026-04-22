'use server';

/**
 * @fileOverview Generates a quiz from a topic within the chat.
 *
 * - generateQuizFromChat - A function that generates a quiz from a topic.
 * - GenerateQuizFromChatInput - The input type for the function.
 * - GenerateQuizFromChatOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateQuizFromChatInputSchema = z.object({
  topic: z.string().describe('The topic of the quiz.'),
  numberOfQuestions: z.number().describe('The number of questions to generate.'),
});

export type GenerateQuizFromChatInput = z.infer<typeof GenerateQuizFromChatInputSchema>;

const GenerateQuizFromChatOutputSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string().describe('The question text.'),
      options: z.array(z.string()).length(4).describe('An array of exactly 4 multiple-choice options.'),
      correctAnswer: z.string().describe('The correct answer, which must match one of the options.'),
    })
  ).describe('An array of generated quiz questions.'),
});

export type GenerateQuizFromChatOutput = z.infer<typeof GenerateQuizFromChatOutputSchema>;

export async function generateQuizFromChat(input: GenerateQuizFromChatInput): Promise<GenerateQuizFromChatOutput> {
  return generateQuizFromChatFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateQuizFromChatPrompt',
  model: 'googleai/gemini-2.5-pro',
  input: { schema: GenerateQuizFromChatInputSchema },
  output: { schema: GenerateQuizFromChatOutputSchema },
  prompt: `You are a quiz generator. Given a topic, generate a quiz with the specified number of questions.

The output MUST be a JSON object containing a "questions" array.
Each question object in the array must have the following properties:
- "question": A string containing the question text.
- "options": An array of exactly 4 strings representing the multiple-choice options.
- "correctAnswer": A string that exactly matches one of the provided options.

IMPORTANT: Do not use any special characters or symbols in your response.

Topic: {{{topic}}}
Number of Questions: {{{numberOfQuestions}}}

Generate the quiz now.`,
});

const generateQuizFromChatFlow = ai.defineFlow(
  {
    name: 'generateQuizFromChatFlow',
    inputSchema: GenerateQuizFromChatInputSchema,
    outputSchema: GenerateQuizFromChatOutputSchema,
  },
  async (input: any) => {
    const { output } = await prompt(input);
    return output!;
  }
);
