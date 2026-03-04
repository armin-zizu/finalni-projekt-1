"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "./ToastContext";
import { FaPlus, FaTimes, FaEdit, FaClipboardList } from "react-icons/fa";
import { uploadFile } from "../../lib/api";
// ...existing code...

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
  orderedAt?: string;
  receivedAt?: string;
  wasEdited?: boolean;
  editedAt?: string;
  invoiceProofImages?: Array<{ name: string; url: string; dataUrl?: string } | string>;
  status: "pending" | "in-transit" | "received" | "completed";
  items: Array<{ name: string; quantity: number }>;
  totalItems: number;
}

interface OrdersModalProps {
  open: boolean;
  onClose: () => void;
  userId?: string;
  items: Array<{ naziv: string; pocetnoStanje?: number }>;
  onRefreshItems?: (setOrdersCb?: (orders: any[]) => void) => Promise<void> | void;
  onInvoiceAccepted?: (
    date: string,
    items: Array<{ name: string; quantity: number }>,
    meta?: { invoiceId?: string; supplierId?: string }
  ) => void;
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

export default function OrdersModal({ open, onClose, userId, items, onRefreshItems, onInvoiceAccepted }: OrdersModalProps) {
  const toast = useToast();
  const LAST_REFRESH_STORAGE_KEY = 'ordersLastItemsRefreshAt';
  const getCurrentTimeString = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('suppliers');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse suppliers from localStorage:', e);
        }
      }
    }
    return [
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
    ];
  });

  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [prepareOrderSupplierId, setPrepareOrderSupplierId] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showArticleList, setShowArticleList] = useState(false);
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);
  const [editInfoMode, setEditInfoMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [supplierItems, setSupplierItems] = useState<Record<string, string[]>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('supplierItems');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse supplierItems from localStorage:', e);
        }
      }
    }
    return {
      "1": [],
      "2": [],
      "3": [],
    };
  });
  const [orderQuantities, setOrderQuantities] = useState<Record<string, Record<string, string>>>({});
  const supplierItemsRef = useRef<Record<string, string[]>>({});
  const [orders, setOrders] = useState<Order[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('orders');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse orders from localStorage:', e);
        }
      }
    }
    return [];
  });

  const [isMobile, setIsMobile] = useState(false);
  const [isRefreshingItems, setIsRefreshingItems] = useState(false);
  const [lastItemsRefreshAt, setLastItemsRefreshAt] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(LAST_REFRESH_STORAGE_KEY);
  });
  const [uploadingProofOrderId, setUploadingProofOrderId] = useState<string | null>(null);
  const [isEditingOrderDetails, setIsEditingOrderDetails] = useState(false);
  const [orderEditDraft, setOrderEditDraft] = useState<Array<{ name: string; quantity: string }>>([]);
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [deletingSupplier, setDeletingSupplier] = useState(false);

  const formatDateTimeLabel = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year}. ${hours}:${minutes}`;
  };

  useEffect(() => {
    // Detektuj mobilnu verziju
    const checkMobile = () => {
      setIsMobile(typeof window !== 'undefined' && window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!viewOrderId) {
      setIsEditingOrderDetails(false);
      setOrderEditDraft([]);
      return;
    }

    const order = orders.find((o) => o.id === viewOrderId);
    if (!order) {
      setIsEditingOrderDetails(false);
      setOrderEditDraft([]);
      return;
    }

    setIsEditingOrderDetails(false);
    setOrderEditDraft(order.items.map((item) => ({ name: item.name, quantity: String(item.quantity) })));
  }, [viewOrderId, orders]);

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
    () => orders.filter((o) => o.status === "pending" || o.status === "in-transit" || o.status === "received"),
    [orders]
  );

  const completedOrdersList = useMemo(
    () => orders.filter((o) => o.status === "completed"),
    [orders]
  );

  useEffect(() => {
    if (selectedSupplier) {
      setEditName(selectedSupplier.name);
      setEditContact(selectedSupplier.contact);
      setEditPhone(selectedSupplier.phone || "");
    }
  }, [selectedSupplier]);

  // Helper function to refresh orders
  const refreshOrdersFromServer = async () => {
    if (!userId) return;
    try {
      const { getOrders } = await import("../../lib/api");
      console.log("🔄 Osvežavam narudžbe sa servera...");
      const serverOrders = await getOrders(userId);
      if (Array.isArray(serverOrders) && serverOrders.length > 0) {
        console.log("✅ Osvežene narudžbe sa servera:", serverOrders.length, "narudžbi");
        setOrders(serverOrders);
        localStorage.setItem('orders', JSON.stringify(serverOrders));
      } else {
        // Ako nema na serveru, učitaj iz localStorage-a
        const savedOrders = localStorage.getItem('orders');
        if (savedOrders) {
          try {
            const parsed = JSON.parse(savedOrders);
            setOrders(parsed);
          } catch (e) {
            console.error('❌ Greška pri parsiranju orders:', e);
          }
        }
      }
    } catch (e) {
      console.error('❌ Greška pri osvežavanju narudžbi sa servera:', e);
      // Fallback na localStorage
      const savedOrders = localStorage.getItem('orders');
      if (savedOrders) {
        try {
          const parsed = JSON.parse(savedOrders);
          setOrders(parsed);
        } catch (e) {
          console.error('❌ Greška pri parsiranju orders:', e);
        }
      }
    }
  };

  // Refresh localStorage data when modal opens (important for mobile)
  useEffect(() => {
    if (open && typeof window !== "undefined") {
      console.log("🔄 Osvežavanje OrdersModal podataka pri otvaranju");

      const savedLastRefresh = localStorage.getItem(LAST_REFRESH_STORAGE_KEY);
      if (savedLastRefresh) {
        setLastItemsRefreshAt(savedLastRefresh);
      }
      
      // Refresh suppliers
      const savedSuppliers = localStorage.getItem('suppliers');
      if (savedSuppliers) {
        try {
          const parsed = JSON.parse(savedSuppliers);
          console.log("📥 Učitani suppliers:", parsed.length, "stavki");
          setSuppliers(parsed);
        } catch (e) {
          console.error('❌ Greška pri parsiranju suppliers:', e);
        }
      }
      
      // Refresh supplierItems
      const savedSupplierItems = localStorage.getItem('supplierItems');
      if (savedSupplierItems) {
        try {
          const parsed = JSON.parse(savedSupplierItems);
          console.log("📥 Učitani supplierItems:", Object.keys(parsed).length, "dobavljača");
          setSupplierItems(parsed);
        } catch (e) {
          console.error('❌ Greška pri parsiranju supplierItems:', e);
        }
      }
      
      // Refresh orders
      refreshOrdersFromServer();
    }
  }, [open, userId]);

  // Refresh orders when user returns focus to the window/tab
  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    const handleFocus = () => {
      console.log("👁️ Korisnik se vratio na tab - osvežavam narudžbe");
      refreshOrdersFromServer();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log("👁️ Tab je sada vidljiv - osvežavam narudžbe");
        refreshOrdersFromServer();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [open, userId]);

  // Save suppliers to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('suppliers', JSON.stringify(suppliers));
    }
  }, [suppliers]);

  // Save supplierItems to localStorage
  useEffect(() => {
    supplierItemsRef.current = supplierItems;
    if (typeof window !== 'undefined') {
      localStorage.setItem('supplierItems', JSON.stringify(supplierItems));
    }
  }, [supplierItems]);

  const updateSupplierItemsForSupplier = (
    supplierId: string | null,
    updater: (currentItems: string[]) => string[]
  ) => {
    if (!supplierId) return;
    setSupplierItems((prev) => {
      const currentItems = prev[supplierId] || [];
      const nextItems = Array.from(new Set(updater(currentItems)));
      const nextState = {
        ...prev,
        [supplierId]: nextItems,
      };

      supplierItemsRef.current = nextState;
      if (typeof window !== 'undefined') {
        localStorage.setItem('supplierItems', JSON.stringify(nextState));
      }

      return nextState;
    });
  };

  // Save orders to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('orders', JSON.stringify(orders));
    }
  }, [orders]);

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

  const handleSaveSupplier = async () => {
    if (!selectedSupplierId) return;
    try {
      setSavingSupplier(true);
      // Simulate API call if needed
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setSuppliers((prev) =>
        prev.map((s) =>
          s.id === selectedSupplierId
            ? { ...s, name: editName.trim(), contact: editContact.trim(), phone: editPhone.trim() }
            : s
        )
      );
      toast.showToast("Dobavljač je sačuvan.", "success");
      setEditInfoMode(false);
    } catch (error: any) {
      console.error("Greška pri čuvanju dobavljača:", error);
      toast.showToast(`Greška: ${error?.message || "Nepoznata greška"}`, "error");
    } finally {
      setSavingSupplier(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!selectedSupplierId) return;
    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    if (!supplier) return;
    
    try {
      setDeletingSupplier(true);
      // Simulate API call if needed
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setSuppliers((prev) => prev.filter((s) => s.id !== selectedSupplierId));
      setSupplierItems((prev) => {
        const copy = { ...prev };
        delete copy[selectedSupplierId];
        return copy;
      });
      setOrderQuantities((prev) => {
        const copy = { ...prev };
        delete copy[selectedSupplierId];
        return copy;
      });
      setOrders((prev) => prev.filter((o) => o.supplierId !== selectedSupplierId));
      setSelectedSupplierId(null);
      toast.showToast(`Dobavljač "${supplier.name}" je trajno obrisan.`, "success");
    } catch (error: any) {
      console.error("Greška pri brisanju dobavljača:", error);
      toast.showToast(`Greška: ${error?.message || "Nepoznata greška"}`, "error");
    } finally {
      setDeletingSupplier(false);
    }
  };

  const toggleItem = (naziv: string) => {
    updateSupplierItemsForSupplier(selectedSupplierId, (current) => {
      const exists = current.includes(naziv);
      return exists ? current.filter((n) => n !== naziv) : [...current, naziv];
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
    const assigned = supplierItems[supplier.id] || [];
    const quantities = orderQuantities[supplier.id] || {};

    const orderItems = assigned
      .map((name) => ({ name, quantity: Number(quantities[name] || 0) || 0 }))
      .filter((item) => item.quantity > 0);

    if (orderItems.length === 0) {
      toast.showToast("Unesite količinu za barem jedan artikal.", "error");
      return;
    }

    // Format date consistently: DD.MM.YYYY.
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const formattedDate = `${day}.${month}.${year}.`;

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      supplierId: supplier.id,
      date: formattedDate,
      orderedAt: getCurrentTimeString(),
      status: "pending",
      items: orderItems,
      totalItems: orderItems.length,
    };

    setOrders((prev) => [newOrder, ...prev]);
    setOrderQuantities((prev) => ({ ...prev, [supplier.id]: {} }));
    toast.showToast(`Narudžba poslana za ${supplier.name}`, "success");
    setPrepareOrderSupplierId(null);
  };

  const handleAddInvoiceProof = async (orderId: string, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    if (uploadingProofOrderId === orderId) return;

    const files = Array.from(fileList).slice(0, 5);
    const toast = useToast();
    try {
      setUploadingProofOrderId(orderId);
      const uploadedFiles = await Promise.all(
        files.map(async (file, index) => {
          const uploaded = await uploadFile(file, 'invoice-proof');
          return {
            name: file.name || `faktura-${Date.now()}-${index + 1}.jpg`,
            url: uploaded?.url,
          };
        })
      );
      const nextFiles = uploadedFiles.filter((item) => !!item.url);
      setOrders((prev) =>
        prev.map((order) => {
          if (order.id !== orderId) return order;
          const existing = order.invoiceProofImages || [];
          const next = [...existing, ...nextFiles].slice(0, 10);
          return { ...order, invoiceProofImages: next };
        })
      );
      toast.showToast(`Dodano ${nextFiles.length} slika fakture kao dokaz.`, "success");
    } catch (e) {
      console.error("Greška pri dodavanju slike fakture:", e);
      toast.showToast("Greška pri dodavanju slike fakture.", "error");
    } finally {
      setUploadingProofOrderId(null);
    }
  };

  const getInvoiceProofFiles = (order: Order): Array<{ name: string; url: string }> => {
    const raw = order.invoiceProofImages || [];
    return raw
      .map((entry, idx) => {
        if (typeof entry === 'string') {
          return {
            name: `faktura-${idx + 1}.jpg`,
            url: entry,
          };
        }

        return {
          name: entry?.name || `faktura-${idx + 1}.jpg`,
          url: entry?.url || entry?.dataUrl || '',
        };
      })
      .filter((entry) => !!entry.url);
  };

  const handleRefreshItems = async () => {
    if (!onRefreshItems || isRefreshingItems) return;
    try {
      setIsRefreshingItems(true);
      await onRefreshItems((ordersFromApi: any[]) => {
        if (Array.isArray(ordersFromApi)) {
          setOrders(ordersFromApi);
        }
      });
      const refreshLabel = formatDateTimeLabel(new Date());
      setLastItemsRefreshAt(refreshLabel);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LAST_REFRESH_STORAGE_KEY, refreshLabel);
      }
      toast.showToast("Stanje artikala i narudžbi je osvježeno.", "success");
    } catch (e: any) {
      console.error("Greška pri osvježavanju stanja artikala/narudžbi:", e);
      toast.showToast(`Greška pri osvježavanju: ${e?.message || "Nepoznata greška"}`, "error");
    } finally {
      setIsRefreshingItems(false);
    }
  };

  const handleRemoveInvoiceProof = (orderId: string, imageIndex: number) => {
    setOrders((prev) =>
      prev.map((order) => {
        if (order.id !== orderId) return order;
        const currentImages = order.invoiceProofImages || [];
        return {
          ...order,
          invoiceProofImages: currentImages.filter((_, idx) => idx !== imageIndex),
        };
      })
    );
  };

  const handleStartEditOrder = (order: Order) => {
    if (order.status === "completed") return;
    setOrderEditDraft(order.items.map((item) => ({ name: item.name, quantity: String(item.quantity) })));
    setIsEditingOrderDetails(true);
  };

  const handleDraftQuantityChange = (index: number, value: string) => {
    setOrderEditDraft((prev) => prev.map((entry, idx) => (idx === index ? { ...entry, quantity: value } : entry)));
  };

  const handleRemoveDraftItem = (index: number) => {
    setOrderEditDraft((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveOrderEdit = async (orderId: string) => {
    try {
      setLoadingOrderId(orderId);
      // Simulate API call if needed
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const sanitized = orderEditDraft
        .map((entry) => ({
          name: entry.name,
          quantity: Number(entry.quantity || 0),
        }))
        .filter((entry) => entry.quantity > 0);

      if (sanitized.length === 0) {
        toast.showToast("Narudžba mora imati barem jedan artikal sa količinom većom od 0.", "error");
        return;
      }

      const currentOrder = orders.find((order) => order.id === orderId);
      if (!currentOrder) return;

      const isChanged =
        sanitized.length !== currentOrder.items.length ||
        sanitized.some((entry, idx) => {
          const currentItem = currentOrder.items[idx];
          return !currentItem || currentItem.name !== entry.name || currentItem.quantity !== entry.quantity;
        });

      setOrders((prev) =>
        prev.map((order) => {
          if (order.id !== orderId) return order;
          if (!isChanged) return order;
          return {
            ...order,
            items: sanitized,
            totalItems: sanitized.length,
            wasEdited: true,
            editedAt: getCurrentTimeString(),
          };
        })
      );

      setIsEditingOrderDetails(false);
      if (isChanged) {
        toast.showToast("Narudžba je uređena i sačuvana.", "success");
      }
    } catch (error: any) {
      console.error("Greška pri čuvanju narudžbe:", error);
      toast.showToast(`Greška: ${error?.message || "Nepoznata greška"}`, "error");
    } finally {
      setLoadingOrderId(null);
    }
  };

  const handleInvoiceOrder = async (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    
    try {
      setLoadingOrderId(orderId);
      // Simulate API call if needed
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Odmah prihvati fakturu, bez potvrde
      const dateParts = order.date.split('.');
      let formattedDate = order.date;
      if (dateParts.length >= 3) {
        const day = dateParts[0].padStart(2, '0');
        const month = dateParts[1].padStart(2, '0');
        const year = dateParts[2];
        formattedDate = `${day}.${month}.${year}.`;
      }
      if (onInvoiceAccepted) {
        onInvoiceAccepted(formattedDate, order.items, {
          invoiceId: order.id,
          supplierId: order.supplierId,
        });
      }
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: "completed" as const, receivedAt: getCurrentTimeString() } : o
        )
      );
      toast.showToast("Faktura je uspješno prihvaćena! Artikli su prebačeni na obračun.", "success");
      setViewOrderId(null);
      setPrepareOrderSupplierId(null);
      setShowArticleList(false);
    } catch (error: any) {
      console.error("Greška pri prihvatanju fakture:", error);
      toast.showToast(`Greška: ${error?.message || "Nepoznata greška"}`, "error");
    } finally {
      setLoadingOrderId(null);
    }
  };

  const renderSupplierEditor = (supplier: Supplier, inlineMobile: boolean) => (
    <div
      style={
        inlineMobile
          ? {
              marginTop: "12px",
              padding: "12px",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
              background: "#f9fafb",
              boxShadow: "inset 0 1px 0 #fff",
              display: "grid",
              gap: "10px",
            }
          : editPanelStyle
      }
    >
      <div style={{ borderBottom: "2px solid #e5e7eb", paddingBottom: "8px", marginBottom: "10px" }}>
        <div style={{ marginBottom: "16px" }}>
          <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 600, color: "#6b7280", letterSpacing: "0.5px", marginBottom: "4px" }}>Uređivanje dobavljača</div>
          <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#111827" }}>{supplier.name}</h3>
        </div>

        <div style={{ background: "linear-gradient(to right, #f9fafb, #ffffff)", padding: "16px", borderRadius: "10px", border: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#111827", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "3px", height: "16px", background: "#3b82f6", borderRadius: "2px" }}></span>
              Informacije dobavljača
            </h4>
            <button
              disabled={savingSupplier}
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
                cursor: savingSupplier ? "not-allowed" : "pointer",
                fontSize: "13px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                transition: "all 0.2s",
                opacity: savingSupplier ? 0.6 : 1,
              }}
            >
              <FaEdit /> {savingSupplier ? "Čuva se..." : editInfoMode ? "Sačuvaj" : "Uredi"}
            </button>
          </div>

          {editInfoMode ? (
            <div style={{ display: "grid", gap: "14px", gridTemplateColumns: inlineMobile ? "1fr" : "repeat(auto-fit, minmax(220px, 1fr))" }}>
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
            <div style={{ display: "grid", gridTemplateColumns: inlineMobile ? "1fr" : "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
              <div style={{ background: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase" }}>Naziv</div>
                <div style={{ fontSize: "14px", color: "#111827", fontWeight: 600 }}>{supplier.name}</div>
              </div>
              <div style={{ background: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase" }}>Kontakt</div>
                <div style={{ fontSize: "14px", color: "#111827", fontWeight: 600 }}>{supplier.contact}</div>
              </div>
              {supplier.phone && (
                <div style={{ background: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase" }}>Telefon</div>
                  <div style={{ fontSize: "14px", color: "#111827", fontWeight: 600 }}>{supplier.phone}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", flexWrap: "wrap", marginTop: "4px", paddingTop: "6px", borderTop: "1px solid #e5e7eb" }}>
        <button
          disabled={deletingSupplier}
          style={{ ...dangerButton, fontSize: "13px", padding: "10px 16px", cursor: deletingSupplier ? "not-allowed" : "pointer", opacity: deletingSupplier ? 0.6 : 1 }}
          onClick={handleDeleteSupplier}
        >
          <FaTimes /> {deletingSupplier ? "Briše se..." : "Obriši"}
        </button>
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
  );
  if (!open) return null;
  return (
    <div style={overlayStyle}>
      <style>{`
        .orders-number-input {
          -moz-appearance: textfield;
          appearance: textfield;
        }
        .orders-number-input::-webkit-outer-spin-button,
        .orders-number-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>
      <div style={modalStyle}>
        <button aria-label="Zatvori" style={closeButtonStyle} onClick={onClose}>
          <FaTimes />
        </button>

        <div style={headerRowStyle}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h2 style={titleStyle}>Narudžbe / Dobavljači</h2>
            <p style={subtitleStyle}>Upravljaj dobavljačima i kreiraj narudžbe. Trenutno: {supplierCount} dobavljača.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px", transform: "translateX(-12px)" }}>
            <div style={actionsRowStyle}>
              <button
                style={{
                  ...secondaryButton,
                  background: isRefreshingItems ? "#a78bfa" : "#8b5cf6",
                  border: "1px solid #7c3aed",
                  color: "#ffffff",
                  cursor: isRefreshingItems ? "not-allowed" : "pointer",
                  opacity: isRefreshingItems ? 0.85 : 1,
                }}
                onClick={handleRefreshItems}
                disabled={isRefreshingItems || !onRefreshItems}
              >
                {isRefreshingItems ? "Osvježavam..." : "Osvježi stanje"}
              </button>
              <button style={secondaryButton} onClick={handleAddSupplier}>
                <FaPlus /> Dodaj dobavljača
              </button>
            </div>
            <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 500 }}>
              Zadnje osvježeno: {lastItemsRefreshAt || "nije osvježeno"}
            </div>
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

              {isMobile && selectedSupplierId === supplier.id && renderSupplierEditor(supplier, true)}
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
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(260px, 1fr))", 
              gap: isMobile ? "12px" : "10px"
            }}>
              {activeOrdersList.map((order) => {
                const supplier = suppliers.find((s) => s.id === order.supplierId);
                const statusConfig = {
                  pending: { label: "Na čekanju", color: "#f59e0b", bg: "#fef3c7" },
                  "in-transit": { label: "U dostavi", color: "#3b82f6", bg: "#dbeafe" },
                  received: { label: "Primljeno", color: "#10b981", bg: "#d1fae5" },
                  completed: { label: "Završeno", color: "#6b7280", bg: "#f3f4f6" },
                } as const;
                const status = statusConfig[order.status];

                return (
                  <div key={order.id} style={{ 
                    background: "#ffffff", 
                    border: "1px solid #e5e7eb", 
                    borderRadius: isMobile ? "12px" : "10px", 
                    padding: isMobile ? "16px" : "12px", 
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px"
                  }}>
                    {/* Header row - Broj narudžbe, datum i status */}
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: isMobile ? "flex-start" : "center", 
                      gap: "12px",
                      flexWrap: isMobile ? "wrap" : "nowrap"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "6px" : "8px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: isMobile ? "13px" : "12px", fontWeight: 700, color: "#111827", background: "#f3f4f6", padding: "4px 8px", borderRadius: "6px" }}>
                          #{order.id.split("-")[1]}
                        </span>
                        <span style={{ fontSize: isMobile ? "13px" : "12px", color: "#6b7280" }}>{order.date}</span>
                        <span style={{ fontSize: isMobile ? "12px" : "11px", color: "#6b7280" }}>Naručeno: {order.orderedAt || "-"}</span>
                        {order.receivedAt && (
                          <span style={{ fontSize: isMobile ? "12px" : "11px", color: "#059669", fontWeight: 600 }}>Primljeno: {order.receivedAt}</span>
                        )}
                      </div>
                      <span style={{ 
                        fontSize: isMobile ? "12px" : "11px", 
                        fontWeight: 700, 
                        color: status.color, 
                        background: status.bg, 
                        padding: isMobile ? "6px 12px" : "4px 10px", 
                        borderRadius: "12px", 
                        border: `1px solid ${status.color}20`,
                        whiteSpace: "nowrap"
                      }}>
                        {status.label}
                      </span>
                    </div>
                    
                    {/* Dobavljač i broj artikala */}
                    <div style={{ 
                      background: "#f9fafb", 
                      padding: isMobile ? "12px" : "10px", 
                      borderRadius: "8px",
                      borderLeft: "4px solid #3b82f6"
                    }}>
                      <div style={{ fontSize: isMobile ? "14px" : "13px", fontWeight: 700, color: "#1f2937", marginBottom: "4px" }}>
                        {supplier?.name || "Nepoznat dobavljač"}
                      </div>
                      <div style={{ fontSize: isMobile ? "13px" : "12px", color: "#6b7280" }}>
                        {order.totalItems} artikal{order.totalItems !== 1 ? "a" : ""}
                      </div>
                      <div style={{ fontSize: isMobile ? "12px" : "11px", color: "#6b7280", marginTop: "4px" }}>
                        Dokaz: {(order.invoiceProofImages || []).length} slika
                      </div>
                    </div>
                    
                    {/* Akcijski dugmadi */}
                    <div style={{ 
                      display: "flex", 
                      gap: isMobile ? "8px" : "8px", 
                      flexWrap: "wrap",
                      justifyContent: isMobile ? "stretch" : "flex-start"
                    }}>
                      <button
                        style={{ 
                          ...smallButton, 
                          padding: isMobile ? "10px 12px" : "8px 10px", 
                          fontSize: isMobile ? "13px" : "12px",
                          flex: isMobile ? "1 1 calc(50% - 4px)" : "auto"
                        }}
                        onClick={() => setViewOrderId(order.id)}
                      >
                        Pregledaj
                      </button>
                      {order.status !== "completed" && (
                        <button
                          disabled={loadingOrderId === order.id}
                          style={{ 
                            padding: isMobile ? "10px 12px" : "8px 10px", 
                            fontSize: isMobile ? "13px" : "12px",
                            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                            color: "#fff",
                            border: "none",
                            borderRadius: "8px",
                            cursor: loadingOrderId === order.id ? "not-allowed" : "pointer",
                            fontWeight: 600,
                            boxShadow: "0 2px 6px rgba(16, 185, 129, 0.2)",
                            flex: isMobile ? "1 1 calc(50% - 4px)" : "auto",
                            opacity: loadingOrderId === order.id ? 0.6 : 1,
                            transition: "all 0.2s",
                          }}
                          onClick={() => handleInvoiceOrder(order.id)}
                        >
                          {loadingOrderId === order.id ? "Čuva se..." : "Prihvati fakturu"}
                        </button>
                      )}
                      <button
                        style={{ 
                          ...smallButton, 
                          padding: isMobile ? "10px 12px" : "8px 10px", 
                          fontSize: isMobile ? "13px" : "12px",
                          flex: isMobile ? "1 1 calc(50% - 4px)" : "auto"
                        }}
                        onClick={() => {
                          if (confirm(`Da li ste sigurni da želite otkazati narudžbu #${order.id.split("-")[1]}?`)) {
                            setOrders((prev) => prev.filter((o) => o.id !== order.id));
                          }
                        }}
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

        {selectedSupplier && !isMobile && renderSupplierEditor(selectedSupplier, false)}
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
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
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
                        flex: "1",
                        justifyContent: "center",
                        boxShadow: "0 4px 12px rgba(139, 92, 246, 0.3)",
                      }}
                    >
                      <FaPlus /> Dodaj artikal
                    </button>
                    {showArticleList && (
                      <button
                        onClick={() => {
                          const latestState = supplierItemsRef.current;
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('supplierItems', JSON.stringify(latestState));
                          }
                          const savedCount = (prepareOrderSupplierId ? latestState[prepareOrderSupplierId] : [])?.length || 0;
                          toast.showToast(`Lista artikala za ${supplier.name} je sačuvana (${savedCount} artikala).`, "success");
                          setShowArticleList(false);
                        }}
                        style={{
                          padding: "12px 20px",
                          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                          color: "#fff",
                          border: "none",
                          borderRadius: "8px",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                          animation: "slideIn 0.3s ease-out",
                        }}
                      >
                        💾 Sačuvaj listu
                      </button>
                    )}
                  </div>

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
                                updateSupplierItemsForSupplier(prepareOrderSupplierId, (current) => [...current, item.naziv]);
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
                  <div style={{ background: "#ffffff", borderRadius: "10px", border: "1px solid #e5e7eb", overflow: isMobile ? "visible" : "hidden" }}>
                    <div style={{ background: "linear-gradient(to right, #f9fafb, #ffffff)", padding: "14px 20px", borderBottom: "2px solid #e5e7eb" }}>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Lista artikala za narudžbu ({assignedItems.length})
                      </div>
                    </div>
                    {isMobile ? (
                      // Mobile verzija - Card layout
                      <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        {assignedItems.map((naziv, idx) => {
                          const itemData = items.find((i: { naziv: string; pocetnoStanje?: number }) => i.naziv === naziv);
                          const currentStock = itemData?.pocetnoStanje || 0;
                          const orderQty = prepareOrderSupplierId ? ((orderQuantities[prepareOrderSupplierId] || {})[naziv] || "") : "";
                          return (
                            <div key={naziv} style={{
                              background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
                              border: "2px solid #e5e7eb",
                              borderRadius: "12px",
                              padding: "0",
                              margin: "0",
                              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)",
                              position: "relative",
                              overflow: "hidden",
                              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                              boxSizing: "border-box"
                            }}>
                              {/* Header - Naziv artikla i dugme za brisanje */}
                              <div style={{ 
                                background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                                padding: "14px 16px",
                                borderBottom: "2px solid #e2e8f0",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "12px"
                              }}>
                                <div style={{
                                  fontSize: "15px",
                                  fontWeight: 700,
                                  color: "#0f172a",
                                  letterSpacing: "-0.3px",
                                  lineHeight: 1.3,
                                  flex: 1,
                                  minWidth: 0,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap"
                                }}>
                                  {naziv}
                                </div>
                                <button
                                  onClick={() => {
                                    updateSupplierItemsForSupplier(prepareOrderSupplierId, (current) => current.filter((n) => n !== naziv));
                                  }}
                                  style={{
                                    width: "28px",
                                    height: "28px",
                                    minWidth: "28px",
                                    maxWidth: "28px",
                                    padding: "0",
                                    background: "transparent",
                                    border: "none",
                                    borderRadius: "4px",
                                    cursor: "pointer",
                                    color: "#dc2626",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "16px",
                                    lineHeight: "1",
                                    transition: "all 0.2s ease",
                                    flexShrink: 0,
                                    outline: "none"
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.color = "#b91c1c";
                                    e.currentTarget.style.transform = "scale(1.1)";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.color = "#dc2626";
                                    e.currentTarget.style.transform = "scale(1)";
                                  }}
                                >
                                  <FaTimes />
                                </button>
                              </div>

                              {/* Body - Info sekcije */}
                              <div style={{ 
                                display: "flex", 
                                flexDirection: "column"
                              }}>
                                {/* Trenutno stanje */}
                                <div style={{
                                  background: "#fafbfc",
                                  padding: "12px 16px",
                                  borderBottom: "1px solid #f1f5f9",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center"
                                }}>
                                  <div style={{ 
                                    fontSize: "11px", 
                                    color: "#64748b", 
                                    fontWeight: 600, 
                                    textTransform: "uppercase", 
                                    letterSpacing: "0.8px"
                                  }}>
                                    📦 Stanje
                                  </div>
                                  <div style={{ 
                                    fontSize: "14px", 
                                    fontWeight: 700, 
                                    color: "#1e40af",
                                    letterSpacing: "-0.2px"
                                  }}>
                                    {currentStock.toFixed(2)}
                                  </div>
                                </div>

                                {/* Unos količine */}
                                <div style={{
                                  background: "#fafbfc",
                                  padding: "12px 16px",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: "12px"
                                }}>
                                  <div style={{ 
                                    fontSize: "11px", 
                                    color: "#64748b", 
                                    fontWeight: 600, 
                                    textTransform: "uppercase", 
                                    letterSpacing: "0.8px"
                                  }}>
                                    🛒 Narudžba
                                  </div>
                                  <input
                                    type="number"
                                    className="orders-number-input"
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
                                      width: "80px", 
                                      padding: "8px 12px", 
                                      border: "2px solid #d1d5db", 
                                      borderRadius: "6px", 
                                      fontSize: "14px", 
                                      textAlign: "center",
                                      fontWeight: 700,
                                      color: "#0f172a",
                                      background: "#ffffff",
                                      transition: "border-color 0.2s",
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
                                    onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      // Desktop verzija - Tabela
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
                                        className="orders-number-input"
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
                                    }}
                                    onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
                                    onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
                                  />
                                </td>
                                <td style={{ padding: "16px 20px", textAlign: "center" }}>
                                  <button
                                    onClick={() => {
                                      updateSupplierItemsForSupplier(prepareOrderSupplierId, (current) => current.filter((n) => n !== naziv));
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
                    )}
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
                    onClick={() => handleCreateOrder(supplier)}
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
              ) : isMobile ? (
                // Mobile verzija - Card layout
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {completedOrdersList.map((order) => {
                    const supplier = suppliers.find((s) => s.id === order.supplierId);
                    const isEditedCompleted = order.wasEdited === true;
                    return (
                      <div key={order.id} style={{
                        background: isEditedCompleted ? "#fefce8" : "#ffffff",
                        border: `1px solid ${isEditedCompleted ? "#facc15" : "#e5e7eb"}`,
                        borderRadius: "12px",
                        padding: "16px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px"
                      }}>
                        {/* Header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: 700, color: "#111827", marginBottom: "2px" }}>
                              #{order.id.split("-")[1]}
                            </div>
                          </div>
                          <span style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            color: isEditedCompleted ? "#854d0e" : "#059669",
                            background: isEditedCompleted ? "#fef3c7" : "#d1fae5",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            whiteSpace: "nowrap"
                          }}>
                            {isEditedCompleted ? "Uređeno + završeno" : "Završeno"}
                          </span>
                        </div>

                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                          gap: "8px",
                        }}>
                          <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "8px" }}>
                            <div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase", fontWeight: 700, marginBottom: "2px" }}>Datum</div>
                            <div style={{ fontSize: "12px", color: "#111827", fontWeight: 600 }}>{order.date}</div>
                          </div>
                          <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "8px" }}>
                            <div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase", fontWeight: 700, marginBottom: "2px" }}>Naručeno</div>
                            <div style={{ fontSize: "12px", color: "#111827", fontWeight: 600 }}>{order.orderedAt || "-"}</div>
                          </div>
                          <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "8px" }}>
                            <div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase", fontWeight: 700, marginBottom: "2px" }}>Primljeno</div>
                            <div style={{ fontSize: "12px", color: "#059669", fontWeight: 700 }}>{order.receivedAt || "-"}</div>
                          </div>
                          <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "8px" }}>
                            <div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase", fontWeight: 700, marginBottom: "2px" }}>Stavki</div>
                            <div style={{ fontSize: "12px", color: "#111827", fontWeight: 600 }}>{order.totalItems}</div>
                          </div>
                        </div>

                        {/* Dobavljač i stavke */}
                        <div style={{
                          background: isEditedCompleted ? "#fefce8" : "#f9fafb",
                          padding: "12px",
                          borderRadius: "8px",
                          borderLeft: `4px solid ${isEditedCompleted ? "#facc15" : "#10b981"}`
                        }}>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#1f2937", marginBottom: "4px" }}>
                            {supplier?.name || "Nepoznat dobavljač"}
                          </div>
                          <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                            Dokaz: {getInvoiceProofFiles(order).length} slika
                          </div>
                        </div>

                        {/* Akcije */}
                        <div style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap"
                        }}>
                          <button
                            style={{
                              ...smallButton,
                              padding: "10px 12px",
                              fontSize: "13px",
                              flex: "1 1 calc(50% - 4px)"
                            }}
                            onClick={() => setViewOrderId(order.id)}
                          >
                            Detalji
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Desktop verzija - Tabela
                <div style={{ border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                        <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#6b7280" }}>ID</th>
                        <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#6b7280" }}>Dobavljač</th>
                        <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#6b7280" }}>Datum</th>
                        <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#6b7280" }}>Naručeno</th>
                        <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#6b7280" }}>Primljeno</th>
                        <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#6b7280" }}>Dokaz</th>
                        <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#6b7280" }}>Stavki</th>
                        <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#6b7280" }}>Status</th>
                        <th style={{ padding: "10px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#6b7280" }}>Akcije</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedOrdersList.map((order) => {
                        const supplier = suppliers.find((s) => s.id === order.supplierId);
                        const isEditedCompleted = order.wasEdited === true;
                        return (
                          <tr key={order.id} style={{ borderBottom: "1px solid #f3f4f6", background: isEditedCompleted ? "#fefce8" : "transparent" }}>
                            <td style={{ padding: "10px", fontSize: "13px", color: "#111827", fontWeight: 700 }}>#{order.id.split("-")[1]}</td>
                            <td style={{ padding: "10px", fontSize: "13px", color: "#374151" }}>{supplier?.name || "Nepoznat"}</td>
                            <td style={{ padding: "10px", fontSize: "13px", color: "#6b7280" }}>{order.date}</td>
                            <td style={{ padding: "10px", fontSize: "13px", color: "#6b7280" }}>{order.orderedAt || "-"}</td>
                            <td style={{ padding: "10px", fontSize: "13px", color: "#059669", fontWeight: 600 }}>{order.receivedAt || "-"}</td>
                            <td style={{ padding: "10px", fontSize: "13px", color: "#6b7280" }}>{getInvoiceProofFiles(order).length}</td>
                            <td style={{ padding: "10px", fontSize: "13px", color: "#6b7280" }}>{order.totalItems}</td>
                            <td style={{ padding: "10px", fontSize: "13px" }}>
                              {isEditedCompleted ? (
                                <span style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  color: "#854d0e",
                                  background: "#fef3c7",
                                  border: "1px solid #fde047",
                                  borderRadius: "999px",
                                  padding: "4px 10px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                }}>
                                  Uređeno
                                </span>
                              ) : (
                                <span style={{ color: "#9ca3af", fontSize: "12px" }}>-</span>
                              )}
                            </td>
                            <td style={{ padding: "10px", display: "flex", gap: "8px" }}>
                              <button
                                style={{ ...smallButton, padding: "8px 10px", fontSize: "12px" }}
                                onClick={() => setViewOrderId(order.id)}
                              >
                                Detalji
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

      {/* Order Details Modal */}
      {viewOrderId && (() => {
        const order = orders.find((o) => o.id === viewOrderId);
        if (!order) return null;
        const supplier = suppliers.find((s) => s.id === order.supplierId);
        const statusConfig = {
          pending: { label: "Na čekanju", color: "#f59e0b", bg: "#fef3c7" },
          "in-transit": { label: "U dostavi", color: "#3b82f6", bg: "#dbeafe" },
          received: { label: "Primljeno", color: "#10b981", bg: "#d1fae5" },
          completed: { label: "Završeno", color: "#6b7280", bg: "#f3f4f6" },
        } as const;
        const status = statusConfig[order.status];

        return (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.65)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10003,
            }}
            onClick={() => setViewOrderId(null)}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: "12px",
                width: "90%",
                maxWidth: "700px",
                maxHeight: "85vh",
                overflow: "auto",
                boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", padding: "20px", borderTopLeftRadius: "12px", borderTopRightRadius: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 600, color: "rgba(255,255,255,0.8)", letterSpacing: "0.5px", marginBottom: "4px" }}>Detalji narudžbe</div>
                    <h3 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#ffffff" }}>#{order.id.split("-")[1]}</h3>
                    <p style={{ margin: "4px 0 0", fontSize: "13px", color: "rgba(255,255,255,0.9)" }}>{supplier?.name || "Nepoznat dobavljač"}</p>
                  </div>
                  <button
                    onClick={() => setViewOrderId(null)}
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
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: "12px",
                    marginBottom: "24px",
                  }}
                >
                  <div style={{ background: "#f9fafb", padding: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase" }}>Datum</div>
                    <div style={{ fontSize: "14px", color: "#111827", fontWeight: 600 }}>{order.date}</div>
                  </div>
                  <div style={{ background: "#f9fafb", padding: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase" }}>Naručeno u</div>
                    <div style={{ fontSize: "14px", color: "#111827", fontWeight: 600 }}>{order.orderedAt || "-"}</div>
                  </div>
                  <div style={{ background: "#f9fafb", padding: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase" }}>Primljeno u</div>
                    <div style={{ fontSize: "14px", color: "#059669", fontWeight: 700 }}>{order.receivedAt || "-"}</div>
                  </div>
                  <div style={{ background: "#f9fafb", padding: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase" }}>Status</div>
                    <span style={{ 
                      fontSize: "12px", 
                      fontWeight: 700, 
                      color: status.color, 
                      background: status.bg, 
                      padding: "4px 10px", 
                      borderRadius: "12px",
                      display: "inline-block"
                    }}>
                      {status.label}
                    </span>
                  </div>
                  <div style={{ background: "#f9fafb", padding: "12px", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase" }}>Ukupno artikala</div>
                    <div style={{ fontSize: "14px", color: "#111827", fontWeight: 600 }}>{order.totalItems}</div>
                  </div>
                </div>

                <div style={{ marginBottom: "24px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "10px" }}>
                    <h4 style={{ fontSize: "13px", fontWeight: 700, color: "#111827", margin: 0, textTransform: "uppercase", letterSpacing: "0.5px" }}>Dokaz fakture</h4>
                    <label style={{
                      padding: "8px 12px",
                      background: uploadingProofOrderId === order.id ? "#93c5fd" : "#3b82f6",
                      color: "#fff",
                      borderRadius: "8px",
                      cursor: uploadingProofOrderId === order.id ? "not-allowed" : "pointer",
                      fontSize: "12px",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}>
                      {uploadingProofOrderId === order.id ? "⏳ Uploadam..." : "📸 Dodaj sliku fakture"}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={uploadingProofOrderId === order.id}
                        onChange={(e) => {
                          handleAddInvoiceProof(order.id, e.target.files);
                          e.currentTarget.value = "";
                        }}
                        style={{ display: "none" }}
                      />
                    </label>
                  </div>
                  {getInvoiceProofFiles(order).length === 0 ? (
                    <div style={{ fontSize: "12px", color: "#6b7280" }}>Nema dodanih slika fakture.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {getInvoiceProofFiles(order).map((file, idx) => (
                        <div
                          key={`${order.id}-proof-${idx}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "10px",
                            padding: "10px 12px",
                            border: "1px solid #d1d5db",
                            borderRadius: "8px",
                            background: "#ffffff",
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              📄 {file.name}
                            </span>
                            <span style={{ fontSize: "11px", color: "#6b7280" }}>Slika dokaza fakture</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                ...smallButton,
                                textDecoration: "none",
                                padding: "6px 10px",
                                fontSize: "12px",
                              }}
                            >
                              Otvori
                            </a>
                            <button
                              type="button"
                              onClick={() => handleRemoveInvoiceProof(order.id, idx)}
                              style={{
                                ...smallButton,
                                padding: "6px 10px",
                                fontSize: "12px",
                                color: "#dc2626",
                                borderColor: "#fecaca",
                                background: "#fef2f2",
                              }}
                            >
                              Obriši
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: "24px" }}>
                  <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#111827", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Naručeni artikli</h4>
                  {isMobile ? (
                    // Mobile verzija - Card layout
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {(isEditingOrderDetails ? orderEditDraft : order.items.map((item) => ({ name: item.name, quantity: String(item.quantity) }))).map((item, idx) => (
                        <div key={idx} style={{
                          background: "#ffffff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "10px",
                          padding: "14px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "12px"
                        }}>
                          <div style={{
                            fontSize: "14px",
                            fontWeight: 600,
                            color: "#111827",
                            flex: 1,
                            minWidth: 0
                          }}>
                            {item.name}
                          </div>
                          {isEditingOrderDetails ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <input
                                type="number"
                                className="orders-number-input"
                                step="1"
                                min="0"
                                value={item.quantity}
                                onChange={(e) => handleDraftQuantityChange(idx, e.target.value)}
                                style={{
                                  width: "86px",
                                  padding: "6px 8px",
                                  border: "1px solid #d1d5db",
                                  borderRadius: "8px",
                                  fontSize: "13px",
                                  fontWeight: 700,
                                  textAlign: "right",
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveDraftItem(idx)}
                                style={{
                                  ...smallButton,
                                  padding: "6px 8px",
                                  fontSize: "11px",
                                  color: "#dc2626",
                                  borderColor: "#fecaca",
                                  background: "#fef2f2",
                                }}
                              >
                                Obriši
                              </button>
                            </div>
                          ) : (
                            <div style={{
                              fontSize: "13px",
                              fontWeight: 700,
                              color: "#fff",
                              background: "#3b82f6",
                              padding: "6px 12px",
                              borderRadius: "8px",
                              whiteSpace: "nowrap"
                            }}>
                              {item.quantity}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Desktop verzija - Tabela
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: "10px", overflow: "hidden" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Artikal</th>
                            <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "12px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>Količina</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(isEditingOrderDetails ? orderEditDraft : order.items.map((item) => ({ name: item.name, quantity: String(item.quantity) }))).map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: idx < order.items.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                              <td style={{ padding: "14px 16px", fontSize: "14px", color: "#111827", fontWeight: 600 }}>{item.name}</td>
                              <td style={{ padding: "14px 16px", fontSize: "14px", color: "#6b7280", fontWeight: 600, textAlign: "right" }}>
                                {isEditingOrderDetails ? (
                                  <input
                                    type="number"
                                    className="orders-number-input"
                                    step="1"
                                    min="0"
                                    value={item.quantity}
                                    onChange={(e) => handleDraftQuantityChange(idx, e.target.value)}
                                    style={{
                                      width: "110px",
                                      padding: "8px 10px",
                                      border: "1px solid #d1d5db",
                                      borderRadius: "8px",
                                      fontSize: "14px",
                                      fontWeight: 700,
                                      textAlign: "right",
                                    }}
                                  />
                                ) : (
                                  item.quantity
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {isEditingOrderDetails && (
                    <div style={{ marginTop: "10px", fontSize: "12px", color: "#6b7280" }}>
                      Savjet: Ako stavku postavite na 0 ili je obrišete, neće biti sačuvana u narudžbi.
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", paddingTop: "16px", borderTop: "1px solid #e5e7eb" }}>
                  <button
                    onClick={() => setViewOrderId(null)}
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
                    Zatvori
                  </button>
                  {order.status !== "completed" ? (
                    <>
                      {isEditingOrderDetails ? (
                        <>
                          <button
                            onClick={() => {
                              setIsEditingOrderDetails(false);
                              setOrderEditDraft(order.items.map((item) => ({ name: item.name, quantity: String(item.quantity) })));
                            }}
                            style={{
                              padding: "12px 20px",
                              background: "#f3f4f6",
                              border: "1px solid #d1d5db",
                              borderRadius: "8px",
                              cursor: "pointer",
                              fontSize: "14px",
                              fontWeight: 600,
                              color: "#374151",
                            }}
                          >
                            Otkaži izmjene
                          </button>
                          <button
                            disabled={loadingOrderId === order.id}
                            onClick={() => handleSaveOrderEdit(order.id)}
                            style={{
                              padding: "12px 24px",
                              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                              border: "none",
                              borderRadius: "8px",
                              cursor: loadingOrderId === order.id ? "not-allowed" : "pointer",
                              fontSize: "14px",
                              fontWeight: 600,
                              color: "#fff",
                              boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)",
                              opacity: loadingOrderId === order.id ? 0.6 : 1,
                              transition: "all 0.2s",
                            }}
                          >
                            {loadingOrderId === order.id ? "Čuva se..." : "Sačuvaj izmjene"}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleStartEditOrder(order)}
                            style={{
                              padding: "12px 20px",
                              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                              border: "none",
                              borderRadius: "8px",
                              cursor: "pointer",
                              fontSize: "14px",
                              fontWeight: 600,
                              color: "#fff",
                              boxShadow: "0 4px 12px rgba(245, 158, 11, 0.3)",
                            }}
                          >
                            Uredi narudžbu
                          </button>
                          <button
                            disabled={loadingOrderId === order.id}
                            onClick={() => handleInvoiceOrder(order.id)}
                            style={{
                              padding: "12px 24px",
                              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                              border: "none",
                              borderRadius: "8px",
                              cursor: loadingOrderId === order.id ? "not-allowed" : "pointer",
                              fontSize: "14px",
                              fontWeight: 600,
                              color: "#fff",
                              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                              transition: "all 0.2s",
                              opacity: loadingOrderId === order.id ? 0.6 : 1,
                            }}
                          >
                            {loadingOrderId === order.id ? "Čuva se..." : "Prihvati fakturu"}
                          </button>
                        </>
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
