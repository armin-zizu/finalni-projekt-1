"use client";

import React, { useState, useEffect } from "react";
import { auth, db } from "../../lib/firebase";
import { collection, getDocs, doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { FaSearch, FaCheck, FaTimes, FaPlus, FaSpinner, FaUser, FaEnvelope, FaCalendar, FaDollarSign } from "react-icons/fa";

// Admin email - promijeni na svoj email
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@example.com";

interface User {
  id: string;
  email: string | null;
  appName: string;
  createdAt: Date | null;
  lastSignIn: Date | null;
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
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMonths, setPaymentMonths] = useState(1);
  const [paymentNote, setPaymentNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      const usersCollection = collection(db, "users");
      const usersSnapshot = await getDocs(usersCollection);
      
      const usersList: User[] = [];
      const subscriptionsMap: Record<string, Subscription> = {};

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();

        // Učitaj subscription
        const subscriptionRef = doc(db, "users", userId, "subscription", "info");
        const subscriptionDoc = await getDoc(subscriptionRef);

        let subscription: Subscription = {
          isActive: false,
          monthlyPrice: 12,
          lastPaymentDate: null,
          expiryDate: null,
          graceEndDate: null,
          trialEndDate: null,
          paymentHistory: [],
        };

        if (subscriptionDoc.exists()) {
          const subData = subscriptionDoc.data();
          subscription = {
            isActive: subData.isActive || false,
            monthlyPrice: subData.monthlyPrice || 12,
            lastPaymentDate: subData.lastPaymentDate?.toDate() || null,
            expiryDate: subData.expiryDate?.toDate() || null,
            graceEndDate: subData.graceEndDate?.toDate() || null,
            trialEndDate: subData.trialEndDate?.toDate() || null,
            paymentHistory: (subData.paymentHistory || []).map((p: any) => ({
              date: p.date?.toDate() || new Date(),
              amount: p.amount || 0,
              note: p.note || "",
            })),
          };
        }

        // Učitaj email iz auth (možeš koristiti admin SDK za sve korisnike)
        // Za sada koristimo appName iz Firestore
        usersList.push({
          id: userId,
          email: userData.email || null,
          appName: userData.appName || "N/A",
          createdAt: userData.createdAt?.toDate() || null,
          lastSignIn: userData.lastSignIn?.toDate() || null,
        });

        subscriptionsMap[userId] = subscription;
      }

      setUsers(usersList);
      setSubscriptions(subscriptionsMap);
      setLoading(false);
    } catch (error) {
      console.error("Greška pri učitavanju korisnika:", error);
      setMessage({ type: "error", text: "Greška pri učitavanju korisnika" });
      setLoading(false);
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
        await setDoc(
          subscriptionRef,
          {
            isActive: newStatus,
            expiryDate: newStatus
              ? Timestamp.fromDate(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) // +30 dana
              : Timestamp.fromDate(new Date(0)), // Prošli datum
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
      const newExpiryDate = new Date(now);
      newExpiryDate.setMonth(newExpiryDate.getMonth() + paymentMonths);

      const payment = {
        date: Timestamp.fromDate(now),
        amount: amount,
        note: paymentNote || `Bank Transfer - ${paymentMonths} ${paymentMonths === 1 ? "mjesec" : "mjeseci"}`,
      };

      let subscriptionData: any = {};
      if (subscriptionDoc.exists()) {
        subscriptionData = subscriptionDoc.data();
      }

      const paymentHistory = subscriptionData.paymentHistory || [];
      paymentHistory.push(payment);

      await setDoc(
        subscriptionRef,
        {
          isActive: true,
          lastPaymentDate: Timestamp.fromDate(now),
          expiryDate: Timestamp.fromDate(newExpiryDate),
          graceEndDate: null,
          monthlyPrice: 12,
          paymentHistory: paymentHistory,
          updatedAt: Timestamp.fromDate(now),
        },
        { merge: true }
      );

      await loadUsers();
      setShowPaymentModal(false);
      setPaymentAmount("");
      setPaymentMonths(1);
      setPaymentNote("");
      setSelectedUser(null);
      setMessage({ type: "success", text: "Uplata dodana uspješno" });
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

      {/* Pretraga */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ position: "relative" }}>
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
              padding: "12px 12px 12px 40px",
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              fontSize: "14px",
              outline: "none",
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
                  Status
                </th>
                <th style={{ padding: "12px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#6b7280" }}>
                  Ističe
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
                const expiryDate = subscription?.expiryDate;
                const daysUntilExpiry = expiryDate
                  ? Math.ceil((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                  : null;

                return (
                  <tr key={user.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px", fontSize: "14px", color: "#1f2937" }}>
                      {user.email || "N/A"}
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
                          backgroundColor: isActive ? "#dcfce7" : "#fee2e2",
                          color: isActive ? "#16a34a" : "#dc2626",
                        }}
                      >
                        {isActive ? "Aktivna" : "Neaktivna"}
                      </span>
                    </td>
                    <td style={{ padding: "12px", fontSize: "14px", color: "#1f2937" }}>
                      {expiryDate
                        ? daysUntilExpiry !== null
                          ? `${daysUntilExpiry > 0 ? daysUntilExpiry : 0} dana`
                          : "Istekla"
                        : "N/A"}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button
                          onClick={() => toggleSubscription(user.id, isActive)}
                          disabled={saving}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            border: "none",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: saving ? "not-allowed" : "pointer",
                            backgroundColor: isActive ? "#fee2e2" : "#dcfce7",
                            color: isActive ? "#dc2626" : "#16a34a",
                            transition: "all 0.2s",
                          }}
                        >
                          {isActive ? <FaTimes /> : <FaCheck />} {isActive ? "Deaktiviraj" : "Aktiviraj"}
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

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedUser(null);
                  setPaymentAmount("");
                  setPaymentMonths(1);
                  setPaymentNote("");
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
    </div>
  );
}

