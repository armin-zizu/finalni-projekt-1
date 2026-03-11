"use client";

import React from "react";
import { cn } from "@/lib/theme";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-4 border-blue-200 border-t-blue-600",
        sizes[size],
        className
      )}
    />
  );
}

interface LoadingProps {
  text?: string;
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
}

export function Loading({ text = "Učitavanje...", size = "md", fullScreen = false }: LoadingProps) {
  const containerClass = fullScreen
    ? "min-h-screen flex flex-col items-center justify-center"
    : "flex flex-col items-center justify-center py-12";

  return (
    <div className={containerClass}>
      <LoadingSpinner size={size} />
      {text && (
        <p className="mt-4 text-sm font-medium text-gray-500 animate-pulse">{text}</p>
      )}
    </div>
  );
}

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
}

export function Skeleton({ className, variant = "rectangular" }: SkeletonProps) {
  const variants = {
    text: "h-4 w-full rounded",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  };

  return (
    <div
      className={cn(
        "animate-pulse bg-gray-200",
        variants[variant],
        className
      )}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" className="w-12 h-12" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-20 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="px-6 py-4 border-b border-gray-100 flex gap-4 items-center"
        >
          {[1, 2, 3, 4, 5].map((j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

