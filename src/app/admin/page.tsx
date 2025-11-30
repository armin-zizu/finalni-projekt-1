"use client";

import React, { useState, useEffect, useMemo } from "react";
import { auth, db } from "../../lib/firebase";
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { useRouter } from "next/navigation";
import { FaSearch, FaCheck, FaTimes, FaPlus, FaSpinner, FaUser, FaEnvelope, FaCalendar, FaDollarSign } from "react-icons/fa";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Admin email
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "gitara.zizu@gmail.com";

interface User {
  id: string;
  email: string | null;
  appName: string;
  createdAt: Date | null;
  lastSignIn: Date | null;
  imeKorisnika?: string;
  brojTelefona?: string;
  lokacija?: string;
}

interface Subscription {
  isActive: boolean;
  monthlyPrice: number;
  lastPaymentDate: Date | null;
  expiryDate: Date | null;
  graceEndDate: Date | null;
  trialEndDate: Date | null;
  paymentHistory: Array<{
    date: Date;
    amount: number;
    note: string;
  }>;
  // Payment request fields
  paymentPendingVerification?: boolean;
  paymentRequestedAmount?: number;
  paymentRequestedMonths?: number;
  paymentReferenceNumber?: string;
  paymentRequestedAt?: Date | null;
  // Calculated fields
  isTrial?: boolean;
  isPremium?: boolean;
  isGracePeriod?: boolean;
  daysRemaining?: number;
  daysUntilExpiry?: number;
  daysInGrace?: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [subscriptions, setSubscriptions] = useState<Record<string, Subscription>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedUserDetails, setSelectedUserDetails] = useState<User | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMonths, setPaymentMonths] = useState(1);
  const [paymentNote, setPaymentNote] = useState("");
  const [activateOnPayment, setActivateOnPayment] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [revenueFilter, setRevenueFilter] = useState<"dnevni" | "tjedni" | "mjesečni" | "prilagođeno">("dnevni");
  const [customFromDate, setCustomFromDate] = useState<string>("");
  const [customToDate, setCustomToDate] = useState<string>("");
  const [premiumDaysAdjustment, setPremiumDaysAdjustment] = useState(0);
  const [trialDaysAdjustment, setTrialDaysAdjustment] = useState(0);
  const [newSubscriptionStatus, setNewSubscriptionStatus] = useState<"trial" | "premium" | "grace" | "inactive">("premium");
  const [imeKorisnika, setImeKorisnika] = useState("");
  const [brojTelefona, setBrojTelefona] = useState("");
  const [lokacija, setLokacija] = useState("");
  const [savingUserInfo, setSavingUserInfo] = useState(false);
  const [editingUserInfo, setEditingUserInfo] = useState(false);

  // Provjeri da li je korisnik admin
  useEffect(() => {
    const checkAdmin = async () => {
      const user = auth.currentUser;
      if (!user || user.email !== ADMIN_EMAIL) {
        setIsAdmin(false);
        setLoading(false);
        router.push("/dashboard");
        return;
      }
      setIsAdmin(true);
      await loadUsers();
    };

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        checkAdmin();
      } else {
        setIsAdmin(false);
        setLoading(false);
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Učitaj sve korisnike
  const loadUsers = async () => {
    try {
      setLoading(true);
      setMessage(null);
      
      const usersCollection = collection(db, "users");
      const usersSnapshot = await getDocs(usersCollection);
      
      const usersList: User[] = [];
      const subscriptionsMap: Record<string, Subscription> = {};

      for (const userDoc of usersSnapshot.docs) {
        try {
          const userId = userDoc.id;
          const userData = userDoc.data();

          // Učitaj subscription
          const subscriptionRef = doc(db, "users", userId, "subscription", "info");
          let subscriptionDoc;
          
          try {
            subscriptionDoc = await getDoc(subscriptionRef);
          } catch (subError) {
            console.warn(`Greška pri učitavanju subscription za korisnika ${userId}:`, subError);
            // Nastavi sa default subscription
          }

          let subscription: Subscription = {
            isActive: false,
            monthlyPrice: 12,
            lastPaymentDate: null,
            expiryDate: null,
            graceEndDate: null,
            trialEndDate: null,
            paymentHistory: [],
          };

          if (subscriptionDoc && subscriptionDoc.exists()) {
            try {
              const subData = subscriptionDoc.data();
              const now = new Date();
              const userCreatedAt = userData.createdAt?.toDate?.() || (userData.createdAt ? new Date(userData.createdAt) : null);
              
              // Parse dates
              const trialEndDate = subData.trialEndDate?.toDate?.() || (subData.trialEndDate ? new Date(subData.trialEndDate) : null);
              const expiryDate = subData.expiryDate?.toDate?.() || (subData.expiryDate ? new Date(subData.expiryDate) : null);
              const graceEndDate = subData.graceEndDate?.toDate?.() || (subData.graceEndDate ? new Date(subData.graceEndDate) : null);
              
              // Calculate status
              let isTrial = false;
              let isGracePeriod = false;
              let daysRemaining = 0;
              let daysUntilExpiry = 0;
              let daysInGrace = 0;
              
              // Check trial period (samo ako nema uplate)
              const hasPayment = subData.lastPaymentDate != null;
              const explicitIsActive = subData.isActive !== undefined ? subData.isActive : null;
              
              if (trialEndDate && now < trialEndDate && !hasPayment && explicitIsActive !== false) {
                isTrial = true;
                daysRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              } else if (expiryDate) {
                if (now < expiryDate) {
                  // Active subscription
                  daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                } else {
                  // Expired, check grace period
                  let calculatedGraceEnd: Date | null = null;
                  if (graceEndDate) {
                    calculatedGraceEnd = graceEndDate;
                  } else if (expiryDate) {
                    // Kreiraj grace period (5 dana od isteka pretplate) samo ako nije eksplicitno postavljen
                    calculatedGraceEnd = new Date(expiryDate);
                    calculatedGraceEnd.setDate(calculatedGraceEnd.getDate() + 5);
                  }
                  
                  if (calculatedGraceEnd && now < calculatedGraceEnd) {
                    // Prikaži grace period čak i ako je isActive = false, ali samo ako postoji graceEndDate u budućnosti
                    isGracePeriod = true;
                    daysInGrace = Math.ceil((calculatedGraceEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  }
                }
              } else if (graceEndDate) {
                // Ako nema expiryDate ali postoji graceEndDate, provjeri grace period
                if (graceEndDate && now < graceEndDate) {
                  isGracePeriod = true;
                  daysInGrace = Math.ceil((graceEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                }
              }
              
              // Uzmi isActive direktno iz Firebase podataka
              const isActiveFromFirebase = subData.isActive === true;
              
              subscription = {
                isActive: isActiveFromFirebase,
                monthlyPrice: subData.monthlyPrice || 12,
                lastPaymentDate: subData.lastPaymentDate?.toDate?.() || (subData.lastPaymentDate ? new Date(subData.lastPaymentDate) : null),
                expiryDate: expiryDate,
                graceEndDate: graceEndDate,
                trialEndDate: trialEndDate,
                paymentHistory: (subData.paymentHistory || []).map((p: any) => ({
                  date: p.date?.toDate?.() || (p.date ? new Date(p.date) : new Date()),
                  amount: p.amount || 0,
                  note: p.note || "",
                  validUntil: p.validUntil?.toDate?.() || (p.validUntil ? new Date(p.validUntil) : undefined),
                })),
                isTrial,
                isPremium: hasPayment && !isTrial && (isActiveFromFirebase || isGracePeriod),
                isGracePeriod,
                daysRemaining,
                daysUntilExpiry,
                daysInGrace,
                paymentPendingVerification: subData.paymentPendingVerification || false,
                paymentRequestedAt: subData.paymentRequestedAt?.toDate?.() || (subData.paymentRequestedAt ? new Date(subData.paymentRequestedAt) : null),
                paymentRequestedAmount: subData.paymentRequestedAmount || 0,
                paymentRequestedMonths: subData.paymentRequestedMonths || 0,
                paymentReferenceNumber: subData.paymentReferenceNumber || null,
              };
            } catch (parseError) {
              console.warn(`Greška pri parsiranju subscription podataka za korisnika ${userId}:`, parseError);
            }
          }

          // Pokušaj učitati email iz Firestore
          let userEmail = userData.email || null;
          
          // Ako email nije u Firestore, pokušaj ga dobiti iz Firebase Auth REST API
          if (!userEmail) {
            try {
              const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyB1PZRZcpjrOvpwEWunbHiUstIUuYIE6k4';
              const response = await fetch(
                `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    localId: [userId]
                  }),
                }
              );
              
              if (response.ok) {
                const data = await response.json();
                if (data.users && data.users.length > 0 && data.users[0].email) {
                  userEmail = data.users[0].email;
                  // Ažuriraj Firestore dokument sa email-om
                  try {
                    await setDoc(
                      doc(db, "users", userId),
                      { email: userEmail },
                      { merge: true }
                    );
                  } catch (updateError) {
                    console.warn(`Greška pri ažuriranju email-a u Firestore za korisnika ${userId}:`, updateError);
                  }
                }
              }
            } catch (authError) {
              console.warn(`Greška pri dohvaćanju email-a iz Firebase Auth za korisnika ${userId}:`, authError);
            }
          }
          
          usersList.push({
            id: userId,
            email: userEmail,
            appName: userData.appName || "N/A",
            createdAt: userData.createdAt?.toDate?.() || (userData.createdAt ? new Date(userData.createdAt) : null),
            lastSignIn: userData.lastSignIn?.toDate?.() || (userData.lastSignIn ? new Date(userData.lastSignIn) : null),
            imeKorisnika: userData.imeKorisnika || undefined,
            brojTelefona: userData.brojTelefona || undefined,
            lokacija: userData.lokacija || undefined,
          });

          subscriptionsMap[userId] = subscription;
        } catch (userError) {
          console.warn(`Greška pri obradi korisnika ${userDoc.id}:`, userError);
          // Nastavi sa sljedećim korisnikom
          continue;
        }
      }

      setUsers(usersList);
      setSubscriptions(subscriptionsMap);
      setLoading(false);
      
      if (usersList.length === 0) {
        setMessage({ type: "error", text: "Nema korisnika u bazi podataka" });
      }
    } catch (error: any) {
      console.error("Greška pri učitavanju korisnika:", error);
      setMessage({ 
        type: "error", 
        text: `Greška pri učitavanju korisnika: ${error.message || "Nepoznata greška"}` 
      });
      setLoading(false);
    }
  };

  // Ažuriraj premium dane
  const adjustPremiumDays = async (userId: string, days: number) => {
    try {
      setSaving(true);
      const subscriptionRef = doc(db, "users", userId, "subscription", "info");
      const subscriptionDoc = await getDoc(subscriptionRef);

      if (!subscriptionDoc.exists()) {
        setMessage({ type: "error", text: "Pretplata ne postoji" });
        return;
      }

      const subData = subscriptionDoc.data();
      const now = new Date();
      
      // Pronađi postojeći expiry date ili kreiraj novi
      let currentExpiryDate: Date;
      if (subData.expiryDate) {
        currentExpiryDate = subData.expiryDate.toDate ? subData.expiryDate.toDate() : new Date(subData.expiryDate);
      } else {
        // Ako nema expiry date, kreiraj od današnjeg datuma
        currentExpiryDate = now;
      }

      // Dodaj ili oduzmi dane
      const newExpiryDate = new Date(currentExpiryDate);
      newExpiryDate.setDate(newExpiryDate.getDate() + days);

      // Ako je novi datum u prošlosti, postavi na danas + dane
      if (newExpiryDate < now && days > 0) {
        newExpiryDate.setTime(now.getTime() + days * 24 * 60 * 60 * 1000);
      }

      await setDoc(
        subscriptionRef,
        {
          expiryDate: Timestamp.fromDate(newExpiryDate),
          isActive: newExpiryDate > now,
          updatedAt: Timestamp.fromDate(now),
        },
        { merge: true }
      );

      await loadUsers();
      setPremiumDaysAdjustment(0);
      setMessage({ type: "success", text: `Premium dana ${days > 0 ? "dodano" : "oduzeto"}: ${Math.abs(days)} dana` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Greška pri ažuriranju premium dana:", error);
      setMessage({ type: "error", text: "Greška pri ažuriranju premium dana" });
    } finally {
      setSaving(false);
    }
  };

  // Ažuriraj trial dane
  const adjustTrialDays = async (userId: string, days: number) => {
    try {
      setSaving(true);
      const subscriptionRef = doc(db, "users", userId, "subscription", "info");
      const subscriptionDoc = await getDoc(subscriptionRef);

      if (!subscriptionDoc.exists()) {
        setMessage({ type: "error", text: "Pretplata ne postoji" });
        return;
      }

      const subData = subscriptionDoc.data();
      const now = new Date();
      
      // Pronađi postojeći trial end date ili kreiraj novi
      let currentTrialEndDate: Date;
      if (subData.trialEndDate) {
        currentTrialEndDate = subData.trialEndDate.toDate ? subData.trialEndDate.toDate() : new Date(subData.trialEndDate);
      } else {
        // Ako nema trial end date, kreiraj od današnjeg datuma (default 15 dana)
        currentTrialEndDate = new Date(now);
        currentTrialEndDate.setDate(currentTrialEndDate.getDate() + 15);
      }

      // Dodaj ili oduzmi dane
      const newTrialEndDate = new Date(currentTrialEndDate);
      newTrialEndDate.setDate(newTrialEndDate.getDate() + days);

      // Ako je novi datum u prošlosti, postavi na danas + dane
      if (newTrialEndDate < now && days > 0) {
        newTrialEndDate.setTime(now.getTime() + days * 24 * 60 * 60 * 1000);
      }

      await setDoc(
        subscriptionRef,
        {
          trialEndDate: Timestamp.fromDate(newTrialEndDate),
          updatedAt: Timestamp.fromDate(now),
        },
        { merge: true }
      );

      await loadUsers();
      setTrialDaysAdjustment(0);
      setMessage({ type: "success", text: `Trial dana ${days > 0 ? "dodano" : "oduzeto"}: ${Math.abs(days)} dana` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Greška pri ažuriranju trial dana:", error);
      setMessage({ type: "error", text: "Greška pri ažuriranju trial dana" });
    } finally {
      setSaving(false);
    }
  };

  // Promijeni status pretplate
  const changeSubscriptionStatus = async (userId: string, status: "trial" | "premium" | "grace" | "inactive") => {
    try {
      setSaving(true);
      const subscriptionRef = doc(db, "users", userId, "subscription", "info");
      const subscriptionDoc = await getDoc(subscriptionRef);

      const now = new Date();
      let updateData: any = {
        updatedAt: Timestamp.fromDate(now),
      };

      if (status === "trial") {
        // Postavi trial period - korisnik nema uplatu, aktivna je pretplata
        const trialEndDate = new Date(now);
        trialEndDate.setDate(trialEndDate.getDate() + 15);
        updateData.trialEndDate = Timestamp.fromDate(trialEndDate);
        updateData.isActive = true;
        updateData.expiryDate = null;
        updateData.graceEndDate = null;
        updateData.lastPaymentDate = null; // Resetuj uplatu da bi se smatralo da je u trial periodu
      } else if (status === "premium") {
        // Postavi premium - korisnik ima aktivnu pretplatu
        const expiryDate = new Date(now);
        expiryDate.setMonth(expiryDate.getMonth() + 1);
        updateData.expiryDate = Timestamp.fromDate(expiryDate);
        updateData.isActive = true;
        updateData.trialEndDate = null;
        updateData.graceEndDate = null;
        // Ako nema lastPaymentDate, postavi ga na sada
        if (!subscriptionDoc.exists() || !subscriptionDoc.data().lastPaymentDate) {
          updateData.lastPaymentDate = Timestamp.fromDate(now);
        }
      } else if (status === "grace") {
        // Postavi grace period - pretplata je istekla, ali ima grace period
        const graceEndDate = new Date(now);
        graceEndDate.setDate(graceEndDate.getDate() + 5);
        updateData.graceEndDate = Timestamp.fromDate(graceEndDate);
        updateData.isActive = false; // Neaktivna, ali ima pristup kroz grace period
        // Postavi expiryDate na prošlost (ili sada) da bi se aktivirao grace period
        updateData.expiryDate = Timestamp.fromDate(now);
        updateData.trialEndDate = null;
      } else {
        // inactive - potpuno blokiran
        // Ako je bio grace period, postavi expiryDate na dan kada je grace period istekao
        if (subscriptionDoc.exists()) {
          const subData = subscriptionDoc.data();
          if (subData.graceEndDate) {
            const graceEnd = subData.graceEndDate.toDate ? subData.graceEndDate.toDate() : new Date(subData.graceEndDate);
            updateData.expiryDate = Timestamp.fromDate(graceEnd);
            // Sačuvaj graceEndDate da bi se mogao prikazati datum isteka grace perioda
            // Ne postavljaj ga na null, već ostavi da se prikaže kada je neaktivna
          } else if (subData.expiryDate) {
            // Ako nema graceEndDate ali ima expiryDate, koristi expiryDate
            const expiry = subData.expiryDate.toDate ? subData.expiryDate.toDate() : new Date(subData.expiryDate);
            // Provjeri da li je datum validan (nije 1970/1969)
            if (expiry.getFullYear() > 1970) {
              updateData.expiryDate = Timestamp.fromDate(expiry);
            } else {
              updateData.expiryDate = Timestamp.fromDate(new Date(0));
            }
          } else {
            updateData.expiryDate = Timestamp.fromDate(new Date(0));
          }
        } else {
          updateData.expiryDate = Timestamp.fromDate(new Date(0));
        }
        updateData.isActive = false;
        // Postavi trialEndDate na null da se korisnik ne smatra da je u trial periodu
        updateData.trialEndDate = null;
        // Postavi lastPaymentDate na nešto (ili ostavi kako jeste) da se korisnik ne smatra da je u trial periodu
        // Ako nema lastPaymentDate, postavi ga na prošlost da se ne smatra da je u trial periodu
        if (!subscriptionDoc.exists() || !subscriptionDoc.data().lastPaymentDate) {
          // Postavi lastPaymentDate na prošlost da se ne smatra da je u trial periodu
          const pastDate = new Date(now);
          pastDate.setDate(pastDate.getDate() - 100); // 100 dana u prošlosti
          updateData.lastPaymentDate = Timestamp.fromDate(pastDate);
        }
      }

      await setDoc(subscriptionRef, updateData, { merge: true });

      await loadUsers();
      setNewSubscriptionStatus("premium");
      setMessage({ type: "success", text: `Status pretplate promijenjen na: ${status === "trial" ? "Probni period" : status === "premium" ? "Premium" : status === "grace" ? "Grace Period" : "Neaktivna"}` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Greška pri promjeni statusa pretplate:", error);
      setMessage({ type: "error", text: "Greška pri promjeni statusa pretplate" });
    } finally {
      setSaving(false);
    }
  };

  // Aktiviraj/deaktiviraj pretplatu
  const toggleSubscription = async (userId: string, currentStatus: boolean) => {
    try {
      setSaving(true);
      const subscriptionRef = doc(db, "users", userId, "subscription", "info");
      const subscriptionDoc = await getDoc(subscriptionRef);

      const now = new Date();
      const newStatus = !currentStatus;

      if (subscriptionDoc.exists()) {
        const subData = subscriptionDoc.data();
        
        // Pronađi trial end date
        let trialEndDate: Date | null = null;
        if (subData.trialEndDate) {
          trialEndDate = subData.trialEndDate.toDate ? subData.trialEndDate.toDate() : new Date(subData.trialEndDate);
        }
        
        // Ako postoji trial end date i još nije prošao, računaj od kraja trial perioda
        let startDate = now;
        if (trialEndDate && now < trialEndDate) {
          startDate = trialEndDate;
        }
        
        const expiryDate = newStatus
          ? new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000) // +30 dana od start date
          : new Date(0); // Prošli datum
        
        await setDoc(
          subscriptionRef,
          {
            isActive: newStatus,
            expiryDate: Timestamp.fromDate(expiryDate),
            graceEndDate: null,
            updatedAt: Timestamp.fromDate(now),
          },
          { merge: true }
        );
      } else {
        await setDoc(subscriptionRef, {
          isActive: newStatus,
          monthlyPrice: 12,
          expiryDate: newStatus
            ? Timestamp.fromDate(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000))
            : Timestamp.fromDate(new Date(0)),
          graceEndDate: null,
          paymentHistory: [],
          createdAt: Timestamp.fromDate(now),
        });
      }

      await loadUsers();
      setMessage({ type: "success", text: `Pretplata ${newStatus ? "aktivirana" : "deaktivirana"}` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Greška pri ažuriranju pretplate:", error);
      setMessage({ type: "error", text: "Greška pri ažuriranju pretplate" });
    } finally {
      setSaving(false);
    }
  };

  // Dodaj uplatu
  const addPayment = async () => {
    if (!selectedUser || !paymentAmount || !paymentMonths) {
      setMessage({ type: "error", text: "Unesi sve podatke" });
      return;
    }

    try {
      setSaving(true);
      const subscriptionRef = doc(db, "users", selectedUser.id, "subscription", "info");
      const subscriptionDoc = await getDoc(subscriptionRef);

      const now = new Date();
      const amount = parseFloat(paymentAmount);
      
      let subscriptionData: any = {};
      if (subscriptionDoc.exists()) {
        subscriptionData = subscriptionDoc.data();
      }

      // Pronađi postojeći expiry date
      let existingExpiryDate: Date | null = null;
      if (subscriptionData.expiryDate) {
        existingExpiryDate = subscriptionData.expiryDate.toDate ? subscriptionData.expiryDate.toDate() : new Date(subscriptionData.expiryDate);
      }

      // Pronađi trial end date
      let trialEndDate: Date | null = null;
      if (subscriptionData.trialEndDate) {
        trialEndDate = subscriptionData.trialEndDate.toDate ? subscriptionData.trialEndDate.toDate() : new Date(subscriptionData.trialEndDate);
      }
      
      // Ako postoji postojeći expiry date i još nije istekao, dodaj nove mjesece na taj datum
      // Inače, ako postoji trial end date i još nije prošao, računaj od kraja trial perioda
      // Inače računaj od današnjeg datuma
      let startDate = now;
      if (existingExpiryDate && now < existingExpiryDate) {
        // Postojeća pretplata još nije istekla - dodaj na postojeći expiry date
        startDate = existingExpiryDate;
      } else if (trialEndDate && now < trialEndDate) {
        // Trial period još traje - počni od kraja trial perioda
        startDate = trialEndDate;
      }
      
      // Izračunaj expiry date od start date
      const newExpiryDate = new Date(startDate);
      newExpiryDate.setMonth(newExpiryDate.getMonth() + paymentMonths);
      
      // Izračunaj validUntil za payment history
      const validUntil = new Date(newExpiryDate);

      const paymentHistory = subscriptionData.paymentHistory || [];
      paymentHistory.push({
        date: Timestamp.fromDate(now),
        amount: amount,
        note: paymentNote || `Bank Transfer - ${paymentMonths} ${paymentMonths === 1 ? "mjesec" : "mjeseci"}`,
        validUntil: Timestamp.fromDate(validUntil),
      });

      await setDoc(
        subscriptionRef,
        {
          isActive: activateOnPayment,
          lastPaymentDate: Timestamp.fromDate(now),
          expiryDate: Timestamp.fromDate(newExpiryDate),
          graceEndDate: null,
          monthlyPrice: 12,
          paymentHistory: paymentHistory,
          // Resetuj payment verification status kada se doda uplata
          paymentPendingVerification: false,
          paymentRequestedAt: null,
          paymentRequestedAmount: null,
          paymentRequestedMonths: null,
          paymentReferenceNumber: null,
          updatedAt: Timestamp.fromDate(now),
        },
        { merge: true }
      );

      await loadUsers();
      setShowPaymentModal(false);
      setPaymentAmount("");
      setPaymentMonths(1);
      setPaymentNote("");
      setActivateOnPayment(true);
      setSelectedUser(null);
      setMessage({ type: "success", text: `Uplata dodana uspješno. Pretplata ${activateOnPayment ? "aktivirana" : "deaktivirana"}.` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Greška pri dodavanju uplate:", error);
      setMessage({ type: "error", text: "Greška pri dodavanju uplate" });
    } finally {
      setSaving(false);
    }
  };

  // Filtriraj korisnike
  const filteredUsers = users.filter((user) => {
    const search = searchTerm.toLowerCase();
    return (
      user.email?.toLowerCase().includes(search) ||
      user.appName.toLowerCase().includes(search) ||
      user.id.toLowerCase().includes(search)
    );
  });

  // Prikupi sve uplate iz svih korisnika
  const allPayments = useMemo(() => {
    const payments: Array<{ date: Date; amount: number; userId: string; appName: string }> = [];
    
    Object.entries(subscriptions).forEach(([userId, subscription]) => {
      if (subscription.paymentHistory && subscription.paymentHistory.length > 0) {
        subscription.paymentHistory.forEach((payment) => {
          payments.push({
            date: payment.date,
            amount: payment.amount,
            userId: userId,
            appName: users.find(u => u.id === userId)?.appName || "N/A",
          });
        });
      }
    });
    
    return payments.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [subscriptions, users]);

  // Grupiši uplate po periodu
  const revenueChartData = useMemo(() => {
    if (allPayments.length === 0) return [];

    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date();
    
    // Odredi početni i krajnji datum na osnovu filtera
    if (revenueFilter === "prilagođeno") {
      if (!customFromDate || !customToDate) return [];
      startDate = new Date(customFromDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(customToDate);
      endDate.setHours(23, 59, 59, 999);
    } else if (revenueFilter === "dnevni") {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30); // Zadnjih 30 dana
      startDate.setHours(0, 0, 0, 0);
    } else if (revenueFilter === "tjedni") {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 84); // Zadnjih 12 tjedana
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 12); // Zadnjih 12 mjeseci
      startDate.setHours(0, 0, 0, 0);
    }

    // Filtriraj uplate
    const filteredPayments = allPayments.filter(p => {
      const paymentDate = new Date(p.date);
      paymentDate.setHours(0, 0, 0, 0);
      return paymentDate >= startDate && paymentDate <= endDate;
    });

    // Grupiši po periodu
    const grouped: Record<string, { amount: number; sortKey: string }> = {};

    filteredPayments.forEach((payment) => {
      let key: string;
      let sortKey: string; // Za sortiranje
      const date = new Date(payment.date);
      
      if (revenueFilter === "dnevni" || revenueFilter === "prilagođeno") {
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        key = `${day}.${month}.${year}`;
        sortKey = `${year}-${month}-${day}`;
      } else if (revenueFilter === "tjedni") {
        // Pronađi početak tjedna (ponedjeljak)
        const weekStart = new Date(date);
        const dayOfWeek = date.getDay();
        const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Ponedjeljak
        weekStart.setDate(diff);
        weekStart.setHours(0, 0, 0, 0);
        
        const day = String(weekStart.getDate()).padStart(2, "0");
        const month = String(weekStart.getMonth() + 1).padStart(2, "0");
        const year = weekStart.getFullYear();
        key = `Tjedan ${day}.${month}.${year}`;
        sortKey = `${year}-${month}-${day}`;
      } else {
        // Mjesečni
        const monthNames = ["januar", "februar", "mart", "april", "maj", "juni", "juli", "august", "septembar", "oktobar", "novembar", "decembar"];
        const month = monthNames[date.getMonth()];
        const year = date.getFullYear();
        key = `${month} ${year}`;
        sortKey = `${year}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      }

      if (!grouped[key]) {
        grouped[key] = { amount: 0, sortKey };
      }
      grouped[key].amount += payment.amount;
    });

    // Konvertuj u array i sortiraj
    return Object.entries(grouped)
      .map(([period, data]) => ({ 
        period, 
        zarada: Number(data.amount.toFixed(2)),
        sortKey: data.sortKey 
      }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ period, zarada }) => ({ period, zarada }));
  }, [allPayments, revenueFilter, customFromDate, customToDate]);

  // Ukupna zarada za odabrani period
  const totalRevenue = useMemo(() => {
    return revenueChartData.reduce((sum, item) => sum + item.zarada, 0);
  }, [revenueChartData]);

  // Custom Tooltip za grafikon
  const RevenueTooltip = ({ active, payload, label }: { active?: boolean; payload?: any; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: "#1f2937", color: "#fff", padding: 12, borderRadius: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: "#10b981", fontWeight: 500 }}>Zarada: </span>
            {payload[0].value.toFixed(2)} KM
          </div>
        </div>
      );
    }
    return null;
  };

  if (isAdmin === null || loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <FaSpinner style={{ fontSize: "32px", color: "#3b82f6", animation: "spin 1s linear infinite" }} />
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "20px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#1f2937", marginBottom: "8px" }}>
          Admin Panel - Upravljanje Pretplatama
        </h1>
        <p style={{ fontSize: "14px", color: "#6b7280" }}>
          Pregled i upravljanje svim korisnicima i pretplatama
        </p>
      </div>

      {message && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "20px",
            backgroundColor: message.type === "success" ? "#dcfce7" : "#fee2e2",
            color: message.type === "success" ? "#16a34a" : "#dc2626",
            border: `1px solid ${message.type === "success" ? "#86efac" : "#fca5a5"}`,
          }}
        >
          {message.text}
        </div>
      )}

      {/* Grafikon zarade */}
      <div style={{ marginBottom: "32px", background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#1f2937", marginBottom: "4px" }}>
              Grafikon Zarade
            </h2>
            <p style={{ fontSize: "14px", color: "#6b7280" }}>
              Ukupna zarada od pretplata korisnika
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                onClick={() => setRevenueFilter("dnevni")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor: revenueFilter === "dnevni" ? "#3b82f6" : "#f3f4f6",
                  color: revenueFilter === "dnevni" ? "#fff" : "#374151",
                  transition: "all 0.2s",
                }}
              >
                Dnevni
              </button>
              <button
                onClick={() => setRevenueFilter("tjedni")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor: revenueFilter === "tjedni" ? "#3b82f6" : "#f3f4f6",
                  color: revenueFilter === "tjedni" ? "#fff" : "#374151",
                  transition: "all 0.2s",
                }}
              >
                Tjedni
              </button>
              <button
                onClick={() => setRevenueFilter("mjesečni")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor: revenueFilter === "mjesečni" ? "#3b82f6" : "#f3f4f6",
                  color: revenueFilter === "mjesečni" ? "#fff" : "#374151",
                  transition: "all 0.2s",
                }}
              >
                Mjesečni
              </button>
              <button
                onClick={() => setRevenueFilter("prilagođeno")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor: revenueFilter === "prilagođeno" ? "#3b82f6" : "#f3f4f6",
                  color: revenueFilter === "prilagođeno" ? "#fff" : "#374151",
                  transition: "all 0.2s",
                }}
              >
                Prilagođeno
              </button>
            </div>
            {revenueFilter === "prilagođeno" && (
              <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>Od datuma:</label>
                  <input
                    type="date"
                    value={customFromDate}
                    onChange={(e) => setCustomFromDate(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px",
                      fontSize: "14px",
                      minWidth: "150px",
                    }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>Do datuma:</label>
                  <input
                    type="date"
                    value={customToDate}
                    onChange={(e) => setCustomToDate(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #e5e7eb",
                      borderRadius: "6px",
                      fontSize: "14px",
                      minWidth: "150px",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {revenueChartData.length > 0 ? (
          <>
            <div style={{ marginBottom: "16px", padding: "12px", background: "#f9fafb", borderRadius: "8px", display: "inline-block" }}>
              <span style={{ fontSize: "14px", color: "#6b7280", marginRight: "8px" }}>Ukupna zarada za period:</span>
              <span style={{ fontSize: "18px", fontWeight: 600, color: "#10b981" }}>
                {totalRevenue.toFixed(2)} KM
              </span>
            </div>
            <div style={{ 
              width: "100%", 
              height: "400px", 
              marginTop: "20px",
              backgroundColor: "#fff",
              borderRadius: "12px",
              padding: "20px",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
              boxSizing: "border-box",
              overflow: "hidden"
            }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueChartData} margin={{ top: 20, right: 20, left: 10, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="period" 
                    stroke="#6b7280"
                    style={{ fontSize: "12px" }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    style={{ fontSize: "12px" }}
                    tickFormatter={(value) => `${value} KM`}
                  />
                  <Tooltip content={<RevenueTooltip />} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="zarada" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ fill: "#10b981", r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Zarada (KM)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <style jsx>{`
              .recharts-wrapper {
                width: 100% !important;
              }
              .recharts-surface {
                width: 100% !important;
              }
            `}</style>
          </>
        ) : (
          <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
            <FaDollarSign style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.5 }} />
            <p style={{ fontSize: "16px" }}>Nema podataka o uplatama za odabrani period.</p>
          </div>
        )}
      </div>

      {/* Korisnici koji su prijavili uplatu */}
      {users.filter(user => subscriptions[user.id]?.paymentPendingVerification).length > 0 && (
        <div style={{ marginBottom: "24px", padding: "16px", background: "#fef3c7", borderRadius: "8px", border: "2px solid #f59e0b" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <span style={{ fontSize: "20px" }}>⚠️</span>
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#92400e", margin: 0 }}>
              Uplate koje čekaju provjeru ({users.filter(user => subscriptions[user.id]?.paymentPendingVerification).length})
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {users
              .filter(user => subscriptions[user.id]?.paymentPendingVerification)
              .map(user => {
                const subscription = subscriptions[user.id];
                return (
                  <div
                    key={user.id}
                    style={{
                      padding: "12px",
                      background: "#fff",
                      borderRadius: "6px",
                      border: "1px solid #fbbf24",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: "200px" }}>
                      <p style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937", margin: "0 0 4px 0" }}>
                        {user.appName} ({user.email || user.id.substring(0, 8) + "..."})
                      </p>
                      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                        <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
                          <strong>Iznos:</strong> {subscription?.paymentRequestedAmount || 0} KM
                        </p>
                        <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
                          <strong>Period:</strong> {subscription?.paymentRequestedMonths || 0} {subscription?.paymentRequestedMonths === 1 ? "mjesec" : "mjeseci"}
                        </p>
                        {subscription?.paymentReferenceNumber && (
                          <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
                            <strong>Reference:</strong> {subscription.paymentReferenceNumber}
                          </p>
                        )}
                        {subscription?.paymentRequestedAt && (
                          <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
                            <strong>Prijavljeno:</strong> {subscription.paymentRequestedAt.toLocaleDateString("bs-BA")} {subscription.paymentRequestedAt.toLocaleTimeString("bs-BA", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setPaymentAmount((subscription?.paymentRequestedAmount || 0).toString());
                          setPaymentMonths(subscription?.paymentRequestedMonths || 1);
                          setPaymentNote(subscription?.paymentReferenceNumber ? `Reference: ${subscription.paymentReferenceNumber}` : "");
                          setShowPaymentModal(true);
                        }}
                        style={{
                          padding: "8px 16px",
                          background: "#16a34a",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: 500,
                        }}
                      >
                        Odobri uplatu
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Da li ste sigurni da želite odbiti uplatu za korisnika ${user.appName}?`)) {
                            return;
                          }

                          try {
                            setSaving(true);
                            const subscriptionRef = doc(db, "users", user.id, "subscription", "info");
                            
                            await setDoc(
                              subscriptionRef,
                              {
                                paymentPendingVerification: false,
                                paymentRequestedAt: null,
                                paymentRequestedAmount: null,
                                paymentRequestedMonths: null,
                                paymentReferenceNumber: null,
                                updatedAt: Timestamp.fromDate(new Date()),
                              },
                              { merge: true }
                            );

                            await loadUsers();
                            setMessage({ type: "success", text: `Uplata odbijena za korisnika ${user.appName}` });
                            setTimeout(() => setMessage(null), 3000);
                          } catch (error) {
                            console.error("Greška pri odbijanju uplate:", error);
                            setMessage({ type: "error", text: "Greška pri odbijanju uplate" });
                            setTimeout(() => setMessage(null), 3000);
                          } finally {
                            setSaving(false);
                          }
                        }}
                        disabled={saving}
                        style={{
                          padding: "8px 16px",
                          background: "#dc2626",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: saving ? "not-allowed" : "pointer",
                          fontSize: "14px",
                          fontWeight: 500,
                          opacity: saving ? 0.6 : 1,
                        }}
                      >
                        {saving ? "Odbijanje..." : "Odbij uplatu"}
                      </button>
                      <button
                        onClick={async () => {
                          setSelectedUserDetails(user);
                          const sub = subscriptions[user.id];
                          // Postavi početni status na osnovu trenutnog statusa
                          if (sub?.isTrial) {
                            setNewSubscriptionStatus("trial");
                          } else if (sub?.isPremium || sub?.isActive) {
                            setNewSubscriptionStatus("premium");
                          } else if (sub?.isGracePeriod) {
                            setNewSubscriptionStatus("grace");
                          } else {
                            setNewSubscriptionStatus("inactive");
                          }
                          setPremiumDaysAdjustment(0);
                          setTrialDaysAdjustment(0);
                          
                          // Učitaj dodatne podatke korisnika (ime, telefon i lokacija)
                          setImeKorisnika(user.imeKorisnika || "");
                          setBrojTelefona(user.brojTelefona || "");
                          setLokacija(user.lokacija || "");
                          setEditingUserInfo(false);
                          setShowDetailsModal(true);
                        }}
                        style={{
                          padding: "8px 16px",
                          background: "#3b82f6",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: 500,
                        }}
                      >
                        Detalji
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Pretraga */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ position: "relative", maxWidth: "100%" }}>
          <FaSearch
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#9ca3af",
            }}
          />
          <input
            type="text"
            placeholder="Pretraži po email-u, app name ili user ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              maxWidth: "100%",
              padding: "12px 12px 12px 40px",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              fontSize: "14px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* Tabela korisnika */}
      <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6b7280" }}>
                  Email
                </th>
                <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6b7280" }}>
                  App Name
                </th>
                <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6b7280" }}>
                  Status Pretplate
                </th>
                <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6b7280" }}>
                  Preostalo Dana
                </th>
                <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6b7280" }}>
                  Registracija
                </th>
                <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6b7280" }}>
                  Uplate
                </th>
                <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6b7280" }}>
                  Akcije
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const subscription = subscriptions[user.id];
                const isActive = subscription?.isActive || false;
                const isTrial = subscription?.isTrial || false;
                const isGracePeriod = subscription?.isGracePeriod || false;
                const daysRemaining = subscription?.daysRemaining || 0;
                const daysUntilExpiry = subscription?.daysUntilExpiry || 0;
                const daysInGrace = subscription?.daysInGrace || 0;
                const paymentCount = subscription?.paymentHistory?.length || 0;
                
                // Determine status text and color
                let statusText = "Neaktivna";
                let statusColor = "#dc2626";
                let statusBg = "#fee2e2";
                
                const isPremium = subscription?.isPremium || false;
                if (isTrial) {
                  statusText = `Probni period (${daysRemaining} dana)`;
                  statusColor = "#2563eb";
                  statusBg = "#dbeafe";
                } else if (isPremium) {
                  statusText = `Premium (${daysUntilExpiry} dana)`;
                  statusColor = "#16a34a";
                  statusBg = "#dcfce7";
                } else if (isActive && daysUntilExpiry > 0) {
                  statusText = `Aktivna (${daysUntilExpiry} dana)`;
                  statusColor = "#16a34a";
                  statusBg = "#dcfce7";
                } else if (isGracePeriod) {
                  statusText = `Grace Period (${daysInGrace} dana)`;
                  statusColor = "#f59e0b";
                  statusBg = "#fef3c7";
                } else if (isActive) {
                  statusText = "Aktivna";
                  statusColor = "#16a34a";
                  statusBg = "#dcfce7";
                } else {
                  statusText = "Neaktivna";
                  statusColor = "#dc2626";
                  statusBg = "#fee2e2";
                }
                
                // Calculate remaining days text
                let remainingDaysText = "N/A";
                if (isTrial) {
                  remainingDaysText = `${daysRemaining} dana (Trial)`;
                } else if (isActive && daysUntilExpiry > 0) {
                  remainingDaysText = `${daysUntilExpiry} dana`;
                } else if (isGracePeriod) {
                  remainingDaysText = `${daysInGrace} dana (Grace)`;
                } else if (subscription?.expiryDate) {
                  remainingDaysText = "Istekla";
                }

                return (
                  <tr key={user.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px", fontSize: "14px", color: "#1f2937" }}>
                      {user.email || user.id.substring(0, 8) + "..."}
                    </td>
                    <td style={{ padding: "12px", fontSize: "14px", color: "#1f2937", fontWeight: 500 }}>
                      {user.appName}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <span
                        style={{
                          padding: "4px 12px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: 600,
                          backgroundColor: statusBg,
                          color: statusColor,
                        }}
                      >
                        {statusText}
                      </span>
                    </td>
                    <td style={{ padding: "12px", fontSize: "14px", color: "#1f2937" }}>
                      {remainingDaysText}
                    </td>
                    <td style={{ padding: "12px", fontSize: "12px", color: "#6b7280" }}>
                      {user.createdAt ? user.createdAt.toLocaleDateString("bs-BA") : "N/A"}
                    </td>
                    <td style={{ padding: "12px", fontSize: "14px", color: "#1f2937" }}>
                      {paymentCount > 0 ? (
                        <span style={{ fontWeight: 600, color: "#3b82f6" }}>{paymentCount} uplata</span>
                      ) : (
                        <span style={{ color: "#9ca3af" }}>Nema uplata</span>
                      )}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          onClick={() => {
                            setSelectedUserDetails(user);
                            const sub = subscriptions[user.id];
                            // Postavi početni status na osnovu trenutnog statusa
                            if (sub?.isTrial) {
                              setNewSubscriptionStatus("trial");
                            } else if (sub?.isPremium || sub?.isActive) {
                              setNewSubscriptionStatus("premium");
                            } else if (sub?.isGracePeriod) {
                              setNewSubscriptionStatus("grace");
                            } else {
                              setNewSubscriptionStatus("inactive");
                            }
                            setPremiumDaysAdjustment(0);
                            setTrialDaysAdjustment(0);
                            setShowDetailsModal(true);
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            border: "none",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            backgroundColor: "#6b7280",
                            color: "#fff",
                            transition: "all 0.2s",
                            marginRight: "4px",
                          }}
                        >
                          Detalji
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setSelectedSubscription(subscription);
                            setShowPaymentModal(true);
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            border: "none",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            backgroundColor: "#3b82f6",
                            color: "#fff",
                            transition: "all 0.2s",
                          }}
                        >
                          <FaPlus /> Dodaj Uplatu
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal za dodavanje uplate */}
      {showPaymentModal && selectedUser && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
          onClick={() => {
            setShowPaymentModal(false);
            setSelectedUser(null);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#1f2937", marginBottom: "20px" }}>
              Dodaj Uplatu - {selectedUser.appName}
            </h2>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "#374151", marginBottom: "6px" }}>
                Iznos (KM)
              </label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="12, 24, 36, 72..."
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #e5e7eb",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "#374151", marginBottom: "6px" }}>
                Period (mjeseci)
              </label>
              <select
                value={paymentMonths}
                onChange={(e) => setPaymentMonths(parseInt(e.target.value))}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #e5e7eb",
                  fontSize: "14px",
                  outline: "none",
                }}
              >
                <option value={1}>1 mjesec</option>
                <option value={2}>2 mjeseca</option>
                <option value={3}>3 mjeseca</option>
                <option value={6}>6 mjeseci</option>
              </select>
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 500, color: "#374151", marginBottom: "6px" }}>
                Napomena (opcionalno)
              </label>
              <input
                type="text"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                placeholder="Bank Transfer - 3 mjeseci"
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid #e5e7eb",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px", padding: "12px", background: "#f9fafb", borderRadius: "6px", border: "1px solid #e5e7eb" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={activateOnPayment}
                  onChange={(e) => setActivateOnPayment(e.target.checked)}
                  style={{ width: "18px", height: "18px", cursor: "pointer" }}
                />
                <span style={{ fontSize: "14px", color: "#1f2937", fontWeight: 500 }}>
                  Aktiviraj pretplatu nakon dodavanja uplate
                </span>
              </label>
              <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px", marginLeft: "26px" }}>
                Ako je označeno, pretplata će biti automatski aktivirana. Ako nije, pretplata će biti deaktivirana.
              </p>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedUser(null);
                  setPaymentAmount("");
                  setPaymentMonths(1);
                  setPaymentNote("");
                  setActivateOnPayment(true);
                }}
                style={{
                  padding: "10px 20px",
                  borderRadius: "6px",
                  border: "1px solid #e5e7eb",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor: "#fff",
                  color: "#374151",
                }}
              >
                Otkaži
              </button>
              <button
                onClick={addPayment}
                disabled={saving || !paymentAmount}
                style={{
                  padding: "10px 20px",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: saving || !paymentAmount ? "not-allowed" : "pointer",
                  backgroundColor: saving || !paymentAmount ? "#9ca3af" : "#3b82f6",
                  color: "#fff",
                }}
              >
                {saving ? "Spremanje..." : "Dodaj Uplatu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal za detalje korisnika */}
      {showDetailsModal && selectedUserDetails && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
          onClick={() => {
            setShowDetailsModal(false);
            setSelectedUserDetails(null);
            setPremiumDaysAdjustment(0);
            setTrialDaysAdjustment(0);
            setNewSubscriptionStatus("premium");
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "700px",
              width: "90%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#1f2937", marginBottom: "20px" }}>
              Detalji Korisnika - {selectedUserDetails.appName}
              {selectedUserDetails.email && (
                <span style={{ fontSize: "14px", fontWeight: 400, color: "#6b7280", marginLeft: "8px" }}>
                  ({selectedUserDetails.email})
                </span>
              )}
            </h2>

            {(() => {
              const subscription = subscriptions[selectedUserDetails.id];
              const isTrial = subscription?.isTrial || false;
              const isGracePeriod = subscription?.isGracePeriod || false;
              const isActive = subscription?.isActive || false;
              
              return (
                <>
                  {/* Osnovne informacije */}
                  <div style={{ marginBottom: "24px", padding: "16px", background: "#f9fafb", borderRadius: "8px" }}>
                    <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", marginBottom: "12px" }}>
                      Osnovne Informacije
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                      <div>
                        <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Email:</p>
                        <p style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937" }}>
                          {selectedUserDetails.email || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>App Name:</p>
                        <p style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937" }}>
                          {selectedUserDetails.appName}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>User ID:</p>
                        <p style={{ fontSize: "12px", fontFamily: "monospace", color: "#6b7280" }}>
                          {selectedUserDetails.id}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Registracija:</p>
                        <p style={{ fontSize: "14px", color: "#1f2937" }}>
                          {selectedUserDetails.createdAt
                            ? selectedUserDetails.createdAt.toLocaleDateString("bs-BA") +
                              " " +
                              selectedUserDetails.createdAt.toLocaleTimeString("bs-BA", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                    
                    {/* Dodatna polja za editovanje */}
                    <div style={{ 
                      display: "grid", 
                      gridTemplateColumns: "1fr 1fr 1fr", 
                      gap: editingUserInfo ? "20px" : "12px", 
                      marginBottom: "16px",
                      padding: editingUserInfo ? "12px" : "0",
                      background: editingUserInfo ? "#ffffff" : "transparent",
                      borderRadius: editingUserInfo ? "8px" : "0",
                      border: editingUserInfo ? "1px solid #e5e7eb" : "none",
                    }}>
                      <div style={{ 
                        padding: editingUserInfo ? "8px" : "0",
                        marginBottom: editingUserInfo ? "8px" : "0",
                      }}>
                        <label style={{ fontSize: "12px", color: "#6b7280", marginBottom: "8px", display: "block" }}>
                          Ime korisnika:
                        </label>
                        {editingUserInfo ? (
                          <input
                            type="text"
                            value={imeKorisnika}
                            onChange={(e) => setImeKorisnika(e.target.value)}
                            placeholder="Unesite ime korisnika"
                            style={{
                              width: "100%",
                              padding: "10px 14px",
                              border: "1px solid #d1d5db",
                              borderRadius: "6px",
                              fontSize: "14px",
                              color: "#1f2937",
                              boxSizing: "border-box",
                            }}
                          />
                        ) : (
                          <p style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937", margin: 0, padding: "8px 0" }}>
                            {imeKorisnika || "Nije uneseno"}
                          </p>
                        )}
                      </div>
                      <div style={{ 
                        padding: editingUserInfo ? "8px" : "0",
                        marginBottom: editingUserInfo ? "8px" : "0",
                      }}>
                        <label style={{ fontSize: "12px", color: "#6b7280", marginBottom: "8px", display: "block" }}>
                          Broj telefona:
                        </label>
                        {editingUserInfo ? (
                          <input
                            type="tel"
                            value={brojTelefona}
                            onChange={(e) => setBrojTelefona(e.target.value)}
                            placeholder="Unesite broj telefona"
                            style={{
                              width: "100%",
                              padding: "10px 14px",
                              border: "1px solid #d1d5db",
                              borderRadius: "6px",
                              fontSize: "14px",
                              color: "#1f2937",
                              boxSizing: "border-box",
                            }}
                          />
                        ) : (
                          <p style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937", margin: 0, padding: "8px 0" }}>
                            {brojTelefona || "Nije uneseno"}
                          </p>
                        )}
                      </div>
                      <div style={{ 
                        padding: editingUserInfo ? "8px" : "0",
                        marginBottom: editingUserInfo ? "8px" : "0",
                      }}>
                        <label style={{ fontSize: "12px", color: "#6b7280", marginBottom: "8px", display: "block" }}>
                          Lokacija:
                        </label>
                        {editingUserInfo ? (
                          <input
                            type="text"
                            value={lokacija}
                            onChange={(e) => setLokacija(e.target.value)}
                            placeholder="Unesite lokaciju"
                            style={{
                              width: "100%",
                              padding: "10px 14px",
                              border: "1px solid #d1d5db",
                              borderRadius: "6px",
                              fontSize: "14px",
                              color: "#1f2937",
                              boxSizing: "border-box",
                            }}
                          />
                        ) : (
                          <p style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937", margin: 0, padding: "8px 0" }}>
                            {lokacija || "Nije uneseno"}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Dugme za editovanje/spremanje */}
                    {editingUserInfo ? (
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={async () => {
                            if (!selectedUserDetails) return;
                            setSavingUserInfo(true);
                            try {
                              const userRef = doc(db, "users", selectedUserDetails.id);
                              
                              // Pripremi podatke za spremanje
                              const updateData: any = {};
                              if (imeKorisnika.trim()) {
                                updateData.imeKorisnika = imeKorisnika.trim();
                              } else {
                                updateData.imeKorisnika = null;
                              }
                              if (brojTelefona.trim()) {
                                updateData.brojTelefona = brojTelefona.trim();
                              } else {
                                updateData.brojTelefona = null;
                              }
                              if (lokacija.trim()) {
                                updateData.lokacija = lokacija.trim();
                              } else {
                                updateData.lokacija = null;
                              }
                              
                              // Spremi u Firestore
                              await updateDoc(userRef, updateData);
                              
                              // Provjeri da li su podaci stvarno spremljeni
                              const savedDoc = await getDoc(userRef);
                              if (savedDoc.exists()) {
                                const savedData = savedDoc.data();
                                console.log("Podaci spremljeni u Firestore:", savedData);
                                
                                // Ažuriraj lokalni state korisnika sa stvarnim podacima iz Firestore
                                const updatedUser = {
                                  ...selectedUserDetails,
                                  imeKorisnika: savedData.imeKorisnika || undefined,
                                  brojTelefona: savedData.brojTelefona || undefined,
                                  lokacija: savedData.lokacija || undefined,
                                };
                                
                                setUsers((prevUsers) =>
                                  prevUsers.map((user) =>
                                    user.id === selectedUserDetails.id ? updatedUser : user
                                  )
                                );
                                
                                // Ažuriraj selectedUserDetails
                                setSelectedUserDetails(updatedUser);
                                
                                // Ažuriraj lokalne state varijable
                                setImeKorisnika(savedData.imeKorisnika || "");
                                setBrojTelefona(savedData.brojTelefona || "");
                                setLokacija(savedData.lokacija || "");
                              }
                              
                              setEditingUserInfo(false);
                              setMessage({ type: "success", text: "Podaci uspješno sačuvani" });
                              setTimeout(() => setMessage(null), 3000);
                            } catch (error) {
                              console.error("Greška pri spremanju podataka:", error);
                              setMessage({ type: "error", text: "Greška pri spremanju podataka: " + (error as Error).message });
                              setTimeout(() => setMessage(null), 5000);
                            } finally {
                              setSavingUserInfo(false);
                            }
                          }}
                          disabled={savingUserInfo}
                          style={{
                            padding: "8px 16px",
                            background: savingUserInfo ? "#9ca3af" : "#10b981",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: savingUserInfo ? "not-allowed" : "pointer",
                            fontSize: "14px",
                            fontWeight: 500,
                          }}
                        >
                          {savingUserInfo ? "Spremanje..." : "Sačuvaj"}
                        </button>
                        <button
                          onClick={() => {
                            // Vrati na originalne vrijednosti
                            setImeKorisnika(selectedUserDetails?.imeKorisnika || "");
                            setBrojTelefona(selectedUserDetails?.brojTelefona || "");
                            setLokacija(selectedUserDetails?.lokacija || "");
                            setEditingUserInfo(false);
                          }}
                          disabled={savingUserInfo}
                          style={{
                            padding: "8px 16px",
                            background: "#6b7280",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: savingUserInfo ? "not-allowed" : "pointer",
                            fontSize: "14px",
                            fontWeight: 500,
                          }}
                        >
                          Otkaži
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingUserInfo(true);
                        }}
                        style={{
                          padding: "8px 16px",
                          background: "#3b82f6",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: 500,
                        }}
                      >
                        Uredi
                      </button>
                    )}
                  </div>

                  {/* Status pretplate */}
                  <div style={{ marginBottom: "24px", padding: "16px", background: "#f9fafb", borderRadius: "8px" }}>
                    <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", marginBottom: "12px" }}>
                      Status Pretplate
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                      <div>
                        <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Status:</p>
                        <span
                          style={{
                            padding: "4px 12px",
                            borderRadius: "12px",
                            fontSize: "12px",
                            fontWeight: 600,
                            backgroundColor: isTrial
                              ? "#dbeafe"
                              : subscription?.isPremium
                              ? "#dcfce7"
                              : isGracePeriod
                              ? "#fef3c7"
                              : isActive
                              ? "#dcfce7"
                              : "#fee2e2",
                            color: isTrial
                              ? "#2563eb"
                              : subscription?.isPremium
                              ? "#16a34a"
                              : isGracePeriod
                              ? "#f59e0b"
                              : isActive
                              ? "#16a34a"
                              : "#dc2626",
                          }}
                        >
                          {isTrial
                            ? `Probni period (${subscription?.daysRemaining || 0} dana)`
                            : subscription?.isPremium
                            ? `Premium (${subscription?.daysUntilExpiry || 0} dana)`
                            : isGracePeriod
                            ? `Grace Period (${subscription?.daysInGrace || 0} dana)`
                            : isActive
                            ? `Aktivna (${subscription?.daysUntilExpiry || 0} dana)`
                            : "Neaktivna"}
                        </span>
                      </div>
                      <div>
                        <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Preostalo dana:</p>
                        <p style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937" }}>
                          {isTrial
                            ? `${subscription?.daysRemaining || 0} dana (Probni period)`
                            : subscription?.isPremium
                            ? `${subscription?.daysUntilExpiry || 0} dana (Premium)`
                            : isGracePeriod
                            ? `${subscription?.daysInGrace || 0} dana (Grace)`
                            : isActive
                            ? `${subscription?.daysUntilExpiry || 0} dana`
                            : "0 dana"}
                        </p>
                      </div>
                      <div>
                        <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Mjesečna Cijena:</p>
                        <p style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937" }}>
                          {subscription?.monthlyPrice || 12} KM
                        </p>
                      </div>
                      {subscription?.paymentHistory && subscription.paymentHistory.length > 0 && (
                        <div>
                          <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Ukupno uplata:</p>
                          <p style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937" }}>
                            {subscription.paymentHistory.length} {subscription.paymentHistory.length === 1 ? "uplata" : "uplata"}
                          </p>
                        </div>
                      )}
                      {subscription?.trialEndDate && (
                        <div>
                          <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Probni period ističe:</p>
                          <p style={{ fontSize: "14px", color: "#1f2937" }}>
                            {subscription.trialEndDate.toLocaleDateString("bs-BA")}
                          </p>
                        </div>
                      )}
                      {(subscription?.expiryDate || subscription?.graceEndDate) && (
                        <div>
                          <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
                            {subscription?.graceEndDate && !subscription?.isActive && !subscription?.isTrial && !subscription?.isGracePeriod
                              ? "Grace period istekao:"
                              : "Pretplata ističe:"}
                          </p>
                          <p style={{ fontSize: "14px", color: (subscription?.expiryDate && subscription.expiryDate < new Date()) || (subscription?.graceEndDate && subscription.graceEndDate < new Date()) ? "#dc2626" : "#1f2937" }}>
                            {(() => {
                              // Ako je neaktivna i postoji graceEndDate, prikaži graceEndDate
                              if (subscription?.graceEndDate && !subscription?.isActive && !subscription?.isTrial && !subscription?.isGracePeriod) {
                                return subscription.graceEndDate.toLocaleDateString("bs-BA");
                              }
                              // Inače prikaži expiryDate (ako nije new Date(0))
                              if (subscription?.expiryDate) {
                                const expiryDate = subscription.expiryDate;
                                // Provjeri da li je datum validan (nije 1970/1969)
                                if (expiryDate.getFullYear() > 1970) {
                                  return expiryDate.toLocaleDateString("bs-BA");
                                }
                                // Ako je expiryDate invalidan, provjeri graceEndDate
                                if (subscription?.graceEndDate) {
                                  return subscription.graceEndDate.toLocaleDateString("bs-BA");
                                }
                              }
                              return "N/A";
                            })()}
                          </p>
                        </div>
                      )}
                      {subscription?.lastPaymentDate && (
                        <div>
                          <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Posljednja uplata:</p>
                          <p style={{ fontSize: "14px", color: "#1f2937" }}>
                            {subscription.lastPaymentDate.toLocaleDateString("bs-BA")}
                          </p>
                        </div>
                      )}
                      {subscription?.paymentHistory && subscription.paymentHistory.length > 0 && (
                        <div>
                          <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Ukupan iznos uplata:</p>
                          <p style={{ fontSize: "14px", fontWeight: 500, color: "#16a34a" }}>
                            {subscription.paymentHistory.reduce((sum, p) => sum + (p.amount || 0), 0).toFixed(2)} KM
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Payment Verification Status */}
                    {subscription?.paymentPendingVerification && (
                      <div style={{ marginTop: "16px", padding: "12px", background: "#fef3c7", borderRadius: "6px", border: "1px solid #f59e0b" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                          <span style={{ fontSize: "18px" }}>⚠️</span>
                          <p style={{ fontSize: "14px", fontWeight: 600, color: "#92400e", margin: 0 }}>
                            Uplata čeka provjeru
                          </p>
                        </div>
                        <div style={{ marginLeft: "26px" }}>
                          <p style={{ fontSize: "12px", color: "#78350f", margin: "4px 0" }}>
                            <strong>Iznos:</strong> {subscription.paymentRequestedAmount || 0} KM
                          </p>
                          <p style={{ fontSize: "12px", color: "#78350f", margin: "4px 0" }}>
                            <strong>Period:</strong> {subscription.paymentRequestedMonths || 0} {subscription.paymentRequestedMonths === 1 ? "mjesec" : "mjeseci"}
                          </p>
                          {subscription.paymentReferenceNumber && (
                            <p style={{ fontSize: "12px", color: "#78350f", margin: "4px 0" }}>
                              <strong>Reference broj:</strong> {subscription.paymentReferenceNumber}
                            </p>
                          )}
                          {subscription.paymentRequestedAt && (
                            <p style={{ fontSize: "12px", color: "#78350f", margin: "4px 0" }}>
                              <strong>Prijavljeno:</strong> {subscription.paymentRequestedAt.toLocaleDateString("bs-BA")} {subscription.paymentRequestedAt.toLocaleTimeString("bs-BA", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #e5e7eb" }}>
                      <h4 style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937", marginBottom: "12px" }}>
                        Upravljanje Pretplatom
                      </h4>
                      
                      {/* Promijeni status pretplate */}
                      <div style={{ marginBottom: "16px" }}>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "#374151", marginBottom: "6px" }}>
                          Promijeni Status Pretplate:
                        </label>
                        <select
                          value={newSubscriptionStatus}
                          onChange={(e) => setNewSubscriptionStatus(e.target.value as "trial" | "premium" | "grace" | "inactive")}
                          style={{
                            width: "100%",
                            padding: "8px",
                            borderRadius: "6px",
                            border: "1px solid #e5e7eb",
                            fontSize: "14px",
                            outline: "none",
                            marginBottom: "8px",
                          }}
                        >
                          <option value="trial">Probni period</option>
                          <option value="premium">Premium</option>
                          <option value="grace">Grace Period</option>
                          <option value="inactive">Neaktivna</option>
                        </select>
                        <button
                          onClick={() => changeSubscriptionStatus(selectedUserDetails.id, newSubscriptionStatus)}
                          disabled={saving}
                          style={{
                            padding: "6px 12px",
                            background: "#3b82f6",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: saving ? "not-allowed" : "pointer",
                            fontSize: "12px",
                            fontWeight: 500,
                            opacity: saving ? 0.6 : 1,
                            width: "100%",
                          }}
                        >
                          {saving ? "Spremanje..." : "Promijeni Status"}
                        </button>
                      </div>

                      {/* Ažuriraj Premium dane */}
                      <div style={{ marginBottom: "16px" }}>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "#374151", marginBottom: "6px" }}>
                          Ažuriraj Premium Dane:
                        </label>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <button
                            onClick={() => setPremiumDaysAdjustment(Math.max(-30, premiumDaysAdjustment - 1))}
                            disabled={saving}
                            style={{
                              padding: "8px 12px",
                              background: "#dc2626",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: saving ? "not-allowed" : "pointer",
                              fontSize: "16px",
                              fontWeight: 600,
                              opacity: saving ? 0.6 : 1,
                            }}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={premiumDaysAdjustment}
                            onChange={(e) => setPremiumDaysAdjustment(parseInt(e.target.value) || 0)}
                            style={{
                              flex: 1,
                              padding: "8px",
                              borderRadius: "6px",
                              border: "1px solid #e5e7eb",
                              fontSize: "14px",
                              textAlign: "center",
                              outline: "none",
                            }}
                            placeholder="0"
                          />
                          <button
                            onClick={() => setPremiumDaysAdjustment(Math.min(365, premiumDaysAdjustment + 1))}
                            disabled={saving}
                            style={{
                              padding: "8px 12px",
                              background: "#16a34a",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: saving ? "not-allowed" : "pointer",
                              fontSize: "16px",
                              fontWeight: 600,
                              opacity: saving ? 0.6 : 1,
                            }}
                          >
                            +
                          </button>
                        </div>
                        {premiumDaysAdjustment !== 0 && (
                          <button
                            onClick={() => adjustPremiumDays(selectedUserDetails.id, premiumDaysAdjustment)}
                            disabled={saving}
                            style={{
                              marginTop: "8px",
                              padding: "6px 12px",
                              background: "#3b82f6",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: saving ? "not-allowed" : "pointer",
                              fontSize: "12px",
                              fontWeight: 500,
                              opacity: saving ? 0.6 : 1,
                              width: "100%",
                            }}
                          >
                            {saving ? "Spremanje..." : `${premiumDaysAdjustment > 0 ? "Dodaj" : "Oduzmi"} ${Math.abs(premiumDaysAdjustment)} ${Math.abs(premiumDaysAdjustment) === 1 ? "dan" : "dana"}`}
                          </button>
                        )}
                      </div>

                      {/* Ažuriraj Probne dane */}
                      <div style={{ marginBottom: "16px" }}>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 500, color: "#374151", marginBottom: "6px" }}>
                          Ažuriraj Probne Dane:
                        </label>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <button
                            onClick={() => setTrialDaysAdjustment(Math.max(-15, trialDaysAdjustment - 1))}
                            disabled={saving}
                            style={{
                              padding: "8px 12px",
                              background: "#dc2626",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: saving ? "not-allowed" : "pointer",
                              fontSize: "16px",
                              fontWeight: 600,
                              opacity: saving ? 0.6 : 1,
                            }}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={trialDaysAdjustment}
                            onChange={(e) => setTrialDaysAdjustment(parseInt(e.target.value) || 0)}
                            style={{
                              flex: 1,
                              padding: "8px",
                              borderRadius: "6px",
                              border: "1px solid #e5e7eb",
                              fontSize: "14px",
                              textAlign: "center",
                              outline: "none",
                            }}
                            placeholder="0"
                          />
                          <button
                            onClick={() => setTrialDaysAdjustment(Math.min(90, trialDaysAdjustment + 1))}
                            disabled={saving}
                            style={{
                              padding: "8px 12px",
                              background: "#16a34a",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: saving ? "not-allowed" : "pointer",
                              fontSize: "16px",
                              fontWeight: 600,
                              opacity: saving ? 0.6 : 1,
                            }}
                          >
                            +
                          </button>
                        </div>
                        {trialDaysAdjustment !== 0 && (
                          <button
                            onClick={() => adjustTrialDays(selectedUserDetails.id, trialDaysAdjustment)}
                            disabled={saving}
                            style={{
                              marginTop: "8px",
                              padding: "6px 12px",
                              background: "#3b82f6",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: saving ? "not-allowed" : "pointer",
                              fontSize: "12px",
                              fontWeight: 500,
                              opacity: saving ? 0.6 : 1,
                              width: "100%",
                            }}
                          >
                            {saving ? "Spremanje..." : `${trialDaysAdjustment > 0 ? "Dodaj" : "Oduzmi"} ${Math.abs(trialDaysAdjustment)} ${Math.abs(trialDaysAdjustment) === 1 ? "dan" : "dana"}`}
                          </button>
                        )}
                      </div>

                      {/* Aktiviraj/Deaktiviraj pretplatu */}
                      <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #e5e7eb" }}>
                        <button
                          onClick={() => toggleSubscription(selectedUserDetails.id, isActive)}
                          disabled={saving}
                          style={{
                            padding: "8px 16px",
                            background: isActive ? "#dc2626" : "#16a34a",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: saving ? "not-allowed" : "pointer",
                            fontSize: "14px",
                            fontWeight: 500,
                            opacity: saving ? 0.6 : 1,
                            width: "100%",
                          }}
                        >
                          {saving ? "Spremanje..." : isActive ? "Deaktiviraj Pretplatu" : "Aktiviraj Pretplatu"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Historija uplata */}
                  {subscription?.paymentHistory && subscription.paymentHistory.length > 0 && (
                    <div style={{ marginBottom: "24px" }}>
                      <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", marginBottom: "12px" }}>
                        Historija Uplata ({subscription.paymentHistory.length})
                      </h3>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ background: "#f9fafb" }}>
                              <th style={{ padding: "8px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6b7280" }}>
                                Datum
                              </th>
                              <th style={{ padding: "8px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6b7280" }}>
                                Iznos
                              </th>
                              <th style={{ padding: "8px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6b7280" }}>
                                Napomena
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {subscription.paymentHistory
                              .sort((a, b) => b.date.getTime() - a.date.getTime())
                              .map((payment, index) => (
                                <tr key={index} style={{ borderBottom: "1px solid #f3f4f6" }}>
                                  <td style={{ padding: "8px", fontSize: "14px", color: "#1f2937" }}>
                                    {payment.date.toLocaleDateString("bs-BA")}
                                  </td>
                                  <td style={{ padding: "8px", fontSize: "14px", fontWeight: 600, color: "#16a34a" }}>
                                    {payment.amount.toFixed(2)} KM
                                  </td>
                                  <td style={{ padding: "8px", fontSize: "14px", color: "#6b7280" }}>
                                    {payment.note || "-"}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => {
                        setShowDetailsModal(false);
                        setSelectedUserDetails(null);
                        setPremiumDaysAdjustment(0);
                        setTrialDaysAdjustment(0);
                        setNewSubscriptionStatus("premium");
                      }}
                      style={{
                        padding: "10px 20px",
                        borderRadius: "6px",
                        border: "1px solid #e5e7eb",
                        fontSize: "14px",
                        fontWeight: 600,
                        cursor: "pointer",
                        backgroundColor: "#fff",
                        color: "#374151",
                      }}
                    >
                      Zatvori
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

