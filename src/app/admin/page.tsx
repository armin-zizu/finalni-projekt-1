"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  getAuthToken, 
  adminAdjustPremiumDays, 
  adminAdjustTrialDays, 
  adminChangeSubscriptionStatus,
  adminToggleSubscription,
  adminAddPayment,
  adminSetUserAsOwner,
  adminDeleteUser
} from "../../lib/api";

// Admin email
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "gitara.zizu@gmail.com";
import { useRouter } from "next/navigation";
import { FaSearch, FaCheck, FaTimes, FaPlus, FaSpinner, FaUser, FaEnvelope, FaCalendar, FaDollarSign } from "react-icons/fa";
import dynamic from "next/dynamic";

const AdminChat = dynamic(() => import("../components/AdminChat"), { ssr: false });
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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
  const [revenueFilter, setRevenueFilter] = useState<"currentWeek" | "previousWeek" | "monthly" | "quarterly" | "selectMonth" | "custom">("currentWeek");
  const [customFrom, setCustomFrom] = useState<string>(
    new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split("T")[0]
  );
  const [customTo, setCustomTo] = useState<string>(new Date().toISOString().split("T")[0]);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [revenueFilterDropdownOpen, setRevenueFilterDropdownOpen] = useState(false);
  const [chartKey, setChartKey] = useState(0);
  const [premiumDaysAdjustment, setPremiumDaysAdjustment] = useState(0);
  const [trialDaysAdjustment, setTrialDaysAdjustment] = useState(0);
  const [newSubscriptionStatus, setNewSubscriptionStatus] = useState<"trial" | "premium" | "grace" | "inactive">("premium");
  const [imeKorisnika, setImeKorisnika] = useState("");
  const [brojTelefona, setBrojTelefona] = useState("");
  const [lokacija, setLokacija] = useState("");
  const [savingUserInfo, setSavingUserInfo] = useState(false);
  const [editingUserInfo, setEditingUserInfo] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const [showDevicesModal, setShowDevicesModal] = useState(false);
  const [userDevices, setUserDevices] = useState<any[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  // Detekcija mobilnog uređaja
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window === 'undefined') return;
      const wasMobile = isMobile;
      const nowMobile = window.innerWidth <= 768;
      setIsMobile(nowMobile);
      // Increment chartKey when switching between mobile/desktop
      if (wasMobile !== nowMobile) {
        setChartKey(prev => prev + 1);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [isMobile]);

  // Postavi korisnika kao vlasnika (isOwner = true) - pomoćna funkcija
  const setUserAsOwnerHelper = async (userEmail: string) => {
    try {
      // Pronađi korisnika po emailu
      const user = users.find(u => u.email === userEmail);
      if (!user) {
        console.warn(`Korisnik sa emailom ${userEmail} nije pronađen`);
        return;
      }
      
      await adminSetUserAsOwner(user.id);
      console.log(`Korisnik ${userEmail} je postavljen kao vlasnik`);
    } catch (error) {
      console.error("Greška pri postavljanju korisnika kao vlasnika:", error);
    }
  };

  // Provjeri da li je korisnik admin
  useEffect(() => {
    const checkAdmin = async () => {
      const token = getAuthToken();
      if (!token) {
        setIsAdmin(false);
        setLoading(false);
        router.push("/login");
        return;
      }

      try {
        // Get current user from API
        const response = await fetch('/api/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          setIsAdmin(false);
          setLoading(false);
          router.push("/login");
          return;
        }

        const user = await response.json();
        const adminEmailLower = ADMIN_EMAIL.toLowerCase().trim();
        const userEmailLower = (user?.email || "").toLowerCase().trim();
        if (!user || userEmailLower !== adminEmailLower) {
          console.log("Admin access denied:", { userEmail: user?.email, adminEmail: ADMIN_EMAIL });
          setIsAdmin(false);
          setLoading(false);
          router.push("/dashboard");
          return;
        }
        
        setIsAdmin(true);
        // Učitaj podatke jednom pri inicijalizaciji
        await loadUsers();
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
        setLoading(false);
        router.push("/login");
      }
    };

    // Check admin status on mount
    checkAdmin();
  }, [router]);
  
  // Automatsko osvježavanje uklonjeno - poruke dolaze preko SSE-a, ostali podaci se učitaju pri refresh-u

  // Ažuriraj state varijable kada se promijeni selectedUserDetails
  useEffect(() => {
    if (selectedUserDetails) {
      // Učitaj podatke iz selectedUserDetails - svi podaci dolaze iz API-ja
      const loadUserInfo = async () => {
        try {
          // Koristi podatke iz selectedUserDetails koji su već učitani iz API-ja
          setImeKorisnika(selectedUserDetails.imeKorisnika || "");
          setBrojTelefona(selectedUserDetails.brojTelefona || "");
          setLokacija(selectedUserDetails.lokacija || "");
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

  // Učitaj sve korisnike sa servera (iz PostgreSQL baze)
  const loadUsers = async () => {
    try {
      setLoading(true);
      setMessage(null);

      // Uzmi token za autentifikaciju
      const token = getAuthToken();
      if (!token) {
        setMessage({ type: "error", text: "Niste prijavljeni" });
        setLoading(false);
        return;
      }
      
      // Pozovi API route koji vraća sve korisnike iz PostgreSQL baze
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
      console.log("Admin - API response:", { 
        status: response.status, 
        hasUsers: !!data.users, 
        usersCount: data.users?.length || 0,
        dataKeys: Object.keys(data)
      });
      
      const usersWithSubscriptions = data.users || [];
      console.log("Admin - Users with subscriptions:", usersWithSubscriptions.length);

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

      console.log("Admin - Processed users list:", usersList.length, "users");
      console.log("Admin - Processed subscriptions:", Object.keys(subscriptionsMap).length, "subscriptions");
      
      setUsers(usersList);
      setSubscriptions(subscriptionsMap);
      setLoading(false);
      
      if (usersList.length === 0) {
        console.warn("Admin - No users found in database");
        // Ne postavljamo error poruku ako nema korisnika, samo logujemo
      } else {
        console.log("Admin - Successfully loaded", usersList.length, "users");
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
      await adminAdjustPremiumDays(userId, days);
      await loadUsers();
      setPremiumDaysAdjustment(0);
      setMessage({ type: "success", text: `Premium dana ${days > 0 ? "dodano" : "oduzeto"}: ${Math.abs(days)} dana` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error("Greška pri ažuriranju premium dana:", error);
      setMessage({ type: "error", text: error.message || "Greška pri ažuriranju premium dana" });
    } finally {
      setSaving(false);
    }
  };

  // Postavi korisnika kao vlasnika (isOwner = true) - migrirano na API
  const setUserAsOwner = async (userEmail: string) => {
    try {
      // Pronađi korisnika po emailu iz trenutne liste korisnika
      const user = users.find(u => u.email === userEmail);
      if (!user) {
        setMessage({ type: "error", text: `Korisnik sa emailom ${userEmail} nije pronađen` });
        return;
      }
      
      setSaving(true);
      setMessage(null);
      
      // Koristi API funkciju za postavljanje korisnika kao vlasnika
      await adminSetUserAsOwner(user.id);
      
      await loadUsers();
      setMessage({ type: "success", text: `Korisnik ${userEmail} je postavljen kao vlasnik` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error("Greška pri postavljanju korisnika kao vlasnika:", error);
      setMessage({ type: "error", text: error.message || "Greška pri postavljanju korisnika kao vlasnika" });
    } finally {
      setSaving(false);
    }
  };

  // Ažuriraj trial dane
  const adjustTrialDays = async (userId: string, days: number) => {
    try {
      setSaving(true);
      await adminAdjustTrialDays(userId, days);
      await loadUsers();
      setTrialDaysAdjustment(0);
      setMessage({ type: "success", text: `Trial dana ${days > 0 ? "dodano" : "oduzeto"}: ${Math.abs(days)} dana` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error("Greška pri ažuriranju trial dana:", error);
      setMessage({ type: "error", text: error.message || "Greška pri ažuriranju trial dana" });
    } finally {
      setSaving(false);
    }
  };

  // Promijeni status pretplate
  const changeSubscriptionStatus = async (userId: string, status: "trial" | "premium" | "grace" | "inactive") => {
    try {
      setSaving(true);
      await adminChangeSubscriptionStatus(userId, status);
      await loadUsers();
      setNewSubscriptionStatus("premium");
      setMessage({ type: "success", text: `Status pretplate promijenjen na: ${status === "trial" ? "Probni period" : status === "premium" ? "Premium" : status === "grace" ? "Grace Period" : "Neaktivna"}` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error("Greška pri promjeni statusa pretplate:", error);
      setMessage({ type: "error", text: error.message || "Greška pri promjeni statusa pretplate" });
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
      await adminDeleteUser(userId);
      
      // Ažuriraj lokalni state
      setUsers((prevUsers) => prevUsers.filter((user) => user.id !== userId));
      setSubscriptions((prevSubs) => {
        const newSubs = { ...prevSubs };
        delete newSubs[userId];
        return newSubs;
      });
      
      // Zatvori modal
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
      const newStatus = !currentStatus;
      await adminToggleSubscription(userId, newStatus);
      await loadUsers();
      setMessage({ type: "success", text: `Pretplata ${newStatus ? "aktivirana" : "deaktivirana"}` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error("Greška pri ažuriranju pretplate:", error);
      setMessage({ type: "error", text: error.message || "Greška pri ažuriranju pretplate" });
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
      const amount = parseFloat(paymentAmount);
      await adminAddPayment(selectedUser.id, amount, paymentMonths, paymentNote);
      await loadUsers();
      setShowPaymentModal(false);
      setPaymentAmount("");
      setPaymentMonths(1);
      setPaymentNote("");
      setActivateOnPayment(true);
      setSelectedUser(null);
      setMessage({ type: "success", text: `Uplata dodana uspješno. Pretplata aktivirana.` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error("Greška pri dodavanju uplate:", error);
      setMessage({ type: "error", text: error.message || "Greška pri dodavanju uplate" });
    } finally {
      setSaving(false);
    }
  };

  // Dohvati uređaje korisnika
  const fetchUserDevices = async (userId: string) => {
    try {
      setLoadingDevices(true);
      const token = getAuthToken();
      const response = await fetch(`/api/users/${userId}/devices`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log("API odgovor - Dohvaćeni uređaji:", data);
      
      // API vraća { devices: [...] } struktura
      let devices = data.devices || data || [];
      
      // Osiguraj da je data niz
      if (!Array.isArray(devices)) {
        devices = [];
      }
      
      console.log("Finalni uređaji za prikaz:", devices);
      setUserDevices(devices);
      setShowDevicesModal(true);
    } catch (error: any) {
      console.error("Greška pri dohvatanju uređaja:", error);
      setUserDevices([]);
      setMessage({ type: "error", text: "Greška pri dohvatanju uređaja" });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setLoadingDevices(false);
    }
  };

  // Odobri uređaj
  const approveDevice = async (userId: string, deviceId: string) => {
    try {
      setSaving(true);
      const token = getAuthToken();
      const response = await fetch(`/api/users/${userId}/devices/${deviceId}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "approved",
          role: "konobar",
          permissions: {
            dashboard: true,
            obracun: true,
            arhiva: true,
            cjenovnik: true,
            profit: true,
            profile: true,
            admin: false,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Osveži listu uređaja
      if (selectedUserDetails) {
        await fetchUserDevices(selectedUserDetails.id);
      }
      setMessage({ type: "success", text: "Uređaj odobren" });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error("Greška pri odobravanju uređaja:", error);
      setMessage({ type: "error", text: "Greška pri odobravanju uređaja" });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  // Zabrani uređaj
  const blockDevice = async (userId: string, deviceId: string) => {
    try {
      setSaving(true);
      const token = getAuthToken();
      const response = await fetch(`/api/users/${userId}/devices/${deviceId}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isBlocked: true,
          status: "blocked",
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Osveži listu uređaja
      if (selectedUserDetails) {
        await fetchUserDevices(selectedUserDetails.id);
      }
      setMessage({ type: "success", text: "Uređaj zabranjen" });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error("Greška pri zabranjivanju uređaja:", error);
      setMessage({ type: "error", text: "Greška pri zabranjivanju uređaja" });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  // Obriši uređaj
  const deleteDevice = async (userId: string, deviceId: string) => {
    try {
      setSaving(true);
      const token = getAuthToken();
      const response = await fetch(`/api/users/${userId}/devices/${deviceId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Osveži listu uređaja
      if (selectedUserDetails) {
        await fetchUserDevices(selectedUserDetails.id);
      }
      setMessage({ type: "success", text: "Uređaj obrisan" });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error("Greška pri brisanju uređaja:", error);
      setMessage({ type: "error", text: "Greška pri brisanju uređaja" });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  // Filtriraj korisnike
  const filteredUsers = useMemo(() => {
    console.log("Admin - Filtering users:", { 
      totalUsers: users.length, 
      searchTerm, 
      users: users.map(u => ({ id: u.id, email: u.email, appName: u.appName }))
    });
    const filtered = users.filter((user) => {
      const search = searchTerm.toLowerCase();
      return (
        user.email?.toLowerCase().includes(search) ||
        user.appName.toLowerCase().includes(search) ||
        user.id.toLowerCase().includes(search)
      );
    });
    console.log("Admin - Filtered users result:", filtered.length, "users");
    return filtered;
  }, [users, searchTerm]);

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
    if (revenueFilter === "custom") {
      const fromTime = new Date(customFrom).getTime();
      const toTime = new Date(customTo).getTime();
      startDate = new Date(fromTime);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(toTime);
      endDate.setHours(23, 59, 59, 999);
    } else if (revenueFilter === "currentWeek") {
      // Trenutna sedmica - od ponedjeljka do nedjelje
      const getMonday = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        date.setDate(date.getDate() + diff);
        date.setHours(0, 0, 0, 0);
        return date;
      };
      startDate = getMonday(now);
      const sunday = new Date(startDate);
      sunday.setDate(startDate.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      endDate = sunday;
    } else if (revenueFilter === "previousWeek") {
      // Prošla sedmica - od ponedjeljka do nedjelje
      const getMonday = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        date.setDate(date.getDate() + diff);
        date.setHours(0, 0, 0, 0);
        return date;
      };
      const lastWeekDate = new Date(now);
      lastWeekDate.setDate(now.getDate() - 7);
      startDate = getMonday(lastWeekDate);
      const sunday = new Date(startDate);
      sunday.setDate(startDate.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      endDate = sunday;
    } else if (revenueFilter === "monthly") {
      // Od trenutnog datuma unazad do početka mjeseca
      startDate = new Date(now);
      startDate.setDate(1); // Prvi dan trenutnog mjeseca
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
    } else if (revenueFilter === "selectMonth") {
      if (!selectedMonth || !selectedYear) return [];
      startDate = new Date(selectedYear, selectedMonth - 1, 1); // Prvi dan odabranog mjeseca
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999); // Posljednji dan odabranog mjeseca
    } else if (revenueFilter === "quarterly") {
      // Tromjesečni - zadnja 3 mjeseca (kvartal)
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(now.getMonth() - 3);
      threeMonthsAgo.setDate(1);
      threeMonthsAgo.setHours(0, 0, 0, 0);
      startDate = threeMonthsAgo;
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
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
      
      if (revenueFilter === "currentWeek" || revenueFilter === "previousWeek" || revenueFilter === "custom" || revenueFilter === "selectMonth") {
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        key = `${day}.${month}.${year}`;
        sortKey = `${year}-${month}-${day}`;
      } else if (revenueFilter === "monthly") {
        // Mjesečni
        const monthNames = ["januar", "februar", "mart", "april", "maj", "juni", "juli", "august", "septembar", "oktobar", "novembar", "decembar"];
        const month = monthNames[date.getMonth()];
        const year = date.getFullYear();
        key = `${month} ${year}`;
        sortKey = `${year}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      } else if (revenueFilter === "quarterly") {
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

    // Za currentWeek i previousWeek filtere, uvek prikaži 7 dana od ponedjeljka do nedjelje
    const getMonday = (d: Date) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      date.setDate(date.getDate() + diff);
      date.setHours(0, 0, 0, 0);
      return date;
    };

    if (revenueFilter === "currentWeek") {
      const sevenDaysData: Array<{ period: string; zarada: number; sortKey: string }> = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const monday = getMonday(today);
      
      // Generiši 7 dana od ponedjeljka do nedjelje (trenutna sedmica)
      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const period = `${day}.${month}.${year}`;
        const sortKey = `${year}-${month}-${day}`;
        
        // Proveri da li postoji zarada za ovaj dan
        const existingData = grouped[period];
        sevenDaysData.push({
          period,
          zarada: existingData ? Number(existingData.amount.toFixed(2)) : 0,
          sortKey
        });
      }
      
      return sevenDaysData.map(({ period, zarada }) => ({ period, zarada: zarada || 0 }));
    } else if (revenueFilter === "previousWeek") {
      const sevenDaysData: Array<{ period: string; zarada: number; sortKey: string }> = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const lastWeekDate = new Date(today);
      lastWeekDate.setDate(today.getDate() - 7);
      const lastWeekMonday = getMonday(lastWeekDate);
      
      // Generiši 7 dana od ponedjeljka do nedjelje (prošla sedmica)
      for (let i = 0; i < 7; i++) {
        const date = new Date(lastWeekMonday);
        date.setDate(lastWeekMonday.getDate() + i);
        
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const period = `${day}.${month}.${year}`;
        const sortKey = `${year}-${month}-${day}`;
        
        // Proveri da li postoji zarada za ovaj dan
        const existingData = grouped[period];
        sevenDaysData.push({
          period,
          zarada: existingData ? Number(existingData.amount.toFixed(2)) : 0,
          sortKey
        });
      }
      
      return sevenDaysData.map(({ period, zarada }) => ({ period, zarada: zarada || 0 }));
    }

    // Konvertuj u array i sortiraj
    return Object.entries(grouped)
      .map(([period, data]) => ({ 
        period, 
        zarada: Number(data.amount.toFixed(2)),
        sortKey: data.sortKey 
      }))
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ period, zarada }) => ({ period, zarada }));
  }, [allPayments, revenueFilter, customFrom, customTo, selectedMonth, selectedYear]);

  // Ukupna zarada za odabrani period
  const totalRevenue = useMemo(() => {
    return revenueChartData.reduce((sum, item) => sum + (item.zarada || 0), 0);
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
        setRevenueFilterDropdownOpen(false);
      }
    };

    if (monthDropdownOpen || yearDropdownOpen || revenueFilterDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [monthDropdownOpen, yearDropdownOpen, revenueFilterDropdownOpen]);

  if (isAdmin === null || loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <FaSpinner style={{ fontSize: "32px", color: "#3b82f6", animation: "spin 1s linear infinite" }} />
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @media (max-width: 768px) {
            /* Spriječi automatsko zumiranje na input poljima - iOS Safari zumira ako je font-size < 16px */
            input[type="text"],
            input[type="number"],
            input[type="tel"],
            input[type="email"],
            input[type="date"],
            input[type="time"],
            input[type="datetime-local"],
            textarea,
            select {
              font-size: 16px !important;
            }
          }
        `}</style>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  // Dinamički padding za mobilnu verziju
  const containerPadding = isMobile ? 4 : 24;

  return (
    <div style={{ padding: containerPadding, fontFamily: "'Inter', sans-serif", backgroundColor: "#f4f5f7", minHeight: "100vh" }}>
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
      <div style={{ marginBottom: "32px", background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "24px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
        <div style={{
          marginBottom: "24px",
          paddingBottom: "20px",
          borderBottom: "2px solid #f3f4f6"
        }}>
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#1f2937", margin: 0 }}>
            Grafikon Zarade
          </h2>
          <p style={{ fontSize: "14px", color: "#6b7280", margin: "4px 0 0 0" }}>
            Ukupna zarada od pretplata korisnika
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
          <div>
            <label style={{
              display: "block",
              fontWeight: 600,
              fontSize: "15px",
              color: "#374151",
              marginBottom: "12px"
            }}>
              Vremenski period
            </label>
            {isMobile ? (
              <div style={{ 
                marginBottom: "16px", 
                background: "linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.95) 100%)",
                backdropFilter: "blur(15px) saturate(180%)",
                WebkitBackdropFilter: "blur(15px) saturate(180%)",
                border: "1px solid rgba(255, 255, 255, 0.8)",
                borderRadius: "16px", 
                boxShadow: "0 15px 30px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.02)", 
                width: "100%", 
                maxWidth: "100%", 
                boxSizing: "border-box",
                position: "relative",
                padding: "12px",
                zIndex: 10
              }}>
                <div style={{ position: "relative", width: "100%" }} data-dropdown-container>
                  <button
                    type="button"
                    onClick={() => {
                      setRevenueFilterDropdownOpen(!revenueFilterDropdownOpen);
                      setMonthDropdownOpen(false);
                      setYearDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "14px 40px 14px 16px",
                      border: revenueFilterDropdownOpen ? "2px solid #3b82f6" : "1px solid #d1d5db",
                      borderRadius: "12px",
                      fontSize: "15px",
                      backgroundColor: "#fff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      boxShadow: revenueFilterDropdownOpen ? "0 8px 20px rgba(59,130,246,0.2), 0 0 0 1px rgba(59,130,246,0.1)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
                      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                      fontWeight: 600,
                      color: "#1f2937",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <span>
                      {[
                        { value: "currentWeek", label: "Trenutna sedmica" },
                        { value: "previousWeek", label: "Prošla sedmica" },
                        { value: "monthly", label: "Mjesečni" },
                        { value: "quarterly", label: "Tromjesečni" },
                        { value: "selectMonth", label: "Odaberi mjesec" },
                        { value: "custom", label: "Prilagođeno" },
                      ].find(r => r.value === revenueFilter)?.label || "Trenutna sedmica"}
                    </span>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{
                        transform: revenueFilterDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        position: "absolute",
                        right: "16px",
                      }}
                    >
                      <path 
                        d="M5 7.5L10 12.5L15 7.5" 
                        stroke={revenueFilterDropdownOpen ? "#3b82f6" : "#6b7280"} 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  {revenueFilterDropdownOpen && (
                    <>
                      <div
                        style={{
                          position: "fixed",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: "rgba(0, 0, 0, 0.08)",
                          backdropFilter: "blur(4px)",
                          WebkitBackdropFilter: "blur(4px)",
                          zIndex: 9999,
                        }}
                        onClick={() => setRevenueFilterDropdownOpen(false)}
                      />
                      <div
                        style={{
                          position: "absolute",
                          top: "calc(100% + 8px)",
                          left: 0,
                          right: 0,
                          background: "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.98) 100%)",
                          backdropFilter: "blur(20px) saturate(180%)",
                          WebkitBackdropFilter: "blur(20px) saturate(180%)",
                          border: "1px solid rgba(255, 255, 255, 0.8)",
                          borderRadius: "16px",
                          boxShadow: "0 25px 50px -12px rgba(59, 130, 246, 0.25), 0 0 0 1px rgba(59, 130, 246, 0.1), 0 10px 30px rgba(0, 0, 0, 0.15)",
                          zIndex: 10000,
                          maxHeight: "320px",
                          overflowY: "auto",
                          overflowX: "hidden",
                        }}
                      >
                        <style>{`
                          @keyframes dropdownSlideIn {
                            from {
                              opacity: 0;
                              transform: translateY(-10px) scale(0.95);
                            }
                            to {
                              opacity: 1;
                              transform: translateY(0) scale(1);
                            }
                          }
                          @keyframes itemSlideIn {
                            from {
                              opacity: 0;
                              transform: translateX(-10px);
                            }
                            to {
                              opacity: 1;
                              transform: translateX(0);
                            }
                          }
                        `}</style>
                        {[
                          { value: "currentWeek", label: "Trenutna sedmica" },
                          { value: "previousWeek", label: "Prošla sedmica" },
                          { value: "monthly", label: "Mjesečni" },
                          { value: "quarterly", label: "Tromjesečni" },
                          { value: "selectMonth", label: "Odaberi mjesec" },
                          { value: "custom", label: "Prilagođeno" },
                        ].map((r, index) => {
                          const isSelected = revenueFilter === r.value;
                          return (
                            <button
                              key={r.value}
                              type="button"
                              onClick={() => {
                                setRevenueFilter(r.value as any);
                                setRevenueFilterDropdownOpen(false);
                                setMonthDropdownOpen(false);
                                setYearDropdownOpen(false);
                              }}
                              style={{
                                width: "100%",
                                padding: "16px 18px",
                                textAlign: "left",
                                border: "none",
                                backgroundColor: isSelected ? "#eff6ff" : "#fff",
                                background: isSelected ? "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)" : "#fff",
                                opacity: 1,
                                color: isSelected ? "#1e40af" : "#374151",
                                fontSize: "15px",
                                cursor: "pointer",
                                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                                fontWeight: isSelected ? 600 : 500,
                                borderBottom: index < 5 ? "1px solid #f1f5f9" : "none",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                animation: `itemSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.05}s both`,
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.backgroundColor = "#f1f5f9";
                                  e.currentTarget.style.background = "#f1f5f9";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.backgroundColor = "#fff";
                                  e.currentTarget.style.background = "#fff";
                                }
                              }}
                            >
                              <span>{r.label}</span>
                              {isSelected && (
                                <svg 
                                  width="22" 
                                  height="22" 
                                  viewBox="0 0 22 22" 
                                  fill="none" 
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <circle cx="11" cy="11" r="10" fill="#3b82f6" opacity="0.15"/>
                                  <path 
                                    d="M7.5 11L10 13.5L14.5 9" 
                                    stroke="#3b82f6" 
                                    strokeWidth="2.5" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
                {revenueFilter === "custom" && (
                  <div style={{ 
                    marginTop: "12px",
                    display: "flex", 
                    gap: 8, 
                    alignItems: "center", 
                    justifyContent: "center",
                    width: "100%", 
                    flexWrap: "nowrap",
                    opacity: 1,
                    visibility: "visible"
                  }}>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      style={{ 
                        flex: "1 1 auto",
                        minWidth: 0,
                        padding: "8px 12px", 
                        border: "1px solid #d1d5db", 
                        borderRadius: "8px", 
                        fontSize: "13px", 
                        outline: "none",
                        backgroundColor: "#fff",
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                        boxSizing: "border-box",
                        color: "#1f2937",
                        fontWeight: 500
                      }}
                    />
                    <span style={{ whiteSpace: "nowrap", fontSize: "13px", color: "#6b7280" }}>do</span>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      style={{ 
                        flex: "1 1 auto",
                        minWidth: 0,
                        padding: "8px 12px", 
                        border: "1px solid #d1d5db", 
                        borderRadius: "8px", 
                        fontSize: "13px", 
                        outline: "none",
                        backgroundColor: "#fff",
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                        boxSizing: "border-box",
                        color: "#1f2937",
                        fontWeight: 500
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                {[
                  { value: "currentWeek", label: "Trenutna sedmica" },
                  { value: "previousWeek", label: "Prošla sedmica" },
                  { value: "monthly", label: "Mjesečni" },
                  { value: "quarterly", label: "Tromjesečni" },
                  { value: "selectMonth", label: "Odaberi mjesec" },
                  { value: "custom", label: "Prilagođeno" },
                ].map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setRevenueFilter(r.value as any)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "none",
                      cursor: "pointer",
                      fontWeight: 500,
                      fontSize: 14,
                      background: revenueFilter === r.value ? "#3b82f6" : "#e5e7eb",
                      color: revenueFilter === r.value ? "#fff" : "#374151",
                      transition: "all 0.2s",
                      boxShadow: revenueFilter === r.value ? "0 2px 8px rgba(59,130,246,0.3)" : "none",
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
            {revenueFilter === "custom" && (
              <div style={{ 
                display: "flex", 
                gap: 8, 
                alignItems: "center", 
                justifyContent: "center",
                width: "100%", 
                flexWrap: "nowrap"
              }}>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  style={{ 
                    flex: "1 1 auto",
                    minWidth: 0,
                    padding: "8px 12px", 
                    border: "1px solid #e5e7eb", 
                    borderRadius: "6px", 
                    fontSize: 14, 
                    outline: "none",
                    boxSizing: "border-box",
                    backgroundColor: "#fff",
                    color: "#1f2937",
                    fontWeight: 500
                  }}
                />
                <span style={{ 
                  whiteSpace: "nowrap", 
                  color: "#6b7280",
                  fontSize: 14
                }}>
                  do
                </span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  style={{ 
                    flex: "1 1 auto",
                    minWidth: 0,
                    padding: "8px 12px", 
                    border: "1px solid #e5e7eb", 
                    borderRadius: "6px", 
                    fontSize: 14, 
                    outline: "none",
                    boxSizing: "border-box",
                    backgroundColor: "#fff",
                    color: "#1f2937",
                    fontWeight: 500
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Grafikon zarade */}
        <>
          <div style={{ marginBottom: "16px", padding: "12px", background: "#f9fafb", borderRadius: "8px", display: "inline-block" }}>
            <span style={{ fontSize: "14px", color: "#6b7280", marginRight: "8px" }}>Ukupna zarada za period:</span>
            <span style={{ fontSize: "18px", fontWeight: 600, color: "#10b981" }}>
              {totalRevenue.toFixed(2)} KM
            </span>
          </div>
          <div
            className="chart-container"
            style={{
              width: "100%",
              maxWidth: "100%",
              height: isMobile ? 310 : 400,
              minHeight: isMobile ? 310 : 400,
              backgroundColor: "#fff",
              borderRadius: 12,
              padding: isMobile ? 0 : 20,
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
              marginBottom: isMobile ? 8 : 30,
              overflow: isMobile ? "visible" : "hidden",
              boxSizing: "border-box",
              position: "relative",
              zIndex: 1
            }}
          >
            <div style={{ width: "100%", height: isMobile ? 300 : 400, minHeight: isMobile ? 300 : 400, position: "relative", padding: isMobile ? "10px" : 0 }}>
              <ResponsiveContainer key={`revenue-chart-${isMobile}-${revenueChartData.length}-${chartKey}-${typeof window !== 'undefined' ? window.innerWidth : 0}`} width="100%" height={isMobile ? 300 : 400}>
                <LineChart data={revenueChartData || []} margin={{ top: isMobile ? 10 : 20, right: isMobile ? 10 : 20, left: isMobile ? 0 : 10, bottom: isMobile ? 25 : 6 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="period" 
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={isMobile ? 25 : 66}
                  />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} width={50} />
                  <Tooltip content={<RevenueTooltip />} />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: "12px" }} />
                  <Line 
                    type="monotone" 
                    dataKey="zarada" 
                    name="Zarada" 
                    stroke="#10b981" 
                    strokeWidth={2} 
                    dot={{ r: isMobile ? 2 : 3 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
        <style jsx>{`
          .recharts-wrapper {
            width: 100% !important;
          }
          .recharts-surface {
            width: 100% !important;
          }
        `}</style>
      </div>

      {/* Korisnici koji su prijavili uplatu - Profesionalni card */}
      {users.filter(user => subscriptions[user.id]?.paymentPendingVerification).length > 0 && (
        <div style={{
          marginBottom: "24px",
          background: "#fff",
          borderRadius: "12px",
          padding: "24px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          border: "1px solid #e5e7eb"
        }}>
          <div style={{
            marginBottom: "20px",
            paddingBottom: "16px",
            borderBottom: "2px solid #f3f4f6"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "24px" }}>⚠️</span>
              <div>
                <h2 style={{
                  fontSize: "20px",
                  fontWeight: 600,
                  color: "#1f2937",
                  margin: 0
                }}>
                  Uplate koje čekaju provjeru
                </h2>
                <p style={{
                  fontSize: "14px",
                  color: "#6b7280",
                  margin: "4px 0 0 0"
                }}>
                  {users.filter(user => subscriptions[user.id]?.paymentPendingVerification).length} uplata {users.filter(user => subscriptions[user.id]?.paymentPendingVerification).length === 1 ? 'čeka' : 'čekaju'} odobrenje
                </p>
              </div>
            </div>
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
                      padding: "16px",
                      background: "#fffbeb",
                      borderRadius: "8px",
                      border: "1px solid #fcd34d",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "16px",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(245, 158, 11, 0.2)";
                      e.currentTarget.style.borderColor = "#f59e0b";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.borderColor = "#fcd34d";
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
                            // Ažuriraj subscription_data da ukloni paymentPendingVerification i označi uplatu kao odbijenu
                            const response = await fetch(`/api/users/${user.id}/subscription`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                subscriptionData: {
                                  paymentPendingVerification: false,
                                  paymentRequestedAt: null,
                                  paymentRequestedAmount: null,
                                  paymentRequestedMonths: null,
                                  paymentReferenceNumber: null,
                                  paymentRejected: true,
                                  paymentRejectedAt: new Date().toISOString(),
                                }
                              })
                            });

                            if (!response.ok) {
                              throw new Error('Failed to update subscription');
                            }

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
                          
                          // Učitaj dodatne podatke korisnika (ime, telefon i lokacija) iz user objekta
                          // TODO: Ako se ovi podaci čuvaju u bazi, dodati API endpoint za njihovo učitavanje
                          try {
                            setImeKorisnika(user.imeKorisnika || "");
                            setBrojTelefona(user.brojTelefona || "");
                            setLokacija(user.lokacija || "");
                          } catch (error) {
                            console.error("Greška pri učitavanju podataka korisnika:", error);
                            // Fallback na prazne stringove
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

      {/* Pretraga - Profesionalni card */}
      <div style={{
        marginBottom: "24px",
        background: "#fff",
        borderRadius: "12px",
        padding: "24px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        border: "1px solid #e5e7eb"
      }}>
        <div style={{
          marginBottom: "16px",
          paddingBottom: "16px",
          borderBottom: "2px solid #f3f4f6"
        }}>
          <h2 style={{
            fontSize: "20px",
            fontWeight: 600,
            color: "#1f2937",
            margin: 0
          }}>
            Pretraga korisnika
          </h2>
          <p style={{
            fontSize: "14px",
            color: "#6b7280",
            margin: "4px 0 0 0"
          }}>
            Pretražite korisnike po email-u, nazivu aplikacije ili user ID-u
          </p>
        </div>
        <div style={{ position: "relative", maxWidth: "100%" }}>
          <FaSearch
            style={{
              position: "absolute",
              left: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#9ca3af",
              fontSize: "16px",
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
              padding: "12px 16px 12px 48px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              fontSize: isMobile ? "16px" : "15px",
              outline: "none",
              boxSizing: "border-box",
              transition: "all 0.2s ease",
              backgroundColor: "#fff",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#3b82f6";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#d1d5db";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>
      </div>

      {/* Tabela korisnika - Desktop verzija */}
      {!isMobile ? (
        <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
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
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
                    {loading ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
                        <FaSpinner style={{ fontSize: "20px", animation: "spin 1s linear infinite" }} />
                        <span>Učitavanje korisnika...</span>
                      </div>
                    ) : (
                      <div>
                        <p style={{ fontSize: "16px", marginBottom: "8px" }}>
                          {searchTerm ? "Nema rezultata za vašu pretragu" : "Nema korisnika u bazi podataka"}
                        </p>
                        {!searchTerm && (
                          <p style={{ fontSize: "14px", color: "#9ca3af" }}>
                            Korisnici će se pojaviti ovde nakon što se registruju
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, index) => {
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
              })
              )}
            </tbody>
          </table>
        </div>
      </div>
      ) : (
        /* Mobilna verzija - Card layout */
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filteredUsers.length === 0 ? (
            <div style={{ 
              padding: "40px", 
              textAlign: "center", 
              color: "#6b7280",
              background: "#fff",
              borderRadius: "12px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)"
            }}>
              {loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", flexDirection: "column" }}>
                  <FaSpinner style={{ fontSize: "20px", animation: "spin 1s linear infinite" }} />
                  <span>Učitavanje korisnika...</span>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: "16px", marginBottom: "8px" }}>
                    {searchTerm ? "Nema rezultata za vašu pretragu" : "Nema korisnika u bazi podataka"}
                  </p>
                  {!searchTerm && (
                    <p style={{ fontSize: "14px", color: "#9ca3af" }}>
                      Korisnici će se pojaviti ovde nakon što se registruju
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            filteredUsers.map((user, index) => {
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
                <div
                  key={user.id}
                  style={{
                    background: "#fff",
                    borderRadius: "12px",
                    padding: "16px",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                    border: "1px solid #e5e7eb"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937", marginBottom: "4px" }}>
                        #{index + 1} - {user.appName}
                      </div>
                      <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>
                        {user.email || user.id.substring(0, 8) + "..."}
                      </div>
                      <div style={{ marginBottom: "8px" }}>
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
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px", fontSize: "13px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#6b7280" }}>Preostalo dana:</span>
                      <span style={{ fontWeight: 600, color: "#1f2937" }}>{remainingDaysText}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#6b7280" }}>Registracija:</span>
                      <span style={{ color: "#1f2937" }}>{user.createdAt ? user.createdAt.toLocaleDateString("bs-BA") : "N/A"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#6b7280" }}>Uplate:</span>
                      {paymentCount > 0 ? (
                        <span style={{ fontWeight: 600, color: "#3b82f6" }}>{paymentCount} uplata</span>
                      ) : (
                        <span style={{ color: "#9ca3af" }}>Nema uplata</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      onClick={() => {
                        setSelectedUserDetails(user);
                        const sub = subscriptions[user.id];
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
                        flex: 1,
                        minWidth: "calc(50% - 4px)",
                        padding: "10px 12px",
                        borderRadius: "6px",
                        border: "none",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                        backgroundColor: "#6b7280",
                        color: "#fff",
                        transition: "all 0.2s",
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
                        flex: 1,
                        minWidth: "calc(50% - 4px)",
                        padding: "10px 12px",
                        borderRadius: "6px",
                        border: "none",
                        fontSize: "13px",
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
                </div>
              );
            })
          )}
        </div>
      )}

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
                              fontSize: isMobile ? "16px" : "14px",
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
                              fontSize: isMobile ? "16px" : "14px",
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
                              fontSize: isMobile ? "16px" : "14px",
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
                              
                              // TODO: Implementirati API endpoint za ažuriranje korisničkih podataka
                              // Za sada samo ažuriramo lokalni state
                              const savedData = updateData;
                              
                              // Ažuriraj lokalni state korisnika
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
                        if (selectedUserDetails) {
                          fetchUserDevices(selectedUserDetails.id);
                        }
                      }}
                      disabled={saving || loadingDevices}
                      style={{
                        padding: "10px 20px",
                        borderRadius: "6px",
                        border: "none",
                        fontSize: "14px",
                        fontWeight: 600,
                        cursor: saving || loadingDevices ? "not-allowed" : "pointer",
                        backgroundColor: "#8b5cf6",
                        color: "#fff",
                        opacity: saving || loadingDevices ? 0.6 : 1,
                      }}
                    >
                      {loadingDevices ? "Učitavanje..." : "📱 Pregled Uređaja"}
                    </button>
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

      {/* Admin Chat - floating button */}
      <AdminChat />

      {/* Devices Modal */}
      {showDevicesModal && selectedUserDetails && (
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
            zIndex: 1001,
          }}
          onClick={() => {
            setShowDevicesModal(false);
            setUserDevices([]);
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "800px",
              width: "90%",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#1f2937", marginBottom: "20px" }}>
              📱 Uređaji - {selectedUserDetails.appName}
            </h2>

            {loadingDevices ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#6b7280" }}>
                <p style={{ fontSize: "16px", margin: 0 }}>Učitavanje uređaja...</p>
              </div>
            ) : !userDevices || userDevices.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#6b7280" }}>
                <p style={{ fontSize: "16px", margin: 0 }}>Nema registrovanih uređaja</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {Array.isArray(userDevices) && userDevices.map((device, index) => (
                  <div
                    key={device.id || device.deviceId || index}
                    style={{
                      padding: "16px",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      background: device.isBlocked ? "#fef2f2" : "#f9fafb",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "12px" }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: "14px", fontWeight: 600, color: "#1f2937", margin: "0 0 4px 0" }}>
                          {device.deviceName || "Neimenovani uređaj"}
                        </p>
                        <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
                          ID: {(device.deviceId || device.device_id || "").substring(0, 12)}...
                        </p>
                      </div>
                      <span
                        style={{
                          padding: "4px 12px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: 600,
                          backgroundColor: device.isBlocked ? "#fee2e2" : device.status === "approved" ? "#dcfce7" : "#fef3c7",
                          color: device.isBlocked ? "#dc2626" : device.status === "approved" ? "#16a34a" : "#f59e0b",
                        }}
                      >
                        {device.isBlocked ? "ZABRANJEN" : device.status === "approved" ? "ODOBREN" : "ČEKA ODOBRENJE"}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px", fontSize: "12px" }}>
                      <div>
                        <p style={{ color: "#6b7280", margin: "0 0 4px 0" }}>Browser:</p>
                        <p style={{ color: "#1f2937", margin: 0, fontWeight: 500 }}>
                          {device.deviceInfo?.browser || "Nepoznat"}
                        </p>
                      </div>
                      <div>
                        <p style={{ color: "#6b7280", margin: "0 0 4px 0" }}>OS:</p>
                        <p style={{ color: "#1f2937", margin: 0, fontWeight: 500 }}>
                          {device.deviceInfo?.os || "Nepoznat"}
                        </p>
                      </div>
                      {device.lastLogin && (
                        <div>
                          <p style={{ color: "#6b7280", margin: "0 0 4px 0" }}>Posljednja prijava:</p>
                          <p style={{ color: "#1f2937", margin: 0, fontWeight: 500 }}>
                            {new Date(device.lastLogin).toLocaleDateString("bs-BA")}
                          </p>
                        </div>
                      )}
                      {device.createdAt && (
                        <div>
                          <p style={{ color: "#6b7280", margin: "0 0 4px 0" }}>Registrovan:</p>
                          <p style={{ color: "#1f2937", margin: 0, fontWeight: 500 }}>
                            {new Date(device.createdAt).toLocaleDateString("bs-BA")}
                          </p>
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {!device.isBlocked && device.status !== "approved" && (
                        <button
                          onClick={() => approveDevice(selectedUserDetails.id, device.deviceId || device.device_id)}
                          disabled={saving}
                          style={{
                            padding: "6px 12px",
                            background: "#16a34a",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: saving ? "not-allowed" : "pointer",
                            fontSize: "12px",
                            fontWeight: 600,
                            opacity: saving ? 0.6 : 1,
                          }}
                        >
                          ✓ Odobri
                        </button>
                      )}
                      {!device.isBlocked && (
                        <button
                          onClick={() => blockDevice(selectedUserDetails.id, device.deviceId || device.device_id)}
                          disabled={saving}
                          style={{
                            padding: "6px 12px",
                            background: "#f59e0b",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: saving ? "not-allowed" : "pointer",
                            fontSize: "12px",
                            fontWeight: 600,
                            opacity: saving ? 0.6 : 1,
                          }}
                        >
                          🚫 Zabrani
                        </button>
                      )}
                      <button
                        onClick={() => deleteDevice(selectedUserDetails.id, device.deviceId || device.device_id)}
                        disabled={saving}
                        style={{
                          padding: "6px 12px",
                          background: "#dc2626",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: saving ? "not-allowed" : "pointer",
                          fontSize: "12px",
                          fontWeight: 600,
                          opacity: saving ? 0.6 : 1,
                        }}
                      >
                        🗑️ Obriši
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "20px" }}>
              <button
                onClick={() => {
                  setShowDevicesModal(false);
                  setUserDevices([]);
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
          </div>
        </div>
      )}
    </div>
  );
}

