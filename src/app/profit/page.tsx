"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useCjenovnik } from "../context/CjenovnikContext";
import { usePathname } from "next/navigation";
import { useRole } from "../context/RoleContext";
import { getObracuni, getCurrentUser, updateCurrentUser } from "../../lib/api";
// TEMPORARY: Firebase imports disabled during migration
// import { auth, onAuthStateChanged } from "../../lib/firebase";
// import { db } from "../../lib/firestore";
// import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";

// Mock objects for migration
const auth = { currentUser: null };
const onAuthStateChanged = (auth: any, callback: any) => {
  callback(null);
  return () => {};
};
const db = {} as any;
const collection = (db: any, path: string) => ({ path });
const getDocs = async (ref: any) => ({ docs: [] });
const doc = (db: any, collection: string, id: string) => ({ id, collection });
const getDoc = async (ref: any) => ({ exists: () => false, data: () => ({}) });
const setDoc = async (ref: any, data: any) => {};
import { encrypt, decrypt } from "../../lib/encryption";

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
  neto: number;  // prava zarada = bruto - nabavna * kolicina - deo rashoda (proporcionalno bruto)
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
  isMobile?: boolean;
}> = ({ filter, setFilter, customPeriod, setCustomPeriod, label = "Filter arhive", isMobile = false }) => {
  const hasLabel = !!label;

  return (
    <div style={{ 
      marginBottom: hasLabel ? (isMobile ? "16px" : "20px") : 0, 
      background: hasLabel ? "#fff" : "transparent", 
      padding: hasLabel ? (isMobile ? "10px 12px" : "16px") : 0, 
      borderRadius: hasLabel ? "8px" : 0, 
      boxShadow: hasLabel ? "0 2px 8px rgba(0,0,0,0.1)" : "none", 
      width: "100%", 
      maxWidth: "100%", 
      boxSizing: "border-box" 
    }}>
      {hasLabel && (
        <h2 style={{ 
          fontSize: isMobile ? "16px" : "18px", 
          fontWeight: 500, 
          marginBottom: isMobile ? "8px" : "12px", 
          wordWrap: "break-word" 
        }}>
          {label}
        </h2>
      )}
      <div style={{ 
        display: "flex", 
        gap: isMobile ? 4 : 12, 
        flexWrap: "wrap", 
        alignItems: "center", 
        width: "100%" 
      }}>
        {["trenutnaSedmica", "proslaSedmica", "prosliMjesec", "custom"].map((f, index) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            style={{
              ...buttonStyle,
              backgroundColor: filter === f ? "#3b82f6" : "#e5e7eb",
              color: filter === f ? "#fff" : "#374151",
              padding: isMobile ? "6px 12px" : "8px 16px",
              fontSize: isMobile ? 13 : 14,
              whiteSpace: "nowrap",
              flex: isMobile && (index === 0 || index === 3) ? "1 1 100%" : isMobile ? "1 1 calc(50% - 3px)" : "1 1 auto",
              minWidth: isMobile && (index === 0 || index === 3) ? "100%" : isMobile ? "calc(50% - 3px)" : "fit-content",
              maxWidth: isMobile && (index === 0 || index === 3) ? "100%" : isMobile ? "calc(50% - 3px)" : "none",
            }}
          >
            {f === "trenutnaSedmica" ? "Trenutna sedmica" :
             f === "proslaSedmica" ? "Prošla sedmica" :
             f === "prosliMjesec" ? "Prošli mjesec" :
             "Prilagođeni period"}
          </button>
        ))}
        {filter === "custom" && (
          <div style={{ display: "flex", gap: isMobile ? 4 : 8, alignItems: "center", width: isMobile ? "100%" : "auto", flexWrap: "wrap" }}>
            <input 
              type="date" 
              value={customPeriod.from} 
              onChange={(e) => setCustomPeriod({ ...customPeriod, from: e.target.value })} 
              style={{ 
                ...formInputStyle, 
                flex: isMobile ? "1 1 auto" : "none", 
                minWidth: 0, 
                maxWidth: isMobile ? "100%" : "none",
                padding: isMobile ? "6px 8px" : "8px",
                fontSize: isMobile ? 13 : 14,
              }} 
            />
            <span style={{ whiteSpace: "nowrap", fontSize: isMobile ? 13 : 14 }}>do</span>
            <input 
              type="date" 
              value={customPeriod.to} 
              onChange={(e) => setCustomPeriod({ ...customPeriod, to: e.target.value })} 
              style={{ 
                ...formInputStyle, 
                flex: isMobile ? "1 1 auto" : "none", 
                minWidth: 0, 
                maxWidth: isMobile ? "100%" : "none",
                padding: isMobile ? "6px 8px" : "8px",
                fontSize: isMobile ? 13 : 14,
              }} 
            />
          </div>
        )}
      </div>
    </div>
  );
};

// ---- Glavna komponenta ----
export default function ProfitPage() {
  const [obracuniProfit, setObracuniProfit] = useState<ObracunProfit[]>([]);
  const [filter, setFilter] = useState<"trenutnaSedmica" | "proslaSedmica" | "prosliMjesec" | "custom">("trenutnaSedmica");
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [chartKey, setChartKey] = useState(0);
  const [customPeriod, setCustomPeriod] = useState<{ from: string; to: string }>({
    from: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });
  // Dropdown state za custom period
  const [customFromDay, setCustomFromDay] = useState<number>(new Date().getDate());
  const [customFromMonth, setCustomFromMonth] = useState<number>(new Date().getMonth() + 1);
  const [customFromYear, setCustomFromYear] = useState<number>(new Date().getFullYear());
  const [customToDay, setCustomToDay] = useState<number>(new Date().getDate());
  const [customToMonth, setCustomToMonth] = useState<number>(new Date().getMonth() + 1);
  const [customToYear, setCustomToYear] = useState<number>(new Date().getFullYear());
  const [customFromDayDropdownOpen, setCustomFromDayDropdownOpen] = useState(false);
  const [customFromMonthDropdownOpen, setCustomFromMonthDropdownOpen] = useState(false);
  const [customFromYearDropdownOpen, setCustomFromYearDropdownOpen] = useState(false);
  const [customToDayDropdownOpen, setCustomToDayDropdownOpen] = useState(false);
  const [customToMonthDropdownOpen, setCustomToMonthDropdownOpen] = useState(false);
  const [customToYearDropdownOpen, setCustomToYearDropdownOpen] = useState(false);
  const [filteredObracuni, setFilteredObracuni] = useState<ObracunProfit[]>([]);
  const [selectedArtikl, setSelectedArtikl] = useState<string>("");
  const [artiklFilter, setArtiklFilter] = useState<"trenutnaSedmica" | "proslaSedmica" | "prosliMjesec" | "custom">("trenutnaSedmica");
  // Dropdown state za artikl filter custom period
  const [artiklCustomFromDay, setArtiklCustomFromDay] = useState<number>(new Date().getDate());
  const [artiklCustomFromMonth, setArtiklCustomFromMonth] = useState<number>(new Date().getMonth() + 1);
  const [artiklCustomFromYear, setArtiklCustomFromYear] = useState<number>(new Date().getFullYear());
  const [artiklCustomToDay, setArtiklCustomToDay] = useState<number>(new Date().getDate());
  const [artiklCustomToMonth, setArtiklCustomToMonth] = useState<number>(new Date().getMonth() + 1);
  const [artiklCustomToYear, setArtiklCustomToYear] = useState<number>(new Date().getFullYear());
  const [artiklCustomFromDayDropdownOpen, setArtiklCustomFromDayDropdownOpen] = useState(false);
  const [artiklCustomFromMonthDropdownOpen, setArtiklCustomFromMonthDropdownOpen] = useState(false);
  const [artiklCustomFromYearDropdownOpen, setArtiklCustomFromYearDropdownOpen] = useState(false);
  const [artiklCustomToDayDropdownOpen, setArtiklCustomToDayDropdownOpen] = useState(false);
  const [artiklCustomToMonthDropdownOpen, setArtiklCustomToMonthDropdownOpen] = useState(false);
  const [artiklCustomToYearDropdownOpen, setArtiklCustomToYearDropdownOpen] = useState(false);
  const [isPasswordProtected, setIsPasswordProtected] = useState<boolean | null>(null); // null = loading
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const { cjenovnik } = useCjenovnik();
  const { user } = useRole();
  const pathname = usePathname();

  // Detekcija mobilnog uređaja
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window === 'undefined') return false;
      const width = window.innerWidth || (window.screen && window.screen.width) || 1024;
      const mobile = width <= 768;
      return mobile;
    };
    
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
      
      const timer = setTimeout(() => {
        const newMobile = checkMobile();
        setIsMobile(newMobile);
      }, 0);
      
      checkMobile();
      window.addEventListener('resize', handleResize);
      window.addEventListener('orientationchange', handleOrientationChange);
      
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleOrientationChange);
      };
    }
  }, [isMobile]);

  // TEMPORARY: Password protection disabled - TODO: Migrate to API
  useEffect(() => {
    // Password protection temporarily disabled during Firebase migration
    setIsPasswordProtected(false);
  }, [pathname]);

  // TEMPORARY: Password protection disabled - TODO: Migrate to API
  const handlePasswordSubmit = async () => {
    // Password protection temporarily disabled during Firebase migration
    setPasswordError("Password protection trenutno nije dostupno.");
  };

  // ---- funkcija za učitavanje arhive i generisanje profita - KORISTI API ----
  const loadArhiva = useCallback(async (userId: string) => {
    try {
      console.log("Profit - Učitavanje arhive za korisnika:", userId);
      
      // UČITAJ IZ API-JA
      let firestoreArhiva: Obracun[] = [];
      
      try {
        const obracuni = await getObracuni(userId);
        
        // Transformiraj podatke iz API-ja u format koji profit očekuje
        firestoreArhiva = obracuni.map((ob: any) => ({
          ...ob,
          artikli: ob.artikli ?? [],
          prihodi: ob.prihodi ?? [],
          rashodi: ob.rashodi ?? [],
        } as Obracun));
        
        console.log("Profit - Učitano iz API-ja:", firestoreArhiva.length, "obračuna");
        
        if (firestoreArhiva.length === 0) {
          console.warn("Profit - Nema obračuna u arhivi!");
          setObracuniProfit([]);
          return;
        }
      } catch (error: any) {
        console.error("Profit - Greška pri učitavanju iz API-ja:", {
          error,
          message: error?.message,
        });
        setObracuniProfit([]);
        return;
      }
      
      console.log("Profit - Učitavanje arhive:", {
        firestoreCount: firestoreArhiva.length,
        cjenovnikLength: cjenovnik.length,
      });

      if (cjenovnik.length === 0) {
        console.log("Profit - Cjenovnik je prazan, čekam učitavanje...");
        setObracuniProfit([]);
        return;
      }

      const parsed: Obracun[] = firestoreArhiva
        .filter((item: any) => !item.isAzuriran) // Filtriraj samo finalne obračune (isAzuriran: false ili undefined)
        .map((item: any) => ({
          ...item,
          artikli: item.artikli ?? [],
          prihodi: item.prihodi ?? [],
          rashodi: item.rashodi ?? [],
        }))
        .sort((a: Obracun, b: Obracun) => {
          const dateA = new Date(a.datum.split(".").reverse().join("-")).getTime();
          const dateB = new Date(b.datum.split(".").reverse().join("-")).getTime();
          return dateB - dateA; // Silazni redoslijed (najnoviji prvo)
        });
        
      console.log("Profit - Filtrirani obračuni:", {
        preFiltera: firestoreArhiva.length,
        posleFiltera: parsed.length,
        finalni: parsed.length
      });

      console.log("Profit - Parsirano obračuna:", parsed.length);
      console.log("Profit - Prvi obračun detalji:", parsed[0] ? {
        datum: parsed[0].datum,
        artikliCount: parsed[0].artikli?.length || 0,
        artikli: parsed[0].artikli
      } : "Nema obračuna");

      console.log("Profit - Generisanje profita:", {
        parsedCount: parsed.length,
        cjenovnikArtikala: cjenovnik.map(c => ({ naziv: c.naziv, nabavnaCijena: c.nabavnaCijena })),
      });

      const profiti: ObracunProfit[] = parsed
        .filter((obracun) => {
          const imaArtikala = obracun.artikli && obracun.artikli.length > 0;
          if (!imaArtikala) {
            console.warn(`Profit - Obračun ${obracun.datum} nema artikala`);
          }
          return imaArtikala;
        })
        .map((obracun) => {
        console.log(`Profit - Procesiranje obračuna ${obracun.datum}:`, {
          artikliCount: obracun.artikli?.length || 0,
          artikli: obracun.artikli?.map(a => ({
            naziv: a.naziv,
            utroseno: a.utroseno,
            cijena: a.cijena,
          })),
        });

        // Prvo izračunaj ukupni rashod
        const ukupnoRashod = obracun.rashodi?.reduce((sum, r) => sum + r.cijena, 0) || 0;

        // Izračunaj artikle sa bruto vrednostima
        const artikliProfitTemp: (ArtikalProfit & { bruto: number })[] = (obracun.artikli || [])
          .filter((a) => {
            const isValid = a && a.naziv;
            if (!isValid) {
              console.warn(`Profit - Nevalidan artikal u obračunu ${obracun.datum}:`, a);
            }
            return isValid;
          })
          .filter((a) => {
            // Proveri da li artikal ima potrebne podatke
            if (!a.utroseno || a.utroseno <= 0) {
              console.warn(`Profit - Artikal "${a.naziv}" nema utrošenu količinu (utroseno: ${a.utroseno})`);
              return false; // Preskoči artikle bez utrošene količine
            }
            return true;
          })
          .map((a) => {
            const cjenovnikArtikl = cjenovnik.find((c) => c.naziv === a.naziv);
            
            // Za žestoka pića: količina = utroseno / zestokoKolicina
            // Za ostale artikle: količina = utroseno
            const kolicina = a.zestokoKolicina && a.zestokoKolicina > 0
              ? a.utroseno / a.zestokoKolicina
              : a.utroseno;
            
            const prodajna = a.cijena || 0;
            const nabavna = cjenovnikArtikl?.nabavnaCijena || 0;
            
            if (!cjenovnikArtikl) {
              console.warn(`Profit - Artikal "${a.naziv}" nije pronađen u cjenovniku (nabavna cijena će biti 0)`);
            } else {
              console.log(`Profit - Artikal "${a.naziv}":`, {
                nabavnaCijena: nabavna,
                prodajnaCijena: prodajna,
                kolicina,
              });
            }
            
            if (prodajna === 0) {
              console.warn(`Profit - Artikal "${a.naziv}" nema prodajnu cijenu`);
            }
            
            const bruto = prodajna * kolicina;
            const profit = prodajna - nabavna;

            return {
              naziv: a.naziv,
              nabavnaCijena: nabavna,
              prodajnaCijena: prodajna,
              kolicina,
              bruto,
              neto: 0, // Biće izračunato nakon što znamo ukupnoBruto
              profit,
              zestokoKolicina: a.zestokoKolicina,
            };
          });

        // Izračunaj ukupno bruto da bismo mogli da delimo rashod proporcionalno
        const ukupnoBruto = artikliProfitTemp.reduce((sum, a) => sum + a.bruto, 0);

        // Sada izračunaj pravu zaradu (neto) po artiklu sa proporcionalnim rashodom
        const artikliProfit: ArtikalProfit[] = artikliProfitTemp.map((a) => {
          // Rashod se dijeli proporcionalno bruto cijeni
          const deoRashoda = ukupnoBruto > 0 ? (a.bruto / ukupnoBruto) * ukupnoRashod : 0;
          // Prava zarada = bruto - nabavna cijena - deo rashoda
          const neto = a.bruto - (a.nabavnaCijena * a.kolicina) - deoRashoda;
          
          return {
            ...a,
            neto,
          };
        });

        console.log(`Profit - Obračun ${obracun.datum} ima ${artikliProfit.length} artikala za prikaz`);

        // Ukupno neto = suma prave zarade svih artikala
        const ukupnoNeto = artikliProfit.reduce((sum, a) => sum + a.neto, 0);

        return {
          datum: obracun.datum,
          artikliProfit,
          ukupnoBruto,
          ukupnoNeto,
          ukupnoRashod,
        };
      });

      console.log("Profit - Generisano profita:", {
        brojObračuna: profiti.length,
        obračuni: profiti.map(p => ({
          datum: p.datum,
          artikliProfitCount: p.artikliProfit.length,
          ukupnoBruto: p.ukupnoBruto,
          ukupnoNeto: p.ukupnoNeto,
        })),
      });

      console.log("Profit - Generisano profita:", profiti.length);
      console.log("Profit - Učitavanje završeno:", {
        brojObračuna: profiti.length,
        prviObračun: profiti[0]?.datum,
      });
      setObracuniProfit(profiti);
    } catch (error) {
      console.error("Profit - Kritična greška pri učitavanju arhive:", error);
      setObracuniProfit([]);
    }
  }, [cjenovnik]);

  // Učitaj arhivu kada se korisnik učita i cjenovnik je spreman
  useEffect(() => {
    if (!user?.id) {
      console.log("Profit - Nema korisnika, ne učitavam podatke");
      setObracuniProfit([]);
      return;
    }

    // Sačekaj mali delay da se sve inicijalizuje + da cjenovnik bude spreman
    if (cjenovnik.length > 0) {
      console.log("Profit - Korisnik učitan, učitavam arhivu...");
      setTimeout(() => {
        loadArhiva(user.id);
      }, 200);
    } else {
      console.log("Profit - Čekam cjenovnik...");
    }
  }, [user?.id, cjenovnik, loadArhiva]);

  // Listener za promjene u arhivi
  useEffect(() => {
    const handler = () => {
      if (user?.id && cjenovnik.length > 0) {
        setTimeout(() => {
          loadArhiva(user.id);
        }, 100);
      }
    };
    window.addEventListener("arhivaChanged", handler);
    return () => window.removeEventListener("arhivaChanged", handler);
  }, [user?.id, cjenovnik, loadArhiva]);

  // ---- filtriranje po periodu za glavni grafikon i tablice ----
  useEffect(() => {
    const today = new Date();
    const getMonday = (d: Date) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      date.setDate(date.getDate() + diff);
      date.setHours(0, 0, 0, 0);
      return date;
    };

    const filtered = obracuniProfit.filter((o) => {
      const dTime = new Date(o.datum.split(".").reverse().join("-")).getTime();

      if (filter === "trenutnaSedmica") {
        const monday = getMonday(today);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        return dTime >= monday.getTime() && dTime <= sunday.getTime();
      }
      if (filter === "proslaSedmica") {
        const lastWeekDate = new Date(today);
        lastWeekDate.setDate(today.getDate() - 7);
        const lastWeekMonday = getMonday(lastWeekDate);
        const lastWeekSunday = new Date(lastWeekMonday);
        lastWeekSunday.setDate(lastWeekMonday.getDate() + 6);
        lastWeekSunday.setHours(23, 59, 59, 999);
        return dTime >= lastWeekMonday.getTime() && dTime <= lastWeekSunday.getTime();
      }
      if (filter === "prosliMjesec") {
        const firstDayPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        lastDayPrevMonth.setHours(23, 59, 59, 999);
        return dTime >= firstDayPrevMonth.getTime() && dTime <= lastDayPrevMonth.getTime();
      }
      if (filter === "custom") {
        const fromTime = new Date(customPeriod.from).getTime();
        const toTime = new Date(customPeriod.to).getTime();
        return dTime >= fromTime && dTime <= toTime;
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
          neto: artikal ? artikal.neto : 0,   // prava zarada = bruto - nabavna * kolicina - deo rashoda
        };
      })
      .filter((o) => o.bruto > 0 || o.neto > 0)
      .sort((a, b) => {
        const dateA = new Date(a.datum.split(".").reverse().join("-")).getTime();
        const dateB = new Date(b.datum.split(".").reverse().join("-")).getTime();
        return dateA - dateB; // Uzlazni redoslijed
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

    if (selectedFilter === "trenutnaSedmica") {
      // Generiši poslednjih 7 dana (od danas unazad)
      const sevenDaysData: ArtiklProfitData[] = [];
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(todayDate);
        date.setDate(date.getDate() - i);
        
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const datumStr = `${day}.${month}.${year}`;
        
        // Pronađi podatke za ovaj dan
        const dayData = filteredData.find((o) => {
          const dTime = new Date(o.datum.split(".").reverse().join("-")).getTime();
          return dTime >= date.getTime() && dTime < date.getTime() + 86400000;
        });
        
        sevenDaysData.push({
          datum: datumStr,
          bruto: dayData ? Number(dayData.bruto) : 0,
          neto: dayData ? Number(dayData.neto) : 0,
        });
      }
      
      return sevenDaysData;
    } else if (selectedFilter === "proslaSedmica") {
      // Generiši prethodnih 7 dana (prošla sedmica)
      const sevenDaysData: ArtiklProfitData[] = [];
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      
      // Počni od pre 7 dana i generiši 7 dana unazad
      for (let i = 13; i >= 7; i--) {
        const date = new Date(todayDate);
        date.setDate(date.getDate() - i);
        
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const datumStr = `${day}.${month}.${year}`;
        
        // Pronađi podatke za ovaj dan
        const dayData = filteredData.find((o) => {
          const dTime = new Date(o.datum.split(".").reverse().join("-")).getTime();
          return dTime >= date.getTime() && dTime < date.getTime() + 86400000;
        });
        
        sevenDaysData.push({
          datum: datumStr,
          bruto: dayData ? Number(dayData.bruto) : 0,
          neto: dayData ? Number(dayData.neto) : 0,
        });
      }
      
      return sevenDaysData;
    } else if (selectedFilter === "prosliMjesec") {
      const firstDayPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      lastDayPrevMonth.setHours(23, 59, 59, 999);
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
    // Za trenutnu i prošlu sedmicu, uvek prikaži 7 dana
    if (filter === "trenutnaSedmica" || filter === "proslaSedmica") {
      const sevenDaysData: Array<{ datum: string; bruto: number; neto: number; rashod: number }> = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Odredi početni dan (za trenutnu sedmicu: danas - 6, za prošlu: danas - 13)
      const startOffset = filter === "trenutnaSedmica" ? 6 : 13;
      const endOffset = filter === "trenutnaSedmica" ? 0 : 7;
      
      for (let i = startOffset; i >= endOffset; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const datumStr = `${day}.${month}.${year}`;
        
        // Pronađi podatke za ovaj dan
        const dayData = filteredObracuni.find((o) => {
          const dTime = new Date(o.datum.split(".").reverse().join("-")).getTime();
          return dTime >= date.getTime() && dTime < date.getTime() + 86400000;
        });
        
        if (dayData) {
          sevenDaysData.push({
            datum: datumStr,
            bruto: dayData.ukupnoBruto,
            neto: dayData.ukupnoNeto,
            rashod: dayData.ukupnoRashod,
          });
        } else {
          sevenDaysData.push({
            datum: datumStr,
            bruto: 0,
            neto: 0,
            rashod: 0,
          });
        }
      }
      
      return sevenDaysData;
    }
    
    // Za ostale filtere, koristi originalnu logiku
    return [...filteredObracuni]
      .sort((a, b) => {
        const dateA = new Date(a.datum.split(".").reverse().join("-")).getTime();
        const dateB = new Date(b.datum.split(".").reverse().join("-")).getTime();
        return dateA - dateB;
      })
      .map((o) => ({
        datum: o.datum,
        bruto: o.ukupnoBruto,
        neto: o.ukupnoNeto,
        rashod: o.ukupnoRashod,
      }));
  }, [filteredObracuni, filter]);

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
            {isPasswordProtected ? "Pristupi" : "Postavi šifru"}
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
            height: 310px !important; 
            min-height: 310px !important;
            padding: 0 !important; 
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
          .recharts-wrapper { 
            width: 100% !important; 
            height: 300px !important;
            min-height: 300px !important;
            position: relative !important;
            margin-bottom: 0 !important;
          }
          .recharts-surface { 
            width: 100% !important; 
            height: 100% !important;
            max-width: 100% !important;
          }
          .recharts-legend-wrapper {
            width: 100% !important;
          }
          div[style*='height: 300'][style*='backgroundColor: #fff'] {
            height: 300px !important;
            min-height: 300px !important;
            position: relative !important;
            overflow: visible !important;
            margin-bottom: 8px !important;
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
      
      {/* ---- Filter za ukupni profit ---- */}
      <FilterSection
        filter={filter}
        setFilter={setFilter}
        customPeriod={customPeriod}
        setCustomPeriod={setCustomPeriod}
        label="Filter ukupnog profita"
        isMobile={isMobile}
      />

      {/* ---- Chart ukupnog profita ---- */}
      <div style={{ 
        width: "100%", 
        maxWidth: "100%", 
        height: isMobile ? 310 : 300, 
        minHeight: isMobile ? 310 : 300,
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: isMobile ? 0 : 20,
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        marginBottom: isMobile ? 8 : 20, 
        overflow: isMobile ? "visible" : "hidden", 
        boxSizing: "border-box",
        position: "relative"
      }}>
        <div style={{ width: "100%", height: isMobile ? 300 : 300, position: "relative", padding: isMobile ? "10px" : 0 }}>
          <ResponsiveContainer key={`profit-chart-${isMobile}-${chartData.length}-${chartKey}-${typeof window !== 'undefined' ? window.innerWidth : 0}`} width="100%" height="100%">
            <LineChart data={chartData && chartData.length > 0 ? chartData : []} margin={{ top: isMobile ? 10 : 20, right: isMobile ? 10 : 10, left: isMobile ? 0 : -10, bottom: isMobile ? 35 : 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="datum" 
                tick={{ fill: "#6b7280", fontSize: 11 }} 
                angle={-45}
                textAnchor="end"
                height={isMobile ? 35 : 66}
              />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} width={50} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: "12px" }} />
              <Line type="monotone" dataKey="bruto" name="Bruto" stroke="#3b82f6" strokeWidth={2} dot={{ r: isMobile ? 2 : 3 }} />
              <Line type="monotone" dataKey="neto" name="Neto" stroke="#10b981" strokeWidth={2} dot={{ r: isMobile ? 2 : 3 }} />
              <Line type="monotone" dataKey="rashod" name="Rashod" stroke="#ef4444" strokeWidth={2} dot={{ r: isMobile ? 2 : 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ---- Odabir artikla i filter za grafikon profita po artiklu ---- */}
      <div style={{
        marginBottom: 20,
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        background: "#fff",
        borderRadius: "12px",
        padding: isMobile ? "16px" : "24px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        border: "1px solid #e5e7eb"
      }}>
        {/* Naslov sekcije */}
        <div style={{
          marginBottom: isMobile ? "16px" : "20px",
          paddingBottom: isMobile ? "12px" : "16px",
          borderBottom: "2px solid #f3f4f6"
        }}>
          <h2 style={{
            fontSize: isMobile ? "18px" : "20px",
            fontWeight: 600,
            color: "#1f2937",
            margin: 0
          }}>
            Profit po artiklu
          </h2>
          <p style={{
            fontSize: isMobile ? "13px" : "14px",
            color: "#6b7280",
            margin: "4px 0 0 0"
          }}>
            Odaberite artikal i vremenski period za detaljnu analizu
          </p>
        </div>

        {/* Odabir artikla */}
        <div style={{
          marginBottom: isMobile ? "20px" : "24px"
        }}>
          <label style={{
            display: "block",
            fontWeight: 600,
            fontSize: isMobile ? "14px" : "15px",
            color: "#374151",
            marginBottom: isMobile ? "8px" : "10px"
          }}>
            Odaberi artikal
          </label>
          <select
            value={selectedArtikl}
            onChange={(e) => setSelectedArtikl(e.target.value)}
            style={{
              width: "100%",
              padding: isMobile ? "10px 12px" : "12px 16px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              fontSize: isMobile ? "14px" : "15px",
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
              backgroundSize: "16px",
              paddingRight: isMobile ? "36px" : "40px"
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#3b82f6";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#d1d5db";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <option value="">Odaberi artikal...</option>
            {allArtikli.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {/* Filter sekcija */}
        <div>
          <label style={{
            display: "block",
            fontWeight: 600,
            fontSize: isMobile ? "14px" : "15px",
            color: "#374151",
            marginBottom: isMobile ? "12px" : "14px"
          }}>
            Vremenski period
          </label>
          <FilterSection
            filter={artiklFilter}
            setFilter={setArtiklFilter}
            customPeriod={customPeriod}
            setCustomPeriod={setCustomPeriod}
            label=""
            isMobile={isMobile}
          />
        </div>
      </div>

      {/* ---- Grafikon profita odabranog artikla ---- */}
      <div
        style={{
        width: "100%",
        maxWidth: "100%",
        height: isMobile ? 310 : 300,
        minHeight: isMobile ? 310 : 300,
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: isMobile ? 0 : 20,
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        marginBottom: 10,
        boxSizing: "border-box",
        overflow: isMobile ? "visible" : "hidden",
        position: "relative"
      }}
      >
        <div style={{ width: "100%", height: isMobile ? 300 : 300, position: "relative", padding: isMobile ? "10px" : 0 }}>
          <ResponsiveContainer key={`artikl-profit-${isMobile}-${selectedArtiklData.length}-${chartKey}-${typeof window !== 'undefined' ? window.innerWidth : 0}`} width="100%" height="100%">
            <LineChart data={selectedArtiklData && selectedArtiklData.length > 0 ? selectedArtiklData : []} margin={{ top: isMobile ? 10 : 20, right: isMobile ? 10 : 10, left: isMobile ? 0 : -10, bottom: isMobile ? 35 : 6 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="datum" 
                tick={{ fill: "#6b7280", fontSize: 11 }} 
                angle={-45}
                textAnchor="end"
                height={isMobile ? 35 : 66}
              />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} width={50} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: "12px" }} />
              <Line type="monotone" dataKey="bruto" name="Bruto artikal" stroke="#3b82f6" strokeWidth={2} dot={{ r: isMobile ? 2 : 3 }} />
              <Line type="monotone" dataKey="neto" name="Neto artikal" stroke="#10b981" strokeWidth={2} dot={{ r: isMobile ? 2 : 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
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