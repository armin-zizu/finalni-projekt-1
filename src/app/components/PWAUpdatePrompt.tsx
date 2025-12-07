"use client";

import React, { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAUpdatePrompt() {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showIOSInstall, setShowIOSInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Provjeri da li je aplikacija već instalirana
    if (typeof window !== "undefined") {
      // Detektuj iOS
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
      const isIOSStandalone = (window.navigator as any).standalone === true;
      setIsIOS(isIOSDevice);
      
      // Provjeri da li je PWA instalirana
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
      setIsInstalled(isStandalone || isIOSStandalone);
      
      // Prikaži iOS install prompt ako nije instalirana i korisnik je na iOS
      if (isIOSDevice && !isIOSStandalone && !isStandalone) {
        // Sačekaj malo da se stranica učita
        setTimeout(() => {
          setShowIOSInstall(true);
        }, 3000); // Prikaži nakon 3 sekunde
      }

      // Registriraj Service Worker
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("[PWA] Service Worker registriran:", registration);
            setSwRegistration(registration);

            // Provjeri za ažuriranja
            registration.addEventListener("updatefound", () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener("statechange", () => {
                  if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                    // Postoji nova verzija
                    setUpdateAvailable(true);
                    setShowUpdatePrompt(true);
                  }
                });
              }
            });

            // Provjeri da li postoji nova verzija pri učitavanju
            registration.update();
          })
          .catch((error) => {
            console.error("[PWA] Greška pri registraciji Service Workera:", error);
          });

        // Slušaj za promjene Service Workera
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          // Service Worker je ažuriran, osvježi stranicu
          window.location.reload();
        });
      }

      // Slušaj za "Install" prompt
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        if (!isInstalled) {
          setShowInstallPrompt(true);
        }
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

      // Provjeri da li je aplikacija instalirana nakon instalacije
      window.addEventListener("appinstalled", () => {
        console.log("[PWA] Aplikacija instalirana");
        setIsInstalled(true);
        setShowInstallPrompt(false);
        setDeferredPrompt(null);
      });

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      };
    }
  }, [isInstalled]);

  // Provjeri za ažuriranja svakih 5 minuta
  useEffect(() => {
    if (swRegistration) {
      const interval = setInterval(() => {
        swRegistration.update();
      }, 5 * 60 * 1000); // 5 minuta

      return () => clearInterval(interval);
    }
  }, [swRegistration]);

  const handleUpdate = () => {
    if (swRegistration && swRegistration.waiting) {
      // Pošalji poruku service workeru da preskoči čekanje
      swRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
      // Osvježi stranicu
      window.location.reload();
    } else {
      // Ako nema waiting service workera, samo osvježi
      window.location.reload();
    }
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log("[PWA] Korisnik je odlučio:", outcome);
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    }
  };

  const handleDismissUpdate = () => {
    setShowUpdatePrompt(false);
  };

  const handleDismissInstall = () => {
    setShowInstallPrompt(false);
  };

  if (showUpdatePrompt) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "#3b82f6",
          color: "white",
          padding: "16px 24px",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
          zIndex: 10000,
          maxWidth: "90%",
          width: "400px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: "16px" }}>
          🎉 Dostupna je nova verzija!
        </div>
        <div style={{ fontSize: "14px", opacity: 0.9 }}>
          Klikni "Ažuriraj" da vidiš najnovije promjene.
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={handleUpdate}
            style={{
              flex: 1,
              padding: "10px 16px",
              backgroundColor: "white",
              color: "#3b82f6",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.opacity = "0.9")}
            onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Ažuriraj
          </button>
          <button
            onClick={handleDismissUpdate}
            style={{
              padding: "10px 16px",
              backgroundColor: "transparent",
              color: "white",
              border: "1px solid white",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.opacity = "0.8")}
            onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Kasnije
          </button>
        </div>
      </div>
    );
  }

  if (showInstallPrompt && !isInstalled && !isIOS) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "#10b981",
          color: "white",
          padding: "16px 24px",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
          zIndex: 10000,
          maxWidth: "90%",
          width: "400px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: "16px" }}>
          📱 Instaliraj aplikaciju
        </div>
        <div style={{ fontSize: "14px", opacity: 0.9 }}>
          Instaliraj aplikaciju na svoj telefon za brži pristup.
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={handleInstall}
            style={{
              flex: 1,
              padding: "10px 16px",
              backgroundColor: "white",
              color: "#10b981",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.opacity = "0.9")}
            onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Instaliraj
          </button>
          <button
            onClick={handleDismissInstall}
            style={{
              padding: "10px 16px",
              backgroundColor: "transparent",
              color: "white",
              border: "1px solid white",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.opacity = "0.8")}
            onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
          >
            Ne sada
          </button>
        </div>
      </div>
    );
  }

  // iOS Install Instructions
  if (showIOSInstall && !isInstalled && isIOS) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "#10b981",
          color: "white",
          padding: "20px 24px",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
          zIndex: 10000,
          maxWidth: "90%",
          width: "400px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <div style={{ fontWeight: 600, fontSize: "18px", marginBottom: "8px" }}>
          📱 Instaliraj aplikaciju
        </div>
        <div style={{ fontSize: "14px", opacity: 0.95, lineHeight: "1.6" }}>
          <div style={{ marginBottom: "12px" }}>
            <strong>Korak 1:</strong> Klikni na <strong>Share</strong> dugme <span style={{ fontSize: "18px" }}>↗️</span> (dolje u Safari browseru)
          </div>
          <div style={{ marginBottom: "12px" }}>
            <strong>Korak 2:</strong> Izaberi <strong>"Dodaj na početni ekran"</strong>
          </div>
          <div>
            <strong>Korak 3:</strong> Potvrdi instalaciju
          </div>
        </div>
        <button
          onClick={() => setShowIOSInstall(false)}
          style={{
            padding: "10px 16px",
            backgroundColor: "white",
            color: "#10b981",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "opacity 0.2s",
            marginTop: "8px",
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = "0.9")}
          onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
        >
          Razumijem
        </button>
      </div>
    );
  }

  return null;
}

