import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="font-headline text-2xl font-semibold tracking-tight sm:text-3xl">
          This page could not be found
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The address may be wrong, or the page was removed. If you opened a bookmark or refreshed on a custom host,
          make sure the server is configured to forward all routes to the Next.js app (SPA fallback).
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
