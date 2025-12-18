"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { RoleContext } from "./RoleContext";
import { getSubscription, updateSubscription, addPaymentToSubscription } from "../../lib/api";

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
  paymentPendingVerification?: boolean; // Da li korisnik prijavio uplatu
  paymentRequestedAt?: Date | null; // Datum kada je korisnik prijavio uplatu
  paymentRequestedAmount?: number; // Iznos koji je korisnik prijavio
  paymentRequestedMonths?: number; // Period koji je korisnik prijavio
  paymentReferenceNumber?: string | null; // Reference broj koji je korisnik koristio
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

  // Ako postoji eksplicitno postavljen isActive u Firestore, koristi ga
  const explicitIsActive = data.isActive !== undefined ? data.isActive : null;
  
  // Ako postoji trialEndDate u podacima, koristi ga
  if (data.trialEndDate) {
    trialEndDate = data.trialEndDate instanceof Date ? data.trialEndDate : new Date(data.trialEndDate);
  } else if (userCreatedAt && explicitIsActive !== false) {
    // Ako nema trialEndDate i korisnik nije eksplicitno deaktiviran, kreiraj ga na osnovu datuma registracije (15 dana)
    trialEndDate = new Date(userCreatedAt);
    trialEndDate.setDate(trialEndDate.getDate() + 15);
  }

  // Provjeri da li je u trial periodu (samo ako nema uplate)
  const hasPayment = data.lastPaymentDate != null;
  
  // Provjeri da li je u trial periodu (samo ako nema uplate)
  if (trialEndDate && now < trialEndDate && !hasPayment && explicitIsActive !== false) {
    // U trial periodu
    isTrial = true;
    isActive = explicitIsActive !== null ? explicitIsActive : true;
    daysRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  } else {
    // Nije u trial periodu, provjeri pretplatu
    if (data.expiryDate) {
      expiryDate = data.expiryDate instanceof Date ? data.expiryDate : new Date(data.expiryDate);
      
      if (expiryDate && now < expiryDate) {
        // Pretplata je aktivna (po datumu)
        isActive = explicitIsActive !== null ? explicitIsActive : true;
        daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      } else if (expiryDate) {
        // Pretplata je istekla, provjeri grace period
        if (data.graceEndDate) {
          graceEndDate = data.graceEndDate instanceof Date ? data.graceEndDate : new Date(data.graceEndDate);
        } else {
          // Kreiraj grace period (5 dana od isteka pretplate) samo ako nije eksplicitno postavljen
          graceEndDate = new Date(expiryDate);
          graceEndDate.setDate(graceEndDate.getDate() + 5);
        }

        // Provjeri da li je u grace periodu - ako postoji graceEndDate u budućnosti, prikaži grace period
        if (graceEndDate && now < graceEndDate) {
          // U grace periodu - prikaži grace period čak i ako je isActive = false
          isGracePeriod = true;
          isActive = false; // Neaktivna, ali ima pristup kroz grace period
          daysInGrace = Math.ceil((graceEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        } else {
          // Grace period je istekao - potpuno blokiran
          isActive = explicitIsActive !== null ? explicitIsActive : false;
          isGracePeriod = false;
        }
      } else if (data.graceEndDate) {
        // Ako nema expiryDate ali postoji graceEndDate, provjeri grace period
        graceEndDate = data.graceEndDate instanceof Date ? data.graceEndDate : new Date(data.graceEndDate);
        if (graceEndDate && now < graceEndDate) {
          // U grace periodu
          isGracePeriod = true;
          isActive = false; // Neaktivna, ali ima pristup kroz grace period
          daysInGrace = Math.ceil((graceEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        } else {
          // Grace period je istekao
          isActive = explicitIsActive !== null ? explicitIsActive : false;
          isGracePeriod = false;
        }
      }
    } else if (explicitIsActive !== null) {
      // Ako nema expiryDate ali postoji eksplicitno postavljen isActive, koristi ga
      isActive = explicitIsActive;
      // Ako je eksplicitno deaktiviran, ne smatraj ga u grace periodu
      if (explicitIsActive === false) {
        isGracePeriod = false;
        isTrial = false;
      }
    }
  }

  // Payment history is already parsed in loadSubscription, use it directly
  const paymentHistory: Payment[] = data.paymentHistory || [];
  
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
    monthlyPrice: data.monthlyPrice || 12, // Fiksna cijena - uvijek 12 KM
    lastPaymentDate: data.lastPaymentDate ? (data.lastPaymentDate instanceof Date ? data.lastPaymentDate : new Date(data.lastPaymentDate)) : null,
    daysRemaining,
    daysUntilExpiry,
    daysInGrace,
    paymentHistory,
    paymentPendingVerification: data.paymentPendingVerification || false,
    paymentRequestedAt: data.paymentRequestedAt ? (data.paymentRequestedAt instanceof Date ? data.paymentRequestedAt : new Date(data.paymentRequestedAt)) : null,
    paymentRequestedAmount: data.paymentRequestedAmount || 0,
    paymentRequestedMonths: data.paymentRequestedMonths || 0,
    paymentReferenceNumber: data.paymentReferenceNumber || null,
  };
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  // Koristi useContext direktno sa fallback-om za SSR
  const roleContext = useContext(RoleContext);
  const user = roleContext?.user ?? null;
  
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSubscription = useCallback(async () => {
    if (!user?.id) {
      console.log("SubscriptionContext - No user.id, skipping subscription load");
      setSubscription(null);
      setLoading(false);
      return;
    }

    // API endpoint očekuje email u URL-u, ne UUID
    const userIdForApi = user.email || user.id;

    try {
      setLoading(true);
      console.log("SubscriptionContext - Loading subscription for user:", userIdForApi, "email:", user.email);
      const subscriptionData = await getSubscription(userIdForApi);
      console.log("SubscriptionContext - Subscription data received:", subscriptionData);

      if (!subscriptionData) {
        console.error("SubscriptionContext - No subscription data returned from API");
        setSubscription(null);
        setLoading(false);
        return;
      }

      // Transform payment history
      const paymentHistory: Payment[] = (subscriptionData.payments || []).map((p: any) => {
        try {
          return {
            date: p.date ? new Date(p.date) : new Date(),
            amount: p.amount || 0,
            note: p.note || "",
            validUntil: p.validUntil ? new Date(p.validUntil) : undefined,
          };
        } catch (err) {
          console.warn("SubscriptionContext - Error parsing payment:", p, err);
          return {
            date: new Date(),
            amount: 0,
            note: "",
            validUntil: undefined,
          };
        }
      });

      // Prepare data for calculateSubscriptionStatus
      const dataForCalculation = {
        isActive: subscriptionData.isActive !== undefined ? subscriptionData.isActive : true,
        monthlyPrice: subscriptionData.monthlyPrice || 12,
        lastPaymentDate: subscriptionData.lastPaymentDate ? (() => {
          try {
            return new Date(subscriptionData.lastPaymentDate);
          } catch (e) {
            console.warn("SubscriptionContext - Error parsing lastPaymentDate:", subscriptionData.lastPaymentDate);
            return null;
          }
        })() : null,
        expiryDate: subscriptionData.endDate ? (() => {
          try {
            return new Date(subscriptionData.endDate);
          } catch (e) {
            console.warn("SubscriptionContext - Error parsing endDate:", subscriptionData.endDate);
            return null;
          }
        })() : null,
        graceEndDate: subscriptionData.graceEndDate ? (() => {
          try {
            return new Date(subscriptionData.graceEndDate);
          } catch (e) {
            console.warn("SubscriptionContext - Error parsing graceEndDate:", subscriptionData.graceEndDate);
            return null;
          }
        })() : null,
        trialEndDate: subscriptionData.trialEndDate ? (() => {
          try {
            return new Date(subscriptionData.trialEndDate);
          } catch (e) {
            console.warn("SubscriptionContext - Error parsing trialEndDate:", subscriptionData.trialEndDate);
            return null;
          }
        })() : null,
        paymentHistory: paymentHistory,
        paymentPendingVerification: subscriptionData.subscriptionData?.paymentPendingVerification || false,
        paymentRequestedAt: subscriptionData.subscriptionData?.paymentRequestedAt || null,
        paymentRequestedAmount: subscriptionData.subscriptionData?.paymentRequestedAmount || 0,
        paymentRequestedMonths: subscriptionData.subscriptionData?.paymentRequestedMonths || 0,
        paymentReferenceNumber: subscriptionData.subscriptionData?.paymentReferenceNumber || null,
      };

      const userCreatedAt = subscriptionData.userCreatedAt ? (() => {
        try {
          return new Date(subscriptionData.userCreatedAt);
        } catch (e) {
          console.warn("SubscriptionContext - Error parsing userCreatedAt:", subscriptionData.userCreatedAt);
          return null;
        }
      })() : null;
      
      console.log("SubscriptionContext - Data for calculation:", dataForCalculation);
      const status = calculateSubscriptionStatus(dataForCalculation, userCreatedAt);
      console.log("SubscriptionContext - Calculated subscription status:", status);
      setSubscription(status);
    } catch (error: any) {
      console.error("Greška pri učitavanju pretplate:", error);
      console.error("SubscriptionContext - Error details:", error.message, error.stack);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.email]);

  // Load subscription when user changes
  useEffect(() => {
    loadSubscription();
  }, [loadSubscription]);

  const refreshSubscription = async () => {
    await loadSubscription();
  };

  const addPayment = async (amount: number, months: number = 1, note?: string) => {
    if (!user?.id) throw new Error("Korisnik nije prijavljen");

    // API endpoint očekuje email u URL-u
    const userIdForApi = user.email || user.id;

    try {
      await addPaymentToSubscription(userIdForApi, amount, months, note);
      await refreshSubscription();
    } catch (error: any) {
      console.error("Greška pri dodavanju uplate:", error);
      throw error;
    }
  };

  const updateMonthlyPrice = async (price: number) => {
    if (!user?.id) throw new Error("Korisnik nije prijavljen");

    // API endpoint očekuje email u URL-u
    const userIdForApi = user.email || user.id;

    try {
      await updateSubscription(userIdForApi, { monthlyPrice: price });
      await refreshSubscription();
    } catch (error: any) {
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

