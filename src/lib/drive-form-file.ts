/**
 * Helpers for Google Drive imports stored on react-hook-form `file` fields
 * alongside normal FileList uploads (see summarize page pattern).
 */

export const DRIVE_PICKER_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/vnd.google-apps.document',
] as const;

export type DriveImportFormValue = {
  __driveImport: true;
  dataUri: string;
  name: string;
  type: string;
};

export function isDriveImportFormValue(v: unknown): v is DriveImportFormValue {
  return Boolean(
    v &&
      typeof v === 'object' &&
      (v as DriveImportFormValue).__driveImport === true &&
      typeof (v as DriveImportFormValue).dataUri === 'string'
  );
}

/** True if the form `file` field has a normal upload or a Drive import object. */
export function hasFormFileValue(file: unknown): boolean {
  if (!file) return false;
  if (isDriveImportFormValue(file)) return true;
  const fl = file as FileList | undefined;
  return !!(fl && typeof fl.length === 'number' && fl.length > 0 && fl[0]);
}

export function getFormFileDisplayName(file: unknown): string | undefined {
  if (isDriveImportFormValue(file)) return file.name;
  const fl = file as FileList | undefined;
  return fl?.[0]?.name;
}

/** Treat Google Docs like PDF after Drive export. */
export function isPdfLikeMime(mime: string): boolean {
  return mime === 'application/pdf' || mime === 'application/vnd.google-apps.document';
}
