"use client";

import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg";

type IntegrationCategory =
  | "ecommerce"
  | "payment"
  | "communication"
  | "automation"
  | "analytics"
  | "routing"
  | "maps";

interface IntegrationLogoProps {
  provider: string;
  category?: IntegrationCategory;
  size?: LogoSize;
  isLoading?: boolean;
  className?: string;
}

/**
 * Integration Logo Component
 * Displays category-based icon or fallback to provider initials in colored circle
 * Supports: sm (24px), md (40px), lg (64px) sizes
 */
export function IntegrationLogo({
  provider,
  category = "ecommerce",
  size = "md",
  isLoading = false,
  className,
}: IntegrationLogoProps) {
  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-16 h-16 text-lg",
  };

  const sizeValues = {
    sm: 24,
    md: 40,
    lg: 64,
  };

  // Category to icon mapping
  const categoryIcons: Record<IntegrationCategory, string> = {
    ecommerce: "🛍️",
    payment: "💳",
    communication: "💬",
    automation: "⚙️",
    analytics: "📊",
    routing: "🚚",
    maps: "📍",
  };

  // Category to color mapping
  const categoryColors: Record<IntegrationCategory, { bg: string; text: string }> = {
    ecommerce: { bg: "bg-wl-info-bg", text: "text-wl-info-500" },
    payment: { bg: "bg-wl-success-bg", text: "text-wl-success-500" },
    communication: { bg: "bg-wl-primary-500/20", text: "text-wl-primary-500" },
    automation: { bg: "bg-wl-warning-bg", text: "text-wl-warning-500" },
    analytics: { bg: "bg-wl-chart-pink/20", text: "text-wl-chart-pink" },
    routing: { bg: "bg-wl-warning-bg", text: "text-wl-warning-400" },
    maps: { bg: "bg-wl-danger-bg", text: "text-wl-danger-500" },
  };

  const colors = categoryColors[category];
  const icon = categoryIcons[category];
  const initials = provider.slice(0, 2).toUpperCase();

  if (isLoading) {
    return (
      <div
        className={cn(
          sizeClasses[size],
          "rounded-full bg-wl-surface-hover animate-pulse",
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClasses[size],
        "rounded-full flex items-center justify-center font-semibold",
        colors.bg,
        colors.text,
        className
      )}
      title={`${provider} (${category})`}
    >
      {icon}
    </div>
  );
}

/**
 * Alternative logo component with initials fallback
 */
export function IntegrationLogoWithFallback({
  provider,
  category = "ecommerce",
  size = "md",
  isLoading = false,
  className,
}: IntegrationLogoProps) {
  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-16 h-16 text-lg",
  };

  // Category to color mapping for initials
  const categoryColors: Record<IntegrationCategory, { bg: string; text: string }> = {
    ecommerce: { bg: "bg-wl-info-500", text: "text-wl-text-inverse" },
    payment: { bg: "bg-wl-success-500", text: "text-wl-text-inverse" },
    communication: { bg: "bg-wl-primary-500", text: "text-wl-text-inverse" },
    automation: { bg: "bg-wl-warning-500", text: "text-wl-text-inverse" },
    analytics: { bg: "bg-wl-chart-pink", text: "text-wl-text-inverse" },
    routing: { bg: "bg-wl-warning-400", text: "text-wl-text-inverse" },
    maps: { bg: "bg-wl-danger-500", text: "text-wl-text-inverse" },
  };

  const colors = categoryColors[category];
  const initials = provider.slice(0, 2).toUpperCase();

  if (isLoading) {
    return (
      <div
        className={cn(
          sizeClasses[size],
          "rounded-full bg-wl-surface-hover animate-pulse",
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClasses[size],
        "rounded-full flex items-center justify-center font-bold",
        colors.bg,
        colors.text,
        className
      )}
      title={provider}
    >
      {initials}
    </div>
  );
}
