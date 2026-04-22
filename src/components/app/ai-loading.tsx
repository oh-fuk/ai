'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/* ─── Bouncing dots (Chat typing indicator) ─────────────────────────────── */
export function TypingDots({ className }: { className?: string }) {
    return (
        <div className={cn("flex items-center gap-1", className)}>
            {[0, 1, 2].map(i => (
                <motion.span
                    key={i}
                    className="h-2 w-2 rounded-full bg-primary"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                />
            ))}
        </div>
    );
}

/* ─── Typewriter status text ────────────────────────────────────────────── */
function TypewriterText({ text }: { text: string }) {
    const [displayed, setDisplayed] = useState('');

    useEffect(() => {
        setDisplayed('');
        let i = 0;
        const interval = setInterval(() => {
            setDisplayed(text.slice(0, i + 1));
            i++;
            if (i >= text.length) clearInterval(interval);
        }, 28);
        return () => clearInterval(interval);
    }, [text]);

    return (
        <span>
            {displayed}
            <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-middle"
            />
        </span>
    );
}

/* ─── Shimmer skeleton lines ────────────────────────────────────────────── */
function SkeletonLines({ count = 4 }: { count?: number }) {
    return (
        <div className="space-y-3 w-full">
            {Array.from({ length: count }).map((_, i) => (
                <motion.div
                    key={i}
                    className="h-3 rounded-full skeleton"
                    style={{ width: `${100 - i * 8}%` }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                />
            ))}
        </div>
    );
}

/* ─── Rotating icon with glow ───────────────────────────────────────────── */
function SpinningIcon({ icon: Icon, color = 'text-primary' }: { icon: React.ElementType; color?: string }) {
    return (
        <div className="relative flex items-center justify-center">
            {/* Glow ring */}
            <motion.div
                className="absolute rounded-full bg-primary/20"
                animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                style={{ width: 64, height: 64 }}
            />
            {/* Spinning icon */}
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
                <Icon className={cn("h-8 w-8", color)} />
            </motion.div>
        </div>
    );
}

/* ─── Step progress ─────────────────────────────────────────────────────── */
function StepProgress({ steps, currentStep }: { steps: string[]; currentStep: number }) {
    return (
        <div className="flex flex-col gap-2 w-full max-w-xs">
            {steps.map((step, i) => (
                <motion.div
                    key={step}
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: i <= currentStep ? 1 : 0.3, x: 0 }}
                    transition={{ delay: i * 0.2 }}
                >
                    <div className={cn(
                        "h-2 w-2 rounded-full flex-shrink-0 transition-colors duration-300",
                        i < currentStep ? "bg-emerald-500" :
                            i === currentStep ? "bg-primary animate-pulse" :
                                "bg-muted-foreground/30"
                    )} />
                    <span className={cn(
                        "text-xs transition-colors duration-300",
                        i === currentStep ? "text-foreground font-medium" : "text-muted-foreground"
                    )}>
                        {step}
                    </span>
                </motion.div>
            ))}
        </div>
    );
}

/* ─── Main AI Loading Screen ────────────────────────────────────────────── */
export type AiLoadingVariant = 'quiz' | 'paper' | 'notes' | 'planner' | 'summarize' | 'grammar' | 'generic';

const CONFIG: Record<AiLoadingVariant, {
    icon: string;
    steps: string[];
    color: string;
}> = {
    quiz: {
        icon: '🧠',
        steps: ['Reading your material...', 'Crafting questions...', 'Setting difficulty...', 'Finalizing quiz...'],
        color: 'text-blue-500',
    },
    paper: {
        icon: '📄',
        steps: ['Analyzing topic...', 'Writing MCQs...', 'Writing short questions...', 'Writing long questions...', 'Formatting paper...'],
        color: 'text-violet-500',
    },
    notes: {
        icon: '✏️',
        steps: ['Extracting content...', 'Identifying key points...', 'Structuring notes...', 'Adding examples...'],
        color: 'text-emerald-500',
    },
    planner: {
        icon: '📅',
        steps: ['Analyzing timeframe...', 'Breaking down topics...', 'Scheduling sessions...', 'Finalizing plan...'],
        color: 'text-orange-500',
    },
    summarize: {
        icon: '🔍',
        steps: ['Scanning document...', 'Extracting key ideas...', 'Writing summary...'],
        color: 'text-cyan-500',
    },
    grammar: {
        icon: '✅',
        steps: ['Reading text...', 'Checking grammar...', 'Finding errors...', 'Preparing corrections...'],
        color: 'text-rose-500',
    },
    generic: {
        icon: '✨',
        steps: ['Processing...', 'Generating...', 'Almost done...'],
        color: 'text-primary',
    },
};

interface AiLoadingScreenProps {
    variant?: AiLoadingVariant;
    title?: string;
    className?: string;
}

export function AiLoadingScreen({ variant = 'generic', title, className }: AiLoadingScreenProps) {
    const config = CONFIG[variant];
    const [step, setStep] = useState(0);

    useEffect(() => {
        setStep(0);
        const interval = setInterval(() => {
            setStep(prev => {
                if (prev < config.steps.length - 1) return prev + 1;
                clearInterval(interval);
                return prev;
            });
        }, 1800);
        return () => clearInterval(interval);
    }, [variant, config.steps.length]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className={cn(
                "flex flex-col items-center justify-center gap-6 py-16 px-8",
                className
            )}
        >
            {/* Big emoji icon with pulse */}
            <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                className="text-6xl select-none"
            >
                {config.icon}
            </motion.div>

            {/* Title */}
            <div className="text-center space-y-1">
                <p className="font-semibold text-foreground text-base">
                    {title || 'AI is working...'}
                </p>
                <p className="text-sm text-muted-foreground">
                    <TypewriterText text={config.steps[step]} />
                </p>
            </div>

            {/* Step progress */}
            <StepProgress steps={config.steps} currentStep={step} />

            {/* Skeleton preview */}
            <div className="w-full max-w-sm mt-2">
                <SkeletonLines count={3} />
            </div>
        </motion.div>
    );
}
