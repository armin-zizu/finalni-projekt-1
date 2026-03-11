"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
// TODO: Uklonjen Firebase import - implementirati API pozive
import { useAppName } from "../context/AppNameContext";
import { useSubscription } from "../context/SubscriptionContext";
import { useRole, UserRole, PagePermission } from "../context/RoleContext";
import { useCjenovnik } from "../context/CjenovnikContext";
import { useRouter, useSearchParams } from "next/navigation";
import jsPDF from "jspdf";
import { updateCurrentUser, logout, getUserDevices, updateDevice, deleteDevice, saveDevice, getObracuni, getCjenovnik, getAuthToken } from "../../lib/api";
// TEMPORARY: Disabled Firebase imports for development - using mocks
// import { db } from "../../lib/firestore";
// TODO: Uklonjen Firebase import - implementirati API pozive
import { FaSearch, FaSpinner, FaMobile, FaDesktop } from "react-icons/fa";
import dynamic from "next/dynamic";

// Dynamic import za chat komponente
const SupportChatButton = dynamic(() => import("../components/SupportChatButton"), { ssr: false });
const SupportChatWindow = dynamic(() => import("../components/SupportChatWindow"), { ssr: false });

// Firebase imports removed - using API calls instead

const containerStyle: React.CSSProperties = {
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "24px",
  fontFamily: "'Inter', sans-serif",
  boxSizing: "border-box",
  width: "100%",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: "800px",
  borderCollapse: "separate" as "separate",
  borderSpacing: 0,
  background: "#ffffff",
  borderRadius: "8px",
  overflow: "hidden",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
  marginBottom: "20px",
};

const tableWrapperStyle: React.CSSProperties = {
  width: "100%",
  overflowX: "auto",
  marginBottom: "20px",
  WebkitOverflowScrolling: "touch",
};

// Koristimo className za bolju kompatibilnost sa CSS media queries
const tableWrapperClassName = "table-wrapper-scroll";

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

const inputStyle: React.CSSProperties = {
  padding: "8px",
  border: "1px solid #e5e7eb",
  borderRadius: "6px",
  fontSize: "14px",
  marginRight: "8px",
  width: "200px",
};

const ULAZ_UNLOCK_PIN_STORAGE_KEY = "obracunUlazUnlockPin";
const DEFAULT_ULAZ_UNLOCK_PIN = "1234";

export default function Profile() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const { appName, setAppName } = useAppName();
  const [localAppName, setLocalAppName] = useState(appName); // Lokalni state za input
  const [isAppNameDirty, setIsAppNameDirty] = useState(false);
  const [isEditingAppName, setIsEditingAppName] = useState(false);
  const [isSavingAppName, setIsSavingAppName] = useState(false);
  // Sessions removed - use devices instead
  const [isAppNameUpdated, setIsAppNameUpdated] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string | null>(null);
  const [backupFromDate, setBackupFromDate] = useState("");
  const [backupToDate, setBackupToDate] = useState("");
  const [showBackupFilters, setShowBackupFilters] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const { subscription, loading: subscriptionLoading, addPayment, refreshSubscription } = useSubscription();
  
  // Osvježi subscription podatke kada se otvori profil stranica i svakih 30 sekundi
  const refreshSubscriptionRef = React.useRef(refreshSubscription);
  useEffect(() => {
    refreshSubscriptionRef.current = refreshSubscription;
  }, [refreshSubscription]);

  useEffect(() => {
    // Osvježi odmah
    if (refreshSubscriptionRef.current) {
      refreshSubscriptionRef.current();
    }
    
    // Osvježavaj svakih 30 sekundi da bi korisnik vidio ažurirane podatke
    const interval = setInterval(() => {
      if (refreshSubscriptionRef.current) {
        refreshSubscriptionRef.current();
      }
    }, 30000); // 30 sekundi
    
    return () => clearInterval(interval);
  }, []); // Run only once on mount
  const [newPaymentAmount, setNewPaymentAmount] = useState("");
  const [newPaymentNote, setNewPaymentNote] = useState("");
  const [subscriptionMessage, setSubscriptionMessage] = useState("");
  
  // Debug logovanje za subscription
  useEffect(() => {
    console.log("Profile - Subscription state:", {
      subscriptionLoading,
      subscription: subscription ? {
        isActive: subscription.isActive,
        isTrial: subscription.isTrial,
        isPremium: subscription.isPremium,
        isGracePeriod: subscription.isGracePeriod,
        daysRemaining: subscription.daysRemaining,
        daysUntilExpiry: subscription.daysUntilExpiry,
        daysInGrace: subscription.daysInGrace,
      } : null,
      hasSubscription: !!subscription
    });
  }, [subscription, subscriptionLoading]);
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [paymentRequested, setPaymentRequested] = useState(false);
  const [requestingPayment, setRequestingPayment] = useState(false);
  const { role, assignRole: assignRoleFromContext, user, refreshRole } = useRole();
  
  // Provjeri da li je admin korisnik
  const isAdmin = user?.email?.toLowerCase() === (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "gitara.zizu@gmail.com").toLowerCase();
  const [devices, setDevices] = useState<any[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [deviceBusyMap, setDeviceBusyMap] = useState<Record<string, boolean>>({});
  const [isOwner, setIsOwner] = useState(false);
  const canManageDeviceRoles = isOwner === true;
  const [loginApprovals, setLoginApprovals] = useState<any[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<PagePermission>({});
  const [selectedRole, setSelectedRole] = useState<Record<string, UserRole>>({});
  const [deviceNames, setDeviceNames] = useState<Record<string, string>>({});
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const [ulazPinCurrent, setUlazPinCurrent] = useState("");
  const [ulazPinNew, setUlazPinNew] = useState("");
  const [ulazPinConfirm, setUlazPinConfirm] = useState("");
  const [ulazPinMessage, setUlazPinMessage] = useState("");
  
  // Detektuj mobilnu verziju
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Uklonjeno lokalno keširanje PIN-a

  const editingBoxRef = useRef<HTMLTableCellElement | null>(null);
  const [arhivaCount, setArhivaCount] = useState<number>(0);
  const [loadingArhivaCount, setLoadingArhivaCount] = useState<boolean>(false);
  const { cjenovnik } = useCjenovnik();
  const router = useRouter();

  const getDeviceActionKey = (deviceOrId: any): string | null => {
    if (!deviceOrId) return null;
    if (typeof deviceOrId === 'string') return deviceOrId;
    return deviceOrId.deviceId || deviceOrId.id || null;
  };

  const setDeviceBusy = (deviceOrId: any, busy: boolean) => {
    const key = getDeviceActionKey(deviceOrId);
    if (!key) return;
    setDeviceBusyMap((prev) => ({
      ...prev,
      [key]: busy,
    }));
  };

  const isDeviceBusy = (deviceOrId: any): boolean => {
    const key = getDeviceActionKey(deviceOrId);
    if (!key) return false;
    return deviceBusyMap[key] === true;
  };

  // Sinhronizuj localAppName sa appName iz contexta
  useEffect(() => {
    if (!isAppNameDirty) {
      setLocalAppName(appName);
    }
  }, [appName, isAppNameDirty]);

  // Učitaj paymentRequested status
  useEffect(() => {
    if (subscription?.paymentPendingVerification) {
      setPaymentRequested(true);
    } else {
      setPaymentRequested(false);
    }
  }, [subscription]);

  // Set email from user context
  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user]);

  // Scroll na editing box kada se otvori (samo na mobilnom)
  useEffect(() => {
    if (editingDeviceId && editingBoxRef.current) {
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
      if (isMobile) {
        // Kratak delay da se DOM ažurira
        setTimeout(() => {
          const element = editingBoxRef.current;
          if (element) {
            // Scrolluj tabelu wrapper na lijevo (scrollTo left: 0) da bi editing box bio vidljiv
            const tableWrapper = element.closest('.table-wrapper-scroll');
            if (tableWrapper) {
              tableWrapper.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
              element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'start' });
            }
          }
        }, 150);
      }
    }
  }, [editingDeviceId]);


  const handleChangePassword = async () => {
    // TODO: Implement password reset via API
    setMessage("Promjena lozinke trenutno nije dostupna. Kontaktirajte administratora.");
      setTimeout(() => setMessage(""), 5000);
  };

  const showUlazPinFeedback = (text: string) => {
    setUlazPinMessage(text);
    setTimeout(() => setUlazPinMessage(""), 5000);
  };

  // Uklonjeno postavljanje PIN-a, ostaje samo promjena
  // Funkcija za postavljanje nove šifre za ulaz (samo ako nema postojeće)
  const handleSetUlazPin = () => {
    const newPin = ulazPinNew.trim();
    const confirmPin = ulazPinConfirm.trim();
    if (newPin.length !== 4) {
      showUlazPinFeedback("Nova šifra mora imati tačno 4 znaka.");
      return;
    }
    if (newPin !== confirmPin) {
      showUlazPinFeedback("Potvrda šifre se ne poklapa.");
      return;
    }
    const token = getAuthToken();
    fetch('/api/users/me/pin', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ newPin }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          showUlazPinFeedback(data.error || 'Greška pri postavljanju šifre.');
          return;
        }
        setUlazPinNew("");
        setUlazPinConfirm("");
        showUlazPinFeedback("Šifra za ulaz je uspješno postavljena.");
      })
      .catch(() => {
        showUlazPinFeedback("Greška pri postavljanju šifre.");
      });
  };
  const handleChangeUlazPin = () => {
    const currentPin = ulazPinCurrent.trim();
    const newPin = ulazPinNew.trim();
    const confirmPin = ulazPinConfirm.trim();

    if (currentPin.length !== 4) {
      showUlazPinFeedback("Trenutna šifra mora imati tačno 4 znaka.");
      return;
    }
    if (newPin.length !== 4) {
      showUlazPinFeedback("Nova šifra mora imati tačno 4 znaka.");
      return;
    }
    if (newPin !== confirmPin) {
      showUlazPinFeedback("Potvrda šifre se ne poklapa.");
      return;
    }
    if (newPin === currentPin) {
      showUlazPinFeedback("Nova šifra mora biti drugačija od trenutne.");
      return;
    }
    const token = getAuthToken();
    fetch('/api/users/me/pin', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ newPin }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          showUlazPinFeedback(data.error || 'Greška pri promjeni šifre.');
          return;
        }
        setUlazPinCurrent("");
        setUlazPinNew("");
        setUlazPinConfirm("");
        showUlazPinFeedback("Šifra za Uredi ulaz je uspješno promijenjena.");
      })
      .catch(() => showUlazPinFeedback('Greška pri komunikaciji sa serverom.'));
  };

  const handleSaveAppName = async () => {
    if (isSavingAppName) return;

    const normalizedAppName = localAppName.trim();

    if (normalizedAppName === "") {
      setMessage("Unesite ime aplikacije!");
      return;
    }

    // Provjeri da li je ime promijenjeno
    if (normalizedAppName === appName) {
      setMessage("Ime aplikacije nije promijenjeno!");
      return;
    }

    // Potvrdi prije spremanja
    const confirmed = window.confirm(
      `Jeste li sigurni da želite promijeniti ime aplikacije na "${normalizedAppName}"?\n\n` +
      `Ova promjena će se automatski primijeniti na svim vašim uređajima.`
    );

    if (!confirmed) {
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setMessage("Morate biti prijavljeni!");
      return;
    }

    try {
      setIsSavingAppName(true);
      // Spremi preko API-ja
      const updatedUser = await updateCurrentUser({ appName: normalizedAppName });
      const finalAppName = updatedUser?.appName || normalizedAppName;
      
      // Ažuriraj context
      setAppName(finalAppName);
      setLocalAppName(finalAppName);
      setIsAppNameDirty(false);
      setIsEditingAppName(false);

      // Obavijesti druge tabove/stranice (npr. admin panel) da je appName ažuriran
      const appNameUpdatedPayload = {
        appName: finalAppName,
        at: Date.now(),
      };
      window.dispatchEvent(new CustomEvent('app-name-updated', { detail: appNameUpdatedPayload }));
      localStorage.setItem('app-name-updated', JSON.stringify(appNameUpdatedPayload));
      
      setIsAppNameUpdated(true);
      // Formatiraj datum samo na klijentu da izbjegnemo hydration mismatch
      if (typeof window !== 'undefined') {
      setLastUpdatedTime(new Date().toLocaleString("bs-BA", { 
        day: "2-digit", 
        month: "2-digit", 
        year: "numeric", 
        hour: "2-digit", 
        minute: "2-digit" 
      }));
      }
      setMessage("Ime aplikacije uspješno spremljeno i sinkronizovano na svim uređajima!");
      // Sakrij poruku nakon 5 sekundi
      setTimeout(() => {
        setIsAppNameUpdated(false);
        setMessage("");
      }, 5000);
    } catch (error: any) {
      console.error("Greška pri spremanju imena aplikacije:", error);
      setMessage("Greška pri spremanju imena aplikacije: " + (error.message || "Nepoznata greška"));
      setTimeout(() => setMessage(""), 5000);
    } finally {
      setIsSavingAppName(false);
    }
  };

  const handleStartEditAppName = () => {
    setLocalAppName(appName);
    setIsAppNameDirty(false);
    setIsAppNameUpdated(false);
    setIsEditingAppName(true);
  };

  const handleCancelEditAppName = () => {
    setLocalAppName(appName);
    setIsAppNameDirty(false);
    setIsEditingAppName(false);
    setIsAppNameUpdated(false);
    setMessage("");
  };

  // Učitaj uređaje za trenutnog korisnika
  const loadDevices = async () => {
    if (!user?.id) return;

    try {
      setLoadingDevices(true);
      const devicesList = await getUserDevices(user.id);
      
      // Transformiraj format za kompatibilnost
      const transformedDevices = devicesList.map((device: any) => ({
        id: device.id,
        ...device,
        deviceId: device.deviceId,
        // Backend koristi status "pending"; UI koristi label "verifikacija"
        status:
          device.status === "pending"
            ? "verifikacija"
            : (device.status || (device.role === null ? "verifikacija" : "approved")),
        // null/undefined u bazi ne smije automatski značiti blocked
        isBlocked: device.isBlocked === true,
        deviceName: device.deviceName || "",
          deviceInfo: {
          ...device.deviceInfo,
          firstSeen: device.deviceInfo?.firstSeen ? new Date(device.deviceInfo.firstSeen) : null,
          lastLogin: device.deviceInfo?.lastLogin ? new Date(device.deviceInfo.lastLogin) : null,
        },
        lastLogin: device.lastLogin ? new Date(device.lastLogin) : null,
        assignedAt: device.createdAt ? new Date(device.createdAt) : null,
      }));
      
      // Filtriraj duplikate po deviceId - zadrži samo najnoviji zapis
      const deviceMap = new Map<string, any>();
      transformedDevices.forEach((device: any) => {
        const deviceId = device.deviceId;
        if (!deviceId) {
          // Ako nema deviceId, dodaj ga (vjerovatno greška u podacima)
          deviceMap.set(device.id, device);
          return;
        }
        
        const existing = deviceMap.get(deviceId);
        if (!existing) {
          deviceMap.set(deviceId, device);
        } else {
          // Uporedi datume - zadrži onaj sa novijim lastLogin ili createdAt
          const existingDate = existing.lastLogin || existing.deviceInfo?.lastLogin || existing.assignedAt || new Date(0);
          const currentDate = device.lastLogin || device.deviceInfo?.lastLogin || device.assignedAt || new Date(0);
          
          if (currentDate > existingDate) {
            // Trenutni uređaj ima noviji datum, zamijeni postojeći
            deviceMap.set(deviceId, device);
          }
          // Inače zadrži postojeći (existing)
        }
      });
      
      // Konvertuj Map nazad u array
      const uniqueDevices = Array.from(deviceMap.values());
      
      // Sortiraj po posljednjoj prijavi (najnoviji prvo)
      uniqueDevices.sort((a, b) => {
        const aDate = a.lastLogin || a.deviceInfo?.lastLogin || a.assignedAt || new Date(0);
        const bDate = b.lastLogin || b.deviceInfo?.lastLogin || b.assignedAt || new Date(0);
        return bDate.getTime() - aDate.getTime();
      });
      
      setDevices(uniqueDevices);
    } catch (error) {
      console.error("Greška pri učitavanju uređaja:", error);
    } finally {
      setLoadingDevices(false);
    }
  };

  // Dodijeli ulogu uređaju
  // device može biti device objekat ili deviceId string (za backward compatibility)
  const handleAssignRole = async (deviceOrId: any, newRole: UserRole, permissions?: PagePermission) => {
    if (!user?.id || !isOwner) return;

    // Ako je prosleđen objekat, uzmi deviceId, inače koristi prosleđeni string
    const deviceId = typeof deviceOrId === 'string' ? deviceOrId : (deviceOrId.deviceId || deviceOrId.id);

    if (isDeviceBusy(deviceOrId)) return;

    try {
      setDeviceBusy(deviceOrId, true);
      await updateDevice(user.id, deviceId, {
        role: newRole || null,
        permissions: permissions || {},
        status: newRole ? 'approved' : 'pending',
      });
      await assignRoleFromContext(deviceId, newRole, permissions);
      await loadDevices();
      setEditingDeviceId(null);
      setEditingPermissions({});
      setMessage("Uloga uspješno dodijeljena uređaju");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Greška pri dodjeljivanju uloge:", error);
      setMessage("Greška pri dodjeljivanju uloge");
      setTimeout(() => setMessage(""), 5000);
    } finally {
      setDeviceBusy(deviceOrId, false);
    }
  };

  // Otvori modal za uređivanje dozvola
  const handleEditPermissions = (device: any) => {
    setEditingDeviceId(device.id);
    setEditingPermissions(device.permissions || {});
  };

  // Spremi dozvole
  const handleSavePermissions = async (deviceOrId: any, deviceRole: UserRole) => {
    await handleAssignRole(deviceOrId, deviceRole, editingPermissions);
  };

  // Odobri novi uređaj - omogući vlasniku da bira ulogu
  // device može biti device objekat ili deviceId string (za backward compatibility)
  const handleApproveDevice = async (deviceOrId: any, preferredRole: UserRole = "konobar") => {
    if (!user?.id || !isOwner) return;

    // Ako je prosleđen objekat, uzmi deviceId, inače koristi prosleđeni string
    const deviceId = typeof deviceOrId === 'string' ? deviceOrId : (deviceOrId.deviceId || deviceOrId.id);

    if (isDeviceBusy(deviceOrId)) return;

    try {
      setDeviceBusy(deviceOrId, true);
      
      // Ako vlasnik želi postaviti kao vlasnika, dozvoli to
      const deviceRole: UserRole = preferredRole || "konobar";
      
      // Default dozvole za konobara (sve osim admina)
      const defaultPermissions: PagePermission = deviceRole === "vlasnik" ? {
        dashboard: true,
        obracun: true,
        arhiva: true,
        cjenovnik: true,
        profit: true,
        profile: true,
        admin: true,
      } : {
        // Za konobara - default dozvole (može se promijeniti kasnije kroz "Uredi")
        dashboard: true,
        obracun: true,
        arhiva: true,
        cjenovnik: true,
        profit: true,
        profile: true,
        admin: false,
      };
      
      await updateDevice(user.id, deviceId, {
          role: deviceRole,
          status: "approved",
          isBlocked: false,
          permissions: defaultPermissions,
      });
      await loadDevices();

      const verifiedDevices = await getUserDevices(user.id);
      const verifiedDevice = verifiedDevices.find((d: any) => d.deviceId === deviceId || d.id === deviceId);
      if (!verifiedDevice || verifiedDevice.status !== 'approved') {
        throw new Error('Promjena nije potvrđena u bazi. Pokušaj ponovo.');
      }

      setMessage(`Uređaj uspješno odobren kao ${deviceRole === "vlasnik" ? "vlasnik" : "konobar"}`);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Greška pri odobravanju uređaja:", error);
      const errorMessage = error instanceof Error ? error.message : "Nepoznata greška";
      setMessage(`Greška pri odobravanju uređaja: ${errorMessage}`);
      setTimeout(() => setMessage(""), 5000);
    } finally {
      setDeviceBusy(deviceOrId, false);
    }
  };

  // Blokiraj/odblokiraj uređaj
  // device može biti device objekat ili deviceId string (za backward compatibility)
  const handleToggleBlockDevice = async (deviceOrId: any, currentBlocked: boolean) => {
    if (!user?.id || !isOwner) return;

    // Ako je prosleđen objekat, uzmi deviceId, inače koristi prosleđeni string
    const deviceId = typeof deviceOrId === 'string' ? deviceOrId : (deviceOrId.deviceId || deviceOrId.id);

    if (isDeviceBusy(deviceOrId)) return;

    try {
      setDeviceBusy(deviceOrId, true);
      await updateDevice(user.id, deviceId, {
          isBlocked: !currentBlocked,
        status: !currentBlocked ? 'blocked' : 'approved',
      });
      await loadDevices();
      setMessage(`Uređaj ${!currentBlocked ? "blokiran" : "odblokiran"}`);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Greška pri blokiranju/odblokiranju uređaja:", error);
      setMessage("Greška pri blokiranju/odblokiranju uređaja");
      setTimeout(() => setMessage(""), 5000);
    } finally {
      setDeviceBusy(deviceOrId, false);
    }
  };

  // Izbriši uređaj (login)
  const handleDeleteDevice = async (device: any) => {
    console.log("handleDeleteDevice pozvan sa device:", device);
    
    if (!user?.id) {
      console.error("Greška: user.id nije pronađen");
      setMessage("Greška: Korisnik nije pronađen. Pokušajte ponovo.");
      setTimeout(() => setMessage(""), 5000);
      return;
    }
    
    if (!isOwner) {
      console.error("Greška: Korisnik nije vlasnik");
      setMessage("Greška: Samo vlasnik može brisati uređaje.");
      setTimeout(() => setMessage(""), 5000);
      return;
    }

    // API endpoint očekuje deviceId (fingerprint ID), ne id (primary key iz baze)
    // deviceId je fingerprint ID koji se koristi u WHERE device_id = $2
    const deviceIdToDelete = device.deviceId;
    
    console.log("deviceIdToDelete:", deviceIdToDelete, "device objekat:", {
      id: device.id,
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      fullDevice: device
    });
    
    if (!deviceIdToDelete) {
      console.error("Greška: deviceId (fingerprint) nije pronađen za uređaj:", device);
      setMessage("Greška: Device ID nije pronađen. Pokušajte ponovo.");
      setTimeout(() => setMessage(""), 5000);
      return;
    }

    if (isDeviceBusy(device)) return;

    try {
      setDeviceBusy(device, true);
      console.log("Pokušavam da obrišem uređaj:", { 
        userId: user.id, 
        deviceId: deviceIdToDelete, 
        deviceDbId: device.id,
        deviceName: device.deviceName
      });
      
      const result = await deleteDevice(user.id, deviceIdToDelete);
      console.log("Uređaj uspješno obrisan, rezultat:", result);
      
      // Zatvori editing box
      setEditingDeviceId(null);
      setEditingPermissions({});
      setSelectedRole({ ...selectedRole, [device.id]: undefined as any });
      setDeviceNames({ ...deviceNames, [device.id]: undefined as any });
      
      // Osveži listu uređaja
      await loadDevices();
      
      setMessage("Login uspješno izbrisan");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Greška pri brisanju login-a - detalji:", {
        error,
        message: error instanceof Error ? error.message : 'Nepoznata greška',
        stack: error instanceof Error ? error.stack : undefined,
        userId: user.id,
        deviceId: deviceIdToDelete
      });
      const errorMessage = error instanceof Error ? error.message : 'Nepoznata greška';
      setMessage(`Greška pri brisanju login-a: ${errorMessage}`);
      setTimeout(() => setMessage(""), 5000);
    } finally {
      setDeviceBusy(device, false);
    }
  };

  // Spremi ime uređaja
  // device može biti device objekat ili deviceId string (za backward compatibility)
  const handleSaveDeviceName = async (deviceOrId: any, deviceName: string) => {
    if (!user?.id || !isOwner) return;

    // Ako je prosleđen objekat, uzmi deviceId, inače koristi prosleđeni string
    const deviceId = typeof deviceOrId === 'string' ? deviceOrId : (deviceOrId.deviceId || deviceOrId.id);

    if (isDeviceBusy(deviceOrId)) return;

    try {
      setDeviceBusy(deviceOrId, true);
      await updateDevice(user.id, deviceId, {
          deviceName: deviceName.trim() || "",
      });
      await loadDevices();
      setMessage("Ime uređaja uspješno spremljeno");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Greška pri spremanju imena uređaja:", error);
      setMessage("Greška pri spremanju imena uređaja");
      setTimeout(() => setMessage(""), 5000);
    } finally {
      setDeviceBusy(deviceOrId, false);
    }
  };

  // Provjeri da li je korisnik vlasnik - koristi user.isOwner iz RoleContext
  useEffect(() => {
    if (user) {
      setIsOwner(user.isOwner === true);
      console.log("Profile - Provjera vlasnika:", { email: user.email, isOwner: user.isOwner, role: role });
        } else {
          setIsOwner(false);
        }
  }, [user, role]);

  // Učitaj zahtjeve za odobrenje (samo za vlasnika)
  // TEMPORARY: Disabled - loginApprovals tabela nije kreirana, koristi se device management
  const loadLoginApprovals = async () => {
    if (!isOwner) return;
    
    try {
      setLoadingApprovals(true);
      // TODO: Migrirati na API kada se implementira loginApprovals tabela
      // Za sada vraćamo praznu listu jer device management se već koristi
      setLoginApprovals([]);
    } catch (error: any) {
      console.warn("Login approvals trenutno nisu podržani:", error);
      setLoginApprovals([]);
    } finally {
      setLoadingApprovals(false);
    }
  };

  // Odobri zahtjev
  // TEMPORARY: Disabled - koristi se device management umjesto loginApprovals
  const approveLoginRequest = async (approvalId: string) => {
    if (!isOwner) return;
    // TODO: Migrirati na API kada se implementira loginApprovals tabela
    setMessage("Login approvals trenutno nisu podržani. Koristi device management za odobravanje uređaja.");
      setTimeout(() => setMessage(""), 5000);
  };

  // Odbij zahtjev
  // TEMPORARY: Disabled - koristi se device management umjesto loginApprovals
  const rejectLoginRequest = async (approvalId: string) => {
    if (!isOwner) return;
    // TODO: Migrirati na API kada se implementira loginApprovals tabela
    setMessage("Login approvals trenutno nisu podržani. Koristi device management za odobravanje uređaja.");
      setTimeout(() => setMessage(""), 5000);
  };

  // Učitaj zahtjeve kada je korisnik vlasnik
  // TEMPORARY: Disabled real-time listener - loginApprovals trenutno nisu podržani
  useEffect(() => {
    if (isOwner) {
      loadLoginApprovals();
      // TODO: Dodati real-time listener kada se implementira loginApprovals API
    }
  }, [isOwner]);

  // Učitaj uređaje kada je korisnik vlasnik
  useEffect(() => {
    if (isOwner) {
      loadDevices();
    }
  }, [isOwner]);

  // Učitaj broj obračuna iz arhive
  const loadArhivaCount = async () => {
    if (!user?.id) return;

    try {
      setLoadingArhivaCount(true);
      const obracuni = await getObracuni(user.id);
      // Filter out drafts - count only final obracuni
      const finalObracuni = obracuni.filter((ob: any) => !ob.isDraft);
      setArhivaCount(finalObracuni.length);
    } catch (error) {
      console.error("Greška pri učitavanju broja obračuna:", error);
      setArhivaCount(0);
    } finally {
      setLoadingArhivaCount(false);
    }
  };

  // Učitaj broj obračuna kada se komponenta učita
  useEffect(() => {
    if (user?.id) {
      loadArhivaCount();
    }
  }, [user?.id]);


  // Sessions functionality removed - use devices instead


  const handleLogout = async () => {
    try {
      await logout();
      console.log("Uspješna odjava");
      // Očisti role state
      await refreshRole(); // Ovo će postaviti role na null jer nema tokena
      // Preusmjeri na login
      router.push("/login");
      // Force refresh da se osigura da je sve očišćeno
      setTimeout(() => {
        window.location.href = "/login";
      }, 100);
    } catch (err: any) {
      console.error("Greška pri odjavi:", err);
      // Ipak preusmjeri na login čak i ako logout API call ne uspije
      router.push("/login");
      setTimeout(() => {
        window.location.href = "/login";
      }, 100);
    }
  };

  // Dinamički container style sa smanjenim padding-om na mobilnom
  const dynamicContainerStyle: React.CSSProperties = {
    ...containerStyle,
    padding: isMobile ? "4px" : "24px",
  };

  return (
    <div style={dynamicContainerStyle}>
      <style jsx>{`
        button:hover {
          background-color: #2563eb;
        }
        .delete-btn {
          background-color: #dc2626;
        }
        .delete-btn:hover {
          background-color: #b91c1c;
        }
        @media (max-width: 768px) {
          .table-wrapper-scroll {
            width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          .table-wrapper-scroll table {
            min-width: 800px;
          }
          div[style*='maxWidth: 1200px'] { padding: 10px; }
          h1 { font-size: 20px; margin-bottom: 16px !important; }
          h2 { font-size: 16px; margin-bottom: 12px !important; }
          h3 { font-size: 14px; margin-bottom: 8px !important; }
          table { font-size: 12px; overflow-x: auto; display: block; }
          th, td { padding: 8px !important; font-size: 12px !important; min-width: 100px; }
          button { width: 100%; margin: 4px 0; padding: 10px; font-size: 14px; min-height: 44px; }
          input { width: 100%; margin: 4px 0; padding: 8px; font-size: 14px; min-height: 44px; }
          div[style*='display: flex'] { flex-direction: column; gap: 8px; }
          div[style*='gap: 8px'] { gap: 8px !important; }
          div[style*='padding: 16px'] { padding: 12px !important; }
          div[style*='padding: 40px'] { padding: 20px !important; }
          /* Forma za uređivanje uređaja - centriranje i mobilna prilagodba */
          td[colspan="7"] {
            width: 100% !important;
            max-width: 100% !important;
            padding: 8px !important;
            box-sizing: border-box !important;
          }
          td[colspan="7"] > div {
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          /* Forma za uređivanje */
          div[style*="flexDirection: column"][style*="gap: 16px"] {
            width: 100% !important;
            max-width: 100% !important;
            padding: 8px !important;
            box-sizing: border-box !important;
          }
          /* Select i input elementi */
          select, input[type="text"] {
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          /* Spriječi automatsko zumiranje na input poljima - iOS Safari zumira ako je font-size < 16px */
          input[type="text"],
          input[type="number"],
          input[type="tel"],
          input[type="email"],
          input[type="date"],
          input[type="time"],
          input[type="datetime-local"],
          textarea,
          select {
            font-size: 16px !important;
          }
          /* Div sa dozvolama */
          div[style*="flexDirection: column"][style*="gap: 12px"][style*="padding: 16px"] {
            padding: 10px !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          /* Checkbox label-ovi */
          label[style*="display: flex"] {
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          /* Button container */
          div[style*="display: flex"][style*="gap: 12px"][style*="width: 100%"] {
            flex-direction: column !important;
            width: 100% !important;
          }
          div[style*="display: flex"][style*="gap: 12px"][style*="width: 100%"] button {
            width: 100% !important;
            flex: 1 1 100% !important;
          }
          /* Container za uređivanje */
          div[style*="marginBottom: 32px"][style*="border: 2px"] {
            width: 100% !important;
            max-width: 100% !important;
            padding: 10px !important;
            box-sizing: border-box !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
          /* Osiguraj da tabela wrapper ne prelazi širinu */
          .table-wrapper-scroll {
            width: 100% !important;
            max-width: 100vw !important;
            overflow-x: auto !important;
            box-sizing: border-box !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
            padding: 0 !important;
          }
          /* Forma za uređivanje - osiguraj da ne prelazi širinu ekrana */
          td[colspan] {
            position: relative !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            padding: 6px !important;
          }
          /* Zaključaj horizontalni scroll kada je editing box otvoren na mobilnom */
          .table-wrapper-scroll:has(.editing-device-box) {
            scroll-behavior: smooth !important;
            overflow-x: hidden !important;
            position: relative !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          /* Blokiraj scroll na body i html dok je editing box otvoren */
          body:has(.editing-device-box),
          html:has(.editing-device-box) {
            overflow-x: hidden !important;
            width: 100% !important;
          }
          /* Osiguraj da editing box bude unutar viewport-a na mobilnom */
          .editing-device-box {
            scroll-margin: 0 !important;
            position: relative !important;
            width: 100% !important;
            max-width: 100% !important;
            left: 0 !important;
            right: 0 !important;
            margin: 0 !important;
            padding: 6px !important;
            box-sizing: border-box !important;
            display: block !important;
          }
          /* Osiguraj da tabela ne prelazi viewport kada je editing box otvoren */
          .table-wrapper-scroll:has(.editing-device-box) table {
            width: 100% !important;
            max-width: 100% !important;
            min-width: auto !important;
          }
          /* Osiguraj da parent container ne omogućava scroll */
          div[style*="maxWidth: 1200px"]:has(.editing-device-box) {
            overflow-x: hidden !important;
            width: 100% !important;
            max-width: 100% !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
          /* Osiguraj da tr element ne prelazi viewport */
          tr:has(.editing-device-box) {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          /* Osiguraj da editing box cell preuzme punu širinu */
          tr:has(.editing-device-box) td {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          /* Editing box - smanji padding i gap na mobilnom */
          .editing-device-box > div {
            gap: 6px !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          .editing-device-box h4 {
            font-size: 13px !important;
            margin-bottom: 4px !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
          .editing-device-box > div > div {
            padding: 6px !important;
            gap: 6px !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          .editing-device-box label {
            font-size: 12px !important;
            margin-bottom: 3px !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          .editing-device-box select,
          .editing-device-box input[type="text"] {
            padding: 5px 8px !important;
            font-size: 12px !important;
            min-height: 30px !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          .editing-device-box button {
            padding: 6px 10px !important;
            font-size: 12px !important;
            min-height: 32px !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          .editing-device-box > div > div > div {
            gap: 4px !important;
            padding: 6px !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          .editing-device-box > div > div > div > label {
            padding: 3px !important;
            min-height: 28px !important;
            font-size: 11px !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          .editing-device-box > div > div > div > label > input[type="checkbox"] {
            width: 16px !important;
            height: 16px !important;
            min-width: 16px !important;
            min-height: 16px !important;
          }
          .editing-device-box > div > div > div > div {
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            gap: 4px !important;
          }
          .editing-device-box > div > div > div > div > button {
            width: 100% !important;
            flex: 1 1 100% !important;
            box-sizing: border-box !important;
          }

          .ulaz-pin-section {
            width: 100% !important;
            max-width: 560px !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
          }

          .ulaz-pin-fields,
          .ulaz-pin-actions {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            width: 100% !important;
            gap: 8px !important;
          }

          .ulaz-pin-fields input,
          .ulaz-pin-actions button {
            width: 100% !important;
            max-width: 320px !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>

      <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#1f2937", marginBottom: "24px" }}>
        Moj Profil
      </h1>

      <div style={{ marginBottom: "32px", border: "2px solid #e5e7eb", borderRadius: "12px", padding: "16px", background: "#f9fafb" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "16px" }}>
          Promijeni ime aplikacije
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          <input
            type="text"
            value={localAppName}
            readOnly={!isEditingAppName || isSavingAppName}
            disabled={!isEditingAppName || isSavingAppName}
            onChange={(e) => {
              setLocalAppName(e.target.value);
              setIsAppNameDirty(true);
              setIsAppNameUpdated(false);
            }}
            style={{
              ...inputStyle,
              opacity: !isEditingAppName || isSavingAppName ? 0.7 : 1,
              cursor: !isEditingAppName || isSavingAppName ? "not-allowed" : "text",
              backgroundColor: !isEditingAppName || isSavingAppName ? "#f3f4f6" : "white",
            }}
            placeholder="Unesite ime aplikacije"
          />
          {!isEditingAppName ? (
            <button style={buttonStyle} onClick={handleStartEditAppName}>
              Uredi ime
            </button>
          ) : (
            <>
              <button
                style={{
                  ...buttonStyle,
                  background: (!isAppNameDirty || isSavingAppName) ? "#9ca3af" : "#3b82f6",
                  cursor: (!isAppNameDirty || isSavingAppName) ? "not-allowed" : "pointer",
                }}
                onClick={handleSaveAppName}
                disabled={!isAppNameDirty || isSavingAppName}
              >
                {isSavingAppName ? "Spremanje..." : "Sačuvaj"}
              </button>
              <button
                style={{ ...buttonStyle, background: "#6b7280" }}
                onClick={handleCancelEditAppName}
                disabled={isSavingAppName}
              >
                Odustani
              </button>
            </>
          )}
          {isAppNameUpdated && (
            <span style={{ 
              color: "#16a34a", 
              fontSize: "14px", 
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}>
              ✓ Ažurirano {typeof window !== 'undefined' && lastUpdatedTime && `(${lastUpdatedTime})`}
            </span>
          )}
        </div>
        {message && <p style={{ color: message.includes("Greška") ? "#dc2626" : "#15803d", marginTop: "8px" }}>{message}</p>}
        <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "8px" }}>
          Trenutno ime aplikacije: <strong>{appName}</strong>
        </p>
      </div>


      {/* Upravljanje uređajima - samo za vlasnika */}
      {canManageDeviceRoles && (
        <div style={{ marginBottom: "32px", border: "2px solid #e5e7eb", borderRadius: "12px", padding: "16px", background: "#f9fafb" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "16px" }}>
            📱 Upravljanje Uređajima
          </h2>
          <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "20px" }}>
            Upravljajte uređajima, dodijelite uloge i dozvole. Novi uređaji zahtijevaju odobrenje prije pristupa.
          </p>


          {/* Tabela sa uređajima */}
          {loadingDevices ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "40px" }}>
              <FaSpinner style={{ fontSize: "32px", color: "#3b82f6", animation: "spin 1s linear infinite" }} />
            </div>
          ) : devices.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
              <FaMobile style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.5 }} />
              <p style={{ fontSize: "16px" }}>Nema uređaja.</p>
              <p style={{ fontSize: "14px", marginTop: "8px" }}>Uređaji će se automatski pojaviti kada se korisnici prijave.</p>
            </div>
          ) : isMobile ? (
            // Mobilna verzija - Card layout
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {devices.map((device) => {
                    const roleColors: Record<string, { bg: string; color: string }> = {
                      vlasnik: { bg: "#dbeafe", color: "#2563eb" },
                      konobar: { bg: "#dcfce7", color: "#16a34a" },
                      verifikacija: { bg: "#fef3c7", color: "#f59e0b" },
                    };

                    const deviceStatus = device.status || (device.role === null ? "verifikacija" : null);
                    const isBlocked = device.isBlocked === true;
                    const needsVerification = deviceStatus === "verifikacija";
                    const deviceBusy = isDeviceBusy(device);
                    const roleColor = device.role ? roleColors[device.role] || { bg: "#f3f4f6", color: "#6b7280" } : 
                                      needsVerification ? roleColors.verifikacija : { bg: "#f3f4f6", color: "#6b7280" };

                    return (
                      <div
                        key={device.id}
                        style={{
                          background: "#fff",
                          borderRadius: "8px",
                          padding: "12px",
                          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                          position: "relative",
                        }}
                      >
                        {/* Ime uređaja - puna širina */}
                        <div style={{ 
                          marginBottom: "12px",
                          fontSize: "16px",
                          fontWeight: 600,
                          color: device.deviceName ? "#1f2937" : "#9ca3af"
                        }}>
                          {device.deviceName || "Nema imena"}
                        </div>

                        {/* Grid sa po 2 polja u redu */}
                        <div style={{ 
                          display: "grid", 
                          gridTemplateColumns: "1fr 1fr", 
                          gap: "12px",
                          marginBottom: "8px"
                        }}>
                          {/* Uređaj tip */}
                          <div>
                            <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>
                              Uređaj
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", fontWeight: 500, color: "#1f2937" }}>
                              {device.deviceInfo?.os === "Android" || device.deviceInfo?.os === "iOS" ? (
                                <FaMobile style={{ fontSize: "14px", color: "#6b7280" }} />
                              ) : (
                                <FaDesktop style={{ fontSize: "14px", color: "#6b7280" }} />
                              )}
                              <span>{device.deviceInfo?.screenSize || "N/A"}</span>
                            </div>
                          </div>

                          {/* Browser / OS */}
                          <div>
                            <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>
                              Browser / OS
                            </div>
                            <div style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937" }}>
                              {device.deviceInfo?.browser || "N/A"} / {device.deviceInfo?.os || "N/A"}
                            </div>
                          </div>

                          {/* Status */}
                          <div>
                            <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>
                              Status
                            </div>
                            <div>
                              {needsVerification ? (
                                <span
                                  style={{
                                    padding: "4px 12px",
                                    borderRadius: "12px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    backgroundColor: "#fef3c7",
                                    color: "#f59e0b",
                                    display: "inline-block",
                                  }}
                                >
                                  Verifikacija
                                </span>
                              ) : isBlocked ? (
                                <span
                                  style={{
                                    padding: "4px 12px",
                                    borderRadius: "12px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    backgroundColor: "#fee2e2",
                                    color: "#dc2626",
                                    display: "inline-block",
                                  }}
                                >
                                  Blokiran
                                </span>
                              ) : (
                                <span
                                  style={{
                                    padding: "4px 12px",
                                    borderRadius: "12px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    backgroundColor: "#dcfce7",
                                    color: "#16a34a",
                                    display: "inline-block",
                                  }}
                                >
                                  Aktivan
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Uloga */}
                          <div>
                            <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>
                              Uloga
                            </div>
                            <div>
                              <span
                                style={{
                                  padding: "4px 12px",
                                  borderRadius: "12px",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  backgroundColor: roleColor.bg,
                                  color: roleColor.color,
                                  display: "inline-block",
                                }}
                              >
                                {device.role || "Nedodijeljena"}
                              </span>
                            </div>
                          </div>

                          {/* Posljednja prijava */}
                          <div style={{ gridColumn: "1 / -1" }}>
                            <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>
                              Posljednja prijava
                            </div>
                            <div style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937" }}>
                              {device.lastLogin
                                ? device.lastLogin.toLocaleDateString("bs-BA") + " " + device.lastLogin.toLocaleTimeString("bs-BA", { hour: "2-digit", minute: "2-digit" })
                                : "N/A"}
                            </div>
                          </div>
                        </div>

                        {/* Akcije - donji dio */}
                        <div style={{ 
                          display: "flex", 
                          flexDirection: "column",
                          gap: "8px",
                          marginTop: "12px",
                          paddingTop: "12px",
                          borderTop: "1px solid #f3f4f6"
                        }}>
                          {needsVerification ? (
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                              <button
                                onClick={() => handleApproveDevice(device, "konobar")}
                                disabled={deviceBusy}
                                style={{ ...buttonStyle, background: deviceBusy ? "#9ca3af" : "#16a34a", fontSize: "12px", padding: "8px 12px", flex: "1", minWidth: "120px", cursor: deviceBusy ? "not-allowed" : "pointer" }}
                              >
                                {deviceBusy ? "Obrada..." : "✓ Odobri (Konobar)"}
                              </button>
                              {isOwner && (
                                <button
                                  onClick={() => {
                                    if (window.confirm("Jeste li sigurni da želite odobriti ovaj uređaj kao VLASNIK? Vlasnik ima pun pristup svemu.")) {
                                      handleApproveDevice(device, "vlasnik");
                                    }
                                  }}
                                  disabled={deviceBusy}
                                  style={{ ...buttonStyle, background: deviceBusy ? "#9ca3af" : "#2563eb", fontSize: "12px", padding: "8px 12px", flex: "1", minWidth: "120px", cursor: deviceBusy ? "not-allowed" : "pointer" }}
                                >
                                  {deviceBusy ? "Obrada..." : "✓ Odobri (Vlasnik)"}
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!canManageDeviceRoles) return;
                                setSelectedDevice(device);
                                setShowDeviceModal(true);
                                if (device.deviceName) {
                                  setDeviceNames({ ...deviceNames, [device.id]: device.deviceName });
                                }
                                setSelectedRole({ ...selectedRole, [device.id]: device.role || null });
                                setEditingPermissions(device.permissions || {});
                              }}
                              style={{ 
                                ...buttonStyle, 
                                fontSize: "13px", 
                                padding: "8px 16px",
                                width: "100%",
                                justifyContent: "center"
                              }}
                            >
                              Uredi
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleBlockDevice(device, isBlocked);
                            }}
                            disabled={deviceBusy || needsVerification}
                            style={{
                              ...buttonStyle,
                              background: isBlocked ? "#16a34a" : "#dc2626",
                              fontSize: "13px",
                              padding: "8px 16px",
                              width: "100%",
                              justifyContent: "center",
                              opacity: (deviceBusy || needsVerification) ? 0.5 : 1,
                              cursor: (deviceBusy || needsVerification) ? "not-allowed" : "pointer",
                            }}
                          >
                            {isBlocked ? "Odblokiraj" : "Blokiraj"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
            </div>
          ) : (
            // Desktop verzija - Tabela
            <div style={tableWrapperStyle} className={tableWrapperClassName}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Ime uređaja</th>
                    <th style={thStyle}>Uređaj</th>
                    <th style={thStyle}>Browser / OS</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Uloga</th>
                    <th style={thStyle}>Posljednja prijava</th>
                    <th style={thStyle}>Akcije</th>
                    <th style={thStyle}>Blokiraj</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Prikaži uređaje */}
                  {devices.map((device) => {
                    const roleColors: Record<string, { bg: string; color: string }> = {
                      vlasnik: { bg: "#dbeafe", color: "#2563eb" },
                      konobar: { bg: "#dcfce7", color: "#16a34a" },
                      verifikacija: { bg: "#fef3c7", color: "#f59e0b" },
                    };

                    const deviceStatus = device.status || (device.role === null ? "verifikacija" : null);
                    const isBlocked = device.isBlocked === true;
                    const needsVerification = deviceStatus === "verifikacija";
                    const deviceBusy = isDeviceBusy(device);
                    const roleColor = device.role ? roleColors[device.role] || { bg: "#f3f4f6", color: "#6b7280" } : 
                                      needsVerification ? roleColors.verifikacija : { bg: "#f3f4f6", color: "#6b7280" };
                    const isEditing = editingDeviceId === device.id;

                    return (
                      <React.Fragment key={device.id}>
                        <tr>
                        <td style={tdStyle}>
                            <span style={{ fontWeight: device.deviceName ? 500 : 400, color: device.deviceName ? "#1f2937" : "#9ca3af" }}>
                              {device.deviceName || "Nema imena"}
                            </span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {device.deviceInfo?.os === "Android" || device.deviceInfo?.os === "iOS" ? (
                              <FaMobile style={{ fontSize: "16px", color: "#6b7280" }} />
                            ) : (
                              <FaDesktop style={{ fontSize: "16px", color: "#6b7280" }} />
                            )}
                            <span>{device.deviceInfo?.screenSize || "N/A"}</span>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          {device.deviceInfo?.browser || "N/A"} / {device.deviceInfo?.os || "N/A"}
                        </td>
                        <td style={tdStyle}>
                          {needsVerification ? (
                            <span
                              style={{
                                padding: "4px 12px",
                                borderRadius: "12px",
                                fontSize: "12px",
                                fontWeight: 600,
                                backgroundColor: "#fef3c7",
                                color: "#f59e0b",
                              }}
                            >
                              Verifikacija
                            </span>
                          ) : isBlocked ? (
                            <span
                              style={{
                                padding: "4px 12px",
                                borderRadius: "12px",
                                fontSize: "12px",
                                fontWeight: 600,
                                backgroundColor: "#fee2e2",
                                color: "#dc2626",
                              }}
                            >
                              Blokiran
                            </span>
                          ) : (
                            <span
                              style={{
                                padding: "4px 12px",
                                borderRadius: "12px",
                                fontSize: "12px",
                                fontWeight: 600,
                                backgroundColor: "#dcfce7",
                                color: "#16a34a",
                              }}
                            >
                              Aktivan
                            </span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              padding: "4px 12px",
                              borderRadius: "12px",
                              fontSize: "12px",
                              fontWeight: 600,
                              backgroundColor: roleColor.bg,
                              color: roleColor.color,
                            }}
                          >
                            {device.role || "Nedodijeljena"}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {device.lastLogin
                            ? device.lastLogin.toLocaleDateString("bs-BA") + " " + device.lastLogin.toLocaleTimeString("bs-BA", { hour: "2-digit", minute: "2-digit" })
                            : "N/A"}
                        </td>
                        <td style={tdStyle}>
                          {needsVerification ? (
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            <button
                                onClick={() => handleApproveDevice(device, "konobar")}
                                style={{ ...buttonStyle, background: "#16a34a", fontSize: "12px", padding: "6px 12px" }}
                                title="Odobri kao konobar"
                            >
                                ✓ Odobri (Konobar)
                            </button>
                              {isOwner && (
                            <button
                              onClick={() => {
                                    if (window.confirm("Jeste li sigurni da želite odobriti ovaj uređaj kao VLASNIK? Vlasnik ima pun pristup svemu.")) {
                                      handleApproveDevice(device, "vlasnik");
                                    }
                                  }}
                                  style={{ ...buttonStyle, background: "#2563eb", fontSize: "12px", padding: "6px 12px" }}
                                  title="Odobri kao vlasnik (pun pristup)"
                                >
                                  ✓ Odobri (Vlasnik)
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!canManageDeviceRoles) return;
                                setSelectedDevice(device);
                                setShowDeviceModal(true);
                                if (device.deviceName) {
                                  setDeviceNames({ ...deviceNames, [device.id]: device.deviceName });
                                }
                                setSelectedRole({ ...selectedRole, [device.id]: device.role || null });
                                setEditingPermissions(device.permissions || {});
                              }}
                              style={{ 
                                ...buttonStyle, 
                                fontSize: "12px", 
                                padding: "4px 8px",
                                cursor: "pointer",
                                transition: "background-color 0.2s"
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.backgroundColor = "#2563eb";
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.backgroundColor = buttonStyle.background as string;
                              }}
                            >
                              Uredi
                            </button>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleBlockDevice(device, isBlocked);
                            }}
                            disabled={deviceBusy || needsVerification}
                            style={{
                              ...buttonStyle,
                              background: isBlocked ? "#16a34a" : "#dc2626",
                              fontSize: "12px",
                              padding: "4px 8px",
                              opacity: (deviceBusy || needsVerification) ? 0.5 : 1,
                              cursor: (deviceBusy || needsVerification) ? "not-allowed" : "pointer",
                            }}
                          >
                            {isBlocked ? "Odblokiraj" : "Blokiraj"}
                          </button>
                        </td>
                      </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: "16px", padding: "12px", background: "#e0f2fe", borderRadius: "8px", border: "1px solid #0ea5e9" }}>
            <p style={{ fontSize: "12px", color: "#0c4a6e", margin: 0 }}>
              <strong>💡 Napomena:</strong> Vlasnik ima pristup svemu. Konobar može pristupiti samo stranicama koje su mu dozvoljene. Novi uređaji zahtijevaju odobrenje prije pristupa. Blokirani uređaji ne mogu se prijaviti dok se ne odblokiraju.
            </p>
          </div>
        </div>
      )}


      <div style={{ marginBottom: "32px", border: "2px solid #e5e7eb", borderRadius: "12px", padding: "16px", background: "#f9fafb" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "16px" }}>
          Statistika korištenja
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(auto-fit, minmax(200px, 1fr))", gap: isMobile ? "10px" : "16px" }}>
          <div style={{ padding: isMobile ? "12px" : "16px", background: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
            <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Ukupno obračuna</p>
            <p style={{ fontSize: "24px", fontWeight: 600, color: "#1f2937" }}>
              {loadingArhivaCount ? (
                <span style={{ fontSize: "16px", color: "#6b7280" }}>Učitavanje...</span>
              ) : (
                arhivaCount
              )}
            </p>
          </div>
          <div style={{ padding: isMobile ? "12px" : "16px", background: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
            <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Artikala u cjenovniku</p>
            <p style={{ fontSize: "24px", fontWeight: 600, color: "#1f2937" }}>
              {cjenovnik.length}
            </p>
          </div>
          <div style={{ padding: isMobile ? "12px" : "16px", background: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
            <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Aktivnih sesija</p>
            <p style={{ fontSize: "24px", fontWeight: 600, color: "#1f2937" }}>
              {devices.filter(d => (d.role === "vlasnik" || d.role === "konobar") && d.status === "approved" && !d.isBlocked).length}
            </p>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: "32px", border: "2px solid #e5e7eb", borderRadius: "12px", padding: "24px", background: "#f9fafb" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "20px", textAlign: "center" }}>
          📥 Backup i export
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
            <button
              onClick={() => setShowBackupFilters(!showBackupFilters)}
              style={{ 
                ...buttonStyle, 
                background: showBackupFilters ? "#6b7280" : "#3b82f6", 
                width: "auto",
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              {showBackupFilters ? "✖️ Sakrij filtere" : "📅 Odaberi period za backup"}
            </button>
          </div>
          
          {showBackupFilters && (
            <div style={{ 
              padding: "20px", 
              background: "#fff", 
              borderRadius: "8px", 
              border: "1px solid #e5e7eb", 
              display: "flex", 
              flexDirection: "column", 
              gap: "16px",
              width: "100%",
              maxWidth: "500px"
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937" }}>Od datuma:</label>
                <input
                  type="date"
                  value={backupFromDate}
                  onChange={(e) => setBackupFromDate(e.target.value)}
                  style={{ 
                    ...inputStyle, 
                    width: "100%",
                    padding: "10px",
                    fontSize: "14px"
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937" }}>Do datuma:</label>
                <input
                  type="date"
                  value={backupToDate}
                  onChange={(e) => setBackupToDate(e.target.value)}
                  style={{ 
                    ...inputStyle, 
                    width: "100%",
                    padding: "10px",
                    fontSize: "14px"
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <button
                  onClick={() => {
                    setBackupFromDate("");
                    setBackupToDate("");
                  }}
                  style={{ ...buttonStyle, background: "#6b7280", width: "auto", padding: "10px 20px" }}
                >
                  🔄 Resetuj filtere
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center", width: "100%" }}>
            <button
            onClick={async () => {
              if (!user?.id) {
                alert("Niste prijavljeni!");
                return;
              }
              
              // Učitaj iz API-ja
              let arhiva: any[] = [];
              let cjenovnik: any[] = [];
              
              try {
                // Učitaj arhivu - filter out drafts
                const obracuni = await getObracuni(user.id);
                arhiva = obracuni.filter((ob: any) => !ob.isDraft);
                
                // Učitaj cjenovnik
                cjenovnik = await getCjenovnik(user.id);
              } catch (error) {
                console.error("Greška pri učitavanju podataka za backup:", error);
                alert("Greška pri učitavanju podataka za backup.");
                return;
              }
              
              // Filtriraj arhivu po datumu ako su odabrani datumi
              if (backupFromDate || backupToDate) {
                arhiva = arhiva.filter((item: any) => {
                  const itemDate = new Date(item.datum.split(".").reverse().join("-"));
                  const fromDate = backupFromDate ? new Date(backupFromDate) : null;
                  const toDate = backupToDate ? new Date(backupToDate) : null;
                  
                  if (fromDate && toDate) {
                    return itemDate >= fromDate && itemDate <= toDate;
                  } else if (fromDate) {
                    return itemDate >= fromDate;
                  } else if (toDate) {
                    return itemDate <= toDate;
                  }
                  return true;
                });
              }
              
              // Generiši PDF
              const doc = new jsPDF();
              
              // Funkcija za pravilno ispisivanje teksta sa UTF-8 karakterima (č, ć, đ, š, ž)
              // jsPDF standardno ne podržava UTF-8 karaktere u default fontu
              // Koristimo jednostavan workaround: zamjenjujemo karaktere sa ASCII ekvivalentima
              // ili koristimo doc.text() direktno jer jsPDF 3.x bi trebao podržavati UTF-8
              const addText = (text: string, x: number, y: number, options?: any) => {
                if (text && typeof text === 'string') {
                  // Provjerimo da li tekst sadrži UTF-8 karaktere sa kvakicama
                  const hasSpecialChars = /[čćđšžČĆĐŠŽ]/.test(text);
                  
                  if (hasSpecialChars) {
                    // Za UTF-8 karaktere, koristimo doc.text() direktno
                    // jsPDF 3.x bi trebao podržavati UTF-8, ali možda treba eksplicitno postaviti encoding
                    try {
                      // Pokušajmo sa standardnim text() metodom
                      // Ako ne radi, možemo koristiti HTML metodu ili dodati font
                      doc.text(text, x, y, options || {});
                    } catch (error) {
                      // Fallback: zamjenjujemo karaktere sa ASCII ekvivalentima
                      console.warn("Greška pri ispisu teksta sa UTF-8 karakterima, koristim ASCII ekvivalente:", error);
                      const asciiText = text
                        .replace(/č/g, 'c').replace(/ć/g, 'c')
                        .replace(/đ/g, 'd').replace(/š/g, 's').replace(/ž/g, 'z')
                        .replace(/Č/g, 'C').replace(/Ć/g, 'C')
                        .replace(/Đ/g, 'D').replace(/Š/g, 'S').replace(/Ž/g, 'Z');
                      doc.text(asciiText, x, y, options || {});
                    }
                  } else {
                    // Standardni tekst bez UTF-8 karaktera
                    doc.text(text, x, y, options || {});
                  }
                } else {
                  doc.text(String(text || ''), x, y, options || {});
                }
              };
              
              let yPos = 20;
              
              // Naslov
              doc.setFontSize(18);
              addText("Backup podataka", 14, yPos);
              yPos += 10;
              
              // Datum exporta
              doc.setFontSize(12);
              addText(`Datum exporta: ${new Date().toLocaleString("bs-BA")}`, 14, yPos);
              yPos += 8;
              
              if (backupFromDate || backupToDate) {
                addText(`Period: ${backupFromDate || "početak"} - ${backupToDate || "kraj"}`, 14, yPos);
                yPos += 8;
              }
              
              yPos += 5;
              
              // Cjenovnik
              doc.setFontSize(14);
              addText("Cjenovnik", 14, yPos);
              yPos += 8;
              
              doc.setFontSize(10);
              if (cjenovnik.length > 0) {
                addText("Naziv | Cijena | Nabavna cijena | Početno stanje", 14, yPos);
                yPos += 6;
                cjenovnik.forEach((item: any) => {
                  if (yPos > 280) {
                    doc.addPage();
                    yPos = 20;
                  }
                  const text = `${item.naziv} | ${item.cijena} KM | ${item.nabavnaCijena} KM | ${item.pocetnoStanje}`;
                  addText(text, 14, yPos);
                  yPos += 6;
                });
              } else {
                addText("Nema artikala u cjenovniku", 14, yPos);
                yPos += 6;
              }
              
              yPos += 5;
              
              // Arhiva
              doc.setFontSize(14);
              if (yPos > 280) {
                doc.addPage();
                yPos = 20;
              }
              addText(`Arhiva obračuna (${arhiva.length} obračuna)`, 14, yPos);
              yPos += 8;
              
              doc.setFontSize(10);
              if (arhiva.length > 0) {
                arhiva.forEach((item: any, index: number) => {
                  // Svaki obračun počinje na novoj stranici
                  if (index > 0 || yPos > 250) {
                    doc.addPage();
                    yPos = 20;
                  }
                  
                  // Naslov obračuna
                  doc.setFontSize(14);
                  addText(`Obračun - ${item.datum}`, 14, yPos);
                  yPos += 8;
                  
                  // Flagovi (ako postoje)
                  if (item.imaUlaz) {
                    doc.setFontSize(10);
                    doc.setTextColor(234, 179, 8); // Žuta
                    addText("(Ima ulaz)", 14, yPos);
                    doc.setTextColor(0, 0, 0); // Crna
                    yPos += 6;
                  } else if (item.isAzuriran) {
                    doc.setFontSize(10);
                    doc.setTextColor(245, 158, 11); // Narandžasta
                    addText("(Ažurirano)", 14, yPos);
                    doc.setTextColor(0, 0, 0); // Crna
                    yPos += 6;
                  }
                  
                  // Tabela artikala
                  doc.setFontSize(12);
                  addText("Artikli:", 14, yPos);
                  yPos += 7;
                  
                  if (item.artikli && item.artikli.length > 0) {
                    // Header tabele
                    doc.setFontSize(9);
                    const startX = 14;
                    const colWidths = [50, 25, 25, 25, 25, 25, 25, 30];
                    const headers = ["Naziv", "Cijena", "Poč. st.", "Ulaz", "Ukupno", "Utroš.", "Kraj. st.", "Vrijednost"];
                    
                    // Header
                    let xPos = startX;
                    headers.forEach((header, i) => {
                      addText(header, xPos, yPos);
                      xPos += colWidths[i];
                    });
                    yPos += 6;
                    
                    // Linija ispod headera
                    doc.line(14, yPos - 2, 200, yPos - 2);
                    yPos += 4;
                    
                    // Artikli
                    item.artikli.forEach((art: any, artIndex: number) => {
                      // Ako ne staje na trenutnu stranicu, pređi na novu i ponovi header
                      if (yPos > 270) {
                        doc.addPage();
                        yPos = 20;
                        // Ponovi naslov obračuna na novoj stranici
                        doc.setFontSize(14);
                        addText(`Obračun - ${item.datum} (nastavak)`, 14, yPos);
                        yPos += 8;
                        doc.setFontSize(12);
                        addText("Artikli:", 14, yPos);
                        yPos += 7;
                        // Ponovi header tabele
                        doc.setFontSize(9);
                        xPos = startX;
                        headers.forEach((header, i) => {
                          addText(header, xPos, yPos);
                          xPos += colWidths[i];
                        });
                        yPos += 6;
                        doc.line(14, yPos - 2, 200, yPos - 2);
                        yPos += 4;
                      }
                      
                      xPos = startX;
                      const ulaz = art.sačuvanUlaz ?? art.ulaz ?? 0;
                      const pocetnoStanje = art.staroPocetnoStanje !== undefined && art.staroPocetnoStanje !== art.pocetnoStanje
                        ? `${art.pocetnoStanje} (${art.staroPocetnoStanje})`
                        : (art.pocetnoStanje ?? "-");
                      
                      addText(art.naziv.substring(0, 20), xPos, yPos);
                      xPos += colWidths[0];
                      addText((art.cijena ?? 0).toFixed(2), xPos, yPos);
                      xPos += colWidths[1];
                      addText(String(pocetnoStanje), xPos, yPos);
                      xPos += colWidths[2];
                      addText(ulaz > 0 ? ulaz.toFixed(2) : "-", xPos, yPos);
                      xPos += colWidths[3];
                      addText((art.ukupno ?? "-").toString(), xPos, yPos);
                      xPos += colWidths[4];
                      addText((art.utroseno ?? "-").toString(), xPos, yPos);
                      xPos += colWidths[5];
                      addText((art.krajnjeStanje ?? "-").toString(), xPos, yPos);
                      xPos += colWidths[6];
                      addText((art.vrijednostKM ?? 0).toFixed(2) + " KM", xPos, yPos);
                      
                      yPos += 6;
                    });
                  } else {
                    addText("Nema artikala", 14, yPos);
                    yPos += 6;
                  }
                  
                  yPos += 5;
                  
                  // Rashodi
                  if (item.rashodi && item.rashodi.length > 0) {
                    if (yPos > 250) {
                      doc.addPage();
                      yPos = 20;
                    }
                    doc.setFontSize(12);
                    addText("Rashodi:", 14, yPos);
                    yPos += 7;
                    
                    doc.setFontSize(9);
                    addText("Naziv", 14, yPos);
                    addText("Cijena", 80, yPos);
                    addText("Plaćeno", 120, yPos);
                    yPos += 6;
                    doc.line(14, yPos - 2, 200, yPos - 2);
                    yPos += 4;
                    
                    item.rashodi.forEach((r: any) => {
                      if (yPos > 270) {
                        doc.addPage();
                        yPos = 20;
                      }
                      addText(r.naziv, 14, yPos);
                      addText(r.cijena.toFixed(2) + " KM", 80, yPos);
                      addText(r.placeno ? "Da" : "Ne", 120, yPos);
                      yPos += 6;
                    });
                    yPos += 5;
                  }
                  
                  // Prihodi
                  if (item.prihodi && item.prihodi.length > 0) {
                    if (yPos > 250) {
                      doc.addPage();
                      yPos = 20;
                    }
                    doc.setFontSize(12);
                    addText("Prihodi:", 14, yPos);
                    yPos += 7;
                    
                    doc.setFontSize(9);
                    addText("Naziv", 14, yPos);
                    addText("Cijena", 80, yPos);
                    yPos += 6;
                    doc.line(14, yPos - 2, 200, yPos - 2);
                    yPos += 4;
                    
                    item.prihodi.forEach((p: any) => {
                      if (yPos > 270) {
                        doc.addPage();
                        yPos = 20;
                      }
                      addText(p.naziv, 14, yPos);
                      addText(p.cijena.toFixed(2) + " KM", 80, yPos);
                      yPos += 6;
                    });
                    yPos += 5;
                  }
                  
                  // Ukupno
                  if (yPos > 250) {
                    doc.addPage();
                    yPos = 20;
                  }
                  doc.setFontSize(11);
                  addText("Ukupno:", 14, yPos);
                  yPos += 7;
                  
                  doc.setFontSize(10);
                  addText(`Ukupno artikli: ${item.ukupnoArtikli.toFixed(2)} KM`, 20, yPos);
                  yPos += 6;
                  addText(`Ukupno rashod: ${item.ukupnoRashod.toFixed(2)} KM`, 20, yPos);
                  yPos += 6;
                  addText(`Ukupno prihod: ${(item.ukupnoPrihod || 0).toFixed(2)} KM`, 20, yPos);
                  yPos += 6;
                  doc.setFontSize(11);
                  addText(`Neto: ${(item.neto || (item.ukupnoArtikli + (item.ukupnoPrihod || 0) - item.ukupnoRashod)).toFixed(2)} KM`, 20, yPos);
                  
                  yPos += 10;
                  
                  // Ne dodavaj liniju između obračuna jer svaki obračun je na posebnoj stranici
                });
              } else {
                addText("Nema obračuna u arhivi", 14, yPos);
              }
              
              // Preuzmi PDF
              const dateRange = backupFromDate || backupToDate 
                ? `-${backupFromDate || "start"}-${backupToDate || "end"}` 
                : "";
              doc.save(`backup-${new Date().toISOString().split("T")[0]}${dateRange}.pdf`);
              
              setBackupMessage(`Backup uspješno preuzet! (${arhiva.length} obračuna, ${cjenovnik.length} artikala)`);
              setTimeout(() => setBackupMessage(""), 5000);
            }}
            style={{ 
              ...buttonStyle, 
              width: "auto", 
              padding: "12px 24px",
              fontSize: "15px",
              fontWeight: 600,
              background: "#16a34a",
              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
            }}
          >
            📄 Preuzmi backup podataka (PDF)
          </button>
          {backupMessage && (
            <p style={{ 
              fontSize: "14px", 
              color: "#16a34a", 
              marginTop: "8px", 
              fontWeight: 500,
              textAlign: "center",
              padding: "8px 16px",
              background: "#dcfce7",
              borderRadius: "6px",
              border: "1px solid #86efac"
            }}>
              ✓ {backupMessage}
            </p>
          )}
          <p style={{ 
            fontSize: "13px", 
            color: "#6b7280",
            textAlign: "center",
            marginTop: "8px",
            maxWidth: "600px"
          }}>
            {backupFromDate || backupToDate 
              ? `📊 Preuzmite podatke za period: ${backupFromDate || "početak"} - ${backupToDate || "kraj"}`
              : "💾 Preuzmite sve podatke (arhiva i cjenovnik) kao PDF fajl"}
          </p>
          </div>
        </div>
      </div>

      {/* Pretplata sekcija */}
      <div style={{ marginBottom: "32px", border: "2px solid #e5e7eb", borderRadius: "12px", padding: "16px", background: "#f9fafb" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "16px" }}>
          Pretplata
        </h2>
        
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {subscriptionLoading ? (
              <div style={{ padding: "16px", background: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb", textAlign: "center" }}>
                <p style={{ fontSize: "14px", color: "#6b7280" }}>Učitavanje pretplate...</p>
              </div>
            ) : subscription ? (
            <div style={{ padding: "16px", background: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", marginBottom: "16px" }}>
                  Status pretplate
                </h3>
                
                {/* Trenutna pretplata i preostali dani - naglašeno */}
                <div style={{ 
                  padding: "16px", 
                  background: subscription.isTrial ? "#eff6ff" : subscription.isPremium ? "#f0fdf4" : subscription.isGracePeriod ? "#fffbeb" : subscription.isActive ? "#f0fdf4" : "#fef2f2",
                  borderRadius: "8px", 
                  border: `2px solid ${subscription.isTrial ? "#3b82f6" : subscription.isPremium ? "#16a34a" : subscription.isGracePeriod ? "#f59e0b" : subscription.isActive ? "#16a34a" : "#dc2626"}`,
                  marginBottom: "16px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "24px" }}>
                      {subscription.isTrial ? "📅" : subscription.isPremium ? "⭐" : subscription.isGracePeriod ? "⏳" : subscription.isActive ? "✓" : "✗"}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: "18px", fontWeight: 700, color: "#1f2937", margin: 0 }}>
                        {subscription.isTrial ? "Probni period (Trial)" : subscription.isPremium ? "Premium pretplata" : subscription.isGracePeriod ? "Grace period" : subscription.isActive ? "Aktivna pretplata" : "Pretplata istekla"}
                      </p>
                {(() => {
                        // Odredi koji podatak o preostalim danima treba prikazati
                        let daysToShow: number | null = null;
                        
                        if (subscription.isTrial && subscription.daysRemaining !== undefined && subscription.daysRemaining !== null) {
                          daysToShow = subscription.daysRemaining;
                        } else if (subscription.isPremium && subscription.daysUntilExpiry !== undefined && subscription.daysUntilExpiry !== null) {
                          daysToShow = subscription.daysUntilExpiry;
                        } else if (subscription.isGracePeriod && subscription.daysInGrace !== undefined && subscription.daysInGrace !== null) {
                          daysToShow = subscription.daysInGrace;
                        } else if (subscription.isActive && subscription.daysUntilExpiry !== undefined && subscription.daysUntilExpiry !== null) {
                          daysToShow = subscription.daysUntilExpiry;
                        }
                        
                        return daysToShow !== null ? (
                          <p style={{ fontSize: "14px", color: "#6b7280", margin: "4px 0 0 0" }}>
                            Preostalo dana: <strong style={{ color: "#1f2937", fontSize: "16px" }}>{Math.max(0, daysToShow)}</strong>
                          </p>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>
                
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
                  {/* Status badge */}
                  {subscription.isTrial ? (
                    <span style={{
                      padding: "6px 12px",
                      background: "#dbeafe",
                      color: "#1e40af",
                        borderRadius: "6px",
                        fontSize: "14px",
                        fontWeight: 600,
                    }}>
                      📅 Trial period
                    </span>
                  ) : subscription.isPremium ? (
                    <span style={{
                      padding: "6px 12px",
                      background: "#dcfce7",
                      color: "#166534",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}>
                      ⭐ Premium
                    </span>
                  ) : subscription.isGracePeriod ? (
                    <span style={{
                      padding: "6px 12px",
                      background: "#fef3c7",
                      color: "#92400e",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}>
                      ⏳ Grace period
                    </span>
                  ) : subscription.isActive ? (
                    <span style={{
                      padding: "6px 12px",
                      background: "#dcfce7",
                      color: "#166534",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}>
                      ✓ Aktivna
                    </span>
                  ) : (
                    <span style={{
                      padding: "6px 12px",
                      background: "#fee2e2",
                      color: "#991b1b",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}>
                      ✗ Istekla
                    </span>
                  )}
                  
                  {/* Payment pending badge */}
                  {subscription.paymentPendingVerification && (
                    <span style={{
                      padding: "6px 12px",
                      background: "#fef3c7",
                      color: "#92400e",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}>
                      ⏳ Čeka provjeru uplate
                    </span>
                  )}
                  
                  {/* Payment rejected badge */}
                  {subscription.paymentRejected && !subscription.paymentPendingVerification && (
                    <span style={{
                      padding: "6px 12px",
                      background: "#fee2e2",
                      color: "#991b1b",
                      borderRadius: "6px",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}>
                      ✗ Uplata odbijena
                    </span>
                  )}
              </div>
              
              {/* Payment rejected message */}
              {subscription.paymentRejected && !subscription.paymentPendingVerification && (
                <div style={{
                  marginTop: "16px",
                  padding: "16px",
                  background: "#fef2f2",
                  borderRadius: "8px",
                  border: "1px solid #fecaca",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                    <span style={{ fontSize: "20px", lineHeight: "1.2" }}>⚠️</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: "14px", fontWeight: 600, color: "#991b1b", margin: "0 0 8px 0" }}>
                        Vaš zahtjev za uplatu je odbijen
                      </p>
                      <p style={{ fontSize: "13px", color: "#7f1d1d", margin: "0 0 8px 0", lineHeight: "1.5" }}>
                        Molimo vas da provjerite podatke o uplati i kontaktirate administratora ako imate pitanja.
                      </p>
                      {subscription.paymentRejectedAt && (
                        <p style={{ fontSize: "12px", color: "#991b1b", margin: 0, opacity: 0.8 }}>
                          Odbijeno: {new Date(subscription.paymentRejectedAt).toLocaleDateString("bs-BA", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
                {/* Detalji statusa */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "12px" }}>
                  {/* Trial period - prikaži ako je u trial periodu */}
                  {subscription.isTrial && subscription.trialEndDate && (
                    <div style={{ padding: "12px", background: "#f9fafb", borderRadius: "6px" }}>
                      <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Trial period završava:</p>
                      <p style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937" }}>
                        {subscription.trialEndDate.toLocaleDateString("bs-BA")}
                      </p>
                      <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                        Preostalo dana: <strong>{subscription.daysRemaining !== undefined ? subscription.daysRemaining : 0}</strong>
                  </p>
                </div>
                  )}
                  
                  {/* Expiry date - prikaži ako postoji */}
                  {(subscription.expiryDate || (!subscription.isTrial && !subscription.isGracePeriod)) && (
                    <div style={{ padding: "12px", background: "#f9fafb", borderRadius: "6px" }}>
                      <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
                        {subscription.isTrial ? "Pretplata istekne:" : "Pretplata ističe:"}
                      </p>
                      {subscription.expiryDate ? (
                        <>
                          <p style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937" }}>
                            {subscription.expiryDate.toLocaleDateString("bs-BA")}
                          </p>
                          {subscription.daysUntilExpiry !== undefined && (
                            subscription.daysUntilExpiry > 0 ? (
                              <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                                Preostalo dana: <strong>{subscription.daysUntilExpiry}</strong>
                              </p>
                            ) : (
                              <p style={{ fontSize: "12px", color: "#dc2626", marginTop: "4px" }}>
                                <strong>Istekla pretplata</strong>
                              </p>
                            )
                          )}
                        </>
                      ) : (
                        <p style={{ fontSize: "14px", color: "#6b7280" }}>
                          Nije postavljeno
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Grace period - prikaži ako je u grace periodu */}
                  {subscription.isGracePeriod && subscription.graceEndDate && (
                    <div style={{ padding: "12px", background: "#f9fafb", borderRadius: "6px" }}>
                      <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Grace period završava:</p>
                      <p style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937" }}>
                        {subscription.graceEndDate.toLocaleDateString("bs-BA")}
                      </p>
                      <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                        Preostalo dana: <strong>{subscription.daysInGrace !== undefined ? subscription.daysInGrace : 0}</strong>
                      </p>
                    </div>
                  )}
                  
                  {/* Last payment date - prikaži ako postoji */}
                {subscription.lastPaymentDate && (
                    <div style={{ padding: "12px", background: "#f9fafb", borderRadius: "6px" }}>
                      <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Posljednja uplata:</p>
                      <p style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937" }}>
                      {subscription.lastPaymentDate.toLocaleDateString("bs-BA")}
                    </p>
                  </div>
                )}
                
                  {/* Monthly price - uvijek prikaži */}
                  <div style={{ padding: "12px", background: "#f9fafb", borderRadius: "6px" }}>
                    <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Mjesečna cijena:</p>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937" }}>
                      {subscription.monthlyPrice || 12} KM
                    </p>
                  </div>
              </div>
            </div>
            ) : (
              <div style={{ padding: "16px", background: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>
                  Status pretplate
                </h3>
                <p style={{ fontSize: "14px", color: "#6b7280" }}>
                  Pretplata nije učitana. Molimo osvježite stranicu ili kontaktirajte administratora.
                </p>
              </div>
            )}

            {/* Plaćanje pretplate */}
            <div style={{ padding: "16px", background: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>
                Plaćanje pretplate
              </h3>
              <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "16px" }}>
                Odaberite period pretplate i izvršite bankovni transfer. Cijena: 12 KM/mjesec.
              </p>
              
              {/* Odabir perioda */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937", marginBottom: "8px", display: "block" }}>
                  Odaberite period:
                </label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {[1, 2, 3, 6].map((months) => {
                    const totalPrice = 12 * months;
                    return (
                      <button
                        key={months}
                        onClick={() => setSelectedMonths(months)}
                        style={{
                          padding: "12px 20px",
                          border: selectedMonths === months ? "2px solid #16a34a" : "1px solid #e5e7eb",
                          borderRadius: "8px",
                          background: selectedMonths === months ? "#dcfce7" : "#fff",
                          color: selectedMonths === months ? "#16a34a" : "#1f2937",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: selectedMonths === months ? 600 : 500,
                          transition: "all 0.2s",
                        }}
                      >
                        {months} {months === 1 ? "mjesec" : "mjeseci"}
                        <br />
                        <span style={{ fontSize: "12px", opacity: 0.8 }}>{totalPrice} KM</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ukupna cijena */}
              <div style={{ marginBottom: "16px", padding: "12px", background: "#f9fafb", borderRadius: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "14px", color: "#6b7280" }}>Ukupno za plaćanje:</span>
                  <span style={{ fontSize: "20px", fontWeight: 600, color: "#1f2937" }}>
                    {12 * selectedMonths} KM
                  </span>
                </div>
              </div>

              {/* Bank Transfer Instrukcije */}
              <div style={{ padding: "16px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                <h4 style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937", marginBottom: "12px" }}>
                  Instrukcije za bankovni transfer:
                </h4>
                <div style={{ marginBottom: "12px" }}>
                  <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px" }}>Broj računa:</p>
                  <p style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937", fontFamily: "monospace" }}>
                    {process.env.NEXT_PUBLIC_BANK_ACCOUNT || "XXX-XXX-XXXXXXX-XX"}
                  </p>
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px" }}>Reference broj:</p>
                  <p style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937", fontFamily: "monospace" }}>
                    {appName && selectedMonths ? `${appName.toUpperCase().replace(/\s+/g, "-")}-${selectedMonths}` : "N/A"}
                  </p>
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px" }}>Iznos:</p>
                  <p style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937" }}>
                    {12 * selectedMonths} KM
                  </p>
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "4px" }}>Svrha plaćanja:</p>
                  <p style={{ fontSize: "14px", color: "#1f2937" }}>
                    Pretplata - {selectedMonths} {selectedMonths === 1 ? "mjesec" : "mjeseci"}
                  </p>
                </div>
                <div style={{ padding: "12px", background: "#fff3cd", borderRadius: "6px", border: "1px solid #ffc107" }}>
                  <p style={{ fontSize: "12px", color: "#856404", margin: 0 }}>
                    ⚠️ <strong>Važno:</strong> Nakon što izvršite transfer, pretplata će biti aktivirana u roku od 24 sata nakon provjere uplate. 
                    Reference broj je jedinstven - molimo koristite ga prilikom transfera.
                  </p>
                </div>
              </div>

              {/* Dugme "Plaćeno" */}
              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                <button
                  onClick={async () => {
                    if (!user?.id) {
                      setSubscriptionMessage("Greška: Korisnik nije pronađen. Pokušajte ponovo.");
                      setTimeout(() => setSubscriptionMessage(""), 5000);
                      return;
                    }

                    try {
                      setRequestingPayment(true);
                      setSubscriptionMessage("");

                      const amount = 12 * selectedMonths;
                      const referenceNumber = appName && selectedMonths 
                        ? `${appName.toUpperCase().replace(/\s+/g, "-")}-${selectedMonths}` 
                        : null;

                      // Pozovi API endpoint za prijavu uplate
                      const token = getAuthToken();
                      if (!token) {
                        setSubscriptionMessage("Greška: Niste prijavljeni. Molimo osvježite stranicu.");
                        setTimeout(() => setSubscriptionMessage(""), 5000);
                        setRequestingPayment(false);
                        return;
                      }

                      const userIdForApi = user.id || user.email; // Prefer UUID radi konzistentnosti sa admin panelom
                      const response = await fetch(`/api/users/${userIdForApi}/subscription`, {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`,
                        },
                        body: JSON.stringify({
                          subscriptionData: {
                          paymentPendingVerification: true,
                            paymentRequestedAt: new Date().toISOString(),
                            paymentRequestedAmount: amount,
                          paymentRequestedMonths: selectedMonths,
                            paymentReferenceNumber: referenceNumber,
                            paymentRejected: false, // Resetuj flag za odbijenu uplatu kada korisnik pošalje novi zahtjev
                            paymentRejectedAt: null,
                          }
                        })
                      });

                      if (!response.ok) {
                        const errorData = await response.json().catch(() => ({ error: 'Nepoznata greška' }));
                        throw new Error(errorData.error || 'Greška pri prijavi uplate');
                      }

                      // Osveži subscription podatke
                      if (refreshSubscription) {
                        await refreshSubscription();
                      }

                      setPaymentRequested(true);
                      setSubscriptionMessage("Uplata je uspješno prijavljena! Administrator će provjeriti uplatu u roku od 24 sata.");
                      setTimeout(() => setSubscriptionMessage(""), 10000);
                    } catch (error: any) {
                      console.error("Greška pri prijavi uplate:", error);
                      setSubscriptionMessage(`Greška pri prijavi uplate: ${error.message || "Nepoznata greška"}`);
                      setTimeout(() => setSubscriptionMessage(""), 5000);
                    } finally {
                      setRequestingPayment(false);
                    }
                  }}
                  disabled={requestingPayment || paymentRequested}
                  style={{
                    padding: "12px 24px",
                    background: paymentRequested ? "#9ca3af" : "#16a34a",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: requestingPayment || paymentRequested ? "not-allowed" : "pointer",
                    fontSize: "14px",
                    fontWeight: 600,
                    width: "auto",
                    opacity: requestingPayment || paymentRequested ? 0.6 : 1,
                  }}
                >
                  {requestingPayment 
                    ? "Prijavljivanje..." 
                    : paymentRequested
                    ? "✓ Uplata je prijavljena - čeka provjeru"
                    : "✓ Plaćeno - Prijavi uplatu"}
                </button>
                {paymentRequested && (
                  <p style={{ fontSize: "12px", color: "#6b7280", textAlign: "center", margin: 0 }}>
                    Vaša uplata je prijavljena i čeka provjeru od strane administratora.
                  </p>
                )}
              </div>

              {subscriptionMessage && (
                <p
                  style={{
                    fontSize: "14px",
                    color: subscriptionMessage.includes("Greška") ? "#dc2626" : "#16a34a",
                    fontWeight: 500,
                    marginTop: "12px",
                  }}
                >
                  {subscriptionMessage}
                </p>
              )}
            </div>

            {/* Historija uplata */}
            {subscription && subscription.paymentHistory && subscription.paymentHistory.length > 0 && (
              <div style={{ padding: "16px", background: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", marginBottom: "12px" }}>
                  Historija uplata
                </h3>
                <div style={{ ...tableWrapperStyle, maxHeight: "400px", overflowY: "auto" }} className={tableWrapperClassName}>
                  <table style={tableStyle}>
                    <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "#f8fafc" }}>
                      <tr>
                        <th style={thStyle}>Datum uplate</th>
                        <th style={thStyle}>Iznos</th>
                        <th style={thStyle}>Napomena</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscription.paymentHistory
                        .sort((a, b) => b.date.getTime() - a.date.getTime())
                        .map((payment, index) => (
                        <tr key={index}>
                          <td style={tdStyle}>{payment.date.toLocaleDateString("bs-BA")} {payment.date.toLocaleTimeString("bs-BA", { hour: "2-digit", minute: "2-digit" })}</td>
                          <td style={tdStyle}>{payment.amount.toFixed(2)} KM</td>
                          <td style={tdStyle}>{payment.note || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
      </div>


      {/* Stara sekcija - obrisana, spojena gore */}
      {false && role === "vlasnik" && (
        <div style={{ marginBottom: "32px", border: "2px solid #e5e7eb", borderRadius: "12px", padding: "16px", background: "#f9fafb" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "16px" }}>
            📱 Upravljanje Uređajima i Ulogama
          </h2>
          <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "20px" }}>
            Dodijelite uloge uređajima koji koriste vašu aplikaciju. Svaki uređaj automatski dobija jedinstveni ID pri prvoj prijavi.
          </p>


          {loadingDevices ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "40px" }}>
              <FaSpinner style={{ fontSize: "32px", color: "#3b82f6", animation: "spin 1s linear infinite" }} />
            </div>
          ) : devices.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
              <FaMobile style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.5 }} />
              <p style={{ fontSize: "16px" }}>Nema uređaja u bazi podataka.</p>
              <p style={{ fontSize: "14px", marginTop: "8px" }}>Uređaji će se automatski pojaviti kada se korisnici prijave.</p>
            </div>
          ) : (
            <div style={tableWrapperStyle} className={tableWrapperClassName}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Uređaj</th>
                    <th style={thStyle}>Browser / OS</th>
                    <th style={thStyle}>Uloga</th>
                    <th style={thStyle}>Posljednja prijava</th>
                    <th style={thStyle}>Akcije</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => {
                    const roleColors: Record<string, { bg: string; color: string }> = {
                      vlasnik: { bg: "#dbeafe", color: "#2563eb" },
                      konobar: { bg: "#dcfce7", color: "#16a34a" },
                    };

                    const roleColor = device.role ? roleColors[device.role] || { bg: "#fee2e2", color: "#dc2626" } : { bg: "#f3f4f6", color: "#6b7280" };
                    const deviceBusy = isDeviceBusy(device);

                    return (
                      <tr key={device.id}>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {device.deviceInfo?.os === "Android" || device.deviceInfo?.os === "iOS" ? (
                              <FaMobile style={{ fontSize: "16px", color: "#6b7280" }} />
                            ) : (
                              <FaDesktop style={{ fontSize: "16px", color: "#6b7280" }} />
                            )}
                            <span>{device.deviceInfo?.screenSize || "N/A"}</span>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          {device.deviceInfo?.browser || "N/A"} / {device.deviceInfo?.os || "N/A"}
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              padding: "4px 12px",
                              borderRadius: "12px",
                              fontSize: "12px",
                              fontWeight: 600,
                              backgroundColor: roleColor.bg,
                              color: roleColor.color,
                            }}
                          >
                            {device.role || "Nedodijeljena"}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {device.lastLogin
                            ? device.lastLogin.toLocaleDateString("bs-BA") + " " + device.lastLogin.toLocaleTimeString("bs-BA", { hour: "2-digit", minute: "2-digit" })
                            : "N/A"}
                        </td>
                        <td style={tdStyle}>
                          <select
                            value={device.role || ""}
                            onChange={(e) => handleAssignRole(device, e.target.value as UserRole || null)}
                            disabled={deviceBusy}
                            style={{
                              padding: "6px 12px",
                              border: "1px solid #e5e7eb",
                              borderRadius: "6px",
                              fontSize: "14px",
                              backgroundColor: "#fff",
                              color: "#1f2937",
                              cursor: deviceBusy ? "not-allowed" : "pointer",
                            }}
                          >
                            <option value="">Nedodijeljena</option>
                            <option value="vlasnik">Vlasnik</option>
                            <option value="konobar">Konobar</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: "16px", padding: "12px", background: "#e0f2fe", borderRadius: "8px", border: "1px solid #0ea5e9" }}>
            <p style={{ fontSize: "12px", color: "#0c4a6e", margin: 0 }}>
              <strong>💡 Napomena:</strong> Vlasnik ima pristup svemu. Konobar može pristupiti samo stranicama koje su mu dozvoljene.
            </p>
          </div>
        </div>
      )}

      <div style={{ border: "2px solid #e5e7eb", borderRadius: "12px", padding: "16px", background: "#f9fafb", marginBottom: "32px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "16px" }}>
          Detalji naloga
        </h2>
        <div style={tableWrapperStyle} className={tableWrapperClassName}>
        <table style={tableStyle}>
          <tbody>
            <tr>
              <td style={tdStyle}>E-mail:</td>
              <td style={tdStyle}>{email || "N/A"}</td>
            </tr>
            <tr>
              <td style={tdStyle}>Datum registracije:</td>
              <td style={tdStyle}>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString("bs-BA") : "N/A"}</td>
            </tr>
              <tr>
                <td style={tdStyle}>Zadnja prijava:</td>
                <td style={tdStyle}>{user?.lastLogin ? new Date(user.lastLogin).toLocaleString("bs-BA") : "N/A"}</td>
              </tr>
          </tbody>
        </table>
        </div>

        {/* Promjena lozinke i Odjava */}
        <div style={{ 
          marginTop: "24px", 
          paddingTop: "24px", 
          borderTop: "1px solid #e5e7eb",
          backgroundColor: "#fff",
          borderRadius: "12px",
          padding: "20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
            {/* Promjena lozinke */}
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", marginBottom: "8px", textAlign: "center" }}>
            🔒 Promijeni lozinku
          </h3>
            <button 
              style={{ 
                ...buttonStyle, 
                width: "auto",
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: 500,
              }} 
              onClick={handleChangePassword}
            >
              ✉️ Pošalji link za promjenu lozinke
            </button>
            {message && message.includes("lozinke") && (
              <p style={{ 
                color: message.includes("Greška") ? "#dc2626" : "#15803d", 
                marginTop: "8px",
                fontSize: "14px",
                textAlign: "center",
                padding: "8px 16px",
                background: message.includes("Greška") ? "#fee2e2" : "#dcfce7",
                borderRadius: "6px",
                border: `1px solid ${message.includes("Greška") ? "#fca5a5" : "#86efac"}`,
                maxWidth: "500px"
              }}>
                {message.includes("Greška") ? "⚠️ " : "✓ "}
                {message}
              </p>
            )}
            <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px", textAlign: "center" }}>
              Link za promjenu lozinke će biti poslan na vaš e-mail ({email || "N/A"})
            </p>
        </div>

            <div
              className="ulaz-pin-section"
              style={{
              width: "100%",
              maxWidth: "560px",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
              padding: "16px",
              background: "#f8fafc"
            }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", marginBottom: "10px", textAlign: "center" }}>
                🔐 Šifra za Uredi ulaz
              </h3>

              <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "12px", textAlign: "center" }}>
                Status: Promjena šifre omogućena
              </p>

              <div className="ulaz-pin-fields" style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center", marginBottom: "10px" }}>
                <input
                  type="password"
                  value={ulazPinCurrent}
                  onChange={(e) => setUlazPinCurrent(e.target.value)}
                  placeholder="Trenutna šifra (4 znaka)"
                  maxLength={4}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  style={{ ...inputStyle, marginRight: 0, width: "180px" }}
                />
                <input
                  type="password"
                  value={ulazPinNew}
                  onChange={(e) => setUlazPinNew(e.target.value)}
                  placeholder="Nova šifra (4 znaka)"
                  maxLength={4}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  style={{ ...inputStyle, marginRight: 0, width: "180px" }}
                />
                <input
                  type="password"
                  value={ulazPinConfirm}
                  onChange={(e) => {
                    // Only allow numbers
                    const sanitized = e.target.value.replace(/[^0-9]/g, "");
                    setUlazPinConfirm(sanitized);
                  }}
                  placeholder="Potvrdi novu šifru"
                  maxLength={4}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  style={{ ...inputStyle, marginRight: 0, width: "180px" }}
                />
              </div>

              <div className="ulaz-pin-actions" style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  style={{ ...buttonStyle, marginRight: 0 }}
                  onClick={handleSetUlazPin}
                >
                  Postavi šifru
                </button>
                <button
                  style={{ ...buttonStyle, marginRight: 0, background: "#7c3aed" }}
                  onClick={handleChangeUlazPin}
                >
                  Promijeni šifru
                </button>
              </div>

              {ulazPinMessage && (
                <p style={{
                  color: ulazPinMessage.includes("uspješno") ? "#15803d" : "#dc2626",
                  marginTop: "10px",
                  fontSize: "13px",
                  textAlign: "center",
                  padding: "8px 12px",
                  background: ulazPinMessage.includes("uspješno") ? "#dcfce7" : "#fee2e2",
                  borderRadius: "6px",
                  border: `1px solid ${ulazPinMessage.includes("uspješno") ? "#86efac" : "#fca5a5"}`,
                }}>
                  {ulazPinMessage.includes("uspješno") ? "✓ " : "⚠️ "}
                  {ulazPinMessage}
                </p>
              )}
            </div>

            {/* Odvajanje */}
        <div style={{ 
              width: "100%", 
              height: "1px", 
              background: "#e5e7eb", 
              margin: "8px 0" 
            }} />

            {/* Odjava */}
            <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
          <button
            onClick={handleLogout}
            style={{
              ...buttonStyle,
              background: "#dc2626",
              width: "auto",
              padding: "12px 28px",
              fontSize: "15px",
              fontWeight: 600,
              boxShadow: "0 2px 4px rgba(220, 38, 38, 0.2)",
              transition: "all 0.2s ease-in-out",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#b91c1c";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 4px 8px rgba(220, 38, 38, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#dc2626";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 4px rgba(220, 38, 38, 0.2)";
            }}
          >
            🚪 Odjava
          </button>
        </div>
      </div>
        </div>
      </div>

      {/* Modal za uređivanje uređaja */}
      {canManageDeviceRoles && showDeviceModal && selectedDevice && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            padding: isMobile ? "16px" : "24px",
          }}
          onClick={() => {
            setShowDeviceModal(false);
            setSelectedDevice(null);
            setEditingDeviceId(null);
            setEditingPermissions({});
            setSelectedRole({ ...selectedRole, [selectedDevice.id]: undefined as any });
            setDeviceNames({ ...deviceNames, [selectedDevice.id]: undefined as any });
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: isMobile ? "16px" : "24px",
              maxWidth: isMobile ? "100%" : "700px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: isMobile ? "18px" : "20px", fontWeight: 600, color: "#1f2937", marginBottom: "20px" }}>
              Uredi Uređaj - {selectedDevice.deviceName || "Nema imena"}
            </h2>

            {/* Informacije o uređaju */}
            <div style={{ marginBottom: "24px", padding: "16px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", marginBottom: "12px" }}>
                Informacije o uređaju
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: "12px", fontSize: "14px", color: "#6b7280" }}>
                <div><strong>Browser:</strong> {selectedDevice.deviceInfo?.browser || "N/A"}</div>
                <div><strong>OS:</strong> {selectedDevice.deviceInfo?.os || "N/A"}</div>
                <div><strong>Ekran:</strong> {selectedDevice.deviceInfo?.screenSize || "N/A"}</div>
                <div><strong>Posljednja prijava:</strong> {selectedDevice.lastLogin ? selectedDevice.lastLogin.toLocaleDateString("bs-BA") + " " + selectedDevice.lastLogin.toLocaleTimeString("bs-BA", { hour: "2-digit", minute: "2-digit" }) : "N/A"}</div>
                {selectedDevice.deviceInfo?.firstSeen && (
                  <div><strong>Prvi put viđen:</strong> {selectedDevice.deviceInfo.firstSeen.toLocaleDateString("bs-BA")}</div>
                )}
              </div>
            </div>

            {/* Ime uređaja */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "#374151", marginBottom: "6px" }}>
                Ime uređaja
              </label>
              <input
                type="text"
                value={deviceNames[selectedDevice.id] !== undefined ? deviceNames[selectedDevice.id] : (selectedDevice.deviceName || "")}
                onChange={(e) => setDeviceNames({ ...deviceNames, [selectedDevice.id]: e.target.value })}
                placeholder="Unesite ime uređaja"
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #e5e7eb",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>

            {/* Uloga */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "#374151", marginBottom: "6px" }}>
                Uloga
              </label>
              <select
                value={selectedRole[selectedDevice.id] !== undefined ? (selectedRole[selectedDevice.id] || "") : (selectedDevice.role || "")}
                onChange={(e) => {
                  const newRole = e.target.value as UserRole || null;
                  setSelectedRole({ ...selectedRole, [selectedDevice.id]: newRole });
                  if (newRole === "konobar" && !selectedDevice.permissions) {
                    setEditingPermissions({
                      dashboard: true,
                      obracun: true,
                      arhiva: true,
                      cjenovnik: true,
                      profit: true,
                      profile: true,
                    });
                  } else if (newRole !== "konobar") {
                    setEditingPermissions({});
                  }
                }}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #e5e7eb",
                  fontSize: "14px",
                  outline: "none",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                }}
              >
                <option value="">Nedodijeljena</option>
                <option value="vlasnik">Vlasnik</option>
                <option value="konobar">Konobar</option>
              </select>
            </div>

            {/* Dozvole (samo za konobar) */}
            {(selectedRole[selectedDevice.id] !== undefined ? selectedRole[selectedDevice.id] : selectedDevice.role) === "konobar" && (
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "#374151", marginBottom: "12px" }}>
                  Dozvole za stranice
                </label>
                <div style={{ 
                  display: "flex", 
                  flexDirection: "column",
                  gap: "12px", 
                  padding: "16px", 
                  background: "#f9fafb", 
                  borderRadius: "8px", 
                  border: "1px solid #e5e7eb" 
                }}>
                  {["dashboard", "obracun", "arhiva", "cjenovnik", "profit", "profile"].map((page) => (
                    <label 
                      key={page} 
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "12px", 
                        fontSize: "14px", 
                        cursor: "pointer",
                        padding: "8px",
                        borderRadius: "6px",
                        minHeight: "44px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={editingPermissions[page as keyof PagePermission] || false}
                        onChange={(e) => {
                          setEditingPermissions({
                            ...editingPermissions,
                            [page]: e.target.checked,
                          });
                        }}
                        style={{ 
                          cursor: "pointer",
                          width: "20px",
                          height: "20px",
                          minWidth: "20px",
                          minHeight: "20px",
                          accentColor: "#3b82f6"
                        }}
                      />
                      <span style={{ userSelect: "none" }}>
                        {page === "dashboard" ? "Radna površina" :
                         page === "obracun" ? "Obračun" :
                         page === "arhiva" ? "Arhiva" :
                         page === "cjenovnik" ? "Cjenovnik" :
                         page === "profit" ? "Profit" :
                         "Profil"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Status i akcije */}
            <div style={{ marginBottom: "20px", padding: "16px", background: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: "14px", color: "#374151" }}>Status: </strong>
                  {selectedDevice.status === "verifikacija" ? (
                    <span style={{ padding: "4px 12px", borderRadius: "12px", fontSize: "12px", fontWeight: 600, backgroundColor: "#fef3c7", color: "#f59e0b" }}>
                      Verifikacija
                    </span>
                  ) : selectedDevice.isBlocked ? (
                    <span style={{ padding: "4px 12px", borderRadius: "12px", fontSize: "12px", fontWeight: 600, backgroundColor: "#fee2e2", color: "#dc2626" }}>
                      Blokiran
                    </span>
                  ) : (
                    <span style={{ padding: "4px 12px", borderRadius: "12px", fontSize: "12px", fontWeight: 600, backgroundColor: "#dcfce7", color: "#16a34a" }}>
                      Aktivan
                    </span>
                  )}
                </div>
                {selectedDevice.status !== "verifikacija" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleBlockDevice(selectedDevice, selectedDevice.isBlocked);
                    }}
                    disabled={isDeviceBusy(selectedDevice)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "6px",
                      border: "none",
                      fontSize: "14px",
                      fontWeight: 500,
                      cursor: isDeviceBusy(selectedDevice) ? "not-allowed" : "pointer",
                      backgroundColor: selectedDevice.isBlocked ? "#16a34a" : "#dc2626",
                      color: "#fff",
                      opacity: isDeviceBusy(selectedDevice) ? 0.5 : 1,
                    }}
                  >
                    {selectedDevice.isBlocked ? "Odblokiraj" : "Blokiraj"}
                  </button>
                )}
              </div>
            </div>

            {/* Dugmad */}
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  setShowDeviceModal(false);
                  setSelectedDevice(null);
                  setEditingDeviceId(null);
                  setEditingPermissions({});
                  setSelectedRole({ ...selectedRole, [selectedDevice.id]: undefined as any });
                  setDeviceNames({ ...deviceNames, [selectedDevice.id]: undefined as any });
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: "6px",
                  border: "1px solid #e5e7eb",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor: "#fff",
                  color: "#374151",
                }}
              >
                Otkaži
              </button>
              <button
                onClick={async () => {
                  const roleToSave = selectedRole[selectedDevice.id] !== undefined ? selectedRole[selectedDevice.id] : selectedDevice.role;
                  
                  // Spremi ulogu
                  if (roleToSave === "konobar") {
                    await handleSavePermissions(selectedDevice, roleToSave);
                  } else if (roleToSave) {
                    await handleAssignRole(selectedDevice, roleToSave);
                  }
                  
                  // Spremi ime uređaja ako je promijenjeno
                  if (deviceNames[selectedDevice.id] !== undefined && deviceNames[selectedDevice.id] !== selectedDevice.deviceName) {
                    await handleSaveDeviceName(selectedDevice, deviceNames[selectedDevice.id]);
                  }
                  
                  // Zatvori modal
                  setShowDeviceModal(false);
                  setSelectedDevice(null);
                  setEditingDeviceId(null);
                  setEditingPermissions({});
                  setSelectedRole({ ...selectedRole, [selectedDevice.id]: undefined as any });
                  setDeviceNames({ ...deviceNames, [selectedDevice.id]: undefined as any });
                }}
                disabled={isDeviceBusy(selectedDevice)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: isDeviceBusy(selectedDevice) ? "not-allowed" : "pointer",
                  backgroundColor: isDeviceBusy(selectedDevice) ? "#9ca3af" : "#3b82f6",
                  color: "#fff",
                }}
              >
                {isDeviceBusy(selectedDevice) ? "Spremanje..." : "Spremi"}
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (window.confirm("Jeste li sigurni da želite izbrisati ovaj uređaj? Korisnik će morati ponovo zatražiti pristup.")) {
                    try {
                      await handleDeleteDevice(selectedDevice);
                      setShowDeviceModal(false);
                      setSelectedDevice(null);
                    } catch (error) {
                      // Error handling je već u handleDeleteDevice
                      console.error("Error in modal delete button:", error);
                    }
                  }
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor: "#dc2626",
                  color: "#fff",
                }}
              >
                Izbriši
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Chat komponente - samo na profilu, NE za admin korisnika */}
      {!isAdmin && (
        <>
          <SupportChatButton />
          <SupportChatWindow />
        </>
      )}
    </div>
  );
}
