"use client";

import React, { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PWAUpdatePrompt() {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Provjeri da li je aplikacija već instalirana
    if (typeof window !== "undefined") {
      // Provjeri da li je PWA instalirana
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone || isIOSStandalone);

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

  if (showInstallPrompt && !isInstalled) {
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

  return null;
}

