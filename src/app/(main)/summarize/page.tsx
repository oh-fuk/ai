

'use client';

import { useState, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader, UploadCloud, FileDown, BookText, X, File, Image as ImageIcon, HardDrive, Upload } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { summarizeText } from '@/ai/flows/summarize-text-from-pdf';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/app/page-header';
import { AnimatePresence, motion } from 'framer-motion';
import { AiLoadingScreen } from '@/components/app/ai-loading';
import { extractTextFromImage } from '@/ai/flows/extract-text-from-image';
import { useRouter } from 'next/navigation';
import { useDrive } from '@/hooks/use-drive';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const formSchema = z.object({
    subject: z.string().min(1, 'Please select a subject.'),
    text: z.string().optional(),
    file: z.any().optional(),
    specificTopic: z.string().optional(),
    pageRange: z.string().optional(),
}).refine(data => data.text || (data.file && data.file.length > 0), {
    message: 'Please either paste text or upload a file to summarize.',
    path: ['text'], // Point error to the text field, but it covers both
}).refine(data => {
    if (data.file && data.file[0]) {
        return data.file[0].size <= MAX_FILE_SIZE;
    }
    return true;
}, {
    message: `File size must be less than 50MB.`,
    path: ['file'],
});

type SummarizeFormValues = z.infer<typeof formSchema>;

interface SummaryResult {
    summary: string;
    progress: string;
}

interface Subject {
    id: string;
    name: string;
}

export default function SummarizePage() {
    const [isLoading, setIsLoading] = useState(false);
    const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null);
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const [summarySource, setSummarySource] = useState('');
    const router = useRouter();
    const { connected: driveConnected, openPicker, downloadFile, uploadFile } = useDrive();
    const [savingToDrive, setSavingToDrive] = useState(false);


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

    const form = useForm<SummarizeFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            text: '',
            specificTopic: '',
            pageRange: '',
            subject: '',
        },
    });

    const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });

    const onSubmit = async (data: SummarizeFormValues) => {
        setIsLoading(true);
        setSummaryResult(null);
        setSummarySource('');

        let textForSummary = data.text || '';
        let pdfDataUri: string | undefined;

        try {
            let sourceType: 'PDF' | 'Text' | 'Image' = 'Text';
            let sourceContent = data.text || '';

            if (data.file && data.file[0]) {
                const file = data.file[0];
                const fileDataUri = await toBase64(file);

                if (file.type.startsWith('image/')) {
                    sourceType = 'Image';
                    sourceContent = file.name;
                    setSummarySource(`from your uploaded image, "${file.name}"`);
                    const imageTextResult = await extractTextFromImage({ imageDataUri: fileDataUri, subject: data.subject });
                    if (!imageTextResult.isRelated || !imageTextResult.extractedText) {
                        toast({ variant: 'destructive', title: 'Image Analysis Failed', description: imageTextResult.reasoning || 'Could not extract relevant text from image.' });
                        setIsLoading(false);
                        return;
                    }
                    textForSummary = imageTextResult.extractedText;
                } else if (file.type === 'application/pdf') {
                    sourceType = 'PDF';
                    sourceContent = file.name;
                    pdfDataUri = fileDataUri;
                    setSummarySource(`from your uploaded PDF, "${file.name}"`);
                } else {
                    toast({ variant: 'destructive', title: 'Unsupported File Type', description: 'Please upload a PDF or an image file.' });
                    setIsLoading(false);
                    return;
                }
            } else {
                setSummarySource("from the text you provided");
            }

            const result = await summarizeText({
                text: textForSummary ? `Subject: ${data.subject}\n\n${textForSummary}` : undefined,
                pdfDataUri: pdfDataUri,
                specificTopic: data.specificTopic,
                pageRange: data.pageRange,
            });

            if (user) {
                const summariesRef = collection(firestore, 'users', user.uid, 'summaries');
                const summaryData = {
                    userId: user.uid,
                    sourceType,
                    sourceContent,
                    summaryText: result.summary,
                    createdAt: serverTimestamp(),
                    subject: data.subject,
                };
                addDocumentNonBlocking(summariesRef, summaryData);
            }

            setSummaryResult(result);

        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error Generating Summary',
                description: 'There was a problem generating the summary. Please check the console and try again.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const downloadPdf = () => {
        if (!summaryResult) return;

        const doc = new jsPDF();
        const { subject } = form.getValues();
        const source = form.watch('file')?.[0]?.name || 'Text Input';
        const reportTitle = `AI Summary for ${subject}`;

        const addHeaderFooter = (docInstance: jsPDF) => {
            const pageCount = (docInstance.internal as any).getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                docInstance.setPage(i);
                const pageHeight = docInstance.internal.pageSize.height;
                const pageWidth = docInstance.internal.pageSize.width;
                const margin = 20;

                docInstance.setFontSize(18);
                docInstance.setFont('helvetica', 'bold');
                docInstance.text('AthenaAI', margin, 20);

                docInstance.setFontSize(12);
                docInstance.setFont('helvetica', 'normal');
                docInstance.text(userProfile?.collegeName || '', pageWidth - margin, 20, { align: 'right' });

                docInstance.setLineWidth(0.5);
                docInstance.line(margin, 25, pageWidth - margin, 25);

                docInstance.setFontSize(14);
                docInstance.text(reportTitle, pageWidth / 2, 35, { align: 'center' });

                docInstance.setFontSize(11);
                docInstance.text(`Student: ${userProfile?.fullName || 'Student'}`, margin, 45);
                docInstance.text(`Source: ${source}`, pageWidth - margin, 45, { align: 'right' });

                docInstance.setFontSize(10);
                docInstance.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
            }
        };

        (doc as any).autoTable({
            head: [['Summary']],
            body: [[summaryResult.summary]],
            startY: 55,
            theme: 'striped',
            headStyles: {
                fontSize: 14,
                fontStyle: 'bold',
                fillColor: [63, 81, 181],
                textColor: [255, 255, 255]
            },
            didDrawPage: (data: any) => addHeaderFooter(doc),
            margin: { top: 55, bottom: 20, left: 20, right: 20 },
        });

        doc.save('summary.pdf');
    };

    const watchedFile = form.watch('file');

    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                title="AI Summarizer"
                description="Get AI-powered summaries of your text or documents."
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <Card className="lg:sticky lg:top-24">
                    <CardHeader>
                        <CardTitle>
                            Provide Your Content
                        </CardTitle>
                        <CardDescription className="flex items-center justify-between">
                            <span>Paste text or upload a file to get started.</span>
                            {driveConnected && (
                                <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs"
                                    onClick={() => openPicker(async (driveFile) => {
                                        try {
                                            const dataUri = await downloadFile(driveFile.id, driveFile.mimeType);
                                            const res = await fetch(dataUri);
                                            const blob = await res.blob();
                                            // Use globalThis to avoid TS DOM type issues in server build
                                            const FileConstructor = (globalThis as any).File as typeof File;
                                            const DataTransferConstructor = (globalThis as any).DataTransfer as typeof DataTransfer;
                                            const f = new FileConstructor([blob], driveFile.name, { type: blob.type });
                                            const dt = new DataTransferConstructor();
                                            dt.items.add(f);
                                            form.setValue('file', dt.files);
                                            setSummarySource(`from Drive: "${driveFile.name}"`);
                                            toast({ title: `Imported: ${driveFile.name}` });
                                        } catch (e: any) {
                                            toast({ variant: 'destructive', title: 'Import failed', description: e.message });
                                        }
                                    })}
                                >
                                    <HardDrive className="h-3.5 w-3.5" /> Import from Drive
                                </Button>
                            )}
                        </CardDescription>
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
                                            <FormLabel>Text to Summarize</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder="Paste your text here..." {...field} rows={8} />
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
                                                <div className="relative flex items-center gap-4">
                                                    <Label
                                                        htmlFor="file-upload"
                                                        className="flex flex-col flex-1 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-primary/50 p-6 text-center text-muted-foreground transition hover:border-primary hover:bg-primary/5"
                                                    >
                                                        <UploadCloud className="mx-auto mb-2 h-8 w-8" />
                                                        <span className='flex items-center gap-2'> <File className='h-4 w-4' /> / <ImageIcon className='h-4 w-4' /></span>
                                                        {watchedFile?.[0]?.name || 'Click or drag to upload file'}
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

                                <Button type="submit" disabled={isLoading} className="w-full">
                                    {isLoading ? (
                                        <>
                                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                                            Summarizing...
                                        </>
                                    ) : (
                                        'Summarize'
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
                                <AiLoadingScreen variant="summarize" title="Summarizing your content..." />
                            </motion.div>
                        )}

                        {summaryResult && !isLoading && (
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
                                                AI-Generated Summary
                                            </CardTitle>
                                            <CardDescription>Summary {summarySource}.</CardDescription>
                                        </div>
                                        <Button onClick={downloadPdf} variant="outline" size="sm" className="w-full sm:w-auto">
                                            <FileDown className="mr-2 h-4 w-4" />
                                            Download PDF
                                        </Button>
                                        {driveConnected && (
                                            <Button variant="outline" size="sm" className="w-full sm:w-auto gap-1.5"
                                                disabled={savingToDrive}
                                                onClick={async () => {
                                                    setSavingToDrive(true);
                                                    try {
                                                        const blob = new Blob([summaryResult!.summary], { type: 'text/plain' });
                                                        await uploadFile(blob, `Summary - ${form.getValues('subject')}.txt`, 'text/plain');
                                                        toast({ title: '✅ Saved to Google Drive!' });
                                                    } catch (e: any) {
                                                        toast({ variant: 'destructive', title: 'Save failed', description: e.message });
                                                    } finally { setSavingToDrive(false); }
                                                }}
                                            >
                                                {savingToDrive ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                                Save to Drive
                                            </Button>
                                        )}
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="prose prose-sm dark:prose-invert max-w-none rounded-md border bg-muted/20 p-4 leading-relaxed text-foreground">
                                            <p>{summaryResult.summary}</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground">{summaryResult.progress}</p>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {!summaryResult && !isLoading && (
                        <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg h-full">
                            <div className="p-4 bg-primary/10 rounded-full mb-4">
                                <BookText className="h-10 w-10 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground">Your summary will appear here</h3>
                            <p className="text-muted-foreground mt-1">Fill out the form to the left to get started.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

