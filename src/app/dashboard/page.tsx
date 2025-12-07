"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { FaArrowUp, FaArrowDown, FaDollarSign } from "react-icons/fa";
import { auth, onAuthStateChanged } from "../../lib/firebase";
import { useRouter } from "next/navigation";
import { getDocs, collection, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firestore";
import { useCjenovnik } from "../context/CjenovnikContext";
import { useAppName } from "../context/AppNameContext";

// Tipovi preuzeti iz ObracunPage
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
};

type Rashod = {
  naziv: string;
  cijena: number;
};

type ArhiviraniObracun = {
  datum: string;
  ukupnoArtikli: number;
  ukupnoRashod: number;
  ukupnoPrihod?: number;
  neto: number;
  artikli: ArhiviraniArtikal[];
  rashodi: Rashod[];
  prihodi?: Rashod[];
  imaUlaz?: boolean;
  isAzuriran?: boolean;
};

// Tip za podatke u grafikonu
type Obracun = {
  datum: string;
  artikli: number;
  rashod: number;
  neto: number;
};

// Tip za agregirane podatke
type AggregatedData = {
  datum: string;
  artikli: number;
  rashod: number;
  neto: number;
};

// Tip za podatke specifičnog artikla
type ArtiklData = {
  datum: string;
  utroseno: number;
};

export default function DashboardPage() {
  const [range, setRange] = useState<"currentWeek" | "previousWeek" | "previousMonth" | "custom">("currentWeek");
  const [customFrom, setCustomFrom] = useState<string>(
    new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split("T")[0]
  );
  const [customTo, setCustomTo] = useState<string>(new Date().toISOString().split("T")[0]);
  const [selectedArtikl, setSelectedArtikl] = useState<string>("");
  const [artiklRange, setArtiklRange] = useState<"currentWeek" | "previousWeek" | "previousMonth" | "custom">("currentWeek");
  const [arhiva, setArhiva] = useState<ArhiviraniObracun[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const router = useRouter();
  const { cjenovnik } = useCjenovnik();
  const { appName } = useAppName();

  // Detekcija mobilnog uređaja
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      console.log('Dashboard - Screen width:', window.innerWidth, 'isMobile:', mobile);
    };
    // Proveri odmah i na resize
    if (typeof window !== 'undefined') {
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }
  }, []);

  // Funkcija za učitavanje arhive - HIBRIDNI PRISTUP
  const loadArhiva = useCallback(async () => {
    try {
      const user = auth.currentUser;
      const userId = user?.uid;
      
      let firestoreArhiva: ArhiviraniObracun[] = [];
      
      // 1. POKUŠAJ UČITATI IZ FIRESTORE (primarni izvor)
      if (user && userId) {
        try {
          const querySnapshot = await getDocs(collection(db, "users", userId, "obracuni"));
          firestoreArhiva = querySnapshot.docs.map((doc) => {
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
          const errorCode = error?.code || "";
          if (errorCode !== "permission-denied" && !errorCode.includes("permission") && !errorCode.includes("insufficient")) {
            console.warn("Greška pri učitavanju iz Firestore:", error);
          }
        }
      }
      
      // Sortiraj po datumu (rastući redoslijed za dashboard)
      const sortedArhiva = firestoreArhiva.sort((a, b) => {
        const dateA = new Date(a.datum.split(".").reverse().join("-")).getTime();
        const dateB = new Date(b.datum.split(".").reverse().join("-")).getTime();
        return dateA - dateB;
      });
      
      setArhiva(sortedArhiva);
      setLoading(false);
      setError(null);
    } catch (error) {
      console.error("Greška pri učitavanju:", error);
      setError("Greška pri učitavanju podataka.");
      setLoading(false);
    }
  }, []);

  // Učitavanje arhive iz Firestore
  useEffect(() => {
    loadArhiva();
  }, [loadArhiva]);

  // Listener za promjene u arhivi
  useEffect(() => {
    const handleArhivaChange = () => {
      setTimeout(() => {
        loadArhiva();
      }, 100);
    };

    window.addEventListener("arhivaChanged", handleArhivaChange);
    return () => {
      window.removeEventListener("arhivaChanged", handleArhivaChange);
    };
  }, [loadArhiva]);

  // OPCIONALNO: Pokušaj učitati iz Firestore-a (fallback)
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      try {
        const querySnapshot = await getDocs(collection(db, "users", user.uid, "obracuni"));
        const firestorePodaci: ArhiviraniObracun[] = [];

        querySnapshot.forEach((doc) => {
          firestorePodaci.push(doc.data() as ArhiviraniObracun);
        });

        // Koristi Firestore podatke
        if (firestorePodaci.length > 0) {
          firestorePodaci.sort((a, b) => {
            const dateA = new Date(a.datum.split(".").reverse().join("-")).getTime();
            const dateB = new Date(b.datum.split(".").reverse().join("-")).getTime();
            return dateA - dateB;
          });
          setArhiva(firestorePodaci);
          console.log("Učitano iz Firestore-a:", firestorePodaci.length, "obračuna");
        }
      } catch (error: any) {
        // Ignoriraj greške dozvola - koristi localStorage
        const errorCode = error?.code || "";
        if (errorCode !== "permission-denied" && !errorCode.includes("permission") && !errorCode.includes("insufficient")) {
          console.warn("Nije moguće učitati iz Firestore-a (možda nema interneta):", error);
        }
        // Ne prikazuj grešku
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  // Priprema podataka za grafikon
  const obracuni: Obracun[] = arhiva
    .map((o) => {
      const ukupnoPrihodi = o.prihodi?.reduce((sum, p) => sum + p.cijena, 0) || 0;
      return {
        datum: o.datum,
        artikli: o.ukupnoArtikli + ukupnoPrihodi,
        rashod: o.ukupnoRashod,
        neto: (o.ukupnoArtikli + ukupnoPrihodi) - o.ukupnoRashod,
      };
    })
    .sort((a, b) => {
      const dateA = new Date(a.datum.split(".").reverse().join("-")).getTime();
      const dateB = new Date(b.datum.split(".").reverse().join("-")).getTime();
      return dateA - dateB;
    });

  // Dobivanje svih artikala za dropdown - koristi artikle iz cjenovnika i arhive
  const artikliIzArhive = [...new Set(arhiva.flatMap((o) => (o.artikli && Array.isArray(o.artikli)) ? o.artikli.map((a) => a.naziv) : []))];
  const artikliIzCjenovnika = cjenovnik.map((item) => item.naziv);
  // Kombiniraj i ukloni duplikate - prioritet artiklima iz cjenovnika
  const allArtikli = [...new Set([...artikliIzCjenovnika, ...artikliIzArhive])].sort();

  // Funkcija za agregaciju podataka
  const aggregateData = (
    data: Obracun[],
    selectedRange: "currentWeek" | "previousWeek" | "previousMonth" | "custom"
  ): AggregatedData[] => {
    let filteredData = data;

    const today = new Date();
    const getMonday = (d: Date) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      date.setDate(date.getDate() + diff);
      date.setHours(0, 0, 0, 0);
      return date;
    };

    if (selectedRange === "currentWeek") {
      const monday = getMonday(today);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      filteredData = data.filter((o) => {
        const dTime = new Date(o.datum.split(".").reverse().join("-")).getTime();
        return dTime >= monday.getTime() && dTime <= sunday.getTime();
      });
    } else if (selectedRange === "previousWeek") {
      const monday = getMonday(new Date(today.setDate(today.getDate() - 7)));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      filteredData = data.filter((o) => {
        const dTime = new Date(o.datum.split(".").reverse().join("-")).getTime();
        return dTime >= monday.getTime() && dTime <= sunday.getTime();
      });
    } else if (selectedRange === "previousMonth") {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      lastDay.setHours(23, 59, 59, 999);
      filteredData = data.filter((o) => {
        const dTime = new Date(o.datum.split(".").reverse().join("-")).getTime();
        return dTime >= firstDay.getTime() && dTime <= lastDay.getTime();
      });
    } else if (selectedRange === "custom") {
      const fromTime = new Date(customFrom).getTime();
      const toTime = new Date(customTo).getTime();
      filteredData = data.filter((o) => {
        const dTime = new Date(o.datum.split(".").reverse().join("-")).getTime();
        return dTime >= fromTime && dTime <= toTime;
      });
    }

    return filteredData.map((o) => ({
      datum: o.datum,
      artikli: Number(o.artikli),
      rashod: Number(o.rashod),
      neto: Number(o.neto),
    }));
  };

  // Funkcija za agregaciju podataka za odabrani artikal
  const aggregateArtiklData = (
    selectedArtikl: string,
    selectedRange: "currentWeek" | "previousWeek" | "previousMonth" | "custom"
  ): ArtiklData[] => {
    let filteredData = arhiva
      .map((o) => ({
        datum: o.datum,
        utroseno: o.artikli.find((a) => a.naziv === selectedArtikl)?.utroseno || 0,
      }))
      .filter((o) => o.utroseno > 0)
      .sort((a, b) => {
        const dateA = new Date(a.datum.split(".").reverse().join("-")).getTime();
        const dateB = new Date(b.datum.split(".").reverse().join("-")).getTime();
        return dateA - dateB;
      });

    const today = new Date();
    const getMonday = (d: Date) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      date.setDate(date.getDate() + diff);
      date.setHours(0, 0, 0, 0);
      return date;
    };

    if (selectedRange === "currentWeek") {
      const monday = getMonday(today);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      filteredData = filteredData.filter((o) => {
        const dTime = new Date(o.datum.split(".").reverse().join("-")).getTime();
        return dTime >= monday.getTime() && dTime <= sunday.getTime();
      });
    } else if (selectedRange === "previousWeek") {
      const monday = getMonday(new Date(today.setDate(today.getDate() - 7)));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      filteredData = filteredData.filter((o) => {
        const dTime = new Date(o.datum.split(".").reverse().join("-")).getTime();
        return dTime >= monday.getTime() && dTime <= sunday.getTime();
      });
    } else if (selectedRange === "previousMonth") {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      lastDay.setHours(23, 59, 59, 999);
      filteredData = filteredData.filter((o) => {
        const dTime = new Date(o.datum.split(".").reverse().join("-")).getTime();
        return dTime >= firstDay.getTime() && dTime <= lastDay.getTime();
      });
    } else if (selectedRange === "custom") {
      const fromTime = new Date(customFrom).getTime();
      const toTime = new Date(customTo).getTime();
      filteredData = filteredData.filter((o) => {
        const dTime = new Date(o.datum.split(".").reverse().join("-")).getTime();
        return dTime >= fromTime && dTime <= toTime;
      });
    }

    return filteredData.map((o) => ({
      datum: o.datum,
      utroseno: Number(o.utroseno),
    }));
  };

  // Podaci za grafikon
  const chartData = aggregateData(obracuni, range);
  const selectedData = selectedArtikl ? aggregateArtiklData(selectedArtikl, artiklRange) : [];

  // Ukupne vrijednosti
  const totalBruto = chartData.reduce((sum, o) => sum + Number(o.artikli), 0);
  const totalRashod = chartData.reduce((sum, o) => sum + Number(o.rashod), 0);
  const totalNeto = chartData.reduce((sum, o) => sum + Number(o.neto), 0);
  const totalArtikl = selectedData.reduce((sum, o) => sum + Number(o.utroseno), 0);

  const growth = (current: number, previous: number) =>
    previous === 0 ? "0" : (((current - previous) / previous) * 100).toFixed(1);

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any; label?: string }) => {
    if (active && payload && payload.length) {
      const dataSource = payload[0].dataKey === "utroseno" ? selectedData : chartData;
      const unit = dataSource === chartData ? " KM" : "";

      return (
        <div style={{ backgroundColor: "#1f2937", color: "#fff", padding: 12, borderRadius: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
          {payload.map((p: any) => {
            return (
              <div key={p.dataKey} style={{ marginBottom: 4 }}>
                <span style={{ color: p.color, fontWeight: 500 }}>{p.name}: </span>
                {p.value.toFixed(2)}{unit}
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 20 }}>Učitavanje podataka...</div>;
  }

  if (error) {
    return <div style={{ textAlign: "center", padding: 20, color: "red" }}>{error}</div>;
  }

  return (
    <div style={{ padding: 30, fontFamily: "'Inter', sans-serif", backgroundColor: "#f4f5f7", minHeight: "100vh" }}>
      <style jsx>{`
        .dashboard-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
        }
        @media (max-width: 768px) {
          div[style*='padding: 30px'] { padding: 10px; }
          h1 { font-size: 18px; margin-bottom: 16px !important; }
          div[style*='fontSize: 36'] { font-size: 14px !important; }
          div[style*='fontSize: 28'] { font-size: 18px !important; }
          /* Ime aplikacije - mobilni stil - pojačan selector */
          div.app-name-header {
            padding: 6px 8px !important;
            margin-bottom: 12px !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
          h1.app-name-title,
          div.app-name-header h1,
          div[class*="app-name-header"] h1,
          .app-name-header .app-name-title {
            font-size: 12px !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            line-height: 1.2 !important;
            max-width: 100% !important;
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            letter-spacing: 0 !important;
            width: 100% !important;
            box-sizing: border-box !important;
            font-weight: 600 !important;
          }
          /* Override inline stilove sa fontSize: 36 - još jači selektor */
          div[style*="fontSize: 36"] h1.app-name-title,
          div[style*="fontSize: 36"].app-name-title,
          div[style*="fontSize: 14"] h1.app-name-title,
          div[style*="fontSize: 12"] h1.app-name-title,
          .app-name-header h1[style*="fontSize: 36"],
          .app-name-header h1[style*="fontSize: 14"],
          .app-name-header h1[style*="fontSize: 12"],
          .app-name-header h1[style*="fontSize"] {
            font-size: 12px !important;
          }
          /* Override svi h1 elementi unutar app-name-header */
          .app-name-header h1 {
            font-size: 12px !important;
            font-weight: 600 !important;
          }
          .decorative-circle-1,
          .decorative-circle-2 {
            display: none !important;
          }
          div[style*='display: flex'][style*='flexWrap'][style*='marginBottom: 30'] { 
            flex-direction: column; 
            gap: 10px; 
            align-items: stretch;
            padding-left: 0 !important;
            padding-right: 0 !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
          div[style*='min-width: 160px'] { min-width: 100%; max-width: 100% !important; }
          button { width: 100%; margin: 5px 0; padding: 10px; font-size: 14px; min-height: 44px; }
          input[type="date"] { width: 100%; margin: 5px 0; padding: 8px; font-size: 14px; min-height: 44px; }
          div[style*='height: 400'] { height: 350px; padding: 10px !important; }
          div[style*='height: 300'] { height: 280px; padding: 10px !important; }
          .dashboard-card { 
            min-width: 100% !important; 
            max-width: 100% !important;
            flex: 1 1 100% !important;
            width: 100% !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
            box-sizing: border-box !important;
          }
          /* Parent div za kartice (Bruto, Rashod, Neto) - osiguraj iste margine */
          div[style*='display: flex'][style*='gap: 20'][style*='flexWrap'][style*='marginBottom: 30'] {
            padding-left: 0 !important;
            padding-right: 0 !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
            gap: 10px !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
          /* Osiguraj da kartice imaju iste margine kao i ostali elementi */
          div[style*='display: flex'][style*='gap: 20'][style*='flexWrap'][style*='marginBottom: 30'] > .dashboard-card {
            width: 100% !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
            box-sizing: border-box !important;
          }
          div[style*='background: linear-gradient'][style*='#667eea'] {
            width: 100% !important;
            box-sizing: border-box !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
          div[style*='backgroundColor: #fff'][style*='borderRadius: 12'] {
            width: 100% !important;
            box-sizing: border-box !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
          .recharts-wrapper { width: 100% !important; }
          .recharts-surface { width: 100% !important; }
        }
      `}</style>

      {/* Ime aplikacije - poboljšan dizajn */}
      <div style={{ 
        textAlign: "center", 
        marginBottom: isMobile ? 12 : 40,
        padding: isMobile ? "6px 8px" : "24px 32px",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        borderRadius: isMobile ? "12px" : "16px",
        boxShadow: "0 8px 24px rgba(102, 126, 234, 0.25)",
        position: "relative",
        overflow: "hidden",
        width: "100%",
        boxSizing: "border-box"
      }} className="app-name-header">
        {/* Dekorativni elementi */}
        {!isMobile && (
          <>
            <div style={{
              position: "absolute",
              top: -50,
              right: -50,
              width: 200,
              height: 200,
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.1)",
              pointerEvents: "none"
            }} className="decorative-circle-1" />
            <div style={{
              position: "absolute",
              bottom: -30,
              left: -30,
              width: 150,
              height: 150,
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.08)",
              pointerEvents: "none"
            }} className="decorative-circle-2" />
          </>
        )}
        
        <h1 style={{ 
          fontSize: isMobile ? 12 : 36,
          fontWeight: isMobile ? 600 : 700, 
          color: "#ffffff",
          margin: 0,
          padding: 0,
          textShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
          letterSpacing: isMobile ? "0" : "-0.5px",
          position: "relative",
          zIndex: 1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineHeight: isMobile ? "1.2" : "1.2",
          maxWidth: "100%",
          display: "block",
          width: "100%",
          boxSizing: "border-box"
        }} className="app-name-title">
          {appName}
        </h1>
      </div>


      {/* Range za prvi grafikon */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 30, alignItems: "center" }}>
        {[
          { value: "currentWeek", label: "Trenutna sedmica" },
          { value: "previousWeek", label: "Prošla sedmica" },
          { value: "previousMonth", label: "Prošli mjesec" },
          { value: "custom", label: "Prilagođeni period" },
        ].map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value as any)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontWeight: 500,
              fontSize: 14,
              background: range === r.value ? "#3b82f6" : "#e5e7eb",
              color: range === r.value ? "#fff" : "#374151",
              transition: "all 0.2s",
              boxShadow: range === r.value ? "0 2px 8px rgba(59,130,246,0.3)" : "none",
            }}
          >
            {r.label}
          </button>
        ))}

        {range === "custom" && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginLeft: 10 }}>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db", outline: "none" }}
            />
            <span style={{ color: "#6b7280" }}>to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db", outline: "none" }}
            />
          </div>
        )}
      </div>

      {/* Grafikon ukupne zarade */}
      <div
        className="chart-container"
        style={{
          width: "100%",
          maxWidth: "100%",
          height: 400,
          backgroundColor: "#fff",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          marginBottom: 30,
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        {chartData && chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%" minHeight={300}>
            <LineChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
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
              <Line type="monotone" dataKey="artikli" name="Bruto" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="rashod" name="Rashod" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="neto" name="Neto" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center", 
            height: "100%",
            color: "#6b7280",
            fontSize: "14px"
          }}>
            Nema podataka za prikaz
          </div>
        )}
      </div>

      {/* Kartice */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 30, width: "100%", boxSizing: "border-box" }}>
        {[
          {
            label: "Bruto",
            value: totalBruto,
            icon: <FaArrowUp color="#16a34a" size={20} />,
          },
          {
            label: "Rashod",
            value: totalRashod,
            icon: <FaArrowDown color="#dc2626" size={20} />,
          },
          {
            label: "Neto",
            value: totalNeto,
            icon: <FaDollarSign color="#3b82f6" size={20} />,
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              flex: 1,
              minWidth: 160,
              backgroundColor: "#fff",
              borderRadius: 12,
              padding: 20,
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
              transition: "transform 0.2s, box-shadow 0.2s",
              cursor: "default",
            }}
            className="dashboard-card"
          >
            <div>{item.icon}</div>
            <div>
              <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>{item.value.toFixed(2)} KM</div>
            </div>
          </div>
        ))}
      </div>

      {/* Artikal grafikon */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <label style={{ marginRight: 10, fontWeight: 500 }}>Odaberi artikal:</label>
          <select
            value={selectedArtikl}
            onChange={(e) => setSelectedArtikl(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db" }}
          >
            <option value="">Odaberi artikal</option>
            {allArtikli.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          {[
            { value: "currentWeek", label: "Trenutna sedmica" },
            { value: "previousWeek", label: "Prošla sedmica" },
            { value: "previousMonth", label: "Prošli mjesec" },
            { value: "custom", label: "Prilagođeni period" },
          ].map((r) => (
            <button
              key={r.value}
              onClick={() => setArtiklRange(r.value as any)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: 14,
                background: artiklRange === r.value ? "#3b82f6" : "#e5e7eb",
                color: artiklRange === r.value ? "#fff" : "#374151",
                transition: "all 0.2s",
                boxShadow: artiklRange === r.value ? "0 2px 8px rgba(59,130,246,0.3)" : "none",
              }}
            >
              {r.label}
            </button>
          ))}

          {artiklRange === "custom" && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginLeft: 10 }}>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db", outline: "none" }}
              />
              <span style={{ color: "#6b7280" }}>to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db", outline: "none" }}
              />
            </div>
          )}
        </div>
      </div>

      {selectedArtikl && (
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
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          <ResponsiveContainer width="100%" height="100%" minHeight={280}>
            <LineChart data={selectedData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
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
              <Line type="monotone" dataKey="utroseno" name="Prodaja" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {selectedArtikl && (
        <div style={{ fontWeight: 600, fontSize: 16 }}>
          Ukupno prodano: {totalArtikl.toFixed(2)} ({selectedArtikl})
        </div>
      )}
    </div>
  );
}