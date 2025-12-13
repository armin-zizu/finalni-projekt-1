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
// TEMPORARY: Disabled Firebase imports for development
// import { auth, onAuthStateChanged } from "../../lib/firebase";
import { useRouter } from "next/navigation";
// import { getDocs, collection, onSnapshot } from "firebase/firestore";
// import { db } from "../../lib/firestore";
import { useCjenovnik } from "../context/CjenovnikContext";
import { useAppName } from "../context/AppNameContext";
import { useRole } from "../context/RoleContext";
import { getObracuni } from "../../lib/api";

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
  const [chartKey, setChartKey] = useState(0);
  const router = useRouter();
  const { cjenovnik } = useCjenovnik();
  const { appName } = useAppName();
  const { user } = useRole();

  // Detekcija mobilnog uređaja - poboljšana za produkciju
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window === 'undefined') return false;
      // Provjeri i window.innerWidth i screen.width za pouzdanost
      const width = window.innerWidth || (window.screen && window.screen.width) || 1024;
      const mobile = width <= 768;
      return mobile;
    };
    
    // Proveri odmah i na resize
    if (typeof window !== 'undefined') {
      const wasMobile = isMobile;
      const newMobile = checkMobile();
      
      if (wasMobile !== newMobile) {
        setIsMobile(newMobile);
        setChartKey(prev => prev + 1);
      } else {
        setIsMobile(newMobile);
      }
      
      const handleResize = () => {
        const newMobile = checkMobile();
        if (newMobile !== isMobile) {
          setIsMobile(newMobile);
          setChartKey(prev => prev + 1);
        }
      };
      
      const handleOrientationChange = () => {
        setTimeout(() => {
          const newMobile = checkMobile();
          setIsMobile(newMobile);
          setChartKey(prev => prev + 1);
        }, 100);
      };
      
      // Dodaj mali delay za SSR/CSR sync
      const timer = setTimeout(() => {
        const newMobile = checkMobile();
        setIsMobile(newMobile);
      }, 0);
      
      window.addEventListener('resize', handleResize);
      window.addEventListener('orientationchange', handleOrientationChange);
      
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleOrientationChange);
      };
    }
  }, [isMobile]);

  // Učitaj arhivu iz API-ja
  const loadArhiva = useCallback(async (userId: string) => {
    try {
      console.log("Dashboard - Učitavanje arhive za korisnika:", userId);
      setLoading(true);
      
      // Učitaj iz API-ja - API već vraća transformirane podatke
      const obracuni = await getObracuni(userId);
      
      // API već vraća podatke u ispravnom formatu, samo provjeri da su arrayi
      const firestoreArhiva: ArhiviraniObracun[] = obracuni.map((ob: any) => ({
        datum: ob.datum,
        ukupnoArtikli: Number(ob.ukupnoArtikli) || 0,
        ukupnoRashod: Number(ob.ukupnoRashod) || 0,
        ukupnoPrihod: Number(ob.ukupnoPrihod) || 0,
        neto: Number(ob.neto) || 0,
        artikli: Array.isArray(ob.artikli) ? ob.artikli : [],
        rashodi: Array.isArray(ob.rashodi) ? ob.rashodi : [],
        prihodi: Array.isArray(ob.prihodi) ? ob.prihodi : [],
        imaUlaz: ob.imaUlaz === true || ob.imaUlaz === 'true',
        isAzuriran: ob.isAzuriran === true || ob.isAzuriran === 'true',
      }));
      
      // Sortiraj po datumu (rastući redoslijed za dashboard)
      const sortedArhiva = firestoreArhiva.sort((a, b) => {
        const dateA = new Date(a.datum.split(".").reverse().join("-")).getTime();
        const dateB = new Date(b.datum.split(".").reverse().join("-")).getTime();
        return dateA - dateB;
      });
      
      setArhiva(sortedArhiva);
      setLoading(false);
      setError(null);
      
      console.log("Dashboard - Učitavanje završeno:", {
        brojObračuna: sortedArhiva.length,
      });
    } catch (error) {
      console.error("Dashboard - Kritična greška pri učitavanju:", error);
      setError("Greška pri učitavanju podataka.");
      setLoading(false);
    }
  }, []);

  // TEMPORARY: Disabled Firebase auth listener - comment out to re-enable
  /*
  // ČEKA NA AUTENTIFIKACIJU PRIJE UČITAVANJA
  useEffect(() => {
    console.log("Dashboard - Postavljanje auth listenera...");
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      console.log("Dashboard - Auth state promijenjen:", user ? `Korisnik: ${user.uid}` : "Nema korisnika");
      
      if (!user) {
        console.log("Dashboard - Nema korisnika, ne učitavam podatke");
        setLoading(false);
        return;
      }

      // Sačekaj mali delay da se sve inicijalizuje
      setTimeout(() => {
        loadArhiva(user.uid);
      }, 100);
    });

    return () => {
      unsubscribeAuth();
    };
  }, [loadArhiva]);
  */
  
  // Učitaj arhivu kada se korisnik učita
  useEffect(() => {
    if (user?.id) {
      loadArhiva(user.id);
    } else {
      setLoading(false);
    }
  }, [user?.id, loadArhiva]);
  
  // Listener za promjene u arhivi (kada se doda novi obračun)
  useEffect(() => {
    const handleArhivaChange = () => {
      if (user?.id) {
        setTimeout(() => {
          loadArhiva(user.id);
        }, 100);
      }
    };

    window.addEventListener("arhivaChanged", handleArhivaChange);
    return () => {
      window.removeEventListener("arhivaChanged", handleArhivaChange);
    };
  }, [user?.id, loadArhiva]);

  // TEMPORARY: Disabled Firebase listener - comment out to re-enable
  /*
  // Listener za promjene u arhivi
  useEffect(() => {
    const handleArhivaChange = () => {
      const user = auth.currentUser;
      if (user) {
        setTimeout(() => {
          loadArhiva(user.uid);
        }, 100);
      }
    };

    window.addEventListener("arhivaChanged", handleArhivaChange);
    return () => {
      window.removeEventListener("arhivaChanged", handleArhivaChange);
    };
  }, [loadArhiva]);
  */

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
      const lastWeekDate = new Date(today);
      lastWeekDate.setDate(today.getDate() - 7);
      const monday = getMonday(lastWeekDate);
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
      const lastWeekDate = new Date(today);
      lastWeekDate.setDate(today.getDate() - 7);
      const monday = getMonday(lastWeekDate);
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
          div[style*='padding: 30px'] { padding: 10px !important; }
          h1 { font-size: 22px !important; margin-bottom: 16px !important; }
          div[style*='fontSize: 36'] { font-size: 22px !important; }
          div[style*='fontSize: 28'] { font-size: 18px !important; }
          /* Ime aplikacije - mobilni stil - maksimalno pojačan selector za produkciju */
          div.app-name-header,
          div[class="app-name-header"],
          div[class*="app-name-header"],
          div[style*="app-name-header"] {
            padding: 12px 16px !important;
            margin-bottom: 16px !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }
          /* SVI mogući selektori za h1 naslov - maksimalna specifičnost */
          h1.app-name-title,
          div.app-name-header h1,
          div[class="app-name-header"] h1,
          div[class*="app-name-header"] h1,
          div[style*="app-name-header"] h1,
          .app-name-header .app-name-title,
          .app-name-header h1.app-name-title,
          div.app-name-header > h1,
          h1[class="app-name-title"],
          h1[class*="app-name-title"] {
            font-size: 22px !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            line-height: 1.3 !important;
            max-width: 100% !important;
            width: 100% !important;
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            letter-spacing: 0 !important;
            box-sizing: border-box !important;
            font-weight: 700 !important;
          }
          /* Override inline stilove - maksimalna specifičnost */
          div[style*="fontSize"] h1.app-name-title,
          div[style*="fontSize: 36"] h1.app-name-title,
          div[style*="fontSize: 22"] h1.app-name-title,
          div[style*="fontSize: 14"] h1.app-name-title,
          div[style*="fontSize: 12"] h1.app-name-title,
          div[style*="fontSize: 36"].app-name-title,
          .app-name-header h1[style*="fontSize: 36"],
          .app-name-header h1[style*="fontSize: 22"],
          .app-name-header h1[style*="fontSize: 14"],
          .app-name-header h1[style*="fontSize: 12"],
          .app-name-header h1[style*="fontSize"],
          h1.app-name-title[style*="fontSize: 36"],
          h1.app-name-title[style*="fontSize: 22"],
          h1.app-name-title[style*="fontSize: 14"],
          h1.app-name-title[style*="fontSize: 12"] {
            font-size: 22px !important;
            max-width: 100% !important;
            width: 100% !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
            font-weight: 700 !important;
          }
          /* Override svi h1 elementi unutar app-name-header - dodatna sigurnost */
          .app-name-header h1,
          div.app-name-header h1,
          h1.app-name-title,
          h1[data-mobile="true"],
          h1.app-name-title[data-mobile="true"],
          .app-name-header h1[data-mobile="true"] {
            font-size: 22px !important;
            font-weight: 700 !important;
            max-width: 100% !important;
            width: 100% !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
          }
          /* Najjači mogući override za inline stilove na mobilnim */
          h1.app-name-title[style] {
            font-size: 22px !important;
            font-weight: 700 !important;
            max-width: 100% !important;
            width: 100% !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
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
          .recharts-wrapper { 
            width: 100% !important; 
            height: 280px !important;
            min-height: 280px !important;
            position: relative !important;
          }
          .recharts-surface { 
            width: 100% !important; 
            height: 100% !important;
          }
          .recharts-legend-wrapper {
            width: 100% !important;
          }
          .chart-container {
            position: relative !important;
            overflow: visible !important;
          }
          div[style*='height: 300'][style*='backgroundColor: #fff'] {
            height: 300px !important;
            min-height: 300px !important;
            position: relative !important;
            overflow: visible !important;
          }
          div[style*='height: 400'][style*='backgroundColor: #fff'] {
            height: 350px !important;
            min-height: 350px !important;
            position: relative !important;
            overflow: visible !important;
          }
        }
      `}</style>

      {/* Ime aplikacije - poboljšan dizajn */}
      <div style={{ 
        textAlign: "center", 
        marginBottom: isMobile ? 16 : 40,
        padding: isMobile ? "12px 16px" : "24px 32px",
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
          fontSize: isMobile ? 22 : 36,
          fontWeight: isMobile ? 700 : 700, 
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
          lineHeight: isMobile ? "1.3" : "1.2",
          maxWidth: "100%",
          display: "block",
          width: "100%",
          boxSizing: "border-box"
        }} className="app-name-title" data-mobile={isMobile}>
          {appName}
        </h1>
      </div>


      {/* Range za prvi grafikon - Box samo na mobilnom */}
      {isMobile ? (
        <div style={{ 
          marginBottom: "16px", 
          background: "#fff", 
          padding: "10px 12px", 
          borderRadius: "8px", 
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)", 
          width: "100%", 
          maxWidth: "100%", 
          boxSizing: "border-box" 
        }}>
          <div style={{ 
            display: "flex", 
            gap: 4, 
            flexWrap: "wrap", 
            alignItems: "center", 
            width: "100%" 
          }}>
            {[
              { value: "currentWeek", label: "Trenutna sedmica" },
              { value: "previousWeek", label: "Prošla sedmica" },
              { value: "previousMonth", label: "Prošli mjesec" },
              { value: "custom", label: "Prilagođeni period" },
            ].map((r, index) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value as any)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 500,
                  fontSize: 13,
                  background: range === r.value ? "#3b82f6" : "#e5e7eb",
                  color: range === r.value ? "#fff" : "#374151",
                  transition: "all 0.2s",
                  boxShadow: range === r.value ? "0 2px 8px rgba(59,130,246,0.3)" : "none",
                  whiteSpace: "nowrap",
                  flex: index === 0 || index === 3 ? "1 1 100%" : "1 1 calc(50% - 2px)",
                  minWidth: index === 0 || index === 3 ? "100%" : "calc(50% - 2px)",
                  maxWidth: index === 0 || index === 3 ? "100%" : "calc(50% - 2px)",
                }}
              >
                {r.label}
              </button>
            ))}
            {range === "custom" && (
              <div style={{ 
                display: "flex", 
                gap: 4, 
                alignItems: "center", 
                width: "100%", 
                flexWrap: "wrap" 
              }}>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  style={{ 
                    padding: "6px 8px", 
                    border: "1px solid #e5e7eb", 
                    borderRadius: "6px", 
                    fontSize: 13, 
                    outline: "none",
                    flex: "1 1 auto",
                    minWidth: 0,
                    maxWidth: "100%",
                    boxSizing: "border-box"
                  }}
                />
                <span style={{ 
                  whiteSpace: "nowrap", 
                  color: "#6b7280",
                  fontSize: 13
                }}>
                  do
                </span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  style={{ 
                    padding: "6px 8px", 
                    border: "1px solid #e5e7eb", 
                    borderRadius: "6px", 
                    fontSize: 13, 
                    outline: "none",
                    flex: "1 1 auto",
                    minWidth: 0,
                    maxWidth: "100%",
                    boxSizing: "border-box"
                  }}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
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
      )}

      {/* Grafikon ukupne zarade */}
      <div
        className="chart-container"
        style={{
          width: "100%",
          maxWidth: "100%",
          height: isMobile ? 300 : 400,
          minHeight: isMobile ? 300 : 400,
          backgroundColor: "#fff",
          borderRadius: 12,
          padding: isMobile ? 10 : 20,
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          marginBottom: 30,
          overflow: isMobile ? "visible" : "hidden",
          boxSizing: "border-box",
          position: "relative"
        }}
      >
        {chartData && chartData.length > 0 ? (
          <div style={{ width: "100%", height: isMobile ? 280 : 400, position: "relative" }}>
            <ResponsiveContainer key={`chart-${isMobile}-${chartData.length}-${chartKey}-${typeof window !== 'undefined' ? window.innerWidth : 0}`} width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: isMobile ? 10 : 20, left: isMobile ? -10 : 10, bottom: isMobile ? 60 : 5 }}>
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
              <Line type="monotone" dataKey="artikli" name="Bruto" stroke="#16a34a" strokeWidth={2} dot={{ r: isMobile ? 2 : 3 }} />
              <Line type="monotone" dataKey="rashod" name="Rashod" stroke="#dc2626" strokeWidth={2} dot={{ r: isMobile ? 2 : 3 }} />
              <Line type="monotone" dataKey="neto" name="Neto" stroke="#3b82f6" strokeWidth={2} dot={{ r: isMobile ? 2 : 3 }} />
            </LineChart>
          </ResponsiveContainer>
          </div>
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

      {/* Artikal grafikon - Box samo na mobilnom */}
      {isMobile ? (
        <div style={{ 
          marginBottom: "16px", 
          background: "#fff", 
          padding: "10px 12px", 
          borderRadius: "8px", 
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)", 
          width: "100%", 
          maxWidth: "100%", 
          boxSizing: "border-box" 
        }}>
          <div style={{ marginBottom: "8px" }}>
            <label style={{ 
              fontWeight: 500, 
              fontSize: "16px", 
              display: "block", 
              marginBottom: "6px" 
            }}>
              Odaberi artikal:
            </label>
            <select
              value={selectedArtikl}
              onChange={(e) => setSelectedArtikl(e.target.value)}
              style={{ 
                padding: "6px 10px", 
                borderRadius: 6, 
                border: "1px solid #d1d5db", 
                fontSize: 13,
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box"
              }}
            >
              <option value="">Odaberi artikal</option>
              {allArtikli.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <h2 style={{ 
            fontSize: "16px", 
            fontWeight: 500, 
            marginBottom: "8px", 
            wordWrap: "break-word" 
          }}>
            Filter profita po artiklu
          </h2>
          <div style={{ 
            display: "flex", 
            gap: 4, 
            flexWrap: "wrap", 
            alignItems: "center", 
            width: "100%" 
          }}>
            {[
              { value: "currentWeek", label: "Trenutna sedmica" },
              { value: "previousWeek", label: "Prošla sedmica" },
              { value: "previousMonth", label: "Prošli mjesec" },
              { value: "custom", label: "Prilagođeni period" },
            ].map((r, index) => (
              <button
                key={r.value}
                onClick={() => setArtiklRange(r.value as any)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 500,
                  fontSize: 13,
                  background: artiklRange === r.value ? "#3b82f6" : "#e5e7eb",
                  color: artiklRange === r.value ? "#fff" : "#374151",
                  transition: "all 0.2s",
                  boxShadow: artiklRange === r.value ? "0 2px 8px rgba(59,130,246,0.3)" : "none",
                  whiteSpace: "nowrap",
                  flex: index === 0 || index === 3 ? "1 1 100%" : "1 1 calc(50% - 2px)",
                  minWidth: index === 0 || index === 3 ? "100%" : "calc(50% - 2px)",
                  maxWidth: index === 0 || index === 3 ? "100%" : "calc(50% - 2px)",
                }}
              >
                {r.label}
              </button>
            ))}
            {artiklRange === "custom" && (
              <div style={{ 
                display: "flex", 
                gap: 4, 
                alignItems: "center", 
                width: "100%", 
                flexWrap: "wrap" 
              }}>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  style={{ 
                    padding: "6px 8px", 
                    border: "1px solid #e5e7eb", 
                    borderRadius: "6px", 
                    fontSize: 13, 
                    outline: "none",
                    flex: "1 1 auto",
                    minWidth: 0,
                    maxWidth: "100%",
                    boxSizing: "border-box"
                  }}
                />
                <span style={{ 
                  whiteSpace: "nowrap", 
                  color: "#6b7280",
                  fontSize: 13
                }}>
                  do
                </span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  style={{ 
                    padding: "6px 8px", 
                    border: "1px solid #e5e7eb", 
                    borderRadius: "6px", 
                    fontSize: 13, 
                    outline: "none",
                    flex: "1 1 auto",
                    minWidth: 0,
                    maxWidth: "100%",
                    boxSizing: "border-box"
                  }}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
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
      )}

      {selectedArtikl && (
        <div
          style={{
            width: "100%",
            maxWidth: "100%",
            height: isMobile ? 300 : 350,
            minHeight: isMobile ? 300 : 350,
            backgroundColor: "#fff",
            borderRadius: 12,
            padding: isMobile ? 10 : 20,
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            marginBottom: 10,
            overflow: isMobile ? "visible" : "hidden",
            boxSizing: "border-box",
            position: "relative"
          }}
        >
          <div style={{ width: "100%", height: isMobile ? 280 : 350, position: "relative" }}>
            <ResponsiveContainer key={`artikl-${isMobile}-${selectedData.length}-${chartKey}-${typeof window !== 'undefined' ? window.innerWidth : 0}`} width="100%" height="100%">
              <LineChart data={selectedData} margin={{ top: 20, right: isMobile ? 10 : 20, left: isMobile ? -10 : 10, bottom: isMobile ? 60 : 5 }}>
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
                <Line type="monotone" dataKey="utroseno" name="Prodaja" stroke="#f59e0b" strokeWidth={2} dot={{ r: isMobile ? 2 : 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
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