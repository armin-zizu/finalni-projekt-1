"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSupportChat } from "../context/SupportChatContext";
import { FaTimes, FaPaperPlane, FaSpinner } from "react-icons/fa";
import { useRole } from "../context/RoleContext";

export default function SupportChatWindow() {
  const {
    isOpen,
    messages,
    isLoading,
    error,
    closeChat,
    sendMessage,
    conversationId,
  } = useSupportChat();

  const { user } = useRole();
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );

  // Detekcija mobilnog uređaja
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth <= 768);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-scroll do najnovije poruke
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!messageText.trim() || sending) return;

    try {
      setSending(true);
      await sendMessage(messageText.trim());
      setMessageText("");
    } catch (err) {
      // Error je već postavljen u context-u
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("hr-HR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: isMobile ? "0px" : "20px",
        right: isMobile ? "0px" : "20px",
        left: isMobile ? "0px" : "auto",
        top: isMobile ? "0px" : "auto",
        width: isMobile ? "100vw" : "calc(100vw - 40px)",
        maxWidth: isMobile ? "100%" : "600px",
        height: isMobile ? "100vh" : "calc(100vh - 40px)",
        maxHeight: isMobile ? "100vh" : "calc(100vh - 40px)",
        background: "white",
        borderRadius: isMobile ? "0px" : "16px",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
        zIndex: 1100, // Iznad sidebara (1000) i dugmeta (1100)
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
          color: "white",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: "16px", fontWeight: 600 }}>💬 Podrška</div>
          <div style={{ fontSize: "12px", opacity: 0.9 }}>
            {user?.email || "Korisnik"}
          </div>
        </div>
        <button
          onClick={closeChat}
          style={{
            background: "rgba(255, 255, 255, 0.2)",
            border: "none",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "white",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
          }}
        >
          <FaTimes />
        </button>
      </div>

      {/* Messages Area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          background: "#f9fafb",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {isLoading && messages.length === 0 ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              flex: 1,
            }}
          >
            <FaSpinner
              style={{
                animation: "spin 1s linear infinite",
                fontSize: "24px",
                color: "#3b82f6",
              }}
            />
          </div>
        ) : messages.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              color: "#6b7280",
              textAlign: "center",
              padding: "20px",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>💬</div>
            <div style={{ fontSize: "16px", fontWeight: 500, marginBottom: "8px" }}>
              Nema poruka
            </div>
            <div style={{ fontSize: "14px" }}>
              Pošaljite poruku da započnete konverzaciju
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const isAdmin = message.isAdminResponse;
            return (
              <div
                key={message.id}
                style={{
                  display: "flex",
                  justifyContent: isAdmin ? "flex-end" : "flex-start",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    maxWidth: "75%",
                    padding: "10px 14px",
                    borderRadius: "12px",
                    background: isAdmin
                      ? "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
                      : "#ffffff",
                    color: isAdmin ? "white" : "#1f2937",
                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                    wordWrap: "break-word",
                  }}
                >
                  <div style={{ fontSize: "14px", lineHeight: "1.5" }}>
                    {message.message}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      opacity: 0.7,
                      marginTop: "4px",
                      textAlign: "right",
                    }}
                  >
                    {formatTime(message.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        {error && (
          <div
            style={{
              padding: "12px",
              background: "#fee2e2",
              color: "#dc2626",
              borderRadius: "8px",
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div
        style={{
          padding: "16px",
          background: "white",
          borderTop: "1px solid #e5e7eb",
        }}
      >
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Unesite poruku..."
            rows={3}
            style={{
              flex: 1,
              padding: "10px 14px",
              border: "2px solid #e5e7eb",
              borderRadius: "8px",
              fontSize: "14px",
              fontFamily: "inherit",
              resize: "none",
              outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#3b82f6";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#e5e7eb";
            }}
          />
          <button
            onClick={handleSend}
            disabled={!messageText.trim() || sending}
            style={{
              padding: "10px 16px",
              background:
                messageText.trim() && !sending
                  ? "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
                  : "#d1d5db",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: messageText.trim() && !sending ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              if (messageText.trim() && !sending) {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(59, 130, 246, 0.3)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {sending ? (
              <FaSpinner
                style={{
                  animation: "spin 1s linear infinite",
                  fontSize: "16px",
                }}
              />
            ) : (
              <FaPaperPlane style={{ fontSize: "16px" }} />
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

