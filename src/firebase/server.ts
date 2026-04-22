'use strict';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Server-safe Firebase initializer. This file intentionally does NOT use React
// client annotations so it can be imported from server actions / API routes.
export function initializeFirebaseServer() {
    if (getApps().length) {
        return getSdks(getApp());
    }

    const config = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG) : firebaseConfig;
    const app = initializeApp(config);
    return getSdks(app);
}

export function getSdks(firebaseApp: FirebaseApp) {
    return {
        firebaseApp,
        firestore: getFirestore(firebaseApp),
        storage: getStorage(firebaseApp),
    };
}

export type ServerSdks = ReturnType<typeof getSdks>;
