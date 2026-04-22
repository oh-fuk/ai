'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, X, Play, Pause, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATIONS = [
    { id: 'lofi', label: 'Lo-Fi Beats', emoji: '🎵', url: 'https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&controls=0&loop=1' },
    { id: 'focus', label: 'Deep Focus', emoji: '🧠', url: 'https://www.youtube.com/embed/5qap5aO4i9A?autoplay=1&controls=0&loop=1' },
    { id: 'nature', label: 'Nature Sounds', emoji: '🌿', url: 'https://www.youtube.com/embed/eKFTSSKCzWA?autoplay=1&controls=0&loop=1' },
    { id: 'jazz', label: 'Study Jazz', emoji: '🎷', url: 'https://www.youtube.com/embed/Dx5qFachd3A?autoplay=1&controls=0&loop=1' },
];

export function MusicPlayer() {
    const [open, setOpen] = useState(false);
    const [playing, setPlaying] = useState<string | null>(null);

    const toggle = (id: string, url: string) => {
        if (playing === id) {
            setPlaying(null);
        } else {
            setPlaying(id);
        }
    };

    return (
        <>
            {/* Hidden iframes for audio */}
            {STATIONS.map(s => (
                playing === s.id ? (
                    <iframe
                        key={s.id}
                        src={s.url}
                        allow="autoplay"
                        className="hidden"
                        title={s.label}
                    />
                ) : null
            ))}

            {/* Floating button */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
                <AnimatePresence>
                    {open && (
                        <motion.div
                            initial={{ opacity: 0, y: 12, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 12, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="rounded-2xl border border-border/60 shadow-2xl overflow-hidden w-56"
                            style={{
                                background: 'rgba(var(--card-rgb,255,255,255),0.85)',
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                            }}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                                <div className="flex items-center gap-2">
                                    <Music className="h-4 w-4 text-primary" />
                                    <span className="text-sm font-semibold text-foreground">Study Music</span>
                                </div>
                                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Stations */}
                            <div className="p-2 space-y-1">
                                {STATIONS.map(s => {
                                    const isPlaying = playing === s.id;
                                    return (
                                        <button
                                            key={s.id}
                                            onClick={() => toggle(s.id, s.url)}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150",
                                                isPlaying
                                                    ? "bg-primary/10 text-primary font-medium"
                                                    : "text-foreground/70 hover:bg-muted hover:text-foreground"
                                            )}
                                        >
                                            <span className="text-base">{s.emoji}</span>
                                            <span className="flex-1 text-left">{s.label}</span>
                                            {isPlaying ? (
                                                <motion.div
                                                    className="flex items-end gap-0.5 h-4"
                                                    initial={false}
                                                >
                                                    {[0, 1, 2].map(i => (
                                                        <motion.div
                                                            key={i}
                                                            className="w-0.5 bg-primary rounded-full"
                                                            animate={{ height: ['4px', '14px', '4px'] }}
                                                            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                                                        />
                                                    ))}
                                                </motion.div>
                                            ) : (
                                                <Play className="h-3.5 w-3.5 opacity-50" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {playing && (
                                <div className="px-4 py-2 border-t border-border/40 flex items-center gap-2">
                                    <div className="flex items-end gap-0.5 h-3">
                                        {[0, 1, 2, 3].map(i => (
                                            <motion.div
                                                key={i}
                                                className="w-0.5 bg-primary rounded-full"
                                                animate={{ height: ['2px', '10px', '2px'] }}
                                                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-xs text-primary font-medium">
                                        {STATIONS.find(s => s.id === playing)?.label}
                                    </span>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* FAB */}
                <motion.button
                    onClick={() => setOpen(o => !o)}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                        "h-12 w-12 rounded-full shadow-lg flex items-center justify-center transition-colors duration-200",
                        playing
                            ? "bg-primary text-primary-foreground"
                            : "bg-card border border-border text-foreground hover:bg-primary hover:text-primary-foreground"
                    )}
                >
                    {playing ? (
                        <motion.div
                            className="flex items-end gap-0.5 h-5"
                        >
                            {[0, 1, 2].map(i => (
                                <motion.div
                                    key={i}
                                    className="w-0.5 bg-current rounded-full"
                                    animate={{ height: ['3px', '16px', '3px'] }}
                                    transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
                                />
                            ))}
                        </motion.div>
                    ) : (
                        <Music className="h-5 w-5" />
                    )}
                </motion.button>
            </div>
        </>
    );
}
