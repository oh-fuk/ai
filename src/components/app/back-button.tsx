"use client";

import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';

export default function BackButton({ className }: { className?: string }) {
    const router = useRouter();

    return (
        <Button variant="outline" size="icon" onClick={() => router.back()} className={className} aria-label="Go back">
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Go back</span>
        </Button>
    );
}
