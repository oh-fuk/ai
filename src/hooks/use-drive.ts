'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { getGooglePickerOrigin, requestGoogleDriveAccessTokenSilent } from '@/lib/google-drive-picker';

const PICKER_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY || '';
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

declare global {
    interface Window { google: any; gapi: any; }
}

function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement('script');
        s.src = src; s.onload = () => resolve(); s.onerror = reject;
        document.head.appendChild(s);
    });
}

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    url: string;
}

export function useDrive() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [connected, setConnected] = useState(false);
    const [accessToken, setAccessToken] = useState('');
    const [pickerReady, setPickerReady] = useState(false);
    const accessTokenRef = useRef('');

    const userDocRef = useMemoFirebase(
        () => (user ? doc(firestore, 'users', user.uid) : null),
        [user, firestore]
    );
    const { data: userProfile } = useDoc(userDocRef);

    useEffect(() => {
        accessTokenRef.current = accessToken;
    }, [accessToken]);

    // Restore token from Firestore
    useEffect(() => {
        if (userProfile?.googleDrive?.connected && userProfile.googleDrive.accessToken) {
            setConnected(true);
            setAccessToken(userProfile.googleDrive.accessToken);
        }
    }, [userProfile]);

    // Picker needs both gapi (picker) and gsi (OAuth refresh for production tokens)
    useEffect(() => {
        Promise.all([
            loadScript('https://accounts.google.com/gsi/client'),
            loadScript('https://apis.google.com/js/api.js'),
        ]).then(() => {
            window.gapi.load('picker', () => setPickerReady(true));
        }).catch(() => { });
    }, []);

    /* ── Open file picker ── */
    const openPicker = useCallback(async (
        onPicked: (file: DriveFile) => void,
        mimeTypes: string[] = ['application/pdf', 'image/*']
    ) => {
        if (!connected || !accessToken) {
            toast({ variant: 'destructive', title: 'Google Drive not connected', description: 'Go to Connectors page to connect.' });
            return;
        }
        if (!pickerReady) {
            toast({ variant: 'destructive', title: 'Picker not ready yet, please try again.' });
            return;
        }
        if (!PICKER_API_KEY?.trim()) {
            toast({
                variant: 'destructive',
                title: 'Google Picker is not configured',
                description: 'In Vercel → Settings → Environment Variables, set NEXT_PUBLIC_GOOGLE_PICKER_API_KEY (Google Cloud: enable Picker API + Drive API, create browser API key, add this site under HTTP referrers).',
            });
            return;
        }

        let tokenForPicker = accessTokenRef.current || accessToken;
        if (GOOGLE_CLIENT_ID.trim()) {
            try {
                tokenForPicker = await requestGoogleDriveAccessTokenSilent(GOOGLE_CLIENT_ID);
                setAccessToken(tokenForPicker);
                accessTokenRef.current = tokenForPicker;
                if (userDocRef) {
                    await updateDoc(userDocRef, { 'googleDrive.accessToken': tokenForPicker } as any);
                }
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : 'Could not refresh Google sign-in';
                toast({
                    variant: 'destructive',
                    title: 'Drive session needs a refresh',
                    description: `${msg} Open Connectors → disconnect Google Drive → connect again, then try import.`,
                });
                return;
            }
        }

        const view = new window.google.picker.DocsView()
            .setMimeTypes(mimeTypes.join(','))
            .setIncludeFolders(true);

        const origin = getGooglePickerOrigin();
        const builder = new window.google.picker.PickerBuilder()
            .addView(view)
            .setOAuthToken(tokenForPicker)
            .setDeveloperKey(PICKER_API_KEY)
            .setTitle('Select a file from Google Drive')
            .setCallback((data: { action?: string; docs?: Array<{ id: string; name: string; mimeType: string; url?: string }>; error?: string }) => {
                const Action = window.google.picker.Action;
                if (data.action === Action.PICKED && data.docs?.[0]) {
                    const f = data.docs[0];
                    onPicked({ id: f.id, name: f.name, mimeType: f.mimeType, url: f.url || '' });
                    return;
                }
                if (data.action === Action.CANCEL) return;
                if (data.error) {
                    toast({
                        variant: 'destructive',
                        title: 'Drive picker error',
                        description: data.error || 'Check API key HTTP referrers include this site (e.g. https://*.vercel.app/*) and Google Picker API is enabled.',
                    });
                }
            });
        if (origin) builder.setOrigin(origin);
        builder.build().setVisible(true);
    }, [connected, accessToken, pickerReady, toast, userDocRef]);

    /* ── Download file from Drive as base64 ── */
    const downloadFile = useCallback(async (fileId: string, mimeType: string): Promise<string> => {
        const t = accessTokenRef.current;
        if (!t) throw new Error('Not connected to Google Drive');

        let url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        if (mimeType === 'application/vnd.google-apps.document') {
            url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`;
        }

        const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
        if (!res.ok) throw new Error(`Drive download failed: ${res.statusText}`);

        const blob = await res.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }, []);

    /* ── Upload file to Drive ── */
    const uploadFile = useCallback(async (
        content: string | Blob,
        fileName: string,
        mimeType: string = 'application/pdf'
    ): Promise<string> => {
        const t = accessTokenRef.current;
        if (!t) throw new Error('Not connected to Google Drive');

        let blob: Blob;
        if (typeof content === 'string') {
            blob = new Blob([content], { type: mimeType });
        } else {
            blob = content;
        }

        const metadata = { name: fileName, mimeType };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { Authorization: `Bearer ${t}` },
            body: form,
        });

        if (!res.ok) throw new Error(`Drive upload failed: ${res.statusText}`);
        const data = await res.json();
        return data.id;
    }, []);

    return { connected, openPicker, downloadFile, uploadFile };
}
