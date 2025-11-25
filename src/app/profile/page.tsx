"use client";

import React, { useState, useEffect } from "react";
import { auth, sendPasswordResetEmail, signOut, sendEmailVerification } from "../../lib/firebase";
import { useAppName } from "../context/AppNameContext";
import { useSubscription } from "../context/SubscriptionContext";
import { useRouter, useSearchParams } from "next/navigation";
import jsPDF from "jspdf";

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
  const [profitPassword, setProfitPassword] = useState("");
  const [cjenovnikPassword, setCjenovnikPassword] = useState("");
  const [profitPasswordInput, setProfitPasswordInput] = useState("");
  const [cjenovnikPasswordInput, setCjenovnikPasswordInput] = useState("");
  const [profitOldPassword, setProfitOldPassword] = useState("");
  const [cjenovnikOldPassword, setCjenovnikOldPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const { subscription, loading: subscriptionLoading, addPayment, updateMonthlyPrice } = useSubscription();
  const [newPaymentAmount, setNewPaymentAmount] = useState("");
  const [newPaymentNote, setNewPaymentNote] = useState("");
  const [subscriptionMessage, setSubscriptionMessage] = useState("");
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [monthlyPrice, setMonthlyPrice] = useState("12");
  const [selectedMonths, setSelectedMonths] = useState(1);
  const router = useRouter();

  // Sinhronizuj localAppName sa appName iz contexta
  useEffect(() => {
    setLocalAppName(appName);
  }, [appName]);

  // Učitaj postojeće šifre
  useEffect(() => {
    const savedProfitPassword = localStorage.getItem("profitPassword");
    const savedCjenovnikPassword = localStorage.getItem("cjenovnikPassword");
    if (savedProfitPassword) {
      setProfitPassword("••••••••"); // Prikaži placeholder
    }
    if (savedCjenovnikPassword) {
      setCjenovnikPassword("••••••••"); // Prikaži placeholder
    }
  }, []);

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

      if (!activeSession) {
        // Ako nema IP info iz login-a, dohvati ga sada
        if (ipInfo.ip === "N/A") {
          fetchIPAndLocation().then(({ ip, location, isp }) => {
            ipInfo = { ip, location, isp };
            createSession(ipInfo);
          });
        } else {
          createSession(ipInfo);
        }
      } else {
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

    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setEmailMessage("Unesite valjanu e-mail adresu!");
      setTimeout(() => setEmailMessage(""), 5000);
      return;
    }

    if (newEmail === user.email) {
      setEmailMessage("Nova e-mail adresa mora biti različita od trenutne!");
      setTimeout(() => setEmailMessage(""), 5000);
      return;
    }

    try {
      // Pošalji verifikacijski link na trenutni email
      await sendEmailVerification(user);
      setEmailMessage(`Verifikacijski link je poslan na vaš trenutni e-mail (${user.email}). Molimo provjerite inbox i kliknite na link prije promjene e-mail adrese.`);
      setNewEmail("");
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
              {sessions.map((session) => (
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

      <div style={{ marginBottom: "32px", border: "2px solid #e5e7eb", borderRadius: "12px", padding: "16px", background: "#f9fafb" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "16px" }}>
          Postavke aplikacije
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937", marginBottom: "4px" }}>Automatsko spremanje</p>
              <p style={{ fontSize: "12px", color: "#6b7280" }}>Automatski spremi promjene u localStorage</p>
            </div>
            <span style={{ color: "#16a34a", fontSize: "14px", fontWeight: 500 }}>✓ Omogućeno</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937", marginBottom: "4px" }}>Offline režim</p>
              <p style={{ fontSize: "12px", color: "#6b7280" }}>Aplikacija radi bez internetske veze</p>
            </div>
            <span style={{ color: "#16a34a", fontSize: "14px", fontWeight: 500 }}>✓ Omogućeno</span>
          </div>
        </div>
      </div>

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

      <div style={{ marginBottom: "32px", border: "2px solid #e5e7eb", borderRadius: "12px", padding: "16px", background: "#f9fafb" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "16px" }}>
          Backup i export
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <button
            onClick={() => setShowBackupFilters(!showBackupFilters)}
            style={{ ...buttonStyle, background: showBackupFilters ? "#6b7280" : "#3b82f6" }}
          >
            {showBackupFilters ? "Sakrij filtere" : "Odaberi period za backup"}
          </button>
          
          {showBackupFilters && (
            <div style={{ padding: "16px", background: "#fff", borderRadius: "8px", border: "1px solid #e5e7eb", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <label style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937" }}>Od datuma:</label>
                <input
                  type="date"
                  value={backupFromDate}
                  onChange={(e) => setBackupFromDate(e.target.value)}
                  style={{ ...inputStyle, width: "auto" }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <label style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937" }}>Do datuma:</label>
                <input
                  type="date"
                  value={backupToDate}
                  onChange={(e) => setBackupToDate(e.target.value)}
                  style={{ ...inputStyle, width: "auto" }}
                />
              </div>
              <button
                onClick={() => {
                  setBackupFromDate("");
                  setBackupToDate("");
                }}
                style={{ ...buttonStyle, background: "#6b7280", width: "auto" }}
              >
                Resetuj filtere
              </button>
            </div>
          )}

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
            style={buttonStyle}
          >
            Preuzmi backup podataka (PDF)
          </button>
          {backupMessage && (
            <p style={{ fontSize: "14px", color: "#16a34a", marginTop: "8px", fontWeight: 500 }}>
              {backupMessage}
            </p>
          )}
          <p style={{ fontSize: "12px", color: "#6b7280" }}>
            {backupFromDate || backupToDate 
              ? `Preuzmite podatke za period: ${backupFromDate || "početak"} - ${backupToDate || "kraj"}`
              : "Preuzmite sve podatke (arhiva i cjenovnik) kao PDF fajl"}
          </p>
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
                      ? `Trial period ističe za ${subscription.daysRemaining} ${subscription.daysRemaining === 1 ? "dan" : "dana"}`
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
                    statusText = `Trial (${subscription.daysRemaining} dana)`;
                    statusColor = "#3b82f6";
                    statusBg = "#dbeafe";
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
                  {isEditingPrice ? (
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        type="number"
                        value={monthlyPrice}
                        onChange={(e) => setMonthlyPrice(e.target.value)}
                        style={{ ...inputStyle, width: "120px" }}
                        placeholder="Cijena"
                        min="0"
                        step="0.01"
                      />
                      <span style={{ fontSize: "14px", color: "#1f2937" }}>KM</span>
                      <button style={buttonStyle} onClick={async () => {
                        try {
                          await updateMonthlyPrice(Number(monthlyPrice));
                          setIsEditingPrice(false);
                          setSubscriptionMessage("Cijena je ažurirana!");
                          setTimeout(() => setSubscriptionMessage(""), 3000);
                        } catch (error) {
                          setSubscriptionMessage("Greška pri ažuriranju cijene");
                        }
                      }}>
                        Spremi
                      </button>
                      <button
                        style={{ ...buttonStyle, background: "#6b7280" }}
                        onClick={() => {
                          setIsEditingPrice(false);
                          setMonthlyPrice(String(subscription.monthlyPrice));
                        }}
                      >
                        Odustani
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <p style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937" }}>
                        {subscription.monthlyPrice.toFixed(2)} KM
                      </p>
                      <button
                        style={{ ...buttonStyle, padding: "4px 8px", fontSize: "12px" }}
                        onClick={() => {
                          setIsEditingPrice(true);
                          setMonthlyPrice(String(subscription.monthlyPrice));
                        }}
                      >
                        Uredi
                      </button>
                    </div>
                  )}
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
                    {auth.currentUser ? `REF-${auth.currentUser.uid.substring(0, 8).toUpperCase()}-${selectedMonths}` : "N/A"}
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

      <div style={{ marginBottom: "32px", border: "2px solid #e5e7eb", borderRadius: "12px", padding: "16px", background: "#f9fafb" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1f2937", marginBottom: "16px" }}>
          Postavke šifri za zaštićene stranice
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <label style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937", display: "block", marginBottom: "8px" }}>
              Šifra za Profit stranicu:
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {localStorage.getItem("profitPassword") && (
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    type="password"
                    value={profitOldPassword}
                    onChange={(e) => setProfitOldPassword(e.target.value)}
                    placeholder="Stara šifra"
                    style={{ ...inputStyle, width: "250px" }}
                  />
                </div>
              )}
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="password"
                  value={profitPasswordInput}
                  onChange={(e) => setProfitPasswordInput(e.target.value)}
                  placeholder={localStorage.getItem("profitPassword") ? "Nova šifra (min. 4 znaka)" : "Postavite šifru (min. 4 znaka)"}
                  style={{ ...inputStyle, width: "250px" }}
                />
                <button
                  onClick={() => {
                    const savedPassword = localStorage.getItem("profitPassword");
                    
                    if (savedPassword) {
                      // Provjeri staru šifru
                      if (profitOldPassword !== savedPassword) {
                        setMessage("Pogrešna stara šifra!");
                        return;
                      }
                    }
                    
                    if (profitPasswordInput.trim().length >= 4) {
                      localStorage.setItem("profitPassword", profitPasswordInput);
                      setProfitPassword("••••••••");
                      setProfitPasswordInput("");
                      setProfitOldPassword("");
                      setMessage("Šifra za Profit uspješno " + (savedPassword ? "promijenjena" : "postavljena") + "!");
                      setTimeout(() => setMessage(""), 3000);
                    } else {
                      setMessage("Šifra mora imati najmanje 4 znaka!");
                    }
                  }}
                  style={buttonStyle}
                >
                  {localStorage.getItem("profitPassword") ? "Promijeni šifru" : "Postavi šifru"}
                </button>
                {localStorage.getItem("profitPassword") && (
                  <>
                    <button
                      onClick={() => {
                        const savedPassword = localStorage.getItem("profitPassword");
                        if (!profitOldPassword) {
                          setMessage("Unesite trenutnu šifru da biste uklonili zaštitu!");
                          return;
                        }
                        if (profitOldPassword !== savedPassword) {
                          setMessage("Pogrešna šifra! Ne možete ukloniti zaštitu.");
                          return;
                        }
                        // Ukloni šifru
                        localStorage.removeItem("profitPassword");
                        setProfitPassword("");
                        setProfitPasswordInput("");
                        setProfitOldPassword("");
                        setMessage("Šifra za Profit uspješno uklonjena!");
                        setTimeout(() => setMessage(""), 3000);
                      }}
                      style={{ ...buttonStyle, background: "#dc2626" }}
                    >
                      Ukloni šifru
                    </button>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>
                      Trenutno: {profitPassword}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <div>
            <label style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937", display: "block", marginBottom: "8px" }}>
              Šifra za Cjenovnik stranicu:
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {localStorage.getItem("cjenovnikPassword") && (
                <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    type="password"
                    value={cjenovnikOldPassword}
                    onChange={(e) => setCjenovnikOldPassword(e.target.value)}
                    placeholder="Stara šifra"
                    style={{ ...inputStyle, width: "250px" }}
                  />
                </div>
              )}
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="password"
                  value={cjenovnikPasswordInput}
                  onChange={(e) => setCjenovnikPasswordInput(e.target.value)}
                  placeholder={localStorage.getItem("cjenovnikPassword") ? "Nova šifra (min. 4 znaka)" : "Postavite šifru (min. 4 znaka)"}
                  style={{ ...inputStyle, width: "250px" }}
                />
                <button
                  onClick={() => {
                    const savedPassword = localStorage.getItem("cjenovnikPassword");
                    
                    if (savedPassword) {
                      // Provjeri staru šifru
                      if (cjenovnikOldPassword !== savedPassword) {
                        setMessage("Pogrešna stara šifra!");
                        return;
                      }
                    }
                    
                    if (cjenovnikPasswordInput.trim().length >= 4) {
                      localStorage.setItem("cjenovnikPassword", cjenovnikPasswordInput);
                      setCjenovnikPassword("••••••••");
                      setCjenovnikPasswordInput("");
                      setCjenovnikOldPassword("");
                      setMessage("Šifra za Cjenovnik uspješno " + (savedPassword ? "promijenjena" : "postavljena") + "!");
                      setTimeout(() => setMessage(""), 3000);
                    } else {
                      setMessage("Šifra mora imati najmanje 4 znaka!");
                    }
                  }}
                  style={buttonStyle}
                >
                  {localStorage.getItem("cjenovnikPassword") ? "Promijeni šifru" : "Postavi šifru"}
                </button>
                {localStorage.getItem("cjenovnikPassword") && (
                  <>
                    <button
                      onClick={() => {
                        const savedPassword = localStorage.getItem("cjenovnikPassword");
                        if (!cjenovnikOldPassword) {
                          setMessage("Unesite trenutnu šifru da biste uklonili zaštitu!");
                          return;
                        }
                        if (cjenovnikOldPassword !== savedPassword) {
                          setMessage("Pogrešna šifra! Ne možete ukloniti zaštitu.");
                          return;
                        }
                        // Ukloni šifru
                        localStorage.removeItem("cjenovnikPassword");
                        setCjenovnikPassword("");
                        setCjenovnikPasswordInput("");
                        setCjenovnikOldPassword("");
                        setMessage("Šifra za Cjenovnik uspješno uklonjena!");
                        setTimeout(() => setMessage(""), 3000);
                      }}
                      style={{ ...buttonStyle, background: "#dc2626" }}
                    >
                      Ukloni šifru
                    </button>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>
                      Trenutno: {cjenovnikPassword}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

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
          <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", marginBottom: "12px" }}>
            Promijeni e-mail adresu
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value);
                setEmailMessage("");
              }}
              style={inputStyle}
              placeholder="Unesite novu e-mail adresu"
            />
            <button style={buttonStyle} onClick={handleChangeEmail}>
              Pošalji verifikacijski link
            </button>
          </div>
          {emailMessage && (
            <p style={{ 
              color: emailMessage.includes("Greška") || emailMessage.includes("mora biti") ? "#dc2626" : "#15803d", 
              marginTop: "8px",
              fontSize: "14px"
            }}>
              {emailMessage}
            </p>
          )}
          <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "8px" }}>
            Verifikacijski link će biti poslan na vaš trenutni e-mail ({email || "N/A"})
          </p>
        </div>

        {/* Promjena šifre */}
        <div style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid #e5e7eb" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", marginBottom: "12px" }}>
            Promijeni lozinku
          </h3>
          <button style={buttonStyle} onClick={handleChangePassword}>
            Pošalji link za promjenu lozinke
          </button>
          {message && message.includes("lozinke") && (
            <p style={{ 
              color: message.includes("Greška") ? "#dc2626" : "#15803d", 
              marginTop: "8px",
              fontSize: "14px"
            }}>
              {message}
            </p>
          )}
          <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "8px" }}>
            Link za promjenu lozinke će biti poslan na vaš e-mail ({email || "N/A"})
          </p>
        </div>

        <button
          onClick={handleLogout}
          style={{
            ...buttonStyle,
            background: "#dc2626",
            marginTop: "24px",
            width: "100%",
          }}
        >
          Odjava
        </button>
      </div>
    </div>
  );
}