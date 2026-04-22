import { NextRequest, NextResponse } from 'next/server';
import { generateChatResponse } from '@/ai/flows/generate-chat-response';

export async function POST(request: NextRequest) {
    try {
        const { messages, userMessage, taskContext, userId, tasks } = await request.json();

        if (!userMessage || !userId) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Format chat history for the AI
        const history = messages.map((msg: any) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            content: msg.content,
            userId: userId,
        }));

        // Create strict task-only context with system instructions
        const tasksInfo = tasks && tasks.length > 0
            ? `\n\nUser's Current Tasks:\n${tasks.map((t: any) => `- "${t.title}" (Priority: ${t.priority}, Completed: ${t.completed})\n  Description: ${t.description}`).join('\n')}`
            : '\n\nUser has no tasks currently.';

        const systemInstructions = `SYSTEM INSTRUCTIONS - READ CAREFULLY:
You are a Task-Only AI Assistant. Your ONLY purpose is to help the user with their study tasks.

STRICT RESTRICTIONS:
1. You ONLY discuss and help with the user's tasks listed below
2. Do NOT access, mention, or discuss any other apps, features, or information from the application
3. Do NOT provide general chat assistance - ONLY task-related help
4. If the user asks about anything other than their tasks, politely decline with: "I'm here to help with your study tasks only. Please ask about your tasks instead."
5. Your responses must be focused ONLY on helping with the specific task they're working on
6. Do NOT mention or suggest any other features, tools, or applications
7. You are like a dedicated AI driver for task management - nothing else

${tasksInfo}

Current Task Being Worked On:${taskContext || '\nNo specific task selected'}

8. RESPONSE STYLE (MANDATORY):
    - Your responses MUST be highly organized: include a short 1-2 line TL;DR, clear headings, numbered steps or bullet lists, and an actionable "Next Steps" or "Action Plan" section when appropriate.
    - Use an original, pedagogical tutoring voice and avoid recycled, generic chatbot templates. Aim for clarity, examples, analogies, and concise explanations that feel distinct and helpful.
    - Provide examples, short worked solutions, or mini-analogies when they help understanding.
    - Keep responses comprehensive and do not truncate. If the content is long, deliver it fully (use headings and sections to structure long content).
    - Avoid including unrelated app features or references. Stay task-focused.

Remember: Enforce these restrictions strictly. If the user tries to get you to discuss anything other than their tasks, refuse politely.`;

        // Create context for AI with system instructions embedded
        const context = JSON.stringify({
            type: 'task_assistance_only',
            systemInstructions: systemInstructions,
            taskContext: taskContext || 'General task assistance',
            userMessage: userMessage,
        });

        // Call the AI flow
        const response = await generateChatResponse({
            prompt: `${systemInstructions}\n\nUser Message: ${userMessage}`,
            history: history,
            context: context,
        });

        return NextResponse.json({
            response: response,
            success: true,
        });
    } catch (error) {
        console.error('Task chat API error:', error);
        return NextResponse.json(
            { error: 'Failed to generate response', details: String(error) },
            { status: 500 }
        );
    }
}
