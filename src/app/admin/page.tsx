"use client";

import React, { useState, useEffect, useMemo } from "react";
import { auth, db } from "../../lib/firebase";
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, Timestamp, query, where, onSnapshot } from "firebase/firestore";
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
  const [revenueFilter, setRevenueFilter] = useState<"dnevni" | "tjedni" | "mjesečni" | "tromjesečni" | "prilagođeno" | "odaberiMjesec">("dnevni");
  const [customFromDate, setCustomFromDate] = useState<string>("");
  const [customToDate, setCustomToDate] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [customFromDay, setCustomFromDay] = useState<number>(new Date().getDate());
  const [customFromMonth, setCustomFromMonth] = useState<number>(new Date().getMonth() + 1);
  const [customFromYear, setCustomFromYear] = useState<number>(new Date().getFullYear());
  const [customToDay, setCustomToDay] = useState<number>(new Date().getDate());
  const [customToMonth, setCustomToMonth] = useState<number>(new Date().getMonth() + 1);
  const [customToYear, setCustomToYear] = useState<number>(new Date().getFullYear());
  const [customFromDayDropdownOpen, setCustomFromDayDropdownOpen] = useState(false);
  const [customFromMonthDropdownOpen, setCustomFromMonthDropdownOpen] = useState(false);
  const [customFromYearDropdownOpen, setCustomFromYearDropdownOpen] = useState(false);
  const [customToDayDropdownOpen, setCustomToDayDropdownOpen] = useState(false);
  const [customToMonthDropdownOpen, setCustomToMonthDropdownOpen] = useState(false);
  const [customToYearDropdownOpen, setCustomToYearDropdownOpen] = useState(false);
  const [premiumDaysAdjustment, setPremiumDaysAdjustment] = useState(0);
  const [trialDaysAdjustment, setTrialDaysAdjustment] = useState(0);
  const [newSubscriptionStatus, setNewSubscriptionStatus] = useState<"trial" | "premium" | "grace" | "inactive">("premium");
  const [imeKorisnika, setImeKorisnika] = useState("");
  const [brojTelefona, setBrojTelefona] = useState("");
  const [lokacija, setLokacija] = useState("");
  const [savingUserInfo, setSavingUserInfo] = useState(false);
  const [editingUserInfo, setEditingUserInfo] = useState(false);

  // Postavi korisnika kao vlasnika (isOwner = true) - pomoćna funkcija
  const setUserAsOwnerHelper = async (userEmail: string) => {
    try {
      // Pronađi korisnika po emailu
      const usersCollection = collection(db, "users");
      const usersSnapshot = await getDocs(usersCollection);
      
      let foundUser = null;
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        if (userData.email === userEmail) {
          foundUser = { id: userDoc.id, ...userData };
          break;
        }
      }
      
      if (!foundUser) {
        console.warn(`Korisnik sa emailom ${userEmail} nije pronađen`);
        return;
      }
      
      // Ažuriraj isOwner na true
      const userDocRef = doc(db, "users", foundUser.id);
      await updateDoc(userDocRef, {
        isOwner: true,
      });
      
      // Ažuriraj sve device dokumente za ovog korisnika da imaju role "vlasnik"
      const devicesCollection = collection(db, "devices");
      const devicesSnapshot = await getDocs(devicesCollection);
      
      for (const deviceDoc of devicesSnapshot.docs) {
        const deviceData = deviceDoc.data();
        if (deviceData.userId === foundUser.id) {
          const deviceRef = doc(db, "devices", deviceDoc.id);
          await updateDoc(deviceRef, {
            role: "vlasnik",
            status: "approved",
            permissions: {
              dashboard: true,
              obracun: true,
              arhiva: true,
              cjenovnik: true,
              profit: true,
              profile: true,
              admin: false,
            },
          });
        }
      }
      
      console.log(`Korisnik ${userEmail} je postavljen kao vlasnik`);
    } catch (error) {
      console.error("Greška pri postavljanju korisnika kao vlasnika:", error);
    }
  };

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
      
      // Učitaj podatke jednom pri inicijalizaciji
      await loadUsers();
      
      // Napomena: Real-time listener više nije potreban jer korisnike učitavamo iz Firebase Auth
      // koje se ne može pratiti preko Firestore listenera. Admin može osvježiti listu ručno
      // ili se lista osvježava pri svakom pristupu stranici.
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

    return () => {
      unsubscribe();
    };
  }, [router]);

  // Ažuriraj state varijable kada se promijeni selectedUserDetails
  useEffect(() => {
    if (selectedUserDetails) {
      // Učitaj podatke iz selectedUserDetails ili iz Firestore
      const loadUserInfo = async () => {
        try {
          const userDoc = await getDoc(doc(db, "users", selectedUserDetails.id));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setImeKorisnika(userData.imeKorisnika || "");
            setBrojTelefona(userData.brojTelefona || "");
            setLokacija(userData.lokacija || "");
          } else {
            // Ako dokument ne postoji, koristi podatke iz selectedUserDetails
            setImeKorisnika(selectedUserDetails.imeKorisnika || "");
            setBrojTelefona(selectedUserDetails.brojTelefona || "");
            setLokacija(selectedUserDetails.lokacija || "");
          }
        } catch (error) {
          console.error("Greška pri učitavanju podataka korisnika:", error);
          // Fallback na podatke iz selectedUserDetails
          setImeKorisnika(selectedUserDetails.imeKorisnika || "");
          setBrojTelefona(selectedUserDetails.brojTelefona || "");
          setLokacija(selectedUserDetails.lokacija || "");
        }
      };
      
      loadUserInfo();
    } else {
      // Resetuj state varijable ako nema selectedUserDetails
      setImeKorisnika("");
      setBrojTelefona("");
      setLokacija("");
    }
  }, [selectedUserDetails?.id]); // Osiguraj da se pokrene kada se promijeni ID korisnika

  // Učitaj sve korisnike
  const loadUsers = async () => {
    try {
      setLoading(true);
      setMessage(null);
      
      // Uzmi ID token od trenutnog korisnika za autentifikaciju
      const user = auth.currentUser;
      if (!user) {
        setMessage({ type: "error", text: "Niste prijavljeni" });
        setLoading(false);
        return;
      }

      const token = await user.getIdToken();
      
      // Pozovi API route koji koristi Firebase Admin SDK da lista korisnike iz Auth
      const response = await fetch('/api/list-users', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Nepoznata greška' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const usersWithSubscriptions = data.users || [];

      // Razdvoji korisnike i subscriptions
      const usersList: User[] = [];
      const subscriptionsMap: Record<string, Subscription> = {};

      usersWithSubscriptions.forEach((item: any) => {
        usersList.push({
          id: item.id,
          email: item.email,
          appName: item.appName,
          createdAt: item.createdAt ? new Date(item.createdAt) : null,
          lastSignIn: item.lastSignIn ? new Date(item.lastSignIn) : null,
          imeKorisnika: item.imeKorisnika,
          brojTelefona: item.brojTelefona,
          lokacija: item.lokacija,
        });

        // Konvertuj subscription podatke
        const sub = item.subscription || {};
        subscriptionsMap[item.id] = {
          isActive: sub.isActive || false,
          monthlyPrice: sub.monthlyPrice || 12,
          lastPaymentDate: sub.lastPaymentDate ? new Date(sub.lastPaymentDate) : null,
          expiryDate: sub.expiryDate ? new Date(sub.expiryDate) : null,
          graceEndDate: sub.graceEndDate ? new Date(sub.graceEndDate) : null,
          trialEndDate: sub.trialEndDate ? new Date(sub.trialEndDate) : null,
          paymentHistory: (sub.paymentHistory || []).map((p: any) => ({
            date: p.date ? new Date(p.date) : new Date(),
            amount: p.amount || 0,
            note: p.note || "",
            validUntil: p.validUntil ? new Date(p.validUntil) : undefined,
          })),
          isTrial: sub.isTrial || false,
          isPremium: sub.isPremium || false,
          isGracePeriod: sub.isGracePeriod || false,
          daysRemaining: sub.daysRemaining || 0,
          daysUntilExpiry: sub.daysUntilExpiry || 0,
          daysInGrace: sub.daysInGrace || 0,
          paymentPendingVerification: sub.paymentPendingVerification || false,
          paymentRequestedAt: sub.paymentRequestedAt ? new Date(sub.paymentRequestedAt) : null,
          paymentRequestedAmount: sub.paymentRequestedAmount || 0,
          paymentRequestedMonths: sub.paymentRequestedMonths || 0,
          paymentReferenceNumber: sub.paymentReferenceNumber || null,
        };
      });

      setUsers(usersList);
      setSubscriptions(subscriptionsMap);
      setLoading(false);
      
      if (usersList.length === 0) {
        setMessage({ type: "error", text: "Nema korisnika u Firebase Auth" });
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

  // Postavi korisnika kao vlasnika (isOwner = true)
  const setUserAsOwner = async (userEmail: string) => {
    try {
      setSaving(true);
      setMessage(null);
      
      // Pronađi korisnika po emailu
      const usersCollection = collection(db, "users");
      const usersSnapshot = await getDocs(usersCollection);
      
      let foundUser = null;
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        if (userData.email === userEmail) {
          foundUser = { id: userDoc.id, ...userData };
          break;
        }
      }
      
      if (!foundUser) {
        setMessage({ type: "error", text: `Korisnik sa emailom ${userEmail} nije pronađen` });
        return;
      }
      
      // Ažuriraj isOwner na true
      const userDocRef = doc(db, "users", foundUser.id);
      await updateDoc(userDocRef, {
        isOwner: true,
      });
      
      // Ažuriraj sve device dokumente za ovog korisnika da imaju role "vlasnik"
      const devicesCollection = collection(db, "devices");
      const devicesSnapshot = await getDocs(devicesCollection);
      
      for (const deviceDoc of devicesSnapshot.docs) {
        const deviceData = deviceDoc.data();
        if (deviceData.userId === foundUser.id) {
          const deviceRef = doc(db, "devices", deviceDoc.id);
          await updateDoc(deviceRef, {
            role: "vlasnik",
            status: "approved",
            permissions: {
              dashboard: true,
              obracun: true,
              arhiva: true,
              cjenovnik: true,
              profit: true,
              profile: true,
              admin: false,
            },
          });
        }
      }
      
      await loadUsers();
      setMessage({ type: "success", text: `Korisnik ${userEmail} je postavljen kao vlasnik` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Greška pri postavljanju korisnika kao vlasnika:", error);
      setMessage({ type: "error", text: "Greška pri postavljanju korisnika kao vlasnika" });
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
  // Funkcija za trajno brisanje korisnika
  const deleteUser = async (userId: string) => {
    if (!selectedUserDetails) return;
    
    // Potvrda prije brisanja
    const confirmed = window.confirm(
      `Jeste li SIGURNI da želite TRAJNO obrisati korisnika?\n\n` +
      `Email: ${selectedUserDetails.email || "N/A"}\n` +
      `App Name: ${selectedUserDetails.appName}\n\n` +
      `Ova akcija je NEPOVRATNA i obrisat će:\n` +
      `- Sve obračune korisnika\n` +
      `- Svu pretplatu i historiju uplata\n` +
      `- Sve cache podatke\n` +
      `- Sve draft obračune\n` +
      `- Sve uređaje korisnika\n` +
      `- Svi podaci korisnika\n\n` +
      `Ova akcija se NE MOŽE poništiti!`
    );
    
    if (!confirmed) return;
    
    // Dodatna potvrda
    const doubleConfirmed = window.confirm(
      `POSLEDNJA POTVRDA!\n\n` +
      `Jeste li 100% sigurni da želite obrisati korisnika "${selectedUserDetails.appName}"?\n\n` +
      `Ova akcija je TRAJNA i NEPOVRATNA!`
    );
    
    if (!doubleConfirmed) return;
    
    setSaving(true);
    try {
      // 1. Obriši sve obračune
      const obracuniRef = collection(db, "users", userId, "obracuni");
      const obracuniSnapshot = await getDocs(obracuniRef);
      for (const docSnapshot of obracuniSnapshot.docs) {
        await deleteDoc(docSnapshot.ref);
      }
      
      // 2. Obriši pretplatu
      const subscriptionRef = collection(db, "users", userId, "subscription");
      const subscriptionSnapshot = await getDocs(subscriptionRef);
      for (const docSnapshot of subscriptionSnapshot.docs) {
        await deleteDoc(docSnapshot.ref);
      }
      
      // 3. Obriši ulaz cache
      const ulazCacheRef = collection(db, "users", userId, "ulazCache");
      const ulazCacheSnapshot = await getDocs(ulazCacheRef);
      for (const docSnapshot of ulazCacheSnapshot.docs) {
        await deleteDoc(docSnapshot.ref);
      }
      
      // 4. Obriši cache
      const cacheRef = collection(db, "users", userId, "cache");
      const cacheSnapshot = await getDocs(cacheRef);
      for (const docSnapshot of cacheSnapshot.docs) {
        await deleteDoc(docSnapshot.ref);
      }
      
      // 5. Obriši draft obračune
      const draftObracuniRef = collection(db, "users", userId, "draftObracuni");
      const draftObracuniSnapshot = await getDocs(draftObracuniRef);
      for (const docSnapshot of draftObracuniSnapshot.docs) {
        await deleteDoc(docSnapshot.ref);
      }
      
      // 6. Obriši uređaje korisnika
      const devicesRef = collection(db, "devices");
      const devicesSnapshot = await getDocs(devicesRef);
      for (const docSnapshot of devicesSnapshot.docs) {
        const deviceData = docSnapshot.data();
        if (deviceData.userId === userId) {
          await deleteDoc(docSnapshot.ref);
        }
      }
      
      // 7. Obriši glavni dokument korisnika
      const userRef = doc(db, "users", userId);
      await deleteDoc(userRef);
      
      // 8. Ažuriraj lokalni state
      setUsers((prevUsers) => prevUsers.filter((user) => user.id !== userId));
      setSubscriptions((prevSubs) => {
        const newSubs = { ...prevSubs };
        delete newSubs[userId];
        return newSubs;
      });
      
      // 9. Zatvori modal
      setShowDetailsModal(false);
      setSelectedUserDetails(null);
      
      setMessage({ type: "success", text: "Korisnik je uspješno obrisan" });
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      console.error("Greška pri brisanju korisnika:", error);
      setMessage({ 
        type: "error", 
        text: `Greška pri brisanju korisnika: ${error?.message || "Nepoznata greška"}` 
      });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setSaving(false);
    }
  };

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
      // Koristi dropdown vrijednosti za custom date range
      startDate = new Date(customFromYear, customFromMonth - 1, customFromDay);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(customToYear, customToMonth - 1, customToDay);
      endDate.setHours(23, 59, 59, 999);
    } else if (revenueFilter === "dnevni") {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30); // Zadnjih 30 dana
      startDate.setHours(0, 0, 0, 0);
    } else if (revenueFilter === "tjedni") {
      // Od trenutnog datuma unazad 7 dana
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    } else if (revenueFilter === "mjesečni") {
      // Od trenutnog datuma unazad do početka mjeseca
      startDate = new Date(now);
      startDate.setDate(1); // Prvi dan trenutnog mjeseca
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    } else if (revenueFilter === "odaberiMjesec") {
      if (!selectedMonth || !selectedYear) return [];
      startDate = new Date(selectedYear, selectedMonth - 1, 1); // Prvi dan odabranog mjeseca
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999); // Posljednji dan odabranog mjeseca
    } else if (revenueFilter === "tromjesečni") {
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 24); // Zadnjih 8 kvartala (2 godine)
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 12);
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
      
      if (revenueFilter === "dnevni" || revenueFilter === "prilagođeno" || revenueFilter === "odaberiMjesec") {
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
      } else if (revenueFilter === "mjesečni") {
        // Mjesečni
        const monthNames = ["januar", "februar", "mart", "april", "maj", "juni", "juli", "august", "septembar", "oktobar", "novembar", "decembar"];
        const month = monthNames[date.getMonth()];
        const year = date.getFullYear();
        key = `${month} ${year}`;
        sortKey = `${year}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      } else if (revenueFilter === "tromjesečni") {
        // Tromjesečni (kvartali)
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        const year = date.getFullYear();
        key = `Q${quarter} ${year}`;
        sortKey = `${year}-Q${quarter}`;
      } else {
        // Default: mjesečni
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
  }, [allPayments, revenueFilter, customFromDay, customFromMonth, customFromYear, customToDay, customToMonth, customToYear, selectedMonth, selectedYear]);

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

  // Zatvori dropdown kada se klikne van njega
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-dropdown-container]')) {
        setMonthDropdownOpen(false);
        setYearDropdownOpen(false);
        setCustomFromDayDropdownOpen(false);
        setCustomFromMonthDropdownOpen(false);
        setCustomFromYearDropdownOpen(false);
        setCustomToDayDropdownOpen(false);
        setCustomToMonthDropdownOpen(false);
        setCustomToYearDropdownOpen(false);
      }
    };

    if (monthDropdownOpen || yearDropdownOpen || 
        customFromDayDropdownOpen || customFromMonthDropdownOpen || customFromYearDropdownOpen ||
        customToDayDropdownOpen || customToMonthDropdownOpen || customToYearDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [monthDropdownOpen, yearDropdownOpen, 
      customFromDayDropdownOpen, customFromMonthDropdownOpen, customFromYearDropdownOpen,
      customToDayDropdownOpen, customToMonthDropdownOpen, customToYearDropdownOpen]);

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
        <div style={{ marginTop: "12px", padding: "12px 16px", background: "#eff6ff", borderRadius: "8px", border: "1px solid #bfdbfe", display: "inline-block" }}>
          <span style={{ fontSize: "16px", fontWeight: 600, color: "#1e40af" }}>
            📊 Ukupno prijavljenih korisnika: <strong>{users.length}</strong>
            {searchTerm && (
              <span style={{ fontSize: "14px", fontWeight: 400, color: "#3b82f6", marginLeft: "8px" }}>
                (Filtrirano: {filteredUsers.length})
              </span>
            )}
          </span>
        </div>
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
                onClick={() => setRevenueFilter("tromjesečni")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor: revenueFilter === "tromjesečni" ? "#3b82f6" : "#f3f4f6",
                  color: revenueFilter === "tromjesečni" ? "#fff" : "#374151",
                  transition: "all 0.2s",
                }}
              >
                Tromjesečni
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
              <button
                onClick={() => setRevenueFilter("odaberiMjesec")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor: revenueFilter === "odaberiMjesec" ? "#3b82f6" : "#f3f4f6",
                  color: revenueFilter === "odaberiMjesec" ? "#fff" : "#374151",
                  transition: "all 0.2s",
                }}
              >
                Odaberi Mjesec
              </button>
            </div>
            {revenueFilter === "prilagođeno" && (
              <div style={{ display: "flex", gap: "16px", alignItems: "flex-end", flexWrap: "wrap" }}>
                {/* Od datuma */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>Od datuma:</label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                    {/* Dan */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative" }} data-dropdown-container>
                      <label style={{ fontSize: "11px", fontWeight: 500, color: "#6b7280" }}>Dan:</label>
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomFromDayDropdownOpen(!customFromDayDropdownOpen);
                            setCustomFromMonthDropdownOpen(false);
                            setCustomFromYearDropdownOpen(false);
                            setCustomToDayDropdownOpen(false);
                            setCustomToMonthDropdownOpen(false);
                            setCustomToYearDropdownOpen(false);
                          }}
                          style={{
                            padding: "10px 32px 10px 12px",
                            border: "1px solid #d1d5db",
                            borderRadius: "8px",
                            fontSize: "14px",
                            minWidth: "70px",
                            backgroundColor: "#fff",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            boxShadow: customFromDayDropdownOpen ? "0 4px 12px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
                            transition: "all 0.2s ease",
                            fontWeight: 500,
                            color: "#1f2937",
                          }}
                        >
                          <span>{customFromDay}</span>
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 12 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            style={{
                              transform: customFromDayDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 0.2s ease",
                              position: "absolute",
                              right: "8px",
                            }}
                          >
                            <path d="M6 9L1 4H11L6 9Z" fill="#6b7280" />
                          </svg>
                        </button>
                        {customFromDayDropdownOpen && (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              right: 0,
                              marginTop: "4px",
                              backgroundColor: "#fff",
                              border: "1px solid #e5e7eb",
                              borderRadius: "8px",
                              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)",
                              zIndex: 1000,
                              maxHeight: "200px",
                              overflowY: "auto",
                              animation: "slideDown 0.2s ease-out",
                            }}
                          >
                            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                              <button
                                key={day}
                                type="button"
                                onClick={() => {
                                  setCustomFromDay(day);
                                  setCustomFromDayDropdownOpen(false);
                                }}
                                style={{
                                  width: "100%",
                                  padding: "8px 12px",
                                  textAlign: "left",
                                  border: "none",
                                  backgroundColor: customFromDay === day ? "#eff6ff" : "#fff",
                                  color: customFromDay === day ? "#2563eb" : "#1f2937",
                                  fontSize: "14px",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                  fontWeight: customFromDay === day ? 600 : 400,
                                }}
                                onMouseEnter={(e) => {
                                  if (customFromDay !== day) {
                                    e.currentTarget.style.backgroundColor = "#f9fafb";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (customFromDay !== day) {
                                    e.currentTarget.style.backgroundColor = "#fff";
                                  }
                                }}
                              >
                                {day}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Mjesec */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative" }} data-dropdown-container>
                      <label style={{ fontSize: "11px", fontWeight: 500, color: "#6b7280" }}>Mjesec:</label>
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomFromMonthDropdownOpen(!customFromMonthDropdownOpen);
                            setCustomFromDayDropdownOpen(false);
                            setCustomFromYearDropdownOpen(false);
                            setCustomToDayDropdownOpen(false);
                            setCustomToMonthDropdownOpen(false);
                            setCustomToYearDropdownOpen(false);
                          }}
                          style={{
                            padding: "10px 32px 10px 12px",
                            border: "1px solid #d1d5db",
                            borderRadius: "8px",
                            fontSize: "14px",
                            minWidth: "120px",
                            backgroundColor: "#fff",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            boxShadow: customFromMonthDropdownOpen ? "0 4px 12px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
                            transition: "all 0.2s ease",
                            fontWeight: 500,
                            color: "#1f2937",
                          }}
                        >
                          <span>{["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"][customFromMonth - 1]}</span>
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 12 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            style={{
                              transform: customFromMonthDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 0.2s ease",
                              position: "absolute",
                              right: "8px",
                            }}
                          >
                            <path d="M6 9L1 4H11L6 9Z" fill="#6b7280" />
                          </svg>
                        </button>
                        {customFromMonthDropdownOpen && (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              right: 0,
                              marginTop: "4px",
                              backgroundColor: "#fff",
                              border: "1px solid #e5e7eb",
                              borderRadius: "8px",
                              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)",
                              zIndex: 1000,
                              maxHeight: "240px",
                              overflowY: "auto",
                              animation: "slideDown 0.2s ease-out",
                            }}
                          >
                            {[
                              "Januar", "Februar", "Mart", "April", "Maj", "Juni",
                              "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"
                            ].map((month, index) => (
                              <button
                                key={index + 1}
                                type="button"
                                onClick={() => {
                                  setCustomFromMonth(index + 1);
                                  setCustomFromMonthDropdownOpen(false);
                                }}
                                style={{
                                  width: "100%",
                                  padding: "10px 14px",
                                  textAlign: "left",
                                  border: "none",
                                  backgroundColor: customFromMonth === index + 1 ? "#eff6ff" : "#fff",
                                  color: customFromMonth === index + 1 ? "#2563eb" : "#1f2937",
                                  fontSize: "14px",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                  fontWeight: customFromMonth === index + 1 ? 600 : 400,
                                }}
                                onMouseEnter={(e) => {
                                  if (customFromMonth !== index + 1) {
                                    e.currentTarget.style.backgroundColor = "#f9fafb";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (customFromMonth !== index + 1) {
                                    e.currentTarget.style.backgroundColor = "#fff";
                                  }
                                }}
                              >
                                {month}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Godina */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative" }} data-dropdown-container>
                      <label style={{ fontSize: "11px", fontWeight: 500, color: "#6b7280" }}>Godina:</label>
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomFromYearDropdownOpen(!customFromYearDropdownOpen);
                            setCustomFromDayDropdownOpen(false);
                            setCustomFromMonthDropdownOpen(false);
                            setCustomToDayDropdownOpen(false);
                            setCustomToMonthDropdownOpen(false);
                            setCustomToYearDropdownOpen(false);
                          }}
                          style={{
                            padding: "10px 32px 10px 12px",
                            border: "1px solid #d1d5db",
                            borderRadius: "8px",
                            fontSize: "14px",
                            minWidth: "100px",
                            backgroundColor: "#fff",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            boxShadow: customFromYearDropdownOpen ? "0 4px 12px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
                            transition: "all 0.2s ease",
                            fontWeight: 500,
                            color: "#1f2937",
                          }}
                        >
                          <span>{customFromYear}</span>
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 12 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            style={{
                              transform: customFromYearDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 0.2s ease",
                              position: "absolute",
                              right: "8px",
                            }}
                          >
                            <path d="M6 9L1 4H11L6 9Z" fill="#6b7280" />
                          </svg>
                        </button>
                        {customFromYearDropdownOpen && (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              right: 0,
                              marginTop: "4px",
                              backgroundColor: "#fff",
                              border: "1px solid #e5e7eb",
                              borderRadius: "8px",
                              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)",
                              zIndex: 1000,
                              maxHeight: "240px",
                              overflowY: "auto",
                              animation: "slideDown 0.2s ease-out",
                            }}
                          >
                            {Array.from({ length: 10 }, (_, i) => {
                              const year = new Date().getFullYear() - 5 + i;
                              return (
                                <button
                                  key={year}
                                  type="button"
                                  onClick={() => {
                                    setCustomFromYear(year);
                                    setCustomFromYearDropdownOpen(false);
                                  }}
                                  style={{
                                    width: "100%",
                                    padding: "10px 14px",
                                    textAlign: "left",
                                    border: "none",
                                    backgroundColor: customFromYear === year ? "#eff6ff" : "#fff",
                                    color: customFromYear === year ? "#2563eb" : "#1f2937",
                                    fontSize: "14px",
                                    cursor: "pointer",
                                    transition: "all 0.15s ease",
                                    fontWeight: customFromYear === year ? 600 : 400,
                                  }}
                                  onMouseEnter={(e) => {
                                    if (customFromYear !== year) {
                                      e.currentTarget.style.backgroundColor = "#f9fafb";
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (customFromYear !== year) {
                                      e.currentTarget.style.backgroundColor = "#fff";
                                    }
                                  }}
                                >
                                  {year}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Do datuma */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>Do datuma:</label>
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                    {/* Dan */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative" }} data-dropdown-container>
                      <label style={{ fontSize: "11px", fontWeight: 500, color: "#6b7280" }}>Dan:</label>
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomToDayDropdownOpen(!customToDayDropdownOpen);
                            setCustomFromDayDropdownOpen(false);
                            setCustomFromMonthDropdownOpen(false);
                            setCustomFromYearDropdownOpen(false);
                            setCustomToMonthDropdownOpen(false);
                            setCustomToYearDropdownOpen(false);
                          }}
                          style={{
                            padding: "10px 32px 10px 12px",
                            border: "1px solid #d1d5db",
                            borderRadius: "8px",
                            fontSize: "14px",
                            minWidth: "70px",
                            backgroundColor: "#fff",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            boxShadow: customToDayDropdownOpen ? "0 4px 12px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
                            transition: "all 0.2s ease",
                            fontWeight: 500,
                            color: "#1f2937",
                          }}
                        >
                          <span>{customToDay}</span>
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 12 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            style={{
                              transform: customToDayDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 0.2s ease",
                              position: "absolute",
                              right: "8px",
                            }}
                          >
                            <path d="M6 9L1 4H11L6 9Z" fill="#6b7280" />
                          </svg>
                        </button>
                        {customToDayDropdownOpen && (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              right: 0,
                              marginTop: "4px",
                              backgroundColor: "#fff",
                              border: "1px solid #e5e7eb",
                              borderRadius: "8px",
                              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)",
                              zIndex: 1000,
                              maxHeight: "200px",
                              overflowY: "auto",
                              animation: "slideDown 0.2s ease-out",
                            }}
                          >
                            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                              <button
                                key={day}
                                type="button"
                                onClick={() => {
                                  setCustomToDay(day);
                                  setCustomToDayDropdownOpen(false);
                                }}
                                style={{
                                  width: "100%",
                                  padding: "8px 12px",
                                  textAlign: "left",
                                  border: "none",
                                  backgroundColor: customToDay === day ? "#eff6ff" : "#fff",
                                  color: customToDay === day ? "#2563eb" : "#1f2937",
                                  fontSize: "14px",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                  fontWeight: customToDay === day ? 600 : 400,
                                }}
                                onMouseEnter={(e) => {
                                  if (customToDay !== day) {
                                    e.currentTarget.style.backgroundColor = "#f9fafb";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (customToDay !== day) {
                                    e.currentTarget.style.backgroundColor = "#fff";
                                  }
                                }}
                              >
                                {day}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Mjesec */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative" }} data-dropdown-container>
                      <label style={{ fontSize: "11px", fontWeight: 500, color: "#6b7280" }}>Mjesec:</label>
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomToMonthDropdownOpen(!customToMonthDropdownOpen);
                            setCustomFromDayDropdownOpen(false);
                            setCustomFromMonthDropdownOpen(false);
                            setCustomFromYearDropdownOpen(false);
                            setCustomToDayDropdownOpen(false);
                            setCustomToYearDropdownOpen(false);
                          }}
                          style={{
                            padding: "10px 32px 10px 12px",
                            border: "1px solid #d1d5db",
                            borderRadius: "8px",
                            fontSize: "14px",
                            minWidth: "120px",
                            backgroundColor: "#fff",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            boxShadow: customToMonthDropdownOpen ? "0 4px 12px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
                            transition: "all 0.2s ease",
                            fontWeight: 500,
                            color: "#1f2937",
                          }}
                        >
                          <span>{["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"][customToMonth - 1]}</span>
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 12 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            style={{
                              transform: customToMonthDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 0.2s ease",
                              position: "absolute",
                              right: "8px",
                            }}
                          >
                            <path d="M6 9L1 4H11L6 9Z" fill="#6b7280" />
                          </svg>
                        </button>
                        {customToMonthDropdownOpen && (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              right: 0,
                              marginTop: "4px",
                              backgroundColor: "#fff",
                              border: "1px solid #e5e7eb",
                              borderRadius: "8px",
                              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)",
                              zIndex: 1000,
                              maxHeight: "240px",
                              overflowY: "auto",
                              animation: "slideDown 0.2s ease-out",
                            }}
                          >
                            {[
                              "Januar", "Februar", "Mart", "April", "Maj", "Juni",
                              "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"
                            ].map((month, index) => (
                              <button
                                key={index + 1}
                                type="button"
                                onClick={() => {
                                  setCustomToMonth(index + 1);
                                  setCustomToMonthDropdownOpen(false);
                                }}
                                style={{
                                  width: "100%",
                                  padding: "10px 14px",
                                  textAlign: "left",
                                  border: "none",
                                  backgroundColor: customToMonth === index + 1 ? "#eff6ff" : "#fff",
                                  color: customToMonth === index + 1 ? "#2563eb" : "#1f2937",
                                  fontSize: "14px",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                  fontWeight: customToMonth === index + 1 ? 600 : 400,
                                }}
                                onMouseEnter={(e) => {
                                  if (customToMonth !== index + 1) {
                                    e.currentTarget.style.backgroundColor = "#f9fafb";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (customToMonth !== index + 1) {
                                    e.currentTarget.style.backgroundColor = "#fff";
                                  }
                                }}
                              >
                                {month}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Godina */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative" }} data-dropdown-container>
                      <label style={{ fontSize: "11px", fontWeight: 500, color: "#6b7280" }}>Godina:</label>
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomToYearDropdownOpen(!customToYearDropdownOpen);
                            setCustomFromDayDropdownOpen(false);
                            setCustomFromMonthDropdownOpen(false);
                            setCustomFromYearDropdownOpen(false);
                            setCustomToDayDropdownOpen(false);
                            setCustomToMonthDropdownOpen(false);
                          }}
                          style={{
                            padding: "10px 32px 10px 12px",
                            border: "1px solid #d1d5db",
                            borderRadius: "8px",
                            fontSize: "14px",
                            minWidth: "100px",
                            backgroundColor: "#fff",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            boxShadow: customToYearDropdownOpen ? "0 4px 12px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
                            transition: "all 0.2s ease",
                            fontWeight: 500,
                            color: "#1f2937",
                          }}
                        >
                          <span>{customToYear}</span>
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 12 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            style={{
                              transform: customToYearDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 0.2s ease",
                              position: "absolute",
                              right: "8px",
                            }}
                          >
                            <path d="M6 9L1 4H11L6 9Z" fill="#6b7280" />
                          </svg>
                        </button>
                        {customToYearDropdownOpen && (
                          <div
                            style={{
                              position: "absolute",
                              top: "100%",
                              left: 0,
                              right: 0,
                              marginTop: "4px",
                              backgroundColor: "#fff",
                              border: "1px solid #e5e7eb",
                              borderRadius: "8px",
                              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)",
                              zIndex: 1000,
                              maxHeight: "240px",
                              overflowY: "auto",
                              animation: "slideDown 0.2s ease-out",
                            }}
                          >
                            {Array.from({ length: 10 }, (_, i) => {
                              const year = new Date().getFullYear() - 5 + i;
                              return (
                                <button
                                  key={year}
                                  type="button"
                                  onClick={() => {
                                    setCustomToYear(year);
                                    setCustomToYearDropdownOpen(false);
                                  }}
                                  style={{
                                    width: "100%",
                                    padding: "10px 14px",
                                    textAlign: "left",
                                    border: "none",
                                    backgroundColor: customToYear === year ? "#eff6ff" : "#fff",
                                    color: customToYear === year ? "#2563eb" : "#1f2937",
                                    fontSize: "14px",
                                    cursor: "pointer",
                                    transition: "all 0.15s ease",
                                    fontWeight: customToYear === year ? 600 : 400,
                                  }}
                                  onMouseEnter={(e) => {
                                    if (customToYear !== year) {
                                      e.currentTarget.style.backgroundColor = "#f9fafb";
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (customToYear !== year) {
                                      e.currentTarget.style.backgroundColor = "#fff";
                                    }
                                  }}
                                >
                                  {year}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {revenueFilter === "odaberiMjesec" && (
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
                {/* Custom Dropdown za Mjesec */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative" }} data-dropdown-container>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>Mjesec:</label>
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setMonthDropdownOpen(!monthDropdownOpen);
                        setYearDropdownOpen(false);
                      }}
                      style={{
                        padding: "10px 40px 10px 14px",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        fontSize: "14px",
                        minWidth: "160px",
                        backgroundColor: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        boxShadow: monthDropdownOpen ? "0 4px 12px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
                        transition: "all 0.2s ease",
                        fontWeight: 500,
                        color: "#1f2937",
                      }}
                      onMouseEnter={(e) => {
                        if (!monthDropdownOpen) {
                          e.currentTarget.style.borderColor = "#9ca3af";
                          e.currentTarget.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.1)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!monthDropdownOpen) {
                          e.currentTarget.style.borderColor = "#d1d5db";
                          e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.1)";
                        }
                      }}
                    >
                      <span>{["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"][selectedMonth - 1]}</span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{
                          transform: monthDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                          position: "absolute",
                          right: "14px",
                        }}
                      >
                        <path d="M6 9L1 4H11L6 9Z" fill="#6b7280" />
                      </svg>
                    </button>
                    {monthDropdownOpen && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          marginTop: "4px",
                          backgroundColor: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)",
                          zIndex: 1000,
                          maxHeight: "240px",
                          overflowY: "auto",
                          animation: "slideDown 0.2s ease-out",
                        }}
                      >
                        {[
                          "Januar", "Februar", "Mart", "April", "Maj", "Juni",
                          "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"
                        ].map((month, index) => (
                          <button
                            key={index + 1}
                            type="button"
                            onClick={() => {
                              setSelectedMonth(index + 1);
                              setMonthDropdownOpen(false);
                            }}
                            style={{
                              width: "100%",
                              padding: "10px 14px",
                              textAlign: "left",
                              border: "none",
                              backgroundColor: selectedMonth === index + 1 ? "#eff6ff" : "#fff",
                              color: selectedMonth === index + 1 ? "#2563eb" : "#1f2937",
                              fontSize: "14px",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              fontWeight: selectedMonth === index + 1 ? 600 : 400,
                            }}
                            onMouseEnter={(e) => {
                              if (selectedMonth !== index + 1) {
                                e.currentTarget.style.backgroundColor = "#f9fafb";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedMonth !== index + 1) {
                                e.currentTarget.style.backgroundColor = "#fff";
                              }
                            }}
                          >
                            {month}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Custom Dropdown za Godinu */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative" }} data-dropdown-container>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>Godina:</label>
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setYearDropdownOpen(!yearDropdownOpen);
                        setMonthDropdownOpen(false);
                      }}
                      style={{
                        padding: "10px 40px 10px 14px",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        fontSize: "14px",
                        minWidth: "130px",
                        backgroundColor: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        boxShadow: yearDropdownOpen ? "0 4px 12px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
                        transition: "all 0.2s ease",
                        fontWeight: 500,
                        color: "#1f2937",
                      }}
                      onMouseEnter={(e) => {
                        if (!yearDropdownOpen) {
                          e.currentTarget.style.borderColor = "#9ca3af";
                          e.currentTarget.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.1)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!yearDropdownOpen) {
                          e.currentTarget.style.borderColor = "#d1d5db";
                          e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.1)";
                        }
                      }}
                    >
                      <span>{selectedYear}</span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{
                          transform: yearDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                          position: "absolute",
                          right: "14px",
                        }}
                      >
                        <path d="M6 9L1 4H11L6 9Z" fill="#6b7280" />
                      </svg>
                    </button>
                    {yearDropdownOpen && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          right: 0,
                          marginTop: "4px",
                          backgroundColor: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1)",
                          zIndex: 1000,
                          maxHeight: "240px",
                          overflowY: "auto",
                          animation: "slideDown 0.2s ease-out",
                        }}
                      >
                        {Array.from({ length: 10 }, (_, i) => {
                          const year = new Date().getFullYear() - 5 + i;
                          return (
                            <button
                              key={year}
                              type="button"
                              onClick={() => {
                                setSelectedYear(year);
                                setYearDropdownOpen(false);
                              }}
                              style={{
                                width: "100%",
                                padding: "10px 14px",
                                textAlign: "left",
                                border: "none",
                                backgroundColor: selectedYear === year ? "#eff6ff" : "#fff",
                                color: selectedYear === year ? "#2563eb" : "#1f2937",
                                fontSize: "14px",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                                fontWeight: selectedYear === year ? 600 : 400,
                              }}
                              onMouseEnter={(e) => {
                                if (selectedYear !== year) {
                                  e.currentTarget.style.backgroundColor = "#f9fafb";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (selectedYear !== year) {
                                  e.currentTarget.style.backgroundColor = "#fff";
                                }
                              }}
                            >
                              {year}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
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
              @keyframes slideDown {
                from {
                  opacity: 0;
                  transform: translateY(-8px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
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
                          
                          // Učitaj dodatne podatke korisnika (ime, telefon i lokacija) direktno iz Firestore
                          try {
                            const userDoc = await getDoc(doc(db, "users", user.id));
                            if (userDoc.exists()) {
                              const userData = userDoc.data();
                              setImeKorisnika(userData.imeKorisnika || "");
                              setBrojTelefona(userData.brojTelefona || "");
                              setLokacija(userData.lokacija || "");
                            } else {
                              // Ako dokument ne postoji, koristi podatke iz user objekta
                              setImeKorisnika(user.imeKorisnika || "");
                              setBrojTelefona(user.brojTelefona || "");
                              setLokacija(user.lokacija || "");
                            }
                          } catch (error) {
                            console.error("Greška pri učitavanju podataka korisnika:", error);
                            // Fallback na podatke iz user objekta
                            setImeKorisnika(user.imeKorisnika || "");
                            setBrojTelefona(user.brojTelefona || "");
                            setLokacija(user.lokacija || "");
                          }
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
                <th style={{ padding: "12px", textAlign: "center", fontSize: "12px", fontWeight: 600, color: "#6b7280", width: "60px" }}>
                  RB
                </th>
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
              {filteredUsers.map((user, index) => {
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
                    <td style={{ padding: "12px", fontSize: "14px", color: "#6b7280", textAlign: "center", fontWeight: 600 }}>
                      {index + 1}
                    </td>
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
                            {selectedUserDetails?.imeKorisnika || imeKorisnika || "Nije uneseno"}
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
                            {selectedUserDetails?.brojTelefona || brojTelefona || "Nije uneseno"}
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
                            {selectedUserDetails?.lokacija || lokacija || "Nije uneseno"}
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
                              
                              // Provjeri da li dokument postoji
                              const existingDoc = await getDoc(userRef);
                              console.log("Dokument postoji:", existingDoc.exists());
                              console.log("Trenutni podaci:", existingDoc.data());
                              
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
                              
                              console.log("Podaci za spremanje:", updateData);
                              
                              // Koristi setDoc sa merge: true umjesto updateDoc (sigurniji pristup)
                              await setDoc(userRef, updateData, { merge: true });
                              console.log("setDoc uspješno izvršen");
                              
                              // Sačekaj malo da se podaci propagiraju
                              await new Promise(resolve => setTimeout(resolve, 500));
                              
                              // Provjeri da li su podaci stvarno spremljeni
                              const savedDoc = await getDoc(userRef);
                              if (savedDoc.exists()) {
                                const savedData = savedDoc.data();
                                console.log("Podaci nakon spremanja:", savedData);
                                
                                // Provjeri da li su podaci stvarno spremljeni
                                const imeSaved = savedData.imeKorisnika === (imeKorisnika.trim() || null);
                                const telefonSaved = savedData.brojTelefona === (brojTelefona.trim() || null);
                                const lokacijaSaved = savedData.lokacija === (lokacija.trim() || null);
                                
                                console.log("Provjera spremanja:", {
                                  imeSaved,
                                  telefonSaved,
                                  lokacijaSaved,
                                  imeKorisnika: savedData.imeKorisnika,
                                  brojTelefona: savedData.brojTelefona,
                                  lokacija: savedData.lokacija
                                });
                                
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
                                
                                setEditingUserInfo(false);
                                setMessage({ type: "success", text: "Podaci uspješno sačuvani" });
                                setTimeout(() => setMessage(null), 3000);
                              } else {
                                throw new Error("Dokument ne postoji nakon spremanja");
                              }
                            } catch (error: any) {
                              console.error("Greška pri spremanju podataka:", error);
                              console.error("Error code:", error?.code);
                              console.error("Error message:", error?.message);
                              setMessage({ 
                                type: "error", 
                                text: `Greška pri spremanju podataka: ${error?.message || error?.code || "Nepoznata greška"}` 
                              });
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
                            // Osiguraj da su state varijable ažurirane sa podacima trenutnog korisnika prije nego što uđemo u edit mode
                            if (selectedUserDetails) {
                              setImeKorisnika(selectedUserDetails.imeKorisnika || "");
                              setBrojTelefona(selectedUserDetails.brojTelefona || "");
                              setLokacija(selectedUserDetails.lokacija || "");
                            }
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

                  {/* Opasna zona - Brisanje korisnika */}
                  <div style={{ marginTop: "24px", marginBottom: "24px", padding: "16px", background: "#fef2f2", borderRadius: "8px", border: "1px solid #fecaca" }}>
                    <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#dc2626", marginBottom: "12px" }}>
                      ⚠️ Opasna Zona
                    </h3>
                    <p style={{ fontSize: "12px", color: "#991b1b", marginBottom: "12px" }}>
                      Trajno brisanje korisnika će obrisati sve podatke korisnika. Ova akcija je NEPOVRATNA!
                    </p>
                    <button
                      onClick={() => deleteUser(selectedUserDetails.id)}
                      disabled={saving}
                      style={{
                        padding: "10px 20px",
                        borderRadius: "6px",
                        border: "none",
                        fontSize: "14px",
                        fontWeight: 600,
                        cursor: saving ? "not-allowed" : "pointer",
                        backgroundColor: "#dc2626",
                        color: "#fff",
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      {saving ? "Brisanje..." : "🗑️ Trajno Obriši Korisnika"}
                    </button>
                  </div>

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

