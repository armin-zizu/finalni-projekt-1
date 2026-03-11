
"use client";

import React from "react";
import { cn } from "@/lib/theme";
import { Button } from "./Button";

// Ikone kao SVG komponente
export const PackageIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
  </svg>
);

export const SearchIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
);

export const DocumentIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

export const UserIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);

export const InboxIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5a3.75 3.75 0 111.5-2.25m9 0a3.75 3.75 0 111.5-2.25m9 0v6a3.75 3.75 0 01-3.75 3.75h-1.5a1.125 1.125 0 01-1.125-1.125v-6a3.75 3.75 0 013.75-3.75h9.75c.621 0 1.125.504 1.125 1.125v6a3.75 3.75 0 01-3.75 3.75H6.75a3.75 3.75 0 01-3.75-3.75v-6a3.75 3.75 0 013.75-3.75h9.75" />
  </svg>
);

export const FolderIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
  </svg>
);

export const ChartIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  accountStatus?: "trial" | "grace" | "premium";
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  accountStatus,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        className
      )}
    >
      {accountStatus && (
        <div style={{
          marginBottom: 8,
          padding: "4px 12px",
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 13,
          background: accountStatus === "premium" ? "#d1fae5" : accountStatus === "grace" ? "#fef9c3" : "#e0e7ff",
          color: accountStatus === "premium" ? "#065f46" : accountStatus === "grace" ? "#92400e" : "#3730a3"
        }}>
          {accountStatus === "premium" ? "Premium račun" : accountStatus === "grace" ? "Grace period" : "Trial račun"}
        </div>
      )}
      {icon && (
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-gray-400">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-gray-500 max-w-sm mb-6">{description}</p>
      )}
      {action}
    </div>
  );
}

// Preddefinirani Empty State-ovi za česte slučajeve
interface NoDataProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export function NoDataEmptyState({
  title = "Nema podataka",
  description = "Trenutno ne postoje podaci za prikaz.",
  action,
}: NoDataProps) {
  return (
    <EmptyState
      icon={<InboxIcon className="w-8 h-8" />}
      title={title}
      description={description}
      action={action}
    />
  );
}

export function NoResultsEmptyState({
  title = "Nema rezultata",
  description = "Pokušajte sa drugačijim parametrima pretrage.",
  action,
}: NoDataProps) {
  return (
    <EmptyState
      icon={<SearchIcon className="w-8 h-8" />}
      title={title}
      description={description}
      action={action}
    />
  );
}

export function NoItemsEmptyState({
  title = "Nema artikala",
  description = "Vaš cjenovnik je prazan. Dodajte prvi artikal.",
  action,
}: NoDataProps) {
  return (
    <EmptyState
      icon={<PackageIcon className="w-8 h-8" />}
      title={title}
      description={description}
      action={action}
    />
  );
}

export function UnauthorizedEmptyState({
  title = "Pristup odbijen",
  description = "Nemate dozvolu za pristup ovoj stranici.",
}: Omit<NoDataProps, "action">) {
  return (
    <EmptyState
      icon={<UserIcon className="w-8 h-8" />}
      title={title}
      description={description}
    />
  );
}

export function ErrorEmptyState({
  title = "Došlo je do greške",
  description = "Pokušajte ponovo ili kontaktirajte podršku.",
  action,
}: NoDataProps) {
  return (
    <EmptyState
      icon={<DocumentIcon className="w-8 h-8" />}
      title={title}
      description={description}
      action={action}
    />
  );
}

