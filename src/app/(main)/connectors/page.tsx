'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import PageHeader from '@/components/app/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
    HardDrive, CheckCircle2, XCircle, Loader, ExternalLink,
    FolderOpen, Upload, Unplug,
} from 'lucide-react';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_PICKER_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY || '';
const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.readonly',
].join(' ');

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

/* ─── Connector card ────────────────────────────────────────────────────── */
function ConnectorCard({
    icon, name, description, connected, connecting, email,
    onConnect, onDisconnect, comingSoon,
}: {
    icon: React.ReactNode; name: string; description: string;
    connected: boolean; connecting?: boolean; email?: string;
    onConnect?: () => void; onDisconnect?: () => void; comingSoon?: boolean;
}) {
    return (
        <Card className={connected ? 'border-green-500/40 bg-green-500/5' : ''}>
            <CardHeader className="flex-row items-start justify-between gap-4 pb-3">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-muted">{icon}</div>
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            {name}
                            {connected && <Badge className="bg-green-600 hover:bg-green-700 text-xs">Connected</Badge>}
                            {comingSoon && <Badge variant="secondary" className="text-xs">Coming Soon</Badge>}
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
                    </div>
                </div>
                {connected
                    ? <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    : <XCircle className="h-5 w-5 text-muted-foreground/40 flex-shrink-0 mt-0.5" />}
            </CardHeader>
            <CardContent className="pt-0 flex items-center justify-between gap-4">
                <p className="text-xs text-muted-foreground">
                    {connected && email ? `Signed in as ${email}` : connected ? 'Active' : 'Not connected'}
                </p>
                {!comingSoon && (
                    connected ? (
                        <Button variant="outline" size="sm" onClick={onDisconnect} className="gap-1.5 text-destructive hover:text-destructive">
                            <Unplug className="h-3.5 w-3.5" /> Disconnect
                        </Button>
                    ) : (
                        <Button size="sm" onClick={onConnect} disabled={connecting} className="gap-1.5">
                            {connecting ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                            {connecting ? 'Connecting...' : 'Connect'}
                        </Button>
                    )
                )}
            </CardContent>
        </Card>
    );
}

/* ─── Main page ─────────────────────────────────────────────────────────── */
export default function ConnectorsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

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

    // Restore saved connection
    useEffect(() => {
        if (userProfile?.googleDrive?.connected) {
            setDriveConnected(true);
            setDriveEmail(userProfile.googleDrive.email || '');
            setAccessToken(userProfile.googleDrive.accessToken || '');
        }
    }, [userProfile]);

    // Load Google Identity + GAPI scripts
    useEffect(() => {
        Promise.all([
            loadScript('https://accounts.google.com/gsi/client'),
            loadScript('https://apis.google.com/js/api.js'),
        ]).then(() => {
            setScriptsLoaded(true);
            // Load picker after gapi is ready
            window.gapi.load('picker', () => setPickerLoaded(true));
        }).catch(() => toast({ variant: 'destructive', title: 'Failed to load Google scripts' }));
    }, []);

    /* ── Connect ── */
    const handleConnectDrive = useCallback(async () => {
        if (!scriptsLoaded) {
            toast({ variant: 'destructive', title: 'Scripts not ready, please wait a moment.' });
            return;
        }
        setDriveConnecting(true);
        try {
            await new Promise<void>((resolve, reject) => {
                const tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_CLIENT_ID,
                    scope: SCOPES,
                    callback: async (response: any) => {
                        if (response.error) { reject(new Error(response.error)); return; }
                        const token = response.access_token;
                        setAccessToken(token);

                        // Get email
                        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        const info = await res.json();
                        const email = info.email || '';
                        setDriveConnected(true);
                        setDriveEmail(email);

                        // Persist to Firestore
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
                        toast({ title: '✅ Google Drive Connected!', description: `Signed in as ${email}` });
                        resolve();
                    },
                });
                tokenClient.requestAccessToken({ prompt: 'consent' });
            });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Connection failed', description: e.message });
        } finally {
            setDriveConnecting(false);
        }
    }, [scriptsLoaded, userDocRef, toast]);

    /* ── Disconnect ── */
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
        toast({ title: 'Google Drive Disconnected' });
    };

    /* ── Open Picker (test) ── */
    const handleOpenPicker = useCallback(() => {
        if (!pickerLoaded || !accessToken) {
            toast({ variant: 'destructive', title: 'Picker not ready or not connected.' });
            return;
        }
        const picker = new window.google.picker.PickerBuilder()
            .addView(window.google.picker.ViewId.DOCS)
            .setOAuthToken(accessToken)
            .setDeveloperKey(GOOGLE_PICKER_API_KEY)
            .setCallback((data: any) => {
                if (data.action === window.google.picker.Action.PICKED) {
                    const file = data.docs[0];
                    toast({ title: `Selected: ${file.name}`, description: `ID: ${file.id}` });
                }
            })
            .build();
        picker.setVisible(true);
    }, [pickerLoaded, accessToken, toast]);

    return (
        <div className="flex flex-col gap-8 max-w-2xl">
            <PageHeader
                title="Connectors"
                description="Connect external tools and services to enhance your workflow."
            />

            {/* Available */}
            <div className="flex flex-col gap-4">
                <h2 className="text-sm font-semibold text-foreground">Available</h2>

                <ConnectorCard
                    icon={<HardDrive className="h-5 w-5 text-blue-500" />}
                    name="Google Drive"
                    description="Import files from Drive into AI tools, and save generated content back to Drive."
                    connected={driveConnected}
                    connecting={driveConnecting}
                    email={driveEmail}
                    onConnect={handleConnectDrive}
                    onDisconnect={handleDisconnectDrive}
                />

                {/* Test picker button when connected */}
                {driveConnected && (
                    <Button variant="outline" size="sm" className="w-fit gap-2" onClick={handleOpenPicker}>
                        <FolderOpen className="h-4 w-4" /> Browse Drive Files
                    </Button>
                )}
            </div>

            {/* What you can do */}
            {driveConnected && (
                <Card className="border-blue-500/20 bg-blue-500/5">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            Google Drive is active
                        </CardTitle>
                        <CardDescription className="text-xs">
                            These features are now available across the app:
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                            { icon: <FolderOpen className="h-3.5 w-3.5" />, text: 'Import PDFs from Drive → Quiz Generator' },
                            { icon: <FolderOpen className="h-3.5 w-3.5" />, text: 'Import documents → Notes Maker' },
                            { icon: <FolderOpen className="h-3.5 w-3.5" />, text: 'Import files → Summarizer' },
                            { icon: <Upload className="h-3.5 w-3.5" />, text: 'Save Notes to Google Drive' },
                            { icon: <Upload className="h-3.5 w-3.5" />, text: 'Save Essays / Emails / Letters' },
                            { icon: <Upload className="h-3.5 w-3.5" />, text: 'Export Progress Report PDF' },
                        ].map((f, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="text-blue-500">{f.icon}</span>
                                {f.text}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Coming soon */}
            <div className="flex flex-col gap-4">
                <h2 className="text-sm font-semibold text-foreground">Coming Soon</h2>
                <div className="grid grid-cols-1 gap-3">
                    {[
                        { name: 'Gmail', desc: 'Read and send emails directly from the Email Writer.' },
                        { name: 'Notion', desc: 'Sync notes and study plans with Notion pages.' },
                        { name: 'OneDrive', desc: 'Import and export files via Microsoft OneDrive.' },
                    ].map(c => (
                        <ConnectorCard
                            key={c.name}
                            icon={<HardDrive className="h-5 w-5 text-muted-foreground" />}
                            name={c.name}
                            description={c.desc}
                            connected={false}
                            comingSoon
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
