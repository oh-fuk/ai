
'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/check-bulk-quiz-answers.ts';
import '@/ai/flows/summarize-text-from-pdf.ts';
import '@/ai/flows/generate-paper-from-prompt.ts';
import '@/ai/flows/generate-quiz-from-pdf.ts';
import '@/ai/flows/generate-quiz-from-topic.ts';
import '@/ai/flows/generate-study-plan.ts';
import '@/ai/flows/generate-remedial-paper.ts';
import '@/ai/flows/generate-remedial-quiz.ts';
import '@/ai/flows/extract-text-from-pdf.ts';
import '@/ai/flows/explain-main-keywords.ts';
import '@/ai/flows/generate-notes.ts';
import '@/ai/flows/generate-chat-title.ts';
import '@/ai/flows/extract-text-from-image.ts';
import '@/ai/flows/explain-terms.ts';
import '@/ai/flows/generate-guess-paper.ts';
import '@/ai/flows/generate-quiz-from-chat.ts';
import '@/ai/tools/get-study-plan-task.ts';
import '@/ai/flows/analyze-book.ts';
import '@/ai/flows/grammar-checker.ts';
import '@/ai/flows/generate-essay.ts';
import '@/ai/flows/generate-email.ts';
import '@/ai/flows/generate-application.ts';
import '@/ai/flows/generate-letter.ts';
    