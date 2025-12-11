"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { getCurrentUser, getUserId, getUserDevices, getDeviceByDeviceId, saveDevice, getAuthToken } from "../../lib/api";

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
  // TEMPORARY: Mock user for development - bypass auth
  const [user, setUser] = useState<any>({ 
    id: 'dev-user-id', 
    email: 'dev@example.com', 
    isOwner: true 
  });
  const [role, setRole] = useState<UserRole>("vlasnik"); // Set to "vlasnik" to bypass checks
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [permissions, setPermissions] = useState<PagePermission | null>({
    dashboard: true,
    obracun: true,
    arhiva: true,
    cjenovnik: true,
    profit: true,
    profile: true,
    admin: false,
  });
  const [loading, setLoading] = useState(false); // Set to false to skip loading
  const [error, setError] = useState<string | null>(null);

  // TEMPORARY: Disabled auth check - comment out to re-enable
  /*
  // Slušaj promjene autentifikacije - koristi API umjesto Firebase
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    const checkAuth = async () => {
      const token = getAuthToken();
      if (!token) {
        setUser(null);
        return;
      }
      
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error("Error checking auth:", error);
        setUser(null);
      }
    };

    // Provjeri odmah
    checkAuth();

    // Provjeri svakih 30 sekundi (umjesto real-time listenera)
    intervalId = setInterval(checkAuth, 30000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);
  */

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

  // Učitaj ili kreiraj Device ID - koristi API
  const initializeDeviceId = async (): Promise<string> => {
    // Generiši deviceId koristeći FingerprintJS (isti kao u login)
    const newDeviceId = await generateDeviceId();
    
    // Provjeri da li dokument sa ovim deviceId-om već postoji
    if (user && user.id) {
      try {
        const existingDevice = await getDeviceByDeviceId(user.id, newDeviceId);
        
        // Ako dokument postoji, vrati deviceId
        if (existingDevice) {
          console.log("RoleContext - Device već postoji:", newDeviceId);
          return newDeviceId;
        }
        
        // Ako dokument ne postoji, to je novi uređaj - ne kreiraj ga ovdje,
        // neka ga kreira loadRole() funkcija sa pravilnim statusom
        console.log("RoleContext - Novi uređaj detektovan:", newDeviceId);
      } catch (error: any) {
        // Ignoriraj greške - loadRole() će kreirati device dokument ako ne postoji
        console.warn("Greška pri provjeri deviceId:", error);
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
        
        // Provjeri da li postoji device
        const existingDevice = await getDeviceByDeviceId(user.id, currentDeviceId);
        const deviceInfoWithTimestamps = {
          ...info,
          firstSeen: existingDevice?.deviceInfo?.firstSeen || new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        };
        
        // Kreiraj ili ažuriraj device sa vlasnik ulogom
        await saveDevice(user.id, {
          deviceId: currentDeviceId,
          deviceName: `${info.browser} on ${info.os}`,
          deviceInfo: deviceInfoWithTimestamps,
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
        });
        
        console.log("RoleContext - Device kreiran/ažuriran kao vlasnik za", user.email);
        
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
      const existingDevice = await getDeviceByDeviceId(user.id, currentDeviceId);

      if (existingDevice) {
        const data = existingDevice;
        let deviceRole = data.role || null;
        const isBlocked = data.isBlocked === true;
        let status = data.status || (deviceRole === null ? "verifikacija" : "approved");
        let needsVerification = status === "verifikacija";
        
        console.log("RoleContext - Device postoji:", {
          deviceId: currentDeviceId,
          status: status,
          isBlocked: isBlocked,
          needsVerification: needsVerification,
          role: deviceRole
        });
        
        // Ažuriraj informacije o uređaju (ali ne mijenjaj status ako je već postavljen)
        const deviceInfoUpdate = {
          ...info,
          firstSeen: data.deviceInfo?.firstSeen || new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        };
        
        await saveDevice(user.id, {
          deviceId: currentDeviceId,
          deviceName: `${info.browser} on ${info.os}`,
          deviceInfo: deviceInfoUpdate,
        });
        
        // Ponovo pročitaj status nakon ažuriranja (možda je vlasnik odobrio uređaj)
        const updatedDevice = await getDeviceByDeviceId(user.id, currentDeviceId);
        if (updatedDevice) {
          status = updatedDevice.status || status;
          needsVerification = status === "verifikacija";
          deviceRole = updatedDevice.role || deviceRole;
          console.log("RoleContext - Status nakon osvježavanja:", {
            status: status,
            needsVerification: needsVerification,
            role: deviceRole
          });
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
            userId: user.id 
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
        
        // Provjeri da li je korisnik vlasnik (iz user objekta)
        const isOwnerFromUserDoc = user.isOwner === true;
        
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
          const userDevices = await getUserDevices(user.id);
          
          console.log("RoleContext - Provjera drugih uređaja - broj uređaja:", userDevices.length, "deviceId:", currentDeviceId);
          
          // Ako korisnik već ima druge uređaje, novi uređaj zahtijeva verifikaciju
          if (userDevices.length > 0) {
            // Provjeri da li je trenutni uređaj već u listi
            const existingDevice = userDevices.find(d => d.deviceId === currentDeviceId);
            
            if (!existingDevice) {
              // Ako trenutni deviceId nije u listi postojećih, to je novi uređaj
              defaultRole = null;
              status = "verifikacija"; // Novi uređaj zahtijeva verifikaciju
              console.log("RoleContext - Korisnik već ima druge uređaje, novi uređaj zahtijeva verifikaciju");
            } else {
              // Ako je trenutni uređaj već u listi, to znači da je već kreiran (možda iz login stranice)
              console.log("RoleContext - Trenutni uređaj već postoji u bazi, učitavam postojeći status");
              defaultRole = existingDevice.role || null;
              status = existingDevice.status || "verifikacija";
              console.log("RoleContext - Učitavanje postojećeg statusa:", { role: defaultRole, status });
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
        
        // Kreiraj device sa ulogom
        const deviceInfoData = {
          ...info,
          firstSeen: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        };
        
        await saveDevice(user.id, {
          deviceId: currentDeviceId,
          deviceName: `${info.browser} on ${info.os}`,
          deviceInfo: deviceInfoData,
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
          } : undefined,
        });
        
        // Ako je status "verifikacija", blokiraj pristup
        if (status === "verifikacija") {
          setRole(null);
          setPermissions(null);
          console.log("RoleContext - Novi uređaj kreiran sa statusom 'verifikacija', pristup blokiran");
        } else {
          setRole(defaultRole);
          setPermissions(defaultRole === "vlasnik" ? {
            dashboard: true,
            obracun: true,
            arhiva: true,
            cjenovnik: true,
            profit: true,
            profile: true,
            admin: false,
          } : null);
          console.log("RoleContext - Novi uređaj kreiran, uloga:", defaultRole, "status:", status);
        }
      }

      setLoading(false);
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
      const updateData: any = {
        role: newRole,
        status: "approved", // Ako se dodjeljuje uloga, uređaj je automatski odobren
      };
      
      // Ako je konobar, dodaj dozvole
      if (newRole === "konobar" && permissions) {
        updateData.permissions = permissions;
      } else if (newRole === "vlasnik") {
        // Vlasnik ima pristup svemu
        updateData.permissions = {
          dashboard: true,
          obracun: true,
          arhiva: true,
          cjenovnik: true,
          profit: true,
          profile: true,
          admin: false,
        };
      }
      
      // Koristi API endpoint za ažuriranje device-a
      const token = getAuthToken();
      const response = await fetch(`/api/users/${user.id}/devices/${targetDeviceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error('Failed to assign role');
      }
    } catch (err: any) {
      console.error("Greška pri dodjeljivanju uloge:", err);
      throw err;
    }
  };

  // Osveži ulogu
  const refreshRole = async () => {
    await loadRole();
  };

  // TEMPORARY: Disabled loadRole useEffect - comment out to re-enable
  /*
  useEffect(() => {
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
        await loadRole();
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
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [user]);
  */

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

