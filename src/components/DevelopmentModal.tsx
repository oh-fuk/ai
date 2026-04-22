'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

/**
 * Development Status Modal
 * Displays on app load to inform users the app is under development
 * User must click OK to proceed to the app
 */
export function DevelopmentModal() {
    const [isOpen, setIsOpen] = useState(true);
    const [hasBeenDismissed, setHasBeenDismissed] = useState(false);

    useEffect(() => {
        // Check if user has already dismissed this modal in this session
        const isDismissed = sessionStorage.getItem('developmentModalDismissed');
        if (isDismissed) {
            setIsOpen(false);
            setHasBeenDismissed(true);
        }
    }, []);

    const handleOK = () => {
        // Mark modal as dismissed for this session
        sessionStorage.setItem('developmentModalDismissed', 'true');
        setIsOpen(false);
        setHasBeenDismissed(true);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-md border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
                <DialogHeader className="gap-3">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                        <DialogTitle className="text-lg font-bold text-amber-900 dark:text-amber-100">
                            App Under Development
                        </DialogTitle>
                    </div>
                </DialogHeader>

                <div className="space-y-4">
                    <p className="text-base text-amber-800 dark:text-amber-200">
                        Welcome to <span className="font-semibold">AthenaAI</span>!
                    </p>

                    <p className="text-base text-amber-800 dark:text-amber-200">
                        This application is currently in active development. You may encounter:
                    </p>

                    <ul className="list-disc list-inside space-y-2 text-base text-amber-800 dark:text-amber-200 ml-2">
                        <li>New features being added regularly</li>
                        <li>Occasional bugs or performance issues</li>
                        <li>Changes to the user interface</li>
                        <li>Temporary service interruptions</li>
                    </ul>

                    <p className="text-base text-amber-800 dark:text-amber-200">
                        We appreciate your patience and feedback as we improve the platform!
                    </p>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <Button
                        onClick={handleOK}
                        className="bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-700 dark:hover:bg-amber-600"
                    >
                        I Understand, Let's Go
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
