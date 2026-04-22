'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingDown, Minus, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DifficultyPredictorProps {
    quizAttempts: { score: number; totalQuestions: number; subjectId: string }[] | null | undefined;
    selectedSubject?: string;
    onSuggest?: (difficulty: 'easy' | 'medium' | 'hard') => void;
}

type Difficulty = 'easy' | 'medium' | 'hard';

const config: Record<Difficulty, {
    label: string;
    color: string;
    bg: string;
    border: string;
    icon: React.ElementType;
    message: string;
}> = {
    easy: {
        label: 'Easy',
        color: 'text-emerald-600',
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        border: 'border-emerald-200 dark:border-emerald-800',
        icon: TrendingDown,
        message: 'Your recent scores are low — start with Easy to build confidence.',
    },
    medium: {
        label: 'Medium',
        color: 'text-blue-600',
        bg: 'bg-blue-50 dark:bg-blue-950/30',
        border: 'border-blue-200 dark:border-blue-800',
        icon: Minus,
        message: 'Your scores look balanced — Medium difficulty is a great challenge.',
    },
    hard: {
        label: 'Hard',
        color: 'text-violet-600',
        bg: 'bg-violet-50 dark:bg-violet-950/30',
        border: 'border-violet-200 dark:border-violet-800',
        icon: TrendingUp,
        message: "You're performing well — push yourself with Hard difficulty!",
    },
};

export function DifficultyPredictor({ quizAttempts, selectedSubject, onSuggest }: DifficultyPredictorProps) {
    const [suggested, setSuggested] = useState<Difficulty | null>(null);
    const [applied, setApplied] = useState(false);

    useEffect(() => {
        setApplied(false);
        if (!quizAttempts || quizAttempts.length === 0) return;

        // Filter by subject if selected
        const relevant = selectedSubject && selectedSubject !== 'general'
            ? quizAttempts.filter(a => a.subjectId === selectedSubject)
            : quizAttempts;

        const pool = relevant.length >= 3 ? relevant.slice(0, 5) : quizAttempts.slice(0, 5);
        if (pool.length === 0) return;

        const avg = pool.reduce((acc, a) => acc + (a.score / a.totalQuestions) * 100, 0) / pool.length;

        if (avg < 50) setSuggested('easy');
        else if (avg < 75) setSuggested('medium');
        else setSuggested('hard');
    }, [quizAttempts, selectedSubject]);

    if (!suggested) return null;

    const c = config[suggested];
    const Icon = c.icon;

    const handleApply = () => {
        onSuggest?.(suggested);
        setApplied(true);
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className={cn(
                    "flex items-start gap-3 rounded-xl p-3 border text-sm",
                    c.bg, c.border
                )}
            >
                <div className={cn("flex-shrink-0 p-1.5 rounded-lg bg-white/60 dark:bg-black/20")}>
                    <Sparkles className={cn("h-4 w-4", c.color)} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                        AI Suggests:
                        <span className={cn("flex items-center gap-1", c.color)}>
                            <Icon className="h-3.5 w-3.5" />
                            {c.label}
                        </span>
                    </p>
                    <p className="text-muted-foreground text-xs mt-0.5">{c.message}</p>
                </div>
                {!applied && (
                    <button
                        onClick={handleApply}
                        className={cn(
                            "flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors",
                            "bg-white/70 dark:bg-black/30 hover:bg-white dark:hover:bg-black/50",
                            c.color
                        )}
                    >
                        Apply
                    </button>
                )}
                {applied && (
                    <span className="flex-shrink-0 text-xs font-semibold text-emerald-600">✓ Applied</span>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
