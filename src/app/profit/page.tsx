"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useCjenovnik } from "../context/CjenovnikContext";
import { usePathname } from "next/navigation";

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
};

type Obracun = {
  datum: string;
  artikli: Artikal[];
  rashodi: { naziv: string; cijena: number }[];
  prihodi: { naziv: string; cijena: number }[];
};

type ArtikalProfit = {
  naziv: string;
  nabavnaCijena: number;
  prodajnaCijena: number;
  kolicina: number;
  bruto: number;
  neto: number;
  profit: number;
  zestokoKolicina?: number;
};

type ObracunProfit = {
  datum: string;
  artikliProfit: ArtikalProfit[];
  ukupnoBruto: number;
  ukupnoNeto: number;
  ukupnoRashod: number;
};

type ArtiklProfitData = {
  datum: string;
  bruto: number; // prodajnaCijena * kolicina
  neto: number;  // (prodajnaCijena - nabavnaCijena) * kolicina
};

// ---- CSS ----
const containerStyle: React.CSSProperties = {
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "24px",
  fontFamily: "'Inter', sans-serif",
  width: "100%",
  boxSizing: "border-box",
  overflowX: "hidden",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  borderCollapse: "separate" as "separate",
  borderSpacing: 0,
  background: "#ffffff",
  borderRadius: "8px",
  overflow: "hidden",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
  marginBottom: "12px",
  boxSizing: "border-box",
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

const summaryStyle: React.CSSProperties = {
  display: "flex",
  gap: "24px",
  marginTop: "12px",
  padding: "12px",
  background: "#f3f4f6",
  borderRadius: "6px",
  width: "100%",
  boxSizing: "border-box",
  flexWrap: "wrap",
};

const summaryItemStyle = (color: string): React.CSSProperties => ({
  fontSize: "14px",
  fontWeight: 600,
  color,
});

const buttonStyle: React.CSSProperties = {
  padding: "8px 16px",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 500,
  transition: "all 0.2s ease-in-out",
};

const formInputStyle: React.CSSProperties = {
  padding: "8px",
  border: "1px solid #e5e7eb",
  borderRadius: "6px",
  fontSize: "14px",
  outline: "none",
  width: "150px",
};

// ---- Filter komponenta ----
const FilterSection: React.FC<{
  filter: "trenutnaSedmica" | "proslaSedmica" | "prosliMjesec" | "custom";
  setFilter: (value: "trenutnaSedmica" | "proslaSedmica" | "prosliMjesec" | "custom") => void;
  customPeriod: { from: string; to: string };
  setCustomPeriod: (value: { from: string; to: string }) => void;
  label?: string;
}> = ({ filter, setFilter, customPeriod, setCustomPeriod, label = "Filter arhive" }) => (
  <div style={{ marginBottom: "20px", background: "#fff", padding: "16px", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
    <h2 style={{ fontSize: "18px", fontWeight: 500, marginBottom: "12px", wordWrap: "break-word" }}>{label}</h2>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", width: "100%" }}>
      {["trenutnaSedmica", "proslaSedmica", "prosliMjesec", "custom"].map((f) => (
        <button
          key={f}
          onClick={() => setFilter(f as any)}
          style={{
            ...buttonStyle,
            backgroundColor: filter === f ? "#3b82f6" : "#e5e7eb",
            color: filter === f ? "#fff" : "#374151",
            flex: "1 1 auto",
            minWidth: "fit-content",
          }}
        >
          {f === "trenutnaSedmica" ? "Trenutna sedmica" :
           f === "proslaSedmica" ? "Prošla sedmica" :
           f === "prosliMjesec" ? "Prošli mjesec" :
           "Prilagođeni period"}
        </button>
      ))}
      {filter === "custom" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%", flexWrap: "wrap" }}>
          <input type="date" value={customPeriod.from} onChange={(e) => setCustomPeriod({ ...customPeriod, from: e.target.value })} style={{ ...formInputStyle, flex: "1 1 auto", minWidth: 0, maxWidth: "100%" }} />
          <span style={{ whiteSpace: "nowrap" }}>do</span>
          <input type="date" value={customPeriod.to} onChange={(e) => setCustomPeriod({ ...customPeriod, to: e.target.value })} style={{ ...formInputStyle, flex: "1 1 auto", minWidth: 0, maxWidth: "100%" }} />
        </div>
      )}
    </div>
  </div>
);

// ---- Glavna komponenta ----
export default function ProfitPage() {
  const [obracuniProfit, setObracuniProfit] = useState<ObracunProfit[]>([]);
  const [filter, setFilter] = useState<"trenutnaSedmica" | "proslaSedmica" | "prosliMjesec" | "custom">("trenutnaSedmica");
  const [customPeriod, setCustomPeriod] = useState<{ from: string; to: string }>({
    from: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });
  const [filteredObracuni, setFilteredObracuni] = useState<ObracunProfit[]>([]);
  const [selectedArtikl, setSelectedArtikl] = useState<string>("");
  const [artiklFilter, setArtiklFilter] = useState<"trenutnaSedmica" | "proslaSedmica" | "prosliMjesec" | "custom">("trenutnaSedmica");
  const [isPasswordProtected, setIsPasswordProtected] = useState<boolean | null>(null); // null = loading
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const { cjenovnik } = useCjenovnik();
  const pathname = usePathname();

  // Provjera šifre pri učitavanju i pri navigaciji - traži šifru svaki put
  useEffect(() => {
    const savedPassword = localStorage.getItem("profitPassword");
    
    // Ako postoji šifra, traži je svaki put (ne koristi sessionStorage)
    if (savedPassword) {
      setIsPasswordProtected(true);
    } else {
      // Ako nema šifre, ne traži je (prvi put)
      setIsPasswordProtected(false);
    }
  }, [pathname]); // Provjeri svaki put kada se pathname promijeni

  const handlePasswordSubmit = () => {
    const savedPassword = localStorage.getItem("profitPassword");
    
    if (!savedPassword) {
      // Prvi put - postavi šifru
      if (passwordInput.trim().length >= 4) {
        localStorage.setItem("profitPassword", passwordInput);
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

  // ---- funkcija za učitavanje arhive i generisanje profita ----
  const loadArhiva = useCallback(() => {
    try {
      const savedArhiva = localStorage.getItem("arhivaObracuna");
      console.log("Profit - Učitavanje arhive:", {
        imaArhiva: !!savedArhiva,
        cjenovnikLength: cjenovnik.length,
        cjenovnik: cjenovnik.map(c => ({ naziv: c.naziv, nabavnaCijena: c.nabavnaCijena }))
      });

      if (!savedArhiva) {
        console.log("Profit - Nema arhive u localStorage");
        setObracuniProfit([]);
        return;
      }

      if (cjenovnik.length === 0) {
        console.log("Profit - Cjenovnik je prazan, čekam učitavanje...");
        setObracuniProfit([]);
        return;
      }

      const parsed: Obracun[] = JSON.parse(savedArhiva)
        .map((item: any) => ({
          ...item,
          prihodi: item.prihodi ?? [],
          rashodi: item.rashodi ?? [],
        }))
        .sort((a: Obracun, b: Obracun) => {
          const dateA = new Date(a.datum.split(".").reverse().join("-")).getTime();
          const dateB = new Date(b.datum.split(".").reverse().join("-")).getTime();
          return dateB - dateA; // Silazni redoslijed (najnoviji prvo)
        });

      console.log("Profit - Parsirano obračuna:", parsed.length);

      const profiti: ObracunProfit[] = parsed.map((obracun) => {
        const artikliProfit: ArtikalProfit[] = obracun.artikli
          .map((a) => {
            const cjenovnikArtikl = cjenovnik.find((c) => c.naziv === a.naziv);
            
            // Za žestoka pića: količina = utroseno / zestokoKolicina
            // Za ostale artikle: količina = utroseno
            const kolicina = a.zestokoKolicina 
              ? a.utroseno / (a.zestokoKolicina || 0.03) 
              : a.utroseno;
            
            const prodajna = a.cijena || 0;
            const nabavna = cjenovnikArtikl?.nabavnaCijena || 0;
            
            if (!cjenovnikArtikl) {
              console.warn(`Profit - Artikal "${a.naziv}" nije pronađen u cjenovniku`);
            }
            
            const bruto = prodajna * kolicina;
            const neto = (prodajna - nabavna) * kolicina;
            const profit = prodajna - nabavna;

            return {
              naziv: a.naziv,
              nabavnaCijena: nabavna,
              prodajnaCijena: prodajna,
              kolicina,
              bruto,
              neto,
              profit,
              zestokoKolicina: a.zestokoKolicina,
            };
          });

        const ukupnoRashod = (obracun.rashodi?.reduce((sum, r) => sum + r.cijena, 0) || 0) + 
                             (obracun.prihodi?.reduce((sum, p) => sum + p.cijena, 0) || 0);
        const ukupnoBruto = artikliProfit.reduce((sum, a) => sum + a.bruto, 0);
        const ukupnoNeto = artikliProfit.reduce((sum, a) => sum + a.neto, 0) - ukupnoRashod;

        return {
          datum: obracun.datum,
          artikliProfit,
          ukupnoBruto,
          ukupnoNeto,
          ukupnoRashod,
        };
      });

      console.log("Profit - Generisano profita:", profiti.length, profiti);
      setObracuniProfit(profiti);
    } catch (error) {
      console.error("Profit - Greška pri učitavanju arhive:", error);
      setObracuniProfit([]);
    }
  }, [cjenovnik]);

  // ---- inicijalno učitavanje + listener za promjene arhive ----
  useEffect(() => {
    loadArhiva();
  }, [loadArhiva]);

  // Listener za promjene u arhivi
  useEffect(() => {
    const handler = () => {
      setTimeout(() => {
        loadArhiva();
      }, 100);
    };
    window.addEventListener("arhivaChanged", handler);
    return () => window.removeEventListener("arhivaChanged", handler);
  }, [loadArhiva]);

  // ---- filtriranje po periodu za glavni grafikon i tablice ----
  useEffect(() => {
    const danas = new Date();

    const filtered = obracuniProfit.filter((o) => {
      const [d, m, y] = o.datum.split(".").map(Number);
      const datumO = new Date(y, m - 1, d);

      if (filter === "trenutnaSedmica") {
        const firstDay = new Date(danas);
        firstDay.setDate(danas.getDate() - danas.getDay() + 1); // ponedeljak
        return datumO >= firstDay && datumO <= danas;
      }
      if (filter === "proslaSedmica") {
        const firstDayPrev = new Date(danas);
        firstDayPrev.setDate(danas.getDate() - danas.getDay() - 6); // ponedeljak prošle sedmice
        const lastDayPrev = new Date(danas);
        lastDayPrev.setDate(danas.getDate() - danas.getDay()); // nedelja prošle sedmice
        return datumO >= firstDayPrev && datumO <= lastDayPrev;
      }
      if (filter === "prosliMjesec") {
        const firstDayPrevMonth = new Date(danas.getFullYear(), danas.getMonth() - 1, 1);
        const lastDayPrevMonth = new Date(danas.getFullYear(), danas.getMonth(), 0);
        return datumO >= firstDayPrevMonth && datumO <= lastDayPrevMonth;
      }
      if (filter === "custom") {
        return datumO >= new Date(customPeriod.from) && datumO <= new Date(customPeriod.to);
      }
      return true;
    });

    setFilteredObracuni(filtered);
  }, [filter, customPeriod, obracuniProfit]);

  // ---- dobijanje svih artikala za dropdown - koristi artikle iz cjenovnika i arhive ----
  const allArtikli = useMemo(() => {
    const artikliIzArhive = [...new Set(obracuniProfit.flatMap((o) => o.artikliProfit.map((a) => a.naziv)))];
    const artikliIzCjenovnika = cjenovnik.map((item) => item.naziv);
    // Kombiniraj i ukloni duplikate - prioritet artiklima iz cjenovnika
    return [...new Set([...artikliIzCjenovnika, ...artikliIzArhive])].sort();
  }, [obracuniProfit, cjenovnik]);

  // ---- agregacija podataka za grafikon profita po artiklu ----
  const aggregateArtiklProfitData = (
    selectedArtikl: string,
    selectedFilter: "trenutnaSedmica" | "proslaSedmica" | "prosliMjesec" | "custom"
  ): ArtiklProfitData[] => {
    let filteredData = obracuniProfit
      .map((o) => {
        const artikal = o.artikliProfit.find((a) => a.naziv === selectedArtikl);
        return {
          datum: o.datum,
          bruto: artikal ? artikal.bruto : 0, // prodajnaCijena * kolicina
          neto: artikal ? artikal.neto : 0,   // (prodajnaCijena - nabavnaCijena) * kolicina
        };
      })
      .filter((o) => o.bruto > 0 || o.neto > 0)
      .sort((a, b) => {
        const dateA = new Date(a.datum.split(".").reverse().join("-")).getTime();
        const dateB = new Date(b.datum.split(".").reverse().join("-")).getTime();
        return dateA - dateB; // Uzlazni redoslijed
      });

    const danas = new Date();

    if (selectedFilter === "trenutnaSedmica") {
      const firstDay = new Date(danas);
      firstDay.setDate(danas.getDate() - danas.getDay() + 1); // ponedeljak
      filteredData = filteredData.filter((o) => {
        const dTime = new Date(o.datum.split(".").reverse().join("-")).getTime();
        return dTime >= firstDay.getTime() && dTime <= danas.getTime();
      });
    } else if (selectedFilter === "proslaSedmica") {
      const firstDayPrev = new Date(danas);
      firstDayPrev.setDate(danas.getDate() - danas.getDay() - 6); // ponedeljak prošle sedmice
      const lastDayPrev = new Date(danas);
      lastDayPrev.setDate(danas.getDate() - danas.getDay()); // nedelja prošle sedmice
      filteredData = filteredData.filter((o) => {
        const dTime = new Date(o.datum.split(".").reverse().join("-")).getTime();
        return dTime >= firstDayPrev.getTime() && dTime <= lastDayPrev.getTime();
      });
    } else if (selectedFilter === "prosliMjesec") {
      const firstDayPrevMonth = new Date(danas.getFullYear(), danas.getMonth() - 1, 1);
      const lastDayPrevMonth = new Date(danas.getFullYear(), danas.getMonth(), 0);
      filteredData = filteredData.filter((o) => {
        const dTime = new Date(o.datum.split(".").reverse().join("-")).getTime();
        return dTime >= firstDayPrevMonth.getTime() && dTime <= lastDayPrevMonth.getTime();
      });
    } else if (selectedFilter === "custom") {
      const fromTime = new Date(customPeriod.from).getTime();
      const toTime = new Date(customPeriod.to).getTime();
      filteredData = filteredData.filter((o) => {
        const dTime = new Date(o.datum.split(".").reverse().join("-")).getTime();
        return dTime >= fromTime && dTime <= toTime;
      });
    }

    return filteredData.map((o) => ({
      datum: o.datum,
      bruto: Number(o.bruto),
      neto: Number(o.neto),
    }));
  };

  // ---- sortiranje podataka za glavni grafikon u uzlaznom redoslijedu ----
  const chartData = useMemo(() => {
    return [...filteredObracuni]
      .sort((a, b) => {
        const dateA = new Date(a.datum.split(".").reverse().join("-")).getTime();
        const dateB = new Date(b.datum.split(".").reverse().join("-")).getTime();
        return dateA - dateB; // Uzlazni redoslijed za grafikon (stariji prvo)
      })
      .map((o) => ({
        datum: o.datum,
        bruto: o.ukupnoBruto,
        neto: o.ukupnoNeto,
        rashod: o.ukupnoRashod,
      }));
  }, [filteredObracuni]);

  // ---- podaci za grafikon profita odabranog artikla ----
  const selectedArtiklData = aggregateArtiklProfitData(selectedArtikl, artiklFilter);

  // ---- ukupni bruto i neto za odabrani artikal ----
  const totalArtiklSummary = useMemo(() => {
    return selectedArtiklData.reduce(
      (acc, o) => {
        acc.bruto += Number(o.bruto);
        acc.neto += Number(o.neto);
        return acc;
      },
      { bruto: 0, neto: 0 }
    );
  }, [selectedArtiklData]);

  const ukupnoPeriod = useMemo(() => {
    return filteredObracuni.reduce(
      (acc, o) => {
        acc.rashod += o.ukupnoRashod;
        acc.bruto += o.ukupnoBruto;
        acc.neto += o.ukupnoNeto;
        return acc;
      },
      { rashod: 0, bruto: 0, neto: 0 }
    );
  }, [filteredObracuni]);

  // ---- Custom Tooltip za grafikon ----
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: "#1f2937", color: "#fff", padding: 12, borderRadius: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
          {payload.map((p: any) => {
            return (
              <div key={p.dataKey} style={{ marginBottom: 4 }}>
                <span style={{ color: p.color, fontWeight: 500 }}>{p.name}: </span>
                {p.value.toFixed(2)} KM
              </div>
            );
          })}
        </div>
      );
    }
    return (
      <div style={{ backgroundColor: "#1f2937", color: "#fff", padding: 12, borderRadius: 8 }}>
        <div style={{ fontWeight: 600 }}>Odaberite artikal za prikaz podataka</div>
      </div>
    );
  };

  // Debug info
  console.log("Profit - Render:", {
    obracuniProfitLength: obracuniProfit.length,
    filteredObracuniLength: filteredObracuni.length,
    cjenovnikLength: cjenovnik.length,
    allArtikliLength: allArtikli.length,
  });

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
            {localStorage.getItem("profitPassword") 
              ? "Unesite šifru za pristup Profit stranici"
              : "Postavite šifru za Profit stranicu (min. 4 znaka)"}
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
            {localStorage.getItem("profitPassword") ? "Pristupi" : "Postavi šifru"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <style jsx>{`
        * {
          box-sizing: border-box;
        }
        @media (max-width: 768px) {
          div[style*='maxWidth: 1200px'] { 
            padding: 10px !important; 
            max-width: 100vw !important;
            overflow-x: hidden !important;
          }
          body {
            overflow-x: hidden !important;
          }
          h1 { font-size: 20px; margin-bottom: 16px !important; }
          h2 { font-size: 16px; margin-bottom: 12px !important; word-wrap: break-word; }
          div[style*='height: 300'] { 
            height: 280px; 
            padding: 10px !important; 
            max-width: 100% !important;
            overflow: hidden !important;
          }
          div[style*='display: flex'] { 
            flex-direction: column; 
            gap: 8px; 
            max-width: 100% !important;
          }
          button { 
            width: 100% !important; 
            max-width: 100% !important;
            margin: 4px 0; 
            padding: 10px; 
            font-size: 14px; 
            min-height: 44px; 
            box-sizing: border-box;
          }
          input[type="date"] { 
            width: 100% !important; 
            max-width: 100% !important;
            margin: 4px 0; 
            padding: 8px; 
            font-size: 14px; 
            min-height: 44px; 
            box-sizing: border-box;
          }
          select { 
            width: 100% !important; 
            max-width: 100% !important;
            padding: 8px; 
            font-size: 14px; 
            min-height: 44px; 
            box-sizing: border-box;
          }
          table { 
            font-size: 12px; 
            width: 100% !important;
            max-width: 100% !important;
            overflow-x: auto !important;
            display: block !important;
          }
          th, td { 
            padding: 8px !important; 
            font-size: 11px !important; 
            white-space: nowrap;
            min-width: 80px;
          }
          .recharts-wrapper { 
            width: 100% !important; 
            max-width: 100% !important;
            overflow: hidden !important;
          }
          .recharts-surface { 
            width: 100% !important; 
            max-width: 100% !important;
          }
          div[style*='gap: 24px'] { 
            flex-direction: column; 
            gap: 8px !important; 
            width: 100% !important;
            max-width: 100% !important;
          }
          div[style*='padding: 20px'] {
            padding: 10px !important;
            max-width: 100% !important;
            overflow: hidden !important;
          }
          label {
            width: 100% !important;
            margin-bottom: 8px !important;
          }
          div[style*='marginBottom: 20'] {
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Profit</h1>
      
      {/* Debug info - ukloni nakon testiranja */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ 
          padding: "12px", 
          background: "#f3f4f6", 
          borderRadius: "8px", 
          marginBottom: "20px",
          fontSize: "12px",
          color: "#6b7280"
        }}>
          <div>Obračuna u arhivi: {obracuniProfit.length}</div>
          <div>Filtrirano obračuna: {filteredObracuni.length}</div>
          <div>Artikala u cjenovniku: {cjenovnik.length}</div>
          <div>Ukupno artikala: {allArtikli.length}</div>
        </div>
      )}

      <FilterSection
        filter={filter}
        setFilter={setFilter}
        customPeriod={customPeriod}
        setCustomPeriod={setCustomPeriod}
        label="Filter ukupnog profita"
      />

      {/* ---- Chart ukupnog profita ---- */}
      <div style={{ width: "100%", maxWidth: "100%", height: 300, marginBottom: 20, overflow: "hidden", boxSizing: "border-box" }}>
        <ResponsiveContainer width="100%" height="100%" minHeight={280}>
          <LineChart data={chartData} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="datum" 
              tick={{ fill: "#6b7280", fontSize: 11 }} 
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} width={50} />
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: "12px" }} />
            <Line type="monotone" dataKey="bruto" name="Bruto" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="neto" name="Neto" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="rashod" name="Rashod" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ---- Ukupno odmah ispod charta ---- */}
      <div style={{ ...summaryStyle, background: "#e5e7eb", marginBottom: 30 }}>
        <div style={summaryItemStyle("#ef4444")}>Ukupno rashod: {ukupnoPeriod.rashod.toFixed(2)} KM</div>
        <div style={summaryItemStyle("#3b82f6")}>Ukupno bruto: {ukupnoPeriod.bruto.toFixed(2)} KM</div>
        <div style={summaryItemStyle("#10b981")}>Ukupno neto: {ukupnoPeriod.neto.toFixed(2)} KM</div>
      </div>

      {/* ---- Odabir artikla i filter za grafikon profita po artiklu ---- */}
      <div style={{ marginBottom: 20, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8, width: "100%" }}>
          <label style={{ fontWeight: 500, minWidth: "fit-content" }}>Odaberi artikal:</label>
          <select
            value={selectedArtikl}
            onChange={(e) => setSelectedArtikl(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db", flex: 1, minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}
          >
            <option value="">Odaberi artikal</option>
            {allArtikli.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <FilterSection
          filter={artiklFilter}
          setFilter={setArtiklFilter}
          customPeriod={customPeriod}
          setCustomPeriod={setCustomPeriod}
          label="Filter profita po artiklu"
        />
      </div>

      {/* ---- Grafikon profita odabranog artikla ---- */}
      <div
        style={{
          width: "100%",
          maxWidth: "100%",
          height: 300,
          backgroundColor: "#fff",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          marginBottom: 10,
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <ResponsiveContainer width="100%" height="100%" minHeight={280}>
          <LineChart data={selectedArtiklData} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="datum" 
              tick={{ fill: "#6b7280", fontSize: 11 }} 
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} width={50} />
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: "12px" }} />
            <Line type="monotone" dataKey="bruto" name="Bruto artikal" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="neto" name="Neto artikal" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ ...summaryStyle, marginBottom: 30 }}>
        <div style={summaryItemStyle("#3b82f6")}>
          Ukupni bruto ({selectedArtikl || "Nema odabranog artikla"}): {totalArtiklSummary.bruto.toFixed(2)} KM
        </div>
        <div style={summaryItemStyle("#10b981")}>
          Ukupni neto ({selectedArtikl || "Nema odabranog artikla"}): {totalArtiklSummary.neto.toFixed(2)} KM
        </div>
      </div>

      {/* ---- Poruka ako nema podataka ---- */}
      {filteredObracuni.length === 0 && (
        <div style={{ 
          textAlign: "center", 
          padding: "40px", 
          background: "#fff", 
          borderRadius: "12px", 
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          marginTop: "20px"
        }}>
          <p style={{ fontSize: "16px", color: "#6b7280", marginBottom: "8px" }}>
            Nema obračuna za odabrani period.
          </p>
          <p style={{ fontSize: "14px", color: "#9ca3af" }}>
            {obracuniProfit.length === 0 
              ? "Nema obračuna u arhivi. Spremite obračun da biste vidjeli profit." 
              : "Promijenite filter da biste vidjeli obračune za drugi period."}
          </p>
        </div>
      )}

      {/* ---- Detaljni obračuni po danima ---- */}
      {filteredObracuni.map((o, i) => (
        <div key={i} style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Obračun - {o.datum}</h2>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Artikal</th>
                <th style={thStyle}>Nabavna cijena</th>
                <th style={thStyle}>Prodajna cijena</th>
                <th style={thStyle}>Količina</th>
                <th style={thStyle}>Bruto</th>
                <th style={thStyle}>Neto</th>
                <th style={thStyle}>Profit po artiklu</th>
              </tr>
            </thead>
            <tbody>
              {o.artikliProfit.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>
                    Nema artikala s utrošenim količinama za ovaj obračun.
                  </td>
                </tr>
              ) : (
                o.artikliProfit.map((a, j) => (
                  <tr key={j}>
                    <td style={tdStyle}>{a.naziv}</td>
                    <td style={tdStyle}>{a.nabavnaCijena.toFixed(2)}</td>
                    <td style={tdStyle}>{a.prodajnaCijena.toFixed(2)}</td>
                    <td style={tdStyle}>{a.kolicina.toFixed(2)}</td>
                    <td style={tdStyle}>{a.bruto.toFixed(2)}</td>
                    <td style={tdStyle}>{a.neto.toFixed(2)}</td>
                    <td style={tdStyle}>{a.profit.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div style={summaryStyle}>
            <div style={summaryItemStyle("#ef4444")}>Ukupno rashod: {o.ukupnoRashod.toFixed(2)} KM</div>
            <div style={summaryItemStyle("#3b82f6")}>Ukupno bruto: {o.ukupnoBruto.toFixed(2)} KM</div>
            <div style={summaryItemStyle("#10b981")}>Ukupno neto: {o.ukupnoNeto.toFixed(2)} KM</div>
          </div>
        </div>
      ))}
    </div>
  );
}