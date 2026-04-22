'use client';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { AlertTriangle, ServerCrash } from 'lucide-react';
import * as React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-muted p-4">
            <Card className="w-full max-w-lg border-destructive">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                        <ServerCrash className="h-6 w-6 text-destructive" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-destructive">Application Error</CardTitle>
                    <CardDescription>
                        Something went wrong. Please try refreshing the page.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-md bg-destructive/5 p-4 text-sm text-destructive">
                        <p className="font-mono whitespace-pre-wrap">{error.message}</p>
                    </div>
                    <Button onClick={() => reset()} className="w-full">
                        Try Again
                    </Button>
                </CardContent>
            </Card>
        </div>
      </body>
    </html>
  );
}
