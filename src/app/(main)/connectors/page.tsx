'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import PageHeader from '@/components/app/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
    HardDrive, CheckCircle2, XCircle, Loader, ExternalLink,
    FolderOpen, Upload, Unplug, Mail, FileStack, Cloud,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    getGooglePickerOrigin,
    GOOGLE_DRIVE_SCOPE_STRING,
    requestGoogleDriveAccessTokenSilent,
} from '@/lib/google-drive-picker';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_PICKER_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY || '';

declare global {
    interface Window { google: any; gapi: any; }
}

function loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => resolve();
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

const connectorCardClass =
    'border border-border/80 bg-card text-card-foreground shadow-sm transition-colors hover:border-primary/25 hover:shadow-md';

function ConnectorCard({
    icon, name, description, connected, connecting, email,
    onConnect, onDisconnect, comingSoon,
}: {
    icon: React.ReactNode; name: string; description: string;
    connected: boolean; connecting?: boolean; email?: string;
    onConnect?: () => void; onDisconnect?: () => void; comingSoon?: boolean;
}) {
    return (
        <Card className={cn(connectorCardClass, connected && 'border-emerald-500/35 bg-emerald-500/[0.06]')}>
            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-muted/80 p-2.5 text-foreground ring-1 ring-border/60">{icon}</div>
                    <div>
                        <CardTitle className="flex items-center gap-2 text-base text-foreground">
                            {name}
                            {connected && <Badge className="bg-emerald-600 text-xs hover:bg-emerald-700">Connected</Badge>}
                            {comingSoon && <Badge variant="secondary" className="text-xs">Coming soon</Badge>}
                        </CardTitle>
                        <CardDescription className="mt-0.5 text-xs text-muted-foreground">{description}</CardDescription>
                    </div>
                </div>
                {connected
                    ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                    : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground/50" />}
            </CardHeader>
            <CardContent className="flex flex-col gap-3 pt-0 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                    {connected && email ? `Signed in as ${email}` : connected ? 'Active' : 'Not connected'}
                </p>
                {!comingSoon && (
                    connected ? (
                        <Button variant="outline" size="sm" onClick={onDisconnect} className="w-full gap-1.5 text-destructive hover:text-destructive sm:w-auto">
                            <Unplug className="h-3.5 w-3.5" /> Disconnect
                        </Button>
                    ) : (
                        <Button size="sm" onClick={onConnect} disabled={connecting} className="w-full gap-1.5 sm:w-auto">
                            {connecting ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                            {connecting ? 'Connecting...' : 'Connect'}
                        </Button>
                    )
                )}
            </CardContent>
        </Card>
    );
}

function ConnectorsPageInner() {
    const searchParams = useSearchParams();
    const section = searchParams.get('section');
    const driveOnly = section === 'drive';

    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const toastRef = useRef(toast);
    toastRef.current = toast;

    const [driveConnecting, setDriveConnecting] = useState(false);
    const [driveConnected, setDriveConnected] = useState(false);
    const [driveEmail, setDriveEmail] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [scriptsLoaded, setScriptsLoaded] = useState(false);
    const [pickerLoaded, setPickerLoaded] = useState(false);

    const userDocRef = useMemoFirebase(
        () => (user ? doc(firestore, 'users', user.uid) : null),
        [user, firestore]
    );
    const { data: userProfile } = useDoc(userDocRef);

    useEffect(() => {
        if (userProfile?.googleDrive?.connected) {
            setDriveConnected(true);
            setDriveEmail(userProfile.googleDrive.email || '');
            setAccessToken(userProfile.googleDrive.accessToken || '');
        }
    }, [userProfile]);

    useEffect(() => {
        Promise.all([
            loadScript('https://accounts.google.com/gsi/client'),
            loadScript('https://apis.google.com/js/api.js'),
        ]).then(() => {
            setScriptsLoaded(true);
            window.gapi.load('picker', () => setPickerLoaded(true));
        }).catch(() => toastRef.current({ variant: 'destructive', title: 'Failed to load Google scripts' }));
    }, []);

    const handleConnectDrive = useCallback(async () => {
        if (!scriptsLoaded) {
            toastRef.current({ variant: 'destructive', title: 'Still loading', description: 'Wait a moment and try again.' });
            return;
        }
        setDriveConnecting(true);
        try {
            await new Promise<void>((resolve, reject) => {
                const tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_CLIENT_ID,
                    scope: GOOGLE_DRIVE_SCOPE_STRING,
                    callback: async (response: any) => {
                        if (response.error) { reject(new Error(response.error)); return; }
                        const token = response.access_token;
                        setAccessToken(token);

                        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        const info = await res.json();
                        const email = info.email || '';
                        setDriveConnected(true);
                        setDriveEmail(email);

                        if (userDocRef) {
                            await updateDoc(userDocRef as any, {
                                googleDrive: {
                                    connected: true,
                                    email,
                                    accessToken: token,
                                    connectedAt: new Date().toISOString(),
                                },
                            });
                        }
                        toastRef.current({ title: 'Google Drive connected', description: `Signed in as ${email}` });
                        resolve();
                    },
                });
                tokenClient.requestAccessToken({ prompt: 'consent' });
            });
        } catch (e: any) {
            toastRef.current({ variant: 'destructive', title: 'Connection failed', description: e.message });
        } finally {
            setDriveConnecting(false);
        }
    }, [scriptsLoaded, userDocRef]);

    const handleDisconnectDrive = async () => {
        if (accessToken) window.google?.accounts.oauth2.revoke(accessToken, () => { });
        setDriveConnected(false);
        setDriveEmail('');
        setAccessToken('');
        if (userDocRef) {
            await updateDoc(userDocRef as any, {
                googleDrive: { connected: false, email: '', accessToken: '', connectedAt: null },
            });
        }
        toastRef.current({ title: 'Google Drive disconnected' });
    };

    const handleOpenPicker = useCallback(async () => {
        if (!pickerLoaded || !accessToken) {
            toastRef.current({ variant: 'destructive', title: 'Picker not ready', description: 'Connect Drive first.' });
            return;
        }
        if (!GOOGLE_PICKER_API_KEY?.trim()) {
            toastRef.current({
                variant: 'destructive',
                title: 'Google Picker is not configured',
                description: 'In Vercel → Environment Variables, set NEXT_PUBLIC_GOOGLE_PICKER_API_KEY. In Google Cloud, enable Picker API + Drive API and restrict the API key by HTTP referrer (include https://ai-amber-omega.vercel.app/* or https://*.vercel.app/*).',
            });
            return;
        }

        let tokenForPicker = accessToken;
        if (GOOGLE_CLIENT_ID.trim()) {
            try {
                tokenForPicker = await requestGoogleDriveAccessTokenSilent(GOOGLE_CLIENT_ID);
                setAccessToken(tokenForPicker);
                if (userDocRef) {
                    await updateDoc(userDocRef as any, { 'googleDrive.accessToken': tokenForPicker });
                }
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : 'Refresh failed';
                toastRef.current({
                    variant: 'destructive',
                    title: 'Drive sign-in expired',
                    description: `${msg} Use Disconnect, then Connect again on this page.`,
                });
                return;
            }
        }

        const view = new window.google.picker.DocsView()
            .setMimeTypes(['application/pdf', 'image/*', 'application/vnd.google-apps.document'].join(','))
            .setIncludeFolders(true);

        const builder = new window.google.picker.PickerBuilder()
            .addView(view)
            .setOAuthToken(tokenForPicker)
            .setDeveloperKey(GOOGLE_PICKER_API_KEY)
            .setTitle('Browse Google Drive')
            .setCallback((data: { action?: string; docs?: Array<{ id: string; name: string }>; error?: string }) => {
                if (data.action === window.google.picker.Action.PICKED && data.docs?.[0]) {
                    const file = data.docs[0];
                    toastRef.current({ title: `Selected: ${file.name}`, description: `ID: ${file.id}` });
                    return;
                }
                if (data.action === window.google.picker.Action.CANCEL) return;
                if (data.error) {
                    toastRef.current({
                        variant: 'destructive',
                        title: 'Drive picker error',
                        description: data.error,
                    });
                }
            });
        const origin = getGooglePickerOrigin();
        if (origin) builder.setOrigin(origin);
        builder.build().setVisible(true);
    }, [pickerLoaded, accessToken, userDocRef]);

    const driveBlock = (
        <div className="flex flex-col gap-4">
            {!driveOnly && (
                <h2 className="text-sm font-semibold text-foreground">Integrations</h2>
            )}
            <ConnectorCard
                icon={<HardDrive className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
                name="Google Drive"
                description="Import files into quizzes, notes, and summarizer; save generated work back to Drive."
                connected={driveConnected}
                connecting={driveConnecting}
                email={driveEmail}
                onConnect={handleConnectDrive}
                onDisconnect={handleDisconnectDrive}
            />
            {driveConnected && (
                <Button variant="outline" size="sm" className="w-fit gap-2" onClick={handleOpenPicker}>
                    <FolderOpen className="h-4 w-4" /> Browse Drive files
                </Button>
            )}
            {driveConnected && (
                <Card className={cn(connectorCardClass, 'border-blue-500/25 bg-blue-500/[0.04]')}>
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-sm text-foreground">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            Drive is active
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                            Use import actions inside each tool, or save exports where the app offers “Save to Drive”.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-2 pt-0 sm:grid-cols-2">
                        {[
                            { icon: <FolderOpen className="h-3.5 w-3.5" />, text: 'Import PDFs into Quiz / Paper flows' },
                            { icon: <FolderOpen className="h-3.5 w-3.5" />, text: 'Import documents into Notes Maker' },
                            { icon: <FolderOpen className="h-3.5 w-3.5" />, text: 'Import files into Summarizer' },
                            { icon: <Upload className="h-3.5 w-3.5" />, text: 'Save generated notes & exports' },
                        ].map((f, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="text-primary">{f.icon}</span>
                                {f.text}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );

    const comingSoonBlock = (
        <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-foreground">Coming soon</h2>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {[
                    { name: 'Gmail', desc: 'Read and send emails from the Email Writer.', icon: <Mail className="h-5 w-5 text-muted-foreground" /> },
                    { name: 'Notion', desc: 'Sync notes and study plans with Notion.', icon: <FileStack className="h-5 w-5 text-muted-foreground" /> },
                    { name: 'OneDrive', desc: 'Import and export with Microsoft OneDrive.', icon: <Cloud className="h-5 w-5 text-muted-foreground" /> },
                ].map(c => (
                    <ConnectorCard
                        key={c.name}
                        icon={c.icon}
                        name={c.name}
                        description={c.desc}
                        connected={false}
                        comingSoon
                    />
                ))}
            </div>
        </div>
    );

    return (
        <div className={cn('mx-auto flex w-full max-w-5xl flex-col gap-8', driveOnly && 'max-w-xl')}>
            <PageHeader
                title={driveOnly ? 'Google Drive' : 'Connectors'}
                description={driveOnly
                    ? 'Connect or manage Google Drive for imports and saves.'
                    : 'Connect external tools to import content and save your work.'}
            />

            {driveOnly ? (
                driveBlock
            ) : (
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                    <div className="lg:col-span-5">{driveBlock}</div>
                    <div className="lg:col-span-7">{comingSoonBlock}</div>
                </div>
            )}
        </div>
    );
}

function ConnectorsFallback() {
    return (
        <div className="mx-auto max-w-5xl space-y-4">
            <div className="h-10 w-48 animate-pulse rounded-md bg-muted" />
            <div className="h-24 animate-pulse rounded-xl bg-muted" />
        </div>
    );
}

export default function ConnectorsPage() {
    return (
        <Suspense fallback={<ConnectorsFallback />}>
            <ConnectorsPageInner />
        </Suspense>
    );
}
