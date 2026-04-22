
'use server';

/**
 * @fileOverview An AI agent for generating a remedial quiz based on a student's quiz history.
 *
 * - generateRemedialQuiz - A function that handles the remedial quiz generation process.
 * - GenerateRemedialQuizInput - The input type for the generateRemedialQuiz function.
 * - GenerateRemedialQuizOutput - The return type for the generateRemedialQuiz function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateRemedialQuizInputSchema = z.object({
  quizHistory: z.string().describe("A JSON string representing the user's quiz attempt history. Each item should include quizName, subject, score, and percentage."),
  numberOfQuestions: z.number().describe('The number of questions to generate.'),
});
export type GenerateRemedialQuizInput = z.infer<typeof GenerateRemedialQuizInputSchema>;

const GenerateRemedialQuizOutputSchema = z.object({
  topic: z.string().describe("The primary topic the AI identified as the user's weak point, prefixed with 'Remedial: '. e.g., 'Remedial: Photosynthesis'"),
  quiz: z.string().describe('A JSON string representing the generated quiz. It should have a "questions" property which is an array of objects, each with "question", "options" (an array of 4 strings), and "correctAnswer" properties.'),
  progress: z.string().describe('A short summary of the quiz generation process.'),
});
export type GenerateRemedialQuizOutput = z.infer<typeof GenerateRemedialQuizOutputSchema>;

export async function generateRemedialQuiz(
  input: GenerateRemedialQuizInput
): Promise<GenerateRemedialQuizOutput> {
  return generateRemedialQuizFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateRemedialQuizPrompt',
  model: 'googleai/gemini-2.5-pro',
  input: { schema: GenerateRemedialQuizInputSchema },
  output: { schema: GenerateRemedialQuizOutputSchema },
  prompt: `You are an expert academic tutor. Your task is to analyze a student's quiz history to identify their weakest topic and then generate a targeted multiple-choice quiz to help them improve.

**Step 1: Analyze Performance**
Review the provided quiz history. Look for patterns of low scores (anything below 70%) in specific subjects or topics. Identify the single most significant area of weakness.

**Step 2: Identify the Weakest Topic and Format the Output Topic**
Based on your analysis, determine the primary topic that the student needs the most help with. Your output for the "topic" field MUST be a string formatted as: "Remedial: [Identified Topic Name]". For example, if the weakness is 'Photosynthesis', the output topic must be 'Remedial: Photosynthesis'.

**Step 3: Generate a Targeted Quiz with New Questions**
Create a multiple-choice quiz that exclusively focuses on the weakest topic you identified. CRITICAL: The questions you generate MUST be new and different from any questions that might be inferred from the student's history. Do not repeat questions.

**Output Requirements:**
The output MUST be a JSON object.
- The "topic" field must contain the name of the weak topic you identified, prefixed with "Remedial: ".
- The "quiz" field must be a JSON string. The JSON object should have a single key "questions".
- The value of "questions" should be an array of question objects.
- Each question object must have the following properties:
  - "question": A string containing the question text.
  - "options": An array of exactly 4 strings representing the multiple-choice options.
  - "correctAnswer": A string that exactly matches one of the provided options.

IMPORTANT: Do not use any special characters or symbols in your response.

**Student's Quiz History (JSON):**
{{{quizHistory}}}

**Requested Number of Questions:**
{{{numberOfQuestions}}}

Analyze the history, identify the weakest topic, and generate the targeted quiz with new questions now.`,
});

const generateRemedialQuizFlow = ai.defineFlow(
  {
    name: 'generateRemedialQuizFlow',
    inputSchema: GenerateRemedialQuizInputSchema,
    outputSchema: GenerateRemedialQuizOutputSchema,
  },
  async (input: any) => {
    const { output } = await prompt(input);
    return {
      ...output!,
      progress: `Generated a remedial quiz with ${input.numberOfQuestions} questions on the topic of ${output!.topic}.`,
    };
  }
);
