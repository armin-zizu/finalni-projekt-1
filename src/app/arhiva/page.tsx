"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { auth, onAuthStateChanged } from "../../lib/firebase";
import { db, storage } from "../../lib/firebase";
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

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
};

type Prihod = {
  naziv: string;
  cijena: number;
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
  overflow: "hidden",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
  marginBottom: "20px",
};

const thStyle: React.CSSProperties = {
  padding: "16px",
  textAlign: "left" as "left",
  background: "#f8fafc",
  color: "#1f2937",
  fontSize: "14px",
  fontWeight: 600,
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle: React.CSSProperties = {
  padding: "16px",
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
};

// ---- Glavna komponenta ----
export default function ArhivaPage() {
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
  const obracunRefs = useRef<{ [key: string]: React.RefObject<HTMLDivElement | null> }>({});

  // Funkcija za učitavanje arhive - HIBRIDNI PRISTUP
  const loadArhiva = React.useCallback(async () => {
    const user = auth.currentUser;
    const userId = user?.uid;
    
    let firestoreArhiva: ArhiviraniObracun[] = [];
    
    // UČITAJ IZ FIRESTORE (samo izvor)
    if (user && userId) {
      try {
        const obracuniRef = collection(db, "users", userId, "obracuni");
        const snapshot = await getDocs(obracuniRef);
        firestoreArhiva = snapshot.docs.map((doc) => {
          const data = doc.data();
          const invoiceImages = data.invoiceImages ?? [];
          if (invoiceImages.length > 0) {
            console.log(`Obračun ${doc.id} ima ${invoiceImages.length} slika faktura`);
          }
          return {
            ...data,
            prihodi: data.prihodi ?? [],
            ukupnoPrihod: data.ukupnoPrihod ?? 0,
            imaUlaz: data.imaUlaz ?? false,
            isAzuriran: data.isAzuriran ?? false,
            invoiceImages: invoiceImages,
          } as ArhiviraniObracun;
        });
        console.log("Učitano iz Firestore:", firestoreArhiva.length, "obračuna");
      } catch (error: any) {
        const errorCode = error?.code || "";
        if (errorCode !== "permission-denied" && !errorCode.includes("permission") && !errorCode.includes("insufficient")) {
          console.warn("Greška pri učitavanju iz Firestore:", error);
        }
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

  // Učitavanje arhive iz Firestore
  useEffect(() => {
    loadArhiva();
  }, [loadArhiva]);

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

  // Brisanje obračuna - HIBRIDNI PRISTUP
  const deleteObracun = async (datum: string) => {
    if (window.confirm(`Jeste li sigurni da želite obrisati obračun za ${datum}?`)) {
      const user = auth.currentUser;
      const userId = user?.uid;
      
      // 1. Obriši iz Firestore
      if (user && userId) {
        try {
          const docRef = doc(db, "users", userId, "obracuni", datum);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            await deleteDoc(docRef);
            console.log("Obračun obrisan iz Firestore:", datum);
          }
        } catch (error: any) {
          console.warn("Greška pri brisanju iz Firestore:", error);
        }
      }
      
      // 2. Obriši iz lokalnog state-a (real-time listener će automatski osvježiti)
      const filteredArhiva = arhiva.filter((item) => item.datum !== datum);
      setArhiva(filteredArhiva);
      
      // 3. NE SPREMAJ U LOCALSTORAGE - sve je u Firestore
      // Real-time listener automatski osvježava arhivu
      
      delete obracunRefs.current[datum];
      setEditingObracunDatum(null);
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
    const updatedArhiva = arhiva
      .map((item) => {
        if (item.datum === datum) {
          const ukupnoRashod = editedRashodi.reduce((sum, r) => sum + r.cijena, 0);
          const ukupnoPrihod = editedPrihodi.reduce((sum, p) => sum + p.cijena, 0);
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
    
    // Spremi u Firestore
    const user = auth.currentUser;
    const userId = user?.uid;
    if (user && userId) {
      try {
        const obracunToUpdate = updatedArhiva.find(o => o.datum === datum);
        if (obracunToUpdate) {
          const cleanedObracun = removeUndefined(obracunToUpdate);
          const docRef = doc(db, "users", userId, "obracuni", datum);
          await setDoc(docRef, cleanedObracun, { merge: true });
          console.log("Obračun ažuriran u Firestore:", datum);
        }
      } catch (error: any) {
        console.warn("Greška pri spremanju u Firestore:", error);
      }
    }
    
    setEditingObracunDatum(null);
    setEditedRashodi([]);
    setEditedPrihodi([]);
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
          });
        }
      });
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
    const obracun = arhiva.find(o => o.datum === datum);
    let images: string[] = [];
    
    // Prvo provjeri u arhivi
    if (obracun && obracun.invoiceImages && obracun.invoiceImages.length > 0) {
      images = obracun.invoiceImages;
    }
    
    // Također provjeri direktno u Firestore (za obračune koji možda još nisu u arhivi)
    const user = auth.currentUser;
    const userId = user?.uid;
    if (userId) {
      try {
        const obracunRef = doc(db, "users", userId, "obracuni", datum);
        const obracunDoc = await getDoc(obracunRef);
        if (obracunDoc.exists()) {
          const data = obracunDoc.data();
          if (data.invoiceImages && data.invoiceImages.length > 0) {
            images = data.invoiceImages;
          }
        }
      } catch (error) {
        console.warn("Greška pri učitavanju faktura iz Firestore:", error);
      }
    }
    
    if (images.length > 0) {
      return [{
        datum: datum,
        images: images,
      }];
    }
    return [];
  };

  // Funkcija za otvaranje modala sa svim faktorama
  const openAllFaktureModal = () => {
    setFaktureModalMode("all");
    setSingleObracunDatum(null);
    setSelectedFakturaDatum(null);
    setSelectedFakturaImages([]);
    setShowFaktureModal(true);
    setShowModalUploadInput(false);
    setModalInvoiceFiles([]);
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

  // Funkcija za upload slika faktura u arhivi
  const uploadInvoiceImagesInArchive = async (datum: string, files?: File[]) => {
    const filesToUpload = files || invoiceFiles[datum] || [];
    if (filesToUpload.length === 0) return;
    
    const user = auth.currentUser;
    if (!user) {
      alert("Korisnik nije autentifikovan");
      return;
    }
    
    const userId = user.uid;
    
    try {
      await user.getIdToken(true); // Refresh token
    } catch (authError) {
      console.error("Greška pri autentifikaciji:", authError);
      alert("Greška pri autentifikaciji. Molimo prijavite se ponovo.");
      return;
    }

    const cleanDatumString = datum.replace(/\.$/, '');
    const uploadedUrls: string[] = [];
    setUploadingImagesForDatum(datum);
    setUploadProgress(0);

    try {
      // Učitaj postojeće slike iz obračuna
      const obracun = arhiva.find(o => o.datum === datum);
      const existingImages = obracun?.invoiceImages || [];

      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const fileName = `${cleanDatumString}_${timestamp}_${i}.${fileExtension}`;
        const storagePath = `users/${userId}/invoices/${cleanDatumString}/${fileName}`;
        const storageRef = ref(storage, storagePath);
        
        const metadata = {
          contentType: file.type || `image/${fileExtension}`,
          customMetadata: {
            uploadedBy: userId,
            uploadedAt: new Date().toISOString(),
            datum: datum,
          }
        };
        
        await uploadBytes(storageRef, file, metadata);
        const downloadURL = await getDownloadURL(storageRef);
        uploadedUrls.push(downloadURL);
        
        setUploadProgress(((i + 1) / filesToUpload.length) * 100);
      }

      // Kombinuj postojeće i nove slike
      const allImages = [...existingImages, ...uploadedUrls];

      // Ažuriraj obračun u arhivi
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

      // Spremi u Firestore
      if (user && userId) {
        try {
          const obracunToUpdate = updatedArhiva.find(o => o.datum === datum);
          if (obracunToUpdate) {
            const cleanedObracun = removeUndefined(obracunToUpdate);
            const docRef = doc(db, "users", userId, "obracuni", datum);
            await setDoc(docRef, cleanedObracun, { merge: true });
            console.log("Slike faktura ažurirane u Firestore:", datum);
          }
        } catch (error: any) {
          console.warn("Greška pri spremanju u Firestore:", error);
          alert("Slike su upload-ovane, ali greška pri spremanju u bazu. Provjerite konzolu.");
        }
      }

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

  // Funkcija za upload slika iz modala
  const uploadInvoiceImagesInModal = async (datum: string) => {
    if (modalInvoiceFiles.length === 0) return;
    
    const user = auth.currentUser;
    if (!user) {
      alert("Korisnik nije autentifikovan");
      return;
    }
    
    const userId = user.uid;
    
    try {
      await user.getIdToken(true);
    } catch (authError) {
      console.error("Greška pri autentifikaciji:", authError);
      alert("Greška pri autentifikaciji. Molimo prijavite se ponovo.");
      return;
    }

    const cleanDatumString = datum.replace(/\.$/, '');
    const uploadedUrls: string[] = [];
    setUploadingImagesForDatum(datum);
    setUploadProgress(0);

    try {
      // Učitaj postojeće slike iz obračuna
      const obracun = arhiva.find(o => o.datum === datum);
      const existingImages = obracun?.invoiceImages || [];

      for (let i = 0; i < modalInvoiceFiles.length; i++) {
        const file = modalInvoiceFiles[i];
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const fileName = `${cleanDatumString}_${timestamp}_${i}.${fileExtension}`;
        const storagePath = `users/${userId}/invoices/${cleanDatumString}/${fileName}`;
        const storageRef = ref(storage, storagePath);
        
        const metadata = {
          contentType: file.type || `image/${fileExtension}`,
          customMetadata: {
            uploadedBy: userId,
            uploadedAt: new Date().toISOString(),
            datum: datum,
          }
        };
        
        await uploadBytes(storageRef, file, metadata);
        const downloadURL = await getDownloadURL(storageRef);
        uploadedUrls.push(downloadURL);
        
        setUploadProgress(((i + 1) / modalInvoiceFiles.length) * 100);
      }

      // Kombinuj postojeće i nove slike
      const allImages = [...existingImages, ...uploadedUrls];

      // Ažuriraj obračun u arhivi
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

      // Spremi u Firestore
      if (user && userId) {
        try {
          const obracunToUpdate = updatedArhiva.find(o => o.datum === datum);
          if (obracunToUpdate) {
            const cleanedObracun = removeUndefined(obracunToUpdate);
            const docRef = doc(db, "users", userId, "obracuni", datum);
            await setDoc(docRef, cleanedObracun, { merge: true });
            console.log("Slike faktura ažurirane u Firestore:", datum);
          }
        } catch (error: any) {
          console.warn("Greška pri spremanju u Firestore:", error);
          alert("Slike su upload-ovane, ali greška pri spremanju u bazu. Provjerite konzolu.");
        }
      }

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

  // Funkcija za brisanje slike iz modala
  const deleteInvoiceImage = async (datum: string, imageIndex: number) => {
    if (!confirm("Da li ste sigurni da želite obrisati ovu sliku?")) {
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      alert("Korisnik nije autentifikovan");
      return;
    }
    
    const userId = user.uid;

    try {
      // Učitaj obračun
      const obracun = arhiva.find(o => o.datum === datum);
      if (!obracun || !obracun.invoiceImages) {
        return;
      }

      // Ukloni sliku iz liste
      const updatedImages = obracun.invoiceImages.filter((_, index) => index !== imageIndex);

      // Ažuriraj obračun u arhivi
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

      // Spremi u Firestore
      try {
        const obracunToUpdate = updatedArhiva.find(o => o.datum === datum);
        if (obracunToUpdate) {
          const cleanedObracun = removeUndefined(obracunToUpdate);
          const docRef = doc(db, "users", userId, "obracuni", datum);
          await setDoc(docRef, cleanedObracun, { merge: true });
          console.log("Slika obrisana iz Firestore:", datum);
        }
      } catch (error: any) {
        console.warn("Greška pri spremanju u Firestore:", error);
        alert("Slika je obrisana, ali greška pri spremanju u bazu. Provjerite konzolu.");
      }

      alert("Slika je uspješno obrisana!");
    } catch (error: any) {
      console.error("Greška pri brisanju slike:", error);
      alert("Greška pri brisanju slike. Provjerite konzolu za detalje.");
    }
  };

  // Funkcija za označavanje duga kao plaćenog
  const markDugAsPlacen = async (obracunDatum: string, rashodIndex: number) => {
    const user = auth.currentUser;
    const userId = user?.uid;
    
    const updatedArhiva = arhiva.map((obracun) => {
      if (obracun.datum === obracunDatum) {
        const updatedRashodi = obracun.rashodi.map((rashod, index) => {
          if (index === rashodIndex) {
            return { ...rashod, placeno: true };
          }
          return rashod;
        });
        return { ...obracun, rashodi: updatedRashodi };
      }
      return obracun;
    });
    setArhiva(updatedArhiva);
    
    // Spremi u Firestore
    if (user && userId) {
      try {
        const obracunToUpdate = updatedArhiva.find(o => o.datum === obracunDatum);
        if (obracunToUpdate) {
          const cleanedObracun = removeUndefined(obracunToUpdate);
          const docRef = doc(db, "users", userId, "obracuni", obracunDatum);
          await setDoc(docRef, cleanedObracun, { merge: true });
        }
      } catch (error: any) {
        console.warn("Greška pri spremanju u Firestore:", error);
      }
    }
  };

  return (
    <div style={containerStyle}>
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
                  <div
                    key={index}
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
                ));
              })()}
            </div>

            {/* Prikaz slika odabrane fakture */}
            {selectedFakturaDatum && selectedFakturaImages.length > 0 && (
              <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid #e5e7eb" }}>
                <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "16px" }}>
                  Slike fakture - {selectedFakturaDatum}
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
                          {modalInvoiceFiles.map((file, index) => (
                            <div 
                              key={index} 
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
                                alt={`Preview ${index + 1}`}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover"
                                }}
                              />
                              <button
                                onClick={() => setModalInvoiceFiles(prev => prev.filter((_, i) => i !== index))}
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
                  {selectedFakturaImages.map((imageUrl, index) => (
                    <div key={index} style={{ position: "relative" }}>
                      <img
                        src={imageUrl}
                        alt={`Faktura ${selectedFakturaDatum} - ${index + 1}`}
                        style={{
                          width: "100%",
                          height: "200px",
                          objectFit: "cover",
                          borderRadius: "8px",
                          border: "1px solid #e5e7eb",
                          cursor: "pointer",
                        }}
                        onClick={() => window.open(imageUrl, "_blank")}
                      />
                      <button
                        onClick={() => {
                          if (selectedFakturaDatum) {
                            deleteInvoiceImage(selectedFakturaDatum, index);
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
                  ))}
                </div>
              </div>
            )}
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
            <div className="table-scroll-wrapper">
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Ime dužnika</th>
                    <th style={thStyle}>Iznos (KM)</th>
                    <th style={thStyle}>Količina</th>
                    <th style={thStyle}>Datum</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Akcija</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredDugovi().length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "#6b7280" }}>
                        Nema dugova za prikaz
                      </td>
                    </tr>
                  ) : (
                    getFilteredDugovi().map((dug, index) => (
                      <tr key={index}>
                        <td style={tdStyle}>
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
            const stvarnoImaUlaz = item.imaUlaz || item.artikli.some((a) => {
              // Provjeri ulaz polje - ako postoji i nije 0, ima ulaz
              return (a.ulaz !== undefined && a.ulaz !== null && a.ulaz !== 0);
            });
            
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
                  Obračun - {item.datum}
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
                    onClick={() => deleteObracun(item.datum)}
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
                    {item.artikli.map((a, i) => (
                      <tr key={i}>
                        <td style={tdStyle}>{a.naziv}</td>
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
                        <td style={tdStyle}>{a.vrijednostKM.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Rashodi */}
              <h3 style={{ fontSize: "16px", fontWeight: 500, color: "#1f2937", marginBottom: "8px" }}>
                Rashodi
              </h3>
              <div className="table-scroll-wrapper">
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Naziv</th>
                      <th style={thStyle}>Cijena</th>
                      <th style={thStyle}>Plaćeno</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.rashodi.map((r, i) => (
                      <tr key={i}>
                        <td style={tdStyle}>{r.naziv}</td>
                        <td style={tdStyle}>{r.cijena.toFixed(2)}</td>
                        <td style={tdStyle}>{r.placeno ? "Da" : "Ne"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

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
                    {item.prihodi.map((p, i) => (
                      <tr key={i}>
                        <td style={tdStyle}>{p.naziv}</td>
                        <td style={tdStyle}>{p.cijena.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Ukupno */}
              <div style={{ fontSize: "16px", color: "#1f2937", marginTop: "16px", fontWeight: 600 }}>
                <div style={{ marginBottom: "12px", color: "#0284c7" }}>
                  <strong>Ukupno artikli:</strong> {item.ukupnoArtikli.toFixed(2)} KM
                </div>
                <div style={{ marginBottom: "12px", color: "#dc2626" }}>
                  <strong>Ukupno rashod:</strong> {item.ukupnoRashod.toFixed(2)} KM
                </div>
                <div style={{ marginBottom: "12px", color: "#15803d" }}>
                  <strong>Ukupno prihod:</strong> {item.ukupnoPrihod.toFixed(2)} KM
                </div>
                <div style={{ color: item.neto >= 0 ? "#15803d" : "#dc2626" }}>
                  <strong>Neto:</strong> {item.neto.toFixed(2)} KM
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