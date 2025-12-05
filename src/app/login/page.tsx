"use client";

import React, { useState, useRef, useEffect } from "react";
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "../../lib/firebase";
import { initializeUser } from "../../lib/userInit";
import { useRouter } from "next/navigation";
import { db } from "../../lib/firestore";
import { doc, getDoc, setDoc, collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { useRole } from "../context/RoleContext";

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

      // Provjeri da li je korisnik vlasnik
      const userDocRef = doc(db, "users", user.uid);
      let userDoc = await getDoc(userDocRef);
      let isOwner = userDoc.exists() && userDoc.data().isOwner === true;
      
      // Ako korisnik ne postoji u Firestore, inicijalizuj ga
      if (!userDoc.exists()) {
        console.log("Login - Korisnik ne postoji u Firestore, inicijalizujem...");
        try {
          await initializeUser(user.uid, user.email);
          userDoc = await getDoc(userDocRef);
          isOwner = userDoc.exists() && userDoc.data().isOwner === true;
          console.log("Login - Korisnik inicijalizovan, isOwner:", isOwner);
        } catch (initError) {
          console.error("Login - Greška pri inicijalizaciji korisnika:", initError);
        }
      }
      
      // Ako korisnik nije vlasnik, provjeri da li je prvi korisnik u sistemu
      if (!isOwner) {
        try {
          const usersRef = collection(db, "users");
          const usersSnapshot = await getDocs(usersRef);
          let hasOwner = false;
          usersSnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.isOwner === true) {
              hasOwner = true;
            }
          });
          
          // Ako nema korisnika sa isOwner: true, ovo je prvi korisnik
          if (!hasOwner) {
            console.log("Login - Prvi korisnik detektovan, postavljam isOwner: true");
            await setDoc(userDocRef, { isOwner: true }, { merge: true });
            isOwner = true;
            userDoc = await getDoc(userDocRef);
          }
        } catch (checkError) {
          console.error("Login - Greška pri provjeri prvog korisnika:", checkError);
        }
      }

      // Provjeri status uređaja prije dozvoljavanja pristupa
      try {
        // Generiši deviceId (ne čuva se u localStorage - čuva se u Firestore nakon prijave)
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        const deviceId = result.visitorId;

        if (deviceId) {
          const deviceRef = doc(db, "devices", deviceId);
          const deviceDoc = await getDoc(deviceRef);
          
          // Provjeri da li je vlasnik sa specifičnim emailom i OS-om
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
          
          const isOwnerDevice = user.email === "gitara.zizu@gmail.com" && os === "Windows";
          
          if (deviceDoc.exists()) {
            const deviceData = deviceDoc.data();
            const isBlocked = deviceData.isBlocked === true;
            const status = deviceData.status || (deviceData.role === null ? "verifikacija" : "approved");
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
          } else {
            // Novi uređaj - ako je vlasnik, automatski kreiraj device dokument sa role = "vlasnik"
            if (isOwner || isOwnerDevice) {
              console.log("Login - Vlasnik detektovan, kreiram device dokument sa role = vlasnik");
              const browser = typeof navigator !== "undefined" && navigator.userAgent.includes("Chrome")
                ? "Chrome"
                : typeof navigator !== "undefined" && navigator.userAgent.includes("Firefox")
                ? "Firefox"
                : typeof navigator !== "undefined" && navigator.userAgent.includes("Safari")
                ? "Safari"
                : typeof navigator !== "undefined" && navigator.userAgent.includes("Edge")
                ? "Edge"
                : "Unknown";
              
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
                  deviceId: deviceId,
                  browser,
                  os,
                  screenSize: typeof screen !== "undefined" ? `${screen.width}x${screen.height}` : "0x0",
                  userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
                  firstSeen: Timestamp.fromDate(new Date()),
                  lastLogin: Timestamp.fromDate(new Date()),
                },
                lastLogin: Timestamp.fromDate(new Date()),
                createdAt: Timestamp.fromDate(new Date()),
                updatedAt: Timestamp.fromDate(new Date()),
              }, { merge: true });
              
              console.log("Login - Device dokument kreiran za vlasnika sa role = vlasnik");
            } else {
              // Novi uređaj - provjeri da li korisnik već ima druge uređaje
              try {
                const devicesQuery = query(collection(db, "devices"), where("userId", "==", user.uid));
                const devicesSnapshot = await getDocs(devicesQuery);
                
                console.log("Login - Provjera drugih uređaja - broj uređaja:", devicesSnapshot.size, "isOwner:", isOwner);
                
                // Ako je vlasnik i nema drugih uređaja, automatski odobri (prvi uređaj za vlasnika)
                if (isOwner && devicesSnapshot.empty) {
                  console.log("Login - Vlasnik sa prvim uređajem, automatski odobravam");
                  const browser = typeof navigator !== "undefined" && navigator.userAgent.includes("Chrome")
                    ? "Chrome"
                    : typeof navigator !== "undefined" && navigator.userAgent.includes("Firefox")
                    ? "Firefox"
                    : typeof navigator !== "undefined" && navigator.userAgent.includes("Safari")
                    ? "Safari"
                    : typeof navigator !== "undefined" && navigator.userAgent.includes("Edge")
                    ? "Edge"
                    : "Unknown";
                  
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
                      deviceId: deviceId,
                      browser,
                      os,
                      screenSize: typeof screen !== "undefined" ? `${screen.width}x${screen.height}` : "0x0",
                      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
                      firstSeen: Timestamp.fromDate(new Date()),
                      lastLogin: Timestamp.fromDate(new Date()),
                    },
                    lastLogin: Timestamp.fromDate(new Date()),
                    createdAt: Timestamp.fromDate(new Date()),
                    updatedAt: Timestamp.fromDate(new Date()),
                  }, { merge: true });
                  
                  console.log("Login - Device dokument kreiran za vlasnika (prvi uređaj) sa role = vlasnik");
                } else if (!devicesSnapshot.empty) {
                  // Ako korisnik već ima druge uređaje, novi uređaj zahtijeva verifikaciju (čak i ako je vlasnik)
                  console.log("Login - Korisnik već ima druge uređaje, kreiram novi sa statusom 'verifikacija'");
                  
                  // Kreiraj novi uređaj sa statusom "verifikacija"
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
                      screenSize: typeof screen !== "undefined" ? `${screen.width}x${screen.height}` : "0x0",
                      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
                      firstSeen: Timestamp.fromDate(new Date()),
                      lastLogin: Timestamp.fromDate(new Date()),
                    },
                    lastLogin: Timestamp.fromDate(new Date()),
                    createdAt: Timestamp.fromDate(new Date()),
                    updatedAt: Timestamp.fromDate(new Date()),
                  });

                  console.log("Login - Novi uređaj kreiran sa statusom 'verifikacija', prikazujem poruku");
                  setError("⏳ Čekanje na odobrenje od administratora. Vaš zahtjev za pristup sa ovog uređaja je poslan administratoru. Molimo sačekajte odobrenje prije pristupa aplikaciji.");
                  setLoading(false);
                  return;
                }
              } catch (queryError: any) {
                console.error("Login - Greška pri provjeri drugih uređaja:", queryError);
                // Ako je greška zbog permisija, možda korisnik nema dozvolu za query
                // U tom slučaju, pokušaj kreirati uređaj sa verifikacijom ako nije vlasnik
                if (queryError.code === 'permission-denied') {
                  // Provjeri ponovo da li je vlasnik prije nego što kreiramo sa verifikacijom
                  const userDocRefCheck = doc(db, "users", user.uid);
                  const userDocCheck = await getDoc(userDocRefCheck);
                  const isOwnerCheck = userDocCheck.exists() && userDocCheck.data().isOwner === true;
                  
                  if (!isOwnerCheck) {
                    console.log("Login - Nemam permisije za query, ali nije vlasnik - kreiram sa verifikacijom");
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
                        screenSize: typeof screen !== "undefined" ? `${screen.width}x${screen.height}` : "0x0",
                        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
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
                }
              }
            }
          }
        }
      } catch (deviceError) {
        console.error("Login - Greška pri provjeri uređaja:", deviceError);
        // U slučaju greške, dozvoli pristup (fallback) - možda je problem sa permisijama
      }

      // Ako korisnik nije vlasnik, provjeri odobrenje (loginApprovals)
      if (!isOwner) {
        const approvalRef = doc(db, "loginApprovals", user.uid);
        const approvalDoc = await getDoc(approvalRef);
        
        console.log("Login - Provjera odobrenja za korisnika:", user.uid);
        console.log("Login - Dokument postoji:", approvalDoc.exists());
        
        if (approvalDoc.exists()) {
          const approvalData = approvalDoc.data();
          console.log("Login - Status odobrenja:", approvalData.status);
          
          if (approvalData.status === "pending") {
            setError("Vaš zahtjev za pristup aplikaciji još nije odobren. Molimo sačekajte odobrenje od administratora.");
            setLoading(false);
            return;
          } else if (approvalData.status === "rejected") {
            setError("Vaš zahtjev za pristup aplikaciji je odbijen. Kontaktirajte administratora za više informacija.");
            setLoading(false);
            return;
          } else if (approvalData.status === "approved") {
            console.log("Login - Odobrenje je potvrđeno, dozvoljavam pristup");
            // Nastavi sa login procesom
          } else {
            console.log("Login - Nepoznat status:", approvalData.status);
            setError("Nemate odobrenje za pristup aplikaciji. Molimo sačekajte odobrenje od administratora.");
            setLoading(false);
            return;
          }
        } else {
          // Ako nema dokumenta za odobrenje, blokiraj pristup
          console.log("Login - Nema dokumenta za odobrenje, blokiram pristup");
          setError("Nemate odobrenje za pristup aplikaciji. Molimo sačekajte odobrenje od administratora.");
          setLoading(false);
          return;
        }
      }

      // Provjeri da li je uređaj blokiran ili zahtijeva verifikaciju
      // KOMENTIRANO ZA TESTIRANJE - omogućava pristup bez provjere uređaja
      /*
      try {
        // Generiši deviceId (ne čuva se u localStorage - čuva se u Firestore nakon prijave)
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        const deviceId = result.visitorId;

        if (deviceId) {
          const deviceRef = doc(db, "devices", deviceId);
          const deviceDoc = await getDoc(deviceRef);
          
          if (deviceDoc.exists()) {
            const deviceData = deviceDoc.data();
            const isBlocked = deviceData.isBlocked === true;
            const status = deviceData.status || (deviceData.role === null ? "verifikacija" : "approved");
            const needsVerification = status === "verifikacija";
            
            // Provjeri da li je vlasnik sa specifičnim emailom i OS-om
            const os = deviceData.deviceInfo?.os || (navigator.userAgent.includes("Windows") ? "Windows" : "Unknown");
            const isOwnerDevice = user.email === "gitara.zizu@gmail.com" && os === "Windows";
            
            if (isBlocked) {
              setError("Ovaj uređaj je blokiran. Kontaktirajte administratora za više informacija.");
              setLoading(false);
              return;
            } else if (needsVerification && !isOwnerDevice) {
              setError("⏳ Čekanje na odobrenje od administratora. Vaš zahtjev za pristup sa ovog uređaja je poslan administratoru. Molimo sačekajte odobrenje prije pristupa aplikaciji.");
              setLoading(false);
              return;
            }
          } else {
            // Novi uređaj - provjeri da li korisnik već ima druge uređaje
            try {
              // Provjeri da li je vlasnik sa specifičnim emailom i OS-om
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
              
              const isOwnerDevice = user.email === "gitara.zizu@gmail.com" && os === "Windows";
              
              if (isOwnerDevice) {
                console.log("Vlasnik sa specifičnim emailom i OS-om, dozvoljavam pristup");
                // Ako je vlasnik sa specifičnim emailom i OS-om, dozvoli pristup
                // Uređaj će se kreirati u RoleContext sa statusom "approved"
              } else {
                // Provjeri da li je korisnik vlasnik (isOwner === true)
                const userDocRefCheck = doc(db, "users", user.uid);
                const userDocCheck = await getDoc(userDocRefCheck);
                const isOwnerCheck = userDocCheck.exists() && userDocCheck.data().isOwner === true;
                
                const devicesQuery = query(collection(db, "devices"), where("userId", "==", user.uid));
                const devicesSnapshot = await getDocs(devicesQuery);
                
                console.log("Provjera drugih uređaja - broj uređaja:", devicesSnapshot.size, "isOwner:", isOwnerCheck);
                
                // Ako korisnik već ima druge uređaje, novi uređaj zahtijeva verifikaciju (čak i ako je vlasnik)
                if (!devicesSnapshot.empty) {
                  console.log("Korisnik već ima druge uređaje, kreiram novi sa statusom 'verifikacija'");
                  
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

                  console.log("Novi uređaj kreiran sa statusom 'verifikacija', prikazujem poruku");
                  setError("⏳ Čekanje na odobrenje od administratora. Vaš zahtjev za pristup sa ovog uređaja je poslan administratoru. Molimo sačekajte odobrenje prije pristupa aplikaciji.");
                  setLoading(false);
                  return;
                } else {
                  console.log("Prvi uređaj za korisnika, dozvoljavam pristup");
                }
              }
              // Ako je prvi uređaj, dozvoli pristup (uređaj će se kreirati u RoleContext)
            } catch (queryError: any) {
              console.error("Greška pri provjeri drugih uređaja:", queryError);
              // Ako je greška zbog permisija, možda korisnik nema dozvolu za query
              // U tom slučaju, pokušaj kreirati uređaj sa verifikacijom ako nije vlasnik
              // Ali samo ako je provjereno da nije vlasnik
              if (queryError.code === 'permission-denied') {
                // Provjeri ponovo da li je vlasnik prije nego što kreiramo sa verifikacijom
                const userDocRef = doc(db, "users", user.uid);
                const userDocCheck = await getDoc(userDocRef);
                const isOwnerCheck = userDocCheck.exists() && userDocCheck.data().isOwner === true;
                
                if (!isOwnerCheck) {
                console.log("Nemam permisije za query, ali nije vlasnik - kreiram sa verifikacijom");
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
              // U slučaju druge greške, dozvoli pristup (fallback)
            }
          }
        }
      } catch (deviceError) {
        console.error("Greška pri provjeri uređaja:", deviceError);
        // U slučaju greške, dozvoli pristup (fallback)
      }
      */

      // Ako je sve prošlo, nastavi sa login procesom
      console.log("Login - Svi uslovi su ispunjeni, nastavljam sa login procesom");

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
      setLoading(false);
      // Ne preusmjeravaj automatski - AppContent će provjeriti role i preusmjeriti ako je potrebno
      // Ako je role === null, AppContent će blokirati pristup
    } catch (err: any) {
      // Ignoriraj grešku ako je korisnik već prijavljen (može se desiti zbog race condition)
      if (auth.currentUser && auth.currentUser.email === email) {
        console.log("Korisnik je već prijavljen, čekam provjeru role...");
        setLoading(false);
        // Ne preusmjeravaj automatski - AppContent će provjeriti role
        return;
      }
      
      // Ignoriraj invalid-credential grešku ako je korisnik već prijavljen
      if (err.code === "auth/invalid-credential" && auth.currentUser) {
        console.log("Greška ignorirana - korisnik je već prijavljen");
        setLoading(false);
        // Ne preusmjeravaj automatski - AppContent će provjeriti role
        return;
      }
      
      // Ignoriraj grešku ako je korisnik već prijavljen (race condition)
      if (auth.currentUser) {
        console.log("Korisnik je već prijavljen, ignoriranje greške");
        setLoading(false);
        // Ne preusmjeravaj automatski - AppContent će provjeriti role
        return;
      }
      
      // Prikaži user-friendly poruku za invalid-credential grešku
      if (err.code === "auth/invalid-credential") {
        setError("Pogrešan e-mail ili lozinka. Provjeri podatke i pokušaj ponovo.");
        setLoading(false);
        return;
      }
      
      // Samo loguj detaljnu grešku u development modu
      if (process.env.NODE_ENV === 'development') {
        console.error("Greška pri e-mail prijavi:", err);
      }
      
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
      let isFirstUser = false;
      try {
        console.log("🔄 Registracija - Pokrećem initializeUser za:", user.uid, user.email);
        await initializeUser(user.uid, user.email);
        console.log("✅ Registracija - Korisnik inicijalizovan u Firestore");
        
        // Provjeri da li je korisnik prvi (isOwner === true)
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          isFirstUser = userData.isOwner === true;
          console.log("📋 Registracija - Provjera isOwner:", isFirstUser, "userData:", userData);
        } else {
          console.warn("⚠️ Registracija - User dokument ne postoji nakon inicijalizacije!");
        }
      } catch (initError: any) {
        console.error("❌ Registracija - Greška pri inicijalizaciji korisnika:", initError);
        console.error("Error code:", initError?.code, "Error message:", initError?.message);
        // Nastavi sa registracijom čak i ako inicijalizacija ne uspije
      }

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
            const deviceRef = doc(db, "devices", deviceId);
            
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
            
            // Eksplicitno kreiraj device dokument sa role = "vlasnik" za prvog korisnika (prvi uređaj)
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
                deviceId: deviceId,
                browser,
                os,
                screenSize: typeof screen !== "undefined" ? `${screen.width}x${screen.height}` : "0x0",
                userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
                firstSeen: Timestamp.fromDate(new Date()),
                lastLogin: Timestamp.fromDate(new Date()),
              },
              lastLogin: Timestamp.fromDate(new Date()),
              createdAt: Timestamp.fromDate(new Date()),
              updatedAt: Timestamp.fromDate(new Date()),
            }, { merge: true });
            
            console.log("✅ Device dokument kreiran za prvog korisnika (vlasnika) sa role = vlasnik, deviceId:", deviceId);
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
        
        // Sačekaj malo da se role postavi
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Preusmjeri na dashboard
        console.log("🚀 Prvi korisnik (vlasnik) - preusmjeravam na dashboard");
        router.push("/dashboard");
      } else {
        console.log("⚠️ Korisnik nije prvi (vlasnik), čekam verifikaciju...");
      }
      // AppContent će također provjeriti role i preusmjeriti ako je potrebno
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