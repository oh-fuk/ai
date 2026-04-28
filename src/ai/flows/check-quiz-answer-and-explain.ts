'use server';
/**
 * @fileOverview An AI agent that checks a quiz answer, explains why it's wrong,
 * and provides the best solution with reasoning.
 *
 * - checkQuizAnswerAndExplain - A function that handles the quiz answer checking process.
 * - CheckQuizAnswerAndExplainInput - The input type for the checkQuizAnswerAndExplain function.
 * - CheckQuizAnswerAndExplainOutput - The return type for the checkQuizAnswerAndExplain function.
 */

import { ai } from '@/ai/genkit';
import { GEMINI_MODEL } from '@/ai/model';
import { z } from 'genkit';

const CheckQuizAnswerAndExplainInputSchema = z.object({
  question: z.string().describe('The quiz question.'),
  studentAnswer: z.string().describe("The student's answer to the question."),
  correctAnswer: z.string().describe('The correct answer to the question.'),
  explanation: z.string().describe('The explanation of the correct answer.'),
});
export type CheckQuizAnswerAndExplainInput = z.infer<
  typeof CheckQuizAnswerAndExplainInputSchema
>;

const CheckQuizAnswerAndExplainOutputSchema = z.object({
  isCorrect: z.boolean().describe("Whether the student's answer is correct."),
  explanation: z.string().describe('Explanation of why the answer is wrong or correct.'),
  bestSolution: z.string().describe('The best solution or answer with reasoning.'),
});
export type CheckQuizAnswerAndExplainOutput = z.infer<
  typeof CheckQuizAnswerAndExplainOutputSchema
>;

export async function checkQuizAnswerAndExplain(
  input: CheckQuizAnswerAndExplainInput
): Promise<CheckQuizAnswerAndExplainOutput> {
  return checkQuizAnswerAndExplainFlow(input);
}

const prompt = ai.definePrompt({
  name: 'checkQuizAnswerAndExplainPrompt',
  model: GEMINI_MODEL,
  input: { schema: CheckQuizAnswerAndExplainInputSchema },
  output: { schema: CheckQuizAnswerAndExplainOutputSchema },
  prompt: `You are an AI quiz checker that helps students understand their mistakes.

You will be given a question, a student's answer, the correct answer, and an explanation of the correct answer.

Your job is to determine if the student's answer is correct, explain why it is wrong (or why it is correct), and provide the best solution or answer with reasoning.

IMPORTANT: Do not use any special characters or symbols in your response.

Question: {{{question}}}
Student's Answer: {{{studentAnswer}}}
Correct Answer: {{{correctAnswer}}}
Explanation: {{{explanation}}}

\nOutput in JSON format:
`,
});

const checkQuizAnswerAndExplainFlow = ai.defineFlow(
  {
    name: 'checkQuizAnswerAndExplainFlow',
    inputSchema: CheckQuizAnswerAndExplainInputSchema,
    outputSchema: CheckQuizAnswerAndExplainOutputSchema,
  },
  async (input: any) => {
    const { output } = await prompt(input);
    return output!;
  }
);
