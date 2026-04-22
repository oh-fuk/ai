
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useUser, useFirestore, useMemoFirebase, useCollection, useDoc, errorEmitter, FirestorePermissionError, addDocumentNonBlocking } from '@/firebase';
import {
  collection,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Loader, Bot, User as UserIcon, Copy, Trash2, Pencil, Plus, MessageSquare, PanelLeft, Search, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateChatResponse } from '@/ai/flows/generate-chat-response';
import { generateChatTitle } from '@/ai/flows/generate-chat-title';
import { generateQuizFromChat } from '@/ai/flows/generate-quiz-from-chat';
import { generatePaperFromPrompt } from '@/ai/flows/generate-paper-from-prompt';
import { TypingDots } from '@/components/app/ai-loading';
import { cn } from '@/lib/utils';
import { useNotification } from '@/context/notification-context';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Image from 'next/image';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  createdAt: { seconds: number };
  userId: string;
  isAction?: boolean;
  actionContent?: any;
}

interface ChatSession {
  id: string;
  topic: string;
  createdAt: { seconds: number };
  userId: string;
}

function ChatHistorySidebar({
  sessions,
  sessionsLoading,
  activeSessionId,
  onSessionSelect,
  onNewChat,
  onRename,
  onDelete,
}: {
  sessions: ChatSession[] | null;
  sessionsLoading: boolean;
  activeSessionId: string | null;
  onSessionSelect: (id: string) => void;
  onNewChat: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSessions = useMemo(() => {
    if (!sessions) return [];
    if (!searchTerm.trim()) return sessions;
    return sessions.filter(session =>
      session.topic.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sessions, searchTerm]);


  return (
    <div className="flex flex-col h-full bg-card border-r">
      <CardHeader className="p-4 border-b flex-shrink-0">
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-lg font-semibold tracking-tight'>Chat History</h2>
          <Button variant="outline" size="icon" onClick={onNewChat} className="h-8 w-8">
            <Plus className="h-4 w-4" />
            <span className="sr-only">New Chat</span>
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="p-2 flex-1 overflow-y-auto scrollbar-hide">

        {sessionsLoading ? (
          <div className="p-4 text-center text-muted-foreground">Loading chats...</div>
        ) : (
          <div className="space-y-1">
            {filteredSessions.map((session) => (
              <ChatHistoryItem
                key={session.id}
                session={session}
                isActive={activeSessionId === session.id}
                onSelect={() => onSessionSelect(session.id)}
                onRename={onRename}
                onDelete={onDelete}
              />
            ))}
            {filteredSessions.length === 0 && (
              <div className="p-4 text-center text-muted-foreground text-sm">
                {searchTerm ? "No chats found." : "No chat history yet."}
              </div>
            )}
          </div>
        )}

      </CardContent>
    </div>
  );
}


export default function ChatPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { setNotification } = useNotification();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isHistorySheetOpen, setIsHistorySheetOpen] = useState(false);

  const sessionsQuery = useMemoFirebase(() => user ? query(collection(firestore, 'users', user.uid, 'chatSessions'), orderBy('createdAt', 'desc')) : null, [user, firestore]);
  const { data: sessions, isLoading: sessionsLoading } = useCollection<ChatSession>(sessionsQuery);

  const subjectsQuery = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'subjects') : null, [user, firestore]);
  const { data: subjects } = useCollection(subjectsQuery);
  const quizAttemptsQuery = useMemoFirebase(() => user ? query(collection(firestore, 'users', user.uid, 'quizAttempts'), orderBy('attemptedAt', 'desc')) : null, [user, firestore]);
  const { data: quizAttempts } = useCollection(quizAttemptsQuery);
  const papersColRef = useMemoFirebase(() => user ? query(collection(firestore, 'users', user.uid, 'papers'), orderBy('createdAt', 'desc')) : null, [user, firestore]);
  const { data: paperResults } = useCollection(papersColRef);
  const plansColRef = useMemoFirebase(() => user ? query(collection(firestore, 'users', user.uid, 'studyPlans'), orderBy('createdAt', 'desc')) : null, [user, firestore]);
  const { data: studyPlans } = useCollection(plansColRef);
  const tasksQuery = useMemoFirebase(() => user ? query(collection(firestore, 'users', user.uid, 'tasks'), orderBy('createdAt', 'desc')) : null, [user, firestore]);
  const { data: tasks } = useCollection(tasksQuery);
  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
  const { data: userProfile } = useDoc(userDocRef);

  useEffect(() => {
    if (!user || isUserLoading || !firestore) return;
    const findOrCreateSession = async () => {
      setIsLoadingMessages(true);
      const userRef = doc(firestore, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();

      if (userData?.lastChatSessionId) {
        setSessionId(userData.lastChatSessionId);
      } else {
        await handleNewChat(true);
      }
      setIsLoadingMessages(false);
    };
    findOrCreateSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isUserLoading, firestore]);

  useEffect(() => {
    if (!sessionId || !user) {
      setMessages([]);
      setIsLoadingMessages(false);
      return;
    }

    setIsLoadingMessages(true);
    const messagesRef = collection(firestore, 'users', user.uid, 'chatSessions', sessionId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setMessages(newMessages);
      setIsLoadingMessages(false);
    }, (error) => {
      const contextualError = new FirestorePermissionError({
        operation: 'list',
        path: `users/${user.uid}/chatSessions/${sessionId}/messages`,
      });
      errorEmitter.emit('permission-error', contextualError);
      setIsLoadingMessages(false);
    });

    return () => unsubscribe();
  }, [sessionId, user, firestore]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      setTimeout(() => {
        scrollAreaRef.current?.scrollTo({
          top: scrollAreaRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [messages, isSending]);

  const handleSendMessage = async (prompt: string) => {
    if (!prompt.trim() || !user) return;

    let currentSessionId = sessionId;
    const isFirstMessageInNewChat = !currentSessionId || messages.length === 0;

    setIsSending(true);

    if (isFirstMessageInNewChat) {
      const newId = await handleNewChat(true); // Create and switch to the new chat
      if (!newId) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not create a new chat session.' });
        setIsSending(false);
        return;
      }
      currentSessionId = newId;
    }

    if (!currentSessionId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Chat session ID is missing.' });
      setIsSending(false);
      return;
    }

    setNotification('chat', true);

    const messagesRef = collection(firestore, `users/${user.uid}/chatSessions/${currentSessionId}/messages`);

    const userMessage: Omit<ChatMessage, 'id' | 'createdAt'> & { createdAt: any } = {
      role: 'user' as const,
      content: prompt,
      createdAt: serverTimestamp(),
      userId: user.uid,
    };

    await addDoc(messagesRef, userMessage).catch(serverError => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: messagesRef.path,
        operation: 'create',
        requestResourceData: userMessage
      }));
    });

    setInput('');

    if (isFirstMessageInNewChat && currentSessionId && !prompt.toLowerCase().startsWith('make quiz of topic:') && !prompt.toLowerCase().startsWith('make paper of topic:')) {
      try {
        const titleResult = await generateChatTitle({ prompt });
        const title = titleResult.title;
        const sessionRef = doc(firestore, 'users', user.uid, 'chatSessions', currentSessionId);
        await updateDoc(sessionRef, { topic: title });
      } catch (error) {
        console.warn("Could not auto-generate chat title:", error);
      }
    }

    // In-chat generation logic
    if (prompt.toLowerCase().startsWith('make quiz of topic:')) {
      const topic = prompt.substring('make quiz of topic:'.length).trim();
      if (topic) {
        try {
          if (isFirstMessageInNewChat && currentSessionId) {
            const sessionRef = doc(firestore, 'users', user.uid, 'chatSessions', currentSessionId);
            await updateDoc(sessionRef, { topic: `Quiz: ${topic}` });
          }
          const quizResult = await generateQuizFromChat({ topic, numberOfQuestions: 5 });
          await addDoc(messagesRef, { role: 'model', content: `Here is a 5-question quiz on "${topic}":`, isAction: true, actionContent: { type: 'quiz', data: quizResult }, createdAt: serverTimestamp(), userId: 'model' });
        } catch (e) {
          await addDoc(messagesRef, { role: 'model', content: "Sorry, I couldn't generate a quiz on that topic right now.", createdAt: serverTimestamp(), userId: 'model' });
        } finally {
          setIsSending(false);
          setNotification('chat', false);
        }
        return;
      }
    }

    if (prompt.toLowerCase().startsWith('make paper of topic:')) {
      const topic = prompt.substring('make paper of topic:'.length).trim();
      if (topic) {
        try {
          if (isFirstMessageInNewChat && currentSessionId) {
            const sessionRef = doc(firestore, 'users', user.uid, 'chatSessions', currentSessionId);
            await updateDoc(sessionRef, { topic: `Paper: ${topic}` });
          }
          const paperResult = await generatePaperFromPrompt({ prompt: topic, mcqCount: 2, shortCount: 2, longCount: 1 });
          await addDoc(messagesRef, { role: 'model', content: `Here is a practice paper on "${topic}":`, isAction: true, actionContent: { type: 'paper', data: paperResult.paper }, createdAt: serverTimestamp(), userId: 'model' });
        } catch (e) {
          await addDoc(messagesRef, { role: 'model', content: "Sorry, I couldn't generate a paper on that topic right now.", createdAt: serverTimestamp(), userId: 'model' });
        } finally {
          setIsSending(false);
          setNotification('chat', false);
        }
        return;
      }
    }

    // Default chat response
    try {
      // COMPLETE CONTEXT: Send ALL student data (no summaries, no limits) so AI knows everything
      const contextData = {
        // Full student profile
        userProfile: {
          fullName: userProfile?.fullName,
          email: userProfile?.email,
          collegeName: userProfile?.collegeName,
          class: userProfile?.class,
          dateOfBirth: userProfile?.dateOfBirth,
          phoneNumber: userProfile?.phoneNumber,
          address: userProfile?.address,
          createdAt: userProfile?.createdAt,
          lastLogin: userProfile?.lastLogin,
        },
        // All enrolled subjects
        allSubjects: subjects?.map(s => ({ id: s.id, name: s.name })) || [],
        // COMPLETE quiz history (all attempts, all details - no limit)
        allQuizAttempts: quizAttempts?.map((q: any) => ({
          id: q.id,
          quizName: q.quizName,
          subject: q.subjectId,
          score: q.score,
          totalQuestions: q.totalQuestions,
          percentage: q.totalQuestions > 0 ? ((q.score / q.totalQuestions) * 100).toFixed(2) : 0,
          attemptedAt: q.attemptedAt,
          duration: q.duration,
          timePerQuestion: q.totalQuestions > 0 ? ((q.duration || 0) / q.totalQuestions).toFixed(2) : 0,
          wrongAnswers: q.totalQuestions - q.score,
          correctAnswers: q.score,
          // Include detailed question-wise performance if available
          questionDetails: q.questionDetails || [],
        })) || [],
        // COMPLETE paper results (all papers, all details - no limit)
        allPaperResults: paperResults?.map((p: any) => ({
          id: p.id,
          topic: p.topic,
          subject: p.subject,
          score: p.score,
          totalMarks: p.total,
          percentage: p.total > 0 ? ((p.score / p.total) * 100).toFixed(2) : 0,
          createdAt: p.createdAt,
          difficulty: p.difficulty,
          numberOfQuestions: p.numberOfQuestions,
          mcqScore: p.mcqScore,
          shortScore: p.shortScore,
          longScore: p.longScore,
          mcqCount: p.mcqCount,
          shortCount: p.shortCount,
          longCount: p.longCount,
          // Include detailed answers if available
          detailedAnswers: p.detailedAnswers || [],
          userAnswers: p.userAnswers || [],
          correctAnswers: p.correctAnswers || [],
          explanations: p.explanations || [],
        })) || [],
        // COMPLETE study plans (all plans with full details)
        allStudyPlans: studyPlans?.map((p: any) => ({
          id: p.id,
          name: p.name,
          subject: p.subject,
          createdAt: p.createdAt,
          startDate: p.startDate,
          endDate: p.endDate,
          tasks: p.tasks || [],
          progress: p.progress,
          completed: p.completed,
          notes: p.notes,
        })) || [],
        // Summary of mistakes/weak areas for quick analysis
        performanceSummary: {
          totalQuizzesTaken: quizAttempts?.length || 0,
          averageQuizScore: (quizAttempts && quizAttempts.length > 0)
            ? (quizAttempts.reduce((sum: number, q: any) => sum + (q.score / q.totalQuestions * 100), 0) / quizAttempts.length).toFixed(2)
            : '0',
          totalPapersTaken: paperResults?.length || 0,
          averagePaperScore: (paperResults && paperResults.length > 0)
            ? (paperResults.reduce((sum: number, p: any) => sum + (p.score / p.total * 100), 0) / paperResults.length).toFixed(2)
            : '0',
          weakestSubjects: (subjects && subjects.length > 0) ? subjects.map(s => {
            const subjectQuizzes = quizAttempts?.filter((q: any) => q.subjectId === s.id) || [];
            return {
              subject: s.name,
              avgQuizScore: subjectQuizzes.length > 0
                ? (subjectQuizzes.reduce((sum: number, q: any) => sum + (q.score / q.totalQuestions * 100), 0) / subjectQuizzes.length).toFixed(2)
                : 'N/A',
              paperCount: paperResults?.filter((p: any) => p.subject === s.id).length || 0,
            };
          }) : [],
        },
        // COMPLETE tasks list
        allTasks: tasks?.map((t: any) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          completed: t.completed,
          priority: t.priority,
          createdAt: t.createdAt,
        })) || [],
      };

      const history = messages.map(({ role, content, userId }) => ({ role, content, userId: userId || user.uid }));

      const aiResult = await generateChatResponse({
        prompt: prompt,
        history: history,
        context: JSON.stringify(contextData, null, 2),
      });

      // If the server returned an error string (our server wrapper returns "Error: ..."),
      // surface that to the user and add a helpful model message rather than letting the client show a generic "Failed to fetch".
      if (typeof aiResult === 'string' && aiResult.startsWith('Error:')) {
        const errorText = aiResult.replace(/^Error:\s*/i, '') || 'An error occurred while generating the response.';
        const errorModelMessage = { role: 'model' as const, content: `Sorry — I couldn't generate a response right now. Reason: ${errorText}`, createdAt: serverTimestamp(), userId: 'model' };
        await addDoc(messagesRef, errorModelMessage).catch(serverError => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: messagesRef.path,
            operation: 'create',
            requestResourceData: errorModelMessage
          }));
        });
        toast({ variant: 'destructive', title: 'AI Error', description: errorText });
      } else {
        const modelMessage = { role: 'model' as const, content: aiResult, createdAt: serverTimestamp(), userId: 'model' };
        await addDoc(messagesRef, modelMessage).catch(serverError => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: messagesRef.path,
            operation: 'create',
            requestResourceData: modelMessage
          }));
        });
      }

    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to get a response from the AI.',
      });
    } finally {
      setIsSending(false);
      setNotification('chat', false);
    }
  };


  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage(input);
  };

  const handleNewChat = async (switchFocus: boolean = true) => {
    if (!user) return null;
    try {
      const newSessionRef = doc(collection(firestore, `users/${user.uid}/chatSessions`));
      await setDoc(newSessionRef, {
        userId: user.uid,
        topic: 'New Conversation',
        createdAt: serverTimestamp(),
      });
      if (switchFocus) {
        setSessionId(newSessionRef.id);
      }
      const userRef = doc(firestore, 'users', user.uid);
      await updateDoc(userRef, { lastChatSessionId: newSessionRef.id });
      toast({ title: 'New chat started.' });
      return newSessionRef.id;
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ operation: 'create', path: `users/${user.uid}/chatSessions` }));
      return null;
    }
  };

  const handleSessionSelect = (selectedSessionId: string) => {
    if (user) {
      setSessionId(selectedSessionId);
      const userRef = doc(firestore, 'users', user.uid);
      updateDoc(userRef, { lastChatSessionId: selectedSessionId });
      setIsHistorySheetOpen(false);
    }
  };

  const handleRenameSession = async (sessionIdToRename: string, newName: string) => {
    if (!user || !newName.trim()) return;
    const sessionRef = doc(firestore, 'users', user.uid, 'chatSessions', sessionIdToRename);
    await updateDoc(sessionRef, { topic: newName });
    toast({ title: 'Chat renamed!' });
  };

  const handleDeleteSession = async (sessionIdToDelete: string) => {
    if (!user) return;
    const sessionRef = doc(firestore, 'users', user.uid, 'chatSessions', sessionIdToDelete);
    await deleteDoc(sessionRef);

    const messagesRef = collection(firestore, 'users', user.uid, 'chatSessions', sessionIdToDelete, 'messages');
    const messagesSnap = await getDocs(messagesRef);
    const batch = writeBatch(firestore);
    messagesSnap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    if (sessionId === sessionIdToDelete) {
      await handleNewChat(true);
    }
    toast({ title: 'Chat deleted!' });
  };

  const handleClearConversation = async () => {
    if (!user || !sessionId) return;
    const messagesRef = collection(firestore, 'users', user.uid, 'chatSessions', sessionId, 'messages');

    try {
      const messagesSnap = await getDocs(messagesRef);
      if (messagesSnap.empty) {
        toast({ description: "Conversation is already empty." });
        return;
      }
      const batch = writeBatch(firestore);
      messagesSnap.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      toast({ title: "Conversation Cleared", description: "All messages have been deleted from this chat." });
    } catch (error) {
      console.error("Error clearing conversation:", error);
      toast({ variant: 'destructive', title: 'Error', description: "Could not clear the conversation." });
    }
  }

  const historySidebarProps = {
    sessions,
    sessionsLoading,
    activeSessionId: sessionId,
    onSessionSelect: handleSessionSelect,
    onNewChat: () => handleNewChat(true),
    onRename: handleRenameSession,
    onDelete: handleDeleteSession,
  };

  const promptSuggestions = [
    { text: "Make quiz of topic: ", action: () => setInput("Make quiz of topic: ") },
    { text: "Make paper of topic: ", action: () => setInput("Make paper of topic: ") },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] h-full overflow-hidden">
      <Sheet open={isHistorySheetOpen} onOpenChange={setIsHistorySheetOpen}>
        <SheetContent side="left" className="p-0 w-80 bg-background md:hidden">
          <SheetHeader>
            <SheetTitle className="sr-only">Chat History</SheetTitle>
          </SheetHeader>
          <ChatHistorySidebar {...historySidebarProps} />
        </SheetContent>
      </Sheet>

      <div className='hidden md:block h-full overflow-hidden'>
        <ChatHistorySidebar {...historySidebarProps} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden h-full">
        <CardHeader className="border-b p-4 flex-row items-center justify-between flex-shrink-0">
          <div className='flex items-center gap-2'>
            <Button variant="ghost" size="icon" className='md:hidden' onClick={() => setIsHistorySheetOpen(true)}>
              <PanelLeft className='h-5 w-5' />
            </Button>
            <CardTitle className="truncate text-base">
              {sessions?.find(s => s.id === sessionId)?.topic || 'Chat'}
            </CardTitle>
          </div>
          <div className='flex items-center gap-1'>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Trash2 className='h-5 w-5' />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Conversation?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete all messages in this chat? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearConversation}>
                    Clear
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 overflow-y-auto scrollbar-hide" ref={scrollAreaRef}>
          <div className="space-y-6 p-4">
            {isUserLoading || isLoadingMessages ? (
              <div className="flex justify-center items-center h-full pt-16"><Loader className="animate-spin" /></div>
            ) : (
              messages.map((msg) => (
                <ChatMessageItem
                  key={msg.id}
                  message={msg}
                />
              ))
            )}
            {isSending && <ChatMessageItem key="sending" message={{ role: 'model', content: '' }} isLoading />}
            {messages.length === 0 && !isLoadingMessages && !isSending && (
              <div className="text-center text-muted-foreground pt-8 flex flex-col items-center">
                <div className="bg-primary/10 p-4 rounded-full">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <p className="text-lg font-medium mt-4">Start a conversation with AthenaAI</p>
                <p className="text-sm">Ask a question or try one of the suggestions below.</p>


                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8 w-full max-w-2xl">
                  <Card className="p-4 hover:bg-muted cursor-pointer" onClick={promptSuggestions[0].action}>
                    <p className="text-sm font-medium text-foreground">{promptSuggestions[0].text}[Your Topic Here]</p>
                  </Card>
                  <Card className="p-4 hover:bg-muted cursor-pointer" onClick={promptSuggestions[1].action}>
                    <p className="text-sm font-medium text-foreground">{promptSuggestions[1].text}[Your Topic Here]</p>
                  </Card>
                </div>

              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="pt-4 border-t flex flex-col items-start gap-2 flex-shrink-0">
          <form onSubmit={handleFormSubmit} className="flex w-full items-center space-x-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={"Ask a question..."}
              disabled={isSending || isUserLoading}
            />
            <Button type="submit" disabled={isSending || !input.trim()}>
              {isSending ? <Loader className="animate-spin" /> : <Send />}
            </Button>
          </form>
        </CardFooter>
      </div>
    </div>
  );
}

function ChatHistoryItem({ session, isActive, onSelect, onRename, onDelete }: { session: ChatSession, isActive: boolean, onSelect: () => void, onRename: (id: string, name: string) => void, onDelete: (id: string) => void }) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(session.topic);

  const handleRename = () => {
    onRename(session.id, newName);
    setIsRenaming(false);
  };

  useEffect(() => {
    setNewName(session.topic);
  }, [session.topic]);

  return (
    <div
      className={cn(
        'group flex items-center justify-between p-2 rounded-md cursor-pointer',
        isActive ? 'bg-primary/10' : 'hover:bg-muted'
      )}
      onClick={!isRenaming ? onSelect : undefined}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <MessageSquare className="h-4 w-4 flex-shrink-0" />
        {isRenaming ? (
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            className="h-7 text-sm bg-transparent"
            autoFocus
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className={cn("truncate text-sm font-medium", isActive ? "text-primary" : "text-card-foreground")}>{session.topic}</span>
        )}
      </div>
      <div className="flex-shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
        {!isRenaming && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setIsRenaming(true); }}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={e => e.stopPropagation()}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Chat?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{session.topic}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function ChatMessageItem({ message, isLoading }: { message: Partial<ChatMessage>, isLoading?: boolean }) {
  const { toast } = useToast();
  const isModel = message.role === 'model';

  const handleCopy = async () => {
    if (!message.content) return;

    const safeCopy = async (text: string) => {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (e) {
        // ignore and fall back
      }

      // Fallback: create a temporary textarea and use execCommand('copy')
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        // Prevent scrolling to bottom
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(ta);
        return successful;
      } catch (e) {
        return false;
      }
    };

    const ok = await safeCopy(message.content);
    if (ok) {
      toast({ title: 'Copied to clipboard!' });
    } else {
      toast({ variant: 'destructive', title: 'Copy failed', description: 'Could not copy to clipboard in this browser.' });
    }
  };

  const formattedContent = (text: string) => {
    // Protect code blocks first
    const codeBlocks: { [key: string]: string } = {};
    // small helper to escape HTML inside code blocks
    const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    let tempText = text.replace(/```([\s\S]*?)```/g, (match, content) => {
      const id = `__CODEBLOCK_${Object.keys(codeBlocks).length}__`;
      // Wrap code blocks in a bordered container so generated code is visually separated
      codeBlocks[id] = `<div class="border rounded-md p-3 bg-muted/5 overflow-auto"><pre class="m-0"><code class=\"font-mono text-sm\">${escapeHtml(content)}</code></pre></div>`;
      return id;
    });

    // Split by newlines, then wrap paragraphs and lists
    const paragraphs = tempText.split('\n').map(line => line.trim());
    let html = '';
    let inList = false;

    paragraphs.forEach(line => {
      if (line.startsWith('- ')) {
        if (!inList) {
          html += '<ul>';
          inList = true;
        }
        html += `<li>${line.substring(2)}</li>`;
      } else {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        if (line) {
          html += `<p>${line}</p>`;
        }
      }
    });

    if (inList) {
      html += '</ul>';
    }

    let finalHtml = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Restore code blocks
    Object.entries(codeBlocks).forEach(([id, code]) => {
      finalHtml = finalHtml.replace(id, code);
    });

    return finalHtml;
  };


  return (
    <div className={cn("flex items-start gap-4 group", isModel ? "" : "justify-end")}>
      {isModel && (
        <Avatar className="h-8 w-8 border shrink-0">
          <Bot className="h-full w-full p-1" />
        </Avatar>
      )}

      <div className={cn("flex flex-col gap-1", isModel ? "max-w-[85%]" : "max-w-[85%] items-end")}>
        <div className={cn("flex items-center gap-2", isModel ? '' : 'flex-row-reverse')}>
          <div
            className={cn(
              "rounded-lg p-3 text-sm whitespace-pre-wrap break-words",
              isModel ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"
            )}
          >
            {isLoading ? (
              <TypingDots className="py-1 px-1" />
            ) : message.isAction ? (
              <ActionableContent action={message.actionContent} />
            ) : (
              isModel ? (
                // Render organized AI response card for model replies to make sidebar responses more structured
                <OrganizedAIResponse raw={message.content} />
              ) : (
                // Render user's message sanitized and with bold first-line heading if present
                <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: formatMessageToHtml(String(message.content || '')) }} />
              )
            )}
          </div>
          {!isLoading && !message.isAction && (
            <div className="self-center flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}><Copy className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
      </div>

      {
        !isModel && (
          <Avatar className="h-8 w-8 border shrink-0">
            <UserIcon className="h-full w-full p-1" />
          </Avatar>
        )
      }
    </div >
  )
}

function ActionableContent({ action }: { action: any }) {
  if (!action || !action.type) return null;

  if (action.type === 'quiz') {
    return <InChatQuiz quizData={action.data} />;
  }

  if (action.type === 'paper') {
    return <InChatPaper paperData={action.data} />;
  }

  return null;
}

function InChatQuiz({ quizData }: { quizData: any }) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleAnswerChange = (qIndex: number, answer: string) => {
    setAnswers(prev => ({ ...prev, [qIndex]: answer }));
  };

  const handleSubmit = () => {
    setSubmitted(true);
  };

  const score = quizData.questions.reduce((acc: number, q: any, i: number) => {
    return answers[i] === q.correctAnswer ? acc + 1 : acc;
  }, 0);

  return (
    <div className="space-y-6">
      {quizData.questions.map((q: any, i: number) => (
        <div key={i} className="space-y-3">
          <p className="font-semibold">{i + 1}. {q.question}</p>
          <RadioGroup onValueChange={(value) => handleAnswerChange(i, value)} value={answers[i]} disabled={submitted}>
            {q.options.map((opt: string, j: number) => (
              <div key={j} className="flex items-center space-x-2">
                <RadioGroupItem value={opt} id={`chat_q${i}o${j}`} />
                <Label htmlFor={`chat_q${i}o${j}`}>{opt}</Label>
              </div>
            ))}
          </RadioGroup>
          {submitted && (
            <div className={`text-xs p-2 rounded-md ${answers[i] === q.correctAnswer ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {answers[i] === q.correctAnswer ? 'Correct!' : `Incorrect. Correct answer: ${q.correctAnswer}`}
            </div>
          )}
        </div>
      ))}
      {!submitted ? (
        <Button onClick={handleSubmit} disabled={Object.keys(answers).length !== quizData.questions.length}>Submit Quiz</Button>
      ) : (
        <div className="font-bold text-center p-2 bg-primary/10 rounded-md">
          Your Score: {score} / {quizData.questions.length}
        </div>
      )}
    </div>
  );
}

function InChatPaper({ paperData }: { paperData: any }) {
  return (
    <div className="space-y-6">
      {paperData.questions.map((q: any, i: number) => (
        <div key={i} className="space-y-2 p-3 border-b">
          <p className="font-semibold">{i + 1} ({q.type.toUpperCase()}). {q.question}</p>
          {q.type === 'mcq' && (
            <div className="text-xs text-muted-foreground pl-4">
              Options: {q.options.join(' | ')}
            </div>
          )}
          <p className="text-xs text-primary font-medium pl-4">Answer: {q.correctAnswer}</p>
        </div>
      ))}
    </div>
  );
}

// Helper: convert simple markdown-like chat text into safe HTML (used for both inline and organized views)
function formatMessageToHtml(text: string) {
  // Helper to escape HTML
  const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Keep code blocks intact but escaped
  const codeBlocks: { [key: string]: string } = {};
  let tempText = text.replace(/```([\s\S]*?)```/g, (match, content) => {
    const id = `__CODEBLOCK_${Object.keys(codeBlocks).length}__`;
    codeBlocks[id] = `<div class=\"border rounded-md p-3 bg-muted/5 overflow-auto\"><pre class=\"m-0\"><code class=\"font-mono text-sm\">${escapeHtml(content)}</code></pre></div>`;
    return id;
  });

  // Sanitize: remove unwanted symbols but keep basic punctuation
  // Allow letters, numbers, whitespace and common punctuation . , ? ! : ; ' " ( ) -
  const sanitizeLine = (ln: string) => {
    // Remove markdown heading markers (#), asterisks used for bullets, bullets like •, em-dashes, arrows, and emojis
    let s = ln.replace(/^\s*#\s*/, '');
    // Replace common bullet symbols and unusual punctuation with nothing
    s = s.replace(/[•→←➤—–•♦•◆✓✔️★☆•··•▪️©®™✓✦✶✷✸✹✺💡📝✳️]/g, '');
    // Remove any character that's not allowed (keep basic punctuation)
    s = s.replace(/[^\w\s\.,\?\!\:\;\'\"\(\)\-\/\%]/g, '');
    // Collapse repeated spaces
    s = s.replace(/\s{2,}/g, ' ').trim();
    return s;
  };

  // Split by newlines, then build HTML. Convert headings (lines starting with #/##/###) into bold paragraphs.
  const rawLines = tempText.split(/\r?\n/);
  let html = '';
  let inList = false;

  for (let rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) {
      if (inList) { html += '</div>'; inList = false; }
      html += '<div style="margin:6px 0;"></div>';
      continue;
    }

    // Heading detection (markdown-style) or explicit 'Action Plan' etc.
    const h1 = line.match(/^#\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h3 = line.match(/^###\s+(.*)/);

    if (h1 || h2 || h3) {
      const headingText = sanitizeLine((h1 && h1[1]) || (h2 && h2[1]) || (h3 && h3[1]) || line);
      html += `<p><strong>${headingText}</strong></p>`;
      continue;
    }

    // Lists: treat lines starting with '-' as normal paragraph but remove the '-' marker to avoid special characters
    if (/^[-*]\s+/.test(line)) {
      const content = sanitizeLine(line.replace(/^[-*]\s+/, ''));
      // Render list-like paragraph (without bullet symbol)
      html += `<p>${content}</p>`;
      continue;
    }

    // Regular paragraph: sanitize
    const para = sanitizeLine(line);
    html += `<p>${para}</p>`;
  }

  // Restore code blocks (escaped)
  Object.entries(codeBlocks).forEach(([id, codeHtml]) => {
    html = html.replace(id, codeHtml);
  });

  // Bold any markdown bold markers that survived (e.g., **bold**), then return
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  return html;
}

// Organized AI response component: renders a model reply as a neat card with title, summary, action plan, and key terms if available
function OrganizedAIResponse({ raw }: { raw?: string | null }) {
  const content = raw || '';

  // Extract first H1/H2-like title (lines starting with '# ' or '## ')
  const lines = content.split(/\r?\n/);
  let title: string | null = null;
  for (const line of lines) {
    const h1 = line.match(/^#\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    if (h1) { title = h1[1]; break; }
    if (h2) { title = h2[1]; break; }
  }

  // Extract Action Plan section (case-insensitive heading)
  const actionPlanMatch = content.match(/(^#+\s*action plan[\s\S]*?)(?=^#+\s|\z)/im);
  const actionPlan = actionPlanMatch ? actionPlanMatch[0].replace(/^#+\s*action plan\s*/i, '').trim() : null;

  // Extract Key Terms / Key Terms & Definitions section
  const keyTermsMatch = content.match(/(^#+\s*(key terms|key terms & definitions|key terms and definitions|key terms:) [\s\S]*?)(?=^#+\s|\z)/im);
  const keyTerms = keyTermsMatch ? keyTermsMatch[0].replace(/^#+\s*(key terms|key terms & definitions|key terms and definitions|key terms:)\s*/i, '').trim() : null;

  // Use the generic formatter for the main body (safe HTML)
  const bodyHtml = formatMessageToHtml(content);

  return (
    <div className="max-w-none">
      <Card className="bg-white border">
        <CardHeader className="p-3">
          <CardTitle className="text-sm font-semibold">{title || 'AI Response'}</CardTitle>
        </CardHeader>
        <CardContent className="p-3 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: bodyHtml }} />

        {(actionPlan || keyTerms) && (
          <CardFooter className="p-3 pt-0 w-full">
            {actionPlan && (
              <div className="mb-3">
                <div className="text-xs font-semibold text-foreground mb-1">Action Plan</div>
                <div className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: formatMessageToHtml(actionPlan) }} />
              </div>
            )}
            {keyTerms && (
              <div>
                <div className="text-xs font-semibold text-foreground mb-1">Key Terms</div>
                <div className="text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: formatMessageToHtml(keyTerms) }} />
              </div>
            )}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
