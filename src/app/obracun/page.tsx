"use client";

import React, { useState, useEffect } from "react";
import { useCjenovnik } from "../context/CjenovnikContext";
import { auth } from "../../lib/firebase";
import { db } from "../../lib/firestore";
import { doc, setDoc, getDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";

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

  // Inicijalizacija artikala na osnovu cjenovnika
  useEffect(() => {
    const inicijalniArtikli = cjenovnik.map((item) => ({
      naziv: item.naziv,
      cijena: item.cijena,
      pocetnoStanje: item.naziv.toLowerCase().includes("kafa") ? 0 : item.pocetnoStanje,
      ulaz: item.naziv.toLowerCase().includes("kafa") ? 0 : 0,
      ukupno: item.naziv.toLowerCase().includes("kafa") ? 0 : item.pocetnoStanje,
      utroseno: 0,
      krajnjeStanje: 0,
      vrijednostKM: 0,
      zestokoKolicina: item.zestokoKolicina,
      proizvodnaCijena: item.proizvodnaCijena,
      isKrajnjeSet: false,
      staroPocetnoStanje: undefined,
      sačuvanUlaz: undefined,
    }));
    setArtikli(inicijalniArtikli);
    setIsAzuriran(false); // Resetiraj flag pri inicijalizaciji
  }, [cjenovnik]);

  const formatirajDatum = (datum: Date): string => {
    const dan = datum.getDate().toString().padStart(2, "0");
    const mjesec = (datum.getMonth() + 1).toString().padStart(2, "0");
    const godina = datum.getFullYear();
    return `${dan}.${mjesec}.${godina}.`;
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
    setArtikli((prev) =>
      prev.map((a, i) =>
        i === index
          ? {
              ...a,
              ulaz: value,
              ukupno: a.pocetnoStanje + value,
              ...(a.krajnjeStanje > 0
                ? {
                    utroseno: a.pocetnoStanje + value - a.krajnjeStanje,
                    vrijednostKM: a.zestokoKolicina
                      ? ((a.pocetnoStanje + value - a.krajnjeStanje) / a.zestokoKolicina) * a.cijena
                      : (a.pocetnoStanje + value - a.krajnjeStanje) * a.cijena,
                  }
                : {}),
            }
          : a
      )
    );
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
  const handleAzurirajObracun = () => {
    // Provjeri da li ima artikala s ulazom
    const imaUlaz = artikli.some((a) => a.ulaz > 0);
    if (!imaUlaz) {
      alert("Nema artikala s ulazom za ažuriranje!");
      return;
    }

    const datumString = formatirajDatum(trenutniDatum);

    // Sačuvaj ulaz u localStorage cache po datumu
    const ulazCache: { [naziv: string]: { ulaz: number; staroPocetnoStanje: number } } = {};
    artikli.forEach((a) => {
      if (a.ulaz > 0) {
        ulazCache[a.naziv] = {
          ulaz: a.ulaz,
          staroPocetnoStanje: a.staroPocetnoStanje ?? a.pocetnoStanje,
        };
      }
    });

    // Spremi cache u localStorage
    const cacheKey = `ulazCache_${datumString}`;
    localStorage.setItem(cacheKey, JSON.stringify(ulazCache));

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

    // Ažuriraj artikle u formi - postavi novo početno stanje i resetiraj ulaz
    setArtikli((prev) =>
      prev.map((a) => {
        if (a.ulaz > 0) {
          const staroPocetnoStanje = a.staroPocetnoStanje ?? a.pocetnoStanje;
          const sačuvanUlaz = a.ulaz; // Sačuvaj ulaz prije resetiranja
          const novoPocetnoStanje = a.naziv.toLowerCase().includes("kafa")
            ? 0
            : a.pocetnoStanje + a.ulaz;
          
          return {
            ...a,
            pocetnoStanje: novoPocetnoStanje,
            ulaz: 0,
            ukupno: novoPocetnoStanje,
            staroPocetnoStanje: staroPocetnoStanje, // Sačuvaj staro stanje
            sačuvanUlaz: sačuvanUlaz, // Sačuvaj ulaz za prikaz u arhivi
          };
        }
        return a;
      })
    );

    setIsAzuriran(true); // Označi da je obračun bio ažuriran
    alert("Obračun ažuriran! Početno stanje artikala je ažurirano.");
  };

  // Čuvanje obračuna (localStorage + opcionalno Firestore)
  const handleSaveObracun = async () => {
    const ukupnoArtikli = artikli.reduce((sum, a) => sum + a.vrijednostKM, 0);
    const ukupnoRashod = rashodi.reduce((sum, r) => sum + r.cijena, 0);
    const ukupnoPrihod = prihodi.reduce((sum, p) => sum + p.cijena, 0);
    const neto = ukupnoArtikli + ukupnoPrihod - ukupnoRashod;
    const datumString = formatirajDatum(trenutniDatum);

    // Učitaj cache ulaza za ovaj datum
    const cacheKey = `ulazCache_${datumString}`;
    const cachedUlaz = localStorage.getItem(cacheKey);
    let ulazCache: { [naziv: string]: { ulaz: number; staroPocetnoStanje: number } } = {};
    if (cachedUlaz) {
      try {
        ulazCache = JSON.parse(cachedUlaz);
      } catch (e) {
        console.warn("Greška pri čitanju cache-a ulaza:", e);
      }
    }

    // Provjeri da li obračun ima ulaz (trenutni, sačuvani u state-u, ili iz cache-a)
    const imaUlaz = artikli.some((a) => {
      const trenutniUlaz = a.ulaz > 0;
      const sačuvanUlaz = a.sačuvanUlaz !== undefined && a.sačuvanUlaz > 0;
      const cachedUlazZaArtikal = ulazCache[a.naziv]?.ulaz > 0;
      return trenutniUlaz || sačuvanUlaz || cachedUlazZaArtikal;
    });

    const arhiviraniObracun: ArhiviraniObracun = {
      datum: datumString,
      ukupnoArtikli,
      ukupnoRashod,
      ukupnoPrihod,
      neto,
      artikli: artikli.map((a) => {
        // Prioritet: 1. trenutni ulaz, 2. sačuvani ulaz u state-u, 3. ulaz iz cache-a
        let ulazZaPrikaz = a.ulaz;
        let staroPocetnoStanjeZaPrikaz = a.staroPocetnoStanje;

        if (a.ulaz === 0) {
          if (a.sačuvanUlaz !== undefined && a.sačuvanUlaz > 0) {
            ulazZaPrikaz = a.sačuvanUlaz;
            staroPocetnoStanjeZaPrikaz = a.staroPocetnoStanje;
          } else if (ulazCache[a.naziv]) {
            ulazZaPrikaz = ulazCache[a.naziv].ulaz;
            staroPocetnoStanjeZaPrikaz = ulazCache[a.naziv].staroPocetnoStanje;
          }
        }
        
        return {
          naziv: a.naziv,
          cijena: a.cijena,
          pocetnoStanje: a.pocetnoStanje,
          ulaz: ulazZaPrikaz, // Sačuvaj ulaz za prikaz u arhivi
          ukupno: a.ukupno,
          utroseno: a.utroseno,
          krajnjeStanje: a.krajnjeStanje,
          vrijednostKM: a.vrijednostKM,
          zestokoKolicina: a.zestokoKolicina,
          proizvodnaCijena: a.proizvodnaCijena,
          staroPocetnoStanje: staroPocetnoStanjeZaPrikaz, // Sačuvaj staro stanje ako postoji
          sačuvanUlaz: ulazZaPrikaz, // Sačuvaj ulaz
        };
      }),
      rashodi,
      prihodi,
      isAzuriran: isAzuriran, // Sačuvaj flag da je obračun bio ažuriran
      imaUlaz: imaUlaz, // Sačuvaj flag da obračun ima ulaz
    };

    // Obriši cache nakon što se obračun spremi
    localStorage.removeItem(cacheKey);

    const user = auth.currentUser;
    const userId = user?.uid;

    // HIBRIDNI PRISTUP: Prvo Firestore (primarno), zatim localStorage (cache/offline)
    try {
      // 1. SPREMI U FIRESTORE (primarni izvor - ako postoji korisnik)
      if (user && userId) {
        try {
          const docRef = doc(db, "users", userId, "obracuni", datumString);
          await setDoc(docRef, {
            ...arhiviraniObracun,
            savedAt: serverTimestamp(),
          });
          console.log("Obračun sačuvan u Firestore:", datumString);
        } catch (firestoreError: any) {
          // Ignoriraj greške dozvola - spremit ćemo u localStorage
          const errorCode = firestoreError?.code || "";
          if (errorCode !== "permission-denied" && !errorCode.includes("permission") && !errorCode.includes("insufficient")) {
            console.warn("Nije moguće sačuvati u Firestore (možda nema interneta):", firestoreError);
          }
        }
      }

      // 2. SPREMI U LOCALSTORAGE (cache/offline backup - per-user)
      if (userId) {
        // User-specific localStorage ključ
        const storageKey = `arhivaObracuna_${userId}`;
        const savedArhiva = localStorage.getItem(storageKey);
        let arhiva: ArhiviraniObracun[] = savedArhiva ? JSON.parse(savedArhiva) : [];
        
        // Ukloni postojeći obračun za isti datum ako postoji
        arhiva = arhiva.filter((item) => item.datum !== datumString);
        
        // Dodaj novi obračun
        arhiva.push(arhiviraniObracun);
        
        // Sortiraj po datumu (najnoviji prvo)
        arhiva.sort((a, b) => {
          const dateA = new Date(a.datum.split(".").reverse().join("-")).getTime();
          const dateB = new Date(b.datum.split(".").reverse().join("-")).getTime();
          return dateB - dateA;
        });
        
        localStorage.setItem(storageKey, JSON.stringify(arhiva));
        console.log("Obračun sačuvan u localStorage (per-user):", datumString);
      } else {
        // Fallback: ako nema korisnika, koristi stari ključ (za migraciju)
        const savedArhiva = localStorage.getItem("arhivaObracuna");
        let arhiva: ArhiviraniObracun[] = savedArhiva ? JSON.parse(savedArhiva) : [];
        arhiva = arhiva.filter((item) => item.datum !== datumString);
        arhiva.push(arhiviraniObracun);
        arhiva.sort((a, b) => {
          const dateA = new Date(a.datum.split(".").reverse().join("-")).getTime();
          const dateB = new Date(b.datum.split(".").reverse().join("-")).getTime();
          return dateB - dateA;
        });
        localStorage.setItem("arhivaObracuna", JSON.stringify(arhiva));
        console.log("Obračun sačuvan u localStorage (fallback):", datumString);
      }

      // Ažuriranje cjenovnika (početno stanje za sljedeći dan)
      setCjenovnik((prev) =>
        prev.map((item) => {
          const artikal = artikli.find((a) => a.naziv === item.naziv);
          if (!artikal) return item;
          const novoPocetnoStanje = artikal.naziv.toLowerCase().includes("kafa")
            ? 0
            : artikal.isKrajnjeSet
            ? artikal.krajnjeStanje
            : artikal.ukupno;
          return {
            ...item,
            pocetnoStanje: novoPocetnoStanje,
          };
        })
      );

      // Povećaj datum za jedan dan
      const noviDatum = new Date(trenutniDatum);
      noviDatum.setDate(noviDatum.getDate() + 1);
      setTrenutniDatum(noviDatum);

      // Resetiraj formu
      setArtikli((prev) =>
        prev.map((a) => {
          if (a.naziv.toLowerCase().includes("kafa")) {
            return {
              ...a,
              pocetnoStanje: 0,
              ulaz: 0,
              ukupno: 0,
              utroseno: 0,
              krajnjeStanje: 0,
              vrijednostKM: 0,
              isKrajnjeSet: false,
              sačuvanUlaz: undefined,
              staroPocetnoStanje: undefined,
            };
          } else {
            const novoPocetnoStanje = a.isKrajnjeSet ? a.krajnjeStanje : a.ukupno;
            return {
              ...a,
              pocetnoStanje: novoPocetnoStanje,
              ulaz: 0,
              ukupno: novoPocetnoStanje,
              utroseno: 0,
              krajnjeStanje: 0,
              vrijednostKM: 0,
              isKrajnjeSet: false,
              sačuvanUlaz: undefined,
              staroPocetnoStanje: undefined,
            };
          }
        })
      );

      setRashodi([]);
      setPrihodi([]);
      setNewRashod({ naziv: "", cijena: 0 });
      setNewPrihod({ naziv: "", cijena: 0 });
      setEditRashodIndex(null);
      setEditPrihodIndex(null);
      setIsAzuriran(false); // Resetiraj flag nakon spremanja
      
      // Resetiraj sačuvane ulaze u artiklima
      setArtikli((prev) =>
        prev.map((a) => ({
          ...a,
          sačuvanUlaz: undefined,
        }))
      );

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
          style={{ ...buttonStyle, background: "#f59e0b", maxWidth: "160px" }} 
          onClick={handleAzurirajObracun}
        >
          Ažuriraj obračun
        </button>
        <button style={saveButtonStyle} onClick={handleSaveObracun} className="save-button">
          Sačuvaj obračun
        </button>
        {isAzuriran && (
          <span style={{ fontSize: "14px", color: "#f59e0b", fontWeight: 500, marginLeft: "8px" }}>
            (Ažurirano)
          </span>
        )}
      </div>

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
            // Funkcija za određivanje boje na osnovu početnog stanja
            const getRowStyle = (): React.CSSProperties => {
              // Kafa je posebna - ne primjenjuj boje
              if (a.naziv.toLowerCase() === "kafa" || a.naziv.toLowerCase() === "kava") {
                return {};
              }
              
              // Za žestoka pića (ima zestokoKolicina)
              if (a.zestokoKolicina && a.zestokoKolicina > 0) {
                // Za žestoka pića, pocetnoStanje je već u litrama (npr. 5 = 5 litara)
                // Koristimo ukupno (pocetnoStanje + ulaz) jer uključuje i ulaz
                const kolicinaULitrama = a.ukupno;
                
                // Ispod 1L = crvena, 1L do 2L (uključujući 2L) = žuta, preko 2L = normalna
                if (kolicinaULitrama < 1) {
                  return lowStockRedStyle;
                } else if (kolicinaULitrama <= 2) {
                  return lowStockYellowStyle;
                }
              } else {
                // Za obične artikle - provjeri početno stanje
                // Prvo provjeri crvenu (nižu granicu), pa žutu (višu granicu)
                if (a.pocetnoStanje < 15) {
                  return lowStockRedStyle;
                } else if (a.pocetnoStanje < 30) {
                  return lowStockYellowStyle;
                }
              }
              
              return {};
            };

            const rowStyle = getRowStyle();
            
            return (
              <tr key={index} style={rowStyle}>
                <td style={tdStyle} data-label="Artikal">{a.naziv}</td>
                <td style={tdStyle} data-label="Cijena">{a.cijena.toFixed(2)}</td>
                <td style={tdStyle} data-label="Zestoko Količina (ml)">{a.zestokoKolicina ? a.zestokoKolicina.toFixed(3) : "-"}</td>
                <td style={tdStyle} data-label="Proizvodna Cijena">{a.proizvodnaCijena ? a.proizvodnaCijena.toFixed(2) : "-"}</td>
                <td style={tdStyle} data-label="Početno stanje">{a.pocetnoStanje}</td>
                <td style={tdStyle} data-label="Ulaz">
                  <input
                    type="number"
                    value={a.ulaz === 0 ? "" : a.ulaz}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handleUlazChange(index, Number(e.target.value) || 0)}
                    style={inputStyle}
                    className="no-spin"
                  />
                </td>
                <td style={tdStyle} data-label="Ukupno">{a.ukupno}</td>
                <td style={tdStyle} data-label="Utrošeno">{a.utroseno}</td>
                <td style={tdStyle} data-label="Krajnje stanje">
                  <input
                    type="number"
                    value={a.krajnjeStanje === 0 ? "" : a.krajnjeStanje}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => handleKrajnjeStanjeChange(index, e.target.value)}
                    style={inputStyle}
                    className="no-spin"
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
                        style={rashodInputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="number"
                        value={editRashod.cijena === 0 ? "" : editRashod.cijena}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setEditRashod({ ...editRashod, cijena: Number(e.target.value) || 0 })}
                        style={rashodInputStyle}
                        className="no-spin"
                      />
                    </td>
                    <td style={tdStyle}>
                      <button style={buttonStyle} onClick={handleSaveEditRashod}>
                        Spremi
                      </button>
                      <button style={cancelButtonStyle} onClick={handleCancelEditRashod} className="cancel-button">
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
                        style={editButtonStyle}
                        onClick={() => handleEditRashod(index)}
                        className="edit-button"
                      >
                        Uredi
                      </button>
                      <button
                        style={deleteButtonStyle}
                        onClick={() => handleDeleteRashod(index)}
                        className="delete-button"
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
          style={{...rashodInputStyle, flex: "1 1 auto", minWidth: "120px"}}
        />
        <input
          type="number"
          placeholder="Cijena"
          value={newRashod.cijena === 0 ? "" : newRashod.cijena}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setNewRashod({ ...newRashod, cijena: Number(e.target.value) || 0 })}
          style={{...rashodInputStyle, flex: "1 1 auto", minWidth: "120px"}}
          className="no-spin"
        />
        <button style={{...buttonStyle, flex: "1 1 auto", minWidth: "140px"}} onClick={handleAddRashod}>
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
                        style={rashodInputStyle}
                      />
                    </td>
                    <td style={tdStyle}>
                      <input
                        type="number"
                        value={editPrihod.cijena === 0 ? "" : editPrihod.cijena}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setEditPrihod({ ...editPrihod, cijena: Number(e.target.value) || 0 })}
                        style={rashodInputStyle}
                        className="no-spin"
                      />
                    </td>
                    <td style={tdStyle}>
                      <button style={buttonStyle} onClick={handleSaveEditPrihod}>
                        Spremi
                      </button>
                      <button style={cancelButtonStyle} onClick={handleCancelEditPrihod} className="cancel-button">
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
                        style={editButtonStyle}
                        onClick={() => handleEditPrihod(index)}
                        className="edit-button"
                      >
                        Uredi
                      </button>
                      <button
                        style={deleteButtonStyle}
                        onClick={() => handleDeletePrihod(index)}
                        className="delete-button"
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
          style={{...rashodInputStyle, flex: "1 1 auto", minWidth: "120px"}}
        />
        <input
          type="number"
          placeholder="Cijena"
          value={newPrihod.cijena === 0 ? "" : newPrihod.cijena}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setNewPrihod({ ...newPrihod, cijena: Number(e.target.value) || 0 })}
          style={{...rashodInputStyle, flex: "1 1 auto", minWidth: "120px"}}
          className="no-spin"
        />
        <button style={{...buttonStyle, flex: "1 1 auto", minWidth: "140px"}} onClick={handleAddPrihod}>
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