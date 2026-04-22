

'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader, UploadCloud, FileDown, Image as ImageIcon, X, BookText, Milestone } from 'lucide-react';
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
import { extractTextFromImage, ImageToTextOutput } from '@/ai/flows/extract-text-from-image';
import { explainMainKeywords, KeywordExplanation } from '@/ai/flows/explain-main-keywords';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useRouter } from 'next/navigation';


const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const formSchema = z.object({
    file: z.any()
        .refine(files => files?.length > 0, 'An image file is required.')
        .refine(files => files?.[0]?.size <= MAX_FILE_SIZE, `File size must be less than 50MB.`)
        .refine(files => files?.[0]?.type.startsWith('image/'), 'Only image files are accepted.'),
    subject: z.string().min(1, 'Please select a subject.'),
});

type ImageToTextFormValues = z.infer<typeof formSchema>;

interface Subject {
    id: string;
    name: string;
}

export default function ImageToTextPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [isExplaining, setIsExplaining] = useState(false);
    const [result, setResult] = useState<ImageToTextOutput | null>(null);
    const [explanations, setExplanations] = useState<KeywordExplanation[] | null>(null);
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

    const form = useForm<ImageToTextFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            subject: '',
        },
    });

    const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });

    const resetState = () => {
        setResult(null);
        setExplanations(null);
    };

    const onSubmit = async (data: ImageToTextFormValues) => {
        setIsLoading(true);
        resetState();

        try {
            const file = data.file[0];
            const fileDataUri = await toBase64(file);

            const response = await extractTextFromImage({
                imageDataUri: fileDataUri,
                subject: data.subject,
            });

            setResult(response);

            if (!response.isRelated) {
                toast({
                    variant: 'destructive',
                    title: 'Image Not Relevant',
                    description: response.reasoning || "The AI determined the image is not related to the selected subject."
                });
            } else {
                toast({ title: 'Text Extracted!', description: 'The text from your image has been processed.' });
            }

        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error Extracting Text',
                description: 'There was a problem processing your image. Please try again.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleExplainTerms = async () => {
        if (!result?.extractedText) return;
        setIsExplaining(true);
        setExplanations(null);

        try {
            // Let's have the AI identify some keywords to explain. We'll take the first few words as a simple example.
            const potentialKeywords = result.extractedText.split(/\s+/).filter(w => w.length > 5).slice(0, 5);

            const response = await explainMainKeywords({
                text: result.extractedText,
                keywords: potentialKeywords,
            });

            setExplanations(response.explanations);
            toast({ title: 'Keywords Explained!', description: 'The AI has provided definitions for key terms.' });
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error Explaining Terms',
                description: 'Could not generate explanations for the key terms.',
            });
        } finally {
            setIsExplaining(false);
        }
    };

    const downloadPdf = () => {
        if (!result) return;
        const doc = new jsPDF();
        const { subject } = form.getValues();
        const source = form.watch('file')?.[0]?.name || 'Image';
        const reportTitle = `Text from Image: ${subject}`;
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
            head: [['Extracted Text']],
            body: [[result.extractedText || 'No text was found in the image.']],
            theme: 'striped',
            didDrawPage: (data: any) => addHeaderFooter(doc)
        });

        if (explanations && explanations.length > 0) {
            doc.addPage();
            (doc as any).autoTable({
                startY: margins.top,
                head: [['Term', 'Explanation']],
                body: explanations.map(e => [e.keyword, e.explanation]),
                theme: 'grid',
                headStyles: { fillColor: [63, 81, 181] },
                didDrawPage: (data: any) => addHeaderFooter(doc)
            });
        }

        addHeaderFooter(doc);
        doc.save('image-to-text-report.pdf');
    };

    const watchedFile = form.watch('file');

    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                title="Image to Text"
                description="Extract text from images and get AI-powered explanations."
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <Card className="lg:sticky lg:top-24">
                    <CardHeader>
                        <CardTitle>Upload Your Image</CardTitle>
                        <CardDescription>Provide an image file containing text.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="subject"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Subject Context</FormLabel>
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
                                    name="file"
                                    render={() => (
                                        <FormItem>
                                            <FormLabel>Image File</FormLabel>
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
                                                                <ImageIcon className="h-3 w-3" /> Image (PNG, JPG, etc.)
                                                            </p>
                                                            {watchedFile?.[0] && <p className='mt-2 text-xs font-bold'>{watchedFile?.[0]?.name}</p>}
                                                        </div>
                                                    </Label>
                                                    <Controller
                                                        name="file"
                                                        control={form.control}
                                                        render={({ field: { onChange } }) => (
                                                            <Input id="file-upload" type="file" accept="image/*" className="sr-only"
                                                                onChange={(e) => {
                                                                    onChange(e.target.files)
                                                                    resetState();
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
                                            Extracting Text...
                                        </>
                                    ) : (
                                        'Extract & Analyze'
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
                                        <CardTitle>Processing Your Image</CardTitle>
                                        <CardDescription>The AI is extracting and analyzing the text. Please wait.</CardDescription>
                                    </CardHeader>
                                    <CardContent className='flex justify-center items-center py-16'>
                                        <Loader className="h-10 w-10 animate-spin text-primary" />
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {result && !isLoading && (
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
                                                Extraction Results
                                            </CardTitle>
                                        </div>
                                        <Button onClick={downloadPdf} variant="outline" size="sm" className="w-full sm:w-auto">
                                            <FileDown className="mr-2 h-4 w-4" />
                                            Download Report
                                        </Button>
                                    </CardHeader>
                                    <CardContent>
                                        {result.extractedText ? (
                                            <div className="space-y-4">
                                                <div className="prose prose-sm dark:prose-invert max-w-none rounded-md border bg-muted/20 p-4 leading-relaxed text-foreground">
                                                    <p>{result.extractedText}</p>
                                                </div>
                                                <Button onClick={handleExplainTerms} disabled={isExplaining} className="w-full">
                                                    {isExplaining ? (
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
                                            </div>
                                        ) : (
                                            <p className="text-muted-foreground">{result.reasoning || "No text could be extracted from the image."}</p>
                                        )}
                                    </CardContent>
                                </Card>

                                {isExplaining && (
                                    <Card>
                                        <CardContent className='flex justify-center items-center py-16'>
                                            <Loader className="h-10 w-10 animate-spin text-primary" />
                                        </CardContent>
                                    </Card>
                                )}

                                {explanations && explanations.length > 0 && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2">
                                                <Milestone className="h-6 w-6 text-primary" />
                                                Key Term Explanations
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <Accordion type="single" collapsible className="w-full">
                                                {explanations.map((item, index) => (
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

                    {!result && !isLoading && (
                        <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg h-full">
                            <div className="p-4 bg-primary/10 rounded-full mb-4">
                                <ImageIcon className="h-10 w-10 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground">Your extracted text will appear here</h3>
                            <p className="text-muted-foreground mt-1">Upload an image to get started.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

