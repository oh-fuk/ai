
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
import { Loader, ChevronLeft, FileText, FileDown, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { generateEmail } from '@/ai/flows/generate-email';
import { AnimatePresence, motion } from 'framer-motion';
import { AiLoadingScreen } from '@/components/app/ai-loading';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { sanitizeText, splitIntoBlocks, wrapTextToLines, getLinesFromBlock, LineObj } from '@/lib/pdf-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';


const formSchema = z.object({
  topic: z.string().min(5, 'Please enter a topic with at least 5 characters.'),
  patternFile: z.any().optional(),
  additionalInfo: z.string().optional(),
});

type EmailFormValues = z.infer<typeof formSchema>;

const examplePattern = `Subject: [Your Subject Here]

Dear [Recipient Name],

[Opening sentence introducing yourself and the purpose of the email].

[Main body paragraph: Provide more details, context, or ask your question here. Be clear and concise.]

[Optional second paragraph for additional information.]

Thank you for your time and consideration.

Best regards,

[Your Name]
[Your Contact Information/Title]`;

export default function EmailWriterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [emailContent, setEmailContent] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );
  const { data: userProfile } = useDoc(userDocRef);


  const form = useForm<EmailFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: '',
      additionalInfo: '',
    },
  });

  const onSubmit = async (data: EmailFormValues) => {
    setIsLoading(true);
    setEmailContent(null);
    try {
      let pattern: string | undefined;
      if (data.patternFile && data.patternFile[0]) {
        pattern = await data.patternFile[0].text();
      }

      const result = await generateEmail({
        topic: data.topic,
        pattern,
        additionalInfo: data.additionalInfo
      });
      setEmailContent(result.emailContent);
      toast({ title: 'Email Generated!', description: 'Your AI-written email is ready.' });
    } catch (error) {
      console.error('Error generating email:', error);
      toast({ variant: 'destructive', title: 'Generation Failed', description: 'Could not generate the email. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }

  // PDF helpers (imported from src/lib/pdf-utils.ts)
  const downloadPdf = () => {
    if (!emailContent) return;

    // App Logo (automatically Base64 after import)
    // If you have a Base64 image string for your app logo, replace `undefined` with that string.
    // Leaving it undefined will skip adding the logo (doc.addImage will be skipped).
    const appLogoBase64 = undefined as string | undefined;

    const studentName =
      (userProfile && (userProfile.fullName || (userProfile as any).name)) ||
      (user && (user.displayName || (user as any).name)) ||
      "Student";

    const doc = new jsPDF({
      unit: "pt",
      format: "letter",
    });

    const title = form.getValues("topic") || "Generated Essay";

    const margins = { top: 90, bottom: 60, left: 60, right: 60 };
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const usableWidth = pageWidth - margins.left - margins.right;

    /* ----------------------------------------
       WATERMARK
    ---------------------------------------- */
    const addWatermark = () => {
      doc.saveGraphicsState();
      doc.setTextColor(220, 220, 220);
      doc.setFontSize(60);
      doc.setFont("helvetica", "bold");
      doc.text("ATHENAAI", pageWidth / 2, pageHeight / 2, {
        align: "center",
        angle: 45,
      });
      doc.restoreGraphicsState();
    };

    /* ----------------------------------------
       HEADER & FOOTER (Quiz Generator Style)
    ---------------------------------------- */
    const addHeaderFooter = (pageNum: number, totalPages: number) => {
      // Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('AthenaAI', margins.left, 20);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(userProfile?.collegeName || '', pageWidth - margins.right, 20, { align: 'right' });

      doc.setLineWidth(0.5);
      doc.setDrawColor(0, 0, 0);
      doc.line(margins.left, 25, pageWidth - margins.right, 25);

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`Email: ${title}`, pageWidth / 2, 35, { align: 'center' });

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Student: ${studentName}`, margins.left, 45);
      doc.text(new Date().toLocaleDateString(), pageWidth - margins.right, 45, { align: 'right' });

      // Footer
      doc.setFontSize(10);
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    };

    /* ----------------------------------------
       BORDER
    ---------------------------------------- */
    const drawBorder = () => {
      doc.setLineWidth(1);
      doc.setDrawColor(180);
      doc.rect(
        margins.left - 20,
        margins.top - 40,
        pageWidth - (margins.left - 20) * 2,
        pageHeight - (margins.top - 20) * 2,
        "S"
      );
    };

    /* ----------------------------------------
       CONVERT CONTENT → SIMPLE LINE-BY-LINE
    ---------------------------------------- */
    const lines = emailContent.split('\n');
    let totalPages = 1;

    // First pass: calculate pages
    let y = margins.top;
    let pageCount = 1;
    const FONT_SIZE = 12;
    const LINE_HEIGHT = 18;

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      doc.setFontSize(FONT_SIZE);
      doc.setFont('helvetica', 'normal');

      if (trimmedLine) {
        const wrappedLines = doc.splitTextToSize(trimmedLine, usableWidth);
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

    /* ----------------------------------------
       SECOND PASS: RENDER CONTENT
    ---------------------------------------- */
    y = margins.top;
    let currentPage = 1;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FONT_SIZE);
    doc.setTextColor(0, 0, 0);

    lines.forEach((line) => {
      const trimmedLine = line.trim();

      if (trimmedLine) {
        const isBold = /^(Subject:|To:|From:|Dear|Respected|Sincerely|Yours|Thank you|Best regards)/i.test(trimmedLine);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');

        const wrappedLines = doc.splitTextToSize(trimmedLine, usableWidth);
        const neededHeight = wrappedLines.length * LINE_HEIGHT;

        if (y + neededHeight > pageHeight - margins.bottom) {
          addHeaderFooter(currentPage, totalPages);
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
          addHeaderFooter(currentPage, totalPages);
          doc.addPage();
          currentPage++;
          y = margins.top;
        }
        y += LINE_HEIGHT;
      }
    });

    addHeaderFooter(currentPage, totalPages);

    // Save with a contextual filename
    const filename = `${title.replace(/[^a-z0-9\-]/gi, '_').toLowerCase() || 'email'}.pdf`;
    doc.save(filename);
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <PageHeader title="Email Writer" description="Draft professional emails for any purpose." />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Card className="lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle>Email Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="topic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Topic/Purpose</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Follow-up on job application" {...field} />
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
                              <DialogTitle>Example Email Pattern</DialogTitle>
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
                        <Textarea placeholder="e.g., Mention the attachment and ask for a reply by Friday." {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? <><Loader className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : 'Generate Email'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <AnimatePresence>
          {isLoading ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AiLoadingScreen variant="generic" title="Writing your email..." />
            </motion.div>
          ) : emailContent ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Generated Email</CardTitle>
                    <CardDescription>Topic: {form.getValues('topic')}</CardDescription>
                  </div>
                  <Button onClick={downloadPdf} variant="outline" size="sm">
                    <FileDown className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border p-6 bg-white dark:bg-gray-900 font-mono text-sm" style={{ lineHeight: '1.8' }}>
                    {(() => {
                      const sanitized = sanitizeText(emailContent || '');
                      const lines = sanitized.split('\n');

                      return lines.map((line, i) => {
                        const trimmed = line.trim();

                        // Empty line - show as visible blank space
                        if (!trimmed) {
                          return <div key={i} style={{ height: '1.5em' }}>&nbsp;</div>;
                        }

                        // Check for Subject: line
                        if (trimmed.startsWith('Subject:')) {
                          return (
                            <div key={i} style={{ marginBottom: '1em' }}>
                              <strong className="font-bold text-base">{trimmed}</strong>
                            </div>
                          );
                        }

                        // Check for section headings (lines with **text**)
                        const boldMatch = trimmed.match(/^\*\*(.*?)\*\*$/);
                        if (boldMatch) {
                          return (
                            <div key={i} style={{ marginBottom: '0.5em' }}>
                              <strong className="font-bold">{boldMatch[1]}</strong>
                            </div>
                          );
                        }

                        // Regular line with inline bold
                        const parts = trimmed.split(/(\*\*.*?\*\*)/g).filter(Boolean);
                        const inlineNodes = parts.map((part, idx) => {
                          const m = part.match(/^\*\*(.*?)\*\*$/);
                          if (m) return <strong key={idx} className="font-bold">{m[1]}</strong>;
                          return <span key={idx}>{part}</span>;
                        });

                        return (
                          <div key={i} style={{ marginBottom: '0.3em' }}>
                            {inlineNodes}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg h-full">
              <div className="p-4 bg-primary/10 rounded-full mb-4">
                <FileText className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Your email will appear here</h3>
              <p className="text-muted-foreground mt-1">Enter a topic to get started.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
