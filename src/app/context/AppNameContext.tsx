"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../../lib/firebase"; // Ispravljena putanja do lib/firebase.ts (ako je u src/app/lib)
import { doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface AppNameContextType {
  appName: string;
  setAppName: React.Dispatch<React.SetStateAction<string>>;
}

const AppNameContext = createContext<AppNameContextType | undefined>(undefined);

export function AppNameProvider({ children }: { children: React.ReactNode }) {
  // Početna vrijednost - učitaj iz Firestore
  const [appName, setAppName] = useState<string>("Moja Aplikacija");

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // Očisti prethodni snapshot listener ako postoji
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (user) {
        const userId = user.uid;
        const storageKey = `appName_${userId}`;
        
        // 1. POKUŠAJ UČITATI IZ FIRESTORE (primarni izvor)
        let firestoreAppName: string | null = null;
        try {
          const userDocRef = doc(db, "users", userId);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const data = userDoc.data();
            firestoreAppName = data.appName || null;
            if (firestoreAppName) {
              setAppName(firestoreAppName);
              // Spremi u localStorage kao cache
              localStorage.setItem(storageKey, firestoreAppName);
              console.log("AppName učitano iz Firestore:", firestoreAppName);
            }
          }
        } catch (error: any) {
          const errorCode = error?.code || "";
          if (errorCode !== "permission-denied" && !errorCode.includes("permission") && !errorCode.includes("insufficient")) {
            console.warn("Greška pri učitavanju appName iz Firestore-a:", error);
          }
        }
        
        // 2. UČITAJ IZ LOCALSTORAGE (cache/offline backup) - samo ako Firestore nema
        if (!firestoreAppName) {
          const localAppName = localStorage.getItem(storageKey) || localStorage.getItem("appName"); // Fallback na stari ključ
          if (localAppName) {
            setAppName(localAppName);
            // Spremi u Firestore ako postoji u localStorage
            try {
              const userDocRef = doc(db, "users", userId);
              await setDoc(userDocRef, { appName: localAppName }, { merge: true });
            } catch (error: any) {
              // Ignoriraj greške
            }
          }
        }

        // Postavi real-time listener za automatsku sinkronizaciju na svim uređajima
        try {
          const userDocRefForSnapshot = doc(db, "users", userId);
          unsubscribeSnapshot = onSnapshot(
            userDocRefForSnapshot, 
            (docSnapshot) => {
              if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                const newAppName = data.appName;
                if (newAppName) {
                  // Uvijek ažuriraj, jer možda je promijenjeno na drugom uređaju
                  setAppName((currentAppName) => {
                    if (currentAppName !== newAppName) {
                      console.log("AppName ažurirano preko real-time listenera:", newAppName);
                      // Spremi u localStorage kao cache (per-user)
                      const storageKeyForSnapshot = `appName_${userId}`;
                      localStorage.setItem(storageKeyForSnapshot, newAppName);
                      return newAppName;
                    }
                    return currentAppName;
                  });
                }
              }
            },
            (error: any) => {
              // Ignoriraj greške dozvola
              const errorCode = error?.code || "";
              if (errorCode !== "permission-denied" && !errorCode.includes("permission") && !errorCode.includes("insufficient")) {
                console.warn("Greška u onSnapshot za appName:", error);
              }
            }
          );
        } catch (error: any) {
          // Ignoriraj greške dozvola
          const errorCode = error?.code || "";
          if (errorCode !== "permission-denied" && !errorCode.includes("permission") && !errorCode.includes("insufficient")) {
            console.warn("Greška pri postavljanju onSnapshot za appName:", error);
          }
        }
      } else {
        // Ako korisnik nije prijavljen, učitaj iz localStorage ili default
        const localAppName = localStorage.getItem("appName");
        setAppName(localAppName || "Moja Aplikacija");
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    const userId = user?.uid;
    
    if (!userId || appName.trim() === "" || typeof window === "undefined") return;
    
    const storageKey = `appName_${userId}`;
    
    // 1. SPREMI U FIRESTORE (primarno)
    const saveToFirestore = async () => {
      try {
        const userDocRef = doc(db, "users", userId);
        await setDoc(userDocRef, { appName }, { merge: true });
        console.log("AppName spremljen u Firestore");
      } catch (error: any) {
        const errorCode = error?.code || "";
        if (errorCode !== "permission-denied" && !errorCode.includes("permission") && !errorCode.includes("insufficient")) {
          console.warn("Greška pri spremanju appName u Firestore:", error);
        }
      }
    };
    
    // 2. SPREMI U LOCALSTORAGE (cache/offline backup)
    localStorage.setItem(storageKey, appName);
    
    // Spremi u Firestore
    saveToFirestore();
  }, [appName]);

  return (
    <AppNameContext.Provider value={{ appName, setAppName }}>
      {children}
    </AppNameContext.Provider>
  );
}

export const useAppName = () => {
  const context = useContext(AppNameContext);
  if (!context) {
    throw new Error("useAppName must be used within an AppNameProvider");
  }
  return context;
};