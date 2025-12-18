"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
// TODO: Implementirati API poziv za autentifikaciju
import { FaTachometerAlt, FaCalculator, FaArchive, FaTags, FaDollarSign, FaUser, FaShieldAlt } from "react-icons/fa";
import { useAppName } from "../context/AppNameContext";
import { useRole } from "../context/RoleContext";

const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { appName } = useAppName();
  const { role, permissions, user } = useRole();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Provjeri admin status koristeći user email iz RoleContext
    const checkAdmin = () => {
      try {
        if (!user?.email) {
          console.log("Admin check: No user email available");
          setIsAdmin(false);
          return;
        }

        // Samo gitara.zizu@gmail.com ima pristup admin panelu
        const envAdminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
        const ADMIN_EMAIL = (envAdminEmail || "gitara.zizu@gmail.com").toLowerCase().trim();
        const userEmail = (user.email || "").toLowerCase().trim();
        const isUserAdmin = userEmail === ADMIN_EMAIL;
        
        console.log("Admin check:", { 
          userEmail, 
          ADMIN_EMAIL, 
          envAdminEmail,
          isUserAdmin,
          match: userEmail === ADMIN_EMAIL,
          userFromContext: user
        });
        
        setIsAdmin(isUserAdmin);
      } catch (error) {
        console.error("Greška pri provjeri admin statusa:", error);
        setIsAdmin(false);
      }
    };
    
    // Proveri admin status kada se user učita
    checkAdmin();
  }, [user?.email]);

  // Definiši dozvole za svaku ulogu
  const canAccess = (path: string): boolean => {
    // Admin stranica - samo ako je isAdmin true
    if (path === "/admin") {
      return isAdmin;
    }
    
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