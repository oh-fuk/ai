

'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader, UploadCloud, FileDown, CheckCircle, XCircle, X, Sparkles, File, Image as ImageIcon, Upload } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { AiLoadingScreen } from '@/components/app/ai-loading';
import { DriveImportButton } from '@/components/app/drive-import-button';
import PageHeader from '@/components/app/page-header';
import { useDrive } from '@/hooks/use-drive';
import { getFormFileDisplayName, hasFormFileValue, isDriveImportFormValue, isPdfLikeMime } from '@/lib/drive-form-file';
import { Confetti } from '@/components/app/confetti';
import { DifficultyPredictor } from '@/components/app/difficulty-predictor';
import { generateQuizFromPdf } from '@/ai/flows/generate-quiz-from-pdf';
import { generateQuizFromTopic } from '@/ai/flows/generate-quiz-from-topic';
import { generateRemedialQuiz } from '@/ai/flows/generate-remedial-quiz';
import { checkBulkQuizAnswers, AnswerResult } from '@/ai/flows/check-bulk-quiz-answers';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, query, updateDoc } from 'firebase/firestore';
import { extractTextFromImage } from '@/ai/flows/extract-text-from-image';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Quiz question flip card ───────────────────────────────────────────── */
function QuizFlipCard({
  question, index, userAnswer, result, onAnswerChange, disabled,
}: {
  question: QuizQuestion;
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
      className="relative min-h-[160px] cursor-pointer"
      style={{ perspective: '1000px' }}
      onClick={() => result && setFlipped(f => !f)}
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.45, ease: 'easeInOut' }}
        style={{ transformStyle: 'preserve-3d' }}
        className="relative w-full"
      >
        {/* Front */}
        <div
          className="w-full rounded-xl border bg-card p-5 space-y-3"
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
          {result && (
            <p className="pl-10 text-xs text-muted-foreground flex items-center gap-1">
              {isCorrect
                ? <><CheckCircle className="h-3.5 w-3.5 text-green-500" /> Correct!</>
                : <><XCircle className="h-3.5 w-3.5 text-red-500" /> Incorrect — tap to see explanation</>
              }
            </p>
          )}
        </div>

        {/* Back */}
        {result && (
          <div
            className={`absolute inset-0 rounded-xl p-5 space-y-3
              ${isCorrect
                ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'}`}
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <div className="flex items-center gap-2">
              {isCorrect
                ? <CheckCircle className="h-5 w-5 text-green-600" />
                : <XCircle className="h-5 w-5 text-red-600" />}
              <span className={`font-semibold text-sm ${isCorrect ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                {isCorrect ? 'Correct!' : `Answer: ${question.correctAnswer}`}
              </span>
            </div>
            {result.explanation && (
              <p className="text-xs text-muted-foreground leading-relaxed">{result.explanation}</p>
            )}
            <p className="text-xs text-muted-foreground/50">← Tap to go back</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}


const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const formSchema = z.object({
  subject: z.string().min(1, 'Please select a subject.'),
  file: z.any().optional(),
  numberOfQuestions: z.string().min(1, 'Please select the number of questions.'),
  topic: z.string().optional(),
  specificTopic: z.string().optional(),
  pageRange: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
}).refine(data => {
  if (hasFormFileValue(data.file)) {
    return true; // Topic is optional if a file is uploaded
  }
  return data.topic && data.topic.length >= 3;
}, {
  message: `A topic of at least 3 characters is required if no file is uploaded.`,
  path: ['topic'],
}).refine(data => {
  if (data.file && data.file[0]) {
    return data.file[0].size <= MAX_FILE_SIZE;
  }
  if (isDriveImportFormValue(data.file)) return true;
  return true;
}, {
  message: `File size must be less than 50MB.`,
  path: ['file'],
});

type QuizFormValues = z.infer<typeof formSchema>;

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
}

interface Quiz {
  quiz: string;
  progress: string;
  questions: QuizQuestion[];
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
  } | null;
}


export default function QuizPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [results, setResults] = useState<AnswerResult[] | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [finalScorePct, setFinalScorePct] = useState(0);
  const [savingQuizPdfToDrive, setSavingQuizPdfToDrive] = useState(false);
  const { connected: driveConnected, uploadFile, downloadFile } = useDrive();
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  // Read URLSearchParams on client inside effects to avoid SSR issues
  // const searchParams = useSearchParams();

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


  const form = useForm<QuizFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      numberOfQuestions: '5',
      topic: '',
      specificTopic: '',
      pageRange: '',
      difficulty: 'medium',
      subject: '',
    },
  });

  const handleGenerateRemedialQuiz = async () => {
    setIsAnalyzing(true);
    resetState();

    if (!quizAttempts || quizAttempts.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Not Enough Data',
        description: 'You need to complete some quizzes before the AI can analyze your performance.',
      });
      setIsAnalyzing(false);
      return;
    }

    try {
      const history = quizAttempts
        .filter(qa => qa.attemptedAt) // Filter out attempts without a timestamp
        .map(qa => ({
          quizName: qa.quizName,
          subject: qa.subjectId,
          score: `${qa.score}/${qa.totalQuestions}`,
          percentage: (qa.score / qa.totalQuestions) * 100,
          date: new Date(qa.attemptedAt!.seconds * 1000).toLocaleDateString(),
        }));

      if (history.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Not Enough Data',
          description: 'No valid quiz history found to analyze for improvement.',
        });
        setIsAnalyzing(false);
        return;
      }

      const result = await generateRemedialQuiz({
        quizHistory: JSON.stringify(history, null, 2),
        numberOfQuestions: 10,
      });

      const parsedQuiz = JSON.parse(result.quiz);

      form.setValue('topic', result.topic);
      form.setValue('numberOfQuestions', String(parsedQuiz.questions.length));

      setQuiz({
        ...result,
        questions: parsedQuiz.questions,
      });

      toast({
        title: "Personalized Quiz Generated!",
        description: `This quiz focuses on "${result.topic}" based on your performance.`,
      });

    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error Analyzing Performance',
        description: 'Could not generate a personalized quiz at this time. Please try again.',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    let isImprove = false;
    let topic: string | null = null;
    let subject: string | null = null;
    let totalQuestions: string | null = null;
    try {
      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
      isImprove = params.get('improve') === 'true';
      topic = params.get('topic');
      subject = params.get('subject');
      totalQuestions = params.get('totalQuestions');
    } catch (e) {
      // noop
    }

    const runAutoGeneration = async () => {
      if (isImprove && topic && subject && totalQuestions) {
        setIsLoading(true);
        resetState();
        form.setValue('topic', topic);
        form.setValue('subject', subject);
        form.setValue('numberOfQuestions', totalQuestions);

        try {
          const quizData = await generateQuizFromTopic({
            numberOfQuestions: parseInt(totalQuestions, 10),
            topic: topic,
            difficulty: form.getValues('difficulty') || 'medium',
          });
          const parsedQuiz = JSON.parse(quizData.quiz);
          setQuiz({ ...quizData, questions: parsedQuiz.questions });
          toast({ title: `New Quiz Generated!`, description: `Here's a new quiz on "${topic}" to help you improve.` });
        } catch (error) {
          console.error(error);
          toast({
            variant: 'destructive',
            title: 'Error Auto-Generating Quiz',
            description: 'Could not automatically generate the quiz. Please try again manually.',
          });
        } finally {
          setIsLoading(false);
        }
      }
    };

    runAutoGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, firestore]);

  const resetState = () => {
    setQuiz(null);
    setUserAnswers({});
    setResults(null);
  };

  const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });

  const onSubmit = async (data: QuizFormValues) => {
    setIsLoading(true);
    resetState();

    try {
      let quizData;
      const topic = data.topic || "the uploaded content";
      if (hasFormFileValue(data.file)) {
        let fileType: string;
        let fileDataUri: string;
        if (isDriveImportFormValue(data.file)) {
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

        if (!fileDataUri) {
          toast({ variant: 'destructive', title: 'Invalid file', description: 'Could not read the selected file.' });
          setIsLoading(false);
          return;
        }
        if (fileType.startsWith('image/')) {
          const imageTextResult = await extractTextFromImage({ imageDataUri: fileDataUri, subject: data.subject });
          if (!imageTextResult.isRelated || !imageTextResult.extractedText) {
            toast({ variant: 'destructive', title: 'Image Analysis Failed', description: imageTextResult.reasoning || 'Could not extract relevant text from image.' });
            setIsLoading(false);
            return;
          }
          quizData = await generateQuizFromTopic({
            numberOfQuestions: parseInt(data.numberOfQuestions, 10),
            topic: `A quiz on ${topic} based on the following text: ${imageTextResult.extractedText}`,
            difficulty: data.difficulty,
          });
        } else if (isPdfLikeMime(fileType)) {
          quizData = await generateQuizFromPdf({
            pdfDataUri: fileDataUri,
            numberOfQuestions: parseInt(data.numberOfQuestions, 10),
            topic: topic,
            specificTopic: data.specificTopic,
            pageRange: data.pageRange,
            difficulty: data.difficulty,
          });
        } else {
          toast({ variant: 'destructive', title: 'Unsupported File Type', description: 'Please upload a PDF or an image file.' });
          setIsLoading(false);
          return;
        }
      } else {
        quizData = await generateQuizFromTopic({
          numberOfQuestions: parseInt(data.numberOfQuestions, 10),
          topic: topic,
          difficulty: data.difficulty,
        });
      }

      const parsedQuiz = JSON.parse(quizData.quiz);

      setQuiz({
        ...quizData,
        questions: parsedQuiz.questions,
      });

    } catch (error) {
      console.error('Quiz generation error:', error);
      const errorMessage = error instanceof Error
        ? error.message
        : 'There was a problem generating the quiz. Please check the console for details and try again.';

      const isNetworkError = errorMessage.includes('fetch failed') || errorMessage.includes('API request failed');

      toast({
        variant: 'destructive',
        title: isNetworkError ? 'API Connection Error' : 'Error Generating Quiz',
        description: isNetworkError
          ? 'Failed to connect to the AI service. Please check your internet connection and API configuration, then try again.'
          : errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerChange = (questionIndex: number, answer: string) => {
    setUserAnswers((prev) => ({ ...prev, [questionIndex]: answer }));
  };

  const checkAnswers = async () => {
    if (!quiz || !user || !firestore) return;
    setIsChecking(true);

    const answersToSubmit = quiz.questions.map((q, i) => ({
      question: q.question,
      studentAnswer: userAnswers[i] || 'No answer provided',
      correctAnswer: q.correctAnswer
    }));

    try {
      const checkResult = await checkBulkQuizAnswers({ answers: answersToSubmit });
      const newResults = checkResult.results;

      const score = newResults.filter(r => r.isCorrect).length;

      let quizIdToUpdate: string | null = null;
      let isImproving = false;
      try {
        const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        quizIdToUpdate = params.get('quizId');
        isImproving = params.get('improve') === 'true' && !!quizIdToUpdate;
      } catch (e) {
        // noop
      }

      const dataToSave = {
        userId: user.uid,
        quizName: form.getValues('topic') || `Quiz from file on ${new Date().toLocaleDateString()}`,
        score: score,
        totalQuestions: quiz.questions.length,
        attemptedAt: serverTimestamp(),
        subjectId: form.getValues('subject'),
      };

      if (isImproving && quizIdToUpdate) {
        const attemptRef = doc(firestore, 'users', user.uid, 'quizAttempts', quizIdToUpdate);
        updateDocumentNonBlocking(attemptRef, dataToSave);
      } else {
        const quizAttemptsRef = collection(firestore, 'users', user.uid, 'quizAttempts');
        addDocumentNonBlocking(quizAttemptsRef, dataToSave);
      }

      setResults(newResults);
      const pct = (score / quiz.questions.length) * 100;
      setFinalScorePct(pct);
      setShowConfetti(true);
      toast({
        title: isImproving ? "Quiz Updated!" : "Quiz Submitted!",
        description: "Your results have been saved to your progress."
      });

    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error Checking Answers',
        description: 'There was a problem checking the answers. Please try again.',
      });
    } finally {
      setIsChecking(false);
    }
  };

  const buildQuizResultsPdfDoc = (): jsPDF => {
    if (!quiz || !results) throw new Error('No quiz or results');

    const doc = new jsPDF();
    const { topic, subject } = form.getValues();
    const finalScore = results.filter(r => r.isCorrect).length;
    const total = quiz.questions.length;
    const reportTitle = `Quiz Results: ${subject} - ${topic || 'File-based Quiz'}`;

    const addHeaderFooter = (data: any) => {
      const pageNum = data.pageNumber;
      const totalPages = (doc as any).internal.getNumberOfPages();
      const pageWidth = doc.internal.pageSize.width;
      const margin = data.settings.margin;
      // Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('AthenaAI', margin.left, 20);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(userProfile?.collegeName || '', pageWidth - margin.right, 20, { align: 'right' });
      doc.setLineWidth(0.5);
      doc.line(margin.left, 25, pageWidth - margin.right, 25);
      doc.setFontSize(14);
      doc.text(reportTitle, pageWidth / 2, 35, { align: 'center' });
      doc.setFontSize(11);
      doc.text(`Student: ${userProfile?.fullName || 'Student'}`, margin.left, 45);
      doc.setFont('helvetica', 'bold');
      doc.text(`Final Score: ${finalScore} / ${total}`, pageWidth - margin.right, 45, { align: 'right' });
      // Footer
      doc.setFontSize(10);
      const pageHeight = doc.internal.pageSize.height;
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    };

    let startY = 55;
    quiz.questions.forEach((q, i) => {
      const result = results[i];
      const userAnswer = userAnswers[i] || 'No answer';
      const isCorrect = result?.isCorrect;

      let explanationContent = `Your Answer: ${userAnswer}\nCorrect Answer: ${q.correctAnswer}`;
      if (!isCorrect && result?.explanation) {
        explanationContent += `\n\nExplanation: ${result.explanation}`;
      }

      const tableHeight = (doc as any).autoTable.previous.finalY || 0;
      if (i > 0 && startY + 40 > doc.internal.pageSize.height - 20) { // Rough check for space
        doc.addPage();
        startY = 55;
      }

      (doc as any).autoTable({
        head: [[`Question ${i + 1}: ${q.question}`]],
        body: [[explanationContent]],
        startY: startY,
        theme: 'grid',
        headStyles: { fillColor: isCorrect ? [212, 237, 218] : [248, 215, 218], textColor: isCorrect ? [21, 87, 36] : [114, 28, 36], fontStyle: 'bold' },
        bodyStyles: { fontSize: 10, cellPadding: 3 },
        didDrawPage: addHeaderFooter,
        margin: { top: 55, bottom: 20, left: 20, right: 20 },
      });
      startY = (doc as any).autoTable.previous.finalY + 10;
    });

    return doc;
  };

  const downloadPdf = () => {
    if (!quiz || !results) return;
    buildQuizResultsPdfDoc().save('quiz-results.pdf');
  };

  const saveQuizResultsPdfToDrive = async () => {
    if (!quiz || !results || !driveConnected) return;
    setSavingQuizPdfToDrive(true);
    try {
      const doc = buildQuizResultsPdfDoc();
      const blob = doc.output('blob');
      const { subject, topic } = form.getValues();
      const safe = (s: string) => s.replace(/[/\\?%*:|"<>]/g, '-').slice(0, 60);
      await uploadFile(blob, `Quiz results - ${safe(subject)} - ${safe(topic || 'quiz')}.pdf`, 'application/pdf');
      toast({ title: 'Saved to Google Drive!' });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Save failed';
      toast({ variant: 'destructive', title: 'Save failed', description: message });
    } finally {
      setSavingQuizPdfToDrive(false);
    }
  };

  const score = results ? results.filter(r => r.isCorrect).length : 0;
  const totalQuestions = quiz?.questions.length ?? 0;
  const watchedFile = form.watch('file');

  if (isLoading) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="Quiz Generator" description="Create custom quizzes from your study materials to test your knowledge." />
        <AiLoadingScreen variant="quiz" title="Generating your quiz..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Confetti trigger={showConfetti} score={finalScorePct} />
      <PageHeader
        title="Quiz Generator"
        description="Create custom quizzes from your study materials to test your knowledge."
      />

      {!quiz && (
        <>
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <Sparkles className="text-primary" />
                AI-Powered Remedial Quiz
              </CardTitle>
              <CardDescription>
                Let the AI analyze your quiz history to find your weak spots and automatically generate a personalized quiz to help you improve.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleGenerateRemedialQuiz} disabled={isAnalyzing || isLoading || attemptsLoading}>
                {isAnalyzing ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing Your Progress...
                  </>
                ) : (
                  'Analyze & Generate Quiz'
                )}
              </Button>
              {attemptsLoading && <p className="text-xs text-muted-foreground mt-2">Loading your history...</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Generate a New Quiz</CardTitle>
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
                          <FormLabel>Quiz Topic (Optional with file)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Photosynthesis" {...field} />
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
                              render={({ field: { onChange } }) => (
                                <Input
                                  id="file-upload"
                                  type="file"
                                  accept=".pdf,image/*"
                                  className="sr-only"
                                  onChange={(e) => onChange(e.target.files)}
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

                  <FormField
                    control={form.control}
                    name="numberOfQuestions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Questions</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select number of questions" />
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
                    name="difficulty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Difficulty</FormLabel>
                        <DifficultyPredictor
                          quizAttempts={quizAttempts}
                          selectedSubject={form.watch('subject')}
                          onSuggest={(d) => form.setValue('difficulty', d)}
                        />
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select difficulty" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <LoadingButton type="submit" loading={isLoading} loadingText="Generating Quiz..." className="w-full sm:w-auto">
                    Generate Quiz
                  </LoadingButton>
                </form>
              </Form>
            </CardContent>
          </Card>
        </>
      )}


      {quiz && (
        <Card>
          <CardHeader>
            <CardTitle>Your Quiz on "{form.getValues('topic') || 'the uploaded content'}"</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AnimatePresence>
              {quiz.questions.map((q, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.07 }}
                >
                  <QuizFlipCard
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
                <Button onClick={checkAnswers} disabled={isChecking || Object.keys(userAnswers).length !== quiz.questions.length} className="w-full sm:w-auto">
                  {isChecking ? <><Loader className="mr-2 h-4 w-4 animate-spin" />Checking...</> : 'Submit Answers'}
                </Button>
              ) : (
                <>
                  <div className="flex-1 rounded-xl bg-primary/10 p-4 text-center text-lg font-bold text-primary">
                    Score: {score} / {totalQuestions}
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <Button onClick={downloadPdf} variant="outline" className="w-full sm:w-auto">
                      <FileDown className="mr-2 h-4 w-4" />Download Results
                    </Button>
                    {driveConnected && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-1.5 sm:w-auto"
                        disabled={savingQuizPdfToDrive}
                        onClick={() => void saveQuizResultsPdfToDrive()}
                      >
                        {savingQuizPdfToDrive ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
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

