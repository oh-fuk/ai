'use client';

import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

interface ConfettiProps {
    trigger: boolean;
    score?: number; // percentage 0-100
}

export function Confetti({ trigger, score = 100 }: ConfettiProps) {
    const firedRef = useRef(false);

    useEffect(() => {
        if (!trigger || firedRef.current) return;
        firedRef.current = true;

        if (score >= 80) {
            // Big celebration — side cannons
            const end = Date.now() + 2000;
            const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

            const frame = () => {
                confetti({
                    particleCount: 3,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors,
                });
                confetti({
                    particleCount: 3,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors,
                });
                if (Date.now() < end) requestAnimationFrame(frame);
            };
            frame();
        } else if (score >= 60) {
            // Medium — single burst
            confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#3b82f6', '#8b5cf6', '#10b981'],
            });
        }
        // Below 60 — no confetti
    }, [trigger, score]);

    return null;
}
