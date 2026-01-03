"use client";

import React, { useState, useEffect, useRef } from "react";
import { getAuthToken } from "../../lib/api";
import { FaComments, FaPaperPlane, FaSpinner, FaTimes } from "react-icons/fa";

interface Message {
  id: string;
  userId: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  isAdminResponse: boolean;
  conversationId: string;
}

interface Conversation {
  conversationId: string;
  userId: string;
  userEmail: string;
  appName?: string;
  lastMessage: string | null | {
    message: string;
    createdAt: string;
    isAdminResponse: boolean;
  };
  lastMessageAt: string;
  unreadCount: number;
}

export default function AdminChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
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
    if (!isMobile || typeof window === 'undefined' || !isOpen) return;

    const handleResize = () => {
      const currentHeight = window.visualViewport?.height || window.innerHeight;
      const initialHeight = window.innerHeight;
      const heightDiff = initialHeight - currentHeight;
      
      if (heightDiff > 150) {
        // Tastatura je otvorena
        setKeyboardHeight(heightDiff);
        setIsKeyboardOpen(true);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
          }
        }, 100);
      } else {
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
  }, [isMobile, isOpen, selectedConversation]);

  // Spriječi scroll na body kada je tastatura otvorena
  useEffect(() => {
    if (isMobile && isKeyboardOpen && isOpen) {
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
  }, [isMobile, isKeyboardOpen, isOpen]);

  // Auto-scroll do najnovije poruke
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages, isKeyboardOpen]);

  // Setup SSE za real-time updates
  useEffect(() => {
    if (!isOpen) {
      // Zatvori SSE konekciju kada se chat zatvori
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    // Setup SSE connection
    const token = getAuthToken();
    if (!token) return;

    // Učitaj početne podatke
    loadConversations();
    if (selectedConversation) {
      loadMessages(selectedConversation);
    }

    // Konektuj se na SSE endpoint
    // EventSource ne može slati custom headers, pa koristimo query parametar
    const sseUrl = `/api/support/sse?token=${encodeURIComponent(token)}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onopen = () => {
      console.log("AdminChat - SSE connected");
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'new_messages' && data.messages && data.messages.length > 0) {
          console.log("AdminChat - New messages received via SSE:", data.messages);
          
          // Provjeri da li su nove poruke relevantne za trenutno otvorenu konverzaciju
          const relevantMessages = data.messages.filter((msg: Message) => 
            selectedConversation ? msg.conversationId === selectedConversation : true
          );

          if (relevantMessages.length > 0) {
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const newMsgs = relevantMessages.filter((m: Message) => !existingIds.has(m.id));
              if (newMsgs.length > 0) {
                return [...prev, ...newMsgs].sort((a, b) => 
                  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );
              }
              return prev;
            });
          }

          // Osvježi listu konverzacija
          loadConversations();
          
          // Ako je otvorena konverzacija, osvježi poruke
          if (selectedConversation) {
            loadMessages(selectedConversation);
          }
        } else if (data.type === 'ping') {
          // Heartbeat - do nothing
        } else if (data.type === 'error') {
          console.error("AdminChat - SSE error:", data.message);
        }
      } catch (err) {
        console.error("AdminChat - Error parsing SSE message:", err);
      }
    };

    eventSource.onerror = (error) => {
      console.error("AdminChat - SSE error:", error);
      setError("Greška u real-time konekciji. Pokušavam ponovo...");
      
      // Pokušaj re-konektovati nakon 3 sekunde
      setTimeout(() => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        eventSourceRef.current = null;
        // Re-trigger useEffect
        setIsOpen(false);
        setTimeout(() => setIsOpen(true), 100);
      }, 3000);
    };

    eventSourceRef.current = eventSource;

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isOpen, selectedConversation]);

  // Učitaj konverzacije
  const loadConversations = async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch("/api/support/conversations", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("AdminChat - Conversations loaded:", data);
        // Mapiraj podatke u ispravan format
        const mappedConversations = (data.conversations || []).map((conv: any) => ({
          conversationId: conv.conversationId,
          userId: conv.userId,
          userEmail: conv.userEmail || "Nepoznat korisnik",
          appName: conv.appName,
          lastMessage: conv.lastMessage,
          lastMessageAt: conv.lastMessageAt,
          unreadCount: conv.unreadCount || 0,
        }));
        console.log("AdminChat - Mapped conversations:", mappedConversations);
        setConversations(mappedConversations);
      } else {
        const errorText = await response.text();
        console.error("AdminChat - Error loading conversations:", response.status, errorText);
        setError(`Greška pri učitavanju konverzacija: ${response.status}`);
      }
    } catch (error: any) {
      console.error("Error loading conversations:", error);
      setError(`Greška: ${error.message || 'Nepoznata greška'}`);
    } finally {
      setLoading(false);
    }
  };

  // Učitaj poruke za odabranu konverzaciju
  const loadMessages = async (conversationId: string) => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(`/api/support/conversations/${conversationId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  // Pošalji poruku
  const handleSend = async () => {
    if (!messageText.trim() || !selectedConversation || sending) return;

    try {
      setSending(true);
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch(`/api/support/conversations/${selectedConversation}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: messageText.trim() }),
      });

      if (response.ok) {
        setMessageText("");
        await loadMessages(selectedConversation);
        await loadConversations(); // Osvježi listu konverzacija
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  // Učitaj konverzacije samo jednom pri mount-u i kada se chat otvori
  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

  // Učitaj poruke kada se promijeni selectedConversation
  useEffect(() => {
    if (selectedConversation && isOpen) {
      loadMessages(selectedConversation);
    }
  }, [selectedConversation, isOpen]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("hr-HR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("hr-HR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const selectedConv = conversations.find((c) => c.conversationId === selectedConversation);

  if (!isOpen) {
    const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
    const buttonSize = isMobile ? "48px" : "56px";
    const buttonFontSize = isMobile ? "20px" : "24px";
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: "fixed",
          bottom: isMobile ? "70px" : "90px",
          right: isMobile ? "10px" : "20px",
          width: buttonSize,
          height: buttonSize,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 12px rgba(59, 130, 246, 0.4)",
          zIndex: 1100,
          transition: "all 0.3s ease",
          color: "white",
          fontSize: buttonFontSize,
        }}
        aria-label="Otvori chat za podršku"
      >
        <FaComments />
        {totalUnread > 0 && (
          <span
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              background: "#ef4444",
              color: "white",
              borderRadius: "50%",
              width: isMobile ? "20px" : "24px",
              height: isMobile ? "20px" : "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: isMobile ? "10px" : "12px",
              fontWeight: 700,
              border: "2px solid white",
              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
            }}
          >
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>
    );
  }

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
        bottom: isMobile ? "0px" : "20px",
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
        zIndex: 1100,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: isMobile ? "height 0.25s ease-out" : "none",
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
          <div style={{ fontSize: "16px", fontWeight: 600 }}>💬 Chat Podrška - Admin</div>
          <div style={{ fontSize: "12px", opacity: 0.9 }}>
            {conversations.length} konverzacija
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
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
          }}
        >
          <FaTimes />
        </button>
      </div>

      <div style={{ 
        display: "flex", 
        flex: 1, 
        overflow: "hidden",
        flexDirection: isMobile && selectedConversation ? "column" : "row",
      }}>
        {/* Lista konverzacija */}
        {(isMobile && selectedConversation ? false : true) && (
        <div
          style={{
            width: isMobile ? "100%" : "240px",
            minWidth: isMobile ? "100%" : "200px",
            borderRight: isMobile ? "none" : "1px solid #e5e7eb",
            borderBottom: isMobile && !selectedConversation ? "1px solid #e5e7eb" : "none",
            display: "flex",
            flexDirection: "column",
            background: "#f9fafb",
            height: isMobile && !selectedConversation ? "100%" : "auto",
          }}
        >
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid #e5e7eb",
              fontWeight: 600,
              fontSize: "13px",
              color: "#374151",
            }}
          >
            Konverzacije
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {error && (
              <div style={{ padding: "12px", margin: "8px", background: "#fee2e2", color: "#dc2626", borderRadius: "8px", fontSize: "12px" }}>
                {error}
              </div>
            )}
            {loading ? (
              <div style={{ padding: "20px", textAlign: "center" }}>
                <FaSpinner style={{ animation: "spin 1s linear infinite", fontSize: "24px", color: "#3b82f6" }} />
                <div style={{ marginTop: "8px", fontSize: "12px", color: "#6b7280" }}>Učitavanje...</div>
              </div>
            ) : conversations.length === 0 ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#6b7280", fontSize: "14px" }}>
                {error ? "Greška pri učitavanju" : "Nema konverzacija"}
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.conversationId}
                  onClick={() => setSelectedConversation(conv.conversationId)}
                  style={{
                    padding: "10px 12px",
                    cursor: "pointer",
                    borderBottom: "1px solid #e5e7eb",
                    background:
                      selectedConversation === conv.conversationId ? "#eff6ff" : "white",
                    transition: "all 0.2s ease",
                    borderLeft: selectedConversation === conv.conversationId ? "3px solid #3b82f6" : "3px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (selectedConversation !== conv.conversationId) {
                      e.currentTarget.style.background = "#f9fafb";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedConversation !== conv.conversationId) {
                      e.currentTarget.style.background = "white";
                    }
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        fontWeight: selectedConversation === conv.conversationId ? 700 : 600, 
                        fontSize: "12px", 
                        color: selectedConversation === conv.conversationId ? "#1e40af" : "#1f2937", 
                        marginBottom: "4px", 
                        overflow: "hidden", 
                        textOverflow: "ellipsis", 
                        whiteSpace: "nowrap" 
                      }}>
                        {conv.userEmail || "Nepoznat korisnik"}
                      </div>
                      <div style={{ 
                        fontSize: "10px", 
                        color: "#9ca3af",
                        fontWeight: 400,
                      }}>
                        {formatDate(conv.lastMessageAt)}
                      </div>
                    </div>
                    {conv.unreadCount > 0 && (
                      <div
                        style={{
                          background: "#ef4444",
                          color: "white",
                          borderRadius: "10px",
                          minWidth: "20px",
                          height: "20px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "0 6px",
                          flexShrink: 0,
                          boxShadow: "0 2px 4px rgba(239, 68, 68, 0.3)",
                        }}
                      >
                        {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        )}

        {/* Poruke */}
        {(isMobile && !selectedConversation ? false : true) && (
        <div style={{ 
          flex: 1, 
          display: "flex", 
          flexDirection: "column",
          width: isMobile ? "100%" : "auto",
        }}>
          {selectedConversation ? (
            <>
              {/* Header konverzacije */}
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #e5e7eb",
                  background: "#f9fafb",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: isMobile ? "13px" : "14px", color: "#1f2937" }}>
                  {selectedConv?.userEmail || "Korisnik"}
                </div>
                {isMobile && (
                  <button
                    onClick={() => setSelectedConversation(null)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#6b7280",
                      cursor: "pointer",
                      fontSize: "14px",
                      padding: "4px 8px",
                      fontWeight: 500,
                    }}
                  >
                    ← Nazad
                  </button>
                )}
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
                  if (isMobile && isKeyboardOpen) {
                    const element = e.currentTarget;
                    const isScrolledToBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 100;
                    if (!isScrolledToBottom && messagesEndRef.current) {
                      setTimeout(() => {
                        if (messagesEndRef.current) {
                          messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
                        }
                      }, 100);
                    }
                  }
                }}
              >
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: msg.isAdminResponse ? "flex-end" : "flex-start",
                      maxWidth: "70%",
                    }}
                  >
                    <div
                      style={{
                        background: msg.isAdminResponse ? "#3b82f6" : "white",
                        color: msg.isAdminResponse ? "white" : "#1f2937",
                        padding: "10px 14px",
                        borderRadius: "12px",
                        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                        fontSize: "14px",
                        lineHeight: "1.5",
                      }}
                    >
                      {msg.message}
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#6b7280",
                        marginTop: "4px",
                        paddingLeft: msg.isAdminResponse ? "0" : "4px",
                        paddingRight: msg.isAdminResponse ? "4px" : "0",
                        textAlign: msg.isAdminResponse ? "right" : "left",
                      }}
                    >
                      {formatTime(msg.createdAt)}
                    </div>
                  </div>
                ))}
                <div style={{ minHeight: "1px" }} />
              </div>

              {/* Input Area */}
              <div
                style={{
                  padding: "12px",
                  borderTop: "1px solid #e5e7eb",
                  background: "white",
                  display: "flex",
                  gap: "8px",
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Napišite poruku..."
                  style={{
                    flex: 1,
                    padding: "10px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    fontSize: isMobile ? "16px" : "14px",
                    resize: "none",
                    minHeight: "40px",
                    maxHeight: isMobile ? "120px" : "100px",
                    fontFamily: "inherit",
                  }}
                  rows={1}
                  onFocus={(e) => {
                    if (isMobile) {
                      setTimeout(() => {
                        e.target.scrollIntoView({ behavior: 'smooth', block: 'end' });
                      }, 300);
                    }
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!messageText.trim() || sending}
                  style={{
                    padding: "10px 20px",
                    background: messageText.trim() && !sending ? "#3b82f6" : "#9ca3af",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: messageText.trim() && !sending ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "14px",
                    fontWeight: 500,
                  }}
                >
                  {sending ? (
                    <FaSpinner style={{ animation: "spin 1s linear infinite" }} />
                  ) : (
                    <>
                      Pošalji <FaPaperPlane />
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6b7280",
                fontSize: "14px",
              }}
            >
              Odaberite konverzaciju
            </div>
          )}
        </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          /* Spriječi automatsko zumiranje na textarea - iOS Safari zumira ako je font-size < 16px */
          textarea {
            font-size: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}

