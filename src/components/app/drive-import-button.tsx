'use client';

import { useState } from 'react';
import { HardDrive, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDrive } from '@/hooks/use-drive';
import { useToast } from '@/hooks/use-toast';
import { DRIVE_PICKER_MIME_TYPES } from '@/lib/drive-form-file';
import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

type ImportedPayload = { dataUri: string; mimeType: string; name: string };

export function DriveImportButton({
  onImported,
  mimeTypes,
  disabled,
  className,
  size = 'sm',
  variant = 'outline',
  label = 'Import from Drive',
}: {
  onImported: (payload: ImportedPayload) => void | Promise<void>;
  mimeTypes?: string[];
  disabled?: boolean;
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: ComponentProps<typeof Button>['variant'];
  label?: string;
}) {
  const { connected, openPicker, downloadFile } = useDrive();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  if (!connected) return null;

  const handleClick = () => {
    openPicker(
      async (driveFile) => {
        setBusy(true);
        try {
          const dataUri = await downloadFile(driveFile.id, driveFile.mimeType);
          await Promise.resolve(
            onImported({
              dataUri,
              mimeType: driveFile.mimeType,
              name: driveFile.name,
            })
          );
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : 'Import failed';
          toast({ variant: 'destructive', title: 'Import failed', description: message });
        } finally {
          setBusy(false);
        }
      },
      mimeTypes ?? [...DRIVE_PICKER_MIME_TYPES]
    );
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={disabled || busy}
      className={cn('gap-1.5', className)}
      onClick={handleClick}
    >
      {busy ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <HardDrive className="h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}
