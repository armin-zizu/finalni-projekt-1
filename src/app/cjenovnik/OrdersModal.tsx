"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FaPlus, FaTimes, FaEdit, FaClipboardList } from "react-icons/fa";

interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone?: string;
}

interface Order {
  id: string;
  supplierId: string;
  date: string;
  status: "pending" | "in-transit" | "received";
  items: Array<{ name: string; quantity: number }>;
  totalItems: number;
}

interface OrdersModalProps {
  open: boolean;
  onClose: () => void;
  items: Array<{ naziv: string; pocetnoStanje?: number }>;
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(17, 24, 39, 0.45)",
  zIndex: 2000,
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  overflowY: "auto",
  padding: "32px 12px",
};

const modalStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "1100px",
  background: "#ffffff",
  borderRadius: "12px",
  boxShadow: "0 20px 50px rgba(0, 0, 0, 0.18)",
  padding: "20px",
  position: "relative",
  border: "1px solid #e5e7eb",
};

const headerRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
  marginBottom: "16px",
};

const titleStyle: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  color: "#111827",
  margin: 0,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#6b7280",
  margin: "4px 0 0 0",
};

const actionsRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const primaryButton: React.CSSProperties = {
  padding: "10px 16px",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: "8px",
  boxShadow: "0 8px 20px rgba(37, 99, 235, 0.25)",
};

const secondaryButton: React.CSSProperties = {
  padding: "10px 16px",
  background: "#f3f4f6",
  color: "#1f2937",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const smallButton: React.CSSProperties = {
  ...secondaryButton,
  padding: "8px 10px",
  fontSize: "12px",
  boxShadow: "none",
};

const smallPrimaryButton: React.CSSProperties = {
  ...primaryButton,
  padding: "8px 10px",
  fontSize: "12px",
  boxShadow: "0 6px 12px rgba(37, 99, 235, 0.18)",
};

const cardGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: "12px",
};

const listBoxStyle: React.CSSProperties = {
  maxHeight: "260px",
  overflowY: "auto",
  border: "1px solid #e5e7eb",
  borderRadius: "8px",
  padding: "10px",
  background: "#ffffff",
};

const cardStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  padding: "14px",
  boxShadow: "0 6px 14px rgba(0, 0, 0, 0.08)",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const chipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  background: "#eef2ff",
  color: "#4338ca",
  borderRadius: "999px",
  fontSize: "12px",
  fontWeight: 600,
  width: "fit-content",
};

const supplierTitle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 700,
  color: "#111827",
  margin: 0,
};

const supplierMeta: React.CSSProperties = {
  fontSize: "13px",
  color: "#4b5563",
  margin: 0,
};

const closeButtonStyle: React.CSSProperties = {
  position: "absolute",
  top: "12px",
  right: "12px",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: "#6b7280",
  padding: "6px",
};

const editPanelStyle: React.CSSProperties = {
  marginTop: "16px",
  padding: "16px",
  border: "1px solid #e5e7eb",
  borderRadius: "12px",
  background: "#f9fafb",
  boxShadow: "inset 0 1px 0 #fff",
  display: "grid",
  gap: "10px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#374151",
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  fontSize: "14px",
  boxSizing: "border-box",
};

const dangerButton: React.CSSProperties = {
  padding: "10px 16px",
  background: "#dc2626",
  color: "white",
  border: "none",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
};

export default function OrdersModal({ open, onClose, items }: OrdersModalProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([
    {
      id: "1",
      name: "Kafa Plus",
      contact: "kontakt@kafaplus.ba",
      phone: "+387 61 222 333"
    },
    {
      id: "2",
      name: "Fresh Fruit",
      contact: "info@freshfruit.ba",
      phone: "+387 62 555 111"
    },
    {
      id: "3",
      name: "Pivara Craft",
      contact: "sales@pivaracraft.ba",
      phone: "+387 63 777 888"
    }
  ]);

  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [prepareOrderSupplierId, setPrepareOrderSupplierId] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showArticleList, setShowArticleList] = useState(false);
  const [editInfoMode, setEditInfoMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [supplierItems, setSupplierItems] = useState<Record<string, string[]>>({
    "1": [],
    "2": [],
    "3": [],
  });
  const [orderQuantities, setOrderQuantities] = useState<Record<string, Record<string, string>>>({});
  const [orders, setOrders] = useState<Order[]>([
    {
      id: "ord-1",
      supplierId: "1",
      date: "15.01.2026",
      status: "pending",
      items: [{ name: "Kafa Espresso", quantity: 10 }, { name: "Mlijeko", quantity: 5 }],
      totalItems: 2,
    },
    {
      id: "ord-2",
      supplierId: "1",
      date: "14.01.2026",
      status: "in-transit",
      items: [{ name: "\u0160e\u0107er", quantity: 20 }],
      totalItems: 1,
    },
    {
      id: "ord-3",
      supplierId: "2",
      date: "16.01.2026",
      status: "received",
      items: [{ name: "Limun", quantity: 30 }, { name: "Narand\u017ea", quantity: 25 }],
      totalItems: 2,
    },
  ]);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === selectedSupplierId) || null,
    [selectedSupplierId, suppliers]
  );

  const assignedItems = useMemo(() => {
    if (!selectedSupplierId) return [] as string[];
    return supplierItems[selectedSupplierId] || [];
  }, [selectedSupplierId, supplierItems]);

  const supplierCount = useMemo(() => suppliers.length, [suppliers]);

  const activeOrdersList = useMemo(
    () => orders.filter((o) => o.status === "pending" || o.status === "in-transit"),
    [orders]
  );

  const completedOrdersList = useMemo(
    () => orders.filter((o) => o.status === "received"),
    [orders]
  );

  useEffect(() => {
    if (selectedSupplier) {
      setEditName(selectedSupplier.name);
      setEditContact(selectedSupplier.contact);
      setEditPhone(selectedSupplier.phone || "");
    }
  }, [selectedSupplier]);

  const handleAddSupplier = () => {
    const name = prompt("Naziv dobavljača");
    if (!name || !name.trim()) return;
    const contact = prompt("Email ili kontakt dobavljača") || "";
    const phone = prompt("Telefon dobavljača") || "";
    const newSupplier: Supplier = {
      id: `${Date.now()}`,
      name: name.trim(),
      contact: contact.trim(),
      phone: phone.trim(),
    };
    setSuppliers((prev) => [...prev, newSupplier]);
    setSupplierItems((prev) => ({ ...prev, [newSupplier.id]: [] }));
    setSelectedSupplierId(newSupplier.id);
  };

  const handleSelectSupplier = (id: string) => {
    setSelectedSupplierId(id);
    setShowArticleList(false);
    setEditInfoMode(false);
  };

  const handleSaveSupplier = () => {
    if (!selectedSupplierId) return;
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === selectedSupplierId
          ? { ...s, name: editName.trim(), contact: editContact.trim(), phone: editPhone.trim() }
          : s
      )
    );
    setEditInfoMode(false);
  };

  const handleDeleteSupplier = () => {
    if (!selectedSupplierId) return;
    setSuppliers((prev) => prev.filter((s) => s.id !== selectedSupplierId));
    setSupplierItems((prev) => {
      const copy = { ...prev };
      delete copy[selectedSupplierId];
      return copy;
    });
    setSelectedSupplierId(null);
  };

  const toggleItem = (naziv: string) => {
    if (!selectedSupplierId) return;
    setSupplierItems((prev) => {
      const current = prev[selectedSupplierId] || [];
      const exists = current.includes(naziv);
      const next = exists ? current.filter((n) => n !== naziv) : [...current, naziv];
      return { ...prev, [selectedSupplierId]: next };
    });
  };

  const handleOrderQuantityChange = (itemName: string, value: string) => {
    if (!selectedSupplierId) return;
    setOrderQuantities((prev) => ({
      ...prev,
      [selectedSupplierId]: {
        ...(prev[selectedSupplierId] || {}),
        [itemName]: value,
      },
    }));
  };

  const handleCreateOrder = (supplier: Supplier) => {
    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      supplierId: supplier.id,
      date: new Date().toLocaleDateString("sr-RS"),
      status: "pending",
      items: [],
      totalItems: 0,
    };
    setOrders((prev) => [...prev, newOrder]);
    alert(`Narud\u017eba poslana za ${supplier.name}`);
  };

  if (!open) return null;

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <button aria-label="Zatvori" style={closeButtonStyle} onClick={onClose}>
          <FaTimes />
        </button>

        <div style={headerRowStyle}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h2 style={titleStyle}>Narudžbe / Dobavljači</h2>
            <p style={subtitleStyle}>Upravljaj dobavljačima i kreiraj narudžbe. Trenutno: {supplierCount} dobavljača.</p>
          </div>
          <div style={actionsRowStyle}>
            <button style={secondaryButton} onClick={handleAddSupplier}>
              <FaPlus /> Dodaj dobavljača
            </button>
          </div>
        </div>

        <div style={cardGridStyle}>
          {suppliers.map((supplier) => (
            <div key={supplier.id} style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                <h3 style={supplierTitle}>{supplier.name}</h3>
              </div>
              <span style={chipStyle}>Dobavljač</span>
              {supplier.contact && <p style={supplierMeta}>Kontakt: {supplier.contact}</p>}
              {supplier.phone && <p style={supplierMeta}>Telefon: {supplier.phone}</p>}
              
              {/* Active Orders Section */}
              {(() => {
                const activeOrders = orders.filter(o => o.supplierId === supplier.id && (o.status === "pending" || o.status === "in-transit"));
                const activeCount = activeOrders.length;
                
                return (
                  <>
                    {activeOrders.length > 0 && (
                      <div style={{ marginTop: "12px", borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                          Aktivne narud\u017ebe ({activeCount})
                        </div>
                        {activeOrders.slice(0, 2).map((order) => {
                          const statusConfig = {
                            pending: { label: "Na \u010dekanju", color: "#f59e0b", bg: "#fef3c7" },
                            "in-transit": { label: "U dostavi", color: "#3b82f6", bg: "#dbeafe" },
                            received: { label: "Primljeno", color: "#10b981", bg: "#d1fae5" },
                          };
                          const status = statusConfig[order.status];
                          
                          return (
                            <div key={order.id} style={{ background: "#f9fafb", padding: "10px", borderRadius: "8px", marginBottom: "8px", border: "1px solid #e5e7eb" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#1f2937" }}>#{order.id.split("-")[1]}</span>
                                  <span style={{ fontSize: "11px", color: "#6b7280" }}>{order.date}</span>
                                </div>
                                <span style={{ 
                                  fontSize: "11px", 
                                  fontWeight: 600, 
                                  color: status.color, 
                                  background: status.bg, 
                                  padding: "3px 8px", 
                                  borderRadius: "12px" 
                                }}>
                                  {status.label}
                                </span>
                              </div>
                              <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "8px" }}>
                                {order.totalItems} artikal{order.totalItems > 1 ? "a" : ""}
                              </div>
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button style={{ 
                                  padding: "5px 10px", 
                                  fontSize: "11px", 
                                  fontWeight: 600, 
                                  background: "#ffffff", 
                                  border: "1px solid #d1d5db", 
                                  borderRadius: "6px", 
                                  cursor: "pointer",
                                  color: "#374151",
                                  transition: "all 0.2s",
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
                                onMouseLeave={(e) => e.currentTarget.style.background = "#ffffff"}
                                onClick={() => alert(`Pregled narud\u017ebe ${order.id}`)}>
                                  Pregledaj
                                </button>
                                {order.status === "received" && (
                                  <button style={{ 
                                    padding: "5px 10px", 
                                    fontSize: "11px", 
                                    fontWeight: 600, 
                                    background: "#10b981", 
                                    border: "none", 
                                    borderRadius: "6px", 
                                    cursor: "pointer",
                                    color: "#ffffff",
                                    transition: "all 0.2s",
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = "#059669"}
                                  onMouseLeave={(e) => e.currentTarget.style.background = "#10b981"}
                                  onClick={() => alert(`Prihvati dostavu ${order.id}`)}>
                                    Prihvati
                                  </button>
                                )}
                                <button style={{ 
                                  padding: "5px 10px", 
                                  fontSize: "11px", 
                                  fontWeight: 600, 
                                  background: "#fee2e2", 
                                  border: "none", 
                                  borderRadius: "6px", 
                                  cursor: "pointer",
                                  color: "#dc2626",
                                  transition: "all 0.2s",
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = "#fecaca"}
                                onMouseLeave={(e) => e.currentTarget.style.background = "#fee2e2"}
                                onClick={() => alert(`Otka\u017ei narud\u017ebu ${order.id}`)}>
                                  Otka\u017ei
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {activeOrders.length > 2 && (
                          <button style={{ 
                            fontSize: "12px", 
                            color: "#3b82f6", 
                            fontWeight: 600, 
                            background: "none", 
                            border: "none", 
                            cursor: "pointer",
                            padding: "4px 0",
                          }}
                          onClick={() => alert(`Prika\u017ei sve narud\u017ebe za ${supplier.name}`)}>
                            Prika\u017ei sve ({activeOrders.length})
                          </button>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}

              <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap", alignItems: "center" }}>
                <button style={smallPrimaryButton} onClick={() => setPrepareOrderSupplierId(supplier.id)}>
                  <FaClipboardList /> Pripremi narudžbu
                </button>
                <button style={smallButton} onClick={() => handleSelectSupplier(supplier.id)}>
                  <FaEdit /> Uredi
                </button>
                <span style={{ ...supplierMeta, fontSize: "12px" }}>
                  { (supplierItems[supplier.id] || []).length } artikala
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Global Active Orders */}
        <div style={{ marginTop: "20px", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "16px", background: "#f9fafb", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#6b7280", fontWeight: 700, letterSpacing: "0.5px", marginBottom: "4px" }}>Aktivne narudžbe</div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#111827" }}>{activeOrdersList.length} u toku</div>
            </div>
            <button
              style={{ ...secondaryButton, padding: "8px 12px", fontSize: "13px" }}
              onClick={() => setShowHistoryModal(true)}
            >
              <FaClipboardList /> Historija narudžbi
            </button>
          </div>

          {activeOrdersList.length === 0 ? (
            <div style={{ padding: "12px", border: "1px dashed #d1d5db", borderRadius: "10px", background: "#ffffff", color: "#6b7280", fontSize: "13px" }}>
              Trenutno nema aktivnih narudžbi.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px" }}>
              {activeOrdersList.map((order) => {
                const supplier = suppliers.find((s) => s.id === order.supplierId);
                const statusConfig = {
                  pending: { label: "Na čekanju", color: "#f59e0b", bg: "#fef3c7" },
                  "in-transit": { label: "U dostavi", color: "#3b82f6", bg: "#dbeafe" },
                  received: { label: "Primljeno", color: "#10b981", bg: "#d1fae5" },
                } as const;
                const status = statusConfig[order.status];

                return (
                  <div key={order.id} style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#111827" }}>#{order.id.split("-")[1]}</span>
                        <span style={{ fontSize: "12px", color: "#6b7280" }}>{order.date}</span>
                      </div>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: status.color, background: status.bg, padding: "4px 10px", borderRadius: "12px", border: `1px solid ${status.color}20` }}>
                        {status.label}
                      </span>
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#1f2937", marginBottom: "4px" }}>{supplier?.name || "Nepoznat dobavljač"}</div>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "10px" }}>
                      {order.totalItems} artikal{order.totalItems !== 1 ? "a" : ""}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        style={{ ...smallButton, padding: "8px 10px", fontSize: "12px" }}
                        onClick={() => alert(`Pregled narudžbe ${order.id}`)}
                      >
                        Pregledaj
                      </button>
                      <button
                        style={{ ...smallButton, padding: "8px 10px", fontSize: "12px" }}
                        onClick={() => alert(`Otkaži narudžbu ${order.id}`)}
                      >
                        Otkaži
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selectedSupplier && (
          <div style={editPanelStyle}>
            <div style={{ borderBottom: "2px solid #e5e7eb", paddingBottom: "16px", marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 600, color: "#6b7280", letterSpacing: "0.5px", marginBottom: "4px" }}>Uređivanje dobavljača</div>
                  <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#111827" }}>{selectedSupplier.name}</h3>
                </div>
                <button style={{ ...dangerButton, fontSize: "13px", padding: "8px 16px" }} onClick={handleDeleteSupplier}>
                  <FaTimes /> Obriši
                </button>
              </div>

              <div style={{ background: "linear-gradient(to right, #f9fafb, #ffffff)", padding: "16px", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#111827", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "3px", height: "16px", background: "#3b82f6", borderRadius: "2px" }}></span>
                    Informacije dobavljača
                  </h4>
                  <button
                    onClick={() => {
                      if (editInfoMode) {
                        handleSaveSupplier();
                      } else {
                        setEditInfoMode(true);
                      }
                    }}
                    style={{
                      padding: "8px 16px",
                      background: editInfoMode ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "13px",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                      transition: "all 0.2s",
                    }}
                  >
                    <FaEdit /> {editInfoMode ? "Sačuvaj" : "Uredi"}
                  </button>
                </div>

                {editInfoMode ? (
                  <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                    <div>
                      <div style={{ ...labelStyle, fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>Naziv</div>
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} style={{ ...inputStyle, fontSize: "14px", padding: "10px 12px" }} />
                    </div>
                    <div>
                      <div style={{ ...labelStyle, fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>Kontakt (email)</div>
                      <input value={editContact} onChange={(e) => setEditContact(e.target.value)} style={{ ...inputStyle, fontSize: "14px", padding: "10px 12px" }} />
                    </div>
                    <div>
                      <div style={{ ...labelStyle, fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>Telefon</div>
                      <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} style={{ ...inputStyle, fontSize: "14px", padding: "10px 12px" }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                    <div style={{ background: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                      <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase" }}>Naziv</div>
                      <div style={{ fontSize: "14px", color: "#111827", fontWeight: 600 }}>{selectedSupplier?.name}</div>
                    </div>
                    <div style={{ background: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                      <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase" }}>Kontakt</div>
                      <div style={{ fontSize: "14px", color: "#111827", fontWeight: 600 }}>{selectedSupplier?.contact}</div>
                    </div>
                    {selectedSupplier?.phone && (
                      <div style={{ background: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                        <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase" }}>Telefon</div>
                        <div style={{ fontSize: "14px", color: "#111827", fontWeight: 600 }}>{selectedSupplier.phone}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", flexWrap: "wrap", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #e5e7eb" }}>
              <button 
                style={{ 
                  padding: "10px 20px", 
                  background: "#f3f4f6", 
                  border: "1px solid #d1d5db", 
                  borderRadius: "8px", 
                  cursor: "pointer", 
                  fontSize: "14px", 
                  fontWeight: 600, 
                  color: "#374151",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.2s",
                }}
                onClick={() => setSelectedSupplierId(null)}
                onMouseEnter={(e) => e.currentTarget.style.background = "#e5e7eb"}
                onMouseLeave={(e) => e.currentTarget.style.background = "#f3f4f6"}
              >
                <FaTimes /> Zatvori
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Prepare Order Modal */}
      {prepareOrderSupplierId && (() => {
        const supplier = suppliers.find((s) => s.id === prepareOrderSupplierId);
        if (!supplier) return null;
        const assignedItems = supplierItems[prepareOrderSupplierId] || [];
        return (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.65)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10001,
            }}
            onClick={() => setPrepareOrderSupplierId(null)}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: "12px",
                maxWidth: "900px",
                width: "90%",
                maxHeight: "85vh",
                overflow: "auto",
                boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", padding: "20px", borderTopLeftRadius: "12px", borderTopRightRadius: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 600, color: "rgba(255,255,255,0.8)", letterSpacing: "0.5px", marginBottom: "4px" }}>Priprema narudžbe</div>
                    <h3 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#ffffff" }}>{supplier.name}</h3>
                    <p style={{ margin: "4px 0 0", fontSize: "13px", color: "rgba(255,255,255,0.9)" }}>{supplier.contact}</p>
                  </div>
                  <button
                    onClick={() => setPrepareOrderSupplierId(null)}
                    style={{
                      background: "rgba(255,255,255,0.2)",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "20px",
                      color: "#ffffff",
                      padding: "8px",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.3)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}
                  >
                    <FaTimes />
                  </button>
                </div>
              </div>

              <div style={{ padding: "24px" }}>
                {/* Add Articles Section */}
                <div style={{ marginBottom: "24px" }}>
                  <button
                    onClick={() => setShowArticleList(!showArticleList)}
                    style={{
                      padding: "12px 20px",
                      background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      width: "100%",
                      justifyContent: "center",
                      boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)",
                    }}
                  >
                    <FaPlus /> Dodaj artikal
                  </button>

                  {showArticleList && (
                    <div style={{ marginTop: "16px", maxHeight: "250px", overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px", background: "#f9fafb" }}>
                      {items.filter((item: { naziv: string; pocetnoStanje?: number }) => !assignedItems.includes(item.naziv)).map((item: { naziv: string; pocetnoStanje?: number }) => {
                        return (
                          <label key={item.naziv} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", fontSize: "13px", color: "#1f2937", cursor: "pointer", borderRadius: "6px", transition: "background 0.2s", background: "transparent" }}
                            onMouseEnter={(e) => e.currentTarget.style.background = "#ffffff"}
                            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                          >
                            <input
                              type="checkbox"
                              checked={false}
                              onChange={() => {
                                const current = supplierItems[prepareOrderSupplierId] || [];
                                setSupplierItems((prev) => ({
                                  ...prev,
                                  [prepareOrderSupplierId]: [...current, item.naziv],
                                }));
                              }}
                              style={{ width: "18px", height: "18px", cursor: "pointer" }}
                            />
                            <span style={{ fontWeight: 500 }}>{item.naziv}</span>
                          </label>
                        );
                      })}
                      {items.filter((item: { naziv: string; pocetnoStanje?: number }) => !assignedItems.includes(item.naziv)).length === 0 && (
                        <p style={{ textAlign: "center", margin: "16px 0", color: "#6b7280", fontSize: "13px" }}>Svi artikli su dodani.</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Order Table */}
                {assignedItems.length > 0 ? (
                  <div style={{ background: "#ffffff", borderRadius: "10px", border: "1px solid #e5e7eb", overflow: "hidden" }}>
                    <div style={{ background: "linear-gradient(to right, #f9fafb, #ffffff)", padding: "14px 20px", borderBottom: "2px solid #e5e7eb" }}>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Lista artikala za narudžbu ({assignedItems.length})
                      </div>
                    </div>
                    <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead style={{ position: "sticky", top: 0, background: "#ffffff", zIndex: 1, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                          <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                            <th style={{ padding: "14px 20px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>Artikal</th>
                            <th style={{ padding: "14px 20px", textAlign: "right", fontSize: "12px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>Trenutno stanje</th>
                            <th style={{ padding: "14px 20px", textAlign: "right", fontSize: "12px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>Narudžba</th>
                            <th style={{ padding: "14px 20px", textAlign: "center", fontSize: "12px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", width: "60px" }}>Akcija</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assignedItems.map((naziv, idx) => {
                            const itemData = items.find((i: { naziv: string; pocetnoStanje?: number }) => i.naziv === naziv);
                            const currentStock = itemData?.pocetnoStanje || 0;
                            const orderQty = prepareOrderSupplierId ? ((orderQuantities[prepareOrderSupplierId] || {})[naziv] || "") : "";
                            return (
                              <tr key={naziv} style={{ borderBottom: idx < assignedItems.length - 1 ? "1px solid #f3f4f6" : "none", transition: "background 0.15s" }}
                                onMouseEnter={(e) => e.currentTarget.style.background = "#f9fafb"}
                                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                              >
                                <td style={{ padding: "16px 20px", fontSize: "14px", color: "#111827", fontWeight: 600 }}>{naziv}</td>
                                <td style={{ padding: "16px 20px", fontSize: "14px", color: "#6b7280", fontWeight: 500, textAlign: "right" }}>{currentStock.toFixed(2)}</td>
                                <td style={{ padding: "16px 20px", textAlign: "right" }}>
                                  <input
                                    type="number"
                                    step="1"
                                    value={orderQty}
                                    onChange={(e) => {
                                      setOrderQuantities((prev) => ({
                                        ...prev,
                                        [prepareOrderSupplierId]: {
                                          ...(prev[prepareOrderSupplierId] || {}),
                                          [naziv]: e.target.value,
                                        },
                                      }));
                                    }}
                                    placeholder="0"
                                    style={{ 
                                      width: "110px", 
                                      padding: "10px 14px", 
                                      border: "2px solid #d1d5db", 
                                      borderRadius: "8px", 
                                      fontSize: "14px", 
                                      textAlign: "right",
                                      fontWeight: 600,
                                      color: "#111827",
                                      transition: "border-color 0.2s",
                                      MozAppearance: "textfield" as any,
                                      WebkitAppearance: "none" as any,
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
                                    onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
                                  />
                                  <style>{`
                                    input[type=number]::-webkit-inner-spin-button,
                                    input[type=number]::-webkit-outer-spin-button {
                                      -webkit-appearance: none;
                                      margin: 0;
                                    }
                                  `}</style>
                                </td>
                                <td style={{ padding: "16px 20px", textAlign: "center" }}>
                                  <button
                                    onClick={() => {
                                      const current = supplierItems[prepareOrderSupplierId] || [];
                                      setSupplierItems((prev) => ({
                                        ...prev,
                                        [prepareOrderSupplierId]: current.filter((n) => n !== naziv),
                                      }));
                                    }}
                                    style={{
                                      background: "#fee2e2",
                                      border: "none",
                                      cursor: "pointer",
                                      padding: "8px 12px",
                                      color: "#dc2626",
                                      fontSize: "14px",
                                      borderRadius: "6px",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      transition: "all 0.2s",
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = "#fecaca";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = "#fee2e2";
                                    }}
                                  >
                                    <FaTimes />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: "#ffffff", padding: "40px", borderRadius: "10px", border: "2px dashed #d1d5db", textAlign: "center" }}>
                    <p style={{ fontSize: "14px", color: "#9ca3af", margin: 0, fontWeight: 500 }}>Još nema dodanih artikala za narudžbu.</p>
                    <p style={{ fontSize: "13px", color: "#d1d5db", margin: "4px 0 0", fontWeight: 400 }}>Kliknite "Dodaj artikal" da počnete.</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #e5e7eb" }}>
                  <button
                    onClick={() => setPrepareOrderSupplierId(null)}
                    style={{
                      padding: "12px 24px",
                      background: "#f3f4f6",
                      border: "1px solid #d1d5db",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#374151",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#e5e7eb"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "#f3f4f6"}
                  >
                    Odustani
                  </button>
                  <button
                    onClick={() => {
                      alert(`Narudžba poslana za ${supplier.name}`);
                      setPrepareOrderSupplierId(null);
                    }}
                    style={{
                      padding: "12px 24px",
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#fff",
                      boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                      transition: "all 0.2s",
                    }}
                  >
                    Pošalji narudžbu
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* History Modal */}
      {showHistoryModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10002,
          }}
          onClick={() => setShowHistoryModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              width: "90%",
              maxWidth: "900px",
              maxHeight: "80vh",
              overflow: "auto",
              boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#6b7280", fontWeight: 700, letterSpacing: "0.5px", marginBottom: "4px" }}>Historija narudžbi</div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "#111827" }}>{completedOrdersList.length} završenih</div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                style={{ ...secondaryButton, padding: "8px 12px", fontSize: "13px" }}
              >
                Zatvori
              </button>
            </div>

            <div style={{ padding: "16px" }}>
              {completedOrdersList.length === 0 ? (
                <div style={{ padding: "12px", border: "1px dashed #d1d5db", borderRadius: "10px", background: "#f9fafb", color: "#6b7280", fontSize: "13px" }}>
                  Još nema završenih narudžbi.
                </div>
              ) : (
                <div style={{ border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                        <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#6b7280" }}>ID</th>
                        <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#6b7280" }}>Dobavljač</th>
                        <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#6b7280" }}>Datum</th>
                        <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#6b7280" }}>Stavki</th>
                        <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#6b7280" }}>Akcije</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedOrdersList.map((order) => {
                        const supplier = suppliers.find((s) => s.id === order.supplierId);
                        return (
                          <tr key={order.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                            <td style={{ padding: "10px", fontSize: "13px", color: "#111827", fontWeight: 700 }}>#{order.id.split("-")[1]}</td>
                            <td style={{ padding: "10px", fontSize: "13px", color: "#374151" }}>{supplier?.name || "Nepoznat"}</td>
                            <td style={{ padding: "10px", fontSize: "13px", color: "#6b7280" }}>{order.date}</td>
                            <td style={{ padding: "10px", fontSize: "13px", color: "#6b7280" }}>{order.totalItems}</td>
                            <td style={{ padding: "10px", display: "flex", gap: "8px" }}>
                              <button
                                style={{ ...smallButton, padding: "8px 10px", fontSize: "12px" }}
                                onClick={() => alert(`Pregled narudžbe ${order.id}`)}
                              >
                                Detalji
                              </button>
                              <button
                                style={{ ...smallButton, padding: "8px 10px", fontSize: "12px" }}
                                onClick={() => alert(`Ponovi narudžbu ${order.id}`)}
                              >
                                Ponovi
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
