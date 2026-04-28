

'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader, UploadCloud, FileDown, BookCopy, X, File, Image as ImageIcon, Milestone, Sparkles, ChevronLeft, Pilcrow, Upload } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, addDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/app/page-header';
import { AnimatePresence, motion } from 'framer-motion';
import { AiLoadingScreen } from '@/components/app/ai-loading';
import { extractTextFromPdf } from '@/ai/flows/extract-text-from-pdf';
import { extractTextFromImage } from '@/ai/flows/extract-text-from-image';
import { generateNotes, extractKeywordsFromNotes } from '@/ai/flows/generate-notes';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DriveImportButton } from '@/components/app/drive-import-button';
import { useDrive } from '@/hooks/use-drive';
import { getFormFileDisplayName, hasFormFileValue, isDriveImportFormValue, isPdfLikeMime } from '@/lib/drive-form-file';


const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const formSchema = z.object({
    subject: z.string().min(1, 'Please select a subject.'),
    generationType: z.enum(['document', 'topic']).default('document'),
    topic: z.string().optional(),
    difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
    file: z.any().optional(),
    specificTopic: z.string().optional(),
    pageRange: z.string().optional(),
    specifications: z.string().min(1, 'Please provide additional specifications.'),
}).refine(data => {
    if (data.generationType === 'document') {
        return hasFormFileValue(data.file);
    }
    return true;
}, {
    message: 'An image or PDF file is required when generating from a document.',
    path: ['file'],
}).refine(data => {
    if (data.generationType === 'topic') {
        return data.topic && data.topic.length >= 3 && data.difficulty;
    }
    return true;
}, {
    message: 'A topic of at least 3 characters and a difficulty level are required.',
    path: ['topic'],
});

type NotesMakerFormValues = z.infer<typeof formSchema>;

interface Keyword {
    term: string;
    explanation: string;
}

interface NotesResult {
    notes: string;
    // Keywords are optional – they may be omitted when includeKeywords is false.
    keywords?: Keyword[];
}

interface Subject {
    id: string;
    name: string;
}

// Helper functions moved outside component
const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
});

const rotateDataUrl = (dataUrl: string, degrees: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Could not get canvas context'));

            const radians = (degrees * Math.PI) / 180;
            // For 90/270 swaps, swap width/height
            const sin = Math.abs(Math.sin(radians));
            const cos = Math.abs(Math.cos(radians));
            canvas.width = Math.round(img.width * cos + img.height * sin);
            canvas.height = Math.round(img.width * sin + img.height * cos);

            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(radians);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);

            resolve(canvas.toDataURL());
        };
        img.onerror = (e) => reject(e);
        img.src = dataUrl;
    });
};

// Remove Action Plan section from notes
const removeActionPlan = (notes: string) => {
    if (!notes) return notes;
    const lines = notes.split(/\r?\n/);
    const actionPlanIndices: number[] = [];

    // Find all Action Plan section starts
    lines.forEach((line, idx) => {
        const trimmed = line.trim().toLowerCase();
        if (trimmed.startsWith('#') && (trimmed.includes('action plan') || trimmed.includes('next steps'))) {
            actionPlanIndices.push(idx);
        }
    });

    if (actionPlanIndices.length === 0) return notes;

    // Remove sections starting from the last one to avoid index shifting issues
    const result = [...lines];
    for (let i = actionPlanIndices.length - 1; i >= 0; i--) {
        const startIdx = actionPlanIndices[i];
        const headingMatch = lines[startIdx].trim().match(/^(#+)\s+/);
        const level = headingMatch ? headingMatch[1].length : 2;

        // Find where this section ends
        let endIdx = startIdx;
        for (let j = startIdx + 1; j < lines.length; j++) {
            const hMatch = lines[j].trim().match(/^(#+)\s+/);
            if (hMatch && hMatch[1].length <= level) {
                endIdx = j;
                break;
            }
            endIdx = j + 1;
        }

        // Remove the section (including the heading)
        result.splice(startIdx, endIdx - startIdx);
    }

    return result.join('\n').trim();
};

const formatNotesForPdf = (notes: string, meta: { reportTitle?: string; subject?: string; topic?: string; difficulty?: string }) => {
    // Extract code blocks first
    const codeBlocks: Record<string, string> = {};
    let idx = 0;
    const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    let temp = notes.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
        const id = `__CODEBLOCK_${idx++}__`;
        const escapedCode = escapeHtml(code.trim());
        codeBlocks[id] = `<div style="background-color:#f8f9fa;border:1pt solid #dee2e6;border-left:4pt solid #3f51b5;border-radius:4pt;padding:12pt;margin:12pt 0;font-family:'Courier New',monospace;font-size:9pt;overflow-x:auto;white-space:pre-wrap;word-break:break-all;page-break-inside:avoid;">${escapedCode}</div>`;
        return id;
    });

    // Escape content
    temp = escapeHtml(temp);

    // Process markdown and build styled HTML with organization
    const lines = temp.replace(/\r/g, '').split('\n');
    let html = '';
    let inList = false;
    let sectionCounter = 0;
    let subsectionCounter = 0;
    let lastHeadingLevel = 0;
    const tocEntries: Array<{ id: string; text: string; level: number }> = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) {
            if (inList) { html += '</ul>'; inList = false; }
            html += '<div style="margin:10pt 0;"></div>';
            continue;
        }

        const h1 = trimmed.match(/^#\s+(.*)/);
        const h2 = trimmed.match(/^##\s+(.*)/);
        const h3 = trimmed.match(/^###\s+(.*)/);
        const listMatch = trimmed.match(/^[-*]\s+(.*)/);

        if (h1) {
            if (inList) { html += '</ul>'; inList = false; }
            sectionCounter = 0;
            subsectionCounter = 0;
            lastHeadingLevel = 1;
            // Add page break before new main section (except first)
            if (html.trim() !== '') {
                html += '<div style="page-break-before:always;margin-top:30pt;"></div>';
            }
            sectionCounter++;
            const id = `toc-h1-${sectionCounter}`;
            tocEntries.push({ id, text: h1[1], level: 1 });
            html += `<div style="background:linear-gradient(to right, #f8f9fa 0%, #ffffff 100%);border-left:6pt solid #3f51b5;padding:18pt 20pt;margin:0 0 20pt 0;border-radius:5pt;box-shadow:0 2pt 4pt rgba(0,0,0,0.05);">
                <h1 id="${id}" style="font-size:24pt;font-weight:bold;margin:0 0 10pt 0;color:#1a1a1a;border-bottom:3pt solid #3f51b5;padding-bottom:10pt;page-break-after:avoid;letter-spacing:0.5pt;">${h1[1]}</h1>
            </div>`;
            continue;
        }
        if (h2) {
            if (inList) { html += '</ul>'; inList = false; }
            sectionCounter++;
            subsectionCounter = 0;
            lastHeadingLevel = 2;
            // Add visual separator before section
            if (html.trim() !== '') {
                html += '<div style="margin:20pt 0 15pt 0;border-top:1.5pt solid #e8e8e8;"></div>';
            }
            const id = `toc-h2-${sectionCounter}`;
            tocEntries.push({ id, text: h2[1], level: 2 });
            html += `<div style="background-color:#fafbfc;border-left:5pt solid #3f51b5;padding:14pt 18pt;margin:18pt 0 12pt 0;border-radius:4pt;border-top:1pt solid #e8e8e8;border-right:1pt solid #e8e8e8;border-bottom:1pt solid #e8e8e8;">
                <h2 id="${id}" style="font-size:18pt;font-weight:bold;margin:0;color:#2c3e50;page-break-after:avoid;letter-spacing:0.3pt;">
                    <span style="color:#3f51b5;margin-right:10pt;font-size:20pt;">${sectionCounter}.</span>${h2[1]}
                </h2>
            </div>`;
            continue;
        }
        if (h3) {
            if (inList) { html += '</ul>'; inList = false; }
            if (lastHeadingLevel === 2) {
                subsectionCounter++;
            } else {
                subsectionCounter = 1;
            }
            lastHeadingLevel = 3;
            const id = `toc-h3-${sectionCounter}-${subsectionCounter}`;
            tocEntries.push({ id, text: h3[1], level: 3 });
            html += `<div style="margin:14pt 0 10pt 0;padding:8pt 0 8pt 15pt;border-left:4pt solid #90caf9;background-color:#fafbfc;border-radius:3pt;">
                <h3 id="${id}" style="font-size:15pt;font-weight:bold;margin:0;color:#34495e;page-break-after:avoid;">
                    <span style="color:#3f51b5;margin-right:8pt;font-weight:bold;">${sectionCounter}.${subsectionCounter}</span>${h3[1]}
                </h3>
            </div>`;
            continue;
        }

        if (listMatch) {
            if (!inList) { html += '<ul style="margin:12pt 0 12pt 25pt;padding-left:25pt;list-style-type:disc;line-height:1.9;">'; inList = true; }
            const item = listMatch[1]
                .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:bold;color:#1a1a1a;">$1</strong>')
                .replace(/`([^`]+)`/g, '<code style="background:#f5f5f5;padding:3pt 7pt;border-radius:3pt;font-family:\'Courier New\',monospace;font-size:10pt;color:#c7254e;border:1pt solid #e0e0e0;">$1</code>');
            html += `<li style="margin:8pt 0;line-height:1.9;color:#2c2c2c;padding-right:5pt;">${item}</li>`;
            continue;
        }

        // Regular paragraph
        if (inList) { html += '</ul>'; inList = false; }
        const para = trimmed
            .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:bold;color:#1a1a1a;">$1</strong>')
            .replace(/`([^`]+)`/g, '<code style="background:#f5f5f5;padding:3pt 7pt;border-radius:3pt;font-family:\'Courier New\',monospace;font-size:10pt;color:#c7254e;border:1pt solid #e0e0e0;">$1</code>');
        html += `<p style="margin:12pt 0;line-height:1.9;text-align:justify;color:#2c2c2c;text-indent:0;padding:0 5pt;">${para}</p>`;
    }

    if (inList) html += '</ul>';

    // Restore code blocks
    Object.entries(codeBlocks).forEach(([id, codeHtml]) => {
        html = html.replace(id, codeHtml);
    });

    // Build a professional Title page and Table of Contents
    const title = (meta && meta.reportTitle) || 'Study Notes';
    const titlePage = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:60pt 40pt;page-break-after:always;background:linear-gradient(135deg, #3f51b5 0%, #5c6bc0 100%);">
            <div style="background:white;padding:50pt;border-radius:8pt;box-shadow:0 8pt 24pt rgba(0,0,0,0.15);text-align:center;max-width:500pt;">
                <div style="font-size:13pt;color:#3f51b5;font-weight:600;margin-bottom:15pt;text-transform:uppercase;letter-spacing:2pt;">Study Notes</div>
                <h1 style="font-size:30pt;margin:0 0 20pt;color:#1a1a1a;font-weight:700;line-height:1.3;">${title}</h1>
                <div style="height:3pt;width:80pt;background:#3f51b5;margin:0 auto 25pt;border-radius:2pt;"></div>
                <div style="font-size:12pt;color:#555;margin-bottom:8pt;line-height:2;">
                    ${meta?.subject ? `<div><strong>Subject:</strong> ${meta.subject}</div>` : ''}
                    ${meta?.topic ? `<div><strong>Topic:</strong> ${meta.topic}</div>` : ''}
                    ${meta?.difficulty ? `<div><strong>Level:</strong> ${meta.difficulty}</div>` : ''}
                </div>
                <div style="font-size:10pt;color:#888;margin-top:30pt;padding-top:20pt;border-top:1pt solid #e0e0e0;">
                    <div style="margin-bottom:5pt;font-weight:600;">Generated by AthenaAI</div>
                    <div>${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>
            </div>
        </div>
    `;

    let tocHtml = '';
    if (tocEntries.length > 0) {
        let tocList = '<ul style="list-style:none;padding:0;margin:20pt 0 0 0;">';
        let currentSection = 0;
        tocEntries.forEach((entry, idx) => {
            const indent = entry.level > 1 ? (entry.level - 1) * 15 : 0;
            const bullet = entry.level === 1 ? '■' : entry.level === 2 ? '▪' : '•';
            const fontSize = entry.level === 1 ? '13pt' : entry.level === 2 ? '12pt' : '11pt';
            const fontWeight = entry.level === 1 ? 'bold' : 'normal';
            const marginTop = entry.level === 1 && idx > 0 ? '15pt' : '8pt';

            tocList += `<li style="margin:${marginTop} 0;padding-left:${indent}pt;font-size:${fontSize};color:#1f2937;font-weight:${fontWeight};">
                <span style="margin-right:8pt;color:#3f51b5;">${bullet}</span>
                <a href="#${entry.id}" style="color:#3f51b5;text-decoration:none;">${entry.text}</a>
            </li>`;
        });
        tocList += '</ul>';

        tocHtml = `
            <div style="padding:40pt 40pt;page-break-after:always;background:#fafbfc;">
                <div style="background:white;padding:35pt;border-radius:6pt;box-shadow:0 2pt 8pt rgba(0,0,0,0.08);">
                    <h2 style="font-size:22pt;margin:0 0 10pt 0;color:#1f2937;font-weight:bold;">Table of Contents</h2>
                    <div style="color:#666;font-size:11pt;margin-bottom:20pt;padding-bottom:15pt;border-bottom:2pt solid #e0e0e0;">Navigate through your study notes</div>
                    ${tocList}
                </div>
            </div>
        `;
    }
    // Add student-friendly PDF styles
    const style = `
        <style>
            :root { color-scheme: light; }
            body { 
                font-family: 'Times New Roman', Times, serif; 
                font-size: 11.5pt; 
                color: #1a1a1a; 
                line-height: 1.85;
                background: #ffffff;
                text-align: justify;
            }
            h1 { 
                font-size: 24pt; 
                margin: 0 0 10pt 0; 
                color: #1a1a1a; 
                font-weight: bold;
                border-bottom: 3pt solid #3f51b5;
                padding-bottom: 10pt;
                page-break-after: avoid;
                letter-spacing: 0.5pt;
            }
            h2 { 
                font-size: 18pt; 
                margin: 0; 
                color: #2c3e50; 
                font-weight: bold;
                page-break-after: avoid;
                letter-spacing: 0.3pt;
            }
            h3 { 
                font-size: 15pt; 
                margin: 0; 
                color: #34495e; 
                font-weight: bold;
                page-break-after: avoid;
            }
            p { 
                margin: 12pt 0; 
                line-height: 1.9; 
                text-align: justify;
                color: #2c2c2c;
                padding: 0 5pt;
                text-indent: 0;
            }
            ul, ol { 
                margin: 12pt 0 12pt 25pt; 
                padding-left: 25pt; 
                line-height: 1.9;
            }
            li {
                margin: 6pt 0;
                color: #2c2c2c;
            }
            strong {
                font-weight: bold;
                color: #1a1a1a;
            }
            code {
                background: #f5f5f5;
                padding: 2pt 6pt;
                border-radius: 3pt;
                font-family: 'Courier New', monospace;
                font-size: 10pt;
                color: #c7254e;
                border: 1pt solid #e0e0e0;
            }
            pre { 
                background: #f8f9fa; 
                padding: 12pt; 
                border: 1pt solid #dee2e6;
                border-left: 4pt solid #3f51b5;
                border-radius: 4pt; 
                overflow: auto;
                page-break-inside: avoid;
                font-family: 'Courier New', monospace;
                font-size: 9pt;
            }
            img { 
                max-width: 100%; 
                height: auto; 
                display: block; 
                margin: 12pt 0;
                page-break-inside: avoid;
            }
            .no-break { page-break-inside: avoid; }
            table, pre, img { page-break-inside: avoid; }
        </style>
    `;

    return style + titlePage + tocHtml + `<div class="pdf-body">${html}</div>`;
};

const formatNotesForDisplay = (notes: string) => {
    const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Extract code blocks and replace with stable placeholders
    const codeBlockMap = new Map<string, { lang: string; code: string }>();
    let idx = 0;
    let temp = notes.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
        const id = `__CODEBLOCK_${idx++}__`;
        codeBlockMap.set(id, { lang: lang || '', code });
        return id;
    });

    temp = escapeHtml(temp);

    // Convert markdown images to HTML
    temp = temp.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, src) => {
        return `<img src="${src}" alt="${alt}" style="max-width:100%;height:auto;display:block;margin:1rem 0;border-radius:0.5rem;box-shadow:0 2px 8px rgba(0,0,0,0.1);"/>`;
    });

    // Process lines with enhanced styling
    const lines = temp.replace(/\r/g, '').split('\n');
    let html = '';
    let inList = false;
    let inNumberedList = false;
    let paraLines: string[] = [];
    let sectionCounter = 0;
    let subsectionCounter = 0;

    const flushParagraph = () => {
        if (paraLines.length === 0) return;
        const text = paraLines.join(' ');
        const processed = text
            .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:700;color:#3f51b5;">$1</strong>')
            .replace(/``([^`]+)``/g, '<code style="background-color:#e0e7ff;padding:0.125rem 0.5rem;border-radius:0.25rem;font-size:0.9em;color:#4338ca;font-family:monospace;">$1</code>')
            .replace(/`([^`]+)`/g, '<code style="background-color:#e0e7ff;padding:0.125rem 0.5rem;border-radius:0.25rem;font-size:0.9em;color:#4338ca;font-family:monospace;">$1</code>');
        html += `<p style="margin:0 0 1rem;line-height:1.75;color:#374151;text-align:justify;">${processed}</p>`;
        paraLines = [];
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed) {
            flushParagraph();
            if (inList) { html += '</ul>'; inList = false; }
            if (inNumberedList) { html += '</ol>'; inNumberedList = false; }
            continue;
        }

        const h1 = trimmed.match(/^#\s+(.*)/);
        const h2 = trimmed.match(/^##\s+(.*)/);
        const h3 = trimmed.match(/^###\s+(.*)/);
        const h4 = trimmed.match(/^####\s+(.*)/);
        const bulletMatch = trimmed.match(/^[-*]\s+(.*)/);
        const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);

        if (h1) {
            flushParagraph();
            if (inList) { html += '</ul>'; inList = false; }
            if (inNumberedList) { html += '</ol>'; inNumberedList = false; }
            sectionCounter = 0;
            subsectionCounter = 0;
            html += `<div style="margin:1.5rem 0 1rem;padding:0.75rem 0;border-bottom:2px solid #3f51b5;">
                <h1 style="font-size:1.25rem;font-weight:700;margin:0;color:#1f2937;">${h1[1]}</h1>
            </div>`;
            continue;
        }
        if (h2) {
            flushParagraph();
            if (inList) { html += '</ul>'; inList = false; }
            if (inNumberedList) { html += '</ol>'; inNumberedList = false; }
            sectionCounter++;
            subsectionCounter = 0;
            html += `<div style="margin:1.25rem 0 0.75rem;padding:0.5rem 0 0.5rem 0.75rem;border-left:3px solid #3f51b5;">
                <h2 style="font-size:1.1rem;font-weight:700;margin:0;color:#1f2937;">
                    <span style="color:#3f51b5;margin-right:0.5rem;">${sectionCounter}.</span>${h2[1]}
                </h2>
            </div>`;
            continue;
        }
        if (h3) {
            flushParagraph();
            if (inList) { html += '</ul>'; inList = false; }
            if (inNumberedList) { html += '</ol>'; inNumberedList = false; }
            subsectionCounter++;
            html += `<div style="margin:1rem 0 0.5rem;padding:0.25rem 0 0.25rem 0.5rem;border-left:2px solid #6b7280;">
                <h3 style="font-size:1rem;font-weight:600;margin:0;color:#374151;">
                    <span style="color:#6b7280;margin-right:0.5rem;">${sectionCounter}.${subsectionCounter}</span>${h3[1]}
                </h3>
            </div>`;
            continue;
        }
        if (h4) {
            flushParagraph();
            if (inList) { html += '</ul>'; inList = false; }
            if (inNumberedList) { html += '</ol>'; inNumberedList = false; }
            html += `<h4 style="font-size:0.95rem;font-weight:600;margin:0.75rem 0 0.5rem;color:#4b5563;">${h4[1]}</h4>`;
            continue;
        }

        if (bulletMatch) {
            flushParagraph();
            if (inNumberedList) { html += '</ol>'; inNumberedList = false; }
            if (!inList) {
                html += '<ul style="margin:0.75rem 0 1rem;padding-left:2rem;list-style-type:none;">';
                inList = true;
            }
            const item = bulletMatch[1]
                .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:700;color:#3f51b5;">$1</strong>')
                .replace(/`([^`]+)`/g, '<code style="background-color:#e0e7ff;padding:0.125rem 0.5rem;border-radius:0.25rem;font-size:0.9em;color:#4338ca;font-family:monospace;">$1</code>');
            html += `<li style="margin-bottom:0.5rem;color:#374151;line-height:1.7;position:relative;padding-left:1.5rem;">
                <span style="position:absolute;left:0;top:0.4rem;width:0.5rem;height:0.5rem;background:#3f51b5;border-radius:50%;"></span>
                ${item}
            </li>`;
            continue;
        }

        if (numberedMatch) {
            flushParagraph();
            if (inList) { html += '</ul>'; inList = false; }
            if (!inNumberedList) {
                html += '<ol style="margin:0.75rem 0 1rem;padding-left:2rem;counter-reset:item;">';
                inNumberedList = true;
            }
            const item = numberedMatch[2]
                .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:700;color:#3f51b5;">$1</strong>')
                .replace(/`([^`]+)`/g, '<code style="background-color:#e0e7ff;padding:0.125rem 0.5rem;border-radius:0.25rem;font-size:0.9em;color:#4338ca;font-family:monospace;">$1</code>');
            html += `<li style="margin-bottom:0.5rem;color:#374151;line-height:1.7;list-style-position:inside;">
                <strong style="color:#3f51b5;margin-right:0.5rem;">${numberedMatch[1]}.</strong>${item}
            </li>`;
            continue;
        }

        paraLines.push(trimmed);
    }

    flushParagraph();
    if (inList) html += '</ul>';
    if (inNumberedList) html += '</ol>';

    // Restore code blocks from map
    let finalHtml = html;
    finalHtml = finalHtml.replace(/__CODEBLOCK_(\d+)__/g, (_m, n) => {
        const entry = codeBlockMap.get(`__CODEBLOCK_${n}__`);
        if (!entry) return '';
        const escapedCode = escapeHtml(entry.code.trim());
        return `<pre style="background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%);color:#e2e8f0;padding:1.25rem;border-radius:0.75rem;overflow-x:auto;font-size:0.875rem;line-height:1.6;margin:1rem 0;border:1px solid #334155;box-shadow:0 4px 12px rgba(0,0,0,0.3);"><code class="language-${entry.lang}" style="font-family:'Courier New',monospace;">${escapedCode}</code></pre>`;
    });

    return finalHtml;
};

// Extract a markdown section by heading name (e.g., 'Action Plan')
const extractSection = (notes: string, headingName: string) => {
    if (!notes) return null;
    const lines = notes.split(/\r?\n/);
    const startIdx = lines.findIndex(l => l.trim().toLowerCase().startsWith(`#`) && l.toLowerCase().includes(headingName.toLowerCase()));
    if (startIdx === -1) return null;

    // Determine heading level of the found heading
    const headingMatch = lines[startIdx].trim().match(/^(#+)\s+/);
    const level = headingMatch ? headingMatch[1].length : 2;

    const sectionLines: string[] = [];
    for (let i = startIdx + 1; i < lines.length; i++) {
        const line = lines[i];
        const hMatch = line.trim().match(/^(#+)\s+/);
        if (hMatch && hMatch[1].length <= level) break; // next top-level or same-level heading => stop
        sectionLines.push(line);
    }

    // Return the heading plus the content as markdown
    return [lines[startIdx], ...sectionLines].join('\n').trim();
};

export default function NotesMakerPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [notesResult, setNotesResult] = useState<NotesResult | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [rotatedImageDataUri, setRotatedImageDataUri] = useState<string | null>(null);
    const [rotationDeg, setRotationDeg] = useState(0);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [editedNotes, setEditedNotes] = useState<string | null>(null);
    const [showRawMarkdown, setShowRawMarkdown] = useState(false);
    const [keywordsCollapsed, setKeywordsCollapsed] = useState(false);
    const [isExtractingKeywords, setIsExtractingKeywords] = useState(false);
    const [savingToDrive, setSavingToDrive] = useState(false);
    const { connected: driveConnected, uploadFile } = useDrive();
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();

    const subjectsQuery = useMemoFirebase(
        () => (user && firestore ? collection(firestore, 'users', user.uid, 'subjects') : null),
        [user, firestore]
    );
    const { data: subjects, isLoading: subjectsLoading } = useCollection<Subject>(subjectsQuery);

    const userDocRef = useMemoFirebase(
        () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
        [user, firestore]
    );
    const { data: userProfile } = useDoc(userDocRef);

    const form = useForm<NotesMakerFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            subject: '',
            generationType: 'document',
            topic: '',
            difficulty: 'Intermediate',
            specificTopic: '',
            pageRange: '',
            specifications: '',
        },
    });







    const onSubmit = async (data: NotesMakerFormValues) => {
        setIsLoading(true);
        setNotesResult(null);

        let extractedText: string | undefined;
        let topicForAI: string | undefined = data.topic;

        try {
            if (data.generationType === 'document') {
                if (hasFormFileValue(data.file)) {
                    let fileType: string;
                    let fileDataUri: string;
                    if (isDriveImportFormValue(data.file)) {
                        fileType = data.file.type;
                        fileDataUri = data.file.dataUri;
                    } else if (data.file[0]) {
                        const file = data.file[0];
                        fileType = file.type;
                        fileDataUri = await toBase64(file);
                    } else {
                        fileType = '';
                        fileDataUri = '';
                    }

                    if (fileDataUri) {
                        if (fileType.startsWith('image/')) {
                            const imageToSend = rotatedImageDataUri || fileDataUri;
                            const result = await extractTextFromImage({ imageDataUri: imageToSend, subject: data.subject });
                            if (!result.extractedText) {
                                toast({ variant: 'destructive', title: 'Extraction Failed', description: result.reasoning || 'Could not extract text from the image.' });
                                setIsLoading(false);
                                return;
                            }
                            extractedText = result.extractedText;
                        } else if (isPdfLikeMime(fileType)) {
                            const result = await extractTextFromPdf({ pdfDataUri: fileDataUri });
                            extractedText = result.extractedText;
                        } else {
                            toast({ variant: 'destructive', title: 'Unsupported File', description: 'Please upload a PDF or image file.' });
                            setIsLoading(false);
                            return;
                        }
                    }
                }

                if (!extractedText) {
                    toast({ variant: 'destructive', title: 'No Content', description: 'Could not find any text in the uploaded file to create notes from.' });
                    setIsLoading(false);
                    return;
                }
            }

            const result = await generateNotes({
                text: extractedText,
                topic: topicForAI,
                difficulty: data.difficulty,
                subject: data.subject,
                specifications: data.specifications,
                specificTopic: data.specificTopic,
                includeKeywords: true,
            });

            setNotesResult(result);

            // Save to history
            if (user && firestore) {
                try {
                    const historyRef = collection(firestore, 'users', user.uid, 'notesHistory');
                    await addDocumentNonBlocking(historyRef, {
                        subject: data.subject,
                        topic: topicForAI || data.topic || 'Untitled',
                        difficulty: data.difficulty || 'Intermediate',
                        generationType: data.generationType,
                        specifications: data.specifications,
                        notes: result.notes,
                        keywords: result.keywords || [],
                        createdAt: new Date().toISOString(),
                        timestamp: Date.now(),
                    });
                } catch (err) {
                    console.error('Failed to save notes to history:', err);
                }
            }

            if (result && (!result.keywords || result.keywords.length === 0)) {
                try {
                    setIsExtractingKeywords(true);
                    const kws = await extractKeywordsFromNotes({ notes: result.notes, subject: data.subject });
                    setNotesResult(prev => prev ? { ...prev, keywords: kws.keywords } : prev);
                    if (kws && kws.keywords && kws.keywords.length > 0) {
                        toast({ title: 'Keyword explanations added' });
                    }
                } finally {
                    setIsExtractingKeywords(false);
                }
            }
            toast({ title: 'Notes Generated!', description: 'Your AI-powered notes are ready and saved to history.' });

        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error Generating Notes',
                description: 'There was a problem generating your notes. Please try again.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const buildNotesPdfDoc = (): jsPDF => {
        if (!notesResult) throw new Error('No notes to export');

        const doc = new jsPDF();
        const { subject, topic, difficulty } = form.getValues();
        const reportTitle = `Study Notes: ${subject} - ${topic || 'Generated Notes'}`;
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = { top: 70, bottom: 30, left: 20, right: 20 };
        const contentWidth = pageWidth - margin.left - margin.right;

        let yPosition = margin.top;

        // Header function
        const addHeader = () => {
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(63, 81, 181);
            doc.text('AthenaAI', margin.left, 20);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 100, 100);
            doc.text(userProfile?.collegeName || '', pageWidth - margin.right, 20, { align: 'right' });

            doc.setLineWidth(0.5);
            doc.setDrawColor(63, 81, 181);
            doc.line(margin.left, 25, pageWidth - margin.right, 25);

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(63, 81, 181);
            doc.text(reportTitle, pageWidth / 2, 40, { align: 'center' });

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text(`Student: ${userProfile?.fullName || 'Student'}`, margin.left, 55);
            if (difficulty) {
                doc.text(`Level: ${difficulty}`, pageWidth - margin.right, 55, { align: 'right' });
            }
        };

        // Footer function
        const addFooter = (pageNum: number) => {
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 15, { align: 'center' });
        };

        // Process notes content
        const notesWithoutActionPlan = removeActionPlan(notesResult.notes);
        const lines = notesWithoutActionPlan.split('\n');

        let pageNum = 1;
        addHeader();

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) {
                yPosition += 5;
                continue;
            }

            // Check for headings
            if (line.startsWith('# ')) {
                // Main heading (H1)
                if (yPosition > pageHeight - margin.bottom - 20) {
                    addFooter(pageNum);
                    doc.addPage();
                    pageNum++;
                    addHeader();
                    yPosition = margin.top;
                }
                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(63, 81, 181);
                const text = line.replace(/^#\s+/, '');
                doc.text(text, margin.left, yPosition);
                yPosition += 20;
            } else if (line.startsWith('## ')) {
                // Subheading (H2)
                if (yPosition > pageHeight - margin.bottom - 15) {
                    addFooter(pageNum);
                    doc.addPage();
                    pageNum++;
                    addHeader();
                    yPosition = margin.top;
                }
                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(63, 81, 181);
                const text = line.replace(/^##\s+/, '');
                doc.text(text, margin.left, yPosition);
                yPosition += 15;
            } else if (line.startsWith('### ')) {
                // Sub-subheading (H3)
                if (yPosition > pageHeight - margin.bottom - 12) {
                    addFooter(pageNum);
                    doc.addPage();
                    pageNum++;
                    addHeader();
                    yPosition = margin.top;
                }
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(0, 0, 0);
                const text = line.replace(/^###\s+/, '');
                doc.text(text, margin.left, yPosition);
                yPosition += 12;
            } else {
                // Regular text or bullet points
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(0, 0, 0);

                const processedLine = line.replace(/\*\*(.*?)\*\*/g, '$1'); // Remove bold markers
                const splitText = doc.splitTextToSize(processedLine, contentWidth);

                for (let j = 0; j < splitText.length; j++) {
                    if (yPosition > pageHeight - margin.bottom - 10) {
                        addFooter(pageNum);
                        doc.addPage();
                        pageNum++;
                        addHeader();
                        yPosition = margin.top;
                    }
                    doc.text(splitText[j], margin.left, yPosition);
                    yPosition += 8;
                }
            }
        }

        // Add keywords section
        if (notesResult.keywords && notesResult.keywords.length > 0) {
            yPosition += 15;
            if (yPosition > pageHeight - margin.bottom - 50) {
                addFooter(pageNum);
                doc.addPage();
                pageNum++;
                addHeader();
                yPosition = margin.top;
            }

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(63, 81, 181);
            doc.text('Key Concepts & Definitions', margin.left, yPosition);
            yPosition += 15;

            notesResult.keywords.forEach(kw => {
                if (yPosition > pageHeight - margin.bottom - 30) {
                    addFooter(pageNum);
                    doc.addPage();
                    pageNum++;
                    addHeader();
                    yPosition = margin.top;
                }

                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(0, 0, 0);
                doc.text(kw.term, margin.left, yPosition);
                yPosition += 10;

                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                const explanationLines = doc.splitTextToSize(kw.explanation, contentWidth);
                explanationLines.forEach((line: string) => {
                    if (yPosition > pageHeight - margin.bottom - 10) {
                        addFooter(pageNum);
                        doc.addPage();
                        pageNum++;
                        addHeader();
                        yPosition = margin.top;
                    }
                    doc.text(line, margin.left + 5, yPosition);
                    yPosition += 8;
                });
                yPosition += 8;
            });
        }

        addFooter(pageNum);
        return doc;
    };

    const downloadPdf = () => {
        if (!notesResult) return;
        buildNotesPdfDoc().save('study-notes.pdf');
    };

    const saveNotesPdfToDrive = async () => {
        if (!notesResult || !driveConnected) return;
        setSavingToDrive(true);
        try {
            const doc = buildNotesPdfDoc();
            const blob = doc.output('blob');
            const { subject, topic } = form.getValues();
            const safe = (s: string) => s.replace(/[/\\?%*:|"<>]/g, '-').slice(0, 80);
            await uploadFile(blob, `Notes - ${safe(subject || 'notes')}${topic ? ` - ${safe(topic)}` : ''}.pdf`, 'application/pdf');
            toast({ title: 'Saved to Google Drive!' });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Save failed';
            toast({ variant: 'destructive', title: 'Save failed', description: message });
        } finally {
            setSavingToDrive(false);
        }
    };



    const watchedFile = form.watch('file');
    const generationType = form.watch('generationType');





    return (
        <div className="flex flex-col gap-8" >
            <div className="flex items-center gap-4">
                <PageHeader
                    title="AI Notes Maker"
                    description="Let AI make organized, student-style notes with keyword explanations."
                />
            </div>

            {/* Page-level hero / tips card for a polished, attractive UI */}
            <div className="w-full" >
                <div className="rounded-xl bg-gradient-to-r from-indigo-50 via-white to-emerald-50 border p-6 shadow-sm flex items-center justify-between gap-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Create Complete, Student-Ready Notes</h1>
                        <p className="mt-2 text-sm text-slate-600 max-w-xl">Upload a PDF or image, or enter a topic. AthenaAI will generate fully structured notes, key concept explanations, and a practical action plan you can follow.</p>
                        {/* <div className="mt-3 flex items-center gap-2">
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">Pro tip</span>
                            <span className="text-sm text-muted-foreground">Use the keyword toggle to show/hide detailed explanations without losing them.</span>
                        </div> */}
                    </div>
                    <div className="hidden md:flex items-center justify-center">
                        <Sparkles className="h-12 w-12 text-primary/80" />
                    </div>
                </div>
            </div >

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start h-[calc(100vh-200px)]">
                {/* LEFT SIDE - Details Form with its own scroll */}
                <div className="h-full overflow-y-scroll pr-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BookCopy className="h-6 w-6" />
                                Provide Your Content
                            </CardTitle>
                            <CardDescription>Choose to generate notes from a document or a general topic.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                    <FormField
                                        control={form.control}
                                        name="subject"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Subject</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={subjectsLoading}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={subjectsLoading ? "Loading subjects..." : "Select a subject"} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="general">General</SelectItem>
                                                        {subjects?.map((subject) => (
                                                            <SelectItem key={subject.id} value={subject.name}>
                                                                {subject.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="generationType"
                                        render={({ field }) => (
                                            <FormItem className="space-y-3">
                                                <FormControl>
                                                    <Tabs defaultValue={field.value} onValueChange={field.onChange} className="w-full">
                                                        <TabsList className="grid w-full grid-cols-2">
                                                            <TabsTrigger value="document"><File className="mr-2 h-4 w-4" />From Document</TabsTrigger>
                                                            <TabsTrigger value="topic"><Pilcrow className="mr-2 h-4 w-4" />From Topic</TabsTrigger>
                                                        </TabsList>
                                                    </Tabs>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    {generationType === 'document' && (
                                        <div className='space-y-6'>
                                            <FormField
                                                control={form.control}
                                                name="file"
                                                render={() => (
                                                    <FormItem>
                                                        <FormLabel>Upload a PDF or Image</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <Label
                                                                    htmlFor="file-upload"
                                                                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer border-primary/50 bg-muted/20 hover:border-primary hover:bg-primary/5"
                                                                >
                                                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                                        <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                                                                        <p className="mb-1 text-sm text-muted-foreground">
                                                                            <span className="font-semibold">Click to upload</span> or drag and drop
                                                                        </p>
                                                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                                            <File className="h-3 w-3" /> PDF or <ImageIcon className="h-3 w-3" /> Image
                                                                        </p>
                                                                        {getFormFileDisplayName(watchedFile) && (
                                                                            <p className="mt-2 text-xs font-bold">{getFormFileDisplayName(watchedFile)}</p>
                                                                        )}
                                                                    </div>
                                                                </Label>
                                                                <Controller
                                                                    name="file"
                                                                    control={form.control}
                                                                    render={({ field: { onChange } }) => (
                                                                        <Input id="file-upload" type="file" accept=".pdf,image/*" className="sr-only"
                                                                            onChange={(e) => {
                                                                                const files = e.target.files;
                                                                                onChange(files);
                                                                                if (files && files[0]) {
                                                                                    // create preview and initialize rotation
                                                                                    toBase64(files[0]).then(dataUrl => {
                                                                                        setPreviewImage(dataUrl);
                                                                                        setRotatedImageDataUri(dataUrl);
                                                                                        setRotationDeg(0);
                                                                                    }).catch(() => {
                                                                                        setPreviewImage(null);
                                                                                        setRotatedImageDataUri(null);
                                                                                        setRotationDeg(0);
                                                                                    });
                                                                                } else {
                                                                                    setPreviewImage(null);
                                                                                    setRotatedImageDataUri(null);
                                                                                    setRotationDeg(0);
                                                                                }
                                                                            }}
                                                                        />
                                                                    )}
                                                                />
                                                                {hasFormFileValue(watchedFile) && (
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="absolute top-2 right-2 h-6 w-6"
                                                                        onClick={() => {
                                                                            form.resetField('file');
                                                                            setPreviewImage(null);
                                                                            setRotatedImageDataUri(null);
                                                                            setRotationDeg(0);
                                                                        }}
                                                                    >
                                                                        <X className="h-4 w-4" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                            <div className="flex justify-center pt-2">
                                                                <DriveImportButton
                                                                    onImported={({ dataUri, mimeType, name }) => {
                                                                        form.setValue('file', {
                                                                            __driveImport: true,
                                                                            dataUri,
                                                                            name,
                                                                            type: mimeType,
                                                                        } as any);
                                                                        if (mimeType.startsWith('image/')) {
                                                                            setPreviewImage(dataUri);
                                                                            setRotatedImageDataUri(dataUri);
                                                                            setRotationDeg(0);
                                                                        } else {
                                                                            setPreviewImage(null);
                                                                            setRotatedImageDataUri(null);
                                                                            setRotationDeg(0);
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage>{form.formState.errors.file?.message as React.ReactNode}</FormMessage>
                                                        {/* Preview and rotate controls for image straightening */}
                                                        {previewImage && (
                                                            <div className="mt-4">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <Button size="sm" variant="ghost" onClick={async () => {
                                                                        const newDeg = (rotationDeg - 90) % 360;
                                                                        try {
                                                                            const rotated = await rotateDataUrl(rotatedImageDataUri || previewImage, -90);
                                                                            setRotatedImageDataUri(rotated);
                                                                            setRotationDeg((newDeg + 360) % 360);
                                                                        } catch (e) {
                                                                            toast({ variant: 'destructive', title: 'Rotate failed', description: 'Could not rotate the image.' });
                                                                        }
                                                                    }}>Rotate Left</Button>
                                                                    <Button size="sm" variant="ghost" onClick={async () => {
                                                                        const newDeg = (rotationDeg + 90) % 360;
                                                                        try {
                                                                            const rotated = await rotateDataUrl(rotatedImageDataUri || previewImage, 90);
                                                                            setRotatedImageDataUri(rotated);
                                                                            setRotationDeg(newDeg);
                                                                        } catch (e) {
                                                                            toast({ variant: 'destructive', title: 'Rotate failed', description: 'Could not rotate the image.' });
                                                                        }
                                                                    }}>Rotate Right</Button>
                                                                    <Button size="sm" variant="outline" onClick={() => {
                                                                        setRotatedImageDataUri(previewImage);
                                                                        setRotationDeg(0);
                                                                    }}>Reset</Button>
                                                                </div>

                                                                <div className="border rounded-md overflow-hidden">
                                                                    <img src={rotatedImageDataUri || previewImage} alt="Preview" className="w-full object-contain" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </FormItem>
                                                )}
                                            />
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <FormField
                                                    control={form.control}
                                                    name="specificTopic"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Specific Topic/Chapter (Optional)</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="e.g., Chapter 3" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="pageRange"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Page Range (Optional)</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="e.g., 25-30" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {generationType === 'topic' && (
                                        <div className='space-y-6'>
                                            <FormField
                                                control={form.control}
                                                name="topic"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Topic</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="e.g., The French Revolution" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="difficulty"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Difficulty Level</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select a difficulty" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="Beginner">Beginner</SelectItem>
                                                                <SelectItem value="Intermediate">Intermediate</SelectItem>
                                                                <SelectItem value="Advanced">Advanced</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}

                                    <FormField
                                        control={form.control}
                                        name="specifications"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Additional Specifications (Required)</FormLabel>
                                                <FormControl>
                                                    <Textarea placeholder="e.g., Focus on the historical context, explain formulas in simple terms, include examples, add diagrams descriptions, etc." {...field} rows={3} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <LoadingButton type="submit" loading={isLoading} loadingText="Generating Notes..." className="w-full">
                                        Make Notes
                                    </LoadingButton>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </div>

                {/* RIGHT SIDE - Study Notes with its own scroll */}
                <div className="h-full overflow-y-auto pr-2">
                    <div className="space-y-8">
                        <AnimatePresence>
                            {isLoading && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                >
                                    <AiLoadingScreen variant="notes" title="Generating your notes..." />
                                </motion.div>
                            )}

                            {notesResult && !isLoading && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-8"
                                >
                                    <Card className="border-2 border-primary/20 shadow-lg">
                                        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b-2 border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                            <div className='space-y-1.5'>
                                                <CardTitle className='flex items-center gap-2 text-xl'>
                                                    <BookCopy className='h-6 w-6 text-primary' />
                                                    Your AI-Generated Notes
                                                </CardTitle>
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <p className="text-sm text-muted-foreground">Well-organized notes with key explanations</p>
                                                    <span className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary font-medium">{form.getValues().subject || 'General'}</span>
                                                    {form.getValues().topic && <span className="text-xs px-2 py-1 rounded-md bg-emerald-100 text-emerald-800 font-medium">Topic: {form.getValues().topic}</span>}
                                                    {form.getValues().difficulty && <span className="text-xs px-2 py-1 rounded-md bg-amber-100 text-amber-800 font-medium">{form.getValues().difficulty}</span>}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Button onClick={downloadPdf} variant="default" size="sm" className="w-full sm:w-auto bg-primary hover:bg-primary/90">
                                                    <FileDown className="mr-2 h-4 w-4" />
                                                    Download PDF
                                                </Button>
                                                {driveConnected && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="gap-1.5"
                                                        disabled={savingToDrive}
                                                        onClick={() => void saveNotesPdfToDrive()}
                                                    >
                                                        {savingToDrive ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                                        Save to Drive
                                                    </Button>
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4 pt-6">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => {
                                                        const toCopy = editedNotes ?? notesResult.notes;
                                                        navigator.clipboard.writeText(toCopy || '');
                                                        toast({ title: 'Notes copied to clipboard' });
                                                    }}>Copy Notes</Button>
                                                    <Button size="sm" variant={isEditingNotes ? 'secondary' : 'ghost'} onClick={() => {
                                                        if (!isEditingNotes) {
                                                            setEditedNotes(notesResult.notes);
                                                            setIsEditingNotes(true);
                                                            setShowRawMarkdown(true);
                                                        } else {
                                                            setIsEditingNotes(false);
                                                        }
                                                    }}>{isEditingNotes ? 'Close Editor' : 'Edit Notes'}</Button>
                                                    <Button size="sm" variant="ghost" onClick={() => setShowRawMarkdown(s => !s)}>{showRawMarkdown ? 'Hide Raw' : 'Show Raw'}</Button>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button size="sm" variant="ghost" onClick={() => setKeywordsCollapsed(k => !k)}>{keywordsCollapsed ? 'Expand Keywords' : 'Collapse Keywords'}</Button>
                                                </div>
                                            </div>

                                            {/* Editable textarea for raw/edited notes */}
                                            {isEditingNotes ? (
                                                <div className="w-full">
                                                    <Textarea value={editedNotes ?? ''} onChange={(e) => setEditedNotes(e.target.value)} rows={16} className="w-full font-mono text-sm" />
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <Button size="sm" onClick={() => {
                                                            // Save edited notes into the result so UI updates
                                                            setNotesResult(prev => prev ? { ...prev, notes: editedNotes ?? prev.notes } : prev);
                                                            setIsEditingNotes(false);
                                                            toast({ title: 'Edits saved' });
                                                        }}>Save Edits</Button>
                                                        <Button size="sm" variant="ghost" onClick={() => { setEditedNotes(notesResult.notes); setIsEditingNotes(false); }}>Cancel</Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                // Rendered view or raw markdown
                                                showRawMarkdown ? (
                                                    <pre className="w-full whitespace-pre-wrap rounded-md bg-muted/30 p-4 text-sm font-mono border border-primary/20 max-h-96 overflow-auto">{editedNotes ?? notesResult.notes}</pre>
                                                ) : (
                                                    <div className="rounded-lg border border-gray-200 bg-white dark:bg-gray-900 p-6 shadow-sm">
                                                        <div className="flex items-start justify-between mb-4 pb-3 border-b border-gray-200">
                                                            <div>
                                                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Organized Study Notes</h2>
                                                                <div className="mt-2 flex items-center gap-2 flex-wrap">
                                                                    <span className="text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-700 font-medium">{form.getValues().subject || 'General'}</span>
                                                                    {form.getValues().topic && <span className="text-xs px-2 py-1 rounded-md bg-green-50 text-green-700 font-medium">Topic: {form.getValues().topic}</span>}
                                                                    {form.getValues().difficulty && <span className="text-xs px-2 py-1 rounded-md bg-yellow-50 text-yellow-700 font-medium">{form.getValues().difficulty}</span>}
                                                                </div>
                                                            </div>
                                                            <div className="text-xs text-gray-500">{new Date().toLocaleDateString()}</div>
                                                        </div>

                                                        <div className="text-sm leading-relaxed text-gray-800 dark:text-gray-200" dangerouslySetInnerHTML={{ __html: formatNotesForDisplay(removeActionPlan(notesResult.notes)) }} />
                                                    </div>
                                                )
                                            )}

                                            {notesResult ? (
                                                <div className="pt-6 mt-6 border-t-2 border-primary/10">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <h3 className="text-lg font-semibold flex items-center gap-2 text-primary">
                                                            <Milestone className="h-5 w-5" />
                                                            Key Concepts & Definitions
                                                        </h3>
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex items-center gap-3">
                                                                {isExtractingKeywords && <Loader className="h-4 w-4 animate-spin text-primary" />}
                                                                <span className="text-sm text-muted-foreground">Keyword explanations shown</span>
                                                            </div>
                                                        </div>
                                                        {notesResult.keywords && notesResult.keywords.length > 0 && (
                                                            <div className="flex items-center gap-2">
                                                                <Button size="sm" variant="outline" onClick={() => {
                                                                    const text = notesResult.keywords?.map(k => `${k.term}: ${k.explanation}`).join('\n\n') || '';
                                                                    navigator.clipboard.writeText(text);
                                                                    toast({ title: 'Keywords copied' });
                                                                }} className="text-xs">{keywordsCollapsed ? 'Show All' : 'Copy All'}</Button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Show keywords as an accordion when available; otherwise show a small notice */}
                                                    {notesResult.keywords && notesResult.keywords.length > 0 && !keywordsCollapsed ? (
                                                        <Accordion type="single" collapsible className="w-full">
                                                            {notesResult.keywords.map((item, index) => (
                                                                <AccordionItem key={index} value={`item-${index}`} className="border-l-2 border-primary/30 pl-2">
                                                                    <AccordionTrigger className="flex items-center justify-between group hover:no-underline py-3">
                                                                        <span className="flex-1 text-left font-semibold text-sm text-foreground">{item.term}</span>
                                                                        <Button asChild size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0">
                                                                            <span onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(item.explanation); toast({ title: 'Keyword copied' }); }} className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm">Copy</span>
                                                                        </Button>
                                                                    </AccordionTrigger>
                                                                    <AccordionContent className="pb-4">
                                                                        <div className="bg-muted/30 rounded-md p-3 text-card-foreground text-sm leading-relaxed">
                                                                            {item.explanation}
                                                                        </div>
                                                                    </AccordionContent>
                                                                </AccordionItem>
                                                            ))}
                                                        </Accordion>
                                                    ) : (!isExtractingKeywords && (!notesResult.keywords || notesResult.keywords.length === 0) ? (
                                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                                                            <p className="text-sm text-amber-800">No keyword explanations are available. Try regenerating notes to attempt AI extraction again.</p>
                                                        </div>
                                                    ) : null)}
                                                </div>
                                            ) : null}
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {!notesResult && !isLoading && (
                            <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-primary/30 rounded-lg h-full bg-gradient-to-br from-primary/5 to-transparent">
                                <div className="p-4 bg-primary/10 rounded-full mb-4">
                                    <BookCopy className="h-12 w-12 text-primary" />
                                </div>
                                <h3 className="text-lg font-semibold text-foreground mb-2">No Notes Yet</h3>
                                <p className="text-muted-foreground text-sm max-w-xs">Fill out the form on the left and upload a document or enter a topic to get started with your AI-powered notes.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
}

