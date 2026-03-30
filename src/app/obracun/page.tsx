"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useCjenovnik } from "../context/CjenovnikContext";
import { useSubscription } from "../context/SubscriptionContext";
import { useRole } from "../context/RoleContext";
import { getUserId, uploadFile, saveObracun, getObracuni, getAuthToken } from "../../lib/api";
// TEMPORARY: Disabled Firebase imports for development - using mocks
// import { auth } from "../../lib/firebase";
// import { db, storage } from "../../lib/firebase";
// import { doc, setDoc, getDoc, deleteDoc, collection, getDocs, serverTimestamp, onSnapshot, Timestamp } from "firebase/firestore";
// import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from "firebase/storage";
// import { onAuthStateChanged } from "firebase/auth";

// TEMPORARY: Mock Firebase objects for development
const auth = { currentUser: { uid: 'dev-user-id' } } as any;
const db = {} as any;
const storage = {} as any;
const doc = (...args: any[]) => ({ id: 'mock-doc' }) as any;
const setDoc = async (...args: any[]) => {};
const getDoc = async (...args: any[]) => ({ exists: () => false, data: () => null } as any);
const deleteDoc = async (...args: any[]) => {};
const collection = (...args: any[]) => ({ id: 'mock-collection' }) as any;
const getDocs = async (...args: any[]) => ({ docs: [] } as any);
const serverTimestamp = (...args: any[]) => new Date();
const onSnapshot = (...args: any[]) => () => {};
const Timestamp = { fromDate: (date: Date) => date } as any;
const ref = (...args: any[]) => ({ fullPath: 'mock/path' }) as any;
const uploadBytes = async (...args: any[]) => ({ metadata: { fullPath: 'mock/path' } } as any);
const getDownloadURL = async (...args: any[]) => 'mock-url';
const listAll = async (...args: any[]) => ({ items: [] } as any);
const deleteObject = async (...args: any[]) => {};
const onAuthStateChanged = (...args: any[]) => () => {};

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
  imageUrl?: string; // URL slike fakture za ovaj rashod
};

type Prihod = {
  naziv: string;
  cijena: number;
  imageUrl?: string; // URL slike fakture za ovaj prihod
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
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "160px",
  padding: "8px 16px",
  background: "#3b82f6",
  color: "white",
  border: "none",
  borderRadius: "6px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 500,
  transition: "background-color 0.2s ease-in-out",
  marginTop: 0,
  marginLeft: 0,
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
  const ULAZ_UNLOCK_PIN_STORAGE_KEY = "obracunUlazUnlockPin";
  const DEFAULT_ULAZ_UNLOCK_PIN = "1234";

  const { cjenovnik, setCjenovnik } = useCjenovnik();
  const { subscription } = useSubscription();
  const { role, permissions, user } = useRole();
  const [artikli, setArtikli] = useState<Artikal[]>([]);
  const [rashodi, setRashodi] = useState<Rashod[]>([]);
  const [prihodi, setPrihodi] = useState<Prihod[]>([]);
  const [newRashod, setNewRashod] = useState<Rashod>({ naziv: "", cijena: 0 });
  const [newPrihod, setNewPrihod] = useState<Prihod>({ naziv: "", cijena: 0 });
  const [editRashodIndex, setEditRashodIndex] = useState<number | null>(null);
  const [editPrihodIndex, setEditPrihodIndex] = useState<number | null>(null);
  const [inlineEditingRashodIndex, setInlineEditingRashodIndex] = useState<number | null>(null);
  const [editRashod, setEditRashod] = useState<Rashod>({ naziv: "", cijena: 0 });
  const [editPrihod, setEditPrihod] = useState<Prihod>({ naziv: "", cijena: 0 });
  const [trenutniDatum, setTrenutniDatum] = useState<Date>(new Date());
  const [isAzuriran, setIsAzuriran] = useState<boolean>(false); // Praćenje da li je obračun bio ažuriran
  const [resetKey, setResetKey] = useState<number>(0); // Key za reset input polja
  const [isOwner, setIsOwner] = useState<boolean>(false); // Provjera da li je korisnik vlasnik
  const [hasUlazInCache, setHasUlazInCache] = useState<boolean>(false); // Provjera da li postoji ulaz u cache-u
  const [isUlazLocked, setIsUlazLocked] = useState<boolean>(false); // Provjera da li su ulazi zaključani
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);

  // Detekcija mobilnog uređaja
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window === 'undefined') return;
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Postavke za malu zalihu
  const [lowStockEnabled, setLowStockEnabled] = useState<boolean>(false);
  const [lowStockThresholdZestoka, setLowStockThresholdZestoka] = useState<number>(100);
  const [lowStockThresholdOstala, setLowStockThresholdOstala] = useState<number>(10);
  
  // State za slike faktura
  const [invoiceImages, setInvoiceImages] = useState<File[]>([]);
  const [uploadingImages, setUploadingImages] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [savedInvoiceImagesCount, setSavedInvoiceImagesCount] = useState<number>(0); // Broj sačuvanih slika
  
  // State za slike rashoda i prihoda
  const [newRashodImage, setNewRashodImage] = useState<File | null>(null);
  const [newPrihodImage, setNewPrihodImage] = useState<File | null>(null);
  const [editRashodImage, setEditRashodImage] = useState<File | null>(null);
  const [editPrihodImage, setEditPrihodImage] = useState<File | null>(null);

  // Provjeri da li je korisnik vlasnik - koristi user.isOwner iz RoleContext
  useEffect(() => {
    if (user?.isOwner) {
      setIsOwner(true);
    } else {
      setIsOwner(false);
    }
  }, [user?.isOwner]);

  // SVI KORISNICI MOGU KORISTITI OBRACUN - nema ograničenja

  // Provjeri samo da li postoji korisnik (user)
  const canEdit = !!user; // Ako postoji korisnik, može da koristi obracun

  // --- PIN modal state and handlers (must be at the top, before return) ---
  const [showPinModal, setShowPinModal] = useState(false);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState("");

  const handleUnlockUlazEditing = () => {
    if (!canEdit) return;
    setEnteredPin("");
    setPinError("");
    setShowPinModal(true);
  };

  const handleConfirmPin = async () => {
    if (enteredPin.length !== 4) {
      setPinError("Šifra mora imati tačno 4 znaka.");
      return;
    }
    try {
      const token = getAuthToken && getAuthToken();
      const res = await fetch('/api/users/me/pin', {
        method: 'GET',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) {
        setPinError("Greška pri provjeri šifre.");
        return;
      }
      const data = await res.json();
      if (!data.pin || enteredPin !== data.pin) {
        setPinError("Pogrešna šifra.");
        return;
      }
      setIsUlazLocked(false);
      setResetKey((k) => k + 1);
      setShowPinModal(false);
    } catch {
      setPinError("Greška pri komunikaciji sa serverom.");
    }
  };
  
  // Debug logging
  useEffect(() => {
    console.log('ObracunPage - canEdit debug:', {
      canEdit,
      user: user ? { id: user.id, email: user.email } : null
    });
  }, [canEdit, user]);
  
  // SVI KORISNICI MOGU KORISTITI OBRACUN - isReadOnly uklonjen
  
  // TEMPORARY: Disabled Firebase listener - comment out to re-enable
  /*
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
          (error: any) => {
            // Ignoriraj greške dozvola
            const errorCode = error?.code || "";
            if (errorCode !== "permission-denied" && !errorCode.includes("permission") && !errorCode.includes("insufficient")) {
              console.error("Greška pri osluškivanju postavki za malu zalihu:", error);
            } else {
              console.warn("Greška pri real-time listeneru: Missing or insufficient permissions.");
            }
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
  */
  
  // TEMPORARY: Set default values for development
  useEffect(() => {
    setLowStockEnabled(false);
    setLowStockThresholdZestoka(100);
    setLowStockThresholdOstala(10);
  }, []);

  // PRVO: Učitaj cache za trenutni datum PRIJE nego što se inicijaliziraju artikli
  // Ovo osigurava da se staroPocetnoStanje učitava iz cache-a prije nego što se artikli kreiraju
  const [ulazCacheForDatum, setUlazCacheForDatum] = useState<{ [naziv: string]: { ulaz: number; staroPocetnoStanje: number; sačuvanUlaz?: number } }>({});
  const [prethodnoStanjePoNazivu, setPrethodnoStanjePoNazivu] = useState<{ [naziv: string]: number }>({});
  const [isCacheLoaded, setIsCacheLoaded] = useState<boolean>(false);

  function normalizeDatumString(datum: string): string {
    return (datum || '').replace(/\.$/, '').trim();
  }

  function datumToSortableNumber(datum: string): number | null {
    const normalized = normalizeDatumString(datum);
    const parts = normalized.split('.');
    if (parts.length !== 3) return null;

    const [dan, mjesec, godina] = parts;
    const dd = dan.padStart(2, '0');
    const mm = mjesec.padStart(2, '0');
    if (!/^\d{2}$/.test(dd) || !/^\d{2}$/.test(mm) || !/^\d{4}$/.test(godina)) return null;

    return Number(`${godina}${mm}${dd}`);
  }

  function extractStartValueFromArtikal(artikal: any): number {
    if (artikal?.krajnjeStanje !== undefined && artikal?.krajnjeStanje !== null && Number(artikal.krajnjeStanje) > 0) {
      return Number(artikal.krajnjeStanje) || 0;
    }

    if (artikal?.ukupno !== undefined && artikal?.ukupno !== null && Number(artikal.ukupno) >= 0) {
      return Number(artikal.ukupno) || 0;
    }

    return Number(artikal?.pocetnoStanje) || 0;
  }

  // Helper funkcija za provjeru da li je prihod još uvijek relevantan (tj. da li postoji plaćen dug u arhivi)
  const isPrihodRelevant = async (prihodNaziv: string, userId: string): Promise<boolean> => {
    try {
      const obracuni = await getObracuni(userId);
      const finalniObracuni = obracuni.filter((ob: any) => !ob.isAzuriran || ob.isAzuriran === false);
      
      // Pronađi obračun koji ima rashod (dug) sa imenom dužnika koje odgovara nazivu prihoda
      for (const obracun of finalniObracuni) {
        if (obracun.rashodi && Array.isArray(obracun.rashodi)) {
          const relevantRashod = obracun.rashodi.find((rashod: any) => {
            const naziv = rashod.naziv || '';
            const lowerNaziv = naziv.toLowerCase().trim();
            if (!lowerNaziv.includes('dug')) return false;
            
            // Ime dužnika je sve prije "dug" u nazivu rashoda
            const parts = naziv.split(/\s+/);
            const dugIndex = parts.findIndex((p: string) => p.toLowerCase() === "dug");
            if (dugIndex === -1) return false;
            
            const imeDuznika = parts.slice(0, dugIndex).join(" ").trim();
            return imeDuznika.toLowerCase() === prihodNaziv.toLowerCase() && rashod.placeno === true;
          });
          
          if (relevantRashod) {
            return true; // Postoji plaćen dug u arhivi
          }
        }
      }
      return false; // Nema plaćenog duga u arhivi
    } catch (error: any) {
      console.error("Greška pri provjeri relevantnosti prihoda:", error);
      return false; // U slučaju greške, smatraj da nije relevantan
    }
  };

  // Helper funkcija za provjeru da li je datum aktivan (nije prošao)
  const isDatumAktivan = (datum: Date): boolean => {
    const danas = new Date();
    danas.setHours(0, 0, 0, 0);
    const provjeraDatuma = new Date(datum);
    provjeraDatuma.setHours(0, 0, 0, 0);
    return provjeraDatuma.getTime() === danas.getTime();
  };

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

  // ===== DRAFT OBRACUN FUNKCIJE (onemogućeno za testiranje) =====
  /*
  const saveDraftObracun = async (datumString: string) => {
    // ... originalna logika za spremanje draft-a (trenutno isključena) ...
  };

  const deleteOldDrafts = async () => {
    console.log("🗑️ Brisanje starih draft-ova se vrši automatski u API-ju");
  };

  const loadDraftObracun = async (datumString: string): Promise<any | null> => {
    // ... originalna logika za učitavanje draft-a (trenutno isključena) ...
    return null;
  };
  */

  // Funkcija autoSaveDraftAsFinal je uklonjena - handleSaveObracun direktno sprema finalni obračun

  useEffect(() => {
    const datumString = formatirajDatum(trenutniDatum);
    const datumAktivan = isDatumAktivan(trenutniDatum);
    
    // PRVO učitaj cache za taj datum - provjeri da li postoji ažurirani obračun
    const loadCacheFirst = async () => {
      setIsCacheLoaded(false);

      const userId = user?.id || user?.email;
      if (!userId) {
        setUlazCacheForDatum({});
        setPrethodnoStanjePoNazivu({});
        setSavedInvoiceImagesCount(0);
        setHasUlazInCache(false);
        setIsUlazLocked(false);
        setIsCacheLoaded(true);
        return;
      }

      try {
        // Provjeri da li postoji ažurirani obračun za taj datum
        // VAŽNO: Ne filtriraj po datumu jer getObracuni sa datumString parametrom možda ne vraća draft obračune
        // Učitaj sve obračune i filtriraj na frontendu
        const obracuni = await getObracuni(userId);
        console.log("🔍 Traženje draft obračuna - ukupno obračuna:", obracuni.length, "traženi datum:", datumString);
        
        // Normalizuj datum (ukloni tačku sa kraja ako postoji)
        const normalizedDatum = normalizeDatumString(datumString);
        console.log("🔍 Normalizovan datum:", normalizedDatum);

        const finalniObracuni = obracuni.filter((ob: any) => ob && ob.isAzuriran !== true);
        const trenutniDatumBroj = datumToSortableNumber(normalizedDatum);

        const prethodniObracuni = finalniObracuni
          .map((ob: any) => {
            const obDatumNormalized = normalizeDatumString(ob?.datum || '');
            const obDatumBroj = datumToSortableNumber(obDatumNormalized);
            return { ...ob, __datumBroj: obDatumBroj };
          })
          .filter((ob: any) => ob.__datumBroj !== null && (trenutniDatumBroj === null || ob.__datumBroj < trenutniDatumBroj))
          .sort((a: any, b: any) => (b.__datumBroj || 0) - (a.__datumBroj || 0));

        const zadnjiFinalniObracun = prethodniObracuni[0] || null;
        const novoPrethodnoStanjePoNazivu: { [naziv: string]: number } = {};

        if (zadnjiFinalniObracun && Array.isArray(zadnjiFinalniObracun.artikli)) {
          zadnjiFinalniObracun.artikli.forEach((a: any) => {
            if (!a?.naziv) return;
            novoPrethodnoStanjePoNazivu[a.naziv] = extractStartValueFromArtikal(a);
          });
        }

        setPrethodnoStanjePoNazivu(novoPrethodnoStanjePoNazivu);
        
        // Filtriraj sve draft obračune i provjeri datume
        const draftObracuni = obracuni.filter((ob: any) => ob.isAzuriran === true);
        console.log("🔍 Pronađeno draft obračuna:", draftObracuni.length);
        console.log("🔍 Draft obračuni:", draftObracuni.map((ob: any) => ({ 
          datum: ob.datum, 
          datumNormalized: ob.datum ? ob.datum.replace(/\.$/, '').trim() : '',
          prihodiCount: ob.prihodi?.length || 0,
          artikliCount: ob.artikli?.length || 0
        })));
        
        const azuriraniObracun = obracuni.find((ob: any) => {
          if (!ob.isAzuriran) return false;
          const obDatum = ob.datum ? ob.datum.replace(/\.$/, '').trim() : '';
          const matches = obDatum === normalizedDatum;
          if (matches) {
            console.log("✅ Pronađen draft obračun:", { obDatum, normalizedDatum, matches });
          }
          return matches;
        });
        
        if (azuriraniObracun) {
          // Učitaj ažurirani obračun
          console.log("🟢 Pronađen ažurirani obračun za datum:", datumString, "artikala:", azuriraniObracun.artikli?.length || 0);
          
          // VAŽNO: Postavi isAzuriran PRIJE svega da bi drugi useEffect preskočio inicijalizaciju
          setIsAzuriran(true);
          setIsUlazLocked(true); // Zaključaj ulaze jer je obračun ažuriran
          
          // Kreiraj cache iz ažuriranog obračuna
          const ulazCache: { [naziv: string]: { ulaz: number; staroPocetnoStanje: number; sačuvanUlaz?: number } } = {};
          if (azuriraniObracun.artikli && azuriraniObracun.artikli.length > 0) {
            azuriraniObracun.artikli.forEach((a: any) => {
              if (a.ulaz !== 0 || (a.sačuvanUlaz !== undefined && a.sačuvanUlaz !== 0)) {
                ulazCache[a.naziv] = { 
                  ulaz: a.ulaz || a.sačuvanUlaz || 0,
                  staroPocetnoStanje: a.pocetnoStanje || 0,
                  sačuvanUlaz: a.sačuvanUlaz
                };
              }
            });
          }
          
          setUlazCacheForDatum(ulazCache);
          setSavedInvoiceImagesCount(azuriraniObracun.invoiceImages?.length || 0);
          setHasUlazInCache(azuriraniObracun.imaUlaz || false);
          
          // Provjeri i filtriraj prihode - ukloni one koji više nisu relevantni (dug više nije plaćen)
          let validPrihodi = Array.isArray(azuriraniObracun.prihodi) ? azuriraniObracun.prihodi : [];
          if (validPrihodi.length > 0) {
            console.log("🔍 Provjera relevantnosti prihoda u draft obračunu:", validPrihodi.length, "prihoda");
            const relevantPrihodiPromises = validPrihodi.map(async (prihod: any) => {
              const isRelevant = await isPrihodRelevant(prihod.naziv, userId);
              return { prihod, isRelevant };
            });
            
            const relevantPrihodiResults = await Promise.all(relevantPrihodiPromises);
            const filteredPrihodi = relevantPrihodiResults
              .filter(result => result.isRelevant)
              .map(result => result.prihod);
            
            if (filteredPrihodi.length !== validPrihodi.length) {
              console.log(`🔍 Uklonjeno ${validPrihodi.length - filteredPrihodi.length} nevažećih prihoda iz draft obračuna`);
              validPrihodi = filteredPrihodi;
              
              // Ažuriraj draft obračun u bazi sa filtriranim prihodima
              const ukupnoPrihod = filteredPrihodi.reduce((sum: number, p: any) => sum + (p.cijena || 0), 0);
              await saveObracun(userId, {
                datum: datumString,
                artikli: Array.isArray(azuriraniObracun.artikli) ? azuriraniObracun.artikli : [],
                rashodi: Array.isArray(azuriraniObracun.rashodi) ? azuriraniObracun.rashodi : [],
                prihodi: filteredPrihodi,
                ukupnoArtikli: azuriraniObracun.ukupnoArtikli || 0,
                ukupnoRashod: azuriraniObracun.ukupnoRashod || 0,
                ukupnoPrihod: ukupnoPrihod,
                neto: (azuriraniObracun.ukupnoArtikli || 0) + ukupnoPrihod - (azuriraniObracun.ukupnoRashod || 0),
                isAzuriran: true,
                imaUlaz: azuriraniObracun.imaUlaz || false,
                invoiceImages: azuriraniObracun.invoiceImages || [],
                isDraft: true,
              });
            }
          }
          
          // Ako postoje artikli u ažuriranom obračunu, učitaj ih u state
          if (azuriraniObracun.artikli && azuriraniObracun.artikli.length > 0) {
            const mappedArtikli = azuriraniObracun.artikli.map((a: any) => {
              // VAŽNO: Ulaz se NE zbraja sa početnim stanjem - ostaje kao posebno polje
              const pocetnoStanje = a.pocetnoStanje || 0;
              const ulaz = a.ulaz || a.sačuvanUlaz || 0;
              // Ukupno se računa samo za prikaz (početno stanje + ulaz), ali ulaz ostaje odvojen
              const ukupno = pocetnoStanje + ulaz;
              
              return {
                naziv: a.naziv,
                cijena: a.cijena || 0,
                pocetnoStanje: pocetnoStanje, // Početno stanje ostaje nepromijenjeno
                ulaz: ulaz, // Ulaz ostaje kao posebno polje (ne zbraja se sa početnim stanjem)
                ukupno: ukupno, // Ukupno = početno + ulaz (samo za prikaz)
                utroseno: a.utroseno || 0,
                krajnjeStanje: a.krajnjeStanje || 0,
                vrijednostKM: a.vrijednostKM || 0,
                zestokoKolicina: a.zestokoKolicina,
                proizvodnaCijena: a.proizvodnaCijena,
                isKrajnjeSet: a.krajnjeStanje !== undefined && a.krajnjeStanje !== null && a.krajnjeStanje > 0,
                staroPocetnoStanje: a.staroPocetnoStanje,
                sačuvanUlaz: a.sačuvanUlaz || a.ulaz || 0, // Sačuvaj ulaz za prikaz u arhivi
              };
            });
            
            console.log("🟢 Učitavanje", mappedArtikli.length, "artikala iz draft obračuna");
            setArtikli(mappedArtikli);
            
            // Učitaj rashode i prihode ako postoje (koristi filtrirane prihode)
            if (azuriraniObracun.rashodi && azuriraniObracun.rashodi.length > 0) {
              setRashodi(azuriraniObracun.rashodi);
              console.log("🟢 Učitano", azuriraniObracun.rashodi.length, "rashoda iz draft obračuna");
            }
            if (validPrihodi.length > 0) {
              setPrihodi(validPrihodi);
              console.log("🟢 Učitano", validPrihodi.length, "validnih prihoda iz draft obračuna:", validPrihodi.map((p: any) => ({ naziv: p.naziv, cijena: p.cijena })));
            } else {
              console.log("⚠️ Nema prihoda u draft obračunu ili su svi filtrirani");
            }
            
            // Učitaj broj slika faktura ako postoje (URL-ovi, ne File objekti)
            if (azuriraniObracun.invoiceImages && azuriraniObracun.invoiceImages.length > 0) {
              setSavedInvoiceImagesCount(azuriraniObracun.invoiceImages.length);
              console.log(`📸 Učitano ${azuriraniObracun.invoiceImages.length} slika faktura iz draft-a:`, azuriraniObracun.invoiceImages);
            } else {
              console.log("⚠️ Nema slika faktura u draft obračunu");
            }
          } else {
            console.log("⚠️ Draft obračun pronađen ali nema artikala - artikli će biti inicijalizovani iz cjenovnika");
            // Učitaj rashode i prihode čak i ako nema artikala (koristi filtrirane prihode)
            if (azuriraniObracun.rashodi && azuriraniObracun.rashodi.length > 0) {
              setRashodi(azuriraniObracun.rashodi);
              console.log("🟢 Učitano", azuriraniObracun.rashodi.length, "rashoda iz draft obračuna (bez artikala)");
            }
            if (validPrihodi.length > 0) {
              setPrihodi(validPrihodi);
              console.log("🟢 Učitano", validPrihodi.length, "validnih prihoda iz draft obračuna (bez artikala):", validPrihodi.map((p: any) => ({ naziv: p.naziv, cijena: p.cijena })));
            } else {
              console.log("⚠️ Nema prihoda u draft obračunu (bez artikala) ili su svi filtrirani");
            }
            // Učitaj broj slika faktura ako postoje
            if (azuriraniObracun.invoiceImages && azuriraniObracun.invoiceImages.length > 0) {
              setSavedInvoiceImagesCount(azuriraniObracun.invoiceImages.length);
              console.log(`📸 Učitano ${azuriraniObracun.invoiceImages.length} slika faktura iz draft-a (bez artikala):`, azuriraniObracun.invoiceImages);
            } else {
              console.log("⚠️ Nema slika faktura u draft obračunu (bez artikala)");
            }
            // Ne postavljaj artikli na prazan array - dozvoli inicijalizaciju iz cjenovnika
            // isAzuriran je već postavljen na true, ali će inicijalizacija artikala biti dozvoljena jer artikli.length === 0
          }
          
          console.log("🟢 Ažurirani obračun učitano:", azuriraniObracun.artikli?.length || 0, "artikala");
        } else {
          // Nema ažuriranog obračuna za datum: inicijalizuj prazan cache, nema fallback-a
          console.log("🟡 Nema ažuriranog obračuna za datum:", datumString);
          setUlazCacheForDatum({});
          setSavedInvoiceImagesCount(0);
          setHasUlazInCache(false);
          setIsUlazLocked(false);
          setIsAzuriran(false);
        }
      } catch (error: any) {
        console.warn("Greška pri učitavanju ažuriranog obračuna:", error);
        // U slučaju greške, inicijalizuj prazan cache
        setUlazCacheForDatum({});
        setPrethodnoStanjePoNazivu({});
        setSavedInvoiceImagesCount(0);
        setHasUlazInCache(false);
        setIsUlazLocked(false);
        setIsAzuriran(false);
      }
      
      setIsCacheLoaded(true);
    };
    
    loadCacheFirst();
  }, [trenutniDatum, user?.email, user?.id]);

  // DRUGO: Inicijalizacija artikala na osnovu cjenovnika I cache-a
  useEffect(() => {
    if (cjenovnik.length === 0 || !isCacheLoaded) {
      console.log("⏳ Čeka se cjenovnik ili cache:", { cjenovnikLength: cjenovnik.length, isCacheLoaded });
      return; // Čekaj da se cache učita
    }
    
    // VAŽNO: Ako je obračun već ažuriran (isAzuriran === true) I ima artikala, NE mijenjaj artikle
    // Draft obračun sa artiklima se uvijek prikazuje sa zaključanim vrijednostima
    // Međutim, ako draft obračun nema artikala (npr. samo sa prihodima), inicijalizuj artikle iz cjenovnika
    if (isAzuriran && artikli.length > 0) {
      console.log("🟢 Obračun je ažuriran (draft) i ima artikala, preskačem inicijalizaciju artikala iz cjenovnika - koristimo zaključane vrijednosti. Trenutno artikala:", artikli.length);
      return;
    }
    
    // Ako je draft obračun ali nema artikala, inicijalizuj artikle iz cjenovnika (zadržavaju se prihodi i rashodi)
    if (isAzuriran && artikli.length === 0) {
      console.log("🟡 Draft obračun postoji ali nema artikala, inicijalizujem artikle iz cjenovnika (zadržavaju se prihodi i rashodi)");
      // Nastavi sa inicijalizacijom - artikli će biti inicijalizovani iz cjenovnika
    }
    
    const datumString = formatirajDatum(trenutniDatum);
    const datumAktivan = isDatumAktivan(trenutniDatum);
    
    // Koristi već učitani cache umjesto ponovnog učitavanja
    const loadCacheAndInit = async () => {
      const ulazCache = ulazCacheForDatum; // Koristi već učitani cache
      console.log("🟡 Inicijalizacija artikala, cache:", ulazCache);
      
      // Draft obračun je uklonjen - inicijaliziraj artikle iz cjenovnika i cache-a
      
      // Ako nema postojećih artikala, inicijaliziraj sve iz cjenovnika
      if (artikli.length === 0) {
      const inicijalniArtikli = cjenovnik.map((item: { naziv: string; cijena: number; pocetnoStanje: number; zestokoKolicina?: number; proizvodnaCijena?: number }) => {
        const cached = ulazCache[item.naziv];
        const prethodnoStanje = prethodnoStanjePoNazivu[item.naziv];
        const pocetnoStanje = item.naziv.toLowerCase().includes("kafa") ? 0 : (prethodnoStanje ?? item.pocetnoStanje);
        
        // Ako postoji cache sa ulazom, učitaj ga (ulaz ostaje vidljiv sve dok se obračun ne sačuva)
        if (cached && cached.ulaz !== 0) {
          console.log(`🟢 Artikal ${item.naziv}: cache postoji, ulaz=${cached.ulaz}, pocetnoStanje=${pocetnoStanje}`);
          // Učitaj ulaz iz cache-a - ostaje vidljiv sve dok se obračun ne sačuva
          return {
            naziv: item.naziv,
            cijena: item.cijena,
            pocetnoStanje: pocetnoStanje,
            ulaz: cached.ulaz, // Učitaj ulaz iz cache-a
            ukupno: pocetnoStanje + cached.ulaz,
            utroseno: 0,
            krajnjeStanje: 0,
            vrijednostKM: 0,
            zestokoKolicina: item.zestokoKolicina,
            proizvodnaCijena: item.proizvodnaCijena,
            isKrajnjeSet: false,
          };
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
        };
      });
      
      console.log("🟢 Inicijalni artikli kreirani:", inicijalniArtikli.map((a: Artikal) => ({ naziv: a.naziv, pocetnoStanje: a.pocetnoStanje, ulaz: a.ulaz })));
      setArtikli(inicijalniArtikli);
      setResetKey(0);
      // Ako postoji ulaz u cache-u, zaključaj ulaze i označi kao ažurirani obračun
      // Također, ako je isAzuriran već postavljen na true (npr. draft obračun sa prihodima), ne resetuj ga
      if (Object.keys(ulazCache).some(naziv => ulazCache[naziv] && ulazCache[naziv].ulaz !== 0)) {
        setIsUlazLocked(true);
        setIsAzuriran(true); // Oznaci da je obračun ažuriran ako ima ulaz
        console.log("🔒 Ulazi zaključani jer postoji ulaz u cache-u");
      } else if (!isAzuriran) {
        // Samo resetuj isAzuriran ako nije već postavljen na true (npr. draft obračun sa prihodima)
        setIsUlazLocked(false);
        setIsAzuriran(false);
      } else {
        // isAzuriran je već true (npr. draft obračun sa prihodima), zadrži ga
        console.log("🟢 isAzuriran je već true (draft obračun), zadržavam ga");
      }
      return;
    }
    
    // Ako postoje artikli, provjeri da li postoje novi artikli u cjenovniku
    const postojeciNazivi = new Set(artikli.map((a: Artikal) => a.naziv));
    const noviArtikli = cjenovnik.filter((item: { naziv: string; cijena: number; pocetnoStanje: number; zestokoKolicina?: number; proizvodnaCijena?: number }) => !postojeciNazivi.has(item.naziv));
    
    // Ako postoje novi artikli, dodaj ih postojećim artiklima
    if (noviArtikli.length > 0) {
      console.log("Pronađeni novi artikli u cjenovniku:", noviArtikli.map((a: { naziv: string }) => a.naziv));
      
      const noviArtikliZaDodati = noviArtikli.map((item: { naziv: string; cijena: number; pocetnoStanje: number; zestokoKolicina?: number; proizvodnaCijena?: number }) => {
        const cached = ulazCache[item.naziv];
        const prethodnoStanje = prethodnoStanjePoNazivu[item.naziv];
        const pocetnoStanje = item.naziv.toLowerCase().includes("kafa") ? 0 : (prethodnoStanje ?? item.pocetnoStanje);
        
        // Ako postoji cache sa ulazom, učitaj ga
        if (cached && cached.ulaz !== 0) {
          return {
            naziv: item.naziv,
            cijena: item.cijena,
            pocetnoStanje: pocetnoStanje,
            ulaz: cached.ulaz, // Učitaj ulaz iz cache-a
            ukupno: pocetnoStanje + cached.ulaz,
            utroseno: 0,
            krajnjeStanje: 0,
            vrijednostKM: 0,
            zestokoKolicina: item.zestokoKolicina,
            proizvodnaCijena: item.proizvodnaCijena,
            isKrajnjeSet: false,
          };
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
        };
      });
      
      // Dodaj nove artikle postojećim (draft onemogućen)
      setArtikli(prev => {
        const updated = [...prev, ...noviArtikliZaDodati];
        return updated;
      });
    }
    
    // Ažuriraj postojeće artikle sa novim podacima iz cjenovnika (cijene, početno stanje, itd.)
    // VAŽNO: Uvijek provjeri cache i učitaj ulaz ako postoji (osobito nakon refresh-a)
    // Koristi već učitani cache umjesto ponovnog učitavanja
    const loadCacheForUpdate = async () => {
      const ulazCache = ulazCacheForDatum; // Koristi već učitani cache
      console.log("🟡 Ažuriranje postojećih artikala, cache:", ulazCache);
      
      setArtikli((prev: Artikal[]) => {
        const updated = prev.map((artikal: Artikal) => {
          const cjenovnikItem = cjenovnik.find((item: { naziv: string; pocetnoStanje: number; zestokoKolicina?: number; proizvodnaCijena?: number }) => item.naziv === artikal.naziv);
          if (cjenovnikItem) {
            // Ažuriraj cijenu i početno stanje iz cjenovnika
            const prethodnoStanje = prethodnoStanjePoNazivu[cjenovnikItem.naziv];
            const pocetnoStanje = cjenovnikItem.naziv.toLowerCase().includes("kafa") ? 0 : (prethodnoStanje ?? cjenovnikItem.pocetnoStanje);
            const cached = ulazCache[artikal.naziv];
            
            // PRIORITET: Učitaj ulaz iz cache-a ako postoji (ulaz ostaje vidljiv sve dok se obračun ne sačuva)
            // Ovo osigurava da se ulaz učitava i nakon refresh-a
            let ulaz = artikal.ulaz;
            if (cached && cached.ulaz !== 0) {
              // Ako cache ima ulaz, učitaj ga (ulaz ostaje vidljiv)
              ulaz = cached.ulaz;
              console.log(`🟢 Učitavanje ulaz iz cache-a za ${artikal.naziv}: ${ulaz}`);
            }
            
            return {
              ...artikal,
              cijena: cjenovnikItem.cijena,
              pocetnoStanje: pocetnoStanje, // Početno stanje ostaje nepromijenjeno
              zestokoKolicina: cjenovnikItem.zestokoKolicina,
              proizvodnaCijena: cjenovnikItem.proizvodnaCijena,
              // VAŽNO: Ulaz se NE zbraja sa početnim stanjem - ostaje kao posebno polje
              ulaz: ulaz, // Ulaz ostaje kao posebno polje (ne zbraja se sa početnim stanjem!)
              // Ukupno = početno + ulaz (samo za prikaz), ali ulaz ostaje odvojen
              ukupno: pocetnoStanje + ulaz,
              sačuvanUlaz: ulaz !== 0 ? ulaz : artikal.sačuvanUlaz, // Sačuvaj ulaz za prikaz u arhivi
              // Zadrži i ostala polja koja su možda postavljena
              utroseno: artikal.utroseno,
              krajnjeStanje: artikal.krajnjeStanje,
              vrijednostKM: artikal.vrijednostKM,
              isKrajnjeSet: artikal.isKrajnjeSet,
            };
          }
          return artikal;
        });
        console.log("🟢 Ažurirani artikli:", updated.map(a => ({ naziv: a.naziv, pocetnoStanje: a.pocetnoStanje, ulaz: a.ulaz })));
        
        // Ako postoji ulaz u cache-u, zaključaj ulaze
        const imaUlazUCache = Object.keys(ulazCache).some(naziv => {
          const cached = ulazCache[naziv];
          return cached && cached.ulaz !== 0;
        });
        if (imaUlazUCache) {
          setIsUlazLocked(true);
          setIsAzuriran(true); // Oznaci da je obračun ažuriran ako ima ulaz
          console.log("🔒 Ulazi zaključani jer postoji ulaz u cache-u (ažuriranje postojećih artikala)");
        }
        
        return updated;
        
        return updated;
      });
    };
    
    // Uvijek pozovi loadCacheForUpdate da se osigura da se ulaz učitava iz cache-a
    // Ovo je posebno važno nakon refresh-a stranice
    loadCacheForUpdate();
    };
    
    loadCacheAndInit();
  }, [cjenovnik, trenutniDatum, isCacheLoaded, ulazCacheForDatum, prethodnoStanjePoNazivu]);

  // Draft obračun je uklonjen - koristimo samo cache za ulaz vrijednosti

  // Uklonjen treći useEffect jer duplicira logiku drugog useEffect-a
  // Sva logika za učitavanje cache-a je sada u drugom useEffect-u

  const formatirajDatum = (datum: Date): string => {
    // Koristi lokalne vrijednosti (bez timezone konverzije) kako bi se izbjegao problem sa pomakom datuma
    // getDate(), getMonth(), getFullYear() koriste lokalni timezone, što je ono što želimo
    const dan = datum.getDate().toString().padStart(2, "0");
    const mjesec = (datum.getMonth() + 1).toString().padStart(2, "0");
    const godina = datum.getFullYear();
    return `${dan}.${mjesec}.${godina}.`;
  };

  // Firebase cache funkcije su uklonjene - koristimo draft sistem umjesto cache-a
  // Ulaz se čuva u draft obračunu, ne u posebnoj cache kolekciji

  // Funkcija za promjenu datuma
  const handleDatumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // HTML date input vraća YYYY-MM-DD format
    // Umjesto new Date() koji interpretira kao UTC, parsiraj string direktno da se izbjegne timezone pomak
    const value = e.target.value;
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) {
        const [godina, mjesec, dan] = parts;
        // Kreiraj lokalni datum bez timezone konverzije
        const selectedDate = new Date(parseInt(godina), parseInt(mjesec) - 1, parseInt(dan));
        if (!isNaN(selectedDate.getTime())) {
          setTrenutniDatum(selectedDate);
        }
      }
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
      
      // Ne spremamo automatski u cache - korisnik mora kliknuti "Ažuriraj obračun" da se sačuva draft
      // Ulaz će biti sačuvan u draft obračunu kada se klikne "Ažuriraj obračun"
      
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

  const handleAddRashod = async () => {
    if (newRashod.naziv && newRashod.cijena >= 0) {
      let imageUrl: string | undefined = undefined;
      
      // Upload slike ako postoji
      if (newRashodImage) {
        try {
          const userId = user?.id || user?.email || (await getUserId());
          if (!userId) {
            throw new Error("Korisnik nije autentifikovan");
          }
          
          const datumString = formatirajDatum(trenutniDatum).replace(/\.$/, '');
          const uploadedFile = await uploadFile(newRashodImage, 'rashod', datumString);
          imageUrl = uploadedFile.url;
        } catch (error: any) {
          console.error("Greška pri upload-u slike rashoda:", error);
          alert("Greška pri upload-u slike rashoda. Rashod će biti dodat bez slike.");
        }
      }
      
      const updatedRashodi = [...rashodi, { ...newRashod, imageUrl }];
      setRashodi(updatedRashodi);
      setNewRashod({ naziv: "", cijena: 0 });
      setNewRashodImage(null);

      // Sačuvaj draft obračun sa novim rashodom
      try {
        const userId = user?.id || user?.email || (await getUserId());
        if (userId) {
          const datumString = formatirajDatum(trenutniDatum);
          const ukupnoArtikli = artikli.reduce((sum, a) => sum + a.vrijednostKM, 0);
          const ukupnoRashod = updatedRashodi.reduce((sum, r) => sum + r.cijena, 0);
          const ukupnoPrihod = prihodi.reduce((sum, p) => sum + p.cijena, 0);
          const neto = ukupnoArtikli + ukupnoPrihod - ukupnoRashod;
          const hasUlaz = artikli.some(a => a.ulaz !== 0);

          await saveObracun(userId, {
            datum: datumString,
            artikli: artikli,
            rashodi: updatedRashodi,
            prihodi: prihodi,
            ukupnoArtikli: ukupnoArtikli,
            ukupnoRashod: ukupnoRashod,
            ukupnoPrihod: ukupnoPrihod,
            neto: neto,
            isAzuriran: true,
            imaUlaz: hasUlaz,
            invoiceImages: undefined, // Slike faktura se ne čuvaju u draft-u sa rashodima
            isDraft: true,
          });
        }
      } catch (error) {
        console.error("Greška pri spremanju draft obračuna sa rashodom:", error);
        // Ne prikazuj alert korisniku jer je rashod već dodat u state
      }
    }
  };

  const handleAddPrihod = async () => {
    if (newPrihod.naziv && newPrihod.cijena >= 0) {
      let imageUrl: string | undefined = undefined;
      
      // Upload slike ako postoji
      if (newPrihodImage) {
        try {
          const userId = user?.id || user?.email || (await getUserId());
          if (!userId) {
            throw new Error("Korisnik nije autentifikovan");
          }
          
          const datumString = formatirajDatum(trenutniDatum).replace(/\.$/, '');
          const uploadedFile = await uploadFile(newPrihodImage, 'prihod', datumString);
          imageUrl = uploadedFile.url;
        } catch (error: any) {
          console.error("Greška pri upload-u slike prihoda:", error);
          alert("Greška pri upload-u slike prihoda. Prihod će biti dodat bez slike.");
        }
      }
      
      const updatedPrihodi = [...prihodi, { ...newPrihod, imageUrl }];
      setPrihodi(updatedPrihodi);
      setNewPrihod({ naziv: "", cijena: 0 });
      setNewPrihodImage(null);

      // Sačuvaj draft obračun sa novim prihodom
      try {
        const userId = user?.id || user?.email || (await getUserId());
        if (userId) {
          const datumString = formatirajDatum(trenutniDatum);
          const ukupnoArtikli = artikli.reduce((sum, a) => sum + a.vrijednostKM, 0);
          const ukupnoRashod = rashodi.reduce((sum, r) => sum + r.cijena, 0);
          const ukupnoPrihod = updatedPrihodi.reduce((sum, p) => sum + p.cijena, 0);
          const neto = ukupnoArtikli + ukupnoPrihod - ukupnoRashod;
          const hasUlaz = artikli.some(a => a.ulaz !== 0);

          await saveObracun(userId, {
            datum: datumString,
            artikli: artikli,
            rashodi: rashodi,
            prihodi: updatedPrihodi,
            ukupnoArtikli: ukupnoArtikli,
            ukupnoRashod: ukupnoRashod,
            ukupnoPrihod: ukupnoPrihod,
            neto: neto,
            isAzuriran: true,
            imaUlaz: hasUlaz,
            invoiceImages: undefined, // Slike faktura se ne čuvaju u draft-u sa prihodima
            isDraft: true,
          });
        }
      } catch (error) {
        console.error("Greška pri spremanju draft obračuna sa prihodom:", error);
        // Ne prikazuj alert korisniku jer je prihod već dodat u state
      }
    }
  };

  const handleEditRashod = (index: number) => {
    setEditRashodIndex(index);
    setEditRashod({ ...rashodi[index] });
    setEditRashodImage(null); // Resetuj sliku pri edit-u
  };

  const handleEditPrihod = (index: number) => {
    setEditPrihodIndex(index);
    setEditPrihod({ ...prihodi[index] });
    setEditPrihodImage(null); // Resetuj sliku pri edit-u
  };

  const startInlineEditRashod = (index: number) => {
    setInlineEditingRashodIndex(index);
  };

  const cancelInlineEditRashod = () => {
    setInlineEditingRashodIndex(null);
  };

  const saveInlineEditRashod = async (index: number, newCijena: number) => {
    const updatedRashodi = [...rashodi];
    updatedRashodi[index].cijena = newCijena;
    setRashodi(updatedRashodi);
    setInlineEditingRashodIndex(null);

    // Sačuvaj draft obračun sa ažuriranim rashodom
    try {
      const userId = user?.id || user?.email || (await getUserId());
      if (userId) {
        const datumString = formatirajDatum(trenutniDatum);
        const ukupnoArtikli = artikli.reduce((sum, a) => sum + a.vrijednostKM, 0);
        const ukupnoRashod = updatedRashodi.reduce((sum, r) => sum + r.cijena, 0);
        const ukupnoPrihod = prihodi.reduce((sum, p) => sum + p.cijena, 0);
        const neto = ukupnoArtikli + ukupnoPrihod - ukupnoRashod;
        await saveObracun(userId, {
          datum: datumString,
          artikli: artikli,
          rashodi: updatedRashodi,
          prihodi: prihodi,
          ukupnoArtikli: ukupnoArtikli,
          ukupnoRashod: ukupnoRashod,
          ukupnoPrihod: ukupnoPrihod,
          neto: neto,
          imaUlaz: artikli.some(a => a.ulaz !== 0),
          isDraft: true
        });
      }
    } catch (error) {
      console.error("Greška pri spremanju draft obračuna sa inline edit rashodom:", error);
    }
  };

  const handleDeleteRashod = async (index: number) => {
    const updatedRashodi = rashodi.filter((_, i) => i !== index);
    setRashodi(updatedRashodi);
    if (editRashodIndex === index) {
      setEditRashodIndex(null);
      setEditRashod({ naziv: "", cijena: 0 });
    }

    // Sačuvaj draft obračun sa obrisanim rashodom
    try {
      const userId = user?.id || user?.email || (await getUserId());
      if (userId) {
        const datumString = formatirajDatum(trenutniDatum);
        const ukupnoArtikli = artikli.reduce((sum, a) => sum + a.vrijednostKM, 0);
        const ukupnoRashod = updatedRashodi.reduce((sum, r) => sum + r.cijena, 0);
        const ukupnoPrihod = prihodi.reduce((sum, p) => sum + p.cijena, 0);
        const neto = ukupnoArtikli + ukupnoPrihod - ukupnoRashod;
        const hasUlaz = artikli.some(a => a.ulaz !== 0);

        await saveObracun(userId, {
          datum: datumString,
          artikli: artikli,
          rashodi: updatedRashodi,
          prihodi: prihodi,
          ukupnoArtikli: ukupnoArtikli,
          ukupnoRashod: ukupnoRashod,
          ukupnoPrihod: ukupnoPrihod,
          neto: neto,
          isAzuriran: true,
          imaUlaz: hasUlaz,
          invoiceImages: undefined,
          isDraft: true,
        });
      }
    } catch (error) {
      console.error("Greška pri spremanju draft obračuna nakon brisanja rashoda:", error);
    }
  };

  const handleDeletePrihod = async (index: number) => {
    // Sačuvaj prihod koji se briše prije nego što ga izbrišemo iz state-a
    const prihodToDelete = prihodi[index];
    
    // Ukloni prihod iz state-a
    const updatedPrihodi = prihodi.filter((_, i) => i !== index);
    setPrihodi(updatedPrihodi);
    if (editPrihodIndex === index) {
      setEditPrihodIndex(null);
      setEditPrihod({ naziv: "", cijena: 0 });
    }

    // Sačuvaj draft obračun sa obrisanim prihodom
    try {
      const userId = user?.id || user?.email || (await getUserId());
      if (userId) {
        const datumString = formatirajDatum(trenutniDatum);
        const ukupnoArtikli = artikli.reduce((sum, a) => sum + a.vrijednostKM, 0);
        const ukupnoRashod = rashodi.reduce((sum, r) => sum + r.cijena, 0);
        const ukupnoPrihod = updatedPrihodi.reduce((sum, p) => sum + p.cijena, 0);
        const neto = ukupnoArtikli + ukupnoPrihod - ukupnoRashod;
        const hasUlaz = artikli.some(a => a.ulaz !== 0);

        await saveObracun(userId, {
          datum: datumString,
          artikli: artikli,
          rashodi: rashodi,
          prihodi: updatedPrihodi,
          ukupnoArtikli: ukupnoArtikli,
          ukupnoRashod: ukupnoRashod,
          ukupnoPrihod: ukupnoPrihod,
          neto: neto,
          isAzuriran: true,
          imaUlaz: hasUlaz,
          invoiceImages: undefined,
          isDraft: true,
        });
      }
    } catch (error) {
      console.error("Greška pri spremanju draft obračuna nakon brisanja prihoda:", error);
    }
    
    // Ako je prihod obrisan, provjeri da li postoji dug u arhivi sa tim imenom (ime dužnika)
    // i ako postoji, označi ga kao neplaćen i ukloni datum plaćanja
    if (prihodToDelete && prihodToDelete.naziv) {
      const userId = user?.id || user?.email;
      if (!userId) {
        console.warn("Korisnik nije prijavljen, ne mogu ažurirati dug u arhivi");
        return;
      }
      
      try {
        // Učitaj sve obračune iz arhive (samo finalni, ne draft)
        const obracuni = await getObracuni(userId);
        const finalniObracuni = obracuni.filter((ob: any) => !ob.isAzuriran || ob.isAzuriran === false);
        
        // Pronađi obračun koji ima rashod (dug) sa imenom dužnika koje odgovara nazivu prihoda
        // VAŽNO: Provjeravamo i iznos da bismo pronašli tačno taj dug (izbjegavamo duplikate)
        let foundAndUpdated = false;
        for (const obracun of finalniObracuni) {
          if (obracun.rashodi && Array.isArray(obracun.rashodi)) {
            // Pronađi rashod (dug) koji ima ime dužnika u nazivu I isti iznos kao prihod
            const rashodIndex = obracun.rashodi.findIndex((rashod: any) => {
              const naziv = rashod.naziv || '';
              const lowerNaziv = naziv.toLowerCase().trim();
              // Provjeri da li naziv rashoda sadrži "dug" i ime dužnika (naziv prihoda)
              if (!lowerNaziv.includes('dug')) return false;
              
              // Ime dužnika je sve prije "dug" u nazivu rashoda
              const parts = naziv.split(/\s+/);
              const dugIndex = parts.findIndex((p: string) => p.toLowerCase() === "dug");
              if (dugIndex === -1) return false;
              
              const imeDuznika = parts.slice(0, dugIndex).join(" ").trim();
              const imeMatches = imeDuznika.toLowerCase() === prihodToDelete.naziv.toLowerCase();
              
              // Provjeri i iznos - mora biti isti kao iznos prihoda (to osigurava da je to tačno taj dug)
              const iznosMatches = Math.abs((rashod.cijena || 0) - (prihodToDelete.cijena || 0)) < 0.01;
              
              return imeMatches && iznosMatches;
            });
            
            if (rashodIndex !== -1) {
              const rashod = obracun.rashodi[rashodIndex];
              // Ako je dug označen kao plaćen, označi ga kao neplaćen i ukloni datum plaćanja
              if (rashod.placeno || rashod.datumPlacanja) {
                console.log(`🔍 Pronađen plaćeni dug za "${prihodToDelete.naziv}" (iznos: ${rashod.cijena}) u obračunu ${obracun.datum}, označavam kao neplaćen`);
                
                const updatedRashodi = obracun.rashodi.map((r: any, i: number) => {
                  if (i === rashodIndex) {
                    // Ukloni placeno i datumPlacanja - vraćamo dug na originalno stanje
                    const { placeno, datumPlacanja, ...rest } = r;
                    return rest;
                  }
                  return r;
                });
                
                const ukupnoRashod = updatedRashodi.reduce((sum: number, r: any) => sum + (r.cijena || 0), 0);
                
                // Ažuriraj obračun u arhivi (isti obračun iz kojeg je dug došao)
                await saveObracun(userId, {
                  datum: obracun.datum,
                  artikli: Array.isArray(obracun.artikli) ? obracun.artikli : [],
                  rashodi: updatedRashodi,
                  prihodi: Array.isArray(obracun.prihodi) ? obracun.prihodi : [],
                  ukupnoArtikli: obracun.ukupnoArtikli || 0,
                  ukupnoRashod: ukupnoRashod,
                  ukupnoPrihod: ukupnoPrihod,
                  neto: (obracun.ukupnoArtikli || 0) + (obracun.ukupnoPrihod || 0) - ukupnoRashod,
                  isAzuriran: false, // Finalni obračun
                  imaUlaz: obracun.imaUlaz || false,
                  invoiceImages: obracun.invoiceImages || [],
                  isDraft: false,
                });
                
                console.log(`✅ Dug za "${prihodToDelete.naziv}" (iznos: ${rashod.cijena}) je označen kao neplaćen u obračunu ${obracun.datum} - vraćen na originalno mjesto`);
                foundAndUpdated = true;
                break; // Pronađen i ažuriran, prekini petlju
              }
            }
          }
        }
        
        if (!foundAndUpdated) {
          console.warn(`⚠️ Nije pronađen plaćeni dug za "${prihodToDelete.naziv}" (iznos: ${prihodToDelete.cijena}) u arhivi`);
        }
      } catch (error: any) {
        console.error("Greška pri ažuriranju duga u arhivi:", error);
        // Ne prikazuj alert jer je to pozadinska operacija
      }
    }
  };

  const handleSaveEditRashod = async () => {
    if (editRashodIndex !== null && editRashod.naziv && editRashod.cijena >= 0) {
      let imageUrl = editRashod.imageUrl; // Zadrži postojeću sliku
      
      // Upload nove slike ako je dodana
      if (editRashodImage) {
        try {
          const userId = user?.id || user?.email || (await getUserId());
          if (!userId) {
            throw new Error("Korisnik nije autentifikovan");
          }
          
          const datumString = formatirajDatum(trenutniDatum).replace(/\.$/, '');
          const uploadedFile = await uploadFile(editRashodImage, 'rashod', datumString);
          imageUrl = uploadedFile.url;
        } catch (error: any) {
          console.error("Greška pri upload-u slike rashoda:", error);
          alert("Greška pri upload-u slike rashoda. Rashod će biti sačuvan sa postojećom slikom.");
        }
      }
      
      const updatedRashodi = rashodi.map((r, i) => (i === editRashodIndex ? { ...editRashod, imageUrl } : r));
      setRashodi(updatedRashodi);
      setEditRashodIndex(null);
      setEditRashod({ naziv: "", cijena: 0 });
      setEditRashodImage(null);

      // Sačuvaj draft obračun sa editiranim rashodom
      try {
        const userId = user?.id || user?.email || (await getUserId());
        if (userId) {
          const datumString = formatirajDatum(trenutniDatum);
          const ukupnoArtikli = artikli.reduce((sum, a) => sum + a.vrijednostKM, 0);
          const ukupnoRashod = updatedRashodi.reduce((sum, r) => sum + r.cijena, 0);
          const ukupnoPrihod = prihodi.reduce((sum, p) => sum + p.cijena, 0);
          const neto = ukupnoArtikli + ukupnoPrihod - ukupnoRashod;
          const hasUlaz = artikli.some(a => a.ulaz !== 0);

          await saveObracun(userId, {
            datum: datumString,
            artikli: artikli,
            rashodi: updatedRashodi,
            prihodi: prihodi,
            ukupnoArtikli: ukupnoArtikli,
            ukupnoRashod: ukupnoRashod,
            ukupnoPrihod: ukupnoPrihod,
            neto: neto,
            isAzuriran: true,
            imaUlaz: hasUlaz,
            invoiceImages: undefined,
            isDraft: true,
          });
        }
      } catch (error) {
        console.error("Greška pri spremanju draft obračuna nakon editiranja rashoda:", error);
      }
    }
  };

  const handleSaveEditPrihod = async () => {
    if (editPrihodIndex !== null && editPrihod.naziv && editPrihod.cijena >= 0) {
      let imageUrl = editPrihod.imageUrl; // Zadrži postojeću sliku
      
      // Upload nove slike ako je dodana
      if (editPrihodImage) {
        try {
          const userId = user?.id || user?.email || (await getUserId());
          if (!userId) {
            throw new Error("Korisnik nije autentifikovan");
          }
          
          const datumString = formatirajDatum(trenutniDatum).replace(/\.$/, '');
          const uploadedFile = await uploadFile(editPrihodImage, 'prihod', datumString);
          imageUrl = uploadedFile.url;
        } catch (error: any) {
          console.error("Greška pri upload-u slike prihoda:", error);
          alert("Greška pri upload-u slike prihoda. Prihod će biti sačuvan sa postojećom slikom.");
        }
      }
      
      const updatedPrihodi = prihodi.map((p, i) => (i === editPrihodIndex ? { ...editPrihod, imageUrl } : p));
      setPrihodi(updatedPrihodi);
      setEditPrihodIndex(null);
      setEditPrihod({ naziv: "", cijena: 0 });
      setEditPrihodImage(null);

      // Sačuvaj draft obračun sa editiranim prihodom
      try {
        const userId = user?.id || user?.email || (await getUserId());
        if (userId) {
          const datumString = formatirajDatum(trenutniDatum);
          const ukupnoArtikli = artikli.reduce((sum, a) => sum + a.vrijednostKM, 0);
          const ukupnoRashod = rashodi.reduce((sum, r) => sum + r.cijena, 0);
          const ukupnoPrihod = updatedPrihodi.reduce((sum, p) => sum + p.cijena, 0);
          const neto = ukupnoArtikli + ukupnoPrihod - ukupnoRashod;
          const hasUlaz = artikli.some(a => a.ulaz !== 0);

          await saveObracun(userId, {
            datum: datumString,
            artikli: artikli,
            rashodi: rashodi,
            prihodi: updatedPrihodi,
            ukupnoArtikli: ukupnoArtikli,
            ukupnoRashod: ukupnoRashod,
            ukupnoPrihod: ukupnoPrihod,
            neto: neto,
            isAzuriran: true,
            imaUlaz: hasUlaz,
            invoiceImages: undefined,
            isDraft: true,
          });
        }
      } catch (error) {
        console.error("Greška pri spremanju draft obračuna nakon editiranja prihoda:", error);
      }
    }
  };

  const handleCancelEditRashod = () => {
    setEditRashodIndex(null);
    setEditRashod({ naziv: "", cijena: 0 });
    setEditRashodImage(null);
  };

  const handleCancelEditPrihod = () => {
    setEditPrihodIndex(null);
    setEditPrihod({ naziv: "", cijena: 0 });
    setEditPrihodImage(null);
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
    const userId = user?.id || user?.email;
    if (!userId) {
      alert("Korisnik nije autentifikovan!");
      return;
    }

    // Ažuriraj artikle u formi - ZADRŽI početno stanje i ulaz (ne mijenjaj ništa)
    // VAŽNO: Ulaz se NE zbraja sa početnim stanjem - ostaje kao posebno polje
    // Ukupno se računa kao pocetnoStanje + ulaz samo za prikaz, ali ulaz ostaje odvojen
    const updated = artikli.map((a) => {
      if (a.ulaz !== 0) {
        return {
          ...a,
          // NE mijenjaj početno stanje - ostaje kako je
          pocetnoStanje: a.pocetnoStanje,
          ulaz: a.ulaz, // ZADRŽI ulaz kao posebno polje - ne zbraja se sa početnim stanjem!
          ukupno: a.pocetnoStanje + a.ulaz, // Ukupno = početno stanje + ulaz (samo za prikaz)
          sačuvanUlaz: a.ulaz, // Sačuvaj ulaz za prikaz u arhivi
          // Ne resetiraj utrošeno, vrijednost, krajnje stanje - ostaju kako su
        };
      }
      // Za artikle bez ulaza, zadrži sve kako je
      return a;
    });
    
    setArtikli(updated);
    
    // Postavi flag da postoji ulaz (za prikaz gumba za slike)
    setHasUlazInCache(true);
    setIsAzuriran(true); // Označi da je obračun bio ažuriran
    setIsUlazLocked(true); // Zaključaj ulaze nakon ažuriranja

    try {
      // 1. Učitaj prethodni draft (ako postoji) da pokupimo stare slike
      let draftInvoiceImages: string[] = [];
      try {
        const obracuni = await getObracuni(userId, datumString);
        const draftObracun = obracuni.find((ob: any) => {
          const obDatum = ob.datum && ob.datum.replace(/\.$/, '');
          const trazeniDatum = datumString.replace(/\.$/, '');
          return obDatum === trazeniDatum && ob.isAzuriran === true;
        });
        if (draftObracun && Array.isArray(draftObracun.invoiceImages)) {
          draftInvoiceImages = [...draftObracun.invoiceImages];
        }
      } catch (e) {
        console.warn("Greška pri učitavanju drafta za slike faktura (azuriranje):", e);
      }

      // 2. Upload nove slike iz state-a
      let uploadedInvoiceImages: string[] = [];
      if (invoiceImages.length > 0) {
        try {
          uploadedInvoiceImages = await uploadInvoiceImages(datumString);
          console.log(`📸 Upload-ovano ${uploadedInvoiceImages.length} slika faktura za draft obračun`);
          setSavedInvoiceImagesCount((prev) => prev + uploadedInvoiceImages.length);
        } catch (error: any) {
          console.warn("Upozorenje: Slike faktura nisu upload-ovane:", error);
        }
      }

      // 3. Spoji sve slike (stare iz drafta, nove uploadovane, i još uvijek prisutne u state-u)
      const allInvoiceImageUrls = Array.from(new Set([
        ...draftInvoiceImages,
        ...uploadedInvoiceImages,
        ...invoiceImages.filter((file) => typeof file === 'string') as string[]
      ]));

      // 4. Sačuvaj ažurirani obračun u bazu kao privremeni (sa isAzuriran: true i isDraft: true)
      const ukupnoArtikli = updated.reduce((sum, a) => sum + a.vrijednostKM, 0);
      const ukupnoRashod = rashodi.reduce((sum, r) => sum + r.cijena, 0);
      const ukupnoPrihod = prihodi.reduce((sum, p) => sum + p.cijena, 0);
      const neto = ukupnoArtikli + ukupnoPrihod - ukupnoRashod;

      await saveObracun(userId, {
        datum: datumString,
        artikli: updated,
        rashodi: rashodi,
        prihodi: prihodi,
        ukupnoArtikli: ukupnoArtikli,
        ukupnoRashod: ukupnoRashod,
        ukupnoPrihod: ukupnoPrihod,
        neto: neto,
        isAzuriran: true,
        imaUlaz: imaUlaz,
        invoiceImages: allInvoiceImageUrls.length > 0 ? allInvoiceImageUrls : undefined,
        isDraft: true,
      });

      alert("Ulaz je sačuvan i zaključan! Kliknite 'Uredi' ako želite promijeniti vrijednosti.");
    } catch (error: any) {
      console.error("Greška pri spremanju ažuriranog obračuna:", error);
      alert("Greška pri spremanju ažuriranog obračuna. Pokušajte ponovo.");
    }
  };

  // Provjeri da li obračun ima ulaz (trenutni ulaz, sačuvan ulaz, ili u cache-u)
  const hasUlaz = artikli.some((a) => a.ulaz !== 0 || (a.sačuvanUlaz !== undefined && a.sačuvanUlaz !== 0)) || hasUlazInCache;



  // Funkcija za upload slika faktura - MIGRIRANO NA API
  const uploadInvoiceImages = async (datumString: string): Promise<string[]> => {
    // Ako nema slika, odmah vrati prazan array
    if (invoiceImages.length === 0) {
      console.log("Nema slika za upload, preskačem");
      return [];
    }
    
    // Email je glavni identifikator
    const userId = user?.id || user?.email || (await getUserId());
    if (!userId) {
      throw new Error("Korisnik nije autentifikovan");
    }

    // Očisti datum string (ukloni tačku na kraju ako postoji)
    const cleanDatumString = datumString.replace(/\.$/, '');

    const uploadedUrls: string[] = [];
    setUploadingImages(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < invoiceImages.length; i++) {
        const file = invoiceImages[i];
        
        console.log("Upload slike:", file.name);
        
        // Upload file preko API-ja
        const uploadedFile = await uploadFile(file, 'invoice', cleanDatumString);
        uploadedUrls.push(uploadedFile.url);
        
        console.log("Slika uspješno upload-ovana:", uploadedFile.url);
        
        setUploadProgress(((i + 1) / invoiceImages.length) * 100);
      }
    } catch (error: any) {
      console.error("Greška pri upload-u slika:", error);
      throw new Error(error.message || "Greška pri upload-u slika. Provjerite da li ste prijavljeni.");
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

    // Provjeri da li obračun ima ulaz - provjeri samo trenutni state (draft je već učitan ako postoji)
    const imaUlaz = artikli.some((a) => {
      // Provjeri trenutni ulaz
      if (a.ulaz !== 0) {
        return true;
      }
      // Provjeri sačuvan ulaz (ako je obračun već ažuriran, ulaz je resetovan na 0 ali je sačuvan)
      if (a.sačuvanUlaz !== undefined && a.sačuvanUlaz !== 0) {
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
        // Prioritet: 1. trenutni ulaz, 2. sačuvan ulaz u state-u, 3. ulaz iz cache-a
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
        
        // Kreiraj objekt bez undefined vrijednosti
        // VAŽNO: Ako nije postavljeno krajnje stanje, krajnje stanje = ukupno (početno + ulaz)
        // Ako je krajnje stanje 0 ili nije postavljeno, koristi ukupno
        // Ukupno = početno stanje + ulaz (za prikaz u arhivi)
        const ukupnoZaPrikaz = ulazZaPrikaz !== 0 ? a.pocetnoStanje + ulazZaPrikaz : a.ukupno;
        const krajnjeStanjeZaPrikaz = (a.isKrajnjeSet && a.krajnjeStanje !== undefined && a.krajnjeStanje !== null && a.krajnjeStanje > 0)
          ? a.krajnjeStanje 
          : (ukupnoZaPrikaz !== undefined && ukupnoZaPrikaz !== null && ukupnoZaPrikaz > 0)
          ? ukupnoZaPrikaz
          : (a.pocetnoStanje !== undefined && a.pocetnoStanje !== null && a.pocetnoStanje > 0)
          ? a.pocetnoStanje
          : 0; // Fallback na 0 ako ništa nije postavljeno
        
        const artikalObj: any = {
          naziv: a.naziv,
          cijena: a.cijena,
          pocetnoStanje: a.pocetnoStanje, // Početno stanje ostaje nepromijenjeno (ulaz se zbraja tek pri spremanju)
          ulaz: ulazZaPrikaz, // Sačuvaj ulaz za prikaz u arhivi - OBAVEZNO postavi ulaz ako postoji
          ukupno: ukupnoZaPrikaz, // Ukupno = početno stanje + ulaz
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

    // Email je glavni identifikator
    const userId = user?.id || user?.email || (await getUserId());
    if (!userId) {
      alert("Greška: Niste prijavljeni. Molimo prijavite se ponovo.");
      return;
    }


    // Uvijek spoji slike iz drafta (ako postoji) i iz trenutnog state-a (invoiceImages)
    let draftInvoiceImages: string[] = [];
    let uploadedInvoiceImages: string[] = [];
    try {
      const obracuni = await getObracuni(userId, datumString);
      const draftObracun = obracuni.find((ob: any) => {
        const obDatum = ob.datum && ob.datum.replace(/\.$/, '');
        const trazeniDatum = datumString.replace(/\.$/, '');
        return obDatum === trazeniDatum && ob.isAzuriran === true;
      });
      if (draftObracun && Array.isArray(draftObracun.invoiceImages)) {
        draftInvoiceImages = [...draftObracun.invoiceImages];
      }
    } catch (error) {
      console.warn("Greška pri učitavanju drafta za slike faktura:", error);
    }

    // Uvijek uploaduj slike iz lokalnog state-a (invoiceImages)
    if (invoiceImages.length > 0) {
      try {
        uploadedInvoiceImages = await uploadInvoiceImages(datumString);
        console.log('[OBRACUN] uploadInvoiceImages rezultat:', uploadedInvoiceImages);
      } catch (error) {
        console.warn("Greška pri uploadu novih slika faktura:", error);
      }
    }

    // Spoji slike i ukloni duplikate (ako postoji isti URL)
    const allInvoiceImageUrls = Array.from(new Set([...draftInvoiceImages, ...uploadedInvoiceImages]));
    if (allInvoiceImageUrls.length > 0) {
      (arhiviraniObracun as any).invoiceImages = allInvoiceImageUrls;
      console.log('[OBRACUN] Sve slike koje šaljemo u arhiviraniObracun:', allInvoiceImageUrls);
    }

    // SPREMI PREKO API-JA kao finalni obračun (isDraft: false ili undefined)
    // API će automatski obrisati draft prije spremanja finalnog
    try {
      console.log("💾 Pokretanje čuvanja obračuna:", {
        userId,
        datum: datumString,
        artikliCount: arhiviraniObracun.artikli.length,
        rashodiCount: arhiviraniObracun.rashodi.length,
        prihodiCount: arhiviraniObracun.prihodi.length,
        invoiceImagesCount: allInvoiceImageUrls.length
      });
      
      const saveData = {
        datum: datumString,
        artikli: arhiviraniObracun.artikli,
        rashodi: arhiviraniObracun.rashodi,
        prihodi: arhiviraniObracun.prihodi,
        ukupnoArtikli: arhiviraniObracun.ukupnoArtikli,
        ukupnoRashod: arhiviraniObracun.ukupnoRashod,
        ukupnoPrihod: arhiviraniObracun.ukupnoPrihod,
        neto: arhiviraniObracun.neto,
        isAzuriran: false, // Finalni obračun se čuva sa isAzuriran: false (prikazuje se u arhivi)
        imaUlaz: arhiviraniObracun.imaUlaz || false,
        invoiceImages: allInvoiceImageUrls.length > 0 ? allInvoiceImageUrls : undefined,
        isDraft: false, // Finalni obračun - API će obrisati draft prije spremanja
      };
      
      console.log("📤 Pozivanje saveObracun API sa podacima:", {
        ...saveData,
        invoiceImages: saveData.invoiceImages ? `[${saveData.invoiceImages.length} slika]` : 'nema slika'
      });
      console.log("📤 Detalji slika faktura:", saveData.invoiceImages);
      
      await saveObracun(userId, saveData);
      
      console.log("✅ Obračun uspješno sačuvan preko API-ja:", datumString, "sa", allInvoiceImageUrls.length, "slika faktura");

      // Očisti fakture/cache za ovaj datum TEK kada je finalni obračun uspješno sačuvan
      if (typeof window !== 'undefined') {
        try {
          const normalizedDatum = normalizeDatumString(datumString);
          const cacheKeys = [`ulazCache_${datumString}`, `ulazCache_${normalizedDatum}`];
          cacheKeys.forEach((key) => localStorage.removeItem(key));

          const acceptedInvoicesRaw = localStorage.getItem('acceptedInvoices');
          const acceptedInvoices = acceptedInvoicesRaw ? JSON.parse(acceptedInvoicesRaw) : {};
          delete acceptedInvoices[datumString];
          delete acceptedInvoices[normalizedDatum];
          localStorage.setItem('acceptedInvoices', JSON.stringify(acceptedInvoices));
        } catch (e) {
          console.warn('⚠️ Ne mogu očistiti localStorage fakture nakon završetka obračuna:', e);
        }
      }
      
      // Resetuj slike faktura nakon uspješnog spremanja
      setInvoiceImages([]);
      setSavedInvoiceImagesCount(0);
      setHasUlazInCache(false); // Resetuj flag da nema ulaz u cache-a
      
      // Resetuj ulaz i otključaj ga za naredni dan
      setIsUlazLocked(false);
      setIsAzuriran(false);
      setUlazCacheForDatum({}); // Očisti cache za ulaz
      
      // Prebaci se na sljedeći dan nakon što se sačuva obračun
      const sljedeciDan = new Date(trenutniDatum);
      sljedeciDan.setDate(sljedeciDan.getDate() + 1);
      setTrenutniDatum(sljedeciDan);
      alert(`Obračun za ${datumString} je sačuvan! Prebačeno na ${formatirajDatum(sljedeciDan)}`);
      
      // Ažuriranje cjenovnika (početno stanje za sljedeći dan = krajnje stanje iz ovog dana)
      setCjenovnik((prev) =>
        prev.map((item) => {
          const artikal = artikli.find((a: Artikal) => a.naziv === item.naziv);
          if (!artikal) return item;
          
          // Za sljedeći dan, početno stanje = krajnje stanje iz ovog dana
          let novoPocetnoStanje: number;
          if (artikal.naziv.toLowerCase().includes("kafa")) {
            novoPocetnoStanje = 0; // Kafa se uvijek resetuje na 0
          } else if (artikal.isKrajnjeSet && artikal.krajnjeStanje > 0) {
            novoPocetnoStanje = artikal.krajnjeStanje;
          } else if (artikal.ulaz !== 0) {
            // Ako ima ulaz, početno stanje za sljedeći dan = trenutno početno stanje + ulaz
            novoPocetnoStanje = artikal.pocetnoStanje + artikal.ulaz;
          } else {
            novoPocetnoStanje = artikal.ukupno;
          }
          
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
      setIsAzuriran(false);
      setIsUlazLocked(false);
      setResetKey((prev) => prev + 1);
      setArtikli([]);

      // Emituj događaj za ažuriranje arhive
      window.dispatchEvent(new Event("arhivaChanged"));
      
      alert("Obračun uspješno sačuvan!");
      
    } catch (error: any) {
      console.error("❌ Greška pri spremanju obračuna:", {
        error,
        message: error?.message,
        stack: error?.stack,
        userId,
        datum: datumString
      });
      const errorMessage = error?.message || error?.error || "Nepoznata greška";
      alert(`Greška pri spremanju obračuna: ${errorMessage}\n\nProverite konzolu za više detalja.`);
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

  // Dinamički container style sa smanjenim padding-om na mobilnom
  const dynamicContainerStyle: React.CSSProperties = {
    ...containerStyle,
    padding: isMobile ? "4px" : "16px",
  };

  return (
    <div style={dynamicContainerStyle}>
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
          /* Spriječi automatsko zumiranje na input poljima - iOS Safari zumira ako je font-size < 16px */
          input[type="text"],
          input[type="number"],
          input[type="tel"],
          input[type="email"],
          input[type="date"],
          input[type="time"],
          input[type="datetime-local"],
          textarea,
          select {
            font-size: 16px !important;
          }
          div[style*="maxWidth: 1200px"] { 
            padding: 8px !important;
            margin: 0 auto !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          /* Osiguraj da je parent container centriran na mobilnom */
          div[style*="padding: 20px"][style*="width: 100%"] {
            padding-left: 10px !important;
            padding-right: 10px !important;
            padding-top: 10px !important;
            padding-bottom: 10px !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
          }
          /* Osiguraj da je obracun container centriran */
          div[style*="maxWidth: 1200px"] {
            margin-left: auto !important;
            margin-right: auto !important;
          }
          table:first-of-type { display: flex; flex-direction: column; }
          table:first-of-type thead { display: none; }
          table:first-of-type tbody { display: flex; flex-direction: column; gap: 16px; padding: 0; }
          table:first-of-type tr { 
            display: flex; 
            flex-direction: column; 
            background: #ffffff; 
            border-radius: 12px; 
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.08); 
            padding: 0; 
            border: 2px solid #e5e7eb;
            overflow: hidden;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
          }
          table:first-of-type tr::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899);
            opacity: 0;
            transition: opacity 0.25s ease;
          }
          table:first-of-type tr:active { 
            transform: translateY(1px); 
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border-color: #cbd5e1;
          }
          table:first-of-type td { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 0; 
            border-bottom: none; 
            font-size: 14px; 
          }
          table:first-of-type td:before { 
            content: attr(data-label); 
            font-weight: 600; 
            color: #64748b; 
            width: 48%; 
            font-size: 12.5px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          /* Header sekcija - Naziv artikla i Cijena */
          table:first-of-type td[data-label="Artikal"] { 
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            padding: 18px 20px 12px 20px;
            border-bottom: 1px solid #e2e8f0;
            margin-bottom: 0;
            position: relative;
          }
          table:first-of-type td[data-label="Artikal"]:before { 
            display: none; 
          }
          table:first-of-type td[data-label="Artikal"] { 
            color: #0f172a !important; 
            font-weight: 700 !important; 
            font-size: 19px !important; 
            justify-content: flex-start !important;
            letter-spacing: -0.3px;
            line-height: 1.3;
          }
          table:first-of-type td[data-label="Cijena"] {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            padding: 0 20px 14px 20px;
            border-bottom: 1px solid #e2e8f0;
            margin-bottom: 0;
            position: relative;
            justify-content: space-between !important;
          }
          table:first-of-type td[data-label="Cijena"]:before {
            display: none !important;
          }
          table:first-of-type td[data-label="Cijena"] span:first-child {
            color: #64748b;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
          }
          table:first-of-type td[data-label="Cijena"] span:last-child {
            margin-left: auto;
          }
          /* Stanja sekcija - grupisanje povezanih polja */
          table:first-of-type td[data-label="Početno stanje"],
          table:first-of-type td[data-label="Ulaz"] {
            padding: 12px 20px;
            background: #fafbfc;
            border-bottom: 1px solid #f1f5f9;
            margin-bottom: 0;
          }
          table:first-of-type td[data-label="Ukupno"] {
            padding: 12px 20px;
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border-bottom: 1px solid #cbd5e1;
            margin-bottom: 0;
          }
          table:first-of-type td[data-label="Ukupno"]:before {
            color: #0369a1;
          }
          table:first-of-type td[data-label="Ukupno"] {
            color: #0369a1 !important;
            font-weight: 700 !important;
            font-size: 15px !important;
          }
          /* Utrošeno i Krajnje stanje sekcija */
          table:first-of-type td[data-label="Utrošeno"] {
            padding: 12px 20px;
            background: #fafbfc;
            border-bottom: 1px solid #f1f5f9;
            margin-bottom: 0;
          }
          table:first-of-type td[data-label="Krajnje stanje"] {
            padding: 12px 20px;
            background: #fafbfc;
            border-bottom: 1px solid #e2e8f0;
            margin-bottom: 0;
          }
          /* Vrijednost KM - naglašena sekcija */
          table:first-of-type td[data-label="Vrijednost KM"] {
            padding: 14px 20px;
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border-bottom: none;
            margin-top: 0;
            border-top: 1px solid rgba(245, 158, 11, 0.3);
            position: relative;
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
            justify-content: space-between !important;
          }
          table:first-of-type td[data-label="Vrijednost KM"]:before {
            display: none !important;
          }
          table:first-of-type td[data-label="Vrijednost KM"] span:first-child {
            color: #92400e;
            font-size: 12.5px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 700;
          }
          table:first-of-type td[data-label="Vrijednost KM"] span:last-child {
            margin-left: auto;
          }
          /* Input polja stilizacija */
          table:first-of-type td input { 
            max-width: 48%; 
            width: 48%;
            padding: 12px 14px;
            border: 2px solid #cbd5e1;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            text-align: right;
            background: #ffffff;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            color: #0f172a;
          }
          table:first-of-type td input:hover:not(:disabled):not([readonly]) { 
            border-color: #94a3b8;
            background: #f8fafc;
          }
          table:first-of-type td input:focus { 
            border-color: #3b82f6;
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
            outline: none;
            background: #ffffff;
            transform: scale(1.02);
          }
          table:first-of-type td input:disabled,
          table:first-of-type td input[readonly] {
            background: #f1f5f9;
            color: #64748b;
            cursor: not-allowed;
          }
          /* Opšti stil za ostale td elemente */
          table:first-of-type td:not([data-label="Artikal"]):not([data-label="Cijena"]):not([data-label="Vrijednost KM"]):not([data-label="Ukupno"]) { 
            color: #334155;
            font-weight: 600;
            font-size: 15px;
          }
          /* Ikonice u labelima */
          table:first-of-type td[data-label="Početno stanje"]:before { content: "📦 " attr(data-label); }
          table:first-of-type td[data-label="Ulaz"]:before { content: "➕ " attr(data-label); }
          table:first-of-type td[data-label="Ukupno"]:before { content: "📊 " attr(data-label); }
          table:first-of-type td[data-label="Utrošeno"]:before { content: "➖ " attr(data-label); }
          table:first-of-type td[data-label="Krajnje stanje"]:before { content: "✓ " attr(data-label); }
          table:first-of-type td[data-label="Cijena"]:before { content: "💵 " attr(data-label); }
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
          /* Mobilni raspored za akcijske gumbe kao u referentnom push-u */
          .date-controls-container {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .date-controls-container > div:first-child {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 8px !important;
            flex-wrap: wrap !important;
          }
          .date-controls-container > div:first-child > label {
            font-size: 14px !important;
            font-weight: 500 !important;
            margin: 0 !important;
            flex-shrink: 0 !important;
          }
          .date-controls-container > div:first-child > input[type="date"] {
            width: auto !important;
            min-width: 140px !important;
            max-width: 160px !important;
            padding: 8px 10px !important;
            font-size: 14px !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 6px !important;
            flex: 0 0 auto !important;
          }
          .date-controls-container > div:last-child {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 8px !important;
            flex-wrap: wrap !important;
          }
          .date-controls-container > div:last-child > button,
          .date-controls-container > div:last-child > label {
            width: 160px !important;
            min-width: 160px !important;
            max-width: 160px !important;
            padding: 8px 12px !important;
            font-size: 13px !important;
            font-weight: 500 !important;
            border-radius: 6px !important;
            margin: 0 !important;
            flex: 0 0 160px !important;
            box-sizing: border-box !important;
          }
          .action-button {
            width: 160px !important;
            min-width: 160px !important;
            max-width: 160px !important;
            height: 38px !important;
            padding: 8px 12px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-sizing: border-box !important;
            white-space: nowrap !important;
          }
          .mobile-top-row {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
            flex-wrap: nowrap !important;
            width: 100% !important;
            gap: 8px !important;
          }
          .mobile-top-row h1 {
            margin: 0 !important;
            font-size: 20px !important;
            white-space: nowrap !important;
            flex: 0 0 auto !important;
          }
          .mobile-top-row .mobile-date-box {
            width: 142px !important;
            min-width: 142px !important;
            max-width: 142px !important;
            flex: 0 0 142px !important;
            margin: 0 !important;
          }
          h1 { font-size: 20px; margin-bottom: 16px; }
          h2 { font-size: 16px; margin-bottom: 12px; }
          h3 { font-size: 14px; margin: 6px 0; }
          /* Osiguraj da rashodi i prihodi budu u jednoj liniji na mobilnom */
          @media (max-width: 768px) {
            div[style*="justifyContent: space-between"][style*="alignItems: center"] {
              flex-wrap: nowrap !important;
              overflow: hidden !important;
            }
            div[style*="justifyContent: space-between"][style*="alignItems: center"] > div:first-child {
              flex: 1 !important;
              min-width: 0 !important;
              overflow: hidden !important;
            }
            div[style*="justifyContent: space-between"][style*="alignItems: center"] > div:first-child span:first-child {
              flex-shrink: 0 !important;
            }
            div[style*="justifyContent: space-between"][style*="alignItems: center"] > div:first-child span:last-child {
              white-space: nowrap !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
              flex: 1 !important;
              min-width: 0 !important;
            }
            div[style*="justifyContent: space-between"][style*="alignItems: center"] > div:last-child {
              flex-shrink: 0 !important;
              margin-left: 4px !important;
            }
            div[style*="justifyContent: space-between"][style*="alignItems: center"] > div:last-child button {
              padding: 2px 4px !important;
              font-size: 12px !important;
              background: transparent !important;
              border: none !important;
              color: inherit !important;
              text-decoration: underline !important;
              cursor: pointer !important;
            }
          }
        }
        @media (min-width: 769px) {
          .date-controls-container {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: flex-start !important;
            flex-wrap: nowrap !important;
            gap: 12px !important;
          }
          .date-controls-container > div:first-child {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 8px !important;
            flex: 0 0 auto !important;
            white-space: nowrap !important;
          }
          .date-controls-container > div:last-child {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 8px !important;
            flex: 0 0 auto !important;
          }
          .date-controls-container .action-button {
            width: 160px !important;
            min-width: 160px !important;
            max-width: 160px !important;
            margin: 0 !important;
          }
        }
      `}</style>

      <div
        className="mobile-top-row"
        style={{
          display: "flex",
          alignItems: isMobile ? "center" : "baseline",
          justifyContent: "space-between",
          flexWrap: "nowrap",
          marginBottom: "20px",
          gap: "12px",
          width: "100%",
        }}
      >
        <h1
          style={{
            fontSize: isMobile ? "20px" : "24px",
            fontWeight: 600,
            color: "#1f2937",
            marginBottom: 0,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Obračun
        </h1>
        <input
          className="mobile-date-box"
          type="date"
          value={formatDateForInput(trenutniDatum)}
          onChange={handleDatumChange}
          style={{
            ...dateInputStyle,
            width: isMobile ? "142px" : "160px",
            maxWidth: isMobile ? "142px" : "160px",
            padding: isMobile ? "7px 8px" : "8px",
            fontSize: isMobile ? "13px" : "14px",
            margin: 0,
            flexShrink: 0,
          }}
        />
      </div>

      {false && (
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

      <div className="date-controls-container" style={{ marginBottom: "20px", display: "flex", alignItems: "center", flexWrap: isMobile ? "wrap" : "nowrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: isMobile ? "wrap" : "nowrap", flex: isMobile ? "1 1 auto" : "0 0 auto" }}>
          <button
            className="action-button"
            style={{ ...buttonStyle, background: "#f59e0b", opacity: (canEdit && !isUlazLocked) ? 1 : 0.5, cursor: (canEdit && !isUlazLocked) ? "pointer" : "not-allowed", margin: 0 }}
            onClick={handleAzurirajObracun}
            disabled={!canEdit || isUlazLocked}
          >
            Ažuriraj obračun
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", flex: "0 0 auto" }}>
          {isUlazLocked && (
            <button
              className="action-button"
              style={{
                ...buttonStyle,
                background: "#6366f1",
                opacity: canEdit ? 1 : 0.5,
                cursor: canEdit ? "pointer" : "not-allowed",
                margin: 0
              }}
              onClick={handleUnlockUlazEditing}
              disabled={!canEdit}
            >
              Uredi ulaz
            </button>
          )}
          {hasUlaz && (
            <label
              className="action-button"
              style={{
                ...buttonStyle,
                background: "#3b82f6",
                maxWidth: "160px",
                minWidth: "160px",
                width: "160px",
                opacity: canEdit ? 1 : 0.5,
                cursor: canEdit ? "pointer" : "not-allowed",
                display: "inline-block",
                margin: 0
              }}
              onMouseEnter={(e) => {
                if (canEdit) {
                  e.currentTarget.style.background = "#2563eb";
                }
              }}
              onMouseLeave={(e) => {
                if (canEdit) {
                  e.currentTarget.style.background = "#3b82f6";
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
                  e.target.value = "";
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
                      const userId = user?.id || (await getUserId());
                      
                      if (!userId) {
                        alert("Korisnik nije autentifikovan");
                        return;
                      }
                      
                      // Provjeri da li ima slika prije nego što pokušaš upload
                      if (invoiceImages.length === 0) {
                        alert("Nema slika za upload!");
                        return;
                      }
                      
                      try {
                        setUploadingImages(true);
                        setUploadProgress(0);
                        const uploadedUrls = await uploadInvoiceImages(datumString);
                        
                        // Upload-ovane slike - sada ih treba sačuvati u draft-u
                        if (uploadedUrls.length > 0) {
                          // Učitaj trenutni draft ili kreiraj novi sa slikama
                          const obracuni = await getObracuni(userId, datumString);
                          const draftObracun = obracuni.find((ob: any) => ob.datum === datumString && ob.isAzuriran === true);
                          
                          let existingImages: string[] = [];
                          if (draftObracun && draftObracun.invoiceImages && Array.isArray(draftObracun.invoiceImages)) {
                            existingImages = draftObracun.invoiceImages;
                          }
                          
                          const allImages = [...existingImages, ...uploadedUrls];
                          
                          // Sačuvaj draft sa svim slikama
                          await saveObracun(userId, {
                            datum: datumString,
                            artikli: draftObracun?.artikli || artikli,
                            rashodi: draftObracun?.rashodi || rashodi,
                            prihodi: draftObracun?.prihodi || prihodi,
                            ukupnoArtikli: draftObracun?.ukupnoArtikli || artikli.reduce((sum, a) => sum + a.vrijednostKM, 0),
                            ukupnoRashod: draftObracun?.ukupnoRashod || rashodi.reduce((sum, r) => sum + r.cijena, 0),
                            ukupnoPrihod: draftObracun?.ukupnoPrihod || prihodi.reduce((sum, p) => sum + p.cijena, 0),
                            neto: draftObracun?.neto || (artikli.reduce((sum, a) => sum + a.vrijednostKM, 0) + prihodi.reduce((sum, p) => sum + p.cijena, 0) - rashodi.reduce((sum, r) => sum + r.cijena, 0)),
                            isAzuriran: true,
                            imaUlaz: draftObracun?.imaUlaz || hasUlaz,
                            invoiceImages: allImages,
                            isDraft: true,
                          });
                          
                          setSavedInvoiceImagesCount(allImages.length);
                          console.log(`📸 Sačuvano ${uploadedUrls.length} novih slika u draft-u (ukupno: ${allImages.length})`);
                        }
                        
                        alert("Slike faktura uspješno sačuvane!");
                        setInvoiceImages([]);
                        
                        console.log("Slike upload-ovane, osvježavam arhivu...");
                        window.dispatchEvent(new Event("arhivaChanged"));
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
                      padding: "8px 16px",
                      fontSize: "14px",
                      maxWidth: "160px",
                      marginRight: "8px",
                      marginBottom: "8px"
                    }}
                  >
                    {uploadingImages ? `Spremanje... ${Math.round(uploadProgress)}%` : "Sačuvaj slike"}
                  </button>
                  <button
                    onClick={() => setInvoiceImages([])}
                    style={{
                      ...buttonStyle,
                      background: "#dc2626",
                      maxWidth: "160px",
                      opacity: canEdit ? 1 : 0.5,
                      cursor: canEdit ? "pointer" : "not-allowed",
                      marginRight: "8px",
                      marginBottom: "8px"
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
      <h2 style={{ fontSize: "18px", fontWeight: 500, color: "#1f2937", marginBottom: isMobile ? "12px" : "16px" }}>
        Artikli
      </h2>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Artikal</th>
            <th style={thStyle}>Cijena</th>
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
                <td style={{...tdStyle, display: isMobile ? "flex" : "table-cell", justifyContent: isMobile ? "space-between" : "flex-end", alignItems: isMobile ? "center" : "center"}} data-label="Cijena">
                  {isMobile ? (
                    <>
                      <span>💵 CIJENA</span>
                      <span style={{fontWeight: 700, color: "#059669", fontSize: "17px"}}>{a.cijena.toFixed(2)} KM</span>
                    </>
                  ) : (
                    <span style={{fontWeight: 700, color: "#059669"}}>{a.cijena.toFixed(2)} KM</span>
                  )}
                </td>
                <td style={tdStyle} data-label="Početno stanje">
                  {a.pocetnoStanje}
                  {/* Ne prikazuj zagrade - ulaz ostaje vidljiv u input polju */}
                </td>
                <td style={tdStyle} data-label="Ulaz">
                  <input
                    key={`ulaz-${index}-${resetKey}`}
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={a.ulaz === 0 ? "" : a.ulaz}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handleUlazChange(index, parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                    style={{ ...inputStyle, opacity: (canEdit && !isUlazLocked) ? 1 : 0.5, cursor: (canEdit && !isUlazLocked) ? "text" : "not-allowed" }}
                    className="no-spin"
                    disabled={!canEdit || isUlazLocked}
                    readOnly={!canEdit || isUlazLocked}
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
                    step="any"
                    inputMode="decimal"
                    value={a.krajnjeStanje === 0 ? "" : a.krajnjeStanje}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handleKrajnjeStanjeChange(index, e.target.value)}
                    style={{ ...inputStyle, opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "text" : "not-allowed" }}
                    className="no-spin"
                    disabled={!canEdit}
                    readOnly={!canEdit}
                  />
                </td>
                <td style={{...tdStyle, display: isMobile ? "flex" : "table-cell", justifyContent: isMobile ? "space-between" : "flex-end", alignItems: isMobile ? "center" : "center"}} data-label="Vrijednost KM">
                  {isMobile ? (
                    <>
                      <span>💰 VRIJEDNOST KM</span>
                      <span style={{fontWeight: 700, color: "#78350f", fontSize: "18px"}}>{a.vrijednostKM.toFixed(2)} KM</span>
                    </>
                  ) : (
                    <span style={{fontWeight: 700, color: "#78350f"}}>{a.vrijednostKM.toFixed(2)} KM</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Rashodi */}
      <h2 style={{ fontSize: "18px", fontWeight: 500, color: "#1f2937", marginBottom: "16px", textAlign: isMobile ? "center" : "left" }}>
        Rashodi
      </h2>
      {isMobile ? (
        <div style={{ marginTop: "8px" }}>
          {rashodi.map((r, index) => (
            <div key={index} style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto",
              alignItems: "center",
              padding: "8px 12px",
              borderBottom: "1px solid #e5e7eb",
              fontSize: "14px",
              fontWeight: 500,
              background: index % 2 === 0 ? "#f9fafb" : "#fff",
              gap: "8px",
              minHeight: "36px",
              borderRadius: "4px",
              marginBottom: "2px",
              transition: "background-color 0.15s ease",
            }}>
              <span style={{
                color: "#1f2937",
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                justifySelf: "start",
                minWidth: 0,
                fontSize: "13px"
              }}>
                {r.naziv}
              </span>
              {inlineEditingRashodIndex === index ? (
                <input
                  type="number"
                  step="0.01"
                  value={rashodi[index].cijena}
                  onChange={(e) => {
                    const updatedRashodi = [...rashodi];
                    updatedRashodi[index].cijena = parseFloat(e.target.value) || 0;
                    setRashodi(updatedRashodi);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      saveInlineEditRashod(index, rashodi[index].cijena);
                    } else if (e.key === 'Escape') {
                      cancelInlineEditRashod();
                    }
                  }}
                  style={{
                    color: "#dc2626",
                    fontWeight: 700,
                    fontSize: "11px",
                    whiteSpace: "nowrap",
                    justifySelf: "end",
                    background: "#fef2f2",
                    padding: "1px 3px",
                    borderRadius: "3px",
                    border: "1px solid #fecaca",
                    width: "60px",
                    textAlign: "center"
                  }}
                  autoFocus
                />
              ) : (
                <span style={{
                  color: "#dc2626",
                  fontWeight: 700,
                  fontSize: "11px",
                  whiteSpace: "nowrap",
                  justifySelf: "end",
                  background: "#fef2f2",
                  padding: "1px 3px",
                  borderRadius: "3px",
                  border: "1px solid #fecaca"
                }}>
                  {r.cijena.toFixed(2)} KM
                </span>
              )}
              <div style={{
                display: "flex",
                gap: "2px",
                justifySelf: "end",
                alignItems: "center"
              }}>
                {inlineEditingRashodIndex === index ? (
                  <>
                    <button
                      style={{
                        background: "#10b981",
                        border: "none",
                        color: "white",
                        fontSize: "10px",
                        fontWeight: 600,
                        padding: "2px 4px",
                        cursor: "pointer",
                        borderRadius: "3px",
                        transition: "all 0.15s ease"
                      }}
                      onClick={() => saveInlineEditRashod(index, rashodi[index].cijena)}
                      disabled={!canEdit}
                    >
                      ✓ Sačuvaj
                    </button>
                    <button
                      style={{
                        background: "#6b7280",
                        border: "none",
                        color: "white",
                        fontSize: "10px",
                        fontWeight: 600,
                        padding: "2px 4px",
                        cursor: "pointer",
                        borderRadius: "3px",
                        transition: "all 0.15s ease"
                      }}
                      onClick={cancelInlineEditRashod}
                    >
                      ✕ Otkaži
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#f59e0b",
                        fontSize: "12px",
                        fontWeight: 600,
                        padding: "4px 6px",
                        cursor: "pointer",
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                        lineHeight: 1,
                        borderRadius: "4px",
                        transition: "all 0.15s ease",
                        display: "flex",
                        alignItems: "center",
                        gap: "2px"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#fef3c7";
                        e.currentTarget.style.color = "#d97706";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = "#f59e0b";
                      }}
                      onClick={() => startInlineEditRashod(index)}
                      disabled={!canEdit}
                    >
                      ✏️ Uredi
                    </button>
                    <button
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#dc2626",
                        fontSize: "12px",
                        fontWeight: 600,
                        padding: "4px 6px",
                        cursor: "pointer",
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                        lineHeight: 1,
                        borderRadius: "4px",
                        transition: "all 0.15s ease",
                        display: "flex",
                        alignItems: "center",
                        gap: "2px"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#fef2f2";
                        e.currentTarget.style.color = "#b91c1c";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = "#dc2626";
                      }}
                      onClick={() => handleDeleteRashod(index)}
                      disabled={!canEdit}
                    >
                      🗑️ Izbriši
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Naziv</th>
                <th style={{
                  ...thStyle,
                  paddingLeft: "25px"
                }}>Cijena</th>
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
                      <td style={{
                        ...tdStyle,
                        paddingLeft: "25px"
                      }}>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={editRashod.cijena === 0 ? "" : editRashod.cijena}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setEditRashod({ ...editRashod, cijena: Number(e.target.value) || 0 })}
                          style={{
                            ...rashodInputStyle,
                            width: "100%",
                            maxWidth: "160px",
                            opacity: canEdit ? 1 : 0.5,
                            cursor: canEdit ? "text" : "not-allowed"
                          }}
                          className="no-spin"
                          disabled={!canEdit}
                          readOnly={!canEdit}
                        />
                      </td>
                      <td style={tdStyle}>
                        <label
                          style={{
                            ...buttonStyle,
                            opacity: canEdit ? 1 : 0.5,
                            cursor: canEdit ? "pointer" : "not-allowed",
                            margin: "0 4px 4px 0",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "4px",
                            fontSize: "12px",
                            padding: "6px 10px"
                          }}
                        >
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setEditRashodImage(file);
                              e.target.value = "";
                            }}
                            style={{ display: "none" }}
                            disabled={!canEdit}
                          />
                          📸 {editRashodImage ? editRashodImage.name.substring(0, 10) + "..." : editRashod.imageUrl ? "Promijeni" : "Dodaj"}
                        </label>
                        {editRashodImage && (
                          <button
                            style={{
                              padding: "4px 8px",
                              background: "#dc2626",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "12px",
                              marginLeft: "4px"
                            }}
                            onClick={() => setEditRashodImage(null)}
                            disabled={!canEdit}
                          >
                            ✕
                          </button>
                        )}
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
                      <td style={{
                        ...tdStyle,
                        paddingLeft: "25px"
                      }}>{r.cijena.toFixed(2)}</td>
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
                          Obriši
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isMobile ? (
        // Mobilna verzija - Card layout
        <div style={{
          background: "#ffffff",
          padding: "16px",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          marginTop: "20px"
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#374151", marginBottom: "6px", fontWeight: 500 }}>
                Naziv rashoda
              </label>
              <input
                type="text"
                placeholder="Naziv rashoda"
                value={newRashod.naziv}
                onChange={(e) => setNewRashod({ ...newRashod, naziv: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                  opacity: canEdit ? 1 : 0.5,
                  cursor: canEdit ? "text" : "not-allowed"
                }}
                disabled={!canEdit}
                readOnly={!canEdit}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#374151", marginBottom: "6px", fontWeight: 500 }}>
                Cijena
              </label>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Cijena"
                value={newRashod.cijena === 0 ? "" : newRashod.cijena}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setNewRashod({ ...newRashod, cijena: Number(e.target.value) || 0 })}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                  opacity: canEdit ? 1 : 0.5,
                  cursor: canEdit ? "text" : "not-allowed"
                }}
                className="no-spin"
                disabled={!canEdit}
                readOnly={!canEdit}
              />
            </div>
          </div>
          {newRashodImage && (
            <div style={{ marginBottom: "12px", padding: "8px 12px", background: "#f3f4f6", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "14px", color: "#374151" }}>{newRashodImage.name}</span>
              <button
                style={{
                  padding: "4px 8px",
                  background: "#dc2626",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                  opacity: canEdit ? 1 : 0.5
                }}
                onClick={() => setNewRashodImage(null)}
                disabled={!canEdit}
              >
                ✕
              </button>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <button 
              style={{
                ...buttonStyle,
                width: "100%",
                opacity: canEdit ? 1 : 0.5,
                cursor: canEdit ? "pointer" : "not-allowed",
                background: "#dc2626",
                justifyContent: "center",
                boxSizing: "border-box"
              }}
              onMouseEnter={(e) => {
                if (canEdit) {
                  e.currentTarget.style.background = "#b91c1c";
                }
              }}
              onMouseLeave={(e) => {
                if (canEdit) {
                  e.currentTarget.style.background = "#dc2626";
                }
              }}
              onClick={handleAddRashod}
              disabled={!canEdit}
            >
              Dodaj rashod
            </button>
            <label
              style={{
                ...buttonStyle,
                width: "100%",
                opacity: canEdit ? 1 : 0.5,
                cursor: canEdit ? "pointer" : "not-allowed",
                marginTop: 0,
                marginLeft: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                background: "#6b7280",
                boxSizing: "border-box"
              }}
              onMouseEnter={(e) => {
                if (canEdit) {
                  e.currentTarget.style.background = "#4b5563";
                }
              }}
              onMouseLeave={(e) => {
                if (canEdit) {
                  e.currentTarget.style.background = "#6b7280";
                }
              }}
            >
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setNewRashodImage(file);
                  e.target.value = "";
                }}
                style={{ display: "none" }}
                disabled={!canEdit}
              />
              📸 {newRashodImage ? newRashodImage.name.substring(0, 10) + "..." : "Dodaj sliku"}
            </label>
          </div>
        </div>
      ) : (
        // Desktop verzija - Flex layout
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
            inputMode="numeric"
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
            style={{
              ...buttonStyle,
              flex: "1 1 auto",
              minWidth: "160px",
              maxWidth: "160px",
              opacity: canEdit ? 1 : 0.5,
              cursor: canEdit ? "pointer" : "not-allowed",
              background: "#dc2626",
              marginTop: 0,
              marginLeft: 0,
              marginRight: 0,
              marginBottom: 0
            }}
            onMouseEnter={(e) => {
              if (canEdit) {
                e.currentTarget.style.background = "#b91c1c";
              }
            }}
            onMouseLeave={(e) => {
              if (canEdit) {
                e.currentTarget.style.background = "#dc2626";
              }
            }}
            onClick={handleAddRashod}
            disabled={!canEdit}
          >
            Dodaj rashod
          </button>
          <label
            style={{
              ...buttonStyle,
              flex: "1 1 auto",
              minWidth: "160px",
              maxWidth: "160px",
              opacity: canEdit ? 1 : 0.5,
              cursor: canEdit ? "pointer" : "not-allowed",
              marginTop: 0,
              marginLeft: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              background: "#6b7280",
              marginRight: 0,
              marginBottom: 0
            }}
            onMouseEnter={(e) => {
              if (canEdit) {
                e.currentTarget.style.background = "#4b5563";
              }
            }}
            onMouseLeave={(e) => {
              if (canEdit) {
                e.currentTarget.style.background = "#6b7280";
              }
            }}
          >
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setNewRashodImage(file);
                e.target.value = "";
              }}
              style={{ display: "none" }}
              disabled={!canEdit}
            />
            📸 {newRashodImage ? newRashodImage.name.substring(0, 15) + (newRashodImage.name.length > 15 ? "..." : "") : "Dodaj sliku"}
          </label>
          {newRashodImage && (
            <button
              style={{
                padding: "8px 12px",
                background: "#dc2626",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                opacity: canEdit ? 1 : 0.5
              }}
              onClick={() => setNewRashodImage(null)}
              disabled={!canEdit}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Prihodi */}
      <h2 style={{ fontSize: "18px", fontWeight: 500, color: "#1f2937", marginBottom: "16px", textAlign: isMobile ? "center" : "left" }}>
        Prihodi
      </h2>
      {isMobile ? (
        <div style={{ marginTop: "8px" }}>
          {prihodi.map((p, index) => (
            <div key={index} style={{
              display: "grid",
              gridTemplateColumns: "1fr auto auto",
              alignItems: "center",
              padding: "8px 12px",
              borderBottom: "1px solid #e5e7eb",
              fontSize: "14px",
              fontWeight: 500,
              background: index % 2 === 0 ? "#f9fafb" : "#fff",
              gap: "8px",
              minHeight: "36px",
              borderRadius: "4px",
              marginBottom: "2px",
              transition: "background-color 0.15s ease",
            }}>
              <span style={{
                color: "#1f2937",
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                justifySelf: "start",
                minWidth: 0,
                fontSize: "13px"
              }}>
                {p.naziv}
              </span>
              <span style={{
                color: "#9333ea",
                fontWeight: 700,
                fontSize: "11px",
                whiteSpace: "nowrap",
                justifySelf: "end",
                background: "#faf5ff",
                padding: "1px 3px",
                borderRadius: "3px",
                border: "1px solid #e9d5ff"
              }}>
                {p.cijena.toFixed(2)} KM
              </span>
              <div style={{
                display: "flex",
                gap: "2px",
                justifySelf: "end",
                alignItems: "center"
              }}>
                <button
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#dc2626",
                    fontSize: "12px",
                    fontWeight: 600,
                    padding: "4px 6px",
                    cursor: "pointer",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                    lineHeight: 1,
                    borderRadius: "4px",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "2px"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#fef2f2";
                    e.currentTarget.style.color = "#b91c1c";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#dc2626";
                  }}
                  onClick={() => handleDeletePrihod(index)}
                  disabled={!canEdit}
                >
                  🗑️ Izbriši
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Naziv</th>
                <th style={{
                  ...thStyle,
                  paddingLeft: "25px"
                }}>Cijena</th>
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
                      <td style={{
                        ...tdStyle,
                        paddingLeft: "25px"
                      }}>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={editPrihod.cijena === 0 ? "" : editPrihod.cijena}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => setEditPrihod({ ...editPrihod, cijena: Number(e.target.value) || 0 })}
                          style={{
                            ...rashodInputStyle,
                            width: "100%",
                            maxWidth: "160px",
                            opacity: canEdit ? 1 : 0.5,
                            cursor: canEdit ? "text" : "not-allowed"
                          }}
                          className="no-spin"
                          disabled={!canEdit}
                          readOnly={!canEdit}
                        />
                      </td>
                      <td style={tdStyle}>
                        <label
                          style={{
                            ...buttonStyle,
                            opacity: canEdit ? 1 : 0.5,
                            cursor: canEdit ? "pointer" : "not-allowed",
                            margin: "0 4px 4px 0",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "4px",
                            fontSize: "12px",
                            padding: "6px 10px"
                          }}
                        >
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setEditPrihodImage(file);
                              e.target.value = "";
                            }}
                            style={{ display: "none" }}
                            disabled={!canEdit}
                          />
                          📸 {editPrihodImage ? editPrihodImage.name.substring(0, 10) + "..." : editPrihod.imageUrl ? "Promijeni" : "Dodaj"}
                        </label>
                        {editPrihodImage && (
                          <button
                            style={{
                              padding: "4px 8px",
                              background: "#dc2626",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "12px",
                              marginLeft: "4px"
                            }}
                            onClick={() => setEditPrihodImage(null)}
                            disabled={!canEdit}
                          >
                            ✕
                          </button>
                        )}
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
                      <td style={{
                        ...tdStyle,
                        paddingLeft: "25px"
                      }}>{p.cijena.toFixed(2)}</td>
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
                          Obriši
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isMobile ? (
        // Mobilna verzija - Card layout
        <div style={{
          background: "#ffffff",
          padding: "16px",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          marginTop: "20px"
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#374151", marginBottom: "6px", fontWeight: 500 }}>
                Naziv prihoda
              </label>
              <input
                type="text"
                placeholder="Naziv prihoda"
                value={newPrihod.naziv}
                onChange={(e) => setNewPrihod({ ...newPrihod, naziv: e.target.value })}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                  opacity: canEdit ? 1 : 0.5,
                  cursor: canEdit ? "text" : "not-allowed"
                }}
                disabled={!canEdit}
                readOnly={!canEdit}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#374151", marginBottom: "6px", fontWeight: 500 }}>
                Cijena
              </label>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Cijena"
                value={newPrihod.cijena === 0 ? "" : newPrihod.cijena}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setNewPrihod({ ...newPrihod, cijena: Number(e.target.value) || 0 })}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box",
                  opacity: canEdit ? 1 : 0.5,
                  cursor: canEdit ? "text" : "not-allowed"
                }}
                className="no-spin"
                disabled={!canEdit}
                readOnly={!canEdit}
              />
            </div>
          </div>
          {newPrihodImage && (
            <div style={{ marginBottom: "12px", padding: "8px 12px", background: "#f3f4f6", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "14px", color: "#374151" }}>{newPrihodImage.name}</span>
              <button
                style={{
                  padding: "4px 8px",
                  background: "#dc2626",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                  opacity: canEdit ? 1 : 0.5
                }}
                onClick={() => setNewPrihodImage(null)}
                disabled={!canEdit}
              >
                ✕
              </button>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <button 
              style={{
                ...buttonStyle,
                width: "100%",
                opacity: canEdit ? 1 : 0.5,
                cursor: canEdit ? "pointer" : "not-allowed",
                background: "#16a34a",
                justifyContent: "center",
                boxSizing: "border-box",
                marginRight: 0,
                marginBottom: 0
              }}
              onMouseEnter={(e) => {
                if (canEdit) {
                  e.currentTarget.style.background = "#15803d";
                }
              }}
              onMouseLeave={(e) => {
                if (canEdit) {
                  e.currentTarget.style.background = "#16a34a";
                }
              }}
              onClick={handleAddPrihod}
              disabled={!canEdit}
            >
              Dodaj prihod
            </button>
            <label
              style={{
                ...buttonStyle,
                width: "100%",
                opacity: canEdit ? 1 : 0.5,
                cursor: canEdit ? "pointer" : "not-allowed",
                marginTop: 0,
                marginLeft: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                background: "#6b7280",
                boxSizing: "border-box",
                marginRight: 0,
                marginBottom: 0
              }}
              onMouseEnter={(e) => {
                if (canEdit) {
                  e.currentTarget.style.background = "#4b5563";
                }
              }}
              onMouseLeave={(e) => {
                if (canEdit) {
                  e.currentTarget.style.background = "#6b7280";
                }
              }}
            >
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setNewPrihodImage(file);
                  e.target.value = "";
                }}
                style={{ display: "none" }}
                disabled={!canEdit}
              />
              📸 {newPrihodImage ? newPrihodImage.name.substring(0, 10) + "..." : "Dodaj sliku"}
            </label>
          </div>
        </div>
      ) : (
        // Desktop verzija - Flex layout
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
            inputMode="numeric"
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
            style={{
              ...buttonStyle,
              flex: "1 1 auto",
              minWidth: "160px",
              maxWidth: "160px",
              opacity: canEdit ? 1 : 0.5,
              cursor: canEdit ? "pointer" : "not-allowed",
              background: "#16a34a",
              marginTop: 0,
              marginLeft: 0,
              marginRight: 0,
              marginBottom: 0
            }}
            onMouseEnter={(e) => {
              if (canEdit) {
                e.currentTarget.style.background = "#15803d";
              }
            }}
            onMouseLeave={(e) => {
              if (canEdit) {
                e.currentTarget.style.background = "#16a34a";
              }
            }}
            onClick={handleAddPrihod}
            disabled={!canEdit}
          >
            Dodaj prihod
          </button>
          <label
            style={{
              ...buttonStyle,
              flex: "1 1 auto",
              minWidth: "160px",
              maxWidth: "160px",
              opacity: canEdit ? 1 : 0.5,
              cursor: canEdit ? "pointer" : "not-allowed",
              marginTop: 0,
              marginLeft: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              background: "#6b7280",
              marginRight: 0,
              marginBottom: 0
            }}
            onMouseEnter={(e) => {
              if (canEdit) {
                e.currentTarget.style.background = "#4b5563";
              }
            }}
            onMouseLeave={(e) => {
              if (canEdit) {
                e.currentTarget.style.background = "#6b7280";
              }
            }}
          >
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setNewPrihodImage(file);
                e.target.value = "";
              }}
              style={{ display: "none" }}
              disabled={!canEdit}
            />
            📸 {newPrihodImage ? newPrihodImage.name.substring(0, 15) + (newPrihodImage.name.length > 15 ? "..." : "") : "Dodaj sliku"}
          </label>
          {newPrihodImage && (
            <button
              style={{
                padding: "8px 12px",
                background: "#dc2626",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                opacity: canEdit ? 1 : 0.5
              }}
              onClick={() => setNewPrihodImage(null)}
              disabled={!canEdit}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Sažetak ukupno - moderni blokovi */}
      <div style={{ marginTop: "24px" }}>
        <div
          style={{
            background: "#fff",
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            padding: isMobile ? "20px 16px" : "32px",
          }}
        >
          <h2 style={{ fontSize: isMobile ? "16px" : "20px", fontWeight: 700, color: "#1f2937", marginBottom: "16px" }}>
            Sažetak obračuna
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
              gap: isMobile ? "12px" : "20px",
            }}
          >
            <div
              style={{
                padding: isMobile ? "14px" : "20px",
                background: "#eff6ff",
                borderRadius: "8px",
                border: "1px solid #bfdbfe",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: isMobile ? "11px" : "13px", color: "#1d4ed8", fontWeight: 600, marginBottom: "4px" }}>
                Ukupno Prihod
              </div>
              <div style={{ fontSize: isMobile ? "18px" : "24px", fontWeight: 700, color: "#1e40af" }}>
                {ukupnoPrihod.toFixed(2)} KM
              </div>
            </div>

            <div
              style={{
                padding: isMobile ? "14px" : "20px",
                background: "#fef2f2",
                borderRadius: "8px",
                border: "1px solid #fecaca",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: isMobile ? "11px" : "13px", color: "#b91c1c", fontWeight: 600, marginBottom: "4px" }}>
                Ukupno Rashod
              </div>
              <div style={{ fontSize: isMobile ? "18px" : "24px", fontWeight: 700, color: "#991b1b" }}>
                {ukupnoRashod.toFixed(2)} KM
              </div>
            </div>

            <div
              style={{
                padding: isMobile ? "14px" : "20px",
                background: "#f0fdf4",
                borderRadius: "8px",
                border: "1px solid #86efac",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: isMobile ? "11px" : "13px", color: "#166534", fontWeight: 600, marginBottom: "4px" }}>
                Ukupno Artikli
              </div>
              <div style={{ fontSize: isMobile ? "18px" : "24px", fontWeight: 700, color: "#14532d" }}>
                {ukupnoArtikli.toFixed(2)} KM
              </div>
            </div>

            <div
              style={{
                gridColumn: isMobile ? "span 2" : "span 1",
                padding: isMobile ? "14px" : "20px",
                background: neto >= 0 ? "#f0fdf4" : "#fef2f2",
                borderRadius: "8px",
                border: `2px solid ${neto >= 0 ? "#22c55e" : "#ef4444"}`,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: isMobile ? "11px" : "13px",
                  color: neto >= 0 ? "#15803d" : "#dc2626",
                  fontWeight: 700,
                  marginBottom: "4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Neto
              </div>
              <div style={{ fontSize: isMobile ? "22px" : "28px", fontWeight: 800, color: neto >= 0 ? "#15803d" : "#dc2626" }}>
                {neto.toFixed(2)} KM
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "32px", marginBottom: "24px", paddingBottom: "16px", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <button
          style={{ ...saveButtonStyle, opacity: canEdit ? 1 : 0.5, cursor: canEdit ? "pointer" : "not-allowed", maxWidth: "300px", width: "100%" }}
          onClick={handleSaveObracun}
          className="save-button"
          disabled={!canEdit || uploadingImages}
        >
          {uploadingImages ? `Upload slika... ${Math.round(uploadProgress)}%` : "Završi obračun"}
        </button>
      </div>
      {/* PIN Modal for unlocking ulaz */}
      {showPinModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.3)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 32, minWidth: 320, boxShadow: '0 2px 16px #0002', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Unesite PIN za otključavanje ulaza</h3>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              autoFocus
              value={enteredPin}
              onChange={e => setEnteredPin(e.target.value.replace(/[^0-9]/g, ""))}
              style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center', padding: 8, border: '1px solid #ddd', borderRadius: 6, marginBottom: 12, width: 120 }}
            />
            {pinError && <div style={{ color: '#dc2626', marginBottom: 8 }}>{pinError}</div>}
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={{ background: '#3b82f6', color: 'white', padding: '8px 20px', borderRadius: 6, border: 'none', fontWeight: 600 }} onClick={handleConfirmPin}>Potvrdi</button>
              <button style={{ background: '#6b7280', color: 'white', padding: '8px 20px', borderRadius: 6, border: 'none', fontWeight: 600 }} onClick={() => setShowPinModal(false)}>Otkaži</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}