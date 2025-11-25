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
  // Calculated fields
  isTrial?: boolean;
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
              
              // Check trial period
              if (trialEndDate && now < trialEndDate) {
                isTrial = true;
                daysRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              } else if (expiryDate) {
                if (now < expiryDate) {
                  // Active subscription
                  daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                } else {
                  // Expired, check grace period
                  const calculatedGraceEnd = graceEndDate || (expiryDate ? new Date(expiryDate.getTime() + 7 * 24 * 60 * 60 * 1000) : null);
                  if (calculatedGraceEnd && now < calculatedGraceEnd) {
                    isGracePeriod = true;
                    daysInGrace = Math.ceil((calculatedGraceEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  }
                }
              }
              
              subscription = {
                isActive: subData.isActive || false,
                monthlyPrice: subData.monthlyPrice || 12,
                lastPaymentDate: subData.lastPaymentDate?.toDate?.() || (subData.lastPaymentDate ? new Date(subData.lastPaymentDate) : null),
                expiryDate: expiryDate,
                graceEndDate: graceEndDate,
                trialEndDate: trialEndDate,
                paymentHistory: (subData.paymentHistory || []).map((p: any) => ({
                  date: p.date?.toDate?.() || (p.date ? new Date(p.date) : new Date()),
                  amount: p.amount || 0,
                  note: p.note || "",
                })),
                isTrial,
                isGracePeriod,
                daysRemaining,
                daysUntilExpiry,
                daysInGrace,
              };
            } catch (parseError) {
              console.warn(`Greška pri parsiranju subscription podataka za korisnika ${userId}:`, parseError);
            }
          }

          // Email se ne čuva u Firestore, koristimo user ID ili appName
          usersList.push({
            id: userId,
            email: userData.email || null, // Može biti null ako nije sačuvan u Firestore
            appName: userData.appName || "N/A",
            createdAt: userData.createdAt?.toDate?.() || (userData.createdAt ? new Date(userData.createdAt) : null),
            lastSignIn: userData.lastSignIn?.toDate?.() || (userData.lastSignIn ? new Date(userData.lastSignIn) : null),
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
                
                if (isTrial) {
                  statusText = `Trial (${daysRemaining} dana)`;
                  statusColor = "#2563eb";
                  statusBg = "#dbeafe";
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
                            setSelectedUserDetails(user);
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
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
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
                  </div>

                  {/* Status pretplate */}
                  <div style={{ marginBottom: "24px", padding: "16px", background: "#f9fafb", borderRadius: "8px" }}>
                    <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1f2937", marginBottom: "12px" }}>
                      Status Pretplate
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
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
                              : isActive
                              ? "#dcfce7"
                              : isGracePeriod
                              ? "#fef3c7"
                              : "#fee2e2",
                            color: isTrial
                              ? "#2563eb"
                              : isActive
                              ? "#16a34a"
                              : isGracePeriod
                              ? "#f59e0b"
                              : "#dc2626",
                          }}
                        >
                          {isTrial
                            ? `Trial (${subscription?.daysRemaining || 0} dana)`
                            : isActive
                            ? `Aktivna (${subscription?.daysUntilExpiry || 0} dana)`
                            : isGracePeriod
                            ? `Grace Period (${subscription?.daysInGrace || 0} dana)`
                            : "Neaktivna"}
                        </span>
                      </div>
                      <div>
                        <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Mjesečna Cijena:</p>
                        <p style={{ fontSize: "14px", fontWeight: 500, color: "#1f2937" }}>
                          {subscription?.monthlyPrice || 12} KM
                        </p>
                      </div>
                      {subscription?.trialEndDate && (
                        <div>
                          <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Trial Ističe:</p>
                          <p style={{ fontSize: "14px", color: "#1f2937" }}>
                            {subscription.trialEndDate.toLocaleDateString("bs-BA")}
                          </p>
                        </div>
                      )}
                      {subscription?.expiryDate && (
                        <div>
                          <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Pretplata Ističe:</p>
                          <p style={{ fontSize: "14px", color: "#1f2937" }}>
                            {subscription.expiryDate.toLocaleDateString("bs-BA")}
                          </p>
                        </div>
                      )}
                      {subscription?.lastPaymentDate && (
                        <div>
                          <p style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>Posljednja Uplata:</p>
                          <p style={{ fontSize: "14px", color: "#1f2937" }}>
                            {subscription.lastPaymentDate.toLocaleDateString("bs-BA")}
                          </p>
                        </div>
                      )}
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

