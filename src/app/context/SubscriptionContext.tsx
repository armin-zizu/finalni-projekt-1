"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { auth, onAuthStateChanged } from "../../lib/firebase";
import { db } from "../../lib/firestore";
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";

interface SubscriptionStatus {
  isActive: boolean;
  isTrial: boolean;
  isGracePeriod: boolean;
  trialEndDate: Date | null;
  expiryDate: Date | null;
  graceEndDate: Date | null;
  monthlyPrice: number;
  lastPaymentDate: Date | null;
  daysRemaining: number;
  daysUntilExpiry: number;
  daysInGrace: number;
}

interface SubscriptionContextType {
  subscription: SubscriptionStatus | null;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const calculateSubscriptionStatus = (data: any, userCreatedAt: Date | null): SubscriptionStatus => {
    const now = new Date();
    let trialEndDate: Date | null = null;
    let expiryDate: Date | null = null;
    let graceEndDate: Date | null = null;
    let isTrial = false;
    let isGracePeriod = false;
    let isActive = false;
    let daysRemaining = 0;
    let daysUntilExpiry = 0;
    let daysInGrace = 0;

    // Ako postoji trialEndDate u podacima, koristi ga
    if (data.trialEndDate) {
      trialEndDate = data.trialEndDate.toDate ? data.trialEndDate.toDate() : new Date(data.trialEndDate);
    } else if (userCreatedAt) {
      // Ako nema trialEndDate, kreiraj ga na osnovu datuma registracije (15 dana)
      trialEndDate = new Date(userCreatedAt);
      trialEndDate.setDate(trialEndDate.getDate() + 15);
    }

    // Provjeri da li je u trial periodu
    if (trialEndDate && now < trialEndDate) {
      isTrial = true;
      isActive = true;
      daysRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      // Nije u trial periodu, provjeri pretplatu
      if (data.expiryDate) {
        expiryDate = data.expiryDate.toDate ? data.expiryDate.toDate() : new Date(data.expiryDate);
        
        if (now < expiryDate) {
          // Pretplata je aktivna
          isActive = true;
          daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        } else {
          // Pretplata je istekla, provjeri grace period
          if (data.graceEndDate) {
            graceEndDate = data.graceEndDate.toDate ? data.graceEndDate.toDate() : new Date(data.graceEndDate);
          } else {
            // Kreiraj grace period (7 dana od isteka pretplate)
            graceEndDate = new Date(expiryDate);
            graceEndDate.setDate(graceEndDate.getDate() + 7);
          }

          if (now < graceEndDate) {
            // U grace periodu
            isGracePeriod = true;
            isActive = false; // Neaktivna, ali ima pristup
            daysInGrace = Math.ceil((graceEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          } else {
            // Grace period je istekao - potpuno blokiran
            isActive = false;
            isGracePeriod = false;
          }
        }
      }
    }

    return {
      isActive,
      isTrial,
      isGracePeriod,
      trialEndDate,
      expiryDate,
      graceEndDate,
      monthlyPrice: data.monthlyPrice || 50,
      lastPaymentDate: data.lastPaymentDate ? (data.lastPaymentDate.toDate ? data.lastPaymentDate.toDate() : new Date(data.lastPaymentDate)) : null,
      daysRemaining,
      daysUntilExpiry,
      daysInGrace,
    };
  };

  const loadSubscription = async () => {
    const user = auth.currentUser;
    console.log("SubscriptionContext - loadSubscription called, user:", user?.email);
    
    if (!user) {
      console.log("SubscriptionContext - No user, setting subscription to null");
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      const userId = user.uid;
      console.log("SubscriptionContext - Loading subscription for user:", userId);
      console.log("SubscriptionContext - User authenticated:", !!user);
      console.log("SubscriptionContext - User UID:", userId);
      
      const subscriptionRef = doc(db, "users", userId, "subscription", "info");
      console.log("SubscriptionContext - Subscription ref path:", subscriptionRef.path);
      
      const subscriptionDoc = await getDoc(subscriptionRef);
      console.log("SubscriptionContext - Subscription doc exists:", subscriptionDoc.exists());
      
      if (!subscriptionDoc.exists()) {
        console.log("SubscriptionContext - Document does not exist, will create new one");
      }

      let subscriptionData: any = {};
      if (subscriptionDoc.exists()) {
        subscriptionData = subscriptionDoc.data();
      } else {
        // Kreiraj default pretplatu sa trial periodom
        const userCreatedAt = user.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date();
        const trialEndDate = new Date(userCreatedAt);
        trialEndDate.setDate(trialEndDate.getDate() + 15);

        subscriptionData = {
          isActive: false,
          monthlyPrice: 50,
          lastPaymentDate: null,
          expiryDate: null,
          graceEndDate: null,
          trialEndDate: trialEndDate,
          paymentHistory: [],
        };

        // Koristimo Timestamp za Firestore
        console.log("SubscriptionContext - Creating new subscription document with trialEndDate:", trialEndDate);
        try {
          await setDoc(subscriptionRef, {
            ...subscriptionData,
            trialEndDate: Timestamp.fromDate(trialEndDate),
          });
          console.log("SubscriptionContext - Successfully created subscription document");
        } catch (createError) {
          console.error("SubscriptionContext - Error creating subscription document:", createError);
          throw createError;
        }

        // Koristimo lokalno izračunati datum za status
        subscriptionData.trialEndDate = trialEndDate;
      }

      // Dobij datum registracije korisnika
      const userCreatedAt = user.metadata.creationTime ? new Date(user.metadata.creationTime) : null;
      
      // Ako nema trialEndDate u podacima, kreiraj ga na osnovu datuma registracije
      if (!subscriptionData.trialEndDate && userCreatedAt) {
        const trialEndDate = new Date(userCreatedAt);
        trialEndDate.setDate(trialEndDate.getDate() + 15);
        subscriptionData.trialEndDate = trialEndDate;
      }

      const status = calculateSubscriptionStatus(subscriptionData, userCreatedAt);
      console.log("SubscriptionContext - Calculated status:", status);
      setSubscription(status);
    } catch (error) {
      console.error("SubscriptionContext - Greška pri učitavanju pretplate:", error);
      setSubscription(null);
    } finally {
      setLoading(false);
      console.log("SubscriptionContext - Loading complete, loading set to false");
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await loadSubscription();
      } else {
        setSubscription(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const refreshSubscription = async () => {
    await loadSubscription();
  };

  return (
    <SubscriptionContext.Provider value={{ subscription, loading, refreshSubscription }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
}

