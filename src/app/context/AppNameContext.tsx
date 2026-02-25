"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { getCurrentUser, getAuthToken } from "../../lib/api";

interface AppNameContextType {
  appName: string;
  setAppName: React.Dispatch<React.SetStateAction<string>>;
}

const AppNameContext = createContext<AppNameContextType | undefined>(undefined);

export function AppNameProvider({ children }: { children: React.ReactNode }) {
  // Početna vrijednost
  const [appName, setAppName] = useState<string>("Moja Aplikacija");

  // Učitaj appName iz baze podataka kada se aplikacija učita i kada se token promijeni
  useEffect(() => {
    const loadAppName = async () => {
      try {
        // Provjeri da li je korisnik prijavljen
        const token = getAuthToken();
        if (!token) {
          console.log("AppNameContext - No auth token, using default app name");
          // Resetuj na default ako nema tokena
          setAppName("Moja Aplikacija");
          return;
        }

        // Učitaj korisnika koji sadrži appName
        const user = await getCurrentUser();
        if (user && user.appName) {
          console.log("AppNameContext - Loaded app name from database:", user.appName);
          setAppName(user.appName);
        } else if (user && !user.appName) {
          // Ako korisnik postoji ali nema appName, koristi default
          console.log("AppNameContext - User exists but no app name, using default");
          setAppName("Moja Aplikacija");
        } else {
          // Korisnik nije pronađen ili endpoint nije dostupan - koristi default bez logovanja
          setAppName("Moja Aplikacija");
        }
      } catch (error) {
        // Tiha greška - ne loguj jer to nije kritično
        // AppNameContext već ima fallback na default vrijednost
        setAppName("Moja Aplikacija");
      }
    };

    const applyAppNameFromPayload = (payload: any) => {
      const nextAppName = payload?.appName;
      if (typeof nextAppName === 'string' && nextAppName.trim().length > 0) {
        setAppName(nextAppName.trim());
      }
    };

    // Učita appName kada se komponenta učita
    loadAppName();

    // Listener za promjene u localStorage (kada se token promijeni)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        // Token se promijenio - ponovno učitaj appName
        loadAppName();
        return;
      }

      if (e.key === 'app-name-updated' && e.newValue) {
        try {
          const payload = JSON.parse(e.newValue);
          applyAppNameFromPayload(payload);
        } catch {
          // ignore invalid storage payload
        }
      }
    };

    // Listener za custom event kada se korisnik prijavi/odjavi
    const handleAuthChange = () => {
      loadAppName();
    };

    const handleAppNameUpdated = (event: Event) => {
      const customEvent = event as CustomEvent;
      applyAppNameFromPayload(customEvent.detail);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-changed', handleAuthChange);
    window.addEventListener('app-name-updated', handleAppNameUpdated as EventListener);
    
    // Osvježi appName kada se prozor fokusira (korisnik se vratio na aplikaciju)
    const handleFocus = () => {
      loadAppName();
    };
    window.addEventListener('focus', handleFocus);

    // Periodičko osvježavanje appName (svakih 5 minuta) - za slučaj da se promijeni na drugom uređaju
    const intervalId = setInterval(() => {
      loadAppName();
    }, 300000); // 5 minuta

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-changed', handleAuthChange);
      window.removeEventListener('app-name-updated', handleAppNameUpdated as EventListener);
      window.removeEventListener('focus', handleFocus);
      clearInterval(intervalId);
    };
  }, []);

  // Ime se sprema eksplicitno kroz handleSaveAppName u profile/page.tsx
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