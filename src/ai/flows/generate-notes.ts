'use server';

import { ai } from '@/ai/genkit';
import {
  GenerateNotesInputSchema,
  GenerateNotesOutputSchema,
  ExtractKeywordsInputSchema,
  ExtractKeywordsOutputSchema,
  type GenerateNotesInput,
  type GenerateNotesOutput,
  type ExtractKeywordsInput,
  type ExtractKeywordsOutput,
} from './generate-notes-schemas';

// ---------------------------------------------------------------------------
// Prompt for generating notes
// ---------------------------------------------------------------------------

const generateNotesPrompt = ai.definePrompt({
  name: 'generateNotesPrompt',
  model: 'googleai/gemini-2.5-flash',  // Gemini 2.5 Pro with 1M context
  input: { schema: GenerateNotesInputSchema },
  output: { 
    schema: GenerateNotesOutputSchema,
  },
  config: {
    temperature: 0.7,
    maxOutputTokens: 32768,  // Gemini 3.0 Pro supports up to 32K output tokens!
    topP: 0.95,
    topK: 40
  },
  prompt: `You are an expert educator. Using the information provided, create a clear, well‑structured set of study notes.

**CRITICAL: GENERATE COMPLETE NOTES**
- DO NOT STOP in the middle of generating notes
- Continue writing until ALL content is covered
- If you reach token limits, prioritize completing the current section
- Generate the FULL notes from start to finish

**CRITICAL FORMATTING REQUIREMENTS:**
- Use markdown formatting with proper hierarchy
- Main topics: Use # (single hash) for main headings - these will appear BOLD and LARGE
- Subtopics: Use doble line arrow  for subheadings - these will appear BOLD
- Sub-sections: Use arow for smaller sections
- Use bold text for important terms and key concepts
- Use bullet points (-) for lists and details
- Organize content in a clear, logical flow with proper sections
- Only bolds the heading and subheading not all content 
- Don't use special characters ans symbol if any use then you can use symbols for puntuation
**Guidelines**
- Keep a logical hierarchy with headings and sub‑headings
- Use bullet points where appropriate
- Make headings descriptive and clear
- Bold all important terminology using **term**
- Preserve any important terminology
- If the user supplied a subject, difficulty, or specific topic, tailor the depth and tone accordingly
- When the field "includeKeywords" is true, also provide a list of key terms with brief explanations at the end of the notes
- Must gives real life examples

**Example Structure:**
# Main Topic Title
Brief introduction to the topic.

## Subtopic 1
- **Key Point 1**: Explanation here
- **Key Point 2**: Explanation here

## Subtopic 2
- Important detail
- Another important detail

### Smaller Section
More detailed information here.

**Input**
{{#if text}}
Text to summarize: {{text}}
{{/if}}
{{#if topic}}
Topic: {{topic}}
{{/if}}
{{#if difficulty}}
Difficulty: {{difficulty}}
{{/if}}
{{#if subject}}
Subject: {{subject}}
{{/if}}
{{#if specifications}}
**IMPORTANT - Additional Specifications (MUST FOLLOW):**
{{specifications}}

You MUST incorporate these specifications into your notes. These are critical requirements that must be addressed in the generated notes. Follow the user's instructions exactly as they specified.
{{/if}}
{{#if specificTopic}}
Specific topic focus: {{specificTopic}}
{{/if}}
{{#if pageRange}}
Page range (if applicable): {{pageRange}}
{{/if}}
{{#if includeKeywords}}
Include a keyword list.
{{/if}}
`
});

// ---------------------------------------------------------------------------
// Flow for generating notes
// ---------------------------------------------------------------------------

const generateNotesFlow = ai.defineFlow(
  {
    name: 'generateNotesFlow',
    inputSchema: GenerateNotesInputSchema,
    outputSchema: GenerateNotesOutputSchema,
  },
  async (input: any) => {
    const { output } = await generateNotesPrompt(input);
    return output!;
  }
);

export async function generateNotes(input: GenerateNotesInput): Promise<GenerateNotesOutput> {
  console.log('generateNotes action called with input:', { ...input, text: input.text ? input.text.substring(0, 50) + '...' : undefined });
  try {
    const result = await generateNotesFlow(input);
    console.log('generateNotes action success');
    return result;
  } catch (error) {
    console.error('generateNotes action failed:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Keyword extraction – separate prompt (used when includeKeywords is false or as a helper)
// ---------------------------------------------------------------------------

const extractKeywordsPrompt = ai.definePrompt({
  name: 'extractKeywordsPrompt',
  model: 'googleai/gemini-2.5-flash',
  input: { schema: ExtractKeywordsInputSchema },
  output: { schema: ExtractKeywordsOutputSchema },
  prompt: `You are a concise knowledge extractor. From the provided study notes, produce a list of the most important terms and a one‑sentence explanation for each.

**Notes**
{{notes}}

If a subject is supplied, prioritize terms relevant to that subject.
`
});

const extractKeywordsFlow = ai.defineFlow(
  {
    name: 'extractKeywordsFlow',
    inputSchema: ExtractKeywordsInputSchema,
    outputSchema: ExtractKeywordsOutputSchema,
  },
  async (input: any) => {
    const { output } = await extractKeywordsPrompt(input);
    return output!;
  }
);

export async function extractKeywordsFromNotes(
  input: ExtractKeywordsInput
): Promise<ExtractKeywordsOutput> {
  return extractKeywordsFlow(input);
}
