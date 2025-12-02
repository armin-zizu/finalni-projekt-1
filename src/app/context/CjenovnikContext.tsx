"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { auth, onAuthStateChanged } from "../../lib/firebase";
import { db } from "../../lib/firestore";
import { doc, setDoc, getDoc, collection, getDocs } from "firebase/firestore";

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
const initialCjenovnik: ArtiklCijena[] = [
  {
    naziv: "Kafa",
    cijena: 2.5,
    jeZestoko: false,
    proizvodnaCijena: 1.5,
    nabavnaCijena: 1.2,
    pocetnoStanje: 10,
  },
  {
    naziv: "Čaj",
    cijena: 2,
    jeZestoko: false,
    proizvodnaCijena: 1.0,
    nabavnaCijena: 0.8,
    pocetnoStanje: 15,
  },
  {
    naziv: "Vodka",
    cijena: 2,
    jeZestoko: true,
    zestokoKolicina: 0.04,
    proizvodnaCijena: 1.2,
    nabavnaCijena: 0.9,
    pocetnoStanje: 1000,
  },
  {
    naziv: "Rakija",
    cijena: 2,
    jeZestoko: true,
    zestokoKolicina: 0.03,
    proizvodnaCijena: 1.1,
    nabavnaCijena: 0.85,
    pocetnoStanje: 800,
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

  // Učitaj cjenovnik iz Firestore (primarno) i localStorage (cache) - HIBRIDNI PRISTUP
  useEffect(() => {
    const loadCjenovnik = async () => {
      const user = auth.currentUser;
      const userId = user?.uid;
      
      let firestoreCjenovnik: ArtiklCijena[] = [];
      let localStorageCjenovnik: ArtiklCijena[] = [];
      
      // 1. POKUŠAJ UČITATI IZ FIRESTORE (primarni izvor)
      if (user && userId) {
        try {
          const userDocRef = doc(db, "users", userId);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.cjenovnik && Array.isArray(data.cjenovnik)) {
              firestoreCjenovnik = data.cjenovnik;
              console.log("Cjenovnik učitano iz Firestore:", firestoreCjenovnik.length, "artikala");
            }
          }
        } catch (error: any) {
          const errorCode = error?.code || "";
          if (errorCode !== "permission-denied" && !errorCode.includes("permission") && !errorCode.includes("insufficient")) {
            console.warn("Greška pri učitavanju cjenovnika iz Firestore:", error);
          }
        }
      }
      
      // 2. UČITAJ IZ LOCALSTORAGE (cache/offline backup)
      if (userId) {
        const storageKey = `cjenovnik_${userId}`;
        const savedCjenovnik = localStorage.getItem(storageKey);
        if (savedCjenovnik) {
          try {
            localStorageCjenovnik = JSON.parse(savedCjenovnik);
          } catch (e) {
            console.warn("Greška pri čitanju cjenovnika iz localStorage:", e);
          }
        }
      } else {
        // Fallback: stari ključ
        const savedCjenovnik = localStorage.getItem("cjenovnik");
        if (savedCjenovnik) {
          try {
            localStorageCjenovnik = JSON.parse(savedCjenovnik);
          } catch (e) {
            console.warn("Greška pri čitanju cjenovnika iz localStorage (fallback):", e);
          }
        }
      }
      
      // 3. MERGE: Firestore ima prioritet, ali koristi localStorage ako Firestore prazan
      let finalCjenovnik: ArtiklCijena[] = [];
      if (firestoreCjenovnik.length > 0) {
        finalCjenovnik = firestoreCjenovnik;
      } else if (localStorageCjenovnik.length > 0) {
        finalCjenovnik = localStorageCjenovnik;
      }
      
      // 4. AŽURIRAJ POČETNO STANJE IZ ARHIVE (najnoviji obračun)
      if (finalCjenovnik.length > 0 && user && userId) {
        try {
          // Učitaj arhivu iz Firestore
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
              console.log("Ažuriranje cjenovnika iz najnovijeg obračuna:", najnovijiObracun.datum);
              
              // Ažuriraj početno stanje u cjenovniku sa krajnjim stanjem iz najnovijeg obračuna
              finalCjenovnik = finalCjenovnik.map((item) => {
                const artikalIzArhive = najnovijiObracun.artikli.find((a: any) => a.naziv === item.naziv);
                if (artikalIzArhive) {
                  // Koristi krajnje stanje iz arhive kao početno stanje
                  // Ako nema krajnjeg stanja, koristi ukupno; ako nema ni ukupnog, koristi početno
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
                  
                  if (novoPocetnoStanje !== item.pocetnoStanje) {
                    console.log(`Ažuriranje ${item.naziv}: ${item.pocetnoStanje} -> ${novoPocetnoStanje} (iz arhive)`);
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
      }
      
      // 5. POSTAVI CJENOVNIK
      if (finalCjenovnik.length > 0) {
        setCjenovnik(finalCjenovnik);
        // Spremi u localStorage kao cache
        if (userId) {
          const storageKey = `cjenovnik_${userId}`;
          localStorage.setItem(storageKey, JSON.stringify(finalCjenovnik));
        }
      }
    };
    
    loadCjenovnik();
    
    // Listener za promjene autentifikacije
    const unsubscribe = onAuthStateChanged(auth, () => {
      loadCjenovnik();
    });
    
    return () => unsubscribe();
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