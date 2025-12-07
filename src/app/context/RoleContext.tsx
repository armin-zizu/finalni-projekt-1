"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, Timestamp, onSnapshot, collection, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import FingerprintJS from "@fingerprintjs/fingerprintjs";

export type UserRole = "vlasnik" | "konobar" | null;

export type PagePermission = {
  dashboard?: boolean;
  obracun?: boolean;
  arhiva?: boolean;
  cjenovnik?: boolean;
  profit?: boolean;
  profile?: boolean;
};

export interface DeviceInfo {
  deviceId: string;
  browser: string;
  os: string;
  screenSize: string;
  userAgent: string;
  lastLogin: Date | null;
  firstSeen: Date | null;
}

export interface RoleData {
  role: UserRole;
  deviceId: string;
  deviceInfo: DeviceInfo;
  assignedBy: string | null;
  assignedAt: Date | null;
  permissions?: PagePermission; // Dozvole po stranicama za konobare
}

interface RoleContextType {
  role: UserRole;
  deviceId: string | null;
  deviceInfo: DeviceInfo | null;
  permissions: PagePermission | null;
  loading: boolean;
  error: string | null;
  assignRole: (deviceId: string, role: UserRole, permissions?: PagePermission) => Promise<void>;
  refreshRole: () => Promise<void>;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [permissions, setPermissions] = useState<PagePermission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Slušaj promjene autentifikacije
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Generiši Device ID
  const generateDeviceId = async (): Promise<string> => {
    // Provjeri da li je client-side
    if (typeof window === "undefined" || !navigator || !screen) {
      // Fallback za server-side
      return `server-${Date.now()}`;
    }

    try {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      return result.visitorId;
    } catch (err) {
      console.error("Greška pri generisanju Device ID:", err);
      // Fallback: koristi kombinaciju browser informacija
      const fallbackId = `${navigator.userAgent}-${screen.width}x${screen.height}-${navigator.language}`;
      return btoa(fallbackId).substring(0, 32);
    }
  };

  // Dohvati Device Info
  const getDeviceInfo = (currentDeviceId: string): DeviceInfo => {
    // Provjeri da li su navigator i screen dostupni (client-side only)
    if (typeof window === "undefined" || !navigator || !screen) {
      return {
        deviceId: currentDeviceId,
        browser: "Unknown",
        os: "Unknown",
        screenSize: "0x0",
        userAgent: "",
        lastLogin: new Date(),
        firstSeen: null,
      };
    }

    const browser = navigator.userAgent.includes("Chrome")
      ? "Chrome"
      : navigator.userAgent.includes("Firefox")
      ? "Firefox"
      : navigator.userAgent.includes("Safari")
      ? "Safari"
      : navigator.userAgent.includes("Edge")
      ? "Edge"
      : "Unknown";

    const os = navigator.userAgent.includes("Windows")
      ? "Windows"
      : navigator.userAgent.includes("Mac")
      ? "macOS"
      : navigator.userAgent.includes("Linux")
      ? "Linux"
      : navigator.userAgent.includes("Android")
      ? "Android"
      : navigator.userAgent.includes("iOS")
      ? "iOS"
      : "Unknown";

    return {
      deviceId: currentDeviceId,
      browser,
      os,
      screenSize: `${screen.width}x${screen.height}`,
      userAgent: navigator.userAgent,
      lastLogin: new Date(),
      firstSeen: null,
    };
  };

  // Učitaj ili kreiraj Device ID - čuva se u Firestore kolekciji "devices"
  const initializeDeviceId = async (): Promise<string> => {
    // Generiši deviceId koristeći FingerprintJS (isti kao u login)
    const newDeviceId = await generateDeviceId();
    
    // Provjeri da li dokument sa ovim deviceId-om već postoji
    if (user && user.uid) {
      try {
        const deviceRef = doc(db, "devices", newDeviceId);
        const deviceDoc = await getDoc(deviceRef);
        
        // Ako dokument postoji, vrati deviceId
        if (deviceDoc.exists()) {
          console.log("RoleContext - Device dokument već postoji:", newDeviceId);
          return newDeviceId;
        }
        
        // Ako dokument ne postoji, to je novi uređaj - ne kreiraj ga ovdje,
        // neka ga kreira loadRole() funkcija sa pravilnim statusom
        console.log("RoleContext - Novi uređaj detektovan:", newDeviceId);
      } catch (error: any) {
        // Ignoriraj greške permisija - mogu se desiti kada korisnik nema dozvolu za čitanje device dokumenta
        // Ovo je u redu jer će loadRole() funkcija kreirati device dokument ako ne postoji
        if (error?.code !== 'permission-denied' && !error?.code?.includes('permission') && !error?.code?.includes('insufficient')) {
          console.warn("Greška pri provjeri deviceId u Firestore:", error);
        }
      }
    }
    
    return newDeviceId;
  };

  // Učitaj ulogu za uređaj
  const loadRole = async () => {
      if (!user) {
        setRole(null);
        setDeviceId(null);
        setDeviceInfo(null);
        setPermissions(null);
        setLoading(false);
        return;
      }

    try {
      setLoading(true);
      setError(null);

      // Učitaj Device ID
      const currentDeviceId = await initializeDeviceId();
      setDeviceId(currentDeviceId);

      // Dohvati informacije o uređaju
      const info = getDeviceInfo(currentDeviceId);
      setDeviceInfo(info);

      // Provjeri da li je vlasnik sa specifičnim emailom i OS-om - automatski postavi kao vlasnik
      const os = info.os || (typeof navigator !== "undefined" && navigator.userAgent.includes("Windows")
        ? "Windows"
        : typeof navigator !== "undefined" && navigator.userAgent.includes("Mac")
        ? "macOS"
        : typeof navigator !== "undefined" && navigator.userAgent.includes("Linux")
        ? "Linux"
        : typeof navigator !== "undefined" && navigator.userAgent.includes("Android")
        ? "Android"
        : typeof navigator !== "undefined" && navigator.userAgent.includes("iOS")
        ? "iOS"
        : "Unknown");
      
      const isOwnerDevice = user.email === "gitara.zizu@gmail.com" && os === "Windows";
      
      // Ako je vlasnik sa specifičnim emailom i OS-om, automatski postavi kao vlasnik i preskoči sve provjere
      if (isOwnerDevice) {
        console.log("RoleContext - Detektovan vlasnik sa specifičnim emailom i OS-om, automatski postavljam kao vlasnik");
        
        // Provjeri da li postoji device dokument
        const deviceRef = doc(db, "devices", currentDeviceId);
        const deviceDoc = await getDoc(deviceRef);
        
        // Kreiraj ili ažuriraj device dokument sa vlasnik ulogom
        await setDoc(deviceRef, {
          userId: user.uid,
          userEmail: user.email,
          role: "vlasnik",
          status: "approved",
          isBlocked: false,
          permissions: {
            dashboard: true,
            obracun: true,
            arhiva: true,
            cjenovnik: true,
            profit: true,
            profile: true,
            admin: false,
          },
          deviceInfo: {
            ...info,
            firstSeen: deviceDoc.exists() ? (deviceDoc.data().deviceInfo?.firstSeen || Timestamp.fromDate(new Date())) : Timestamp.fromDate(new Date()),
            lastLogin: Timestamp.fromDate(new Date()),
          },
          lastLogin: Timestamp.fromDate(new Date()),
          createdAt: deviceDoc.exists() ? (deviceDoc.data().createdAt || Timestamp.fromDate(new Date())) : Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date()),
        }, { merge: true });
        
        console.log("RoleContext - Device dokument kreiran/ažuriran kao vlasnik za", user.email);
        
        // Automatski postavi ulogu i dozvole - PRESKOČI SVE OSTALE PROVJERE
        setRole("vlasnik");
        setPermissions({
          dashboard: true,
          obracun: true,
          arhiva: true,
          cjenovnik: true,
          profit: true,
          profile: true,
          admin: false,
        });
        setLoading(false);
        setError(null);
        return; // Preskoči sve ostale provjere
      }

      // Provjeri da li postoji uloga za ovaj uređaj
      const deviceRef = doc(db, "devices", currentDeviceId);
      const deviceDoc = await getDoc(deviceRef);

      if (deviceDoc.exists()) {
        const data = deviceDoc.data();
        let deviceRole = data.role || null;
        const isBlocked = data.isBlocked === true;
        let status = data.status || (deviceRole === null ? "verifikacija" : "approved");
        let needsVerification = status === "verifikacija";
        
        console.log("RoleContext - Device dokument postoji:", {
          deviceId: currentDeviceId,
          status: status,
          isBlocked: isBlocked,
          needsVerification: needsVerification,
          role: deviceRole
        });
        
        // Provjeri da li je vlasnik sa specifičnim emailom i OS-om - automatski postavi kao vlasnik
        const os = info.os || (typeof navigator !== "undefined" && navigator.userAgent.includes("Windows")
          ? "Windows"
          : typeof navigator !== "undefined" && navigator.userAgent.includes("Mac")
          ? "macOS"
          : typeof navigator !== "undefined" && navigator.userAgent.includes("Linux")
          ? "Linux"
          : typeof navigator !== "undefined" && navigator.userAgent.includes("Android")
          ? "Android"
          : typeof navigator !== "undefined" && navigator.userAgent.includes("iOS")
          ? "iOS"
          : "Unknown");
        
        const isOwnerDevice = user.email === "gitara.zizu@gmail.com" && os === "Windows";
        
        if (isOwnerDevice) {
          // Automatski postavi kao vlasnik
          deviceRole = "vlasnik";
          status = "approved";
          needsVerification = false;
          console.log("RoleContext - Automatski postavljam uređaj kao vlasnik (email + OS)");
          
          // Ažuriraj uređaj sa vlasnik ulogom
          await setDoc(
            deviceRef,
            {
              userId: user.uid,
              userEmail: user.email,
              role: "vlasnik",
              status: "approved",
              isBlocked: false,
              permissions: {
                dashboard: true,
                obracun: true,
                arhiva: true,
                cjenovnik: true,
                profit: true,
                profile: true,
                admin: false,
              },
              deviceInfo: {
                ...info,
                firstSeen: data.deviceInfo?.firstSeen || Timestamp.fromDate(new Date()),
                lastLogin: Timestamp.fromDate(new Date()),
              },
              lastLogin: Timestamp.fromDate(new Date()),
              updatedAt: Timestamp.fromDate(new Date()),
            },
            { merge: true }
          );
        } else {
          // Ažuriraj informacije o uređaju (ali ne mijenjaj status ako je već postavljen)
          await setDoc(
            deviceRef,
            {
              userId: user.uid,
              userEmail: user.email,
              deviceInfo: {
                ...info,
                firstSeen: data.deviceInfo?.firstSeen || Timestamp.fromDate(new Date()),
                lastLogin: Timestamp.fromDate(new Date()),
              },
              lastLogin: Timestamp.fromDate(new Date()),
              updatedAt: Timestamp.fromDate(new Date()),
            },
            { merge: true }
          );
          
          // Ponovo pročitaj status nakon ažuriranja (možda je vlasnik odobrio uređaj)
          const updatedDeviceDoc = await getDoc(deviceRef);
          if (updatedDeviceDoc.exists()) {
            const updatedData = updatedDeviceDoc.data();
            status = updatedData.status || status;
            needsVerification = status === "verifikacija";
            deviceRole = updatedData.role || deviceRole;
            console.log("RoleContext - Status nakon osvježavanja:", {
              status: status,
              needsVerification: needsVerification,
              role: deviceRole
            });
          }
        }
        
        // Provjeri da li je uređaj blokiran ili zahtijeva verifikaciju
        if (isBlocked || (needsVerification && !isOwnerDevice)) {
          // Blokiraj pristup ako je uređaj blokiran ili zahtijeva verifikaciju (osim ako je vlasnik)
          setRole(null);
          setPermissions(null);
          console.log("RoleContext - Uređaj blokiran ili zahtijeva verifikaciju:", { 
            isBlocked, 
            needsVerification, 
            status, 
            deviceId: currentDeviceId,
            userId: user.uid 
          });
        } else {
          setRole(deviceRole);
          setPermissions(data.permissions || (deviceRole === "vlasnik" ? {
            dashboard: true,
            obracun: true,
            arhiva: true,
            cjenovnik: true,
            profit: true,
            profile: true,
            admin: false,
          } : null));
          console.log("RoleContext - Uređaj odobren, uloga:", deviceRole, "status:", status);
        }
      } else {
        // Novi uređaj - provjeri da li je ovo prvi uređaj za ovog korisnika
        let defaultRole: UserRole = "vlasnik"; // Po defaultu postavi kao vlasnik
        let status = "approved"; // Prvi uređaj je automatski odobren
        
        // Provjeri da li je korisnik vlasnik (isOwner === true u user dokumentu)
        let isOwnerFromUserDoc = false;
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            isOwnerFromUserDoc = userData.isOwner === true;
          }
        } catch (error) {
          console.warn("Greška pri provjeri isOwner iz user dokumenta:", error);
        }
        
        // Provjeri da li je vlasnik sa specifičnim emailom i OS-om
        const os = info.os || (navigator.userAgent.includes("Windows")
          ? "Windows"
          : navigator.userAgent.includes("Mac")
          ? "macOS"
          : navigator.userAgent.includes("Linux")
          ? "Linux"
          : navigator.userAgent.includes("Android")
          ? "Android"
          : navigator.userAgent.includes("iOS")
          ? "iOS"
          : "Unknown");
        
        const isOwnerDevice = user.email === "gitara.zizu@gmail.com" && os === "Windows";
        
        // Provjeri da li korisnik već ima druge uređaje (prije kreiranja novog)
        try {
          const devicesQuery = query(collection(db, "devices"), where("userId", "==", user.uid));
          const devicesSnapshot = await getDocs(devicesQuery);
          
          console.log("RoleContext - Provjera drugih uređaja - broj uređaja:", devicesSnapshot.size, "deviceId:", currentDeviceId);
          
          // Ako korisnik već ima druge uređaje, novi uređaj zahtijeva verifikaciju
          if (!devicesSnapshot.empty) {
            // Provjeri da li je trenutni uređaj već u listi (ne bi trebao biti jer je novi)
            const existingDeviceIds = devicesSnapshot.docs.map(doc => doc.id);
            console.log("RoleContext - Postojeći uređaji:", existingDeviceIds);
            
            // Ako trenutni deviceId nije u listi postojećih, to je novi uređaj
            if (!existingDeviceIds.includes(currentDeviceId)) {
              defaultRole = null;
              status = "verifikacija"; // Novi uređaj zahtijeva verifikaciju
              console.log("RoleContext - Korisnik već ima druge uređaje, novi uređaj zahtijeva verifikaciju");
            } else {
              // Ako je trenutni uređaj već u listi, to znači da je već kreiran (možda iz login stranice)
              console.log("RoleContext - Trenutni uređaj već postoji u bazi, učitavam postojeći status");
              const existingDeviceDoc = devicesSnapshot.docs.find(doc => doc.id === currentDeviceId);
              if (existingDeviceDoc) {
                const existingData = existingDeviceDoc.data();
                defaultRole = existingData.role || null;
                status = existingData.status || "verifikacija";
                console.log("RoleContext - Učitavanje postojećeg statusa:", { role: defaultRole, status });
              }
            }
          } else {
            // Prvi uređaj - provjeri da li je korisnik vlasnik
            if (isOwnerFromUserDoc || isOwnerDevice) {
              // Prvi uređaj za vlasnika - automatski odobren
              defaultRole = "vlasnik";
              status = "approved";
              console.log("RoleContext - Prvi uređaj za vlasnika, automatski odobren");
            } else {
              // Prvi uređaj za korisnika koji nije vlasnik - također automatski odobren (jer je prvi)
              defaultRole = "vlasnik";
              status = "approved";
              console.log("RoleContext - Prvi uređaj za korisnika, automatski odobren");
            }
          }
        } catch (queryError: any) {
          // Ako query ne uspije zbog permisija ili indexa, provjeri da li je vlasnik
          console.warn("Greška pri provjeri drugih uređaja:", queryError);
          if (isOwnerFromUserDoc || isOwnerDevice) {
            // Ako je vlasnik, postavi kao vlasnik (fallback)
            defaultRole = "vlasnik";
            status = "approved";
          } else {
            // Ako nije vlasnik i query ne radi, postavi na verifikaciju (sigurnije)
            defaultRole = null;
            status = "verifikacija";
          }
        }
        
        // Kreiraj dokument sa ulogom
        const deviceData = {
          userId: user.uid,
          userEmail: user.email,
          role: defaultRole,
          status: status,
          isBlocked: false,
          permissions: defaultRole === "vlasnik" ? {
            dashboard: true,
            obracun: true,
            arhiva: true,
            cjenovnik: true,
            profit: true,
            profile: true,
            admin: false,
          } : null,
          deviceInfo: {
            ...info,
            firstSeen: Timestamp.fromDate(new Date()),
            lastLogin: Timestamp.fromDate(new Date()),
          },
          lastLogin: Timestamp.fromDate(new Date()),
          createdAt: Timestamp.fromDate(new Date()),
          updatedAt: Timestamp.fromDate(new Date()),
        };
        
        await setDoc(deviceRef, deviceData);
        
        // Ako je status "verifikacija", blokiraj pristup
        if (status === "verifikacija") {
          setRole(null);
          setPermissions(null);
          console.log("RoleContext - Novi uređaj kreiran sa statusom 'verifikacija', pristup blokiran");
        } else {
          setRole(defaultRole);
          setPermissions(deviceData.permissions || null);
          console.log("RoleContext - Novi uređaj kreiran, uloga:", defaultRole, "status:", status);
        }
      }

      // Slušaj promjene u realnom vremenu (samo ako dokument postoji)
      const unsubscribe = onSnapshot(
        deviceRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const isBlocked = data.isBlocked === true;
            const status = data.status || (data.role === null ? "verifikacija" : "approved");
            const needsVerification = status === "verifikacija";
            
            // Provjeri da li je uređaj blokiran ili zahtijeva verifikaciju
            if (isBlocked || needsVerification) {
              setRole(null);
              setPermissions(null);
            } else {
              setRole(data.role || null);
              setPermissions(data.permissions || null);
            }
          } else {
            setRole(null);
            setPermissions(null);
          }
        },
        (error: any) => {
          // Ignoriraj greške permisija - mogu se desiti kada korisnik nema dozvolu za čitanje device dokumenta
          // Ovo je u redu jer će se device dokument kreirati kada korisnik pokuša pristupiti aplikaciji
          const errorCode = error?.code || error?.message || '';
          const isPermissionError = 
            errorCode === 'permission-denied' || 
            errorCode.includes('permission') || 
            errorCode.includes('insufficient') ||
            errorCode.includes('Missing or insufficient permissions') ||
            error?.message?.includes('permission') ||
            error?.message?.includes('insufficient');
          
          if (!isPermissionError) {
            // Samo loguj ako nije greška permisija
            console.error("Greška pri real-time listeneru:", error);
          }
          // Ako je greška permisija, postavi role na null (verifikacija potrebna)
          if (isPermissionError) {
            setRole(null);
            setPermissions(null);
          }
        }
      );

      setLoading(false);
      
      // Vrati cleanup funkciju
      return unsubscribe;
    } catch (err: any) {
      // Ignoriraj greške permisija - mogu se desiti kada korisnik nema dozvolu za čitanje device dokumenta
      // Ovo je u redu jer će se device dokument kreirati kada korisnik pokuša pristupiti aplikaciji
      if (err?.code !== 'permission-denied' && !err?.code?.includes('permission') && !err?.code?.includes('insufficient')) {
        console.error("Greška pri učitavanju uloge:", err);
        setError(err.message || "Greška pri učitavanju uloge");
      } else {
        // Ako je greška permisija, postavi role na null (verifikacija potrebna)
        setRole(null);
        setPermissions(null);
      }
      setLoading(false);
    }
  };

  // Dodijeli ulogu uređaju
  const assignRole = async (targetDeviceId: string, newRole: UserRole, permissions?: PagePermission) => {
    if (!user) {
      throw new Error("Korisnik nije prijavljen");
    }

    try {
      const deviceRef = doc(db, "devices", targetDeviceId);
      const updateData: any = {
        role: newRole,
        assignedBy: user.uid,
        assignedAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      };
      
      // Ako je konobar, dodaj dozvole
      if (newRole === "konobar" && permissions) {
        updateData.permissions = permissions;
      } else if (newRole === "vlasnik") {
        // Vlasnik ima pristup svemu, ne trebaju mu dozvole
        updateData.permissions = null;
      }
      
      await setDoc(deviceRef, updateData, { merge: true });
    } catch (err: any) {
      console.error("Greška pri dodjeljivanju uloge:", err);
      throw err;
    }
  };

  // Osveži ulogu
  const refreshRole = async () => {
    await loadRole();
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let timeoutId: NodeJS.Timeout | undefined;
    
    const load = async () => {
      // Timeout fallback - ako se učitavanje ne završi za 8 sekundi, postavi loading na false
      timeoutId = setTimeout(() => {
        if (loading) {
          console.warn("RoleContext - Timeout pri učitavanju role, postavljam loading na false");
          setLoading(false);
          // Ako nema usera, role je već null
          if (!user) {
            setRole(null);
            setPermissions(null);
          }
        }
      }, 8000);
      
      try {
        const cleanup = await loadRole();
        if (cleanup) {
          unsubscribe = cleanup;
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        console.error("RoleContext - Greška pri učitavanju role:", error);
        setLoading(false);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    };
    
    load();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [user]);

  return (
    <RoleContext.Provider
      value={{
        role,
        deviceId,
        deviceInfo,
        permissions,
        loading,
        error,
        assignRole,
        refreshRole,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return context;
}

