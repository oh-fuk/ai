
'use server';

/**
 * @fileOverview An AI agent for generating a remedial exam paper based on a student's performance history.
 *
 * - generateRemedialPaper - A function that handles the remedial paper generation process.
 * - GenerateRemedialPaperInput - The input type for the generateRemedialPaper function.
 * - GenerateRemedialPaperOutput - The return type for the generateRemedialPaper function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateRemedialPaperInputSchema = z.object({
  history: z.string().describe("A JSON string representing the user's combined quiz and paper attempt history. Each item should include name, subject, score, and percentage."),
  mcqCount: z.number().describe('Number of multiple choice questions'),
  shortCount: z.number().describe('Number of short answer questions'),
  longCount: z.number().describe('Number of long answer questions'),
});
export type GenerateRemedialPaperInput = z.infer<typeof GenerateRemedialPaperInputSchema>;

const GenerateRemedialPaperOutputSchema = z.object({
  topic: z.string().describe("The primary topic the AI identified as the user's weak point, prefixed with 'Remedial: '. e.g., 'Remedial: Photosynthesis'"),
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
export type GenerateRemedialPaperOutput = z.infer<typeof GenerateRemedialPaperOutputSchema>;

export async function generateRemedialPaper(
  input: GenerateRemedialPaperInput
): Promise<GenerateRemedialPaperOutput> {
  return generateRemedialPaperFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateRemedialPaperPrompt',
  model: 'googleai/gemini-2.5-pro',
  input: { schema: GenerateRemedialPaperInputSchema },
  output: { schema: GenerateRemedialPaperOutputSchema },
  prompt: `You are an expert academic tutor. Your task is to analyze a student's performance history to identify their weakest topic and then generate a targeted exam paper to help them improve.

**Step 1: Analyze Performance**
Review the provided performance history. Look for patterns of low scores (anything below 70%) in specific subjects or topics. Identify the single most significant area of weakness. This could be a recurring topic across multiple assessments where the student consistently underperforms.

**Step 2: Identify the Weakest Topic and Format the Output Topic**
Based on your analysis, determine the primary topic that the student needs the most help with. Your output for the "topic" field MUST be a string formatted as: "Remedial: [Identified Topic Name]". For example, if the weakness is 'Quantum Physics', the output topic must be 'Remedial: Quantum Physics'.

**Step 3: Generate a Targeted Exam Paper with New Questions**
Create an exam paper that exclusively focuses on the weakest topic you identified. CRITICAL: The questions you generate MUST be new and different from any questions that might be inferred from the student's history. Do not repeat questions.

**Output Requirements:**
The output MUST be a JSON object.
- The "topic" field must contain the name of the weak topic you identified, prefixed with "Remedial: ".
- The "paper" field must be a JSON object containing a "questions" array.
- Each question object in the array must have:
  - "question": The question text.
  - "type": One of 'mcq', 'short', 'long'.
  - "options": An array of exactly 4 strings (only for 'mcq' questions).
  - "correctAnswer": The correct answer. For 'mcq', it must match an option. For 'short' and 'long', provide a model answer.

IMPORTANT: Do not use any special characters or symbols in your response.

**Student's Performance History (JSON):**
{{{history}}}

**Requested Question Counts:**
- MCQs: {{{mcqCount}}}
- Short Answer: {{{shortCount}}}
- Long Answer: {{{longCount}}}

Analyze the history, identify the weakest topic, and generate the targeted exam paper with new questions now.`,
});

const generateRemedialPaperFlow = ai.defineFlow(
  {
    name: 'generateRemedialPaperFlow',
    inputSchema: GenerateRemedialPaperInputSchema,
    outputSchema: GenerateRemedialPaperOutputSchema,
  },
  async (input: GenerateRemedialPaperInput) => {
    const { output } = await prompt(input as any);
    return {
      ...output!,
      progress: `Generated a remedial paper focusing on "${output!.topic}" based on your performance history.`,
    };
  }
);
