
'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader, Eye, EyeOff } from 'lucide-react';
import { useAuth, useFirestore } from '@/firebase';
import {
    signInWithEmailAndPassword,
    UserCredential,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { AthenaLogo } from '@/components/app/logo';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const auth = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        // Read search params from window to avoid SSR/suspense issues during build
        try {
            const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
            const fromOnboarding = params.get('onboarding') === 'complete';
            if (fromOnboarding) {
                toast({
                    title: 'Account Created!',
                    description: 'Please log in to continue.',
                });
            }
        } catch (e) {
            // noop in non-browser contexts
        }
    }, [toast]);

    const handleSuccessfulLogin = async (userCredential: UserCredential) => {
        const user = userCredential.user;
        const userRef = doc(firestore, 'users', user.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists() && userDoc.data().hasCompletedOnboarding) {
            router.push('/dashboard');
        } else {
            // This handles cases where user signed up but didn't finish onboarding
            router.push('/onboarding');
        }
    };

    const handleSignIn = async () => {
        // Basic client-side validation to avoid sending malformed credentials to Firebase.
        const trimmedEmail = String(email || '').trim();
        const pwd = String(password || '');

        // Ensure auth SDK is available
        if (!auth) {
            toast({ variant: 'destructive', title: 'Sign In Failed', description: 'Auth service is unavailable.' });
            return;
        }

        if (!trimmedEmail || !pwd) {
            toast({ variant: 'destructive', title: 'Sign In Failed', description: 'Please enter both email and password.' });
            return;
        }

        // Simple email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            toast({ variant: 'destructive', title: 'Sign In Failed', description: 'Please enter a valid email address.' });
            return;
        }

        setIsLoading(true);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, pwd);
            await handleSuccessfulLogin(userCredential);
        } catch (error: any) {
            // Log the full error to help debugging in dev tools
            console.error('Sign-in error:', error);

            // Surface the SDK message/code in the toast so we can immediately see what's happening
            toast({
                variant: 'destructive',
                title: 'Sign In Failed',
                description: error?.message || error?.code ||
                    (error?.code === 'auth/user-not-found'
                        ? 'No account found with this email. Please sign up.'
                        : error?.code === 'auth/wrong-password'
                            ? 'Incorrect password. Please try again.'
                            : 'An unknown error occurred.'),
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
            <motion.div
                initial={{ opacity: 0, y: -100 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="absolute top-4 left-4"
            >
                <Link href="/" className="flex items-center gap-2 text-foreground">
                    <AthenaLogo className="h-8 w-8" />
                    <span className="font-bold">AthenaAI</span>
                </Link>
            </motion.div>

            <div className="w-full max-w-4xl">
                <Card className="grid md:grid-cols-2 overflow-hidden shadow-2xl">
                    <div className="p-8 md:p-12 order-2 md:order-1">
                        <CardHeader className="p-0 text-left mb-6">
                            <CardTitle className="text-3xl font-bold font-headline">Welcome Back</CardTitle>
                            <CardDescription>Enter your credentials to access your study dashboard.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <form onSubmit={(e) => { e.preventDefault(); handleSignIn(); }} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="m@example.com"
                                        required
                                        autoComplete="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={isLoading}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <div className="relative">
                                        <Input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            autoComplete="current-password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            disabled={isLoading}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="absolute inset-y-0 right-0 h-full px-3"
                                            onClick={() => setShowPassword(!showPassword)}
                                            disabled={isLoading}
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            <span className="sr-only">{showPassword ? 'Hide password' : 'Show password'}</span>
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 pt-2">
                                    <Button type="submit" disabled={isLoading}>
                                        {isLoading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Sign In
                                    </Button>
                                    <p className="text-center text-sm text-muted-foreground">
                                        Don't have an account?{" "}
                                        <Link href="/register" className="font-semibold text-primary hover:underline">
                                            Sign Up
                                        </Link>
                                    </p>
                                </div>
                            </form>
                        </CardContent>
                    </div>
                    <div className="relative hidden md:flex items-center justify-center p-12 bg-primary/10 order-1 md:order-2">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.8, ease: 'backOut', delay: 0.2 }}
                        >
                            <AthenaLogo className="h-48 w-48" />
                        </motion.div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
