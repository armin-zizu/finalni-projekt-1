"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { auth, onAuthStateChanged } from "../../lib/firebase";
import { db } from "../../lib/firestore";
import { doc, setDoc, getDoc, collection, getDocs, onSnapshot } from "firebase/firestore";

// ---- Tip artikla ----
type ArtiklCijena = {
  naziv: string;
  cijena: number;
  jeZestoko: boolean;
  zestokoKolicina?: number;
  proizvodnaCijena?: number;
  nabavnaCijena: number;
  nabavnaCijenaFlase?: number;
  zapreminaFlase?: number;
  pocetnoStanje: number;
};

// ---- Tip contexta ----
type CjenovnikContextType = {
  cjenovnik: ArtiklCijena[];
  pendingCjenovnik: ArtiklCijena[]; // Privremeni cjenovnik za nove artikle
  setCjenovnik: React.Dispatch<React.SetStateAction<ArtiklCijena[]>>;
  addArtikal: (artikal: ArtiklCijena) => void;
  updateCjenovnik: () => void; // Potvrda promjena
};

const CjenovnikContext = createContext<CjenovnikContextType | undefined>(undefined);

// ---- Početni podaci ----
// Samo Kafa za nove korisnike - korisnici će sami dodavati artikle
const initialCjenovnik: ArtiklCijena[] = [
  {
    naziv: "Kafa",
    cijena: 2.5,
    jeZestoko: false,
    proizvodnaCijena: 1.5,
    nabavnaCijena: 1.2,
    pocetnoStanje: 0,
  },
];

// ---- Provider ----
export function CjenovnikProvider({ children }: { children: ReactNode }) {
  const [cjenovnik, setCjenovnik] = useState<ArtiklCijena[]>(() => {
    if (typeof window === "undefined") {
      return initialCjenovnik;
    }
    // Fallback: stari ključ za migraciju
    const savedCjenovnik = localStorage.getItem("cjenovnik");
    return savedCjenovnik ? JSON.parse(savedCjenovnik) : initialCjenovnik;
  });
  const [pendingCjenovnik, setPendingCjenovnik] = useState<ArtiklCijena[]>([]); // Privremeni cjenovnik

  // Učitaj cjenovnik iz Firestore (primarno) i localStorage (cache) - HIBRIDNI PRISTUP sa real-time sinkronizacijom
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;
    let unsubscribeAuth: (() => void) | null = null;
    
    const setupCjenovnikListener = async (user: any, userId: string) => {
      // Očisti prethodni snapshot listener ako postoji
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }
      
      // 1. UČITAJ IZ LOCALSTORAGE (cache/offline backup) - za početno učitavanje
      let localStorageCjenovnik: ArtiklCijena[] = [];
      const storageKey = `cjenovnik_${userId}`;
      const savedCjenovnik = localStorage.getItem(storageKey);
      if (savedCjenovnik) {
        try {
          localStorageCjenovnik = JSON.parse(savedCjenovnik);
        } catch (e) {
          console.warn("Greška pri čitanju cjenovnika iz localStorage:", e);
        }
      }
      
      // 2. POSTAVI REAL-TIME LISTENER ZA FIRESTORE (automatska sinkronizacija)
      try {
        const userDocRef = doc(db, "users", userId);
        
        unsubscribeSnapshot = onSnapshot(
          userDocRef,
          async (docSnapshot) => {
            if (docSnapshot.exists()) {
              const data = docSnapshot.data();
              if (data.cjenovnik && Array.isArray(data.cjenovnik)) {
                let firestoreCjenovnik = data.cjenovnik;
                console.log("Cjenovnik učitano iz Firestore (real-time):", firestoreCjenovnik.length, "artikala");
                
                // 3. AŽURIRAJ POČETNO STANJE IZ ARHIVE (najnoviji obračun)
                try {
                  const obracuniRef = collection(db, "users", userId, "obracuni");
                  const snapshot = await getDocs(obracuniRef);
                  const arhiva = snapshot.docs.map((doc) => doc.data());
                  
                  if (arhiva.length > 0) {
                    // Sortiraj po datumu (najnoviji prvo)
                    arhiva.sort((a: any, b: any) => {
                      const dateA = new Date(a.datum?.split(".").reverse().join("-") || 0).getTime();
                      const dateB = new Date(b.datum?.split(".").reverse().join("-") || 0).getTime();
                      return dateB - dateA;
                    });
                    
                    // Uzmi najnoviji obračun
                    const najnovijiObracun = arhiva[0];
                    if (najnovijiObracun && najnovijiObracun.artikli && Array.isArray(najnovijiObracun.artikli)) {
                      // Ažuriraj početno stanje u cjenovniku sa krajnjim stanjem iz najnovijeg obračuna
                      firestoreCjenovnik = firestoreCjenovnik.map((item) => {
                        const artikalIzArhive = najnovijiObracun.artikli.find((a: any) => a.naziv === item.naziv);
                        if (artikalIzArhive) {
                          let novoPocetnoStanje = item.pocetnoStanje; // Default
                          
                          if (artikalIzArhive.krajnjeStanje !== undefined && artikalIzArhive.krajnjeStanje !== null && artikalIzArhive.krajnjeStanje > 0) {
                            novoPocetnoStanje = artikalIzArhive.krajnjeStanje;
                          } else if (artikalIzArhive.ukupno !== undefined && artikalIzArhive.ukupno !== null && artikalIzArhive.ukupno > 0) {
                            novoPocetnoStanje = artikalIzArhive.ukupno;
                          } else if (artikalIzArhive.pocetnoStanje !== undefined && artikalIzArhive.pocetnoStanje !== null && artikalIzArhive.pocetnoStanje > 0) {
                            novoPocetnoStanje = artikalIzArhive.pocetnoStanje;
                          }
                          
                          // Za kafu, uvijek resetuj na 0
                          if (item.naziv.toLowerCase().includes("kafa")) {
                            novoPocetnoStanje = 0;
                          }
                          
                          return {
                            ...item,
                            pocetnoStanje: novoPocetnoStanje,
                          };
                        }
                        return item;
                      });
                    }
                  }
                } catch (error: any) {
                  const errorCode = error?.code || "";
                  if (errorCode !== "permission-denied" && !errorCode.includes("permission") && !errorCode.includes("insufficient")) {
                    console.warn("Greška pri učitavanju arhive za ažuriranje cjenovnika:", error);
                  }
                }
                
                // 4. POSTAVI CJENOVNIK (Firestore ima prioritet)
                if (firestoreCjenovnik.length > 0) {
                  setCjenovnik(firestoreCjenovnik);
                  // Spremi u localStorage kao cache
                  localStorage.setItem(storageKey, JSON.stringify(firestoreCjenovnik));
                } else if (localStorageCjenovnik.length > 0) {
                  // Ako Firestore nema cjenovnik, koristi localStorage
                  setCjenovnik(localStorageCjenovnik);
                }
              }
            }
          },
          (error: any) => {
            const errorCode = error?.code || "";
            if (errorCode !== "permission-denied" && !errorCode.includes("permission") && !errorCode.includes("insufficient")) {
              console.warn("Greška pri real-time listeneru za cjenovnik:", error);
            }
          }
        );
      } catch (error: any) {
        const errorCode = error?.code || "";
        if (errorCode !== "permission-denied" && !errorCode.includes("permission") && !errorCode.includes("insufficient")) {
          console.warn("Greška pri postavljanju real-time listenera za cjenovnik:", error);
        }
      }
    };
    
    // Listener za promjene autentifikacije
    unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user && user.uid) {
        setupCjenovnikListener(user, user.uid);
      } else {
        // Ako nema korisnika, očisti listener
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
          unsubscribeSnapshot = null;
        }
      }
    });
    
    return () => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
      if (unsubscribeAuth) {
        unsubscribeAuth();
      }
    };
  }, []);

  // Spremi cjenovnik u Firestore (primarno) i localStorage (cache) - HIBRIDNI PRISTUP
  useEffect(() => {
    const user = auth.currentUser;
    const userId = user?.uid;
    
    if (!userId || cjenovnik.length === 0) return;
    
    // 1. SPREMI U FIRESTORE (primarno)
    const saveToFirestore = async () => {
      try {
        const userDocRef = doc(db, "users", userId);
        await setDoc(userDocRef, { cjenovnik }, { merge: true });
        console.log("Cjenovnik spremljen u Firestore");
      } catch (error: any) {
        const errorCode = error?.code || "";
        if (errorCode !== "permission-denied" && !errorCode.includes("permission") && !errorCode.includes("insufficient")) {
          console.warn("Greška pri spremanju cjenovnika u Firestore:", error);
        }
      }
    };
    
    // 2. SPREMI U LOCALSTORAGE (cache/offline backup)
    const storageKey = `cjenovnik_${userId}`;
    localStorage.setItem(storageKey, JSON.stringify(cjenovnik));
    
    // Spremi u Firestore
    saveToFirestore();
  }, [cjenovnik]);

  const addArtikal = (artikal: ArtiklCijena) => {
    setPendingCjenovnik((prev) => [...prev, artikal]); // Dodaj u privremeni cjenovnik
  };

  const updateCjenovnik = () => {
    setCjenovnik((prev) => [...prev, ...pendingCjenovnik]); // Potvrdi promjene
    setPendingCjenovnik([]); // Očisti privremeni cjenovnik
  };

  return (
    <CjenovnikContext.Provider value={{ cjenovnik, pendingCjenovnik, setCjenovnik, addArtikal, updateCjenovnik }}>
      {children}
    </CjenovnikContext.Provider>
  );
}

// ---- Hook za korištenje contexta ----
export function useCjenovnik() {
  const context = useContext(CjenovnikContext);
  if (!context) {
    throw new Error("useCjenovnik mora biti korišten unutar CjenovnikProvider");
  }
  return context;
}