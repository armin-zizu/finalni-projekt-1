"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { auth, db } from "../../lib/firebase";
import { doc, getDoc, setDoc, onSnapshot, Timestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// Tipovi
interface Payment {
  date: Date;
  amount: number;
  note?: string;
  validUntil?: Date; // Do kada važi uplata
}

interface SubscriptionStatus {
  isActive: boolean;
  isTrial: boolean;
  isPremium: boolean; // Premium status (nakon uplate)
  isGracePeriod: boolean;
  trialEndDate: Date | null;
  expiryDate: Date | null;
  graceEndDate: Date | null;
  monthlyPrice: number;
  lastPaymentDate: Date | null;
  daysRemaining: number; // Preostalo dana u trial periodu
  daysUntilExpiry: number; // Preostalo dana do isteka pretplate
  daysInGrace: number; // Preostalo dana u grace periodu
  paymentHistory: Payment[];
}

interface SubscriptionContextType {
  subscription: SubscriptionStatus | null;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
  addPayment: (amount: number, months?: number, note?: string) => Promise<void>;
  updateMonthlyPrice: (price: number) => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// Funkcija za izračunavanje subscription statusa
function calculateSubscriptionStatus(data: any, userCreatedAt: Date | null): SubscriptionStatus {
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

  // Provjeri da li je u trial periodu (samo ako nema uplate)
  const hasPayment = data.lastPaymentDate != null;
  if (trialEndDate && now < trialEndDate && !hasPayment) {
    isTrial = true;
    isActive = true;
    daysRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  } else {
    // Nije u trial periodu, provjeri pretplatu
    if (data.expiryDate) {
      expiryDate = data.expiryDate.toDate ? data.expiryDate.toDate() : new Date(data.expiryDate);
      
      if (expiryDate && now < expiryDate) {
        // Pretplata je aktivna
        isActive = true;
        daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      } else if (expiryDate) {
        // Pretplata je istekla, provjeri grace period
        if (data.graceEndDate) {
          graceEndDate = data.graceEndDate.toDate ? data.graceEndDate.toDate() : new Date(data.graceEndDate);
        } else {
          // Kreiraj grace period (5 dana od isteka pretplate)
          graceEndDate = new Date(expiryDate);
          graceEndDate.setDate(graceEndDate.getDate() + 5);
        }

        if (graceEndDate && now < graceEndDate) {
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

  // Parsiraj payment history
  const paymentHistory: Payment[] = (data.paymentHistory || []).map((p: any) => ({
    date: p.date?.toDate ? p.date.toDate() : new Date(p.date),
    amount: p.amount || 0,
    note: p.note || "",
    validUntil: p.validUntil?.toDate ? p.validUntil.toDate() : (p.validUntil ? new Date(p.validUntil) : undefined),
  }));
  
  // Provjeri da li je Premium (ima uplatu i nije u trial periodu)
  const isPremium = hasPayment && !isTrial && (isActive || isGracePeriod);

  return {
    isActive,
    isTrial,
    isPremium,
    isGracePeriod,
    trialEndDate,
    expiryDate,
    graceEndDate,
    monthlyPrice: 12, // Fiksna cijena - uvijek 12 KM
    lastPaymentDate: data.lastPaymentDate ? (data.lastPaymentDate.toDate ? data.lastPaymentDate.toDate() : new Date(data.lastPaymentDate)) : null,
    daysRemaining,
    daysUntilExpiry,
    daysInGrace,
    paymentHistory,
  };
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSubscription = async () => {
    const user = auth.currentUser;
    
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      const userId = user.uid;
      const subscriptionRef = doc(db, "users", userId, "subscription", "info");
      const subscriptionDoc = await getDoc(subscriptionRef);

      let subscriptionData: any = {};
      if (subscriptionDoc.exists()) {
        subscriptionData = subscriptionDoc.data();
        // Ažuriraj monthlyPrice na 12 ako je stara vrijednost
        if (subscriptionData.monthlyPrice !== 12) {
          subscriptionData.monthlyPrice = 12;
          await setDoc(subscriptionRef, { monthlyPrice: 12 }, { merge: true });
        }
      } else {
        // Kreiraj default pretplatu sa trial periodom
        const userCreatedAt = user.metadata.creationTime ? new Date(user.metadata.creationTime) : new Date();
        const trialEndDate = new Date(userCreatedAt);
        trialEndDate.setDate(trialEndDate.getDate() + 15);

        subscriptionData = {
          isActive: true,
          monthlyPrice: 12,
          lastPaymentDate: null,
          expiryDate: null,
          graceEndDate: null,
          trialEndDate: Timestamp.fromDate(trialEndDate),
          paymentHistory: [],
        };

        await setDoc(subscriptionRef, subscriptionData);
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
      setSubscription(status);
    } catch (error) {
      console.error("Greška pri učitavanju pretplate:", error);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  // Real-time listener za promjene
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userId = user.uid;
        const subscriptionRef = doc(db, "users", userId, "subscription", "info");
        
        // Postavi real-time listener
        const unsubscribe = onSnapshot(subscriptionRef, async (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            const userCreatedAt = user.metadata.creationTime ? new Date(user.metadata.creationTime) : null;
            const status = calculateSubscriptionStatus(data, userCreatedAt);
            setSubscription(status);
            setLoading(false);
          } else {
            // Dokument ne postoji, kreiraj ga
            await loadSubscription();
          }
        }, (error) => {
          console.error("Greška pri real-time listeneru:", error);
          setLoading(false);
        });

        return () => unsubscribe();
      } else {
        setSubscription(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Učitaj subscription pri mount-u
  useEffect(() => {
    loadSubscription();
  }, []);

  const refreshSubscription = async () => {
    await loadSubscription();
  };

  const addPayment = async (amount: number, months: number = 1, note?: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Korisnik nije prijavljen");

    try {
      const userId = user.uid;
      const subscriptionRef = doc(db, "users", userId, "subscription", "info");
      const subscriptionDoc = await getDoc(subscriptionRef);

      const now = new Date();
      let subscriptionData: any = {};
      if (subscriptionDoc.exists()) {
        subscriptionData = subscriptionDoc.data();
      }

      // Pronađi trial end date
      let trialEndDate: Date | null = null;
      if (subscriptionData.trialEndDate) {
        trialEndDate = subscriptionData.trialEndDate.toDate ? subscriptionData.trialEndDate.toDate() : new Date(subscriptionData.trialEndDate);
      } else if (user.metadata.creationTime) {
        trialEndDate = new Date(user.metadata.creationTime);
        trialEndDate.setDate(trialEndDate.getDate() + 15);
      }

      // Ako postoji trial end date i još nije prošao, računaj od kraja trial perioda
      // Inače računaj od današnjeg datuma
      let startDate = now;
      if (trialEndDate && now < trialEndDate) {
        startDate = trialEndDate; // Počni od kraja trial perioda
      }

      // Izračunaj expiry date od start date
      const newExpiryDate = new Date(startDate);
      newExpiryDate.setMonth(newExpiryDate.getMonth() + months);

      // Izračunaj validUntil za payment history
      const validUntil = new Date(newExpiryDate);

      const paymentHistory = subscriptionData.paymentHistory || [];
      paymentHistory.push({
        date: Timestamp.fromDate(now),
        amount,
        note: note || `Bank Transfer - ${months} ${months === 1 ? 'mjesec' : 'mjeseci'}`,
        validUntil: Timestamp.fromDate(validUntil),
      });

      await setDoc(subscriptionRef, {
        ...subscriptionData,
        isActive: true,
        lastPaymentDate: Timestamp.fromDate(now),
        expiryDate: Timestamp.fromDate(newExpiryDate),
        graceEndDate: null, // Resetuj grace period
        paymentHistory,
        updatedAt: Timestamp.fromDate(now),
      }, { merge: true });

      await refreshSubscription();
    } catch (error) {
      console.error("Greška pri dodavanju uplate:", error);
      throw error;
    }
  };

  const updateMonthlyPrice = async (price: number) => {
    const user = auth.currentUser;
    if (!user) throw new Error("Korisnik nije prijavljen");

    try {
      const userId = user.uid;
      const subscriptionRef = doc(db, "users", userId, "subscription", "info");
      
      await setDoc(subscriptionRef, {
        monthlyPrice: price,
        updatedAt: Timestamp.fromDate(new Date()),
      }, { merge: true });

      await refreshSubscription();
    } catch (error) {
      console.error("Greška pri ažuriranju cijene:", error);
      throw error;
    }
  };

  return (
    <SubscriptionContext.Provider value={{ subscription, loading, refreshSubscription, addPayment, updateMonthlyPrice }}>
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

