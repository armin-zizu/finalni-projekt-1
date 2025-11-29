"use client";

import React, { useState, useRef, useEffect } from "react";
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "../../lib/firebase";
import { initializeUser } from "../../lib/userInit";
import { useRouter } from "next/navigation";
import { db } from "../../lib/firestore";
import { doc, getDoc, setDoc, collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import FingerprintJS from "@fingerprintjs/fingerprintjs";

export default function LoginPage() {
  const [loginMethod, setLoginMethod] = useState<"email" | "register" | "forgot" | null>(null);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const router = useRouter();

  const handleEmailLogin = async () => {
    if (!email || !password) {
      setError("Unesi e-mail i lozinku");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Unesi valjanu e-mail adresu");
      return;
    }
    // Spriječi višestruke pozive
    if (loading) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      console.log("Pokušavam prijavu s e-mailom:", email);
      console.log("Firebase Auth Domain:", auth.config?.authDomain || 'N/A');
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;
      
      // Provjeri da li je prijava uspješna prije nego što nastaviš
      if (!user) {
        throw new Error("Prijava nije uspjela");
      }
      
      const idToken = await user.getIdToken();
      console.log("ID Token generisan:", idToken);
      console.log("Uspješan login:", user.email);

      // Provjeri da li je korisnik vlasnik (prvi korisnik)
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      const isOwner = userDoc.exists() && userDoc.data().isOwner === true;

      // Ako korisnik nije vlasnik, provjeri odobrenje
      if (!isOwner) {
        const approvalRef = doc(db, "loginApprovals", user.uid);
        const approvalDoc = await getDoc(approvalRef);
        
        if (approvalDoc.exists()) {
          const approvalData = approvalDoc.data();
          if (approvalData.status === "pending") {
            setError("Vaš zahtjev za pristup aplikaciji još nije odobren. Molimo sačekajte odobrenje od administratora.");
            setLoading(false);
            return;
          } else if (approvalData.status === "rejected") {
            setError("Vaš zahtjev za pristup aplikaciji je odbijen. Kontaktirajte administratora za više informacija.");
            setLoading(false);
            return;
          } else if (approvalData.status !== "approved") {
            setError("Nemate odobrenje za pristup aplikaciji. Molimo sačekajte odobrenje od administratora.");
            setLoading(false);
            return;
          }
        } else {
          // Ako nema dokumenta za odobrenje, blokiraj pristup
          setError("Nemate odobrenje za pristup aplikaciji. Molimo sačekajte odobrenje od administratora.");
          setLoading(false);
          return;
        }
      }

      // Provjeri da li je uređaj blokiran ili zahtijeva verifikaciju
      try {
        let deviceId = localStorage.getItem("deviceId");
        if (!deviceId) {
          // Generiši deviceId ako ne postoji
          const fp = await FingerprintJS.load();
          const result = await fp.get();
          deviceId = result.visitorId;
          localStorage.setItem("deviceId", deviceId);
        }

        if (deviceId) {
          const deviceRef = doc(db, "devices", deviceId);
          const deviceDoc = await getDoc(deviceRef);
          
          if (deviceDoc.exists()) {
            const deviceData = deviceDoc.data();
            const isBlocked = deviceData.isBlocked === true;
            const status = deviceData.status || (deviceData.role === null ? "verifikacija" : "approved");
            const needsVerification = status === "verifikacija";
            
            if (isBlocked) {
              setError("Ovaj uređaj je blokiran. Kontaktirajte administratora za više informacija.");
              setLoading(false);
              return;
            } else if (needsVerification) {
              setError("⏳ Čekanje na odobrenje od administratora. Vaš zahtjev za pristup sa ovog uređaja je poslan administratoru. Molimo sačekajte odobrenje prije pristupa aplikaciji.");
              setLoading(false);
              return;
            }
          } else {
            // Novi uređaj - provjeri da li korisnik već ima druge uređaje
            try {
              const devicesQuery = query(collection(db, "devices"), where("userId", "==", user.uid));
              const devicesSnapshot = await getDocs(devicesQuery);
              
              // Ako korisnik već ima druge uređaje, novi uređaj zahtijeva verifikaciju
              if (!devicesSnapshot.empty) {
                // Kreiraj novi uređaj sa statusom "verifikacija"
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

                await setDoc(deviceRef, {
                  userId: user.uid,
                  userEmail: user.email,
                  role: null,
                  status: "verifikacija",
                  isBlocked: false,
                  deviceInfo: {
                    deviceId: deviceId,
                    browser,
                    os,
                    screenSize: `${screen.width}x${screen.height}`,
                    userAgent: navigator.userAgent,
                    firstSeen: Timestamp.fromDate(new Date()),
                    lastLogin: Timestamp.fromDate(new Date()),
                  },
                  lastLogin: Timestamp.fromDate(new Date()),
                  createdAt: Timestamp.fromDate(new Date()),
                  updatedAt: Timestamp.fromDate(new Date()),
                });

                setError("⏳ Čekanje na odobrenje od administratora. Vaš zahtjev za pristup sa ovog uređaja je poslan administratoru. Molimo sačekajte odobrenje prije pristupa aplikaciji.");
                setLoading(false);
                return;
              }
              // Ako je prvi uređaj, dozvoli pristup (uređaj će se kreirati u RoleContext)
            } catch (queryError) {
              console.error("Greška pri provjeri drugih uređaja:", queryError);
              // U slučaju greške, dozvoli pristup (fallback)
            }
          }
        }
      } catch (deviceError) {
        console.error("Greška pri provjeri uređaja:", deviceError);
        // U slučaju greške, dozvoli pristup (fallback)
      }

      // Dohvati IP adresu i lokaciju pri login-u
      try {
        const ipResponse = await fetch("https://ip-api.com/json/?fields=status,message,query,country,regionName,city,isp");
        const ipData = await ipResponse.json();
        
        let ipInfo = {
          ip: "N/A",
          location: "Nepoznata lokacija",
          isp: "N/A"
        };
        
        if (ipData.status === "success") {
          ipInfo = {
            ip: ipData.query,
            location: `${ipData.city || ""}, ${ipData.regionName || ""}, ${ipData.country || ""}`.replace(/^,\s*|,\s*$/g, "").trim() || "Nepoznata lokacija",
            isp: ipData.isp || "N/A"
          };
        } else {
          // Fallback na ipify
          const fallbackResponse = await fetch("https://api.ipify.org?format=json");
          const fallbackData = await fallbackResponse.json();
          ipInfo.ip = fallbackData.ip;
        }
        
        // Spremi IP info u localStorage za kasnije korištenje
        localStorage.setItem("lastLoginIP", JSON.stringify({
          ...ipInfo,
          timestamp: Date.now(),
          userEmail: user.email
        }));
      } catch (ipError) {
        console.error("Greška pri dohvaćanju IP adrese:", ipError);
        // Nastavi sa login-om čak i ako IP dohvat ne uspije
      }

      // Session management se rješava automatski kroz Firebase Auth
      // API route nije potreban za static export
      console.log("Login uspješan, preusmjeravam na dashboard");
      setLoading(false);
      router.push("/dashboard");
    } catch (err: any) {
      // Ignoriraj grešku ako je korisnik već prijavljen (može se desiti zbog race condition)
      if (auth.currentUser && auth.currentUser.email === email) {
        console.log("Korisnik je već prijavljen, preusmjeravam na dashboard");
        setLoading(false);
        router.push("/dashboard");
        return;
      }
      
      // Ignoriraj invalid-credential grešku ako je korisnik već prijavljen
      if (err.code === "auth/invalid-credential" && auth.currentUser) {
        console.log("Greška ignorirana - korisnik je već prijavljen");
        setLoading(false);
        router.push("/dashboard");
        return;
      }
      
      // Ignoriraj grešku ako je korisnik već prijavljen (race condition)
      if (auth.currentUser) {
        console.log("Korisnik je već prijavljen, ignoriranje greške");
        setLoading(false);
        router.push("/dashboard");
        return;
      }
      
      console.error("Greška pri e-mail prijavi:", err);
      
      if (err.code === "auth/configuration-not-found") {
        setError("Email/Password autentifikacija nije omogućena u Firebase Console. Otvori: https://console.firebase.google.com/project/zadnji-projekt/authentication/providers i omogući Email/Password sign-in method.");
      } else if (err.code === "auth/user-not-found") {
        setError("Korisnik s ovim e-mailom ne postoji. Registriraj se.");
      } else if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setError("Pogrešna lozinka. Pokušaj ponovo.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Previše pokušaja. Pokušaj ponovo kasnije.");
      } else {
        // Prikaži grešku samo ako nije invalid-credential (koja se može desiti zbog race condition)
        if (err.code !== "auth/invalid-credential") {
          setError(err.message || "Greška pri prijavi. Provjeri e-mail i lozinku.");
        }
      }
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword) {
      setError("Unesi e-mail, lozinku i potvrdu lozinke");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Unesi valjanu e-mail adresu");
      return;
    }
    if (password.length < 6) {
      setError("Lozinka mora imati najmanje 6 znakova");
      return;
    }
    if (password !== confirmPassword) {
      setError("Lozinke se ne podudaraju");
      return;
    }
    setLoading(true);
    setError("");
    try {
      console.log("Pokušavam registraciju s e-mailom:", email);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const user = result.user;
      const idToken = await user.getIdToken();
      console.log("ID Token generisan:", idToken);
      console.log("Uspješna registracija:", user.email);

      // Kreiraj početnu strukturu za novog korisnika u Firestore
      try {
        await initializeUser(user.uid, user.email);
        console.log("Korisnik inicijalizovan u Firestore");
      } catch (initError) {
        console.error("Greška pri inicijalizaciji korisnika (nastavljam):", initError);
        // Nastavi sa registracijom čak i ako inicijalizacija ne uspije
      }

      // Dohvati IP adresu i lokaciju pri registraciji
      try {
        const ipResponse = await fetch("https://ip-api.com/json/?fields=status,message,query,country,regionName,city,isp");
        const ipData = await ipResponse.json();
        
        let ipInfo = {
          ip: "N/A",
          location: "Nepoznata lokacija",
          isp: "N/A"
        };
        
        if (ipData.status === "success") {
          ipInfo = {
            ip: ipData.query,
            location: `${ipData.city || ""}, ${ipData.regionName || ""}, ${ipData.country || ""}`.replace(/^,\s*|,\s*$/g, "").trim() || "Nepoznata lokacija",
            isp: ipData.isp || "N/A"
          };
        } else {
          // Fallback na ipify
          const fallbackResponse = await fetch("https://api.ipify.org?format=json");
          const fallbackData = await fallbackResponse.json();
          ipInfo.ip = fallbackData.ip;
        }
        
        // Spremi IP info u localStorage za kasnije korištenje
        localStorage.setItem("lastLoginIP", JSON.stringify({
          ...ipInfo,
          timestamp: Date.now(),
          userEmail: user.email
        }));
      } catch (ipError) {
        console.error("Greška pri dohvaćanju IP adrese:", ipError);
        // Nastavi sa registracijom čak i ako IP dohvat ne uspije
      }

      // Session management se rješava automatski kroz Firebase Auth
      // API route nije potreban za static export
      console.log("Registracija uspješna, preusmjeravam na dashboard");
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Greška pri registraciji:", err);
      if (err.code === "auth/email-already-in-use") {
        setError("Ovaj e-mail je već registriran. Pokušaj se prijaviti.");
      } else {
        setError(err.message || "Greška pri registraciji. Pokušaj ponovo.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Unesi e-mail za reset lozinke");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Unesi valjanu e-mail adresu");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Link za reset lozinke poslan na vaš e-mail!");
    } catch (err: any) {
      console.error("Greška pri resetu lozinke:", err);
      setError(err.message || "Greška pri slanju linka za reset. Pokušaj ponovo.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setLoginMethod(null);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setMessage("");
  };

  return (
    <div style={{ 
      minHeight: "100vh", 
      width: "100vw", 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center", 
      padding: "20px",
      boxSizing: "border-box",
      position: "relative"
    }}>
      {/* Pozadinska slika sa opacity */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: "url('/background.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        opacity: 0.7,
        zIndex: 0
      }} />
      
      {/* Fade overlay - tamni overlay za kontrast */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        zIndex: 1
      }} />
      
      <div style={{ 
        padding: "40px", 
        background: "rgba(255, 255, 255, 0.95)", 
        borderRadius: "12px", 
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)", 
        textAlign: "center", 
        maxWidth: "450px", 
        width: "100%",
        margin: "0 auto",
        position: "relative",
        zIndex: 2,
        backdropFilter: "blur(10px)"
      }}>
        <style jsx>{`
          @media (max-width: 768px) {
            h1 {
              font-size: 24px;
              margin-bottom: 24px;
            }
            div[style*='padding: 40px'] {
              padding: 24px;
            }
            input {
              width: 100%;
              margin: 12px 0;
              padding: 12px;
              font-size: 16px;
              min-height: 48px;
              box-sizing: border-box;
            }
            button {
              width: 100%;
              margin: 8px 0;
              padding: 12px;
              font-size: 16px;
              min-height: 48px;
              box-sizing: border-box;
            }
          }
          @media (min-width: 769px) {
            input {
              margin: 12px 0;
              padding: 12px;
              font-size: 16px;
            }
            button {
              margin: 8px 0;
              padding: 12px;
              font-size: 16px;
            }
          }
        `}</style>
        <h1 style={{ marginBottom: "32px", fontSize: "28px", fontWeight: 600, color: "#1f2937" }}>
          {loginMethod === "register" ? "Registracija" : loginMethod === "forgot" ? "Reset lozinke" : "Prijava"}
        </h1>
        {error && (
          <div style={{ 
            color: "#dc2626", 
            marginBottom: "16px", 
            padding: "12px 16px", 
            background: "#fef2f2", 
            borderRadius: "8px",
            border: "1px solid #fecaca",
            fontSize: "14px"
          }}>
            {error}
            {error.includes("e-mail je već registriran") && (
              <div>
                <button
                  onClick={() => setLoginMethod("email")}
                  style={{ marginTop: "10px", padding: "5px 10px", background: "#4285f4", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}
                >
                  Prijavi se
                </button>
              </div>
            )}
            {error.includes("Korisnik s ovim e-mailom ne postoji") && (
              <div>
                <button
                  onClick={() => setLoginMethod("register")}
                  style={{ marginTop: "10px", padding: "5px 10px", background: "#fbbc05", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}
                >
                  Registriraj se
                </button>
              </div>
            )}
          </div>
        )}
        {message && (
          <div style={{ 
            color: "#16a34a", 
            marginBottom: "16px", 
            padding: "12px 16px", 
            background: "#f0fdf4", 
            borderRadius: "8px",
            border: "1px solid #bbf7d0",
            fontSize: "14px"
          }}>
            {message}
          </div>
        )}
        {!loginMethod ? (
          <>
            <button
              onClick={() => setLoginMethod("email")}
              style={{ 
                width: "100%", 
                padding: "12px 16px", 
                background: "#34a853", 
                color: "white", 
                border: "none", 
                borderRadius: "8px", 
                marginBottom: "12px", 
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: 500,
                transition: "background-color 0.2s",
                boxSizing: "border-box"
              }}
            >
              Prijava putem e-maila
            </button>
            <button
              onClick={() => setLoginMethod("register")}
              style={{ 
                width: "100%", 
                padding: "12px 16px", 
                background: "#fbbc05", 
                color: "white", 
                border: "none", 
                borderRadius: "8px", 
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: 500,
                transition: "background-color 0.2s",
                boxSizing: "border-box"
              }}
            >
              Registracija
            </button>
          </>
        ) : loginMethod === "email" ? (
          <>
            <input
              type="email"
              placeholder="Unesi e-mail adresu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ 
                width: "100%", 
                padding: "12px 16px", 
                margin: "12px 0", 
                borderRadius: "8px", 
                border: "1px solid #d1d5db",
                fontSize: "16px",
                outline: "none",
                transition: "border-color 0.2s",
                boxSizing: "border-box"
              }}
              onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
              onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
            />
            <input
              type="password"
              placeholder="Unesi lozinku"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ 
                width: "100%", 
                padding: "12px 16px", 
                margin: "12px 0", 
                borderRadius: "8px", 
                border: "1px solid #d1d5db",
                fontSize: "16px",
                outline: "none",
                transition: "border-color 0.2s",
                boxSizing: "border-box"
              }}
              onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
              onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
            />
            <button 
              onClick={handleEmailLogin} 
              disabled={loading || !email || !password}
              style={{ 
                width: "100%", 
                padding: "12px 16px", 
                background: loading || !email || !password ? "#9ca3af" : "#34a853", 
                color: "white", 
                border: "none", 
                borderRadius: "8px", 
                cursor: (loading || !email || !password) ? "not-allowed" : "pointer",
                fontSize: "16px",
                fontWeight: 500,
                marginTop: "8px",
                transition: "background-color 0.2s",
                boxSizing: "border-box"
              }}
            >
              {loading ? "Prijavljujem..." : "Prijavi se"}
            </button>
            <button 
              onClick={() => setLoginMethod("forgot")}
              style={{ 
                width: "100%", 
                padding: "12px 16px", 
                background: "#4285f4", 
                color: "white", 
                border: "none", 
                borderRadius: "8px", 
                marginTop: "8px",
                fontSize: "16px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "background-color 0.2s",
                boxSizing: "border-box"
              }}
            >
              Zaboravio sam lozinku
            </button>
            <button 
              onClick={handleBack} 
              style={{ 
                width: "100%", 
                padding: "12px 16px", 
                background: "#6b7280", 
                color: "white", 
                border: "none", 
                borderRadius: "8px", 
                marginTop: "8px",
                fontSize: "16px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "background-color 0.2s",
                boxSizing: "border-box"
              }}
            >
              Nazad
            </button>
          </>
        ) : loginMethod === "register" ? (
          <>
            <input
              type="email"
              placeholder="Unesi e-mail adresu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ 
                width: "100%", 
                padding: "12px 16px", 
                margin: "12px 0", 
                borderRadius: "8px", 
                border: "1px solid #d1d5db",
                fontSize: "16px",
                outline: "none",
                transition: "border-color 0.2s",
                boxSizing: "border-box"
              }}
              onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
              onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
            />
            <input
              type="password"
              placeholder="Unesi lozinku"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ 
                width: "100%", 
                padding: "12px 16px", 
                margin: "12px 0", 
                borderRadius: "8px", 
                border: "1px solid #d1d5db",
                fontSize: "16px",
                outline: "none",
                transition: "border-color 0.2s",
                boxSizing: "border-box"
              }}
              onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
              onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
            />
            <input
              type="password"
              placeholder="Potvrdi lozinku"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ 
                width: "100%", 
                padding: "12px 16px", 
                margin: "12px 0", 
                borderRadius: "8px", 
                border: "1px solid #d1d5db",
                fontSize: "16px",
                outline: "none",
                transition: "border-color 0.2s",
                boxSizing: "border-box"
              }}
              onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
              onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
            />
            <button 
              onClick={handleRegister} 
              disabled={loading || !email || !password || !confirmPassword}
              style={{ 
                width: "100%", 
                padding: "12px 16px", 
                background: loading || !email || !password || !confirmPassword ? "#9ca3af" : "#fbbc05", 
                color: "white", 
                border: "none", 
                borderRadius: "8px", 
                cursor: (loading || !email || !password || !confirmPassword) ? "not-allowed" : "pointer",
                fontSize: "16px",
                fontWeight: 500,
                marginTop: "8px",
                transition: "background-color 0.2s",
                boxSizing: "border-box"
              }}
            >
              {loading ? "Registrujem..." : "Registriraj se"}
            </button>
            <button 
              onClick={handleBack} 
              style={{ 
                width: "100%", 
                padding: "12px 16px", 
                background: "#6b7280", 
                color: "white", 
                border: "none", 
                borderRadius: "8px", 
                marginTop: "8px",
                fontSize: "16px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "background-color 0.2s",
                boxSizing: "border-box"
              }}
            >
              Nazad
            </button>
          </>
        ) : loginMethod === "forgot" ? (
          <>
            <input
              type="email"
              placeholder="Unesi e-mail adresu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ 
                width: "100%", 
                padding: "12px 16px", 
                margin: "12px 0", 
                borderRadius: "8px", 
                border: "1px solid #d1d5db",
                fontSize: "16px",
                outline: "none",
                transition: "border-color 0.2s",
                boxSizing: "border-box"
              }}
              onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
              onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
            />
            <button 
              onClick={handleForgotPassword} 
              disabled={loading || !email}
              style={{ 
                width: "100%", 
                padding: "12px 16px", 
                background: loading || !email ? "#9ca3af" : "#4285f4", 
                color: "white", 
                border: "none", 
                borderRadius: "8px", 
                cursor: (loading || !email) ? "not-allowed" : "pointer",
                fontSize: "16px",
                fontWeight: 500,
                marginTop: "8px",
                transition: "background-color 0.2s",
                boxSizing: "border-box"
              }}
            >
              {loading ? "Šaljem link..." : "Pošalji link za reset"}
            </button>
            <button 
              onClick={handleBack} 
              style={{ 
                width: "100%", 
                padding: "12px 16px", 
                background: "#6b7280", 
                color: "white", 
                border: "none", 
                borderRadius: "8px", 
                marginTop: "8px",
                fontSize: "16px",
                fontWeight: 500,
                cursor: "pointer",
                transition: "background-color 0.2s",
                boxSizing: "border-box"
              }}
            >
              Nazad
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}