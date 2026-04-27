

'use server';

/**
 * @fileOverview An AI agent for generating a study plan.
 *
 * - generateStudyPlan - A function that handles the study plan generation process.
 * - GenerateStudyPlanInput - The input type for the generateStudyPlan function.
 * - GenerateStudyPlanOutput - The return type for the generateStudyPlan function.
 */

import { ai } from '@/ai/genkit';
import { ANTHROPIC_MODEL } from '@/ai/model';
import { z } from 'genkit';

const GenerateStudyPlanInputSchema = z.object({
  topic: z.string().optional().describe('The main topic or subject for the study plan.'),
  timeframe: z.string().describe('The total time available for study (e.g., "2 weeks", "1 month", "30 hours").'),
  specifications: z.string().optional().describe('Any additional requirements or constraints, like "I can only study on weekends" or "Focus on practical examples".'),
  pdfDataUri: z
    .string()
    .optional()
    .describe(
      "An optional PDF document (textbook, syllabus) as a data URI to base the plan on. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  specificTopic: z.string().optional().describe('A specific chapter or topic within the PDF to focus on.'),
  pageRange: z.string().optional().describe('A page range to focus on, e.g., "5-10".')
});
export type GenerateStudyPlanInput = z.infer<typeof GenerateStudyPlanInputSchema>;

const GenerateStudyPlanOutputSchema = z.object({
  plan: z.array(
    z.object({
      duration: z.string().describe('The time period for this part of the plan (e.g., "Day 1", "Week 1", "Session 1-2").'),
      topic: z.string().describe('The specific topic or concept to focus on during this period.'),
      tasks: z.array(z.string()).describe('A list of concrete, actionable tasks for the student to complete.'),
    })
  ).describe('A structured, day-by-day or session-by-session study plan.'),
  progress: z.string().describe('A summary of the generation process.'),
});
export type GenerateStudyPlanOutput = z.infer<typeof GenerateStudyPlanOutputSchema>;

export async function generateStudyPlan(
  input: GenerateStudyPlanInput
): Promise<GenerateStudyPlanOutput> {
  return generateStudyPlanFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateStudyPlanPrompt',
  model: ANTHROPIC_MODEL,
  input: { schema: GenerateStudyPlanInputSchema },
  output: { schema: GenerateStudyPlanOutputSchema },
  prompt: `You are an expert academic advisor who creates detailed, actionable study plans. A student needs a plan for the following topic within a specific timeframe.

**Important Context for Plan Generation:**
When creating the plan, you must consider the context of the student's entire academic year. The 'specifications' field may contain crucial information about different periods, such as:
- **Final Exam Months:** During these periods, plans should be revision-focused, prioritizing practice papers, and reviewing key topics.
- **Bi-Monthly Exam Periods:** These require a mix of learning new material and revising for the upcoming smaller exams.
- **Summer Vacation / Breaks:** These periods are ideal for covering large, foundational topics, catching up on backlogs, or getting ahead.
- **Regular Study Months:** These should involve a steady pace of learning new concepts and regular, smaller review sessions.

Your generated plan should reflect the nature of the period mentioned in the specifications. If no specific period is mentioned, assume it's a regular study period.

The output MUST be a JSON object containing a "plan" array.
Each item in the "plan" array must be an object with three properties:
- "duration": A string representing the time block (e.g., "Day 1", "Week 1", "Hours 1-3").
- "topic": A string for the specific concept or chapter to be covered.
- "tasks": An array of strings, where each string is a clear, actionable task (e.g., "Read Chapter 5", "Complete 10 practice problems on topic X", "Review flashcards for key terms").

IMPORTANT: Do not use any special characters or symbols in your response.

Main Study Topic: {{{topic}}}
Total Timeframe: {{{timeframe}}}

{{#if specifications}}
Additional Student Requirements:
{{{specifications}}}
{{/if}}

{{#if pdfDataUri}}
The student has provided the following reference material. Base the study plan on its content, breaking down chapters or sections logically. If a topic is also provided, use it to focus the plan within the context of the PDF.
Reference Material:
{{media url=pdfDataUri}}

{{#if specificTopic}}
Please focus on the chapter or topic: {{{specificTopic}}}.
{{/if}}
{{#if pageRange}}
Please focus on pages: {{{pageRange}}}.
{{/if}}

If both a specific topic and page range are provided, use them to narrow down the relevant content in the PDF.
{{else}}
Generate a general study plan based on the provided topic.
{{/if}}

Break down the main topic into smaller, manageable sub-topics and assign them to different study periods within the given timeframe. For each period, define specific tasks. Create a comprehensive and realistic plan that respects the academic calendar context provided.`,
});

const generateStudyPlanFlow = ai.defineFlow(
  {
    name: 'generateStudyPlanFlow',
    inputSchema: GenerateStudyPlanInputSchema,
    outputSchema: GenerateStudyPlanOutputSchema,
  },
  async (input: any) => {
    if (!input.topic && !input.pdfDataUri) {
      throw new Error('Either a topic or a file must be provided to generate a study plan.');
    }
    const { output } = await prompt(input);
    return {
      ...output!,
      progress: 'Generated a personalized study plan.',
    };
  }
);
