
'use server';
/**
 * @fileOverview An AI agent for generating formal applications.
 *
 * - generateApplication - A function that handles the application generation process.
 * - GenerateApplicationInput - The input type for the function.
 * - GenerateApplicationOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { GEMINI_MODEL } from '@/ai/model';
import { z } from 'genkit';

const GenerateApplicationInputSchema = z.object({
  topic: z.string().describe('The purpose of the application (e.g., "Leave of absence," "Scholarship application").'),
  pattern: z.string().optional().describe('An optional pattern or template for the application content.'),
  additionalInfo: z.string().optional().describe('Any additional information or context the user wants to include.'),
});
export type GenerateApplicationInput = z.infer<typeof GenerateApplicationInputSchema>;

const GenerateApplicationOutputSchema = z.object({
  applicationContent: z.string().describe('The generated formal application content, formatted with markdown for clarity (e.g., proper spacing, bolding for subject line).'),
});
export type GenerateApplicationOutput = z.infer<typeof GenerateApplicationOutputSchema>;

export async function generateApplication(input: GenerateApplicationInput): Promise<GenerateApplicationOutput> {
  return generateApplicationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateApplicationPrompt',
  model: GEMINI_MODEL,
  input: { schema: GenerateApplicationInputSchema },
  output: { schema: GenerateApplicationOutputSchema },
  prompt: `You are an expert at writing formal applications. Your task is to generate a COMPLETE, well-structured application based on the provided topic, optional pattern, and any additional user-provided information.

CRITICAL FORMAT REQUIREMENTS - YOU MUST FOLLOW THIS EXACTLY:

Generate the application with EACH LINE SEPARATED by pressing Enter/Return.
Put a BLANK LINE (empty line) between each section.

DO NOT write long paragraphs. Keep sentences clear.
Each section = blank line before it.

EXACT FORMAT TO FOLLOW:
Subject: [Subject Line]
[BLANK LINE]
[Recipient Name/Title if known, or "To the Principal/Manager"]
[Address if applicable]
[BLANK LINE]
Dear [Name/Title],
[BLANK LINE]
[First paragraph: Purpose of application]
[BLANK LINE]
[Second paragraph: Details/Reasoning]
[BLANK LINE]
[Third paragraph: Closing/Request]
[BLANK LINE]
Sincerely,
[BLANK LINE]
[Your Name]
[Your Contact Info]

REAL EXAMPLE - COPY THIS STYLE:
Subject: Application for Sick Leave
[BLANK LINE]
To the Principal,
City High School,
New York.
[BLANK LINE]
Respected Sir/Madam,
[BLANK LINE]
I am writing to request sick leave for two days as I am suffering from a high fever.
[BLANK LINE]
The doctor has advised me to take complete rest for recovery.
[BLANK LINE]
I kindly request you to grant me leave from October 10th to October 11th.
[BLANK LINE]
Thank you for your understanding.
[BLANK LINE]
Yours obediently,
[BLANK LINE]
John Doe
Class 10-A

RULES:
- Press Enter TWICE between sections (creates blank line)
- Clear, professional tone
- Organized and easy to read

**Application Topic/Purpose:**
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

Generate the full, complete, well-formatted application content now without any interruption:`,
});

const generateApplicationFlow = ai.defineFlow(
  {
    name: 'generateApplicationFlow',
    inputSchema: GenerateApplicationInputSchema,
    outputSchema: GenerateApplicationOutputSchema,
  },
  async (input: any) => {
    const { output } = await prompt(input);
    return output!;
  }
);
