'use client';

import { FileSearch, Sigma, BookCopy, Image as ImageIcon, SpellCheck } from "lucide-react";
import ModuleGrid from "@/components/app/module-grid";

const items = [
  { title: "Text Analyzer", icon: Sigma, href: "/analyzer/text-analyzer", description: "Get detailed statistics and insights about any text from various sources." },
  { title: "Summarizer", icon: FileSearch, href: "/summarize", description: "Get concise AI-powered summaries of long articles, PDFs, or notes." },
  { title: "Notes Maker", icon: BookCopy, href: "/notes-maker", description: "Generate clean, structured student-style notes from any document or topic." },
  { title: "Image to Text", icon: ImageIcon, href: "/image-to-text", description: "Extract text from images and get AI explanations of the content." },
  { title: "Grammar Checker", icon: SpellCheck, href: "/analyzer/grammar-checker", description: "Check your writing for grammatical errors and get clear correction suggestions." },
];

export default function AnalyzerPage() {
  return (
    <ModuleGrid
      title="Analysis Tools"
      description="AI-powered tools to analyze, summarize, and understand your study materials."
      badge="Analyze"
      items={items}
    />
  );
}
