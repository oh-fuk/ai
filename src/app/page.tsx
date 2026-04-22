
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AthenaLogo } from '@/components/app/logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BrainCircuit,
  FileSearch,
  PenSquare,
  CalendarDays,
  Timer,
  Image as ImageIcon,
  LineChart,
  MessageCircle,
  Sparkles,
  FileCheck,
  Sigma,
  BookCopy,
  SpellCheck,
  FileSignature,
  FileText,
  Briefcase,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggler } from '@/components/app/theme-toggler';

const features = [
  {
    title: 'AI Chat',
    description: 'Get personalized academic advice from a context-aware AI that understands your study patterns.',
    icon: MessageCircle,
  },
  {
    title: 'Quiz Generator',
    description: 'Create custom multiple-choice quizzes from topics, PDFs, or even your weakest subjects.',
    icon: BrainCircuit,
  },
  {
    title: 'Paper Generator',
    description: 'Generate practice exam papers with a mix of question types to prepare for the real thing.',
    icon: PenSquare,
  },
  {
    title: 'AI Summarizer',
    description: 'Condense long documents, articles, or pasted text into concise, easy-to-digest summaries.',
    icon: FileSearch,
  },
  {
    title: 'Study Planner',
    description: 'Automatically generate structured, actionable study plans based on a topic or syllabus.',
    icon: CalendarDays,
  },
  {
    title: 'Study Timer',
    description: 'Manage focused study sessions and breaks with a built-in Pomodoro timer.',
    icon: Timer,
  },
  {
    title: 'Image to Text',
    description: 'Extract text from handwritten notes or book pages and get AI-powered explanations.',
    icon: ImageIcon,
  },
  {
    title: 'Progress Tracker',
    description: 'Visualize your academic growth with charts and statistics on your performance.',
    icon: LineChart,
  },
  {
    title: "Guess Paper Generator",
    description: "Analyze past papers to predict future exam questions.",
    icon: FileCheck,
  },
  {
    title: "Text Analyzer",
    description: "Get detailed statistics and keyword explanations for your text.",
    icon: Sigma,
  },
  {
    title: "Notes Maker",
    description: "Generate student-style notes from your documents.",
    icon: BookCopy,
  },
  {
    title: "Grammar Checker",
    description: "Check your writing for grammatical errors.",
    icon: SpellCheck,
  },
  {
    title: "Paper Analysis",
    description: "Let the AI grade your paper or solve it for you.",
    icon: FileSignature,
  },
  {
    title: "Essay Writer",
    description: "Generate well-structured essays on any topic.",
    icon: PenSquare,
  },
  {
    title: "Email Writer",
    description: "Draft professional emails for various purposes.",
    icon: FileText,
  },
  {
    title: "Application Writer",
    description: "Create formal applications for jobs, leave, etc.",
    icon: Briefcase,
  },
  {
    title: "Letter Writer",
    description: "Compose formal or informal letters with ease.",
    icon: BookOpen,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: 'easeOut',
    },
  },
};

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      {/* Header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="sticky top-0 z-50 flex items-center justify-between p-4 bg-background/80 backdrop-blur-sm border-b"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <AthenaLogo className="h-8 w-8" />
            <span className="text-xl font-bold font-headline">AthenaAI</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggler />
          <Button variant="ghost" asChild>
            <Link href="/login">Log In</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Sign Up</Link>
          </Button>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 md:py-32 text-center flex flex-col items-center justify-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <Image
              src="https://images.unsplash.com/photo-1677442d019cecf8fbf11497c339629d1c5c78c11?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
              alt="Abstract neural network"
              fill
              sizes="100vw"
              style={{ objectFit: "cover" }}
              className="opacity-30"
            />
            <div className="absolute inset-0 bg-background/80"></div>
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.6, ease: 'backOut' }}
              className="flex items-center justify-center gap-4 mb-8"
            >
              <Image src="https://tse3.mm.bing.net/th/id/OIP.Za0LyZ-7RsrF946oeekWvQHaHe?cb=ucfimgc2&rs=1&pid=ImgDetMain&o=7&rm=3" alt="IMCB G-10/4 Logo" width={100} height={100} className="h-32 w-32 rounded-full" />
              <AthenaLogo className="h-32 w-32" />
            </motion.div>
            <motion.h1
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              className="text-4xl md:text-6xl font-bold tracking-tight font-headline text-foreground"
            >
              Your Personal AI Study Partner
            </motion.h1>
            <motion.p
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.2 }}
              className="mt-4 max-w-2xl text-lg text-foreground/80"
            >
              AthenaAI leverages cutting-edge artificial intelligence to help you study smarter, not harder. From generating quizzes to planning your schedule, we've got you covered.
            </motion.p>
            <motion.div
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.4 }}
              className="mt-8"
            >
              <Button size="lg" asChild>
                <Link href="/register">Get Started for Free</Link>
              </Button>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 md:py-24 bg-muted/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="text-3xl md:text-4xl font-bold font-headline"
              >
                A Full Suite of AI-Powered Tools
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="mt-2 text-muted-foreground max-w-xl mx-auto"
              >
                Everything you need to excel in your studies, all in one place.
              </motion.p>
            </div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {features.map((feature) => (
                <motion.div
                  key={feature.title}
                  variants={itemVariants}
                  whileHover={{ y: -5, boxShadow: '0px 0px 20px hsl(var(--primary) / 0.3)', transition: { duration: 0.2 } }}
                >
                  <Card className="h-full flex flex-col">
                    <CardHeader className="flex-row items-start gap-4">
                      <div className="p-3 bg-primary/10 rounded-lg text-primary">
                        <feature.icon className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle>{feature.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <p className="text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 text-center text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} AthenaAI StudyBuddy. All rights reserved.</p>
        </footer>
      </main>
    </div>
  );
}
