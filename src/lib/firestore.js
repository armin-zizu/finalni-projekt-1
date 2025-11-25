// lib/firestore.js
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp, collection, getDocs, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyB1PZRZcpjrOvpwEWunbHiUstIUuYIE6k4',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'zadnji-projekt.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'zadnji-projekt',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'zadnji-projekt.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '917711656028',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:917711656028:web:34b091221909d7f4ab0299',
};

// Koristi postojeću app instancu ako postoji, inače kreiraj novu
const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export { doc, setDoc, serverTimestamp, collection, getDocs, onSnapshot };