import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    PENDING: "var(--wl-warning-400)",
    ACCEPTED: "var(--wl-info-400)",
    ASSIGNED: "var(--wl-info-500)",
    PICKED_UP: "var(--wl-primary-400)",
    OUT_FOR_DELIVERY: "var(--wl-primary-500)",
    ARRIVED: "var(--wl-success-400)",
    DELIVERED: "var(--wl-success-500)",
    FAILED: "var(--wl-danger-500)",
    RETURNED: "var(--wl-danger-400)",
    CANCELLED: "var(--wl-neutral-500)",
    AVAILABLE: "var(--wl-success-400)",
    ON_ROUTE: "var(--wl-primary-400)",
    OFFLINE: "var(--wl-neutral-500)",
    ON_BREAK: "var(--wl-warning-400)",
    HEALTHY: "var(--wl-success-400)",
    DEGRADED: "var(--wl-warning-400)",
    ERROR: "var(--wl-danger-400)",
    UNKNOWN: "var(--wl-neutral-500)",
  };
  return map[status] ?? "var(--wl-neutral-400)";
}
