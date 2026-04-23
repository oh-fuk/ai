
'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, getDocs, doc, addDoc, serverTimestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import PageHeader from '@/components/app/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileDown, Loader, History, Sparkles, Trash } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { generatePaperFromPrompt } from '@/ai/flows/generate-paper-from-prompt';
import { generateStudyPlan } from '@/ai/flows/generate-study-plan';
import { useToast } from '@/hooks/use-toast';


// Data Interfaces
interface QuizAttempt {
    id: string;
    quizName: string;
    score: number;
    totalQuestions: number;
    subjectId: string;
    attemptedAt: { seconds: number };
}

interface PaperResult {
    id: string;
    topic: string;
    score: number;
    total: number;
    subject: string;
    createdAt: { seconds: number };
    mcqCount?: number;
    shortCount?: number;
    longCount?: number;
    mcqMarks?: number;
    shortMarks?: number;
    longMarks?: number;
    pdfId?: string;
}

interface StudySession {
    id: string;
    topic: string;
    duration: number;
    date: { seconds: number };
    subjectId: string;
}

interface AiSummary {
    id: string;
    sourceType: 'PDF' | 'Text';
    sourceContent: string;
    summaryText: string;
    createdAt: { seconds: number };
    subject: string;
}

interface StudyPlan {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    timeframe: string;
    createdAt: { seconds: number };
}


export default function HistoryPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();


    // Data Fetching Hooks
    const quizAttemptsQuery = useMemoFirebase(() => (user ? query(collection(firestore, 'users', user.uid, 'quizAttempts'), orderBy('attemptedAt', 'desc')) : null), [user, firestore]);
    const { data: quizAttempts, isLoading: attemptsLoading } = useCollection<QuizAttempt>(quizAttemptsQuery);

    const studySessionsQuery = useMemoFirebase(() => (user ? query(collection(firestore, 'users', user.uid, 'studySessions'), orderBy('date', 'desc')) : null), [user, firestore]);
    const { data: studySessions, isLoading: sessionsLoading } = useCollection<StudySession>(studySessionsQuery);

    const summariesQuery = useMemoFirebase(() => (user ? query(collection(firestore, 'users', user.uid, 'summaries'), orderBy('createdAt', 'desc')) : null), [user, firestore]);
    const { data: summaries, isLoading: summariesLoading } = useCollection<AiSummary>(summariesQuery);

    const studyPlansQuery = useMemoFirebase(() => (user ? query(collection(firestore, 'users', user.uid, 'studyPlans'), orderBy('createdAt', 'desc')) : null), [user, firestore]);
    const { data: studyPlans, isLoading: plansLoading } = useCollection<StudyPlan>(studyPlansQuery);

    // Notes history
    const notesQuery = useMemoFirebase(() => (user ? query(collection(firestore, 'users', user.uid, 'notesHistory'), orderBy('timestamp', 'desc')) : null), [user, firestore]);
    const { data: notesHistory, isLoading: notesLoading } = useCollection<any>(notesQuery);

    // Writing artifacts: essays, emails, letters, applications
    const essaysQuery = useMemoFirebase(() => (user ? query(collection(firestore, 'users', user.uid, 'essays'), orderBy('createdAt', 'desc')) : null), [user, firestore]);
    const { data: essays, isLoading: essaysLoading } = useCollection<any>(essaysQuery);

    const emailsQuery = useMemoFirebase(() => (user ? query(collection(firestore, 'users', user.uid, 'emails'), orderBy('createdAt', 'desc')) : null), [user, firestore]);
    const { data: emails, isLoading: emailsLoading } = useCollection<any>(emailsQuery);

    const lettersQuery = useMemoFirebase(() => (user ? query(collection(firestore, 'users', user.uid, 'letters'), orderBy('createdAt', 'desc')) : null), [user, firestore]);
    const { data: letters, isLoading: lettersLoading } = useCollection<any>(lettersQuery);

    const applicationsQuery = useMemoFirebase(() => (user ? query(collection(firestore, 'users', user.uid, 'applications'), orderBy('createdAt', 'desc')) : null), [user, firestore]);
    const { data: applications, isLoading: applicationsLoading } = useCollection<any>(applicationsQuery);


    const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
    const { data: userProfile } = useDoc(userDocRef);

    const [paperResults, setPaperResults] = useState<PaperResult[]>([]);
    const [paperResultsLoading, setPaperResultsLoading] = useState(true);

    useEffect(() => {
        async function fetchPaperResults() {
            if (!user) return;
            setPaperResultsLoading(true);
            const papersRef = collection(firestore, 'users', user.uid, 'papers');
            const papersSnapshot = await getDocs(query(papersRef, orderBy('createdAt', 'desc')));
            const results: PaperResult[] = papersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaperResult));
            setPaperResults(results);
            setPaperResultsLoading(false);
        }
        if (user && firestore) {
            fetchPaperResults();
        }
    }, [user, firestore]);

    const isLoading = isUserLoading || attemptsLoading || sessionsLoading || paperResultsLoading || summariesLoading || plansLoading;
    const writingLoading = essaysLoading || emailsLoading || lettersLoading || applicationsLoading;
    const combinedLoading = isLoading || writingLoading;

    const handleDelete = (collectionName: string, docId: string) => {
        if (!user) return;
        const docRef = doc(firestore, 'users', user.uid, collectionName, docId);
        deleteDocumentNonBlocking(docRef);
        toast({
            title: "Item Deleted",
            description: "The selected item has been removed from your history.",
        });
    };

    const addHeaderFooter = (doc: jsPDF, title: string) => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            const pageHeight = doc.internal.pageSize.height;
            const pageWidth = doc.internal.pageSize.width;
            const margin = 20;

            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text('AthenaAI', margin, 20);

            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.text(userProfile?.collegeName || 'Your College', pageWidth - margin, 20, { align: 'right' });

            doc.setLineWidth(0.5);
            doc.line(margin, 25, pageWidth - margin, 25);

            doc.setFontSize(14);
            doc.text(title, pageWidth / 2, 35, { align: 'center' });

            doc.setFontSize(11);
            doc.text(`Student: ${userProfile?.fullName || 'Student'}`, margin, 45);
            doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - margin, 45, { align: 'right' });

            doc.setFontSize(10);
            doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }
    };

    const downloadFullHistoryPdf = () => {
        if (!user) return;
        const doc = new jsPDF();
        const reportTitle = "Full Activity Report";

        let finalY = 60;

        const addSection = (title: string, head: any[][], body: any[][]) => {
            if (!body || body.length === 0) return;

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(title, 20, finalY);
            finalY += 10;

            (doc as any).autoTable({
                startY: finalY,
                head: head,
                body: body,
                theme: 'striped',
                didDrawPage: (data: any) => addHeaderFooter(doc, reportTitle),
                margin: { top: 60 }
            });
            finalY = (doc as any).lastAutoTable.finalY + 15;
        };

        addSection('Quizzes', [['Name', 'Subject', 'Score', 'Date', 'Performance']], (quizAttempts || []).map(a => [a.quizName, a.subjectId, `${a.score}/${a.totalQuestions}`, new Date(a.attemptedAt.seconds * 1000).toLocaleDateString(), getScoreBadgeText(a.score, a.totalQuestions)]));
        addSection('Papers', [['Topic', 'Subject', 'Score', 'Date', 'Performance']], (paperResults || []).map(p => [p.topic, p.subject, `${p.score}/${p.total}`, new Date(p.createdAt.seconds * 1000).toLocaleDateString(), getScoreBadgeText(p.score, p.total)]));
        addSection('Study Sessions', [['Topic', 'Subject', 'Duration (min)', 'Date']], (studySessions || []).map(s => [s.topic, s.subjectId, s.duration, new Date(s.date.seconds * 1000).toLocaleDateString()]));
        addSection('Summaries', [['Source Type', 'Source', 'Date']], (summaries || []).map(s => [s.sourceType, s.sourceContent.substring(0, 50) + '...', new Date(s.createdAt.seconds * 1000).toLocaleDateString()]));
        addSection('Study Plans', [['Name', 'Start Date', 'End Date', 'Created On']], (studyPlans || []).map(p => [p.name, p.startDate, p.endDate, new Date(p.createdAt.seconds * 1000).toLocaleDateString()]));

        addHeaderFooter(doc, reportTitle);
        doc.save('full-history-report.pdf');
    };

    const downloadSpecificQuizPdf = (attempt: QuizAttempt) => {
        const doc = new jsPDF();
        const reportTitle = `Quiz: ${attempt.quizName}`;

        (doc as any).autoTable({
            head: [['Quiz Name', 'Subject', 'Score', 'Date']],
            body: [[
                attempt.quizName,
                attempt.subjectId,
                `${attempt.score} / ${attempt.totalQuestions} (${((attempt.score / attempt.totalQuestions) * 100).toFixed(1)}%)`,
                new Date(attempt.attemptedAt.seconds * 1000).toLocaleDateString(),
            ]],
            startY: 60,
            didDrawPage: (data: any) => addHeaderFooter(doc, reportTitle),
            margin: { top: 60 },
        });

        addHeaderFooter(doc, reportTitle);
        doc.save(`${attempt.quizName.replace(/\s+/g, '_')}-result.pdf`);
    }

    const downloadSpecificPaperPdf = async (paper: PaperResult) => {
        const doc = new jsPDF();
        const reportTitle = `Paper: ${paper.topic}`;
        try {
            const result = await generatePaperFromPrompt({ prompt: paper.topic, mcqCount: paper.mcqCount || 5, shortCount: paper.shortCount || 3, longCount: paper.longCount || 1 });
            const generatedPaper = result.paper;
            const questions = generatedPaper.questions.map((q: any, i: number) => {
                let questionText = `Q${i + 1} (${q.type}): ${q.question}\n`;
                if (q.options) {
                    questionText += `Options: ${q.options.join(', ')}\n`;
                }
                questionText += `Correct Answer: ${q.correctAnswer}`;
                return questionText;
            });

            (doc as any).autoTable({
                head: [[`Paper on ${paper.topic}`]],
                body: questions.map((q: string) => [q]),
                startY: 60,
                didDrawPage: (data: any) => addHeaderFooter(doc, reportTitle),
            });
            addHeaderFooter(doc, reportTitle);
            doc.save(`${paper.topic.replace(/\s+/g, '_')}-paper.pdf`);
        } catch (e) {
            console.error(e);
        }
    }

    const downloadSpecificSummaryPdf = (summary: AiSummary) => {
        const doc = new jsPDF();
        const reportTitle = `Summary: ${summary.sourceContent.substring(0, 20)}...`;

        (doc as any).autoTable({
            head: [['Summary']],
            body: [[summary.summaryText]],
            startY: 60,
            didDrawPage: (data: any) => addHeaderFooter(doc, reportTitle),
        });
        addHeaderFooter(doc, reportTitle);
        doc.save('summary.pdf');
    }

    const downloadSpecificStudyPlanPdf = async (plan: StudyPlan) => {
        const doc = new jsPDF();
        const reportTitle = `Study Plan: ${plan.name}`;
        try {
            const result = await generateStudyPlan({ topic: plan.name, timeframe: plan.timeframe || "1 week" });
            const planItems = result.plan;

            (doc as any).autoTable({
                head: [['Duration', 'Topic', 'Tasks']],
                body: planItems.map(item => [item.duration, item.topic, item.tasks.join('\n')]),
                startY: 60,
                didDrawPage: (data: any) => addHeaderFooter(doc, reportTitle),
            });
            addHeaderFooter(doc, reportTitle);
            doc.save(`${plan.name.replace(/\s+/g, '_')}-plan.pdf`);
        } catch (e) {
            console.error(e);
        }
    }


    const getScoreBadgeText = (score: number, total: number) => {
        if (total === 0) return "N/A";
        const percentage = (score / total) * 100;
        if (percentage >= 80) return "Excellent";
        if (percentage >= 60) return "Good";
        return "Needs Improvement";
    }

    const getScoreBadge = (score: number, total: number) => {
        const text = getScoreBadgeText(score, total);
        let variant: "default" | "secondary" | "destructive" = "destructive";
        if (text === "Excellent") variant = "default";
        if (text === "Good") variant = "secondary";

        let className = "";
        if (variant === 'default') className = "bg-green-600 hover:bg-green-700";
        if (variant === 'secondary') className = "bg-yellow-500 hover:bg-yellow-600";
        if (variant === 'destructive') className = "bg-red-600 hover:bg-red-700";

        return <Badge variant={variant} className={className}>{text}</Badge>;
    }

    const handleImprove = (type: 'quiz' | 'paper', item: QuizAttempt | PaperResult) => {
        const url = type === 'quiz' ? '/quiz' : '/paper-generator';
        const params = new URLSearchParams({ improve: 'true' });

        if (type === 'quiz') {
            const quizAttempt = item as QuizAttempt;
            params.set('quizId', quizAttempt.id);
            params.set('topic', quizAttempt.quizName);
            params.set('subject', quizAttempt.subjectId);
            params.set('totalQuestions', String(quizAttempt.totalQuestions));
        } else {
            const paperResult = item as PaperResult;
            if (paperResult.mcqCount === undefined) {
                toast({
                    variant: 'destructive',
                    title: 'Cannot Improve Old Paper',
                    description: 'This paper was saved before the "Improve" feature was fully implemented. Please generate a new paper to use this feature going forward.'
                });
                return;
            }
            params.set('paperId', paperResult.id);
            params.set('topic', paperResult.topic);
            params.set('subject', paperResult.subject);
            params.set('mcqCount', String(paperResult.mcqCount || 0));
            params.set('shortCount', String(paperResult.shortCount || 0));
            params.set('longCount', String(paperResult.longCount || 0));
            params.set('mcqMarks', String(paperResult.mcqMarks || 0));
            params.set('shortMarks', String(paperResult.shortMarks || 0));
            params.set('longMarks', String(paperResult.longMarks || 0));
            if (paperResult.pdfId) {
                params.set('pdfId', paperResult.pdfId);
            }
        }

        router.push(`${url}?${params.toString()}`);
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center gap-4">
                <PageHeader
                    title="Activity History"
                    description="A complete record of all your quizzes, papers, study sessions, and more."
                />
            </div>
            {combinedLoading ? (
                <div className='flex items-center justify-center p-8'>
                    <Loader className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <History className="h-6 w-6" />
                            Your Full History
                        </CardTitle>
                        <Button onClick={downloadFullHistoryPdf} variant="outline" size="sm">
                            <FileDown className="mr-2 h-4 w-4" />
                            Download Full Report
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="quizzes" className="w-full">
                            <div className="overflow-x-auto pb-2">
                                <TabsList className="inline-flex w-full gap-2 bg-transparent p-0">
                                    <TabsTrigger value="quizzes" className="min-w-max">Quizzes</TabsTrigger>
                                    <TabsTrigger value="papers" className="min-w-max">Papers</TabsTrigger>
                                    <TabsTrigger value="sessions" className="min-w-max">Study Sessions</TabsTrigger>
                                    <TabsTrigger value="summaries" className="min-w-max">Summaries</TabsTrigger>
                                    <TabsTrigger value="plans" className="min-w-max">Study Plans</TabsTrigger>
                                    <TabsTrigger value="notes" className="min-w-max">Notes</TabsTrigger>
                                    <TabsTrigger value="essays" className="min-w-max">Essays</TabsTrigger>
                                    <TabsTrigger value="emails" className="min-w-max">Emails</TabsTrigger>
                                    <TabsTrigger value="apps" className="min-w-max">Applications</TabsTrigger>
                                    <TabsTrigger value="letters" className="min-w-max">Letters</TabsTrigger>
                                </TabsList>
                            </div>
                            <TabsContent value="quizzes" className="mt-4">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Quiz Name</TableHead><TableHead>Subject</TableHead><TableHead>Score</TableHead><TableHead>Date</TableHead><TableHead>Performance</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {quizAttempts && quizAttempts.length > 0 ? quizAttempts.map(attempt => {
                                            const performance = getScoreBadgeText(attempt.score, attempt.totalQuestions);
                                            return (
                                                <TableRow key={attempt.id}>
                                                    <TableCell>{attempt.quizName}</TableCell>
                                                    <TableCell>{attempt.subjectId}</TableCell>
                                                    <TableCell>{attempt.score}/{attempt.totalQuestions}</TableCell>
                                                    <TableCell>{new Date(attempt.attemptedAt.seconds * 1000).toLocaleDateString()}</TableCell>
                                                    <TableCell>{getScoreBadge(attempt.score, attempt.totalQuestions)}</TableCell>
                                                    <TableCell className="flex gap-2">
                                                        <Button variant="outline" size="icon" onClick={() => downloadSpecificQuizPdf(attempt)}><FileDown className="h-4 w-4" /></Button>
                                                        {performance !== 'Good' && performance !== 'Excellent' && (
                                                            <Button variant="outline" size="sm" onClick={() => handleImprove('quiz', attempt)}>
                                                                <Sparkles className="mr-2 h-4 w-4" />
                                                                Improve
                                                            </Button>
                                                        )}
                                                        <Button variant="destructive" size="icon" onClick={() => handleDelete('quizAttempts', attempt.id)}><Trash className="h-4 w-4" /></Button>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        }) : (<TableRow><TableCell colSpan={6} className="text-center">No quiz history yet.</TableCell></TableRow>)}
                                    </TableBody>
                                </Table>
                            </TabsContent>
                            <TabsContent value="notes" className="mt-4">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Topic</TableHead><TableHead>Subject</TableHead><TableHead>Difficulty</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {notesHistory && notesHistory.length > 0 ? (
                                            notesHistory.map((note: any) => (
                                                <TableRow key={note.id}>
                                                    <TableCell className='truncate max-w-xs'>{note.topic || 'Untitled'}</TableCell>
                                                    <TableCell>{note.subject || 'General'}</TableCell>
                                                    <TableCell><Badge>{note.difficulty || 'Intermediate'}</Badge></TableCell>
                                                    <TableCell>{new Date(note.timestamp).toLocaleDateString()}</TableCell>
                                                    <TableCell className="flex gap-2">
                                                        <Button variant="outline" size="icon" onClick={() => {
                                                            const doc = new jsPDF();
                                                            doc.text(`Notes: ${note.topic}`, 20, 40);
                                                            doc.text((note.notes || '').substring(0, 1000), 20, 60);
                                                            addHeaderFooter(doc, note.topic || 'Notes');
                                                            doc.save(`${(note.topic || 'notes').replace(/\s+/g, '_')}.pdf`);
                                                        }}><FileDown className="h-4 w-4" /></Button>
                                                        <Button variant="destructive" size="icon" onClick={() => handleDelete('notesHistory', note.id)}><Trash className="h-4 w-4" /></Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={5} className="text-center">No notes yet.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TabsContent>
                            <TabsContent value="essays" className="mt-4">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {essays && essays.length > 0 ? (
                                            essays.map((e: any) => (
                                                <TableRow key={e.id}>
                                                    <TableCell className='truncate max-w-xs'>{e.title || e.topic || 'Essay'}</TableCell>
                                                    <TableCell>{new Date(e.createdAt.seconds * 1000).toLocaleDateString()}</TableCell>
                                                    <TableCell className="flex gap-2">
                                                        <Button variant="outline" size="icon" onClick={() => {
                                                            const doc = new jsPDF();
                                                            doc.text(e.title || e.topic || 'Essay', 20, 40);
                                                            doc.text((e.content || '').substring(0, 1000), 20, 60);
                                                            addHeaderFooter(doc, e.title || 'Essay');
                                                            doc.save(`${(e.title || e.topic || 'essay').replace(/\s+/g, '_')}.pdf`);
                                                        }}><FileDown className="h-4 w-4" /></Button>
                                                        <Button variant="destructive" size="icon" onClick={() => handleDelete('essays', e.id)}><Trash className="h-4 w-4" /></Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={3} className="text-center">No essays yet.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TabsContent>
                            <TabsContent value="emails" className="mt-4">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {emails && emails.length > 0 ? (
                                            emails.map((m: any) => (
                                                <TableRow key={m.id}>
                                                    <TableCell className='truncate max-w-xs'>{m.subject || m.title || 'Email'}</TableCell>
                                                    <TableCell>{new Date(m.createdAt.seconds * 1000).toLocaleDateString()}</TableCell>
                                                    <TableCell className="flex gap-2">
                                                        <Button variant="outline" size="icon" onClick={() => {
                                                            const doc = new jsPDF();
                                                            doc.text(m.subject || 'Email', 20, 40);
                                                            doc.text((m.body || '').substring(0, 1000), 20, 60);
                                                            addHeaderFooter(doc, m.subject || 'Email');
                                                            doc.save(`${(m.subject || 'email').replace(/\s+/g, '_')}.pdf`);
                                                        }}><FileDown className="h-4 w-4" /></Button>
                                                        <Button variant="destructive" size="icon" onClick={() => handleDelete('emails', m.id)}><Trash className="h-4 w-4" /></Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={3} className="text-center">No emails yet.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TabsContent>
                            <TabsContent value="letters" className="mt-4">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {letters && letters.length > 0 ? (
                                            letters.map((l: any) => (
                                                <TableRow key={l.id}>
                                                    <TableCell className='truncate max-w-xs'>{l.subject || l.title || 'Letter'}</TableCell>
                                                    <TableCell>{new Date(l.createdAt.seconds * 1000).toLocaleDateString()}</TableCell>
                                                    <TableCell className="flex gap-2">
                                                        <Button variant="outline" size="icon" onClick={() => {
                                                            const doc = new jsPDF();
                                                            doc.text(l.subject || 'Letter', 20, 40);
                                                            doc.text((l.body || '').substring(0, 1000), 20, 60);
                                                            addHeaderFooter(doc, l.subject || 'Letter');
                                                            doc.save(`${(l.subject || 'letter').replace(/\s+/g, '_')}.pdf`);
                                                        }}><FileDown className="h-4 w-4" /></Button>
                                                        <Button variant="destructive" size="icon" onClick={() => handleDelete('letters', l.id)}><Trash className="h-4 w-4" /></Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={3} className="text-center">No letters yet.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TabsContent>
                            <TabsContent value="apps" className="mt-4">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Application Title</TableHead><TableHead>Target</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {applications && applications.length > 0 ? applications.map((app: any) => (
                                            <TableRow key={app.id}>
                                                <TableCell>{app.title || app.position || 'Application'}</TableCell>
                                                <TableCell className='truncate max-w-xs'>{app.organization || app.target || ''}</TableCell>
                                                <TableCell>{new Date(app.createdAt.seconds * 1000).toLocaleDateString()}</TableCell>
                                                <TableCell className="flex gap-2">
                                                    <Button variant="outline" size="icon" onClick={() => {
                                                        const doc = new jsPDF();
                                                        doc.text(app.title || app.position || 'Application', 20, 40);
                                                        doc.text((app.content || '').substring(0, 1000), 20, 60);
                                                        addHeaderFooter(doc, app.title || 'Application');
                                                        doc.save(`${(app.title || app.position || 'application').replace(/\s+/g, '_')}.pdf`);
                                                    }}><FileDown className="h-4 w-4" /></Button>
                                                    <Button variant="destructive" size="icon" onClick={() => handleDelete('applications', app.id)}><Trash className="h-4 w-4" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        )) : (<TableRow><TableCell colSpan={4} className="text-center">No applications created yet.</TableCell></TableRow>)}
                                    </TableBody>
                                </Table>
                            </TabsContent>
                            <TabsContent value="papers" className="mt-4">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Paper Topic</TableHead><TableHead>Subject</TableHead><TableHead>Score</TableHead><TableHead>Date</TableHead><TableHead>Performance</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {paperResults && paperResults.length > 0 ? paperResults.map(paper => {
                                            const performance = getScoreBadgeText(paper.score, paper.total);
                                            return (
                                                <TableRow key={paper.id}>
                                                    <TableCell>{paper.topic}</TableCell>
                                                    <TableCell>{paper.subject}</TableCell>
                                                    <TableCell>{paper.score}/{paper.total}</TableCell>
                                                    <TableCell>{new Date(paper.createdAt.seconds * 1000).toLocaleDateString()}</TableCell>
                                                    <TableCell>{getScoreBadge(paper.score, paper.total)}</TableCell>
                                                    <TableCell className="flex gap-2">
                                                        <Button variant="outline" size="icon" onClick={() => downloadSpecificPaperPdf(paper)}><FileDown className="h-4 w-4" /></Button>
                                                        {performance === 'Needs Improvement' && (
                                                            <Button variant="outline" size="sm" onClick={() => handleImprove('paper', paper)}>
                                                                <Sparkles className="mr-2 h-4 w-4" />
                                                                Improve
                                                            </Button>
                                                        )}
                                                        <Button variant="destructive" size="icon" onClick={() => handleDelete('papers', paper.id)}><Trash className="h-4 w-4" /></Button>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        }) : (<TableRow><TableCell colSpan={6} className="text-center">No paper history yet.</TableCell></TableRow>)}
                                    </TableBody>
                                </Table>
                            </TabsContent>
                            <TabsContent value="sessions" className="mt-4">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Session Topic</TableHead><TableHead>Subject</TableHead><TableHead>Duration (minutes)</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {studySessions && studySessions.length > 0 ? studySessions.map(session => (
                                            <TableRow key={session.id}>
                                                <TableCell>{session.topic}</TableCell>
                                                <TableCell>{session.subjectId}</TableCell>
                                                <TableCell>{session.duration}</TableCell>
                                                <TableCell>{new Date(session.date.seconds * 1000).toLocaleDateString()}</TableCell>
                                                <TableCell>
                                                    <Button variant="destructive" size="icon" onClick={() => handleDelete('studySessions', session.id)}><Trash className="h-4 w-4" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        )) : (<TableRow><TableCell colSpan={5} className="text-center">No study sessions logged yet.</TableCell></TableRow>)}
                                    </TableBody>
                                </Table>
                            </TabsContent>
                            <TabsContent value="summaries" className="mt-4">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Source Type</TableHead><TableHead>Source Content</TableHead><TableHead>Date</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {summaries && summaries.length > 0 ? summaries.map(summary => (
                                            <TableRow key={summary.id}>
                                                <TableCell>{summary.sourceType}</TableCell>
                                                <TableCell className='truncate max-w-xs'>{summary.sourceContent}</TableCell>
                                                <TableCell>{new Date(summary.createdAt.seconds * 1000).toLocaleDateString()}</TableCell>
                                                <TableCell className="flex gap-2">
                                                    <Button variant="outline" size="icon" onClick={() => downloadSpecificSummaryPdf(summary)}><FileDown className="h-4 w-4" /></Button>
                                                    <Button variant="destructive" size="icon" onClick={() => handleDelete('summaries', summary.id)}><Trash className="h-4 w-4" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        )) : (<TableRow><TableCell colSpan={4} className="text-center">No summaries created yet.</TableCell></TableRow>)}
                                    </TableBody>
                                </Table>
                            </TabsContent>
                            <TabsContent value="plans" className="mt-4">
                                <Table>
                                    <TableHeader><TableRow><TableHead>Plan Name</TableHead><TableHead>Start Date</TableHead><TableHead>End Date</TableHead><TableHead>Created On</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {studyPlans && studyPlans.length > 0 ? studyPlans.map(plan => (
                                            <TableRow key={plan.id}>
                                                <TableCell>{plan.name}</TableCell>
                                                <TableCell>{plan.startDate}</TableCell>
                                                <TableCell>{plan.endDate}</TableCell>
                                                <TableCell>{new Date(plan.createdAt.seconds * 1000).toLocaleDateString()}</TableCell>
                                                <TableCell className="flex gap-2">
                                                    <Button variant="outline" size="icon" onClick={() => downloadSpecificStudyPlanPdf(plan)}><FileDown className="h-4 w-4" /></Button>
                                                    <Button variant="destructive" size="icon" onClick={() => handleDelete('studyPlans', plan.id)}><Trash className="h-4 w-4" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        )) : (<TableRow><TableCell colSpan={5} className="text-center">No study plans created yet.</TableCell></TableRow>)}
                                    </TableBody>
                                </Table>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
