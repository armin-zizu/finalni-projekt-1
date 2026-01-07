"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { FaArrowUp, FaArrowDown, FaDollarSign } from "react-icons/fa";
import { useCjenovnik } from "../context/CjenovnikContext";
import { usePathname } from "next/navigation";
import { useRole } from "../context/RoleContext";
import { getObracuni, getCurrentUser, updateCurrentUser } from "../../lib/api";
// TEMPORARY: Firebase imports disabled during migration
// import { auth, onAuthStateChanged } from "../../lib/firebase";
// import { db } from "../../lib/firestore";
// import { collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";

// Mock objects for migration
const auth = { currentUser: null };
const onAuthStateChanged = (auth: any, callback: any) => {
  callback(null);
  return () => {};
};
const db = {} as any;
const collection = (db: any, path: string) => ({ path });
const getDocs = async (ref: any) => ({ docs: [] });
const doc = (db: any, collection: string, id: string) => ({ id, collection });
const getDoc = async (ref: any) => ({ exists: () => false, data: () => ({}) });
const setDoc = async (ref: any, data: any) => {};
import { encrypt, decrypt } from "../../lib/encryption";

// ---- Tipovi ----
type Artikal = {
  naziv: string;
  cijena: number;
  pocetnoStanje: number;
  ulaz: number;
  ukupno: number;
  utroseno: number;
  krajnjeStanje: number;
  vrijednostKM: number;
  zestokoKolicina?: number;
};

type Obracun = {
  datum: string;
  artikli: Artikal[];
  rashodi: { naziv: string; cijena: number }[];
  prihodi: { naziv: string; cijena: number }[];
};

type ArtikalProfit = {
  naziv: string;
  nabavnaCijena: number;
  prodajnaCijena: number;
  kolicina: number;
  bruto: number;
  neto: number;
  profit: number;
  zestokoKolicina?: number;
};

type ObracunProfit = {
  datum: string;
  artikliProfit: ArtikalProfit[];
  ukupnoBruto: number;
  ukupnoNeto: number;
  ukupnoRashod: number;
};

type ArtiklProfitData = {
  datum: string;
  bruto: number; // prodajnaCijena * kolicina
  neto: number;  // prava zarada = bruto - nabavna * kolicina - deo rashoda (proporcionalno bruto)
};

// Helper funkcija za parsiranje datuma - normalizuje format (uklanja tačku na kraju)
function parseDatumToDate(datum: string): Date {
  // Normalizuj datum - ukloni tačku na kraju ako postoji
  const normalizedDatum = datum.trim().replace(/\.$/, '');
  const datumParts = normalizedDatum.split('.').filter(Boolean); // Filter uklanja prazne stringove
  if (datumParts.length !== 3) {
    // Fallback ako format nije validan
    return new Date(datum);
  }
  // Format: DD.MM.YYYY -> YYYY-MM-DD
  return new Date(`${datumParts[2]}-${datumParts[1]}-${datumParts[0]}`);
}

// ---- CSS ----
const containerStyle: React.CSSProperties = {
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "24px",
  fontFamily: "'Inter', sans-serif",
  width: "100%",
  boxSizing: "border-box",
  overflowX: "hidden",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  borderCollapse: "separate" as "separate",
  borderSpacing: 0,
  background: "#ffffff",
  borderRadius: "8px",
  overflow: "hidden",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
  marginBottom: "12px",
  boxSizing: "border-box",
};

const thStyle: React.CSSProperties = {
  padding: "16px",
  textAlign: "left" as "left",
  background: "#f8fafc",
  color: "#1f2937",
  fontSize: "14px",
  fontWeight: 600,
  borderBottom: "1px solid #e5e7eb",
};

const tdStyle: React.CSSProperties = {
  padding: "16px",
  textAlign: "left" as "left",
  borderBottom: "1px solid #f3f4f6",
  fontSize: "14px",
  color: "#374151",
};

const summaryStyle: React.CSSProperties = {
  display: "flex",
  gap: "24px",
  marginTop: "12px",
  padding: "12px",
  background: "#f3f4f6",
  borderRadius: "6px",
  width: "100%",
  boxSizing: "border-box",
  flexWrap: "wrap",
};

const summaryItemStyle = (color: string): React.CSSProperties => ({
  fontSize: "14px",
  fontWeight: 600,
  color,
});

const formInputStyle: React.CSSProperties = {
  padding: "8px",
  border: "1px solid #e5e7eb",
  borderRadius: "6px",
  fontSize: "14px",
  outline: "none",
  width: "150px",
};

const buttonStyle: React.CSSProperties = {
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  transition: "all 0.2s",
  fontWeight: 500,
};

// ---- Filter komponenta ----
const FilterSection: React.FC<{
  filter: "currentWeek" | "previousWeek" | "monthly" | "quarterly" | "selectMonth" | "custom";
  setFilter: (value: "currentWeek" | "previousWeek" | "monthly" | "quarterly" | "selectMonth" | "custom") => void;
  customPeriod: { from: string; to: string };
  setCustomPeriod: (value: { from: string; to: string }) => void;
  selectedMonth?: number;
  setSelectedMonth?: (value: number) => void;
  selectedYear?: number;
  setSelectedYear?: (value: number) => void;
  monthDropdownOpen?: boolean;
  setMonthDropdownOpen?: (value: boolean) => void;
  yearDropdownOpen?: boolean;
  setYearDropdownOpen?: (value: boolean) => void;
  label?: string;
  isMobile?: boolean;
}> = ({ filter, setFilter, customPeriod, setCustomPeriod, selectedMonth, setSelectedMonth, selectedYear, setSelectedYear, monthDropdownOpen, setMonthDropdownOpen, yearDropdownOpen, setYearDropdownOpen, label = "Filter arhive", isMobile = false }) => {
  const hasLabel = !!label;
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Close dropdown on click outside
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown-container]')) {
        setDropdownOpen(false);
        if (setMonthDropdownOpen) setMonthDropdownOpen(false);
        if (setYearDropdownOpen) setYearDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen, setMonthDropdownOpen, setYearDropdownOpen]);

  const filterOptions = [
    { value: "currentWeek", label: "Trenutna sedmica" },
    { value: "previousWeek", label: "Prošla sedmica" },
    { value: "monthly", label: "Mjesečni" },
    { value: "quarterly", label: "Tromjesečni" },
    { value: "selectMonth", label: "Odaberi mjesec" },
    { value: "custom", label: "Prilagođeno" },
  ];

  const currentLabel = filterOptions.find(f => f.value === filter)?.label || "Trenutna sedmica";

  return (
    <div style={{ 
      marginBottom: hasLabel ? (isMobile ? "16px" : "20px") : 0, 
      background: hasLabel ? (isMobile ? "linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.95) 100%)" : "#fff") : "transparent", 
      backdropFilter: hasLabel && isMobile ? "blur(15px) saturate(180%)" : "none",
      WebkitBackdropFilter: hasLabel && isMobile ? "blur(15px) saturate(180%)" : "none",
      border: hasLabel && isMobile ? "1px solid rgba(255, 255, 255, 0.8)" : "none",
      padding: hasLabel ? (isMobile ? "12px" : "16px") : 0, 
      borderRadius: hasLabel ? (isMobile ? "16px" : "8px") : 0, 
      boxShadow: hasLabel ? (isMobile ? "0 15px 30px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.02)" : "0 2px 8px rgba(0,0,0,0.1)") : "none", 
      width: "100%", 
      maxWidth: "100%", 
      boxSizing: "border-box",
      position: "relative",
      zIndex: 10
    }}>
      {hasLabel && (
        <h2 style={{ 
          fontSize: isMobile ? "16px" : "18px", 
          fontWeight: 500, 
          marginBottom: isMobile ? "12px" : "12px", 
          wordWrap: "break-word" 
        }}>
          {label}
        </h2>
      )}
      {isMobile ? (
        <div style={{ position: "relative", width: "100%" }} data-dropdown-container>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              width: "100%",
              padding: "14px 40px 14px 16px",
              border: dropdownOpen ? "2px solid #3b82f6" : "1px solid #d1d5db",
              borderRadius: "12px",
              fontSize: "15px",
              backgroundColor: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: dropdownOpen ? "0 8px 20px rgba(59,130,246,0.2), 0 0 0 1px rgba(59,130,246,0.1)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              fontWeight: 600,
              color: "#1f2937",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <span>{currentLabel}</span>
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                position: "absolute",
                right: "16px",
              }}
            >
              <path 
                d="M5 7.5L10 12.5L15 7.5" 
                stroke={dropdownOpen ? "#3b82f6" : "#6b7280"} 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {dropdownOpen && (
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
                onClick={() => setDropdownOpen(false)}
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
                {filterOptions.map((option, index) => {
                  const isSelected = filter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setFilter(option.value as any);
                        setDropdownOpen(false);
                        if (setMonthDropdownOpen) setMonthDropdownOpen(false);
                        if (setYearDropdownOpen) setYearDropdownOpen(false);
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
                        borderBottom: index < filterOptions.length - 1 ? "1px solid #f1f5f9" : "none",
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
                      <span>{option.label}</span>
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
          {filter === "selectMonth" && selectedMonth && setSelectedMonth && selectedYear && setSelectedYear && monthDropdownOpen !== undefined && setMonthDropdownOpen && yearDropdownOpen !== undefined && setYearDropdownOpen && (
            <div style={{ 
              marginTop: "12px",
              display: "flex", 
              gap: 8, 
              alignItems: "flex-end", 
              width: "100%", 
              flexWrap: "wrap",
              opacity: 1,
              visibility: "visible"
            }}>
              {/* Custom Dropdown za Mjesec */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative", flex: "1 1 auto", minWidth: 0 }} data-dropdown-container>
                <label style={{ fontSize: "11px", fontWeight: 500, color: "#6b7280" }}>Mjesec:</label>
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMonthDropdownOpen(!monthDropdownOpen);
                      if (setYearDropdownOpen) setYearDropdownOpen(false);
                      setDropdownOpen(false);
                    }}
                    style={{
                      padding: "8px 32px 8px 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: "8px",
                      fontSize: "13px",
                      width: "100%",
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
                  >
                    <span>{["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"][selectedMonth - 1]}</span>
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{
                        transform: monthDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                        position: "absolute",
                        right: "8px",
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
                        zIndex: 10000,
                        maxHeight: "240px",
                        overflowY: "auto",
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
                            if (setSelectedMonth) setSelectedMonth(index + 1);
                            if (setMonthDropdownOpen) setMonthDropdownOpen(false);
                            setDropdownOpen(false);
                          }}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            textAlign: "left",
                            border: "none",
                            backgroundColor: selectedMonth === index + 1 ? "#eff6ff" : "#fff",
                            color: selectedMonth === index + 1 ? "#2563eb" : "#1f2937",
                            fontSize: "13px",
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
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative", flex: "1 1 auto", minWidth: 0 }} data-dropdown-container>
                <label style={{ fontSize: "11px", fontWeight: 500, color: "#6b7280" }}>Godina:</label>
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (setYearDropdownOpen) setYearDropdownOpen(!yearDropdownOpen);
                      if (setMonthDropdownOpen) setMonthDropdownOpen(false);
                      setDropdownOpen(false);
                    }}
                    style={{
                      padding: "8px 32px 8px 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: "8px",
                      fontSize: "13px",
                      width: "100%",
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
                  >
                    <span>{selectedYear}</span>
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{
                        transform: yearDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                        position: "absolute",
                        right: "8px",
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
                        zIndex: 10000,
                        maxHeight: "200px",
                        overflowY: "auto",
                      }}
                    >
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                        <button
                          key={year}
                          type="button"
                          onClick={() => {
                            if (setSelectedYear) setSelectedYear(year);
                            if (setYearDropdownOpen) setYearDropdownOpen(false);
                            setDropdownOpen(false);
                          }}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            textAlign: "left",
                            border: "none",
                            backgroundColor: selectedYear === year ? "#eff6ff" : "#fff",
                            color: selectedYear === year ? "#2563eb" : "#1f2937",
                            fontSize: "13px",
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
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {filter === "custom" && (
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
                value={customPeriod.from} 
                onChange={(e) => setCustomPeriod({ ...customPeriod, from: e.target.value })} 
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
                value={customPeriod.to} 
                onChange={(e) => setCustomPeriod({ ...customPeriod, to: e.target.value })} 
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
        <div style={{ 
          display: "flex", 
          gap: 12, 
          flexWrap: "wrap", 
          alignItems: "center", 
          width: "100%" 
        }}>
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value as any)}
              style={{
                ...buttonStyle,
                backgroundColor: filter === option.value ? "#3b82f6" : "#e5e7eb",
                color: filter === option.value ? "#fff" : "#374151",
                padding: "8px 16px",
                fontSize: 14,
              }}
            >
              {option.label}
            </button>
          ))}
          {filter === "selectMonth" && selectedMonth && setSelectedMonth && selectedYear && setSelectedYear && monthDropdownOpen !== undefined && setMonthDropdownOpen && yearDropdownOpen !== undefined && setYearDropdownOpen && (
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginLeft: 10, flexWrap: "wrap" }}>
              {/* Custom Dropdown za Mjesec */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "relative" }} data-dropdown-container>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151" }}>Mjesec:</label>
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setMonthDropdownOpen(!monthDropdownOpen);
                      if (setYearDropdownOpen) setYearDropdownOpen(false);
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
                  >
                    <span>{["Januar", "Februar", "Mart", "April", "Maj", "Juni", "Juli", "August", "Septembar", "Oktobar", "Novembar", "Decembar"][selectedMonth - 1]}</span>
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{
                        transform: monthDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                        position: "absolute",
                        right: "8px",
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
                            if (setSelectedMonth) setSelectedMonth(index + 1);
                            if (setMonthDropdownOpen) setMonthDropdownOpen(false);
                          }}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            textAlign: "left",
                            border: "none",
                            backgroundColor: selectedMonth === index + 1 ? "#eff6ff" : "#fff",
                            color: selectedMonth === index + 1 ? "#2563eb" : "#1f2937",
                            fontSize: "13px",
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
                      if (setYearDropdownOpen) setYearDropdownOpen(!yearDropdownOpen);
                      if (setMonthDropdownOpen) setMonthDropdownOpen(false);
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
                      boxShadow: yearDropdownOpen ? "0 4px 12px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.1)",
                      transition: "all 0.2s ease",
                      fontWeight: 500,
                      color: "#1f2937",
                    }}
                  >
                    <span>{selectedYear}</span>
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{
                        transform: yearDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                        position: "absolute",
                        right: "8px",
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
                        maxHeight: "200px",
                        overflowY: "auto",
                      }}
                    >
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                        <button
                          key={year}
                          type="button"
                          onClick={() => {
                            if (setSelectedYear) setSelectedYear(year);
                            if (setYearDropdownOpen) setYearDropdownOpen(false);
                          }}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            textAlign: "left",
                            border: "none",
                            backgroundColor: selectedYear === year ? "#eff6ff" : "#fff",
                            color: selectedYear === year ? "#2563eb" : "#1f2937",
                            fontSize: "13px",
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
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {filter === "custom" && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", width: "100%", flexWrap: "nowrap" }}>
              <input 
                type="date" 
                value={customPeriod.from} 
                onChange={(e) => setCustomPeriod({ ...customPeriod, from: e.target.value })} 
                style={{ 
                  ...formInputStyle, 
                  padding: "8px",
                  fontSize: 14,
                }} 
              />
              <span style={{ whiteSpace: "nowrap", fontSize: 14 }}>do</span>
              <input 
                type="date" 
                value={customPeriod.to} 
                onChange={(e) => setCustomPeriod({ ...customPeriod, to: e.target.value })} 
                style={{ 
                  ...formInputStyle, 
                  padding: "8px",
                  fontSize: 14,
                }} 
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ---- Glavna komponenta ----
export default function ProfitPage() {
  const [obracuniProfit, setObracuniProfit] = useState<ObracunProfit[]>([]);
  const [filter, setFilter] = useState<"currentWeek" | "previousWeek" | "monthly" | "quarterly" | "selectMonth" | "custom">("currentWeek");
  // Detekcija mobilnog uređaja - poboljšana sa User-Agent fallback
  const detectMobile = (): boolean => {
    if (typeof window === 'undefined') return false;
    
    // Metoda 1: Provjeri User-Agent (najpouzdanije za initial state)
    if (typeof navigator !== 'undefined' && navigator.userAgent) {
      const ua = navigator.userAgent.toLowerCase();
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
      if (mobileRegex.test(ua)) {
        return true;
      }
    }
    
    // Metoda 2: Provjeri širinu ekrana
    const width = window.innerWidth || (window.screen && window.screen.width) || 1024;
    if (width <= 768) {
      return true;
    }
    
    // Metoda 3: Provjeri touch support
    if ('ontouchstart' in window || (navigator && navigator.maxTouchPoints > 0)) {
      const width = window.innerWidth || (window.screen && window.screen.width) || 1024;
      if (width <= 1024) {
        return true;
      }
    }
    
    return false;
  };
  
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    // Inicijalizuj sa User-Agent detekcijom (radi i na SSR)
    if (typeof window !== 'undefined') {
      return detectMobile();
    }
    return false;
  });
  const [chartKey, setChartKey] = useState(0);
  const [customPeriod, setCustomPeriod] = useState<{ from: string; to: string }>({
    from: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });
  // State za selectMonth
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  // Dropdown state za custom period
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
  const [filteredObracuni, setFilteredObracuni] = useState<ObracunProfit[]>([]);
  const [selectedArtikl, setSelectedArtikl] = useState<string>("");
  const [artiklFilter, setArtiklFilter] = useState<"currentWeek" | "previousWeek" | "monthly" | "quarterly" | "selectMonth" | "custom">("currentWeek");
  // Dropdown state za artikl filter custom period
  const [artiklCustomFromDay, setArtiklCustomFromDay] = useState<number>(new Date().getDate());
  const [artiklCustomFromMonth, setArtiklCustomFromMonth] = useState<number>(new Date().getMonth() + 1);
  const [artiklCustomFromYear, setArtiklCustomFromYear] = useState<number>(new Date().getFullYear());
  const [artiklCustomToDay, setArtiklCustomToDay] = useState<number>(new Date().getDate());
  const [artiklCustomToMonth, setArtiklCustomToMonth] = useState<number>(new Date().getMonth() + 1);
  const [artiklCustomToYear, setArtiklCustomToYear] = useState<number>(new Date().getFullYear());
  const [artiklCustomFromDayDropdownOpen, setArtiklCustomFromDayDropdownOpen] = useState(false);
  const [artiklCustomFromMonthDropdownOpen, setArtiklCustomFromMonthDropdownOpen] = useState(false);
  const [artiklCustomFromYearDropdownOpen, setArtiklCustomFromYearDropdownOpen] = useState(false);
  const [artiklCustomToDayDropdownOpen, setArtiklCustomToDayDropdownOpen] = useState(false);
  const [artiklCustomToMonthDropdownOpen, setArtiklCustomToMonthDropdownOpen] = useState(false);
  const [artiklCustomToYearDropdownOpen, setArtiklCustomToYearDropdownOpen] = useState(false);
  const [isPasswordProtected, setIsPasswordProtected] = useState<boolean | null>(null); // null = loading
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const { cjenovnik } = useCjenovnik();
  const { user } = useRole();
  const pathname = usePathname();

  // Detekcija mobilnog uređaja - poboljšana za produkciju
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkMobile = () => detectMobile();
    
    // Postavi odmah (bez čekanja na event)
    const initialMobile = checkMobile();
    if (initialMobile !== isMobile) {
      setIsMobile(initialMobile);
      setChartKey(prev => prev + 1);
    }
    
    const handleResize = () => {
      const newMobile = checkMobile();
      if (newMobile !== isMobile) {
        setIsMobile(newMobile);
        setChartKey(prev => prev + 1);
      }
    };
    
    const handleOrientationChange = () => {
      setTimeout(() => {
        const newMobile = checkMobile();
        if (newMobile !== isMobile) {
          setIsMobile(newMobile);
          setChartKey(prev => prev + 1);
        }
      }, 150);
    };
    
    // Dodaj listener-e
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Re-check nakon kratkog delay-a (za mobilne browser-e koji možda ne detektuju odmah)
    const timer = setTimeout(() => {
      const newMobile = checkMobile();
      if (newMobile !== isMobile) {
        setIsMobile(newMobile);
        setChartKey(prev => prev + 1);
      }
    }, 100);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [isMobile]);

  // TEMPORARY: Password protection disabled - TODO: Migrate to API
  useEffect(() => {
    // Password protection temporarily disabled during Firebase migration
    setIsPasswordProtected(false);
  }, [pathname]);

  // TEMPORARY: Password protection disabled - TODO: Migrate to API
  const handlePasswordSubmit = async () => {
    // Password protection temporarily disabled during Firebase migration
    setPasswordError("Password protection trenutno nije dostupno.");
  };

  // ---- funkcija za učitavanje arhive i generisanje profita - KORISTI API ----
  const loadArhiva = useCallback(async (userId: string) => {
    try {
      console.log("Profit - Učitavanje arhive za korisnika:", userId);
      
      // UČITAJ IZ API-JA
      let firestoreArhiva: Obracun[] = [];
      
      try {
        const obracuni = await getObracuni(userId);
        
        // Transformiraj podatke iz API-ja u format koji profit očekuje
        firestoreArhiva = obracuni.map((ob: any) => ({
          ...ob,
          artikli: ob.artikli ?? [],
          prihodi: ob.prihodi ?? [],
          rashodi: ob.rashodi ?? [],
        } as Obracun));
        
        console.log("Profit - Učitano iz API-ja:", firestoreArhiva.length, "obračuna");
        
        if (firestoreArhiva.length === 0) {
          console.warn("Profit - Nema obračuna u arhivi!");
          setObracuniProfit([]);
          return;
        }
      } catch (error: any) {
        console.error("Profit - Greška pri učitavanju iz API-ja:", {
          error,
          message: error?.message,
        });
        setObracuniProfit([]);
        return;
      }
      
      console.log("Profit - Učitavanje arhive:", {
        firestoreCount: firestoreArhiva.length,
        cjenovnikLength: cjenovnik.length,
      });

      if (cjenovnik.length === 0) {
        console.log("Profit - Cjenovnik je prazan, čekam učitavanje...");
        setObracuniProfit([]);
        return;
      }

      const parsed: Obracun[] = firestoreArhiva
        .filter((item: any) => !item.isAzuriran) // Filtriraj samo finalne obračune (isAzuriran: false ili undefined)
        .map((item: any) => ({
          ...item,
          artikli: item.artikli ?? [],
          prihodi: item.prihodi ?? [],
          rashodi: item.rashodi ?? [],
        }))
        .sort((a: Obracun, b: Obracun) => {
          const dateA = parseDatumToDate(a.datum).getTime();
          const dateB = parseDatumToDate(b.datum).getTime();
          return dateB - dateA; // Silazni redoslijed (najnoviji prvo)
        });
        
      console.log("Profit - Filtrirani obračuni:", {
        preFiltera: firestoreArhiva.length,
        posleFiltera: parsed.length,
        finalni: parsed.length
      });

      console.log("Profit - Parsirano obračuna:", parsed.length);
      console.log("Profit - Prvi obračun detalji:", parsed[0] ? {
        datum: parsed[0].datum,
        artikliCount: parsed[0].artikli?.length || 0,
        artikli: parsed[0].artikli
      } : "Nema obračuna");

      console.log("Profit - Generisanje profita:", {
        parsedCount: parsed.length,
        cjenovnikArtikala: cjenovnik.map(c => ({ naziv: c.naziv, nabavnaCijena: c.nabavnaCijena })),
      });

      const profiti: ObracunProfit[] = parsed
        .filter((obracun) => {
          const imaArtikala = obracun.artikli && obracun.artikli.length > 0;
          if (!imaArtikala) {
            console.warn(`Profit - Obračun ${obracun.datum} nema artikala`);
          }
          return imaArtikala;
        })
        .map((obracun) => {
        console.log(`Profit - Procesiranje obračuna ${obracun.datum}:`, {
          artikliCount: obracun.artikli?.length || 0,
          artikli: obracun.artikli?.map(a => ({
            naziv: a.naziv,
            utroseno: a.utroseno,
            cijena: a.cijena,
          })),
        });

        // Prvo izračunaj ukupni rashod
        const ukupnoRashod = obracun.rashodi?.reduce((sum, r) => sum + r.cijena, 0) || 0;

        // Izračunaj artikle sa bruto vrednostima
        const artikliProfitTemp: (ArtikalProfit & { bruto: number })[] = (obracun.artikli || [])
          .filter((a) => {
            const isValid = a && a.naziv;
            if (!isValid) {
              console.warn(`Profit - Nevalidan artikal u obračunu ${obracun.datum}:`, a);
            }
            return isValid;
          })
          .filter((a) => {
            // Proveri da li artikal ima potrebne podatke
            if (!a.utroseno || a.utroseno <= 0) {
              console.warn(`Profit - Artikal "${a.naziv}" nema utrošenu količinu (utroseno: ${a.utroseno})`);
              return false; // Preskoči artikle bez utrošene količine
            }
            return true;
          })
          .map((a) => {
            const cjenovnikArtikl = cjenovnik.find((c) => c.naziv === a.naziv);
            
            // Za žestoka pića: količina = utroseno / zestokoKolicina
            // Za ostale artikle: količina = utroseno
            const kolicina = a.zestokoKolicina && a.zestokoKolicina > 0
              ? a.utroseno / a.zestokoKolicina
              : a.utroseno;
            
            const prodajna = a.cijena || 0;
            const nabavna = cjenovnikArtikl?.nabavnaCijena || 0;
            
            if (!cjenovnikArtikl) {
              console.warn(`Profit - Artikal "${a.naziv}" nije pronađen u cjenovniku (nabavna cijena će biti 0)`);
            } else {
              console.log(`Profit - Artikal "${a.naziv}":`, {
                nabavnaCijena: nabavna,
                prodajnaCijena: prodajna,
                kolicina,
              });
            }
            
            if (prodajna === 0) {
              console.warn(`Profit - Artikal "${a.naziv}" nema prodajnu cijenu`);
            }
            
            const bruto = prodajna * kolicina;
            const profit = prodajna - nabavna;

            return {
              naziv: a.naziv,
              nabavnaCijena: nabavna,
              prodajnaCijena: prodajna,
              kolicina,
              bruto,
              neto: 0, // Biće izračunato nakon što znamo ukupnoBruto
              profit,
              zestokoKolicina: a.zestokoKolicina,
            };
          });

        // Izračunaj ukupno bruto da bismo mogli da delimo rashod proporcionalno
        const ukupnoBruto = artikliProfitTemp.reduce((sum, a) => sum + a.bruto, 0);

        // Sada izračunaj pravu zaradu (neto) po artiklu sa proporcionalnim rashodom
        const artikliProfit: ArtikalProfit[] = artikliProfitTemp.map((a) => {
          // Rashod se dijeli proporcionalno bruto cijeni
          const deoRashoda = ukupnoBruto > 0 ? (a.bruto / ukupnoBruto) * ukupnoRashod : 0;
          // Prava zarada = bruto - nabavna cijena - deo rashoda
          const neto = a.bruto - (a.nabavnaCijena * a.kolicina) - deoRashoda;
          
          return {
            ...a,
            neto,
          };
        });

        console.log(`Profit - Obračun ${obracun.datum} ima ${artikliProfit.length} artikala za prikaz`);

        // Ukupno neto = suma prave zarade svih artikala
        const ukupnoNeto = artikliProfit.reduce((sum, a) => sum + a.neto, 0);

        return {
          datum: obracun.datum,
          artikliProfit,
          ukupnoBruto,
          ukupnoNeto,
          ukupnoRashod,
        };
      });

      console.log("Profit - Generisano profita:", {
        brojObračuna: profiti.length,
        obračuni: profiti.map(p => ({
          datum: p.datum,
          artikliProfitCount: p.artikliProfit.length,
          ukupnoBruto: p.ukupnoBruto,
          ukupnoNeto: p.ukupnoNeto,
        })),
      });

      console.log("Profit - Generisano profita:", profiti.length);
      console.log("Profit - Učitavanje završeno:", {
        brojObračuna: profiti.length,
        prviObračun: profiti[0]?.datum,
      });
      setObracuniProfit(profiti);
    } catch (error) {
      console.error("Profit - Kritična greška pri učitavanju arhive:", error);
      setObracuniProfit([]);
    }
  }, [cjenovnik]);

  // Učitaj arhivu kada se korisnik učita i cjenovnik je spreman
  useEffect(() => {
    if (!user?.id) {
      console.log("Profit - Nema korisnika, ne učitavam podatke");
      setObracuniProfit([]);
      return;
    }

    // Sačekaj mali delay da se sve inicijalizuje + da cjenovnik bude spreman
    if (cjenovnik.length > 0) {
      console.log("Profit - Korisnik učitan, učitavam arhivu...");
      setTimeout(() => {
        loadArhiva(user.id);
      }, 200);
    } else {
      console.log("Profit - Čekam cjenovnik...");
    }
  }, [user?.id, cjenovnik, loadArhiva]);

  // Listener za promjene u arhivi
  useEffect(() => {
    const handler = () => {
      if (user?.id && cjenovnik.length > 0) {
        setTimeout(() => {
          loadArhiva(user.id);
        }, 100);
      }
    };
    window.addEventListener("arhivaChanged", handler);
    return () => window.removeEventListener("arhivaChanged", handler);
  }, [user?.id, cjenovnik, loadArhiva]);

  // ---- filtriranje po periodu za glavni grafikon i tablice ----
  useEffect(() => {
    const today = new Date();
    const getMonday = (d: Date) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      date.setDate(date.getDate() + diff);
      date.setHours(0, 0, 0, 0);
      return date;
    };

    const filtered = obracuniProfit.filter((o) => {
      const dTime = parseDatumToDate(o.datum).getTime();

      if (filter === "currentWeek") {
        const monday = getMonday(today);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        return dTime >= monday.getTime() && dTime <= sunday.getTime();
      }
      if (filter === "previousWeek") {
        const lastWeekDate = new Date(today);
        lastWeekDate.setDate(today.getDate() - 7);
        const lastWeekMonday = getMonday(lastWeekDate);
        const lastWeekSunday = new Date(lastWeekMonday);
        lastWeekSunday.setDate(lastWeekMonday.getDate() + 6);
        lastWeekSunday.setHours(23, 59, 59, 999);
        return dTime >= lastWeekMonday.getTime() && dTime <= lastWeekSunday.getTime();
      }
      if (filter === "monthly") {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        firstDay.setHours(0, 0, 0, 0);
        const lastDay = new Date(today);
        lastDay.setHours(23, 59, 59, 999);
        return dTime >= firstDay.getTime() && dTime <= lastDay.getTime();
      }
      if (filter === "quarterly") {
        const threeMonthsAgo = new Date(today);
        threeMonthsAgo.setMonth(today.getMonth() - 3);
        threeMonthsAgo.setDate(1);
        threeMonthsAgo.setHours(0, 0, 0, 0);
        const lastDay = new Date(today);
        lastDay.setHours(23, 59, 59, 999);
        return dTime >= threeMonthsAgo.getTime() && dTime <= lastDay.getTime();
      }
      if (filter === "selectMonth") {
        const firstDay = new Date(selectedYear, selectedMonth - 1, 1);
        firstDay.setHours(0, 0, 0, 0);
        const lastDay = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
        return dTime >= firstDay.getTime() && dTime <= lastDay.getTime();
      }
      if (filter === "custom") {
        const fromTime = new Date(customPeriod.from).getTime();
        const toTime = new Date(customPeriod.to).getTime();
        return dTime >= fromTime && dTime <= toTime;
      }
      return true;
    });

    setFilteredObracuni(filtered);
  }, [filter, customPeriod, selectedMonth, selectedYear, obracuniProfit]);

  // ---- dobijanje svih artikala za dropdown - samo artikli iz cjenovnika (sortirani po displayOrder) ----
  const allArtikli = useMemo(() => {
    // Sortiraj artikle iz cjenovnika po displayOrder
    return [...cjenovnik]
      .sort((a, b) => {
        const orderA = a.displayOrder !== null && a.displayOrder !== undefined ? a.displayOrder : 999999;
        const orderB = b.displayOrder !== null && b.displayOrder !== undefined ? b.displayOrder : 999999;
        return orderA - orderB;
      })
      .map((item) => item.naziv);
  }, [cjenovnik]);

  // ---- agregacija podataka za grafikon profita po artiklu ----
  const aggregateArtiklProfitData = useCallback((
    selectedArtikl: string,
    selectedFilter: "currentWeek" | "previousWeek" | "monthly" | "quarterly" | "selectMonth" | "custom"
  ): ArtiklProfitData[] => {
    let filteredData = obracuniProfit
      .map((o) => {
        const artikal = o.artikliProfit.find((a) => a.naziv === selectedArtikl);
        return {
          datum: o.datum,
          bruto: artikal ? artikal.bruto : 0, // prodajnaCijena * kolicina
          neto: artikal ? artikal.neto : 0,   // prava zarada = bruto - nabavna * kolicina - deo rashoda
        };
      })
      .filter((o) => o.bruto > 0 || o.neto > 0)
      .sort((a, b) => {
        const dateA = parseDatumToDate(a.datum).getTime();
        const dateB = parseDatumToDate(b.datum).getTime();
        return dateA - dateB; // Uzlazni redoslijed
      });

    const today = new Date();
    const getMonday = (d: Date) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      date.setDate(date.getDate() + diff);
      date.setHours(0, 0, 0, 0);
      return date;
    };

    if (selectedFilter === "currentWeek") {
      // Generiši 7 dana od ponedeljka do nedelje (trenutna sedmica)
      const sevenDaysData: ArtiklProfitData[] = [];
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      
      const monday = getMonday(todayDate);
      
      // Generiši 7 dana od ponedeljka do nedelje
      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const datumStr = `${day}.${month}.${year}`;
        
        // Pronađi SVE podatke za ovaj dan i sumiraj ih
        const dayObracuni = filteredData.filter((o) => {
          const dTime = parseDatumToDate(o.datum).getTime();
          return dTime >= date.getTime() && dTime < date.getTime() + 86400000;
        });
        
        const totalBruto = dayObracuni.reduce((sum, o) => sum + (Number(o.bruto) || 0), 0);
        const totalNeto = dayObracuni.reduce((sum, o) => sum + (Number(o.neto) || 0), 0);
        
        sevenDaysData.push({
          datum: datumStr,
          bruto: totalBruto,
          neto: totalNeto,
        });
      }
      
      return sevenDaysData;
    } else if (selectedFilter === "previousWeek") {
      // Generiši prethodnih 7 dana (prošla sedmica)
      const sevenDaysData: ArtiklProfitData[] = [];
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      
      const lastWeekDate = new Date(todayDate);
      lastWeekDate.setDate(todayDate.getDate() - 7);
      const lastWeekMonday = getMonday(lastWeekDate);
      
      // Generiši 7 dana od ponedeljka do nedelje (prošla sedmica)
      for (let i = 0; i < 7; i++) {
        const date = new Date(lastWeekMonday);
        date.setDate(lastWeekMonday.getDate() + i);
        
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const datumStr = `${day}.${month}.${year}`;
        
        // Pronađi SVE podatke za ovaj dan i sumiraj ih
        const dayObracuni = filteredData.filter((o) => {
          const dTime = parseDatumToDate(o.datum).getTime();
          return dTime >= date.getTime() && dTime < date.getTime() + 86400000;
        });
        
        const totalBruto = dayObracuni.reduce((sum, o) => sum + (Number(o.bruto) || 0), 0);
        const totalNeto = dayObracuni.reduce((sum, o) => sum + (Number(o.neto) || 0), 0);
        
        sevenDaysData.push({
          datum: datumStr,
          bruto: totalBruto,
          neto: totalNeto,
        });
      }
      
      return sevenDaysData;
    } else if (selectedFilter === "monthly") {
      // Mjesečni - vratiti 3 tačke: 0 na početku, zbir u sredini, 0 na kraju
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      firstDay.setHours(0, 0, 0, 0);
      const lastDay = new Date(today);
      lastDay.setHours(23, 59, 59, 999);
      const monthObracuni = filteredData.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= firstDay.getTime() && dTime <= lastDay.getTime();
      });

      const totalBruto = monthObracuni.reduce((sum, o) => sum + (Number(o.bruto) || 0), 0);
      const totalNeto = monthObracuni.reduce((sum, o) => sum + (Number(o.neto) || 0), 0);

      const month = String(firstDay.getMonth() + 1).padStart(2, "0");
      const year = firstDay.getFullYear();
      const firstLabel = `01.${month}.${year}`;
      const midLabel = `${month}/${year}`;
      const lastLabel = `${String(lastDay.getDate()).padStart(2, "0")}.${month}.${year}`;

      return [
        { datum: firstLabel, bruto: 0, neto: 0 },
        { datum: midLabel, bruto: totalBruto, neto: totalNeto },
        { datum: lastLabel, bruto: 0, neto: 0 },
      ];
    } else if (selectedFilter === "quarterly") {
      // Tromjesečni - prikaži 3 tačke (po mjesecu) sa zbirom svakog mjeseca
      const quarterlyData: ArtiklProfitData[] = [];
      for (let i = 0; i < 3; i++) {
        const monthStart = new Date(today);
        monthStart.setMonth(today.getMonth() - 2 + i);
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const monthEnd = new Date(monthStart);
        if (i === 2) {
          monthEnd.setHours(23, 59, 59, 999);
        } else {
          monthEnd.setMonth(monthStart.getMonth() + 1);
          monthEnd.setDate(0);
          monthEnd.setHours(23, 59, 59, 999);
        }

        const monthObracuni = filteredData.filter((o) => {
          const dTime = parseDatumToDate(o.datum).getTime();
          return dTime >= monthStart.getTime() && dTime <= monthEnd.getTime();
        });

        const totalBruto = monthObracuni.reduce((sum, o) => sum + (Number(o.bruto) || 0), 0);
        const totalNeto = monthObracuni.reduce((sum, o) => sum + (Number(o.neto) || 0), 0);

        const month = String(monthStart.getMonth() + 1).padStart(2, "0");
        const year = monthStart.getFullYear();

        quarterlyData.push({
          datum: `${month}/${year}`,
          bruto: totalBruto,
          neto: totalNeto,
        });
      }

      return quarterlyData;
    } else if (selectedFilter === "selectMonth") {
      // Odabrani mjesec - vratiti 3 tačke: 0 na početku, zbir u sredini, 0 na kraju
      const firstDay = new Date(selectedYear, selectedMonth - 1, 1);
      firstDay.setHours(0, 0, 0, 0);
      const lastDay = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
      const monthObracuni = filteredData.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= firstDay.getTime() && dTime <= lastDay.getTime();
      });

      const totalBruto = monthObracuni.reduce((sum, o) => sum + (Number(o.bruto) || 0), 0);
      const totalNeto = monthObracuni.reduce((sum, o) => sum + (Number(o.neto) || 0), 0);

      const month = String(firstDay.getMonth() + 1).padStart(2, "0");
      const year = firstDay.getFullYear();
      const firstLabel = `01.${month}.${year}`;
      const midLabel = `${month}/${year}`;
      const lastLabel = `${String(lastDay.getDate()).padStart(2, "0")}.${month}.${year}`;

      return [
        { datum: firstLabel, bruto: 0, neto: 0 },
        { datum: midLabel, bruto: totalBruto, neto: totalNeto },
        { datum: lastLabel, bruto: 0, neto: 0 },
      ];
    } else if (selectedFilter === "custom") {
      // Dinamička rezolucija za prilagođeni raspon (dnevno/sedmično/mjesečno)
      try {
        const from = new Date(customPeriod.from);
        const to = new Date(customPeriod.to);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        const msPerDay = 1000 * 60 * 60 * 24;
        const numberOfDays = Math.ceil((to.getTime() - from.getTime()) / msPerDay);

        if (numberOfDays <= 15) {
          // Dnevna agregacija
          const days: ArtiklProfitData[] = [];
          for (let i = 0; i <= numberOfDays; i++) {
            const d = new Date(from);
            d.setDate(from.getDate() + i);
            const day = String(d.getDate()).padStart(2, "0");
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const year = d.getFullYear();
            const label = `${day}.${month}.${year}`;

            const dayStart = new Date(d);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart.getTime() + msPerDay - 1);

            const dayData = filteredData.filter((o) => {
              const t = parseDatumToDate(o.datum).getTime();
              return t >= dayStart.getTime() && t <= dayEnd.getTime();
            });

            const totalBruto = dayData.reduce((s, o) => s + (Number(o.bruto) || 0), 0);
            const totalNeto = dayData.reduce((s, o) => s + (Number(o.neto) || 0), 0);

            days.push({ datum: label, bruto: totalBruto, neto: totalNeto });
          }
          return days;
        } else if (numberOfDays <= 60) {
          // Sedmična agregacija (ponedeljak-nedelja)
          const weeks: ArtiklProfitData[] = [];
          const startDate = new Date(from);
          const dayOfWeek = startDate.getDay();
          const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          startDate.setDate(startDate.getDate() + diffToMonday);
          startDate.setHours(0, 0, 0, 0);

          let current = new Date(startDate);
          while (current <= to) {
            const weekStart = new Date(current);
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            if (weekEnd > to) weekEnd.setTime(to.getTime());

            const d1 = String(weekStart.getDate()).padStart(2, "0");
            const m1 = String(weekStart.getMonth() + 1).padStart(2, "0");
            const d2 = String(weekEnd.getDate()).padStart(2, "0");
            const m2 = String(weekEnd.getMonth() + 1).padStart(2, "0");
            const y1 = weekStart.getFullYear();
            const y2 = weekEnd.getFullYear();
            
            // Format: ako je isti mjesec i godina: "15-21.12.2025", ako nisu: "29.12-04.01.2025"
            let label: string;
            if (m1 === m2 && y1 === y2) {
              label = `${d1}-${d2}.${m1}.${y1}`;
            } else if (y1 === y2) {
              label = `${d1}.${m1}-${d2}.${m2}.${y1}`;
            } else {
              label = `${d1}.${m1}.${y1}-${d2}.${m2}.${y2}`;
            }

            const weekData = filteredData.filter((o) => {
              const t = parseDatumToDate(o.datum).getTime();
              return t >= weekStart.getTime() && t <= weekEnd.getTime();
            });

            const totalBruto = weekData.reduce((s, o) => s + (Number(o.bruto) || 0), 0);
            const totalNeto = weekData.reduce((s, o) => s + (Number(o.neto) || 0), 0);

            weeks.push({ datum: label, bruto: totalBruto, neto: totalNeto });
            current.setDate(current.getDate() + 7);
          }
          return weeks;
        } else {
          // Mjesečna agregacija
          const months: ArtiklProfitData[] = [];
          const startMonth = new Date(from.getFullYear(), from.getMonth(), 1);
          let currentMonth = new Date(startMonth);
          const endDate = new Date(to);

          while (currentMonth <= endDate) {
            const monthStart = new Date(currentMonth);
            monthStart.setHours(0, 0, 0, 0);
            const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
            monthEnd.setHours(23, 59, 59, 999);
            if (monthEnd > endDate) monthEnd.setTime(endDate.getTime());

            const monthData = filteredData.filter((o) => {
              const t = parseDatumToDate(o.datum).getTime();
              return t >= monthStart.getTime() && t <= monthEnd.getTime();
            });

            const totalBruto = monthData.reduce((s, o) => s + (Number(o.bruto) || 0), 0);
            const totalNeto = monthData.reduce((s, o) => s + (Number(o.neto) || 0), 0);

            const label = `${String(monthStart.getMonth() + 1).padStart(2, "0")}/${monthStart.getFullYear()}`;
            months.push({ datum: label, bruto: totalBruto, neto: totalNeto });

            currentMonth.setMonth(currentMonth.getMonth() + 1);
          }
          return months;
        }
      } catch (e) {
        return filteredData.map((o) => ({ datum: o.datum, bruto: Number(o.bruto), neto: Number(o.neto) }));
      }
    }

    return filteredData.map((o) => ({
      datum: o.datum,
      bruto: Number(o.bruto),
      neto: Number(o.neto),
    }));
  }, [obracuniProfit, customPeriod, selectedMonth, selectedYear]);

  // ---- sortiranje podataka za glavni grafikon u uzlaznom redoslijedu ----
  const chartData = useMemo(() => {
    // Definiši `today` lokalno za cijeli useMemo (koristi se i u sigurnosnom bloku)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Za trenutnu i prošlu sedmicu, koristi istu logiku kao filteredObracuni (ponedeljak do nedelje)
    if (filter === "currentWeek" || filter === "previousWeek") {
      const sevenDaysData: Array<{ datum: string; bruto: number; neto: number; rashod: number }> = [];
      
      const getMonday = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        date.setDate(date.getDate() + diff);
        date.setHours(0, 0, 0, 0);
        return date;
      };
      
      // Odredi početni dan (ponedeljak) za trenutnu ili prošlu sedmicu
      let monday: Date;
      if (filter === "currentWeek") {
        monday = getMonday(today);
      } else {
        const lastWeekDate = new Date(today);
        lastWeekDate.setDate(today.getDate() - 7);
        monday = getMonday(lastWeekDate);
      }
      
      // Generiši 7 dana od ponedeljka do nedelje
      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        const datumStr = `${day}.${month}.${year}`;
        
        // Pronađi SVE podatke za ovaj dan i sumiraj ih - koristi obracuniProfit umjesto filteredObracuni
        const dayObracuni = obracuniProfit.filter((o) => {
          const dTime = parseDatumToDate(o.datum).getTime();
          return dTime >= date.getTime() && dTime < date.getTime() + 86400000;
        });
        
        // Debug log za mobilne uređaje
        if (typeof window !== 'undefined' && isMobile && i === 0) {
          console.log('📊 Profit Chart Debug - Dan:', datumStr, {
            dateTime: date.getTime(),
            dateStr: date.toISOString(),
            dayObracuniCount: dayObracuni.length,
            allObracuniCount: obracuniProfit.length,
            allObracuniDates: obracuniProfit.map(o => ({ datum: o.datum, bruto: o.ukupnoBruto, neto: o.ukupnoNeto })),
            mondayTime: monday.getTime(),
            mondayStr: monday.toISOString()
          });
        }
        
        if (dayObracuni.length > 0) {
          // Sumiraj sve obračune za ovaj dan
          const totalBruto = dayObracuni.reduce((sum, o) => sum + (o.ukupnoBruto || 0), 0);
          const totalNeto = dayObracuni.reduce((sum, o) => sum + (o.ukupnoNeto || 0), 0);
          const totalRashod = dayObracuni.reduce((sum, o) => sum + (o.ukupnoRashod || 0), 0);
          
          sevenDaysData.push({
            datum: datumStr,
            bruto: totalBruto,
            neto: totalNeto,
            rashod: totalRashod,
          });
        } else {
          sevenDaysData.push({
            datum: datumStr,
            bruto: 0,
            neto: 0,
            rashod: 0,
          });
        }
      }
      
      return sevenDaysData;
    }
    
    // Ako je mjesečni ili odabrani mjesec, vratiti tri tačke (0 - zbir - 0) da linija bude vidljiva
    if (filter === "monthly" || filter === "selectMonth") {
      const firstDay = filter === "selectMonth" ?
        new Date(selectedYear, selectedMonth - 1, 1) :
        new Date(today.getFullYear(), today.getMonth(), 1);
      firstDay.setHours(0, 0, 0, 0);
      const lastDay = filter === "selectMonth" ?
        new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999) :
        new Date(today);
      lastDay.setHours(23, 59, 59, 999);

      const monthObracuni = filteredObracuni.filter((o) => {
        const dTime = parseDatumToDate(o.datum).getTime();
        return dTime >= firstDay.getTime() && dTime <= lastDay.getTime();
      });

      const totalBruto = monthObracuni.reduce((sum, o) => sum + (o.ukupnoBruto || 0), 0);
      const totalNeto = monthObracuni.reduce((sum, o) => sum + (o.ukupnoNeto || 0), 0);
      const totalRashod = monthObracuni.reduce((sum, o) => sum + (o.ukupnoRashod || 0), 0);

      const month = String(firstDay.getMonth() + 1).padStart(2, "0");
      const year = firstDay.getFullYear();
      const firstLabel = `01.${month}.${year}`;
      const midLabel = `${month}/${year}`;
      const lastLabel = `${String(lastDay.getDate()).padStart(2, "0")}.${month}.${year}`;

      return [
        { datum: firstLabel, bruto: 0, neto: 0, rashod: 0 },
        { datum: midLabel, bruto: totalBruto, neto: totalNeto, rashod: totalRashod },
        { datum: lastLabel, bruto: 0, neto: 0, rashod: 0 },
      ];
    }

    // Za ostale filtere, koristi filteredObracuni ali sumiraj po danu ako ima više obračuna
    const groupedByDate = new Map<string, { bruto: number; neto: number; rashod: number }>();
    
    filteredObracuni.forEach((o) => {
      const datumKey = o.datum.trim().replace(/\.$/, ''); // Normalizuj datum
      const existing = groupedByDate.get(datumKey) || { bruto: 0, neto: 0, rashod: 0 };
      groupedByDate.set(datumKey, {
        bruto: existing.bruto + (o.ukupnoBruto || 0),
        neto: existing.neto + (o.ukupnoNeto || 0),
        rashod: existing.rashod + (o.ukupnoRashod || 0),
      });
    });
    
    const result = Array.from(groupedByDate.entries())
      .map(([datum, values]) => ({
        datum,
        bruto: values.bruto,
        neto: values.neto,
        rashod: values.rashod,
      }))
      .sort((a, b) => {
        const dateA = parseDatumToDate(a.datum).getTime();
        const dateB = parseDatumToDate(b.datum).getTime();
        return dateA - dateB;
      });

    // Safety: if filter is monthly/selectMonth but earlier logic somehow returned daily points,
    // aggregate them into a single mid-point with leading/trailing zeros to ensure a visible line.
    const currentFilter = filter as "currentWeek" | "previousWeek" | "monthly" | "quarterly" | "selectMonth" | "custom";
    if ((currentFilter === "monthly" || currentFilter === "selectMonth") && result.length > 3) {
      const firstDay = currentFilter === "selectMonth" ? new Date(selectedYear, selectedMonth - 1, 1) : new Date(today.getFullYear(), today.getMonth(), 1);
      firstDay.setHours(0, 0, 0, 0);
      const lastDay = currentFilter === "selectMonth" ? new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999) : new Date(today);
      lastDay.setHours(23, 59, 59, 999);

      // Sum existing values (in case groupedByDate already contains daily sums)
      const totalBruto = result.reduce((s, r) => s + (Number(r.bruto) || 0), 0);
      const totalNeto = result.reduce((s, r) => s + (Number(r.neto) || 0), 0);
      const totalRashod = result.reduce((s, r) => s + (Number(r.rashod) || 0), 0);

      const month = String(firstDay.getMonth() + 1).padStart(2, "0");
      const year = firstDay.getFullYear();
      const firstLabel = `01.${month}.${year}`;
      const midLabel = `${month}/${year}`;
      const lastLabel = `${String(lastDay.getDate()).padStart(2, "0")}.${month}.${year}`;

      return [
        { datum: firstLabel, bruto: 0, neto: 0, rashod: 0 },
        { datum: midLabel, bruto: totalBruto, neto: totalNeto, rashod: totalRashod },
        { datum: lastLabel, bruto: 0, neto: 0, rashod: 0 },
      ];
    }

    return result;
  }, [obracuniProfit, filter, selectedMonth, selectedYear]);

  // Display data for chart: ensure monthly/selectMonth always shows 3 points (0 - total - 0)
  const displayChartData = useMemo(() => {
    if (!chartData) return [];

    // Monthly / selectMonth: ensure 3 points
    if (filter === "monthly" || filter === "selectMonth") {
      if (chartData.length === 3) return chartData;

      // Sum totals from whatever chartData contains
      const totalBruto = chartData.reduce((s, r: any) => s + (Number(r.bruto) || 0), 0);
      const totalNeto = chartData.reduce((s, r: any) => s + (Number(r.neto) || 0), 0);
      const totalRashod = chartData.reduce((s, r: any) => s + (Number(r.rashod) || 0), 0);

      const now = new Date();
      const firstDay = filter === "selectMonth" ? new Date(selectedYear, selectedMonth - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
      firstDay.setHours(0, 0, 0, 0);
      const lastDay = filter === "selectMonth" ? new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999) : new Date(now);
      lastDay.setHours(23, 59, 59, 999);

      const month = String(firstDay.getMonth() + 1).padStart(2, "0");
      const year = firstDay.getFullYear();
      const firstLabel = `01.${month}.${year}`;
      const midLabel = `${month}/${year}`;
      const lastLabel = `${String(lastDay.getDate()).padStart(2, "0")}.${month}.${year}`;

      return [
        { datum: firstLabel, bruto: 0, neto: 0, rashod: 0 },
        { datum: midLabel, bruto: totalBruto, neto: totalNeto, rashod: totalRashod },
        { datum: lastLabel, bruto: 0, neto: 0, rashod: 0 },
      ];
    }

    // Quarterly: build 3 months * 3 points each (start 0, mid total, end 0)
    if (filter === "quarterly") {
      const now = new Date();
      const monthsData: Array<{ datum: string; bruto: number; neto: number; rashod: number }> = [];

      for (let i = 0; i < 3; i++) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - 2 + i, 1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
        // For the last month, cap at today
        if (i === 2) {
          monthEnd.setTime(now.getTime());
        }
        monthEnd.setHours(23, 59, 59, 999);

        const monthObracuni = obracuniProfit.filter((o) => {
          const dTime = parseDatumToDate(o.datum).getTime();
          return dTime >= monthStart.getTime() && dTime <= monthEnd.getTime();
        });

        const totalBruto = monthObracuni.reduce((s, o) => s + (o.ukupnoBruto || 0), 0);
        const totalNeto = monthObracuni.reduce((s, o) => s + (o.ukupnoNeto || 0), 0);
        const totalRashod = monthObracuni.reduce((s, o) => s + (o.ukupnoRashod || 0), 0);

        const month = String(monthStart.getMonth() + 1).padStart(2, "0");
        const year = monthStart.getFullYear();
        const midLabel = `${month}/${year}`;

        // Push a single point per month (mid label) with the monthly total
        monthsData.push({ datum: midLabel, bruto: totalBruto, neto: totalNeto, rashod: totalRashod });
      }

      return monthsData;
    }

    // Custom: dynamic resolution (0-15 days daily, 16-60 weekly, 60+ monthly)
    if (filter === "custom") {
      try {
        const from = new Date(customPeriod.from);
        const to = new Date(customPeriod.to);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        const msPerDay = 1000 * 60 * 60 * 24;
        const numberOfDays = Math.ceil((to.getTime() - from.getTime()) / msPerDay);

        if (numberOfDays <= 15) {
          // Daily points
          const days: Array<any> = [];
          for (let i = 0; i <= numberOfDays; i++) {
            const d = new Date(from);
            d.setDate(from.getDate() + i);
            const dayStr = String(d.getDate()).padStart(2, "0");
            const monthStr = String(d.getMonth() + 1).padStart(2, "0");
            const yearStr = d.getFullYear();
            const label = `${dayStr}.${monthStr}.${yearStr}`;

            const dayStart = new Date(d);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart.getTime() + msPerDay - 1);

            const dayObracuni = obracuniProfit.filter((o) => {
              const t = parseDatumToDate(o.datum).getTime();
              return t >= dayStart.getTime() && t <= dayEnd.getTime();
            });

            const totalBruto = dayObracuni.reduce((s, o) => s + (o.ukupnoBruto || 0), 0);
            const totalNeto = dayObracuni.reduce((s, o) => s + (o.ukupnoNeto || 0), 0);
            const totalRashod = dayObracuni.reduce((s, o) => s + (o.ukupnoRashod || 0), 0);

            days.push({ datum: label, bruto: totalBruto, neto: totalNeto, rashod: totalRashod });
          }
          return days;
        } else if (numberOfDays <= 60) {
          // Weekly aggregation (weeks starting Monday)
          const weeks: Array<any> = [];
          const startDate = new Date(from);
          const dayOfWeek = startDate.getDay();
          const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          startDate.setDate(startDate.getDate() + diffToMonday);
          startDate.setHours(0, 0, 0, 0);

          let current = new Date(startDate);
          while (current <= to) {
            const weekStart = new Date(current);
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            if (weekEnd > to) weekEnd.setTime(to.getTime());

            const d1 = String(weekStart.getDate()).padStart(2, "0");
            const m1 = String(weekStart.getMonth() + 1).padStart(2, "0");
            const d2 = String(weekEnd.getDate()).padStart(2, "0");
            const m2 = String(weekEnd.getMonth() + 1).padStart(2, "0");
            const y1 = weekStart.getFullYear();
            const y2 = weekEnd.getFullYear();
            
            // Format: ako je isti mjesec i godina: "15-21.12.2025", ako nisu: "29.12-04.01.2025"
            let label: string;
            if (m1 === m2 && y1 === y2) {
              label = `${d1}-${d2}.${m1}.${y1}`;
            } else if (y1 === y2) {
              label = `${d1}.${m1}-${d2}.${m2}.${y1}`;
            } else {
              label = `${d1}.${m1}.${y1}-${d2}.${m2}.${y2}`;
            }

            const weekObracuni = obracuniProfit.filter((o) => {
              const t = parseDatumToDate(o.datum).getTime();
              return t >= weekStart.getTime() && t <= weekEnd.getTime();
            });

            const totalBruto = weekObracuni.reduce((s, o) => s + (o.ukupnoBruto || 0), 0);
            const totalNeto = weekObracuni.reduce((s, o) => s + (o.ukupnoNeto || 0), 0);
            const totalRashod = weekObracuni.reduce((s, o) => s + (o.ukupnoRashod || 0), 0);

            weeks.push({ datum: label, bruto: totalBruto, neto: totalNeto, rashod: totalRashod });
            current.setDate(current.getDate() + 7);
          }
          return weeks;
        } else {
          // Monthly aggregation
          const months: Array<any> = [];
          const startMonth = new Date(from.getFullYear(), from.getMonth(), 1);
          let currentMonth = new Date(startMonth);
          const endDate = new Date(to);

          while (currentMonth <= endDate) {
            const monthStart = new Date(currentMonth);
            monthStart.setHours(0, 0, 0, 0);
            const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
            monthEnd.setHours(23, 59, 59, 999);
            if (monthEnd > endDate) monthEnd.setTime(endDate.getTime());

            const monthObracuni = obracuniProfit.filter((o) => {
              const t = parseDatumToDate(o.datum).getTime();
              return t >= monthStart.getTime() && t <= monthEnd.getTime();
            });

            const totalBruto = monthObracuni.reduce((s, o) => s + (o.ukupnoBruto || 0), 0);
            const totalNeto = monthObracuni.reduce((s, o) => s + (o.ukupnoNeto || 0), 0);
            const totalRashod = monthObracuni.reduce((s, o) => s + (o.ukupnoRashod || 0), 0);

            const label = `${String(monthStart.getMonth() + 1).padStart(2, "0")}/${monthStart.getFullYear()}`;
            months.push({ datum: label, bruto: totalBruto, neto: totalNeto, rashod: totalRashod });

            currentMonth.setMonth(currentMonth.getMonth() + 1);
          }
          return months;
        }
      } catch (e) {
        return chartData;
      }
    }

    return chartData;
  }, [chartData, filter, selectedMonth, selectedYear, obracuniProfit]);

  // ---- podaci za grafikon profita odabranog artikla ----
  // Ako nema odabranog artikla i artiklFilter je "currentWeek", generiši prazan chart sa datumima za trenutnu sedmicu
  const selectedArtiklData = selectedArtikl 
    ? aggregateArtiklProfitData(selectedArtikl, artiklFilter)
    : artiklFilter === "currentWeek"
    ? (() => {
        const sevenDaysData: ArtiklProfitData[] = [];
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        
        const getMonday = (d: Date) => {
          const date = new Date(d);
          const day = date.getDay();
          const diff = day === 0 ? -6 : 1 - day;
          date.setDate(date.getDate() + diff);
          date.setHours(0, 0, 0, 0);
          return date;
        };
        
        const monday = getMonday(todayDate);
        
        // Generiši 7 dana od ponedeljka do nedelje
        for (let i = 0; i < 7; i++) {
          const date = new Date(monday);
          date.setDate(monday.getDate() + i);
          
          const day = String(date.getDate()).padStart(2, "0");
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const year = date.getFullYear();
          const datumStr = `${day}.${month}.${year}`;
          
          sevenDaysData.push({
            datum: datumStr,
            bruto: 0,
            neto: 0,
          });
        }
        
        return sevenDaysData;
      })()
    : [];

  // ---- ukupni bruto i neto za odabrani artikal ----
  const totalArtiklSummary = useMemo(() => {
    return selectedArtiklData.reduce(
      (acc, o) => {
        acc.bruto += Number(o.bruto);
        acc.neto += Number(o.neto);
        return acc;
      },
      { bruto: 0, neto: 0 }
    );
  }, [selectedArtiklData]);

  const ukupnoPeriod = useMemo(() => {
    return filteredObracuni.reduce(
      (acc, o) => {
        acc.rashod += o.ukupnoRashod;
        acc.bruto += o.ukupnoBruto;
        acc.neto += o.ukupnoNeto;
        return acc;
      },
      { rashod: 0, bruto: 0, neto: 0 }
    );
  }, [filteredObracuni]);

  // ---- Custom Tooltip za grafikon ----
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: "#1f2937", color: "#fff", padding: 12, borderRadius: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
          {payload.map((p: any) => {
            return (
              <div key={p.dataKey} style={{ marginBottom: 4 }}>
                <span style={{ color: p.color, fontWeight: 500 }}>{p.name}: </span>
                {p.value.toFixed(2)} KM
              </div>
            );
          })}
        </div>
      );
    }
    return (
      <div style={{ backgroundColor: "#1f2937", color: "#fff", padding: 12, borderRadius: 8 }}>
        <div style={{ fontWeight: 600 }}>Odaberite artikal za prikaz podataka</div>
      </div>
    );
  };


  // Ako se još učitava provjera, prikaži loading
  if (isPasswordProtected === null) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f4f5f7"
      }}>
        <div style={{ fontSize: "16px", color: "#6b7280" }}>Učitavanje...</div>
      </div>
    );
  }

  // Ako je zaštićeno šifrom, prikaži password prompt
  if (isPasswordProtected) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f4f5f7",
        padding: "20px"
      }}>
        <div style={{
          background: "white",
          padding: "40px",
          borderRadius: "12px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
          maxWidth: "400px",
          width: "100%"
        }}>
          <h2 style={{ fontSize: "24px", fontWeight: 600, marginBottom: "24px", textAlign: "center", color: "#1f2937" }}>
            Zaštićeno šifrom
          </h2>
          <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "20px", textAlign: "center" }}>
            {isPasswordProtected
              ? "Unesite šifru za pristup Profit stranici"
              : "Postavite šifru za Profit stranicu (min. 4 znaka)"}
          </p>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => {
              setPasswordInput(e.target.value);
              setPasswordError("");
            }}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                handlePasswordSubmit();
              }
            }}
            placeholder="Unesite šifru"
            style={{
              width: "100%",
              padding: "12px 16px",
              marginBottom: "12px",
              borderRadius: "8px",
              border: passwordError ? "1px solid #dc2626" : "1px solid #d1d5db",
              fontSize: "16px",
              outline: "none",
              boxSizing: "border-box"
            }}
          />
          {passwordError && (
            <p style={{ color: "#dc2626", fontSize: "14px", marginBottom: "12px" }}>{passwordError}</p>
          )}
          <button
            onClick={handlePasswordSubmit}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: 500,
              cursor: "pointer",
              transition: "background-color 0.2s"
            }}
          >
            {isPasswordProtected ? "Pristupi" : "Postavi šifru"}
          </button>
        </div>
      </div>
    );
  }

  // Dinamički container style sa smanjenim padding-om na mobilnom
  const dynamicContainerStyle: React.CSSProperties = {
    ...containerStyle,
    padding: isMobile ? "4px" : "24px",
  };

  return (
    <div style={dynamicContainerStyle}>
      <style jsx>{`
        * {
          box-sizing: border-box;
        }
        @media (max-width: 768px) {
          div[style*='maxWidth: 1200px'] { 
            padding: 10px !important; 
            max-width: 100vw !important;
            overflow-x: hidden !important;
          }
          body {
            overflow-x: hidden !important;
          }
          h1 { font-size: 20px; margin-bottom: 16px !important; }
          h2 { font-size: 16px; margin-bottom: 12px !important; word-wrap: break-word; }
          div[style*='height: 300'] { 
            height: 310px !important; 
            min-height: 310px !important;
            padding: 0 !important; 
            max-width: 100% !important;
            overflow: hidden !important;
          }
          div[style*='display: flex'] { 
            flex-direction: column; 
            gap: 8px; 
            max-width: 100% !important;
          }
          button { 
            width: 100% !important; 
            max-width: 100% !important;
            margin: 4px 0; 
            padding: 10px; 
            font-size: 14px; 
            min-height: 44px; 
            box-sizing: border-box;
          }
          input[type="date"] { 
            width: 100% !important; 
            max-width: 100% !important;
            margin: 4px 0; 
            padding: 8px; 
            font-size: 14px; 
            min-height: 44px; 
            box-sizing: border-box;
          }
          select { 
            width: 100% !important; 
            max-width: 100% !important;
            padding: 8px; 
            font-size: 14px; 
            min-height: 44px; 
            box-sizing: border-box;
          }
          table { 
            font-size: 12px; 
            width: 100% !important;
            max-width: 100% !important;
            overflow-x: auto !important;
            display: block !important;
          }
          th, td { 
            padding: 8px !important; 
            font-size: 11px !important; 
            white-space: nowrap;
            min-width: 80px;
          }
          .recharts-wrapper { 
            width: 100% !important; 
            max-width: 100% !important;
            overflow: hidden !important;
          }
          .recharts-wrapper { 
            width: 100% !important; 
            height: 300px !important;
            min-height: 300px !important;
            position: relative !important;
            margin-bottom: 0 !important;
          }
          .recharts-surface { 
            width: 100% !important; 
            height: 100% !important;
            max-width: 100% !important;
          }
          .recharts-legend-wrapper {
            width: 100% !important;
          }
          div[style*='height: 300'][style*='backgroundColor: #fff'] {
            height: 300px !important;
            min-height: 300px !important;
            position: relative !important;
            overflow: visible !important;
            margin-bottom: 8px !important;
          }
          div[style*='gap: 24px'] { 
            flex-direction: column; 
            gap: 8px !important; 
            width: 100% !important;
            max-width: 100% !important;
          }
          div[style*='padding: 20px'] {
            padding: 10px !important;
            max-width: 100% !important;
            overflow: hidden !important;
          }
          label {
            width: 100% !important;
            margin-bottom: 8px !important;
          }
          div[style*='marginBottom: 20'] {
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      `}</style>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Profit</h1>
      
      {/* ---- Filter za ukupni profit ---- */}
      <FilterSection
        filter={filter}
        setFilter={setFilter}
        customPeriod={customPeriod}
        setCustomPeriod={setCustomPeriod}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        monthDropdownOpen={monthDropdownOpen}
        setMonthDropdownOpen={setMonthDropdownOpen}
        yearDropdownOpen={yearDropdownOpen}
        setYearDropdownOpen={setYearDropdownOpen}
        label="Filter ukupnog profita"
        isMobile={isMobile}
      />

      {/* ---- Chart ukupnog profita ---- */}
      <div style={{ 
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
      }}>
        <div style={{ width: "100%", height: isMobile ? 300 : 400, minHeight: isMobile ? 300 : 400, position: "relative", padding: isMobile ? "10px" : 0 }}>
          {(() => {
            // Debug log za mobilne uređaje
            if (typeof window !== 'undefined' && isMobile) {
              console.log('📱 Profit Chart Mobile Debug:', {
                loading: false,
                chartDataLength: chartData.length,
                isMobile,
                chartKey,
                windowWidth: window.innerWidth,
                hasChartData: chartData.length > 0,
                chartDataSample: chartData[0] || null
              });
            }
            return (
              <ResponsiveContainer 
                key={`profit-chart-${isMobile}-${chartData.length}-${chartKey}-${typeof window !== 'undefined' ? window.innerWidth : 0}`} 
                width="100%"
                height={isMobile ? 300 : 400}
              >
                <LineChart data={displayChartData || []} margin={{ top: isMobile ? 10 : 20, right: isMobile ? 10 : 20, left: isMobile ? 0 : 10, bottom: isMobile ? 30 : 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="datum" 
                    tick={{ fill: "#6b7280", fontSize: isMobile ? 10 : 11 }} 
                    angle={0}
                    textAnchor="middle"
                    height={isMobile ? 30 : 40}
                    tickMargin={isMobile ? 6 : 8}
                  />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} width={50} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: "12px" }} />
                  <Line type="monotone" dataKey="bruto" name="Bruto" stroke="#3b82f6" strokeWidth={isMobile ? 1.5 : 2} dot={{ r: isMobile ? 2 : 3 }} connectNulls={true} />
                  <Line type="monotone" dataKey="rashod" name="Rashod" stroke="#ef4444" strokeWidth={isMobile ? 1.5 : 2} dot={{ r: isMobile ? 2 : 3 }} connectNulls={true} />
                  <Line type="monotone" dataKey="neto" name="Neto" stroke="#10b981" strokeWidth={isMobile ? 1.5 : 2} dot={{ r: isMobile ? 2 : 3 }} connectNulls={true} />
                </LineChart>
              </ResponsiveContainer>
            );
          })()}
        </div>
      </div>

      {/* Kartice sa ukupnim bruto, rashod i neto vrednostima */}
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: isMobile ? 16 : 30, width: "100%", boxSizing: "border-box" }}>
        {[
          {
            label: "Bruto",
            value: ukupnoPeriod.bruto,
            icon: <FaArrowUp color="#3b82f6" size={20} />,
          },
          {
            label: "Rashod",
            value: ukupnoPeriod.rashod,
            icon: <FaArrowDown color="#ef4444" size={20} />,
          },
          {
            label: "Neto",
            value: ukupnoPeriod.neto,
            icon: <FaDollarSign color="#10b981" size={20} />,
          },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              flex: 1,
              minWidth: isMobile ? "calc(50% - 10px)" : 160,
              backgroundColor: "#fff",
              borderRadius: 12,
              padding: isMobile ? 16 : 20,
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
              transition: "transform 0.2s, box-shadow 0.2s",
              cursor: "default",
            }}
            className="dashboard-card"
          >
            <div>{item.icon}</div>
            <div style={{ textAlign: isMobile ? "center" : "left", flex: 1 }}>
              <div style={{ fontSize: isMobile ? 12 : 14, color: "#6b7280", marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: "#111827" }}>{item.value.toFixed(2)} KM</div>
            </div>
          </div>
        ))}
      </div>

      {/* ---- Odabir artikla i filter za grafikon profita po artiklu ---- */}
      <div style={{
        marginBottom: 20,
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        background: "#fff",
        borderRadius: "12px",
        padding: isMobile ? "16px" : "24px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        border: "1px solid #e5e7eb"
      }}>
        {/* Naslov sekcije */}
        <div style={{
          marginBottom: isMobile ? "16px" : "20px",
          paddingBottom: isMobile ? "12px" : "16px",
          borderBottom: "2px solid #f3f4f6"
        }}>
          <h2 style={{
            fontSize: isMobile ? "18px" : "20px",
            fontWeight: 600,
            color: "#1f2937",
            margin: 0
          }}>
            Profit po artiklu
          </h2>
          <p style={{
            fontSize: isMobile ? "13px" : "14px",
            color: "#6b7280",
            margin: "4px 0 0 0"
          }}>
            Odaberite artikal i vremenski period za detaljnu analizu
          </p>
        </div>

        {/* Odabir artikla */}
        <div style={{
          marginBottom: isMobile ? "20px" : "24px"
        }}>
          <label style={{
            display: "block",
            fontWeight: 600,
            fontSize: isMobile ? "14px" : "15px",
            color: "#374151",
            marginBottom: isMobile ? "8px" : "10px"
          }}>
            Odaberi artikal
          </label>
          <select
            value={selectedArtikl}
            onChange={(e) => setSelectedArtikl(e.target.value)}
            style={{
              width: "100%",
              padding: isMobile ? "10px 12px" : "12px 16px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              fontSize: isMobile ? "14px" : "15px",
              backgroundColor: "#fff",
              color: "#1f2937",
              cursor: "pointer",
              outline: "none",
              transition: "all 0.2s ease",
              boxSizing: "border-box",
              appearance: "none",
              backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
              backgroundPosition: "right 8px center",
              backgroundRepeat: "no-repeat",
              backgroundSize: "16px",
              paddingRight: isMobile ? "36px" : "40px"
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#3b82f6";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#d1d5db";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <option value="">Odaberi artikal...</option>
            {allArtikli.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {/* Filter sekcija */}
        <div>
          <label style={{
            display: "block",
            fontWeight: 600,
            fontSize: isMobile ? "14px" : "15px",
            color: "#374151",
            marginBottom: isMobile ? "12px" : "14px"
          }}>
            Vremenski period
          </label>
          <FilterSection
            filter={artiklFilter}
            setFilter={setArtiklFilter}
            customPeriod={customPeriod}
            setCustomPeriod={setCustomPeriod}
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            monthDropdownOpen={monthDropdownOpen}
            setMonthDropdownOpen={setMonthDropdownOpen}
            yearDropdownOpen={yearDropdownOpen}
            setYearDropdownOpen={setYearDropdownOpen}
            label=""
            isMobile={isMobile}
          />
        </div>
      </div>

      {/* ---- Grafikon profita odabranog artikla ---- */}
      <div
        style={{
        width: "100%",
        maxWidth: "100%",
        height: isMobile ? 310 : 400,
        minHeight: isMobile ? 310 : 400,
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: isMobile ? 0 : 20,
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        marginBottom: isMobile ? 16 : 30,
        boxSizing: "border-box",
        overflow: isMobile ? "visible" : "hidden",
        position: "relative"
      }}
      >
        <div style={{ width: "100%", height: isMobile ? 300 : 400, minHeight: isMobile ? 300 : 400, position: "relative", padding: isMobile ? "10px" : 0 }}>
          <ResponsiveContainer key={`artikl-profit-${isMobile}-${selectedArtiklData.length}-${chartKey}-${typeof window !== 'undefined' ? window.innerWidth : 0}`} width="100%" height={isMobile ? 300 : 400}>
            <LineChart data={selectedArtiklData || []} margin={{ top: isMobile ? 10 : 20, right: isMobile ? 10 : 20, left: isMobile ? 0 : 10, bottom: isMobile ? 30 : 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="datum" 
                tick={{ fill: "#6b7280", fontSize: isMobile ? 10 : 11 }} 
                angle={0}
                textAnchor="middle"
                height={isMobile ? 30 : 40}
                tickMargin={isMobile ? 6 : 8}
              />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} width={50} />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: "12px" }} />
              <Line type="monotone" dataKey="bruto" name="Bruto artikal" stroke="#3b82f6" strokeWidth={2} dot={{ r: isMobile ? 2 : 3 }} connectNulls={true} />
              <Line type="monotone" dataKey="neto" name="Neto artikal" stroke="#10b981" strokeWidth={2} dot={{ r: isMobile ? 2 : 3 }} connectNulls={true} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Kartice sa ukupnim bruto i neto vrednostima za odabrani artikal */}
      {selectedArtikl && (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: isMobile ? 16 : 30, width: "100%", boxSizing: "border-box" }}>
          {[
            {
              label: `Bruto (${selectedArtikl})`,
              value: totalArtiklSummary.bruto,
              icon: <FaArrowUp color="#3b82f6" size={20} />,
            },
            {
              label: `Neto (${selectedArtikl})`,
              value: totalArtiklSummary.neto,
              icon: <FaDollarSign color="#10b981" size={20} />,
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                flex: 1,
                minWidth: isMobile ? "calc(50% - 10px)" : 160,
                backgroundColor: "#fff",
                borderRadius: 12,
                padding: isMobile ? 16 : 20,
                display: "flex",
                alignItems: "center",
                gap: 12,
                boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                transition: "transform 0.2s, box-shadow 0.2s",
                cursor: "default",
              }}
              className="dashboard-card"
            >
              <div>{item.icon}</div>
              <div>
                <div style={{ fontSize: isMobile ? 12 : 14, color: "#6b7280", marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: "#111827" }}>{item.value.toFixed(2)} KM</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- Poruka ako nema podataka ---- */}
      {filteredObracuni.length === 0 && (
        <div style={{ 
          textAlign: "center", 
          padding: "40px", 
          background: "#fff", 
          borderRadius: "12px", 
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
          marginTop: "20px"
        }}>
          <p style={{ fontSize: "16px", color: "#6b7280", marginBottom: "8px" }}>
            Nema obračuna za odabrani period.
          </p>
          <p style={{ fontSize: "14px", color: "#9ca3af" }}>
            {obracuniProfit.length === 0 
              ? "Nema obračuna u arhivi. Spremite obračun da biste vidjeli profit." 
              : "Promijenite filter da biste vidjeli obračune za drugi period."}
          </p>
        </div>
      )}

      {/* ---- Detaljni obračuni po danima ---- */}
      {filteredObracuni.map((o, i) => (
        <div key={i} style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Obračun - {o.datum}</h2>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Artikal</th>
                <th style={thStyle}>Nabavna cijena</th>
                <th style={thStyle}>Prodajna cijena</th>
                <th style={thStyle}>Količina</th>
                <th style={thStyle}>Bruto</th>
                <th style={thStyle}>Neto</th>
                <th style={thStyle}>Profit po artiklu</th>
              </tr>
            </thead>
            <tbody>
              {o.artikliProfit.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "#9ca3af" }}>
                    Nema artikala s utrošenim količinama za ovaj obračun.
                  </td>
                </tr>
              ) : (
                o.artikliProfit.map((a, j) => (
                  <tr key={j}>
                    <td style={tdStyle}>{a.naziv}</td>
                    <td style={tdStyle}>{a.nabavnaCijena.toFixed(2)}</td>
                    <td style={tdStyle}>{a.prodajnaCijena.toFixed(2)}</td>
                    <td style={tdStyle}>{a.kolicina.toFixed(2)}</td>
                    <td style={tdStyle}>{a.bruto.toFixed(2)}</td>
                    <td style={tdStyle}>{a.neto.toFixed(2)}</td>
                    <td style={tdStyle}>{a.profit.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div style={summaryStyle}>
            <div style={summaryItemStyle("#ef4444")}>Ukupno rashod: {o.ukupnoRashod.toFixed(2)} KM</div>
            <div style={summaryItemStyle("#3b82f6")}>Ukupno bruto: {o.ukupnoBruto.toFixed(2)} KM</div>
            <div style={summaryItemStyle("#10b981")}>Ukupno neto: {o.ukupnoNeto.toFixed(2)} KM</div>
          </div>
        </div>
      ))}
    </div>
  );
}