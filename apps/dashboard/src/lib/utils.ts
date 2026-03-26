import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS classes with support for overrides.
 * Combines clsx for conditional classes with twMerge for resolving Tailwind conflicts.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as currency (USD by default)
 */
export function formatCurrency(amount: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a date/timestamp as a relative time string (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string | number): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - dateObj.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Format a number with locale-specific separators
 */
export function formatNumber(num: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale).format(num);
}

/**
 * Map a status string to a CSS color variable name
 */
export function statusColor(status: string): string {
  const map: Record<string, string> = {
    active: 'var(--wl-success-400)',
    completed: 'var(--wl-success-400)',
    delivered: 'var(--wl-success-400)',
    pending: 'var(--wl-warning-400)',
    in_progress: 'var(--wl-info-400)',
    in_transit: 'var(--wl-info-400)',
    failed: 'var(--wl-error-400)',
    cancelled: 'var(--wl-error-400)',
    inactive: 'var(--wl-neutral-400)',
  };
  return map[status?.toLowerCase()] ?? 'var(--wl-neutral-400)';
}
