"use client";

import React from "react";
import { useSubscription } from "../context/SubscriptionContext";
import { useRouter } from "next/navigation";

export default function SubscriptionBanner() {
  const { subscription, loading } = useSubscription();
  const router = useRouter();

  if (loading || !subscription) {
    return null;
  }

  // Trial period - prikaži banner UVIJEK kada je u trial periodu
  if (subscription.isTrial) {
    return (
      <div
        style={{
          background: subscription.daysRemaining <= 3 ? "#fef3c7" : "#dbeafe",
          borderBottom: `2px solid ${subscription.daysRemaining <= 3 ? "#f59e0b" : "#3b82f6"}`,
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
          <span style={{ fontSize: "20px" }}>
            {subscription.daysRemaining <= 3 ? "⚠️" : "🎉"}
          </span>
          <div>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#1f2937" }}>
              {subscription.daysRemaining <= 3
                ? `Trial period ističe za ${subscription.daysRemaining} ${subscription.daysRemaining === 1 ? "dan" : "dana"}!`
                : `Trial period: Preostalo ${subscription.daysRemaining} ${subscription.daysRemaining === 1 ? "dan" : "dana"}`}
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6b7280" }}>
              Aktiviraj pretplatu da nastaviš koristiti aplikaciju
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push("/profile")}
          style={{
            padding: "8px 16px",
            background: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          Aktiviraj pretplatu
        </button>
      </div>
    );
  }

  // Grace period - prikaži upozorenje
  if (subscription.isGracePeriod) {
    return (
      <div
        style={{
          background: "#fee2e2",
          borderBottom: "2px solid #dc2626",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
          <span style={{ fontSize: "20px" }}>⚠️</span>
          <div>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#1f2937" }}>
              Pretplata je istekla! Grace period: {subscription.daysInGrace} {subscription.daysInGrace === 1 ? "dan" : "dana"}
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6b7280" }}>
              Aktiviraj pretplatu prije isteka grace perioda da nastaviš koristiti aplikaciju
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push("/profile")}
          style={{
            padding: "8px 16px",
            background: "#dc2626",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          Aktiviraj pretplatu
        </button>
      </div>
    );
  }

  // Pretplata ističe uskoro (manje od 7 dana) ili je neaktivna
  if (subscription.isActive && !subscription.isTrial && subscription.daysUntilExpiry <= 7) {
    return (
      <div
        style={{
          background: subscription.daysUntilExpiry <= 3 ? "#fef3c7" : "#dbeafe",
          borderBottom: `2px solid ${subscription.daysUntilExpiry <= 3 ? "#f59e0b" : "#3b82f6"}`,
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
          <span style={{ fontSize: "20px" }}>
            {subscription.daysUntilExpiry <= 3 ? "⚠️" : "ℹ️"}
          </span>
          <div>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#1f2937" }}>
              Pretplata ističe za {subscription.daysUntilExpiry} {subscription.daysUntilExpiry === 1 ? "dan" : "dana"}
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6b7280" }}>
              Obnovi pretplatu da nastaviš koristiti aplikaciju
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push("/profile")}
          style={{
            padding: "8px 16px",
            background: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          Obnovi pretplatu
        </button>
      </div>
    );
  }

  // Ako je pretplata neaktivna i nije u trial/grace periodu, prikaži banner
  if (!subscription.isActive && !subscription.isTrial && !subscription.isGracePeriod) {
    return (
      <div
        style={{
          background: "#fee2e2",
          borderBottom: "2px solid #dc2626",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
          <span style={{ fontSize: "20px" }}>⚠️</span>
          <div>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#1f2937" }}>
              Pretplata nije aktivna
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6b7280" }}>
              Aktiviraj pretplatu da nastaviš koristiti aplikaciju
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push("/profile")}
          style={{
            padding: "8px 16px",
            background: "#dc2626",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          Aktiviraj pretplatu
        </button>
      </div>
    );
  }

  return null;
}

