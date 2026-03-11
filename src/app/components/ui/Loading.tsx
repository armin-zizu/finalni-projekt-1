"use client";

import React from "react";
import { cn } from "@/lib/theme";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
}

export function LoadingSpinner({ size = "md", text, className }: LoadingSpinnerProps) {
  const sizes = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center py-8", className)}>
      <div
        className={cn(
          "animate-spin rounded-full border-4 border-blue-200 border-t-blue-600",
          sizes[size]
        )}
      />
      {text && (
        <p className={cn("mt-4 text-gray-500", textSizes[size])}>{text}</p>
      )}
    </div>
  );
}

interface LoadingOverlayProps {
  isLoading: boolean;
  children: React.ReactNode;
  text?: string;
}

export function LoadingOverlay({ isLoading, children, text }: LoadingOverlayProps) {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-inherit">
          <LoadingSpinner text={text} />
        </div>
      )}
    </div>
  );
}

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className, variant = "rectangular", width, height }: SkeletonProps) {
  const variants = {
    text: "rounded h-4",
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
      style={{ width, height }}
    />
  );
}

interface PageSkeletonProps {
  rows?: number;
}

export function PageSkeleton({ rows = 5 }: PageSkeletonProps) {
  return (
    <div className="space-y-4 p-6">
      <Skeleton height={40} width="40%" />
      <Skeleton height={200} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton variant="circular" width={48} height={48} />
          <div className="flex-1 space-y-2">
            <Skeleton width="30%" />
            <Skeleton width="60%" />
          </div>
        </div>
      ))}
    </div>
  );
}

