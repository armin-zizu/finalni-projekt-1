"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../../lib/firebase"; // Ispravljena putanja do lib/firebase.ts (ako je u src/app/lib)
import { doc, setDoc, getDoc, onSnapshot, Timestamp } from "firebase/firestore";
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
        let firestoreUpdatedAt: number | null = null;
        try {
          const userDocRef = doc(db, "users", userId);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const data = userDoc.data();
            firestoreAppName = data.appName || null;
            if (data.appNameUpdatedAt) {
              firestoreUpdatedAt = data.appNameUpdatedAt.toMillis ? data.appNameUpdatedAt.toMillis() : null;
            }
            if (firestoreAppName) {
              setAppName(firestoreAppName);
              console.log("AppName učitano iz Firestore:", firestoreAppName);
            }
          }
        } catch (error: any) {
          const errorCode = error?.code || "";
          if (errorCode !== "permission-denied" && !errorCode.includes("permission") && !errorCode.includes("insufficient")) {
            console.warn("Greška pri učitavanju appName iz Firestore-a:", error);
          }
        }
        
        // 2. NE UČITAVAJ IZ LOCALSTORAGE - sve je u Firestore
        // Ako Firestore nema ime, koristi default
        if (!firestoreAppName) {
          setAppName("Moja Aplikacija");
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
                const newUpdatedAt = data.appNameUpdatedAt ? (data.appNameUpdatedAt.toMillis ? data.appNameUpdatedAt.toMillis() : null) : null;
                
                if (newAppName) {
                  // Uvijek ažuriraj, jer možda je promijenjeno na drugom uređaju
                  setAppName((currentAppName) => {
                    if (currentAppName !== newAppName) {
                      console.log("AppName ažurirano preko real-time listenera:", newAppName);
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
        // Ako korisnik nije prijavljen, koristi default
        setAppName("Moja Aplikacija");
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []);

  // Uklonjen automatski useEffect koji sprema appName u Firestore
  // Ime se sada sprema samo eksplicitno kroz handleSaveAppName u profile/page.tsx
  // Ovo sprječava nepotrebne update-e i race condition probleme

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