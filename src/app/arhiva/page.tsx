"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { getUserId, getObracuni, deleteObracun, saveObracun, uploadFile, deleteFile, getAuthToken } from "../../lib/api";
import { useRole } from "../context/RoleContext";

// ---- Tipovi ----
type ArhiviraniArtikal = {
  naziv: string;
  cijena?: number;
  pocetnoStanje?: number;
  ulaz?: number;
  ukupno?: number;
  utroseno?: number;
  krajnjeStanje?: number;
  vrijednostKM: number;
  zestokoKolicina?: number;
  proizvodnaCijena?: number;
  staroPocetnoStanje?: number; // Staro stanje prije ažuriranja
  sačuvanUlaz?: number; // Sačuvani ulaz za prikaz u arhivi
};

type Rashod = {
  naziv: string;
  cijena: number;
  placeno?: boolean;
  datumPlacanja?: string; // Datum kada je dug označen kao plaćen (DD.MM.YYYY format)
  imageUrl?: string; // URL slike fakture za ovaj rashod
};

type Prihod = {
  naziv: string;
  cijena: number;
  imageUrl?: string; // URL slike fakture za ovaj prihod
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
  invoiceImages?: string[]; // URL-ovi slika faktura
  createdAt?: string | Date; // Timestamp kada je obračun sačuvan (za prikaz satnice)
};

// ---- CSS Stilovi ----
const containerStyle: React.CSSProperties = {
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "24px",
  fontFamily: "'Inter', sans-serif",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "separate" as "separate",
  borderSpacing: 0,
  background: "#ffffff",
  borderRadius: "8px",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
  marginBottom: "20px",
};

const thStyle: React.CSSProperties = {
  paddingTop: "16px",
  paddingBottom: "16px",
  paddingLeft: "16px",
  paddingRight: "16px",
  textAlign: "left" as "left",
  background: "#f8fafc",
  color: "#1f2937",
  fontSize: "14px",
  fontWeight: 600,
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle: React.CSSProperties = {
  paddingTop: "16px",
  paddingBottom: "16px",
  paddingLeft: "16px",
  paddingRight: "16px",
  textAlign: "left" as "left",
  borderBottom: "1px solid #f3f4f6",
  fontSize: "14px",
  color: "#374151",
};

const buttonStyle: React.CSSProperties = {
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
};

const deleteButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#dc2626",
};

const editFormStyle: React.CSSProperties = {
  background: "#fff",
  padding: "16px",
  borderRadius: "8px",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
  marginTop: "16px",
};

const inputStyle: React.CSSProperties = {
  padding: "8px",
  border: "1px solid #e5e7eb",
  borderRadius: "6px",
  fontSize: "14px",
  marginRight: "8px",
  width: "200px",
};

const checkboxStyle: React.CSSProperties = {
  marginRight: "8px",
};

// Funkcija za formatiranje datuma sa satima (MM-DD-YYYY HH:MM)
// Prima datum string ili Date objekat, i opciono savedAt za satnicu
const formatDatumSaSatima = (datum: string | Date, savedAt?: string | Date): string => {
  let dateObj: Date;
  
  // Ako ima savedAt, koristi ga za satnicu, inače koristi datum
  const dateForTime = savedAt ? (typeof savedAt === 'string' ? new Date(savedAt) : savedAt) : null;
  
  // Parsiraj datum
  if (typeof datum === 'string') {
    // Proveri da li je ISO format (YYYY-MM-DD ili YYYY-MM-DDTHH:MM:SS)
    if (datum.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(datum)) {
      // ISO format - direktno parse
      dateObj = new Date(datum);
    } else {
      // Proveri da li je u formatu DD.MM.YYYY ili DD.MM.YYYY.
      const cleanedDatum = datum.replace(/\.$/, ''); // Ukloni tačku na kraju ako postoji
      const parts = cleanedDatum.split('.');
      
      if (parts.length === 3) {
        // DD.MM.YYYY format
        const [dan, mjesec, godina] = parts;
        dateObj = new Date(parseInt(godina), parseInt(mjesec) - 1, parseInt(dan));
      } else {
        // Pokušaj standardni Date parse
        dateObj = new Date(cleanedDatum);
      }
    }
  } else {
    dateObj = datum;
  }
  
  // Proveri da li je validan datum
  if (isNaN(dateObj.getTime())) {
    return datum.toString(); // Vrati original ako ne može da se parsira
  }
  
  // Formatiraj u MM-DD-YYYY
  const mjesec = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dan = String(dateObj.getDate()).padStart(2, '0');
  const godina = dateObj.getFullYear();
  
  // Ako postoji savedAt, koristi satnicu iz njega, inače koristi iz datuma ili postavi na 00:00
  let sati = '00';
  let minuti = '00';
  
  if (dateForTime && !isNaN(dateForTime.getTime())) {
    sati = String(dateForTime.getHours()).padStart(2, '0');
    minuti = String(dateForTime.getMinutes()).padStart(2, '0');
  } else if (!isNaN(dateObj.getTime()) && dateObj.getHours !== undefined) {
    sati = String(dateObj.getHours()).padStart(2, '0');
    minuti = String(dateObj.getMinutes()).padStart(2, '0');
  }
  
  return `${mjesec}-${dan}-${godina} ${sati}:${minuti}`;
};

const obracunContainerStyle: React.CSSProperties = {
  marginBottom: "32px",
  border: "2px solid #e5e7eb",
  borderRadius: "12px",
  padding: "16px",
  background: "#f9fafb",
};

const obracunContainerAzuriranStyle: React.CSSProperties = {
  marginBottom: "32px",
  border: "3px solid #f59e0b", // Narandžasta boja za ažurirane obračune
  borderRadius: "12px",
  padding: "16px",
  background: "#fffbeb", // Svijetlo narandžasta pozadina
};

const obracunContainerUlazStyle: React.CSSProperties = {
  marginBottom: "32px",
  border: "3px solid #eab308", // Žuta boja za obračune s ulazom
  borderRadius: "12px",
  padding: "16px",
  background: "#fefce8", // Svijetlo žuta pozadina
};

// ---- Tip za dugove ----
type DugInfo = {
  imeDuznika: string;
  iznos: number;
  kolicina?: number;
  placeno: boolean;
  datum: string;
  obracunDatum: string;
  rashodIndex: number;
  datumPlacanja?: string; // Datum kada je dug označen kao plaćen (DD.MM.YYYY format)
};

// ---- Glavna komponenta ----
// Helper funkcija za normalizaciju URL-ova slika
// Konvertuje putanje slika na API route za serviranje
const normalizeImageUrl = (imageUrl: string): string => {
  if (!imageUrl) return imageUrl;
  
  // Ako već počinje sa http ili https, vrati kao jeste (eksterni URL)
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // Ako već koristi API route, vrati kao jeste
  if (imageUrl.includes('/api/files/serve')) {
    return imageUrl;
  }
  
  let normalizedPath = '';
  
  // Ukloni file:/// protokol
  if (imageUrl.startsWith('file:///')) {
    // Pronađi /public/ ili /uploads/
    const publicIndex = imageUrl.indexOf('/public/');
    const uploadsIndex = imageUrl.indexOf('/uploads/');
    
    if (publicIndex !== -1) {
      normalizedPath = imageUrl.substring(publicIndex + '/public'.length);
    } else if (uploadsIndex !== -1) {
      normalizedPath = imageUrl.substring(uploadsIndex);
    } else {
      // Ako nema public ili uploads, probaj da ekstraktuj putanju nakon poslednjeg /
      const lastSlash = imageUrl.lastIndexOf('/');
      if (lastSlash !== -1 && lastSlash < imageUrl.length - 1) {
        const pathPart = imageUrl.substring(lastSlash);
        normalizedPath = pathPart.startsWith('/uploads') ? pathPart : `/uploads${pathPart}`;
      }
    }
  } else if (imageUrl.includes('public/uploads')) {
    // Ako sadrži public/uploads, ekstraktuj relativni put
    const uploadsIndex = imageUrl.indexOf('/uploads/');
    if (uploadsIndex !== -1) {
      normalizedPath = imageUrl.substring(uploadsIndex);
    }
  } else if (imageUrl.startsWith('/uploads/')) {
    // Ako već počinje sa /uploads/, koristi direktno
    normalizedPath = imageUrl;
  } else if (!imageUrl.startsWith('/')) {
    // Ako je samo naziv fajla ili relativni put bez /, dodaj /uploads/
    normalizedPath = imageUrl.startsWith('uploads/') ? `/${imageUrl}` : `/uploads/${imageUrl}`;
  } else {
    normalizedPath = imageUrl;
  }
  
  // Konvertuj na API route za serviranje
  // URL encode putanju da bi se pravilno proslijedila kao query parametar
  const encodedUrl = encodeURIComponent(normalizedPath);
  return `/api/files/serve?url=${encodedUrl}`;
};

export default function ArhivaPage() {
  const { user } = useRole();
  const [arhiva, setArhiva] = useState<ArhiviraniObracun[]>([]);
  const [editingObracunDatum, setEditingObracunDatum] = useState<string | null>(null);
  const [editedRashodi, setEditedRashodi] = useState<Rashod[]>([]);
  const [editedPrihodi, setEditedPrihodi] = useState<Prihod[]>([]);
  const [showDugoviModal, setShowDugoviModal] = useState(false);
  const [dugoviFilter, setDugoviFilter] = useState<"svi" | "neplaceni" | "placeni">("svi");
  const [showFaktureModal, setShowFaktureModal] = useState(false);
  const [selectedFakturaDatum, setSelectedFakturaDatum] = useState<string | null>(null);
  const [selectedFakturaImages, setSelectedFakturaImages] = useState<string[]>([]);
  const [modalFakture, setModalFakture] = useState<{ datum: string; images: string[] }[]>([]);
  const [uploadingImagesForDatum, setUploadingImagesForDatum] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [invoiceFiles, setInvoiceFiles] = useState<{ [datum: string]: File[] }>({});
  const [modalInvoiceFiles, setModalInvoiceFiles] = useState<File[]>([]);
  const [showModalUploadInput, setShowModalUploadInput] = useState<boolean>(false);
  const [faktureModalMode, setFaktureModalMode] = useState<"all" | "single">("all"); // "all" za sve fakture, "single" za jedan obračun
  const [singleObracunDatum, setSingleObracunDatum] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const obracunRefs = useRef<{ [key: string]: React.RefObject<HTMLDivElement | null> }>({});

  // Funkcija za učitavanje arhive - MIGRIRANO NA API
  const loadArhiva = React.useCallback(async () => {
    // Koristi user.id iz RoleContext umjesto API poziva
    const userId = user?.id || (await getUserId());
    
    let firestoreArhiva: ArhiviraniObracun[] = [];
    
    // UČITAJ IZ API-JA
    if (userId) {
      try {
        const obracuni = await getObracuni(userId);
        // getObracuni već vraća transformisane podatke gde su artikli, rashodi i prihodi direktno arrayi
        // FILTRIRAJ: Ne prikazuj ažurirane obračune u arhivi (isAzuriran: true) - oni se čuvaju samo u pozadini
        const finalniObracuni = obracuni.filter((ob: any) => !ob.isAzuriran || ob.isAzuriran === false);
        firestoreArhiva = finalniObracuni.map((obracun: any) => {
          // getObracuni već vraća artikli, rashodi, prihodi kao arraye
          // Osiguraj da su arrayi
          const artikli = Array.isArray(obracun.artikli) ? obracun.artikli : [];
          const rashodi = Array.isArray(obracun.rashodi) ? obracun.rashodi : [];
          const prihodi = Array.isArray(obracun.prihodi) ? obracun.prihodi : [];
          
          console.log(`Arhiva - Loading obracun ${obracun.id}, artikli count: ${artikli.length}, rashodi: ${rashodi.length}, prihodi: ${prihodi.length}`);
          
          let invoiceImages = Array.isArray(obracun.invoiceImages) ? obracun.invoiceImages : [];
          // Normalizuj URL-ove slika prije spremanja u state
          if (invoiceImages.length > 0) {
            invoiceImages = invoiceImages.map(url => normalizeImageUrl(url));
            console.log(`Obračun ${obracun.id} ima ${invoiceImages.length} slika faktura`);
          }
          
          return {
            datum: obracun.datum,
            createdAt: obracun.createdAt, // saved_at timestamp za satnicu
            artikli: artikli,
            rashodi: rashodi,
            prihodi: prihodi,
            ukupnoArtikli: Number(obracun.ukupnoArtikli) || 0,
            ukupnoRashod: Number(obracun.ukupnoRashod) || 0,
            ukupnoPrihod: Number(obracun.ukupnoPrihod) || 0,
            neto: Number(obracun.neto) || 0,
            imaUlaz: obracun.imaUlaz ?? false,
            isAzuriran: obracun.isAzuriran ?? false,
            invoiceImages: invoiceImages,
          } as ArhiviraniObracun;
        });
        console.log("Učitano iz API-ja:", firestoreArhiva.length, "obračuna");
      } catch (error: any) {
        console.warn("Greška pri učitavanju iz API-ja:", error);
      }
    }
    
    // Sortiraj po datumu (najnoviji prvo)
    const sortedArhiva = firestoreArhiva.sort((a, b) => {
      const dateA = new Date(a.datum.split(".").reverse().join("-")).getTime();
      const dateB = new Date(b.datum.split(".").reverse().join("-")).getTime();
      return dateB - dateA;
    });
    
    // 3.5. TRANSFORMIRAJ PODATKE: Ako postoji staroPocetnoStanje u zagradi, to znači da je bio ulaz
    // U tom slučaju: pocetnoStanje = staroPocetnoStanje, ulaz = pocetnoStanje - staroPocetnoStanje
    const transformedArhiva = sortedArhiva.map((obracun) => {
      let imaUlaz = obracun.imaUlaz ?? false;
      // Provjeri da li artikli postoje prije nego što pozoveš .map()
      const transformedArtikli = (obracun.artikli && Array.isArray(obracun.artikli)) 
        ? obracun.artikli.map((artikal) => {
          // Ako postoji staroPocetnoStanje i razlikuje se od pocetnoStanje, to znači da je bio ulaz
          if (
            artikal.staroPocetnoStanje !== undefined &&
            artikal.pocetnoStanje !== undefined &&
            artikal.staroPocetnoStanje !== artikal.pocetnoStanje
          ) {
            const staroStanje = artikal.staroPocetnoStanje;
            const novoStanje = artikal.pocetnoStanje;
            const ulaz = novoStanje - staroStanje;
            
            imaUlaz = true; // Postavi flag da obračun ima ulaz
            
            return {
              ...artikal,
              pocetnoStanje: staroStanje, // Postavi staro stanje kao početno
              ulaz: ulaz, // Postavi ulaz kao razliku
              staroPocetnoStanje: undefined, // Ukloni staroPocetnoStanje jer je sada u pocetnoStanje
            };
          }
          return artikal;
        })
        : []; // Ako artikli ne postoje, koristi prazan array
      
      return {
        ...obracun,
        artikli: transformedArtikli,
        imaUlaz: imaUlaz, // Ažuriraj flag
      };
    });
    
    // POSTAVI STANJE (ne sprema se u localStorage - sve je u Firestore)
    setArhiva((prevArhiva) => {
      const prevString = JSON.stringify(prevArhiva);
      const newString = JSON.stringify(transformedArhiva);
      if (prevString === newString) {
        return prevArhiva; // Ne mijenjaj ako je ista
      }
      return transformedArhiva;
    });
    
    // Kreiraj refs za obračune
    transformedArhiva.forEach((item) => {
      if (!obracunRefs.current[item.datum]) {
        obracunRefs.current[item.datum] = React.createRef<HTMLDivElement>();
      }
    });
  }, []);

  // Detekcija mobilnog uređaja
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window === 'undefined') return false;
      const width = window.innerWidth || (window.screen && window.screen.width) || 1024;
      return width <= 768;
    };
    
    if (typeof window !== 'undefined') {
      setIsMobile(checkMobile());
      
      const handleResize = () => {
        setIsMobile(checkMobile());
      };
      
      window.addEventListener('resize', handleResize);
      window.addEventListener('orientationchange', () => {
        setTimeout(() => setIsMobile(checkMobile()), 100);
      });
      
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);

  // Učitavanje arhive iz Firestore
  useEffect(() => {
    loadArhiva();
  }, [loadArhiva]);

  // TEMPORARY: Disabled Firebase real-time listener - comment out to re-enable
  /*
  // Real-time listener za Firestore promjene
  useEffect(() => {
    const user = auth.currentUser;
    const userId = user?.uid;
    
    if (!userId) return;
    
    const obracuniRef = collection(db, "users", userId, "obracuni");
    
    const unsubscribe = onSnapshot(
      obracuniRef,
      () => {
        // Osvježi arhivu kada se promijeni Firestore
        console.log("Firestore promjena detektovana, osvježavam arhivu...");
        loadArhiva();
      },
      (error: any) => {
        // Ignoriraj greške dozvola
        const errorCode = error?.code || "";
        if (errorCode !== "permission-denied" && !errorCode.includes("permission") && !errorCode.includes("insufficient")) {
          console.warn("Greška u real-time listeneru za arhivu:", error);
        }
      }
    );
    
    return () => unsubscribe();
  }, [loadArhiva]);
  */

  // Listener za promjene u arhivi (samo za vanjske promjene, ne za interne)
  useEffect(() => {
    const handleArhivaChange = () => {
      // Koristi setTimeout da izbjegne direktnu petlju
      setTimeout(() => {
        loadArhiva();
      }, 100);
    };

    window.addEventListener("arhivaChanged", handleArhivaChange);
    return () => {
      window.removeEventListener("arhivaChanged", handleArhivaChange);
    };
  }, [loadArhiva]);

  // NE SPREMAJ U LOCALSTORAGE - sve se čuva u Firestore
  // Real-time listener automatski osvježava arhivu kada se promijeni u Firestore

  // Brisanje obračuna
  const handleDeleteObracun = async (datum: string) => {
    if (!window.confirm(`Jeste li sigurni da želite obrisati obračun za ${datum}?`)) {
      return;
    }

    // Email je glavni identifikator
    const userId = user?.email || user?.id;
    if (!userId) {
      alert("Korisnik nije prijavljen!");
      return;
    }

    try {
      // Provjeri da li postoje dugovi koji su plaćeni i imaju prihod u draft obračunu
      // Ako postoje, ne briši obračun jer bi se to poremetilo
      const obracunToDelete = arhiva.find(o => o.datum === datum);
      if (obracunToDelete && obracunToDelete.rashodi) {
        const placeniDugovi = obracunToDelete.rashodi.filter((r: Rashod) => r.placeno && r.datumPlacanja);
        if (placeniDugovi.length > 0) {
          const confirmMessage = `Upozorenje: Ovaj obračun ima ${placeniDugovi.length} plaćenih dugova koji su dodati u draft obračune. Ako obrišete ovaj obračun, status plaćenih dugova će se vratiti na neplaćen.\n\nŽelite li ipak obrisati obračun?`;
          if (!window.confirm(confirmMessage)) {
            return;
          }
        }
      }
      
      await deleteObracun(userId, datum);
      
      // Obriši iz lokalnog state-a
      const filteredArhiva = arhiva.filter((item) => item.datum !== datum);
      setArhiva(filteredArhiva);
      
      delete obracunRefs.current[datum];
      setEditingObracunDatum(null);
    } catch (error: any) {
      console.error("Greška pri brisanju obračuna:", error);
      alert(`Greška pri brisanju obračuna: ${error.message}`);
    }
  };

  // Početak uređivanja obračuna
  const startEditingObracun = (datum: string, rashodi: Rashod[], prihodi: Prihod[]) => {
    setEditingObracunDatum(datum);
    setEditedRashodi(rashodi.map(r => ({ ...r, placeno: r.placeno ?? false })));
    setEditedPrihodi([...prihodi]);
  };

  // Promjena rashoda u obrascu
  const handleRashodChange = (index: number, field: keyof Rashod, value: string | boolean) => {
    const updatedRashodi = [...editedRashodi];
    if (field === "naziv") {
      updatedRashodi[index].naziv = value as string;
    } else if (field === "cijena") {
      updatedRashodi[index].cijena = parseFloat(value as string) || 0;
    } else if (field === "placeno") {
      updatedRashodi[index].placeno = value as boolean;
    }
    setEditedRashodi(updatedRashodi);
  };

  // Promjena prihoda u obrascu
  const handlePrihodChange = (index: number, field: keyof Prihod, value: string) => {
    const updatedPrihodi = [...editedPrihodi];
    if (field === "naziv") {
      updatedPrihodi[index].naziv = value;
    } else if (field === "cijena") {
      updatedPrihodi[index].cijena = parseFloat(value) || 0;
    }
    setEditedPrihodi(updatedPrihodi);
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

  // Spremanje uređenih rashoda i prihoda
  const saveEditedObracun = async (datum: string) => {
    if (!user?.id) {
      alert("Korisnik nije prijavljen!");
      return;
    }

    try {
      // Pronađi obračun u arhivi
      const obracunToUpdate = arhiva.find(o => o.datum === datum);
      if (!obracunToUpdate) {
        alert("Obračun nije pronađen!");
        return;
      }

      const ukupnoRashod = editedRashodi.reduce((sum, r) => sum + r.cijena, 0);
      const ukupnoPrihod = editedPrihodi.reduce((sum, p) => sum + p.cijena, 0);
      
      // Email je glavni identifikator
      const userId = user?.email || user?.id;
      if (!userId) {
        alert("Korisnik nije prijavljen!");
        return;
      }
      
      // Spremi kroz API
      await saveObracun(userId, {
        datum: datum,
        artikli: obracunToUpdate.artikli || [],
        rashodi: editedRashodi,
        prihodi: editedPrihodi,
        ukupnoArtikli: obracunToUpdate.ukupnoArtikli || 0,
        ukupnoRashod: ukupnoRashod,
        ukupnoPrihod: ukupnoPrihod,
        neto: obracunToUpdate.ukupnoArtikli + ukupnoPrihod - ukupnoRashod,
        isAzuriran: obracunToUpdate.isAzuriran,
        imaUlaz: obracunToUpdate.imaUlaz,
        invoiceImages: obracunToUpdate.invoiceImages || [],
        isDraft: false,
      });

      // Ažuriraj lokalni state
      const updatedArhiva = arhiva
        .map((item) => {
          if (item.datum === datum) {
            return {
              ...item,
              rashodi: editedRashodi,
              prihodi: editedPrihodi,
              ukupnoRashod,
              ukupnoPrihod,
              neto: item.ukupnoArtikli + ukupnoPrihod - ukupnoRashod,
            };
          }
          return item;
        })
        .sort((a, b) => {
          const dateA = new Date(a.datum.split(".").reverse().join("-")).getTime();
          const dateB = new Date(b.datum.split(".").reverse().join("-")).getTime();
          return dateB - dateA;
        });
      setArhiva(updatedArhiva);
      
      setEditingObracunDatum(null);
      setEditedRashodi([]);
      setEditedPrihodi([]);
    } catch (error: any) {
      console.error("Greška pri spremanju obračuna:", error);
      alert(`Greška pri spremanju obračuna: ${error.message}`);
    }
  };

  // Odustajanje od uređivanja
  const cancelEditing = () => {
    setEditingObracunDatum(null);
    setEditedRashodi([]);
    setEditedPrihodi([]);
  };

  // Funkcija za izvlačenje informacija o dugu iz naziva rashoda
  const extractDugInfo = (naziv: string): { isDug: boolean; imeDuznika: string; kolicina?: number } => {
    const lowerNaziv = naziv.toLowerCase().trim();
    if (!lowerNaziv.includes("dug")) {
      return { isDug: false, imeDuznika: "" };
    }

    // Ukloni "dug" iz naziva i izvuci ime dužnika
    const parts = naziv.split(/\s+/);
    const dugIndex = parts.findIndex(p => p.toLowerCase() === "dug");
    
    if (dugIndex === -1) {
      return { isDug: false, imeDuznika: "" };
    }

    // Ime dužnika je sve prije "dug"
    const imeDuznika = parts.slice(0, dugIndex).join(" ").trim();
    
    // Provjeri da li postoji broj nakon "dug" (količina)
    let kolicina: number | undefined;
    if (dugIndex + 1 < parts.length) {
      const kolicinaStr = parts[dugIndex + 1];
      const parsedKolicina = parseFloat(kolicinaStr);
      if (!isNaN(parsedKolicina)) {
        kolicina = parsedKolicina;
      }
    }

    return { isDug: true, imeDuznika, kolicina };
  };

  // Funkcija za prikupljanje svih dugova iz arhive
  const getAllDugovi = (): DugInfo[] => {
    const dugovi: DugInfo[] = [];
    
    arhiva.forEach((obracun) => {
      // Provjeri da li rashodi postoje prije nego što pozoveš .forEach()
      if (obracun.rashodi && Array.isArray(obracun.rashodi)) {
        obracun.rashodi.forEach((rashod, index) => {
        const dugInfo = extractDugInfo(rashod.naziv);
        if (dugInfo.isDug) {
          dugovi.push({
            imeDuznika: dugInfo.imeDuznika,
            iznos: rashod.cijena,
            kolicina: dugInfo.kolicina,
            placeno: rashod.placeno ?? false,
            datum: obracun.datum,
            obracunDatum: obracun.datum,
            rashodIndex: index,
            datumPlacanja: rashod.datumPlacanja,
          });
        }
      });
      }
    });

    return dugovi;
  };

  // Funkcija za filtriranje dugova
  const getFilteredDugovi = (): DugInfo[] => {
    const sviDugovi = getAllDugovi();
    
    if (dugoviFilter === "svi") {
      return sviDugovi;
    } else if (dugoviFilter === "neplaceni") {
      return sviDugovi.filter(d => !d.placeno);
    } else {
      return sviDugovi.filter(d => d.placeno);
    }
  };

  // Funkcija za izračun sume neplaćenih dugova
  const getNeplaceniDugoviSum = (): number => {
    return getAllDugovi()
      .filter(d => !d.placeno)
      .reduce((sum, d) => sum + d.iznos, 0);
  };

  // Funkcija za prikupljanje svih faktura iz arhive
  const getAllFakture = (): { datum: string; images: string[] }[] => {
    const fakture: { datum: string; images: string[] }[] = [];
    
    arhiva.forEach((obracun) => {
      if (obracun.invoiceImages && obracun.invoiceImages.length > 0) {
        fakture.push({
          datum: obracun.datum,
          images: obracun.invoiceImages,
        });
      }
    });

    return fakture.sort((a, b) => {
      const dateA = new Date(a.datum.split(".").reverse().join("-")).getTime();
      const dateB = new Date(b.datum.split(".").reverse().join("-")).getTime();
      return dateB - dateA; // Najnoviji prvo
    });
  };

  // Funkcija za dobijanje faktura jednog obračuna
  const getSingleObracunFakture = async (datum: string): Promise<{ datum: string; images: string[] }[]> => {
    // Prvo provjeri u arhivi
    const obracun = arhiva.find(o => o.datum === datum);
    if (obracun && obracun.invoiceImages && obracun.invoiceImages.length > 0) {
      return [{
        datum: datum,
        images: obracun.invoiceImages,
      }];
    }
    
    // Ako nije u arhivi, učitaj iz API-ja
    if (!user?.id) {
      return [];
    }

    try {
      const obracuni = await getObracuni(user.id, datum);
      const obracunFromApi = obracuni.find((o: any) => o.datum === datum);
      if (obracunFromApi && obracunFromApi.invoiceImages && obracunFromApi.invoiceImages.length > 0) {
        // Normalizuj URL-ove slika
        const normalizedImages = obracunFromApi.invoiceImages.map((url: string) => normalizeImageUrl(url));
        return [{
          datum: datum,
          images: normalizedImages,
        }];
      }
    } catch (error) {
      console.warn("Greška pri učitavanju faktura iz API-ja:", error);
    }
    
    return [];
  };

  // Funkcija za otvaranje modala sa svim faktorama
  const openAllFaktureModal = async () => {
    setFaktureModalMode("all");
    setSingleObracunDatum(null);
    setSelectedFakturaDatum(null);
    setSelectedFakturaImages([]);
    setShowFaktureModal(true);
    setShowModalUploadInput(false);
    setModalInvoiceFiles([]);
    
    // Učitaj sve fakture iz arhive
    const allFakture = getAllFakture();
    setModalFakture(allFakture);
    
    // Ako nema faktura u lokalnoj arhivi, pokušaj učitati iz API-ja
    if (allFakture.length === 0 && user?.id) {
      try {
        const obracuni = await getObracuni(user.id);
        const finalniObracuni = obracuni.filter((ob: any) => !ob.isAzuriran || ob.isAzuriran === false);
        const faktureFromApi: { datum: string; images: string[] }[] = [];
        
        finalniObracuni.forEach((obracun: any) => {
          if (obracun.invoiceImages && Array.isArray(obracun.invoiceImages) && obracun.invoiceImages.length > 0) {
            const normalizedImages = obracun.invoiceImages.map((url: string) => normalizeImageUrl(url));
            faktureFromApi.push({
              datum: obracun.datum,
              images: normalizedImages,
            });
          }
        });
        
        if (faktureFromApi.length > 0) {
          // Sortiraj po datumu (najnoviji prvo)
          faktureFromApi.sort((a, b) => {
            const dateA = new Date(a.datum.split(".").reverse().join("-")).getTime();
            const dateB = new Date(b.datum.split(".").reverse().join("-")).getTime();
            return dateB - dateA;
          });
          setModalFakture(faktureFromApi);
        }
      } catch (error) {
        console.warn("Greška pri učitavanju faktura iz API-ja:", error);
      }
    }
  };

  // Funkcija za otvaranje modala sa faktorama jednog obračuna
  const openSingleObracunFaktureModal = async (datum: string) => {
    setFaktureModalMode("single");
    setSingleObracunDatum(datum);
    setSelectedFakturaDatum(null);
    setSelectedFakturaImages([]);
    setShowFaktureModal(true);
    setShowModalUploadInput(false);
    setModalInvoiceFiles([]);
    
    // Učitaj fakture za taj obračun
    const fakture = await getSingleObracunFakture(datum);
    setModalFakture(fakture);
    
    // Ažuriraj arhivu sa slikama ako nisu već učitane
    if (fakture.length > 0 && fakture[0].images.length > 0) {
      setArhiva((prev) =>
        prev.map((obracun) => {
          if (obracun.datum === datum && (!obracun.invoiceImages || obracun.invoiceImages.length === 0)) {
            return {
              ...obracun,
              invoiceImages: fakture[0].images,
            };
          }
          return obracun;
        })
      );
    }
  };

  // Funkcija za klik na datum u listi faktura (prikazuje slike)
  const handleFakturaDatumClick = (datum: string, images: string[]) => {
    setSelectedFakturaDatum(datum);
    setSelectedFakturaImages(images);
    setShowModalUploadInput(false);
    setModalInvoiceFiles([]);
    
    // Scroll na obračun ako je modal za sve fakture
    if (faktureModalMode === "all") {
      setTimeout(() => {
        const obracunRef = obracunRefs.current[datum];
        if (obracunRef && obracunRef.current) {
          obracunRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
          // Highlight obračun
          obracunRef.current.style.boxShadow = "0 0 0 3px #3b82f6";
          setTimeout(() => {
            if (obracunRef.current) {
              obracunRef.current.style.boxShadow = "";
            }
          }, 2000);
        }
      }, 100);
    }
  };

  // Funkcija za upload slika faktura u arhivi - kao što je Firebase radio
  const uploadInvoiceImagesInArchive = async (datum: string, files?: File[]) => {
    const filesToUpload = files || invoiceFiles[datum] || [];
    if (filesToUpload.length === 0) return;
    
    // Email je glavni identifikator
    const userId = user?.email || user?.id;
    if (!userId) {
      alert("Korisnik nije autentifikovan");
      return;
    }
    const cleanDatumString = datum.replace(/\.$/, '');
    const uploadedUrls: string[] = [];
    setUploadingImagesForDatum(datum);
    setUploadProgress(0);

    try {
      // Pronađi obračun u lokalnom state-u (kao Firebase)
      const obracunToUpdate = arhiva.find(o => o.datum === datum);
      if (!obracunToUpdate) {
        alert("Obračun nije pronađen!");
        return;
      }

      // Upload svih fajlova
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const uploadedFile = await uploadFile(file, 'invoice', cleanDatumString);
        uploadedUrls.push(uploadedFile.url);
        
        setUploadProgress(((i + 1) / filesToUpload.length) * 100);
      }

      // Kombinuj postojeće i nove slike (iz lokalnog state-a)
      const existingImages = obracunToUpdate.invoiceImages || [];
      const allImages = [...existingImages, ...uploadedUrls];

      // Direktno spremi obračun (kao Firebase setDoc) - koristi podatke iz lokalnog state-a
      await saveObracun(userId, {
        datum: datum,
        artikli: obracunToUpdate.artikli || [],
        rashodi: obracunToUpdate.rashodi || [],
        prihodi: obracunToUpdate.prihodi || [],
        ukupnoArtikli: obracunToUpdate.ukupnoArtikli || 0,
        ukupnoRashod: obracunToUpdate.ukupnoRashod || 0,
        ukupnoPrihod: obracunToUpdate.ukupnoPrihod || 0,
        neto: obracunToUpdate.neto || 0,
        isAzuriran: obracunToUpdate.isAzuriran || false,
        imaUlaz: obracunToUpdate.imaUlaz || false,
        invoiceImages: allImages,
        isDraft: false,
      });

      // Ažuriraj lokalni state
      const updatedArhiva = arhiva.map((obracun) => {
        if (obracun.datum === datum) {
          return {
            ...obracun,
            invoiceImages: allImages,
          };
        }
        return obracun;
      });
      setArhiva(updatedArhiva);

      // Očisti fajlove
      setInvoiceFiles((prev) => {
        const newFiles = { ...prev };
        delete newFiles[datum];
        return newFiles;
      });

      alert(`Uspješno upload-ovano ${uploadedUrls.length} slika!`);
    } catch (error: any) {
      console.error("Greška pri upload-u slika:", error);
      alert("Greška pri upload-u slika. Provjerite konzolu za detalje.");
    } finally {
      setUploadingImagesForDatum(null);
      setUploadProgress(0);
    }
  };

  // Funkcija za brisanje slike iz preview-a
  const removeImageFromPreview = (datum: string, index: number) => {
    setInvoiceFiles((prev) => {
      const files = prev[datum] || [];
      return {
        ...prev,
        [datum]: files.filter((_, i) => i !== index),
      };
    });
  };

  // Funkcija za upload slika iz modala - kao što je Firebase radio
  const uploadInvoiceImagesInModal = async (datum: string) => {
    if (modalInvoiceFiles.length === 0) return;
    
    // Email je glavni identifikator
    const userId = user?.email || user?.id;
    if (!userId) {
      alert("Korisnik nije autentifikovan");
      return;
    }
    const cleanDatumString = datum.replace(/\.$/, '');
    const uploadedUrls: string[] = [];
    setUploadingImagesForDatum(datum);
    setUploadProgress(0);

    try {
      // Pronađi obračun u lokalnom state-u (kao Firebase)
      const obracunToUpdate = arhiva.find(o => o.datum === datum);
      if (!obracunToUpdate) {
        alert("Obračun nije pronađen!");
        return;
      }

      // Upload svih fajlova
      for (let i = 0; i < modalInvoiceFiles.length; i++) {
        const file = modalInvoiceFiles[i];
        const uploadedFile = await uploadFile(file, 'invoice', cleanDatumString);
        uploadedUrls.push(uploadedFile.url);
        
        setUploadProgress(((i + 1) / modalInvoiceFiles.length) * 100);
      }

      // Kombinuj postojeće i nove slike (iz lokalnog state-a)
      const existingImages = obracunToUpdate.invoiceImages || [];
      const allImages = [...existingImages, ...uploadedUrls];

      // Direktno spremi obračun (kao Firebase setDoc) - koristi podatke iz lokalnog state-a
      await saveObracun(userId, {
        datum: datum,
        artikli: obracunToUpdate.artikli || [],
        rashodi: obracunToUpdate.rashodi || [],
        prihodi: obracunToUpdate.prihodi || [],
        ukupnoArtikli: obracunToUpdate.ukupnoArtikli || 0,
        ukupnoRashod: obracunToUpdate.ukupnoRashod || 0,
        ukupnoPrihod: obracunToUpdate.ukupnoPrihod || 0,
        neto: obracunToUpdate.neto || 0,
        isAzuriran: obracunToUpdate.isAzuriran || false,
        imaUlaz: obracunToUpdate.imaUlaz || false,
        invoiceImages: allImages,
        isDraft: false,
      });

      // Ažuriraj lokalni state
      const updatedArhiva = arhiva.map((obracun) => {
        if (obracun.datum === datum) {
          return {
            ...obracun,
            invoiceImages: allImages,
          };
        }
        return obracun;
      });
      setArhiva(updatedArhiva);

      // Ažuriraj prikaz u modalu
      setSelectedFakturaImages(allImages);

      // Očisti fajlove
      setModalInvoiceFiles([]);
      setShowModalUploadInput(false);

      alert(`Uspješno upload-ovano ${uploadedUrls.length} slika!`);
    } catch (error: any) {
      console.error("Greška pri upload-u slika:", error);
      alert("Greška pri upload-u slika. Provjerite konzolu za detalje.");
    } finally {
      setUploadingImagesForDatum(null);
      setUploadProgress(0);
    }
  };

  // Funkcija za brisanje slike iz modala - kao što je Firebase radio
  const deleteInvoiceImage = async (datum: string, imageIndex: number) => {
    if (!confirm("Da li ste sigurni da želite obrisati ovu sliku?")) {
      return;
    }

    // Email je glavni identifikator
    const userId = user?.email || user?.id;
    if (!userId) {
      alert("Korisnik nije autentifikovan");
      return;
    }

    try {
      // Pronađi obračun u lokalnom state-u (kao Firebase)
      const obracunToUpdate = arhiva.find(o => o.datum === datum);
      if (!obracunToUpdate || !obracunToUpdate.invoiceImages || !obracunToUpdate.invoiceImages[imageIndex]) {
        return;
      }

      // Pronađi URL slike koja treba biti obrisana
      const imageUrlToDelete = obracunToUpdate.invoiceImages[imageIndex];

      // Obriši fajl sa servera
      try {
        await deleteFile(imageUrlToDelete);
      } catch (error: any) {
        console.warn("Greška pri brisanju fajla sa servera:", error);
        // Nastavi sa brisanjem iz baze čak i ako brisanje fajla ne uspije
      }

      // Ukloni sliku iz liste
      const updatedImages = obracunToUpdate.invoiceImages.filter((_, index) => index !== imageIndex);

      // Direktno spremi obračun (kao Firebase setDoc) - koristi podatke iz lokalnog state-a
      await saveObracun(userId, {
        datum: datum,
        artikli: obracunToUpdate.artikli || [],
        rashodi: obracunToUpdate.rashodi || [],
        prihodi: obracunToUpdate.prihodi || [],
        ukupnoArtikli: obracunToUpdate.ukupnoArtikli || 0,
        ukupnoRashod: obracunToUpdate.ukupnoRashod || 0,
        ukupnoPrihod: obracunToUpdate.ukupnoPrihod || 0,
        neto: obracunToUpdate.neto || 0,
        isAzuriran: obracunToUpdate.isAzuriran || false,
        imaUlaz: obracunToUpdate.imaUlaz || false,
        invoiceImages: updatedImages,
        isDraft: false,
      });

      // Ažuriraj lokalni state
      const updatedArhiva = arhiva.map((o) => {
        if (o.datum === datum) {
          return {
            ...o,
            invoiceImages: updatedImages,
          };
        }
        return o;
      });
      setArhiva(updatedArhiva);

      // Ažuriraj prikaz u modalu
      setSelectedFakturaImages(updatedImages);

      alert("Slika je uspješno obrisana!");
    } catch (error: any) {
      console.error("Greška pri brisanju slike:", error);
      alert("Greška pri brisanju slike. Provjerite konzolu za detalje.");
    }
  };

  // Funkcija za označavanje duga kao plaćenog
  const markDugAsPlacen = async (obracunDatum: string, rashodIndex: number) => {
    // Email je glavni identifikator
    const userId = user?.email || user?.id;
    if (!userId) {
      alert("Korisnik nije prijavljen!");
      return;
    }
    
    // Pronađi obračun u arhivi
    const obracunToUpdate = arhiva.find(o => o.datum === obracunDatum);
    if (!obracunToUpdate) {
      alert("Obračun nije pronađen!");
      return;
    }

    // Pronađi rashod (dug) koji se označava kao plaćen
    const rashodToMark = obracunToUpdate.rashodi && Array.isArray(obracunToUpdate.rashodi) 
      ? obracunToUpdate.rashodi[rashodIndex] 
      : null;
    
    if (!rashodToMark) {
      alert("Rashod (dug) nije pronađen!");
      return;
    }

    // Izvuci ime dužnika iz naziva rashoda
    const dugInfo = extractDugInfo(rashodToMark.naziv);
    if (!dugInfo.isDug || !dugInfo.imeDuznika) {
      alert("Greška: Ne može se pronaći ime dužnika!");
      return;
    }

    // Formiraj datum plaćanja (trenutni datum u DD.MM.YYYY. formatu - sa tačkom na kraju)
    // Koristi lokalno vrijeme iz browsera za konzistentnost (ne UTC)
    // Koristi isti format kao formatirajDatum funkcija iz obracun/page.tsx
    const today = new Date();
    // Koristi getFullYear(), getMonth(), getDate() koji vraćaju lokalne vrijednosti (ne UTC)
    const dan = String(today.getDate()).padStart(2, '0');
    const mjesec = String(today.getMonth() + 1).padStart(2, '0');
    const godina = today.getFullYear();
    const datumPlacanja = `${dan}.${mjesec}.${godina}.`; // Dodaj tačku na kraju za konzistentnost
    
    // Eksplicitno koristi lokalno vrijeme (ne UTC)
    const localDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    console.log("📅 Formiranje datuma plaćanja:", {
      todayISO: today.toISOString(),
      todayLocal: today.toString(),
      todayUTC: today.toUTCString(),
      localDate: localDate.toString(),
      datumPlacanja,
      dateParts: { dan, mjesec, godina },
      timezoneOffset: today.getTimezoneOffset(),
      isUTC: today.getTimezoneOffset() === 0
    });

    // Ažuriraj rashode - dodaj datum plaćanja
    const updatedRashodi = (obracunToUpdate.rashodi && Array.isArray(obracunToUpdate.rashodi)) 
      ? obracunToUpdate.rashodi.map((rashod, index) => {
          if (index === rashodIndex) {
            return { ...rashod, placeno: true, datumPlacanja: datumPlacanja };
          }
          return rashod;
        }) 
      : [];

    // Ažuriraj lokalni state
    const updatedArhiva = arhiva.map((obracun) => {
      if (obracun.datum === obracunDatum) {
        return { ...obracun, rashodi: updatedRashodi };
      }
      return obracun;
    });
    setArhiva(updatedArhiva);
    
    try {
      // 1. Spremi ažurirani obračun (sa datumom plaćanja u rashodu)
      const ukupnoRashod = updatedRashodi.reduce((sum, r) => sum + r.cijena, 0);
      
      await saveObracun(userId, {
        datum: obracunDatum,
        artikli: obracunToUpdate.artikli || [],
        rashodi: updatedRashodi,
        prihodi: obracunToUpdate.prihodi || [],
        ukupnoArtikli: obracunToUpdate.ukupnoArtikli || 0,
        ukupnoRashod: ukupnoRashod,
        ukupnoPrihod: obracunToUpdate.ukupnoPrihod || 0,
        neto: obracunToUpdate.ukupnoArtikli + (obracunToUpdate.ukupnoPrihod || 0) - ukupnoRashod,
        isAzuriran: obracunToUpdate.isAzuriran || false,
        imaUlaz: obracunToUpdate.imaUlaz || false,
        invoiceImages: obracunToUpdate.invoiceImages || [],
        isDraft: false,
      });

      // 2. Pronađi ili kreiraj draft obračun za danas (datum plaćanja)
      // Provjeri da li postoji draft obračun za danas
      console.log("🔍 Traženje draft obračuna za datum plaćanja:", datumPlacanja);
      console.log("🔍 Trenutno vrijeme na klijentu:", new Date().toISOString());
      
      const obracuni = await getObracuni(userId);
      console.log("🔍 Pronađeno obračuna:", obracuni.length);
      console.log("🔍 Svi obračuni (datum i isAzuriran):", obracuni.map((ob: any) => ({ datum: ob.datum, isAzuriran: ob.isAzuriran })));
      
      const trazeniDatum = datumPlacanja.replace(/\.$/, '').trim();
      const draftObracun = obracuni.find((ob: any) => {
        const obDatum = ob.datum ? ob.datum.replace(/\.$/, '').trim() : '';
        const matches = obDatum === trazeniDatum && ob.isAzuriran === true;
        if (ob.isAzuriran === true) {
          console.log("🔍 Provjera draft obračuna:", { 
            obDatum, 
            trazeniDatum, 
            obDatumLength: obDatum.length,
            trazeniDatumLength: trazeniDatum.length,
            isAzuriran: ob.isAzuriran, 
            matches,
            exactMatch: obDatum === trazeniDatum,
            caseSensitive: obDatum.toLowerCase() === trazeniDatum.toLowerCase()
          });
        }
        return matches;
      });
      
      console.log("🔍 Pronađen draft obračun:", draftObracun ? "DA" : "NE");

      // Pripremi novi prihod
      const noviPrihod = {
        naziv: dugInfo.imeDuznika,
        cijena: rashodToMark.cijena,
      };

      if (draftObracun) {
        // Ažuriraj postojeći draft obračun - dodaj prihod
        const postojeciPrihodi = Array.isArray(draftObracun.prihodi) ? draftObracun.prihodi : [];
        const updatedPrihodi = [...postojeciPrihodi, noviPrihod];
        const ukupnoPrihod = updatedPrihodi.reduce((sum, p) => sum + (p.cijena || 0), 0);
        
        await saveObracun(userId, {
          datum: datumPlacanja,
          artikli: Array.isArray(draftObracun.artikli) ? draftObracun.artikli : [],
          rashodi: Array.isArray(draftObracun.rashodi) ? draftObracun.rashodi : [],
          prihodi: updatedPrihodi,
          ukupnoArtikli: draftObracun.ukupnoArtikli || 0,
          ukupnoRashod: draftObracun.ukupnoRashod || 0,
          ukupnoPrihod: ukupnoPrihod,
          neto: (draftObracun.ukupnoArtikli || 0) + ukupnoPrihod - (draftObracun.ukupnoRashod || 0),
          isAzuriran: true, // Draft obračun
          imaUlaz: draftObracun.imaUlaz || false,
          invoiceImages: draftObracun.invoiceImages || [],
          isDraft: true,
        });
      } else {
        // Kreiraj novi draft obračun sa prihodom
        await saveObracun(userId, {
          datum: datumPlacanja,
          artikli: [],
          rashodi: [],
          prihodi: [noviPrihod],
          ukupnoArtikli: 0,
          ukupnoRashod: 0,
          ukupnoPrihod: noviPrihod.cijena,
          neto: noviPrihod.cijena,
          isAzuriran: true, // Draft obračun
          imaUlaz: false,
          invoiceImages: [],
          isDraft: true,
        });
      }

      console.log("✅ Dug je uspješno označen kao plaćen i prihod je dodan u draft obračun");
      alert(`Dug je označen kao plaćen. Prihod od ${rashodToMark.cijena.toFixed(2)} KM je dodan u draft obračun za ${datumPlacanja}.`);
    } catch (error: any) {
      console.error("❌ Greška pri spremanju:", error);
      console.error("❌ Error details:", {
        message: error.message,
        stack: error.stack,
        userId,
        obracunDatum,
        datumPlacanja,
        rashodIndex,
      });
      alert(`Greška pri spremanju promjene: ${error.message || 'Unknown error'}. Provjerite konzolu za detalje.`);
    }
  };

  // Dinamički container style sa smanjenim padding-om na mobilnom
  const dynamicContainerStyle: React.CSSProperties = {
    ...containerStyle,
    padding: isMobile ? "4px" : "24px",
    margin: isMobile ? "0 auto" : "0 auto",
    marginLeft: isMobile ? "auto" : "auto",
  };

  return (
    <div style={dynamicContainerStyle}>
      <style jsx>{`
        button:hover {
          background-color: #2563eb;
        }
        .delete-button:hover {
          background-color: #b91c1c;
        }
        .edit-button:hover {
          background-color: #059669;
        }
        .table-scroll-wrapper {
          overflow-x: visible; /* Na desktopu nema scroll */
          width: 100%;
        }
        /* Desktop verzija - osiguraj marginu */
        @media (min-width: 769px) {
          div[style*='maxWidth: 1200px'] {
            margin-left: auto !important;
            margin-right: auto !important;
          }
        }
          @media (max-width: 768px) {
          div[style*='padding: 24px'] {
            padding: 10px; /* Smanjen padding na mobilu */
          }
          h1 {
            font-size: 18px; /* Smanjen font za naslove */
            margin-bottom: 16px !important;
          }
          h2 {
            font-size: 16px;
            margin-bottom: 12px !important;
          }
          .table-scroll-wrapper {
            overflow-x: auto !important; /* Na mobilu omogući scroll */
            -webkit-overflow-scrolling: touch; /* Smooth scrolling na iOS */
            width: 100%;
          }
          table {
            font-size: 12px;
            min-width: 800px; /* Osigurava horizontalni scroll */
          }
          th, td {
            font-size: 11px !important; /* Smanjen font za tablice */
            padding: 8px !important; /* Smanjen padding za ćelije */
            min-width: 80px;
            white-space: nowrap; /* Sprečava prelamanje teksta */
          }
          /* Sticky prva kolona (Artikal) na mobilnoj verziji - VRLO SPECIFIČNI SELEKTORI */
          .table-scroll-wrapper {
            display: block !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
          }
          .table-scroll-wrapper table {
            border-collapse: separate !important;
            border-spacing: 0 !important;
            display: table !important;
          }
          /* PRVA KOLONA - Header - koristi klasu za sigurnost */
          .table-scroll-wrapper table thead tr th:first-child,
          .table-scroll-wrapper table thead tr th.sticky-first-column-header {
            position: -webkit-sticky !important;
            position: sticky !important;
            left: 0 !important;
            z-index: 101 !important;
            background-color: #f8fafc !important;
            box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15) !important;
          }
          /* PRVA KOLONA - Body - svi redovi - koristi klasu za sigurnost */
          .table-scroll-wrapper table tbody tr td:first-child,
          .table-scroll-wrapper table tbody tr td.sticky-first-column-row {
            position: -webkit-sticky !important;
            position: sticky !important;
            left: 0 !important;
            z-index: 100 !important;
            box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15) !important;
          }
          /* Body prva kolona - alterniraj boju pozadine po klasi */
          .table-scroll-wrapper table tbody tr:nth-child(even) td:first-child,
          .table-scroll-wrapper table tbody tr td.sticky-first-column-even {
            background-color: #ffffff !important;
          }
          .table-scroll-wrapper table tbody tr:nth-child(odd) td:first-child,
          .table-scroll-wrapper table tbody tr td.sticky-first-column-odd {
            background-color: #f9fafb !important;
          }
          button {
            width: 100%;
            margin: 4px 0; /* Kompaktniji razmak */
            padding: 10px;
            font-size: 14px; /* Smanjen font za dugmadi */
            min-height: 44px; /* Minimalna visina za touch target */
          }
          div[style*='display: flex'] {
            flex-direction: column; /* Stack-anje elemenata vertikalno */
            gap: 8px;
          }
          input {
            width: 100%;
            margin: 5px 0;
            padding: 8px;
            font-size: 14px;
          }
          .edit-form {
            padding: 10px; /* Smanjen padding za edit formu */
          }
        }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#1f2937", margin: 0 }}>
          Arhiva
        </h1>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {getAllDugovi().length > 0 && (
            <button
              style={{
                ...buttonStyle,
                background: "#f59e0b",
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: 600,
              }}
              onClick={() => setShowDugoviModal(true)}
            >
              💰 Pregled duga ({getAllDugovi().filter(d => !d.placeno).length} neplaćenih)
            </button>
          )}
          {getAllFakture().length > 0 && (
            <button
              style={{
                ...buttonStyle,
                background: "#8b5cf6",
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: 600,
              }}
              onClick={openAllFaktureModal}
            >
              📸 Pregled faktura ({getAllFakture().length})
            </button>
          )}
        </div>
      </div>

      {/* Modal za pregled faktura */}
      {showFaktureModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() => {
            setShowFaktureModal(false);
            setSelectedFakturaDatum(null);
            setSelectedFakturaImages([]);
            setModalInvoiceFiles([]);
            setShowModalUploadInput(false);
            setFaktureModalMode("all");
            setSingleObracunDatum(null);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "900px",
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#1f2937", margin: 0 }}>
                📸 Pregled faktura{faktureModalMode === "single" && singleObracunDatum ? ` - ${singleObracunDatum}` : ""}
              </h2>
              <div style={{ display: "flex", gap: "8px" }}>
                {selectedFakturaDatum && (
                  <button
                    style={{
                      background: "#8b5cf6",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      padding: "8px 16px",
                      cursor: "pointer",
                      fontSize: "14px",
                    }}
                    onClick={() => setShowModalUploadInput(!showModalUploadInput)}
                  >
                    📎 Dodaj sliku
                  </button>
                )}
                <button
                  style={{
                    background: "#6b7280",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    padding: "8px 16px",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                  onClick={() => {
                    setShowFaktureModal(false);
                    setSelectedFakturaDatum(null);
                    setSelectedFakturaImages([]);
                    setModalInvoiceFiles([]);
                    setShowModalUploadInput(false);
                    setFaktureModalMode("all");
                    setSingleObracunDatum(null);
                  }}
                >
                  ✕ Zatvori
                </button>
              </div>
            </div>

            {/* Lista faktura */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {(() => {
                const fakture = modalFakture;
                
                if (fakture.length === 0) {
                  return (
                    <p style={{ textAlign: "center", color: "#6b7280", padding: "20px" }}>
                      Nema faktura za prikaz
                    </p>
                  );
                }
                
                return fakture.map((faktura, index) => (
                  <React.Fragment key={index}>
                    <div
                      style={{
                        padding: "16px",
                        border: selectedFakturaDatum === faktura.datum ? "2px solid #8b5cf6" : "1px solid #e5e7eb",
                        borderRadius: "8px",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        background: selectedFakturaDatum === faktura.datum ? "#f3e8ff" : "#fff",
                      }}
                      onMouseEnter={(e) => {
                        if (selectedFakturaDatum !== faktura.datum) {
                          e.currentTarget.style.backgroundColor = "#f9fafb";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedFakturaDatum !== faktura.datum) {
                          e.currentTarget.style.backgroundColor = "#fff";
                        }
                      }}
                      onClick={() => handleFakturaDatumClick(faktura.datum, faktura.images)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", margin: 0 }}>
                            {faktura.datum}
                          </h3>
                          <p style={{ fontSize: "14px", color: "#6b7280", margin: "4px 0 0 0" }}>
                            {faktura.images.length} {faktura.images.length === 1 ? "slika" : "slika"}
                          </p>
                        </div>
                        <div style={{ fontSize: "14px", color: "#8b5cf6", fontWeight: 500 }}>
                          {selectedFakturaDatum === faktura.datum ? "▼ Otvoreno" : "▶ Klikni za pregled"}
                        </div>
                      </div>
                    </div>

                    {/* Prikaz slika odmah ispod kliknute fakture */}
                    {selectedFakturaDatum === faktura.datum && faktura.images.length > 0 && (
                      <div style={{ 
                        marginTop: "16px", 
                        marginBottom: "24px",
                        padding: "20px",
                        background: "#faf5ff",
                        borderRadius: "8px",
                        border: "1px solid #e9d5ff"
                      }}>
                        <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "16px" }}>
                          Slike fakture - {faktura.datum}
                        </h3>

                        {/* Upload sekcija u modalu */}
                        {showModalUploadInput && (
                          <div style={{ 
                            marginBottom: "20px", 
                            padding: "12px", 
                            background: "#f3f4f6",
                            borderRadius: "8px",
                            border: "1px solid #e5e7eb"
                          }}>
                            <label
                              style={{
                                display: "block",
                                padding: "8px 12px",
                                background: "#fff",
                                borderWidth: "1px",
                                borderStyle: "dashed",
                                borderColor: "#8b5cf6",
                                borderRadius: "6px",
                                cursor: "pointer",
                                textAlign: "center",
                                transition: "all 0.2s ease",
                                marginBottom: "10px"
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#f3e8ff";
                                e.currentTarget.style.borderColor = "#7c3aed";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "#fff";
                                e.currentTarget.style.borderColor = "#8b5cf6";
                              }}
                            >
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => {
                                  const files = Array.from(e.target.files || []);
                                  setModalInvoiceFiles((prev) => [...prev, ...files]);
                                  e.target.value = "";
                                }}
                                style={{ display: "none" }}
                              />
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                                <span style={{ fontSize: "16px" }}>📎</span>
                                <span style={{ fontSize: "12px", fontWeight: 500, color: "#6b21a8" }}>
                                  Odaberi slike
                                </span>
                              </div>
                            </label>

                            {modalInvoiceFiles.length > 0 && (
                              <div style={{ marginTop: "10px" }}>
                                <div style={{ 
                                  display: "flex", 
                                  alignItems: "center", 
                                  justifyContent: "space-between",
                                  marginBottom: "8px"
                                }}>
                                  <span style={{ fontSize: "12px", fontWeight: 500, color: "#6b21a8" }}>
                                    Odabrano: {modalInvoiceFiles.length}
                                  </span>
                                  <button
                                    onClick={() => setModalInvoiceFiles([])}
                                    style={{
                                      padding: "2px 8px",
                                      background: "#dc2626",
                                      color: "white",
                                      border: "none",
                                      borderRadius: "4px",
                                      fontSize: "11px",
                                      cursor: "pointer",
                                      fontWeight: 500
                                    }}
                                  >
                                    Obriši sve
                                  </button>
                                </div>
                                <div style={{ 
                                  display: "grid", 
                                  gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", 
                                  gap: "8px",
                                  marginBottom: "10px"
                                }}>
                                  {modalInvoiceFiles.map((file, idx) => (
                                    <div 
                                      key={idx} 
                                      style={{ 
                                        position: "relative", 
                                        width: "100%",
                                        aspectRatio: "1",
                                        borderRadius: "6px",
                                        overflow: "hidden",
                                        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.1)"
                                      }}
                                    >
                                      <img
                                        src={URL.createObjectURL(file)}
                                        alt={`Preview ${idx + 1}`}
                                        style={{
                                          width: "100%",
                                          height: "100%",
                                          objectFit: "cover"
                                        }}
                                      />
                                      <button
                                        onClick={() => setModalInvoiceFiles(prev => prev.filter((_, i) => i !== idx))}
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
                                          justifyContent: "center"
                                        }}
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                                </div>
                                <button
                                  onClick={() => {
                                    if (selectedFakturaDatum) {
                                      uploadInvoiceImagesInModal(selectedFakturaDatum);
                                    }
                                  }}
                                  disabled={uploadingImagesForDatum === selectedFakturaDatum}
                                  style={{
                                    width: "100%",
                                    padding: "8px 16px",
                                    background: uploadingImagesForDatum === selectedFakturaDatum ? "#9ca3af" : "#8b5cf6",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "6px",
                                    fontSize: "12px",
                                    cursor: uploadingImagesForDatum === selectedFakturaDatum ? "not-allowed" : "pointer",
                                    fontWeight: 500
                                  }}
                                >
                                  {uploadingImagesForDatum === selectedFakturaDatum 
                                    ? `Upload... ${Math.round(uploadProgress)}%` 
                                    : "Upload slike"}
                                </button>
                                {uploadingImagesForDatum === selectedFakturaDatum && uploadProgress > 0 && (
                                  <div style={{ marginTop: "8px" }}>
                                    <div style={{
                                      width: "100%",
                                      height: "6px",
                                      background: "#e9d5ff",
                                      borderRadius: "3px",
                                      overflow: "hidden"
                                    }}>
                                      <div style={{
                                        width: `${uploadProgress}%`,
                                        height: "100%",
                                        background: "linear-gradient(90deg, #8b5cf6, #7c3aed)",
                                        borderRadius: "3px",
                                        transition: "width 0.3s ease"
                                      }} />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
                          {faktura.images.map((imageUrl, imgIdx) => {
                            // Normalizuj URL koristeći helper funkciju
                            const normalizedUrl = normalizeImageUrl(imageUrl);
                            
                            return (
                            <div key={imgIdx} style={{ position: "relative" }}>
                              <img
                                src={normalizedUrl}
                                alt={`Faktura ${faktura.datum} - ${imgIdx + 1}`}
                                style={{
                                  width: "100%",
                                  height: "200px",
                                  objectFit: "cover",
                                  borderRadius: "8px",
                                  border: "1px solid #e5e7eb",
                                  cursor: "pointer",
                                }}
                                onClick={async () => {
                                  try {
                                    const token = getAuthToken();
                                    if (!token) {
                                      alert('Niste prijavljeni!');
                                      return;
                                    }
                                    
                                    const response = await fetch(normalizedUrl, {
                                      headers: {
                                        'Authorization': `Bearer ${token}`,
                                      },
                                    });
                                    
                                    if (!response.ok) {
                                      if (response.status === 404) {
                                        alert('Slika nije pronađena. Možda je obrisana ili premještena.');
                                        return;
                                      }
                                      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
                                    }
                                    
                                    const blob = await response.blob();
                                    const blobUrl = URL.createObjectURL(blob);
                                    const newWindow = window.open(blobUrl, "_blank");
                                    
                                    if (!newWindow) {
                                      URL.revokeObjectURL(blobUrl);
                                      alert('Popup blocker je blokirao otvaranje slike. Molimo dozvolite popup-ove za ovaj sajt.');
                                      return;
                                    }
                                    
                                    // Očisti blob URL nakon što se prozor otvori (pauza od 1 sekunde)
                                    setTimeout(() => {
                                      try {
                                        URL.revokeObjectURL(blobUrl);
                                      } catch (e) {
                                        // Ignoriraj grešku pri brisanju blob URL-a
                                      }
                                    }, 1000);
                                  } catch (error: any) {
                                    console.error('Error opening image:', error);
                                    alert('Greška pri otvaranju slike: ' + (error.message || 'Nepoznata greška'));
                                  }
                                }}
                                onError={(e) => {
                                  // Samo loguj grešku, ne menjaj src da ne bi izazvao petlju
                                  console.warn('Error loading image in img tag:', normalizedUrl, 'Original:', imageUrl);
                                }}
                              />
                              <button
                                onClick={() => {
                                  if (selectedFakturaDatum) {
                                    deleteInvoiceImage(selectedFakturaDatum, imgIdx);
                                  }
                                }}
                                style={{
                                  position: "absolute",
                                  top: "8px",
                                  right: "8px",
                                  background: "rgba(220, 38, 38, 0.9)",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "50%",
                                  width: "28px",
                                  height: "28px",
                                  cursor: "pointer",
                                  fontSize: "16px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)"
                                }}
                              >
                                ×
                              </button>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal za pregled duga */}
      {showDugoviModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() => setShowDugoviModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "900px",
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#1f2937", margin: 0 }}>
                💰 Pregled duga
              </h2>
              <button
                style={{
                  background: "#6b7280",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
                onClick={() => setShowDugoviModal(false)}
              >
                ✕ Zatvori
              </button>
            </div>

            {/* Suma neplaćenih dugova */}
            <div
              style={{
                padding: "16px",
                background: "#fee2e2",
                borderRadius: "8px",
                marginBottom: "20px",
                border: "1px solid #fca5a5",
              }}
            >
              <div style={{ fontSize: "16px", fontWeight: 600, color: "#991b1b" }}>
                Ukupno neplaćenih dugova: {getNeplaceniDugoviSum().toFixed(2)} KM
              </div>
            </div>

            {/* Filter dugova */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
              <button
                style={{
                  ...buttonStyle,
                  background: dugoviFilter === "svi" ? "#3b82f6" : "#9ca3af",
                  padding: "8px 16px",
                }}
                onClick={() => setDugoviFilter("svi")}
              >
                Svi ({getAllDugovi().length})
              </button>
              <button
                style={{
                  ...buttonStyle,
                  background: dugoviFilter === "neplaceni" ? "#dc2626" : "#9ca3af",
                  padding: "8px 16px",
                }}
                onClick={() => setDugoviFilter("neplaceni")}
              >
                Neplaćeni ({getAllDugovi().filter(d => !d.placeno).length})
              </button>
              <button
                style={{
                  ...buttonStyle,
                  background: dugoviFilter === "placeni" ? "#16a34a" : "#9ca3af",
                  padding: "8px 16px",
                }}
                onClick={() => setDugoviFilter("placeni")}
              >
                Plaćeni ({getAllDugovi().filter(d => d.placeno).length})
              </button>
            </div>

            {/* Tabela dugova */}
            {(() => {
              // Izračunaj širinu prve kolone na osnovu najdužeg imena dužnika
              const filteredDugovi = getFilteredDugovi();
              const maxLength = filteredDugovi.length > 0 
                ? Math.max(...filteredDugovi.map(dug => (dug.imeDuznika || "Nepoznato").length))
                : 0;
              // Aproksimacija: svaki karakter je ~6px, plus minimalni padding 12px
              const estimatedWidth = maxLength > 0 ? Math.max(70, Math.min(250, maxLength * 6 + 12)) : 90;
              const firstColumnWidth = `${estimatedWidth}px`;
              
              return (
              <div className="table-scroll-wrapper">
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th 
                        className={isMobile ? "sticky-first-column-header" : ""}
                        style={isMobile ? {
                          width: firstColumnWidth,
                          minWidth: firstColumnWidth,
                          maxWidth: firstColumnWidth,
                          paddingTop: thStyle.paddingTop,
                          paddingBottom: thStyle.paddingBottom,
                          paddingLeft: '4px',
                          paddingRight: '4px',
                          textAlign: thStyle.textAlign,
                          background: thStyle.background,
                          color: thStyle.color,
                          fontSize: thStyle.fontSize,
                          fontWeight: thStyle.fontWeight,
                          borderBottom: thStyle.borderBottom,
                        } : thStyle}
                      >
                        Ime dužnika
                      </th>
                      <th style={thStyle}>Iznos (KM)</th>
                      <th style={thStyle}>Količina</th>
                      <th style={thStyle}>Datum</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Datum plaćanja</th>
                      <th style={thStyle}>Akcija</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDugovi.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "#6b7280" }}>
                          Nema dugova za prikaz
                        </td>
                      </tr>
                    ) : (
                      filteredDugovi.map((dug, index) => (
                        <tr key={index}>
                          <td 
                            className={isMobile ? `sticky-first-column-row sticky-first-column-${index % 2 === 0 ? 'even' : 'odd'}` : ""}
                            style={isMobile ? {
                              width: firstColumnWidth,
                              minWidth: firstColumnWidth,
                              maxWidth: firstColumnWidth,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              paddingTop: tdStyle.paddingTop,
                              paddingBottom: tdStyle.paddingBottom,
                              paddingLeft: '4px',
                              paddingRight: '4px',
                              textAlign: tdStyle.textAlign,
                              borderBottom: tdStyle.borderBottom,
                              fontSize: tdStyle.fontSize,
                              color: tdStyle.color,
                            } : tdStyle}
                          >
                            <strong>{dug.imeDuznika || "Nepoznato"}</strong>
                          </td>
                        <td style={tdStyle}>{dug.iznos.toFixed(2)}</td>
                        <td style={tdStyle}>{dug.kolicina ? dug.kolicina.toString() : "-"}</td>
                        <td style={tdStyle}>{dug.datum}</td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              padding: "4px 12px",
                              borderRadius: "4px",
                              fontSize: "12px",
                              fontWeight: 600,
                              background: dug.placeno ? "#dcfce7" : "#fee2e2",
                              color: dug.placeno ? "#166534" : "#991b1b",
                            }}
                          >
                            {dug.placeno ? "✓ Plaćeno" : "✗ Neplaćeno"}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {dug.datumPlacanja ? (
                            <span style={{ color: "#16a34a", fontWeight: 500 }}>
                              {dug.datumPlacanja}
                            </span>
                          ) : (
                            <span style={{ color: "#9ca3af" }}>-</span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {!dug.placeno && (
                            <button
                              style={{
                                ...buttonStyle,
                                background: "#16a34a",
                                padding: "6px 12px",
                                fontSize: "12px",
                              }}
                              onClick={() => {
                                markDugAsPlacen(dug.obracunDatum, dug.rashodIndex);
                              }}
                            >
                              Označi kao plaćeno
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                    )}
                  </tbody>
                </table>
              </div>
              );
            })()}
          </div>
        </div>
      )}

      {arhiva.length === 0 ? (
        <p style={{ fontSize: "14px", color: "#6b7280", textAlign: "center", padding: "16px" }}>
          Nema arhiviranih obračuna.
        </p>
      ) : (
        <div>
          {arhiva.map((item, index) => {
            // Provjeri da li obračun ima ulaz - koristi flag imaUlaz (koji je sada pravilno postavljen)
            // ili provjeri direktno ulaz polje u artiklima
            const stvarnoImaUlaz = item.imaUlaz || (item.artikli && Array.isArray(item.artikli) && item.artikli.some((a) => {
              // Provjeri ulaz polje - ako postoji i nije 0, ima ulaz
              return (a.ulaz !== undefined && a.ulaz !== null && a.ulaz !== 0);
            }));
            
            // Odredi stil na osnovu flagova - koristi flag imaUlaz ili stvarni ulaz
            let containerStyle = obracunContainerStyle;
            if (stvarnoImaUlaz) {
              containerStyle = obracunContainerUlazStyle; // Žuta za ulaz
            } else if (item.isAzuriran) {
              containerStyle = obracunContainerAzuriranStyle; // Narandžasta za ažurirane
            }

            return (
            <div
              key={index}
              ref={obracunRefs.current[item.datum]!}
              style={containerStyle}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937" }}>
                  Obračun - {formatDatumSaSatima(item.datum, item.createdAt)}
                  {stvarnoImaUlaz && (
                    <span style={{ fontSize: "14px", color: "#eab308", fontWeight: 500, marginLeft: "8px" }}>
                      (Ima ulaz)
                    </span>
                  )}
                  {item.isAzuriran && !stvarnoImaUlaz && (
                    <span style={{ fontSize: "14px", color: "#f59e0b", fontWeight: 500, marginLeft: "8px" }}>
                      (Ažurirano)
                    </span>
                  )}
                  {item.invoiceImages && item.invoiceImages.length > 0 && (
                    <span style={{ fontSize: "14px", color: "#8b5cf6", fontWeight: 500, marginLeft: "8px" }}>
                      📸 {item.invoiceImages.length} {item.invoiceImages.length === 1 ? "faktura" : "faktura"}
                    </span>
                  )}
                </h2>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {item.invoiceImages && item.invoiceImages.length > 0 ? (
                    <button
                      style={{
                        ...buttonStyle,
                        background: "#8b5cf6",
                        padding: "8px 16px",
                        fontSize: "14px",
                        maxWidth: "160px",
                      }}
                      onClick={() => openSingleObracunFaktureModal(item.datum)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#7c3aed";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#8b5cf6";
                      }}
                    >
                      📸 Pregled fakture
                    </button>
                  ) : stvarnoImaUlaz ? (
                    <label
                      style={{
                        ...buttonStyle,
                        background: "#3b82f6",
                        padding: "8px 16px",
                        fontSize: "14px",
                        maxWidth: "160px",
                        cursor: "pointer",
                        margin: 0
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#2563eb";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#3b82f6";
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length > 0) {
                            uploadInvoiceImagesInArchive(item.datum, files);
                          }
                          e.target.value = ""; // Reset input
                        }}
                        style={{ display: "none" }}
                      />
                      📸 Dodaj slike fakture
                    </label>
                  ) : null}
                  <button
                    style={{ ...buttonStyle, background: "#10b981", maxWidth: "160px" }}
                    className="edit-button"
                    onClick={() => startEditingObracun(item.datum, item.rashodi, item.prihodi)}
                  >
                    Uredi obračun
                  </button>
                  <button
                    style={deleteButtonStyle}
                    className="delete-button"
                    onClick={() => handleDeleteObracun(item.datum)}
                  >
                    Obriši obračun
                  </button>
                </div>
              </div>

              {/* Upload slika faktura - prikazuje se za obračune sa ulazom, ali se sakriva ako već ima slike */}

              {/* Obrazac za uređivanje rashoda i prihoda */}
              {editingObracunDatum === item.datum && (
                <div style={editFormStyle} className="edit-form">
                  <h3 style={{ fontSize: "16px", fontWeight: 500, marginBottom: "12px" }}>
                    Uređivanje rashoda
                  </h3>
                  {editedRashodi.map((rashod, i) => (
                    <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                      <input
                        type="text"
                        value={rashod.naziv}
                        onChange={(e) => handleRashodChange(i, "naziv", e.target.value)}
                        style={inputStyle}
                        placeholder="Naziv rashoda"
                      />
                      <input
                        type="number"
                        value={rashod.cijena}
                        onChange={(e) => handleRashodChange(i, "cijena", e.target.value)}
                        style={inputStyle}
                        placeholder="Cijena"
                        step="0.01"
                      />
                      <label style={{ display: "flex", alignItems: "center", fontSize: "14px" }}>
                        <input
                          type="checkbox"
                          checked={rashod.placeno ?? false}
                          onChange={(e) => handleRashodChange(i, "placeno", e.target.checked)}
                          style={checkboxStyle}
                        />
                        Plaćeno
                      </label>
                    </div>
                  ))}
                  <h3 style={{ fontSize: "16px", fontWeight: 500, marginBottom: "12px", marginTop: "16px" }}>
                    Uređivanje prihoda
                  </h3>
                  {editedPrihodi.map((prihod, i) => (
                    <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                      <input
                        type="text"
                        value={prihod.naziv}
                        onChange={(e) => handlePrihodChange(i, "naziv", e.target.value)}
                        style={inputStyle}
                        placeholder="Naziv prihoda"
                      />
                      <input
                        type="number"
                        value={prihod.cijena}
                        onChange={(e) => handlePrihodChange(i, "cijena", e.target.value)}
                        style={inputStyle}
                        placeholder="Cijena"
                        step="0.01"
                      />
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <button
                      style={buttonStyle}
                      onClick={() => saveEditedObracun(item.datum)}
                    >
                      Spremi
                    </button>
                    <button
                      style={{ ...buttonStyle, background: "#6b7280" }}
                      onClick={cancelEditing}
                    >
                      Odustani
                    </button>
                  </div>
                </div>
              )}

              {/* Artikli */}
              <h3 style={{ fontSize: "16px", fontWeight: 500, color: "#1f2937", marginBottom: "8px" }}>
                Artikli
              </h3>
              <div className="table-scroll-wrapper">
                {(() => {
                  // Izračunaj širinu prve kolone jednom na osnovu najdužeg imena
                  const artikli = item.artikli && Array.isArray(item.artikli) ? item.artikli : [];
                  const maxLength = artikli.length > 0 ? Math.max(...artikli.map(art => (art.naziv || '').length)) : 0;
                  // Aproksimacija: svaki karakter je ~6px, plus minimalni padding 12px
                  const estimatedWidth = maxLength > 0 ? Math.max(70, Math.min(250, maxLength * 6 + 12)) : 90;
                  const firstColumnWidth = `${estimatedWidth}px`;
                  
                  return (
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th 
                        className={isMobile ? "sticky-first-column-header" : ""}
                        style={isMobile ? {
                          width: firstColumnWidth,
                          minWidth: firstColumnWidth,
                          maxWidth: firstColumnWidth,
                          paddingTop: thStyle.paddingTop,
                          paddingBottom: thStyle.paddingBottom,
                          paddingLeft: '4px',
                          paddingRight: '4px',
                          textAlign: thStyle.textAlign,
                          background: thStyle.background,
                          color: thStyle.color,
                          fontSize: thStyle.fontSize,
                          fontWeight: thStyle.fontWeight,
                          borderBottom: thStyle.borderBottom,
                        } : thStyle}
                      >
                        Artikal
                      </th>
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
                    {artikli.map((a, i) => (
                      <tr key={i}>
                        <td 
                          className={isMobile ? `sticky-first-column-row sticky-first-column-${i % 2 === 0 ? 'even' : 'odd'}` : ""}
                          style={isMobile ? {
                            width: firstColumnWidth,
                            minWidth: firstColumnWidth,
                            maxWidth: firstColumnWidth,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            paddingTop: tdStyle.paddingTop,
                            paddingBottom: tdStyle.paddingBottom,
                            paddingLeft: '4px',
                            paddingRight: '4px',
                            textAlign: tdStyle.textAlign,
                            borderBottom: tdStyle.borderBottom,
                            fontSize: tdStyle.fontSize,
                            color: tdStyle.color,
                          } : tdStyle}
                        >
                          {a.naziv}
                        </td>
                        <td style={tdStyle}>{a.cijena?.toFixed(2) ?? "-"}</td>
                        <td style={tdStyle}>{a.zestokoKolicina?.toFixed(3) ?? "-"}</td>
                        <td style={tdStyle}>{a.proizvodnaCijena?.toFixed(2) ?? "-"}</td>
                        <td style={tdStyle}>
                          {a.pocetnoStanje ?? "-"}
                          {a.staroPocetnoStanje !== undefined && a.staroPocetnoStanje !== a.pocetnoStanje && (
                            <span style={{ color: "#eab308", marginLeft: "4px", fontSize: "12px" }}>
                              ({a.staroPocetnoStanje})
                            </span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {(() => {
                            // Prioritet: 1. ulaz, 2. sačuvanUlaz
                            // Provjeri da li postoji ulaz (može biti 0, negativan ili pozitivan)
                            let ulazZaPrikaz = 0;
                            
                            // Prvo provjeri ulaz (može biti 0, negativan ili pozitivan)
                            if (a.ulaz !== undefined && a.ulaz !== null && a.ulaz !== 0) {
                              ulazZaPrikaz = a.ulaz;
                            } 
                            // Ako ulaz nije postavljen ili je 0, provjeri sačuvanUlaz
                            else if (a.sačuvanUlaz !== undefined && a.sačuvanUlaz !== null && a.sačuvanUlaz !== 0) {
                              ulazZaPrikaz = a.sačuvanUlaz;
                            }
                            
                            // Prikaži ulaz ako postoji (može biti i negativan)
                            return ulazZaPrikaz !== 0 ? ulazZaPrikaz : "-";
                          })()}
                        </td>
                        <td style={tdStyle}>{a.ukupno ?? "-"}</td>
                        <td style={tdStyle}>{a.utroseno ?? "-"}</td>
                        <td style={tdStyle}>
                          {(() => {
                            // Ako nije postavljeno krajnje stanje ili je 0, prikaži ukupno (ili početno ako nema ukupnog)
                            if (a.krajnjeStanje !== undefined && a.krajnjeStanje !== null && a.krajnjeStanje > 0) {
                              return a.krajnjeStanje;
                            } else if (a.ukupno !== undefined && a.ukupno !== null && a.ukupno > 0) {
                              return a.ukupno;
                            } else if (a.pocetnoStanje !== undefined && a.pocetnoStanje !== null && a.pocetnoStanje > 0) {
                              return a.pocetnoStanje;
                            }
                            return "-";
                          })()}
                        </td>
                        <td style={tdStyle}>{a.vrijednostKM !== undefined && a.vrijednostKM !== null ? a.vrijednostKM.toFixed(2) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                );
                })()}
              </div>

              {/* Rashodi */}
              <h3 style={{ fontSize: "16px", fontWeight: 500, color: "#1f2937", marginBottom: "8px" }}>
                Rashodi
              </h3>
              {(() => {
                // Izračunaj širinu prve kolone na osnovu najdužeg naziva rashoda
                const rashodi = item.rashodi && Array.isArray(item.rashodi) ? item.rashodi : [];
                const maxLength = rashodi.length > 0 
                  ? Math.max(...rashodi.map(rashod => (rashod.naziv || '').length))
                  : 0;
                // Aproksimacija: svaki karakter je ~6px, plus minimalni padding 12px
                const estimatedWidth = maxLength > 0 ? Math.max(70, Math.min(250, maxLength * 6 + 12)) : 90;
                const firstColumnWidth = `${estimatedWidth}px`;
                
                return (
                <div className="table-scroll-wrapper">
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th 
                          className={isMobile ? "sticky-first-column-header" : ""}
                          style={isMobile ? {
                            width: firstColumnWidth,
                            minWidth: firstColumnWidth,
                            maxWidth: firstColumnWidth,
                            paddingTop: thStyle.paddingTop,
                            paddingBottom: thStyle.paddingBottom,
                            paddingLeft: '4px',
                            paddingRight: '4px',
                            textAlign: thStyle.textAlign,
                            background: thStyle.background,
                            color: thStyle.color,
                            fontSize: thStyle.fontSize,
                            fontWeight: thStyle.fontWeight,
                            borderBottom: thStyle.borderBottom,
                          } : thStyle}
                        >
                          Naziv
                        </th>
                        <th style={thStyle}>Cijena</th>
                        <th style={thStyle}>Plaćeno</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rashodi.map((r, i) => (
                        <tr key={i}>
                          <td 
                            className={isMobile ? `sticky-first-column-row sticky-first-column-${i % 2 === 0 ? 'even' : 'odd'}` : ""}
                            style={isMobile ? {
                              width: firstColumnWidth,
                              minWidth: firstColumnWidth,
                              maxWidth: firstColumnWidth,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              paddingTop: tdStyle.paddingTop,
                              paddingBottom: tdStyle.paddingBottom,
                              paddingLeft: '4px',
                              paddingRight: '4px',
                              textAlign: tdStyle.textAlign,
                              borderBottom: tdStyle.borderBottom,
                              fontSize: tdStyle.fontSize,
                              color: tdStyle.color,
                            } : tdStyle}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span>{r.naziv}</span>
                              {r.imageUrl && (
                                <span
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      const normalizedUrl = normalizeImageUrl(r.imageUrl!);
                                      const token = getAuthToken();
                                      if (!token) {
                                        alert('Niste prijavljeni!');
                                        return;
                                      }
                                      
                                      const response = await fetch(normalizedUrl, {
                                        headers: {
                                          'Authorization': `Bearer ${token}`,
                                        },
                                      });
                                      
                                      if (!response.ok) {
                                        if (response.status === 404) {
                                          alert('Slika nije pronađena. Možda je obrisana ili premještena.');
                                          return;
                                        }
                                        throw new Error(`Failed to fetch image: ${response.status}`);
                                      }
                                      
                                      const blob = await response.blob();
                                      const blobUrl = URL.createObjectURL(blob);
                                      const newWindow = window.open(blobUrl, "_blank");
                                      
                                      if (!newWindow) {
                                        URL.revokeObjectURL(blobUrl);
                                        alert('Popup blocker je blokirao otvaranje slike. Molimo dozvolite popup-ove za ovaj sajt.');
                                        return;
                                      }
                                      
                                      setTimeout(() => {
                                        try {
                                          URL.revokeObjectURL(blobUrl);
                                        } catch (e) {}
                                      }, 1000);
                                    } catch (error: any) {
                                      console.error('Error opening image:', error);
                                      alert('Greška pri otvaranju slike: ' + (error.message || 'Nepoznata greška'));
                                    }
                                  }}
                                  style={{
                                    cursor: "pointer",
                                    fontSize: "24px",
                                    padding: "4px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                  }}
                                  title="Pregled fakture"
                                >
                                  📸
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={tdStyle}>{r.cijena !== undefined && r.cijena !== null ? r.cijena.toFixed(2) : "-"}</td>
                          <td style={tdStyle}>{r.placeno ? "Da" : "Ne"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                );
              })()}

              {/* Prihodi */}
              <h3 style={{ fontSize: "16px", fontWeight: 500, color: "#1f2937", marginBottom: "8px" }}>
                Prihodi
              </h3>
              <div className="table-scroll-wrapper">
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Naziv</th>
                      <th style={thStyle}>Cijena</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(item.prihodi && Array.isArray(item.prihodi) ? item.prihodi : []).map((p, i) => (
                      <tr key={i}>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>{p.naziv}</span>
                            {p.imageUrl && (
                              <span
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    const normalizedUrl = normalizeImageUrl(p.imageUrl!);
                                    const token = getAuthToken();
                                    if (!token) {
                                      alert('Niste prijavljeni!');
                                      return;
                                    }
                                    
                                    const response = await fetch(normalizedUrl, {
                                      headers: {
                                        'Authorization': `Bearer ${token}`,
                                      },
                                    });
                                    
                                    if (!response.ok) {
                                      if (response.status === 404) {
                                        alert('Slika nije pronađena. Možda je obrisana ili premještena.');
                                        return;
                                      }
                                      throw new Error(`Failed to fetch image: ${response.status}`);
                                    }
                                    
                                    const blob = await response.blob();
                                    const blobUrl = URL.createObjectURL(blob);
                                    const newWindow = window.open(blobUrl, "_blank");
                                    
                                    if (!newWindow) {
                                      URL.revokeObjectURL(blobUrl);
                                      alert('Popup blocker je blokirao otvaranje slike. Molimo dozvolite popup-ove za ovaj sajt.');
                                      return;
                                    }
                                    
                                    setTimeout(() => {
                                      try {
                                        URL.revokeObjectURL(blobUrl);
                                      } catch (e) {}
                                    }, 1000);
                                  } catch (error: any) {
                                    console.error('Error opening image:', error);
                                    alert('Greška pri otvaranju slike: ' + (error.message || 'Nepoznata greška'));
                                  }
                                }}
                                style={{
                                  cursor: "pointer",
                                  fontSize: "24px",
                                  padding: "4px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center"
                                }}
                                title="Pregled fakture"
                              >
                                📸
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={tdStyle}>{p.cijena !== undefined && p.cijena !== null ? p.cijena.toFixed(2) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Ukupno */}
              <div style={{ fontSize: "16px", color: "#1f2937", marginTop: "16px", fontWeight: 600 }}>
                <div style={{ marginBottom: "12px", color: "#0284c7" }}>
                  <strong>Ukupno artikli:</strong> {(item.ukupnoArtikli !== undefined && item.ukupnoArtikli !== null ? item.ukupnoArtikli.toFixed(2) : "0.00")} KM
                </div>
                <div style={{ marginBottom: "12px", color: "#dc2626" }}>
                  <strong>Ukupno rashod:</strong> {(item.ukupnoRashod !== undefined && item.ukupnoRashod !== null ? item.ukupnoRashod.toFixed(2) : "0.00")} KM
                </div>
                <div style={{ marginBottom: "12px", color: "#15803d" }}>
                  <strong>Ukupno prihod:</strong> {(item.ukupnoPrihod !== undefined && item.ukupnoPrihod !== null ? item.ukupnoPrihod.toFixed(2) : "0.00")} KM
                </div>
                <div style={{ color: (item.neto !== undefined && item.neto !== null && item.neto >= 0) ? "#15803d" : "#dc2626" }}>
                  <strong>Neto:</strong> {(item.neto !== undefined && item.neto !== null ? item.neto.toFixed(2) : "0.00")} KM
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}