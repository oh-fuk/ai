

'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader, UploadCloud, FileDown, CheckCircle, XCircle, X, Sparkles, File, Image as ImageIcon, Info } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import PageHeader from '@/components/app/page-header';
import { generatePaperFromPrompt } from '@/ai/flows/generate-paper-from-prompt';
import { generateRemedialPaper } from '@/ai/flows/generate-remedial-paper';
import { checkBulkQuizAnswers, AnswerResult } from '@/ai/flows/check-bulk-quiz-answers';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, useStorage, errorEmitter, FirestorePermissionError, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, addDoc, serverTimestamp, getDocs, updateDoc, getDoc } from 'firebase/firestore';
import { ref as storageRef, getBlob } from 'firebase/storage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import { extractTextFromImage } from '@/ai/flows/extract-text-from-image';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';


const formSchema = z.object({
    subject: z.string().min(1, 'Please select a subject.'),
    file: z.any().optional(),
    topic: z.string().optional(),
    specificTopic: z.string().optional(),
    pageRange: z.string().optional(),
    mcqCount: z.coerce.number().min(0).default(0),
    shortCount: z.coerce.number().min(0).default(0),
    longCount: z.coerce.number().min(0).default(0),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    mcqMarks: z.coerce.number().min(0).optional(),
    shortMarks: z.coerce.number().min(0).optional(),
    longMarks: z.coerce.number().min(0).optional(),
    pdfId: z.string().optional(),
}).refine(data => data.mcqCount + data.shortCount + data.longCount > 0, {
    message: 'Please specify at least one question to generate.',
    path: ['mcqCount'],
}).refine(data => {
    if (data.file && data.file[0]) {
        return true; // Topic is optional if a file is uploaded
    }
    return data.topic && data.topic.length >= 3;
}, {
    message: `A topic of at least 3 characters is required if no file is uploaded.`,
    path: ['topic'],
});

type PaperFormValues = z.infer<typeof formSchema>;

interface Question {
    question: string;
    type: 'mcq' | 'short' | 'long';
    options?: string[];
    correctAnswer: string;
}

interface Paper {
    bookIntro?: string;
    paper: {
        questions: Question[];
    };
    progress: string;
}

interface Subject {
    id: string;
    name: string;
}

interface QuizAttempt {
    id: string;
    quizName: string;
    score: number;
    totalQuestions: number;
    subjectId: string;
    attemptedAt: {
        seconds: number;
    };
}

interface PaperResult {
    id: string;
    topic: string;
    subject: string;
    score: number;
    total: number;
    createdAt: {
        seconds: number;
    };
    pdfId?: string;
}

export default function PaperGeneratorPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [paper, setPaper] = useState<Paper | null>(null);
    const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
    const [results, setResults] = useState<AnswerResult[] | null>(null);
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const storage = useStorage();
    const router = useRouter();

    const [paperResults, setPaperResults] = useState<PaperResult[]>([]);
    const [paperResultsLoading, setPaperResultsLoading] = useState(true);

    const subjectsQuery = useMemoFirebase(
        () => (user ? collection(firestore, 'users', user.uid, 'subjects') : null),
        [user, firestore]
    );
    const { data: subjects, isLoading: subjectsLoading } = useCollection<Subject>(subjectsQuery);

    const quizAttemptsQuery = useMemoFirebase(
        () => (user ? query(collection(firestore, 'users', user.uid, 'quizAttempts')) : null),
        [user, firestore]
    );
    const { data: quizAttempts, isLoading: attemptsLoading } = useCollection<QuizAttempt>(quizAttemptsQuery);

    const userDocRef = useMemoFirebase(
        () => (user ? doc(firestore, 'users', user.uid) : null),
        [user, firestore]
    );
    const { data: userProfile } = useDoc(userDocRef);

    const fetchPaperResults = async () => {
        if (!user) return;
        setPaperResultsLoading(true);
        const papersRef = collection(firestore, 'users', user.uid, 'papers');
        const papersSnapshot = await getDocs(papersRef);
        const results: PaperResult[] = papersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaperResult));
        setPaperResults(results);
        setPaperResultsLoading(false);
    };

    useEffect(() => {
        if (user && firestore) {
            fetchPaperResults();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, firestore]);

    const form = useForm<PaperFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            topic: '',
            specificTopic: '',
            pageRange: '',
            mcqCount: 2,
            shortCount: 2,
            longCount: 1,
            difficulty: 'medium',
            mcqMarks: 1,
            shortMarks: 5,
            longMarks: 10,
            subject: '',
        },
    });

    const handleGenerateRemedialPaper = async () => {
        setIsAnalyzing(true);
        resetState();

        if ((!quizAttempts || quizAttempts.length === 0) && (!paperResults || paperResults.length === 0)) {
            toast({
                variant: 'destructive',
                title: 'Not Enough Data',
                description: 'You need to complete some quizzes or papers before the AI can analyze your performance.',
            });
            setIsAnalyzing(false);
            return;
        }

        try {
            const quizHistory = (quizAttempts || []).map(qa => ({
                name: qa.quizName,
                subject: qa.subjectId,
                score: `${qa.score}/${qa.totalQuestions}`,
                percentage: (qa.score / qa.totalQuestions) * 100,
                date: new Date(qa.attemptedAt.seconds * 1000).toLocaleDateString(),
                type: 'Quiz'
            }));

            const paperHistory = (paperResults || []).map(pr => ({
                name: pr.topic,
                subject: pr.subject,
                score: `${pr.score}/${pr.total}`,
                percentage: (pr.score / pr.total) * 100,
                date: new Date(pr.createdAt.seconds * 1000).toLocaleDateString(),
                type: 'Paper'
            }));

            const combinedHistory = [...quizHistory, ...paperHistory];

            const result = await generateRemedialPaper({
                history: JSON.stringify(combinedHistory, null, 2),
                mcqCount: 5,
                shortCount: 3,
                longCount: 1,
            });

            const parsedPaper = result.paper;

            form.setValue('topic', result.topic);

            setPaper({
                ...result,
                paper: {
                    questions: parsedPaper.questions,
                },
            });

            toast({
                title: "Personalized Paper Generated!",
                description: `This paper focuses on "${result.topic}" based on your performance.`,
            });

        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error Analyzing Performance',
                description: 'Could not generate a personalized paper at this time. Please try again.',
            });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const toBase64 = (file: File | Blob): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });

    useEffect(() => {
        let isImprove = false;
        let topic: string | null = null;
        let subject: string | null = null;
        let mcqCount: string | null = null;
        let shortCount: string | null = null;
        let longCount: string | null = null;
        let mcqMarks: string | null = null;
        let shortMarks: string | null = null;
        let longMarks: string | null = null;
        let pdfId: string | null = null;

        try {
            const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
            isImprove = params.get('improve') === 'true';
            topic = params.get('topic');
            subject = params.get('subject');
            mcqCount = params.get('mcqCount');
            shortCount = params.get('shortCount');
            longCount = params.get('longCount');
            mcqMarks = params.get('mcqMarks');
            shortMarks = params.get('shortMarks');
            longMarks = params.get('longMarks');
            pdfId = params.get('pdfId');
        } catch (e) {
            // noop in non-browser context
        }

        if (!isImprove) return;

        const runAutoGeneration = async () => {
            if (topic && subject && user) {
                setIsLoading(true);
                resetState();

                const mcq = mcqCount ? parseInt(mcqCount, 10) : 0;
                const short = shortCount ? parseInt(shortCount, 10) : 0;
                const long = longCount ? parseInt(longCount, 10) : 0;
                const mcqM = mcqMarks ? parseInt(mcqMarks, 10) : 1;
                const shortM = shortMarks ? parseInt(shortMarks, 10) : 5;
                const longM = longMarks ? parseInt(longMarks, 10) : 10;

                form.setValue('topic', topic);
                form.setValue('subject', subject);
                form.setValue('mcqCount', mcq);
                form.setValue('shortCount', short);
                form.setValue('longCount', long);
                form.setValue('mcqMarks', mcqM);
                form.setValue('shortMarks', shortM);
                form.setValue('longMarks', longM);

                let pdfDataUri: string | undefined;
                if (pdfId) {
                    try {
                        const docRef = doc(firestore, 'users', user.uid, 'documents', pdfId);
                        const docSnap = await getDoc(docRef);
                        if (docSnap.exists()) {
                            const filePath = docSnap.data().storagePath;
                            const fileRef = storageRef(storage, filePath);
                            const blob = await getBlob(fileRef);
                            pdfDataUri = await toBase64(blob);
                            form.setValue('pdfId', pdfId);
                        }
                    } catch (e) {
                        console.error("Failed to fetch original PDF for improvement:", e);
                        toast({
                            variant: 'destructive',
                            title: 'Could Not Load PDF',
                            description: 'Failed to load the original PDF. Generating paper without it.'
                        });
                    }
                }


                try {
                    const result = await generatePaperFromPrompt({
                        prompt: topic,
                        subject: subject,
                        mcqCount: mcq,
                        shortCount: short,
                        longCount: long,
                        difficulty: form.getValues('difficulty') || 'medium',
                        pdfDataUri: pdfDataUri,
                    });
                    const parsedPaper = result.paper;
                    setPaper({ ...result, paper: { questions: parsedPaper.questions } });
                    toast({ title: `New Paper Generated!`, description: `Here's a new paper on "${topic}" to help you improve.` });
                } catch (error) {
                    console.error(error);
                    toast({
                        variant: 'destructive',
                        title: 'Error Auto-Generating Paper',
                        description: 'Could not automatically generate the paper. Please try again manually.',
                    });
                } finally {
                    setIsLoading(false);
                }
            }
        };

        runAutoGeneration();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, firestore, storage]);


    const resetState = () => {
        setPaper(null);
        setUserAnswers({});
        setResults(null);
        form.resetField('file');
    };

    const onSubmit = async (data: PaperFormValues) => {
        setIsLoading(true);
        resetState();
        let topic = data.topic || "the uploaded content";
        let pdfDataUri: string | undefined;

        try {
            let documentId: string | undefined;
            let extractedTextFromImage: string | undefined;

            if (data.file && data.file[0]) {
                const file = data.file[0];
                const fileDataUri = await toBase64(file);

                if (file.type.startsWith('image/')) {
                    const imageTextResult = await extractTextFromImage({ imageDataUri: fileDataUri, subject: data.subject });
                    if (!imageTextResult.isRelated || !imageTextResult.extractedText) {
                        toast({ variant: 'destructive', title: 'Image Analysis Failed', description: imageTextResult.reasoning || 'Could not extract relevant text from image.' });
                        setIsLoading(false);
                        return;
                    }
                    extractedTextFromImage = imageTextResult.extractedText;
                } else if (file.type === 'application/pdf') {
                    pdfDataUri = fileDataUri;
                    if (user) {
                        const docRef = doc(collection(firestore, 'users', user.uid, 'documents'));
                        documentId = docRef.id;
                        form.setValue('pdfId', documentId);
                    }
                } else {
                    toast({ variant: 'destructive', title: 'Unsupported File Type', description: 'Please upload a PDF or an image file.' });
                    setIsLoading(false);
                    return;
                }
            }

            const result = await generatePaperFromPrompt({
                prompt: extractedTextFromImage ? `Topic: ${topic}\n\nUse the following text as reference: ${extractedTextFromImage}` : topic,
                subject: data.subject,
                pdfDataUri: pdfDataUri,
                mcqCount: data.mcqCount,
                shortCount: data.shortCount,
                longCount: data.longCount,
                difficulty: data.difficulty,
                pageRange: data.pageRange,
                specificTopic: data.specificTopic,
            });

            const parsedPaper = result.paper;

            setPaper({
                ...result,
                paper: {
                    questions: parsedPaper.questions,
                },
            });

        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error Generating Paper',
                description: 'There was a problem generating the paper. Please try again.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnswerChange = (questionIndex: number, answer: string) => {
        setUserAnswers((prev) => ({ ...prev, [questionIndex]: answer }));
    };

    const checkAnswers = async () => {
        if (!paper || !user) return;
        setIsChecking(true);
        let studentScore = 0;
        let totalScore = 0;

        let paperIdToUpdate: string | null = null;
        let isImproving = false;
        try {
            const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
            paperIdToUpdate = params.get('paperId');
            isImproving = params.get('improve') === 'true' && !!paperIdToUpdate;
        } catch (e) {
            // noop
        }

        const answersToSubmit = paper.paper.questions.map((q, i) => ({
            question: q.question,
            studentAnswer: userAnswers[i] || 'No answer provided',
            correctAnswer: q.correctAnswer
        }));

        try {
            const checkResult = await checkBulkQuizAnswers({ answers: answersToSubmit });
            const newResults = checkResult.results;

            const { mcqMarks, shortMarks, longMarks, topic, subject, mcqCount, shortCount, longCount, pdfId } = form.getValues();

            paper.paper.questions.forEach((question, i) => {
                let marks = 0;
                if (question.type === 'mcq') marks = mcqMarks ?? 0;
                if (question.type === 'short') marks = shortMarks ?? 0;
                if (question.type === 'long') marks = longMarks ?? 0;
                totalScore += marks;
                if (newResults[i]?.isCorrect) {
                    studentScore += marks;
                }
            });

            const dataToSave: any = {
                userId: user.uid,
                topic: topic || `Paper from file on ${new Date().toLocaleDateString()}`,
                subject: subject,
                score: studentScore,
                total: totalScore,
                createdAt: serverTimestamp(),
                mcqCount,
                shortCount,
                longCount,
                mcqMarks,
                shortMarks,
                longMarks,
            };

            if (pdfId) {
                dataToSave.pdfId = pdfId;
            }

            if (isImproving && paperIdToUpdate) {
                const paperRef = doc(firestore, 'users', user.uid, 'papers', paperIdToUpdate);
                updateDocumentNonBlocking(paperRef, dataToSave);
            } else {
                const papersRef = collection(firestore, 'users', user.uid, 'papers');
                addDocumentNonBlocking(papersRef, dataToSave);
            }

            setResults(newResults);
            toast({
                title: isImproving ? 'Paper Updated!' : 'Paper Graded!',
                description: `Your score of ${studentScore}/${totalScore} has been saved.`,
            });
        } catch (e) {
            toast({
                variant: 'destructive',
                title: 'Error Checking Answers',
                description: 'There was a problem checking the answers. Please try again.',
            });
        } finally {
            setIsChecking(false);
        }
    };

    const downloadResultsPdf = () => {
        if (!paper || !results) return;

        const doc = new jsPDF();
        const { mcqMarks, shortMarks, longMarks, topic, subject } = form.getValues();
        const finalTopic = topic || `Paper from file on ${new Date().toLocaleDateString()}`;

        let studentScore = 0;
        let totalScore = 0;
        paper.paper.questions.forEach((q, i) => {
            let marks = 0;
            if (q.type === 'mcq') marks = mcqMarks ?? 0;
            if (q.type === 'short') marks = shortMarks ?? 0;
            if (q.type === 'long') marks = longMarks ?? 0;
            totalScore += marks;
            if (results[i]?.isCorrect) {
                studentScore += marks;
            }
        });

        const addHeaderFooter = (data: any) => {
            const pageNum = data.pageNumber;
            const totalPages = (doc as any).internal.getNumberOfPages();
            const pageHeight = doc.internal.pageSize.height;
            const pageWidth = doc.internal.pageSize.width;
            // Header
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text('AthenaAI', data.settings.margin.left, 20);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.text(userProfile?.collegeName || '', pageWidth - data.settings.margin.right, 20, { align: 'right' });
            doc.setLineWidth(0.5);
            doc.line(data.settings.margin.left, 25, pageWidth - data.settings.margin.right, 25);

            doc.setFontSize(14);
            doc.text(`Exam Paper Results: ${subject} - ${finalTopic}`, pageWidth / 2, 35, { align: 'center' });

            doc.setFontSize(11);
            doc.text(`Student: ${userProfile?.fullName || 'Student'}`, data.settings.margin.left, 45);

            doc.setFont('helvetica', 'bold');
            doc.text(`Final Score: ${studentScore} / ${totalScore}`, pageWidth - data.settings.margin.right, 45, { align: 'right' });

            // Footer
            doc.setFontSize(10);
            doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        };

        const bodyData = paper.paper.questions.map((q, i) => {
            const result = results[i];
            const userAnswer = userAnswers[i] || "No answer provided";
            const isCorrect = result?.isCorrect;

            let marks = 0;
            if (q.type === 'mcq') marks = mcqMarks ?? 0;
            if (q.type === 'short') marks = shortMarks ?? 0;
            if (q.type === 'long') marks = longMarks ?? 0;
            const points = isCorrect ? marks : 0;

            let answerBlock = `Your Answer: ${userAnswer}\nCorrect Answer: ${q.correctAnswer}`;
            if (!isCorrect && result?.explanation) {
                answerBlock += `\n\nExplanation: ${result.explanation}`;
            }

            return [
                `Q${i + 1}: ${q.question}\n(${q.type.toUpperCase()}, ${marks} marks)`,
                answerBlock,
                { content: `${points}/${marks}`, styles: { halign: 'center', fontStyle: 'bold', textColor: isCorrect ? [0, 100, 0] : [200, 0, 0] } },
            ];
        });

        (doc as any).autoTable({
            startY: 60,
            head: [['Question', 'Response & Explanation', 'Score']],
            body: bodyData,
            theme: 'grid',
            headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 80 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 20, halign: 'center' },
            },
            didDrawPage: addHeaderFooter,
            margin: { top: 60, bottom: 20, left: 20, right: 20 },
        });

        doc.save('exam-paper-results.pdf');
    };

    const downloadQuestionPaperPdf = () => {
        if (!paper) return;

        const doc = new jsPDF();
        const { topic, subject } = form.getValues();
        const finalTopic = topic || `Paper from file on ${new Date().toLocaleDateString()}`;
        const margins = { top: 60, bottom: 20, left: 20, right: 20 };

        const addHeaderFooter = (pageNum: number, totalPages: number) => {
            const pageHeight = doc.internal.pageSize.height;
            const pageWidth = doc.internal.pageSize.width;
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text('AthenaAI', margins.left, 20);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.text(userProfile?.collegeName || '', pageWidth - margins.right, 20, { align: 'right' });
            doc.setLineWidth(0.5);
            doc.line(margins.left, 25, pageWidth - margins.right, 25);

            doc.setFontSize(14);
            doc.text(`Exam Paper: ${subject} - ${finalTopic}`, pageWidth / 2, 35, { align: 'center' });

            doc.setFontSize(11);
            doc.text(`Student: ${userProfile?.fullName || 'Student'}`, margins.left, 45);

            doc.setFontSize(10);
            doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        };

        let lastY = margins.top;
        const addSection = (title: string, questions: Question[]) => {
            if (questions.length === 0) return;

            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text(title, 20, lastY);
            lastY += 10;

            const bodyData = questions.map((q, i) => {
                let questionText = `Q${i + 1}: ${q.question}\n\n`;
                if (q.type === 'mcq' && q.options) {
                    questionText += q.options.map(opt => `- ${opt}`).join('\n');
                }
                return [questionText];
            });

            (doc as any).autoTable({
                startY: lastY,
                head: [['Questions']],
                body: bodyData,
                theme: 'grid',
                headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
                didDrawPage: (data: any) => addHeaderFooter(data.pageNumber, (doc as any).internal.getNumberOfPages()),
                margin: margins
            });

            lastY = (doc as any).autoTable.previous.finalY + 15;
            if (lastY > doc.internal.pageSize.height - 40) {
                doc.addPage();
                lastY = margins.top;
            }
        };

        const mcqQuestions = paper.paper.questions.filter(q => q.type === 'mcq');
        const shortQuestions = paper.paper.questions.filter(q => q.type === 'short');
        const longQuestions = paper.paper.questions.filter(q => q.type === 'long');

        addSection('Section A (Multiple Choice Questions)', mcqQuestions);
        addSection('Section B (Short Answer Questions)', shortQuestions);
        addSection('Section C (Long Answer Questions)', longQuestions);

        const totalPages = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            addHeaderFooter(i, totalPages);
        }

        doc.save('question-paper.pdf');
    };

    const score = results ? results.filter(r => r.isCorrect).length : 0;
    const totalQuestions = paper?.paper.questions.length ?? 0;
    const watchedFile = form.watch('file');

    if (isLoading) {
        return (
            <div className="flex flex-col gap-8">
                <div className="flex items-center gap-4">
                    <PageHeader
                        title="Exam Paper Generator"
                        description="Create a custom exam paper or let AI generate one based on your progress."
                    />
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>Generating Paper...</CardTitle>
                        <CardDescription>The AI is crafting your paper. This may take a moment.</CardDescription>
                    </CardHeader>
                    <CardContent className='flex justify-center items-center py-12'>
                        <Loader className="h-8 w-8 animate-spin text-primary" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center gap-4">
                <PageHeader
                    title="Exam Paper Generator"
                    description="Create a custom exam paper or let AI generate one based on your progress."
                />
            </div>

            {!paper && (
                <>
                    <Card className="border-primary/50 bg-primary/5">
                        <CardHeader>
                            <CardTitle className='flex items-center gap-2'>
                                <Sparkles className="text-primary" />
                                AI-Powered Remedial Paper
                            </CardTitle>
                            <CardDescription>
                                Let the AI analyze your quiz and paper history to find your weak spots and automatically generate a personalized exam paper to help you improve.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={handleGenerateRemedialPaper} disabled={isAnalyzing || isLoading || attemptsLoading || paperResultsLoading}>
                                {isAnalyzing ? (
                                    <>
                                        <Loader className="mr-2 h-4 w-4 animate-spin" />
                                        Analyzing Your Progress...
                                    </>
                                ) : (
                                    'Analyze & Generate Paper'
                                )}
                            </Button>
                            {(attemptsLoading || paperResultsLoading) && <p className="text-xs text-muted-foreground mt-2">Loading your history...</p>}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Generate a Custom Exam Paper</CardTitle>
                            <CardDescription>Manually create an exam paper by providing a topic and other details.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="subject"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Subject</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={subjectsLoading}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder={subjectsLoading ? "Loading subjects..." : "Select a subject"} />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="general">General</SelectItem>
                                                            {subjects?.map((subject) => (
                                                                <SelectItem key={subject.id} value={subject.name}>
                                                                    {subject.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="topic"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Exam Topic / Book Name</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="e.g., The Great Gatsby or Photosynthesis" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="mcqCount"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>No. of MCQs</FormLabel>
                                                    <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={String(field.value)}>
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {Array.from({ length: 15 }, (_, i) => i + 2).map(num => (
                                                                <SelectItem key={num} value={String(num)}>
                                                                    {num} Questions
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="shortCount"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>No. of Short Questions</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" min="0" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="longCount"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>No. of Long Questions</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" min="0" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <FormMessage>
                                        {form.formState.errors.mcqCount?.message}
                                    </FormMessage>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="difficulty"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Difficulty</FormLabel>
                                                    <FormControl>
                                                        <Select onValueChange={field.onChange} defaultValue={String(field.value)} value={String(field.value)}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="easy">Easy</SelectItem>
                                                                <SelectItem value="medium">Medium</SelectItem>
                                                                <SelectItem value="hard">Hard</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="mcqMarks"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Marks per MCQ</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" min="0" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="shortMarks"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Marks per Short Question</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" min="0" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="longMarks"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Marks per Long Question</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" min="0" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>


                                    <FormField
                                        control={form.control}
                                        name="file"
                                        render={() => (
                                            <FormItem>
                                                <FormLabel>Reference Material (PDF or Image) - Optional</FormLabel>
                                                <FormControl>
                                                    <div className="relative flex items-center gap-4">
                                                        <Label
                                                            htmlFor="file-upload"
                                                            className="flex flex-col flex-1 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-primary/50 p-6 text-center text-muted-foreground transition hover:border-primary hover:bg-primary/5"
                                                        >
                                                            <UploadCloud className="mx-auto mb-2 h-8 w-8" />
                                                            <span className='flex items-center gap-2'> <File className='h-4 w-4' /> / <ImageIcon className='h-4 w-4' /></span>
                                                            {watchedFile?.[0]?.name || 'Click or drag to upload PDF/Image'}
                                                        </Label>
                                                        <Controller
                                                            name="file"
                                                            control={form.control}
                                                            render={({ field: { onChange, onBlur, value, ref } }) => (
                                                                <Input
                                                                    id="file-upload"
                                                                    type="file"
                                                                    accept=".pdf,image/*"
                                                                    className="sr-only"
                                                                    onBlur={onBlur}
                                                                    ref={ref}
                                                                    onChange={(e) => {
                                                                        onChange(e.target.files);
                                                                    }}
                                                                />
                                                            )}
                                                        />
                                                        {watchedFile?.[0] && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-destructive"
                                                                onClick={() => form.resetField('file')}
                                                            >
                                                                <X className="h-4 w-4" />
                                                                <span className="sr-only">Remove file</span>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </FormControl>
                                                <FormMessage>{form.formState.errors.file?.message as React.ReactNode}</FormMessage>
                                            </FormItem>
                                        )}
                                    />

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="specificTopic"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Specific Topic/Chapter (Optional)</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="e.g., Chapter 3" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="pageRange"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Page Range (Optional)</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="e.g., 25-30" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <Button type="submit" disabled={isLoading || isAnalyzing} className="w-full sm:w-auto">
                                        {isLoading ? (
                                            <>
                                                <Loader className="mr-2 h-4 w-4 animate-spin" />
                                                Generating Paper...
                                            </>
                                        ) : (
                                            'Generate Paper'
                                        )}
                                    </Button>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </>
            )}


            {paper && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Your Exam on "{form.getValues('topic') || 'the uploaded content'}"</CardTitle>
                        {!results && (
                            <Button onClick={downloadQuestionPaperPdf} variant="outline">
                                <FileDown className="mr-2 h-4 w-4" />
                                Download Question Paper
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-8">
                        {paper.bookIntro && (
                            <Card className="bg-primary/5 border-primary/20">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <Info className="h-5 w-5 text-primary" />
                                        About the Book
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-foreground/80">{paper.bookIntro}</p>
                                </CardContent>
                            </Card>
                        )}
                        {paper.paper.questions.map((q, i) => (
                            <div key={q.question} className="space-y-4">
                                <p className="font-semibold">{i + 1}. {q.question}</p>
                                {q.type === 'mcq' && q.options && (
                                    <RadioGroup
                                        onValueChange={(value) => handleAnswerChange(i, value)}
                                        value={userAnswers[i]}
                                        disabled={!!results}
                                    >
                                        {q.options!.map((option, index) => (
                                            <div key={index} className="flex items-center space-x-3">
                                                <RadioGroupItem value={option} id={`q${i}-opt${index}`} />
                                                <Label htmlFor={`q${i}-opt${index}`} className="font-normal">{option}</Label>
                                            </div>
                                        ))}
                                    </RadioGroup>
                                )}
                                {(q.type === 'short' || q.type === 'long') && (
                                    <Textarea
                                        placeholder="Your answer..."
                                        onChange={(e) => handleAnswerChange(i, e.target.value)}
                                        disabled={!!results}
                                        rows={q.type === 'short' ? 3 : 6}
                                    />
                                )}
                                {results && results[i] && (
                                    <div className={`mt-4 rounded-md p-4 text-sm ${results[i].isCorrect ? 'bg-green-100 border-green-200 text-green-800' : 'bg-red-100 border-red-200 text-red-800'}`}>
                                        {results[i].isCorrect ? (
                                            <div className="flex items-center gap-2">
                                                <CheckCircle className="h-5 w-5" />
                                                <strong>Correct!</strong>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 font-bold">
                                                    <XCircle className="h-5 w-5" />
                                                    Incorrect.
                                                </div>
                                                <p><strong>Correct Answer:</strong> {q.correctAnswer}</p>
                                                <p><strong>Explanation:</strong> {results[i].explanation}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                        <div className="flex flex-col sm:flex-row gap-4 pt-6">
                            {!results ? (
                                <Button onClick={checkAnswers} disabled={isChecking || Object.keys(userAnswers).length !== paper.paper.questions.length} className="w-full sm:w-auto">
                                    {isChecking ? (
                                        <>
                                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                                            Checking...
                                        </>
                                    ) : (
                                        'Check Answers'
                                    )}
                                </Button>
                            ) : (
                                <>
                                    <div className="flex-1 rounded-md bg-primary/10 p-4 text-center text-lg font-bold text-primary">
                                        Your Score: {score} / {totalQuestions}
                                    </div>
                                    <Button onClick={downloadResultsPdf} className="w-full sm:w-auto">
                                        <FileDown className="mr-2 h-4 w-4" />
                                        Download Results
                                    </Button>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
