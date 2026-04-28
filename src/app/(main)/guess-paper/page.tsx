

'use client';

import { useState, useRef, useEffect } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader, UploadCloud, FileDown, File as FileIcon, Image as ImageIcon, X, AlertTriangle, Lightbulb, GraduationCap, TrendingUp, BarChart, Upload } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/app/page-header';
import { AnimatePresence, motion } from 'framer-motion';
import { generateGuessPaper, GuessPaperOutput } from '@/ai/flows/generate-guess-paper';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { AiLoadingScreen } from '@/components/app/ai-loading';
import { DriveImportButton } from '@/components/app/drive-import-button';
import { useDrive } from '@/hooks/use-drive';
import { useApplyQueuedDriveImport } from '@/hooks/use-apply-queued-drive-import';
import { isDriveImportFormValue } from '@/lib/drive-form-file';

const GUESS_PAPER_DRIVE_MIMES = ['application/pdf', 'application/vnd.google-apps.document'];

const fileSlotSchema = z.object({
    file: z.any(),
});

const formSchema = z.object({
    subject: z.string().min(1, 'Please select a subject.'),
    numberOfPapers: z.coerce.number().min(1).max(80),
    files: z.array(fileSlotSchema).min(1, 'Please upload at least one past paper.'),
}).superRefine((data, ctx) => {
    const anyFilled = data.files.some((slot) => {
        const f = slot.file;
        return isDriveImportFormValue(f) || (f instanceof File && f.size > 0);
    });
    if (!anyFilled) {
        ctx.addIssue({
            code: 'custom',
            message: 'Please upload at least one past paper.',
            path: ['files'],
        });
    }
});

type GuessPaperFormValues = z.infer<typeof formSchema>;

interface Subject {
    id: string;
    name: string;
}

export default function GuessPaperPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<GuessPaperOutput | null>(null);
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
    const [savingGuessPdfToDrive, setSavingGuessPdfToDrive] = useState(false);
    const { connected: driveConnected, uploadFile, downloadFile } = useDrive();

    const form = useForm<GuessPaperFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            subject: '',
            numberOfPapers: 1,
            files: [{ file: new File([], "") }],
        },
    });

    useApplyQueuedDriveImport({
        connected: driveConnected,
        downloadFile,
        onApplied: ({ name, mimeType, dataUri }) => {
            form.setValue('files.0.file', {
                __driveImport: true,
                dataUri,
                name,
                type: mimeType,
            } as any);
        },
    });

    const { fields, append, remove, replace } = useFieldArray({
        control: form.control,
        name: "files"
    });

    const numberOfPapers = form.watch('numberOfPapers');

    useEffect(() => {
        const newFields = Array.from({ length: numberOfPapers }, () => ({ file: new File([], "") }));
        replace(newFields);
    }, [numberOfPapers, replace]);


    const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });

    const onSubmit = async (data: GuessPaperFormValues) => {
        setIsLoading(true);
        setResult(null);

        const validFiles = data.files.filter((f) => isDriveImportFormValue(f.file) || (f.file instanceof File && f.file.size > 0));

        if (validFiles.length === 0) {
            toast({
                variant: 'destructive',
                title: 'No Files Uploaded',
                description: 'Please upload at least one past paper to generate a guess paper.',
            });
            setIsLoading(false);
            return;
        }


        try {
            const pastPapersDataUris = await Promise.all(
                validFiles.map((f) =>
                    isDriveImportFormValue(f.file) ? Promise.resolve(f.file.dataUri) : toBase64(f.file as File)
                )
            );

            const response = await generateGuessPaper({
                subject: data.subject,
                pastPapersDataUris: pastPapersDataUris,
            });

            setResult(response);
            toast({ title: 'Guess Paper Generated!', description: 'Your AI-powered guess paper is ready.' });
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error Generating Guess Paper',
                description: 'There was a problem analyzing the papers. Please try again.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const buildGuessPaperPdfDoc = (): jsPDF => {
        if (!result) throw new Error('No result');
        const doc = new jsPDF();
        const { subject } = form.getValues();
        const reportTitle = `Guess Paper for ${subject}`;
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
                docInstance.setFontSize(10);
                docInstance.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
            }
        };

        let finalY = margins.top;

        const addSection = (title: string, body: () => void) => {
            if (finalY > margins.top && finalY + 40 > doc.internal.pageSize.height - margins.bottom) {
                doc.addPage();
                finalY = margins.top;
            }
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text(title, margins.left, finalY);
            finalY += 10;
            body();
        }

        // Analysis Summary Section
        addSection("Analysis Summary", () => {
            (doc as any).autoTable({
                startY: finalY,
                head: [['Analysis']],
                body: [[result.analysis.analysisSummary]],
                theme: 'striped',
                didDrawPage: () => addHeaderFooter(doc),
                margin: margins
            });
            finalY = (doc as any).lastAutoTable.finalY + 15;
        });

        // Predicted Topics Section
        addSection("Predicted Key Topics", () => {
            (doc as any).autoTable({
                startY: finalY,
                head: [['Topic', 'Reasoning']],
                body: result.analysis.predictedTopics.map(t => [t.topic, t.reasoning]),
                theme: 'grid',
                headStyles: { fillColor: [63, 81, 181] },
                didDrawPage: () => addHeaderFooter(doc),
                margin: margins
            });
            finalY = (doc as any).lastAutoTable.finalY + 15;
        });

        // Guess Paper Section
        addSection("Generated Guess Paper", () => {
            (doc as any).autoTable({
                startY: finalY,
                head: [['Question', 'Difficulty']],
                body: result.guessPaper.map(q => [{ content: q.question }, { content: q.difficulty, styles: { halign: 'center' } }]),
                theme: 'grid',
                headStyles: { fillColor: [63, 81, 181] },
                didDrawPage: () => addHeaderFooter(doc),
                margin: margins
            });
            finalY = (doc as any).lastAutoTable.finalY + 15;
        });

        // Tips & Tricks Section
        addSection("Tips and Formulas", () => {
            (doc as any).autoTable({
                startY: finalY,
                body: result.tipsAndFormulas.map(tip => [tip]),
                theme: 'striped',
                didDrawPage: () => addHeaderFooter(doc),
                margin: margins
            });
            finalY = (doc as any).lastAutoTable.finalY + 15;
        });

        // Common Mistakes Section
        addSection("Common Mistakes to Avoid", () => {
            (doc as any).autoTable({
                startY: finalY,
                body: result.commonMistakes.map(mistake => [mistake]),
                theme: 'striped',
                didDrawPage: () => addHeaderFooter(doc),
                margin: margins
            });
        });

        addHeaderFooter(doc);
        return doc;
    };

    const downloadPdf = () => {
        if (!result) return;
        buildGuessPaperPdfDoc().save('guess-paper.pdf');
    };

    const saveGuessPaperPdfToDrive = async () => {
        if (!result || !driveConnected) return;
        setSavingGuessPdfToDrive(true);
        try {
            const doc = buildGuessPaperPdfDoc();
            const blob = doc.output('blob');
            const { subject } = form.getValues();
            const safe = (s: string) => s.replace(/[/\\?%*:|"<>]/g, '-').slice(0, 80);
            await uploadFile(blob, `Guess paper - ${safe(subject || 'subject')}.pdf`, 'application/pdf');
            toast({ title: 'Saved to Google Drive!' });
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Save failed';
            toast({ variant: 'destructive', title: 'Save failed', description: message });
        } finally {
            setSavingGuessPdfToDrive(false);
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center gap-4">
                <PageHeader
                    title="Generate Guess Paper"
                    description="Upload past exam papers and let AI predict your upcoming exam."
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <Card className="lg:sticky lg:top-24">
                    <CardHeader>
                        <CardTitle>Upload Past Papers</CardTitle>
                        <CardDescription>Select a subject and the number of papers, then upload your files.</CardDescription>
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
                                        name="numberOfPapers"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Number of Papers</FormLabel>
                                                <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={String(field.value)}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {Array.from({ length: 80 }, (_, i) => i + 1).map(num => (
                                                            <SelectItem key={num} value={String(num)}>
                                                                {num} Paper{num > 1 ? 's' : ''}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <Label>Past Papers</Label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {fields.map((field, index) => (
                                            <FormField
                                                key={field.id}
                                                control={form.control}
                                                name={`files.${index}.file`}
                                                render={({ field: { onChange, value, ...rest } }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs text-muted-foreground">Paper {index + 1}</FormLabel>
                                                        <FormControl>
                                                            <div className="space-y-2">
                                                                <Input
                                                                    type="file"
                                                                    accept="application/pdf"
                                                                    onChange={(e) => onChange(e.target.files?.[0])}
                                                                    {...rest}
                                                                />
                                                                {(isDriveImportFormValue(value) || (value instanceof File && value.size > 0)) && (
                                                                    <p className="truncate text-xs font-medium text-foreground">
                                                                        {isDriveImportFormValue(value) ? value.name : (value as File).name}
                                                                    </p>
                                                                )}
                                                                <DriveImportButton
                                                                    size="sm"
                                                                    className="w-full"
                                                                    mimeTypes={GUESS_PAPER_DRIVE_MIMES}
                                                                    label="From Drive"
                                                                    onImported={({ dataUri, mimeType, name }) => {
                                                                        onChange({
                                                                            __driveImport: true,
                                                                            dataUri,
                                                                            name,
                                                                            type: mimeType,
                                                                        } as any);
                                                                    }}
                                                                />
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        ))}
                                    </div>
                                    <FormMessage>{form.formState.errors.files?.message}</FormMessage>
                                </div>

                                <Button type="submit" disabled={isLoading} className="w-full">
                                    {isLoading ? (
                                        <>
                                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                                            Analyzing Papers...
                                        </>
                                    ) : (
                                        'Generate Guess Paper'
                                    )}
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                <div className="space-y-8">
                    <AnimatePresence>
                        {isLoading && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                                <AiLoadingScreen variant="generic" title="Analyzing past papers & generating guess paper..." />
                            </motion.div>
                        )}
                        {result && !isLoading && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <div className="space-y-1.5">
                                            <CardTitle>AI Guess Paper & Analysis</CardTitle>
                                            <CardDescription>Based on {form.getValues('numberOfPapers')} past papers for {form.getValues('subject')}.</CardDescription>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Button onClick={downloadPdf} variant="outline" size="sm">
                                                <FileDown className="mr-2 h-4 w-4" />
                                                Download Report
                                            </Button>
                                            {driveConnected && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-1.5"
                                                    disabled={savingGuessPdfToDrive}
                                                    onClick={() => void saveGuessPaperPdfToDrive()}
                                                >
                                                    {savingGuessPdfToDrive ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                                    Save to Drive
                                                </Button>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        <Accordion type="multiple" defaultValue={['analysis', 'guess-paper']} className="w-full">
                                            <AccordionItem value="analysis">
                                                <AccordionTrigger className="text-lg font-semibold">
                                                    <div className="flex items-center gap-2"><BarChart className="h-5 w-5 text-primary" />Analysis Summary</div>
                                                </AccordionTrigger>
                                                <AccordionContent className="prose prose-sm max-w-none dark:prose-invert">
                                                    <p>{result.analysis.analysisSummary}</p>
                                                    <h4 className="font-semibold mt-4">Predicted Key Topics:</h4>
                                                    <ul className="list-disc pl-5">
                                                        {result.analysis.predictedTopics.map((topic, index) => (
                                                            <li key={index}><strong>{topic.topic}:</strong> {topic.reasoning}</li>
                                                        ))}
                                                    </ul>
                                                </AccordionContent>
                                            </AccordionItem>
                                            <AccordionItem value="guess-paper">
                                                <AccordionTrigger className="text-lg font-semibold">
                                                    <div className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary" />Generated Guess Paper</div>
                                                </AccordionTrigger>
                                                <AccordionContent className="space-y-4">
                                                    {result.guessPaper.map((q, index) => (
                                                        <div key={index} className="p-3 border rounded-md">
                                                            <div className="flex justify-between items-start">
                                                                <p className="font-medium pr-4">{index + 1}. {q.question}</p>
                                                                <Badge variant={
                                                                    q.difficulty === 'Hard' ? 'destructive' :
                                                                        q.difficulty === 'Medium' ? 'secondary' : 'default'
                                                                }>{q.difficulty}</Badge>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </AccordionContent>
                                            </AccordionItem>
                                            <AccordionItem value="tips">
                                                <AccordionTrigger className="text-lg font-semibold">
                                                    <div className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-primary" />Tips & Formulas</div>
                                                </AccordionTrigger>
                                                <AccordionContent className="prose prose-sm max-w-none dark:prose-invert">
                                                    <ul className="list-disc pl-5">
                                                        {result.tipsAndFormulas.map((tip, index) => (
                                                            <li key={index}>{tip}</li>
                                                        ))}
                                                    </ul>
                                                </AccordionContent>
                                            </AccordionItem>
                                            <AccordionItem value="mistakes">
                                                <AccordionTrigger className="text-lg font-semibold">
                                                    <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-primary" />Common Mistakes to Avoid</div>
                                                </AccordionTrigger>
                                                <AccordionContent className="prose prose-sm max-w-none dark:prose-invert">
                                                    <ul className="list-disc pl-5">
                                                        {result.commonMistakes.map((mistake, index) => (
                                                            <li key={index}>{mistake}</li>
                                                        ))}
                                                    </ul>
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    {!result && !isLoading && (
                        <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg h-full">
                            <div className="p-4 bg-primary/10 rounded-full mb-4">
                                <TrendingUp className="h-10 w-10 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground">Your Guess Paper will appear here</h3>
                            <p className="text-muted-foreground mt-1">Upload past papers to get started.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

