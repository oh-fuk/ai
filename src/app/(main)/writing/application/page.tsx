
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import PageHeader from '@/components/app/page-header';
import { Loader, Briefcase, FileDown, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { generateApplication } from '@/ai/flows/generate-application';
import { AnimatePresence, motion } from 'framer-motion';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { sanitizeText, splitIntoBlocks, wrapTextToLines, getLinesFromBlock, LineObj, BlockLine, TextBlock } from '@/lib/pdf-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';


const formSchema = z.object({
  topic: z.string().min(5, 'Please enter a topic with at least 5 characters.'),
  patternFile: z.any().optional(),
  additionalInfo: z.string().optional(),
});

type ApplicationFormValues = z.infer<typeof formSchema>;

const examplePattern = `[Your Name]
[Your Address]
[Your City, Postal Code]
[Your Email]
[Your Phone Number]
[Date]

[Recipient Name]
[Recipient Title]
[Organization Name]
[Organization Address]

Subject: Application for the Position of [Position Name]

Dear [Mr./Ms./Dr. Last Name],

I am writing to express my keen interest in the [Position Name] position at [Organization Name], which I saw advertised on [Platform where you saw the ad, e.g., LinkedIn, company website].

[In the following paragraph, explain your qualifications, relevant skills, and why you are a good fit for the role. Mention specific experiences from your resume.]

[In this paragraph, express your enthusiasm for the company and the role. Explain why you want to work for this specific organization.]

Thank you for considering my application. I have attached my resume for your review and look forward to the possibility of discussing this opportunity with you further.

Sincerely,
[Your Name]`;

export default function ApplicationWriterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [applicationContent, setApplicationContent] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );
  const { data: userProfile } = useDoc(userDocRef);


  const form = useForm<ApplicationFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: '',
      additionalInfo: '',
    },
  });

  const onSubmit = async (data: ApplicationFormValues) => {
    setIsLoading(true);
    setApplicationContent(null);
    try {
      let pattern: string | undefined;
      if (data.patternFile && data.patternFile[0]) {
        pattern = await data.patternFile[0].text();
      }

      const result = await generateApplication({
        topic: data.topic,
        pattern,
        additionalInfo: data.additionalInfo
      });
      setApplicationContent(result.applicationContent);
      toast({ title: 'Application Generated!', description: 'Your AI-written application is ready.' });
    } catch (error) {
      console.error('Error generating application:', error);
      toast({ variant: 'destructive', title: 'Generation Failed', description: 'Could not generate the application. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };
  // PDF helpers (imported from src/lib/pdf-utils.ts)

  const downloadPdf = () => {
    if (!applicationContent) return;

    const studentName = (userProfile && (userProfile.fullName || (userProfile as any).name)) || (user && (user.displayName || (user as any).name)) || 'Student';

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const reportTitle = `Application`;
    const FONT_SIZE = 12;
    const LINE_HEIGHT = 18; // 1.5x line height
    const margins = { top: 80, bottom: 60, left: 60, right: 60 };
    
    doc.setProperties({ title: reportTitle, subject: form.getValues('topic') });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const bodyWidth = pageWidth - margins.left - margins.right;

    // Split content by lines (exactly as shown on screen)
    const lines = applicationContent.split('\n');
    
    let totalPages = 1;
    
    const addHeaderFooter = (docInstance: jsPDF, pageNum: number) => {
      // Header
      docInstance.setFont('helvetica', 'bold');
      docInstance.setFontSize(10);
      docInstance.text('AthenaAI', margins.left, 30);

      docInstance.setFont('helvetica', 'normal');
      docInstance.setFontSize(9);
      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      docInstance.text(dateStr, pageWidth - margins.right, 30, { align: 'right' });

      // Thin line under header
      docInstance.setLineWidth(0.5);
      docInstance.setDrawColor(200, 200, 200);
      docInstance.line(margins.left, 38, pageWidth - margins.right, 38);

      // Footer
      docInstance.setFont('helvetica', 'normal');
      docInstance.setFontSize(9);
      docInstance.setTextColor(100, 100, 100);
      docInstance.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 30, { align: 'center' });
      
      if (userProfile?.collegeName) {
        docInstance.text(userProfile.collegeName, margins.left, pageHeight - 30);
      }
      docInstance.text(studentName, pageWidth - margins.right, pageHeight - 30, { align: 'right' });
      
      // Reset text color
      docInstance.setTextColor(0, 0, 0);
    };

    // First pass: calculate total pages
    let y = margins.top;
    let pageCount = 1;
    
    lines.forEach((line) => {
      const trimmedLine = line.trim();
      
      // Check if line needs wrapping
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
        // Empty line
        if (y + LINE_HEIGHT > pageHeight - margins.bottom) {
          pageCount++;
          y = margins.top;
        }
        y += LINE_HEIGHT;
      }
    });
    
    totalPages = pageCount;

    // Second pass: render content
    y = margins.top;
    let currentPage = 1;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT_SIZE);
    doc.setTextColor(0, 0, 0);
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      if (trimmedLine) {
        // Check for bold text (Subject:, Dear, Sincerely, etc.)
        const isBold = /^(Subject:|Dear|Respected|Sincerely|Yours|Thank you)/i.test(trimmedLine);
        
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        
        // Wrap text if needed
        const wrappedLines = doc.splitTextToSize(trimmedLine, bodyWidth);
        const neededHeight = wrappedLines.length * LINE_HEIGHT;
        
        // Check if we need a new page
        if (y + neededHeight > pageHeight - margins.bottom) {
          addHeaderFooter(doc, currentPage);
          doc.addPage();
          currentPage++;
          y = margins.top;
        }
        
        // Render each wrapped line
        wrappedLines.forEach((wrappedLine: string) => {
          doc.text(wrappedLine, margins.left, y);
          y += LINE_HEIGHT;
        });
      } else {
        // Empty line - add spacing
        if (y + LINE_HEIGHT > pageHeight - margins.bottom) {
          addHeaderFooter(doc, currentPage);
          doc.addPage();
          currentPage++;
          y = margins.top;
        }
        y += LINE_HEIGHT;
      }
    });
    
    // Add header/footer to last page
    addHeaderFooter(doc, currentPage);

    doc.save('application.pdf');
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <PageHeader title="Application Writer" description="Draft formal applications for jobs, leave, and more." />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Card className="lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle>Application Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="topic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Application Topic/Purpose</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Application for sick leave" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="patternFile"
                  render={({ field: { onChange, ...rest } }) => (
                    <FormItem>
                      <div className="flex justify-between items-center">
                        <FormLabel>Pattern File (Optional)</FormLabel>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="link" size="sm" className="h-auto p-0"><Eye className="mr-2 h-4 w-4" />View Example</Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Example Application Pattern</DialogTitle>
                            </DialogHeader>
                            <pre className="mt-2 w-full whitespace-pre-wrap rounded-md bg-muted p-4 text-sm font-mono">{examplePattern}</pre>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <FormControl>
                        <Input type="file" accept=".txt" onChange={e => onChange(e.target.files)} {...rest} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="additionalInfo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Information (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="e.g., Mention that I have a doctor's note..." {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : 'Generate Application'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <AnimatePresence>
          {isLoading ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card>
                <CardHeader>
                  <CardTitle>Generating Your Application</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center items-center py-16">
                  <Loader className="h-10 w-10 animate-spin text-primary" />
                </CardContent>
              </Card>
            </motion.div>
          ) : applicationContent ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Generated Application</CardTitle>
                    <CardDescription>Topic: {form.getValues('topic')}</CardDescription>
                  </div>
                  <Button onClick={downloadPdf} variant="outline" size="sm">
                    <FileDown className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="prose dark:prose-invert max-w-none rounded-md border p-4 bg-muted/50 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: applicationContent.replace(/\n/g, '<br/>') }} />
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg h-full">
              <div className="p-4 bg-primary/10 rounded-full mb-4">
                <Briefcase className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Your application will appear here</h3>
              <p className="text-muted-foreground mt-1">Enter a topic to get started.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
