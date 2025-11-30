"use client";

import React, { useState, useEffect } from "react";
import { useCjenovnik } from "../context/CjenovnikContext";
import { usePathname } from "next/navigation";
import { FaTrash, FaPlus } from "react-icons/fa";
import { auth, onAuthStateChanged } from "../../lib/firebase";
import { db } from "../../lib/firestore";
import { doc, getDoc, setDoc } from "firebase/firestore";

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

// ---- Glavna komponenta ----
export default function CjenovnikPage() {
  const { cjenovnik, pendingCjenovnik, setCjenovnik, addArtikal, updateCjenovnik } = useCjenovnik();

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
  const pathname = usePathname();
  
  // Postavke za malu zalihu
  const [lowStockEnabled, setLowStockEnabled] = useState<boolean>(false);
  const [lowStockThresholdZestoka, setLowStockThresholdZestoka] = useState<string>("100");
  const [lowStockThresholdOstala, setLowStockThresholdOstala] = useState<string>("10");
  const [savingLowStockSettings, setSavingLowStockSettings] = useState<boolean>(false);

  // Provjera šifre pri učitavanju i pri navigaciji - traži šifru svaki put
  useEffect(() => {
    const savedPassword = localStorage.getItem("cjenovnikPassword");
    
    // Ako postoji šifra, traži je svaki put (ne koristi sessionStorage)
    if (savedPassword) {
      setIsPasswordProtected(true);
    } else {
      // Ako nema šifre, ne traži je (prvi put)
      setIsPasswordProtected(false);
    }
  }, [pathname]); // Provjeri svaki put kada se pathname promijeni

  // Učitaj postavke za malu zalihu iz Firestore
  useEffect(() => {
    const loadLowStockSettings = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.lowStockSettings) {
            setLowStockEnabled(data.lowStockSettings.enabled || false);
            setLowStockThresholdZestoka(String(data.lowStockSettings.thresholdZestoka || 100));
            setLowStockThresholdOstala(String(data.lowStockSettings.thresholdOstala || 10));
          }
        }
      } catch (error) {
        console.error("Greška pri učitavanju postavki za malu zalihu:", error);
      }
    };

    loadLowStockSettings();
    
    // Osluškuj promjene u autentifikaciji
    const unsubscribe = onAuthStateChanged(auth, () => {
      loadLowStockSettings();
    });
    
    return () => unsubscribe();
  }, []);
  
  // Osiguraj da se upozorenja ažuriraju kada se cjenovnik promijeni
  useEffect(() => {
    // Ova promjena će automatski triggerati re-render sa novim upozorenjima
  }, [cjenovnik, lowStockEnabled, lowStockThresholdZestoka, lowStockThresholdOstala]);

  // Spremi postavke za malu zalihu u Firestore
  const saveLowStockSettings = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setSavingLowStockSettings(true);
    try {
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(
        userDocRef,
        {
          lowStockSettings: {
            enabled: lowStockEnabled,
            thresholdZestoka: parseFloat(lowStockThresholdZestoka) || 100,
            thresholdOstala: parseFloat(lowStockThresholdOstala) || 10,
          },
        },
        { merge: true }
      );
      setError("");
    } catch (error) {
      console.error("Greška pri spremanju postavki za malu zalihu:", error);
      setError("Greška pri spremanju postavki");
    } finally {
      setSavingLowStockSettings(false);
    }
  };

  const handlePasswordSubmit = () => {
    const savedPassword = localStorage.getItem("cjenovnikPassword");
    
    if (!savedPassword) {
      // Prvi put - postavi šifru
      if (passwordInput.trim().length >= 4) {
        localStorage.setItem("cjenovnikPassword", passwordInput);
        setIsPasswordProtected(false);
        setPasswordInput("");
        setPasswordError("");
      } else {
        setPasswordError("Šifra mora imati najmanje 4 znaka");
      }
    } else {
      // Provjeri šifru - svaki put traži šifru, ne koristi sessionStorage
      if (passwordInput === savedPassword) {
        setIsPasswordProtected(false);
        setPasswordInput("");
        setPasswordError("");
      } else {
        setPasswordError("Pogrešna šifra!");
      }
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
            {localStorage.getItem("cjenovnikPassword") 
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
            {localStorage.getItem("cjenovnikPassword") ? "Pristupi" : "Postavi šifru"}
          </button>
        </div>
      </div>
    );
  }

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
          <div style={{ display: "flex", alignItems: "center", marginRight: "8px" }}>
            <input
              type="checkbox"
              checked={newArtiklJeZestoko}
              onChange={(e) => setNewArtiklJeZestoko(e.target.checked)}
              style={checkboxStyle}
            />
            <span style={{ fontSize: "14px", color: "#374151" }}>Žestoko piće</span>
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
        <button
          onClick={updateCjenovnik}
          style={updateButtonStyle}
          disabled={pendingCjenovnik.length === 0} // Onemogući ako nema promjena
        >
          Ažuriraj cjenovnik
        </button>
      </div>

      {/* Lista artikala */}
      <h2 style={{ fontSize: "18px", fontWeight: 500, color: "#1f2937", marginBottom: "16px" }}>
        Lista artikala
      </h2>
      {cjenovnik.length === 0 ? (
        <p style={{ fontSize: "14px", color: "#6b7280", textAlign: "center", padding: "16px" }}>
          Nema artikala u cjenovniku.
        </p>
      ) : (
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
              <th style={thStyle}>Akcija</th>
            </tr>
          </thead>
          <tbody>
            {cjenovnik.map((artikl) => {
              // Provjeri da li je zaliha mala
              const threshold = artikl.jeZestoko 
                ? parseFloat(lowStockThresholdZestoka) || 100 
                : parseFloat(lowStockThresholdOstala) || 10;
              const isLowStock = lowStockEnabled && artikl.pocetnoStanje < threshold;
              
              return (
                <tr 
                  key={artikl.naziv}
                  style={isLowStock ? { 
                    backgroundColor: "#fef2f2",
                    borderLeft: "4px solid #dc2626"
                  } : {}}
                >
                <td style={tdStyle}>
                  {artikl.naziv}
                </td>
                  <td style={tdStyle}>{artikl.cijena.toFixed(2)}</td>
                  <td style={tdStyle}>{artikl.nabavnaCijena.toFixed(2)}</td>
                  <td style={{
                    ...tdStyle,
                    ...(isLowStock ? { 
                      color: "#dc2626", 
                      fontWeight: 600 
                    } : {})
                  }}>
                    {artikl.pocetnoStanje.toFixed(artikl.jeZestoko ? 2 : 0)}
                    {artikl.jeZestoko ? " L" : " kom"}
                  </td>
                  <td style={tdStyle}>{artikl.jeZestoko ? (artikl.zestokoKolicina || 0).toFixed(2) : "-"}</td>
                  <td style={tdStyle}>{artikl.jeZestoko ? (artikl.proizvodnaCijena || 0).toFixed(2) : "-"}</td>
                  <td style={tdStyle}>
                    <button
                      style={deleteButtonStyle}
                      onClick={() => deleteArtikl(artikl.naziv)}
                      className="delete-button"
                    >
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
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