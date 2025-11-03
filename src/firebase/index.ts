'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, browserSessionPersistence, setPersistence } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (!getApps().length) {
    // Important! initializeApp() is called without any arguments because Firebase App Hosting
    // integrates with the initializeApp() function to provide the environment variables needed to
    // populate the FirebaseOptions in production. It is critical that we attempt to call initializeApp()
    // without arguments.
    let firebaseApp;
    try {
      // Attempt to initialize via Firebase App Hosting environment variables
      firebaseApp = initializeApp();
    } catch (e) {
      // Only warn in production because it's normal to use the firebaseConfig to initialize
      // during development
      if (process.env.NODE_ENV === "production") {
        console.warn('Automatic initialization failed. Falling back to firebase config object.', e);
      }
      firebaseApp = initializeApp(firebaseConfig);
    }

    return getSdks(firebaseApp);
  }

  // If already initialized, return the SDKs with the already initialized App
  return getSdks(getApp());
}

let cachedAuth: Auth | null = null;

function getAuthWithSessionPersistence(firebaseApp: FirebaseApp): Auth {
  if (cachedAuth) {
    return cachedAuth;
  }

  const isBrowser = typeof window !== 'undefined';

  if (isBrowser) {
    try {
      cachedAuth = initializeAuth(firebaseApp, {
        persistence: browserSessionPersistence,
      });
      return cachedAuth;
    } catch (error) {
      // initializeAuth throws if Auth was already initialized elsewhere (e.g., during hot reload).
      console.warn('initializeAuth failed, falling back to existing instance.', error);
    }
  }

  cachedAuth = getAuth(firebaseApp);

  if (isBrowser) {
    void setPersistence(cachedAuth, browserSessionPersistence).catch((error) => {
      console.warn('Failed to enforce session-scoped auth persistence.', error);
    });
  }

  return cachedAuth;
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuthWithSessionPersistence(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
export * from './auth/delete-user';
