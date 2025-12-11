"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { useRole } from "../context/RoleContext";
import { setAuthToken, getDeviceByDeviceId, saveDevice, getUserDevices } from "../../lib/api";

export default function LoginPage() {
  const [loginMethod, setLoginMethod] = useState<"email" | "register" | "forgot" | null>(null);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const router = useRouter();
  const { refreshRole } = useRole();

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
      
      // API login poziv umjesto Firebase Auth
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!loginResponse.ok) {
        const errorData = await loginResponse.json();
        throw new Error(errorData.error || 'Prijava nije uspjela');
      }

      const loginData = await loginResponse.json();
      const user = loginData.user;
      const token = loginData.token;
      
      // Provjeri da li je prijava uspješna prije nego što nastaviš
      if (!user || !token) {
        throw new Error("Prijava nije uspjela");
      }
      
      // Sačuvaj token u localStorage
      setAuthToken(token);
      console.log("Token sačuvan u localStorage");
      
      // Verificiraj da je token sačuvan
      const savedToken = localStorage.getItem('token');
      if (!savedToken) {
        console.error("GREŠKA: Token nije sačuvan u localStorage!");
      } else {
        console.log("Token uspješno verificiran u localStorage");
      }
      
      console.log("Uspješan login:", user.email);
      console.log("User ID:", user.id);

      // Koristimo podatke iz API odgovora
      const isOwner = user.isOwner === true;

      // Provjeri status uređaja prije dozvoljavanja pristupa
      try {
        // Generiši deviceId
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        const deviceId = result.visitorId;

        if (deviceId) {
          // Dohvati device info
          const os = typeof navigator !== "undefined" && navigator.userAgent.includes("Windows")
            ? "Windows"
            : typeof navigator !== "undefined" && navigator.userAgent.includes("Mac")
            ? "macOS"
            : typeof navigator !== "undefined" && navigator.userAgent.includes("Linux")
            ? "Linux"
            : typeof navigator !== "undefined" && navigator.userAgent.includes("Android")
            ? "Android"
            : typeof navigator !== "undefined" && navigator.userAgent.includes("iOS")
            ? "iOS"
            : "Unknown";
          
          const browser = typeof navigator !== "undefined" && navigator.userAgent.includes("Chrome")
            ? "Chrome"
            : typeof navigator !== "undefined" && navigator.userAgent.includes("Firefox")
            ? "Firefox"
            : typeof navigator !== "undefined" && navigator.userAgent.includes("Safari")
            ? "Safari"
            : typeof navigator !== "undefined" && navigator.userAgent.includes("Edge")
            ? "Edge"
            : "Unknown";

          const deviceInfo = {
            deviceId: deviceId,
            browser,
            os,
            screenSize: typeof screen !== "undefined" ? `${screen.width}x${screen.height}` : "0x0",
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
            firstSeen: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
          };

          const isOwnerDevice = user.email === "gitara.zizu@gmail.com" && os === "Windows";
          
          // Provjeri postojeći uređaj preko API-ja
          const existingDevice = await getDeviceByDeviceId(user.id, deviceId);
          
          if (existingDevice) {
            const isBlocked = existingDevice.isBlocked === true;
            const status = existingDevice.status || (existingDevice.role === null ? "verifikacija" : "approved");
            const needsVerification = status === "verifikacija";
            
            console.log("Login - Provjera statusa uređaja:", { deviceId, status, isBlocked, needsVerification, isOwnerDevice });
            
            if (isBlocked) {
              setError("Ovaj uređaj je blokiran. Kontaktirajte administratora za više informacija.");
              setLoading(false);
              return;
            } else if (needsVerification && !isOwnerDevice) {
              setError("⏳ Čekanje na odobrenje od administratora. Vaš zahtjev za pristup sa ovog uređaja je poslan administratoru. Molimo sačekajte odobrenje prije pristupa aplikaciji.");
              setLoading(false);
              return;
            }

            // Ažuriraj lastLogin
            await saveDevice(user.id, {
              deviceId,
              deviceInfo: { ...deviceInfo, firstSeen: existingDevice.deviceInfo?.firstSeen || deviceInfo.firstSeen },
            });
          } else {
            // Novi uređaj - provjeri da li korisnik već ima druge uređaje
            try {
              const userDevices = await getUserDevices(user.id);
              
              console.log("Login - Provjera drugih uređaja - broj uređaja:", userDevices.length, "isOwner:", isOwner);
              
              // Provjeri da li je ovo prvi uređaj za korisnika
              if (userDevices.length === 0) {
                // Prvi uređaj - ako je vlasnik, automatski odobri
                if (isOwner) {
                  console.log("Login - Vlasnik sa prvim uređajem, automatski odobravam");
                  
                  await saveDevice(user.id, {
                    deviceId,
                    deviceName: `${browser} on ${os}`,
                    deviceInfo,
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
                  
                  console.log("Login - Device kreiran za vlasnika (prvi uređaj) sa role = vlasnik, status = approved");
                } else {
                  // Nije vlasnik, ali je prvi uređaj - zahtijeva verifikaciju
                  console.log("Login - Nije vlasnik, prvi uređaj zahtijeva verifikaciju");
                  
                  await saveDevice(user.id, {
                    deviceId,
                    deviceName: `${browser} on ${os}`,
                    deviceInfo,
                    role: null,
                    status: "verifikacija",
                    isBlocked: false,
                  });

                  console.log("Login - Device kreiran sa statusom 'verifikacija' (nije vlasnik, prvi uređaj)");
                  setError("⏳ Čekanje na odobrenje od administratora. Vaš zahtjev za pristup sa ovog uređaja je poslan administratoru. Molimo sačekajte odobrenje prije pristupa aplikaciji.");
                  setLoading(false);
                  return;
                }
              } else {
                // Drugi, treći itd. uređaj - ZAUVIJEK zahtijeva verifikaciju (čak i ako je vlasnik)
                console.log("Login - Drugi/treći itd. uređaj zahtijeva verifikaciju", {
                  isOwner,
                  hasOtherDevices: userDevices.length > 0,
                  reason: "Korisnik već ima druge uređaje - novi uređaj mora biti odobren od prvog uređaja"
                });
                
                await saveDevice(user.id, {
                  deviceId,
                  deviceName: `${browser} on ${os}`,
                  deviceInfo,
                  role: isOwner ? "vlasnik" : null,
                  status: "verifikacija",
                  isBlocked: false,
                });

                console.log("Login - Novi uređaj kreiran sa statusom 'verifikacija', prikazujem poruku");
                setError("⏳ Čekanje na odobrenje od administratora. Vaš zahtjev za pristup sa ovog uređaja je poslan administratoru. Molimo sačekajte odobrenje prije pristupa aplikaciji.");
                setLoading(false);
                return;
              }
            } catch (queryError: any) {
              console.error("Login - Greška pri provjeri/kreiranju uređaja:", queryError);
              // Ako nije vlasnik i ima grešku, kreiraj sa verifikacijom
              if (!isOwner) {
                try {
                  await saveDevice(user.id, {
                    deviceId,
                    deviceName: `${browser} on ${os}`,
                    deviceInfo,
                    role: null,
                    status: "verifikacija",
                    isBlocked: false,
                  });

                  setError("⏳ Čekanje na odobrenje od administratora. Vaš zahtjev za pristup sa ovog uređaja je poslan administratoru. Molimo sačekajte odobrenje prije pristupa aplikaciji.");
                  setLoading(false);
                  return;
                } catch (saveError) {
                  console.error("Login - Greška pri kreiranju uređaja sa verifikacijom:", saveError);
                }
              }
            }
          }
        }
      } catch (deviceError) {
        console.error("Login - Greška pri provjeri uređaja:", deviceError);
        // U slučaju greške, dozvoli pristup (fallback) - možda je problem sa permisijama
      }

      // Dohvati IP adresu i lokaciju pri login-u
      try {
        let ipInfo = {
          ip: "N/A",
          location: "Nepoznata lokacija",
          isp: "N/A"
        };
        
        // Pokušaj dobiti IP - koristimo samo ipify jer ip-api.com često vraća 403
        try {
          const ipResponse = await fetch("https://api.ipify.org?format=json");
          if (ipResponse.ok) {
            const ipData = await ipResponse.json();
            ipInfo.ip = ipData.ip || "N/A";
          }
        } catch (error) {
          // Ignoriraj grešku sa ipify
        }
        
        // NE SPREMAJ U LOCALSTORAGE - IP info se može čuvati u Firestore ako je potrebno
        // Trenutno se ne čuva jer nije kritično
      } catch (ipError) {
        console.error("Greška pri dohvaćanju IP adrese:", ipError);
        // Nastavi sa login-om čak i ako IP dohvat ne uspije
      }

      // Session management se rješava automatski kroz Firebase Auth
      // API route nije potreban za static export
      console.log("Login uspješan, čekam provjeru role...");
      
      // Osvježi role u RoleContext nakon logina
      try {
        await refreshRole();
        console.log("Role osvježen nakon logina");
      } catch (refreshError) {
        console.error("Greška pri osvježavanju role:", refreshError);
      }
      
      setLoading(false);
      
      // AppContent će automatski preusmjeriti na dashboard ako je role postavljen
      // Ako je role === null (verifikacija potrebna), AppContent će prikazati poruku
    } catch (err: any) {
      console.error("Greška pri e-mail prijavi:", err);
      
      // Prikaži user-friendly poruku
      if (err.message?.includes("Invalid email or password") || err.message?.includes("Prijava nije uspjela")) {
        setError("Pogrešan e-mail ili lozinka. Provjeri podatke i pokušaj ponovo.");
      } else if (err.message?.includes("User not found")) {
        setError("Korisnik s ovim e-mailom ne postoji. Registriraj se.");
      } else {
        setError(err.message || "Greška pri prijavi. Provjeri e-mail i lozinku.");
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
      
      // API register poziv
      const registerResponse = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, confirmPassword }),
      });

      if (!registerResponse.ok) {
        const errorData = await registerResponse.json();
        throw new Error(errorData.error || 'Registracija nije uspjela');
      }

      const registerData = await registerResponse.json();
      const user = registerData.user;
      const token = registerData.token;

      if (!user || !token) {
        throw new Error("Registracija nije uspjela");
      }

      // Sačuvaj token
      setAuthToken(token);

      console.log("Uspješna registracija:", user.email);
      console.log("User ID:", user.id);

      // API automatski postavlja prvi korisnik kao vlasnik
      const isFirstUser = user.isOwner === true;

      // Dohvati IP adresu i lokaciju pri registraciji
      try {
        let ipInfo = {
          ip: "N/A",
          location: "Nepoznata lokacija",
          isp: "N/A"
        };
        
        // Pokušaj dobiti IP - koristimo samo ipify jer ip-api.com često vraća 403
        try {
          const ipResponse = await fetch("https://api.ipify.org?format=json");
          if (ipResponse.ok) {
            const ipData = await ipResponse.json();
            ipInfo.ip = ipData.ip || "N/A";
          }
        } catch (error) {
          // Ignoriraj grešku sa ipify
        }
        
        // NE SPREMAJ U LOCALSTORAGE - IP info se može čuvati u Firestore ako je potrebno
        // Trenutno se ne čuva jer nije kritično
      } catch (ipError) {
        console.error("Greška pri dohvaćanju IP adrese:", ipError);
        // Nastavi sa registracijom čak i ako IP dohvat ne uspije
      }

      // Session management se rješava automatski kroz Firebase Auth
      // API route nije potreban za static export
      console.log("Registracija uspješna, čekam provjeru role...");
      
      // Ako je prvi korisnik (vlasnik), eksplicitno kreiraj device dokument sa role = "vlasnik"
      if (isFirstUser) {
        console.log("✅ Prvi korisnik (vlasnik) detektovan, kreiram device dokument sa role = vlasnik...");
        try {
          // Generiši deviceId
          const fp = await FingerprintJS.load();
          const fpResult = await fp.get();
          const deviceId = fpResult.visitorId;
          
          if (deviceId) {
            // Dohvati device info
            const browser = typeof navigator !== "undefined" && navigator.userAgent.includes("Chrome")
              ? "Chrome"
              : typeof navigator !== "undefined" && navigator.userAgent.includes("Firefox")
              ? "Firefox"
              : typeof navigator !== "undefined" && navigator.userAgent.includes("Safari")
              ? "Safari"
              : typeof navigator !== "undefined" && navigator.userAgent.includes("Edge")
              ? "Edge"
              : "Unknown";
            
            const os = typeof navigator !== "undefined" && navigator.userAgent.includes("Windows")
              ? "Windows"
              : typeof navigator !== "undefined" && navigator.userAgent.includes("Mac")
              ? "macOS"
              : typeof navigator !== "undefined" && navigator.userAgent.includes("Linux")
              ? "Linux"
              : typeof navigator !== "undefined" && navigator.userAgent.includes("Android")
              ? "Android"
              : typeof navigator !== "undefined" && navigator.userAgent.includes("iOS")
              ? "iOS"
              : "Unknown";

            const deviceInfo = {
              deviceId: deviceId,
              browser,
              os,
              screenSize: typeof screen !== "undefined" ? `${screen.width}x${screen.height}` : "0x0",
              userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
              firstSeen: new Date().toISOString(),
              lastLogin: new Date().toISOString(),
            };
            
            // Kreiraj device dokument sa role = "vlasnik" za prvog korisnika (prvi uređaj)
            await saveDevice(user.id, {
              deviceId,
              deviceName: `${browser} on ${os}`,
              deviceInfo,
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
            
            console.log("✅ Device kreiran za prvog korisnika (vlasnika) sa role = vlasnik, deviceId:", deviceId);
          } else {
            console.error("❌ Nije moguće generisati deviceId");
          }
        } catch (deviceError: any) {
          console.error("❌ Greška pri kreiranju device dokumenta za prvog korisnika:", deviceError);
          console.error("Error code:", deviceError?.code, "Error message:", deviceError?.message);
        }
        
        // Osvježi role u RoleContext
        try {
          await refreshRole();
          console.log("✅ Role osvježen za prvog korisnika");
        } catch (refreshError: any) {
          console.error("❌ Greška pri osvježavanju role:", refreshError);
          console.error("Error code:", refreshError?.code, "Error message:", refreshError?.message);
        }
        
        setLoading(false);
        
        // AppContent će automatski preusmjeriti na dashboard ako je role postavljen
        console.log("✅ Prvi korisnik (vlasnik) - AppContent će preusmjeriti na dashboard");
      } else {
        console.log("⚠️ Korisnik nije prvi (vlasnik), čekam verifikaciju...");
        setLoading(false);
      }
      // AppContent će provjeriti role i preusmjeriti/prikazati poruku kako je potrebno
    } catch (err: any) {
      console.error("Greška pri registraciji:", err);
      if (err.message?.includes("already exists") || err.message?.includes("već registriran")) {
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
      // TODO: Implementirati API endpoint za password reset
      // await fetch('/api/auth/reset-password', { ... });
      setMessage("Funkcionalnost resetovanja lozinke još nije implementirana. Kontaktirajte administratora.");
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
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Animirana gradient pozadina */}
      <div className="animated-background" style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "linear-gradient(-45deg, #667eea, #764ba2, #f093fb, #4facfe, #00f2fe)",
        backgroundSize: "400% 400%",
        animation: "gradientShift 15s ease infinite",
        zIndex: 0
      }} />
      
      {/* Floating orbs/čestice */}
      <div className="floating-orbs">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className={`floating-orb orb-${i + 1}`}
            style={{
              position: "absolute",
              borderRadius: "50%",
              background: `rgba(255, 255, 255, ${0.1 + i * 0.05})`,
              filter: "blur(40px)",
              animation: `float${i + 1} ${15 + i * 2}s ease-in-out infinite`,
              zIndex: 1
            }}
          />
        ))}
      </div>
      
      {/* Fade overlay - tamni overlay za kontrast */}
      <div style={{
        position: "absolute",
      top: 0, 
      left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        zIndex: 2
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
          @keyframes gradientShift {
            0% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
            100% {
              background-position: 0% 50%;
            }
          }
          
          @keyframes float1 {
            0%, 100% {
              transform: translate(0, 0) scale(1);
              opacity: 0.3;
            }
            33% {
              transform: translate(30px, -30px) scale(1.1);
              opacity: 0.5;
            }
            66% {
              transform: translate(-20px, 20px) scale(0.9);
              opacity: 0.4;
            }
          }
          
          @keyframes float2 {
            0%, 100% {
              transform: translate(0, 0) scale(1);
              opacity: 0.25;
            }
            33% {
              transform: translate(-40px, 40px) scale(1.2);
              opacity: 0.45;
            }
            66% {
              transform: translate(30px, -20px) scale(0.8);
              opacity: 0.35;
            }
          }
          
          @keyframes float3 {
            0%, 100% {
              transform: translate(0, 0) scale(1);
              opacity: 0.2;
            }
            50% {
              transform: translate(50px, 50px) scale(1.3);
              opacity: 0.4;
            }
          }
          
          @keyframes float4 {
            0%, 100% {
              transform: translate(0, 0) scale(1);
              opacity: 0.3;
            }
            25% {
              transform: translate(-30px, -50px) scale(1.1);
              opacity: 0.5;
            }
            75% {
              transform: translate(40px, 30px) scale(0.9);
              opacity: 0.35;
            }
          }
          
          @keyframes float5 {
            0%, 100% {
              transform: translate(0, 0) scale(1);
              opacity: 0.25;
            }
            40% {
              transform: translate(60px, -40px) scale(1.2);
              opacity: 0.45;
            }
            80% {
              transform: translate(-50px, 60px) scale(0.85);
              opacity: 0.3;
            }
          }
          
          @keyframes float6 {
            0%, 100% {
              transform: translate(0, 0) scale(1);
              opacity: 0.2;
            }
            30% {
              transform: translate(-60px, 30px) scale(1.15);
              opacity: 0.4;
            }
            70% {
              transform: translate(50px, -50px) scale(0.95);
              opacity: 0.3;
            }
          }
          
          .floating-orb.orb-1 {
            width: 300px;
            height: 300px;
            top: 10%;
            left: 10%;
          }
          
          .floating-orb.orb-2 {
            width: 250px;
            height: 250px;
            top: 60%;
            right: 15%;
          }
          
          .floating-orb.orb-3 {
            width: 200px;
            height: 200px;
            bottom: 20%;
            left: 20%;
          }
          
          .floating-orb.orb-4 {
            width: 350px;
            height: 350px;
            top: 30%;
            right: 30%;
          }
          
          .floating-orb.orb-5 {
            width: 180px;
            height: 180px;
            bottom: 40%;
            right: 10%;
          }
          
          .floating-orb.orb-6 {
            width: 280px;
            height: 280px;
            top: 70%;
            left: 50%;
          }
          
          @media (max-width: 768px) {
            .floating-orb {
              width: 150px !important;
              height: 150px !important;
            }
            .floating-orb.orb-4 {
              width: 200px !important;
              height: 200px !important;
            }
          }
          
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
