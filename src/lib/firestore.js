// lib/firestore.js
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp, collection, getDocs, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Inicijalizuj Firebase samo ako su environment varijable dostupne
let app = null;
const hasValidConfig = firebaseConfig.apiKey && 
                       firebaseConfig.authDomain && 
                       firebaseConfig.projectId;

if (hasValidConfig) {
  try {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
  } catch (error) {
    // Ignoriraj greške tokom build-a
    if (typeof window !== 'undefined') {
      console.error('Firestore initialization error:', error);
    }
  }
}

export const db = app ? getFirestore(app) : null;
export { doc, setDoc, serverTimestamp, collection, getDocs, onSnapshot };