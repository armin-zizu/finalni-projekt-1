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
import { useRouter } from "next/navigation";
import { useCjenovnik } from "../context/CjenovnikContext";
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
  const [chartSeriesView, setChartSeriesView] = useState<"all" | "artikli" | "prihod" | "rashod" | "neto">("all");
  const [chartSeriesDropdownOpen, setChartSeriesDropdownOpen] = useState(false);
  const [selectedArtikl, setSelectedArtikl] = useState<string>("");
  const [artiklRange, setArtiklRange] = useState<"currentWeek" | "previousWeek" | "monthly" | "quarterly" | "selectMonth" | "custom">("currentWeek");
  const [artiklRangeDropdownOpen, setArtiklRangeDropdownOpen] = useState(false);
  const [artiklViewDropdownOpen, setArtiklViewDropdownOpen] = useState(false);
  const [artiklMonthDropdownOpen, setArtiklMonthDropdownOpen] = useState(false);
  const [artiklYearDropdownOpen, setArtiklYearDropdownOpen] = useState(false);
  const [artiklSelectedMonth, setArtiklSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [artiklSelectedYear, setArtiklSelectedYear] = useState<number>(new Date().getFullYear());
  const [artiklCustomFrom, setArtiklCustomFrom] = useState<string>(
    new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split("T")[0]
  );
  const [artiklCustomTo, setArtiklCustomTo] = useState<string>(new Date().toISOString().split("T")[0]);
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
  const { user } = useRole();
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const enableDashboardDebug = false;

  // Stabilna detekcija mobilnog uređaja (bez post-mount oscilacija)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let orientationTimer: ReturnType<typeof setTimeout> | undefined;

    const applyMobileState = () => {
      const nextMobile = detectMobile();
      setIsMobile((prevMobile) => {
        if (prevMobile !== nextMobile) {
          setChartKey((prevKey) => prevKey + 1);
          return nextMobile;
        }
        return prevMobile;
      });
    };

    applyMobileState();

    const handleResize = () => {
      applyMobileState();
    };

    const handleOrientationChange = () => {
      if (orientationTimer) {
        clearTimeout(orientationTimer);
      }
      orientationTimer = setTimeout(() => {
        applyMobileState();
      }, 120);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      if (orientationTimer) {
        clearTimeout(orientationTimer);
      }
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

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
      
      const apiArhiva: ArhiviraniObracun[] = obracuni.map((ob: any, index: number) => {
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
      
      console.log("Dashboard - Učitano obračuna:", apiArhiva.length);
      console.log("Dashboard - Finalni obračuni (bez isAzuriran):", apiArhiva.filter(o => !o.isAzuriran).length);
      console.log("Dashboard - Ažurirani obračuni (isAzuriran: true):", apiArhiva.filter(o => o.isAzuriran).length);
      
      // Sortiraj po datumu (rastući redoslijed za dashboard)
      const sortedArhiva = apiArhiva.sort((a, b) => {
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

  useEffect(() => {
    setArtiklSelectedMonth(selectedMonth);
    setArtiklSelectedYear(selectedYear);
    setArtiklCustomFrom(customFrom);
    setArtiklCustomTo(customTo);
  }, [selectedMonth, selectedYear, customFrom, customTo]);
  
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
        setChartSeriesDropdownOpen(false);
        setArtiklRangeDropdownOpen(false);
        setArtiklViewDropdownOpen(false);
        setArtiklMonthDropdownOpen(false);
        setArtiklYearDropdownOpen(false);
      }
    };

    if (
      monthDropdownOpen ||
      yearDropdownOpen ||
      rangeDropdownOpen ||
      chartSeriesDropdownOpen ||
      artiklRangeDropdownOpen ||
      artiklViewDropdownOpen ||
      artiklMonthDropdownOpen ||
      artiklYearDropdownOpen
    ) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [
    monthDropdownOpen,
    yearDropdownOpen,
    rangeDropdownOpen,
    chartSeriesDropdownOpen,
    artiklRangeDropdownOpen,
    artiklViewDropdownOpen,
    artiklMonthDropdownOpen,
    artiklYearDropdownOpen,
  ]);

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
  
  if (enableDashboardDebug) {
    console.log("Dashboard - Priprema podataka za grafikon:", {
      arhivaCount: arhiva.length,
      finalniObracuniCount: obracuni.length,
      arhivaIsAzuriranCount: arhiva.filter(o => o.isAzuriran).length,
      primjerPodataka: obracuni[0] || null,
      chartDataLength: obracuni.length,
      prviObracunIzArhive: arhiva[0] || null,
    });
  }

  // Dobivanje svih artikala za dropdown - samo artikli iz cjenovnika (sortirani po displayOrder)
  // Sortiraj artikle iz cjenovnika po displayOrder
  const allArtikli = [...cjenovnik]
    .sort((a, b) => {
      const orderA = a.displayOrder !== null && a.displayOrder !== undefined ? a.displayOrder : 999999;
      const orderB = b.displayOrder !== null && b.displayOrder !== undefined ? b.displayOrder : 999999;
      return orderA - orderB;
    })
    .map((item) => item.naziv);

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
      // Mjesečni - prikaži samo zbir mjeseca sa 0 na početku i kraju za vidljivu liniju
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      firstDay.setHours(0, 0, 0, 0);
      const lastDay = new Date(today);
      lastDay.setHours(23, 59, 59, 999);
      
      const monthObracuni = data.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= firstDay.getTime() && dTime <= lastDay.getTime();
      });
      
      const totalArtikli = monthObracuni.reduce((sum, o) => sum + (Number(o.artikli) || 0), 0);
      const totalRashod = monthObracuni.reduce((sum, o) => sum + (Number(o.rashod) || 0), 0);
      const totalPrihod = monthObracuni.reduce((sum, o) => sum + (Number(o.prihod) || 0), 0);
      const totalNeto = monthObracuni.reduce((sum, o) => sum + (Number(o.neto) || 0), 0);
      
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const year = today.getFullYear();
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const midLabel = `${month}/${year}`;
      
      // Vrati početnu točku (0), srednju tačku (zbir mjeseca), i završnu točku mjeseca (0)
      return [
        {
          datum: `01.${month}.${year}`,
          artikli: 0,
          rashod: 0,
          prihod: 0,
          neto: 0,
        },
        {
          datum: midLabel,
          artikli: totalArtikli,
          rashod: totalRashod,
          prihod: totalPrihod,
          neto: totalNeto,
        },
        {
          datum: `${String(lastDayOfMonth).padStart(2, "0")}.${month}.${year}`,
          artikli: 0,
          rashod: 0,
          prihod: 0,
          neto: 0,
        }
      ];
    } else if (selectedRange === "selectMonth") {
      // Odabrani mjesec - prikaži samo zbir mjeseca sa 0 na početku i kraju za vidljivu liniju
      const firstDay = new Date(selectedYear, selectedMonth - 1, 1);
      firstDay.setHours(0, 0, 0, 0);
      const lastDay = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
      
      const monthObracuni = data.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= firstDay.getTime() && dTime <= lastDay.getTime();
      });
      
      const totalArtikli = monthObracuni.reduce((sum, o) => sum + (Number(o.artikli) || 0), 0);
      const totalRashod = monthObracuni.reduce((sum, o) => sum + (Number(o.rashod) || 0), 0);
      const totalPrihod = monthObracuni.reduce((sum, o) => sum + (Number(o.prihod) || 0), 0);
      const totalNeto = monthObracuni.reduce((sum, o) => sum + (Number(o.neto) || 0), 0);
      
      const month = String(selectedMonth).padStart(2, "0");
      const year = selectedYear;
      const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      
      const midLabel = `${month}/${year}`;

      // Vrati početnu točku (0), srednju tačku (zbir mjeseca), i završnu točku mjeseca (0)
      return [
        {
          datum: `01.${month}.${year}`,
          artikli: 0,
          rashod: 0,
          prihod: 0,
          neto: 0,
        },
        {
          datum: midLabel,
          artikli: totalArtikli,
          rashod: totalRashod,
          prihod: totalPrihod,
          neto: totalNeto,
        },
        {
          datum: `${String(lastDayOfMonth).padStart(2, "0")}.${month}.${year}`,
          artikli: 0,
          rashod: 0,
          prihod: 0,
          neto: 0,
        }
      ];
    } else if (selectedRange === "quarterly") {
      // Tromjesečni - prikaži 3 LINIJE (po mjesecu) sa zbirom svakog mjeseca
      const quarterlyData: AggregatedData[] = [];
      
      // Kreiraj 3 mjeseca (od prije 3 mjeseca do sada)
      for (let i = 0; i < 3; i++) {
        const monthStart = new Date(today);
        monthStart.setMonth(today.getMonth() - 2 + i);
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        
        const monthEnd = new Date(monthStart);
        if (i === 2) {
          // Za zadnji mjesec, koristi današnji datum
          monthEnd.setHours(23, 59, 59, 999);
        } else {
          // Za druge mjesece, koristi zadnji dan mjeseca
          monthEnd.setMonth(monthStart.getMonth() + 1);
          monthEnd.setDate(0);
          monthEnd.setHours(23, 59, 59, 999);
        }
        
        const monthObracuni = data.filter((o) => {
          const dTime = parseDatumToDate(o.datum).getTime();
          return dTime >= monthStart.getTime() && dTime <= monthEnd.getTime();
        });
        
        const totalArtikli = monthObracuni.reduce((sum, o) => sum + (Number(o.artikli) || 0), 0);
        const totalRashod = monthObracuni.reduce((sum, o) => sum + (Number(o.rashod) || 0), 0);
        const totalPrihod = monthObracuni.reduce((sum, o) => sum + (Number(o.prihod) || 0), 0);
        const totalNeto = monthObracuni.reduce((sum, o) => sum + (Number(o.neto) || 0), 0);
        
        const month = String(monthStart.getMonth() + 1).padStart(2, "0");
        const year = monthStart.getFullYear();
        
        quarterlyData.push({
          datum: `${month}/${year}`,
          artikli: totalArtikli,
          rashod: totalRashod,
          prihod: totalPrihod,
          neto: totalNeto,
        });
      }
      
      return quarterlyData;
    } else if (selectedRange === "custom") {
      // Prilagođeni raspon - dinamička rezolucija podataka
      const fromTime = new Date(customFrom).getTime();
      const toTime = new Date(customTo).getTime();
      
      // Izračunaj broj dana
      const numberOfDays = Math.ceil((toTime - fromTime) / (1000 * 60 * 60 * 24));
      
      if (numberOfDays <= 15) {
        // 0-15 dana: prikaži po danima
        const customDaysData: AggregatedData[] = [];
        const startDate = new Date(customFrom);
        startDate.setHours(0, 0, 0, 0);
        
        for (let i = 0; i <= numberOfDays; i++) {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + i);
          
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
            const totalArtikli = dayObracuni.reduce((sum, o) => sum + (Number(o.artikli) || 0), 0);
            const totalRashod = dayObracuni.reduce((sum, o) => sum + (Number(o.rashod) || 0), 0);
            const totalPrihod = dayObracuni.reduce((sum, o) => sum + (Number(o.prihod) || 0), 0);
            const totalNeto = dayObracuni.reduce((sum, o) => sum + (Number(o.neto) || 0), 0);
            
            customDaysData.push({
              datum: datumStr,
              artikli: totalArtikli,
              rashod: totalRashod,
              prihod: totalPrihod,
              neto: totalNeto,
            });
          } else {
            customDaysData.push({
              datum: datumStr,
              artikli: 0,
              rashod: 0,
              prihod: 0,
              neto: 0,
            });
          }
        }
        return customDaysData;
      } else if (numberOfDays <= 60) {
        // 16-60 dana: prikaži po sedmicama
        const customWeeksData: AggregatedData[] = [];
        const startDate = new Date(customFrom);
        startDate.setHours(0, 0, 0, 0);
        
        // Zaokruži na početak sedmice (ponedeljak)
        const day = startDate.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        startDate.setDate(startDate.getDate() + diff);
        
        let currentDate = new Date(startDate);
        const endDate = new Date(customTo);
        endDate.setHours(23, 59, 59, 999);
        
        while (currentDate < endDate) {
          const weekStart = new Date(currentDate);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          
          // Pronađi sve podatke za ovu sedmicu
          const weekObracuni = data.filter((o) => {
            const dTime = parseDatumToDate(o.datum).getTime();
            return dTime >= weekStart.getTime() && dTime <= weekEnd.getTime();
          });
          
          const totalArtikli = weekObracuni.reduce((sum, o) => sum + (Number(o.artikli) || 0), 0);
          const totalRashod = weekObracuni.reduce((sum, o) => sum + (Number(o.rashod) || 0), 0);
          const totalPrihod = weekObracuni.reduce((sum, o) => sum + (Number(o.prihod) || 0), 0);
          const totalNeto = weekObracuni.reduce((sum, o) => sum + (Number(o.neto) || 0), 0);
          
          const day1 = String(weekStart.getDate()).padStart(2, "0");
          const month1 = String(weekStart.getMonth() + 1).padStart(2, "0");
          const year1 = weekStart.getFullYear();
          const day2 = String(weekEnd.getDate()).padStart(2, "0");
          const month2 = String(weekEnd.getMonth() + 1).padStart(2, "0");
          
          customWeeksData.push({
            datum: `${day1}.${month1}-${day2}.${month2}.${year1}`,
            artikli: totalArtikli,
            rashod: totalRashod,
            prihod: totalPrihod,
            neto: totalNeto,
          });
          
          currentDate.setDate(currentDate.getDate() + 7);
        }
        return customWeeksData;
      } else {
        // 60+ dana: prikaži po mjesecima
        const customMonthsData: AggregatedData[] = [];
        const startDate = new Date(customFrom);
        startDate.setHours(0, 0, 0, 0);
        startDate.setDate(1);
        
        let currentDate = new Date(startDate);
        const endDate = new Date(customTo);
        endDate.setHours(23, 59, 59, 999);
        
        while (currentDate < endDate) {
          const monthStart = new Date(currentDate);
          const monthEnd = new Date(monthStart);
          monthEnd.setMonth(monthStart.getMonth() + 1);
          monthEnd.setDate(0);
          monthEnd.setHours(23, 59, 59, 999);
          
          // Pronađi sve podatke za ovaj mjesec
          const monthObracuni = data.filter((o) => {
            const dTime = parseDatumToDate(o.datum).getTime();
            return dTime >= monthStart.getTime() && dTime <= monthEnd.getTime();
          });
          
          const totalArtikli = monthObracuni.reduce((sum, o) => sum + (Number(o.artikli) || 0), 0);
          const totalRashod = monthObracuni.reduce((sum, o) => sum + (Number(o.rashod) || 0), 0);
          const totalPrihod = monthObracuni.reduce((sum, o) => sum + (Number(o.prihod) || 0), 0);
          const totalNeto = monthObracuni.reduce((sum, o) => sum + (Number(o.neto) || 0), 0);
          
          const month = String(monthStart.getMonth() + 1).padStart(2, "0");
          const year = monthStart.getFullYear();
          
          customMonthsData.push({
            datum: `${month}/${year}`,
            artikli: totalArtikli,
            rashod: totalRashod,
            prihod: totalPrihod,
            neto: totalNeto,
          });
          
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
        return customMonthsData;
      }
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
      // Mjesečni - vratiti 3 tačke: 0 na početku, zbir u sredini, 0 na kraju
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today);
      lastDay.setHours(23, 59, 59, 999);
      const monthObracuni = allData.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= firstDay.getTime() && dTime <= lastDay.getTime();
      });

      const totalUtroseno = monthObracuni.reduce((sum, o) => sum + (Number(o.utroseno) || 0), 0);
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const year = today.getFullYear();

      const firstLabel = `01.${month}.${year}`;
      const midLabel = `${month}/${year}`;
      const lastLabel = `${String(lastDay.getDate()).padStart(2, "0")}.${month}.${year}`;

      return [
        { datum: firstLabel, utroseno: 0 },
        { datum: midLabel, utroseno: totalUtroseno },
        { datum: lastLabel, utroseno: 0 },
      ];
    } else if (selectedRange === "selectMonth") {
      // Odabrani mjesec - prikaži SAMO 1 liniju sa zbirom tog mjeseca
      const firstDay = new Date(artiklSelectedYear, artiklSelectedMonth - 1, 1);
      const lastDay = new Date(artiklSelectedYear, artiklSelectedMonth, 0, 23, 59, 59, 999);
      const monthObracuni = allData.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= firstDay.getTime() && dTime <= lastDay.getTime();
      });
      
      const totalUtroseno = monthObracuni.reduce((sum, o) => sum + (Number(o.utroseno) || 0), 0);
      const month = String(artiklSelectedMonth).padStart(2, "0");
      const year = artiklSelectedYear;
      
      const firstLabel = `01.${month}.${year}`;
      const midLabel = `${month}/${year}`;
      const lastLabel = `${String(lastDay.getDate()).padStart(2, "0")}.${month}.${year}`;

      return [
        { datum: firstLabel, utroseno: 0 },
        { datum: midLabel, utroseno: totalUtroseno },
        { datum: lastLabel, utroseno: 0 },
      ];
    } else if (selectedRange === "quarterly") {
      // Tromjesečni - prikaži 3 LINIJE (po mjesecu) sa zbirom svakog mjeseca
      const quarterlyData: ArtiklData[] = [];
      
      for (let i = 0; i < 3; i++) {
        const monthStart = new Date(today);
        monthStart.setMonth(today.getMonth() - 2 + i);
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        
        const monthEnd = new Date(monthStart);
        if (i === 2) {
          monthEnd.setHours(23, 59, 59, 999);
        } else {
          monthEnd.setMonth(monthStart.getMonth() + 1);
          monthEnd.setDate(0);
          monthEnd.setHours(23, 59, 59, 999);
        }
        
        const monthObracuni = allData.filter((o) => {
          const dTime = parseDatumToDate(o.datum).getTime();
          return dTime >= monthStart.getTime() && dTime <= monthEnd.getTime();
        });
        
        const totalUtroseno = monthObracuni.reduce((sum, o) => sum + (Number(o.utroseno) || 0), 0);
        const month = String(monthStart.getMonth() + 1).padStart(2, "0");
        const year = monthStart.getFullYear();
        
        quarterlyData.push({
          datum: `${month}/${year}`,
          utroseno: totalUtroseno,
        });
      }
      
      return quarterlyData;
    } else if (selectedRange === "custom") {
      // Prilagođeni raspon - dinamička rezolucija podataka
      const fromTime = new Date(artiklCustomFrom).getTime();
      const toTime = new Date(artiklCustomTo).getTime();
      
      // Izračunaj broj dana
      const numberOfDays = Math.ceil((toTime - fromTime) / (1000 * 60 * 60 * 24));
      
      if (numberOfDays <= 15) {
        // 0-15 dana: prikaži po danima
        const customDaysData: ArtiklData[] = [];
        const startDate = new Date(artiklCustomFrom);
        startDate.setHours(0, 0, 0, 0);
        
        for (let i = 0; i <= numberOfDays; i++) {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + i);
          
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
          
          customDaysData.push({
            datum: datumStr,
            utroseno: totalUtroseno,
          });
        }
        return customDaysData;
      } else if (numberOfDays <= 60) {
        // 16-60 dana: prikaži po sedmicama
        const customWeeksData: ArtiklData[] = [];
        const startDate = new Date(artiklCustomFrom);
        startDate.setHours(0, 0, 0, 0);
        
        // Zaokruži na početak sedmice (ponedeljak)
        const day = startDate.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        startDate.setDate(startDate.getDate() + diff);
        
        let currentDate = new Date(startDate);
        const endDate = new Date(artiklCustomTo);
        endDate.setHours(23, 59, 59, 999);
        
        while (currentDate < endDate) {
          const weekStart = new Date(currentDate);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          
          // Pronađi sve podatke za ovu sedmicu
          const weekObracuni = allData.filter((o) => {
            const dTime = parseDatumToDate(o.datum).getTime();
            return dTime >= weekStart.getTime() && dTime <= weekEnd.getTime();
          });
          
          const totalUtroseno = weekObracuni.reduce((sum, o) => sum + (Number(o.utroseno) || 0), 0);
          
          const day1 = String(weekStart.getDate()).padStart(2, "0");
          const month1 = String(weekStart.getMonth() + 1).padStart(2, "0");
          const year1 = weekStart.getFullYear();
          const day2 = String(weekEnd.getDate()).padStart(2, "0");
          const month2 = String(weekEnd.getMonth() + 1).padStart(2, "0");
          
          customWeeksData.push({
            datum: `${day1}.${month1}-${day2}.${month2}.${year1}`,
            utroseno: totalUtroseno,
          });
          
          currentDate.setDate(currentDate.getDate() + 7);
        }
        return customWeeksData;
      } else {
        // 60+ dana: prikaži po mjesecima
        const customMonthsData: ArtiklData[] = [];
        const startDate = new Date(artiklCustomFrom);
        startDate.setHours(0, 0, 0, 0);
        startDate.setDate(1);
        
        let currentDate = new Date(startDate);
        const endDate = new Date(artiklCustomTo);
        endDate.setHours(23, 59, 59, 999);
        
        while (currentDate < endDate) {
          const monthStart = new Date(currentDate);
          const monthEnd = new Date(monthStart);
          monthEnd.setMonth(monthStart.getMonth() + 1);
          monthEnd.setDate(0);
          monthEnd.setHours(23, 59, 59, 999);
          
          // Pronađi sve podatke za ovaj mjesec
          const monthObracuni = allData.filter((o) => {
            const dTime = parseDatumToDate(o.datum).getTime();
            return dTime >= monthStart.getTime() && dTime <= monthEnd.getTime();
          });
          
          const totalUtroseno = monthObracuni.reduce((sum, o) => sum + (Number(o.utroseno) || 0), 0);
          
          const month = String(monthStart.getMonth() + 1).padStart(2, "0");
          const year = monthStart.getFullYear();
          
          customMonthsData.push({
            datum: `${month}/${year}`,
            utroseno: totalUtroseno,
          });
          
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
        return customMonthsData;
      }
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
      const getMonday = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        date.setDate(date.getDate() + diff);
        date.setHours(0, 0, 0, 0);
        return date;
      };
      const startOfWeek = getMonday(today);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      filteredObracuni = arhiva.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= startOfWeek.getTime() && dTime <= endOfWeek.getTime();
      });
    } else if (selectedRange === "previousWeek") {
      const getMonday = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        date.setDate(date.getDate() + diff);
        date.setHours(0, 0, 0, 0);
        return date;
      };
      const currentWeekMonday = getMonday(today);
      const startOfWeek = new Date(currentWeekMonday);
      startOfWeek.setDate(currentWeekMonday.getDate() - 7);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
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
      const firstDay = new Date(artiklSelectedYear, artiklSelectedMonth - 1, 1);
      const lastDay = new Date(artiklSelectedYear, artiklSelectedMonth, 0, 23, 59, 59, 999);
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
      const fromDate = new Date(artiklCustomFrom);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(artiklCustomTo);
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
  }, [arhiva, artiklCustomFrom, artiklCustomTo, artiklSelectedMonth, artiklSelectedYear]);

  // Izračunaj listu svih artikala sortiranih po prodaji (od najviše ka najmanje)
  const calculateArtiklRanking = useCallback((selectedRange: "currentWeek" | "previousWeek" | "monthly" | "quarterly" | "selectMonth" | "custom") => {
    const today = new Date();
    let filteredObracuni = [...arhiva];

    if (selectedRange === "currentWeek") {
      const getMonday = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        date.setDate(date.getDate() + diff);
        date.setHours(0, 0, 0, 0);
        return date;
      };
      const startOfWeek = getMonday(today);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      filteredObracuni = arhiva.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= startOfWeek.getTime() && dTime <= endOfWeek.getTime();
      });
    } else if (selectedRange === "previousWeek") {
      const getMonday = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        date.setDate(date.getDate() + diff);
        date.setHours(0, 0, 0, 0);
        return date;
      };
      const currentWeekMonday = getMonday(today);
      const startOfWeek = new Date(currentWeekMonday);
      startOfWeek.setDate(currentWeekMonday.getDate() - 7);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
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
      const firstDay = new Date(artiklSelectedYear, artiklSelectedMonth - 1, 1);
      const lastDay = new Date(artiklSelectedYear, artiklSelectedMonth, 0, 23, 59, 59, 999);
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
      const fromDate = new Date(artiklCustomFrom);
      fromDate.setHours(0, 0, 0, 0);
      const toDate = new Date(artiklCustomTo);
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
  }, [arhiva, artiklCustomFrom, artiklCustomTo, artiklSelectedMonth, artiklSelectedYear]);

  // Podaci za grafikon
  const chartData = aggregateData(obracuni, range);
  
  // Debug: Provjeri stvarne vrijednosti u chartData
  if (enableDashboardDebug && typeof window !== 'undefined' && isMobile) {
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
  // Chart se uvijek prikazuje - ako nema odabranog artikla i artiklRange je "currentWeek", prikazuj prazan chart sa datumima za trenutnu sedmicu
  const topArtikl = calculateTopArtikl(artiklRange);
  const artiklRanking = calculateArtiklRanking(artiklRange);
  const artiklToDisplay = artiklViewType === "top" ? topArtikl : selectedArtikl;
  
  // Generiši podatke - ako nema odabranog artikla i artiklRange je "currentWeek", generiši prazan chart sa datumima
  let selectedData: ArtiklData[] = [];
  if (artiklToDisplay) {
    selectedData = aggregateArtiklData(artiklToDisplay, artiklRange);
  } else if (artiklRange === "currentWeek") {
    // Generiši 7 dana od ponedeljka do nedelje (trenutna sedmica) sa praznim podacima
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
      
      selectedData.push({
        datum: datumStr,
        utroseno: 0,
      });
    }
  }

  // Ukupne vrijednosti
  const totalBruto = chartData.reduce((sum, o) => sum + Number(o.artikli || 0), 0);
  const totalRashod = chartData.reduce((sum, o) => sum + Number(o.rashod || 0), 0);
  const totalPrihod = chartData.reduce((sum, o) => sum + Number(o.prihod || 0), 0);
  const totalNeto = chartData.reduce((sum, o) => sum + Number(o.neto || 0), 0);
  const totalArtikl = selectedData.reduce((sum, o) => sum + Number(o.utroseno || 0), 0);

  // Debug logiranje za chart podatke - NAKON izračuna varijabli
  useEffect(() => {
    if (enableDashboardDebug && typeof window !== 'undefined' && !loading) {
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
  }, [enableDashboardDebug, loading, isMobile, range, totalBruto, totalRashod, totalNeto, chartData, obracuni, arhiva]);

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

      {/* Range za prvi grafikon - Box samo na mobilnom */}
      {isMobile ? (
        <div style={{ 
          marginBottom: "16px", 
          background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", 
          padding: "12px", 
          borderRadius: "12px", 
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04)", 
          width: "100%", 
          maxWidth: "100%", 
          boxSizing: "border-box",
          border: "1px solid rgba(0, 0, 0, 0.05)"
        }}>
          <h2 style={{
            fontSize: "16px",
            fontWeight: 700,
            color: "#1f2937",
            margin: "0 0 8px 0"
          }}>
            Pregled prometa i zarade
          </h2>
          <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", padding: "8px 10px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase" }}>Period izvještaja</label>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as any)}
                style={{ width: "100%", padding: "9px 10px", borderRadius: "9px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: 600, color: "#0f172a", backgroundColor: "#fff" }}
              >
                <option value="currentWeek">Trenutna sedmica</option>
                <option value="previousWeek">Prošla sedmica</option>
                <option value="monthly">Mjesečni</option>
                <option value="quarterly">Tromjesečni</option>
                <option value="selectMonth">Odaberi mjesec</option>
                <option value="custom">Prilagođeno</option>
              </select>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", padding: "8px 10px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase" }}>Prikaz vrijednosti</label>
              <select
                value={chartSeriesView}
                onChange={(e) => setChartSeriesView(e.target.value as any)}
                style={{ width: "100%", padding: "9px 10px", borderRadius: "9px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: 600, color: "#0f172a", backgroundColor: "#fff" }}
              >
                <option value="all">Sve ukupno</option>
                <option value="artikli">Bruto</option>
                <option value="prihod">Prihod</option>
                <option value="rashod">Rashod</option>
                <option value="neto">Neto</option>
              </select>
            </div>
          </div>

          {range === "selectMonth" && (
            <div style={{ marginTop: "8px", display: "flex", gap: "6px", width: "100%" }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", padding: "8px 10px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase" }}>Mjesec</label>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ width: "100%", padding: "9px 10px", borderRadius: "9px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: 600, color: "#0f172a", backgroundColor: "#fff" }}>
                  {["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"].map((month, index) => (
                    <option key={month} value={index + 1}>{month}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", padding: "8px 10px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase" }}>Godina</label>
                <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} style={{ width: "100%", padding: "9px 10px", borderRadius: "9px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: 600, color: "#0f172a", backgroundColor: "#fff" }}>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
            
            {range === "custom" && (
              <div style={{ marginTop: "8px", display: "flex", gap: "6px", width: "100%" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", padding: "8px 10px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase" }}>Od datuma</label>
                  <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ width: "100%", padding: "9px 10px", borderRadius: "9px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: 600, color: "#0f172a", backgroundColor: "#fff", boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", padding: "8px 10px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase" }}>Do datuma</label>
                  <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ width: "100%", padding: "9px 10px", borderRadius: "9px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: 600, color: "#0f172a", backgroundColor: "#fff", boxSizing: "border-box" }} />
                </div>
              </div>
            )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: isMobile ? 16 : 30, alignItems: "stretch", width: "100%", overflowX: "auto", padding: "14px", borderRadius: "12px", border: "1px solid rgba(0, 0, 0, 0.05)", background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", boxSizing: "border-box" }}>
          <h2 style={{
            fontSize: "18px",
            fontWeight: 700,
            color: "#1f2937",
            margin: 0
          }}>
            Pregled prometa i zarade
          </h2>
          <div style={{ display: "flex", flexWrap: "nowrap", gap: 12, alignItems: "flex-end", width: "100%", overflowX: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase" }}>Period izvještaja</label>
            <div style={{ position: "relative" }}>
              <select value={range} onChange={(e) => setRange(e.target.value as any)} style={{ WebkitAppearance: "none", MozAppearance: "none", appearance: "none", padding: "11px 40px 11px 14px", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "14px", width: "220px", backgroundColor: "#fff", cursor: "pointer", boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)", fontWeight: 600, color: "#0f172a", outline: "none", transition: "all 0.2s ease" }}>
                <option value="currentWeek">Trenutna sedmica</option>
                <option value="previousWeek">Prošla sedmica</option>
                <option value="monthly">Mjesečni</option>
                <option value="quarterly">Tromjesečni</option>
                <option value="selectMonth">Odaberi mjesec</option>
                <option value="custom">Prilagođeno</option>
              </select>
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <path d="M6 9L1 4H11L6 9Z" fill="#64748b" />
              </svg>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase" }}>Prikaz vrijednosti</label>
            <div style={{ position: "relative" }}>
              <select value={chartSeriesView} onChange={(e) => setChartSeriesView(e.target.value as any)} style={{ WebkitAppearance: "none", MozAppearance: "none", appearance: "none", padding: "11px 40px 11px 14px", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "14px", width: "180px", backgroundColor: "#fff", cursor: "pointer", boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)", fontWeight: 600, color: "#0f172a", outline: "none", transition: "all 0.2s ease" }}>
                <option value="all">Sve ukupno</option>
                <option value="artikli">Bruto</option>
                <option value="prihod">Prihod</option>
                <option value="rashod">Rashod</option>
                <option value="neto">Neto</option>
              </select>
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <path d="M6 9L1 4H11L6 9Z" fill="#64748b" />
              </svg>
            </div>
          </div>
          {range === "selectMonth" && (
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginLeft: 0, flexWrap: "nowrap", flex: "0 0 auto" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase" }}>Mjesec</label>
                <div style={{ position: "relative" }}>
                  <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ WebkitAppearance: "none", MozAppearance: "none", appearance: "none", width: "150px", padding: "11px 40px 11px 14px", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "14px", backgroundColor: "#fff", cursor: "pointer", boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)", fontWeight: 600, color: "#0f172a", outline: "none" }}>
                    {["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"].map((month, index) => (
                      <option key={month} value={index + 1}>{month}</option>
                    ))}
                  </select>
                  <svg width="14" height="14" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                    <path d="M6 9L1 4H11L6 9Z" fill="#64748b" />
                  </svg>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase" }}>Godina</label>
                <div style={{ position: "relative" }}>
                  <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} style={{ WebkitAppearance: "none", MozAppearance: "none", appearance: "none", width: "110px", padding: "11px 40px 11px 14px", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "14px", backgroundColor: "#fff", cursor: "pointer", boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)", fontWeight: 600, color: "#0f172a", outline: "none" }}>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <svg width="14" height="14" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                    <path d="M6 9L1 4H11L6 9Z" fill="#64748b" />
                  </svg>
                </div>
              </div>
            </div>
          )}
          {range === "custom" && (
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginLeft: 0, opacity: 1, visibility: "visible", flexWrap: "nowrap", flex: "0 0 auto" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase" }}>Od datuma</label>
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={{ padding: "11px 14px", borderRadius: 10, border: "1px solid #cbd5e1", outline: "none", color: "#0f172a", fontWeight: 600, boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase" }}>Do datuma</label>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={{ padding: "11px 14px", borderRadius: 10, border: "1px solid #cbd5e1", outline: "none", color: "#0f172a", fontWeight: 600, boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)" }} />
              </div>
            </div>
          )}
          </div>
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
            if (enableDashboardDebug && typeof window !== 'undefined' && isMobile) {
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
                <LineChart data={chartData || []} margin={{ top: isMobile ? 10 : 20, right: isMobile ? 10 : 20, left: isMobile ? 30 : 10, bottom: isMobile ? 30 : 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="datum" 
                    tick={{ fill: "#6b7280", fontSize: isMobile ? 10 : 11 }} 
                    angle={0}
                    textAnchor="middle"
                    height={isMobile ? 30 : 40}
                    tickMargin={isMobile ? 6 : 8}
                  />
                  <YAxis tick={{ fill: "#6b7280", fontSize: isMobile ? 10 : 11 }} width={isMobile ? 35 : 50} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: isMobile ? "11px" : "12px" }} />
                  {(chartSeriesView === "all" || chartSeriesView === "artikli") && (
                    <Line type="monotone" dataKey="artikli" name="Bruto" stroke="#16a34a" strokeWidth={isMobile ? 1.5 : 2} dot={{ r: isMobile ? 2 : 3 }} connectNulls={true} />
                  )}
                  {(chartSeriesView === "all" || chartSeriesView === "prihod") && (
                    <Line type="monotone" dataKey="prihod" name="Prihod" stroke="#9333ea" strokeWidth={isMobile ? 1.5 : 2} dot={{ r: isMobile ? 2 : 3 }} connectNulls={true} />
                  )}
                  {(chartSeriesView === "all" || chartSeriesView === "rashod") && (
                    <Line type="monotone" dataKey="rashod" name="Rashod" stroke="#dc2626" strokeWidth={isMobile ? 1.5 : 2} dot={{ r: isMobile ? 2 : 3 }} connectNulls={true} />
                  )}
                  {(chartSeriesView === "all" || chartSeriesView === "neto") && (
                    <Line type="monotone" dataKey="neto" name="Neto" stroke="#3b82f6" strokeWidth={isMobile ? 1.5 : 2} dot={{ r: isMobile ? 2 : 3 }} connectNulls={true} />
                  )}
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
        if (enableDashboardDebug && typeof window !== 'undefined' && isMobile) {
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
            gap: isMobile ? 10 : 20, 
            flexWrap: "wrap", 
            marginBottom: isMobile ? 8 : 30, 
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
                  minWidth: isMobile ? "calc(50% - 5px)" : 160,
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  padding: isMobile ? 12 : 20,
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
                  <div style={{ fontSize: isMobile ? 11 : 14, color: "#6b7280", marginBottom: isMobile ? 2 : 4 }}>{item.label}</div>
                  <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: "#111827" }}>{item.value.toFixed(2)} KM</div>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Artikal grafikon - Box samo na mobilnom */}
      {isMobile ? (
        <div style={{ 
          marginBottom: "12px", 
          background: "#fff", 
          padding: "8px 10px", 
          borderRadius: "10px", 
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)", 
          width: "100%", 
          maxWidth: "100%", 
          boxSizing: "border-box" 
        }}>
          <h2 style={{
            fontSize: "16px",
            fontWeight: 700,
            color: "#1f2937",
            margin: "0 0 8px 0"
          }}>
            Detalji po artiklu
          </h2>
          <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", padding: "8px 10px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", marginBottom: "6px", display: "block" }}>Tip prikaza</label>
              <select
                value={artiklViewType}
                onChange={(e) => {
                  setArtiklViewType(e.target.value as "custom" | "top");
                  setSelectedArtikl("");
                }}
                style={{ width: "100%", padding: "9px 10px", borderRadius: "9px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: 600, color: "#0f172a", backgroundColor: "#fff" }}
              >
                <option value="custom">Po Artiklu</option>
                <option value="top">Najprodavaniji</option>
              </select>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", padding: "8px 10px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", marginBottom: "6px", display: "block" }}>Period</label>
              <select
                value={artiklRange}
                onChange={(e) => setArtiklRange(e.target.value as any)}
                style={{ width: "100%", padding: "9px 10px", borderRadius: "9px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: 600, color: "#0f172a", backgroundColor: "#fff" }}
              >
                <option value="currentWeek">Trenutna sedmica</option>
                <option value="previousWeek">Prošla sedmica</option>
                <option value="monthly">Mjesečni</option>
                <option value="quarterly">Tromjesečni</option>
                <option value="selectMonth">Odaberi mjesec</option>
                <option value="custom">Prilagođeno</option>
              </select>
            </div>
          </div>

          {/* Odabir artikla - prikazuje se samo kada je "Odaberi artikal" aktivno */}
          {artiklViewType === "custom" && (
            <div style={{ marginBottom: "8px", display: "flex", flexDirection: "column", gap: "4px", padding: "8px 10px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", marginBottom: "6px", display: "block" }}>
                Odaberi artikal
              </label>
              <select
                value={selectedArtikl}
                onChange={(e) => setSelectedArtikl(e.target.value)}
                style={{ width: "100%", padding: "9px 10px", borderRadius: "9px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: 600, color: "#0f172a", backgroundColor: "#fff" }}
              >
                <option value="">Odaberi artikal</option>
                {allArtikli.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          )}

          {artiklRange === "selectMonth" && (
            <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", padding: "8px 10px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", marginBottom: "6px", display: "block" }}>Mjesec</label>
                <select
                  value={artiklSelectedMonth}
                  onChange={(e) => setArtiklSelectedMonth(Number(e.target.value))}
                  style={{ width: "100%", padding: "9px 10px", borderRadius: "9px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: 600, color: "#0f172a", backgroundColor: "#fff" }}
                >
                  {["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"].map((month, index) => (
                    <option key={month} value={index + 1}>{month}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", padding: "8px 10px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", marginBottom: "6px", display: "block" }}>Godina</label>
                <select
                  value={artiklSelectedYear}
                  onChange={(e) => setArtiklSelectedYear(Number(e.target.value))}
                  style={{ width: "100%", padding: "9px 10px", borderRadius: "9px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: 600, color: "#0f172a", backgroundColor: "#fff" }}
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {artiklRange === "custom" && (
            <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", padding: "8px 10px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", marginBottom: "6px", display: "block" }}>Od datuma</label>
                <input
                  type="date"
                  value={artiklCustomFrom}
                  onChange={(e) => setArtiklCustomFrom(e.target.value)}
                  style={{ width: "100%", padding: "9px 10px", borderRadius: "9px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: 600, color: "#0f172a", backgroundColor: "#fff", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", padding: "8px 10px", borderRadius: "10px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", marginBottom: "6px", display: "block" }}>Do datuma</label>
                <input
                  type="date"
                  value={artiklCustomTo}
                  onChange={(e) => setArtiklCustomTo(e.target.value)}
                  style={{ width: "100%", padding: "9px 10px", borderRadius: "9px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: 600, color: "#0f172a", backgroundColor: "#fff", boxSizing: "border-box" }}
                />
              </div>
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
          <h2 style={{
            fontSize: "18px",
            fontWeight: 700,
            color: "#1f2937",
            margin: "0 0 12px 0"
          }}>
            Detalji po artiklu
          </h2>
          <div style={{ display: "flex", flexWrap: "nowrap", gap: 12, alignItems: "flex-end", width: "100%", overflowX: "auto", paddingBottom: "2px", marginBottom: "24px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase" }}>Tip prikaza</label>
              <select value={artiklViewType} onChange={(e) => { setArtiklViewType(e.target.value as "custom" | "top"); setSelectedArtikl(""); }} style={{ width: "170px", padding: "11px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "14px", fontWeight: 600, color: "#0f172a", backgroundColor: "#fff" }}>
                <option value="custom">Po Artiklu</option>
                <option value="top">Najprodavaniji</option>
              </select>
            </div>

            {artiklViewType === "custom" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase" }}>Odaberi artikal</label>
                <select value={selectedArtikl} onChange={(e) => setSelectedArtikl(e.target.value)} style={{ width: "220px", padding: "11px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "14px", fontWeight: 600, color: "#0f172a", backgroundColor: "#fff" }}>
                  <option value="">Odaberi artikal</option>
                  {allArtikli.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase" }}>Period</label>
              <select value={artiklRange} onChange={(e) => setArtiklRange(e.target.value as any)} style={{ width: "210px", padding: "11px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "14px", fontWeight: 600, color: "#0f172a", backgroundColor: "#fff" }}>
                <option value="currentWeek">Trenutna sedmica</option>
                <option value="previousWeek">Prošla sedmica</option>
                <option value="monthly">Mjesečni</option>
                <option value="quarterly">Tromjesečni</option>
                <option value="selectMonth">Odaberi mjesec</option>
                <option value="custom">Prilagođeno</option>
              </select>
            </div>

            {artiklRange === "selectMonth" && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase" }}>Mjesec</label>
                  <select value={artiklSelectedMonth} onChange={(e) => setArtiklSelectedMonth(Number(e.target.value))} style={{ width: "150px", padding: "11px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "14px", fontWeight: 600, color: "#0f172a", backgroundColor: "#fff" }}>
                    {["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"].map((month, index) => (
                      <option key={month} value={index + 1}>{month}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase" }}>Godina</label>
                  <select value={artiklSelectedYear} onChange={(e) => setArtiklSelectedYear(Number(e.target.value))} style={{ width: "110px", padding: "11px 14px", borderRadius: "10px", border: "1px solid #cbd5e1", fontSize: "14px", fontWeight: 600, color: "#0f172a", backgroundColor: "#fff" }}>
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {artiklRange === "custom" && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase" }}>Od datuma</label>
                  <input type="date" value={artiklCustomFrom} onChange={(e) => setArtiklCustomFrom(e.target.value)} style={{ padding: "11px 14px", borderRadius: 10, border: "1px solid #cbd5e1", outline: "none", color: "#0f172a", fontWeight: 600, boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e5e7eb", background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", letterSpacing: "0.04em", textTransform: "uppercase" }}>Do datuma</label>
                  <input type="date" value={artiklCustomTo} onChange={(e) => setArtiklCustomTo(e.target.value)} style={{ padding: "11px 14px", borderRadius: 10, border: "1px solid #cbd5e1", outline: "none", color: "#0f172a", fontWeight: 600, boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)" }} />
                </div>
              </>
            )}
          </div>

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
            if (enableDashboardDebug && typeof window !== 'undefined' && isMobile) {
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
                <LineChart data={selectedData || []} margin={{ top: isMobile ? 10 : 20, right: isMobile ? 10 : 20, left: isMobile ? 0 : 10, bottom: isMobile ? 30 : 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="datum" 
                    tick={{ fill: "#6b7280", fontSize: isMobile ? 10 : 11 }} 
                    angle={0}
                    textAnchor="middle"
                    height={isMobile ? 30 : 40}
                    tickMargin={isMobile ? 6 : 8}
                  />
                  <YAxis tick={{ fill: "#6b7280", fontSize: isMobile ? 10 : 11 }} width={isMobile ? 35 : 50} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: isMobile ? "11px" : "12px" }} />
                  <Line type="monotone" dataKey="utroseno" name={artiklToDisplay ? `Utrošeno (${artiklToDisplay})` : "Utrošeno"} stroke="#8b5cf6" strokeWidth={isMobile ? 1.5 : 2} dot={{ r: isMobile ? 2 : 3 }} connectNulls={true} />
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
          gap: isMobile ? 10 : 20, 
          flexWrap: "wrap", 
          marginBottom: isMobile ? 12 : 30, 
          width: "100%", 
          boxSizing: "border-box" 
        }}>
          <div
            style={{
              flex: 1,
              minWidth: isMobile ? "100%" : 300,
              backgroundColor: "#fff",
              borderRadius: 12,
              padding: isMobile ? 12 : 20,
              display: "flex",
              alignItems: "center",
              gap: isMobile ? 10 : 12,
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
              transition: "transform 0.2s, box-shadow 0.2s",
              cursor: "default",
            }}
            className="dashboard-card"
          >
            <div>
              <svg width={isMobile ? "20" : "24"} height={isMobile ? "20" : "24"} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 13H11V3H3V13ZM3 21H11V15H3V21ZM13 21H21V11H13V21ZM13 3V9H21V3H13Z" fill="#8b5cf6"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: isMobile ? 11 : 14, color: "#6b7280", marginBottom: isMobile ? 2 : 4 }}>
                Ukupno utrošeno ({artiklToDisplay})
              </div>
              <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: "#111827" }}>
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