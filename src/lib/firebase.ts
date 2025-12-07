import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut, sendEmailVerification, updateEmail } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase konfiguracija iz environment varijabli
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Inicijalizuj Firebase samo ako su environment varijable dostupne
let app: any = null;
let auth: any = null;
let db: any = null;
let storage: any = null;

// Proveri da li su sve potrebne vrednosti dostupne
const hasValidConfig = firebaseConfig.apiKey && 
                       firebaseConfig.authDomain && 
                       firebaseConfig.projectId &&
                       firebaseConfig.apiKey !== 'dummy-key-for-build';

if (hasValidConfig) {
  try {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (error) {
    // Ignoriraj greške tokom build-a
    if (typeof window !== 'undefined') {
      console.error('Firebase initialization error:', error);
    }
  }
}

export { auth, db, storage };

export { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut, sendEmailVerification, updateEmail };
