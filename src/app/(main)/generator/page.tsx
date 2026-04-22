'use client';

import { BrainCircuit, PenSquare, FileCheck } from "lucide-react";
import ModuleGrid from "@/components/app/module-grid";

const items = [
  { title: "Quiz Generator", icon: BrainCircuit, href: "/quiz", description: "Create quizzes from a topic, text, or your uploaded documents." },
  { title: "Paper Generator", icon: PenSquare, href: "/paper-generator", description: "Generate full practice exam papers with MCQs, short and long questions." },
  { title: "Guess Paper Generator", icon: FileCheck, href: "/guess-paper", description: "Analyze past papers to predict the most likely questions for your next exam." },
];

export default function GeneratorPage() {
  return (
    <ModuleGrid
      title="Generator Tools"
      description="AI-powered tools to create quizzes, papers, and exam predictions from your study materials."
      badge="Generate"
      items={items}
    />
  );
}
