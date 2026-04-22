
'use server';
/**
 * @fileOverview An AI agent for generating professional emails.
 *
 * - generateEmail - A function that handles the email generation process.
 * - GenerateEmailInput - The input type for the function.
 * - GenerateEmailOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateEmailInputSchema = z.object({
  topic: z.string().describe('The purpose or topic of the email (e.g., "Job application follow-up").'),
  pattern: z.string().optional().describe('An optional pattern or template for the email content.'),
  additionalInfo: z.string().optional().describe('Any additional information or context the user wants to include.'),
});
export type GenerateEmailInput = z.infer<typeof GenerateEmailInputSchema>;

const GenerateEmailOutputSchema = z.object({
  emailContent: z.string().describe('The generated email, including a clear subject line and body, formatted with markdown for readability.'),
});
export type GenerateEmailOutput = z.infer<typeof GenerateEmailOutputSchema>;

export async function generateEmail(input: GenerateEmailInput): Promise<GenerateEmailOutput> {
  return generateEmailFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateEmailPrompt',
  model: 'googleai/gemini-2.5-pro',
  input: { schema: GenerateEmailInputSchema },
  output: { schema: GenerateEmailOutputSchema },
  prompt: `You are an email formatter. Generate emails in ORGANIZED FORMAT ONLY.

⚠️ CRITICAL: DO NOT WRITE IN PARAGRAPH FORM. DO NOT WRITE IN ESSAY FORM.
⚠️ WRITE IN ORGANIZED EMAIL FORMAT WITH LINE BREAKS.

YOU MUST OUTPUT EXACTLY LIKE THIS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Subject: [Write subject]

Dear [Name],

[Sentence 1 here]

[Sentence 2 here]

[Sentence 3 here]

[Closing sentence]

Best regards,
[Your Name]
[Contact]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MANDATORY RULES:
1. Put BLANK LINE after Subject
2. Put BLANK LINE after greeting
3. Put BLANK LINE between EVERY sentence
4. Put BLANK LINE before closing
5. NEVER write multiple sentences together
6. NEVER write paragraphs
7. Each line = ONE thought only

CORRECT EXAMPLE:
Subject: Meeting Request

Dear Dr. Smith,

I would like to schedule a meeting with you.

I want to discuss my research progress.

Are you available next Tuesday at 2 PM?

Thank you for your time.

Best regards,
John Doe
john@email.com

WRONG (DO NOT DO THIS):
Dear Dr. Smith, I would like to schedule a meeting with you to discuss my research progress. Are you available next Tuesday at 2 PM? Thank you for your time.

NOW GENERATE THE EMAIL IN ORGANIZED FORMAT WITH BLANK LINES BETWEEN EACH SENTENCE.

**Email Topic/Purpose:**
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

Generate the full, complete, well-formatted email content now without any interruption:`,
});

const generateEmailFlow = ai.defineFlow(
  {
    name: 'generateEmailFlow',
    inputSchema: GenerateEmailInputSchema,
    outputSchema: GenerateEmailOutputSchema,
  },
  async (input: GenerateEmailInput) => {
    const { output } = await prompt(input);
    return output!;
  }
);
