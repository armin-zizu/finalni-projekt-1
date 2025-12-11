import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
};

// Initialize Firebase - TEMPORARY: Disabled during migration to server API
// TODO: Remove Firebase completely after migration
let app: FirebaseApp | null = null;
try {
  // Only initialize if we have valid config
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
  }
} catch (error) {
  console.warn('Firebase initialization skipped (migration in progress):', error);
}

// Initialize Firebase services - fallback to mock objects if not initialized
export const auth: Auth = app ? getAuth(app) : ({} as Auth);
export const db: Firestore = app ? getFirestore(app) : ({} as Firestore);
export const storage: FirebaseStorage = app ? getStorage(app) : ({} as FirebaseStorage);

// Export onAuthStateChanged for convenience - TEMPORARY: Mock during migration
export const onAuthStateChanged = app 
  ? require('firebase/auth').onAuthStateChanged
  : (auth: any, callback: (user: any) => void) => {
      // Mock function that immediately calls callback with null
      callback(null);
      return () => {}; // Return unsubscribe function
    };

// Export default app
export default app;

