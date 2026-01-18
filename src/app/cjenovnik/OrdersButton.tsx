"use client";

import React from "react";
import { FaClipboardList } from "react-icons/fa";

const ordersButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  background: "#111827",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: "8px",
  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.18)",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

export default function OrdersButton() {
  return (
    <button type="button" style={ordersButtonStyle}>
      <FaClipboardList /> Narudžbe
    </button>
  );
}
