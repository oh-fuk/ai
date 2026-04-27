"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  BookOpen, Brain, FileText, Clock, Music, FileSearch,
  PenTool, Calendar, BarChart3, FileCheck, BookCopy,
  SpellCheck, MessageCircle, ChevronRight, Play, X, Menu,
  Sparkles, Zap, Users, Volume2, Globe, CheckCircle,
  ChevronDown, Shield, Rocket, LayoutDashboard,
} from "lucide-react";
import Link from "next/link";
import { AthenaLogo } from "@/components/app/logo";

// 3D scene — client only, no SSR (fixes React 19 + three.js crash)
const ThreeScene = dynamic(() => import("@/components/app/three-scene"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a2e] via-[#070714] to-[#070714]" />,
});

/* ─── Background Music ───────────────────────────────────────────────────── */
function BackgroundMusic() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(
      "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=ocean-waves-112906.mp3"
    );
    audioRef.current.loop = true;
    audioRef.current.volume = 0.3;
    return () => { audioRef.current?.pause(); };
  }, []);

  const toggle = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play().catch(() => { });
    setIsPlaying(!isPlaying);
  };

  return (
    <motion.button
      type="button"
      aria-label={isPlaying ? "Pause background ambience" : "Play background ambience"}
      title={isPlaying ? "Pause study ambience" : "Play study ambience"}
      whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
      onClick={toggle}
      className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600
                 shadow-lg shadow-cyan-500/30 flex items-center justify-center text-white border border-white/20
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a1a]"
    >
      {isPlaying ? <Volume2 className="w-6 h-6 animate-pulse" /> : <Play className="w-6 h-6" />}
    </motion.button>
  );
}

/* ─── Flip Card ─────────────────────────────────────────────────────────── */
function FeatureCard({ icon: Icon, title, description, delay, color, href }: {
  icon: React.ComponentType<{ className?: string }>; title: string; description: string;
  delay: number; color: string; href?: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const reduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (reduceMotion) return;
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setInView(Boolean(e?.isIntersecting)),
      { threshold: 0.15, rootMargin: "40px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion || !inView) return;
    const flipMs = 4200;
    const startOffset = 400 + Math.round(delay * 12000);
    const t0 = window.setTimeout(() => setFlipped(true), startOffset);
    const id = window.setInterval(() => setFlipped((f) => !f), flipMs);
    return () => {
      window.clearTimeout(t0);
      window.clearInterval(id);
    };
  }, [reduceMotion, inView, delay]);

  return (
    <motion.div
      ref={rootRef}
      initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : delay }}
      className="relative h-52 rounded-2xl"
      style={{ perspective: "1000px" }}
    >
      <div className="pointer-events-none relative h-full w-full">
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.55, ease: [0.4, 0, 0.2, 1] }}
          style={{ transformStyle: "preserve-3d" }}
          className="relative h-full w-full"
        >
          {/* Front */}
          <div
            className="absolute inset-0 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-lg shadow-black/20 backdrop-blur-xl"
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r ${color}`}>
              <Icon className="h-6 w-6 text-white" />
            </div>
            <h3 className="font-headline text-lg font-bold tracking-tight text-white">{title}</h3>
            <p className="text-xs text-zinc-400">Auto-flips to show details</p>
          </div>

          {/* Back */}
          <div
            className={`absolute inset-0 flex flex-col justify-between rounded-2xl bg-gradient-to-br ${color} p-6 shadow-inner`}
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <p className="text-sm leading-relaxed text-white/95">{description}</p>
            {href && (
              <Link
                href={href}
                className="pointer-events-auto mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/20 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              >
                Open <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  const features: { icon: React.ComponentType<{ className?: string }>; title: string; description: string; color: string; href: string }[] = [
    { icon: MessageCircle, title: "AI Chat", description: "Context-aware AI advisor that knows your study patterns and history.", color: "from-purple-500 to-pink-500", href: "/chat" },
    { icon: Brain, title: "Quiz Generator", description: "Auto-generate quizzes from topics, PDFs, or your weakest subjects.", color: "from-blue-500 to-cyan-500", href: "/quiz" },
    { icon: FileText, title: "Paper Generator", description: "Full practice exam papers with MCQs, short & long questions.", color: "from-green-500 to-emerald-500", href: "/paper-generator" },
    { icon: Clock, title: "Pomodoro Timer", description: "Stay focused with customizable Pomodoro study sessions.", color: "from-orange-500 to-red-500", href: "/timer" },
    { icon: Music, title: "Study Music", description: "Curated lo-fi and ambient music for deep focus.", color: "from-pink-500 to-rose-500", href: "/dashboard" },
    { icon: FileSearch, title: "AI Summarizer", description: "Condense long documents into concise, easy-to-digest summaries.", color: "from-indigo-500 to-purple-500", href: "/summarize" },
    { icon: PenTool, title: "Writing Assistant", description: "AI helps with essays, emails, letters & applications.", color: "from-yellow-500 to-orange-500", href: "/writing/essay" },
    { icon: Calendar, title: "Study Planner", description: "AI-generated personalized study schedules from your syllabus.", color: "from-teal-500 to-cyan-500", href: "/planner" },
    { icon: BarChart3, title: "Progress Tracker", description: "Visualize your academic growth with detailed charts.", color: "from-blue-600 to-indigo-600", href: "/progress" },
    { icon: FileCheck, title: "Guess Paper", description: "Analyze past papers to predict future exam questions.", color: "from-red-500 to-pink-500", href: "/guess-paper" },
    { icon: BookCopy, title: "Notes Maker", description: "Generate structured student-style notes from any document.", color: "from-violet-500 to-purple-500", href: "/notes-maker" },
    { icon: SpellCheck, title: "Grammar Checker", description: "Check your writing for grammatical errors with explanations.", color: "from-emerald-500 to-green-500", href: "/analyzer/grammar-checker" },
  ];

  const stats: { icon: React.ComponentType<{ className?: string }>; value: string; label: string }[] = [
    { icon: Users, value: "50K+", label: "Active Students" },
    { icon: BookOpen, value: "1M+", label: "Questions Solved" },
    { icon: Zap, value: "99.9%", label: "Uptime" },
    { icon: Globe, value: "150+", label: "Countries" },
  ];

  const navItems = [
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#how-it-works" },
    { label: "About", href: "#about" },
  ] as const;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#070714] text-white selection:bg-cyan-500/30 selection:text-white">
      <a
        href="#main"
        className="fixed left-4 top-4 z-[60] -translate-y-24 rounded-full bg-cyan-500 px-4 py-2 text-sm font-medium text-black shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        Skip to content
      </a>

      {/* ── Nav ── */}
      <motion.nav
        role="navigation"
        aria-label="Primary"
        className={`fixed top-0 z-40 w-full transition-all duration-300 ${
          scrolled ? "border-b border-white/10 bg-[#070714]/85 backdrop-blur-xl shadow-lg shadow-black/20" : "bg-transparent"
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-[4.5rem] items-center justify-between md:h-20">
            <motion.div whileHover={reduceMotion ? undefined : { scale: 1.02 }}>
              <Link href="/" className="flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80" aria-label="AthenaAI home">
                <AthenaLogo className="h-10 w-10" />
                <span className="font-headline text-2xl font-bold bg-gradient-to-r from-cyan-300 to-blue-500 bg-clip-text text-transparent">
                  AthenaAI
                </span>
              </Link>
            </motion.div>
            <div className="hidden items-center gap-8 md:flex">
              {navItems.map((item) => (
                <motion.a
                  key={item.href}
                  href={item.href}
                  className="group relative text-sm font-medium text-zinc-300 transition-colors hover:text-white"
                  whileHover={reduceMotion ? undefined : { y: -1 }}
                >
                  {item.label}
                  <span className="absolute -bottom-1 left-0 h-0.5 w-0 bg-cyan-400 transition-all duration-300 group-hover:w-full" />
                </motion.a>
              ))}
            </div>
            <div className="hidden items-center gap-3 md:flex">
              <Link
                href="/login"
                className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium text-white transition-all hover:border-cyan-400/50 hover:bg-white/5 hover:text-cyan-200"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:brightness-110 hover:shadow-cyan-500/35"
              >
                Sign up free
              </Link>
            </div>
            <button
              type="button"
              className="rounded-lg p-2 text-white md:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              id="mobile-nav"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-b border-white/10 bg-[#070714]/95 backdrop-blur-xl md:hidden"
            >
              <div className="space-y-1 px-4 py-5">
                {navItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={closeMenu}
                    className="block rounded-lg px-3 py-3 text-zinc-200 hover:bg-white/5 hover:text-white"
                  >
                    {item.label}
                  </a>
                ))}
                <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                  <Link href="/login" onClick={closeMenu} className="block w-full rounded-full border border-white/15 py-3 text-center text-sm font-medium hover:bg-white/5">
                    Log in
                  </Link>
                  <Link href="/register" onClick={closeMenu} className="block w-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 py-3 text-center text-sm font-semibold hover:brightness-110">
                    Sign up free
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ── Hero with 3D ── */}
      <section className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden pt-[4.5rem] md:pt-20">
        <div className="absolute inset-0 z-0">
          <ThreeScene />
        </div>
        {/* Readability: vignette + bottom fade so type stays legible on busy 3D */}
        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_85%_60%_at_50%_20%,rgba(7,7,20,0.15),rgba(7,7,20,0.85))]"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-48 bg-gradient-to-t from-[#070714] via-[#070714]/80 to-transparent" aria-hidden />

        <div id="main" className="relative z-10 mx-auto max-w-5xl px-4 text-center">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.85, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-8 flex justify-center">
              <AthenaLogo className="h-16 w-16 rounded-2xl ring-2 ring-white/15 shadow-2xl shadow-cyan-500/10 md:h-20 md:w-20" />
            </div>

            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 py-2 text-sm text-zinc-200 backdrop-blur-md">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span>Powered by Gemini AI</span>
              <span className="hidden sm:inline text-zinc-500">·</span>
              <span className="hidden sm:inline text-zinc-400">Built for students</span>
            </div>

            <h1 className="mb-6 font-headline text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-7xl lg:text-8xl">
              <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-500 bg-clip-text text-transparent">Study smarter</span>
              <br />
              <span className="text-white">not harder</span>
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-zinc-400 md:text-xl md:leading-relaxed">
              One calm workspace for chat, quizzes, papers, notes, and progress — so you spend less time juggling tabs and more time learning.
            </p>

            <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-cyan-500/25 transition-all hover:brightness-110 hover:shadow-cyan-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070714]"
              >
                Get started free
                <ChevronRight className="h-5 w-5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/[0.04] px-8 py-4 text-base font-medium text-white backdrop-blur-sm transition-all hover:border-cyan-400/40 hover:bg-white/[0.08] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070714]"
              >
                I already have an account
              </Link>
            </div>
          </motion.div>
        </div>

        <motion.a
          href="#features"
          className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1 text-zinc-500 hover:text-zinc-300"
          initial={reduceMotion ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduceMotion ? 0 : 1.1, duration: 0.5 }}
          aria-label="Scroll to features"
        >
          <span className="text-xs uppercase tracking-widest">Explore</span>
          <ChevronDown className={`h-6 w-6 ${reduceMotion ? "" : "animate-bounce"}`} />
        </motion.a>
      </section>

      {/* ── Stats ── */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.02] p-8 shadow-xl shadow-black/30 backdrop-blur-sm md:p-12">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-10">
            {stats.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.5 }} whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 flex items-center justify-center border border-white/10">
                    <s.icon className="w-8 h-8 text-cyan-400" />
                  </div>
                </div>
                <div className="text-3xl md:text-4xl font-bold text-white mb-1">{s.value}</div>
                <div className="text-gray-400">{s.label}</div>
              </motion.div>
            ))}
          </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="scroll-mt-24 border-y border-white/5 bg-white/[0.02] py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-cyan-400/90">How it works</p>
            <h2 className="font-headline text-3xl font-bold tracking-tight text-white md:text-4xl">From signup to study session in minutes</h2>
            <p className="mt-3 text-zinc-400">No clutter — pick a tool, add your topic or file, and let Athena handle the heavy lifting.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              { step: "01", title: "Create your free account", body: "Sign up in seconds and keep your history, notes, and progress in one place.", icon: Shield },
              { step: "02", title: "Choose your study tool", body: "Chat, quiz, papers, planner, notes — open what you need without losing context.", icon: LayoutDashboard },
              { step: "03", title: "Learn with AI that adapts", body: "Get explanations, practice, and summaries tuned to how you actually study.", icon: Rocket },
            ].map((row, idx) => (
              <motion.div
                key={row.step}
                initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: reduceMotion ? 0 : idx * 0.08 }}
                className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-8 shadow-lg shadow-black/20"
              >
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/20">
                  <row.icon className="h-6 w-6" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Step {row.step}</span>
                <h3 className="mt-2 font-headline text-xl font-semibold text-white">{row.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">{row.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="relative scroll-mt-24 py-20 md:py-24">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/20 to-transparent" aria-hidden />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-14 text-center"
          >
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-cyan-400/90">Features</p>
            <h2 className="font-headline text-3xl font-bold tracking-tight text-white md:text-5xl">
              <span className="bg-gradient-to-r from-cyan-300 to-blue-500 bg-clip-text text-transparent">Everything in one study stack</span>
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-zinc-400">Twelve+ tools that work together — flip a card to read more, then jump straight in.</p>
          </motion.div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {features.map((f, i) => (
              <FeatureCard key={f.href} {...f} delay={i * 0.04} />
            ))}
          </div>
          <motion.div initial={reduceMotion ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-12 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-6 py-3 text-zinc-300 backdrop-blur-sm">
              <Sparkles className="h-5 w-5 text-cyan-400" />
              <span>More tools shipping regularly</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden py-20 md:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(34,211,238,0.12),transparent)]" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-950/30 to-blue-950/30" aria-hidden />
        <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" aria-hidden />
        <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" aria-hidden />
        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: reduceMotion ? 0 : 0.6 }}
          >
            <h2 className="font-headline text-3xl font-bold leading-tight text-white md:text-5xl">
              Ready for calmer, sharper study sessions?
              <span className="mt-2 block bg-gradient-to-r from-cyan-300 to-blue-500 bg-clip-text text-transparent">Start free today.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-zinc-400">
              Join students using AthenaAI for quizzes, papers, notes, and chat — without switching between a dozen apps.
            </p>
            <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-10 py-4 text-lg font-semibold text-white shadow-xl shadow-cyan-500/25 transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070714]"
              >
                Create free account
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/[0.04] px-10 py-4 text-lg font-medium text-white transition-all hover:border-cyan-400/40 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070714]"
              >
                Log in
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-zinc-500">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" /> No credit card
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" /> Free to start
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" /> Use on any device
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer id="about" className="scroll-mt-24 border-t border-white/10 bg-black/40 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-12 md:gap-8">
            <div className="md:col-span-5">
              <Link href="/" className="inline-flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80">
                <AthenaLogo className="h-9 w-9" />
                <span className="font-headline text-xl font-bold text-white">AthenaAI</span>
              </Link>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-400">
                Your AI study companion for chat, practice, papers, and progress — built to feel fast, focused, and student-first.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Product</p>
                <ul className="mt-4 space-y-2 text-sm text-zinc-400">
                  <li><Link href="/chat" className="transition-colors hover:text-white">AI Chat</Link></li>
                  <li><Link href="/quiz" className="transition-colors hover:text-white">Quiz</Link></li>
                  <li><Link href="/dashboard" className="transition-colors hover:text-white">Dashboard</Link></li>
                  <li><Link href="/planner" className="transition-colors hover:text-white">Planner</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Account</p>
                <ul className="mt-4 space-y-2 text-sm text-zinc-400">
                  <li><Link href="/login" className="transition-colors hover:text-white">Log in</Link></li>
                  <li><Link href="/register" className="transition-colors hover:text-white">Sign up</Link></li>
                  <li><Link href="/onboarding" className="transition-colors hover:text-white">Onboarding</Link></li>
                </ul>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Legal</p>
                <ul className="mt-4 space-y-2 text-sm text-zinc-400">
                  <li>
                    <Link href="/register" className="transition-colors hover:text-white">
                      Privacy and terms <span className="text-zinc-600">(at signup)</span>
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-zinc-500 md:flex-row">
            <p>© {new Date().getFullYear()} AthenaAI. All rights reserved.</p>
            <p className="text-center md:text-right">Made for students who prefer one workspace over ten tabs.</p>
          </div>
        </div>
      </footer>

      <BackgroundMusic />
    </div>
  );
}
