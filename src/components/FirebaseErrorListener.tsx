'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

/**
 * Global listener for Firestore permission errors.
 *
 * Previously this component threw the error so Next.js' global error UI would
 * surface a full "Application Error" page. That leads to a poor experience for
 * transient permission issues (token expiry or mis-deployed rules). Instead,
 * surface a friendly toast to the user and log the error to the console. The
 * underlying rules should still be corrected/deployed; this change prevents a
 * single denied write from taking down the whole app UI.
 */
export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      console.error('Firestore permission error:', error);

      // Show a user-friendly toast explaining what happened and suggesting next steps.
      toast({
        title: 'Action not allowed',
        description: 'You do not have permission to perform this action. Try refreshing the page or signing out and signing in again. If the problem persists, contact support.',
        variant: 'destructive',
      });
    };

    errorEmitter.on('permission-error', handleError);
    return () => errorEmitter.off('permission-error', handleError);
  }, [toast]);

  return null;
}
