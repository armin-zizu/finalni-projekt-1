"use client";

import React, { useState, useEffect } from "react";
import { AppNameProvider } from "./context/AppNameContext";
import { CjenovnikProvider } from "./context/CjenovnikContext";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import { RoleProvider, useRole, UserRole } from "./context/RoleContext";
import SubscriptionBanner from "./components/SubscriptionBanner";
import Sidebar from "./sidebar/Sidebar";
import { usePathname, useRouter } from "next/navigation";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { setAuthToken, getAuthToken } from "../lib/api";

// Komponenta koja provjerava role i blokira pristup ako je potrebno
function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  
  // Provjeri da li smo na client-side prije korištenja useRole (zbog SSR)
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Ne koristi useRole tokom SSR - fallback vrijednosti
  let role: UserRole | null = null;
  let roleLoading = true;
  
  if (isMounted) {
    try {
      const roleContext = useRole();
      role = roleContext.role;
      roleLoading = roleContext.loading;
    } catch (error) {
      // Context nije dostupan (može se desiti tokom SSR)
      console.warn('RoleContext not available:', error);
      role = null;
      roleLoading = false;
    }
  }

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
            onClick={async () => {
              // TODO: Implementirati API poziv za logout
              // await fetch('/api/auth/logout', { method: 'POST' });
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
    </>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Sync token from cookie to localStorage on app load
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Provjeri da li token već postoji u localStorage
    const existingToken = localStorage.getItem('token');
    if (existingToken) {
      return; // Token već postoji
    }
    
    // Pokušaj učitati token iz cookie-ja
    try {
      const cookies = document.cookie.split(';');
      const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
      if (tokenCookie) {
        const token = tokenCookie.split('=')[1];
        if (token) {
          localStorage.setItem('token', token);
          console.log('Token synced from cookie to localStorage');
        }
      }
    } catch (error) {
      console.warn('Error syncing token from cookie:', error);
    }
  }, []);

  // TEMPORARY: Disabled auth check
  /*
  useEffect(() => {
    // Agresivno ukloni Service Worker i cache-ove (ODMAH, ne čekaj load event)
    if (typeof window !== 'undefined') {
      // Onemogući Service Worker update pokušaje PRIJE nego što se bilo što desi
      if ('serviceWorker' in navigator) {
        // Prekini sve aktivne Service Worker update-ove
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            registrations.forEach((registration) => {
              registration.update().catch(() => {
                // Ignoriši greške - samo pokušaj update da trigger-uje unregister
              });
            });
          });
        });

        // Ukloni Service Worker - više puta za sigurnost
        const clearServiceWorkers = () => {
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            console.log('📋 Layout - Pronađeno Service Worker registracija:', registrations.length);
            if (registrations.length === 0) {
              console.log('✅ Layout - Nema Service Worker registracija');
              return;
            }
            registrations.forEach((registration) => {
              registration.unregister().then((success) => {
                if (success) {
                  console.log('✅ Layout - Service Worker uklonjen:', registration.scope);
                }
              }).catch((error) => {
                console.warn('⚠️ Layout - Greška pri uklanjanju Service Workera:', error);
                setTimeout(() => {
                  registration.unregister().catch(() => {});
                }, 1000);
              });
            });
          }).catch((error) => {
            console.warn('⚠️ Layout - Greška pri dohvaćanju Service Worker registracija:', error);
          });
        };
        
        clearServiceWorkers();
        setTimeout(clearServiceWorkers, 100);
        setTimeout(clearServiceWorkers, 500);
        setTimeout(clearServiceWorkers, 1000);
      }

      // Očisti sve cache-ove (neovisno o Service Worker-u) - više puta za sigurnost
      const clearCaches = () => {
        if ('caches' in window) {
          caches.keys().then((names) => {
            console.log('📋 Layout - Pronađeno cache-ova:', names.length);
            if (names.length === 0) {
              console.log('✅ Layout - Nema cache-ova');
              return;
            }
            names.forEach((name) => {
              caches.delete(name).then(() => {
                console.log(`✅ Layout - Cache obrisan: ${name}`);
              }).catch(() => {});
            });
          }).catch(() => {});
        }
      };
      
      clearCaches();
      setTimeout(clearCaches, 100);
      setTimeout(clearCaches, 500);
      setTimeout(clearCaches, 1000);

      // Zapamti verziju za buduće provjere
      const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString();
      sessionStorage.setItem('appBuildTime', buildTime);
    }

    // TODO: Implementirati provjeru autentifikacije preko API poziva
    // Za sada, proveri da li postoji JWT token u localStorage/cookie
    const checkAuth = async () => {
      try {
        // TODO: Zamijeniti sa API pozivom
        // const response = await fetch('/api/auth/me');
        // const authenticated = response.ok;
        // setIsAuthenticated(authenticated);
        setIsAuthenticated(false); // Za sada false dok se ne implementira API
        setIsLoading(false);
        
        if (pathname !== "/login") {
          router.push("/login");
        }
      } catch (error) {
        console.error("Greška pri provjeri autentifikacije:", error);
        setIsAuthenticated(false);
        setIsLoading(false);
        if (pathname !== "/login") {
          router.push("/login");
        }
      }
    };
    
    checkAuth();
  }, [pathname, router, isLoading]);
  */

  // AppContent provjerava role i odlučuje šta prikazati
  return (
    <html lang="bs">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="theme-color" content="#3b82f6" />
        <meta name="description" content="Office Lounge Bar - Aplikacija za upravljanje poslovanjem" />
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        {/* Agresivno ukloni Service Worker i cache-ove ODMAH */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    registrations.forEach(function(registration) {
                      registration.unregister().then(function() {
                        console.log('✅ Service Worker uklonjen (inline script)');
                      });
                    });
                  });
                }
                if ('caches' in window) {
                  caches.keys().then(function(names) {
                    names.forEach(function(name) {
                      caches.delete(name).then(function() {
                        console.log('✅ Cache obrisan (inline script):', name);
                      });
                    });
                  });
                }
              })();
            `,
          }}
        />
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