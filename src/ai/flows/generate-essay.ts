
'use server';
/**
 * @fileOverview An AI agent for generating an essay from a topic.
 *
 * - generateEssay - A function that handles the essay generation process.
 * - GenerateEssayInput - The input type for the function.
 * - GenerateEssayOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateEssayInputSchema = z.object({
  topic: z.string().describe('The topic for the essay.'),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().describe('Difficulty level: easy | medium | hard'),
  specifications: z.string().optional().describe('Additional specifications or requirements for the essay (e.g., word count, specific focus areas, examples to include).'),
});
export type GenerateEssayInput = z.infer<typeof GenerateEssayInputSchema>;

const GenerateEssayOutputSchema = z.object({
  essay: z.string().describe('The generated essay content, formatted with markdown (headings, paragraphs).'),
});
export type GenerateEssayOutput = z.infer<typeof GenerateEssayOutputSchema>;

export async function generateEssay(input: GenerateEssayInput): Promise<GenerateEssayOutput> {
  return generateEssayFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateEssayPrompt',
  model: 'googleai/gemini-2.5-pro',
  input: { schema: GenerateEssayInputSchema },
  output: { schema: GenerateEssayOutputSchema },
  prompt: `You are an expert academic writer. Your task is to write a well-structured, comprehensive, and COMPLETE essay on the given topic without breaking or interrupting the content.

CRITICAL INSTRUCTIONS:
- Generate the ENTIRE essay in ONE COMPLETE response
- DO NOT STOP in the middle
- DO NOT say "to be continued" or "I'll continue"
- WRITE THE FULL ESSAY from start to finish WITHOUT STOPPING
- Continue writing until you reach a proper conclusion
- The essay MUST be COMPLETE with introduction, body, AND conclusion

FORMATTING RULES:
- Use PLAIN TEXT ONLY - NO special characters, symbols, or markdown
- NO asterisks, underscores, hashtags, or any formatting symbols
- Write in clean, simple paragraphs separated by blank lines
- Use standard English letters, numbers, and basic punctuation only (periods, commas, question marks, exclamation points)
- NO emojis, arrows, bullets, or decorative characters

The essay must include:
1. A compelling introduction that introduces the topic and thesis
2. Multiple body paragraphs (at least 3-4) with detailed supporting information, examples, and analysis
3. A strong conclusion that summarizes the key points and reinforces the thesis

Follow the requested difficulty level. Difficulty influences complexity and depth:
- easy: simple language, concise explanations, fewer examples
- medium: moderate depth with examples and analysis
- hard: in-depth analysis, advanced vocabulary, multiple examples and extended explanations

Requested Difficulty: {{{difficulty}}}

Topic: {{{topic}}}

{{#if specifications}}
Additional Specifications: {{{specifications}}}
{{/if}}

Generate the complete essay now in plain text format without any special characters or formatting symbols. Write the full content without interruption:`,
});

const generateEssayFlow = ai.defineFlow(
  {
    name: 'generateEssayFlow',
    inputSchema: GenerateEssayInputSchema,
    outputSchema: GenerateEssayOutputSchema,
  },
  async (input: any) => {
    const { output } = await prompt(input);
    return output!;
  }
);
