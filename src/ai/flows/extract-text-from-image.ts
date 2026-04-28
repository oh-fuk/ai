'use server';
/**
 * @fileOverview An AI agent that extracts text from an image and determines if the content is relevant.
 *
 * - extractTextFromImage - A function that handles the image text extraction process.
 * - ImageToTextInput - The input type for the extractTextFromImage function.
 * - ImageToTextOutput - The return type for the extractTextFromImage function.
 */

import { ai } from '@/ai/genkit';
import { GEMINI_MODEL } from '@/ai/model';
import { z } from 'genkit';

const ImageToTextInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "An image, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  subject: z.string().describe('The subject context for the image, e.g., "Physics", "History".'),
});
export type ImageToTextInput = z.infer<typeof ImageToTextInputSchema>;

const ImageToTextOutputSchema = z.object({
  isRelated: z.boolean().describe('Whether the content of the image is related to the provided subject.'),
  extractedText: z
    .string()
    .optional()
    .describe(
      'All text extracted from the image. If no text is found, this will be empty.'
    ),
  reasoning: z.string().describe("A brief explanation for the 'isRelated' decision. If not related, explain why. If it is, briefly state what was found."),
});
export type ImageToTextOutput = z.infer<typeof ImageToTextOutputSchema>;

export async function extractTextFromImage(
  input: ImageToTextInput
): Promise<ImageToTextOutput> {
  return extractTextFromImageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractTextFromImagePrompt',
  model: GEMINI_MODEL,
  input: { schema: ImageToTextInputSchema },
  output: { schema: ImageToTextOutputSchema },
  prompt: `You are an expert data extractor with Optical Character Recognition (OCR) capabilities. Your task is to analyze the provided image in the context of a specific subject.

**Instructions:**

1.  **Extract Text:** Carefully extract all readable text from the image.
2.  **Analyze Relevance:** Determine if the extracted text (or the image content itself, if no text is present) is related to the given subject.
3.  **Provide Reasoning:** Explain your decision.
    *   If it **is related**, briefly confirm this (e.g., "The image contains text related to Physics concepts.").
    *   If it **is not related**, explain why (e.g., "The image appears to be a landscape and has no connection to the subject of History.").
    *   If **no text is found**, state that and base the relevance on the visual content.

**Subject:** {{{subject}}}

**Image to Analyze:**
{{media url=imageDataUri}}

Generate your response now.`,
});

const extractTextFromImageFlow = ai.defineFlow(
  {
    name: 'extractTextFromImageFlow',
    inputSchema: ImageToTextInputSchema,
    outputSchema: ImageToTextOutputSchema,
  },
  async (input: any) => {
    const { output } = await prompt(input);
    return output!;
  }
);
