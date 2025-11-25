import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut, sendEmailVerification, updateEmail } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase konfiguracija iz environment varijabli
// Fallback na hardcoded vrijednosti ako environment varijable nisu dostupne
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyB1PZRZcpjrOvpwEWunbHiUstIUuYIE6k4',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'zadnji-projekt.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'zadnji-projekt',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'zadnji-projekt.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '917711656028',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:917711656028:web:34b091221909d7f4ab0299',
};

// Debug log (samo u development modu)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('Firebase Config Check:', {
    hasApiKey: !!firebaseConfig.apiKey,
    apiKeyPrefix: firebaseConfig.apiKey?.substring(0, 10) + '...',
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    allEnvVars: {
      NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'EXISTS' : 'MISSING',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? 'EXISTS' : 'MISSING',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'EXISTS' : 'MISSING',
    }
  });
}

// Provjera konfiguracije
if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
  const errorMsg = `Missing Firebase configuration. Check .env.local for NEXT_PUBLIC_ variables.
    apiKey: ${firebaseConfig.apiKey ? 'EXISTS' : 'MISSING'}
    authDomain: ${firebaseConfig.authDomain ? 'EXISTS' : 'MISSING'}
    projectId: ${firebaseConfig.projectId ? 'EXISTS' : 'MISSING'}`;
  console.error('Firebase Config Error:', errorMsg);
  throw new Error(errorMsg);
}

// Koristi postojeću app instancu ako postoji, inače kreiraj novu
const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut, sendEmailVerification, updateEmail };