
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader, Eye, EyeOff } from 'lucide-react';
import { useAuth, useFirestore } from '@/firebase';
import {
    createUserWithEmailAndPassword,
    UserCredential,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { AthenaLogo } from '@/components/app/logo';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { PrivacyPolicyModal } from '@/components/PrivacyPolicy';
import { TermsOfServiceModal } from '@/components/TermsOfService';

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [agreeToPolicy, setAgreeToPolicy] = useState(false);
    const [agreeToTerms, setAgreeToTerms] = useState(false);
    const [showPrivacyModal, setShowPrivacyModal] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);
    const auth = useAuth();
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();

    const handleSuccessfulSignUp = async (userCredential: UserCredential) => {
        const user = userCredential.user;
        const userRef = doc(firestore, 'users', user.uid);

        // Create a basic user profile document
        await setDoc(userRef, {
            id: user.uid,
            email: user.email || '',
            hasCompletedOnboarding: false, // This is key
            hasSeenAppTour: false,
            username: user.email?.split('@')[0] || `user_${user.uid.substring(0, 6)}`,
            // Initialize other fields as empty
            fullName: user.displayName || '',
            fatherName: '',
            about: '',
            collegeName: '',
            country: '',
            city: '',
            class: '',
        });

        // Redirect to onboarding to complete the profile
        router.push('/onboarding');
    };

    const handleSignUp = async () => {
        if (!agreeToPolicy || !agreeToTerms) {
            toast({
                variant: 'destructive',
                title: 'Agreement Required',
                description: 'Please agree to the Privacy Policy and Terms of Service to create an account.',
            });
            return;
        }

        setIsLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await handleSuccessfulSignUp(userCredential);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Sign Up Failed',
                description: error.code === 'auth/email-already-in-use'
                    ? 'This email is already in use. Please sign in instead.'
                    : 'An unknown error occurred.',
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
                    <div className="relative hidden md:flex items-center justify-center p-12 bg-primary/10">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.8, ease: 'backOut', delay: 0.2 }}
                        >
                            <AthenaLogo className="h-48 w-48" />
                        </motion.div>
                    </div>
                    <div className="p-8 md:p-12">
                        <CardHeader className="p-0 text-left mb-6">
                            <CardTitle className="text-3xl font-bold font-headline">Create Your Account</CardTitle>
                            <CardDescription>Join AthenaAI and start studying smarter today.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <form onSubmit={(e) => { e.preventDefault(); handleSignUp(); }} className="space-y-4">
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
                                            autoComplete="new-password"
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
                                <div className="space-y-3 pt-2">
                                    <div className="flex items-start gap-2">
                                        <input
                                            type="checkbox"
                                            id="privacy"
                                            checked={agreeToPolicy}
                                            onChange={(e) => setAgreeToPolicy(e.target.checked)}
                                            disabled={isLoading}
                                            className="h-4 w-4 mt-1 accent-primary"
                                        />
                                        <Label htmlFor="privacy" className="text-sm font-normal cursor-pointer">
                                            I agree to the{" "}
                                            <button
                                                type="button"
                                                onClick={() => setShowPrivacyModal(true)}
                                                className="text-primary hover:underline font-semibold"
                                            >
                                                Privacy Policy
                                            </button>
                                        </Label>
                                    </div>

                                    <div className="flex items-start gap-2">
                                        <input
                                            type="checkbox"
                                            id="terms"
                                            checked={agreeToTerms}
                                            onChange={(e) => setAgreeToTerms(e.target.checked)}
                                            disabled={isLoading}
                                            className="h-4 w-4 mt-1 accent-primary"
                                        />
                                        <Label htmlFor="terms" className="text-sm font-normal cursor-pointer">
                                            I agree to the{" "}
                                            <button
                                                type="button"
                                                onClick={() => setShowTermsModal(true)}
                                                className="text-primary hover:underline font-semibold"
                                            >
                                                Terms of Service
                                            </button>
                                        </Label>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 pt-2">
                                    <Button type="submit" disabled={isLoading}>
                                        {isLoading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Create Account
                                    </Button>
                                    <p className="text-center text-sm text-muted-foreground">
                                        Already have an account?{" "}
                                        <Link href="/login" className="font-semibold text-primary hover:underline">
                                            Sign In
                                        </Link>
                                    </p>
                                </div>
                            </form>
                        </CardContent>
                    </div>
                </Card>
            </div>

            <PrivacyPolicyModal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />
            <TermsOfServiceModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} />
        </div>
    );
}