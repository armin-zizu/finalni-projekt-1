"use client";

import React from "react";
import { cn } from "@/lib/theme";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "elevated" | "outlined";
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
}

export function Card({
  children,
  className,
  variant = "default",
  padding = "md",
  hover = false,
}: CardProps) {
  const variants = {
    default: "border border-gray-200 bg-white",
    elevated: "bg-white shadow-lg hover:shadow-xl transition-shadow duration-300",
    outlined: "border-2 border-gray-300 bg-white",
  };

  const paddings = {
    none: "",
    sm: "p-3",
    md: "p-5",
    lg: "p-6",
  };

  return (
    <div
      className={cn(
        "rounded-xl",
        variants[variant],
        paddings[padding],
        hover && "hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={cn("pb-4 border-b border-gray-100 mb-4", className)}>
      {children}
    </div>
  );
}

interface CardTitleProps {
  children: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export function CardTitle({ children, className, as: Component = "h3" }: CardTitleProps) {
  return (
    <Component className={cn("text-lg font-semibold text-gray-900", className)}>
      {children}
    </Component>
  );
}

interface CardDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function CardDescription({ children, className }: CardDescriptionProps) {
  return <p className={cn("text-sm text-gray-500 mt-1", className)}>{children}</p>;
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={cn("", className)}>{children}</div>;
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={cn("pt-4 border-t border-gray-100 mt-4", className)}>
      {children}
    </div>
  );
}

