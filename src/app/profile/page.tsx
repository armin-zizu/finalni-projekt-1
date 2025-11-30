"use client";

import React, { useState, useEffect, useMemo } from "react";
import { auth, sendPasswordResetEmail, signOut, sendEmailVerification } from "../../lib/firebase";
import { useAppName } from "../context/AppNameContext";
import { useSubscription } from "../context/SubscriptionContext";
import { useRole, UserRole, PagePermission } from "../context/RoleContext";
import { useRouter, useSearchParams } from "next/navigation";
import jsPDF from "jspdf";
import { db } from "../../lib/firestore";
import { doc, setDoc, Timestamp, collection, getDocs, query, where, getDoc, updateDoc, onSnapshot, deleteDoc } from "firebase/firestore";
import { FaSearch, FaSpinner, FaMobile, FaDesktop } from "react-icons/fa";

const containerStyle: React.CSSProperties = {
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "24px",
  fontFamily: "'Inter', sans-serif",
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

export default function Profile() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const { appName, setAppName } = useAppName();
  const [localAppName, setLocalAppName] = useState(appName); // Lokalni state za input
  const [sessions, setSessions] = useState<any[]>([]);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editedSessionName, setEditedSessionName] = useState("");
  const [isAppNameUpdated, setIsAppNameUpdated] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string | null>(null);
  const [backupFromDate, setBackupFromDate] = useState("");
  const [backupToDate, setBackupToDate] = useState("");
  const [showBackupFilters, setShowBackupFilters] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const { subscription, loading: subscriptionLoading, addPayment } = useSubscription();
  const [newPaymentAmount, setNewPaymentAmount] = useState("");
  const [newPaymentNote, setNewPaymentNote] = useState("");
  const [subscriptionMessage, setSubscriptionMessage] = useState("");
  const [selectedMonths, setSelectedMonths] = useState(1);
  const [paymentRequested, setPaymentRequested] = useState(false);
  const [requestingPayment, setRequestingPayment] = useState(false);
  const { role, assignRole: assignRoleFromContext } = useRole();
  const [devices, setDevices] = useState<any[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [loginApprovals, setLoginApprovals] = useState<any[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<PagePermission>({});
  const [selectedRole, setSelectedRole] = useState<Record<string, UserRole>>({});
  const router = useRouter();

  // Sinhronizuj localAppName sa appName iz contexta
  useEffect(() => {
    setLocalAppName(appName);
  }, [appName]);

  // Učitaj paymentRequested status
  useEffect(() => {
    if (subscription?.paymentPendingVerification) {
      setPaymentRequested(true);
    } else {
      setPaymentRequested(false);
    }
  }, [subscription]);

  // Dohvati IP adresu, lokaciju i trenutnog korisnika
  useEffect(() => {
    const fetchIPAndLocation = async () => {
      try {
        // Pokušaj dobiti IP i lokaciju iz ip-api.com (besplatno, bez API ključa)
        const response = await fetch("https://ip-api.com/json/?fields=status,message,query,country,regionName,city,isp");
        const data = await response.json();
        
        if (data.status === "success") {
          return {
            ip: data.query,
            location: `${data.city || ""}, ${data.regionName || ""}, ${data.country || ""}`.replace(/^,\s*|,\s*$/g, "").trim() || "Nepoznata lokacija",
            isp: data.isp || "N/A"
          };
        } else {
          // Fallback na ipify ako ip-api ne radi
          const ipResponse = await fetch("https://api.ipify.org?format=json");
          const ipData = await ipResponse.json();
          return {
            ip: ipData.ip,
            location: "Nepoznata lokacija",
            isp: "N/A"
          };
        }
      } catch (error) {
        console.error("Greška pri dohvaćanju IP adrese i lokacije:", error);
        // Fallback na ipify
        try {
          const ipResponse = await fetch("https://api.ipify.org?format=json");
          const ipData = await ipResponse.json();
          return {
            ip: ipData.ip,
            location: "Nepoznata lokacija",
            isp: "N/A"
          };
        } catch (fallbackError) {
          return {
            ip: "N/A",
            location: "Nepoznata lokacija",
            isp: "N/A"
          };
        }
      }
    };

    const user = auth.currentUser;
    if (user) {
      setEmail(user.email || "N/A"); // Postavi trenutni e-mail
      
      // Provjeri da li već postoji sesija u localStorage
      const savedSessions = localStorage.getItem("userSessions");
      let existingSessions: any[] = [];
      if (savedSessions) {
        try {
          existingSessions = JSON.parse(savedSessions);
        } catch (e) {
          existingSessions = [];
        }
      }

      // Provjeri da li postoji aktivna sesija za ovog korisnika
      const activeSession = existingSessions.find(s => s.userEmail === user.email && s.status === "Aktivna");
      
      // Provjeri da li postoji IP info iz posljednjeg login-a
      const lastLoginIP = localStorage.getItem("lastLoginIP");
      let ipInfo = { ip: "N/A", location: "Nepoznata lokacija", isp: "N/A" };
      
      if (lastLoginIP) {
        try {
          const parsed = JSON.parse(lastLoginIP);
          // Koristi IP info samo ako je za istog korisnika i nije stariji od 1 sata
          if (parsed.userEmail === user.email && (Date.now() - parsed.timestamp) < 3600000) {
            ipInfo = { ip: parsed.ip, location: parsed.location, isp: parsed.isp };
          }
        } catch (e) {
          // Ignoriraj grešku
        }
      }

      // Dohvati IP info ako nije dostupan
      if (ipInfo.ip === "N/A") {
        fetchIPAndLocation().then(({ ip, location, isp }) => {
          ipInfo = { ip, location, isp };
          
          // Provjeri da li postoji sesija sa istom IP adresom za ovog korisnika
          const existingSessionWithSameIP = existingSessions.find(s => 
            s.userEmail === user.email && 
            s.ip === ipInfo.ip && 
            ipInfo.ip !== "N/A"
          );

          if (!activeSession && !existingSessionWithSameIP) {
            // Kreiraj novu sesiju samo ako nema aktivne sesije i nema sesije sa istom IP
            createSession(ipInfo);
          } else if (activeSession) {
            // Koristi postojeću aktivnu sesiju, ali ažuriraj IP ako je noviji
            if (ipInfo.ip !== "N/A" && activeSession.ip === "N/A") {
              activeSession.ip = ipInfo.ip;
              activeSession.location = ipInfo.location;
              const updatedSessions = existingSessions.map(s => 
                s.id === activeSession.id ? activeSession : s
              );
              localStorage.setItem("userSessions", JSON.stringify(updatedSessions));
              setSessions(updatedSessions);
            } else {
              setSessions(existingSessions);
            }
          } else {
            // Postoji sesija sa istom IP, ne kreiraj novu
            setSessions(existingSessions);
          }
        });
      } else {
        // Provjeri da li postoji sesija sa istom IP adresom za ovog korisnika
        const existingSessionWithSameIP = existingSessions.find(s => 
          s.userEmail === user.email && 
          s.ip === ipInfo.ip && 
          ipInfo.ip !== "N/A"
        );

        if (!activeSession && !existingSessionWithSameIP) {
          // Kreiraj novu sesiju samo ako nema aktivne sesije i nema sesije sa istom IP
          createSession(ipInfo);
        } else if (activeSession) {
          // Koristi postojeću aktivnu sesiju, ali ažuriraj IP ako je noviji
          if (ipInfo.ip !== "N/A" && activeSession.ip === "N/A") {
            activeSession.ip = ipInfo.ip;
            activeSession.location = ipInfo.location;
            const updatedSessions = existingSessions.map(s => 
              s.id === activeSession.id ? activeSession : s
            );
            localStorage.setItem("userSessions", JSON.stringify(updatedSessions));
            setSessions(updatedSessions);
          } else {
            setSessions(existingSessions);
          }
        } else {
          // Postoji sesija sa istom IP, ne kreiraj novu
          setSessions(existingSessions);
        }
      }

      function createSession(ipInfo: { ip: string; location: string; isp: string }) {
        const user = auth.currentUser;
        if (!user || !user.email) return; // Ako nema korisnika, ne kreiraj sesiju
        
        const device = /Mobi|Android/i.test(navigator.userAgent) ? "Mobilni" : "Desktop";
        const currentSession = {
          id: Date.now().toString(),
          date: new Date().toLocaleString("bs-BA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
          status: "Aktivna",
          device,
          location: ipInfo.location,
          ip: ipInfo.ip,
          name: user.displayName || "Korisnik",
          userEmail: user.email,
          isp: ipInfo.isp
        };
        
        // Ažuriraj localStorage
        const updatedSessions = [currentSession, ...existingSessions.filter(s => s.userEmail !== user.email || s.status !== "Aktivna")];
        localStorage.setItem("userSessions", JSON.stringify(updatedSessions));
        
        setSessions(updatedSessions);
      }
    }
  }, []);

  const handleChangeEmail = async () => {
    const user = auth.currentUser;
    if (!user || !user.email) {
      setEmailMessage("Niste prijavljeni!");
      setTimeout(() => setEmailMessage(""), 5000);
      return;
    }

    try {
      // Pošalji verifikacijski link na trenutni email
      await sendEmailVerification(user);
      setEmailMessage(`Verifikacijski link je poslan na vaš trenutni e-mail (${user.email}). Molimo provjerite inbox i kliknite na link za promjenu e-mail adrese.`);
      setTimeout(() => setEmailMessage(""), 10000);
    } catch (err: any) {
      setEmailMessage("Greška: " + err.message);
      setTimeout(() => setEmailMessage(""), 5000);
    }
  };

  const handleChangePassword = async () => {
    const user = auth.currentUser;
    if (!user || !user.email) {
      setMessage("Niste prijavljeni!");
      setTimeout(() => setMessage(""), 5000);
      return;
    }

    try {
      await sendPasswordResetEmail(auth, user.email);
      setMessage(`Link za promjenu lozinke je poslan na vaš e-mail (${user.email}). Provjerite inbox.`);
      setTimeout(() => setMessage(""), 8000);
    } catch (err: any) {
      setMessage("Greška: " + err.message);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  const handleSaveAppName = () => {
    if (localAppName.trim() !== "") {
      // Spremi direktno u localStorage
      localStorage.setItem("appName", localAppName.trim());
      // Ažuriraj context
      setAppName(localAppName.trim());
      setIsAppNameUpdated(true);
      setLastUpdatedTime(new Date().toLocaleString("bs-BA", { 
        day: "2-digit", 
        month: "2-digit", 
        year: "numeric", 
        hour: "2-digit", 
        minute: "2-digit" 
      }));
      setMessage("");
      // Sakrij poruku nakon 3 sekunde
      setTimeout(() => {
        setIsAppNameUpdated(false);
      }, 3000);
    } else {
      setMessage("Unesite ime aplikacije!");
    }
  };

  // Učitaj uređaje za trenutnog korisnika
  const loadDevices = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      setLoadingDevices(true);
      // Učitaj sve uređaje koji pripadaju ovom korisniku
      const devicesCollection = collection(db, "devices");
      const q = query(devicesCollection, where("userId", "==", user.uid));
      const devicesSnapshot = await getDocs(q);
      
      const devicesList: any[] = [];
      devicesSnapshot.forEach((doc) => {
        const data = doc.data();
        devicesList.push({
          id: doc.id,
          ...data,
          deviceId: doc.id,
          status: data.status || (data.role === null ? "verifikacija" : "approved"),
          isBlocked: data.isBlocked === true,
          deviceInfo: {
            ...data.deviceInfo,
            firstSeen: data.deviceInfo?.firstSeen?.toDate?.() || null,
            lastLogin: data.deviceInfo?.lastLogin?.toDate?.() || null,
          },
          lastLogin: data.lastLogin?.toDate?.() || null,
          assignedAt: data.assignedAt?.toDate?.() || null,
        });
      });
      
      // Sortiraj po posljednjoj prijavi (najnoviji prvo)
      devicesList.sort((a, b) => {
        const aDate = a.lastLogin || a.deviceInfo?.firstSeen || new Date(0);
        const bDate = b.lastLogin || b.deviceInfo?.firstSeen || new Date(0);
        return bDate.getTime() - aDate.getTime();
      });
      
      setDevices(devicesList);
    } catch (error) {
      console.error("Greška pri učitavanju uređaja:", error);
    } finally {
      setLoadingDevices(false);
    }
  };

  // Dodijeli ulogu uređaju
  const handleAssignRole = async (deviceId: string, newRole: UserRole, permissions?: PagePermission) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      setSavingRole(true);
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
      setSavingRole(false);
    }
  };

  // Otvori modal za uređivanje dozvola
  const handleEditPermissions = (device: any) => {
    setEditingDeviceId(device.id);
    setEditingPermissions(device.permissions || {});
  };

  // Spremi dozvole
  const handleSavePermissions = async (deviceId: string, deviceRole: UserRole) => {
    await handleAssignRole(deviceId, deviceRole, editingPermissions);
  };

  // Odobri novi uređaj
  const handleApproveDevice = async (deviceId: string) => {
    const user = auth.currentUser;
    if (!user || role !== "vlasnik") return;

    try {
      setSavingRole(true);
      const deviceRef = doc(db, "devices", deviceId);
      await setDoc(
        deviceRef,
        {
          status: "approved",
          approvedAt: Timestamp.fromDate(new Date()),
          approvedBy: user.uid,
          updatedAt: Timestamp.fromDate(new Date()),
        },
        { merge: true }
      );
      await loadDevices();
      setMessage("Uređaj uspješno odobren");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Greška pri odobravanju uređaja:", error);
      setMessage("Greška pri odobravanju uređaja");
      setTimeout(() => setMessage(""), 5000);
    } finally {
      setSavingRole(false);
    }
  };

  // Blokiraj/odblokiraj uređaj
  const handleToggleBlockDevice = async (deviceId: string, currentBlocked: boolean) => {
    const user = auth.currentUser;
    if (!user || role !== "vlasnik") return;

    try {
      setSavingRole(true);
      const deviceRef = doc(db, "devices", deviceId);
      await setDoc(
        deviceRef,
        {
          isBlocked: !currentBlocked,
          blockedAt: !currentBlocked ? Timestamp.fromDate(new Date()) : null,
          blockedBy: !currentBlocked ? user.uid : null,
          updatedAt: Timestamp.fromDate(new Date()),
        },
        { merge: true }
      );
      await loadDevices();
      setMessage(`Uređaj ${!currentBlocked ? "blokiran" : "odblokiran"}`);
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Greška pri blokiranju/odblokiranju uređaja:", error);
      setMessage("Greška pri blokiranju/odblokiranju uređaja");
      setTimeout(() => setMessage(""), 5000);
    } finally {
      setSavingRole(false);
    }
  };

  // Izbriši uređaj (login)
  const handleDeleteDevice = async (deviceId: string) => {
    const user = auth.currentUser;
    if (!user || role !== "vlasnik") return;

    if (!window.confirm("Jeste li sigurni da želite izbrisati ovaj login? Korisnik će morati ponovo zatražiti pristup.")) {
      return;
    }

    try {
      setSavingRole(true);
      const deviceRef = doc(db, "devices", deviceId);
      await deleteDoc(deviceRef);
      await loadDevices();
      setMessage("Login uspješno izbrisan");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Greška pri brisanju login-a:", error);
      setMessage("Greška pri brisanju login-a");
      setTimeout(() => setMessage(""), 5000);
    } finally {
      setSavingRole(false);
    }
  };

  // Provjeri da li je korisnik vlasnik
  useEffect(() => {
    const checkOwner = async () => {
      const user = auth.currentUser;
      if (!user) return;
      
      try {
        // Provjeri email direktno
        if (user.email === "gitara.zizu@gmail.com") {
          setIsOwner(true);
          return;
        }
        
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setIsOwner(userDoc.data().isOwner === true);
        }
      } catch (error) {
        console.error("Greška pri provjeri vlasnika:", error);
      }
    };
    checkOwner();
  }, []);

  // Učitaj zahtjeve za odobrenje (samo za vlasnika)
  const loadLoginApprovals = async () => {
    const user = auth.currentUser;
    if (!isOwner && user?.email !== "gitara.zizu@gmail.com") return;
    
    try {
      setLoadingApprovals(true);
      const approvalsRef = collection(db, "loginApprovals");
      const q = query(approvalsRef, where("status", "==", "pending"));
      const snapshot = await getDocs(q);
      
      const approvalsList: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        approvalsList.push({
          id: doc.id,
          ...data,
          requestedAt: data.requestedAt?.toDate?.() || null,
        });
      });
      
      // Sortiraj po datumu (najnoviji prvo)
      approvalsList.sort((a, b) => {
        const aDate = a.requestedAt || new Date(0);
        const bDate = b.requestedAt || new Date(0);
        return bDate.getTime() - aDate.getTime();
      });
      
      setLoginApprovals(approvalsList);
    } catch (error: any) {
      // Ignoriraj greške permisija ako nije vlasnik
      if (error.code === 'permission-denied') {
        console.warn("Nemam permisije za učitavanje zahtjeva za odobrenje");
      } else {
        console.error("Greška pri učitavanju zahtjeva za odobrenje:", error);
      }
    } finally {
      setLoadingApprovals(false);
    }
  };

  // Odobri zahtjev
  const approveLoginRequest = async (approvalId: string) => {
    const user = auth.currentUser;
    if (!user || (!isOwner && user.email !== "gitara.zizu@gmail.com")) return;

    try {
      const approvalRef = doc(db, "loginApprovals", approvalId);
      await updateDoc(approvalRef, {
        status: "approved",
        approvedAt: Timestamp.fromDate(new Date()),
        approvedBy: user.uid,
      });
      console.log("Zahtjev odobren za korisnika:", approvalId);
      
      // Provjeri da li je status stvarno ažuriran
      const updatedDoc = await getDoc(approvalRef);
      if (updatedDoc.exists()) {
        const updatedData = updatedDoc.data();
        console.log("Status nakon odobrenja:", updatedData.status);
      }
      
      await loadLoginApprovals();
      setMessage("Zahtjev uspješno odobren. Korisnik se sada može prijaviti.");
      setTimeout(() => setMessage(""), 5000);
    } catch (error) {
      console.error("Greška pri odobravanju zahtjeva:", error);
      setMessage("Greška pri odobravanju zahtjeva");
      setTimeout(() => setMessage(""), 5000);
    }
  };

  // Odbij zahtjev
  const rejectLoginRequest = async (approvalId: string) => {
    const user = auth.currentUser;
    if (!user || (!isOwner && user.email !== "gitara.zizu@gmail.com")) return;

    try {
      const approvalRef = doc(db, "loginApprovals", approvalId);
      await updateDoc(approvalRef, {
        status: "rejected",
        rejectedAt: Timestamp.fromDate(new Date()),
        rejectedBy: user.uid,
      });
      await loadLoginApprovals();
      setMessage("Zahtjev uspješno odbijen");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Greška pri odbijanju zahtjeva:", error);
      setMessage("Greška pri odbijanju zahtjeva");
      setTimeout(() => setMessage(""), 5000);
    }
  };

  // Učitaj zahtjeve kada je korisnik vlasnik
  useEffect(() => {
    if (isOwner) {
      loadLoginApprovals();
      
      // Postavi real-time listener
      const approvalsRef = collection(db, "loginApprovals");
      const q = query(approvalsRef, where("status", "==", "pending"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const approvalsList: any[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          approvalsList.push({
            id: doc.id,
            ...data,
            requestedAt: data.requestedAt?.toDate?.() || null,
          });
        });
        approvalsList.sort((a, b) => {
          const aDate = a.requestedAt || new Date(0);
          const bDate = b.requestedAt || new Date(0);
          return bDate.getTime() - aDate.getTime();
        });
        setLoginApprovals(approvalsList);
      });
      
      return () => unsubscribe();
    }
  }, [isOwner]);

  // Učitaj uređaje kada je korisnik vlasnik
  useEffect(() => {
    if (role === "vlasnik" || isOwner) {
      loadDevices();
    }
  }, [role, isOwner]);


  const handleDeleteSession = (id: string) => {
    if (window.confirm("Jeste li sigurni da želite obrisati ovu sesiju?")) {
      setSessions(sessions.filter(session => session.id !== id));
    }
  };

  const handleEditSessionName = (id: string, currentName: string) => {
    setEditingSessionId(id);
    setEditedSessionName(currentName);
  };

  const handleSaveSessionName = (id: string) => {
    setSessions(sessions.map(session =>
      session.id === id ? { ...session, name: editedSessionName } : session
    ));
    setEditingSessionId(null);
    setEditedSessionName("");
  };

  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setEditedSessionName("");
  };


  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log("Uspješna odjava, preusmjeravam na login");
      // Session se automatski briše kroz Firebase Auth
      // API route nije potreban za static export
      router.push("/login");
    } catch (err: any) {
      console.error("Greška pri odjavi:", err);
    }
  };

  return (
    <div style={containerStyle}>
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
            onChange={(e) => {
              setLocalAppName(e.target.value);
              setIsAppNameUpdated(false);
            }}
            style={inputStyle}
            placeholder="Unesite ime aplikacije"
          />
          <button style={buttonStyle} onClick={handleSaveAppName}>
            Spremi ime
          </button>
          {isAppNameUpdated && (
            <span style={{ 
              color: "#16a34a", 
              fontSize: "14px", 
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}>
              ✓ Ažurirano {lastUpdatedTime && `(${lastUpdatedTime})`}
            </span>
          )}
        </div>
        {message && <p style={{ color: message.includes("Greška") ? "#dc2626" : "#15803d", marginTop: "8px" }}>{message}</p>}
        <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "8px" }}>
          Trenutno ime aplikacije: <strong>{appName}</strong>
        </p>
      </div>


      {/* Upravljanje uređajima - samo za vlasnika */}
      {(role === "vlasnik" || isOwner || auth.currentUser?.email === "gitara.zizu@gmail.com") && (
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
          ) : (
            <div style={tableWrapperStyle} className={tableWrapperClassName}>
              <table style={tableStyle}>
                <thead>
                  <tr>
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
                    const roleColor = device.role ? roleColors[device.role] || { bg: "#f3f4f6", color: "#6b7280" } : 
                                      needsVerification ? roleColors.verifikacija : { bg: "#f3f4f6", color: "#6b7280" };
                    const isEditing = editingDeviceId === device.id;

                    return (
                      <React.Fragment key={device.id}>
                        <tr>
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
                            <button
                              onClick={() => handleApproveDevice(device.id)}
                              style={{ ...buttonStyle, background: "#16a34a", fontSize: "12px", padding: "4px 8px" }}
                            >
                              Odobri
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingDeviceId(device.id);
                                setSelectedRole({ ...selectedRole, [device.id]: device.role || null });
                                setEditingPermissions(device.permissions || {});
                              }}
                              style={{ ...buttonStyle, fontSize: "12px", padding: "4px 8px" }}
                            >
                              Uredi
                            </button>
                          )}
                        </td>
                        <td style={tdStyle}>
                          <button
                            onClick={() => handleToggleBlockDevice(device.id, isBlocked)}
                            disabled={savingRole || needsVerification}
                            style={{
                              ...buttonStyle,
                              background: isBlocked ? "#16a34a" : "#dc2626",
                              fontSize: "12px",
                              padding: "4px 8px",
                              opacity: (savingRole || needsVerification) ? 0.5 : 1,
                              cursor: (savingRole || needsVerification) ? "not-allowed" : "pointer",
                            }}
                          >
                            {isBlocked ? "Odblokiraj" : "Blokiraj"}
                          </button>
                        </td>
                      </tr>
                      {isEditing && (
                        <tr>
                          <td colSpan={7} style={{ ...tdStyle, padding: "16px", background: "#f9fafb" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                              <div>
                                <h4 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px", color: "#1f2937" }}>
                                  Uredi Ulogu i Dozvole
                                </h4>
                                {isEditing ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "12px", background: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                                    <div>
                                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px", color: "#374151" }}>
                                        Uloga:
                                      </label>
                                      <select
                                        value={selectedRole[device.id] || device.role || ""}
                                        onChange={(e) => {
                                          const newRole = e.target.value as UserRole || null;
                                          setSelectedRole({ ...selectedRole, [device.id]: newRole });
                                          if (newRole === "konobar" && !device.permissions) {
                                            setEditingPermissions({
                                              dashboard: true,
                                              obracun: true,
                                              arhiva: true,
                                              cjenovnik: true,
                                              profit: true,
                                              profile: true,
                                              admin: false,
                                            });
                                          }
                                        }}
                                        style={{
                                          padding: "8px 12px",
                                          border: "1px solid #e5e7eb",
                                          borderRadius: "6px",
                                          fontSize: "14px",
                                          backgroundColor: "#fff",
                                          color: "#1f2937",
                                          cursor: "pointer",
                                          width: "100%",
                                          maxWidth: "300px",
                                        }}
                                      >
                                        <option value="">Nedodijeljena</option>
                                        <option value="vlasnik">Vlasnik</option>
                                        <option value="konobar">Konobar</option>
                                      </select>
                                    </div>
                                    {(selectedRole[device.id] || device.role) === "konobar" && (
                                      <div>
                                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "8px", color: "#374151" }}>
                                          Dozvole za stranice:
                                        </label>
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", padding: "12px", background: "#f9fafb", borderRadius: "6px", border: "1px solid #e5e7eb" }}>
                                          {["dashboard", "obracun", "arhiva", "cjenovnik", "profit", "profile"].map((page) => (
                                            <label key={page} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                                              <input
                                                type="checkbox"
                                                checked={editingPermissions[page as keyof PagePermission] || false}
                                                onChange={(e) => {
                                                  setEditingPermissions({
                                                    ...editingPermissions,
                                                    [page]: e.target.checked,
                                                  });
                                                }}
                                                style={{ cursor: "pointer" }}
                                              />
                                              {page === "dashboard" ? "Radna površina" :
                                               page === "obracun" ? "Obračun" :
                                               page === "arhiva" ? "Arhiva" :
                                               page === "cjenovnik" ? "Cjenovnik" :
                                               page === "profit" ? "Profit" :
                                               "Profil"}
                                            </label>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                      <button
                                        onClick={() => {
                                          const roleToSave = selectedRole[device.id] || device.role;
                                          if (roleToSave === "konobar") {
                                            handleSavePermissions(device.id, roleToSave);
                                          } else {
                                            handleAssignRole(device.id, roleToSave);
                                          }
                                          setSelectedRole({ ...selectedRole, [device.id]: undefined as any });
                                        }}
                                        style={{ ...buttonStyle, background: "#16a34a", fontSize: "13px", padding: "8px 16px" }}
                                      >
                                        Spremi
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingDeviceId(null);
                                          setEditingPermissions({});
                                          setSelectedRole({ ...selectedRole, [device.id]: undefined as any });
                                        }}
                                        style={{ ...buttonStyle, background: "#6b7280", fontSize: "13px", padding: "8px 16px" }}
                                      >
                                        Odustani
                                      </button>
                                      <button
                                        onClick={() => handleDeleteDevice(device.id)}
                                        style={{ ...buttonStyle, background: "#dc2626", fontSize: "13px", padding: "8px 16px" }}
                                      >
                                        Izbriši login
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    <div style={{ padding: "12px", background: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                                      <p style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 8px 0" }}>
                                        <strong>Uloga:</strong> {device.role || "Nedodijeljena"}
                                      </p>
                                      {device.role === "konobar" && device.permissions && (
                                        <div>
                                          <p style={{ fontSize: "12px", fontWeight: 600, margin: "0 0 8px 0", color: "#374151" }}>
                                            Dozvole:
                                          </p>
                                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                            {Object.entries(device.permissions).filter(([key]) => key !== "admin").map(([page, allowed]) => (
                                              <span
                                                key={page}
                                                style={{
                                                  padding: "4px 8px",
                                                  borderRadius: "4px",
                                                  fontSize: "11px",
                                                  backgroundColor: allowed ? "#dcfce7" : "#fee2e2",
                                                  color: allowed ? "#16a34a" : "#dc2626",
                                                }}
                                              >
                                                {page === "dashboard" ? "Radna površina" :
                                                 page === "obracun" ? "Obračun" :
                                                 page === "arhiva" ? "Arhiva" :
                                                 page === "cjenovnik" ? "Cjenovnik" :
                                                 page === "profit" ? "Profit" :
                                                 "Profil"}: {allowed ? "Dozvoljeno" : "Blokirano"}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => {
                                        setEditingDeviceId(device.id);
                                        setSelectedRole({ ...selectedRole, [device.id]: device.role || null });
                                        setEditingPermissions(device.permissions || {});
                                      }}
                                      style={{ ...buttonStyle, background: "#3b82f6", fontSize: "13px", padding: "8px 16px", alignSelf: "flex-start" }}
                                    >
                                      Uredi
                                    </button>
                                  </div>
                                )}
                              </div>
                              <div style={{ paddingTop: "12px", borderTop: "1px solid #e5e7eb" }}>
                                <h4 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px", color: "#1f2937" }}>
                                  Informacije o uređaju
                                </h4>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px", fontSize: "12px", color: "#6b7280" }}>
                                  <div><strong>Device ID:</strong> {device.id}</div>
                                  <div><strong>Email:</strong> {device.userEmail || "N/A"}</div>
                                  <div><strong>Browser:</strong> {device.deviceInfo?.browser || "N/A"}</div>
                                  <div><strong>OS:</strong> {device.deviceInfo?.os || "N/A"}</div>
                                  <div><strong>Ekran:</strong> {device.deviceInfo?.screenSize || "N/A"}</div>
                                  <div><strong>Prvi put viđen:</strong> {device.deviceInfo?.firstSeen ? device.deviceInfo.firstSeen.toLocaleDateString("bs-BA") : "N/A"}</div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
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

      {/* Stara sekcija za sesije - sakrivena jer je spojena gore */}
      {false && role === "vlasnik" && (
      <div style={{ marginBottom: "32px", border: "2px solid #e5e7eb", borderRadius: "12px", padding: "16px", background: "#f9fafb" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "16px" }}>
          Pregled sesija
        </h2>
        <div style={tableWrapperStyle} className={tableWrapperClassName}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Sesija ID</th>
              <th style={thStyle}>Datum logovanja</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Uređaj</th>
              <th style={thStyle}>Lokacija</th>
              <th style={thStyle}>IP adresa</th>
              <th style={thStyle}>Ime sesije</th>
              <th style={thStyle}>Akcije</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Filtriraj sesije - prikaži samo jednu sesiju po IP adresi (najnoviju)
              const user = auth.currentUser;
              const userSessions = sessions.filter(s => s.userEmail === user?.email);
              const uniqueIPSessions: any[] = [];
              const seenIPs = new Set<string>();
              
              // Sortiraj po ID-u (koji je timestamp, veći ID = noviji) - najnovije prvo
              const sortedSessions = [...userSessions].sort((a, b) => {
                const idA = parseInt(a.id) || 0;
                const idB = parseInt(b.id) || 0;
                return idB - idA; // Najnovije prvo
              });
              
              for (const session of sortedSessions) {
                if (session.ip && session.ip !== "N/A") {
                  if (!seenIPs.has(session.ip)) {
                    seenIPs.add(session.ip);
                    uniqueIPSessions.push(session);
                  }
                } else {
                  // Ako nema IP adresu, dodaj je
                  uniqueIPSessions.push(session);
                }
              }
              
              return uniqueIPSessions;
            })().map((session) => (
              <tr key={session.id}>
                <td style={tdStyle}>{session.id}</td>
                <td style={tdStyle}>{session.date}</td>
                <td style={tdStyle}>{session.status}</td>
                <td style={tdStyle}>{session.device}</td>
                <td style={tdStyle}>{session.location}</td>
                <td style={tdStyle}>{session.ip}</td>
                <td style={tdStyle}>
                  {editingSessionId === session.id ? (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        value={editedSessionName}
                        onChange={(e) => setEditedSessionName(e.target.value)}
                        style={inputStyle}
                      />
                      <button style={buttonStyle} onClick={() => handleSaveSessionName(session.id)}>
                        Spremi
                      </button>
                      <button style={{ ...buttonStyle, background: "#6b7280" }} onClick={handleCancelEdit}>
                        Odustani
                      </button>
                    </div>
                  ) : (
                    session.name
                  )}
                </td>
                <td style={tdStyle}>
                  <button
                    style={{ ...buttonStyle, ...{ background: "#dc2626" } }}
                    onClick={() => handleDeleteSession(session.id)}
                  >
                    Obriši
                  </button>
                  {session.status === "Aktivna" && (
                    <button
                      style={buttonStyle}
                      onClick={() => handleEditSessionName(session.id, session.name)}
                    >
                      Uredi
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      )}

      <div style={{ marginBottom: "32px", border: "2px solid #e5e7eb", borderRadius: "12px", padding: "16px", background: "#f9fafb" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "16px" }}>
          Statistika korištenja
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          <div style={{ padding: "16px", background: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
            <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Ukupno obračuna</p>
            <p style={{ fontSize: "24px", fontWeight: 600, color: "#1f2937" }}>
              {(() => {
                const user = auth.currentUser;
                const userId = user?.uid;
                const storageKey = userId ? `arhivaObracuna_${userId}` : "arhivaObracuna";
                const arhiva = localStorage.getItem(storageKey);
                return arhiva ? JSON.parse(arhiva).length : 0;
              })()}
            </p>
          </div>
          <div style={{ padding: "16px", background: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
            <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Artikala u cjenovniku</p>
            <p style={{ fontSize: "24px", fontWeight: 600, color: "#1f2937" }}>
              {(() => {
                const user = auth.currentUser;
                const userId = user?.uid;
                const storageKey = userId ? `cjenovnik_${userId}` : "cjenovnik";
                const cjenovnik = localStorage.getItem(storageKey);
                return cjenovnik ? JSON.parse(cjenovnik).length : 0;
              })()}
            </p>
          </div>
          <div style={{ padding: "16px", background: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
            <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Aktivnih sesija</p>
            <p style={{ fontSize: "24px", fontWeight: 600, color: "#1f2937" }}>
              {sessions.filter(s => s.status === "Aktivna").length}
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
            onClick={() => {
              const user = auth.currentUser;
              const userId = user?.uid;
              const arhivaKey = userId ? `arhivaObracuna_${userId}` : "arhivaObracuna";
              const cjenovnikKey = userId ? `cjenovnik_${userId}` : "cjenovnik";
              const arhivaRaw = localStorage.getItem(arhivaKey);
              const cjenovnikRaw = localStorage.getItem(cjenovnikKey);
              
              let arhiva = arhivaRaw ? JSON.parse(arhivaRaw) : [];
              const cjenovnik = cjenovnikRaw ? JSON.parse(cjenovnikRaw) : [];
              
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
              let yPos = 20;
              
              // Naslov
              doc.setFontSize(18);
              doc.text("Backup podataka", 14, yPos);
              yPos += 10;
              
              // Datum exporta
              doc.setFontSize(12);
              doc.text(`Datum exporta: ${new Date().toLocaleString("bs-BA")}`, 14, yPos);
              yPos += 8;
              
              if (backupFromDate || backupToDate) {
                doc.text(`Period: ${backupFromDate || "početak"} - ${backupToDate || "kraj"}`, 14, yPos);
                yPos += 8;
              }
              
              yPos += 5;
              
              // Cjenovnik
              doc.setFontSize(14);
              doc.text("Cjenovnik", 14, yPos);
              yPos += 8;
              
              doc.setFontSize(10);
              if (cjenovnik.length > 0) {
                doc.text("Naziv | Cijena | Nabavna cijena | Početno stanje", 14, yPos);
                yPos += 6;
                cjenovnik.forEach((item: any) => {
                  if (yPos > 280) {
                    doc.addPage();
                    yPos = 20;
                  }
                  const text = `${item.naziv} | ${item.cijena} KM | ${item.nabavnaCijena} KM | ${item.pocetnoStanje}`;
                  doc.text(text, 14, yPos);
                  yPos += 6;
                });
              } else {
                doc.text("Nema artikala u cjenovniku", 14, yPos);
                yPos += 6;
              }
              
              yPos += 5;
              
              // Arhiva
              doc.setFontSize(14);
              if (yPos > 280) {
                doc.addPage();
                yPos = 20;
              }
              doc.text(`Arhiva obračuna (${arhiva.length} obračuna)`, 14, yPos);
              yPos += 8;
              
              doc.setFontSize(10);
              if (arhiva.length > 0) {
                arhiva.forEach((item: any, index: number) => {
                  // Dodaj novu stranicu ako je potrebno
                  if (yPos > 250) {
                    doc.addPage();
                    yPos = 20;
                  }
                  
                  // Naslov obračuna
                  doc.setFontSize(14);
                  doc.text(`Obračun - ${item.datum}`, 14, yPos);
                  yPos += 8;
                  
                  // Flagovi (ako postoje)
                  if (item.imaUlaz) {
                    doc.setFontSize(10);
                    doc.setTextColor(234, 179, 8); // Žuta
                    doc.text("(Ima ulaz)", 14, yPos);
                    doc.setTextColor(0, 0, 0); // Crna
                    yPos += 6;
                  } else if (item.isAzuriran) {
                    doc.setFontSize(10);
                    doc.setTextColor(245, 158, 11); // Narandžasta
                    doc.text("(Ažurirano)", 14, yPos);
                    doc.setTextColor(0, 0, 0); // Crna
                    yPos += 6;
                  }
                  
                  // Tabela artikala
                  doc.setFontSize(12);
                  doc.text("Artikli:", 14, yPos);
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
                      doc.text(header, xPos, yPos);
                      xPos += colWidths[i];
                    });
                    yPos += 6;
                    
                    // Linija ispod headera
                    doc.line(14, yPos - 2, 200, yPos - 2);
                    yPos += 4;
                    
                    // Artikli
                    item.artikli.forEach((art: any) => {
                      if (yPos > 270) {
                        doc.addPage();
                        yPos = 20;
                        // Ponovi header
                        xPos = startX;
                        headers.forEach((header, i) => {
                          doc.text(header, xPos, yPos);
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
                      
                      doc.text(art.naziv.substring(0, 20), xPos, yPos);
                      xPos += colWidths[0];
                      doc.text((art.cijena ?? 0).toFixed(2), xPos, yPos);
                      xPos += colWidths[1];
                      doc.text(String(pocetnoStanje), xPos, yPos);
                      xPos += colWidths[2];
                      doc.text(ulaz > 0 ? ulaz.toFixed(2) : "-", xPos, yPos);
                      xPos += colWidths[3];
                      doc.text((art.ukupno ?? "-").toString(), xPos, yPos);
                      xPos += colWidths[4];
                      doc.text((art.utroseno ?? "-").toString(), xPos, yPos);
                      xPos += colWidths[5];
                      doc.text((art.krajnjeStanje ?? "-").toString(), xPos, yPos);
                      xPos += colWidths[6];
                      doc.text((art.vrijednostKM ?? 0).toFixed(2) + " KM", xPos, yPos);
                      
                      yPos += 6;
                    });
                  } else {
                    doc.text("Nema artikala", 14, yPos);
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
                    doc.text("Rashodi:", 14, yPos);
                    yPos += 7;
                    
                    doc.setFontSize(9);
                    doc.text("Naziv", 14, yPos);
                    doc.text("Cijena", 80, yPos);
                    doc.text("Plaćeno", 120, yPos);
                    yPos += 6;
                    doc.line(14, yPos - 2, 200, yPos - 2);
                    yPos += 4;
                    
                    item.rashodi.forEach((r: any) => {
                      if (yPos > 270) {
                        doc.addPage();
                        yPos = 20;
                      }
                      doc.text(r.naziv, 14, yPos);
                      doc.text(r.cijena.toFixed(2) + " KM", 80, yPos);
                      doc.text(r.placeno ? "Da" : "Ne", 120, yPos);
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
                    doc.text("Prihodi:", 14, yPos);
                    yPos += 7;
                    
                    doc.setFontSize(9);
                    doc.text("Naziv", 14, yPos);
                    doc.text("Cijena", 80, yPos);
                    yPos += 6;
                    doc.line(14, yPos - 2, 200, yPos - 2);
                    yPos += 4;
                    
                    item.prihodi.forEach((p: any) => {
                      if (yPos > 270) {
                        doc.addPage();
                        yPos = 20;
                      }
                      doc.text(p.naziv, 14, yPos);
                      doc.text(p.cijena.toFixed(2) + " KM", 80, yPos);
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
                  doc.text("Ukupno:", 14, yPos);
                  yPos += 7;
                  
                  doc.setFontSize(10);
                  doc.text(`Ukupno artikli: ${item.ukupnoArtikli.toFixed(2)} KM`, 20, yPos);
                  yPos += 6;
                  doc.text(`Ukupno rashod: ${item.ukupnoRashod.toFixed(2)} KM`, 20, yPos);
                  yPos += 6;
                  doc.text(`Ukupno prihod: ${(item.ukupnoPrihod || 0).toFixed(2)} KM`, 20, yPos);
                  yPos += 6;
                  doc.setFontSize(11);
                  doc.text(`Neto: ${(item.neto || (item.ukupnoArtikli + (item.ukupnoPrihod || 0) - item.ukupnoRashod)).toFixed(2)} KM`, 20, yPos);
                  
                  yPos += 10;
                  
                  // Linija između obračuna
                  if (index < arhiva.length - 1) {
                    doc.line(14, yPos, 200, yPos);
                    yPos += 5;
                  }
                });
              } else {
                doc.text("Nema obračuna u arhivi", 14, yPos);
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
        
        {subscriptionLoading || !subscription ? (
          <p style={{ color: "#6b7280", fontSize: "14px" }}>Učitavanje pretplate...</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Status pretplate */}
            <div style={{ padding: "16px", background: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", marginBottom: "4px" }}>Status pretplate</h3>
                  <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
                    {subscription.isTrial 
                      ? `Probni period ističe za ${subscription.daysRemaining} ${subscription.daysRemaining === 1 ? "dan" : "dana"}`
                      : subscription.isPremium
                      ? `Premium pretplata ističe za ${subscription.daysUntilExpiry} ${subscription.daysUntilExpiry === 1 ? "dan" : "dana"}`
                      : subscription.isActive
                      ? `Pretplata ističe za ${subscription.daysUntilExpiry} ${subscription.daysUntilExpiry === 1 ? "dan" : "dana"}`
                      : subscription.isGracePeriod
                      ? `Grace period ističe za ${subscription.daysInGrace} ${subscription.daysInGrace === 1 ? "dan" : "dana"}`
                      : "Pretplata nije aktivna"}
                  </p>
                </div>
                {(() => {
                  let statusText = "N/A";
                  let statusColor = "#6b7280";
                  let statusBg = "#f3f4f6";
                  
                  if (subscription.isTrial) {
                    statusText = `Probni period (${subscription.daysRemaining} dana)`;
                    statusColor = "#3b82f6";
                    statusBg = "#dbeafe";
                  } else if (subscription.isPremium) {
                    statusText = `Premium (${subscription.daysUntilExpiry} dana)`;
                    statusColor = "#16a34a";
                    statusBg = "#dcfce7";
                  } else if (subscription.isActive) {
                    statusText = `Aktivna (${subscription.daysUntilExpiry} dana)`;
                    statusColor = "#16a34a";
                    statusBg = "#dcfce7";
                  } else if (subscription.isGracePeriod) {
                    statusText = `Grace period (${subscription.daysInGrace} dana)`;
                    statusColor = "#f59e0b";
                    statusBg = "#fef3c7";
                  } else {
                    statusText = "Neaktivna";
                    statusColor = "#dc2626";
                    statusBg = "#fee2e2";
                  }
                  
                  return (
                    <span
                      style={{
                        padding: "8px 16px",
                        borderRadius: "6px",
                        fontSize: "14px",
                        fontWeight: 600,
                        background: statusBg,
                        color: statusColor,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {statusText}
                    </span>
                  );
                })()}
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                <div>
                  <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Mjesečna cijena</p>
                  <p style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937" }}>
                    {subscription.monthlyPrice.toFixed(2)} KM
                  </p>
                </div>
                
                {subscription.lastPaymentDate && (
                  <div>
                    <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Posljednja uplata</p>
                    <p style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937" }}>
                      {subscription.lastPaymentDate.toLocaleDateString("bs-BA")}
                    </p>
                  </div>
                )}
                
                {subscription.expiryDate && (
                  <div>
                    <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Datum isteka</p>
                    <p
                      style={{
                        fontSize: "14px",
                        fontWeight: 500,
                        color: subscription.expiryDate < new Date() ? "#dc2626" : "#1f2937",
                      }}
                    >
                      {subscription.expiryDate.toLocaleDateString("bs-BA")}
                    </p>
                  </div>
                )}
              </div>
            </div>

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
                    const user = auth.currentUser;
                    if (!user) {
                      setSubscriptionMessage("Niste prijavljeni!");
                      setTimeout(() => setSubscriptionMessage(""), 5000);
                      return;
                    }

                    try {
                      setRequestingPayment(true);
                      const userId = user.uid;
                      const subscriptionRef = doc(db, "users", userId, "subscription", "info");
                      
                      await setDoc(
                        subscriptionRef,
                        {
                          paymentPendingVerification: true,
                          paymentRequestedAt: Timestamp.fromDate(new Date()),
                          paymentRequestedAmount: 12 * selectedMonths,
                          paymentRequestedMonths: selectedMonths,
                          paymentReferenceNumber: appName && selectedMonths ? `${appName.toUpperCase().replace(/\s+/g, "-")}-${selectedMonths}` : null,
                          updatedAt: Timestamp.fromDate(new Date()),
                        },
                        { merge: true }
                      );

                      setPaymentRequested(true);
                      setSubscriptionMessage("Uspješno ste prijavili uplatu! Admin će provjeriti uplatu u najkraćem roku.");
                      setTimeout(() => setSubscriptionMessage(""), 5000);
                    } catch (error: any) {
                      console.error("Greška pri prijavi uplate:", error);
                      setSubscriptionMessage("Greška pri prijavi uplate: " + (error.message || "Nepoznata greška"));
                      setTimeout(() => setSubscriptionMessage(""), 5000);
                    } finally {
                      setRequestingPayment(false);
                    }
                  }}
                  disabled={requestingPayment || paymentRequested || subscription?.paymentPendingVerification}
                  style={{
                    padding: "12px 24px",
                    background: paymentRequested || subscription?.paymentPendingVerification ? "#9ca3af" : "#16a34a",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: requestingPayment || paymentRequested || subscription?.paymentPendingVerification ? "not-allowed" : "pointer",
                    fontSize: "14px",
                    fontWeight: 600,
                    width: "auto",
                    opacity: requestingPayment || paymentRequested || subscription?.paymentPendingVerification ? 0.6 : 1,
                  }}
                >
                  {requestingPayment 
                    ? "Prijavljivanje..." 
                    : paymentRequested || subscription?.paymentPendingVerification
                    ? "✓ Uplata je prijavljena - čeka provjeru"
                    : "✓ Plaćeno - Prijavi uplatu"}
                </button>
                {(paymentRequested || subscription?.paymentPendingVerification) && (
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
            {subscription.paymentHistory && subscription.paymentHistory.length > 0 && (
              <div style={{ padding: "16px", background: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", marginBottom: "12px" }}>
                  Historija uplata
                </h3>
                <div style={tableWrapperStyle} className={tableWrapperClassName}>
                  <table style={tableStyle}>
                    <thead>
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
        )}
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
                            onChange={(e) => handleAssignRole(device.id, e.target.value as UserRole || null)}
                            disabled={savingRole}
                            style={{
                              padding: "6px 12px",
                              border: "1px solid #e5e7eb",
                              borderRadius: "6px",
                              fontSize: "14px",
                              backgroundColor: "#fff",
                              color: "#1f2937",
                              cursor: savingRole ? "not-allowed" : "pointer",
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
              <td style={tdStyle}>{auth.currentUser?.metadata?.creationTime ? new Date(auth.currentUser.metadata.creationTime).toLocaleDateString("bs-BA") : "N/A"}</td>
            </tr>
              <tr>
                <td style={tdStyle}>Zadnja prijava:</td>
                <td style={tdStyle}>{auth.currentUser?.metadata?.lastSignInTime ? new Date(auth.currentUser.metadata.lastSignInTime).toLocaleString("bs-BA") : "N/A"}</td>
              </tr>
          </tbody>
        </table>
        </div>

        {/* Promjena email-a */}
        <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid #e5e7eb" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", marginBottom: "12px", textAlign: "center" }}>
            📧 Promijeni e-mail adresu
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
            <button 
              style={{ 
                ...buttonStyle, 
                width: "auto",
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: 500,
              }} 
              onClick={handleChangeEmail}
            >
              ✉️ Pošalji verifikacijski link
            </button>
            {emailMessage && (
              <p style={{ 
                color: emailMessage.includes("Greška") || emailMessage.includes("mora biti") ? "#dc2626" : "#15803d", 
                marginTop: "8px",
                fontSize: "14px",
                textAlign: "center",
                padding: "8px 16px",
                background: emailMessage.includes("Greška") || emailMessage.includes("mora biti") ? "#fee2e2" : "#dcfce7",
                borderRadius: "6px",
                border: `1px solid ${emailMessage.includes("Greška") || emailMessage.includes("mora biti") ? "#fca5a5" : "#86efac"}`,
                maxWidth: "500px"
              }}>
                {emailMessage.includes("Greška") || emailMessage.includes("mora biti") ? "⚠️ " : "✓ "}
                {emailMessage}
              </p>
            )}
            <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px", textAlign: "center" }}>
              Verifikacijski link će biti poslan na vaš trenutni e-mail ({email || "N/A"})
            </p>
          </div>
        </div>

        {/* Promjena šifre */}
        <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid #e5e7eb" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", marginBottom: "12px", textAlign: "center" }}>
            🔒 Promijeni lozinku
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
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
        </div>

        <div style={{ 
          display: "flex", 
          justifyContent: "center", 
          marginTop: "32px",
          paddingTop: "24px",
          borderTop: "2px solid #e5e7eb"
        }}>
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
  );
}