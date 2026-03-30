"use client";

import React, { useState, useEffect, useContext } from "react";
import { AppNameProvider } from "./context/AppNameContext";
import { CjenovnikProvider } from "./context/CjenovnikContext";
import { SubscriptionProvider, useSubscription } from "./context/SubscriptionContext";
import { RoleProvider, useRole, UserRole, RoleContext } from "./context/RoleContext";
import { SupportChatProvider } from "./context/SupportChatContext";
import dynamic from "next/dynamic";

// Dynamic import za komponente koje koriste useRole (da izbjegnemo SSR probleme)
const SubscriptionBanner = dynamic(() => import("./components/SubscriptionBanner"), { ssr: false });
const Sidebar = dynamic(() => import("./sidebar/Sidebar"), { ssr: false });
import { usePathname, useRouter } from "next/navigation";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { setAuthToken, getAuthToken } from "../lib/api";

// Komponenta koja provjerava role i blokira pristup ako je potrebno
function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState<boolean>(false);
  
  // Koristi useContext direktno sa fallback vrijednostima (ne može se uslovno pozivati)
  const roleContext = useContext(RoleContext);
  const role = roleContext?.role ?? null;
  const roleLoading = roleContext?.loading ?? true;
  
  // Import SubscriptionContext za provjeru subscription statusa
  const { subscription, loading: subscriptionLoading } = useSubscription();

  // Detekcija mobilnog uređaja
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window === 'undefined') return false;
      const width = window.innerWidth || (window.screen && window.screen.width) || 1024;
      return width <= 768;
    };
    
    if (typeof window !== 'undefined') {
      setIsMobile(checkMobile());
      
      const handleResize = () => {
        setIsMobile(checkMobile());
      };
      
      window.addEventListener('resize', handleResize);
      window.addEventListener('orientationchange', () => {
        setTimeout(() => setIsMobile(checkMobile()), 100);
      });
      
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);

  // Registracija Service Worker za PWA
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => {
          registrations.forEach((registration) => {
            registration.unregister().catch(() => {});
          });
        })
        .catch(() => {});
      return;
    }

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });
        console.log('[PWA] Service Worker registered:', registration.scope);

        // Provjeri da li postoji nova verzija
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] New service worker available. Refresh to update.');
              }
            });
          }
        });
      } catch (error) {
        console.error('[PWA] Service Worker registration failed:', error);
      }
    };

    // Registruj service worker nakon učitavanja stranice
    if (document.readyState === 'complete') {
      registerServiceWorker();
    } else {
      window.addEventListener('load', registerServiceWorker);
      return () => {
        window.removeEventListener('load', registerServiceWorker);
      };
    }
  }, []);

  // Preusmjeri na dashboard ako je role postavljen i korisnik je na login stranici
  useEffect(() => {
    if (!roleLoading && role !== null && pathname === "/login") {
      router.push("/dashboard");
    }
  }, [role, roleLoading, pathname, router]);

  // Provjeri subscription status - blokiraj pristup svim stranicama osim /profile ako subscription nije aktivan i grace period je prošao
  const isSubscriptionBlocked = !subscriptionLoading && subscription && 
    !subscription.isActive && 
    !subscription.isTrial && 
    !subscription.isGracePeriod;
  
  // Preusmjeri na /profile ako je subscription blokiran i korisnik nije na /profile stranici
  useEffect(() => {
    if (isSubscriptionBlocked && pathname !== "/profile") {
      router.push("/profile");
    }
  }, [isSubscriptionBlocked, pathname, router]);

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

  // Ako je subscription blokiran i korisnik nije na /profile stranici, prikaži loading dok se preusmjerava
  if (isSubscriptionBlocked && pathname !== "/profile") {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "#f4f5f7" }}>
        <div style={{ fontSize: "16px", color: "#6b7280" }}>Preusmjeravanje na profil...</div>
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
        <div style={{ padding: isMobile ? "4px" : "20px", width: "100%", boxSizing: "border-box" }}>{children}</div>
      </main>
    </>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
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

        // Registruj Service Worker - više puta za sigurnost
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
    <AppNameProvider>
      <RoleProvider>
        <SubscriptionProvider>
          <CjenovnikProvider>
            <SupportChatProvider>
              <AppContent>{children}</AppContent>
            </SupportChatProvider>
          </CjenovnikProvider>
        </SubscriptionProvider>
      </RoleProvider>
    </AppNameProvider>
  );
}