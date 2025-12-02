"use client";

import React, { useState, useEffect, useRef } from "react";
import { useCjenovnik } from "../context/CjenovnikContext";
import { useSubscription } from "../context/SubscriptionContext";
import { useRole } from "../context/RoleContext";
import { auth } from "../../lib/firebase";
import { db, storage } from "../../lib/firebase";
import { doc, setDoc, getDoc, collection, getDocs, serverTimestamp, onSnapshot, Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";

// ---- Tipovi ----
type Artikal = {
  naziv: string;
  cijena: number;
  pocetnoStanje: number;
  ulaz: number;
  ukupno: number;
  utroseno: number;
  krajnjeStanje: number;
  vrijednostKM: number;
  zestokoKolicina?: number;
  proizvodnaCijena?: number;
  isKrajnjeSet: boolean;
  staroPocetnoStanje?: number; // Za praćenje starog stanja pri ažuriranju
  sačuvanUlaz?: number; // Sačuvaj ulaz prije resetiranja za prikaz u arhivi
};

type Rashod = {
  naziv: string;
  cijena: number;
};

type Prihod = {
  naziv: string;
  cijena: number;
};

type ArhiviraniArtikal = {
  naziv: string;
  cijena: number;
  pocetnoStanje: number;
  ulaz: number;
  ukupno: number;
  utroseno: number;
  krajnjeStanje: number;
  vrijednostKM: number;
  zestokoKolicina?: number;
  proizvodnaCijena?: number;
  staroPocetnoStanje?: number; // Staro stanje prije ažuriranja
  sačuvanUlaz?: number; // Sačuvani ulaz za prikaz u arhivi
};

type ArhiviraniObracun = {
  datum: string;
  ukupnoArtikli: number;
  ukupnoRashod: number;
  ukupnoPrihod: number;
  neto: number;
  artikli: ArhiviraniArtikal[];
  rashodi: Rashod[];
  prihodi: Prihod[];
  isAzuriran?: boolean; // Flag da je obračun bio ažuriran
  imaUlaz?: boolean; // Flag da obračun ima ulaz
};

// ---- CSS Stilovi ----
const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "separate" as const,
  borderSpacing: 0,
  background: "#ffffff",
  borderRadius: "8px",
  overflow: "hidden",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
  marginBottom: "20px",
};

const tableWrapperStyle: React.CSSProperties = {
  width: "100%",
  overflowX: "auto",
  marginBottom: "20px",
  WebkitOverflowScrolling: "touch",
};

const thStyle: React.CSSProperties = {
  padding: "12px",
  textAlign: "left" as const,
  background: "#f8fafc",
  color: "#1f2937",
  fontSize: "14px",
  fontWeight: 600,
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle: React.CSSProperties = {
  padding: "12px",
  textAlign: "left" as const,
  borderBottom: "1px solid #f3f4f6",
  fontSize: "14px",
  color: "#374151",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "80px",
  padding: "8px",
  border: "1px solid #e5e7eb",
  borderRadius: "6px",
  textAlign: "center",
  fontSize: "14px",
  background: "#fff",
  transition: "border-color 0.2s ease-in-out",
  outline: "none",
  appearance: "none",
  MozAppearance: "textfield",
  WebkitAppearance: "none",
};

const dateInputStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "160px",
  padding: "8px",
  border: "1px solid #e5e7eb",
  borderRadius: "6px",
  fontSize: "14px",
  outline: "none",
  background: "#fff",
};

const containerStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "16px",
  fontFamily: "'Inter', sans-serif",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "160px",
  padding: "8px 16px",
  background: "#3b82f6",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 500,
  transition: "background-color 0.2s ease-in-out",
  marginRight: "8px",
  marginBottom: "8px",
};

const saveButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#15803d",
};

const editButtonStyle: React.CSSProperties = {
  padding: "8px",
  background: "none",
  color: "#3b82f6",
  border: "none",
  cursor: "pointer",
  fontSize: "14px",
};

const deleteButtonStyle: React.CSSProperties = {
  padding: "8px",
  background: "none",
  color: "#dc2626",
  border: "none",
  cursor: "pointer",
  fontSize: "14px",
};

const cancelButtonStyle: React.CSSProperties = {
  padding: "8px",
  background: "none",
  color: "#dc2626",
  border: "none",
  cursor: "pointer",
  fontSize: "14px",
};

// Stilovi za niska stanja
const lowStockYellowStyle: React.CSSProperties = {
  backgroundColor: "#fef3c7", // Žuta pozadina
};

const lowStockRedStyle: React.CSSProperties = {
  backgroundColor: "#fee2e2", // Crvena pozadina
};

const rashodInputStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "160px",
  padding: "8px",
  border: "1px solid #e5e7eb",
  borderRadius: "6px",
  fontSize: "14px",
  outline: "none",
  marginRight: "8px",
  marginBottom: "8px",
  boxSizing: "border-box",
};

// ---- Glavna komponenta ----
export default function ObracunPage() {
  const { cjenovnik, setCjenovnik } = useCjenovnik();
  const { subscription } = useSubscription();
  const { role, permissions } = useRole();
  const [artikli, setArtikli] = useState<Artikal[]>([]);
  const [rashodi, setRashodi] = useState<Rashod[]>([]);
  const [prihodi, setPrihodi] = useState<Prihod[]>([]);
  const [newRashod, setNewRashod] = useState<Rashod>({ naziv: "", cijena: 0 });
  const [newPrihod, setNewPrihod] = useState<Prihod>({ naziv: "", cijena: 0 });
  const [editRashodIndex, setEditRashodIndex] = useState<number | null>(null);
  const [editPrihodIndex, setEditPrihodIndex] = useState<number | null>(null);
  const [editRashod, setEditRashod] = useState<Rashod>({ naziv: "", cijena: 0 });
  const [editPrihod, setEditPrihod] = useState<Prihod>({ naziv: "", cijena: 0 });
  const [trenutniDatum, setTrenutniDatum] = useState<Date>(new Date());
  const [isAzuriran, setIsAzuriran] = useState<boolean>(false); // Praćenje da li je obračun bio ažuriran
  const [resetKey, setResetKey] = useState<number>(0); // Key za reset input polja
  const [isOwner, setIsOwner] = useState<boolean>(false); // Provjera da li je korisnik vlasnik
  const [hasUlazInCache, setHasUlazInCache] = useState<boolean>(false); // Provjera da li postoji ulaz u cache-u
  
  // Postavke za malu zalihu
  const [lowStockEnabled, setLowStockEnabled] = useState<boolean>(false);
  const [lowStockThresholdZestoka, setLowStockThresholdZestoka] = useState<number>(100);
  const [lowStockThresholdOstala, setLowStockThresholdOstala] = useState<number>(10);
  
  // State za slike faktura
  const [invoiceImages, setInvoiceImages] = useState<File[]>([]);
  const [uploadingImages, setUploadingImages] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [savedInvoiceImagesCount, setSavedInvoiceImagesCount] = useState<number>(0); // Broj sačuvanih slika

  // Provjeri da li je korisnik vlasnik (iz user dokumenta)
  useEffect(() => {
    const checkIsOwner = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const data = userDoc.data();
            setIsOwner(data.isOwner === true);
          }
        } catch (error) {
          console.warn("Greška pri provjeri isOwner:", error);
        }
      }
    };
    checkIsOwner();
  }, []);

  // Provjeri da li korisnik može editovati (ne može ako grace period istekne)
  const canEditSubscription = subscription && (subscription.isActive || subscription.isTrial || subscription.isGracePeriod);
  
  // Provjeri da li korisnik može editovati na osnovu uloge
  // Ako role je null ali korisnik ima aktivan subscription ili je vlasnik (isOwner), dozvoli pristup
  const canEdit = canEditSubscription && (
    role === "vlasnik" || 
    isOwner || 
    (role === "konobar" && permissions?.obracun === true) ||
    (role === null && canEditSubscription) // Novi korisnici sa aktivnim subscription mogu koristiti obracun
  );
  
  // Konobar2 može samo pregledati
  const isReadOnly = role === "konobar" && permissions?.obracun !== true;
  
  // Učitaj postavke za malu zalihu iz Firestore sa real-time osluškivanjem
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;
    
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Očisti prethodni snapshot listener ako postoji
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        
        // Postavi real-time listener za automatsku sinkronizaciju
        unsubscribeSnapshot = onSnapshot(
          userDocRef,
          (docSnapshot) => {
            if (docSnapshot.exists()) {
              const data = docSnapshot.data();
              if (data.lowStockSettings) {
                setLowStockEnabled(data.lowStockSettings.enabled || false);
                setLowStockThresholdZestoka(data.lowStockSettings.thresholdZestoka || 100);
                setLowStockThresholdOstala(data.lowStockSettings.thresholdOstala || 10);
              } else {
                // Ako nema postavki, koristi default vrijednosti
                setLowStockEnabled(false);
                setLowStockThresholdZestoka(100);
                setLowStockThresholdOstala(10);
              }
            }
          },
          (error) => {
            console.error("Greška pri osluškivanju postavki za malu zalihu:", error);
          }
        );
      }
    });
    
    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []);

  // Inicijalizacija artikala na osnovu cjenovnika
  useEffect(() => {
    if (cjenovnik.length === 0) return;
    
    const datumString = formatirajDatum(trenutniDatum);
    
    // Učitaj ulaz cache iz Firestore
    const loadCacheAndInit = async () => {
      const ulazCache = await loadUlazCacheFromFirestore(datumString);
      
      // Ako nema postojećih artikala, inicijaliziraj sve iz cjenovnika
      if (artikli.length === 0) {
      const inicijalniArtikli = cjenovnik.map((item) => {
        const cached = ulazCache[item.naziv];
        const pocetnoStanje = item.naziv.toLowerCase().includes("kafa") ? 0 : item.pocetnoStanje;
        
        // Ako postoji cache, učitaj ulaz i staro početno stanje
        if (cached && cached.staroPocetnoStanje !== undefined) {
          if (cached.ulaz !== 0) {
            // Ako ima ulaz, učitaj ga
            return {
              naziv: item.naziv,
              cijena: item.cijena,
              pocetnoStanje: pocetnoStanje,
              ulaz: cached.ulaz,
              ukupno: pocetnoStanje + cached.ulaz,
              utroseno: 0,
              krajnjeStanje: 0,
              vrijednostKM: 0,
              zestokoKolicina: item.zestokoKolicina,
              proizvodnaCijena: item.proizvodnaCijena,
              isKrajnjeSet: false,
              staroPocetnoStanje: cached.staroPocetnoStanje,
              sačuvanUlaz: undefined,
            };
          } else {
            // Ako je ulaz 0 (već je ažuriran), samo postavi staroPocetnoStanje
            return {
              naziv: item.naziv,
              cijena: item.cijena,
              pocetnoStanje: pocetnoStanje,
              ulaz: 0,
              ukupno: pocetnoStanje,
              utroseno: 0,
              krajnjeStanje: 0,
              vrijednostKM: 0,
              zestokoKolicina: item.zestokoKolicina,
              proizvodnaCijena: item.proizvodnaCijena,
              isKrajnjeSet: false,
              staroPocetnoStanje: cached.staroPocetnoStanje,
              sačuvanUlaz: undefined,
            };
          }
        }
        
        // Ako nema cache, inicijaliziraj normalno
        return {
          naziv: item.naziv,
          cijena: item.cijena,
          pocetnoStanje: pocetnoStanje,
          ulaz: 0,
          ukupno: pocetnoStanje,
          utroseno: 0,
          krajnjeStanje: 0,
          vrijednostKM: 0,
          zestokoKolicina: item.zestokoKolicina,
          proizvodnaCijena: item.proizvodnaCijena,
          isKrajnjeSet: false,
          staroPocetnoStanje: undefined,
          sačuvanUlaz: undefined,
        };
      });
      
      setArtikli(inicijalniArtikli);
      setIsAzuriran(false);
      setResetKey(0);
      return;
    }
    
    // Ako postoje artikli, provjeri da li postoje novi artikli u cjenovniku
    const postojeciNazivi = new Set(artikli.map(a => a.naziv));
    const noviArtikli = cjenovnik.filter(item => !postojeciNazivi.has(item.naziv));
    
    // Ako postoje novi artikli, dodaj ih postojećim artiklima
    if (noviArtikli.length > 0) {
      console.log("Pronađeni novi artikli u cjenovniku:", noviArtikli.map(a => a.naziv));
      
      const noviArtikliZaDodati = noviArtikli.map((item) => {
        const cached = ulazCache[item.naziv];
        const pocetnoStanje = item.naziv.toLowerCase().includes("kafa") ? 0 : item.pocetnoStanje;
        
        if (cached && cached.staroPocetnoStanje !== undefined) {
          if (cached.ulaz !== 0) {
            return {
              naziv: item.naziv,
              cijena: item.cijena,
              pocetnoStanje: pocetnoStanje,
              ulaz: cached.ulaz,
              ukupno: pocetnoStanje + cached.ulaz,
              utroseno: 0,
              krajnjeStanje: 0,
              vrijednostKM: 0,
              zestokoKolicina: item.zestokoKolicina,
              proizvodnaCijena: item.proizvodnaCijena,
              isKrajnjeSet: false,
              staroPocetnoStanje: cached.staroPocetnoStanje,
              sačuvanUlaz: undefined,
            };
          } else {
            return {
              naziv: item.naziv,
              cijena: item.cijena,
              pocetnoStanje: pocetnoStanje,
              ulaz: 0,
              ukupno: pocetnoStanje,
              utroseno: 0,
              krajnjeStanje: 0,
              vrijednostKM: 0,
              zestokoKolicina: item.zestokoKolicina,
              proizvodnaCijena: item.proizvodnaCijena,
              isKrajnjeSet: false,
              staroPocetnoStanje: cached.staroPocetnoStanje,
              sačuvanUlaz: undefined,
            };
          }
        }
        
        return {
          naziv: item.naziv,
          cijena: item.cijena,
          pocetnoStanje: pocetnoStanje,
          ulaz: 0,
          ukupno: pocetnoStanje,
          utroseno: 0,
          krajnjeStanje: 0,
          vrijednostKM: 0,
          zestokoKolicina: item.zestokoKolicina,
          proizvodnaCijena: item.proizvodnaCijena,
          isKrajnjeSet: false,
          staroPocetnoStanje: undefined,
          sačuvanUlaz: undefined,
        };
      });
      
      // Dodaj nove artikle postojećim
      setArtikli(prev => [...prev, ...noviArtikliZaDodati]);
    }
    
    // Ažuriraj postojeće artikle sa novim podacima iz cjenovnika (cijene, početno stanje, itd.)
    // VAŽNO: Zadrži ulaz, staroPocetnoStanje i sačuvanUlaz ako postoje
    setArtikli(prev => prev.map(artikal => {
      const cjenovnikItem = cjenovnik.find(item => item.naziv === artikal.naziv);
      if (cjenovnikItem) {
        // Ažuriraj cijenu i početno stanje iz cjenovnika
        const pocetnoStanje = cjenovnikItem.naziv.toLowerCase().includes("kafa") ? 0 : cjenovnikItem.pocetnoStanje;
        return {
          ...artikal,
          cijena: cjenovnikItem.cijena,
          pocetnoStanje: pocetnoStanje,
          zestokoKolicina: cjenovnikItem.zestokoKolicina,
          proizvodnaCijena: cjenovnikItem.proizvodnaCijena,
          // VAŽNO: Eksplicitno zadrži ulaz iz trenutnog state-a
          ulaz: artikal.ulaz,
          // Ažuriraj ukupno na osnovu novog početnog stanja i postojećeg ulaza
          ukupno: artikal.ulaz !== 0 ? pocetnoStanje + artikal.ulaz : pocetnoStanje,
          // Zadrži staroPocetnoStanje i sačuvanUlaz ako postoje
          staroPocetnoStanje: artikal.staroPocetnoStanje,
          sačuvanUlaz: artikal.sačuvanUlaz,
          // Zadrži i ostala polja koja su možda postavljena
          utroseno: artikal.utroseno,
          krajnjeStanje: artikal.krajnjeStanje,
          vrijednostKM: artikal.vrijednostKM,
          isKrajnjeSet: artikal.isKrajnjeSet,
        };
      }
      return artikal;
    }));
    };
    
    loadCacheAndInit();
  }, [cjenovnik, trenutniDatum]);

  // Učitaj ulaz iz cache-a kada se promijeni datum (backup - ako se promijeni datum nakon inicijalizacije)
  useEffect(() => {
    if (cjenovnik.length === 0 || artikli.length === 0) return;
    
    const datumString = formatirajDatum(trenutniDatum);
    
    // Učitaj ulaz cache iz Firestore
    const loadCache = async () => {
      const ulazCache = await loadUlazCacheFromFirestore(datumString);
      
      // Učitaj broj sačuvanih slika iz Firestore
      const user = auth.currentUser;
      const userId = user?.uid;
      if (userId) {
        try {
          const cacheRef = doc(db, "users", userId, "cache", datumString);
          const cacheDoc = await getDoc(cacheRef);
          if (cacheDoc.exists()) {
            const cacheData = cacheDoc.data();
            const savedCount = cacheData.savedInvoiceImagesCount || 0;
            setSavedInvoiceImagesCount(savedCount);
          } else {
            setSavedInvoiceImagesCount(0);
          }
        } catch (error) {
          console.warn("Greška pri učitavanju broja sačuvanih slika:", error);
          setSavedInvoiceImagesCount(0);
        }
      }
      
      // Provjeri da li postoji ulaz u cache-u (bilo da je ulaz > 0 ili da postoji staroPocetnoStanje)
      const imaUlazUCache = Object.keys(ulazCache).some(naziv => {
        const cached = ulazCache[naziv];
        return (cached && cached.ulaz !== 0) || (cached && cached.staroPocetnoStanje !== undefined);
      });
      setHasUlazInCache(imaUlazUCache);
      
      if (Object.keys(ulazCache).length > 0) {
        setArtikli((prev) =>
          prev.map((a) => {
            const cached = ulazCache[a.naziv];
            if (cached && cached.staroPocetnoStanje !== undefined) {
              // Ako postoji cache sa staroPocetnoStanje, učitaj ga
              // Čak i ako je ulaz 0 (već je ažuriran), postavi staroPocetnoStanje da se prikaže zagrada
              if (cached.ulaz !== 0) {
                // Ako ima ulaz, učitaj ga
                return {
                  ...a,
                  ulaz: cached.ulaz,
                  ukupno: a.pocetnoStanje + cached.ulaz,
                  staroPocetnoStanje: cached.staroPocetnoStanje,
                };
              } else {
                // Ako je ulaz 0 (već je ažuriran), samo postavi staroPocetnoStanje da se prikaže zagrada
                // Ne mijenjaj početno stanje, samo postavi staroPocetnoStanje
                return {
                  ...a,
                  staroPocetnoStanje: cached.staroPocetnoStanje,
                };
              }
            }
            return a;
          })
        );
      }
    };
    
    loadCache();
  }, [trenutniDatum]);

  const formatirajDatum = (datum: Date): string => {
    const dan = datum.getDate().toString().padStart(2, "0");
    const mjesec = (datum.getMonth() + 1).toString().padStart(2, "0");
    const godina = datum.getFullYear();
    return `${dan}.${mjesec}.${godina}.`;
  };

  // Helper funkcije za ulaz cache u Firestore (umjesto localStorage)
  const loadUlazCacheFromFirestore = async (datumString: string): Promise<{ [naziv: string]: { ulaz: number; staroPocetnoStanje: number } }> => {
    const user = auth.currentUser;
    if (!user) return {};
    
    try {
      const ulazCacheRef = doc(db, "users", user.uid, "ulazCache", datumString);
      const ulazCacheDoc = await getDoc(ulazCacheRef);
      if (ulazCacheDoc.exists()) {
        const data = ulazCacheDoc.data();
        return data.cache || {};
      }
    } catch (error: any) {
      const errorCode = error?.code || "";
      if (errorCode !== "permission-denied" && !errorCode.includes("permission") && !errorCode.includes("insufficient")) {
        console.warn("Greška pri učitavanju ulaz cache iz Firestore:", error);
      }
    }
    return {};
  };

  const saveUlazCacheToFirestore = async (datumString: string, ulazCache: { [naziv: string]: { ulaz: number; staroPocetnoStanje: number } }) => {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
      const ulazCacheRef = doc(db, "users", user.uid, "ulazCache", datumString);
      await setDoc(ulazCacheRef, {
        cache: ulazCache,
        datum: datumString,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (error: any) {
      const errorCode = error?.code || "";
      if (errorCode !== "permission-denied" && !errorCode.includes("permission") && !errorCode.includes("insufficient")) {
        console.warn("Greška pri spremanju ulaz cache u Firestore:", error);
      }
    }
  };

  // Funkcija za promjenu datuma
  const handleDatumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = new Date(e.target.value);
    if (!isNaN(selectedDate.getTime())) {
      setTrenutniDatum(selectedDate);
    }
  };

  // Funkcije za update artikala
  const handleUlazChange = (index: number, value: number) => {
    setArtikli((prev) => {
      const updated = prev.map((a, i) => {
        if (i !== index) return a;
        
        // Izračunaj novo ukupno stanje (početno + ulaz)
        const novoUkupno = a.pocetnoStanje + value;
        
        // Sačuvaj staro početno stanje ako već nije postavljeno i ako ima ulaz (pozitivan ili negativan)
        const novoStaroPocetnoStanje = a.staroPocetnoStanje !== undefined 
          ? a.staroPocetnoStanje 
          : (value !== 0 ? a.pocetnoStanje : undefined);
        
        // Ako je postavljeno krajnje stanje, izračunaj utrošeno i vrijednost na osnovu novog ukupnog
        let utroseno = 0;
        let vrijednostKM = 0;
        
        if (a.isKrajnjeSet && a.krajnjeStanje > 0) {
          // Za kafu, utrošeno = krajnje stanje
          if (a.naziv.toLowerCase().includes("kafa")) {
            utroseno = a.krajnjeStanje;
            vrijednostKM = utroseno * a.cijena;
          } else {
            // Za ostale artikle, utrošeno = ukupno - krajnje stanje
            utroseno = Math.max(novoUkupno - a.krajnjeStanje, 0);
            vrijednostKM = a.zestokoKolicina
              ? (utroseno / a.zestokoKolicina) * a.cijena
              : utroseno * a.cijena;
          }
        }
        
        return {
          ...a,
          ulaz: value,
          ukupno: novoUkupno, // Početno stanje + ulaz
          staroPocetnoStanje: novoStaroPocetnoStanje,
          utroseno: utroseno,
          vrijednostKM: vrijednostKM,
        };
      });
      
      // Postavi flag da postoji ulaz ako bilo koji artikal ima ulaz
      const imaUlaz = updated.some((a) => a.ulaz !== 0);
      if (imaUlaz) {
        setHasUlazInCache(true);
      }
      
      return updated;
    });
  };

  const handleKrajnjeStanjeChange = (index: number, value: string) => {
    setArtikli((prev) =>
      prev.map((a, i) => {
        if (i !== index) return a;

        const isSet = value.trim() !== "";
        const broj = isSet ? Number(value) : 0;

        if (a.naziv.toLowerCase().includes("kafa")) {
          const utroseno = broj;
          const vrijednostKM = utroseno * a.cijena;
          return {
            ...a,
            krajnjeStanje: broj,
            utroseno,
            vrijednostKM,
            isKrajnjeSet: isSet,
          };
        } else {
          const utroseno = isSet ? Math.max(a.ukupno - broj, 0) : 0;
          const vrijednostKM = a.zestokoKolicina
            ? (utroseno / a.zestokoKolicina) * a.cijena
            : utroseno * a.cijena;
          return {
            ...a,
            krajnjeStanje: broj,
            utroseno,
            vrijednostKM,
            isKrajnjeSet: isSet,
          };
        }
      })
    );
  };

  const handleAddRashod = () => {
    if (newRashod.naziv && newRashod.cijena >= 0) {
      setRashodi([...rashodi, newRashod]);
      setNewRashod({ naziv: "", cijena: 0 });
    }
  };

  const handleAddPrihod = () => {
    if (newPrihod.naziv && newPrihod.cijena >= 0) {
      setPrihodi([...prihodi, newPrihod]);
      setNewPrihod({ naziv: "", cijena: 0 });
    }
  };

  const handleEditRashod = (index: number) => {
    setEditRashodIndex(index);
    setEditRashod({ ...rashodi[index] });
  };

  const handleEditPrihod = (index: number) => {
    setEditPrihodIndex(index);
    setEditPrihod({ ...prihodi[index] });
  };

  const handleDeleteRashod = (index: number) => {
    setRashodi((prev) => prev.filter((_, i) => i !== index));
    if (editRashodIndex === index) {
      setEditRashodIndex(null);
      setEditRashod({ naziv: "", cijena: 0 });
    }
  };

  const handleDeletePrihod = (index: number) => {
    setPrihodi((prev) => prev.filter((_, i) => i !== index));
    if (editPrihodIndex === index) {
      setEditPrihodIndex(null);
      setEditPrihod({ naziv: "", cijena: 0 });
    }
  };

  const handleSaveEditRashod = () => {
    if (editRashodIndex !== null && editRashod.naziv && editRashod.cijena >= 0) {
      setRashodi((prev) =>
        prev.map((r, i) => (i === editRashodIndex ? { ...editRashod } : r))
      );
      setEditRashodIndex(null);
      setEditRashod({ naziv: "", cijena: 0 });
    }
  };

  const handleSaveEditPrihod = () => {
    if (editPrihodIndex !== null && editPrihod.naziv && editPrihod.cijena >= 0) {
      setPrihodi((prev) =>
        prev.map((p, i) => (i === editPrihodIndex ? { ...editPrihod } : p))
      );
      setEditPrihodIndex(null);
      setEditPrihod({ naziv: "", cijena: 0 });
    }
  };

  const handleCancelEditRashod = () => {
    setEditRashodIndex(null);
    setEditRashod({ naziv: "", cijena: 0 });
  };

  const handleCancelEditPrihod = () => {
    setEditPrihodIndex(null);
    setEditPrihod({ naziv: "", cijena: 0 });
  };

  // Funkcija za ažuriranje obračuna (bez spremanja u arhivu)
  const handleAzurirajObracun = async () => {
    // Provjeri da li ima artikala s ulazom (pozitivnim ili negativnim)
    const imaUlaz = artikli.some((a) => a.ulaz !== 0);
    if (!imaUlaz) {
      alert("Nema artikala s ulazom za ažuriranje!");
      return;
    }

    const datumString = formatirajDatum(trenutniDatum);

    // Učitaj postojeći cache iz Firestore da ne izgubimo podatke
    const existingCache = await loadUlazCacheFromFirestore(datumString);
    let ulazCache: { [naziv: string]: { ulaz: number; staroPocetnoStanje: number } } = existingCache;
    
    // Ažuriraj cache sa novim podacima - SAČUVAJ ulaz prije nego što se resetira
    artikli.forEach((a) => {
      if (a.ulaz !== 0) {
        // Ako ima ulaz, ažuriraj cache sa ulazom i starim početnim stanjem
        ulazCache[a.naziv] = {
          ulaz: a.ulaz, // Sačuvaj ulaz
          staroPocetnoStanje: a.staroPocetnoStanje ?? a.pocetnoStanje,
        };
      } else if (a.staroPocetnoStanje !== undefined) {
        // Ako nema ulaz ali ima staroPocetnoStanje (već je ažuriran), sačuvaj samo staroPocetnoStanje
        // Postavi ulaz na 0 da znamo da je već ažuriran
        ulazCache[a.naziv] = {
          ulaz: 0,
          staroPocetnoStanje: a.staroPocetnoStanje,
        };
      }
    });

    // Spremi cache u Firestore PRIJE nego što se artikli ažuriraju
    await saveUlazCacheToFirestore(datumString, ulazCache);

    // Ažuriraj cjenovnik i artikle - sačuvaj staro stanje prije ažuriranja
    setCjenovnik((prev) =>
      prev.map((item) => {
        const artikal = artikli.find((a) => a.naziv === item.naziv);
        if (!artikal || artikal.ulaz === 0) return item;
        
        // Sačuvaj staro početno stanje prije ažuriranja
        const staroPocetnoStanje = item.pocetnoStanje;
        const novoPocetnoStanje = artikal.naziv.toLowerCase().includes("kafa")
          ? 0
          : artikal.pocetnoStanje + artikal.ulaz;
        
        return {
          ...item,
          pocetnoStanje: novoPocetnoStanje,
        };
      })
    );

    // Ažuriraj artikle u formi - postavi novo početno stanje i resetiraj ulaz (isto kao u handleSaveObracun)
    const updated = artikli.map((a) => {
      if (a.ulaz !== 0) {
        const staroPocetnoStanje = a.staroPocetnoStanje ?? a.pocetnoStanje;
        const sačuvanUlaz = a.ulaz; // Sačuvaj ulaz prije resetiranja
        const novoPocetnoStanje = a.naziv.toLowerCase().includes("kafa")
          ? 0
          : a.pocetnoStanje + a.ulaz;
        
        return {
          ...a,
          pocetnoStanje: novoPocetnoStanje,
          ulaz: 0, // Resetiraj ulaz na 0 da se obriše iz input polja
          ukupno: novoPocetnoStanje,
          utroseno: 0, // Resetiraj utrošeno jer se početno stanje promijenilo
          vrijednostKM: 0, // Resetiraj vrijednost
          krajnjeStanje: 0, // Resetiraj krajnje stanje
          isKrajnjeSet: false, // Resetiraj flag
          staroPocetnoStanje: staroPocetnoStanje, // Sačuvaj staro stanje da se prikaže zagrada
          sačuvanUlaz: sačuvanUlaz, // Sačuvaj ulaz za prikaz u arhivi
        };
      }
      // Za artikle bez ulaza, resetiraj ulaz na 0 ali zadrži staroPocetnoStanje ako postoji
      return {
        ...a,
        ulaz: 0,
      };
    });
    
    setArtikli(updated);
    
    // Ažuriraj cache sa novim podacima (ulaz je sada 0, ali staroPocetnoStanje treba ostati)
    const existingCache2 = await loadUlazCacheFromFirestore(datumString);
    let ulazCache2: { [naziv: string]: { ulaz: number; staroPocetnoStanje: number } } = existingCache2;
    
    // Ažuriraj cache sa novim podacima (ulaz je sada 0, ali staroPocetnoStanje treba ostati)
    updated.forEach((a) => {
      if (a.staroPocetnoStanje !== undefined) {
        ulazCache2[a.naziv] = {
          ulaz: 0, // Ulaz je sada 0 jer je ažuriran
          staroPocetnoStanje: a.staroPocetnoStanje,
        };
      }
    });
    
    await saveUlazCacheToFirestore(datumString, ulazCache2);
    
    // Postavi flag da postoji ulaz u cache-u (za prikaz gumba za slike)
    setHasUlazInCache(true);

    setIsAzuriran(true); // Označi da je obračun bio ažuriran
    
    // Povećaj reset key da se input polja potpuno resetiraju (isto kao u handleSaveObracun)
    // Koristimo setTimeout da se osigura da se React stigne ažurirati prije nego što se prikaže alert
    setTimeout(() => {
      setResetKey((prev) => prev + 1);
    }, 0);
    
    alert("Obračun ažuriran! Početno stanje artikala je ažurirano.");
  };

  // Provjeri da li obračun ima ulaz (trenutni ulaz, sačuvan ulaz, ili u cache-u)
  const hasUlaz = artikli.some((a) => a.ulaz !== 0 || (a.sačuvanUlaz !== undefined && a.sačuvanUlaz !== 0)) || hasUlazInCache;

  // Funkcija za upload slika faktura
  const uploadInvoiceImages = async (datumString: string): Promise<string[]> => {
    if (invoiceImages.length === 0) return [];
    
    const user = auth.currentUser;
    if (!user) {
      throw new Error("Korisnik nije autentifikovan");
    }
    
    const userId = user.uid;
    
    // Čekaj da se korisnik potpuno autentifikuje i refresh token
    try {
      await user.getIdToken(true); // Refresh token
      console.log("Korisnik autentifikovan:", userId);
    } catch (authError) {
      console.error("Greška pri autentifikaciji:", authError);
      throw new Error("Greška pri autentifikaciji. Molimo prijavite se ponovo.");
    }

    // Očisti datum string za Storage putanju (ukloni tačku na kraju ako postoji)
    const cleanDatumString = datumString.replace(/\.$/, '');

    const uploadedUrls: string[] = [];
    setUploadingImages(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < invoiceImages.length; i++) {
        const file = invoiceImages[i];
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const fileName = `${cleanDatumString}_${timestamp}_${i}.${fileExtension}`;
        const storagePath = `users/${userId}/invoices/${cleanDatumString}/${fileName}`;
        const storageRef = ref(storage, storagePath);
        
        console.log("Upload slike na putanju:", storagePath);
        
        // Dodaj metadata sa contentType
        const metadata = {
          contentType: file.type || `image/${fileExtension}`,
          customMetadata: {
            uploadedBy: userId,
            uploadedAt: new Date().toISOString(),
            datum: datumString,
          }
        };
        
        await uploadBytes(storageRef, file, metadata);
        const downloadURL = await getDownloadURL(storageRef);
        uploadedUrls.push(downloadURL);
        
        console.log("Slika uspješno upload-ovana:", downloadURL);
        
        setUploadProgress(((i + 1) / invoiceImages.length) * 100);
      }
    } catch (error: any) {
      console.error("Greška pri upload-u slika:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      
      // Detaljnija greška
      if (error.code === 'storage/unauthorized') {
        throw new Error("Nemate dozvolu za upload slika. Provjerite Firebase Storage pravila i da li ste prijavljeni.");
      } else if (error.code === 'storage/canceled') {
        throw new Error("Upload je otkazan.");
      } else if (error.code === 'storage/unknown') {
        throw new Error("Nepoznata greška pri upload-u. Provjerite Firebase Storage pravila i CORS postavke.");
      }
      throw error;
    } finally {
      setUploadingImages(false);
      setUploadProgress(0);
    }

    return uploadedUrls;
  };

  // Funkcija za brisanje slike iz preview-a
  const removeImageFromPreview = (index: number) => {
    setInvoiceImages(invoiceImages.filter((_, i) => i !== index));
  };

  // Čuvanje obračuna (localStorage + opcionalno Firestore)
  const handleSaveObracun = async () => {
    const ukupnoArtikli = artikli.reduce((sum, a) => sum + a.vrijednostKM, 0);
    const ukupnoRashod = rashodi.reduce((sum, r) => sum + r.cijena, 0);
    const ukupnoPrihod = prihodi.reduce((sum, p) => sum + p.cijena, 0);
    const neto = ukupnoArtikli + ukupnoPrihod - ukupnoRashod;
    const datumString = formatirajDatum(trenutniDatum);

    // Učitaj cache ulaza za ovaj datum iz Firestore
    const ulazCache = await loadUlazCacheFromFirestore(datumString);

    // Provjeri da li obračun ima ulaz
    // Provjeri trenutni ulaz u state-u ili sačuvan ulaz (ako je obračun već ažuriran)
    // Ne provjeravaj cache jer to može biti iz prethodnih obračuna
    const imaUlaz = artikli.some((a) => {
      // Provjeri trenutni ulaz
      if (a.ulaz !== 0) {
        return true;
      }
      // Provjeri sačuvan ulaz (ako je obračun već ažuriran, ulaz je resetovan na 0 ali je sačuvan)
      if (a.sačuvanUlaz !== undefined && a.sačuvanUlaz !== 0) {
        return true;
      }
      // Provjeri cache (ako postoji ulaz u cache-u za ovaj datum)
      if (ulazCache[a.naziv] && ulazCache[a.naziv].ulaz !== 0) {
        return true;
      }
      return false;
    });

    const arhiviraniObracun: ArhiviraniObracun = {
      datum: datumString,
      ukupnoArtikli,
      ukupnoRashod,
      ukupnoPrihod,
      neto,
      artikli: artikli.map((a) => {
        // Prioritet: 1. trenutni ulaz, 2. sačuvani ulaz u state-u, 3. ulaz iz cache-a
        let ulazZaPrikaz = 0;
        let staroPocetnoStanjeZaPrikaz = a.staroPocetnoStanje;

        // Ako trenutni ulaz nije 0, koristi ga (direktno spremanje bez ažuriranja)
        if (a.ulaz !== 0) {
          ulazZaPrikaz = a.ulaz;
          // Ako nema staroPocetnoStanje, postavi ga na trenutno početno stanje
          if (a.staroPocetnoStanje === undefined) {
            staroPocetnoStanjeZaPrikaz = a.pocetnoStanje;
          }
        } 
        // Ako trenutni ulaz je 0, provjeri sačuvan ulaz (ako je obračun već ažuriran)
        else if (a.sačuvanUlaz !== undefined && a.sačuvanUlaz !== 0) {
          // Kada je obračun ažuriran, ulaz je resetovan na 0, ali je sačuvan u sačuvanUlaz
          // Koristi sačuvanUlaz za prikaz u arhivi
          ulazZaPrikaz = a.sačuvanUlaz;
          staroPocetnoStanjeZaPrikaz = a.staroPocetnoStanje;
        } 
        // Ako nema ni trenutni ni sačuvan ulaz, provjeri cache
        else if (ulazCache[a.naziv] && ulazCache[a.naziv].ulaz !== 0) {
          ulazZaPrikaz = ulazCache[a.naziv].ulaz;
          staroPocetnoStanjeZaPrikaz = ulazCache[a.naziv].staroPocetnoStanje;
        }
        
        // Kreiraj objekt bez undefined vrijednosti
        // VAŽNO: Ako nije postavljeno krajnje stanje, krajnje stanje = ukupno (početno + ulaz)
        // Ako je krajnje stanje 0 ili nije postavljeno, koristi ukupno
        const krajnjeStanjeZaPrikaz = (a.isKrajnjeSet && a.krajnjeStanje !== undefined && a.krajnjeStanje !== null && a.krajnjeStanje > 0)
          ? a.krajnjeStanje 
          : (a.ukupno !== undefined && a.ukupno !== null && a.ukupno > 0)
          ? a.ukupno
          : (a.pocetnoStanje !== undefined && a.pocetnoStanje !== null && a.pocetnoStanje > 0)
          ? a.pocetnoStanje
          : 0; // Fallback na 0 ako ništa nije postavljeno
        
        const artikalObj: any = {
          naziv: a.naziv,
          cijena: a.cijena,
          pocetnoStanje: a.pocetnoStanje,
          ulaz: ulazZaPrikaz, // Sačuvaj ulaz za prikaz u arhivi - OBAVEZNO postavi ulaz ako postoji
          ukupno: a.ukupno,
          utroseno: a.utroseno,
          krajnjeStanje: krajnjeStanjeZaPrikaz, // Uvijek postavi krajnje stanje (ili postavljeno ili ukupno)
          vrijednostKM: a.vrijednostKM,
        };
        
        // Dodaj opcionalna polja samo ako nisu undefined
        if (a.zestokoKolicina !== undefined) {
          artikalObj.zestokoKolicina = a.zestokoKolicina;
        }
        if (a.proizvodnaCijena !== undefined) {
          artikalObj.proizvodnaCijena = a.proizvodnaCijena;
        }
        if (staroPocetnoStanjeZaPrikaz !== undefined) {
          artikalObj.staroPocetnoStanje = staroPocetnoStanjeZaPrikaz;
        }
        if (ulazZaPrikaz !== 0) {
          artikalObj.sačuvanUlaz = ulazZaPrikaz;
        }
        
        return artikalObj;
      }),
      rashodi,
      prihodi,
      isAzuriran: isAzuriran, // Sačuvaj flag da je obračun bio ažuriran
      imaUlaz: imaUlaz, // Sačuvaj flag da obračun ima ulaz
    };

    // NE briši cache - možda će korisnik htjeti vidjeti ulaz u arhivi
    // Cache se automatski ažurira kada se promijeni datum

    const user = auth.currentUser;
    const userId = user?.uid;

    // Upload slika faktura ako postoje
    let invoiceImageUrls: string[] = [];
    if (invoiceImages.length > 0 && user && userId) {
      try {
        invoiceImageUrls = await uploadInvoiceImages(datumString);
        // Sačuvaj URL-ove slika u obračun
        (arhiviraniObracun as any).invoiceImages = invoiceImageUrls;
      } catch (error) {
        console.error("Greška pri upload-u slika faktura:", error);
        alert("Upozorenje: Obračun je sačuvan, ali slike faktura nisu uspješno upload-ovane.");
      }
    }

    // HIBRIDNI PRISTUP: Prvo Firestore (primarno), zatim localStorage (cache/offline)
    try {
      // 1. SPREMI U FIRESTORE (primarni izvor - ako postoji korisnik)
      if (user && userId) {
        try {
          // Funkcija za uklanjanje undefined vrijednosti
          const removeUndefined = (obj: any): any => {
            if (obj === null || obj === undefined) {
              return null;
            }
            if (Array.isArray(obj)) {
              return obj.map(removeUndefined);
            }
            if (typeof obj === 'object') {
              const cleaned: any = {};
              for (const key in obj) {
                if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
                  cleaned[key] = removeUndefined(obj[key]);
                }
              }
              return cleaned;
            }
            return obj;
          };
          
          const cleanArhiviraniObracun = removeUndefined(arhiviraniObracun);
          
          const docRef = doc(db, "users", userId, "obracuni", datumString);
          await setDoc(docRef, {
            ...cleanArhiviraniObracun,
            savedAt: serverTimestamp(),
          });
          console.log("Obračun sačuvan u Firestore:", datumString);
        } catch (firestoreError: any) {
          // Ignoriraj greške dozvola - spremit ćemo u localStorage
          const errorCode = firestoreError?.code || "";
          if (errorCode !== "permission-denied" && !errorCode.includes("permission") && !errorCode.includes("insufficient")) {
            console.warn("Nije moguće sačuvati u Firestore (možda nema interneta):", firestoreError);
          } else {
            console.warn("Greška dozvola pri spremanju u Firestore:", firestoreError);
          }
        }
      } else {
        console.warn("Nema korisnika, obračun se sprema samo u localStorage");
      }

      // 2. NE SPREMAJ U LOCALSTORAGE - sve se čuva u Firestore
      // Arhiva se automatski učitava iz Firestore kroz real-time listener u arhiva/page.tsx
      if (userId) {
        console.log("Obračun sačuvan u Firestore:", datumString);
      } else {
        console.warn("Nema korisnika, obračun se ne može sačuvati");
      }

      // Resetuj slike faktura nakon uspješnog spremanja
      setInvoiceImages([]);
      
      // Obriši broj sačuvanih slika iz cache-a jer je obračun sačuvan
      if (user && userId) {
        try {
          const cacheRef = doc(db, "users", userId, "cache", datumString);
          await setDoc(cacheRef, {
            savedInvoiceImagesCount: 0,
          }, { merge: true });
          setSavedInvoiceImagesCount(0);
        } catch (error) {
          console.warn("Greška pri brisanju broja sačuvanih slika:", error);
        }
      }

      // Ažuriranje cjenovnika (početno stanje za sljedeći dan = krajnje stanje iz ovog dana)
      // VAŽNO: Ažuriraj cjenovnik PRIJE promjene datuma, da se novi datum učita sa ispravnim početnim stanjem
      setCjenovnik((prev) =>
        prev.map((item) => {
          const artikal = artikli.find((a) => a.naziv === item.naziv);
          if (!artikal) return item;
          
          // Za sljedeći dan, početno stanje = krajnje stanje iz ovog dana (ili ukupno ako nije postavljeno krajnje)
          // Ako je postavljeno krajnje stanje, koristi ga; inače koristi ukupno (početno + ulaz)
          let novoPocetnoStanje: number;
          if (artikal.naziv.toLowerCase().includes("kafa")) {
            novoPocetnoStanje = 0; // Kafa se uvijek resetuje na 0
          } else if (artikal.isKrajnjeSet && artikal.krajnjeStanje > 0) {
            // Ako je postavljeno krajnje stanje, koristi ga
            novoPocetnoStanje = artikal.krajnjeStanje;
          } else {
            // Ako nije postavljeno krajnje stanje, koristi ukupno (početno + ulaz)
            novoPocetnoStanje = artikal.ukupno;
          }
          
          console.log(`Ažuriranje cjenovnika za ${item.naziv}: ${item.pocetnoStanje} -> ${novoPocetnoStanje} (krajnje: ${artikal.krajnjeStanje}, ukupno: ${artikal.ukupno})`);
          
          return {
            ...item,
            pocetnoStanje: novoPocetnoStanje,
          };
        })
      );

      // Povećaj datum za jedan dan (prebacivanje na novi dan)
      const noviDatum = new Date(trenutniDatum);
      noviDatum.setDate(noviDatum.getDate() + 1);
      setTrenutniDatum(noviDatum);

      setRashodi([]);
      setPrihodi([]);
      setNewRashod({ naziv: "", cijena: 0 });
      setNewPrihod({ naziv: "", cijena: 0 });
      setEditRashodIndex(null);
      setEditPrihodIndex(null);
      setIsAzuriran(false); // Resetiraj flag nakon spremanja
      setResetKey((prev) => prev + 1); // Povećaj reset key da se input polja potpuno resetiraju
      
      // Eksplicitno resetiraj artikle na prazan niz da se useEffect pokrene i inicijalizira nove artikle
      // Ovo će osigurati da se artikli odmah resetiraju za novi dan
      setArtikli([]);

      // Emituj događaj (ako koristiš fallback)
      window.dispatchEvent(new Event("arhivaChanged"));

      alert("Obračun uspješno sačuvan!");
    } catch (error) {
      console.error("Greška pri čuvanju:", error);
      alert("Greška pri čuvanju. Provjeri konzolu za detalje.");
    }
  };

  const ukupnoRashod = rashodi.reduce((sum, r) => sum + r.cijena, 0);
  const ukupnoPrihod = prihodi.reduce((sum, p) => sum + p.cijena, 0);
  const ukupnoArtikli = artikli.reduce((sum, a) => sum + a.vrijednostKM, 0);
  const neto = ukupnoArtikli + ukupnoPrihod - ukupnoRashod;

  const formatDateForInput = (datum: Date): string => {
    const godina = datum.getFullYear();
    const mjesec = (datum.getMonth() + 1).toString().padStart(2, "0");
    const dan = datum.getDate().toString().padStart(2, "0");
    return `${godina}-${mjesec}-${dan}`;
  };

  return (
    <div style={containerStyle}>
      {!canEdit && subscription && !subscription.isActive && !subscription.isTrial && !subscription.isGracePeriod && (
        <div style={{
          padding: "16px",
          background: "#fee2e2",
          border: "2px solid #dc2626",
          borderRadius: "8px",
          marginBottom: "20px",
          textAlign: "center"
        }}>
          <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#dc2626" }}>
            ⚠️ Vaša pretplata je istekla. Možete samo pregledavati podatke, ali ne možete unositi nove obračune.
          </p>
          <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#6b7280" }}>
            Aktivirajte pretplatu na stranici profila da biste nastavili koristiti aplikaciju.
          </p>
        </div>
      )}
      <style jsx>{`
        input.no-spin::-webkit-inner-spin-button,
        input.no-spin::-webkit-outer-spin-button {
          display: none;
        }
        button:hover {
          background-color: #2563eb;
        }
        .save-button:hover {
          background-color: #166534;
        }
        .edit-button:hover {
          color: #1d4ed8;
        }
        .delete-button:hover {
          color: #b91c1c;
        }
        .cancel-button:hover {
          color: #b91c1c;
        }
        button[style*="background: #f59e0b"]:hover {
          background-color: #d97706 !important;
        }
        @media (max-width: 768px) {
          div[style*="maxWidth: 1200px"] { padding: 8px; }
          table:first-of-type { display: flex; flex-direction: column; }
          table:first-of-type thead { display: none; }
          table:first-of-type tbody { display: flex; flex-direction: column; gap: 16px; }
          table:first-of-type tr { display: flex; flex-direction: column; background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); padding: 12px; }
          table:first-of-type td { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: none; font-size: 13px; }
          table:first-of-type td:before { content: attr(data-label); font-weight: 600; color: #1f2937; width: 50%; }
          table:first-of-type td[data-label="Artikal"] { color: #1e40af !important; font-weight: 600 !important; font-size: 15px !important; }
          table:first-of-type td input { max-width: 100%; width: 100%; }
          div[style*="overflowX: auto"] {
            width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          table:not(:first-of-type) { 
            width: 100%;
            min-width: 400px;
            box-sizing: border-box;
          }
          table:not(:first-of-type) thead,
          table:not(:first-of-type) tbody,
          table:not(:first-of-type) tr {
            display: table;
            width: 100%;
            table-layout: fixed;
          }
          table:not(:first-of-type) th, 
          table:not(:first-of-type) td { 
            min-width: 100px; 
            font-size: 13px; 
            padding: 8px;
            word-wrap: break-word;
            box-sizing: border-box;
          }
          table:not(:first-of-type) th:last-child,
          table:not(:first-of-type) td:last-child {
            width: auto;
            min-width: 120px;
            white-space: nowrap;
          }
          table:not(:first-of-type) td:last-child button {
            display: inline-block;
            margin: 0 4px;
            padding: 6px 8px;
            font-size: 12px;
          }
          input, button { width: 100%; max-width: 100%; margin-bottom: 8px; font-size: 13px; box-sizing: border-box; }
          input[type="date"] { max-width: 100%; }
          div[style*="display: flex"] { 
            flex-direction: column; 
            align-items: stretch; 
            gap: 8px;
            width: 100%;
            box-sizing: border-box;
          }
          div[style*="marginTop: 20px"][style*="display: flex"] {
            flex-wrap: wrap;
          }
          div[style*="marginTop: 20px"][style*="display: flex"] input {
            flex: 1 1 auto;
            min-width: 0;
            max-width: calc(50% - 4px);
          }
          div[style*="marginTop: 20px"][style*="display: flex"] button {
            flex: 1 1 100%;
            max-width: 100%;
          }
          h1 { font-size: 20px; margin-bottom: 16px; }
          h2 { font-size: 16px; margin-bottom: 12px; }
          h3 { font-size: 14px; margin: 6px 0; }
        }
      `}</style>

      <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#1f2937", marginBottom: "24px" }}>
        Obračun
      </h1>

      {isReadOnly && (
        <div style={{ 
          marginBottom: "20px", 
          padding: "12px 16px", 
          background: "#fef3c7", 
          borderRadius: "8px", 
          border: "1px solid #f59e0b",
          color: "#92400e"
        }}>
          <strong>Pregled mod:</strong> Vaša uloga (Konobar 2) omogućava samo pregled podataka. Niste u mogućnosti unositi ili mijenjati podatke.
        </div>
      )}

      <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
        <label style={{ fontSize: "14px", color: "#1f2937", marginRight: "8px" }}>
          Datum obračuna:
        </label>
        <input
          type="date"
          value={formatDateForInput(trenutniDatum)}
          onChange={handleDatumChange}
          style={dateInputStyle}
        />
        <button 
          style={{ ...buttonStyle, background: "#f59e0b", maxWidth: "160px", opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "pointer" : "not-allowed" }} 
          onClick={handleAzurirajObracun}
          disabled={!canEdit}
        >
          Ažuriraj obračun
        </button>
        <button 
          style={{ ...saveButtonStyle, opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "pointer" : "not-allowed" }} 
          onClick={handleSaveObracun} 
          className="save-button"
          disabled={!canEdit || uploadingImages}
        >
          {uploadingImages ? `Upload slika... ${Math.round(uploadProgress)}%` : "Sačuvaj obračun"}
        </button>
        {/* Upload slika faktura - prikazuje se samo ako ima ulaz (sve dok obračun nije sačuvan) */}
        {hasUlaz && (
          <label
            style={{
              ...buttonStyle,
              background: "#6366f1",
              maxWidth: "160px",
              opacity: canEdit ? 1 : 0.5,
              cursor: canEdit ? "pointer" : "not-allowed",
              display: "inline-block",
              margin: 0
            }}
            onMouseEnter={(e) => {
              if (canEdit) {
                e.currentTarget.style.background = "#4f46e5";
              }
            }}
            onMouseLeave={(e) => {
              if (canEdit) {
                e.currentTarget.style.background = "#6366f1";
              }
            }}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setInvoiceImages([...invoiceImages, ...files]);
                e.target.value = ""; // Reset input
              }}
              style={{ display: "none" }}
              disabled={!canEdit}
            />
            📸 Dodaj slike fakture{(invoiceImages.length > 0 || savedInvoiceImagesCount > 0) ? ` (${invoiceImages.length + savedInvoiceImagesCount})` : ""}
          </label>
        )}
        {isAzuriran && (
          <span style={{ fontSize: "14px", color: "#f59e0b", fontWeight: 500, marginLeft: "8px" }}>
            (Ažurirano)
          </span>
        )}
      </div>

      {/* Prikaz odabranih slika faktura */}
      {hasUlaz && invoiceImages.length > 0 && (
        <div style={{ 
          marginTop: "16px", 
          marginBottom: "16px", 
          padding: "12px", 
          background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
          borderRadius: "8px",
          border: "1px solid #f59e0b",
          boxShadow: "0 2px 8px rgba(245, 158, 11, 0.1)"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                background: "#6366f1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "8px",
                fontSize: "16px"
              }}>
                📸
              </div>
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#92400e", margin: 0 }}>
                Slike faktura za ulaz
              </h3>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 500, color: "#92400e" }}>
                Odabrano: {invoiceImages.length}
              </span>
              {canEdit && invoiceImages.length > 0 && (
                <>
                  <button
                    onClick={async () => {
                      const datumString = formatirajDatum(trenutniDatum);
                      const user = auth.currentUser;
                      const userId = user?.uid;
                      
                      if (!user || !userId) {
                        alert("Korisnik nije autentifikovan");
                        return;
                      }
                      
                      try {
                        setUploadingImages(true);
                        setUploadProgress(0);
                        const uploadedUrls = await uploadInvoiceImages(datumString);
                        
                        // Ažuriraj obračun u Firestore sa slikama
                        if (uploadedUrls.length > 0) {
                          const obracunRef = doc(db, "users", userId, "obracuni", datumString);
                          const obracunDoc = await getDoc(obracunRef);
                          
                          if (obracunDoc.exists()) {
                            // Ako obračun već postoji, dodaj nove slike postojećim
                            const existingData = obracunDoc.data();
                            const existingImages = existingData.invoiceImages || [];
                            const allImages = [...existingImages, ...uploadedUrls];
                            
                            await setDoc(obracunRef, {
                              invoiceImages: allImages,
                            }, { merge: true });
                          } else {
                            // Ako obračun ne postoji, kreiraj novi sa slikama
                            await setDoc(obracunRef, {
                              invoiceImages: uploadedUrls,
                            }, { merge: true });
                          }
                          
                          // Sačuvaj broj sačuvanih slika u cache
                          const cacheRef = doc(db, "users", userId, "cache", datumString);
                          const cacheDoc = await getDoc(cacheRef);
                          const currentCount = cacheDoc.exists() ? (cacheDoc.data().savedInvoiceImagesCount || 0) : 0;
                          const newCount = currentCount + uploadedUrls.length;
                          
                          await setDoc(cacheRef, {
                            savedInvoiceImagesCount: newCount,
                          }, { merge: true });
                          
                          setSavedInvoiceImagesCount(newCount);
                        }
                        
                        alert("Slike faktura uspješno sačuvane!");
                        setInvoiceImages([]);
                      } catch (error: any) {
                        console.error("Greška pri upload-u slika:", error);
                        alert("Greška pri upload-u slika: " + (error.message || "Nepoznata greška"));
                      } finally {
                        setUploadingImages(false);
                        setUploadProgress(0);
                      }
                    }}
                    disabled={uploadingImages || !canEdit}
                    style={{
                      ...saveButtonStyle,
                      background: "#15803d",
                      opacity: (canEdit && !uploadingImages) ? 1 : 0.5,
                      cursor: (canEdit && !uploadingImages) ? "pointer" : "not-allowed",
                      padding: "6px 12px",
                      fontSize: "12px"
                    }}
                  >
                    {uploadingImages ? `Spremanje... ${Math.round(uploadProgress)}%` : "Sačuvaj slike"}
                  </button>
                  <button
                    onClick={() => setInvoiceImages([])}
                    style={{
                      padding: "6px 12px",
                      background: "#dc2626",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12px",
                      cursor: "pointer",
                      fontWeight: 500,
                      opacity: canEdit ? 1 : 0.5
                    }}
                    disabled={!canEdit}
                  >
                    Obriši sve
                  </button>
                </>
              )}
            </div>
          </div>
          
          {invoiceImages.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", 
                gap: "8px"
              }}>
                {invoiceImages.map((file, index) => (
                  <div 
                    key={index} 
                    style={{ 
                      position: "relative", 
                      width: "100%",
                      aspectRatio: "1",
                      borderRadius: "6px",
                      overflow: "hidden",
                      boxShadow: "0 1px 4px rgba(0, 0, 0, 0.1)",
                      transition: "transform 0.2s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "scale(1.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Preview ${index + 1}`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover"
                      }}
                    />
                    {canEdit && (
                      <button
                        onClick={() => removeImageFromPreview(index)}
                        style={{
                          position: "absolute",
                          top: "2px",
                          right: "2px",
                          background: "rgba(220, 38, 38, 0.9)",
                          color: "white",
                          border: "none",
                          borderRadius: "50%",
                          width: "20px",
                          height: "20px",
                          cursor: "pointer",
                          fontSize: "12px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)"
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadProgress > 0 && (
            <div style={{ marginTop: "10px" }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "4px"
              }}>
                <span style={{ fontSize: "12px", fontWeight: 500, color: "#92400e" }}>
                  Upload...
                </span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#92400e" }}>
                  {Math.round(uploadProgress)}%
                </span>
              </div>
              <div style={{
                width: "100%",
                height: "6px",
                background: "#fde68a",
                borderRadius: "3px",
                overflow: "hidden"
              }}>
                <div style={{
                  width: `${uploadProgress}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #f59e0b, #d97706)",
                  borderRadius: "3px",
                  transition: "width 0.3s ease"
                }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Artikli */}
      <h2 style={{ fontSize: "18px", fontWeight: 500, color: "#1f2937", marginBottom: "16px" }}>
        Artikli
      </h2>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Artikal</th>
            <th style={thStyle}>Cijena</th>
            <th style={thStyle}>Zestoko Količina (ml)</th>
            <th style={thStyle}>Proizvodna Cijena</th>
            <th style={thStyle}>Početno stanje</th>
            <th style={thStyle}>Ulaz</th>
            <th style={thStyle}>Ukupno</th>
            <th style={thStyle}>Utrošeno</th>
            <th style={thStyle}>Krajnje stanje</th>
            <th style={thStyle}>Vrijednost KM</th>
          </tr>
        </thead>
        <tbody>
          {artikli.map((a, index) => {
            // Funkcija za određivanje boje na osnovu trenutne zalihe (krajnjeStanje ili ukupno)
            const getRowStyle = (): React.CSSProperties => {
              // Ako funkcija nije uključena, ne primjenjuj boje
              if (!lowStockEnabled) {
                return {};
              }
              
              // Kafa je posebna - ne primjenjuj boje
              if (a.naziv.toLowerCase() === "kafa" || a.naziv.toLowerCase() === "kava") {
                return {};
              }
              
              // Koristimo krajnjeStanje ako je postavljeno, inače ukupno (pocetnoStanje + ulaz)
              const trenutnaZaliha = a.isKrajnjeSet ? a.krajnjeStanje : a.ukupno;
              
              // Za žestoka pića (ima zestokoKolicina)
              if (a.zestokoKolicina && a.zestokoKolicina > 0) {
                // Provjeri da li je zaliha ispod praga za žestoka pića
                if (trenutnaZaliha < lowStockThresholdZestoka) {
                  return {
                    backgroundColor: "#fef2f2",
                    borderLeft: "4px solid #dc2626"
                  };
                }
              } else {
                // Za obične artikle - provjeri da li je zaliha ispod praga za ostala pića
                if (trenutnaZaliha < lowStockThresholdOstala) {
                  return {
                    backgroundColor: "#fef2f2",
                    borderLeft: "4px solid #dc2626"
                  };
                }
              }
              
              return {};
            };
            
            // Provjeri da li je zaliha mala za prikaz upozorenja
            const trenutnaZaliha = a.isKrajnjeSet ? a.krajnjeStanje : a.ukupno;
            const threshold = (a.zestokoKolicina && a.zestokoKolicina > 0) 
              ? lowStockThresholdZestoka 
              : lowStockThresholdOstala;
            const isLowStock = lowStockEnabled && 
              !(a.naziv.toLowerCase() === "kafa" || a.naziv.toLowerCase() === "kava") &&
              trenutnaZaliha < threshold;

            const rowStyle = getRowStyle();
            
            return (
              <tr key={index} style={rowStyle}>
                <td style={{...tdStyle, color: "#1e40af", fontWeight: 600}} data-label="Artikal">
                  {a.naziv}
                </td>
                <td style={tdStyle} data-label="Cijena">{a.cijena.toFixed(2)}</td>
                <td style={tdStyle} data-label="Zestoko Količina (ml)">{a.zestokoKolicina ? a.zestokoKolicina.toFixed(3) : "-"}</td>
                <td style={tdStyle} data-label="Proizvodna Cijena">{a.proizvodnaCijena ? a.proizvodnaCijena.toFixed(2) : "-"}</td>
                <td style={tdStyle} data-label="Početno stanje">
                  {a.pocetnoStanje}
                  {a.staroPocetnoStanje !== undefined && a.staroPocetnoStanje !== a.pocetnoStanje && (
                    <span style={{ color: "#eab308", marginLeft: "4px", fontSize: "12px" }}>
                      ({a.staroPocetnoStanje})
                    </span>
                  )}
                </td>
                <td style={tdStyle} data-label="Ulaz">
                  <input
                    key={`ulaz-${index}-${resetKey}`}
                    type="number"
                    value={a.ulaz === 0 ? "" : a.ulaz}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handleUlazChange(index, Number(e.target.value) || 0)}
                    style={{ ...inputStyle, opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "text" : "not-allowed" }}
                    className="no-spin"
                    disabled={!canEdit}
                    readOnly={!canEdit}
                  />
                </td>
                <td style={tdStyle} data-label="Ukupno">{a.ukupno}</td>
                <td style={tdStyle} data-label="Utrošeno">{a.utroseno}</td>
                <td style={{
                  ...tdStyle,
                  ...(isLowStock ? { 
                    color: "#dc2626", 
                    fontWeight: 600 
                  } : {})
                }} data-label="Krajnje stanje">
                  <input
                    type="number"
                    value={a.krajnjeStanje === 0 ? "" : a.krajnjeStanje}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handleKrajnjeStanjeChange(index, e.target.value)}
                    style={{ ...inputStyle, opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "text" : "not-allowed" }}
                    className="no-spin"
                    disabled={!canEdit}
                    readOnly={!canEdit}
                  />
                </td>
                <td style={tdStyle} data-label="Vrijednost KM">{a.vrijednostKM.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Rashodi */}
      <h2 style={{ fontSize: "18px", fontWeight: 500, color: "#1f2937", marginBottom: "16px" }}>
        Rashodi
      </h2>
      <div style={tableWrapperStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Naziv</th>
              <th style={thStyle}>Cijena</th>
              <th style={thStyle}>Akcija</th>
            </tr>
          </thead>
          <tbody>
            {rashodi.map((r, index) => (
              <tr key={index}>
                {editRashodIndex === index ? (
                  <>
                    <td style={tdStyle}>
                      <input
                        type="text"
                        value={editRashod.naziv}
                        onChange={(e) => setEditRashod({ ...editRashod, naziv: e.target.value })}
                        style={{...rashodInputStyle, opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "text" : "not-allowed"}}
                        disabled={!canEdit}
                        readOnly={!canEdit}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="number"
                        value={editRashod.cijena === 0 ? "" : editRashod.cijena}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setEditRashod({ ...editRashod, cijena: Number(e.target.value) || 0 })}
                        style={{...rashodInputStyle, opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "text" : "not-allowed"}}
                        className="no-spin"
                        disabled={!canEdit}
                        readOnly={!canEdit}
                      />
                    </td>
                    <td style={tdStyle}>
                      <button 
                        style={{...buttonStyle, opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "pointer" : "not-allowed"}} 
                        onClick={handleSaveEditRashod}
                        disabled={!canEdit}
                      >
                        Spremi
                      </button>
                      <button 
                        style={{...cancelButtonStyle, opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "pointer" : "not-allowed"}} 
                        onClick={handleCancelEditRashod} 
                        className="cancel-button"
                        disabled={!canEdit}
                      >
                        Otkaži
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={tdStyle}>{r.naziv}</td>
                    <td style={tdStyle}>{r.cijena.toFixed(2)}</td>
                    <td style={tdStyle}>
                      <button
                        style={{...editButtonStyle, opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "pointer" : "not-allowed"}}
                        onClick={() => handleEditRashod(index)}
                        className="edit-button"
                        disabled={!canEdit}
                      >
                        Uredi
                      </button>
                      <button
                        style={{...deleteButtonStyle, opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "pointer" : "not-allowed"}}
                        onClick={() => handleDeleteRashod(index)}
                        className="delete-button"
                        disabled={!canEdit}
                      >
                        Izbriši
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "20px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", width: "100%", boxSizing: "border-box" }}>
        <input
          type="text"
          placeholder="Naziv rashoda"
          value={newRashod.naziv}
          onChange={(e) => setNewRashod({ ...newRashod, naziv: e.target.value })}
          style={{...rashodInputStyle, flex: "1 1 auto", minWidth: "120px", opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "text" : "not-allowed"}}
          disabled={!canEdit}
          readOnly={!canEdit}
        />
        <input
          type="number"
          placeholder="Cijena"
          value={newRashod.cijena === 0 ? "" : newRashod.cijena}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setNewRashod({ ...newRashod, cijena: Number(e.target.value) || 0 })}
          style={{...rashodInputStyle, flex: "1 1 auto", minWidth: "120px", opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "text" : "not-allowed"}}
          className="no-spin"
          disabled={!canEdit}
          readOnly={!canEdit}
        />
        <button 
          style={{...buttonStyle, flex: "1 1 auto", minWidth: "140px", opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "pointer" : "not-allowed"}} 
          onClick={handleAddRashod}
          disabled={!canEdit}
        >
          Dodaj rashod
        </button>
      </div>

      {/* Prihodi */}
      <h2 style={{ fontSize: "18px", fontWeight: 500, color: "#1f2937", marginBottom: "16px" }}>
        Prihodi
      </h2>
      <div style={tableWrapperStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Naziv</th>
              <th style={thStyle}>Cijena</th>
              <th style={thStyle}>Akcija</th>
            </tr>
          </thead>
          <tbody>
            {prihodi.map((p, index) => (
              <tr key={index}>
                {editPrihodIndex === index ? (
                  <>
                    <td style={tdStyle}>
                      <input
                        type="text"
                        value={editPrihod.naziv}
                        onChange={(e) => setEditPrihod({ ...editPrihod, naziv: e.target.value })}
                        style={{...rashodInputStyle, opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "text" : "not-allowed"}}
                        disabled={!canEdit}
                        readOnly={!canEdit}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="number"
                        value={editPrihod.cijena === 0 ? "" : editPrihod.cijena}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setEditPrihod({ ...editPrihod, cijena: Number(e.target.value) || 0 })}
                        style={{...rashodInputStyle, opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "text" : "not-allowed"}}
                        className="no-spin"
                        disabled={!canEdit}
                        readOnly={!canEdit}
                      />
                    </td>
                    <td style={tdStyle}>
                      <button 
                        style={{...buttonStyle, opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "pointer" : "not-allowed"}} 
                        onClick={handleSaveEditPrihod}
                        disabled={!canEdit}
                      >
                        Spremi
                      </button>
                      <button 
                        style={{...cancelButtonStyle, opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "pointer" : "not-allowed"}} 
                        onClick={handleCancelEditPrihod} 
                        className="cancel-button"
                        disabled={!canEdit}
                      >
                        Otkaži
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={tdStyle}>{p.naziv}</td>
                    <td style={tdStyle}>{p.cijena.toFixed(2)}</td>
                    <td style={tdStyle}>
                      <button
                        style={{...editButtonStyle, opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "pointer" : "not-allowed"}}
                        onClick={() => handleEditPrihod(index)}
                        className="edit-button"
                        disabled={!canEdit}
                      >
                        Uredi
                      </button>
                      <button
                        style={{...deleteButtonStyle, opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "pointer" : "not-allowed"}}
                        onClick={() => handleDeletePrihod(index)}
                        className="delete-button"
                        disabled={!canEdit}
                      >
                        Izbriši
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "20px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px", width: "100%", boxSizing: "border-box" }}>
        <input
          type="text"
          placeholder="Naziv prihoda"
          value={newPrihod.naziv}
          onChange={(e) => setNewPrihod({ ...newPrihod, naziv: e.target.value })}
          style={{...rashodInputStyle, flex: "1 1 auto", minWidth: "120px", opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "text" : "not-allowed"}}
          disabled={!canEdit}
          readOnly={!canEdit}
        />
        <input
          type="number"
          placeholder="Cijena"
          value={newPrihod.cijena === 0 ? "" : newPrihod.cijena}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setNewPrihod({ ...newPrihod, cijena: Number(e.target.value) || 0 })}
          style={{...rashodInputStyle, flex: "1 1 auto", minWidth: "120px", opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "text" : "not-allowed"}}
          className="no-spin"
          disabled={!canEdit}
          readOnly={!canEdit}
        />
        <button 
          style={{...buttonStyle, flex: "1 1 auto", minWidth: "140px", opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "pointer" : "not-allowed"}} 
          onClick={handleAddPrihod}
          disabled={!canEdit}
        >
          Dodaj prihod
        </button>
      </div>

      {/* Ukupno */}
      <div style={{ marginTop: "24px", fontSize: "16px", color: "#1f2937" }}>
        <h3 style={{ margin: "8px 0", fontWeight: 500 }}>
          Ukupno rashod: {ukupnoRashod.toFixed(2)} KM
        </h3>
        <h3 style={{ margin: "8px 0", fontWeight: 500 }}>
          Ukupno prihod: {ukupnoPrihod.toFixed(2)} KM
        </h3>
        <h3 style={{ margin: "8px 0", fontWeight: 500 }}>
          Ukupno artikli: {ukupnoArtikli.toFixed(2)} KM
        </h3>
        <h3
          style={{
            margin: "8px 0",
            fontWeight: 600,
            color: neto >= 0 ? "#15803d" : "#dc2626",
          }}
        >
          Neto: {neto.toFixed(2)} KM
        </h3>
      </div>
    </div>
  );
}