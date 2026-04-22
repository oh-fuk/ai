'use client';

import { PenSquare, FileText, Briefcase, BookOpen } from "lucide-react";
import ModuleGrid from "@/components/app/module-grid";

const items = [
  { title: "Essay Writer", icon: PenSquare, href: "/writing/essay", description: "Generate well-structured, detailed essays on any topic in seconds." },
  { title: "Email Writer", icon: FileText, href: "/writing/email", description: "Draft professional emails for any purpose — formal, academic, or casual." },
  { title: "Application Writer", icon: Briefcase, href: "/writing/application", description: "Create formal applications for jobs, leave requests, admissions, and more." },
  { title: "Letter Writer", icon: BookOpen, href: "/writing/letter", description: "Compose formal or informal letters with the right tone and structure." },
];

export default function WritingPage() {
  return (
    <ModuleGrid
      title="Writing Tools"
      description="AI-powered writing assistants for essays, emails, applications, and letters."
      badge="Write"
      items={items}
    />
  );
}
