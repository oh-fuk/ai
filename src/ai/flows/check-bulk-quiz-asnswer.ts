
'use server';
/**
 * @fileOverview An AI agent that checks a full list of quiz answers, explains
 * why each is right or wrong, and provides the best solution.
 *
 * - checkBulkQuizAnswers - A function that handles the bulk quiz answer checking process.
 * - CheckBulkQuizAnswersInput - The input type for the function.
 * - CheckBulkQuizAnswersOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { GEMINI_MODEL } from '@/ai/model';
import { z } from 'genkit';

const AnswerToCheckSchema = z.object({
  question: z.string().describe('The quiz question.'),
  studentAnswer: z.string().describe("The student's answer to the question."),
  correctAnswer: z.string().describe('The correct answer to the question.'),
});

const CheckBulkQuizAnswersInputSchema = z.object({
  answers: z.array(AnswerToCheckSchema),
});
export type CheckBulkQuizAnswersInput = z.infer<typeof CheckBulkQuizAnswersInputSchema>;

const AnswerResultSchema = z.object({
  isCorrect: z.boolean().describe("Whether the student's answer is correct."),
  explanation: z.string().describe('A clear explanation of why the answer is wrong or correct.'),
});

const CheckBulkQuizAnswersOutputSchema = z.object({
  results: z.array(AnswerResultSchema),
});
export type CheckBulkQuizAnswersOutput = z.infer<typeof CheckBulkQuizAnswersOutputSchema>;
export type AnswerResult = z.infer<typeof AnswerResultSchema>;


export async function checkBulkQuizAnswers(
  input: CheckBulkQuizAnswersInput
): Promise<CheckBulkQuizAnswersOutput> {
  return checkBulkQuizAnswersFlow(input);
}


const prompt = ai.definePrompt({
  name: 'checkBulkQuizAnswersPrompt',
  model: GEMINI_MODEL,
  input: { schema: CheckBulkQuizAnswersInputSchema },
  output: { schema: CheckBulkQuizAnswersOutputSchema },
  prompt: `You are an AI quiz grading assistant. Your task is to evaluate a list of student answers for a multiple-choice quiz.

For each question provided, you must:
1.  Compare the student's answer to the correct answer.
2.  Determine if the student's answer is correct.
3.  Provide a clear, concise explanation for why the answer is correct or incorrect.

Return an array of result objects, one for each question in the input.

**Quiz Questions and Answers to Evaluate:**
---
{{#each answers}}
**Question {{@index}}:**
- **Question:** {{{this.question}}}
- **Student's Answer:** {{{this.studentAnswer}}}
- **Correct Answer:** {{{this.correctAnswer}}}
---
{{/each}}

Now, generate the results for all questions.`,
});

const checkBulkQuizAnswersFlow = ai.defineFlow(
  {
    name: 'checkBulkQuizAnswersFlow',
    inputSchema: CheckBulkQuizAnswersInputSchema,
    outputSchema: CheckBulkQuizAnswersOutputSchema,
  },
  async (input: any) => {
    const { output } = await prompt(input);
    return output!;
  }
);
