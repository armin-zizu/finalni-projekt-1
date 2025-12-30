"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { getSupportMessages, sendSupportMessage, getUnreadCount, type SupportMessage } from "../../lib/api";

interface SupportChatContextType {
  messages: SupportMessage[];
  unreadCount: number;
  conversationId: string | null;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  openChat: () => void;
  closeChat: () => void;
  sendMessage: (message: string) => Promise<void>;
  refreshMessages: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
}

const SupportChatContext = createContext<SupportChatContextType | undefined>(undefined);

export function SupportChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Učitaj poruke
  const loadMessages = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const loadedMessages = await getSupportMessages();
      setMessages(loadedMessages);
      
      // Postavi conversation_id iz prve poruke ako postoji
      if (loadedMessages.length > 0 && !conversationId) {
        setConversationId(loadedMessages[0].conversationId);
      }
    } catch (err: any) {
      console.error("Error loading messages:", err);
      setError(err.message || "Greška pri učitavanju poruka");
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  // Učitaj broj nepročitanih poruka
  const loadUnreadCount = useCallback(async () => {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch (err) {
      console.error("Error loading unread count:", err);
    }
  }, []);

  // Pošalji poruku
  const sendMessage = useCallback(async (messageText: string) => {
    try {
      setError(null);
      const newMessage = await sendSupportMessage(messageText, conversationId || undefined);
      
      setMessages(prev => [...prev, newMessage]);
      
      // Postavi conversation_id ako je nova konverzacija
      if (!conversationId) {
        setConversationId(newMessage.conversationId);
      }
    } catch (err: any) {
      console.error("Error sending message:", err);
      setError(err.message || "Greška pri slanju poruke");
      throw err;
    }
  }, [conversationId]);

  // Refresh poruka
  const refreshMessages = useCallback(async () => {
    await loadMessages();
  }, [loadMessages]);

  // Refresh unread count
  const refreshUnreadCount = useCallback(async () => {
    await loadUnreadCount();
  }, [loadUnreadCount]);

  // Otvori chat
  const openChat = useCallback(() => {
    setIsOpen(true);
    loadMessages();
  }, [loadMessages]);

  // Zatvori chat
  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Setup SSE za real-time updates
  useEffect(() => {
    if (!isOpen) return;

    // Pošalji početni zahtjev za poruke
    loadMessages();

    // Setup SSE connection
    const token = localStorage.getItem('token');
    if (!token) return;

    // Koristi polling umjesto SSE za početak (jednostavnije)
    const startPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      pollingIntervalRef.current = setInterval(async () => {
        try {
          const loadedMessages = await getSupportMessages();
          setMessages(prev => {
            // Provjeri da li ima novih poruka
            const prevIds = new Set(prev.map(m => m.id));
            const newMessages = loadedMessages.filter(m => !prevIds.has(m.id));
            
            if (newMessages.length > 0) {
              return [...prev, ...newMessages].sort((a, b) => 
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              );
            }
            
            return prev;
          });
          
          await loadUnreadCount();
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 5000); // Poll svakih 5 sekundi
    };

    startPolling();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [isOpen, loadMessages, loadUnreadCount]);

  // Load unread count on mount i periodički
  useEffect(() => {
    loadUnreadCount();
    
    const interval = setInterval(() => {
      loadUnreadCount();
    }, 30000); // Provjeri svakih 30 sekundi

    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  const value: SupportChatContextType = {
    messages,
    unreadCount,
    conversationId,
    isOpen,
    isLoading,
    error,
    openChat,
    closeChat,
    sendMessage,
    refreshMessages,
    refreshUnreadCount,
  };

  return (
    <SupportChatContext.Provider value={value}>
      {children}
    </SupportChatContext.Provider>
  );
}

export const useSupportChat = () => {
  const context = useContext(SupportChatContext);
  if (!context) {
    throw new Error("useSupportChat must be used within a SupportChatProvider");
  }
  return context;
};

