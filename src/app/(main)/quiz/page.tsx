

'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader, UploadCloud, FileDown, CheckCircle, XCircle, X, Sparkles, File, Image as ImageIcon } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import PageHeader from '@/components/app/page-header';
import { generateQuizFromPdf } from '@/ai/flows/generate-quiz-from-pdf';
import { generateQuizFromTopic } from '@/ai/flows/generate-quiz-from-topic';
import { generateRemedialQuiz } from '@/ai/flows/generate-remedial-quiz';
import { checkBulkQuizAnswers, AnswerResult } from '@/ai/flows/check-bulk-quiz-answers';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, query, updateDoc } from 'firebase/firestore';
// Avoid next/navigation useSearchParams (can require Suspense during prerender).
import { extractTextFromImage } from '@/ai/flows/extract-text-from-image';


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
  if (data.file && data.file[0]) {
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
      if (data.file && data.file[0]) {
        const file = data.file[0];
        if (file.type.startsWith('image/')) {
          const imageDataUri = await toBase64(file);
          const imageTextResult = await extractTextFromImage({ imageDataUri, subject: data.subject });
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
        } else if (file.type === 'application/pdf') {
          const pdfDataUri = await toBase64(file);
          quizData = await generateQuizFromPdf({
            pdfDataUri,
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

  const downloadPdf = () => {
    if (!quiz || !results) return;

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

    doc.save('quiz-results.pdf');
  };

  const score = results ? results.filter(r => r.isCorrect).length : 0;
  const totalQuestions = quiz?.questions.length ?? 0;
  const watchedFile = form.watch('file');

  if (isLoading) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Quiz Generator"
          description="Create custom quizzes from your study materials to test your knowledge."
        />
        <Card>
          <CardHeader>
            <CardTitle>Generating Quiz...</CardTitle>
            <CardDescription>The AI is crafting your questions. Please wait a moment.</CardDescription>
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
                              {watchedFile?.[0]?.name || 'Click or drag to upload PDF/Image'}
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
          <CardContent className="space-y-8">
            {quiz.questions.map((q, i) => (
              <div key={q.question} className="space-y-4">
                <p className="font-semibold">{i + 1}. {q.question}</p>
                <RadioGroup onValueChange={(value) => handleAnswerChange(i, value)} value={userAnswers[i]}>
                  {q.options.map((option, j) => (
                    <div key={option} className="flex items-center space-x-2">
                      <RadioGroupItem value={option} id={`q${i}o${j}`} disabled={!!results} />
                      <Label htmlFor={`q${i}o${j}`} className="font-normal">{option}</Label>
                    </div>
                  ))}
                </RadioGroup>
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
                          Incorrect. The correct answer is: {q.correctAnswer}
                        </div>
                        <p><strong>Explanation:</strong> {results[i].explanation}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              {!results ? (
                <Button onClick={checkAnswers} disabled={isChecking || Object.keys(userAnswers).length !== quiz.questions.length} className="w-full sm:w-auto">
                  {isChecking ? (
                    <>
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : 'Check Answers'}
                </Button>
              ) : (
                <>
                  <div className="flex-1 rounded-md bg-primary/10 p-4 text-center text-lg font-bold text-primary">
                    Your Score: {score} / {totalQuestions}
                  </div>
                  <Button onClick={downloadPdf} className="w-full sm:w-auto">
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

