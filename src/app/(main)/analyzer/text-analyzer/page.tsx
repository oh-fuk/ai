

'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader, UploadCloud, FileDown, BookText, X, File, Image as ImageIcon, Pilcrow, CaseSensitive, Clock, Milestone } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import PageHeader from '@/components/app/page-header';
import { AnimatePresence, motion } from 'framer-motion';
import { extractTextFromPdf } from '@/ai/flows/extract-text-from-pdf';
import { extractTextFromImage } from '@/ai/flows/extract-text-from-image';
import { explainMainKeywords, KeywordExplanation } from '@/ai/flows/explain-main-keywords';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';


const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const formSchema = z.object({
    text: z.string().optional(),
    file: z.any().optional(),
    subject: z.string().min(1, 'Please select a subject.'),
}).refine(data => data.text || (data.file && data.file.length > 0), {
    message: 'Please either paste text or upload a file to analyze.',
    path: ['text'],
}).refine(data => {
    if (data.file && data.file[0]) {
        return data.file[0].size <= MAX_FILE_SIZE;
    }
    return true;
}, {
    message: `File size must be less than 50MB.`,
    path: ['file'],
});

type TextAnalyzerFormValues = z.infer<typeof formSchema>;

interface AnalysisResult {
    wordCount: number;
    characterCount: number;
    readingTime: number; // in minutes
}

interface Subject {
    id: string;
    name: string;
}

export default function TextAnalyzerPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [analyzedText, setAnalyzedText] = useState<string>('');
    const [termExplanations, setTermExplanations] = useState<KeywordExplanation[] | null>(null);
    const [isExplainingTerms, setIsExplainingTerms] = useState(false);
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();

    const subjectsQuery = useMemoFirebase(
        () => (user && firestore ? collection(firestore, 'users', user.uid, 'subjects') : null),
        [user, firestore]
    );
    const { data: subjects, isLoading: subjectsLoading } = useCollection<Subject>(subjectsQuery);

    const userDocRef = useMemoFirebase(
        () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
        [user, firestore]
    );
    const { data: userProfile } = useDoc(userDocRef);

    const form = useForm<TextAnalyzerFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            text: '',
            subject: '',
        },
    });

    const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });

    const resetOutputs = () => {
        setAnalysisResult(null);
        setTermExplanations(null);
        setAnalyzedText('');
    }

    const performAnalysis = (text: string) => {
        const words = text.trim().split(/\s+/).filter(Boolean);
        const wordCount = words.length;
        const characterCount = text.length;
        const readingTime = Math.ceil(wordCount / 200); // Average reading speed of 200 WPM

        setAnalysisResult({
            wordCount,
            characterCount,
            readingTime,
        });
        setAnalyzedText(text);
    };

    const onSubmit = async (data: TextAnalyzerFormValues) => {
        setIsLoading(true);
        resetOutputs();

        let textToAnalyze = data.text || '';

        try {
            if (data.file && data.file[0]) {
                const file = data.file[0];
                const fileDataUri = await toBase64(file);

                if (file.type.startsWith('image/')) {
                    const result = await extractTextFromImage({ imageDataUri: fileDataUri, subject: 'general' });
                    if (!result.extractedText) {
                        toast({ variant: 'destructive', title: 'Extraction Failed', description: result.reasoning || 'Could not extract text from the image.' });
                        setIsLoading(false);
                        return;
                    }
                    textToAnalyze = result.extractedText;
                } else if (file.type === 'application/pdf') {
                    const result = await extractTextFromPdf({ pdfDataUri: fileDataUri });
                    textToAnalyze = result.extractedText;
                } else {
                    toast({ variant: 'destructive', title: 'Unsupported File', description: 'Please upload a PDF or image file.' });
                    setIsLoading(false);
                    return;
                }
            }

            if (!textToAnalyze.trim()) {
                toast({ variant: 'destructive', title: 'No Content', description: 'Could not find any text to analyze.' });
                setIsLoading(false);
                return;
            }

            performAnalysis(textToAnalyze);
            toast({ title: 'Analysis Complete!', description: 'Your text statistics are ready.' });

        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error Analyzing Text',
                description: 'There was a problem analyzing your content. Please try again.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleExplainTerms = async () => {
        if (!analyzedText) return;
        setIsExplainingTerms(true);
        setTermExplanations(null);
        try {
            // Dummy keywords for now, a more advanced version could extract them.
            const keywords = analyzedText.split(/\s+/).filter(w => w.length > 5).slice(0, 5);
            const result = await explainMainKeywords({
                text: analyzedText,
                keywords: keywords,
            });
            setTermExplanations(result.explanations);
            toast({ title: 'Keywords Explained!', description: 'The AI has defined the key terms from your text.' });
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error Explaining Terms',
                description: 'There was a problem explaining the terms. Please try again.',
            });
        } finally {
            setIsExplainingTerms(false);
        }
    };

    const downloadPdf = () => {
        if (!analysisResult) return;

        const doc = new jsPDF();
        const source = form.watch('file')?.[0]?.name || 'Text Input';
        const reportTitle = `Text Analysis Report`;
        const margins = { top: 60, bottom: 20, left: 20, right: 20 };

        const addHeaderFooter = (docInstance: jsPDF) => {
            const pageCount = (docInstance.internal as any).getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                docInstance.setPage(i);
                const pageHeight = docInstance.internal.pageSize.height;
                const pageWidth = docInstance.internal.pageSize.width;

                docInstance.setFontSize(18);
                docInstance.setFont('helvetica', 'bold');
                docInstance.text('AthenaAI', margins.left, 20);

                docInstance.setFontSize(12);
                docInstance.setFont('helvetica', 'normal');
                docInstance.text(userProfile?.collegeName || '', pageWidth - margins.right, 20, { align: 'right' });

                docInstance.setLineWidth(0.5);
                docInstance.line(margins.left, 25, pageWidth - margins.right, 25);

                docInstance.setFontSize(14);
                docInstance.text(reportTitle, pageWidth / 2, 35, { align: 'center' });

                docInstance.setFontSize(11);
                docInstance.text(`Student: ${userProfile?.fullName || 'Student'}`, margins.left, 45);
                docInstance.text(`Source: ${source}`, pageWidth - margins.right, 45, { align: 'right' });

                docInstance.setFontSize(10);
                docInstance.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
            }
        };

        (doc as any).autoTable({
            startY: margins.top,
            head: [['Metric', 'Value']],
            body: [
                ['Word Count', analysisResult.wordCount.toLocaleString()],
                ['Character Count', analysisResult.characterCount.toLocaleString()],
                ['Estimated Reading Time', `${analysisResult.readingTime} minute${analysisResult.readingTime === 1 ? '' : 's'}`],
            ],
            theme: 'grid',
            headStyles: { fillColor: [63, 81, 181] },
            didDrawPage: (data: any) => {
                addHeaderFooter(doc);
            },
        });

        if (termExplanations && termExplanations.length > 0) {
            doc.addPage();
            (doc as any).autoTable({
                startY: margins.top,
                head: [['Term', 'Explanation']],
                body: termExplanations.map(t => [t.keyword, t.explanation]),
                theme: 'grid',
                headStyles: { fillColor: [63, 81, 181] },
                didDrawPage: (data: any) => {
                    addHeaderFooter(doc);
                },
            });
        }

        doc.addPage();
        (doc as any).autoTable({
            head: [['Analyzed Text']],
            body: [[analyzedText]],
            startY: margins.top,
            theme: 'striped',
            didDrawPage: (data: any) => {
                addHeaderFooter(doc);
            }
        });

        addHeaderFooter(doc);
        doc.save('text-analysis.pdf');
    };

    const watchedFile = form.watch('file');

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center gap-4">
                <PageHeader
                    title="Text Analyzer"
                    description="Get detailed statistics and keyword explanations for your text."
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <Card className="lg:sticky lg:top-24">
                    <CardHeader>
                        <CardTitle>
                            Provide Your Content
                        </CardTitle>
                        <CardDescription>Paste text or upload a file to get started.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="subject"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Subject</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={subjectsLoading}>
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
                                    name="text"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Text to Analyze</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder="Paste your text here..." {...field} rows={8} disabled={!!watchedFile?.[0]} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="relative flex items-center">
                                    <div className="flex-grow border-t border-muted"></div>
                                    <span className="flex-shrink mx-4 text-muted-foreground">Or</span>
                                    <div className="flex-grow border-t border-muted"></div>
                                </div>

                                <FormField
                                    control={form.control}
                                    name="file"
                                    render={() => (
                                        <FormItem>
                                            <FormLabel>Upload a PDF or Image</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Label
                                                        htmlFor="file-upload"
                                                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer border-primary/50 bg-muted/20 hover:border-primary hover:bg-primary/5"
                                                    >
                                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                            <UploadCloud className="w-8 h-8 mb-2 text-muted-foreground" />
                                                            <p className="mb-1 text-sm text-muted-foreground">
                                                                <span className="font-semibold">Click to upload</span> or drag and drop
                                                            </p>
                                                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                                <File className="h-3 w-3" /> PDF or <ImageIcon className="h-3 w-3" /> Image
                                                            </p>
                                                            {watchedFile?.[0] && <p className='mt-2 text-xs font-bold'>{watchedFile?.[0]?.name}</p>}
                                                        </div>
                                                    </Label>
                                                    <Controller
                                                        name="file"
                                                        control={form.control}
                                                        render={({ field: { onChange } }) => (
                                                            <Input id="file-upload" type="file" accept=".pdf,image/*" className="sr-only"
                                                                onChange={(e) => {
                                                                    onChange(e.target.files)
                                                                    form.resetField('text');
                                                                    resetOutputs();
                                                                }}
                                                            />
                                                        )}
                                                    />
                                                    {watchedFile?.[0] && (
                                                        <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => form.resetField('file')}>
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </FormControl>
                                            <FormMessage>{form.formState.errors.file?.message as React.ReactNode}</FormMessage>
                                        </FormItem>
                                    )}
                                />

                                <Button type="submit" disabled={isLoading} className="w-full">
                                    {isLoading ? (
                                        <>
                                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                                            Analyzing...
                                        </>
                                    ) : (
                                        'Analyze Text'
                                    )}
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                <div className="space-y-8">
                    <AnimatePresence>
                        {isLoading && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                            >
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Analyzing Your Text</CardTitle>
                                        <CardDescription>The AI is processing your content. Please wait.</CardDescription>
                                    </CardHeader>
                                    <CardContent className='flex justify-center items-center py-16'>
                                        <Loader className="h-10 w-10 animate-spin text-primary" />
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {analysisResult && !isLoading && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-8"
                            >
                                <Card>
                                    <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div className='space-y-1.5'>
                                            <CardTitle className='flex items-center gap-2'>
                                                <BookText className='h-6 w-6 text-primary' />
                                                Analysis Results
                                            </CardTitle>
                                        </div>
                                        <Button onClick={downloadPdf} variant="outline" size="sm" className="w-full sm:w-auto">
                                            <FileDown className="mr-2 h-4 w-4" />
                                            Download Report
                                        </Button>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className='flex items-center gap-4 p-4 rounded-lg bg-muted/50'>
                                            <Pilcrow className='h-8 w-8 text-primary' />
                                            <div>
                                                <div className='text-sm text-muted-foreground'>Word Count</div>
                                                <div className='text-2xl font-bold'>{analysisResult.wordCount.toLocaleString()}</div>
                                            </div>
                                        </div>
                                        <div className='flex items-center gap-4 p-4 rounded-lg bg-muted/50'>
                                            <CaseSensitive className='h-8 w-8 text-primary' />
                                            <div>
                                                <div className='text-sm text-muted-foreground'>Character Count</div>
                                                <div className='text-2xl font-bold'>{analysisResult.characterCount.toLocaleString()}</div>
                                            </div>
                                        </div>
                                        <div className='flex items-center gap-4 p-4 rounded-lg bg-muted/50'>
                                            <Clock className='h-8 w-8 text-primary' />
                                            <div>
                                                <div className='text-sm text-muted-foreground'>Reading Time</div>
                                                <div className='text-2xl font-bold'>~{analysisResult.readingTime} min</div>
                                            </div>
                                        </div>
                                    </CardContent>
                                    <CardContent>
                                        <Button onClick={handleExplainTerms} disabled={isExplainingTerms} className="w-full">
                                            {isExplainingTerms ? (
                                                <>
                                                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                                                    Explaining...
                                                </>
                                            ) : (
                                                <>
                                                    <Milestone className="mr-2 h-4 w-4" />
                                                    Explain Key Terms
                                                </>
                                            )}
                                        </Button>
                                    </CardContent>
                                </Card>

                                {isExplainingTerms && (
                                    <Card>
                                        <CardContent className='flex justify-center items-center py-16'>
                                            <Loader className="h-10 w-10 animate-spin text-primary" />
                                        </CardContent>
                                    </Card>
                                )}

                                {termExplanations && termExplanations.length > 0 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <Milestone className="h-6 w-6 text-primary" />
                                                Key Term Explanations
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <Accordion type="single" collapsible className="w-full">
                                                {termExplanations.map((item, index) => (
                                                    <AccordionItem key={index} value={`item-${index}`}>
                                                        <AccordionTrigger>{item.keyword}</AccordionTrigger>
                                                        <AccordionContent>
                                                            <div className="prose prose-sm max-w-none text-card-foreground">
                                                                {item.explanation}
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                ))}
                                            </Accordion>
                                        </CardContent>
                                    </Card>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {!analysisResult && !isLoading && (
                        <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg h-full">
                            <div className="p-4 bg-primary/10 rounded-full mb-4">
                                <BookText className="h-10 w-10 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground">Your analysis will appear here</h3>
                            <p className="text-muted-foreground mt-1">Fill out the form to get started.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

