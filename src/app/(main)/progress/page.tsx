
'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, getDocs } from 'firebase/firestore';
import { FileDown, Loader, BarChart, Clock, Award, PieChart as PieChartIcon, FileText } from 'lucide-react';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart, Cell, ResponsiveContainer, BarChart as HorizontalBarChart } from 'recharts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { toPng } from 'html-to-image';
import { embedWebFonts } from '@/lib/utils';
import { ChartToolbar } from '@/components/app/chart-toolbar';
import PageHeader from '@/components/app/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';


interface QuizAttempt {
  id: string;
  quizName: string;
  score: number;
  totalQuestions: number;
  subjectId: string;
  attemptedAt: {
    seconds: number;
  };
}

interface PaperResult {
  id: string;
  topic: string;
  score: number;
  total: number;
  subject: string;
  createdAt: {
    seconds: number;
  };
}

interface StudySession {
  id: string;
  topic: string;
  duration: number;
  date: {
    seconds: number;
  };
  subjectId: string;
}

export default function ProgressPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const quizAttemptsQuery = useMemoFirebase(
    () => (user && firestore ? query(collection(firestore, 'users', user.uid, 'quizAttempts'), orderBy('attemptedAt', 'desc')) : null),
    [user, firestore]
  );
  const { data: quizAttempts, isLoading: attemptsLoading } = useCollection<QuizAttempt>(quizAttemptsQuery);

  const studySessionsQuery = useMemoFirebase(
    () => (user && firestore ? query(collection(firestore, 'users', user.uid, 'studySessions'), orderBy('date', 'desc')) : null),
    [user, firestore]
  );
  const { data: studySessions, isLoading: sessionsLoading } = useCollection<StudySession>(studySessionsQuery);

  const userDocRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'users', user.uid) : null),
    [user, firestore]
  );
  const { data: userProfile } = useDoc(userDocRef);

  const [paperResults, setPaperResults] = useState<PaperResult[]>([]);
  const [paperResultsLoading, setPaperResultsLoading] = useState(true);

  const [quizChartData, setQuizChartData] = useState<any[]>([]);
  const [studyChartData, setStudyChartData] = useState<any[]>([]);
  const [paperChartData, setPaperChartData] = useState<any[]>([]);
  const [performanceBarData, setPerformanceBarData] = useState<any[]>([]);

  const [totalStudyTime, setTotalStudyTime] = useState(0);
  const [averageScore, setAverageScore] = useState(0);

  useEffect(() => {
    if (quizAttempts) {
      const subjectScores: { [key: string]: { totalScore: number; count: number } } = {};

      quizAttempts.forEach(attempt => {
        const subject = attempt.subjectId || 'General';
        if (!subjectScores[subject]) {
          subjectScores[subject] = { totalScore: 0, count: 0 };
        }
        subjectScores[subject].totalScore += (attempt.score / attempt.totalQuestions) * 100;
        subjectScores[subject].count += 1;
      });

      const data = Object.keys(subjectScores).map(subject => ({
        subject,
        averageScore: subjectScores[subject].totalScore / subjectScores[subject].count,
      }));
      setQuizChartData(data);

      const totalScoreSum = quizAttempts.reduce((acc, attempt) => acc + (attempt.score / attempt.totalQuestions) * 100, 0);
      setAverageScore(quizAttempts.length > 0 ? totalScoreSum / quizAttempts.length : 0);
    }
  }, [quizAttempts]);

  useEffect(() => {
    if (studySessions) {
      const totalMinutes = studySessions.reduce((acc, session) => acc + session.duration, 0);
      setTotalStudyTime(totalMinutes);

      const studyTimeBySubject = studySessions.reduce((acc, session) => {
        const subject = session.subjectId || 'General';
        acc[subject] = (acc[subject] || 0) + session.duration;
        return acc;
      }, {} as Record<string, number>);

      const studyData = Object.entries(studyTimeBySubject).map(([subject, minutes]) => ({ subject, minutes }));
      setStudyChartData(studyData);
    }
  }, [studySessions]);

  useEffect(() => {
    async function fetchPaperResults() {
      if (!user) return;
      setPaperResultsLoading(true);
      const papersRef = collection(firestore, 'users', user.uid, 'papers');
      const papersSnapshot = await getDocs(query(papersRef, orderBy('createdAt', 'desc')));
      const results: PaperResult[] = papersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaperResult));
      setPaperResults(results);

      const paperDataBySubject = results.reduce((acc, paper) => {
        const subject = paper.subject || 'General';
        if (!acc[subject]) {
          acc[subject] = { totalScore: 0, count: 0 };
        }
        acc[subject].totalScore += (paper.score / paper.total) * 100;
        acc[subject].count += 1;
        return acc;
      }, {} as Record<string, { totalScore: number; count: number }>);

      const paperChart = Object.entries(paperDataBySubject).map(([subject, data]) => ({ subject, averageScore: data.totalScore / data.count }));
      setPaperChartData(paperChart);

      setPaperResultsLoading(false);
    }
    fetchPaperResults();
  }, [user, firestore]);

  useEffect(() => {
    const allScores = [
      ...(quizAttempts || []).map(a => (a.score / a.totalQuestions) * 100),
      ...(paperResults || []).map(p => (p.score / p.total) * 100),
    ];

    if (allScores.length > 0) {
      const excellent = allScores.filter(s => s >= 80).length;
      const good = allScores.filter(s => s >= 60 && s < 80).length;
      const needsImprovement = allScores.filter(s => s < 60).length;

      setPerformanceBarData([
        { name: 'Excellent (80%+)', count: excellent, fill: 'hsl(var(--chart-1))' },
        { name: 'Good (60-79%)', count: good, fill: 'hsl(var(--chart-2))' },
        { name: 'Needs Improvement (<60%)', count: needsImprovement, fill: 'hsl(var(--chart-3))' },
      ]);
    }
  }, [quizAttempts, paperResults]);

  const CustomLegend = (props: any) => {
    const { payload } = props;
    return (
      <ul className="flex justify-center gap-4 mt-4 text-sm">
        {payload.map((entry: any, index: number) => (
          <li key={`item-${index}`} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.payload.fill }}></span>
            <span>{entry.payload.name}</span>
          </li>
        ))}
      </ul>
    );
  };


  const downloadPdf = async () => {
    if (!user) return;
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const margin = { top: 60, right: 20, bottom: 20, left: 20 };

    const addHeaderFooter = (data: any) => {
      const pageNum = data.pageNumber;
      const totalPages = (doc as any).internal.getNumberOfPages();
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
      doc.text('Progress Report', pageWidth / 2, 35, { align: 'center' });
      doc.setFontSize(11);
      doc.text(`Student: ${userProfile?.fullName || 'Student'}`, margin.left, 45);
      doc.text(`Report Date: ${new Date().toLocaleDateString()}`, pageWidth - margin.right, 45, { align: 'right' });
      // Footer
      doc.setFontSize(10);
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    };

    (doc as any).autoTable({
      startY: margin.top,
      head: [['Metric', 'Value']],
      body: [
        ['Total Quizzes Taken', quizAttempts?.length ?? 0],
        ['Average Score', `${averageScore.toFixed(2)}%`],
        ['Total Study Time', `${Math.floor(totalStudyTime / 60)}h ${totalStudyTime % 60}m`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [63, 81, 181] },
      didDrawPage: addHeaderFooter,
      margin: { ...margin, top: 60 }
    });

    // Embed fonts before capturing charts to avoid CORS issues.
    await embedWebFonts();

    const chartElements = [
      { id: 'quiz-chart', title: 'Quiz Performance by Subject' },
      { id: 'study-chart', title: 'Study Time by Subject' },
      { id: 'paper-chart', title: 'Paper Performance by Subject' },
      { id: 'performance-bar-chart', title: 'Overall Performance Distribution' }
    ];

    for (const chart of chartElements) {
      const chartElement = document.getElementById(chart.id);
      if (chartElement) {
        try {
          const imgData = await toPng(chartElement, {
            quality: 0.95,
            backgroundColor: 'white',
            pixelRatio: 2,
          });

          const imgWidth = pageWidth - margin.left - margin.right;
          const imgHeight = (chartElement.offsetHeight * imgWidth) / chartElement.offsetWidth;

          let yPos = (doc as any).autoTable.previous.finalY + 15;
          if (yPos + imgHeight > pageHeight - margin.bottom) {
            doc.addPage();
            yPos = margin.top;
          }
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text(chart.title, margin.left, yPos - 5);
          doc.addImage(imgData, 'PNG', margin.left, yPos, imgWidth, imgHeight);
          (doc as any).autoTable.previous.finalY = yPos + imgHeight;
        } catch (error) {
          console.error(`Could not generate ${chart.id} image`, error);
        }
      }
    }


    const finalPageCount = (doc as any).internal.getNumberOfPages();
    for (let j = 1; j <= finalPageCount; j++) {
      doc.setPage(j);
      addHeaderFooter({ pageNumber: j });
    }

    doc.save('progress-report.pdf');
  };

  const isLoading = isUserLoading || attemptsLoading || sessionsLoading || paperResultsLoading;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-4">
        <PageHeader
          title="Your Progress"
          description="Track your quiz scores, study time, and subject mastery."
        />
      </div>
      {isLoading ? (
        <div className='flex items-center justify-center p-8'>
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Study Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.floor(totalStudyTime / 60)}h {totalStudyTime % 60}m
                </div>
                <p className="text-xs text-muted-foreground">
                  Across {studySessions?.length ?? 0} sessions
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Quiz Score</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{averageScore.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">
                  From {quizAttempts?.length ?? 0} quizzes
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Subjects Mastered</CardTitle>
                <BarChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {quizChartData.filter(d => d.averageScore >= 80).length} / {quizChartData.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Based on an 80% score threshold
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className='flex-row items-center justify-between'>
                <ChartToolbar title="Quiz Performance by Subject" description="Your average score for each subject." icon={BarChart} />
              </CardHeader>
              <CardContent>
                {quizChartData.length > 0 ? (
                  <div id="quiz-chart" className='bg-background p-4 rounded-md'>
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={quizChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="subject" tickLine={false} tickMargin={10} axisLine={false} />
                        <YAxis unit="%" />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="averageScore" name="Average Score" barSize={30} fill="var(--color-chart-1)" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No quiz data available yet. Take a quiz to see your progress!</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='flex-row items-center justify-between'>
                <ChartToolbar title="Study Time by Subject" icon={Clock} />
              </CardHeader>
              <CardContent>
                {studyChartData.length > 0 ? (
                  <div id="study-chart" className="bg-background p-4 rounded-md">
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={studyChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="subject" tick={{ fontSize: 12 }} />
                        <YAxis label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="minutes" name="Minutes" barSize={30} fill="var(--color-chart-2)" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className='text-sm text-muted-foreground'>No study sessions logged yet. Use the Study Timer!</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className='flex-row items-center justify-between'>
                <ChartToolbar title="Paper Performance by Subject" description="Your average score on generated papers." icon={FileText} />
              </CardHeader>
              <CardContent>
                {paperChartData.length > 0 ? (
                  <div id="paper-chart" className='bg-background p-4 rounded-md'>
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={paperChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="subject" tickLine={false} tickMargin={10} axisLine={false} />
                        <YAxis unit="%" />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="averageScore" name="Average Score" barSize={30} fill="var(--color-chart-3)" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No paper results available. Generate and submit a paper to see your progress!</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className='flex-row items-center justify-between'>
                <ChartToolbar title="Overall Performance" description="Distribution of scores across all assessments." icon={PieChartIcon} />
              </CardHeader>
              <CardContent>
                {performanceBarData.some(d => d.count > 0) ? (
                  <div id="performance-bar-chart" className="bg-background p-4 rounded-md">
                    <ResponsiveContainer width="100%" height={300}>
                      <HorizontalBarChart layout="vertical" data={performanceBarData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                        <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} />
                        <Legend content={<CustomLegend />} />
                        <Bar dataKey="count" name="Assessments" barSize={20}>
                          {performanceBarData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </HorizontalBarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>Not enough data for a performance summary. Complete a few quizzes or papers!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button onClick={downloadPdf} variant="outline">
              <FileDown className="mr-2 h-4 w-4" />
              Download Full Report
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
