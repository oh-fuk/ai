
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, Settings, Volume2, VolumeX, RotateCcw, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import PageHeader from '@/components/app/page-header';
import { useUser, useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

interface Subject {
  id: string;
  name: string;
}

const DEFAULTS = {
  study: 25,
  short: 5,
  long: 15,
  autoStart: true,
  sound: true,
};

type TimerMode = 'study' | 'short' | 'long';

export default function StudyTimerPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const subjectsQuery = useMemoFirebase(
    () => (user ? collection(firestore, 'users', user.uid, 'subjects') : null),
    [user, firestore]
  );
  const { data: subjects, isLoading: subjectsLoading } = useCollection<Subject>(subjectsQuery);
  const [subject, setSubject] = useState('general');

  const [config, setConfig] = useState(DEFAULTS);
  const [mode, setMode] = useState<TimerMode>('study');
  const [remaining, setRemaining] = useState(config.study * 60);
  const [running, setRunning] = useState(false);
  const [doneSessions, setDoneSessions] = useState(0);

  const timerInterval = useRef<NodeJS.Timeout | null>(null);

  const playAlert = useCallback(async () => {
    if (!config.sound) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(880, audioCtx.currentTime);
      g.gain.setValueAtTime(0.06, audioCtx.currentTime);
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      o.frequency.setValueAtTime(660, audioCtx.currentTime + 0.12);
      o.stop(audioCtx.currentTime + 0.42);
    } catch (e) {
      console.warn('playAlert error', e);
    }
  }, [config.sound]);

  const pause = useCallback(() => {
    setRunning(false);
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }
  }, []);

  const setTimer = useCallback((newMode: TimerMode, startClock: boolean) => {
    setMode(newMode);
    let duration = 0;
    if (newMode === 'study') duration = config.study;
    else if (newMode === 'short') duration = config.short;
    else if (newMode === 'long') duration = config.long;

    setRemaining(Math.max(0, duration) * 60);

    if (startClock) {
      setRunning(true);
    } else {
      pause();
    }
  }, [config.study, config.short, config.long, pause]);

  const formatTime = (sec: number) => {
    const mm = Math.floor(sec / 60).toString().padStart(2, '0');
    const ss = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const onFinish = useCallback(async () => {
    pause();
    await playAlert();

    let nextMode: TimerMode = 'study';
    let newDoneSessions = doneSessions;

    if (mode === 'study') {
      newDoneSessions = doneSessions + 1;
      setDoneSessions(newDoneSessions);

      if (user && firestore && config.study > 0) {
        const studySessionsRef = collection(firestore, 'users', user.uid, 'studySessions');
        addDocumentNonBlocking(studySessionsRef, {
          userId: user.uid,
          topic: `Pomodoro Session #${newDoneSessions}`,
          duration: config.study,
          date: serverTimestamp(),
          subjectId: subject,
        });
        toast({
          title: "Session Saved!",
          description: `Your ${config.study}-minute session for ${subject} has been logged.`,
        });
      }

      // Using a fixed cycle of 4 study sessions before a long break
      const goLong = (newDoneSessions % 4) === 0;
      nextMode = goLong ? 'long' : 'short';
    } else {
      nextMode = 'study';
    }

    setTimer(nextMode, config.autoStart);

  }, [config, doneSessions, mode, user, firestore, subject, toast, pause, playAlert, setTimer]);

  const tick = useCallback(() => {
    setRemaining(prev => {
      if (prev <= 1) {
        onFinish();
        return 0;
      }
      return prev - 1;
    });
  }, [onFinish]);

  const start = () => {
    if (running) return;

    // If current mode has 0 duration, finish it immediately
    const currentDuration = mode === 'study' ? config.study : mode === 'short' ? config.short : config.long;
    if (currentDuration <= 0) {
      onFinish();
      return;
    }

    setRunning(true);
    if (timerInterval.current) clearInterval(timerInterval.current);
    timerInterval.current = setInterval(tick, 1000);
  };

  const skip = () => {
    onFinish();
  };

  const resetClock = useCallback(() => {
    pause();
    setTimer('study', false);
    setDoneSessions(0);
  }, [pause, setTimer]);

  useEffect(() => {
    if (running) {
      document.title = `${formatTime(remaining)} - ${mode}`;
    } else {
      document.title = "AthenaAI StudyBuddy";
    }
    return () => {
      document.title = "AthenaAI StudyBuddy";
    }
  }, [remaining, running, mode])

  useEffect(() => {
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, []);

  useEffect(() => {
    resetClock();
  }, [config.study, config.short, config.long, resetClock]);

  const totalSeconds = mode === 'study' ? config.study * 60 : mode === 'short' ? config.short * 60 : config.long * 60;
  const progressPercent = totalSeconds > 0 ? ((totalSeconds - remaining) / totalSeconds) * 360 : 0;

  const modeText = {
    study: 'Study Session',
    short: 'Short Break',
    long: 'Long Break',
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Study Timer"
        description="Use the Pomodoro Technique to stay focused and productive."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-1 flex flex-col items-center gap-4">
          <Card className="w-full max-w-sm">
            <CardContent className="pt-6 flex justify-center items-center">
              <div
                className="relative grid place-items-center rounded-full w-64 h-64 sm:w-72 sm:h-72"
                style={{ background: `conic-gradient(hsl(var(--primary)) ${progressPercent}deg, hsl(var(--muted)) ${progressPercent}deg)` }}
              >
                <div className="absolute w-[84%] h-[84%] bg-background rounded-full grid place-items-center">
                  <div className="text-center">
                    <div className="text-5xl md:text-6xl font-bold font-mono">{formatTime(remaining)}</div>
                    <div className="text-muted-foreground uppercase tracking-widest text-sm mt-2">{modeText[mode]}</div>
                    <div className="flex gap-2 justify-center mt-4">
                      <Button onClick={() => running ? pause() : start()} size="icon" className='h-12 w-12'>
                        {running ? <Pause /> : <Play />}
                      </Button>
                      <Button onClick={skip} variant="ghost" size="icon" className='h-12 w-12'>
                        <SkipForward />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="w-full max-w-sm">
            <CardContent className="pt-6 flex justify-around text-center">
              <div>
                <div className="text-2xl font-bold">{doneSessions}</div>
                <div className="text-sm text-muted-foreground">Sessions Done</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{Math.floor(doneSessions / 4)}</div>
                <div className="text-sm text-muted-foreground">Cycles Done</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Settings className='h-6 w-6' /> Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className='space-y-2'>
                <Label>Subject</Label>
                <Select onValueChange={setSubject} defaultValue={subject} disabled={subjectsLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder={subjectsLoading ? "Loading subjects..." : "Select a subject"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    {subjects?.map((subject) => (
                      <SelectItem key={subject.id} value={subject.name}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="studyMin">Study (minutes)</Label>
                  <Input id="studyMin" type="number" min="0" max="180" value={config.study} onChange={e => setConfig(prev => ({ ...prev, study: Number(e.target.value) }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shortBreakMin">Short Break (minutes)</Label>
                  <Input id="shortBreakMin" type="number" min="0" max="60" value={config.short} onChange={e => setConfig(prev => ({ ...prev, short: Number(e.target.value) }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longBreakMin">Long Break (minutes)</Label>
                  <Input id="longBreakMin" type="number" min="0" max="60" value={config.long} onChange={e => setConfig(prev => ({ ...prev, long: Number(e.target.value) }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Auto-start next session?</Label>
                <Select value={config.autoStart ? 'on' : 'off'} onValueChange={v => setConfig(prev => ({ ...prev, autoStart: v === 'on' }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on">On</SelectItem>
                    <SelectItem value="off">Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-2 pt-4">
                <Button onClick={() => setConfig(prev => ({ ...prev, sound: !config.sound }))} variant="outline">
                  {config.sound ? <Volume2 className="mr-2" /> : <VolumeX className="mr-2" />}
                  Sound is {config.sound ? 'On' : 'Off'}
                </Button>
                <Button onClick={resetClock} variant="outline">
                  <RotateCcw className="mr-2" />
                  Reset Cycle
                </Button>
                <Button onClick={() => {
                  setConfig(DEFAULTS);
                  toast({ title: 'Settings restored to default.' });
                }} variant="ghost">
                  Restore Defaults
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
