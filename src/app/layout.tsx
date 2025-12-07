"use client";

import React, { useState, useEffect } from "react";
import { AppNameProvider } from "./context/AppNameContext";
import { CjenovnikProvider } from "./context/CjenovnikContext";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import { RoleProvider, useRole } from "./context/RoleContext";
import SubscriptionBanner from "./components/SubscriptionBanner";
import Sidebar from "./sidebar/Sidebar";
import PWAUpdatePrompt from "./components/PWAUpdatePrompt";
import { auth, db } from "../lib/firebase";
import { usePathname, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import FingerprintJS from "@fingerprintjs/fingerprintjs";

// Komponenta koja provjerava role i blokira pristup ako je potrebno
function AppContent({ children }: { children: React.ReactNode }) {
  const { role, loading: roleLoading } = useRole();
  const pathname = usePathname();
  const router = useRouter();

  // Preusmjeri na dashboard ako je role postavljen i korisnik je na login stranici
  useEffect(() => {
    if (!roleLoading && role !== null && pathname === "/login") {
      router.push("/dashboard");
    }
  }, [role, roleLoading, pathname, router]);

  // Ako se još učitava role, prikaži loading
  if (roleLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "#f4f5f7" }}>
        <div style={{ fontSize: "16px", color: "#6b7280" }}>Učitavanje...</div>
      </div>
    );
  }

  // Ako je role null (verifikacija potrebna), blokiraj pristup i prikaži poruku
  if (role === null) {
    // Ako je na login stranici, ostavi ga tamo (login stranica će prikazati poruku)
    if (pathname === "/login") {
      return <>{children}</>;
    }
    // Ako nije na login stranici, blokiraj pristup i prikaži poruku
    return (
      <div style={{ 
        display: "flex", 
        flexDirection: "column",
        justifyContent: "center", 
        alignItems: "center", 
        height: "100vh", 
        backgroundColor: "#f4f5f7",
        padding: "20px",
        textAlign: "center"
      }}>
        <div style={{ 
          maxWidth: "500px",
          backgroundColor: "#fff",
          padding: "32px",
          borderRadius: "12px",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
        }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>⏳</div>
          <h2 style={{ fontSize: "24px", fontWeight: 600, color: "#1f2937", marginBottom: "12px" }}>
            Čekanje na odobrenje
          </h2>
          <p style={{ fontSize: "16px", color: "#6b7280", marginBottom: "24px", lineHeight: "1.6" }}>
            Vaš zahtjev za pristup sa ovog uređaja je poslan administratoru. Molimo sačekajte odobrenje prije pristupa aplikaciji.
          </p>
          <button
            onClick={() => {
              auth.signOut();
              router.push("/login");
            }}
            style={{
              padding: "12px 24px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "background-color 0.2s"
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#2563eb"}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#3b82f6"}
          >
            Odjavi se
          </button>
        </div>
      </div>
    );
  }

  // Ako je role postavljen i korisnik je na login stranici, prikaži loading dok se preusmjerava
  if (pathname === "/login" && role !== null) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "#f4f5f7" }}>
        <div style={{ fontSize: "16px", color: "#6b7280" }}>Preusmjeravanje...</div>
      </div>
    );
  }

  // Ako je role postavljen, prikaži normalnu aplikaciju
  return (
    <>
      <SubscriptionBanner />
      <Sidebar />
      <main
        style={{
          flex: 1,
          padding: "0",
          backgroundColor: "#f4f5f7",
          minHeight: "100vh",
          paddingBottom: "60px", // Prostor za bottom bar
          width: "100%",
        }}
      >
        <div style={{ padding: "20px", width: "100%", boxSizing: "border-box" }}>{children}</div>
      </main>
      <PWAUpdatePrompt />
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // null = loading
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      const authenticated = !!user;
      
      if (authenticated && user) {
        // Provjeri da li je vlasnik sa specifičnim emailom i OS-om - automatski dozvoli pristup
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
        
        // Provjeri da li je korisnik vlasnik (za informacije)
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          const isOwner = userDoc.exists() && userDoc.data().isOwner === true;

          // Provjera statusa uređaja se sada radi u RoleContext.tsx
          // deviceId se generiše i čuva u Firestore kroz RoleContext
        } catch (error) {
          console.error("Greška pri provjeri odobrenja:", error);
          // U slučaju greške, dozvoli pristup (fallback)
        }
      }
      
      setIsAuthenticated(authenticated);
      setIsLoading(false);

      // Ako korisnik nije prijavljen i nije na login stranici, preusmjeri na login
      if (!authenticated && pathname !== "/login") {
        router.push("/login");
      }
      // Ako je korisnik prijavljen i na login stranici, NE preusmjeravaj automatski
      // AppContent će provjeriti role i blokirati pristup ako je potrebno
      // Preusmjeravanje na dashboard će se desiti samo ako je role postavljen (u AppContent)
    });
    return () => unsubscribe();
  }, [pathname, router]);

  // Ako se još učitava autentifikacija, prikaži loading ili ništa
  if (isLoading) {
    return (
      <html lang="bs">
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <style>{`* { -webkit-tap-highlight-color: transparent; }`}</style>
        </head>
        <body style={{ margin: 0, padding: 0, minHeight: "100vh", fontFamily: "'Inter', sans-serif", display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "#f4f5f7", WebkitTapHighlightColor: "transparent" }}>
          <div style={{ fontSize: "16px", color: "#6b7280" }}>Učitavanje...</div>
        </body>
      </html>
    );
  }

  // Ako korisnik nije prijavljen, prikaži samo login stranicu (bez sidebara i layouta)
  if (!isAuthenticated) {
    // Ako nije na login stranici, preusmjeri na login
    if (pathname !== "/login") {
      return (
        <html lang="bs">
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
            <style>{`* { -webkit-tap-highlight-color: transparent; }`}</style>
          </head>
          <body style={{ margin: 0, padding: 0, minHeight: "100vh", fontFamily: "'Inter', sans-serif", overflowX: "hidden", WebkitTapHighlightColor: "transparent", display: "flex", justifyContent: "center", alignItems: "center", backgroundColor: "#f4f5f7" }}>
            <div style={{ fontSize: "16px", color: "#6b7280" }}>Preusmjeravanje na login...</div>
          </body>
        </html>
      );
    }
    
    return (
      <html lang="bs">
        <head>
          <title>Knjiga Obračuna - Prijava</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <meta name="theme-color" content="#3b82f6" />
          <meta name="description" content="Office Lounge Bar - Aplikacija za upravljanje poslovanjem" />
          <link rel="manifest" href="/manifest.json" />
          <link rel="apple-touch-icon" href="/icon-192x192.svg" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="Office App" />
          <style>{`* { -webkit-tap-highlight-color: transparent; }`}</style>
        </head>
        <body style={{ margin: 0, padding: 0, minHeight: "100vh", fontFamily: "'Inter', sans-serif", overflowX: "hidden", WebkitTapHighlightColor: "transparent" }}>
          <AppNameProvider>
            <CjenovnikProvider>
              <SubscriptionProvider>
                <RoleProvider>
                  {children}
                </RoleProvider>
              </SubscriptionProvider>
            </CjenovnikProvider>
          </AppNameProvider>
          <PWAUpdatePrompt />
        </body>
      </html>
    );
  }

  // Ako je korisnik prijavljen, prikaži normalnu app sa sidebarom
  return (
    <html lang="bs">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="description" content="Office Lounge Bar - Aplikacija za upravljanje poslovanjem" />
        <link rel="manifest" href="/manifest.json" />
          <link rel="apple-touch-icon" href="/icon-192x192.svg" />
          <link rel="apple-touch-icon" sizes="152x152" href="/icon-152x152.svg" />
          <link rel="apple-touch-icon" sizes="180x180" href="/icon-192x192.svg" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Office App" />
        <style>{`* { -webkit-tap-highlight-color: transparent; }`}</style>
      </head>
      <body style={{ margin: 0, padding: 0, minHeight: "100vh", fontFamily: "'Inter', sans-serif", overflowX: "hidden", position: "relative", WebkitTapHighlightColor: "transparent" }}>
        <AppNameProvider>
          <CjenovnikProvider>
            <SubscriptionProvider>
              <RoleProvider>
                <AppContent>{children}</AppContent>
              </RoleProvider>
            <style jsx>{`
              .sidebar-link:hover {
                background-color: #3b82f6;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
              }
              @media (max-width: 768px) {
                main {
                  padding-bottom: 60px; /* Zadrži prostor za bottom bar */
                }
                div[style*="padding: 20px"] {
                  padding: 10px; /* Smanji padding na mobilu */
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
              }
              @media (min-width: 768px) {
                main {
                  padding-bottom: 0; /* Bez paddinga na desktopu */
                }
              }
            `}</style>
            </SubscriptionProvider>
          </CjenovnikProvider>
        </AppNameProvider>
      </body>
    </html>
  );
}