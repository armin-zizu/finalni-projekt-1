"use client";

import React from "react";
import { useSupportChat } from "../context/SupportChatContext";
import { FaComments } from "react-icons/fa";

export default function SupportChatButton() {
  const { isOpen, unreadCount, openChat } = useSupportChat();

  return (
    <>
      {!isOpen && (
        <button
          onClick={openChat}
          style={{
            position: "fixed",
            bottom: "90px", // Iznad sidebara (60px visina + 20px padding + 10px razmak)
            right: "20px",
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(59, 130, 246, 0.4)",
            zIndex: 1100, // Iznad sidebara (1000)
            transition: "all 0.3s ease",
            color: "white",
            fontSize: "24px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.1)";
            e.currentTarget.style.boxShadow = "0 6px 16px rgba(59, 130, 246, 0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.4)";
          }}
          aria-label="Otvori chat za podršku"
        >
          <FaComments />
          {unreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: "-4px",
                right: "-4px",
                background: "#ef4444",
                color: "white",
                borderRadius: "50%",
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                fontWeight: 700,
                border: "2px solid white",
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
              }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      )}
    </>
  );
}

