

'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader, UploadCloud, FileDown, CheckCircle, XCircle, X, Sparkles, File, Image as ImageIcon, Info, Upload } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AiLoadingScreen } from '@/components/app/ai-loading';
import { DriveImportButton } from '@/components/app/drive-import-button';
import PageHeader from '@/components/app/page-header';
import { useDrive } from '@/hooks/use-drive';
import { useApplyQueuedDriveImport } from '@/hooks/use-apply-queued-drive-import';
import { getFormFileDisplayName, hasFormFileValue, isDriveImportFormValue, isPdfLikeMime } from '@/lib/drive-form-file';
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
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Step-by-step paper generation animation ───────────────────────────── */
function PaperGeneratingAnimation({ mcqCount, shortCount, longCount }: {
    mcqCount: number; shortCount: number; longCount: number;
}) {
    const steps = [
        mcqCount > 0 && { label: `Generating ${mcqCount} MCQs`, icon: '📝', color: 'text-blue-500' },
        shortCount > 0 && { label: `Generating ${shortCount} Short Questions`, icon: '✏️', color: 'text-green-500' },
        longCount > 0 && { label: `Generating ${longCount} Long Questions`, icon: '📄', color: 'text-purple-500' },
        { label: 'Finalizing Paper', icon: '✅', color: 'text-primary' },
    ].filter(Boolean) as { label: string; icon: string; color: string }[];

    const [currentStep, setCurrentStep] = useState(0);

    useEffect(() => {
        if (currentStep >= steps.length - 1) return;
        const delay = currentStep === 0 ? 1200 : 1800;
        const t = setTimeout(() => setCurrentStep(s => s + 1), delay);
        return () => clearTimeout(t);
    }, [currentStep, steps.length]);

    return (
        <div className="flex flex-col gap-8">
            <PageHeader title="Exam Paper Generator" description="Create a custom exam paper or let AI generate one based on your progress." />
            <div className="flex flex-col items-center justify-center py-16 gap-8">
                <div className="relative">
                    <div className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <span className="absolute inset-0 flex items-center justify-center text-2xl">
                        {steps[currentStep]?.icon}
                    </span>
                </div>
                <div className="flex flex-col gap-3 w-full max-w-sm">
                    {steps.map((step, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: i <= currentStep ? 1 : 0.3, x: 0 }}
                            transition={{ duration: 0.4, delay: i * 0.1 }}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/50"
                        >
                            <span className="text-lg">{step.icon}</span>
                            <span className={`text-sm font-medium ${i <= currentStep ? step.color : 'text-muted-foreground'}`}>
                                {step.label}
                            </span>
                            {i < currentStep && <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />}
                            {i === currentStep && <Loader className="h-4 w-4 animate-spin ml-auto text-primary" />}
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ─── Flip card for questions ───────────────────────────────────────────── */
function QuestionFlipCard({
    question, index, userAnswer, result, onAnswerChange, disabled,
}: {
    question: Question;
    index: number;
    userAnswer?: string;
    result?: AnswerResult;
    onAnswerChange: (i: number, v: string) => void;
    disabled: boolean;
}) {
    const [flipped, setFlipped] = useState(false);
    const isCorrect = result?.isCorrect;

    return (
        <div
            className="relative min-h-[180px] cursor-pointer"
            style={{ perspective: '1000px' }}
            onClick={() => result && setFlipped(f => !f)}
        >
            <motion.div
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
                style={{ transformStyle: 'preserve-3d' }}
                className="relative w-full"
            >
                {/* Front */}
                <div
                    className="w-full rounded-xl border bg-card p-5 space-y-4"
                    style={{ backfaceVisibility: 'hidden' }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex items-start gap-3">
                        <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white
                            ${result ? (isCorrect ? 'bg-green-500' : 'bg-red-500') : 'bg-primary'}`}>
                            {index + 1}
                        </span>
                        <p className="font-medium text-sm leading-relaxed">{question.question}</p>
                    </div>

                    {question.type === 'mcq' && question.options && (
                        <RadioGroup
                            value={userAnswer || ''}
                            onValueChange={v => onAnswerChange(index, v)}
                            disabled={disabled}
                            className="pl-10 space-y-2"
                        >
                            {question.options.map((opt, j) => (
                                <div key={j} className="flex items-center gap-2">
                                    <RadioGroupItem value={opt} id={`q${index}o${j}`} />
                                    <Label htmlFor={`q${index}o${j}`} className="font-normal text-sm cursor-pointer">{opt}</Label>
                                </div>
                            ))}
                        </RadioGroup>
                    )}

                    {question.type !== 'mcq' && (
                        <textarea
                            className="w-full ml-10 text-sm border rounded-lg p-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                            rows={3}
                            placeholder="Write your answer..."
                            value={userAnswer || ''}
                            onChange={e => onAnswerChange(index, e.target.value)}
                            disabled={disabled}
                            onClick={e => e.stopPropagation()}
                        />
                    )}

                    {result && (
                        <div className="pl-10 text-xs text-muted-foreground flex items-center gap-1">
                            {isCorrect ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <XCircle className="h-3.5 w-3.5 text-red-500" />}
                            {isCorrect ? 'Correct!' : 'Incorrect — tap card to see explanation'}
                        </div>
                    )}
                </div>

                {/* Back (result detail) */}
                {result && (
                    <div
                        className={`absolute inset-0 rounded-xl p-5 space-y-3 ${isCorrect ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'}`}
                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    >
                        <div className="flex items-center gap-2">
                            {isCorrect ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                            <span className={`font-semibold text-sm ${isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                                {isCorrect ? 'Correct!' : `Correct Answer: ${question.correctAnswer}`}
                            </span>
                        </div>
                        {result.explanation && (
                            <p className="text-xs text-muted-foreground leading-relaxed">{result.explanation}</p>
                        )}
                        <p className="text-xs text-muted-foreground/60 mt-2">← Tap to go back</p>
                    </div>
                )}
            </motion.div>
        </div>
    );
}


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
    if (hasFormFileValue(data.file)) {
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
    const [savingQuestionPdfToDrive, setSavingQuestionPdfToDrive] = useState(false);
    const [savingResultsPdfToDrive, setSavingResultsPdfToDrive] = useState(false);
    const { connected: driveConnected, uploadFile, downloadFile } = useDrive();

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

    useApplyQueuedDriveImport({
        connected: driveConnected,
        downloadFile,
        onApplied: ({ name, mimeType, dataUri }) => {
            form.setValue('file', { __driveImport: true, dataUri, name, type: mimeType } as any);
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

            if (hasFormFileValue(data.file)) {
                let fileType: string;
                let fileDataUri: string;
                let fromDrive = false;
                if (isDriveImportFormValue(data.file)) {
                    fromDrive = true;
                    fileType = data.file.type;
                    fileDataUri = data.file.dataUri;
                } else if (data.file[0]) {
                    const file = data.file[0];
                    fileType = file.type;
                    fileDataUri = await toBase64(file);
                } else {
                    fileType = '';
                    fileDataUri = '';
                }

                if (fileDataUri) {
                    if (fileType.startsWith('image/')) {
                        const imageTextResult = await extractTextFromImage({ imageDataUri: fileDataUri, subject: data.subject });
                        if (!imageTextResult.isRelated || !imageTextResult.extractedText) {
                            toast({ variant: 'destructive', title: 'Image Analysis Failed', description: imageTextResult.reasoning || 'Could not extract relevant text from image.' });
                            setIsLoading(false);
                            return;
                        }
                        extractedTextFromImage = imageTextResult.extractedText;
                    } else if (isPdfLikeMime(fileType)) {
                        pdfDataUri = fileDataUri;
                        if (user && !fromDrive) {
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

    const buildResultsPdfDoc = (): jsPDF => {
        if (!paper || !results) throw new Error('No paper or results');

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

        return doc;
    };

    const downloadResultsPdf = () => {
        if (!paper || !results) return;
        buildResultsPdfDoc().save('exam-paper-results.pdf');
    };

    const saveResultsPdfToDrive = async () => {
        if (!paper || !results || !driveConnected) return;
        setSavingResultsPdfToDrive(true);
        try {
            const doc = buildResultsPdfDoc();
            const blob = doc.output('blob');
            const { subject, topic } = form.getValues();
            const safe = (s: string) => s.replace(/[/\\?%*:|"<>]/g, '-').slice(0, 60);
            await uploadFile(blob, `Paper results - ${safe(subject)} - ${safe(topic || 'exam')}.pdf`, 'application/pdf');
            toast({ title: 'Saved to Google Drive!' });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Save failed';
            toast({ variant: 'destructive', title: 'Save failed', description: message });
        } finally {
            setSavingResultsPdfToDrive(false);
        }
    };

    const buildQuestionPaperPdfDoc = (): jsPDF => {
        if (!paper) throw new Error('No paper');

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

        return doc;
    };

    const downloadQuestionPaperPdf = () => {
        if (!paper) return;
        buildQuestionPaperPdfDoc().save('question-paper.pdf');
    };

    const saveQuestionPaperPdfToDrive = async () => {
        if (!paper || !driveConnected) return;
        setSavingQuestionPdfToDrive(true);
        try {
            const doc = buildQuestionPaperPdfDoc();
            const blob = doc.output('blob');
            const { subject, topic } = form.getValues();
            const safe = (s: string) => s.replace(/[/\\?%*:|"<>]/g, '-').slice(0, 60);
            await uploadFile(blob, `Question paper - ${safe(subject)} - ${safe(topic || 'exam')}.pdf`, 'application/pdf');
            toast({ title: 'Saved to Google Drive!' });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Save failed';
            toast({ variant: 'destructive', title: 'Save failed', description: message });
        } finally {
            setSavingQuestionPdfToDrive(false);
        }
    };

    const score = results ? results.filter(r => r.isCorrect).length : 0;
    const totalQuestions = paper?.paper.questions.length ?? 0;
    const watchedFile = form.watch('file');
    const mcqCount = form.watch('mcqCount') || 0;
    const shortCount = form.watch('shortCount') || 0;
    const longCount = form.watch('longCount') || 0;

    if (isLoading) {
        return (
            <PaperGeneratingAnimation
                mcqCount={mcqCount}
                shortCount={shortCount}
                longCount={longCount}
            />
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
                                                            {getFormFileDisplayName(watchedFile) || 'Click or drag to upload PDF/Image'}
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
                                                        {hasFormFileValue(watchedFile) && (
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
                                                    <div className="flex justify-center pt-2">
                                                        <DriveImportButton
                                                            onImported={({ dataUri, mimeType, name }) => {
                                                                form.setValue('file', {
                                                                    __driveImport: true,
                                                                    dataUri,
                                                                    name,
                                                                    type: mimeType,
                                                                } as any);
                                                            }}
                                                        />
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
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle>Your Exam on "{form.getValues('topic') || 'the uploaded content'}"</CardTitle>
                        {!results && (
                            <div className="flex flex-wrap gap-2">
                                <Button onClick={downloadQuestionPaperPdf} variant="outline" size="sm">
                                    <FileDown className="mr-2 h-4 w-4" />
                                    Download Question Paper
                                </Button>
                                {driveConnected && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="gap-1.5"
                                        disabled={savingQuestionPdfToDrive}
                                        onClick={() => void saveQuestionPaperPdfToDrive()}
                                    >
                                        {savingQuestionPdfToDrive ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                        Save to Drive
                                    </Button>
                                )}
                            </div>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-4">
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

                        {/* Animated reveal of questions */}
                        <AnimatePresence>
                            {paper.paper.questions.map((q, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 24 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.35, delay: i * 0.08 }}
                                >
                                    <QuestionFlipCard
                                        question={q}
                                        index={i}
                                        userAnswer={userAnswers[i]}
                                        result={results?.[i]}
                                        onAnswerChange={handleAnswerChange}
                                        disabled={!!results}
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        <div className="flex flex-col sm:flex-row gap-4 pt-6">
                            {!results ? (
                                <Button
                                    onClick={checkAnswers}
                                    disabled={isChecking || Object.keys(userAnswers).length !== paper.paper.questions.length}
                                    className="w-full sm:w-auto"
                                >
                                    {isChecking ? (
                                        <><Loader className="mr-2 h-4 w-4 animate-spin" />Checking...</>
                                    ) : 'Submit & Check Answers'}
                                </Button>
                            ) : (
                                <>
                                    <div className="flex-1 rounded-xl bg-primary/10 p-4 text-center text-lg font-bold text-primary">
                                        Score: {score} / {totalQuestions}
                                    </div>
                                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                                        <Button onClick={downloadResultsPdf} className="w-full sm:w-auto">
                                            <FileDown className="mr-2 h-4 w-4" />
                                            Download Results
                                        </Button>
                                        {driveConnected && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="w-full gap-1.5 sm:w-auto"
                                                disabled={savingResultsPdfToDrive}
                                                onClick={() => void saveResultsPdfToDrive()}
                                            >
                                                {savingResultsPdfToDrive ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                                Save to Drive
                                            </Button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
