// src/lib/firebase-admin.ts
import { getAuth } from "firebase-admin/auth";
import { initializeApp, cert, getApps } from "firebase-admin/app";

// Inicijalizuj Firebase Admin samo ako još nije inicijalizovan i ako su environment varijable postavljene
if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  // Provjeri da li su environment varijable postavljene
  if (projectId && clientEmail && privateKey) {
    try {
      initializeApp({
        credential: cert({
          projectId: projectId,
          clientEmail: clientEmail,
          privateKey: privateKey.replace(/\\n/g, "\n"),
        }),
      });
    } catch (error) {
      console.error("Greška pri inicijalizaciji Firebase Admin:", error);
      // Ne bacaj grešku ovdje - dozvoli da aplikacija nastavi, samo API routes neće raditi
    }
  } else {
    console.warn("Firebase Admin environment varijable nisu postavljene. Admin funkcionalnosti neće raditi.");
  }
}

export const getSessionCookie = async (cookie: string) => {
  try {
    const decodedToken = await getAuth().verifySessionCookie(cookie);
    return decodedToken;
  } catch (error) {
    console.error("Greška verifikacije session cookie-a:", error);
    return null;
  }
};

export const auth = getAuth();