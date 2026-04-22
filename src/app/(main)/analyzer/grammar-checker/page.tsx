
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader, FileDown, Check, ArrowRight, SpellCheck, Info } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import PageHeader from '@/components/app/page-header';
import { AnimatePresence, motion } from 'framer-motion';
import { checkGrammar, Correction } from '@/ai/flows/grammar-checker';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';


const formSchema = z.object({
    text: z.string().min(10, 'Please enter at least 10 characters to check.'),
});

type GrammarCheckerFormValues = z.infer<typeof formSchema>;

export default function GrammarCheckerPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [corrections, setCorrections] = useState<Correction[] | null>(null);
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();

    const userDocRef = useMemoFirebase(
        () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
        [user, firestore]
    );
    const { data: userProfile } = useDoc(userDocRef);

    const form = useForm<GrammarCheckerFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            text: '',
        },
    });

    const onSubmit = async (data: GrammarCheckerFormValues) => {
        setIsLoading(true);
        setCorrections(null);

        try {
            const result = await checkGrammar({ text: data.text });
            setCorrections(result.corrections);
            if (result.corrections.length > 0) {
                toast({ title: 'Grammar Checked!', description: `Found ${result.corrections.length} suggestion(s).` });
            } else {
                toast({ title: 'Looks Good!', description: 'The AI found no grammar mistakes.' });
            }
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error Checking Grammar',
                description: 'There was a problem checking your text. Please try again.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const downloadPdf = () => {
        if (corrections === null) return;

        const doc = new jsPDF();
        const reportTitle = `Grammar Check Report`;
        const margins = { top: 60, bottom: 20, left: 20, right: 20 };
        const originalText = form.getValues('text');
        let correctedText = originalText;

        if (corrections.length > 0) {
            corrections.forEach(correction => {
                correctedText = correctedText.replace(correction.original, correction.corrected);
            });
        }

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

        // Page 1: Original Text
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Original Text', margins.left, margins.top);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const splitOriginalText = doc.splitTextToSize(originalText, doc.internal.pageSize.width - margins.left - margins.right);
        doc.text(splitOriginalText, margins.left, margins.top + 10);

        // Page 2: Corrected Text
        doc.addPage();
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Corrected Text', margins.left, margins.top);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const splitCorrectedText = doc.splitTextToSize(correctedText, doc.internal.pageSize.width - margins.left - margins.right);
        doc.text(splitCorrectedText, margins.left, margins.top + 10);

        if (corrections.length > 0) {
            doc.addPage();
            (doc as any).autoTable({
                startY: margins.top,
                head: [['Original', 'Correction', 'Explanation']],
                body: corrections.map(c => [c.original, c.corrected, c.explanation]),
                theme: 'grid',
                headStyles: { fillColor: [63, 81, 181] },
                didDrawPage: (data: any) => {
                    addHeaderFooter(doc);
                },
                margin: margins,
            });
        }

        addHeaderFooter(doc);
        doc.save('grammar-report.pdf');
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex items-center gap-4">
                <PageHeader
                    title="Grammar Checker"
                    description="Paste your text below to get AI-powered grammar and spelling corrections."
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <Card className="lg:sticky lg:top-24">
                    <CardHeader>
                        <CardTitle>Enter Your Text</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="text"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Text to Check</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder="Paste your essay, report, or any text here..." {...field} rows={12} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Button type="submit" disabled={isLoading} className="w-full">
                                    {isLoading ? (
                                        <>
                                            <Loader className="mr-2 h-4 w-4 animate-spin" />
                                            Checking...
                                        </>
                                    ) : (
                                        'Check Grammar'
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
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Checking Your Text</CardTitle>
                                        <CardDescription>The AI is proofreading your content. Please wait.</CardDescription>
                                    </CardHeader>
                                    <CardContent className='flex justify-center items-center py-16'>
                                        <Loader className="h-10 w-10 animate-spin text-primary" />
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}

                        {corrections !== null && !isLoading && (
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                                <Card>
                                    <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div className='space-y-1.5'>
                                            <CardTitle className='flex items-center gap-2'>
                                                <SpellCheck className='h-6 w-6 text-primary' />
                                                Grammar Report
                                            </CardTitle>
                                            <CardDescription>
                                                {corrections.length > 0 ? `Found ${corrections.length} suggestion(s).` : 'Everything looks great! No mistakes found.'}
                                            </CardDescription>
                                        </div>
                                        <Button onClick={downloadPdf} variant="outline" size="sm" className="w-full sm:w-auto">
                                            <FileDown className="mr-2 h-4 w-4" />
                                            Download Report
                                        </Button>
                                    </CardHeader>
                                    <CardContent>
                                        {corrections.length > 0 ? (
                                            <Accordion type="single" collapsible className="w-full">
                                                {corrections.map((item, index) => (
                                                    <AccordionItem key={index} value={`item-${index}`}>
                                                        <AccordionTrigger className='text-left hover:no-underline'>
                                                            {/* If the original problematic sentence is long (>20 chars or >6 words), show it on the next line for clarity */}
                                                            {(() => {
                                                                const orig = item.original || '';
                                                                const wordCount = orig.trim() ? orig.trim().split(/\s+/).length : 0;
                                                                const charCount = orig.length;
                                                                if (charCount > 20 || wordCount > 6) {
                                                                    return (
                                                                        <div className='text-sm' style={{ color: '#FF4C4C', whiteSpace: 'pre-wrap' }}>
                                                                            <span>Issue:</span>
                                                                            <br />
                                                                            <span>{orig}</span>
                                                                        </div>
                                                                    );
                                                                }
                                                                return <p className='text-sm' style={{ color: '#FF4C4C' }}>{orig}</p>;
                                                            })()}
                                                        </AccordionTrigger>
                                                        <AccordionContent className="space-y-2 pt-2">
                                                            <div className='flex items-start gap-2'>
                                                                <Check className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: '#4CAF50' }} />
                                                                <p className="font-medium text-sm" style={{ color: '#4CAF50' }}>{item.corrected}</p>
                                                            </div>
                                                            <div className='flex items-start gap-2'>
                                                                <Info className="h-5 w-5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                                                                <p className="text-sm text-muted-foreground">{item.explanation}</p>
                                                            </div>
                                                        </AccordionContent>
                                                    </AccordionItem>
                                                ))}
                                            </Accordion>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center text-center p-8 text-green-600">
                                                <Check className="h-12 w-12 mb-4" />
                                                <h3 className="text-lg font-semibold">No Errors Found</h3>
                                                <p className="text-muted-foreground">The AI didn't find any grammatical mistakes.</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {corrections === null && !isLoading && (
                        <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg h-full">
                            <div className="p-4 bg-primary/10 rounded-full mb-4">
                                <SpellCheck className="h-10 w-10 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground">Your grammar report will appear here</h3>
                            <p className="text-muted-foreground mt-1">Paste your text in the form to get started.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

