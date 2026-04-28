'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

const PICKER_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY || '';

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

    const userDocRef = useMemoFirebase(
        () => (user ? doc(firestore, 'users', user.uid) : null),
        [user, firestore]
    );
    const { data: userProfile } = useDoc(userDocRef);

    // Restore token from Firestore
    useEffect(() => {
        if (userProfile?.googleDrive?.connected && userProfile.googleDrive.accessToken) {
            setConnected(true);
            setAccessToken(userProfile.googleDrive.accessToken);
        }
    }, [userProfile]);

    // Load picker script
    useEffect(() => {
        loadScript('https://apis.google.com/js/api.js').then(() => {
            window.gapi.load('picker', () => setPickerReady(true));
        }).catch(() => { });
    }, []);

    /* ── Open file picker ── */
    const openPicker = useCallback((
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
                description: 'Set NEXT_PUBLIC_GOOGLE_PICKER_API_KEY in your environment (Google Cloud → APIs & Services → Credentials → API key, with Drive API enabled).',
            });
            return;
        }

        const view = new window.google.picker.DocsView()
            .setMimeTypes(mimeTypes.join(','))
            .setIncludeFolders(true);

        const picker = new window.google.picker.PickerBuilder()
            .addView(view)
            .setOAuthToken(accessToken)
            .setDeveloperKey(PICKER_API_KEY)
            .setTitle('Select a file from Google Drive')
            .setCallback((data: any) => {
                if (data.action === window.google.picker.Action.PICKED) {
                    const f = data.docs[0];
                    onPicked({ id: f.id, name: f.name, mimeType: f.mimeType, url: f.url });
                }
            })
            .build();
        picker.setVisible(true);
    }, [connected, accessToken, pickerReady, toast]);

    /* ── Download file from Drive as base64 ── */
    const downloadFile = useCallback(async (fileId: string, mimeType: string): Promise<string> => {
        if (!accessToken) throw new Error('Not connected to Google Drive');

        // For Google Docs/Sheets export as PDF
        let url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        if (mimeType === 'application/vnd.google-apps.document') {
            url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`;
        }

        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!res.ok) throw new Error(`Drive download failed: ${res.statusText}`);

        const blob = await res.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }, [accessToken]);

    /* ── Upload file to Drive ── */
    const uploadFile = useCallback(async (
        content: string | Blob,
        fileName: string,
        mimeType: string = 'application/pdf'
    ): Promise<string> => {
        if (!accessToken) throw new Error('Not connected to Google Drive');

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
            headers: { Authorization: `Bearer ${accessToken}` },
            body: form,
        });

        if (!res.ok) throw new Error(`Drive upload failed: ${res.statusText}`);
        const data = await res.json();
        return data.id;
    }, [accessToken]);

    return { connected, openPicker, downloadFile, uploadFile };
}
