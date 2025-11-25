"use client";

import React, { ReactNode } from "react";
import { useSubscription } from "../context/SubscriptionContext";
import { usePathname } from "next/navigation";

export default function SubscriptionGuard({ children }: { children: ReactNode }) {
  const { subscription, loading } = useSubscription();
  const pathname = usePathname();

  // Uvijek dozvoli pristup profilu
  if (pathname === "/profile") {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center", color: "#6b7280" }}>
        Učitavanje statusa pretplate...
      </div>
    );
  }

  // Ako nema pretplate ili je neaktivna i nije u trial/grace periodu
  if (!subscription || (!subscription.isActive && !subscription.isTrial && !subscription.isGracePeriod)) {
    return (
      <div style={{ padding: "40px", textAlign: "center", background: "#fff", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
        <h2 style={{ color: "#dc2626", marginBottom: "16px" }}>Pristup odbijen!</h2>
        <p style={{ color: "#4b5563", fontSize: "16px", marginBottom: "24px" }}>
          Vaša pretplata nije aktivna ili je istekla. Molimo aktivirajte pretplatu na stranici profila da biste nastavili koristiti aplikaciju.
        </p>
        <button
          onClick={() => window.location.href = "/profile"}
          style={{
            padding: "10px 20px",
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
    );
  }

  return <>{children}</>;
}

