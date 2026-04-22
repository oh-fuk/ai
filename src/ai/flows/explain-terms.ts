'use server';
/**
 * @fileOverview An AI agent that explains specific terms or concepts in simple language.
 *
 * - explainTerms - A function that handles the term explanation process.
 * - ExplainTermsInput - The input type for the function.
 * - ExplainTermsOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExplainTermsInputSchema = z.object({
    terms: z.array(z.string()).describe('A list of terms or concepts to explain.'),
    context: z.string().optional().describe('Optional context or subject area to tailor the explanations.'),
});
export type ExplainTermsInput = z.infer<typeof ExplainTermsInputSchema>;

const TermExplanationSchema = z.object({
    term: z.string().describe('The term or concept.'),
    explanation: z.string().describe('A clear, simple explanation of the term.'),
    example: z.string().optional().describe('An optional example to illustrate the term.'),
});

const ExplainTermsOutputSchema = z.object({
    explanations: z.array(TermExplanationSchema).describe('An array of terms with their explanations.'),
});
export type ExplainTermsOutput = z.infer<typeof ExplainTermsOutputSchema>;
export type TermExplanation = z.infer<typeof TermExplanationSchema>;

export async function explainTerms(input: ExplainTermsInput): Promise<ExplainTermsOutput> {
    return explainTermsFlow(input);
}

const prompt = ai.definePrompt({
    name: 'explainTermsPrompt',
    model: 'googleai/gemini-2.5-flash',
    input: { schema: ExplainTermsInputSchema },
    output: { schema: ExplainTermsOutputSchema },
    prompt: `You are an expert educator. Your task is to explain the provided terms clearly and simply so a student can understand them.

For each term:
1. Provide a clear, concise explanation in plain language.
2. Optionally include a short example to illustrate the concept.

{{#if context}}
**Subject Context:** {{{context}}}
{{/if}}

**Terms to Explain:**
{{#each terms}}
- {{{this}}}
{{/each}}

Provide your explanations now.`,
});

const explainTermsFlow = ai.defineFlow(
    {
        name: 'explainTermsFlow',
        inputSchema: ExplainTermsInputSchema,
        outputSchema: ExplainTermsOutputSchema,
    },
    async (input: any) => {
        const { output } = await prompt(input);
        return output!;
    }
);
