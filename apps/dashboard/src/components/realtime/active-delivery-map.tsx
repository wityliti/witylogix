"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Navigation,
  MapPin,
  Users,
  RefreshCw,
  Truck,
} from "lucide-react";
import { useApiList } from "@/hooks/use-api";
import Link from "next/link";

interface ApiDriver {
  id: string;
  name: string;
  status: string;
  currentLocation: { lat?: number; lng?: number; latitude?: number; longitude?: number } | null;
  lastLocationAt: string | null;
  heading: number | null;
  vehicleType: string;
  _count: { orders: number };
}

interface ActiveDeliveryMapProps {
  className?: string;
}

const STATUS_CONFIG: Record<string, { color: string; label: string; badge: "success" | "primary" | "default" | "warning" }> = {
  AVAILABLE: { color: "#10B981", label: "Available", badge: "success" },
  ONLINE: { color: "#10B981", label: "Available", badge: "success" },
  ON_DELIVERY: { color: "#3B82F6", label: "On Delivery", badge: "primary" },
  ON_ROUTE: { color: "#3B82F6", label: "En Route", badge: "primary" },
  ASSIGNED: { color: "#3B82F6", label: "Assigned", badge: "primary" },
  ON_BREAK: { color: "#F59E0B", label: "On Break", badge: "warning" },
  OFFLINE: { color: "#6B7280", label: "Offline", badge: "default" },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status.toUpperCase()] ?? { color: "#6B7280", label: status, badge: "default" as const };
}

function timeAgo(ts: string | null): string | null {
  if (!ts) return null;
  const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function extractCoords(loc: ApiDriver["currentLocation"]) {
  if (!loc) return null;
  const lat = loc.lat ?? loc.latitude;
  const lng = loc.lng ?? loc.longitude;
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

function DriverDotMap({ drivers }: { drivers: ApiDriver[] }) {
  const withLoc = drivers.filter((d) => extractCoords(d.currentLocation));
  const [selected, setSelected] = useState<string | null>(null);

  if (withLoc.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-wl-bg-surface/50 rounded-lg gap-3">
        <MapPin className="w-8 h-8 text-wl-text-secondary opacity-30" />
        <p className="text-xs text-wl-text-secondary text-center px-4">
          No driver locations available.<br />Locations update as drivers go online.
        </p>
      </div>
    );
  }

  // Compute map bounds
  const lats = withLoc.map((d) => extractCoords(d.currentLocation)!.lat);
  const lngs = withLoc.map((d) => extractCoords(d.currentLocation)!.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const padLat = Math.max((maxLat - minLat) * 0.2, 0.01);
  const padLng = Math.max((maxLng - minLng) * 0.2, 0.01);
  const bMinLat = minLat - padLat;
  const bMaxLat = maxLat + padLat;
  const bMinLng = minLng - padLng;
  const bMaxLng = maxLng + padLng;
  const latRange = bMaxLat - bMinLat || 0.1;
  const lngRange = bMaxLng - bMinLng || 0.1;

  return (
    <div className="relative w-full h-full bg-[#0f0f1a] rounded-lg overflow-hidden border border-white/[0.04]">
      {/* Grid lines */}
      <svg className="absolute inset-0 w-full h-full opacity-10" preserveAspectRatio="none">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* Driver dots */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        {withLoc.map((driver) => {
          const coords = extractCoords(driver.currentLocation)!;
          const x = ((coords.lng - bMinLng) / lngRange) * 100;
          const y = 100 - ((coords.lat - bMinLat) / latRange) * 100;
          const cfg = getStatusConfig(driver.status);

          return (
            <g key={driver.id}>
              {/* Pulse ring for active drivers */}
              {driver.status !== "OFFLINE" && (
                <circle
                  cx={`${x}%`}
                  cy={`${y}%`}
                  r="12"
                  fill={`${cfg.color}25`}
                  stroke={cfg.color}
                  strokeWidth="1"
                  opacity="0.6"
                />
              )}
              {/* Driver dot */}
              <circle
                cx={`${x}%`}
                cy={`${y}%`}
                r="6"
                fill={cfg.color}
                className="cursor-pointer"
                onClick={() => setSelected(selected === driver.id ? null : driver.id)}
              />
              {/* Driver name label */}
              {selected === driver.id && (
                <text
                  x={`${x}%`}
                  y={`${Math.max(y - 5, 5)}%`}
                  textAnchor="middle"
                  fontSize="10"
                  fill="white"
                  fontWeight="600"
                  style={{ pointerEvents: "none" }}
                >
                  {driver.name.split(" ")[0]}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-1">
        {[
          { color: "#10B981", label: "Available" },
          { color: "#3B82F6", label: "On Delivery" },
          { color: "#6B7280", label: "Offline" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-white/50">{label}</span>
          </div>
        ))}
      </div>

      {/* Driver count */}
      <div className="absolute top-3 right-3 bg-black/40 rounded-md px-2 py-1">
        <span className="text-xs text-white/60">{withLoc.length} located</span>
      </div>
    </div>
  );
}

function DriverList({ drivers, loading }: { drivers: ApiDriver[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-2">
            <Skeleton className="w-8 h-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-2.5 w-16 rounded" />
            </div>
            <Skeleton className="h-5 w-16 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-y-auto flex-1">
      {drivers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-8 gap-2">
          <Users className="w-6 h-6 text-wl-text-secondary opacity-40" />
          <p className="text-xs text-wl-text-secondary">No drivers found</p>
        </div>
      ) : (
        <div className="space-y-1 p-2">
          {drivers.map((driver) => {
            const cfg = getStatusConfig(driver.status);
            const coords = extractCoords(driver.currentLocation);
            const ago = timeAgo(driver.lastLocationAt);

            return (
              <Link key={driver.id} href={`/drivers/${driver.id}`}>
                <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-wl-bg-surface transition-colors cursor-pointer">
                  <div className="relative flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-wl-bg-surface flex items-center justify-center">
                      <Truck className="w-4 h-4 text-wl-text-secondary" />
                    </div>
                    <div
                      className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-wl-bg-elevated"
                      style={{ backgroundColor: cfg.color }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-wl-text-primary truncate">{driver.name}</p>
                    <p className="text-[10px] text-wl-text-secondary">
                      {driver._count.orders > 0 ? `${driver._count.orders} active order${driver._count.orders !== 1 ? "s" : ""}` : "No active orders"}
                      {ago && !coords && <span> · GPS off</span>}
                      {ago && coords && <span> · {ago}</span>}
                    </p>
                  </div>

                  <Badge variant={cfg.badge as any} className="text-[10px] flex-shrink-0">
                    {cfg.label}
                  </Badge>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ActiveDeliveryMap({ className }: ActiveDeliveryMapProps) {
  const [view, setView] = useState<"map" | "list">("map");

  const { items: drivers, loading, error, refetch } = useApiList<ApiDriver>("/api/v4/drivers", {
    limit: 50,
    sort: "status:asc",
  });

  const activeDrivers = drivers.filter((d) => d.status !== "OFFLINE");
  const onDelivery = drivers.filter((d) => ["ON_DELIVERY", "ON_ROUTE", "ASSIGNED"].includes(d.status.toUpperCase())).length;

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-wl-border-subtle flex-shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-wl-text-primary tracking-wider uppercase flex items-center gap-2">
            <Navigation className="w-4 h-4" />
            Driver Overview
          </h3>
          <p className="text-xs text-wl-text-secondary mt-0.5">
            {loading ? "Loading…" : error ? "Error" : `${activeDrivers.length} active · ${onDelivery} on delivery`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-md overflow-hidden border border-wl-border-subtle">
            <button
              onClick={() => setView("map")}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium transition-colors",
                view === "map" ? "bg-wl-primary-500/20 text-wl-primary-400" : "text-wl-text-secondary hover:bg-wl-bg-overlay"
              )}
            >
              Map
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium transition-colors",
                view === "list" ? "bg-wl-primary-500/20 text-wl-primary-400" : "text-wl-text-secondary hover:bg-wl-bg-overlay"
              )}
            >
              List
            </button>
          </div>

          <button
            onClick={() => refetch()}
            className="p-1.5 rounded hover:bg-wl-bg-overlay transition-colors text-wl-text-secondary"
            aria-label="Refresh"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-3">
        {loading && drivers.length === 0 ? (
          <Skeleton className="w-full h-full rounded-lg" />
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <MapPin className="w-6 h-6 text-wl-danger-400 opacity-60" />
            <p className="text-xs text-wl-text-secondary">Failed to load driver data</p>
          </div>
        ) : view === "map" ? (
          <DriverDotMap drivers={drivers} />
        ) : (
          <DriverList drivers={drivers} loading={false} />
        )}
      </div>
    </Card>
  );
}
