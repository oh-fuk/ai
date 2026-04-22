'use server';
/**
 * @fileOverview An AI agent for generating formal or informal letters.
 *
 * - generateLetter - A function that handles the letter generation process.
 * - GenerateLetterInput - The input type for the function.
 * - GenerateLetterOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateLetterInputSchema = z.object({
  topic: z.string().describe('The purpose or topic of the letter (e.g., "Recommendation letter," "Thank you letter").'),
  pattern: z.string().optional().describe('An optional pattern or template for the letter content.'),
  additionalInfo: z.string().optional().describe('Any additional information or context the user wants to include.'),
});
export type GenerateLetterInput = z.infer<typeof GenerateLetterInputSchema>;

const GenerateLetterOutputSchema = z.object({
  letterContent: z.string().describe('The generated letter content, formatted with markdown for proper spacing and structure.'),
});
export type GenerateLetterOutput = z.infer<typeof GenerateLetterOutputSchema>;

export async function generateLetter(input: GenerateLetterInput): Promise<GenerateLetterOutput> {
  return generateLetterFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateLetterPrompt',
  model: 'googleai/gemini-2.0-flash',
  input: { schema: GenerateLetterInputSchema },
  output: { schema: GenerateLetterOutputSchema },
  prompt: `You are an expert at writing letters. Your task is to generate a COMPLETE letter based on the provided topic, optional pattern, and any additional information.

CRITICAL FORMAT REQUIREMENTS - YOU MUST FOLLOW THIS EXACTLY:

Generate the letter with EACH LINE SEPARATED by pressing Enter/Return.
Put a BLANK LINE (empty line) between each section.

EXACT FORMAT TO FOLLOW:
[Sender Name/Address]
[Date]
[BLANK LINE]
[Recipient Name/Address]
[BLANK LINE]
Dear [Name],
[BLANK LINE]
[First paragraph: Introduction]
[BLANK LINE]
[Second paragraph: Body]
[BLANK LINE]
[Third paragraph: Conclusion]
[BLANK LINE]
Sincerely,
[BLANK LINE]
[Your Name]

REAL EXAMPLE - COPY THIS STYLE:
123 Maple Street
Springfield, IL 62704
October 25, 2023
[BLANK LINE]
Mr. James Smith
456 Oak Avenue
Springfield, IL 62704
[BLANK LINE]
Dear Mr. Smith,
[BLANK LINE]
I am writing to express my gratitude for your assistance with the community project.
[BLANK LINE]
Your dedication and hard work were instrumental in making the event a success.
[BLANK LINE]
I look forward to working with you again in the future.
[BLANK LINE]
Sincerely,
[BLANK LINE]
Jane Doe

RULES:
- Press Enter TWICE between sections (creates blank line)
- Professional or appropriate tone based on topic
- Organized and easy to read

**Letter Topic/Purpose:**
---
{{{topic}}}
---

{{#if pattern}}
**Use this pattern:**
---
{{{pattern}}}
---
{{/if}}

{{#if additionalInfo}}
**Incorporate this additional information:**
---
{{{additionalInfo}}}
---
{{/if}}

Generate the full, complete, well-formatted letter content now without any interruption:`,
});

const generateLetterFlow = ai.defineFlow(
  {
    name: 'generateLetterFlow',
    inputSchema: GenerateLetterInputSchema,
    outputSchema: GenerateLetterOutputSchema,
  },
  async (input: any) => {
    const { output } = await prompt(input);
    return output!;
  }
);
