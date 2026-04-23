'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useUser, useFirestore, useMemoFirebase, useCollection, useDoc, errorEmitter, FirestorePermissionError, addDocumentNonBlocking } from '@/firebase';
import {
  collection, query, orderBy, addDoc, serverTimestamp,
  doc, getDoc, updateDoc, onSnapshot, setDoc, deleteDoc, getDocs, writeBatch,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Send, Loader, Copy, Trash2, Pencil, Plus, MessageSquare,
  PanelLeftClose, PanelLeftOpen, Search, Sparkles, Bot, User as UserIcon,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateChatResponse } from '@/ai/flows/generate-chat-response';
import { generateChatTitle } from '@/ai/flows/generate-chat-title';
import { generateQuizFromChat } from '@/ai/flows/generate-quiz-from-chat';
import { generatePaperFromPrompt } from '@/ai/flows/generate-paper-from-prompt';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TypingDots } from '@/components/app/ai-loading';
import { cn } from '@/lib/utils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

/* ─── Types ─────────────────────────────────────────────────────────────── */

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

/* ─── Chat history sidebar ───────────────────────────────────────────────── */

function ChatHistorySidebar({
  sessions, sessionsLoading, activeSessionId,
  onSessionSelect, onNewChat, onRename, onDelete,
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
    return sessions.filter(s => s.topic.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [sessions, searchTerm]);

  return (
    <div className="flex flex-col h-full bg-card border-r">
      <div className="p-3 border-b flex-shrink-0 space-y-2">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-semibold tracking-tight">Chats</h2>
          <Button variant="outline" size="icon" onClick={onNewChat} className="h-7 w-7">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-8 h-8 text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide p-1.5 space-y-0.5">
        {sessionsLoading ? (
          <div className="p-4 text-center text-muted-foreground text-sm">Loading...</div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            {searchTerm ? "No chats found." : "No chats yet."}
          </div>
        ) : filteredSessions.map(session => (
          <ChatHistoryItem
            key={session.id}
            session={session}
            isActive={activeSessionId === session.id}
            onSelect={() => onSessionSelect(session.id)}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Chat history item ──────────────────────────────────────────────────── */

function ChatHistoryItem({ session, isActive, onSelect, onRename, onDelete }: {
  session: ChatSession; isActive: boolean; onSelect: () => void;
  onRename: (id: string, name: string) => void; onDelete: (id: string) => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(session.topic);

  useEffect(() => { setNewName(session.topic); }, [session.topic]);

  const handleRename = () => { onRename(session.id, newName); setIsRenaming(false); };

  return (
    <div
      className={cn('group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer text-sm', isActive ? 'bg-primary/10' : 'hover:bg-muted')}
      onClick={!isRenaming ? onSelect : undefined}
    >
      <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
        <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        {isRenaming ? (
          <Input value={newName} onChange={e => setNewName(e.target.value)} onBlur={handleRename}
            onKeyDown={e => e.key === 'Enter' && handleRename()}
            className="h-6 text-xs bg-transparent px-1" autoFocus onClick={e => e.stopPropagation()} />
        ) : (
          <span className={cn("truncate font-medium", isActive ? "text-primary" : "text-foreground")}>{session.topic}</span>
        )}
      </div>
      <div className="flex-shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
        {!isRenaming && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); setIsRenaming(true); }}>
            <Pencil className="h-3 w-3" />
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={e => e.stopPropagation()}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Chat?</AlertDialogTitle>
              <AlertDialogDescription>Delete "{session.topic}"? This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={e => { e.stopPropagation(); onDelete(session.id); }}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

/* ─── Message item ───────────────────────────────────────────────────────── */

function ChatMessageItem({ message, isLoading }: { message: Partial<ChatMessage>; isLoading?: boolean }) {
  const isUser = message.role === 'user';
  const { toast } = useToast();

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      toast({ description: 'Copied to clipboard.' });
    }
  };

  return (
    <div className={cn("flex gap-3 group", isUser ? "flex-row-reverse" : "flex-row")}>
      <div className={cn("flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold", isUser ? "bg-primary" : "bg-muted border")}>
        {isUser ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4 text-primary" />}
      </div>
      <div className={cn("max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed", isUser ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm")}>
        {isLoading ? <TypingDots /> : (
          isUser ? (
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              className="prose prose-sm dark:prose-invert max-w-none break-words
                prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1
                prose-li:my-0.5 prose-code:bg-muted prose-code:px-1 prose-code:rounded
                prose-pre:bg-muted prose-pre:p-3 prose-pre:rounded-lg"
            >
              {message.content || ''}
            </ReactMarkdown>
          )
        )}
        {!isLoading && !isUser && message.content && (
          <button onClick={handleCopy} className="mt-1 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity">
            <Copy className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Main chat page ─────────────────────────────────────────────────────── */

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
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // ── Firestore queries ──
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

  // ── Load last session on mount ──
  useEffect(() => {
    if (!user || isUserLoading || !firestore) return;
    const init = async () => {
      setIsLoadingMessages(true);
      const userSnap = await getDoc(doc(firestore, 'users', user.uid));
      const lastId = userSnap.data()?.lastChatSessionId;
      if (lastId) {
        setSessionId(lastId);
      } else {
        await createNewSession();
      }
      setIsLoadingMessages(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isUserLoading, firestore]);

  // ── Subscribe to messages ──
  useEffect(() => {
    if (!sessionId || !user) { setMessages([]); setIsLoadingMessages(false); return; }
    setIsLoadingMessages(true);
    const q = query(collection(firestore, 'users', user.uid, 'chatSessions', sessionId, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)));
      setIsLoadingMessages(false);
    }, () => setIsLoadingMessages(false));
    return () => unsub();
  }, [sessionId, user, firestore]);

  // ── Auto scroll ──
  useEffect(() => {
    setTimeout(() => scrollAreaRef.current?.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' }), 100);
  }, [messages, isSending]);

  // ── Create a new session (does NOT switch focus unless told to) ──
  const createNewSession = async (switchFocus = true): Promise<string | null> => {
    if (!user) return null;
    try {
      const ref = doc(collection(firestore, `users/${user.uid}/chatSessions`));
      await setDoc(ref, { userId: user.uid, topic: 'New Conversation', createdAt: serverTimestamp() });
      if (switchFocus) {
        setSessionId(ref.id);
        await updateDoc(doc(firestore, 'users', user.uid), { lastChatSessionId: ref.id });
      }
      return ref.id;
    } catch {
      return null;
    }
  };

  // ── New chat button ──
  const handleNewChat = async () => {
    const id = await createNewSession(true);
    if (id) toast({ title: 'New chat started.' });
  };

  // ── Select existing session ──
  const handleSessionSelect = (id: string) => {
    setSessionId(id);
    updateDoc(doc(firestore, 'users', user!.uid), { lastChatSessionId: id });
  };

  // ── Send message ──
  const handleSendMessage = async (prompt: string) => {
    if (!prompt.trim() || !user) return;

    // FIX: only create a new session if there is NO session at all
    // If session exists but is empty — reuse it, don't create a duplicate
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const newId = await createNewSession(true);
      if (!newId) { toast({ variant: 'destructive', title: 'Error', description: 'Could not create chat session.' }); return; }
      currentSessionId = newId;
    }

    setIsSending(true);
    setNotification('chat', true);
    setInput('');

    const messagesRef = collection(firestore, `users/${user.uid}/chatSessions/${currentSessionId}/messages`);
    const isFirstMessage = messages.length === 0;

    // Save user message
    await addDoc(messagesRef, { role: 'user', content: prompt, createdAt: serverTimestamp(), userId: user.uid })
      .catch(() => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: messagesRef.path, operation: 'create' })));

    // Auto-title on first message
    if (isFirstMessage && !prompt.toLowerCase().startsWith('make quiz of topic:') && !prompt.toLowerCase().startsWith('make paper of topic:')) {
      generateChatTitle({ prompt }).then(r => {
        updateDoc(doc(firestore, 'users', user.uid, 'chatSessions', currentSessionId!), { topic: r.title });
      }).catch(() => { });
    }

    // Quiz shortcut
    if (prompt.toLowerCase().startsWith('make quiz of topic:')) {
      const topic = prompt.substring('make quiz of topic:'.length).trim();
      if (topic) {
        try {
          if (isFirstMessage) updateDoc(doc(firestore, 'users', user.uid, 'chatSessions', currentSessionId), { topic: `Quiz: ${topic}` });
          const quizResult = await generateQuizFromChat({ topic, numberOfQuestions: 5 });
          await addDoc(messagesRef, { role: 'model', content: `Here is a 5-question quiz on "${topic}":`, isAction: true, actionContent: { type: 'quiz', data: quizResult }, createdAt: serverTimestamp(), userId: 'model' });
        } catch {
          await addDoc(messagesRef, { role: 'model', content: "Sorry, couldn't generate a quiz right now.", createdAt: serverTimestamp(), userId: 'model' });
        } finally { setIsSending(false); setNotification('chat', false); }
        return;
      }
    }

    // Paper shortcut
    if (prompt.toLowerCase().startsWith('make paper of topic:')) {
      const topic = prompt.substring('make paper of topic:'.length).trim();
      if (topic) {
        try {
          if (isFirstMessage) updateDoc(doc(firestore, 'users', user.uid, 'chatSessions', currentSessionId), { topic: `Paper: ${topic}` });
          const paperResult = await generatePaperFromPrompt({ prompt: topic, mcqCount: 2, shortCount: 2, longCount: 1 });
          await addDoc(messagesRef, { role: 'model', content: `Here is a practice paper on "${topic}":`, isAction: true, actionContent: { type: 'paper', data: paperResult.paper }, createdAt: serverTimestamp(), userId: 'model' });
        } catch {
          await addDoc(messagesRef, { role: 'model', content: "Sorry, couldn't generate a paper right now.", createdAt: serverTimestamp(), userId: 'model' });
        } finally { setIsSending(false); setNotification('chat', false); }
        return;
      }
    }

    // Normal AI response
    try {
      const contextData = {
        userProfile: { fullName: userProfile?.fullName, email: userProfile?.email, collegeName: userProfile?.collegeName, class: userProfile?.class },
        allSubjects: subjects?.map((s: any) => ({ id: s.id, name: s.name })) || [],
        allQuizAttempts: quizAttempts?.map((q: any) => ({ id: q.id, quizName: q.quizName, subject: q.subjectId, score: q.score, totalQuestions: q.totalQuestions, percentage: q.totalQuestions > 0 ? ((q.score / q.totalQuestions) * 100).toFixed(2) : 0, attemptedAt: q.attemptedAt })) || [],
        allPaperResults: paperResults?.map((p: any) => ({ id: p.id, topic: p.topic, subject: p.subject, score: p.score, totalMarks: p.total, percentage: p.total > 0 ? ((p.score / p.total) * 100).toFixed(2) : 0, createdAt: p.createdAt })) || [],
        allStudyPlans: studyPlans?.map((p: any) => ({ id: p.id, name: p.name, subject: p.subject, tasks: p.tasks || [] })) || [],
        allTasks: tasks?.map((t: any) => ({ id: t.id, title: t.title, completed: t.completed, priority: t.priority })) || [],
        performanceSummary: {
          totalQuizzesTaken: quizAttempts?.length || 0,
          averageQuizScore: quizAttempts?.length ? (quizAttempts.reduce((s: number, q: any) => s + (q.score / q.totalQuestions * 100), 0) / quizAttempts.length).toFixed(2) : '0',
          totalPapersTaken: paperResults?.length || 0,
        },
      };

      const history = messages.map(({ role, content, userId }) => ({ role, content, userId: userId || user.uid }));
      const aiResult = await generateChatResponse({ prompt, history, context: JSON.stringify(contextData, null, 2) });

      if (typeof aiResult === 'string' && aiResult.startsWith('Error:')) {
        const errorText = aiResult.replace(/^Error:\s*/i, '');
        await addDoc(messagesRef, { role: 'model', content: `Sorry — I couldn't generate a response right now. Reason: ${errorText}`, createdAt: serverTimestamp(), userId: 'model' });
        toast({ variant: 'destructive', title: 'AI Error', description: errorText });
      } else {
        await addDoc(messagesRef, { role: 'model', content: aiResult, createdAt: serverTimestamp(), userId: 'model' });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to get a response from the AI.' });
    } finally {
      setIsSending(false);
      setNotification('chat', false);
    }
  };

  const handleRenameSession = async (id: string, name: string) => {
    if (!user || !name.trim()) return;
    await updateDoc(doc(firestore, 'users', user.uid, 'chatSessions', id), { topic: name });
    toast({ title: 'Chat renamed!' });
  };

  const handleDeleteSession = async (id: string) => {
    if (!user) return;
    await deleteDoc(doc(firestore, 'users', user.uid, 'chatSessions', id));
    const snap = await getDocs(collection(firestore, 'users', user.uid, 'chatSessions', id, 'messages'));
    const batch = writeBatch(firestore);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    if (sessionId === id) await createNewSession(true);
    toast({ title: 'Chat deleted!' });
  };

  const handleClearConversation = async () => {
    if (!user || !sessionId) return;
    const snap = await getDocs(collection(firestore, 'users', user.uid, 'chatSessions', sessionId, 'messages'));
    if (snap.empty) { toast({ description: 'Already empty.' }); return; }
    const batch = writeBatch(firestore);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    toast({ title: 'Conversation cleared.' });
  };

  const currentTopic = sessions?.find(s => s.id === sessionId)?.topic || 'Chat';

  return (
    // Full viewport height, no padding — sits directly under the app header
    <div className="flex h-full overflow-hidden">

      {/* ── Chat history sidebar ── */}
      <div className={cn(
        "flex-shrink-0 h-full border-r transition-all duration-300 overflow-hidden",
        sidebarOpen ? "w-[260px]" : "w-0"
      )}>
        <ChatHistorySidebar
          sessions={sessions}
          sessionsLoading={sessionsLoading}
          activeSessionId={sessionId}
          onSessionSelect={handleSessionSelect}
          onNewChat={handleNewChat}
          onRename={handleRenameSession}
          onDelete={handleDeleteSession}
        />
      </div>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Chat header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(o => !o)}>
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </Button>
            <span className="font-semibold text-sm truncate max-w-[200px]">{currentTopic}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNewChat} title="New chat">
              <Plus className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear Conversation?</AlertDialogTitle>
                  <AlertDialogDescription>Delete all messages in this chat? This cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearConversation}>Clear</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-4" ref={scrollAreaRef}>
          {isUserLoading || isLoadingMessages ? (
            <div className="flex justify-center pt-16"><Loader className="animate-spin" /></div>
          ) : messages.length === 0 && !isSending ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-3 pt-16">
              <div className="bg-primary/10 p-4 rounded-full">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <p className="text-lg font-medium text-foreground">Start a conversation with AthenaAI</p>
              <p className="text-sm">Ask anything or try a suggestion below.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 w-full max-w-xl">
                {[
                  { text: "Make quiz of topic: ", label: "Generate a Quiz" },
                  { text: "Make paper of topic: ", label: "Generate a Paper" },
                ].map(s => (
                  <Card key={s.text} className="p-3 hover:bg-muted cursor-pointer text-left" onClick={() => setInput(s.text)}>
                    <p className="text-xs font-semibold text-primary mb-0.5">{s.label}</p>
                    <p className="text-sm text-muted-foreground">{s.text}[topic]</p>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            messages.map(msg => <ChatMessageItem key={msg.id} message={msg} />)
          )}
          {isSending && <ChatMessageItem message={{ role: 'model', content: '' }} isLoading />}
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t p-3 bg-background">
          <form onSubmit={e => { e.preventDefault(); handleSendMessage(input); }} className="flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask a question..."
              disabled={isSending || isUserLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isSending || !input.trim()} size="icon">
              {isSending ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
