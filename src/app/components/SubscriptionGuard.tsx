"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSubscription } from "../context/SubscriptionContext";

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

export default function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { subscription, loading } = useSubscription();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Ako se još učitava, ne blokiraj
    if (loading) {
      return;
    }

    // Ako nema pretplate, ne blokiraj (možda korisnik nije prijavljen)
    if (!subscription) {
      return;
    }

    // Ako je na profil stranici, uvijek dozvoli pristup
    if (pathname === "/profile") {
      return;
    }

    // Provjeri da li korisnik ima pristup
    // Pristup imaju ako:
    // 1. Pretplata je aktivna (trial ili plaćena)
    // 2. Ili je u grace periodu
    const hasAccess = subscription.isActive || subscription.isTrial || subscription.isGracePeriod;

    if (!hasAccess) {
      // Blokiraj pristup i preusmjeri na profil
      router.push("/profile");
    }
  }, [subscription, loading, pathname, router]);

  // Ako se učitava, prikaži loading
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "50vh" }}>
        <div style={{ fontSize: "16px", color: "#6b7280" }}>Učitavanje...</div>
      </div>
    );
  }

  // Ako nema pretplate, prikaži children (možda korisnik nije prijavljen)
  if (!subscription) {
    return <>{children}</>;
  }

  // Ako je na profil stranici, uvijek prikaži
  if (pathname === "/profile") {
    return <>{children}</>;
  }

  // Provjeri pristup
  const hasAccess = subscription.isActive || subscription.isTrial || subscription.isGracePeriod;

  if (!hasAccess) {
    // Prikaži poruku o blokiranom pristupu
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: "50vh", padding: "20px" }}>
        <div style={{ textAlign: "center", maxWidth: "500px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: 600, color: "#1f2937", marginBottom: "16px" }}>
            Pretplata je istekla
          </h2>
          <p style={{ fontSize: "16px", color: "#6b7280", marginBottom: "24px" }}>
            Vaša pretplata i grace period su istekli. Molimo aktivirajte pretplatu da nastavite koristiti aplikaciju.
          </p>
          <button
            onClick={() => router.push("/profile")}
            style={{
              padding: "12px 24px",
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: 500,
            }}
          >
            Idi na Profil
          </button>
        </div>
      </div>
    );
  }

  // Ako ima pristup, prikaži children
  return <>{children}</>;
}

