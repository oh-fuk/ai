/** sessionStorage payload when user picks a file on Connectors and chooses a destination tool. */
export const DRIVE_IMPORT_QUEUE_KEY = 'athenaDriveImportQueue';

export type QueuedDriveFile = {
  id: string;
  name: string;
  mimeType: string;
};

export function setDriveImportQueue(file: QueuedDriveFile): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(DRIVE_IMPORT_QUEUE_KEY, JSON.stringify(file));
}

/** Read and remove the queue (single consume). */
export function consumeDriveImportQueue(): QueuedDriveFile | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(DRIVE_IMPORT_QUEUE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(DRIVE_IMPORT_QUEUE_KEY);
  try {
    const j = JSON.parse(raw) as QueuedDriveFile;
    if (j?.id && j?.name && j?.mimeType) return j;
  } catch {
    /* ignore */
  }
  return null;
}

/** Where Connectors can send a picked file (paths must match app routes). */
export const DRIVE_IMPORT_DESTINATIONS: { href: string; label: string; description: string }[] = [
  { href: '/summarize', label: 'Summarizer', description: 'PDF, Google Doc, or image → summary' },
  { href: '/notes-maker', label: 'Notes Maker', description: 'PDF or image → structured notes' },
  { href: '/paper-generator', label: 'Paper Generator', description: 'PDF / image / topic → exam paper' },
  { href: '/quiz', label: 'Quiz Generator', description: 'PDF or image → quiz' },
  { href: '/planner', label: 'Study Planner', description: 'PDF / image + topic → plan' },
  { href: '/guess-paper', label: 'Guess Paper', description: 'Past paper PDF → slot 1 (add more on page)' },
  { href: '/chat', label: 'AI Chat', description: 'Attach file context to your next message' },
];
