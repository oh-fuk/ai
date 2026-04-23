'use client';

import { useState, useRef, useEffect } from 'react';
import { Trash2, Plus, Brain, Send, ChevronLeft, CheckCircle2, Circle, Loader, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import PageHeader from '@/components/app/page-header';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';

interface Task {
    id: string;
    title: string;
    description: string;
    completed: boolean;
    createdAt: Date;
    priority: 'low' | 'medium' | 'high';
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export default function TasksPage() {
    const router = useRouter();
    const { user } = useUser();
    const firestore = useFirestore();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDescription, setNewTaskDescription] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [showAddTask, setShowAddTask] = useState(false);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isLoadingChat, setIsLoadingChat] = useState(false);
    const [selectedTaskForAi, setSelectedTaskForAi] = useState<Task | null>(null);
    const [aiStarted, setAiStarted] = useState(false);
    const [askingQuestions, setAskingQuestions] = useState(false);
    const [isLoadingTasks, setIsLoadingTasks] = useState(true);
    const { toast } = useToast();
    const chatEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // Load tasks from localStorage and sync with Firestore
    useEffect(() => {
        if (!user || !firestore) {
            setIsLoadingTasks(false);
            return;
        }

        // First, load from localStorage for instant display
        const savedTasks = localStorage.getItem(`tasks_${user.uid}`);
        if (savedTasks) {
            try {
                const parsed = JSON.parse(savedTasks);
                setTasks(parsed.map((t: any) => ({ ...t, createdAt: new Date(t.createdAt) })));
            } catch (e) {
                console.error('Failed to parse tasks from localStorage:', e);
            }
        }

        // Then, sync with Firestore for real-time updates across devices
        const tasksRef = collection(firestore, 'users', user.uid, 'tasks');
        const q = query(tasksRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const firestoreTasks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() || new Date(),
            } as Task));

            setTasks(firestoreTasks);
            // Also update localStorage with Firestore data
            localStorage.setItem(`tasks_${user.uid}`, JSON.stringify(firestoreTasks));
            setIsLoadingTasks(false);
        }, (error) => {
            console.error('Error syncing tasks from Firestore:', error);
            setIsLoadingTasks(false);
        });

        // Initialize AI chat
        setChatMessages([
            {
                id: '1',
                role: 'assistant',
                content: "👋 Hi! I'm your AI study assistant. I can help you with your tasks! You can:\n\n• **Select a task** and ask for help\n• **Ask how to approach** any task\n• **Request tips and strategies** for completion\n• **Get clarification** on confusing parts\n\nHow can I assist you today?",
                timestamp: new Date(),
            },
        ]);

        return () => unsubscribe();
    }, [user, firestore]);

    // Save tasks to localStorage (always)
    useEffect(() => {
        if (!user) return;
        localStorage.setItem(`tasks_${user.uid}`, JSON.stringify(tasks));
    }, [tasks, user]);

    // Auto-scroll chat to bottom
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const addTask = () => {
        if (!newTaskTitle.trim()) {
            toast({ variant: 'destructive', title: 'Error', description: 'Please enter a task title' });
            return;
        }

        const task: Task = {
            id: Date.now().toString(),
            title: newTaskTitle,
            description: newTaskDescription,
            completed: false,
            createdAt: new Date(),
            priority: newTaskPriority,
        };

        // Save to both localStorage and Firestore
        setTasks([task, ...tasks]);

        // Auto-select the newly added task so user can immediately chat with AI
        setSelectedTaskForAi(task);

        // Save to Firestore for cross-device sync
        if (user && firestore) {
            const taskRef = doc(firestore, 'users', user.uid, 'tasks', task.id);
            setDoc(taskRef, {
                title: task.title,
                description: task.description,
                completed: task.completed,
                createdAt: new Date(),
                priority: task.priority,
            }).catch(error => {
                console.error('Error saving task to Firestore:', error);
                toast({ variant: 'destructive', title: 'Warning', description: 'Task saved locally but sync failed' });
            });
        }

        setNewTaskTitle('');
        setNewTaskDescription('');
        setNewTaskPriority('medium');
        setShowAddTask(false);
        toast({ title: 'Success', description: 'Task added successfully! Click "Start AI - Ask Questions" to begin.' });
    };

    const removeTask = (id: string) => {
        setTasks(tasks.filter(t => t.id !== id));

        // Delete from Firestore
        if (user && firestore) {
            const taskRef = doc(firestore, 'users', user.uid, 'tasks', id);
            deleteDoc(taskRef).catch(error => {
                console.error('Error deleting task from Firestore:', error);
            });
        }

        toast({ title: 'Deleted', description: 'Task removed' });
    };

    const toggleTaskCompletion = (id: string) => {
        const updatedTasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
        setTasks(updatedTasks);

        // Update in Firestore
        if (user && firestore) {
            const task = updatedTasks.find(t => t.id === id);
            if (task) {
                const taskRef = doc(firestore, 'users', user.uid, 'tasks', id);
                setDoc(taskRef, {
                    title: task.title,
                    description: task.description,
                    completed: task.completed,
                    createdAt: task.createdAt,
                    priority: task.priority,
                }).catch(error => {
                    console.error('Error updating task in Firestore:', error);
                });
            }
        }
    };

    const startAiWithQuestions = async () => {
        // If no task is selected (or no tasks exist), start the AI and ask the user to create their first task
        if (!selectedTaskForAi) {
            setAiStarted(true);

            setChatMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: "I don't see any tasks yet. Please create your first task using the 'Add New Task' button on the left. Would you like me to help you create it? I'll open the task form for you.",
                timestamp: new Date(),
            }]);

            // Open the add task form to reduce friction
            setShowAddTask(true);
            return;
        }

        // Start the AI chat for the selected task without asking the mandatory custom questions
        setAiStarted(true);
        setAskingQuestions(false);

        setChatMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: `✅ I'm ready to help with "${selectedTaskForAi.title}". Ask me anything about this task and I'll assist you step-by-step.`,
            timestamp: new Date(),
        }]);
    };

    const selectTaskForAi = (task: Task) => {
        setSelectedTaskForAi(task);
        // Immediately open the AI chat for the selected task and do not auto-ask custom questions
        setAiStarted(true);
        setAskingQuestions(false);
    };

    const handleSendMessage = async () => {
        if (!chatInput.trim()) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: chatInput,
            timestamp: new Date(),
        };

        setChatMessages(prev => [...prev, userMessage]);
        setChatInput('');
        setIsLoadingChat(true);

        try {
            const taskContext = selectedTaskForAi
                ? `\n\n**Task Context:** The user is working on "${selectedTaskForAi.title}" - ${selectedTaskForAi.description}`
                : '';

            const response = await fetch('/api/ai/task-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: chatMessages,
                    userMessage: chatInput,
                    taskContext,
                    tasks: tasks,
                    userId: user?.uid,
                }),
            });

            const data = await response.json();

            const assistantMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.response || 'I understand you need help. Could you provide more details?',
                timestamp: new Date(),
            };

            setChatMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '⚠️ Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
            };
            setChatMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoadingChat(false);
        }
    };

    const completedCount = tasks.filter(t => t.completed).length;
    const priorityColor = {
        low: 'border-l-blue-500 bg-blue-50 dark:bg-blue-950',
        medium: 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950',
        high: 'border-l-red-500 bg-red-50 dark:bg-red-950',
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="border-b bg-background">
                <div className="flex items-center gap-4 p-6">
                    <PageHeader
                        title="📋 Your Tasks"
                        description="Manage your study tasks and get AI assistance"
                    />
                    <div className="ml-auto text-sm text-muted-foreground">
                        {completedCount} of {tasks.length} completed
                    </div>
                </div>
            </div>

            {/* Main Content - Two Column Layout */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left: Task List */}
                <div className="flex-1 border-r overflow-y-auto p-6">
                    {/* Add Task Button */}
                    {!showAddTask && (
                        <Button onClick={() => setShowAddTask(true)} size="lg" className="w-full mb-6">
                            <Plus className="mr-2 h-5 w-5" />
                            Add New Task
                        </Button>
                    )}

                    {/* Add Task Form */}
                    <AnimatePresence>
                        {showAddTask && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-6 p-4 border-2 border-primary/30 rounded-lg bg-gradient-to-br from-primary/5 to-transparent"
                            >
                                <h4 className="font-semibold mb-3">Create New Task</h4>
                                <div className="space-y-3">
                                    <Input
                                        placeholder="Task title"
                                        value={newTaskTitle}
                                        onChange={(e) => setNewTaskTitle(e.target.value)}
                                        autoFocus
                                    />
                                    <Textarea
                                        placeholder="Task description (optional)"
                                        value={newTaskDescription}
                                        onChange={(e) => setNewTaskDescription(e.target.value)}
                                        rows={3}
                                    />
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm font-medium">Priority:</label>
                                        <select
                                            value={newTaskPriority}
                                            onChange={(e) => setNewTaskPriority(e.target.value as 'low' | 'medium' | 'high')}
                                            className="px-3 py-2 border rounded-md text-sm"
                                        >
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button onClick={addTask} size="sm" variant="default">
                                            Add Task
                                        </Button>
                                        <Button onClick={() => setShowAddTask(false)} size="sm" variant="outline">
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Task List */}
                    {tasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="p-4 bg-primary/10 rounded-full mb-4">
                                <Circle className="h-8 w-8 text-primary" />
                            </div>
                            <p className="text-muted-foreground">No tasks yet. Add one to get started!</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {tasks.map((task) => (
                                <motion.div
                                    key={task.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    onClick={() => selectTaskForAi(task)}
                                    className={`p-4 border-l-4 rounded-lg cursor-pointer transition-all hover:shadow-md ${priorityColor[task.priority]} ${selectedTaskForAi?.id === task.id ? 'bg-slate-800 text-white' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3 flex-1">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleTaskCompletion(task.id);
                                                }}
                                                className="mt-1 flex-shrink-0 transition-colors hover:text-primary"
                                            >
                                                {task.completed ? (
                                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                ) : (
                                                    <Circle className="h-5 w-5 text-muted-foreground" />
                                                )}
                                            </button>
                                            <div className="flex-1">
                                                <h4 className={`font-semibold ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                                                    {task.title}
                                                </h4>
                                                {task.description && (
                                                    <p className={`text-sm mt-1 ${task.completed ? 'line-through text-muted-foreground' : 'text-muted-foreground'}`}>
                                                        {task.description}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${task.priority === 'high' ? 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                                        task.priority === 'medium' ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                            'bg-blue-200 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                                        }`}>
                                                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <Button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeTask(task.id);
                                            }}
                                            size="sm"
                                            variant="ghost"
                                            className="text-destructive hover:text-destructive"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right: AI Sidebar */}
                <div className="w-96 bg-muted/30 flex flex-col border-l overflow-hidden">
                    {/* Sidebar Header */}
                    <div className="border-b bg-gradient-to-r from-primary/10 to-primary/5 p-4">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Brain className="h-5 w-5 text-primary" />
                            AI Study Assistant
                        </h3>
                        <p className="text-xs text-muted-foreground mt-2">
                            📚 Task-only mode - I only help with your tasks
                        </p>
                        {selectedTaskForAi && (
                            <p className="text-xs text-primary mt-2 font-semibold">
                                ✓ Helping with: {selectedTaskForAi.title}
                            </p>
                        )}
                    </div>

                    {/* AI Initial State - Big Start Button */}
                    {!aiStarted ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6">
                            {tasks.length === 0 ? (
                                <>
                                    <div className="space-y-3">
                                        <Brain className="h-16 w-16 text-muted-foreground mx-auto opacity-30" />
                                        <div>
                                            <h4 className="text-lg font-bold text-foreground">No Tasks Yet</h4>
                                            <p className="text-sm text-muted-foreground mt-2">Add a task on the left to get started with AI help</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <p>👈 Click "Add New Task" on the left</p>
                                        <p>✅ Create at least one task</p>
                                        <p>🤖 Then AI will be available</p>
                                    </div>

                                    <Button
                                        onClick={startAiWithQuestions}
                                        size="lg"
                                        className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-6 text-lg rounded-lg shadow-lg hover:shadow-xl transition-all"
                                    >
                                        <Brain className="mr-2 h-5 w-5" />
                                        Start AI - Help me create a task
                                    </Button>

                                    <p className="text-xs text-muted-foreground italic">
                                        📌 AI is available — if you don't have tasks yet, I'll help you create your first one
                                    </p>
                                </>
                            ) : (
                                <>
                                    <div className="space-y-3">
                                        <Brain className="h-16 w-16 text-primary mx-auto opacity-60" />
                                        <div>
                                            <h4 className="text-lg font-bold text-foreground">AI Task Assistant</h4>
                                            <p className="text-sm text-muted-foreground mt-2">
                                                I'm here to help you with your study tasks only.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <p>✓ Select a task from the left</p>
                                        <p>✓ Click "Start AI" below</p>
                                        <p>✓ I will assist you immediately</p>
                                    </div>

                                    <Button
                                        onClick={startAiWithQuestions}
                                        disabled={!selectedTaskForAi || askingQuestions}
                                        size="lg"
                                        className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-6 text-lg rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                                    >
                                        {askingQuestions ? (
                                            <>
                                                <Loader className="mr-2 h-5 w-5 animate-spin" />
                                                Preparing...
                                            </>
                                        ) : (
                                            <>
                                                <Brain className="mr-2 h-5 w-5" />
                                                {selectedTaskForAi ? 'Start AI' : 'Select a Task First'}
                                            </>
                                        )}
                                    </Button>

                                    <p className="text-xs text-muted-foreground italic">
                                        📌 The assistant will start immediately when you select a task.
                                    </p>
                                </>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Chat Messages */}
                            <div
                                ref={messagesContainerRef}
                                className="flex-1 overflow-y-auto p-4 space-y-4"
                            >
                                {chatMessages.map((message) => (
                                    <motion.div
                                        key={message.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-xs px-4 py-2 rounded-lg text-sm ${message.role === 'user'
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-background text-foreground border border-primary/20'
                                                }`}
                                        >
                                            <p className="whitespace-pre-wrap break-words">{message.content}</p>
                                        </div>
                                    </motion.div>
                                ))}
                                {isLoadingChat && (
                                    <div className="flex justify-start">
                                        <div className="bg-background border border-primary/20 p-3 rounded-lg">
                                            <div className="flex gap-1">
                                                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
                                                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0.1s' }} />
                                                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0.2s' }} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Chat Input */}
                            <div className="border-t bg-background p-4 flex gap-2">
                                {!selectedTaskForAi ? (
                                    <div className="w-full flex items-center justify-center p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                                        👈 Select a task first to chat with AI
                                    </div>
                                ) : (
                                    <>
                                        <Textarea
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendMessage();
                                                }
                                            }}
                                            placeholder="Ask AI for help..."
                                            className="resize-none text-sm max-h-20"
                                            rows={1}
                                            disabled={isLoadingChat}
                                        />
                                        <Button
                                            onClick={handleSendMessage}
                                            disabled={isLoadingChat || !chatInput.trim()}
                                            size="sm"
                                            className="flex-shrink-0"
                                        >
                                            <Send className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div >
    );
}
