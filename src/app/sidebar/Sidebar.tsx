"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
// TODO: Implementirati API poziv za autentifikaciju
import { FaTachometerAlt, FaCalculator, FaArchive, FaTags, FaDollarSign, FaUser, FaBars, FaShieldAlt } from "react-icons/fa";
import { useAppName } from "../context/AppNameContext";
import { useRole } from "../context/RoleContext";

const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { appName } = useAppName();
  const { role, permissions } = useRole();
  const [isBottomBarVisible, setIsBottomBarVisible] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Provjeri admin status preko API poziva
    const checkAdmin = async () => {
      try {
        const response = await fetch('/api/users/me');
        if (response.ok) {
          const user = await response.json();
          // Samo gitara.zizu@gmail.com ima pristup admin panelu
          const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "gitara.zizu@gmail.com";
          setIsAdmin(user.email === ADMIN_EMAIL);
        }
      } catch (error) {
        console.error("Greška pri provjeri admin statusa:", error);
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, []);

  // Definiši dozvole za svaku ulogu
  const canAccess = (path: string): boolean => {
    // Ako nema uloge, dozvoli pristup (za kompatibilnost)
    if (!role) return true;
    
    // Vlasnik ima pristup svemu
    if (role === "vlasnik") return true;
    
    // Konobar koristi dozvole iz permissions
    if (role === "konobar" && permissions) {
      const pathMap: Record<string, keyof typeof permissions> = {
        "/dashboard": "dashboard",
        "/obracun": "obracun",
        "/arhiva": "arhiva",
        "/cjenovnik": "cjenovnik",
        "/profit": "profit",
        "/profile": "profile",
      };
      
      const permissionKey = pathMap[path];
      return permissionKey ? (permissions[permissionKey] === true) : false;
    }
    
    // Ako je konobar ali nema dozvole, ne dozvoli pristup
    if (role === "konobar") return false;
    
    return false;
  };

  const allNavLinks = [
    { href: "/dashboard", label: "Radna površina", icon: <FaTachometerAlt /> },
    { href: "/obracun", label: "Obračun", icon: <FaCalculator /> },
    { href: "/arhiva", label: "Arhiva", icon: <FaArchive /> },
    { href: "/cjenovnik", label: "Cjenovnik", icon: <FaTags /> },
    { href: "/profit", label: "Profit", icon: <FaDollarSign /> },
    { href: "/profile", label: "Profil", icon: <FaUser /> },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: <FaShieldAlt /> }] : []),
  ];

  // Filtriraj linkove na osnovu uloge
  const navLinks = allNavLinks.filter(link => canAccess(link.href));

  // Ne prikazuj sidebar na login stranici
  if (pathname === "/login") {
    return null;
  }

  return (
    <>
      {isBottomBarVisible && (
        <nav
          style={{
            backgroundColor: "#1E1E2F",
            color: "#fff",
            padding: "10px 0",
            display: "flex",
            justifyContent: "space-around",
            alignItems: "center",
            position: "fixed",
            bottom: 0,
            left: 0,
            width: "100%",
            zIndex: 1000,
            boxShadow: "0 -2px 8px rgba(0,0,0,0.15)",
            height: "60px",
            transition: "transform 0.3s ease",
          }}
        >
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "2px",
                  padding: "5px",
                  borderRadius: "8px",
                  background: isActive ? "#3b82f6" : "transparent",
                  color: "#fff",
                  textDecoration: "none",
                  fontWeight: 500,
                  transition: "all 0.2s ease",
                  fontSize: "12px",
                  width: "16%", // Ravnomjerno raspoređeno za 6 linkova
                  textAlign: "center",
                }}
                className="sidebar-link"
              >
                {link.icon}
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
      <div
          style={{
            position: "fixed",
            bottom: "60px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1001,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "40px",
            height: "40px",
            backgroundColor: "#2A2A3F",
            borderRadius: "50%",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            transition: "transform 0.3s ease",
          }}
          onClick={() => setIsBottomBarVisible(!isBottomBarVisible)}
        >
          <FaBars style={{ color: "#fff", fontSize: "18px" }} />
        </div>
      <style jsx>{`
        .sidebar-link:hover {
          background-color: #3b82f6;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
        @media (max-width: 768px) {
          nav {
            height: 60px; /* Fiksna visina na mobilu */
          }
          .sidebar-link span {
            font-size: 10px; /* Smanji tekst na mobilu */
          }
          .sidebar-link {
            width: "16%"; /* Prilagođeno za 6 elemenata */
          }
          div[onClick] {
            bottom: ${isBottomBarVisible ? "60px" : "10px"}; /* Pomicanje ikone kad je bar sakriven */
            transform: ${isBottomBarVisible ? "translateX(-50%)" : "translateX(-50%) rotate(90deg)"};
          }
        }
        @media (min-width: 768px) {
          nav {
            height: 60px; /* Fiksna visina na desktopu */
          }
          .sidebar-link span {
            font-size: 12px; /* Normalni tekst na desktopu */
          }
        }
      `}</style>
    </>
  );
};

export default Sidebar;