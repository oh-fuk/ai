
'use server';
/**
 * @fileOverview An AI agent that analyzes past exam papers to generate a "guess paper" for an upcoming exam.
 *
 * - generateGuessPaper - A function that handles the guess paper generation process.
 * - GuessPaperInput - The input type for the generateGuessPaper function.
 * - GuessPaperOutput - The return type for the generateGuessPaper function.
 */

import { ai } from '@/ai/genkit';
import { ANTHROPIC_MODEL } from '@/ai/model';
import { z } from 'genkit';

const GuessPaperInputSchema = z.object({
  subject: z.string().describe('The subject of the exam (e.g., "Physics", "History").'),
  pastPapersDataUris: z.array(z.string()).describe(
    "An array of 7-10 past exam papers, each as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
  ),
});
export type GuessPaperInput = z.infer<typeof GuessPaperInputSchema>;

const PredictedTopicSchema = z.object({
  topic: z.string().describe("A frequently asked or important topic identified from the past papers."),
  reasoning: z.string().describe("A brief explanation of why this topic is considered important (e.g., 'Appeared in 5 of the last 7 papers').")
});

const AnalysisSchema = z.object({
  analysisSummary: z.string().describe("A summary of the AI's findings, including patterns in question types, recurring themes, and any noticeable progression in difficulty over the years."),
  predictedTopics: z.array(PredictedTopicSchema).describe("A list of topics that are highly likely to appear on the upcoming exam based on historical data.")
});

const GuessQuestionSchema = z.object({
  question: z.string().describe("A predicted exam question based on the analysis."),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).describe("The predicted difficulty level of the question."),
});

const GuessPaperOutputSchema = z.object({
  analysis: AnalysisSchema,
  guessPaper: z.array(GuessQuestionSchema).describe("An array of predicted questions for the upcoming exam."),
  tipsAndFormulas: z.array(z.string()).describe("A list of subject-specific tips, key formulas, and important concepts to remember."),
  commonMistakes: z.array(z.string()).describe("A list of common mistakes students make in this subject and how to avoid them."),
});
export type GuessPaperOutput = z.infer<typeof GuessPaperOutputSchema>;

export async function generateGuessPaper(input: GuessPaperInput): Promise<GuessPaperOutput> {
  return generateGuessPaperFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateGuessPaperPrompt',
  model: ANTHROPIC_MODEL,
  input: { schema: GuessPaperInputSchema },
  output: { schema: GuessPaperOutputSchema },
  prompt: `You are an expert exam analyst for high school students. Your task is to analyze a collection of past exam papers for a specific subject and generate a "guess paper" to help a student prepare for their upcoming final exam.

**Subject:** {{{subject}}}

**Analysis Instructions:**

1.  **Review Past Papers:** Carefully examine the content of all the provided past exam papers spanning the last 7-10 years.
    {{#each pastPapersDataUris}}
    Past Paper {{@index}}:
    {{media url=this}}
    ---
    {{/each}}

2.  **Identify Patterns:**
    *   **Frequently Asked Topics:** Identify which topics, chapters, or concepts appear most frequently across the years.
    *   **Question Types:** Note the common formats of questions (e.g., multiple-choice, short-answer, long-form essays, problem-solving).
    *   **Difficulty Progression:** Analyze if there's a trend in the difficulty of questions over the years.

3.  **Create Analysis Summary:** Write a concise summary of your findings. Mention recurring themes, the distribution of question types, and any insights on difficulty.

4.  **Predict Key Topics:** Based on your analysis, list the topics that have the highest probability of appearing in the upcoming exam. For each topic, provide a brief reasoning for your prediction.

5.  **Generate Guess Paper:**
    *   Create a set of new, predicted exam questions that reflect the patterns you identified.
    *   Ensure the questions cover the most probable topics.
    *   Assign a difficulty level ('Easy', 'Medium', 'Hard') to each question.

6.  **Provide Strategic Guidance:**
    *   **Tips and Formulas:** Compile a list of essential subject-specific tips, tricks, and key formulas that are crucial for success.
    *   **Common Mistakes:** List common pitfalls and mistakes that students often make in this subject and advise on how to avoid them.

Now, produce the full analysis and guess paper in the required JSON format.`,
});

const generateGuessPaperFlow = ai.defineFlow(
  {
    name: 'generateGuessPaperFlow',
    inputSchema: GuessPaperInputSchema,
    outputSchema: GuessPaperOutputSchema,
  },
  async (input: any) => {
    const { output } = await prompt(input);
    return output!;
  }
);
