

'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader, UploadCloud, FileDown, X, File, Image as ImageIcon, ChevronLeft, Upload } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import PageHeader from '@/components/app/page-header';
import { generateStudyPlan } from '@/ai/flows/generate-study-plan';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { extractTextFromImage } from '@/ai/flows/extract-text-from-image';
import { extractTextFromPdf } from '@/ai/flows/extract-text-from-pdf';
import { useRouter } from 'next/navigation';
import { DriveImportButton } from '@/components/app/drive-import-button';
import { useDrive } from '@/hooks/use-drive';
import { getFormFileDisplayName, hasFormFileValue, isDriveImportFormValue, isPdfLikeMime } from '@/lib/drive-form-file';


const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const formSchema = z.object({
  subject: z.string().min(1, 'Please select a subject.'),
  topic: z.string().optional(),
  timeframeValue: z.coerce.number().min(1, 'Please enter a valid timeframe.'),
  timeframeUnit: z.enum(['hours', 'days', 'weeks', 'months', 'years']),
  specifications: z.string().optional(),
  file: z.any().optional(),
  specificTopic: z.string().optional(),
  pageRange: z.string().optional(),
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

type PlannerFormValues = z.infer<typeof formSchema>;

interface PlanItem {
  duration: string;
  topic: string;
  tasks: string[];
}

interface StudyPlanResult {
  plan: PlanItem[];
  progress: string;
}

interface Subject {
  id: string;
  name: string;
}

export default function PlannerPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [studyPlan, setStudyPlan] = useState<StudyPlanResult | null>(null);
  const [savingPlanPdfToDrive, setSavingPlanPdfToDrive] = useState(false);
  const { connected: driveConnected, uploadFile } = useDrive();
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

  const form = useForm<PlannerFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: '',
      timeframeValue: 1,
      timeframeUnit: 'weeks',
      specifications: '',
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

  const onSubmit = async (data: PlannerFormValues) => {
    setIsLoading(true);
    setStudyPlan(null);
    let specifications = data.specifications || '';

    const timeframe = `${data.timeframeValue} ${data.timeframeUnit}`;

    try {
      let pdfDataUri: string | undefined;
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

        if (fileDataUri) {
          if (fileType.startsWith('image/')) {
            const imageTextResult = await extractTextFromImage({ imageDataUri: fileDataUri, subject: data.subject });
            if (!imageTextResult.isRelated || !imageTextResult.extractedText) {
              toast({ variant: 'destructive', title: 'Image Analysis Failed', description: imageTextResult.reasoning || 'Could not extract relevant text from image.' });
              setIsLoading(false);
              return;
            }
            specifications += `\nBase the plan on the following text from an image: ${imageTextResult.extractedText}`;
          } else if (isPdfLikeMime(fileType)) {
            pdfDataUri = fileDataUri;
          } else {
            toast({ variant: 'destructive', title: 'Unsupported File Type', description: 'Please upload a PDF or an image file.' });
            setIsLoading(false);
            return;
          }
        }
      }

      const result = await generateStudyPlan({
        topic: data.topic,
        timeframe: timeframe,
        specifications: specifications,
        pdfDataUri: pdfDataUri,
        specificTopic: data.specificTopic,
        pageRange: data.pageRange,
      });

      if (user) {
        const plansRef = collection(firestore, 'users', user.uid, 'studyPlans');
        const planData = {
          userId: user.uid,
          name: data.topic || `Plan for ${getFormFileDisplayName(data.file) || 'document'}`,
          startDate: new Date().toISOString().split('T')[0], // Save as YYYY-MM-DD
          endDate: '', // This can be calculated if needed
          timeframe: timeframe,
          plan: result.plan, // Save the generated plan structure
          createdAt: serverTimestamp(),
        };
        addDocumentNonBlocking(plansRef, planData);
      }

      toast({
        title: "Study Plan Generated",
        description: "Your personalized study plan is ready.",
      });

      setStudyPlan(result);

    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error Generating Plan',
        description: 'There was a problem generating the study plan. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const buildStudyPlanPdfDoc = (): jsPDF => {
    if (!studyPlan) throw new Error('No study plan');

    const doc = new jsPDF();
    const { topic, timeframeValue, timeframeUnit, subject } = form.getValues();
    const timeFrame = `${timeframeValue} ${timeframeUnit}`;
    const finalTopic = topic || `Content-based Plan`;

    const tableData = studyPlan.plan.map(item => [
      item.duration,
      item.topic,
      item.tasks.map(t => `- ${t}`).join('\n')
    ]);

    (doc as any).autoTable({
      head: [['Duration', 'Topic', 'Tasks']],
      body: tableData,
      startY: 55,
      theme: 'grid',
      headStyles: { fillColor: [0, 150, 136], textColor: 255, fontStyle: 'bold' },
      didDrawPage: (data: any) => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        const pageHeight = doc.internal.pageSize.height;
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
        doc.text(`Study Plan: ${subject} - ${finalTopic}`, pageWidth / 2, 35, { align: 'center' });

        doc.setFontSize(11);
        doc.text(`Student: ${userProfile?.fullName || 'Student'}`, margin.left, 45);
        doc.text(`Timeframe: ${timeFrame}`, pageWidth - margin.right, 45, { align: 'right' });

        // Footer
        doc.setFontSize(10);
        doc.text(`Page ${data.pageNumber} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      },
      margin: { top: 55, bottom: 20, left: 20, right: 20 }
    });

    return doc;
  };

  const downloadPdf = () => {
    if (!studyPlan) return;
    buildStudyPlanPdfDoc().save('study-plan.pdf');
  };

  const saveStudyPlanPdfToDrive = async () => {
    if (!studyPlan || !driveConnected) return;
    setSavingPlanPdfToDrive(true);
    try {
      const doc = buildStudyPlanPdfDoc();
      const blob = doc.output('blob');
      const { subject, topic } = form.getValues();
      const safe = (s: string) => s.replace(/[/\\?%*:|"<>]/g, '-').slice(0, 60);
      await uploadFile(blob, `Study plan - ${safe(subject)} - ${safe(topic || 'plan')}.pdf`, 'application/pdf');
      toast({ title: 'Saved to Google Drive!' });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Save failed';
      toast({ variant: 'destructive', title: 'Save failed', description: message });
    } finally {
      setSavingPlanPdfToDrive(false);
    }
  };

  const watchedFile = form.watch('file');

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <PageHeader
          title="Study Planner"
          description="Organize your study schedule, track tasks, and stay on top of your goals."
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Create Your Study Plan</CardTitle>
          <CardDescription>
            Tell the AI your topic and timeframe to generate a personalized schedule.
          </CardDescription>
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
                  name="topic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Study Topic (Optional with file)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Quantum Physics" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="timeframeValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Timeframe</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="timeframeUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="hours">Hours</SelectItem>
                          <SelectItem value="days">Days</SelectItem>
                          <SelectItem value="weeks">Weeks</SelectItem>
                          <SelectItem value="months">Months</SelectItem>
                          <SelectItem value="years">Years</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="specifications"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Specifications (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g., I have 2 hours to study each weekday. Focus on practical applications." {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                          {getFormFileDisplayName(watchedFile) || 'Click or drag to upload file'}
                        </Label>
                        <Controller
                          name="file"
                          control={form.control}
                          render={({ field: { onChange, onBlur, value, ref } }) => (
                            <Input
                              id="file-upload"
                              type="file"
                              accept=".pdf,image/*"
                              className="sr-only"
                              onBlur={onBlur}
                              ref={ref}
                              onChange={(e) => {
                                onChange(e.target.files);
                              }}
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

              <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                {isLoading ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Generating Plan...
                  </>
                ) : (
                  'Generate Study Plan'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {studyPlan && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Your Study Plan for "{form.getValues('topic') || 'your uploaded document'}"</CardTitle>
              <CardDescription>A step-by-step guide to help you succeed.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={downloadPdf} variant="outline" size="sm">
                <FileDown className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
              {driveConnected && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={savingPlanPdfToDrive}
                  onClick={() => void saveStudyPlanPdfToDrive()}
                >
                  {savingPlanPdfToDrive ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Save to Drive
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Duration</TableHead>
                  <TableHead>Topic / Concept</TableHead>
                  <TableHead>Tasks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studyPlan.plan.map((item, index) => (
                  <TableRow key={`${item.duration}-${index}`}>
                    <TableCell className="font-medium">{item.duration}</TableCell>
                    <TableCell>{item.topic}</TableCell>
                    <TableCell>
                      <ul className="list-disc space-y-1 pl-4">
                        {item.tasks.map((task, i) => (
                          <li key={i}>{task}</li>
                        ))}
                      </ul>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-4 text-xs text-muted-foreground">{studyPlan.progress}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

