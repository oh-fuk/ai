
'use server';
/**
 * @fileOverview An AI agent for generating a concise chat title from the user's initial prompt.
 *
 * - generateChatTitle - A function that handles generating a chat title.
 * - GenerateChatTitleInput - The input type for the function.
 * - GenerateChatTitleOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { ANTHROPIC_MODEL } from '@/ai/model';
import { z } from 'genkit';

const GenerateChatTitleInputSchema = z.object({
  prompt: z.string().describe("The user's first message in a new conversation."),
});

const GenerateChatTitleOutputSchema = z.object({
  title: z.string().describe("A short, descriptive title (5 words or less) summarizing the user's prompt."),
});

export async function generateChatTitle(
  input: z.infer<typeof GenerateChatTitleInputSchema>
): Promise<z.infer<typeof GenerateChatTitleOutputSchema>> {
  return generateChatTitleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateChatTitlePrompt',
  model: ANTHROPIC_MODEL,
  input: { schema: GenerateChatTitleInputSchema },
  output: { schema: GenerateChatTitleOutputSchema },
  prompt: `You are an expert at creating concise titles. Your task is to read the user's first message and create a short, descriptive title for the conversation.

The title should be no more than 5 words.

**User's First Message:**
---
{{{prompt}}}
---

Now, generate the title.`,
});

const generateChatTitleFlow = ai.defineFlow(
  {
    name: 'generateChatTitleFlow',
    inputSchema: GenerateChatTitleInputSchema,
    outputSchema: GenerateChatTitleOutputSchema,
  },
  async (input: any) => {
    const { output } = await prompt(input);
    return output!;
  }
);


