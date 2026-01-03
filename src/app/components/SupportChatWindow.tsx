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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

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

  // Detekcija otvaranja/zatvaranja tastature na mobilnoj verziji
  useEffect(() => {
    if (!isMobile || typeof window === 'undefined') return;

    const handleResize = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const initialHeight = window.innerHeight;
      const heightDiff = initialHeight - currentHeight;
      
      if (heightDiff > 150) {
        // Tastatura je otvorena (obično je visina 200-400px)
        setKeyboardHeight(heightDiff);
        setIsKeyboardOpen(true);
        // Scroll do inputa
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }
        }, 100);
      } else {
        // Tastatura je zatvorena
        setKeyboardHeight(0);
        setIsKeyboardOpen(false);
      }
    };

    const handleFocus = () => {
      setIsKeyboardOpen(true);
      setTimeout(() => {
        handleResize();
        if (textareaRef.current) {
          textareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }, 300);
    };

    const handleBlur = () => {
      setIsKeyboardOpen(false);
      setKeyboardHeight(0);
    };

    if (textareaRef.current) {
      textareaRef.current.addEventListener('focus', handleFocus);
      textareaRef.current.addEventListener('blur', handleBlur);
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    } else {
      window.addEventListener('resize', handleResize);
    }

    return () => {
      if (textareaRef.current) {
        textareaRef.current.removeEventListener('focus', handleFocus);
        textareaRef.current.removeEventListener('blur', handleBlur);
      }
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      } else {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, [isMobile, isOpen]);

  // Spriječi scroll na body kada je tastatura otvorena
  useEffect(() => {
    if (isMobile && isKeyboardOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [isMobile, isKeyboardOpen]);

  // Spriječi pinch-to-zoom i double-tap zoom na mobilnoj verziji
  useEffect(() => {
    if (!isMobile || !isOpen) return;

    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const preventDoubleTapZoom = (e: TouchEvent) => {
      const now = Date.now();
      const timeSince = now - (preventDoubleTapZoom as any).lastTouch || 0;
      (preventDoubleTapZoom as any).lastTouch = now;

      if (timeSince < 300 && timeSince > 0) {
        e.preventDefault();
      }
    };

    const container = chatContainerRef.current;
    if (container) {
      container.addEventListener('touchstart', preventZoom, { passive: false });
      container.addEventListener('touchmove', preventZoom, { passive: false });
      container.addEventListener('touchend', preventDoubleTapZoom, { passive: false });
      container.addEventListener('gesturestart', (e) => e.preventDefault());
      container.addEventListener('gesturechange', (e) => e.preventDefault());
      container.addEventListener('gestureend', (e) => e.preventDefault());
    }

    return () => {
      if (container) {
        container.removeEventListener('touchstart', preventZoom);
        container.removeEventListener('touchmove', preventZoom);
        container.removeEventListener('touchend', preventDoubleTapZoom);
        container.removeEventListener('gesturestart', (e) => e.preventDefault());
        container.removeEventListener('gesturechange', (e) => e.preventDefault());
        container.removeEventListener('gestureend', (e) => e.preventDefault());
      }
    };
  }, [isMobile, isOpen]);

  // Auto-scroll do najnovije poruke
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages, isKeyboardOpen]);

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

  // Dinamička visina na mobilnoj verziji kada je tastatura otvorena
  const getChatHeight = () => {
    if (!isMobile) return "calc(100vh - 40px)";
    if (isKeyboardOpen && typeof window !== 'undefined') {
      const vpHeight = window.visualViewport?.height;
      if (vpHeight && vpHeight > 0) {
        return `${vpHeight}px`;
      }
      return `${window.innerHeight}px`;
    }
    return "100vh";
  };

  const chatHeight = getChatHeight();

  return (
    <div
      ref={chatContainerRef}
      style={{
        position: "fixed",
        bottom: isMobile ? (isKeyboardOpen ? "0px" : "0px") : "20px",
        right: isMobile ? "0px" : "20px",
        left: isMobile ? "0px" : "auto",
        top: isMobile && isKeyboardOpen ? "0px" : (isMobile ? "0px" : "auto"),
        width: isMobile ? "100vw" : "calc(100vw - 40px)",
        maxWidth: isMobile ? "100%" : "600px",
        height: chatHeight,
        maxHeight: chatHeight,
        background: "white",
        borderRadius: isMobile ? "0px" : "16px",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
        zIndex: 1100, // Iznad sidebara (1000) i dugmeta (1100)
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: isMobile ? "height 0.25s ease-out" : "none",
        touchAction: isMobile ? "pan-y" : "auto",
      }}
      onTouchMove={(e: React.TouchEvent) => {
        if (isMobile && e.touches.length > 1) {
          e.preventDefault();
        }
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
        ref={messagesEndRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          paddingBottom: isMobile && isKeyboardOpen ? "8px" : "16px",
          background: "#f9fafb",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          WebkitOverflowScrolling: "touch",
        }}
        onScroll={(e) => {
          // Scroll to bottom kada je tastatura otvorena
          if (isMobile && isKeyboardOpen) {
            const element = e.currentTarget;
            const isScrolledToBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 100;
            if (!isScrolledToBottom && messagesEndRef.current) {
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
              }, 100);
            }
          }
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
        <div style={{ minHeight: "1px" }} />
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
            ref={textareaRef}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Unesite poruku..."
            rows={isMobile ? 1 : 3}
            style={{
              flex: 1,
              padding: "10px 14px",
              border: "2px solid #e5e7eb",
              borderRadius: "8px",
              fontSize: isMobile ? "16px" : "14px",
              fontFamily: "inherit",
              resize: "none",
              outline: "none",
              transition: "border-color 0.2s",
              maxHeight: isMobile ? "120px" : "100px",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#3b82f6";
              if (isMobile) {
                setTimeout(() => {
                  e.target.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }, 300);
              }
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
        @media (max-width: 768px) {
          /* Spriječi automatsko zumiranje na textarea - iOS Safari zumira ako je font-size < 16px */
          textarea {
            font-size: 16px !important;
          }
          /* Spriječi pinch-to-zoom i double-tap zoom */
          textarea, input {
            touch-action: pan-y !important;
          }
          /* Osiguraj da poruke mogu biti selektovane */
          [style*="message"] {
            -webkit-user-select: text !important;
            user-select: text !important;
          }
        }
      `}</style>
    </div>
  );
}

