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
  // NE koristi localStorage za početno učitavanje - čekaj da se korisnik prijavi
  const [cjenovnik, setCjenovnik] = useState<ArtiklCijena[]>(initialCjenovnik);
  const [pendingCjenovnik, setPendingCjenovnik] = useState<ArtiklCijena[]>([]); // Privremeni cjenovnik
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Flag za prvo učitavanje
  const [prethodniCjenovnik, setPrethodniCjenovnik] = useState<ArtiklCijena[]>([]); // Prethodno stanje cjenovnika

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
      
      // POSTAVI REAL-TIME LISTENER ZA FIRESTORE (automatska sinkronizacija)
      // NE koristi localStorage - sve se čuva u Firestore
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
                
                // 4. AŽURIRAJ POČETNO STANJE IZ ARHIVE (najnoviji obračun)
                // VAŽNO: Ažuriraj samo ako artikal već postoji u cjenovniku (nije novi artikal)
                // Ako je artikal novi (nije bio u prethodnom cjenovniku), koristi početno stanje koje je korisnik unio
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
                      // ALI samo za artikle koji su već postojali u prethodnom cjenovniku
                      firestoreCjenovnik = firestoreCjenovnik.map((item) => {
                        // Provjeri da li artikal već postoji u trenutnom cjenovniku (nije novi)
                        // Koristi cjenovnik state koji sadrži prethodno stanje prije nego što se ažurira
                        const postojiUTrenutnom = cjenovnik.some((a) => a.naziv === item.naziv);
                        
                        // Ako artikal ne postoji u trenutnom cjenovniku, koristi početno stanje koje je korisnik unio
                        if (!postojiUTrenutnom) {
                          return item; // Koristi početno stanje iz Firestore (koje je korisnik unio)
                        }
                        
                        // Ako artikal postoji u prethodnom cjenovniku, provjeri arhivu
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
                        // Ako artikal ne postoji u arhivi, koristi početno stanje iz Firestore
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
                
                // POSTAVI CJENOVNIK (samo iz Firestore - nema localStorage)
                if (firestoreCjenovnik.length > 0) {
                  // Firestore ima cjenovnik - koristi ga (to je izvor istine)
                  // Sačuvaj prethodno stanje prije ažuriranja
                  setPrethodniCjenovnik(cjenovnik);
                  setCjenovnik(firestoreCjenovnik);
                  console.log("Cjenovnik postavljen iz Firestore za korisnika:", userId);
                  setIsInitialLoad(false); // Označi da je prvo učitavanje završeno
                } else {
                  // Nema cjenovnik u Firestore - koristi initial
                  setPrethodniCjenovnik(cjenovnik);
                  setCjenovnik(initialCjenovnik);
                  console.log("Cjenovnik postavljen na initial za korisnika:", userId);
                  setIsInitialLoad(false); // Označi da je prvo učitavanje završeno
                }
              }
            }
          },
          (error: any) => {
            // Ignoriraj greške permisija - mogu se desiti kada korisnik nema dozvolu
            const errorCode = error?.code || error?.message || "";
            const isPermissionError = 
              errorCode === "permission-denied" || 
              errorCode.includes("permission") || 
              errorCode.includes("insufficient") ||
              errorCode.includes("Missing or insufficient permissions") ||
              error?.message?.includes("permission") ||
              error?.message?.includes("insufficient");
            
            if (!isPermissionError) {
              // Samo loguj ako nije greška permisija
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

  // Spremi cjenovnik u Firestore - SAMO Firestore, nema localStorage
  // Ovo se pokreće kada se cjenovnik promijeni (ažuriranje cijena, brisanje, itd.)
  // NE sprema se kada se prvi put učita iz Firestore (izbjegavanje beskonačne petlje)
  useEffect(() => {
    const user = auth.currentUser;
    const userId = user?.uid;
    
    if (!userId) return;
    
    // Ako je prvo učitavanje, ne spremaj (izbjegni beskonačnu petlju)
    if (isInitialLoad) {
      return;
    }
    
    // SPREMI U FIRESTORE - automatski čim se promijeni
    const saveToFirestore = async () => {
      try {
        const userDocRef = doc(db, "users", userId);
        await setDoc(userDocRef, { cjenovnik }, { merge: true });
        console.log("Cjenovnik automatski spremljen u Firestore:", cjenovnik.length, "artikala");
      } catch (error: any) {
        const errorCode = error?.code || "";
        if (errorCode !== "permission-denied" && !errorCode.includes("permission") && !errorCode.includes("insufficient")) {
          console.warn("Greška pri spremanju cjenovnika u Firestore:", error);
        }
      }
    };
    
    // Spremi u Firestore
    saveToFirestore();
  }, [cjenovnik, isInitialLoad]);

  const addArtikal = (artikal: ArtiklCijena) => {
    // Dodaj u privremeni cjenovnik (pending) - čeka na potvrdu
    setPendingCjenovnik((prev) => [...prev, artikal]);
  };

  const updateCjenovnik = () => {
    // Potvrdi promjene - dodaj pending artikle u glavni cjenovnik
    // useEffect će automatski spremiti u Firestore kada se cjenovnik promijeni
    setCjenovnik((prev) => [...prev, ...pendingCjenovnik]);
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