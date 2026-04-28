'use client';

import {
  ArrowRight, CalendarDays, LineChart, PenSquare, Timer,
  History as HistoryIcon, Sigma, Sparkles, Loader, MessageCircle,
  CheckSquare, Clock, Award, BarChart2, TrendingUp, Download, Upload,
} from "lucide-react";
import Image from "next/image";
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, query, orderBy, updateDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { AthenaLogo } from "@/components/app/logo";
import { cn } from "@/lib/utils";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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

const DEFAULT_ORDER: string[] = features.map((f) => f.href);

type FeatureItem = (typeof features)[number];

/* ─── Flip feature card (hover) — theme-safe below hero ─────────────────── */
function FeatureFlipCard({
  title, icon: Icon, href, description, isButtonLoading, onClick,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  description: string;
  isButtonLoading: boolean;
  onClick: () => void;
}) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      className="relative h-44 cursor-pointer"
      style={{ perspective: '1000px' }}
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
        style={{ transformStyle: 'preserve-3d' }}
        className="relative w-full h-full"
      >
        <div
          className="absolute inset-0 flex flex-col gap-3 rounded-2xl border border-border/80 bg-card/90 p-5 text-card-foreground shadow-sm backdrop-blur-md transition-shadow hover:shadow-md"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="flex items-center justify-between">
            <div className="rounded-xl bg-primary/12 p-3 ring-1 ring-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <h3 className="font-headline text-[15px] font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">Hover for details</p>
        </div>

        <div
          className="absolute inset-0 flex flex-col justify-between rounded-2xl border border-border bg-muted/40 p-5 text-foreground backdrop-blur-md"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <p className="text-sm leading-relaxed text-foreground/90">{description}</p>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/25"
          >
            {isButtonLoading ? <><Loader className="h-3 w-3 animate-spin" /> Opening...</> : <>Open {title} <ArrowRight className="h-3 w-3" /></>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } },
};

/* ═══════════════════════════════════════════════════════════════════════════
   Page
═══════════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [totalStudyTime, setTotalStudyTime] = useState(0);
  const [averageScore, setAverageScore] = useState(0);
  const [subjectsMastered, setSubjectsMastered] = useState(0);
  const [quickOrder, setQuickOrder] = useState<string[]>([...DEFAULT_ORDER]);

  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
  const { data: userProfile, isLoading: isProfileLoading } = useDoc(userDocRef);

  const quizQ = useMemoFirebase(() => user ? query(collection(firestore, 'users', user.uid, 'quizAttempts'), orderBy('attemptedAt', 'desc')) : null, [user, firestore]);
  const { data: quizAttempts } = useCollection<{ score: number; totalQuestions: number; subjectId: string }>(quizQ);

  const sessionsQ = useMemoFirebase(() => user ? query(collection(firestore, 'users', user.uid, 'studySessions'), orderBy('date', 'desc')) : null, [user, firestore]);
  const { data: studySessions } = useCollection<{ duration: number }>(sessionsQ);

  useEffect(() => {
    const raw = (userProfile as { dashboardQuickOrder?: string[] } | undefined)?.dashboardQuickOrder;
    if (!raw?.length) {
      setQuickOrder([...DEFAULT_ORDER]);
      return;
    }
    const known = new Set(DEFAULT_ORDER);
    const filtered = raw.filter((h) => known.has(h));
    const merged = [...filtered, ...DEFAULT_ORDER.filter((h) => !filtered.includes(h))];
    setQuickOrder(merged);
  }, [userProfile]);

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

  const orderedFeatures = useMemo(() => {
    const map = new Map(features.map((f) => [f.href, f as FeatureItem]));
    return quickOrder.map((h) => map.get(h)).filter(Boolean) as FeatureItem[];
  }, [quickOrder]);

  const persistQuickOrder = async (order: string[]) => {
    if (!userDocRef) {
      toast({ variant: 'destructive', title: 'Sign in required', description: 'Log in to save dashboard layout.' });
      return;
    }
    await updateDoc(userDocRef, { dashboardQuickOrder: order });
    setQuickOrder(order);
    toast({ title: 'Saved', description: 'Quick access order updated in your account.' });
  };

  const exportPrefs = () => {
    const payload = { version: 1, dashboardQuickOrder: quickOrder, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'athena-dashboard-prefs.json';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'Downloaded dashboard preferences JSON.' });
  };

  const importPrefsFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = reader.result as string;
        const j = JSON.parse(text) as { dashboardQuickOrder?: string[] };
        if (!Array.isArray(j.dashboardQuickOrder)) throw new Error('Missing dashboardQuickOrder array');
        const known = new Set(DEFAULT_ORDER);
        const next = j.dashboardQuickOrder.filter((h) => known.has(h));
        if (!next.length) throw new Error('No valid tool paths');
        const merged = [...next, ...DEFAULT_ORDER.filter((h) => !next.includes(h))];
        await persistQuickOrder(merged);
        toast({ title: 'Imported', description: 'Dashboard quick access updated from file.' });
      } catch (e: unknown) {
        toast({
          variant: 'destructive',
          title: 'Import failed',
          description: e instanceof Error ? e.message : 'Invalid JSON file.',
        });
      }
    };
    reader.readAsText(file);
  };

  const resetOrder = async () => {
    await persistQuickOrder([...DEFAULT_ORDER]);
  };

  const isLoading = isUserLoading || isProfileLoading;
  const fullName = userProfile?.fullName || "Student";
  const firstName = fullName.split(' ')[0];

  const statValues = [
    `${Math.floor(totalStudyTime / 60)}h ${totalStudyTime % 60}m`,
    `${averageScore.toFixed(1)}%`,
    `${subjectsMastered}`,
  ];

  const statConfig = [
    { label: "Study Time", icon: Clock, color: "text-sky-500 dark:text-sky-400", bg: "bg-sky-500/15 dark:bg-sky-400/15 ring-1 ring-sky-500/20" },
    { label: "Avg Quiz Score", icon: Award, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/15 dark:bg-emerald-400/15 ring-1 ring-emerald-500/20" },
    { label: "Subjects Mastered", icon: BarChart2, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/15 dark:bg-violet-400/15 ring-1 ring-violet-500/20" },
  ];

  const heroImage = PlaceHolderImages.find(p => p.id === "dashboardHero");

  return (
    <div className="flex min-h-full flex-col bg-background">

      <div className="relative min-h-[460px] overflow-hidden sm:min-h-[520px]">

        {heroImage ? (
          <div className="absolute inset-0">
            <Image src={heroImage.imageUrl} alt="" fill className="object-cover" priority />
            <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/50 to-background" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/85 to-accent/70" />
        )}

        <div className="relative z-10 px-4 pb-10 pt-8 sm:px-6 sm:pt-14 lg:px-8">

          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mb-10 flex items-center justify-end"
          >
            <AthenaLogo className="h-14 w-14 shadow-lg ring-2 ring-white/30" />
          </motion.div>

          <motion.div
            id="onborda-dashboard-hero"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 }}
            className="mb-10"
          >
            <p className="mb-2 text-sm font-medium tracking-wide text-white/70">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="font-headline text-4xl font-bold leading-tight text-white drop-shadow-sm sm:text-5xl">
              {isLoading ? "Welcome back..." : `Hey, ${firstName}`}
            </h1>
            <p className="mt-3 max-w-lg text-base text-white/80">
              Your AI-powered study buddy is ready to help you excel today.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.16 }}
            className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
            {statConfig.map((s, i) => (
              <div
                key={s.label}
                className="flex items-center gap-4 rounded-2xl border border-white/20 bg-white/10 p-5 text-white shadow-sm backdrop-blur-md"
              >
                <div className={cn("flex-shrink-0 rounded-xl p-3", s.bg)}>
                  <s.icon className={cn("h-6 w-6", s.color)} />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none text-white">{statValues[i]}</p>
                  <p className="mt-1 text-sm text-white/75">{s.label}</p>
                </div>
              </div>
            ))}
          </motion.div>

        </div>
      </div>

      <div className="mt-6 px-4 pb-10 sm:px-6 lg:px-8">

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-wide text-foreground">Quick access</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={exportPrefs}>
              <Download className="h-3.5 w-3.5" /> Export layout
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" /> Import layout
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) importPrefsFromFile(f);
              }}
            />
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => void resetOrder()}>
              Reset order
            </Button>
          </div>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          {orderedFeatures.map((feature) => {
            const isButtonLoading = loading === feature.href;
            return (
              <motion.div key={feature.href} variants={itemVariants}>
                <FeatureFlipCard
                  title={feature.title}
                  icon={feature.icon}
                  href={feature.href}
                  description={feature.description}
                  isButtonLoading={isButtonLoading}
                  onClick={() => {
                    setLoading(feature.href);
                    requestAnimationFrame(() => router.push(feature.href));
                  }}
                />
              </motion.div>
            );
          })}
        </motion.div>
      </div>

    </div>
  );
}
