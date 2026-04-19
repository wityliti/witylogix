"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * KpiRow / KpiCard — single source of truth for the stat-card band that
 * opens every Integrations sub-page.
 *
 * Design contract (frozen — see docs/superpowers/specs/
 * 2026-04-19-integrations-ux-cognitive-load-design.md §3.2):
 * - At most 4 cards per row. If a page needs more, pick the 4 most
 *   actionable and move the rest into a SectionCard below the fold.
 * - `tone` is a closed enum; it maps 1:1 to wl-* semantic tokens and is the
 *   only way state color reaches a KPI. Do not pass raw Tailwind colors.
 * - Optional `href` turns the whole card into a link with a focus ring.
 */

export type KpiTone = "default" | "success" | "warning" | "danger" | "info";

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  tone?: KpiTone;
  hint?: string;
  icon?: ReactNode;
  href?: string;
  isLoading?: boolean;
  className?: string;
}

const valueToneClass: Record<KpiTone, string> = {
  default: "text-wl-text-primary",
  success: "text-wl-success-400",
  warning: "text-wl-warning-400",
  danger: "text-wl-danger-400",
  info: "text-wl-info-400",
};

const accentToneClass: Record<KpiTone, string> = {
  default: "before:bg-wl-border-subtle",
  success: "before:bg-wl-success-400/60",
  warning: "before:bg-wl-warning-400/60",
  danger: "before:bg-wl-danger-400/60",
  info: "before:bg-wl-info-400/60",
};

const iconToneClass: Record<KpiTone, string> = {
  default: "text-wl-text-tertiary",
  success: "text-wl-success-400",
  warning: "text-wl-warning-400",
  danger: "text-wl-danger-400",
  info: "text-wl-info-400",
};

export function KpiCard ({
  label,
  value,
  tone = "default",
  hint,
  icon,
  href,
  isLoading,
  className,
}: KpiCardProps) {
  const baseClass = cn(
    "relative block rounded-xl border border-wl-border-subtle bg-wl-bg-surface px-5 py-4",
    "before:absolute before:left-0 before:top-0 before:h-full before:w-0.5 before:rounded-l-xl",
    accentToneClass[tone],
    href &&
      "transition-colors hover:border-wl-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wl-primary-500",
    className
  );

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-wl-text-tertiary">
          {label}
        </p>
        {icon && (
          <span className={cn("flex items-center", iconToneClass[tone])}>
            {icon}
          </span>
        )}
      </div>

      <div
        className={cn(
          "mt-2 text-3xl font-semibold leading-tight tracking-tight",
          valueToneClass[tone],
          isLoading && "opacity-50"
        )}
      >
        {isLoading ? "—" : value}
      </div>

      {hint && (
        <p className="mt-1 text-xs text-wl-text-tertiary">{hint}</p>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={baseClass} aria-label={label} role="listitem">
        {body}
      </Link>
    );
  }

  return (
    <div className={baseClass} role="listitem">
      {body}
    </div>
  );
}

export interface KpiRowProps {
  children: ReactNode;
  className?: string;
}

export function KpiRow ({ children, className }: KpiRowProps) {
  return (
    <div
      role="list"
      aria-label="Key metrics"
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}
