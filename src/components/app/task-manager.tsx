'use client';

import { useState, useRef, useEffect } from 'react';
import { Trash2, Plus, Brain, Send, X, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

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

interface TaskManagerProps {
    userId: string;
}

export default function TaskManager({ userId }: TaskManagerProps) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDescription, setNewTaskDescription] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [showAddTask, setShowAddTask] = useState(false);
    const [showAiChat, setShowAiChat] = useState(false);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isLoadingChat, setIsLoadingChat] = useState(false);
    const [selectedTaskForAi, setSelectedTaskForAi] = useState<Task | null>(null);
    const { toast } = useToast();
    const chatEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // Load tasks from localStorage
    useEffect(() => {
        const savedTasks = localStorage.getItem(`tasks_${userId}`);
        if (savedTasks) {
            try {
                const parsed = JSON.parse(savedTasks);
                setTasks(parsed.map((t: any) => ({ ...t, createdAt: new Date(t.createdAt) })));
            } catch (e) {
                console.error('Failed to parse tasks:', e);
            }
        }

        // Initialize AI chat with welcome message
        setChatMessages([
            {
                id: '1',
                role: 'assistant',
                content: "👋 Hi! I'm your AI study assistant. I can help you with your tasks! You can:\n\n• **Select a task** and ask for help\n• **Ask how to approach** any task\n• **Request tips and strategies** for completion\n• **Get clarification** on confusing parts\n\nHow can I assist you today?",
                timestamp: new Date(),
            },
        ]);
    }, [userId]);

    // Save tasks to localStorage
    useEffect(() => {
        localStorage.setItem(`tasks_${userId}`, JSON.stringify(tasks));
    }, [tasks, userId]);

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

        setTasks([task, ...tasks]);
        setNewTaskTitle('');
        setNewTaskDescription('');
        setNewTaskPriority('medium');
        setShowAddTask(false);
        toast({ title: 'Success', description: 'Task added successfully!' });
    };

    const removeTask = (id: string) => {
        setTasks(tasks.filter(t => t.id !== id));
        toast({ title: 'Deleted', description: 'Task removed' });
    };

    const toggleTaskCompletion = (id: string) => {
        setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    };

    const handleAiChatOpen = (task?: Task) => {
        setShowAiChat(true);
        if (task) {
            setSelectedTaskForAi(task);
            // Add context message
            setChatMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'user',
                content: `I need help with this task: "${task.title}"\n\n${task.description}`,
                timestamp: new Date(),
            }]);
        }
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
            // Simulate AI response with task context
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
                    userId,
                }),
            });

            const data = await response.json();

            const assistantMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: data.response || 'I understand you need help. Could you provide more details about what you\'d like assistance with?',
                timestamp: new Date(),
            };

            setChatMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Chat error:', error);
            const errorMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '⚠️ Sorry, I encountered an error. Please try again or rephrase your question.',
                timestamp: new Date(),
            };
            setChatMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoadingChat(false);
        }
    };

    const completedCount = tasks.filter(t => t.completed).length;
    const priorityColor = {
        low: 'border-l-blue-500',
        medium: 'border-l-yellow-500',
        high: 'border-l-red-500',
    };

    const priorityBgColor = {
        low: 'bg-blue-50 dark:bg-blue-950',
        medium: 'bg-yellow-50 dark:bg-yellow-950',
        high: 'bg-red-50 dark:bg-red-950',
    };

    return (
        <div className="space-y-6">
            <Card className="border-2 border-primary/20">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b-2 border-primary/20">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-xl">
                                📋 Your Tasks
                            </CardTitle>
                            <CardDescription>
                                Manage your study tasks and get AI assistance. {completedCount} of {tasks.length} completed
                            </CardDescription>
                        </div>
                        {!showAddTask && (
                            <Button onClick={() => setShowAddTask(true)} size="sm" variant="default">
                                <Plus className="mr-2 h-4 w-4" />
                                Add Task
                            </Button>
                        )}
                    </div>
                </CardHeader>

                <CardContent className="pt-6">
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
                                        placeholder="Task title (e.g., Complete Chapter 5 Notes)"
                                        value={newTaskTitle}
                                        onChange={(e) => setNewTaskTitle(e.target.value)}
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
                                            className="px-3 py-1 border rounded-md text-sm"
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
                                    className={`p-4 border-l-4 rounded-lg ${priorityColor[task.priority]} ${priorityBgColor[task.priority]} transition-all hover:shadow-md`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3 flex-1">
                                            <button
                                                onClick={() => toggleTaskCompletion(task.id)}
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
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <Button
                                                onClick={() => handleAiChatOpen(task)}
                                                size="sm"
                                                variant="outline"
                                                className="gap-2"
                                            >
                                                <Brain className="h-4 w-4" />
                                                <span className="hidden sm:inline">AI Help</span>
                                            </Button>
                                            <Button
                                                onClick={() => removeTask(task.id)}
                                                size="sm"
                                                variant="ghost"
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Mini AI Chat Modal */}
            <AnimatePresence>
                {showAiChat && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed inset-0 z-50 flex items-end justify-end p-4 md:items-center md:justify-center"
                    >
                        {/* Overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowAiChat(false)}
                            className="absolute inset-0 bg-black/50"
                        />

                        {/* Chat Window */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            className="relative w-full max-w-md bg-background rounded-lg shadow-2xl border-2 border-primary/20 flex flex-col max-h-96 md:max-h-[600px]"
                        >
                            {/* Header */}
                            <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-b-2 border-primary/20 px-4 py-3 flex items-center justify-between">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <Brain className="h-5 w-5 text-primary" />
                                    AI Study Assistant
                                </h3>
                                <button
                                    onClick={() => setShowAiChat(false)}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

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
                                                    : 'bg-muted text-foreground border border-primary/20'
                                                }`}
                                        >
                                            <p className="whitespace-pre-wrap break-words">{message.content}</p>
                                        </div>
                                    </motion.div>
                                ))}
                                {isLoadingChat && (
                                    <div className="flex justify-start">
                                        <div className="bg-muted p-3 rounded-lg">
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

                            {/* Input Area */}
                            <div className="border-t-2 border-primary/20 bg-muted/30 p-3 flex gap-2">
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
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
