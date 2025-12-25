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
import { useSubscription } from "../context/SubscriptionContext";
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
  prihod: number;
  neto: number;
};

// Tip za agregirane podatke
type AggregatedData = {
  datum: string;
  artikli: number;
  rashod: number;
  prihod: number;
  neto: number;
};

// Tip za podatke specifičnog artikla
type ArtiklData = {
  datum: string;
  utroseno: number;
};

// Helper funkcija za parsiranje datuma - normalizuje format (uklanja tačku na kraju)
function parseDatumToDate(datum: string): Date {
  // Normalizuj datum - ukloni tačku na kraju ako postoji
  const normalizedDatum = datum.trim().replace(/\.$/, '');
  const datumParts = normalizedDatum.split('.').filter(Boolean); // Filter uklanja prazne stringove
  if (datumParts.length !== 3) {
    // Fallback ako format nije validan
    return new Date(datum);
  }
  // Format: DD.MM.YYYY -> YYYY-MM-DD
  return new Date(`${datumParts[2]}-${datumParts[1]}-${datumParts[0]}`);
}

export default function DashboardPage() {
  const [range, setRange] = useState<"currentWeek" | "previousWeek" | "monthly" | "quarterly" | "selectMonth" | "custom">("currentWeek");
  const [customFrom, setCustomFrom] = useState<string>(
    new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split("T")[0]
  );
  const [customTo, setCustomTo] = useState<string>(new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [rangeDropdownOpen, setRangeDropdownOpen] = useState(false);
  const [selectedArtikl, setSelectedArtikl] = useState<string>("");
  const [artiklRange, setArtiklRange] = useState<"currentWeek" | "previousWeek" | "monthly" | "quarterly" | "selectMonth" | "custom">("currentWeek");
  const [artiklRangeDropdownOpen, setArtiklRangeDropdownOpen] = useState(false);
  const [ripplePos, setRipplePos] = useState<{ x: number; y: number; key: string } | null>(null);
  const [artiklViewType, setArtiklViewType] = useState<"custom" | "top">("custom");
  const [arhiva, setArhiva] = useState<ArhiviraniObracun[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Detekcija mobilnog uređaja - poboljšana sa User-Agent fallback
  const detectMobile = (): boolean => {
    if (typeof window === 'undefined') return false;
    
    // Metoda 1: Provjeri User-Agent (najpouzdanije za initial state)
    if (typeof navigator !== 'undefined' && navigator.userAgent) {
      const ua = navigator.userAgent.toLowerCase();
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
      if (mobileRegex.test(ua)) {
        return true;
      }
    }
    
    // Metoda 2: Provjeri širinu ekrana
    const width = window.innerWidth || (window.screen && window.screen.width) || 1024;
    if (width <= 768) {
      return true;
    }
    
    // Metoda 3: Provjeri touch support
    if ('ontouchstart' in window || (navigator && navigator.maxTouchPoints > 0)) {
      const width = window.innerWidth || (window.screen && window.screen.width) || 1024;
      if (width <= 1024) {
        return true;
      }
    }
    
    return false;
  };
  
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    // Inicijalizuj sa User-Agent detekcijom (radi i na SSR)
    if (typeof window !== 'undefined') {
      return detectMobile();
    }
    return false;
  });
  const [chartKey, setChartKey] = useState(0);
  const router = useRouter();
  const { cjenovnik } = useCjenovnik();
  const { appName } = useAppName();
  const { user } = useRole();
  const { subscription, loading: subscriptionLoading } = useSubscription();

  // Detekcija mobilnog uređaja - poboljšana za produkciju
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkMobile = () => detectMobile();
    
    // Postavi odmah (bez čekanja na event)
    const initialMobile = checkMobile();
    if (initialMobile !== isMobile) {
      setIsMobile(initialMobile);
      setChartKey(prev => prev + 1);
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
        if (newMobile !== isMobile) {
          setIsMobile(newMobile);
          setChartKey(prev => prev + 1);
        }
      }, 150);
    };
    
    // Dodaj listener-e
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Re-check nakon kratkog delay-a (za mobilne browser-e koji možda ne detektuju odmah)
    const timer = setTimeout(() => {
      const newMobile = checkMobile();
      if (newMobile !== isMobile) {
        setIsMobile(newMobile);
        setChartKey(prev => prev + 1);
      }
    }, 100);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [isMobile]);

  // Učitaj arhivu iz API-ja
  const loadArhiva = useCallback(async (userId: string) => {
    try {
      console.log("Dashboard - Učitavanje arhive za korisnika:", userId);
      setLoading(true);
      setError(null);
      
      // Učitaj iz API-ja - API već vraća transformirane podatke
      const obracuni = await getObracuni(userId);
      console.log("Dashboard - API vratio obračune:", obracuni?.length || 0, "obračuna");
      
      // Ako API ne vrati array, postavi prazan array (ne postavi grešku)
      if (!Array.isArray(obracuni)) {
        console.warn("Dashboard - API nije vratio array, postavljam prazan array:", typeof obracuni);
        setArhiva([]);
        setLoading(false);
        setError(null); // Ne postavljaj grešku, samo prikaži prazan dashboard
        return;
      }
      
      // API već vraća podatke u ispravnom formatu, samo provjeri da su arrayi
      console.log("Dashboard - Primjer obračuna iz API-ja:", obracuni[0] || null);
      
      const firestoreArhiva: ArhiviraniObracun[] = obracuni.map((ob: any, index: number) => {
        const mapped = {
          datum: ob.datum || "",
          ukupnoArtikli: Number(ob.ukupnoArtikli) || 0,
          ukupnoRashod: Number(ob.ukupnoRashod) || 0,
          ukupnoPrihod: Number(ob.ukupnoPrihod) || 0,
          neto: Number(ob.neto) || 0,
          artikli: Array.isArray(ob.artikli) ? ob.artikli : [],
          rashodi: Array.isArray(ob.rashodi) ? ob.rashodi : [],
          prihodi: Array.isArray(ob.prihodi) ? ob.prihodi : [],
          imaUlaz: ob.imaUlaz === true || ob.imaUlaz === 'true',
          isAzuriran: ob.isAzuriran === true || ob.isAzuriran === 'true',
        };
        
        // Debug log za prvi obračun
        if (index === 0) {
          console.log("Dashboard - Mapiranje prvog obračuna:", {
            original: ob,
            mapped: mapped
          });
        }
        
        return mapped;
      });
      
      console.log("Dashboard - Učitano obračuna:", firestoreArhiva.length);
      console.log("Dashboard - Finalni obračuni (bez isAzuriran):", firestoreArhiva.filter(o => !o.isAzuriran).length);
      console.log("Dashboard - Ažurirani obračuni (isAzuriran: true):", firestoreArhiva.filter(o => o.isAzuriran).length);
      
      // Sortiraj po datumu (rastući redoslijed za dashboard)
      const sortedArhiva = firestoreArhiva.sort((a, b) => {
        const dateA = parseDatumToDate(a.datum).getTime();
        const dateB = parseDatumToDate(b.datum).getTime();
        return dateA - dateB;
      });
      
      setArhiva(sortedArhiva);
      setLoading(false);
      setError(null);
      
      console.log("Dashboard - Učitavanje završeno:", {
        brojObračuna: sortedArhiva.length,
        imaPodataka: sortedArhiva.length > 0
      });
    } catch (error: any) {
      console.error("Dashboard - Greška pri učitavanju (prikazujem prazan dashboard):", {
        error,
        message: error?.message
      });
      // Ne postavljaj grešku - prikaži prazan dashboard umesto error poruke
      setError(null);
      setLoading(false);
      setArhiva([]); // Postavi prazan array da se stranica renderuje
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
      console.log("Dashboard - User ID za učitavanje arhive:", user.id, "type:", typeof user.id);
      loadArhiva(user.id);
    } else {
      console.warn("Dashboard - User ID nije dostupan, ne učitavam arhivu");
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

  // Zatvori dropdown kada se klikne van njega
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-dropdown-container]')) {
        setMonthDropdownOpen(false);
        setYearDropdownOpen(false);
        setRangeDropdownOpen(false);
        setArtiklRangeDropdownOpen(false);
      }
    };

    if (monthDropdownOpen || yearDropdownOpen || rangeDropdownOpen || artiklRangeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [monthDropdownOpen, yearDropdownOpen, rangeDropdownOpen, artiklRangeDropdownOpen]);

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

  // Priprema podataka za grafikon - samo finalni obračuni (bez isAzuriran: true)
  const obracuni: Obracun[] = arhiva
    .filter((o) => !o.isAzuriran) // Filtriraj samo finalne obračune (isAzuriran: false ili undefined)
    .map((o) => {
      const ukupnoArtikli = Number(o.ukupnoArtikli) || 0;
      const ukupnoRashod = Number(o.ukupnoRashod) || 0;
      const ukupnoPrihod = Number(o.ukupnoPrihod) || 0;
      
      return {
        datum: o.datum,
        artikli: ukupnoArtikli,
        rashod: ukupnoRashod,
        prihod: ukupnoPrihod,
        neto: ukupnoArtikli + ukupnoPrihod - ukupnoRashod,
      };
    })
    .sort((a, b) => {
      const dateA = parseDatumToDate(a.datum).getTime();
      const dateB = parseDatumToDate(b.datum).getTime();
      return dateA - dateB;
    });
  
  // Debug logiranje
  console.log("Dashboard - Priprema podataka za grafikon:", {
    arhivaCount: arhiva.length,
    finalniObracuniCount: obracuni.length,
    arhivaIsAzuriranCount: arhiva.filter(o => o.isAzuriran).length,
    primjerPodataka: obracuni[0] || null,
    chartDataLength: obracuni.length,
    prviObracunIzArhive: arhiva[0] || null,
  });
  
  if (obracuni.length === 0) {
    console.warn("Dashboard - Nema obračuna za grafikon!", {
      arhivaLength: arhiva.length,
      arhivaPrimer: arhiva[0] || null,
    });
  }

  // Dobivanje svih artikala za dropdown - koristi artikle iz cjenovnika i arhive
  const artikliIzArhive = [...new Set(arhiva.flatMap((o) => (o.artikli && Array.isArray(o.artikli)) ? o.artikli.map((a) => a.naziv) : []))];
  const artikliIzCjenovnika = cjenovnik.map((item) => item.naziv);
  // Kombiniraj i ukloni duplikate - prioritet artiklima iz cjenovnika
  const allArtikli = [...new Set([...artikliIzCjenovnika, ...artikliIzArhive])].sort();

  // Funkcija za agregaciju podataka
  const aggregateData = (
    data: Obracun[],
    selectedRange: "currentWeek" | "previousWeek" | "monthly" | "quarterly" | "selectMonth" | "custom"
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
      // Generiši 7 dana od ponedeljka do nedelje (trenutna sedmica)
      const sevenDaysData: AggregatedData[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const getMonday = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        date.setDate(date.getDate() + diff);
        date.setHours(0, 0, 0, 0);
        return date;
      };
      
      const monday = getMonday(today);
      
      // Generiši 7 dana od ponedeljka do nedelje
      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const datumStr = `${day}.${month}.${year}`;
        
        // Pronađi SVE podatke za ovaj dan i sumiraj ih
        const dayObracuni = data.filter((o) => {
          const dTime = parseDatumToDate(o.datum).getTime();
          return dTime >= date.getTime() && dTime < date.getTime() + 86400000;
        });
        
        if (dayObracuni.length > 0) {
          // Sumiraj sve obračune za ovaj dan
          const totalArtikli = dayObracuni.reduce((sum, o) => sum + (Number(o.artikli) || 0), 0);
          const totalRashod = dayObracuni.reduce((sum, o) => sum + (Number(o.rashod) || 0), 0);
          const totalPrihod = dayObracuni.reduce((sum, o) => sum + (Number(o.prihod) || 0), 0);
          const totalNeto = dayObracuni.reduce((sum, o) => sum + (Number(o.neto) || 0), 0);
          
          sevenDaysData.push({
            datum: datumStr,
            artikli: totalArtikli,
            rashod: totalRashod,
            prihod: totalPrihod,
            neto: totalNeto,
          });
        } else {
          // Ako nema podataka, dodaj sa 0 vrednostima
          sevenDaysData.push({
            datum: datumStr,
            artikli: 0,
            rashod: 0,
            prihod: 0,
            neto: 0,
          });
        }
      }
      
      return sevenDaysData;
    } else if (selectedRange === "previousWeek") {
      // Generiši 7 dana od ponedeljka do nedelje (prošla sedmica)
      const sevenDaysData: AggregatedData[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const getMonday = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        date.setDate(date.getDate() + diff);
        date.setHours(0, 0, 0, 0);
        return date;
      };
      
      const lastWeekDate = new Date(today);
      lastWeekDate.setDate(today.getDate() - 7);
      const lastWeekMonday = getMonday(lastWeekDate);
      
      // Generiši 7 dana od ponedeljka do nedelje (prošla sedmica)
      for (let i = 0; i < 7; i++) {
        const date = new Date(lastWeekMonday);
        date.setDate(lastWeekMonday.getDate() + i);
        
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const datumStr = `${day}.${month}.${year}`;
        
        // Pronađi SVE podatke za ovaj dan i sumiraj ih
        const dayObracuni = data.filter((o) => {
          const dTime = parseDatumToDate(o.datum).getTime();
          return dTime >= date.getTime() && dTime < date.getTime() + 86400000;
        });
        
        if (dayObracuni.length > 0) {
          // Sumiraj sve obračune za ovaj dan
          const totalArtikli = dayObracuni.reduce((sum, o) => sum + (Number(o.artikli) || 0), 0);
          const totalRashod = dayObracuni.reduce((sum, o) => sum + (Number(o.rashod) || 0), 0);
          const totalPrihod = dayObracuni.reduce((sum, o) => sum + (Number(o.prihod) || 0), 0);
          const totalNeto = dayObracuni.reduce((sum, o) => sum + (Number(o.neto) || 0), 0);
          
          sevenDaysData.push({
            datum: datumStr,
            artikli: totalArtikli,
            rashod: totalRashod,
            prihod: totalPrihod,
            neto: totalNeto,
          });
        } else {
          sevenDaysData.push({
            datum: datumStr,
            artikli: 0,
            rashod: 0,
            prihod: 0,
            neto: 0,
          });
        }
      }
      
      return sevenDaysData;
    } else if (selectedRange === "monthly") {
      // Trenutni mjesec - od početka mjeseca do danas
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      firstDay.setHours(0, 0, 0, 0);
      const lastDay = new Date(today);
      lastDay.setHours(23, 59, 59, 999);
      filteredData = data.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= firstDay.getTime() && dTime <= lastDay.getTime();
      });
    } else if (selectedRange === "selectMonth") {
      // Odabrani mjesec
      const firstDay = new Date(selectedYear, selectedMonth - 1, 1);
      firstDay.setHours(0, 0, 0, 0);
      const lastDay = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
      filteredData = data.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= firstDay.getTime() && dTime <= lastDay.getTime();
      });
    } else if (selectedRange === "quarterly") {
      // Tromjesečni - zadnja 3 mjeseca (kvartal)
      const threeMonthsAgo = new Date(today);
      threeMonthsAgo.setMonth(today.getMonth() - 3);
      threeMonthsAgo.setDate(1);
      threeMonthsAgo.setHours(0, 0, 0, 0);
      const lastDay = new Date(today);
      lastDay.setHours(23, 59, 59, 999);
      filteredData = data.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= threeMonthsAgo.getTime() && dTime <= lastDay.getTime();
      });
    } else if (selectedRange === "custom") {
      const fromTime = new Date(customFrom).getTime();
      const toTime = new Date(customTo).getTime();
      filteredData = data.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= fromTime && dTime <= toTime;
      });
    }

    return filteredData.map((o) => ({
      datum: o.datum,
      artikli: Number(o.artikli),
      rashod: Number(o.rashod),
      prihod: Number(o.prihod || 0),
      neto: Number(o.neto),
    }));
  };

  // Funkcija za agregaciju podataka za odabrani artikal
  const aggregateArtiklData = (
    selectedArtikl: string,
    selectedRange: "currentWeek" | "previousWeek" | "monthly" | "quarterly" | "selectMonth" | "custom"
  ): ArtiklData[] => {
    // Prvo pripremi sve podatke sa artiklom (bez filtriranja utroseno > 0)
    const allData = arhiva
      .map((o) => ({
        datum: o.datum,
        utroseno: o.artikli.find((a) => a.naziv === selectedArtikl)?.utroseno || 0,
      }))
      .sort((a, b) => {
        const dateA = parseDatumToDate(a.datum).getTime();
        const dateB = parseDatumToDate(b.datum).getTime();
        return dateA - dateB;
      });

    const today = new Date();

    if (selectedRange === "currentWeek") {
      // Generiši 7 dana od ponedeljka do nedelje (trenutna sedmica)
      const sevenDaysData: ArtiklData[] = [];
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      
      const getMonday = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        date.setDate(date.getDate() + diff);
        date.setHours(0, 0, 0, 0);
        return date;
      };
      
      const monday = getMonday(todayDate);
      
      // Generiši 7 dana od ponedeljka do nedelje
      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const datumStr = `${day}.${month}.${year}`;
        
        // Pronađi SVE podatke za ovaj dan i sumiraj ih
        const dayObracuni = allData.filter((o) => {
          const dTime = parseDatumToDate(o.datum).getTime();
          return dTime >= date.getTime() && dTime < date.getTime() + 86400000;
        });
        
        const totalUtroseno = dayObracuni.reduce((sum, o) => sum + (Number(o.utroseno) || 0), 0);
        
        sevenDaysData.push({
          datum: datumStr,
          utroseno: totalUtroseno,
        });
      }
      
      return sevenDaysData;
    } else if (selectedRange === "previousWeek") {
      // Generiši prethodnih 7 dana (prošla sedmica)
      const sevenDaysData: ArtiklData[] = [];
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      
      const getMonday = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        date.setDate(date.getDate() + diff);
        date.setHours(0, 0, 0, 0);
        return date;
      };
      
      const lastWeekDate = new Date(todayDate);
      lastWeekDate.setDate(todayDate.getDate() - 7);
      const lastWeekMonday = getMonday(lastWeekDate);
      
      // Generiši 7 dana od ponedeljka do nedelje (prošla sedmica)
      for (let i = 0; i < 7; i++) {
        const date = new Date(lastWeekMonday);
        date.setDate(lastWeekMonday.getDate() + i);
        
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const datumStr = `${day}.${month}.${year}`;
        
        // Pronađi SVE podatke za ovaj dan i sumiraj ih
        const dayObracuni = allData.filter((o) => {
          const dTime = parseDatumToDate(o.datum).getTime();
          return dTime >= date.getTime() && dTime < date.getTime() + 86400000;
        });
        
        const totalUtroseno = dayObracuni.reduce((sum, o) => sum + (Number(o.utroseno) || 0), 0);
        
        sevenDaysData.push({
          datum: datumStr,
          utroseno: totalUtroseno,
        });
      }
      
      return sevenDaysData;
    } else if (selectedRange === "monthly") {
      // Trenutni mjesec
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today);
      lastDay.setHours(23, 59, 59, 999);
      const filteredData = allData.filter((o) => {
        const dTime = new Date(o.datum.split(".").reverse().join("-")).getTime();
        return dTime >= firstDay.getTime() && dTime <= lastDay.getTime();
      });
      return filteredData.map((o) => ({
        datum: o.datum,
        utroseno: Number(o.utroseno),
      }));
    } else if (selectedRange === "selectMonth") {
      // Odabrani mjesec
      const firstDay = new Date(selectedYear, selectedMonth - 1, 1);
      const lastDay = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
      const filteredData = allData.filter((o) => {
        const dTime = new Date(o.datum.split(".").reverse().join("-")).getTime();
        return dTime >= firstDay.getTime() && dTime <= lastDay.getTime();
      });
      return filteredData.map((o) => ({
        datum: o.datum,
        utroseno: Number(o.utroseno),
      }));
    } else if (selectedRange === "quarterly") {
      // Tromjesečni - zadnja 3 mjeseca
      const threeMonthsAgo = new Date(today);
      threeMonthsAgo.setMonth(today.getMonth() - 3);
      threeMonthsAgo.setDate(1);
      threeMonthsAgo.setHours(0, 0, 0, 0);
      const lastDay = new Date(today);
      lastDay.setHours(23, 59, 59, 999);
      const filteredData = allData.filter((o) => {
        const dTime = new Date(o.datum.split(".").reverse().join("-")).getTime();
        return dTime >= threeMonthsAgo.getTime() && dTime <= lastDay.getTime();
      });
      return filteredData.map((o) => ({
        datum: o.datum,
        utroseno: Number(o.utroseno),
      }));
    } else if (selectedRange === "custom") {
      const fromTime = new Date(customFrom).getTime();
      const toTime = new Date(customTo).getTime();
      const filteredData = allData.filter((o) => {
        const dTime = new Date(o.datum.split(".").reverse().join("-")).getTime();
        return dTime >= fromTime && dTime <= toTime;
      });
      return filteredData.map((o) => ({
        datum: o.datum,
        utroseno: Number(o.utroseno),
      }));
    }

    // Fallback (ne bi trebalo da se desi)
    return allData.map((o) => ({
      datum: o.datum,
      utroseno: Number(o.utroseno),
    }));
  };

  // Izračunaj najprodavaniji artikal za odabrani period
  const calculateTopArtikl = useCallback((selectedRange: "currentWeek" | "previousWeek" | "monthly" | "quarterly" | "selectMonth" | "custom") => {
    const today = new Date();
    let filteredObracuni = [...arhiva];

    if (selectedRange === "currentWeek") {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - 6);
      startOfWeek.setHours(0, 0, 0, 0);
      filteredObracuni = arhiva.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= startOfWeek.getTime();
      });
    } else if (selectedRange === "previousWeek") {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - 13);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() - 7);
      endOfWeek.setHours(23, 59, 59, 999);
      filteredObracuni = arhiva.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= startOfWeek.getTime() && dTime <= endOfWeek.getTime();
      });
    } else if (selectedRange === "monthly") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today);
      lastDay.setHours(23, 59, 59, 999);
      filteredObracuni = arhiva.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= firstDay.getTime() && dTime <= lastDay.getTime();
      });
    } else if (selectedRange === "selectMonth") {
      const firstDay = new Date(selectedYear, selectedMonth - 1, 1);
      const lastDay = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
      filteredObracuni = arhiva.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= firstDay.getTime() && dTime <= lastDay.getTime();
      });
    } else if (selectedRange === "quarterly") {
      const threeMonthsAgo = new Date(today);
      threeMonthsAgo.setMonth(today.getMonth() - 3);
      threeMonthsAgo.setDate(1);
      threeMonthsAgo.setHours(0, 0, 0, 0);
      const lastDay = new Date(today);
      lastDay.setHours(23, 59, 59, 999);
      filteredObracuni = arhiva.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= threeMonthsAgo.getTime() && dTime <= lastDay.getTime();
      });
    } else if (selectedRange === "custom") {
      const fromDate = new Date(customFrom);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(customTo);
      toDate.setHours(23, 59, 59, 999);
      filteredObracuni = arhiva.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= fromDate.getTime() && dTime <= toDate.getTime();
      });
    }

    // Izračunaj ukupno utrošeno po artiklu
    const artiklTotals: Record<string, number> = {};
    filteredObracuni.forEach((obracun) => {
      obracun.artikli.forEach((artikal) => {
        if (artikal.utroseno > 0) {
          artiklTotals[artikal.naziv] = (artiklTotals[artikal.naziv] || 0) + artikal.utroseno;
        }
      });
    });

    // Pronađi artikal sa najvećim utroškom
    let topArtikl = "";
    let maxUtroseno = 0;
    Object.entries(artiklTotals).forEach(([naziv, utroseno]) => {
      if (utroseno > maxUtroseno) {
        maxUtroseno = utroseno;
        topArtikl = naziv;
      }
    });

    return topArtikl;
  }, [arhiva, customFrom, customTo, selectedMonth, selectedYear]);

  // Izračunaj listu svih artikala sortiranih po prodaji (od najviše ka najmanje)
  const calculateArtiklRanking = useCallback((selectedRange: "currentWeek" | "previousWeek" | "monthly" | "quarterly" | "selectMonth" | "custom") => {
    const today = new Date();
    let filteredObracuni = [...arhiva];

    if (selectedRange === "currentWeek") {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - 6);
      startOfWeek.setHours(0, 0, 0, 0);
      filteredObracuni = arhiva.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= startOfWeek.getTime();
      });
    } else if (selectedRange === "previousWeek") {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - 13);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() - 7);
      endOfWeek.setHours(23, 59, 59, 999);
      filteredObracuni = arhiva.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= startOfWeek.getTime() && dTime <= endOfWeek.getTime();
      });
    } else if (selectedRange === "monthly") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today);
      lastDay.setHours(23, 59, 59, 999);
      filteredObracuni = arhiva.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= firstDay.getTime() && dTime <= lastDay.getTime();
      });
    } else if (selectedRange === "selectMonth") {
      const firstDay = new Date(selectedYear, selectedMonth - 1, 1);
      const lastDay = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
      filteredObracuni = arhiva.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= firstDay.getTime() && dTime <= lastDay.getTime();
      });
    } else if (selectedRange === "quarterly") {
      const threeMonthsAgo = new Date(today);
      threeMonthsAgo.setMonth(today.getMonth() - 3);
      threeMonthsAgo.setDate(1);
      threeMonthsAgo.setHours(0, 0, 0, 0);
      const lastDay = new Date(today);
      lastDay.setHours(23, 59, 59, 999);
      filteredObracuni = arhiva.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= threeMonthsAgo.getTime() && dTime <= lastDay.getTime();
      });
    } else if (selectedRange === "custom") {
      const fromDate = new Date(customFrom);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(customTo);
      toDate.setHours(23, 59, 59, 999);
      filteredObracuni = arhiva.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= fromDate.getTime() && dTime <= toDate.getTime();
      });
    }

    // Izračunaj ukupno utrošeno po artiklu
    const artiklTotals: Record<string, number> = {};
    filteredObracuni.forEach((obracun) => {
      obracun.artikli.forEach((artikal) => {
        if (artikal.utroseno > 0) {
          artiklTotals[artikal.naziv] = (artiklTotals[artikal.naziv] || 0) + artikal.utroseno;
        }
      });
    });

    // Sortiraj artikle po ukupnom utrošku (od najviše ka najmanje)
    const ranking = Object.entries(artiklTotals)
      .map(([naziv, utroseno]) => ({ naziv, utroseno }))
      .sort((a, b) => b.utroseno - a.utroseno);

    return ranking;
  }, [arhiva, customFrom, customTo, selectedMonth, selectedYear]);

  // Podaci za grafikon
  const chartData = aggregateData(obracuni, range);
  
  // Debug: Provjeri stvarne vrijednosti u chartData
  if (typeof window !== 'undefined' && isMobile) {
    console.log('📊 CHART DATA DEBUG - Stvarne vrijednosti:', {
      chartDataLength: chartData.length,
      chartDataSviPodaci: chartData,
      totalBruto: chartData.reduce((sum, o) => sum + Number(o.artikli || 0), 0),
      totalRashod: chartData.reduce((sum, o) => sum + Number(o.rashod || 0), 0),
      totalNeto: chartData.reduce((sum, o) => sum + Number(o.neto || 0), 0),
      obracuniPrimjer: obracuni[0] || null,
      obracuniCount: obracuni.length,
      range: range
    });
    
    // Detaljni debug - ispiši svaki element iz chartData
    console.log('📊 CHART DATA - Detaljno po elementima:');
    chartData.forEach((item, index) => {
      console.log(`  [${index}] ${item.datum}: artikli=${item.artikli}, rashod=${item.rashod}, prihod=${item.prihod}, neto=${item.neto}`);
    });
    
    // Debug - provjeri obračune i njihove datume
    console.log('📊 OBRACUNI DEBUG - Datumi obračuna:');
    obracuni.forEach((ob, index) => {
      console.log(`  [${index}] datum: ${ob.datum}, artikli: ${ob.artikli}, rashod: ${ob.rashod}, neto: ${ob.neto}`);
    });
    
    // Debug - provjeri range i datume
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    console.log('📊 RANGE DEBUG:', {
      range: range,
      today: today.toLocaleDateString('bs-BA'),
      sevenDaysAgo: sevenDaysAgo.toLocaleDateString('bs-BA'),
      currentWeekDates: chartData.map(item => item.datum)
    });
  }
  
  // Odredi koji artikal prikazati
  // Ako je "top" - koristi najprodavaniji, inače koristi selectedArtikl
  // Ako nema selectedArtikl i nije "top", ne prikazuj ništa
  const topArtikl = calculateTopArtikl(artiklRange);
  const artiklRanking = calculateArtiklRanking(artiklRange);
  const artiklToDisplay = artiklViewType === "top" ? topArtikl : selectedArtikl;
  const selectedData = artiklToDisplay ? aggregateArtiklData(artiklToDisplay, artiklRange) : [];

  // Ukupne vrijednosti
  const totalBruto = chartData.reduce((sum, o) => sum + Number(o.artikli || 0), 0);
  const totalRashod = chartData.reduce((sum, o) => sum + Number(o.rashod || 0), 0);
  const totalPrihod = chartData.reduce((sum, o) => sum + Number(o.prihod || 0), 0);
  const totalNeto = chartData.reduce((sum, o) => sum + Number(o.neto || 0), 0);
  const totalArtikl = selectedData.reduce((sum, o) => sum + Number(o.utroseno || 0), 0);

  // Debug logiranje za chart podatke - NAKON izračuna varijabli
  useEffect(() => {
    if (typeof window !== 'undefined' && !loading) {
      try {
        console.log("Dashboard - Debug Info:", {
          loading,
          chartDataLength: chartData?.length || 0,
          obracuniLength: obracuni?.length || 0,
          isMobile,
          windowWidth: window.innerWidth,
          screenWidth: window.screen?.width,
          hasChartData: (chartData?.length || 0) > 0,
          totalBruto,
          totalRashod,
          totalNeto,
          range,
          arhivaLength: arhiva?.length || 0
        });
        
        // Dodatni debug za mobilne uređaje
        if (isMobile) {
          console.log("🔍 MOBILE DEBUG - Chart i Kartice:", {
            willRenderChart: !loading,
            chartDataExists: (chartData?.length || 0) > 0,
            willRenderCards: true,
            cardValues: { totalBruto, totalRashod, totalNeto },
            containerHeight: isMobile ? 300 : 400
          });
        }
      } catch (error) {
        // Ignoriši greške u debug logovanju
        console.warn("Dashboard - Debug log error:", error);
      }
    }
  }, [loading, isMobile, range, totalBruto, totalRashod, totalNeto, chartData, obracuni, arhiva]);

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

  // Ne blokiraj renderovanje - dashboard se uvek prikazuje
  // if (loading) {
  //   return <div style={{ textAlign: "center", padding: 20 }}>Učitavanje podataka...</div>;
  // }

  // if (error) {
  //   return <div style={{ textAlign: "center", padding: 20, color: "red" }}>{error}</div>;
  // }

  // Dinamički padding za mobilnu verziju
  const containerPadding = isMobile ? 4 : 24;

  return (
    <div style={{ padding: containerPadding, fontFamily: "'Inter', sans-serif", backgroundColor: "#f4f5f7", minHeight: "100vh" }}>
      {/* Loading indikator - prikaži samo tokom učitavanja ako nema podataka */}
      {loading && arhiva.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
          <div style={{ fontSize: 18, marginBottom: 10 }}>Učitavanje podataka...</div>
        </div>
      )}
      
      {/* Error poruka - prikaži samo ako postoji (ne blokira renderovanje) */}
      {error && (
        <div style={{ 
          textAlign: "center", 
          padding: 16, 
          marginBottom: 20,
          backgroundColor: "#fee2e2", 
          color: "#dc2626", 
          borderRadius: 8,
          border: "1px solid #fecaca"
        }}>
          {error}
        </div>
      )}
      
      {/* Dashboard sadržaj - uvek prikaži, čak i ako je prazan */}
      <>
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
          div[style*='height: 400'] { height: 350px; padding: 0 !important; }
          div[style*='height: 300'] { height: 280px; padding: 0 !important; }
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
            margin-bottom: 0 !important;
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
            height: 310px !important;
            min-height: 310px !important;
            position: relative !important;
            overflow: visible !important;
            margin-bottom: 8px !important;
            padding: 0 !important;
          }
          div[style*='height: 400'][style*='backgroundColor: #fff'] {
            height: 310px !important;
            min-height: 310px !important;
            position: relative !important;
            overflow: visible !important;
            margin-bottom: 8px !important;
            padding: 0 !important;
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
          marginBottom: "20px", 
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", 
          padding: "16px", 
          borderRadius: "16px", 
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04)", 
          width: "100%", 
          maxWidth: "100%", 
          boxSizing: "border-box",
          border: "1px solid rgba(0, 0, 0, 0.05)"
        }}>
          {/* Dropdown za vremenski period */}
          <div style={{ position: "relative", width: "100%" }} data-dropdown-container>
            <button
              type="button"
              onClick={() => {
                setRangeDropdownOpen(!rangeDropdownOpen);
                setMonthDropdownOpen(false);
                setYearDropdownOpen(false);
              }}
              style={{
                width: "100%",
                padding: "14px 44px 14px 16px",
                border: rangeDropdownOpen ? "2px solid #3b82f6" : "2px solid #e5e7eb",
                borderRadius: "12px",
                fontSize: "15px",
                backgroundColor: rangeDropdownOpen ? "#f8fafc" : "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: rangeDropdownOpen 
                  ? "0 8px 20px rgba(59, 130, 246, 0.15), 0 2px 6px rgba(0, 0, 0, 0.08)" 
                  : "0 2px 4px rgba(0, 0, 0, 0.04)",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                fontWeight: 600,
                color: "#111827",
                outline: "none",
              }}
              onMouseEnter={(e) => {
                if (!rangeDropdownOpen) {
                  e.currentTarget.style.borderColor = "#cbd5e1";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.08)";
                }
              }}
              onMouseLeave={(e) => {
                if (!rangeDropdownOpen) {
                  e.currentTarget.style.borderColor = "#e5e7eb";
                  e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.04)";
                }
              }}
            >
              <span style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "10px",
                flex: 1 
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path 
                    d="M8 7V3M16 7V3M7 11H17M5 21H19C20.1046 21 21 20.1046 21 19V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V19C3 20.1046 3.89543 21 5 21Z" 
                    stroke={rangeDropdownOpen ? "#3b82f6" : "#6b7280"} 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
                <span>
                  {[
                    { value: "currentWeek", label: "Trenutna sedmica", icon: "📅" },
                    { value: "previousWeek", label: "Prošla sedmica", icon: "⏪" },
                    { value: "monthly", label: "Mjesečni", icon: "📆" },
                    { value: "quarterly", label: "Tromjesečni", icon: "🗓️" },
                    { value: "selectMonth", label: "Odaberi mjesec", icon: "🗓️" },
                    { value: "custom", label: "Prilagođeno", icon: "⚙️" },
                  ].find(r => r.value === range)?.label || "Trenutna sedmica"}
                </span>
              </span>
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  transform: rangeDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  position: "absolute",
                  right: "16px",
                }}
              >
                <path 
                  d="M5 7.5L10 12.5L15 7.5" 
                  stroke={rangeDropdownOpen ? "#3b82f6" : "#6b7280"} 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {rangeDropdownOpen && (
              <>
                {/* Backdrop overlay with blur */}
                <div
                  style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.08)",
                    backdropFilter: "blur(4px)",
                    WebkitBackdropFilter: "blur(4px)",
                    zIndex: 9999,
                  }}
                  onClick={() => setRangeDropdownOpen(false)}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    left: 0,
                    right: 0,
                    background: "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.98) 100%)",
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                    border: "1px solid rgba(255, 255, 255, 0.8)",
                    borderRadius: "16px",
                    boxShadow: "0 25px 50px -12px rgba(59, 130, 246, 0.25), 0 0 0 1px rgba(59, 130, 246, 0.1), 0 10px 30px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
                    zIndex: 10000,
                    maxHeight: "320px",
                    overflowY: "auto",
                    overflowX: "hidden",
                    opacity: 1,
                    transform: "translateY(0) scale(1)",
                    animation: "dropdownSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    scrollBehavior: "smooth",
                    WebkitOverflowScrolling: "touch",
                  }}
                  onMouseEnter={(e) => e.stopPropagation()}
                  onScroll={(e) => {
                    // Dynamic scroll indicators based on scroll position
                    const target = e.currentTarget;
                    const scrollTop = target.scrollTop;
                    const scrollHeight = target.scrollHeight;
                    const clientHeight = target.clientHeight;
                    const atTop = scrollTop === 0;
                    const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
                    
                    const topIndicator = target.previousElementSibling as HTMLElement;
                    const bottomIndicator = Array.from(target.parentElement?.children || []).find(
                      (el) => el !== target && (el as HTMLElement).style.position === "absolute" && (el as HTMLElement).style.bottom === "0px"
                    ) as HTMLElement;
                    
                    if (topIndicator) {
                      topIndicator.style.opacity = atTop ? "0" : "1";
                    }
                    if (bottomIndicator) {
                      bottomIndicator.style.opacity = atBottom ? "0" : "1";
                    }
                  }}
                >
                  {/* Scroll indicators */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: "20px",
                      background: "linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, transparent 100%)",
                      pointerEvents: "none",
                      zIndex: 1,
                      borderRadius: "16px 16px 0 0",
                      willChange: "auto",
                      opacity: 1,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: "20px",
                      background: "linear-gradient(0deg, rgba(255, 255, 255, 0.95) 0%, transparent 100%)",
                      pointerEvents: "none",
                      zIndex: 1,
                      borderRadius: "0 0 16px 16px",
                      willChange: "auto",
                      opacity: 1,
                    }}
                  />
                  <style>{`
                    @keyframes dropdownSlideIn {
                      from {
                        opacity: 0;
                        transform: translateY(-10px) scale(0.95);
                      }
                      to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                      }
                    }
                    @keyframes itemSlideIn {
                      from {
                        opacity: 0;
                        transform: translateX(-10px);
                      }
                      to {
                        opacity: 1;
                        transform: translateX(0);
                      }
                    }
                    @keyframes pulseGlow {
                      0%, 100% {
                        box-shadow: 0 25px 50px -12px rgba(59, 130, 246, 0.25), 0 0 0 1px rgba(59, 130, 246, 0.1), 0 10px 30px rgba(0, 0, 0, 0.15);
                      }
                      50% {
                        box-shadow: 0 25px 50px -12px rgba(59, 130, 246, 0.35), 0 0 0 1px rgba(59, 130, 246, 0.15), 0 15px 40px rgba(0, 0, 0, 0.2);
                      }
                    }
                    @keyframes checkmarkPop {
                      0% {
                        transform: scale(0);
                        opacity: 0;
                      }
                      50% {
                        transform: scale(1.2);
                      }
                      100% {
                        transform: scale(1);
                        opacity: 1;
                      }
                    }
                    @keyframes iconBounce {
                      0%, 100% {
                        transform: scale(1);
                      }
                      50% {
                        transform: scale(1.15);
                      }
                    }
                    @keyframes ripple {
                      0% {
                        transform: scale(0);
                        opacity: 1;
                      }
                      100% {
                        transform: scale(4);
                        opacity: 0;
                      }
                    }
                    @keyframes hapticPulse {
                      0%, 100% {
                        transform: scale(1);
                      }
                      50% {
                        transform: scale(0.98);
                      }
                    }
                  `}</style>
                {[
                  { value: "currentWeek", label: "Trenutna sedmica", icon: "📅" },
                  { value: "previousWeek", label: "Prošla sedmica", icon: "⏪" },
                  { value: "monthly", label: "Mjesečni", icon: "📆" },
                  { value: "quarterly", label: "Tromjesečni", icon: "🗓️" },
                  { value: "selectMonth", label: "Odaberi mjesec", icon: "🗓️" },
                  { value: "custom", label: "Prilagođeno", icon: "⚙️" },
                ].map((r, index) => {
                  const isSelected = range === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={(e) => {
                        // Ripple efekat
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;
                        setRipplePos({ x, y, key: `${r.value}-${Date.now()}` });
                        
                        // Haptic feedback simulacija (vibracija)
                        if (navigator.vibrate) {
                          navigator.vibrate(10);
                        }
                        
                        setTimeout(() => {
                          setRange(r.value as any);
                          setRangeDropdownOpen(false);
                          setMonthDropdownOpen(false);
                          setYearDropdownOpen(false);
                          setRipplePos(null);
                        }, 300);
                      }}
                      style={{
                        width: "100%",
                        padding: "16px 18px",
                        textAlign: "left",
                        border: "none",
                        backgroundColor: isSelected ? "#eff6ff" : "#fff",
                        background: isSelected 
                          ? "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)" 
                          : "#fff",
                        opacity: 1,
                        color: isSelected ? "#1e40af" : "#374151",
                        fontSize: "15px",
                        cursor: "pointer",
                        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                        fontWeight: isSelected ? 600 : 500,
                        borderBottom: index < 5 ? "1px solid #f1f5f9" : "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px",
                        position: "relative",
                        zIndex: 2,
                        animation: `itemSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.05}s both`,
                        transform: "translateX(0) scale(1)",
                        overflow: "hidden",
                        willChange: "auto",
                      }}
                      onAnimationEnd={(e) => {
                        // Ensure opacity is 1 after animation completes
                        e.currentTarget.style.opacity = "1";
                        e.currentTarget.style.willChange = "auto";
                      }}
                      onMouseDown={(e) => {
                        // Haptic pulse on mouse down
                        const target = e.currentTarget;
                        if (target) {
                          target.style.animation = "hapticPulse 0.15s ease";
                          setTimeout(() => {
                            if (target && target.style) {
                              target.style.animation = "";
                            }
                          }, 150);
                        }
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = "#f1f5f9";
                          e.currentTarget.style.background = "#f1f5f9";
                          e.currentTarget.style.transform = "translateX(8px) scale(1.02)";
                          e.currentTarget.style.boxShadow = "inset 4px 0 0 #3b82f6";
                          e.currentTarget.style.opacity = "1";
                        } else {
                          e.currentTarget.style.transform = "scale(1.02)";
                          e.currentTarget.style.opacity = "1";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = "#fff";
                          e.currentTarget.style.background = "#fff";
                          e.currentTarget.style.transform = "translateX(0) scale(1)";
                          e.currentTarget.style.boxShadow = "none";
                          e.currentTarget.style.opacity = "1";
                        } else {
                          e.currentTarget.style.transform = "scale(1)";
                          e.currentTarget.style.opacity = "1";
                        }
                      }}
                    >
                      <span style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "14px", 
                        flex: 1,
                        transition: "all 0.2s ease"
                      }}>
                        <span style={{
                          position: "relative"
                        }}>
                          {r.label}
                          {isSelected && (
                            <span style={{
                              position: "absolute",
                              bottom: "-2px",
                              left: 0,
                              right: 0,
                              height: "2px",
                              background: "linear-gradient(90deg, #3b82f6, #60a5fa)",
                              borderRadius: "1px",
                              animation: "itemSlideIn 0.3s ease"
                            }} />
                          )}
                        </span>
                      </span>
                      {isSelected && (
                        <svg 
                          width="22" 
                          height="22" 
                          viewBox="0 0 22 22" 
                          fill="none" 
                          xmlns="http://www.w3.org/2000/svg"
                          style={{
                            animation: "checkmarkPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)"
                          }}
                        >
                          <defs>
                            <linearGradient id="checkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#3b82f6" />
                              <stop offset="100%" stopColor="#2563eb" />
                            </linearGradient>
                          </defs>
                          <circle cx="11" cy="11" r="10" fill="url(#checkGradient)" opacity="0.15"/>
                          <circle cx="11" cy="11" r="9" stroke="url(#checkGradient)" strokeWidth="1" opacity="0.3"/>
                          <path 
                            d="M7.5 11L10 13.5L14.5 9" 
                            stroke="url(#checkGradient)" 
                            strokeWidth="2.5" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                      {!isSelected && (
                        <div style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          backgroundColor: "#e5e7eb",
                          transition: "all 0.2s ease",
                          opacity: 0.5
                        }} />
                      )}
                      {/* Ripple efekat */}
                      {ripplePos && ripplePos.key.startsWith(r.value) && (
                        <span
                          key={ripplePos.key}
                          style={{
                            position: "absolute",
                            left: `${ripplePos.x}px`,
                            top: `${ripplePos.y}px`,
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            background: "rgba(59, 130, 246, 0.4)",
                            transform: "translate(-50%, -50%)",
                            animation: "ripple 0.6s ease-out",
                            pointerEvents: "none",
                            zIndex: 10,
                          }}
                        />
                      )}
                    </button>
                  );
                })}
                </div>
              </>
            )}
          </div>

          {range === "selectMonth" && (
            <div style={{ 
              marginTop: "12px",
              display: "flex", 
              gap: 8, 
              alignItems: "flex-end", 
              width: "100%", 
              flexWrap: "wrap",
              opacity: 1,
              visibility: "visible"
            }}>
                {/* Custom Dropdown za Mjesec */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative", flex: "1 1 auto", minWidth: 0 }} data-dropdown-container>
                  <label style={{ fontSize: "11px", fontWeight: 500, color: "#6b7280" }}>Mjesec:</label>
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setMonthDropdownOpen(!monthDropdownOpen);
                        setYearDropdownOpen(false);
                      }}
                      style={{
                        padding: "8px 32px 8px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        fontSize: "13px",
                        width: "100%",
                        backgroundColor: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        boxShadow: monthDropdownOpen ? "0 4px 12px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
                        transition: "all 0.2s ease",
                        fontWeight: 500,
                        color: "#1f2937",
                      }}
                    >
                      <span>{["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"][selectedMonth - 1]}</span>
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{
                          transform: monthDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                          position: "absolute",
                          right: "8px",
                        }}
                      >
                        <path d="M6 9L1 4H11L6 9Z" fill="#6b7280" />
                      </svg>
                    </button>
                    {monthDropdownOpen && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          marginTop: "4px",
                          backgroundColor: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)",
                          zIndex: 1000,
                          maxHeight: "240px",
                          overflowY: "auto",
                        }}
                      >
                        {[
                          "Januar", "Februar", "Mart", "April", "Maj", "Juni",
                          "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"
                        ].map((month, index) => (
                          <button
                            key={index + 1}
                            type="button"
                            onClick={() => {
                              setSelectedMonth(index + 1);
                              setMonthDropdownOpen(false);
                            }}
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              textAlign: "left",
                              border: "none",
                              backgroundColor: selectedMonth === index + 1 ? "#eff6ff" : "#fff",
                              color: selectedMonth === index + 1 ? "#2563eb" : "#1f2937",
                              fontSize: "13px",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              fontWeight: selectedMonth === index + 1 ? 600 : 400,
                            }}
                            onMouseEnter={(e) => {
                              if (selectedMonth !== index + 1) {
                                e.currentTarget.style.backgroundColor = "#f9fafb";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedMonth !== index + 1) {
                                e.currentTarget.style.backgroundColor = "#fff";
                              }
                            }}
                          >
                            {month}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Custom Dropdown za Godinu */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative", flex: "1 1 auto", minWidth: 0 }} data-dropdown-container>
                  <label style={{ fontSize: "11px", fontWeight: 500, color: "#6b7280" }}>Godina:</label>
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setYearDropdownOpen(!yearDropdownOpen);
                        setMonthDropdownOpen(false);
                        setArtiklRangeDropdownOpen(false);
                      }}
                      style={{
                        padding: "8px 32px 8px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        fontSize: "13px",
                        width: "100%",
                        backgroundColor: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        boxShadow: yearDropdownOpen ? "0 4px 12px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
                        transition: "all 0.2s ease",
                        fontWeight: 500,
                        color: "#1f2937",
                      }}
                    >
                      <span>{selectedYear}</span>
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{
                          transform: yearDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                          position: "absolute",
                          right: "8px",
                        }}
                      >
                        <path d="M6 9L1 4H11L6 9Z" fill="#6b7280" />
                      </svg>
                    </button>
                    {yearDropdownOpen && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          marginTop: "4px",
                          backgroundColor: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)",
                          zIndex: 10000,
                          maxHeight: "200px",
                          overflowY: "auto",
                        }}
                      >
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                          <button
                            key={year}
                            type="button"
                            onClick={() => {
                              setSelectedYear(year);
                              setYearDropdownOpen(false);
                              setArtiklRangeDropdownOpen(false);
                            }}
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              textAlign: "left",
                              border: "none",
                              backgroundColor: selectedYear === year ? "#eff6ff" : "#fff",
                              color: selectedYear === year ? "#2563eb" : "#1f2937",
                              fontSize: "13px",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              fontWeight: selectedYear === year ? 600 : 400,
                            }}
                            onMouseEnter={(e) => {
                              if (selectedYear !== year) {
                                e.currentTarget.style.backgroundColor = "#f9fafb";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedYear !== year) {
                                e.currentTarget.style.backgroundColor = "#fff";
                              }
                            }}
                          >
                            {year}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {range === "custom" && (
              <div style={{ 
                marginTop: "12px",
                display: "flex",  
                gap: 8, 
                alignItems: "flex-end", 
                width: "100%", 
                flexWrap: "wrap",
                opacity: 1,
                visibility: "visible"
              }}>
                {/* Custom Date Input za Od */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative", flex: "1 1 auto", minWidth: 0 }} data-dropdown-container>
                  <label style={{ fontSize: "11px", fontWeight: 500, color: "#6b7280" }}>Od datuma:</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    style={{ 
                      padding: "8px 12px", 
                      border: "1px solid #d1d5db", 
                      borderRadius: "8px", 
                      fontSize: "13px", 
                      outline: "none",
                      width: "100%",
                      backgroundColor: "#fff",
                      cursor: "pointer",
                      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                      transition: "all 0.2s ease",
                      fontWeight: 500,
                      color: "#1f2937",
                      boxSizing: "border-box"
                    }}
                  />
                </div>
                {/* Custom Date Input za Do */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative", flex: "1 1 auto", minWidth: 0 }} data-dropdown-container>
                  <label style={{ fontSize: "11px", fontWeight: 500, color: "#6b7280" }}>Do datuma:</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    style={{ 
                      padding: "8px 12px", 
                      border: "1px solid #d1d5db", 
                      borderRadius: "8px", 
                      fontSize: "13px", 
                      outline: "none",
                      width: "100%",
                      backgroundColor: "#fff",
                      cursor: "pointer",
                      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                      transition: "all 0.2s ease",
                      fontWeight: 500,
                      color: "#1f2937",
                      boxSizing: "border-box"
                    }}
                  />
                </div>
              </div>
            )}
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: isMobile ? 16 : 30, alignItems: "center" }}>
          {[
            { value: "currentWeek", label: "Trenutna sedmica" },
            { value: "previousWeek", label: "Prošla sedmica" },
            { value: "monthly", label: "Mjesečni" },
            { value: "quarterly", label: "Tromjesečni" },
            { value: "selectMonth", label: "Odaberi mjesec" },
            { value: "custom", label: "Prilagođeno" },
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
          {range === "selectMonth" && (
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginLeft: 10, flexWrap: "wrap" }}>
              {/* Custom Dropdown za Mjesec */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative" }} data-dropdown-container>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>Mjesec:</label>
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMonthDropdownOpen(!monthDropdownOpen);
                      setYearDropdownOpen(false);
                    }}
                    style={{
                      padding: "10px 40px 10px 14px",
                      border: "1px solid #d1d5db",
                      borderRadius: "8px",
                      fontSize: "14px",
                      minWidth: "160px",
                      backgroundColor: "#fff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      boxShadow: monthDropdownOpen ? "0 4px 12px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
                      transition: "all 0.2s ease",
                      fontWeight: 500,
                      color: "#1f2937",
                    }}
                    onMouseEnter={(e) => {
                      if (!monthDropdownOpen) {
                        e.currentTarget.style.borderColor = "#9ca3af";
                        e.currentTarget.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.1)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!monthDropdownOpen) {
                        e.currentTarget.style.borderColor = "#d1d5db";
                        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.1)";
                      }
                    }}
                  >
                    <span>{["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"][selectedMonth - 1]}</span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{
                        transform: monthDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                        position: "absolute",
                        right: "14px",
                      }}
                    >
                      <path d="M6 9L1 4H11L6 9Z" fill="#6b7280" />
                    </svg>
                  </button>
                  {monthDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: "4px",
                        backgroundColor: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)",
                        zIndex: 1000,
                        maxHeight: "240px",
                        overflowY: "auto",
                      }}
                    >
                      {[
                        "Januar", "Februar", "Mart", "April", "Maj", "Juni",
                        "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"
                      ].map((month, index) => (
                        <button
                          key={index + 1}
                          type="button"
                          onClick={() => {
                            setSelectedMonth(index + 1);
                            setMonthDropdownOpen(false);
                          }}
                          style={{
                            width: "100%",
                            padding: "10px 14px",
                            textAlign: "left",
                            border: "none",
                            backgroundColor: selectedMonth === index + 1 ? "#eff6ff" : "#fff",
                            color: selectedMonth === index + 1 ? "#2563eb" : "#1f2937",
                            fontSize: "14px",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            fontWeight: selectedMonth === index + 1 ? 600 : 400,
                          }}
                          onMouseEnter={(e) => {
                            if (selectedMonth !== index + 1) {
                              e.currentTarget.style.backgroundColor = "#f9fafb";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedMonth !== index + 1) {
                              e.currentTarget.style.backgroundColor = "#fff";
                            }
                          }}
                        >
                          {month}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {/* Custom Dropdown za Godinu */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative" }} data-dropdown-container>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>Godina:</label>
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setYearDropdownOpen(!yearDropdownOpen);
                      setMonthDropdownOpen(false);
                    }}
                    style={{
                      padding: "10px 40px 10px 14px",
                      border: "1px solid #d1d5db",
                      borderRadius: "8px",
                      fontSize: "14px",
                      minWidth: "120px",
                      backgroundColor: "#fff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      boxShadow: yearDropdownOpen ? "0 4px 12px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
                      transition: "all 0.2s ease",
                      fontWeight: 500,
                      color: "#1f2937",
                    }}
                    onMouseEnter={(e) => {
                      if (!yearDropdownOpen) {
                        e.currentTarget.style.borderColor = "#9ca3af";
                        e.currentTarget.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.1)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!yearDropdownOpen) {
                        e.currentTarget.style.borderColor = "#d1d5db";
                        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.1)";
                      }
                    }}
                  >
                    <span>{selectedYear}</span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{
                        transform: yearDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                        position: "absolute",
                        right: "14px",
                      }}
                    >
                      <path d="M6 9L1 4H11L6 9Z" fill="#6b7280" />
                    </svg>
                  </button>
                  {yearDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: "4px",
                        backgroundColor: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)",
                        zIndex: 1000,
                        maxHeight: "200px",
                        overflowY: "auto",
                      }}
                    >
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                        <button
                          key={year}
                          type="button"
                          onClick={() => {
                            setSelectedYear(year);
                            setYearDropdownOpen(false);
                          }}
                          style={{
                            width: "100%",
                            padding: "10px 14px",
                            textAlign: "left",
                            border: "none",
                            backgroundColor: selectedYear === year ? "#eff6ff" : "#fff",
                            color: selectedYear === year ? "#2563eb" : "#1f2937",
                            fontSize: "14px",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            fontWeight: selectedYear === year ? 600 : 400,
                          }}
                          onMouseEnter={(e) => {
                            if (selectedYear !== year) {
                              e.currentTarget.style.backgroundColor = "#f9fafb";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedYear !== year) {
                              e.currentTarget.style.backgroundColor = "#fff";
                            }
                          }}
                        >
                          {year}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {range === "custom" && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginLeft: 10, opacity: 1, visibility: "visible" }}>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db", outline: "none" }}
              />
              <span style={{ color: "#6b7280" }}>do</span>
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
          height: isMobile ? 310 : 400,
          minHeight: isMobile ? 310 : 400,
          backgroundColor: "#fff",
          borderRadius: 12,
          padding: isMobile ? 0 : 20,
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          marginBottom: isMobile ? 8 : 30,
          overflow: isMobile ? "visible" : "hidden",
          boxSizing: "border-box",
          position: "relative"
        }}
      >
        <div style={{ width: "100%", height: isMobile ? 300 : 400, minHeight: isMobile ? 300 : 400, position: "relative", padding: isMobile ? "10px" : 0 }}>
          {(() => {
            // Debug log za mobilne uređaje
            if (typeof window !== 'undefined' && isMobile) {
              console.log('Dashboard Mobile Debug:', {
                loading,
                chartDataLength: chartData.length,
                isMobile,
                chartKey,
                windowWidth: window.innerWidth,
                screenWidth: window.screen?.width,
                userAgent: navigator.userAgent,
                hasChartData: chartData.length > 0,
                chartDataSample: chartData[0] || null,
                totalBruto,
                totalRashod,
                totalNeto
              });
            }
            return !loading ? (
              <ResponsiveContainer 
                key={`chart-${isMobile}-${chartData.length}-${chartKey}-${typeof window !== 'undefined' ? window.innerWidth : 0}`} 
                width="100%"
                height={isMobile ? 300 : 400}
              >
                <LineChart data={chartData || []} margin={{ top: isMobile ? 10 : 20, right: isMobile ? 10 : 20, left: isMobile ? 30 : 10, bottom: isMobile ? 25 : 6 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="datum" 
                    tick={{ fill: "#6b7280", fontSize: isMobile ? 10 : 11 }} 
                    angle={-45}
                    textAnchor="end"
                    height={isMobile ? 25 : 66}
                  />
                  <YAxis tick={{ fill: "#6b7280", fontSize: isMobile ? 10 : 11 }} width={isMobile ? 35 : 50} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: isMobile ? "11px" : "12px" }} />
                  <Line type="monotone" dataKey="artikli" name="Bruto" stroke="#16a34a" strokeWidth={isMobile ? 1.5 : 2} dot={{ r: isMobile ? 2 : 3 }} />
                  <Line type="monotone" dataKey="prihod" name="Prihod" stroke="#9333ea" strokeWidth={isMobile ? 1.5 : 2} dot={{ r: isMobile ? 2 : 3 }} />
                  <Line type="monotone" dataKey="rashod" name="Rashod" stroke="#dc2626" strokeWidth={isMobile ? 1.5 : 2} dot={{ r: isMobile ? 2 : 3 }} />
                  <Line type="monotone" dataKey="neto" name="Neto" stroke="#3b82f6" strokeWidth={isMobile ? 1.5 : 2} dot={{ r: isMobile ? 2 : 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "#6b7280", fontSize: "14px" }}>
                Učitavanje podataka...
              </div>
            );
          })()}
        </div>
      </div>

      {/* Kartice */}
      {(() => {
        // Debug log za mobilne uređaje
        if (typeof window !== 'undefined' && isMobile) {
          console.log('📱 Dashboard Cards Mobile Debug:', {
            totalBruto,
            totalRashod,
            totalNeto,
            isMobile,
            loading,
            chartDataLength: chartData.length,
            windowWidth: window.innerWidth,
            screenWidth: window.screen?.width,
            userAgent: navigator.userAgent?.substring(0, 50),
            willRender: true
          });
        }
        return (
          <div style={{ 
            display: "flex", 
            gap: isMobile ? 12 : 20, 
            flexWrap: "wrap", 
            marginBottom: isMobile ? 10 : 30, 
            width: "100%", 
            boxSizing: "border-box",
            visibility: "visible",
            opacity: 1
          }}>
            {[
              {
                label: "Bruto",
                value: totalBruto,
                icon: <FaArrowUp color="#16a34a" size={isMobile ? 18 : 20} />,
              },
              {
                label: "Rashod",
                value: totalRashod,
                icon: <FaArrowDown color="#dc2626" size={isMobile ? 18 : 20} />,
              },
              {
                label: "Neto",
                value: totalNeto,
                icon: <FaDollarSign color="#3b82f6" size={isMobile ? 18 : 20} />,
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  flex: isMobile ? "1 1 calc(50% - 6px)" : 1,
                  minWidth: isMobile ? "calc(50% - 6px)" : 160,
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  padding: isMobile ? 16 : 20,
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? 10 : 12,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  cursor: "default",
                  visibility: "visible",
                  opacity: 1,
                  position: "relative",
                  zIndex: 1
                }}
                className="dashboard-card"
              >
                <div style={{ flexShrink: 0 }}>{item.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: isMobile ? 12 : 14, color: "#6b7280", marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: "#111827" }}>{item.value.toFixed(2)} KM</div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

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
          {/* Naslov - h1 */}
          <h1 style={{
            fontSize: "20px",
            fontWeight: 600,
            color: "#1f2937",
            margin: "0 0 16px 0"
          }}>
            Utrošak po artiklu
          </h1>
          
          {/* Tip prikaza - Radio buttoni */}
          <div style={{ marginBottom: "12px" }}>
            <label style={{ 
              fontWeight: 500, 
              fontSize: "14px", 
              display: "block", 
              marginBottom: "8px",
              color: "#374151"
            }}>
              Tip prikaza:
            </label>
            <div style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap"
            }}>
              <label style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
                fontSize: "13px",
                color: "#374151",
                padding: "6px 10px",
                borderRadius: "6px",
                backgroundColor: artiklViewType === "custom" ? "#eff6ff" : "transparent",
                border: `1px solid ${artiklViewType === "custom" ? "#3b82f6" : "#e5e7eb"}`,
                transition: "all 0.2s"
              }}>
                <input
                  type="radio"
                  name="artiklViewTypeMobile"
                  value="custom"
                  checked={artiklViewType === "custom"}
                  onChange={(e) => {
                    setArtiklViewType("custom");
                    setSelectedArtikl("");
                  }}
                  style={{
                    width: "16px",
                    height: "16px",
                    cursor: "pointer",
                    accentColor: "#3b82f6"
                  }}
                />
                <span>Po Artiklu</span>
              </label>
              <label style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
                fontSize: "13px",
                color: "#374151",
                padding: "6px 10px",
                borderRadius: "6px",
                backgroundColor: artiklViewType === "top" ? "#eff6ff" : "transparent",
                border: `1px solid ${artiklViewType === "top" ? "#3b82f6" : "#e5e7eb"}`,
                transition: "all 0.2s"
              }}>
                <input
                  type="radio"
                  name="artiklViewTypeMobile"
                  value="top"
                  checked={artiklViewType === "top"}
                  onChange={(e) => {
                    setArtiklViewType("top");
                    setSelectedArtikl("");
                  }}
                  style={{
                    width: "16px",
                    height: "16px",
                    cursor: "pointer",
                    accentColor: "#3b82f6"
                  }}
                />
                <span style={{ fontWeight: artiklViewType === "top" ? 600 : 400 }}>Najprodavaniji</span>
              </label>
            </div>
          </div>

          {/* Odabir artikla - prikazuje se samo kada je "Odaberi artikal" aktivno */}
          {artiklViewType === "custom" && (
            <div style={{ marginBottom: "12px" }}>
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
                  width: "100%",
                  padding: "6px 36px 6px 10px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  fontSize: "13px",
                  backgroundColor: "#fff",
                  color: "#1f2937",
                  cursor: "pointer",
                  outline: "none",
                  transition: "all 0.2s ease",
                  boxSizing: "border-box",
                  appearance: "none",
                  backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
                  backgroundPosition: "right 8px center",
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "16px"
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#3b82f6";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#d1d5db";
                  e.currentTarget.style.boxShadow = "none";
                }}
                onMouseEnter={(e) => {
                  if (document.activeElement !== e.currentTarget) {
                    e.currentTarget.style.borderColor = "#9ca3af";
                  }
                }}
                onMouseLeave={(e) => {
                  if (document.activeElement !== e.currentTarget) {
                    e.currentTarget.style.borderColor = "#d1d5db";
                  }
                }}
              >
                <option value="">Odaberi artikal</option>
                {allArtikli.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          )}

          {/* Prikaz najprodavanijeg artikla i liste - prikazuje se samo kada je "Najprodavaniji artikal" aktivno */}
          {artiklViewType === "top" && artiklRanking.length > 0 && (
            <div style={{
              marginBottom: "12px"
            }}>
              <div style={{
                padding: "10px 12px",
                backgroundColor: "#f0f9ff",
                borderRadius: 6,
                border: "1px solid #bae6fd",
                marginBottom: "12px"
              }}>
                <div style={{
                  fontSize: "13px",
                  color: "#0369a1",
                  fontWeight: 600
                }}>
                  Najprodavaniji: <span style={{ color: "#0c4a6e" }}>{artiklToDisplay}</span>
                </div>
              </div>
              
              {/* Lista artikala sortirana po prodaji - mobilna verzija */}
              <div style={{
                backgroundColor: "#fff",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                overflow: "hidden",
                maxHeight: "250px",
                overflowY: "auto"
              }}>
                <div style={{
                  padding: "10px 12px",
                  backgroundColor: "#f9fafb",
                  borderBottom: "1px solid #e5e7eb",
                  position: "sticky",
                  top: 0,
                  zIndex: 1
                }}>
                  <h3 style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#1f2937",
                    margin: 0
                  }}>
                    Rang lista (po prodaji)
                  </h3>
                </div>
                {artiklRanking.map((item, index) => (
                  <div
                    key={item.naziv}
                    style={{
                      padding: "10px 12px",
                      borderBottom: index < artiklRanking.length - 1 ? "1px solid #f3f4f6" : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: item.naziv === artiklToDisplay ? "#eff6ff" : "transparent"
                    }}
                  >
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      flex: 1,
                      minWidth: 0
                    }}>
                      <div style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        backgroundColor: index === 0 ? "#fef3c7" : index === 1 ? "#e5e7eb" : index === 2 ? "#fed7aa" : "#f3f4f6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "12px",
                        color: index === 0 ? "#92400e" : index === 1 ? "#374151" : index === 2 ? "#9a3412" : "#6b7280",
                        flexShrink: 0
                      }}>
                        {index + 1}
                      </div>
                      <div style={{
                        fontSize: "13px",
                        fontWeight: item.naziv === artiklToDisplay ? 600 : 400,
                        color: item.naziv === artiklToDisplay ? "#1e40af" : "#1f2937",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}>
                        {item.naziv}
                      </div>
                    </div>
                    <div style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#059669",
                      flexShrink: 0,
                      marginLeft: "8px"
                    }}>
                      {Math.round(item.utroseno)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2 style={{ 
            fontSize: "16px", 
            fontWeight: 500, 
            marginBottom: "12px", 
            wordWrap: "break-word" 
          }}>
            Utrošak po artiklu
          </h2>
          <div style={{ position: "relative", width: "100%" }} data-dropdown-container>
            <button
              type="button"
              onClick={() => {
                setArtiklRangeDropdownOpen(!artiklRangeDropdownOpen);
                setMonthDropdownOpen(false);
                setYearDropdownOpen(false);
              }}
              style={{
                width: "100%",
                padding: "14px 40px 14px 16px",
                border: artiklRangeDropdownOpen ? "2px solid #3b82f6" : "1px solid #d1d5db",
                borderRadius: "12px",
                fontSize: "15px",
                backgroundColor: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: artiklRangeDropdownOpen ? "0 8px 20px rgba(59,130,246,0.2), 0 0 0 1px rgba(59,130,246,0.1)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                fontWeight: 600,
                color: "#1f2937",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <span>
                {[
                  { value: "currentWeek", label: "Trenutna sedmica" },
                  { value: "previousWeek", label: "Prošla sedmica" },
                  { value: "monthly", label: "Mjesečni" },
                  { value: "quarterly", label: "Tromjesečni" },
                  { value: "selectMonth", label: "Odaberi mjesec" },
                  { value: "custom", label: "Prilagođeno" },
                ].find(r => r.value === artiklRange)?.label || "Trenutna sedmica"}
              </span>
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  transform: artiklRangeDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  position: "absolute",
                  right: "16px",
                }}
              >
                <path 
                  d="M5 7.5L10 12.5L15 7.5" 
                  stroke={artiklRangeDropdownOpen ? "#3b82f6" : "#6b7280"} 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {artiklRangeDropdownOpen && (
              <>
                <div
                  style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(0, 0, 0, 0.08)",
                    backdropFilter: "blur(4px)",
                    WebkitBackdropFilter: "blur(4px)",
                    zIndex: 9999,
                  }}
                  onClick={() => setArtiklRangeDropdownOpen(false)}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    left: 0,
                    right: 0,
                    background: "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.98) 100%)",
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                    border: "1px solid rgba(255, 255, 255, 0.8)",
                    borderRadius: "16px",
                    boxShadow: "0 25px 50px -12px rgba(59, 130, 246, 0.25), 0 0 0 1px rgba(59, 130, 246, 0.1), 0 10px 30px rgba(0, 0, 0, 0.15)",
                    zIndex: 10000,
                    maxHeight: "320px",
                    overflowY: "auto",
                    overflowX: "hidden",
                  }}
                >
                  <style>{`
                    @keyframes dropdownSlideIn {
                      from {
                        opacity: 0;
                        transform: translateY(-10px) scale(0.95);
                      }
                      to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                      }
                    }
                    @keyframes itemSlideIn {
                      from {
                        opacity: 0;
                        transform: translateX(-10px);
                      }
                      to {
                        opacity: 1;
                        transform: translateX(0);
                      }
                    }
                  `}</style>
                  {[
                    { value: "currentWeek", label: "Trenutna sedmica" },
                    { value: "previousWeek", label: "Prošla sedmica" },
                    { value: "monthly", label: "Mjesečni" },
                    { value: "quarterly", label: "Tromjesečni" },
                    { value: "selectMonth", label: "Odaberi mjesec" },
                    { value: "custom", label: "Prilagođeno" },
                  ].map((r, index) => {
                    const isSelected = artiklRange === r.value;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => {
                          setArtiklRange(r.value as any);
                          setArtiklRangeDropdownOpen(false);
                          setMonthDropdownOpen(false);
                          setYearDropdownOpen(false);
                        }}
                        style={{
                          width: "100%",
                          padding: "16px 18px",
                          textAlign: "left",
                          border: "none",
                          backgroundColor: isSelected ? "#eff6ff" : "#fff",
                          background: isSelected ? "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)" : "#fff",
                          opacity: 1,
                          color: isSelected ? "#1e40af" : "#374151",
                          fontSize: "15px",
                          cursor: "pointer",
                          transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                          fontWeight: isSelected ? 600 : 500,
                          borderBottom: index < 5 ? "1px solid #f1f5f9" : "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          animation: `itemSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.05}s both`,
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = "#f1f5f9";
                            e.currentTarget.style.background = "#f1f5f9";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = "#fff";
                            e.currentTarget.style.background = "#fff";
                          }
                        }}
                      >
                        <span>{r.label}</span>
                        {isSelected && (
                          <svg 
                            width="22" 
                            height="22" 
                            viewBox="0 0 22 22" 
                            fill="none" 
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <circle cx="11" cy="11" r="10" fill="#3b82f6" opacity="0.15"/>
                            <path 
                              d="M7.5 11L10 13.5L14.5 9" 
                              stroke="#3b82f6" 
                              strokeWidth="2.5" 
                              strokeLinecap="round" 
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {artiklRange === "selectMonth" && (
              <div style={{ 
                marginTop: "12px",
                display: "flex", 
                gap: 8, 
                alignItems: "flex-end", 
                width: "100%", 
                flexWrap: "wrap",
                opacity: 1,
                visibility: "visible"
              }}>
                {/* Custom Dropdown za Mjesec */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative", flex: "1 1 auto", minWidth: 0 }} data-dropdown-container>
                  <label style={{ fontSize: "11px", fontWeight: 500, color: "#6b7280" }}>Mjesec:</label>
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setMonthDropdownOpen(!monthDropdownOpen);
                        setYearDropdownOpen(false);
                        setArtiklRangeDropdownOpen(false);
                      }}
                      style={{
                        padding: "8px 32px 8px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        fontSize: "13px",
                        width: "100%",
                        backgroundColor: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        boxShadow: monthDropdownOpen ? "0 4px 12px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
                        transition: "all 0.2s ease",
                        fontWeight: 500,
                        color: "#1f2937",
                      }}
                    >
                      <span>{["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"][selectedMonth - 1]}</span>
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{
                          transform: monthDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                          position: "absolute",
                          right: "8px",
                        }}
                      >
                        <path d="M6 9L1 4H11L6 9Z" fill="#6b7280" />
                      </svg>
                    </button>
                    {monthDropdownOpen && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          marginTop: "4px",
                          backgroundColor: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)",
                          zIndex: 10000,
                          maxHeight: "240px",
                          overflowY: "auto",
                        }}
                      >
                        {[
                          "Januar", "Februar", "Mart", "April", "Maj", "Juni",
                          "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"
                        ].map((month, index) => (
                          <button
                            key={index + 1}
                            type="button"
                            onClick={() => {
                              setSelectedMonth(index + 1);
                              setMonthDropdownOpen(false);
                              setArtiklRangeDropdownOpen(false);
                            }}
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              textAlign: "left",
                              border: "none",
                              backgroundColor: selectedMonth === index + 1 ? "#eff6ff" : "#fff",
                              color: selectedMonth === index + 1 ? "#2563eb" : "#1f2937",
                              fontSize: "13px",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              fontWeight: selectedMonth === index + 1 ? 600 : 400,
                            }}
                            onMouseEnter={(e) => {
                              if (selectedMonth !== index + 1) {
                                e.currentTarget.style.backgroundColor = "#f9fafb";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedMonth !== index + 1) {
                                e.currentTarget.style.backgroundColor = "#fff";
                              }
                            }}
                          >
                            {month}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Custom Dropdown za Godinu */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative", flex: "1 1 auto", minWidth: 0 }} data-dropdown-container>
                  <label style={{ fontSize: "11px", fontWeight: 500, color: "#6b7280" }}>Godina:</label>
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setYearDropdownOpen(!yearDropdownOpen);
                        setMonthDropdownOpen(false);
                        setArtiklRangeDropdownOpen(false);
                      }}
                      style={{
                        padding: "8px 32px 8px 12px",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        fontSize: "13px",
                        width: "100%",
                        backgroundColor: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        boxShadow: yearDropdownOpen ? "0 4px 12px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
                        transition: "all 0.2s ease",
                        fontWeight: 500,
                        color: "#1f2937",
                      }}
                    >
                      <span>{selectedYear}</span>
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{
                          transform: yearDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                          position: "absolute",
                          right: "8px",
                        }}
                      >
                        <path d="M6 9L1 4H11L6 9Z" fill="#6b7280" />
                      </svg>
                    </button>
                    {yearDropdownOpen && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          marginTop: "4px",
                          backgroundColor: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)",
                          zIndex: 10000,
                          maxHeight: "200px",
                          overflowY: "auto",
                        }}
                      >
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                          <button
                            key={year}
                            type="button"
                            onClick={() => {
                              setSelectedYear(year);
                              setYearDropdownOpen(false);
                              setArtiklRangeDropdownOpen(false);
                            }}
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              textAlign: "left",
                              border: "none",
                              backgroundColor: selectedYear === year ? "#eff6ff" : "#fff",
                              color: selectedYear === year ? "#2563eb" : "#1f2937",
                              fontSize: "13px",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              fontWeight: selectedYear === year ? 600 : 400,
                            }}
                            onMouseEnter={(e) => {
                              if (selectedYear !== year) {
                                e.currentTarget.style.backgroundColor = "#f9fafb";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedYear !== year) {
                                e.currentTarget.style.backgroundColor = "#fff";
                              }
                            }}
                          >
                            {year}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
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
        <div style={{
          marginBottom: 20,
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          background: "#fff",
          borderRadius: "12px",
          padding: "24px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          border: "1px solid #e5e7eb"
        }}>
          {/* Naslov sekcije - h1 */}
          <div style={{
            marginBottom: "20px",
            paddingBottom: "16px",
            borderBottom: "2px solid #f3f4f6"
          }}>
            <h1 style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#1f2937",
              margin: "0 0 8px 0"
            }}>
              Utrošak po artiklu
            </h1>
            <p style={{
              fontSize: "14px",
              color: "#6b7280",
              margin: "4px 0 0 0"
            }}>
              Odaberite artikal i vremenski period za detaljnu analizu utroška
            </p>
          </div>

          {/* Tip prikaza - Radio buttoni (desktop verzija) */}
          <div style={{
            marginBottom: "24px"
          }}>
            <label style={{
              display: "block",
              fontWeight: 600,
              fontSize: "14px",
              color: "#374151",
              marginBottom: "12px"
            }}>
              Tip prikaza:
            </label>
            <div style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap"
            }}>
              <label style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                fontSize: "14px",
                color: "#374151",
                padding: "10px 16px",
                borderRadius: "8px",
                backgroundColor: artiklViewType === "custom" ? "#eff6ff" : "transparent",
                border: `2px solid ${artiklViewType === "custom" ? "#3b82f6" : "#e5e7eb"}`,
                transition: "all 0.2s",
                fontWeight: artiklViewType === "custom" ? 600 : 400
              }}>
                <input
                  type="radio"
                  name="artiklViewTypeDesktop"
                  value="custom"
                  checked={artiklViewType === "custom"}
                  onChange={(e) => {
                    setArtiklViewType("custom");
                    setSelectedArtikl("");
                  }}
                  style={{
                    width: "18px",
                    height: "18px",
                    cursor: "pointer",
                    accentColor: "#3b82f6"
                  }}
                />
                <span>Po Artiklu</span>
              </label>
              <label style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                fontSize: "14px",
                color: "#374151",
                padding: "10px 16px",
                borderRadius: "8px",
                backgroundColor: artiklViewType === "top" ? "#eff6ff" : "transparent",
                border: `2px solid ${artiklViewType === "top" ? "#3b82f6" : "#e5e7eb"}`,
                transition: "all 0.2s",
                fontWeight: artiklViewType === "top" ? 600 : 400
              }}>
                <input
                  type="radio"
                  name="artiklViewTypeDesktop"
                  value="top"
                  checked={artiklViewType === "top"}
                  onChange={(e) => {
                    setArtiklViewType("top");
                    setSelectedArtikl("");
                  }}
                  style={{
                    width: "18px",
                    height: "18px",
                    cursor: "pointer",
                    accentColor: "#3b82f6"
                  }}
                />
                <span>Najprodavaniji</span>
              </label>
            </div>
          </div>

          {/* Odabir artikla - prikazuje se samo kada je "Odaberi artikal" aktivno */}
          {artiklViewType === "custom" && (
            <div style={{
              marginBottom: "24px"
            }}>
              <label style={{
                display: "block",
                fontWeight: 600,
                fontSize: "14px",
                color: "#374151",
                marginBottom: "8px"
              }}>
                Odaberi artikal:
              </label>
              <select
                value={selectedArtikl}
                onChange={(e) => setSelectedArtikl(e.target.value)}
                style={{
                  width: "100%",
                  maxWidth: "400px",
                  padding: "12px 40px 12px 16px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  fontSize: "15px",
                  backgroundColor: "#fff",
                  color: "#1f2937",
                  cursor: "pointer",
                  outline: "none",
                  transition: "all 0.2s ease",
                  boxSizing: "border-box",
                  appearance: "none",
                  backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
                  backgroundPosition: "right 8px center",
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "16px"
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#3b82f6";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#d1d5db";
                  e.currentTarget.style.boxShadow = "none";
                }}
                onMouseEnter={(e) => {
                  if (document.activeElement !== e.currentTarget) {
                    e.currentTarget.style.borderColor = "#9ca3af";
                  }
                }}
                onMouseLeave={(e) => {
                  if (document.activeElement !== e.currentTarget) {
                    e.currentTarget.style.borderColor = "#d1d5db";
                  }
                }}
              >
                <option value="">Odaberi artikal</option>
                {allArtikli.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          )}

          {/* Prikaz najprodavanijeg artikla i liste - prikazuje se samo kada je "Najprodavaniji artikal" aktivno */}
          {artiklViewType === "top" && artiklRanking.length > 0 && (
            <div style={{
              marginBottom: "24px"
            }}>
              <div style={{
                padding: "12px 16px",
                backgroundColor: "#f0f9ff",
                borderRadius: 8,
                border: "1px solid #bae6fd",
                marginBottom: "16px"
              }}>
                <div style={{
                  fontSize: "14px",
                  color: "#0369a1",
                  fontWeight: 600
                }}>
                  Najprodavaniji artikal: <span style={{ color: "#0c4a6e" }}>{artiklToDisplay}</span>
                </div>
              </div>
              
              {/* Lista artikala sortirana po prodaji */}
              <div style={{
                backgroundColor: "#fff",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                overflow: "hidden"
              }}>
                <div style={{
                  padding: "12px 16px",
                  backgroundColor: "#f9fafb",
                  borderBottom: "1px solid #e5e7eb"
                }}>
                  <h3 style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#1f2937",
                    margin: 0
                  }}>
                    Rang lista artikala (po prodaji)
                  </h3>
                </div>
                <div style={{
                  maxHeight: "300px",
                  overflowY: "auto"
                }}>
                  {artiklRanking.map((item, index) => (
                    <div
                      key={item.naziv}
                      style={{
                        padding: "12px 16px",
                        borderBottom: index < artiklRanking.length - 1 ? "1px solid #f3f4f6" : "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: item.naziv === artiklToDisplay ? "#eff6ff" : "transparent",
                        transition: "background-color 0.2s"
                      }}
                    >
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        flex: 1
                      }}>
                        <div style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          backgroundColor: index === 0 ? "#fef3c7" : index === 1 ? "#e5e7eb" : index === 2 ? "#fed7aa" : "#f3f4f6",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "14px",
                          color: index === 0 ? "#92400e" : index === 1 ? "#374151" : index === 2 ? "#9a3412" : "#6b7280",
                          flexShrink: 0
                        }}>
                          {index + 1}
                        </div>
                        <div style={{
                          fontSize: "14px",
                          fontWeight: item.naziv === artiklToDisplay ? 600 : 400,
                          color: item.naziv === artiklToDisplay ? "#1e40af" : "#1f2937"
                        }}>
                          {item.naziv}
                        </div>
                      </div>
                      <div style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#059669"
                      }}>
                        {Math.round(item.utroseno)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Filter perioda */}
          <div>
            <label style={{
              display: "block",
              fontWeight: 600,
              fontSize: "14px",
              color: "#374151",
              marginBottom: "12px"
            }}>
              Vremenski period:
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
              {[
                { value: "currentWeek", label: "Trenutna sedmica" },
                { value: "previousWeek", label: "Prošla sedmica" },
                { value: "monthly", label: "Mjesečni" },
                { value: "quarterly", label: "Tromjesečni" },
                { value: "selectMonth", label: "Odaberi mjesec" },
                { value: "custom", label: "Prilagođeno" },
              ].map((r) => (
                <button
                  key={r.value}
                  onClick={() => setArtiklRange(r.value as any)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 500,
                    fontSize: 14,
                    background: artiklRange === r.value ? "#3b82f6" : "#f3f4f6",
                    color: artiklRange === r.value ? "#fff" : "#374151",
                    transition: "all 0.2s",
                    boxShadow: artiklRange === r.value ? "0 2px 8px rgba(59,130,246,0.3)" : "0 1px 2px rgba(0,0,0,0.05)"
                  }}
                  onMouseEnter={(e) => {
                    if (artiklRange !== r.value) {
                      e.currentTarget.style.background = "#e5e7eb";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (artiklRange !== r.value) {
                      e.currentTarget.style.background = "#f3f4f6";
                    }
                  }}
                >
                  {r.label}
                </button>
              ))}
              {artiklRange === "selectMonth" && (
                <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginLeft: 10, flexWrap: "wrap" }}>
                  {/* Custom Dropdown za Mjesec */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative" }} data-dropdown-container>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>Mjesec:</label>
                    <div style={{ position: "relative" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setMonthDropdownOpen(!monthDropdownOpen);
                          setYearDropdownOpen(false);
                        }}
                        style={{
                          padding: "10px 40px 10px 14px",
                          border: "1px solid #d1d5db",
                          borderRadius: "8px",
                          fontSize: "14px",
                          minWidth: "160px",
                          backgroundColor: "#fff",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          boxShadow: monthDropdownOpen ? "0 4px 12px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
                          transition: "all 0.2s ease",
                          fontWeight: 500,
                          color: "#1f2937",
                        }}
                        onMouseEnter={(e) => {
                          if (!monthDropdownOpen) {
                            e.currentTarget.style.borderColor = "#9ca3af";
                            e.currentTarget.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.1)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!monthDropdownOpen) {
                            e.currentTarget.style.borderColor = "#d1d5db";
                            e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.1)";
                          }
                        }}
                      >
                        <span>{["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"][selectedMonth - 1]}</span>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          style={{
                            transform: monthDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s ease",
                            position: "absolute",
                            right: "14px",
                          }}
                        >
                          <path d="M6 9L1 4H11L6 9Z" fill="#6b7280" />
                        </svg>
                      </button>
                      {monthDropdownOpen && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            right: 0,
                            marginTop: "4px",
                            backgroundColor: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)",
                            zIndex: 1000,
                            maxHeight: "240px",
                            overflowY: "auto",
                          }}
                        >
                          {[
                            "Januar", "Februar", "Mart", "April", "Maj", "Juni",
                            "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"
                          ].map((month, index) => (
                            <button
                              key={index + 1}
                              type="button"
                              onClick={() => {
                                setSelectedMonth(index + 1);
                                setMonthDropdownOpen(false);
                              }}
                              style={{
                                width: "100%",
                                padding: "10px 14px",
                                textAlign: "left",
                                border: "none",
                                backgroundColor: selectedMonth === index + 1 ? "#eff6ff" : "#fff",
                                color: selectedMonth === index + 1 ? "#2563eb" : "#1f2937",
                                fontSize: "14px",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                fontWeight: selectedMonth === index + 1 ? 600 : 400,
                              }}
                              onMouseEnter={(e) => {
                                if (selectedMonth !== index + 1) {
                                  e.currentTarget.style.backgroundColor = "#f9fafb";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (selectedMonth !== index + 1) {
                                  e.currentTarget.style.backgroundColor = "#fff";
                                }
                              }}
                            >
                              {month}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Custom Dropdown za Godinu */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative" }} data-dropdown-container>
                    <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>Godina:</label>
                    <div style={{ position: "relative" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setYearDropdownOpen(!yearDropdownOpen);
                          setMonthDropdownOpen(false);
                        }}
                        style={{
                          padding: "10px 40px 10px 14px",
                          border: "1px solid #d1d5db",
                          borderRadius: "8px",
                          fontSize: "14px",
                          minWidth: "120px",
                          backgroundColor: "#fff",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          boxShadow: yearDropdownOpen ? "0 4px 12px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
                          transition: "all 0.2s ease",
                          fontWeight: 500,
                          color: "#1f2937",
                        }}
                        onMouseEnter={(e) => {
                          if (!yearDropdownOpen) {
                            e.currentTarget.style.borderColor = "#9ca3af";
                            e.currentTarget.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.1)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!yearDropdownOpen) {
                            e.currentTarget.style.borderColor = "#d1d5db";
                            e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.1)";
                          }
                        }}
                      >
                        <span>{selectedYear}</span>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          style={{
                            transform: yearDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s ease",
                            position: "absolute",
                            right: "14px",
                          }}
                        >
                          <path d="M6 9L1 4H11L6 9Z" fill="#6b7280" />
                        </svg>
                      </button>
                      {yearDropdownOpen && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            right: 0,
                            marginTop: "4px",
                            backgroundColor: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)",
                            zIndex: 1000,
                            maxHeight: "200px",
                            overflowY: "auto",
                          }}
                        >
                          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                            <button
                              key={year}
                              type="button"
                              onClick={() => {
                                setSelectedYear(year);
                                setYearDropdownOpen(false);
                              }}
                              style={{
                                width: "100%",
                                padding: "10px 14px",
                                textAlign: "left",
                                border: "none",
                                backgroundColor: selectedYear === year ? "#eff6ff" : "#fff",
                                color: selectedYear === year ? "#2563eb" : "#1f2937",
                                fontSize: "14px",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                fontWeight: selectedYear === year ? 600 : 400,
                              }}
                              onMouseEnter={(e) => {
                                if (selectedYear !== year) {
                                  e.currentTarget.style.backgroundColor = "#f9fafb";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (selectedYear !== year) {
                                  e.currentTarget.style.backgroundColor = "#fff";
                                }
                              }}
                            >
                              {year}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {artiklRange === "custom" && (
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginLeft: 10 }}>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    style={{ 
                      padding: "8px 12px", 
                      borderRadius: 6, 
                      border: "1px solid #d1d5db", 
                      outline: "none",
                      fontSize: "14px",
                      transition: "border-color 0.2s"
                    }}
                    onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
                    onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
                  />
                  <span style={{ color: "#6b7280", fontSize: "14px" }}>do</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    style={{ 
                      padding: "8px 12px", 
                      borderRadius: 6, 
                      border: "1px solid #d1d5db", 
                      outline: "none",
                      fontSize: "14px",
                      transition: "border-color 0.2s"
                    }}
                    onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
                    onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grafikon utroška po artiklu - uvijek prikazuj, kao prvi chart */}
      <div
        className="chart-container"
        style={{
          width: "100%",
          maxWidth: "100%",
          height: isMobile ? 310 : 400,
          minHeight: isMobile ? 310 : 400,
          backgroundColor: "#fff",
          borderRadius: 12,
          padding: isMobile ? 0 : 20,
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          marginBottom: isMobile ? 16 : 30,
          overflow: isMobile ? "visible" : "hidden",
          boxSizing: "border-box",
          position: "relative"
        }}
      >
        <div style={{ width: "100%", height: isMobile ? 300 : 400, minHeight: isMobile ? 300 : 400, position: "relative", padding: isMobile ? "10px" : 0 }}>
          {(() => {
            // Debug log za mobilne uređaje
            if (typeof window !== 'undefined' && isMobile) {
              console.log('📱 Dashboard Artikl Chart Mobile Debug:', {
                loading,
                selectedDataLength: selectedData.length,
                isMobile,
                chartKey,
                windowWidth: window.innerWidth,
                hasSelectedData: selectedData.length > 0,
                artiklToDisplay,
                artiklViewType,
                willRender: !loading
              });
            }
            return !loading ? (
              <ResponsiveContainer 
                key={`artikl-chart-${isMobile}-${selectedData.length}-${chartKey}-${typeof window !== 'undefined' ? window.innerWidth : 0}`} 
                width="100%"
                height={isMobile ? 300 : 400}
              >
                <LineChart data={selectedData || []} margin={{ top: isMobile ? 10 : 20, right: isMobile ? 10 : 20, left: isMobile ? 0 : 10, bottom: isMobile ? 25 : 6 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="datum" 
                    tick={{ fill: "#6b7280", fontSize: isMobile ? 10 : 11 }} 
                    angle={-45}
                    textAnchor="end"
                    height={isMobile ? 25 : 66}
                  />
                  <YAxis tick={{ fill: "#6b7280", fontSize: isMobile ? 10 : 11 }} width={isMobile ? 35 : 50} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: isMobile ? "11px" : "12px" }} />
                  <Line type="monotone" dataKey="utroseno" name={artiklToDisplay ? `Utrošeno (${artiklToDisplay})` : "Utrošeno"} stroke="#8b5cf6" strokeWidth={isMobile ? 1.5 : 2} dot={{ r: isMobile ? 2 : 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "#6b7280", fontSize: "14px" }}>
                Učitavanje podataka...
              </div>
            );
          })()}
        </div>
      </div>

      {/* Karta sa ukupnim utroškom - prikazuj samo ako postoji artikal */}
      {artiklToDisplay && (
        <div style={{ 
          display: "flex", 
          gap: 20, 
          flexWrap: "wrap", 
          marginBottom: isMobile ? 16 : 30, 
          width: "100%", 
          boxSizing: "border-box" 
        }}>
          <div
            style={{
              flex: 1,
              minWidth: isMobile ? "100%" : 300,
              backgroundColor: "#fff",
              borderRadius: 12,
              padding: isMobile ? 16 : 20,
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
              transition: "transform 0.2s, box-shadow 0.2s",
              cursor: "default",
            }}
            className="dashboard-card"
          >
            <div>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 13H11V3H3V13ZM3 21H11V15H3V21ZM13 21H21V11H13V21ZM13 3V9H21V3H13Z" fill="#8b5cf6"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: isMobile ? 12 : 14, color: "#6b7280", marginBottom: 4 }}>
                Ukupno utrošeno ({artiklToDisplay})
              </div>
              <div style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: "#111827" }}>
                {totalArtikl.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}
      </>
    </div>
  );
}