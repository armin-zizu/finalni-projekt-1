"use client";

import React, { useState, useEffect } from "react";
import { AppNameProvider } from "./context/AppNameContext";
import { CjenovnikProvider } from "./context/CjenovnikContext";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import { RoleProvider } from "./context/RoleContext";
import SubscriptionBanner from "./components/SubscriptionBanner";
import SubscriptionGuard from "./components/SubscriptionGuard";
import Sidebar from "./sidebar/Sidebar";
import { auth, db } from "../lib/firebase";
import { usePathname, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import FingerprintJS from "@fingerprintjs/fingerprintjs";

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
        
        // Provjeri da li je korisnik vlasnik (za informacije, ali ne blokiraj pristup)
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          const isOwner = userDoc.exists() && userDoc.data().isOwner === true;
          // Ne blokiraj pristup na osnovu isOwner statusa - svi korisnici mogu pristupiti

          // Provjeri da li je uređaj blokiran ili zahtijeva verifikaciju
          // KOMENTIRANO ZA TESTIRANJE - omogućava pristup bez provjere uređaja
          /*
          try {
            const deviceId = localStorage.getItem("deviceId");
            if (deviceId) {
              const deviceRef = doc(db, "devices", deviceId);
              const deviceDoc = await getDoc(deviceRef);
              
              if (deviceDoc.exists()) {
                const deviceData = deviceDoc.data();
                const isBlocked = deviceData.isBlocked === true;
                const status = deviceData.status || (deviceData.role === null ? "verifikacija" : "approved");
                const needsVerification = status === "verifikacija";
                
                // Provjeri da li je vlasnik sa specifičnim emailom i OS-om
                const os = deviceData.deviceInfo?.os || (typeof navigator !== "undefined" && navigator.userAgent.includes("Windows") ? "Windows" : "Unknown");
                const isOwnerDevice = user.email === "gitara.zizu@gmail.com" && os === "Windows";
                
                if (isBlocked || (needsVerification && !isOwnerDevice)) {
                  // Uređaj je blokiran ili zahtijeva verifikaciju (osim ako je vlasnik), preusmjeri na login
                  setIsAuthenticated(false);
                  setIsLoading(false);
                  if (pathname !== "/login") {
                    router.push("/login");
                  }
                  return;
                }
              }
            }
          } catch (deviceError) {
            console.error("Greška pri provjeri uređaja:", deviceError);
            // U slučaju greške, dozvoli pristup (fallback)
          }
          */
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
      // Ako je korisnik prijavljen i na login stranici, preusmjeri na dashboard
      if (authenticated && pathname === "/login") {
        router.push("/dashboard");
      }
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
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
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
        </body>
      </html>
    );
  }

  // Ako je korisnik prijavljen, prikaži normalnu app sa sidebarom
  return (
    <html lang="bs">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>{`* { -webkit-tap-highlight-color: transparent; }`}</style>
      </head>
      <body style={{ margin: 0, padding: 0, minHeight: "100vh", fontFamily: "'Inter', sans-serif", overflowX: "hidden", position: "relative", WebkitTapHighlightColor: "transparent" }}>
        <AppNameProvider>
          <CjenovnikProvider>
            <SubscriptionProvider>
              <RoleProvider>
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
                  <SubscriptionGuard>
                    <div style={{ padding: "20px", width: "100%", boxSizing: "border-box" }}>{children}</div>
                  </SubscriptionGuard>
                </main>
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