
'use server';

/**
 * @fileOverview Generates a quiz from a topic.
 *
 * - generateQuizFromTopic - A function that generates a quiz from a topic.
 * - GenerateQuizFromTopicInput - The input type for the generateQuizFromTopic function.
 * - GenerateQuizFromTopicOutput - The return type for the generateQuizFromTopic function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateQuizFromTopicInputSchema = z.object({
  topic: z.string().describe('The topic of the quiz.'),
  numberOfQuestions: z.number().describe('The number of questions to generate.'),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().describe('Difficulty level: easy | medium | hard'),
});

export type GenerateQuizFromTopicInput = z.infer<typeof GenerateQuizFromTopicInputSchema>;

const GenerateQuizFromTopicOutputSchema = z.object({
  quiz: z.string().describe('A JSON string representing the generated quiz. It should have a "questions" property which is an array of objects, each with "question", "options" (an array of 4 strings), and "correctAnswer" properties.'),
  progress: z.string().describe('A short summary of the quiz generation process.'),
});

export type GenerateQuizFromTopicOutput = z.infer<typeof GenerateQuizFromTopicOutputSchema>;

export async function generateQuizFromTopic(input: GenerateQuizFromTopicInput): Promise<GenerateQuizFromTopicOutput> {
  return generateQuizFromTopicFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateQuizFromTopicPrompt',
  model: 'googleai/gemini-2.5-pro',
  input: { schema: GenerateQuizFromTopicInputSchema },
  output: { schema: GenerateQuizFromTopicOutputSchema },
  prompt: `You are a quiz generator. Given a topic, generate a quiz with the specified number of questions.

The output MUST be a JSON string. The JSON object should have a single key "questions".
The value of "questions" should be an array of question objects.
Each question object must have the following properties:
- "question": A string containing the question text.
- "options": An array of exactly 4 strings representing the multiple-choice options.
- "correctAnswer": A string that exactly matches one of the provided options.

Follow the requested difficulty level when composing questions and options:
- easy: straightforward questions, simple wording, clearly distinct options
- medium: moderately challenging, require some reasoning or application
- hard: higher cognitive load, multi-step reasoning, trickier distractors

IMPORTANT: Do not use any special characters or symbols in your response.

Topic: {{{topic}}}
Number of Questions: {{{numberOfQuestions}}}
Requested Difficulty: {{{difficulty}}}

Generate the quiz now.`,
});

const generateQuizFromTopicFlow = ai.defineFlow(
  {
    name: 'generateQuizFromTopicFlow',
    inputSchema: GenerateQuizFromTopicInputSchema,
    outputSchema: GenerateQuizFromTopicOutputSchema,
  },
  async (input: any) => {
    const { output } = await prompt(input);
    return {
      ...output!,
      progress: `Generated a quiz with ${input.numberOfQuestions} questions on the topic of ${input.topic}.`,
    };
  }
);
