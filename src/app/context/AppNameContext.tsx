"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
// TODO: Implementirati API pozive za AppName

interface AppNameContextType {
  appName: string;
  setAppName: React.Dispatch<React.SetStateAction<string>>;
}

const AppNameContext = createContext<AppNameContextType | undefined>(undefined);

export function AppNameProvider({ children }: { children: React.ReactNode }) {
  // Početna vrijednost - učitaj iz Firestore
  const [appName, setAppName] = useState<string>("Moja Aplikacija");

  useEffect(() => {
    // TODO: Implementirati API poziv za učitavanje appName
    // const loadAppName = async () => {
    //   try {
    //     const response = await fetch('/api/users/app-name');
    //     if (response.ok) {
    //       const data = await response.json();
    //       setAppName(data.appName || "Moja Aplikacija");
    //     }
    //   } catch (error) {
    //     console.error("Greška pri učitavanju appName:", error);
    //   }
    // };
    // loadAppName();
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