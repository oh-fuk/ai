'use client';

import { memo, useCallback, useEffect } from 'react';
import { Onborda, OnbordaProvider, useOnborda } from 'onborda';
import type { CardComponentProps, Step } from 'onborda';
import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';

const MAIN_TOUR: { tour: string; steps: Step[] } = {
  tour: 'main',
  steps: [
    {
      icon: '👋',
      title: 'Welcome to AthenaAI StudyBuddy',
      content: (
        <p className="text-sm text-muted-foreground leading-relaxed">
          This app is your AI study partner: chat, quizzes, practice papers, notes, summaries, planners, timers, and
          progress tracking in one place. Follow the next steps for a quick map of the layout, or skip anytime.
        </p>
      ),
      selector: '#onborda-dashboard-hero',
      side: 'bottom',
    },
    {
      icon: '🧭',
      title: 'Sidebar — every tool',
      content: (
        <p className="text-sm text-muted-foreground leading-relaxed">
          Open <strong>Dashboard</strong>, <strong>AI Chat</strong>, generators, analyzers, writing tools, your{' '}
          <strong>Study Planner</strong>, <strong>Timer</strong>, <strong>History</strong>, and more. Use the edge
          button to collapse or expand this menu.
        </p>
      ),
      selector: '#onborda-app-sidebar',
      side: 'right',
    },
    {
      icon: '🔌',
      title: 'Connectors & Google Drive',
      content: (
        <p className="text-sm text-muted-foreground leading-relaxed">
          Under <strong>Connectors</strong> you link Google Drive and open each integration&apos;s page. Browse files on
          the Drive screen; use <strong>Import from Drive</strong> inside Summarize, Notes, Quiz, and other tools to
          pull a file into a workflow.
        </p>
      ),
      selector: '#onborda-nav-connectors',
      side: 'right',
    },
    {
      icon: '⚙️',
      title: 'Theme & profile',
      content: (
        <p className="text-sm text-muted-foreground leading-relaxed">
          Toggle light or dark mode and open your <strong>profile</strong> from the top bar. Subjects, account, and more
          live under <strong>Settings</strong> at the bottom of the sidebar.
        </p>
      ),
      selector: '#onborda-header-controls',
      side: 'bottom',
    },
  ],
};

const TourCard = memo(function TourCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  arrow,
}: CardComponentProps) {
  const { closeOnborda } = useOnborda();
  const { user } = useUser();
  const firestore = useFirestore();
  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);

  const markComplete = useCallback(async () => {
    closeOnborda();
    if (!userDocRef) return;
    try {
      await updateDoc(userDocRef, { hasSeenAppTour: true });
    } catch (e) {
      console.error(e);
    }
  }, [closeOnborda, userDocRef]);

  const handlePrimary = async () => {
    if (currentStep >= totalSteps - 1) {
      await markComplete();
    } else {
      await nextStep();
    }
  };

  const handleSkip = async () => {
    await markComplete();
  };

  if (!step) return null;

  const isLast = currentStep >= totalSteps - 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="rounded-xl border border-border bg-card text-card-foreground shadow-2xl p-4 max-w-[min(100vw-2rem,22rem)]"
    >
      <div className="text-muted-foreground [&_svg]:text-primary">{arrow}</div>
      <div className="mt-2 flex items-start gap-2">
        {typeof step.icon === 'string' && step.icon ? (
          <span className="text-2xl leading-none" aria-hidden>
            {step.icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="font-headline text-base font-semibold text-foreground leading-tight">{step.title}</h3>
          <div className="text-sm">{step.content}</div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Step {currentStep + 1} of {totalSteps} — use Next to see the full tour, or Skip to close.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="text-xs" disabled={currentStep === 0} onClick={() => void prevStep()}>
          Back
        </Button>
        <Button type="button" size="sm" className="text-xs" onClick={() => void handlePrimary()}>
          {isLast ? 'Finish' : 'Next'}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="ml-auto text-xs text-muted-foreground" onClick={() => void handleSkip()}>
          Skip tour
        </Button>
      </div>
    </motion.div>
  );
});

function TourAutostart() {
  const { startOnborda } = useOnborda();
  const pathname = usePathname();
  const { user } = useUser();
  const firestore = useFirestore();
  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
  const { data: userProfile, isLoading } = useDoc(userDocRef);

  useEffect(() => {
    if (isLoading || !user || !userProfile) return;
    if (userProfile.hasSeenAppTour !== false) return;
    if (pathname !== '/dashboard') return;
    const id = window.setTimeout(() => startOnborda('main'), 500);
    return () => clearTimeout(id);
  }, [isLoading, user, userProfile, pathname, startOnborda]);

  return null;
}

export function AppTourProvider({ children }: { children: React.ReactNode }) {
  return (
    <OnbordaProvider>
      <Onborda
        steps={[MAIN_TOUR]}
        cardComponent={TourCard}
        cardTransition={{ type: 'spring', stiffness: 280, damping: 32 }}
        shadowOpacity="0.32"
      >
        {children}
      </Onborda>
      <TourAutostart />
    </OnbordaProvider>
  );
}
