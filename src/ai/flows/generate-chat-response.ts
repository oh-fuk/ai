
'use server';
/**
 * @fileOverview An AI agent for generating conversational, emoji-structured chat responses.
 *
 * - generateChatResponse - A function that handles generating a response in a chat session.
 * - GenerateChatResponseInput - The input type for the function.
 * - GenerateChatResponseOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { ANTHROPIC_MODEL } from '@/ai/model';
import { z } from 'genkit';
import { getTodayStudyTask } from '@/ai/tools/get-study-plan-task';
import { hasAnthropicApiKey, anthropicConfigErrorMessage } from '@/lib/anthropic-env';

// Define the structure for a single message in the chat history
const ChatMessageSchema = z.object({
  role: z.enum(['user', 'model']),
  content: z.string(),
  userId: z.string(),
});

const GenerateChatResponseInputSchema = z.object({
  history: z.array(ChatMessageSchema).describe("The conversation history between the user and the model."),
  prompt: z.string().describe("The user's latest message."),
  context: z.string().describe("A JSON string containing the user's real-time data from the application, including profile, subjects, quiz history, paper results, study plans, and tasks."),
});


const GenerateChatResponseOutputSchema = z.string().describe("The AI's generated response, formatted with markdown for readability. Use bolding for headings and bullet points for lists.");


export async function generateChatResponse(
  input: z.infer<typeof GenerateChatResponseInputSchema>
): Promise<z.infer<typeof GenerateChatResponseOutputSchema>> {
  if (!hasAnthropicApiKey()) {
    return `Error: ${anthropicConfigErrorMessage()}` as z.infer<typeof GenerateChatResponseOutputSchema>;
  }

  // Implement a small retry/backoff strategy for transient provider errors (503, 429, network issues)
  const maxAttempts = 3;
  let attempt = 0;
  let lastErr: any = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await generateChatResponseFlow(input);
    } catch (err: any) {
      lastErr = err;
      // If it's the last attempt, break and return an informative error
      const msg = err?.message || String(err) || 'Unknown error from AI provider';
      // If it's a transient server error or rate limit, wait and retry
      const isTransient = /429|Too Many Requests|503|Service Unavailable|rate limit|overload/i.test(msg);
      const waitMs = 500 * Math.pow(2, attempt - 1); // 500ms, 1000ms, 2000ms
      console.warn(`generateChatResponse attempt ${attempt} failed: ${msg}. transient=${isTransient}.`);
      if (attempt >= maxAttempts || !isTransient) {
        break;
      }
      // sleep before retrying
      await new Promise(res => setTimeout(res, waitMs));
    }
  }

  // Log final failure
  console.error('generateChatResponse failed after retries:', lastErr);
  const message = lastErr?.message || 'The AI service is currently unavailable. Please try again later.';
  // Return an Error: ... string so the client can surface a friendly message and insert a model message
  return `Error: ${message}` as z.infer<typeof GenerateChatResponseOutputSchema>;
}


const prompt = ai.definePrompt({
  name: 'chatPrompt',
  model: ANTHROPIC_MODEL,
  input: { schema: GenerateChatResponseInputSchema },
  tools: [getTodayStudyTask],
  prompt: `You are Athena AI, a helpful and professional AI assistant for students. Your job is to provide clear, friendly, and well-organized answers.

You have **COMPLETE and DETAILED access** to the user's entire educational history and profile in the 'context' block. This includes:
- Complete quiz history with all attempts, scores, and performance metrics
- Complete paper results with detailed answers and explanations
- All study plans and tasks
- Full student profile and enrollment information
- Performance analysis including weak areas and strong subjects

### CRITICAL: USE ALL PROVIDED DATA
- **Analyze ALL quiz attempts** (not just recent ones) to identify patterns in mistakes and weak topics
- **Review COMPLETE paper results** including detailed answers to understand where the student struggles
- **Consider performance trends** across all subjects and over time
- **Reference specific mistakes** the student has made to provide targeted help
- **Do NOT summarize or skip information** — use every detail provided to give the most accurate, personalized guidance

### Personalized Analysis
When responding:
1. **Identify weakness areas** from quiz/paper performance (what subjects/topics have lower scores)
2. **Reference specific mistakes** the student has made (e.g., "I noticed you scored lower on Physics numericals in your last 3 quizzes...")
3. **Provide targeted help** based on actual performance data
4. **Suggest remedial exercises** or practice areas where the student is weak
5. **Track progress** by comparing recent performance with historical data

### Full Access & Capabilities
- You have **full permission and access** to all user data in the app (profile, subjects, quiz attempts, papers, study plans, notes, etc.).
- You can generate **code in any language** (HTML, CSS, JavaScript, Python, Java, C++, etc.) whenever the user asks or when it helps explain a concept.
- When generating code, always wrap it in triple backticks with the language identifier: \`\`\`language ... \`\`\`
- Provide explanations for code and suggest improvements or alternatives when relevant.
- You can create interactive examples, solutions, projects, or tutorials.

### Identity and Persona
- If a user asks who made you, you MUST respond with: "I was made by Muhammad Saad Cheema and Fatin Khan Jadoon."

### CRITICAL: Response Formatting Rules
- Structure your responses with markdown.
- Use **bolding** for headings.
- Use bullet points (-).
- **Add a blank line (an extra newline) between paragraphs, headings, and list items to create space.**
- **DO NOT** use any emojis.
- For code blocks, always use triple backticks with language identifier.
- For LaTeX math, use \`$...$\` for inline and \`$$...$$\` for display.

---

**USER DATA CONTEXT (COMPLETE - Use ALL details provided):**
{{{context}}}
---

**CONVERSATION HISTORY:**
{{#each history}}
{{role}}: {{{content}}}
{{/each}}

**USER's LATEST MESSAGE:**
user: {{{prompt}}}

Now, provide your insightful and well-organized response. You have full permission to access all data and generate code when helpful. Follow all persona and formatting rules precisely.`,
  /* Math & Physics Guidance:
   - For purely mathematical problems, prefer to use LaTeX for all equations, expressions and derivations. Use $...$ for inline math and $$...$$ for display math.
   - For physics numerical problems, you may mix English and math: present formulas in LaTeX and show numeric steps in clear prose/numbered steps.
   - At the end of your response, add one short suggested related feature, prefixed with 'Suggested feature:' (one sentence).
  */
});

const generateChatResponseFlow = ai.defineFlow(
  {
    name: 'generateChatResponseFlow',
    inputSchema: GenerateChatResponseInputSchema,
    outputSchema: GenerateChatResponseOutputSchema,
  },
  async (input: any) => {
    const { text } = await prompt(input);
    if (!text) {
      throw new Error("AI returned no output.");
    }
    return text;
  }
);
