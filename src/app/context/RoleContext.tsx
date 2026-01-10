"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getCurrentUser, getUserId, getUserDevices, getDeviceByDeviceId, saveDevice, getAuthToken } from "../../lib/api";
import { getOrCreateDeviceId, getDeviceFingerprint } from "../../lib/device-utils";

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
  user: any | null; // User object sa id, email, isOwner, etc.
  role: UserRole;
  deviceId: string | null;
  deviceInfo: DeviceInfo | null;
  permissions: PagePermission | null;
  loading: boolean;
  error: string | null;
  assignRole: (deviceId: string, role: UserRole, permissions?: PagePermission) => Promise<void>;
  refreshRole: () => Promise<void>;
}

export const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [permissions, setPermissions] = useState<PagePermission | null>(null);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [error, setError] = useState<string | null>(null);
  const isApprovedRef = React.useRef<boolean>(false); // Ref za praćenje da li je uređaj odobren

  // Generiši Device ID - koristi UUID pristup (isti kao u login stranici)
  const generateDeviceId = async (): Promise<string> => {
    // Provjeri da li je client-side
    if (typeof window === "undefined" || !navigator || !screen) {
      // Fallback za server-side
      return `server-${Date.now()}`;
    }

    // Koristi isti pristup kao u login stranici - UUID + localStorage
    return getOrCreateDeviceId();
  };

  // Dohvati Device Info - koristi device fingerprint pristup (isti kao u login stranici)
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

    // Koristi isti pristup kao u login stranici - device fingerprint
    const fingerprint = getDeviceFingerprint();

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
      screenSize: fingerprint.screenResolution,
      userAgent: fingerprint.userAgent,
      lastLogin: new Date(),
      firstSeen: null,
    };
  };

  // Učitaj ili kreiraj Device ID - koristi UUID pristup (isti kao u login stranici)
  const initializeDeviceId = async (): Promise<string> => {
    // Koristi isti pristup kao u login stranici - UUID + localStorage
    const newDeviceId = getOrCreateDeviceId();
    
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
    try {
      setLoading(true);
      setError(null);
      
      // Učitaj user iz API-ja
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        setUser(null);
        setRole(null);
        setDeviceId(null);
        setDeviceInfo(null);
        setPermissions(null);
        setLoading(false);
        return;
      }

      // Postavi user state
      setUser(currentUser);
      const user = currentUser; // Koristi lokalnu varijablu za ostatak funkcije

      // Učitaj Device ID
      const currentDeviceId = await initializeDeviceId();
      setDeviceId(currentDeviceId);

      // Dohvati informacije o uređaju
      const info = getDeviceInfo(currentDeviceId);
      setDeviceInfo(info);

      // Provjeri da li postoji uloga za ovaj uređaj
      const existingDevice = await getDeviceByDeviceId(user.id, currentDeviceId);

      if (existingDevice) {
        const data = existingDevice;
        let deviceRole = data.role || null;
        const isBlocked = data.isBlocked === true;
        // Ne koristi fallback logiku - koristi samo status iz baze
        // Ako status nije postavljen ili je null, tretiraj kao "verifikacija"
        let status = data.status;
        if (!status || status === null || status === undefined) {
          status = "verifikacija";
        }
        
        console.log("RoleContext - Device postoji:", {
          deviceId: currentDeviceId,
          status: status,
          isBlocked: isBlocked,
          role: deviceRole
        });
        
          // Ažuriraj informacije o uređaju (ali ne mijenjaj status ako je već postavljen)
        const fingerprint = getDeviceFingerprint();
        const deviceInfoUpdate = {
          ...info,
          timezone: fingerprint.timezone,
          language: fingerprint.language,
          platform: fingerprint.platform,
          fingerprintHash: fingerprint.fingerprintHash,
          firstSeen: data.deviceInfo?.firstSeen || new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        };
        
        // VAŽNO: Ažuriraj deviceInfo i lastLogin, ali NIKAD ne mijenjaj status ili role ako su već postavljeni
        // Ovo osigurava da se status "approved" ne resetuje nakon deploy-a ili refresh-a
        await saveDevice(user.id, {
          deviceId: currentDeviceId,
          deviceName: `${info.browser} on ${info.os}`,
          deviceInfo: deviceInfoUpdate,
          // Eksplicitno zadrži postojeći status i role - ne dozvoli resetovanje
          status: status, // Zadrži postojeći status
          role: deviceRole, // Zadrži postojeći role
        });
          
          // Ponovo pročitaj status nakon ažuriranja (možda je vlasnik odobrio uređaj)
        const updatedDevice = await getDeviceByDeviceId(user.id, currentDeviceId);
        if (updatedDevice) {
          // Koristi status iz baze, bez fallback logike
          status = updatedDevice.status || "verifikacija";
          deviceRole = updatedDevice.role || deviceRole;
            console.log("RoleContext - Status nakon osvježavanja:", {
              status: status,
              role: deviceRole
            });
        }
        
        // Provjeri da li je uređaj blokiran ili zahtijeva verifikaciju
        // BLOKIRAJ pristup ako:
        // 1. Uređaj je blokiran (isBlocked === true)
        // 2. Status nije eksplicitno "approved" (sve dok se ne odobri na prvom uređaju, nema pristupa)
        // Ovo osigurava da korisnik ne može pristupiti aplikaciji dok se ne odobri na prvom uređaju
        if (isBlocked || status !== "approved") {
          // Blokiraj pristup ako je uređaj blokiran ili status nije "approved"
          setRole(null);
          setPermissions(null);
          isApprovedRef.current = false; // Označi da uređaj nije odobren
          console.log("RoleContext - Uređaj blokiran ili status nije odobren:", { 
            isBlocked, 
            status, 
            deviceId: currentDeviceId,
            userId: user.id 
          });
        } else {
          // Status je eksplicitno "approved" - dozvoli pristup
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
          isApprovedRef.current = true; // Označi da je uređaj odobren
          console.log("RoleContext - Uređaj odobren, uloga:", deviceRole, "status:", status);
        }
      } else {
        // Novi uređaj - provjeri da li je ovo prvi uređaj za ovog korisnika
        let defaultRole: UserRole = "vlasnik"; // Po defaultu postavi kao vlasnik
        let status = "approved"; // Prvi uređaj je automatski odobren
        
        // Provjeri da li korisnik već ima druge uređaje (prije kreiranja novog)
        try {
          const userDevices = await getUserDevices(user.id);
          
          console.log("RoleContext - Provjera drugih uređaja - broj uređaja:", userDevices.length, "deviceId:", currentDeviceId);
          
          // Ako korisnik već ima druge uređaje, novi uređaj ZAUVIJEK zahtijeva verifikaciju
          if (userDevices.length > 0) {
            // Provjeri da li je trenutni uređaj već u listi
            const existingDevice = userDevices.find(d => d.deviceId === currentDeviceId);
            
            if (!existingDevice) {
            // Ako trenutni deviceId nije u listi postojećih, to je novi uređaj
              // Novi uređaj ZAUVIJEK zahtijeva verifikaciju - bez obzira na ulogu korisnika
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
            // Prvi uređaj - provjeri da li je korisnik vlasnik svog naloga
            const isOwnerOfAccount = user.isOwner === true;
            if (isOwnerOfAccount) {
              // Prvi uređaj za vlasnika naloga - automatski odobren kao vlasnik
              defaultRole = "vlasnik";
              status = "approved";
              console.log("RoleContext - Prvi uređaj za vlasnika naloga, automatski odobren kao vlasnik");
            } else {
              // Prvi uređaj za korisnika koji nije vlasnik naloga - također automatski odobren (jer je prvi)
              // Ali ne dobija ulogu vlasnika, već konobar ili null
              defaultRole = null; // Ne postavi kao vlasnika ako korisnik nije vlasnik naloga
              status = "approved"; // Ali odobri pristup jer je prvi uređaj
              console.log("RoleContext - Prvi uređaj za korisnika koji nije vlasnik naloga, odobren ali bez uloge vlasnika");
            }
          }
        } catch (queryError: any) {
          // Ako query ne uspije zbog permisija ili indexa, postavi na verifikaciju (sigurnije)
          console.warn("Greška pri provjeri drugih uređaja:", queryError);
          defaultRole = null;
          status = "verifikacija";
        }
        
        // Kreiraj device sa ulogom
        const fingerprint = getDeviceFingerprint();
        const deviceInfoData = {
          ...info,
          timezone: fingerprint.timezone,
          language: fingerprint.language,
          platform: fingerprint.platform,
          fingerprintHash: fingerprint.fingerprintHash,
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
          isApprovedRef.current = false; // Označi da uređaj nije odobren
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
          isApprovedRef.current = (status === "approved"); // Označi da li je uređaj odobren
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

  // Učitaj role pri inicijalizaciji i kada se user promijeni
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | undefined;
    let intervalId: NodeJS.Timeout | undefined;
    let isMounted = true;
    
    const load = async () => {
      // Timeout fallback - ako se učitavanje ne završi za 8 sekundi, postavi loading na false
      timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn("RoleContext - Timeout pri učitavanju role, postavljam loading na false");
          setLoading(false);
        }
      }, 8000);
      
      try {
        await loadRole();
        if (timeoutId && isMounted) {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        console.error("RoleContext - Greška pri učitavanju role:", error);
        if (isMounted) {
          setLoading(false);
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    };
    
    load();
    
    // Periodička provjera statusa uređaja svakih 30 sekundi (samo ako nije već odobren)
    // Ovo osigurava da se provjera statusa izvršava i nakon refresh-a, ali samo ako je potrebno
    intervalId = setInterval(() => {
      if (isMounted && user && deviceId && !isApprovedRef.current) {
        // Provjeri status samo ako uređaj NIJE odobren (koristi ref umjesto state za tačnost)
        // Ako je uređaj već odobren, ne treba provjeravati status (štedi resurse i sprečava resetovanje)
        console.log("RoleContext - Periodička provjera statusa uređaja (uređaj nije odobren)");
        loadRole().catch((error) => {
          console.error("RoleContext - Greška pri periodičkoj provjeri statusa:", error);
        });
      }
    }, 30000); // Provjeri svakih 30 sekundi (samo ako nije odobren)

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []); // Run only once on mount

  return (
    <RoleContext.Provider
      value={{
        user,
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

