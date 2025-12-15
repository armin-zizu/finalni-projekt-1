"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { RoleContext } from "./RoleContext";
import { getCjenovnik, saveCjenovnik, getObracuni } from "../../lib/api";

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
  // Koristi useContext direktno sa fallback-om za SSR
  const roleContext = useContext(RoleContext);
  const user = roleContext?.user ?? null;
  const [cjenovnik, setCjenovnik] = useState<ArtiklCijena[]>(initialCjenovnik);
  const [pendingCjenovnik, setPendingCjenovnik] = useState<ArtiklCijena[]>([]); // Privremeni cjenovnik
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Flag za prvo učitavanje
  const [prethodniCjenovnik, setPrethodniCjenovnik] = useState<ArtiklCijena[]>([]); // Prethodno stanje cjenovnika

  // Učitaj cjenovnik iz API-ja
  useEffect(() => {
    if (!user?.id) {
      // Ako nema korisnika, koristi initial cjenovnik
      setCjenovnik(initialCjenovnik);
      setIsInitialLoad(false);
      return;
    }

    const loadCjenovnik = async () => {
      try {
        // Učitaj cjenovnik iz API-ja
        console.log("📥 Učitavam cjenovnik iz API-ja za korisnika:", user.id);
        const apiCjenovnik = await getCjenovnik(user.id);
        console.log("📦 API vratio cjenovnik:", apiCjenovnik?.length || 0, "artikala:", apiCjenovnik?.map((a: any) => a.naziv) || []);
        
        if (apiCjenovnik && apiCjenovnik.length > 0) {
          // Transformiraj API format u format koji context koristi
          // API vraća: { id, naziv, cijena, proizvodnaCijena, zestokoKolicina, pocetnoStanje: 0 }
          // Context očekuje: { naziv, cijena, jeZestoko, zestokoKolicina, proizvodnaCijena, nabavnaCijena, pocetnoStanje, ... }
          
          let transformedCjenovnik: ArtiklCijena[] = apiCjenovnik.map((item: any) => ({
            naziv: item.naziv,
            cijena: item.cijena,
            jeZestoko: item.zestokoKolicina ? true : false,
            zestokoKolicina: item.zestokoKolicina,
            proizvodnaCijena: item.proizvodnaCijena,
            nabavnaCijena: item.proizvodnaCijena || 0, // Koristi proizvodnaCijena kao nabavnaCijena ako nije postavljeno
            pocetnoStanje: item.pocetnoStanje || 0,
            // Dodatna polja koja možda nedostaju
            nabavnaCijenaFlase: item.nabavnaCijenaFlase,
            zapreminaFlase: item.zapreminaFlase,
          }));

          // Ažuriraj početno stanje iz najnovijeg obračuna
          // Ovo je opcionalno - ako ne uspe, koristi početno stanje iz cjenovnika
          try {
            const obracuni = await getObracuni(user.id).catch((error) => {
              console.warn("Greška pri učitavanju obracuni za ažuriranje početnog stanja (ignoriramo):", error);
              return []; // Vrati prazan array ako ne uspe
            });
            if (obracuni && obracuni.length > 0) {
              // Sortiraj po datumu (najnoviji prvo)
              const sortedObracuni = [...obracuni].sort((a: any, b: any) => {
                const dateA = new Date(a.datum?.split(".").reverse().join("-") || 0).getTime();
                const dateB = new Date(b.datum?.split(".").reverse().join("-") || 0).getTime();
                return dateB - dateA;
              });

              const najnovijiObracun = sortedObracuni[0];
              if (najnovijiObracun && najnovijiObracun.artikli && Array.isArray(najnovijiObracun.artikli)) {
                transformedCjenovnik = transformedCjenovnik.map((item) => {
                  const artikalIzArhive = najnovijiObracun.artikli.find((a: any) => a.naziv === item.naziv);
                  if (artikalIzArhive) {
                    let novoPocetnoStanje = item.pocetnoStanje;
                    
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
          } catch (error) {
            console.warn("Greška pri učitavanju arhive za ažuriranje cjenovnika:", error);
          }

          setPrethodniCjenovnik(cjenovnik);
          setCjenovnik(transformedCjenovnik);
          console.log("Cjenovnik učitano iz API-ja:", transformedCjenovnik.length, "artikala");
        } else {
          // Nema cjenovnik u API-ju - koristi initial
          setPrethodniCjenovnik(cjenovnik);
          setCjenovnik(initialCjenovnik);
          console.log("Cjenovnik postavljen na initial za korisnika:", user.id);
        }
        setIsInitialLoad(false);
      } catch (error) {
        console.warn("Greška pri učitavanju cjenovnika iz API-ja:", error);
        // U slučaju greške, koristi initial cjenovnik
        setCjenovnik(initialCjenovnik);
        setIsInitialLoad(false);
      }
    };

    loadCjenovnik();
  }, [user?.id]);

  // TEMPORARY: Disabled Firebase listeners - comment out to re-enable
  /*
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
  */

  // Spremi cjenovnik u API - automatski kada se promijeni
  useEffect(() => {
    if (!user?.id) return;
    
    // Ako je prvo učitavanje, ne spremaj (izbjegni beskonačnu petlju)
    if (isInitialLoad) {
      return;
    }
    
    // SPREMI U API - automatski čim se promijeni
    const saveToAPI = async () => {
      try {
        // Transformiraj u format koji API očekuje
        const apiCjenovnik = cjenovnik.map((item) => ({
          naziv: item.naziv,
          cijena: item.cijena,
          proizvodnaCijena: item.proizvodnaCijena,
          zestokoKolicina: item.zestokoKolicina,
          // Napomena: pocetnoStanje se ne sprema u cjenovnik tabelu, već se uzima iz obračuna
        }));
        
        await saveCjenovnik(user.id, apiCjenovnik);
        console.log("Cjenovnik automatski spremljen u API:", cjenovnik.length, "artikala");
      } catch (error: any) {
        console.warn("Greška pri spremanju cjenovnika u API:", error);
      }
    };
    
    // Spremi u API
    saveToAPI();
  }, [cjenovnik, isInitialLoad, user?.id]);

  const addArtikal = (artikal: ArtiklCijena) => {
    // Dodaj u privremeni cjenovnik (pending) - čeka na potvrdu
    setPendingCjenovnik((prev) => {
      if (prev.some((a) => a.naziv.toLowerCase() === artikal.naziv.toLowerCase())) {
        return prev;
      }
      if (cjenovnik.some((a) => a.naziv.toLowerCase() === artikal.naziv.toLowerCase())) {
        return prev;
      }
      return [...prev, artikal];
    });
  };

  const updateCjenovnik = async () => {
    // Potvrdi promjene - dodaj pending artikle u glavni cjenovnik
    // Izračunaj novi cjenovnik pre nego što ažuriramo state
    const noviArtikli = pendingCjenovnik.filter(
      (pending) => !cjenovnik.some((existing) => existing.naziv.toLowerCase() === pending.naziv.toLowerCase())
    );
    if (noviArtikli.length === 0) {
      console.log("ℹ️ Nema novih artikala za dodavanje");
      return; // Nema ništa za dodati
    }
    
    const noviCjenovnik = [...cjenovnik, ...noviArtikli];
    
    // Eksplicitno sačuvaj u API PRVO pre nego što ažuriramo state
    if (!user?.id) {
      console.error("❌ Korisnik nije autentifikovan, ne mogu spremiti cjenovnik");
      throw new Error("Korisnik nije autentifikovan");
    }
    
    try {
      // Transformiraj u format koji API očekuje
      const apiCjenovnik = noviCjenovnik.map((item) => ({
        naziv: item.naziv,
        cijena: item.cijena,
        proizvodnaCijena: item.proizvodnaCijena,
        zestokoKolicina: item.zestokoKolicina,
      }));
      
      console.log("💾 Spremanje cjenovnika u API - userId:", user.id, "artikala:", apiCjenovnik.length, "nazivi:", apiCjenovnik.map((a: any) => a.naziv));
      await saveCjenovnik(user.id, apiCjenovnik);
      console.log("✅ Cjenovnik uspješno sačuvan u API:", noviCjenovnik.length, "artikala");
      
      // Ako je uspješno sačuvano, ažuriraj state
      setCjenovnik(noviCjenovnik);
      setPendingCjenovnik([]); // Očisti privremeni cjenovnik
    } catch (error: any) {
      console.error("❌ Greška pri čuvanju cjenovnika u API:", error);
      throw error; // Re-throw da se korisnik obavesti o grešci
    }
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