'use client';

import {
  ArrowRight, CalendarDays, LineChart, PenSquare, Timer,
  History as HistoryIcon, Sigma, Sparkles, Loader, MessageCircle,
  CheckSquare, Clock, Award, BarChart2, TrendingUp,
} from "lucide-react";
import Image from "next/image";
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AthenaLogo } from "@/components/app/logo";
import { cn } from "@/lib/utils";
import schoolLogo from "@/LOGO/college.png";
import { PlaceHolderImages } from "@/lib/placeholder-images";

/* ─── Feature list (no images) ─────────────────────────────────────────── */
const features = [
  { title: "AI Chat", icon: MessageCircle, href: "/chat", description: "Your personal AI academic advisor. Ask questions, generate quizzes or papers directly from the conversation." },
  { title: "Generator", icon: Sparkles, href: "/generator", description: "Create quizzes and practice exam papers from your study materials or let AI create remedial tests." },
  { title: "Analysis Tools", icon: Sigma, href: "/analyzer", description: "Summarize articles, get keyword explanations, and analyze text from any source including images." },
  { title: "Writing Tools", icon: PenSquare, href: "/writing", description: "Generate well-structured essays, draft professional emails, or create formal applications and letters." },
  { title: "Study Planner", icon: CalendarDays, href: "/planner", description: "Let AI generate a detailed, actionable plan based on your topics, timeframe, or an uploaded syllabus." },
  { title: "Study Timer", icon: Timer, href: "/timer", description: "Stay focused with the Pomodoro technique. Sessions are automatically logged to track your effort." },
  { title: "My Tasks", icon: CheckSquare, href: "/tasks", description: "Organize study tasks with AI-powered assistance. Get personalized help with each task." },
  { title: "Track Progress", icon: LineChart, href: "/progress", description: "Monitor your learning journey with charts. Visualize quiz scores and study time by subject." },
  { title: "History", icon: HistoryIcon, href: "/history", description: "Review all past activities — quizzes, papers, summaries, and study sessions." },
];

/* ─── Stat config ───────────────────────────────────────────────────────── */
const statConfig = [
  { label: "Study Time", icon: Clock, color: "text-blue-400", bg: "bg-blue-400/20" },
  { label: "Avg Quiz Score", icon: Award, color: "text-emerald-400", bg: "bg-emerald-400/20" },
  { label: "Subjects Mastered", icon: BarChart2, color: "text-violet-400", bg: "bg-violet-400/20" },
];

/* ─── Animation variants ────────────────────────────────────────────────── */
const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: "easeOut" } },
};

/* ─── Frosted glass style (shared) ─────────────────────────────────────── */
const glassStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.09)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(255,255,255,0.15)',
};

/* ═══════════════════════════════════════════════════════════════════════════
   Page
═══════════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [totalStudyTime, setTotalStudyTime] = useState(0);
  const [averageScore, setAverageScore] = useState(0);
  const [subjectsMastered, setSubjectsMastered] = useState(0);

  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userDocRef);

  const quizQ = useMemoFirebase(() => user ? query(collection(firestore, 'users', user.uid, 'quizAttempts'), orderBy('attemptedAt', 'desc')) : null, [user, firestore]);
  const { data: quizAttempts } = useCollection<{ score: number; totalQuestions: number; subjectId: string }>(quizQ);

  const sessionsQ = useMemoFirebase(() => user ? query(collection(firestore, 'users', user.uid, 'studySessions'), orderBy('date', 'desc')) : null, [user, firestore]);
  const { data: studySessions } = useCollection<{ duration: number }>(sessionsQ);

  useEffect(() => {
    if (!quizAttempts) return;
    const subjectScores: Record<string, { total: number; count: number }> = {};
    quizAttempts.forEach(a => {
      const s = a.subjectId || 'General';
      if (!subjectScores[s]) subjectScores[s] = { total: 0, count: 0 };
      subjectScores[s].total += (a.score / a.totalQuestions) * 100;
      subjectScores[s].count += 1;
    });
    const sum = quizAttempts.reduce((acc, a) => acc + (a.score / a.totalQuestions) * 100, 0);
    setAverageScore(quizAttempts.length > 0 ? sum / quizAttempts.length : 0);
    setSubjectsMastered(Object.values(subjectScores).filter(s => s.total / s.count >= 80).length);
  }, [quizAttempts]);

  useEffect(() => {
    if (!studySessions) return;
    setTotalStudyTime(studySessions.reduce((acc, s) => acc + s.duration, 0));
  }, [studySessions]);

  const isLoading = isUserLoading || isProfileLoading;
  const fullName = userProfile?.fullName || "Student";
  const firstName = fullName.split(' ')[0];

  const statValues = [
    `${Math.floor(totalStudyTime / 60)}h ${totalStudyTime % 60}m`,
    `${averageScore.toFixed(1)}%`,
    `${subjectsMastered}`,
  ];

  const heroImage = PlaceHolderImages.find(p => p.id === "dashboardHero");

  return (
    <div className="flex flex-col min-h-full bg-background">

      {/* ══════════════════════════════════════════
          HERO
      ══════════════════════════════════════════ */}
      <div className="relative overflow-hidden min-h-[460px] sm:min-h-[520px]">

        {/* Background */}
        {heroImage ? (
          <div className="absolute inset-0">
            <Image src={heroImage.imageUrl} alt="" fill className="object-cover" priority />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/55 to-background" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/80 to-accent/60" />
        )}

        <div className="relative z-10 px-4 pt-8 pb-10 sm:px-6 lg:px-8 sm:pt-14">

          {/* ── Logos row ── */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-between mb-10"
          >
            {/* School logo + name */}
            <div className="flex items-center gap-3">
              <Image
                src={schoolLogo}
                alt="School Logo"
                width={56}
                height={56}
                className="rounded-full ring-2 ring-white/25 shadow-lg object-cover"
              />
              <div className="hidden sm:block leading-tight">
                <p className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">IMCB G-10/4</p>
                <p className="text-sm font-bold text-white">Islamabad</p>
              </div>
            </div>

            {/* Athena logo */}
            <AthenaLogo className="h-14 w-14 ring-2 ring-white/25 shadow-lg" />
          </motion.div>

          {/* ── Greeting ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mb-10"
          >
            <p className="text-sm font-medium text-white/55 mb-2 tracking-wide">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold font-headline text-white leading-tight drop-shadow-md">
              {isLoading ? "Welcome back..." : `Hey, ${firstName} 👋`}
            </h1>
            <p className="mt-3 text-white/65 text-base max-w-lg">
              Your AI-powered study buddy is ready to help you excel today.
            </p>
          </motion.div>

          {/* ── Stat cards ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.22 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            {statConfig.map((s, i) => (
              <div key={s.label} className="rounded-2xl p-5 flex items-center gap-4" style={glassStyle}>
                <div className={cn("flex-shrink-0 p-3 rounded-xl", s.bg)}>
                  <s.icon className={cn("h-6 w-6", s.color)} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white leading-none">{statValues[i]}</p>
                  <p className="text-sm text-white/55 mt-1">{s.label}</p>
                </div>
              </div>
            ))}
          </motion.div>

        </div>
      </div>

      {/* ══════════════════════════════════════════
          FEATURE GRID
      ══════════════════════════════════════════ */}
      <div className="px-4 pb-10 sm:px-6 lg:px-8 mt-6">

        {/* Section header */}
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground tracking-wide">Quick Access</h2>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {features.map((feature) => {
            const isButtonLoading = loading === feature.href;
            return (
              <motion.div key={feature.title} variants={itemVariants}>
                <div
                  onClick={() => { setLoading(feature.href); router.push(feature.href); }}
                  className="group cursor-pointer rounded-2xl p-5 flex flex-col gap-4 h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-primary/30"
                  style={glassStyle}
                >
                  {/* Icon row */}
                  <div className="flex items-center justify-between">
                    <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors duration-200">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-1 transition-all duration-200" />
                  </div>

                  {/* Text */}
                  <div className="flex flex-col gap-1 flex-1">
                    <h3 className="font-semibold text-foreground text-[15px] font-headline leading-snug">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>

                  {/* CTA */}
                  <div className="text-xs font-semibold text-primary flex items-center gap-1.5">
                    {isButtonLoading ? (
                      <><Loader className="h-3.5 w-3.5 animate-spin" /> Opening...</>
                    ) : (
                      <>Open {feature.title}</>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

    </div>
  );
}
