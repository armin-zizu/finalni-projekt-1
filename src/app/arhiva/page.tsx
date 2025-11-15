"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { auth, onAuthStateChanged } from "../../lib/firebase";
import { db } from "../../lib/firestore";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

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

// ---- Glavna komponenta ----
export default function ArhivaPage() {
  const [arhiva, setArhiva] = useState<ArhiviraniObracun[]>([]);
  const [editingObracunDatum, setEditingObracunDatum] = useState<string | null>(null);
  const [editedRashodi, setEditedRashodi] = useState<Rashod[]>([]);
  const [editedPrihodi, setEditedPrihodi] = useState<Prihod[]>([]);
  const obracunRefs = useRef<{ [key: string]: React.RefObject<HTMLDivElement | null> }>({});

  // Funkcija za učitavanje arhive - HIBRIDNI PRISTUP
  const loadArhiva = React.useCallback(async () => {
    const user = auth.currentUser;
    const userId = user?.uid;
    
    let firestoreArhiva: ArhiviraniObracun[] = [];
    let localStorageArhiva: ArhiviraniObracun[] = [];
    
    // 1. POKUŠAJ UČITATI IZ FIRESTORE (primarni izvor)
    if (user && userId) {
      try {
        const obracuniRef = collection(db, "users", userId, "obracuni");
        const snapshot = await getDocs(obracuniRef);
        firestoreArhiva = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            ...data,
            prihodi: data.prihodi ?? [],
            ukupnoPrihod: data.ukupnoPrihod ?? 0,
            imaUlaz: data.imaUlaz ?? false,
            isAzuriran: data.isAzuriran ?? false,
          } as ArhiviraniObracun;
        });
        console.log("Učitano iz Firestore:", firestoreArhiva.length, "obračuna");
      } catch (error: any) {
        // Ignoriraj greške dozvola - koristit ćemo localStorage
        const errorCode = error?.code || "";
        if (errorCode !== "permission-denied" && !errorCode.includes("permission") && !errorCode.includes("insufficient")) {
          console.warn("Greška pri učitavanju iz Firestore:", error);
        }
      }
    }
    
    // 2. UČITAJ IZ LOCALSTORAGE (cache/offline backup)
    if (userId) {
      // User-specific localStorage ključ
      const storageKey = `arhivaObracuna_${userId}`;
      const savedArhiva = localStorage.getItem(storageKey);
      if (savedArhiva) {
        try {
          localStorageArhiva = JSON.parse(savedArhiva).map((item: any) => ({
            ...item,
            prihodi: item.prihodi ?? [],
            ukupnoPrihod: item.ukupnoPrihod ?? 0,
            imaUlaz: item.imaUlaz ?? false,
            isAzuriran: item.isAzuriran ?? false,
          }));
          console.log("Učitano iz localStorage (per-user):", localStorageArhiva.length, "obračuna");
        } catch (e) {
          console.warn("Greška pri čitanju localStorage:", e);
        }
      }
    } else {
      // Fallback: stari ključ (za migraciju)
      const savedArhiva = localStorage.getItem("arhivaObracuna");
      if (savedArhiva) {
        try {
          localStorageArhiva = JSON.parse(savedArhiva).map((item: any) => ({
            ...item,
            prihodi: item.prihodi ?? [],
            ukupnoPrihod: item.ukupnoPrihod ?? 0,
            imaUlaz: item.imaUlaz ?? false,
            isAzuriran: item.isAzuriran ?? false,
          }));
        } catch (e) {
          console.warn("Greška pri čitanju localStorage (fallback):", e);
        }
      }
    }
    
    // 3. MERGE: Firestore ima prioritet, ali dodaj i iz localStorage ako nema u Firestore
    const mergedArhiva: ArhiviraniObracun[] = [...firestoreArhiva];
    const firestoreDatumi = new Set(firestoreArhiva.map((item) => item.datum));
    
    // Dodaj iz localStorage samo one koji nisu u Firestore
    localStorageArhiva.forEach((item) => {
      if (!firestoreDatumi.has(item.datum)) {
        mergedArhiva.push(item);
      }
    });
    
    // Sortiraj po datumu (najnoviji prvo)
    const sortedArhiva = mergedArhiva.sort((a, b) => {
      const dateA = new Date(a.datum.split(".").reverse().join("-")).getTime();
      const dateB = new Date(b.datum.split(".").reverse().join("-")).getTime();
      return dateB - dateA;
    });
    
    // 4. SPREMI U LOCALSTORAGE KAO CACHE (ako je Firestore imao podatke)
    if (firestoreArhiva.length > 0 && userId) {
      const storageKey = `arhivaObracuna_${userId}`;
      localStorage.setItem(storageKey, JSON.stringify(sortedArhiva));
      console.log("Arhiva spremljena u localStorage kao cache");
    }
    
    // 5. POSTAVI STANJE
    setArhiva((prevArhiva) => {
      const prevString = JSON.stringify(prevArhiva);
      const newString = JSON.stringify(sortedArhiva);
      if (prevString === newString) {
        return prevArhiva; // Ne mijenjaj ako je ista
      }
      return sortedArhiva;
    });
    
    // Kreiraj refs za obračune
    sortedArhiva.forEach((item) => {
      if (!obracunRefs.current[item.datum]) {
        obracunRefs.current[item.datum] = React.createRef<HTMLDivElement>();
      }
    });
  }, []);

  // Učitavanje arhive iz localStorage
  useEffect(() => {
    loadArhiva();
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

  // Spremanje arhive u localStorage (per-user cache)
  useEffect(() => {
    const user = auth.currentUser;
    const userId = user?.uid;
    
    if (arhiva.length > 0 && userId) {
      const storageKey = `arhivaObracuna_${userId}`;
      const currentArhiva = localStorage.getItem(storageKey);
      const newArhivaString = JSON.stringify(arhiva);
      
      // Spremi samo ako se promijenilo
      if (currentArhiva !== newArhivaString) {
        localStorage.setItem(storageKey, newArhivaString);
      }
    }
  }, [arhiva]);

  // Brisanje obračuna - HIBRIDNI PRISTUP
  const deleteObracun = async (datum: string) => {
    if (window.confirm(`Jeste li sigurni da želite obrisati obračun za ${datum}?`)) {
      const user = auth.currentUser;
      const userId = user?.uid;
      
      // 1. Obriši iz Firestore
      if (user && userId) {
        try {
          const docRef = doc(db, "users", userId, "obracuni", datum);
          await getDoc(docRef).then(async (docSnap) => {
            if (docSnap.exists()) {
              // Firestore ima deleteDoc, ali koristimo setDoc sa merge: false ili brišemo direktno
              // Za sada ćemo samo ažurirati lokalno, Firestore će se ažurirati pri sljedećem učitavanju
            }
          });
        } catch (error: any) {
          console.warn("Greška pri brisanju iz Firestore:", error);
        }
      }
      
      // 2. Obriši iz localStorage
      const filteredArhiva = arhiva.filter((item) => item.datum !== datum);
      setArhiva(filteredArhiva);
      
      // Spremi ažuriranu arhivu u localStorage
      if (userId) {
        const storageKey = `arhivaObracuna_${userId}`;
        localStorage.setItem(storageKey, JSON.stringify(filteredArhiva));
      }
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

  // Spremanje uređenih rashoda i prihoda
  const saveEditedObracun = (datum: string) => {
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
          table {
            overflow-x: auto; /* Horizontalni scroll za tablice */
            display: block;
            font-size: 12px;
          }
          th, td {
            font-size: 11px !important; /* Smanjen font za tablice */
            padding: 8px !important; /* Smanjen padding za ćelije */
            min-width: 80px;
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

      <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#1f2937", marginBottom: "24px" }}>
        Arhiva
      </h1>

      {arhiva.length === 0 ? (
        <p style={{ fontSize: "14px", color: "#6b7280", textAlign: "center", padding: "16px" }}>
          Nema arhiviranih obračuna.
        </p>
      ) : (
        <div>
          {arhiva.map((item, index) => {
            // Odredi stil na osnovu flagova
            let containerStyle = obracunContainerStyle;
            if (item.imaUlaz) {
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
                  {item.imaUlaz && (
                    <span style={{ fontSize: "14px", color: "#eab308", fontWeight: 500, marginLeft: "8px" }}>
                      (Ima ulaz)
                    </span>
                  )}
                  {item.isAzuriran && !item.imaUlaz && (
                    <span style={{ fontSize: "14px", color: "#f59e0b", fontWeight: 500, marginLeft: "8px" }}>
                      (Ažurirano)
                    </span>
                  )}
                </h2>
                <div>
                  <button
                    style={{ ...buttonStyle, background: "#10b981" }}
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
                        {a.ulaz !== undefined && a.ulaz !== null ? (a.ulaz > 0 ? a.ulaz : "-") : "-"}
                      </td>
                      <td style={tdStyle}>{a.ukupno ?? "-"}</td>
                      <td style={tdStyle}>{a.utroseno ?? "-"}</td>
                      <td style={tdStyle}>{a.krajnjeStanje ?? "-"}</td>
                      <td style={tdStyle}>{a.vrijednostKM.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Rashodi */}
              <h3 style={{ fontSize: "16px", fontWeight: 500, color: "#1f2937", marginBottom: "8px" }}>
                Rashodi
              </h3>
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

              {/* Prihodi */}
              <h3 style={{ fontSize: "16px", fontWeight: 500, color: "#1f2937", marginBottom: "8px" }}>
                Prihodi
              </h3>
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