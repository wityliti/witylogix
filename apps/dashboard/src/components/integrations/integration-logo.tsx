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
    ecommerce: { bg: "bg-blue-500/20 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400" },
    payment: { bg: "bg-green-500/20 dark:bg-green-900/30", text: "text-green-600 dark:text-green-400" },
    communication: { bg: "bg-purple-500/20 dark:bg-purple-900/30", text: "text-purple-600 dark:text-purple-400" },
    automation: { bg: "bg-orange-500/20 dark:bg-orange-900/30", text: "text-orange-600 dark:text-orange-400" },
    analytics: { bg: "bg-pink-500/20 dark:bg-pink-900/30", text: "text-pink-600 dark:text-pink-400" },
    routing: { bg: "bg-amber-500/20 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400" },
    maps: { bg: "bg-red-500/20 dark:bg-red-900/30", text: "text-red-600 dark:text-red-400" },
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
    ecommerce: { bg: "bg-blue-500", text: "text-white" },
    payment: { bg: "bg-green-500", text: "text-white" },
    communication: { bg: "bg-purple-500", text: "text-white" },
    automation: { bg: "bg-orange-500", text: "text-white" },
    analytics: { bg: "bg-pink-500", text: "text-white" },
    routing: { bg: "bg-amber-600", text: "text-white" },
    maps: { bg: "bg-red-500", text: "text-white" },
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
