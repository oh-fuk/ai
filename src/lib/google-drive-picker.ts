/** OAuth scopes used for Drive import/export (must match connectors page). */
export const GOOGLE_DRIVE_SCOPE_STRING = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
].join(' ');

/** Origin Google Picker expects (no trailing slash). */
export function getGooglePickerOrigin(): string {
  if (typeof window === 'undefined') return '';
  const o = window.location.origin;
  return o.endsWith('/') ? o.slice(0, -1) : o;
}

/**
 * Silently refresh OAuth access token (works after user has already consented).
 * Required because tokens saved in Firestore expire in ~1h; picker breaks with stale tokens.
 */
export function requestGoogleDriveAccessTokenSilent(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!clientId?.trim()) {
      reject(new Error('Missing Google OAuth client ID'));
      return;
    }
    if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services not loaded'));
      return;
    }
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_DRIVE_SCOPE_STRING,
      callback: (r: { access_token?: string; error?: string }) => {
        if (r.error) reject(new Error(r.error));
        else if (r.access_token) resolve(r.access_token);
        else reject(new Error('No access token from Google'));
      },
    });
    tokenClient.requestAccessToken({ prompt: '' });
  });
}
