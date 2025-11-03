'use server';

import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp, cert } from 'firebase-admin/app';

// This function initializes Firebase Admin SDK. It's safe to call multiple times.
function initializeAdmin() {
  if (getApps().length) {
    return;
  }

  const serviceAccountEnv = process.env.FIREBASE_ADMIN_SDK_CONFIG;
  if (!serviceAccountEnv) {
    throw new Error('Firebase Admin SDK service account key is not available. Please set the FIREBASE_ADMIN_SDK_CONFIG environment variable.');
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountEnv);
    initializeApp({
      credential: cert(serviceAccount)
    });
  } catch (e) {
    console.error("Failed to parse FIREBASE_ADMIN_SDK_CONFIG:", e);
    throw new Error("Invalid Firebase Admin SDK configuration.");
  }
}


export async function deleteCurrentUser(userId: string) {
    try {
        initializeAdmin();
        const auth = getAuth();
        const firestore = getFirestore();

        // 1. Delete all posts and their subcollections by the user
        const postsQuery = firestore.collection('posts').where('authorId', '==', userId);
        const postsSnapshot = await postsQuery.get();
        const batch = firestore.batch();

        for (const postDoc of postsSnapshot.docs) {
            // Delete comments subcollection for each post
            const commentsSnapshot = await postDoc.ref.collection('comments').get();
            commentsSnapshot.forEach(commentDoc => {
                batch.delete(commentDoc.ref);
            });
            // Delete the post itself
            batch.delete(postDoc.ref);
        }
        
        // 2. Delete the user's profile document from 'users' collection
        const userProfileRef = firestore.collection('users').doc(userId);
        batch.delete(userProfileRef);

        // Commit all Firestore deletions in a batch
        await batch.commit();

        // 3. Delete the user from Firebase Authentication
        await auth.deleteUser(userId);

        return { success: true };
    } catch (error: any) {
        console.error('Error deleting user and their content:', error);
        return { success: false, error: error.message };
    }
}
