import { z } from 'genkit';

// ---------------------------------------------------------------------------
// Input / Output Schemas
// ---------------------------------------------------------------------------

// Input for generating notes. All fields are optional except `text` when generating from a document.
export const GenerateNotesInputSchema = z.object({
    text: z.string().optional(), // extracted text from PDF/Image
    topic: z.string().optional(),
    difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
    subject: z.string().optional(),
    specifications: z.string().optional(),
    specificTopic: z.string().optional(),
    pageRange: z.string().optional(),
    includeKeywords: z.boolean().optional().default(false),
});

export type GenerateNotesInput = z.infer<typeof GenerateNotesInputSchema>;

export const GenerateNotesOutputSchema = z.object({
    notes: z.string(),
    // Keywords are optional – only returned when includeKeywords is true.
    keywords: z
        .array(
            z.object({
                term: z.string(),
                explanation: z.string(),
            })
        )
        .optional(),
});

export type GenerateNotesOutput = z.infer<typeof GenerateNotesOutputSchema>;

// ---------------------------------------------------------------------------
// Keyword extraction – separate prompt (used when includeKeywords is false or as a helper)
// ---------------------------------------------------------------------------

export const ExtractKeywordsInputSchema = z.object({
    notes: z.string(),
    subject: z.string().optional(),
});

export type ExtractKeywordsInput = z.infer<typeof ExtractKeywordsInputSchema>;

export const ExtractKeywordsOutputSchema = z.object({
    keywords: z.array(
        z.object({
            term: z.string(),
            explanation: z.string(),
        })
    ),
});

export type ExtractKeywordsOutput = z.infer<typeof ExtractKeywordsOutputSchema>;
