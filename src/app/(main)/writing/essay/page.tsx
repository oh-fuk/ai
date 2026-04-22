
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading-button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import PageHeader from '@/components/app/page-header';
import { Loader, ChevronLeft, PenSquare, FileDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { generateEssay } from '@/ai/flows/generate-essay';
import { AnimatePresence, motion } from 'framer-motion';
import jsPDF from 'jspdf';
import { sanitizeText, splitIntoBlocks, wrapTextToLines, LineObj } from '@/lib/pdf-utils';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';


const formSchema = z.object({
  topic: z.string().min(5, 'Please enter a topic with at least 5 characters.'),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  specifications: z.string().optional(),
});

type EssayFormValues = z.infer<typeof formSchema>;

export default function EssayWriterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [essay, setEssay] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );
  const { data: userProfile } = useDoc(userDocRef);


  const form = useForm<EssayFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: '',
      difficulty: 'medium',
      specifications: '',
    },
  });

  const cleanEssayText = (text: string): string => {
    return text
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .replace(/[^\x20-\x7E\n\r\t]/g, '') // Keep only standard ASCII + newlines/tabs
      .replace(/[*_~`]/g, '') // Remove markdown special characters
      .replace(/#{1,6}\s*/g, '') // Remove markdown headings
      .replace(/\*\*/g, '') // Remove bold markers
      .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
      .trim();
  };

  const onSubmit = async (data: EssayFormValues) => {
    setIsLoading(true);
    setEssay(null);
    try {
      const result = await generateEssay({ 
        topic: data.topic, 
        difficulty: data.difficulty,
        specifications: data.specifications 
      });
      const cleanedEssay = cleanEssayText(result.essay);
      setEssay(cleanedEssay);
      toast({ title: 'Essay Generated!', description: 'Your AI-written essay is ready.' });
    } catch (error) {
      console.error('Error generating essay:', error);
      toast({ variant: 'destructive', title: 'Generation Failed', description: 'Could not generate the essay. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const cleanPdfText = (text: string): string => {
    return text
      // Remove control characters
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      // Remove non-ASCII characters and special symbols (but keep standard text)
      .replace(/[^\x20-\x7E\n\r\t]/g, '')
      // Remove markdown formatting symbols
      .replace(/\*\*/g, '')
      .replace(/__|~~|``/g, '')
      // Remove special bullet and decorative symbols
      .replace(/[•◦▪▫■□●○◆◇★☆♦♥♠♣]/g, '')
      .replace(/[←→↑↓↔↕⇐⇒⇑⇓⇔⇕]/g, '')
      .replace(/[⚠️✓✗✘✔✖]/g, '')
      // Remove emojis
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\t/g, ' ')
      .replace(/  +/g, ' ')
      .trim();
  };

  const downloadPdf = () => {
    if (!essay) return;

    const studentName = userProfile?.fullName || (user && user.displayName) || 'Student';
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const reportTitle = `Essay`;
    const FONT_SIZE = 12;
    const LINE_HEIGHT = 18;
    const margins = { top: 80, bottom: 60, left: 60, right: 60 };

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const bodyWidth = pageWidth - margins.left - margins.right;

    const lines = essay.split('\n');
    let totalPages = 1;

    const addHeaderFooter = (docInstance: jsPDF, pageNum: number, total: number) => {
      docInstance.setFont('helvetica', 'bold');
      docInstance.setFontSize(10);
      docInstance.text('AthenaAI', margins.left, 30);

      docInstance.setFont('helvetica', 'normal');
      docInstance.setFontSize(9);
      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      docInstance.text(dateStr, pageWidth - margins.right, 30, { align: 'right' });

      docInstance.setLineWidth(0.5);
      docInstance.setDrawColor(200, 200, 200);
      docInstance.line(margins.left, 38, pageWidth - margins.right, 38);

      docInstance.setFont('helvetica', 'normal');
      docInstance.setFontSize(9);
      docInstance.setTextColor(100, 100, 100);
      docInstance.text(`Page ${pageNum} of ${total}`, pageWidth / 2, pageHeight - 30, { align: 'center' });
      
      if (userProfile?.collegeName) {
        docInstance.text(userProfile.collegeName, margins.left, pageHeight - 30);
      }
      docInstance.text(studentName, pageWidth - margins.right, pageHeight - 30, { align: 'right' });
      
      docInstance.setTextColor(0, 0, 0);
    };

    // First pass: calculate pages
    let y = margins.top;
    let pageCount = 1;
    
    lines.forEach((line) => {
      const trimmedLine = line.trim();
      doc.setFontSize(FONT_SIZE);
      doc.setFont('helvetica', 'normal');
      
      if (trimmedLine) {
        const wrappedLines = doc.splitTextToSize(trimmedLine, bodyWidth);
        const neededHeight = wrappedLines.length * LINE_HEIGHT;
        
        if (y + neededHeight > pageHeight - margins.bottom) {
          pageCount++;
          y = margins.top;
        }
        y += neededHeight;
      } else {
        if (y + LINE_HEIGHT > pageHeight - margins.bottom) {
          pageCount++;
          y = margins.top;
        }
        y += LINE_HEIGHT;
      }
    });
    
    totalPages = pageCount;

    // Second pass: render
    y = margins.top;
    let currentPage = 1;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT_SIZE);
    doc.setTextColor(0, 0, 0);
    
    lines.forEach((line) => {
      const trimmedLine = line.trim();
      
      if (trimmedLine) {
        const isBold = /^(Subject:|Dear|Respected|Sincerely|Yours|Thank you|Introduction|Conclusion)/i.test(trimmedLine);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        
        const wrappedLines = doc.splitTextToSize(trimmedLine, bodyWidth);
        const neededHeight = wrappedLines.length * LINE_HEIGHT;
        
        if (y + neededHeight > pageHeight - margins.bottom) {
          addHeaderFooter(doc, currentPage, totalPages);
          doc.addPage();
          currentPage++;
          y = margins.top;
        }
        
        wrappedLines.forEach((wrappedLine: string) => {
          doc.text(wrappedLine, margins.left, y);
          y += LINE_HEIGHT;
        });
      } else {
        if (y + LINE_HEIGHT > pageHeight - margins.bottom) {
          addHeaderFooter(doc, currentPage, totalPages);
          doc.addPage();
          currentPage++;
          y = margins.top;
        }
        y += LINE_HEIGHT;
      }
    });
    
    addHeaderFooter(doc, currentPage, totalPages);
    doc.save('essay.pdf');
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <PageHeader title="Essay Writer" description="Generate a well-structured essay on any topic." />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Card className="lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle>Essay Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="topic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Essay Topic</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., The Industrial Revolution" {...field} />
                      </FormControl>
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
                      <FormControl>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
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
                <FormField
                  control={form.control}
                  name="specifications"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Specifications (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Include examples, focus on economic impact, 1000 words" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <LoadingButton type="submit" loading={isLoading} loadingText="Generating..." className="w-full">
                  Generate Essay
                </LoadingButton>
              </form>
            </Form>
          </CardContent>
        </Card>

        <AnimatePresence>
          {isLoading ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card>
                <CardHeader>
                  <CardTitle>Generating Your Essay</CardTitle>
                  <CardDescription>The AI is writing. Please wait.</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center items-center py-16">
                  <Loader className="h-10 w-10 animate-spin text-primary" />
                </CardContent>
              </Card>
            </motion.div>
          ) : essay ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Generated Essay</CardTitle>
                    <CardDescription>Topic: {form.getValues('topic')}</CardDescription>
                  </div>
                  <Button onClick={downloadPdf} variant="outline" size="sm">
                    <FileDown className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="max-w-none rounded-md border p-6 bg-muted/50">
                    <div className="text-foreground leading-relaxed space-y-4">
                      {essay.split('\n\n').map((paragraph, idx) => (
                        <p key={idx} className="text-justify">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg h-full">
              <div className="p-4 bg-primary/10 rounded-full mb-4">
                <PenSquare className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Your essay will appear here</h3>
              <p className="text-muted-foreground mt-1">Enter a topic to get started.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
