"use client";

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
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
  displayOrder?: number | null; // Dodaj displayOrder tip
};

// ---- Tip contexta ----
type CjenovnikContextType = {
  cjenovnik: ArtiklCijena[];
  pendingCjenovnik: ArtiklCijena[]; // Privremeni cjenovnik za nove artikle
  setCjenovnik: (value: ArtiklCijena[] | ((prev: ArtiklCijena[]) => ArtiklCijena[])) => void;
  addArtikal: (artikal: ArtiklCijena) => void;
  updateCjenovnik: () => Promise<void>;
  refreshPrethodniCjenovnik: (noviCjenovnik?: ArtiklCijena[]) => void;
};

const CjenovnikContext = createContext<CjenovnikContextType | undefined>(undefined);

export function CjenovnikProvider({ children }: { children: ReactNode }) {
  const [cjenovnik, setCjenovnik] = useState<ArtiklCijena[]>([]);
  const [pendingCjenovnik, setPendingCjenovnik] = useState<ArtiklCijena[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const prethodniCjenovnikRef = useRef<ArtiklCijena[]>([]);
  const roleContext = useContext(RoleContext);
  const user = roleContext?.user;

  // Spremi cjenovnik u API - automatski kada se promijeni (samo ako je dužina promijenjena ili nazivi)
  // NE sprema svaki put kada se promijeni pocetnoStanje ili nabavnaCijena (jer to nije u bazi)
  useEffect(() => {
    // Email je glavni identifikator
    const userId = user?.email || user?.id;
    if (!userId) return;
    
    // Ako je prvo učitavanje, ne spremaj (izbjegni beskonačnu petlju)
    if (isInitialLoad) {
      return;
    }
    
    // Provjeri da li se promijenio broj artikala, nazivi, ILI bilo koje vrijednosti (osim pocetnoStanje koje se ne čuva u bazi)
    const prethodniCjenovnik = prethodniCjenovnikRef.current;
    const trenutniNazivi = cjenovnik.map((a) => a.naziv).sort().join(",");
    const prethodniNazivi = prethodniCjenovnik.map((a) => a.naziv).sort().join(",");
    
    // Provjeri da li su se promijenile vrijednosti artikala (cijena, nabavnaCijena, proizvodnaCijena, zestokoKolicina, itd.)
    // Također provjeri da li se promijenio displayOrder (za redoslijed)
    const trenutniPodaci = cjenovnik.map((a) => ({
      naziv: a.naziv,
      cijena: a.cijena,
      nabavnaCijena: a.nabavnaCijena,
      proizvodnaCijena: a.proizvodnaCijena,
      zestokoKolicina: a.zestokoKolicina,
      nabavnaCijenaFlase: a.nabavnaCijenaFlase,
      zapreminaFlase: a.zapreminaFlase,
      displayOrder: a.displayOrder, // Uključi displayOrder u poređenje
    })).sort((a, b) => a.naziv.localeCompare(b.naziv));
    
    const prethodniPodaci = prethodniCjenovnik.map((a) => ({
      naziv: a.naziv,
      cijena: a.cijena,
      nabavnaCijena: a.nabavnaCijena,
      proizvodnaCijena: a.proizvodnaCijena,
      zestokoKolicina: a.zestokoKolicina,
      nabavnaCijenaFlase: a.nabavnaCijenaFlase,
      zapreminaFlase: a.zapreminaFlase,
      displayOrder: a.displayOrder, // Uključi displayOrder u poređenje
    })).sort((a, b) => a.naziv.localeCompare(b.naziv));
    
    const podaciIsti = JSON.stringify(trenutniPodaci) === JSON.stringify(prethodniPodaci);
    
    // Provjeri redoslijed (nazivi na različitim pozicijama) - VAŽNO za displayOrder
    let redoslijedPromijenjen = false;
    for (let i = 0; i < Math.max(cjenovnik.length, prethodniCjenovnik.length); i++) {
      if (cjenovnik[i]?.naziv !== prethodniCjenovnik[i]?.naziv) {
        redoslijedPromijenjen = true;
        break;
      }
    }
    
    // Spremi ako su se promijenili nazivi, broj artikala, ILI bilo koje vrijednosti (osim pocetnoStanje)
    // ILI ako se promijenio redoslijed
    // ILI ako je broj artikala smanjen (obrisani artikli)
    if (podaciIsti && cjenovnik.length === prethodniCjenovnik.length && !redoslijedPromijenjen) {
      // Nema promjene - ne sprema (možda se samo promijenilo pocetnoStanje koje se ne čuva u bazi)
      return;
    }
    
    // Ako je broj artikala smanjen, obavezno spremi (artikli su obrisani)
    if (cjenovnik.length < prethodniCjenovnik.length) {
      console.log("📊 Broj artikala se smanjio (obrisani artikli), sprema se u API");
    }
    
    // SPREMI U API - automatski čim se promijeni
    // Koristi setTimeout da se izbjegne ažuriranje tokom renderovanja
    const timeoutId = setTimeout(async () => {
      try {
        // Snimi trenutni cjenovnik u closure da bi se koristio u async funkciji
        const currentCjenovnik = cjenovnik;
        
        // Transformiraj u format koji API očekuje - šalji SVE podatke (uključujući pocetnoStanje i displayOrder)
        const apiCjenovnik = currentCjenovnik.map((item) => ({
          naziv: item.naziv,
          cijena: item.cijena,
          proizvodnaCijena: item.proizvodnaCijena,
          zestokoKolicina: item.zestokoKolicina,
          nabavnaCijena: item.nabavnaCijena,
          nabavnaCijenaFlase: item.nabavnaCijenaFlase,
          zapreminaFlase: item.zapreminaFlase,
          pocetnoStanje: item.pocetnoStanje, // Takođe šalji pocetnoStanje
          displayOrder: item.displayOrder !== null && item.displayOrder !== undefined ? item.displayOrder : null, // Šalji displayOrder
        }));
          
        await saveCjenovnik(userId, apiCjenovnik);
        console.log("Cjenovnik automatski spremljen u API:", currentCjenovnik.length, "artikala");
        // Ažuriraj prethodni cjenovnik nakon spremanja - koristi useRef da se izbjegne re-render
        prethodniCjenovnikRef.current = currentCjenovnik;
      } catch (error: any) {
        console.warn("Greška pri spremanju cjenovnika u API:", error);
      }
    }, 0);
    
    return () => clearTimeout(timeoutId);
  }, [cjenovnik, isInitialLoad, user?.email, user?.id]);

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
    
    // Dodaj displayOrder novim artiklima - postavi ih na kraj (najveći displayOrder + 1)
    const maxDisplayOrder = cjenovnik.length > 0 
      ? Math.max(...cjenovnik.map((item) => item.displayOrder ?? -1)) 
      : -1;
    
    const noviArtikliSaDisplayOrder = noviArtikli.map((item, index) => ({
      ...item,
      displayOrder: maxDisplayOrder + 1 + index, // Postavi na kraj
    }));
    
    const noviCjenovnik = [...cjenovnik, ...noviArtikliSaDisplayOrder];
    
    // Eksplicitno sačuvaj u API PRVO pre nego što ažuriramo state
    // Email je glavni identifikator - uzmi iz roleContext ponovo da osiguraš da imamo najnovije podatke
    const currentUser = roleContext?.user ?? null;
    const userId = currentUser?.email || currentUser?.id;
    
    console.log("🔍 updateCjenovnik - currentUser:", currentUser, "userId:", userId);
    
    if (!userId) {
      console.error("❌ Korisnik nije autentifikovan, ne mogu spremiti cjenovnik", {
        roleContext,
        user: currentUser,
        userEmail: currentUser?.email,
        userId: currentUser?.id
      });
      throw new Error("Korisnik nije autentifikovan");
    }
    
    try {
      // Transformiraj u format koji API očekuje - šalji SVE podatke (uključujući pocetnoStanje i displayOrder)
      const apiCjenovnik = noviCjenovnik.map((item) => ({
        naziv: item.naziv,
        cijena: item.cijena,
        proizvodnaCijena: item.proizvodnaCijena,
        zestokoKolicina: item.zestokoKolicina,
        nabavnaCijena: item.nabavnaCijena,
        nabavnaCijenaFlase: item.nabavnaCijenaFlase,
        zapreminaFlase: item.zapreminaFlase,
        pocetnoStanje: item.pocetnoStanje, // Takođe šalji pocetnoStanje
        displayOrder: item.displayOrder !== null && item.displayOrder !== undefined ? item.displayOrder : null, // Šalji displayOrder
      }));
      
      console.log("💾 Spremanje cjenovnika u API - userId:", userId, "artikala:", apiCjenovnik.length, "nazivi:", apiCjenovnik.map((a: any) => a.naziv));
      await saveCjenovnik(userId, apiCjenovnik);
      console.log("✅ Cjenovnik uspješno sačuvan u API:", noviCjenovnik.length, "artikala");
      
      // Ako je uspješno sačuvano, ažuriraj state
      // Postavi isInitialLoad flag da ne bi automatski čuvanje prepisalo podatke
      setIsInitialLoad(true);
      // Ažuriraj prethodniCjenovnikRef PRIJE nego što ažuriramo cjenovnik state
      prethodniCjenovnikRef.current = noviCjenovnik; // Koristi useRef da se izbjegne re-render
      setCjenovnik(noviCjenovnik);
      setPendingCjenovnik([]); // Očisti privremeni cjenovnik
      // Resetuj flag nakon duže pauze da omogući da API poziv završi prije nego što se automatsko čuvanje aktivira
      setTimeout(() => {
        setIsInitialLoad(false);
        // Osiguraj da prethodniCjenovnikRef odgovara trenutnom cjenovniku nakon čuvanja
        // Koristi funkcijski update da dobijemo najnoviji state
        setCjenovnik((currentCjenovnik) => {
          prethodniCjenovnikRef.current = currentCjenovnik;
          return currentCjenovnik; // Ne mijenjaj state, samo osvježi ref
        });
      }, 500); // Povećano sa 100ms na 500ms da se osigura da API poziv završi
    } catch (error: any) {
      console.error("❌ Greška pri čuvanju cjenovnika u API:", error);
      throw error; // Re-throw da se korisnik obavesti o grešci
    }
  };

  // Funkcija za eksplicitno ažuriranje prethodniCjenovnikRef
  // Ako se proslijedi noviCjenovnik, koristi ga, inače koristi trenutni cjenovnik
  const refreshPrethodniCjenovnik = (noviCjenovnik?: ArtiklCijena[]) => {
    prethodniCjenovnikRef.current = noviCjenovnik || cjenovnik;
  };

  return (
    <CjenovnikContext.Provider value={{ cjenovnik, pendingCjenovnik, setCjenovnik, addArtikal, updateCjenovnik, refreshPrethodniCjenovnik }}>
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