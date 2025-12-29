"use client";

import React, { useState, useEffect } from "react";
import { useCjenovnik } from "../context/CjenovnikContext";
import { useRole } from "../context/RoleContext";
import { usePathname } from "next/navigation";
import { saveCjenovnik } from "../../lib/api";
import { FaTrash, FaPlus, FaArrowUp, FaArrowDown, FaGripVertical } from "react-icons/fa";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
// TEMPORARY: Firebase imports disabled during migration
// import { auth, onAuthStateChanged } from "../../lib/firebase";
// import { db } from "../../lib/firestore";
// import { doc, getDoc, setDoc } from "firebase/firestore";

// Mock objects for migration
const auth = { currentUser: null };
const onAuthStateChanged = (auth: any, callback: any) => {
  callback(null);
  return () => {};
};
const db = {} as any;
const doc = (db: any, collection: string, id: string) => ({ id, collection });
const getDoc = async (ref: any) => ({ exists: () => false, data: () => ({}) });
const setDoc = async (ref: any, data: any) => {};
import { encrypt, decrypt } from "../../lib/encryption";

// ---- Tipovi ----
type Artikl = {
  naziv: string;
  cijena: number;
  jeZestoko: boolean;
  pocetnoStanje: number;
  nabavnaCijena: number;
  zestokoKolicina?: number;
  proizvodnaCijena?: number;
  nabavnaCijenaFlase?: number;
  zapreminaFlase?: number;
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
  minWidth: "600px",
  borderCollapse: "separate" as "separate",
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

const inputStyle: React.CSSProperties = {
  width: "80px",
  padding: "8px",
  border: "1px solid #e5e7eb",
  borderRadius: "6px",
  textAlign: "center",
  fontSize: "14px",
  background: "#fff",
};

const formInputStyle: React.CSSProperties = {
  padding: "8px",
  border: "1px solid #e5e7eb",
  borderRadius: "6px",
  fontSize: "14px",
  marginRight: "8px",
  outline: "none",
  width: "120px",
};

const disabledInputStyle: React.CSSProperties = {
  ...formInputStyle,
  background: "#f3f4f6",
  cursor: "not-allowed",
};

const selectStyle: React.CSSProperties = {
  padding: "8px",
  border: "1px solid #e5e7eb",
  borderRadius: "6px",
  fontSize: "14px",
  marginRight: "8px",
  outline: "none",
  background: "#fff",
  width: "120px",
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
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const updateButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "#15803d", // Zeleno dugme za ažuriranje
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 500,
  marginTop: "10px",
};

const deleteButtonStyle: React.CSSProperties = {
  padding: "8px",
  background: "none",
  color: "#dc2626",
  border: "none",
  cursor: "pointer",
  fontSize: "14px",
};

const errorStyle: React.CSSProperties = {
  padding: "12px",
  background: "#fef2f2",
  color: "#dc2626",
  borderRadius: "6px",
  border: "1px solid #fee2e2",
  marginBottom: "16px",
  fontSize: "14px",
};

const checkboxStyle: React.CSSProperties = {
  width: "16px",
  height: "16px",
  marginRight: "8px",
};

// Sortable Row komponenta za desktop
function SortableRow({ 
  artikl, 
  isLowStock, 
  lowStockThresholdZestoka, 
  lowStockThresholdOstala, 
  lowStockEnabled,
  onDelete,
  tdStyle,
  deleteButtonStyle
}: {
  artikl: any;
  isLowStock: boolean;
  lowStockThresholdZestoka: string;
  lowStockThresholdOstala: string;
  lowStockEnabled: boolean;
  onDelete: (naziv: string) => void;
  tdStyle: React.CSSProperties;
  deleteButtonStyle: React.CSSProperties;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: artikl.naziv });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr 
      ref={setNodeRef}
      style={{
        ...style,
        ...(isLowStock ? { 
          backgroundColor: "#fef2f2",
          borderLeft: "4px solid #dc2626"
        } : {})
      }}
    >
      <td style={tdStyle}>
        {artikl.naziv}
      </td>
      <td style={tdStyle}>{artikl.cijena.toFixed(2)}</td>
      <td style={tdStyle}>{artikl.nabavnaCijena.toFixed(2)}</td>
      <td style={tdStyle}>
        {artikl.pocetnoStanje.toFixed(artikl.jeZestoko ? 2 : 0)}
        {artikl.jeZestoko ? " L" : " kom"}
      </td>
      <td style={tdStyle}>{artikl.jeZestoko ? (artikl.zestokoKolicina || 0).toFixed(2) : "-"}</td>
      <td style={tdStyle}>{artikl.jeZestoko ? (artikl.proizvodnaCijena || 0).toFixed(2) : "-"}</td>
      <td style={tdStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-start" }}>
          <button
            style={deleteButtonStyle}
            onClick={() => onDelete(artikl.naziv)}
            className="delete-button"
          >
            <FaTrash />
          </button>
          <div
            {...attributes}
            {...listeners}
            style={{
              cursor: "grab",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              color: "#6b7280",
            }}
          >
            <FaGripVertical />
          </div>
        </div>
      </td>
    </tr>
  );
}

// ---- Glavna komponenta ----
export default function CjenovnikPage() {
  const { cjenovnik, pendingCjenovnik, setCjenovnik, addArtikal, updateCjenovnik, refreshPrethodniCjenovnik } = useCjenovnik();

  const [newArtiklNaziv, setNewArtiklNaziv] = useState<string>("");
  const [newArtiklCijena, setNewArtiklCijena] = useState<string>("");
  const [newArtiklNabavnaCijena, setNewArtiklNabavnaCijena] = useState<string>("");
  const [newArtiklJeZestoko, setNewArtiklJeZestoko] = useState<boolean>(false);
  const [newArtiklZestokoKolicina, setNewArtiklZestokoKolicina] = useState<string>("0.03");
  const [newArtiklProizvodnaCijena, setNewArtiklProizvodnaCijena] = useState<string>("");
  const [newArtiklNabavnaCijenaFlase, setNewArtiklNabavnaCijenaFlase] = useState<string>("");
  const [newArtiklZapreminaFlase, setNewArtiklZapreminaFlase] = useState<string>("");
  const [newArtiklPocetnoStanje, setNewArtiklPocetnoStanje] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isPasswordProtected, setIsPasswordProtected] = useState<boolean | null>(null); // null = loading
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const [hasOrderChanges, setHasOrderChanges] = useState<boolean>(false); // Flag za promjenu redoslijeda
  const [savingOrder, setSavingOrder] = useState<boolean>(false); // Flag za spremanje
  const pathname = usePathname();

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
  const [lowStockThresholdZestoka, setLowStockThresholdZestoka] = useState<string>("100");
  const [lowStockThresholdOstala, setLowStockThresholdOstala] = useState<string>("10");
  const [savingLowStockSettings, setSavingLowStockSettings] = useState<boolean>(false);

  // TEMPORARY: Password protection disabled - TODO: Migrate to API
  useEffect(() => {
    setIsPasswordProtected(false);
  }, [pathname]);

  // TEMPORARY: Low stock settings disabled - TODO: Migrate to API
  useEffect(() => {
    // Low stock settings temporarily disabled during Firebase migration
    setLowStockEnabled(false);
  }, []);
  
  // Osiguraj da se upozorenja ažuriraju kada se cjenovnik promijeni
  useEffect(() => {
    // Ova promjena će automatski triggerati re-render sa novim upozorenjima
  }, [cjenovnik, lowStockEnabled, lowStockThresholdZestoka, lowStockThresholdOstala]);

  // TEMPORARY: Low stock settings disabled - TODO: Migrate to API
  const saveLowStockSettings = async () => {
    setError("Low stock settings trenutno nisu dostupne.");
  };

  // TEMPORARY: Password protection disabled - TODO: Migrate to API
  const handlePasswordSubmit = async () => {
    setPasswordError("Password protection trenutno nije dostupno.");
  };

  // ---- Drag & Drop funkcionalnost ----
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setCjenovnik((items) => {
        const oldIndex = items.findIndex((item) => item.naziv === active.id);
        const newIndex = items.findIndex((item) => item.naziv === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);
        // Ažuriraj displayOrder za sve artikle na osnovu novog redoslijeda
        const updatedItems = newItems.map((item, index) => ({
          ...item,
          displayOrder: index,
        }));
        return updatedItems;
      });
      // Postavi flag da ima promjena redoslijeda - VAN setCjenovnik callback-a
      setHasOrderChanges(true);
    }
  };

  // ---- Funkcije za premještanje artikala (mobilna verzija) ----
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setCjenovnik((items) => {
      const newItems = [...items];
      [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
      // Ažuriraj displayOrder za sve artikle na osnovu novog redoslijeda
      const updatedItems = newItems.map((item, idx) => ({
        ...item,
        displayOrder: idx,
      }));
      return updatedItems;
    });
    // Postavi flag da ima promjena redoslijeda - VAN setCjenovnik callback-a
    setHasOrderChanges(true);
  };

  const handleMoveDown = (index: number) => {
    if (index === cjenovnik.length - 1) return;
    setCjenovnik((items) => {
      const newItems = [...items];
      [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
      // Ažuriraj displayOrder za sve artikle na osnovu novog redoslijeda
      const updatedItems = newItems.map((item, idx) => ({
        ...item,
        displayOrder: idx,
      }));
      return updatedItems;
    });
    // Postavi flag da ima promjena redoslijeda - VAN setCjenovnik callback-a
    setHasOrderChanges(true);
  };

  // ---- Funkcija za čuvanje redoslijeda ----
  const { user } = useRole();
  const handleSaveOrder = async () => {
    if (savingOrder) return;
    
    setSavingOrder(true);
    try {
      const userId = user?.email || user?.id;
      if (!userId) {
        throw new Error("Korisnik nije autentifikovan");
      }

      // Transformiraj cjenovnik u format koji API očekuje sa displayOrder
      const apiCjenovnik = cjenovnik.map((item) => ({
        naziv: item.naziv,
        cijena: item.cijena,
        proizvodnaCijena: item.proizvodnaCijena,
        zestokoKolicina: item.zestokoKolicina,
        nabavnaCijena: item.nabavnaCijena,
        nabavnaCijenaFlase: item.nabavnaCijenaFlase,
        zapreminaFlase: item.zapreminaFlase,
        pocetnoStanje: item.pocetnoStanje,
        displayOrder: item.displayOrder !== null && item.displayOrder !== undefined ? item.displayOrder : null,
      }));

      console.log("💾 Spremanje redoslijeda - userId:", userId, "artikala:", apiCjenovnik.length);
      console.log("💾 DisplayOrder za artikle:", apiCjenovnik.map((a: any) => ({ naziv: a.naziv, displayOrder: a.displayOrder })));
      
      await saveCjenovnik(userId, apiCjenovnik);
      
      // Ažuriraj prethodniCjenovnikRef u contextu nakon uspješnog spremanja
      // Ovo će osigurati da automatsko čuvanje ne prepisuje promjene
      refreshPrethodniCjenovnik();
      
      setHasOrderChanges(false);
      alert("✅ Redoslijed artikala je sačuvan!");
    } catch (error: any) {
      console.error("Greška pri čuvanju redoslijeda:", error);
      alert(`Greška pri čuvanju redoslijeda: ${error.message || error}`);
    } finally {
      setSavingOrder(false);
    }
  };

  // ---- Automatski izračun nabavne cijene po dozi za žestoka pića ----
  const calculateNabavnaPoDozi = () => {
    const flasaL = parseFloat(newArtiklZapreminaFlase) || 1; // default 1L
    const nabavnaFlase = parseFloat(newArtiklNabavnaCijenaFlase) || 0;
    const dozaL = parseFloat(newArtiklZestokoKolicina) || 0.03;
    return (nabavnaFlase / flasaL) * dozaL;
  };

  // ---- Sinkronizacija cijena za žestoka pića ----
  useEffect(() => {
    if (newArtiklJeZestoko) {
      setNewArtiklCijena(newArtiklProizvodnaCijena);
      setNewArtiklNabavnaCijena(calculateNabavnaPoDozi().toFixed(2));
    } else {
      setNewArtiklCijena("");
      setNewArtiklNabavnaCijena("");
    }
  }, [
    newArtiklJeZestoko,
    newArtiklProizvodnaCijena,
    newArtiklNabavnaCijenaFlase,
    newArtiklZapreminaFlase,
    newArtiklZestokoKolicina,
  ]);

  // ---- Dodavanje artikla ----
  const addArtikl = () => {
    if (!newArtiklNaziv.trim()) {
      setError("Naziv artikla je obavezan!");
      return;
    }
    if (!newArtiklCijena || parseFloat(newArtiklCijena) <= 0) {
      setError("Unesite valjanu prodajnu cijenu!");
      return;
    }
    if (!newArtiklNabavnaCijena || parseFloat(newArtiklNabavnaCijena) < 0) {
      setError("Unesite valjanu nabavnu cijenu!");
      return;
    }
    if (!newArtiklPocetnoStanje || parseFloat(newArtiklPocetnoStanje) < 0) {
      setError("Unesite valjanu početnu količinu!");
      return;
    }
    if (newArtiklJeZestoko && (!newArtiklProizvodnaCijena || parseFloat(newArtiklProizvodnaCijena) < 0)) {
      setError("Unesite valjanu proizvodnu cijenu za žestoko piće!");
      return;
    }
    if (newArtiklJeZestoko && (!newArtiklNabavnaCijenaFlase || parseFloat(newArtiklNabavnaCijenaFlase) < 0)) {
      setError("Unesite valjanu nabavnu cijenu flaše za žestoko piće!");
      return;
    }
    if (newArtiklJeZestoko && (!newArtiklZapreminaFlase || parseFloat(newArtiklZapreminaFlase) <= 0)) {
      setError("Unesite valjanu zapreminu flaše za žestoko piće!");
      return;
    }
    if (
      [...cjenovnik, ...pendingCjenovnik].some(
        (artikl) => artikl.naziv.toLowerCase() === newArtiklNaziv.trim().toLowerCase()
      )
    ) {
      setError("Artikl s tim nazivom već postoji!");
      return;
    }

    const noviArtikl: Artikl = {
      naziv: newArtiklNaziv.trim(),
      cijena: parseFloat(newArtiklCijena) || 0,
      nabavnaCijena: newArtiklJeZestoko ? calculateNabavnaPoDozi() : parseFloat(newArtiklNabavnaCijena) || 0,
      pocetnoStanje: parseFloat(newArtiklPocetnoStanje) || 0,
      jeZestoko: newArtiklJeZestoko,
      ...(newArtiklJeZestoko
        ? {
            zestokoKolicina: parseFloat(newArtiklZestokoKolicina) || 0.03,
            proizvodnaCijena: parseFloat(newArtiklProizvodnaCijena) || 0,
            nabavnaCijenaFlase: parseFloat(newArtiklNabavnaCijenaFlase) || 0,
            zapreminaFlase: parseFloat(newArtiklZapreminaFlase) || 1,
          }
        : {}),
    };

    addArtikal(noviArtikl); // Dodaj u privremeni cjenovnik
    setNewArtiklNaziv("");
    setNewArtiklCijena("");
    setNewArtiklNabavnaCijena("");
    setNewArtiklJeZestoko(false);
    setNewArtiklZestokoKolicina("0.03");
    setNewArtiklProizvodnaCijena("");
    setNewArtiklNabavnaCijenaFlase("");
    setNewArtiklZapreminaFlase("");
    setNewArtiklPocetnoStanje("");
    setError("");
  };

  // ---- Brisanje artikla ----
  const deleteArtikl = (naziv: string) => {
    setCjenovnik(cjenovnik.filter((artikl) => artikl.naziv !== naziv)); // Ispravljeno korištenje setCjenovnik
  };

  // Ako se još učitava provjera, prikaži loading
  if (isPasswordProtected === null) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f4f5f7"
      }}>
        <div style={{ fontSize: "16px", color: "#6b7280" }}>Učitavanje...</div>
      </div>
    );
  }

  // Ako je zaštićeno šifrom, prikaži password prompt
  if (isPasswordProtected) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f4f5f7",
        padding: "20px"
      }}>
        <div style={{
          background: "white",
          padding: "40px",
          borderRadius: "12px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
          maxWidth: "400px",
          width: "100%"
        }}>
          <h2 style={{ fontSize: "24px", fontWeight: 600, marginBottom: "24px", textAlign: "center", color: "#1f2937" }}>
            Zaštićeno šifrom
          </h2>
          <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "20px", textAlign: "center" }}>
            {isPasswordProtected
              ? "Unesite šifru za pristup Cjenovnik stranici"
              : "Postavite šifru za Cjenovnik stranicu (min. 4 znaka)"}
          </p>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => {
              setPasswordInput(e.target.value);
              setPasswordError("");
            }}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                handlePasswordSubmit();
              }
            }}
            placeholder="Unesite šifru"
            style={{
              width: "100%",
              padding: "12px 16px",
              marginBottom: "12px",
              borderRadius: "8px",
              border: passwordError ? "1px solid #dc2626" : "1px solid #d1d5db",
              fontSize: "16px",
              outline: "none",
              boxSizing: "border-box"
            }}
          />
          {passwordError && (
            <p style={{ color: "#dc2626", fontSize: "14px", marginBottom: "12px" }}>{passwordError}</p>
          )}
          <button
            onClick={handlePasswordSubmit}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "background-color 0.2s"
            }}
          >
            {isPasswordProtected ? "Pristupi" : "Postavi šifru"}
          </button>
        </div>
      </div>
    );
  }

  // Dinamički container style sa smanjenim padding-om na mobilnom
  const dynamicContainerStyle: React.CSSProperties = {
    ...containerStyle,
    padding: isMobile ? "4px" : "24px",
  };

  return (
    <div style={dynamicContainerStyle}>
      <style jsx>{`
        input.no-spin::-webkit-inner-spin-button,
        input.no-spin::-webkit-outer-spin-button {
          display: none;
        }
        button:hover {
          background-color: #2563eb;
        }
        .delete-button:hover {
          color: #b91c1c;
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
            font-size: 16px; /* Smanjen font za podnaslove */
            margin-bottom: 12px !important;
          }
          div[style*='display: flex'] {
            flex-direction: column; /* Stack-anje elemenata vertikalno */
            gap: 8px;
          }
          input, select {
            width: 100%; /* Inputi i select popunjavaju širinu */
            margin: 4px 0; /* Kompaktniji razmak */
            font-size: 14px; /* Smanjen font za inpute */
            min-height: 44px; /* Minimalna visina za touch target */
            padding: 8px;
          }
          button {
            width: 100%;
            margin: 4px 0; /* Kompaktniji razmak */
            font-size: 14px; /* Smanjen font za dugmadi */
            min-height: 44px; /* Minimalna visina za touch target */
            padding: 10px;
          }
          table {
            font-size: 12px; /* Smanjen font za tablice */
          }
          th, td {
            font-size: 11px !important;
            padding: 8px !important; /* Smanjen padding u tablicama */
            min-width: 80px;
          }
          .table-wrapper {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          table {
            min-width: 600px;
          }
          div[style*='marginBottom: 20px'] {
            marginBottom: 15px; /* Smanjen margin za sekcije */
          }
          .low-stock-settings-grid {
            grid-template-columns: 1fr !important; /* Jedna kolona na mobilu */
          }
          .low-stock-settings-grid input {
            width: 100% !important;
            box-sizing: border-box;
          }
          div[style*='background: #f9fafb'] {
            padding: 16px !important; /* Smanjen padding na mobilu */
          }
        }
      `}</style>

      <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#1f2937", marginBottom: "24px" }}>
        Cjenovnik
      </h1>

      {/* Obrazac za dodavanje artikla */}
      <div
        style={{
          marginBottom: "20px",
          background: "#ffffff",
          padding: "16px",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
        }}
      >
        <h2 style={{ fontSize: "18px", fontWeight: 500, color: "#1f2937", marginBottom: "16px" }}>
          Dodaj novi artikal
        </h2>
        {error && <div style={errorStyle}>{error}</div>}
        
        {isMobile ? (
          // Mobilna verzija - Grid layout
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Naziv artikla - puna širina */}
            <div>
              <label style={{ display: "block", fontSize: "13px", color: "#374151", marginBottom: "6px", fontWeight: 500 }}>
                Naziv artikla
              </label>
              <input
                type="text"
                placeholder="Naziv artikla"
                value={newArtiklNaziv}
                onChange={(e) => setNewArtiklNaziv(e.target.value)}
                style={{ 
                  width: "100%", 
                  padding: "10px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box"
                }}
              />
            </div>

            {/* Grid sa po 2 polja u redu - osnovni podaci */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#374151", marginBottom: "6px", fontWeight: 500 }}>
                  Prodajna cijena
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newArtiklCijena}
                  onChange={(e) => setNewArtiklCijena(e.target.value)}
                  style={{ 
                    width: "100%", 
                    padding: "10px 12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                    ...(newArtiklJeZestoko ? { background: "#f3f4f6", cursor: "not-allowed" } : {})
                  }}
                  disabled={newArtiklJeZestoko}
                  className="no-spin"
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", color: "#374151", marginBottom: "6px", fontWeight: 500 }}>
                  Nabavna cijena
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newArtiklNabavnaCijena}
                  onChange={(e) => setNewArtiklNabavnaCijena(e.target.value)}
                  style={{ 
                    width: "100%", 
                    padding: "10px 12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box",
                    ...(newArtiklJeZestoko ? { background: "#f3f4f6", cursor: "not-allowed" } : {})
                  }}
                  disabled={newArtiklJeZestoko}
                  className="no-spin"
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ display: "block", fontSize: "13px", color: "#374151", marginBottom: "6px", fontWeight: 500 }}>
                  {newArtiklJeZestoko ? "Količina (L)" : "Količina (kom)"}
                </label>
                <input
                  type="number"
                  step={newArtiklJeZestoko ? "0.01" : "1"}
                  placeholder={newArtiklJeZestoko ? "0.00" : "0"}
                  value={newArtiklPocetnoStanje}
                  onChange={(e) => setNewArtiklPocetnoStanje(e.target.value)}
                  style={{ 
                    width: "100%", 
                    padding: "10px 12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                  className="no-spin"
                />
              </div>
            </div>

            {/* Checkbox za žestoko piće - Toggle Switch */}
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "space-between",
              padding: "12px 14px",
              background: newArtiklJeZestoko ? "#eff6ff" : "#f9fafb",
              border: `2px solid ${newArtiklJeZestoko ? "#3b82f6" : "#e5e7eb"}`,
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.2s ease",
              marginTop: "4px"
            }}
            onClick={() => setNewArtiklJeZestoko(!newArtiklJeZestoko)}
            >
              <span style={{ 
                fontSize: "14px", 
                color: "#374151", 
                fontWeight: newArtiklJeZestoko ? 600 : 500
              }}>
                Žestoko piće
              </span>
              {/* Custom Toggle Switch */}
              <div style={{
                position: "relative",
                width: "44px",
                height: "24px",
                background: newArtiklJeZestoko ? "#3b82f6" : "#d1d5db",
                borderRadius: "12px",
                transition: "background 0.2s ease",
                flexShrink: 0
              }}>
                <div style={{
                  position: "absolute",
                  top: "2px",
                  left: newArtiklJeZestoko ? "22px" : "2px",
                  width: "20px",
                  height: "20px",
                  background: "#fff",
                  borderRadius: "50%",
                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                  transition: "left 0.2s ease"
                }} />
              </div>
            </div>

            {/* Dodatna polja za žestoka pića */}
            {newArtiklJeZestoko && (
              <div style={{ 
                display: "flex", 
                flexDirection: "column", 
                gap: "12px", 
                padding: "14px", 
                background: "#f9fafb", 
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                boxSizing: "border-box"
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", color: "#374151", marginBottom: "6px", fontWeight: 500 }}>
                      Količina po dozi (L)
                    </label>
                    <select
                      value={newArtiklZestokoKolicina}
                      onChange={(e) => setNewArtiklZestokoKolicina(e.target.value)}
                      style={{ 
                        width: "100%",
                        padding: "10px 12px",
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        fontSize: "14px",
                        outline: "none",
                        background: "#fff",
                        cursor: "pointer",
                        boxSizing: "border-box"
                      }}
                    >
                      <option value="0.03">0.03 L</option>
                      <option value="0.04">0.04 L</option>
                      <option value="0.05">0.05 L</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", color: "#374151", marginBottom: "6px", fontWeight: 500 }}>
                      Proizvodna cijena
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newArtiklProizvodnaCijena}
                      onChange={(e) => setNewArtiklProizvodnaCijena(e.target.value)}
                      style={{ 
                        width: "100%",
                        padding: "10px 12px",
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        fontSize: "14px",
                        outline: "none",
                        boxSizing: "border-box"
                      }}
                      className="no-spin"
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", color: "#374151", marginBottom: "6px", fontWeight: 500 }}>
                      Nabavna cijena flaše
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newArtiklNabavnaCijenaFlase}
                      onChange={(e) => setNewArtiklNabavnaCijenaFlase(e.target.value)}
                      style={{ 
                        width: "100%",
                        padding: "10px 12px",
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        fontSize: "14px",
                        outline: "none",
                        boxSizing: "border-box"
                      }}
                      className="no-spin"
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", color: "#374151", marginBottom: "6px", fontWeight: 500 }}>
                      Zapremina flaše (L)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newArtiklZapreminaFlase}
                      onChange={(e) => setNewArtiklZapreminaFlase(e.target.value)}
                      style={{ 
                        width: "100%",
                        padding: "10px 12px",
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        fontSize: "14px",
                        outline: "none",
                        boxSizing: "border-box"
                      }}
                      className="no-spin"
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", color: "#374151", marginBottom: "6px", fontWeight: 500 }}>
                    Nabavna cijena po dozi (auto)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={calculateNabavnaPoDozi().toFixed(2)}
                    disabled
                    style={{ 
                      width: "100%",
                      padding: "10px 12px",
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px",
                      fontSize: "14px",
                      outline: "none",
                      background: "#f3f4f6",
                      cursor: "not-allowed",
                      boxSizing: "border-box"
                    }}
                    className="no-spin"
                  />
                </div>
              </div>
            )}

            {/* Dugme za dodavanje */}
            <button style={{ 
              ...buttonStyle, 
              width: "100%", 
              justifyContent: "center", 
              padding: "12px 16px",
              fontSize: "15px",
              marginTop: "0",
              boxSizing: "border-box"
            }} onClick={addArtikl}>
              <FaPlus /> Dodaj artikal
            </button>
          </div>
        ) : (
          // Desktop verzija - Flex layout
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            <input
              type="text"
              placeholder="Naziv artikla"
              value={newArtiklNaziv}
              onChange={(e) => setNewArtiklNaziv(e.target.value)}
              style={formInputStyle}
            />
            <input
              type="number"
              step="0.01"
              placeholder="Prodajna cijena"
              value={newArtiklCijena}
              onChange={(e) => setNewArtiklCijena(e.target.value)}
              style={newArtiklJeZestoko ? disabledInputStyle : formInputStyle}
              disabled={newArtiklJeZestoko}
              className="no-spin"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Nabavna cijena"
              value={newArtiklNabavnaCijena}
              onChange={(e) => setNewArtiklNabavnaCijena(e.target.value)}
              style={newArtiklJeZestoko ? disabledInputStyle : formInputStyle}
              disabled={newArtiklJeZestoko}
              className="no-spin"
            />
            <input
              type="number"
              step={newArtiklJeZestoko ? "0.01" : "1"}
              placeholder={newArtiklJeZestoko ? "Količina (L)" : "Količina (kom)"}
              value={newArtiklPocetnoStanje}
              onChange={(e) => setNewArtiklPocetnoStanje(e.target.value)}
              style={formInputStyle}
              className="no-spin"
            />
            <div 
              style={{ 
                display: "flex", 
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                background: newArtiklJeZestoko ? "#eff6ff" : "#f9fafb",
                border: `2px solid ${newArtiklJeZestoko ? "#3b82f6" : "#e5e7eb"}`,
                borderRadius: "8px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                marginRight: "8px",
                minWidth: "140px"
              }}
              onClick={() => setNewArtiklJeZestoko(!newArtiklJeZestoko)}
            >
              <span style={{ 
                fontSize: "14px", 
                color: "#374151",
                fontWeight: newArtiklJeZestoko ? 600 : 500
              }}>
                Žestoko piće
              </span>
              {/* Custom Toggle Switch */}
              <div style={{
                position: "relative",
                width: "44px",
                height: "24px",
                background: newArtiklJeZestoko ? "#3b82f6" : "#d1d5db",
                borderRadius: "12px",
                transition: "background 0.2s ease",
                flexShrink: 0
              }}>
                <div style={{
                  position: "absolute",
                  top: "2px",
                  left: newArtiklJeZestoko ? "22px" : "2px",
                  width: "20px",
                  height: "20px",
                  background: "#fff",
                  borderRadius: "50%",
                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                  transition: "left 0.2s ease"
                }} />
              </div>
            </div>
            {newArtiklJeZestoko && (
              <>
                <select
                  value={newArtiklZestokoKolicina}
                  onChange={(e) => setNewArtiklZestokoKolicina(e.target.value)}
                  style={selectStyle}
                >
                  <option value="0.03">0.03 L</option>
                  <option value="0.04">0.04 L</option>
                  <option value="0.05">0.05 L</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Proizvodna cijena po dozi"
                  value={newArtiklProizvodnaCijena}
                  onChange={(e) => setNewArtiklProizvodnaCijena(e.target.value)}
                  style={formInputStyle}
                  className="no-spin"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Nabavna cijena flaše"
                  value={newArtiklNabavnaCijenaFlase}
                  onChange={(e) => setNewArtiklNabavnaCijenaFlase(e.target.value)}
                  style={formInputStyle}
                  className="no-spin"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Zapremina flaše (L)"
                  value={newArtiklZapreminaFlase}
                  onChange={(e) => setNewArtiklZapreminaFlase(e.target.value)}
                  style={formInputStyle}
                  className="no-spin"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Nabavna cijena po dozi"
                  value={calculateNabavnaPoDozi().toFixed(2)}
                  disabled
                  style={formInputStyle}
                  className="no-spin"
                />
              </>
            )}
            <button style={buttonStyle} onClick={addArtikl}>
              <FaPlus /> Dodaj
            </button>
          </div>
        )}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            onClick={async () => {
              try {
                await updateCjenovnik();
              } catch (error: any) {
                console.error("Greška pri ažuriranju cjenovnika:", error);
                alert(`Greška pri ažuriranju cjenovnika: ${error.message || error}`);
              }
            }}
            style={updateButtonStyle}
            disabled={pendingCjenovnik.length === 0} // Onemogući ako nema promjena
          >
            Ažuriraj cjenovnik
          </button>
          <button
            onClick={handleSaveOrder}
            disabled={!hasOrderChanges || savingOrder}
            style={{
              ...updateButtonStyle,
              background: (!hasOrderChanges || savingOrder) ? "#9ca3af" : "#3b82f6",
            }}
          >
            {savingOrder ? "Spremanje..." : "💾 Sačuvaj redoslijed"}
          </button>
        </div>
      </div>

      {/* Lista artikala */}
      <h2 style={{ fontSize: "18px", fontWeight: 500, color: "#1f2937", marginBottom: "16px" }}>
        Lista artikala
      </h2>
      {cjenovnik.length === 0 ? (
        <p style={{ fontSize: "14px", color: "#6b7280", textAlign: "center", padding: "16px" }}>
          Nema artikala u cjenovniku.
        </p>
      ) : isMobile ? (
        // Mobilna verzija - Card layout
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {cjenovnik.map((artikl, index) => {
            // Provjeri da li je zaliha mala
            const threshold = artikl.jeZestoko 
              ? parseFloat(lowStockThresholdZestoka) || 100 
              : parseFloat(lowStockThresholdOstala) || 10;
            const isLowStock = lowStockEnabled && artikl.pocetnoStanje < threshold;
            
            return (
              <div
                key={artikl.naziv}
                style={{
                  background: "#fff",
                  borderRadius: "8px",
                  padding: "12px",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                  borderLeft: isLowStock ? "4px solid #dc2626" : "4px solid transparent",
                  backgroundColor: isLowStock ? "#fef2f2" : "#fff",
                  position: "relative",
                }}
              >
                {/* Artikal naziv - puna širina */}
                <div style={{ 
                  marginBottom: "12px",
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "#1f2937"
                }}>
                  {artikl.naziv}
                </div>

                {/* Grid sa po 2 polja u redu */}
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: "1fr 1fr", 
                  gap: "12px",
                  marginBottom: "8px"
                }}>
                  {/* Prodajna cijena */}
                  <div>
                    <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>
                      Prodajna cijena
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937" }}>
                      {artikl.cijena.toFixed(2)} KM
                    </div>
                  </div>

                  {/* Nabavna cijena */}
                  <div>
                    <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>
                      Nabavna cijena
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937" }}>
                      {artikl.nabavnaCijena.toFixed(2)} KM
                    </div>
                  </div>

                  {/* Početna količina */}
                  <div>
                    <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>
                      Početna količina
                    </div>
                    <div style={{ 
                      fontSize: "14px", 
                      fontWeight: 600, 
                      color: isLowStock ? "#dc2626" : "#1f2937"
                    }}>
                      {artikl.pocetnoStanje.toFixed(artikl.jeZestoko ? 2 : 0)}
                      {artikl.jeZestoko ? " L" : " kom"}
                    </div>
                  </div>

                  {/* Žestoko Količina (ako je relevantno) */}
                  {artikl.jeZestoko ? (
                    <div>
                      <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>
                        Žestoko Količina (L)
                      </div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937" }}>
                        {(artikl.zestokoKolicina || 0).toFixed(2)}
                      </div>
                    </div>
                  ) : (
                    <div></div>
                  )}
                </div>

                {/* Proizvodna Cijena (puna širina, samo za žestoka pića) */}
                {artikl.jeZestoko && (
                  <div style={{ marginTop: "8px", marginBottom: "8px" }}>
                    <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>
                      Proizvodna Cijena
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937" }}>
                      {(artikl.proizvodnaCijena || 0).toFixed(2)} KM
                    </div>
                  </div>
                )}

                {/* Strelice za premještanje i akcija dugme - donji desni ugao */}
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "8px",
                  paddingTop: "8px",
                  borderTop: "1px solid #f3f4f6"
                }}>
                  {/* Strelice gore/dolje jedna pored druge */}
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      style={{
                        padding: "6px",
                        background: index === 0 ? "#f3f4f6" : "#f0f0f0",
                        border: "none",
                        borderRadius: "4px",
                        cursor: index === 0 ? "not-allowed" : "pointer",
                        color: index === 0 ? "#9ca3af" : "#374151",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <FaArrowUp />
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === cjenovnik.length - 1}
                      style={{
                        padding: "6px",
                        background: index === cjenovnik.length - 1 ? "#f3f4f6" : "#f0f0f0",
                        border: "none",
                        borderRadius: "4px",
                        cursor: index === cjenovnik.length - 1 ? "not-allowed" : "pointer",
                        color: index === cjenovnik.length - 1 ? "#9ca3af" : "#374151",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <FaArrowDown />
                    </button>
                  </div>
                  <button
                    style={deleteButtonStyle}
                    onClick={() => deleteArtikl(artikl.naziv)}
                    className="delete-button"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Desktop verzija - Tabela sa drag & drop
        <div style={tableWrapperStyle}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Artikal</th>
              <th style={thStyle}>Prodajna cijena</th>
              <th style={thStyle}>Nabavna cijena</th>
              <th style={thStyle}>Početna količina</th>
              <th style={thStyle}>Žestoko Količina (L)</th>
              <th style={thStyle}>Proizvodna Cijena</th>
              <th style={thStyle}>Akcija</th>
            </tr>
          </thead>
            <SortableContext items={cjenovnik.map(a => a.naziv)} strategy={verticalListSortingStrategy}>
              <tbody>
                {cjenovnik.map((artikl) => {
                  // Provjeri da li je zaliha mala
                  const threshold = artikl.jeZestoko 
                    ? parseFloat(lowStockThresholdZestoka) || 100 
                    : parseFloat(lowStockThresholdOstala) || 10;
                  const isLowStock = lowStockEnabled && artikl.pocetnoStanje < threshold;
                  
                  return (
                    <SortableRow
                      key={artikl.naziv}
                      artikl={artikl}
                      isLowStock={isLowStock}
                      lowStockThresholdZestoka={lowStockThresholdZestoka}
                      lowStockThresholdOstala={lowStockThresholdOstala}
                      lowStockEnabled={lowStockEnabled}
                      onDelete={deleteArtikl}
                      tdStyle={tdStyle}
                      deleteButtonStyle={deleteButtonStyle}
                    />
                  );
                })}
              </tbody>
            </SortableContext>
          </table>
          </DndContext>
        </div>
      )}
      {pendingCjenovnik.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 500, color: "#1f2937", marginBottom: "16px" }}>
            Čekajuće promjene
          </h2>
          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Artikal</th>
                <th style={thStyle}>Prodajna cijena</th>
                <th style={thStyle}>Nabavna cijena</th>
                <th style={thStyle}>Početna količina</th>
                <th style={thStyle}>Žestoko Količina (L)</th>
                <th style={thStyle}>Proizvodna Cijena</th>
              </tr>
            </thead>
            <tbody>
              {pendingCjenovnik.map((artikl) => (
                <tr key={artikl.naziv}>
                  <td style={tdStyle}>{artikl.naziv}</td>
                  <td style={tdStyle}>{artikl.cijena.toFixed(2)}</td>
                  <td style={tdStyle}>{artikl.nabavnaCijena.toFixed(2)}</td>
                  <td style={tdStyle}>
                    {artikl.pocetnoStanje.toFixed(artikl.jeZestoko ? 2 : 0)}
                    {artikl.jeZestoko ? " L" : " kom"}
                  </td>
                  <td style={tdStyle}>{artikl.jeZestoko ? (artikl.zestokoKolicina || 0).toFixed(2) : "-"}</td>
                  <td style={tdStyle}>{artikl.jeZestoko ? (artikl.proizvodnaCijena || 0).toFixed(2) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Postavke za malu zalihu */}
      <div style={{ 
        marginTop: "32px", 
        marginBottom: "32px", 
        padding: "20px", 
        background: "#f9fafb", 
        borderRadius: "8px",
        border: "1px solid #e5e7eb"
      }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "16px" }}>
          Postavke za malu zalihu
        </h2>
        
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "flex", alignItems: "center", cursor: "pointer", marginBottom: "16px" }}>
            <input
              type="checkbox"
              checked={lowStockEnabled}
              onChange={(e) => setLowStockEnabled(e.target.checked)}
              style={{ ...checkboxStyle, cursor: "pointer" }}
            />
            <span style={{ fontSize: "14px", color: "#374151" }}>Uključi upozorenje za malu zalihu</span>
          </label>
        </div>

        {lowStockEnabled && (
          <div className="low-stock-settings-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#6b7280", marginBottom: "8px" }}>
                Prag za žestoka pića (L):
              </label>
              <input
                type="number"
                value={lowStockThresholdZestoka}
                onChange={(e) => setLowStockThresholdZestoka(e.target.value)}
                placeholder="100"
                min="0"
                step="0.01"
                style={formInputStyle}
              />
              <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                Upozorenje će se prikazati kada zaliha padne ispod ove vrijednosti
              </p>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#6b7280", marginBottom: "8px" }}>
                Prag za ostala pića (kom):
              </label>
              <input
                type="number"
                value={lowStockThresholdOstala}
                onChange={(e) => setLowStockThresholdOstala(e.target.value)}
                placeholder="10"
                min="0"
                step="1"
                style={formInputStyle}
              />
              <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                Upozorenje će se prikazati kada zaliha padne ispod ove vrijednosti
              </p>
            </div>
          </div>
        )}

        <button
          onClick={saveLowStockSettings}
          disabled={savingLowStockSettings}
          style={{
            ...updateButtonStyle,
            background: savingLowStockSettings ? "#9ca3af" : "#3b82f6",
            marginTop: "0",
          }}
        >
          {savingLowStockSettings ? "Spremanje..." : "Sačuvaj postavke"}
        </button>
      </div>
    </div>
  );
}