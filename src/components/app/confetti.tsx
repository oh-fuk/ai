'use client';

import { useEffect, useRef } from 'react';

interface ConfettiProps {
    trigger: boolean;
    score?: number;
}

// Pure canvas confetti — no external dependency
function fireConfetti(canvas: HTMLCanvasElement, score: number) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
    const particles: {
        x: number; y: number; vx: number; vy: number;
        color: string; size: number; rotation: number; rotSpeed: number; alpha: number;
    }[] = [];

    const count = score >= 80 ? 180 : 80;

    for (let i = 0; i < count; i++) {
        const fromLeft = score >= 80 && i < count / 2;
        particles.push({
            x: fromLeft ? 0 : canvas.width,
            y: canvas.height * 0.5,
            vx: fromLeft ? (Math.random() * 12 + 4) : -(Math.random() * 12 + 4),
            vy: -(Math.random() * 18 + 6),
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 8 + 4,
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 8,
            alpha: 1,
        });
    }

    let frame: number;
    const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.4; // gravity
            p.vx *= 0.99;
            p.rotation += p.rotSpeed;
            p.alpha -= 0.012;
            if (p.alpha > 0) {
                alive = true;
                ctx.save();
                ctx.globalAlpha = Math.max(0, p.alpha);
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
                ctx.restore();
            }
        });
        if (alive) frame = requestAnimationFrame(animate);
        else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    animate();
    return () => cancelAnimationFrame(frame);
}

export function Confetti({ trigger, score = 100 }: ConfettiProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const firedRef = useRef(false);

    useEffect(() => {
        if (!trigger || firedRef.current || !canvasRef.current) return;
        if (score < 60) return; // no confetti below 60%
        firedRef.current = true;
        const cleanup = fireConfetti(canvasRef.current, score);
        return cleanup;
    }, [trigger, score]);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-[9999]"
            style={{ width: '100vw', height: '100vh' }}
        />
    );
}
