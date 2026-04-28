'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { consumeDriveImportQueue, type QueuedDriveFile } from '@/lib/drive-import-queue';

type AppliedPayload = QueuedDriveFile & { dataUri: string };

/**
 * When user lands with ?applyDrive=1 after Connectors queued a file, download it and run onApplied.
 * Strips the query param when done (success or failure).
 */
export function useApplyQueuedDriveImport(options: {
  connected: boolean;
  downloadFile: (fileId: string, mimeType: string) => Promise<string>;
  /** Return a Promise for async work (e.g. chat extracts text before attaching). */
  onApplied: (payload: AppliedPayload) => void | Promise<void>;
}) {
  const { connected, downloadFile, onApplied } = options;
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const onAppliedRef = useRef(onApplied);
  onAppliedRef.current = onApplied;

  useEffect(() => {
    if (typeof window === 'undefined' || !connected) return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('applyDrive') !== '1') return;

    const queued = consumeDriveImportQueue();
    const stripQuery = () => {
      router.replace(pathname);
    };

    if (!queued) {
      toast({
        variant: 'destructive',
        title: 'Nothing to import',
        description: 'Pick a file on Connectors → Google Drive, then choose a tool again.',
      });
      stripQuery();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const dataUri = await downloadFile(queued.id, queued.mimeType);
        if (cancelled) return;
        await Promise.resolve(
          onAppliedRef.current({
            id: queued.id,
            name: queued.name,
            mimeType: queued.mimeType,
            dataUri,
          })
        );
        toast({ title: 'Imported from Drive', description: queued.name });
      } catch (e: unknown) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : 'Import failed';
        toast({ variant: 'destructive', title: 'Drive import failed', description: message });
      } finally {
        if (!cancelled) stripQuery();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connected, downloadFile, pathname, router, toast]);
}
