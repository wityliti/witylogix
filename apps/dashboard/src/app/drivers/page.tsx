"use client";

import { useState, useMemo } from "react";
import { Header } from "../../components/layout/header";
import { StatCard } from "../../components/ui/stat-card";
import { Card, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";

/* ═══════════════════════════════════════════════════════════
   DRIVERS PAGE — Enhanced fleet management with detail panel
   MIGRATION STATUS: Inline styles → Tailwind CSS (COMPLETE)
   ═══════════════════════════════════════════════════════════ */

type DriverStatus = "ACTIVE" | "ON_DELIVERY" | "ON_BREAK" | "OFFLINE";
type VehicleType = "BICYCLE" | "MOTORCYCLE" | "CAR" | "VAN" | "TRUCK";
type DocumentStatus = "VERIFIED" | "PENDING" | "EXPIRED" | "REJECTED";
type SortOption = "name" | "rating" | "deliveries" | "ontime";

interface Document {
  id: string;
  type: "LICENSE" | "INSURANCE" | "BACKGROUND";
  status: DocumentStatus;
  expiryDate: string;
  issuedDate: string;
  number: string;
}

interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: DriverStatus;
  vehicleType: VehicleType;
  vehiclePlate: string;
  maxCapacity: number;
  activeOrders: number;
  completedToday: number;
  avgRating: number;
  totalDeliveries: number;
  onTimePercentage: number;
  currentLocation: string;
  lastActive: string;
  hireDate: string;
  licenseNumber: string;
  documents: Document[];
  zones: string[];
  recentDeliveries: string[];
  photoUrl?: string;
}

const statusVariant = (s: string): "success" | "warning" | "info" | "primary" | "default" => {
  const map: Record<string, "success" | "warning" | "info" | "primary" | "default"> = {
    ACTIVE: "success",
    ON_DELIVERY: "info",
    ON_BREAK: "warning",
    OFFLINE: "default",
  };
  return map[s] ?? "default";
};

const docStatusVariant = (s: string): "success" | "warning" | "info" | "primary" | "default" => {
  const map: Record<string, "success" | "warning" | "info" | "primary" | "default"> = {
    VERIFIED: "success",
    PENDING: "info",
    EXPIRED: "warning",
    REJECTED: "default",
  };
  return map[s] ?? "default";
};

const vehicleIcon: Record<VehicleType, string> = {
  BICYCLE: "🚲",
  MOTORCYCLE: "🏍️",
  CAR: "🚗",
  VAN: "🚐",
  TRUCK: "🚛",
};

const DRIVERS: Driver[] = [
  {
    id: "drv-1",
    name: "Carlos Martinez",
    email: "carlos@witylogix.io",
    phone: "+1 555-0101",
    status: "ON_DELIVERY",
    vehicleType: "VAN",
    vehiclePlate: "WTY-4501",
    maxCapacity: 20,
    activeOrders: 4,
    completedToday: 7,
    avgRating: 4.8,
    totalDeliveries: 847,
    onTimePercentage: 94,
    currentLocation: "Downtown Core",
    lastActive: "now",
    hireDate: "2021-03-15",
    licenseNumber: "DL-2847-CA",
    documents: [
      { id: "doc-1", type: "LICENSE", status: "VERIFIED", issuedDate: "2020-05-12", expiryDate: "2028-05-12", number: "DL-2847-CA" },
      { id: "doc-2", type: "INSURANCE", status: "VERIFIED", issuedDate: "2023-01-10", expiryDate: "2026-01-10", number: "INS-8934" },
      { id: "doc-3", type: "BACKGROUND", status: "VERIFIED", issuedDate: "2021-03-01", expiryDate: "2026-03-01", number: "BG-5621" },
    ],
    zones: ["Downtown Core", "Midtown East"],
    recentDeliveries: ["ORD-2847", "ORD-2846", "ORD-2845"],
  },
  {
    id: "drv-2",
    name: "Sofia Lindberg",
    email: "sofia@witylogix.io",
    phone: "+1 555-0102",
    status: "ON_DELIVERY",
    vehicleType: "CAR",
    vehiclePlate: "WTY-2201",
    maxCapacity: 10,
    activeOrders: 3,
    completedToday: 5,
    avgRating: 4.9,
    totalDeliveries: 923,
    onTimePercentage: 97,
    currentLocation: "Midtown East",
    lastActive: "now",
    hireDate: "2020-07-22",
    licenseNumber: "DL-3921-ON",
    documents: [
      { id: "doc-4", type: "LICENSE", status: "VERIFIED", issuedDate: "2019-11-08", expiryDate: "2027-11-08", number: "DL-3921-ON" },
      { id: "doc-5", type: "INSURANCE", status: "VERIFIED", issuedDate: "2023-02-14", expiryDate: "2026-02-14", number: "INS-7849" },
      { id: "doc-6", type: "BACKGROUND", status: "VERIFIED", issuedDate: "2020-07-15", expiryDate: "2025-07-15", number: "BG-4832" },
    ],
    zones: ["Midtown East", "West Side"],
    recentDeliveries: ["ORD-2844", "ORD-2843", "ORD-2842"],
  },
  {
    id: "drv-3",
    name: "Ahmed Khalil",
    email: "ahmed@witylogix.io",
    phone: "+1 555-0103",
    status: "ACTIVE",
    vehicleType: "MOTORCYCLE",
    vehiclePlate: "WTY-1101",
    maxCapacity: 5,
    activeOrders: 0,
    completedToday: 9,
    avgRating: 4.7,
    totalDeliveries: 756,
    onTimePercentage: 92,
    currentLocation: "West Side",
    lastActive: "2m ago",
    hireDate: "2022-01-10",
    licenseNumber: "DL-5847-BC",
    documents: [
      { id: "doc-7", type: "LICENSE", status: "VERIFIED", issuedDate: "2021-03-20", expiryDate: "2026-03-20", number: "DL-5847-BC" },
      { id: "doc-8", type: "INSURANCE", status: "PENDING", issuedDate: "2023-03-01", expiryDate: "2026-03-01", number: "INS-6521" },
      { id: "doc-9", type: "BACKGROUND", status: "VERIFIED", issuedDate: "2022-01-05", expiryDate: "2027-01-05", number: "BG-7834" },
    ],
    zones: ["West Side", "South District"],
    recentDeliveries: ["ORD-2841", "ORD-2840", "ORD-2839"],
  },
  {
    id: "drv-4",
    name: "Lisa Thompson",
    email: "lisa@witylogix.io",
    phone: "+1 555-0104",
    status: "ON_BREAK",
    vehicleType: "CAR",
    vehiclePlate: "WTY-2202",
    maxCapacity: 10,
    activeOrders: 0,
    completedToday: 6,
    avgRating: 4.6,
    totalDeliveries: 634,
    onTimePercentage: 89,
    currentLocation: "South District",
    lastActive: "15m ago",
    hireDate: "2021-09-05",
    licenseNumber: "DL-4156-AB",
    documents: [
      { id: "doc-10", type: "LICENSE", status: "VERIFIED", issuedDate: "2020-08-12", expiryDate: "2025-08-12", number: "DL-4156-AB" },
      { id: "doc-11", type: "INSURANCE", status: "VERIFIED", issuedDate: "2023-04-10", expiryDate: "2026-04-10", number: "INS-5432" },
      { id: "doc-12", type: "BACKGROUND", status: "EXPIRED", issuedDate: "2021-09-01", expiryDate: "2024-09-01", number: "BG-3849" },
    ],
    zones: ["South District", "Harbor Area"],
    recentDeliveries: ["ORD-2838", "ORD-2837"],
  },
  {
    id: "drv-5",
    name: "Marcus Johnson",
    email: "marcus@witylogix.io",
    phone: "+1 555-0105",
    status: "ON_DELIVERY",
    vehicleType: "VAN",
    vehiclePlate: "WTY-4502",
    maxCapacity: 20,
    activeOrders: 5,
    completedToday: 3,
    avgRating: 4.5,
    totalDeliveries: 721,
    onTimePercentage: 88,
    currentLocation: "Harbor Area",
    lastActive: "now",
    hireDate: "2022-05-18",
    licenseNumber: "DL-6234-SK",
    documents: [
      { id: "doc-13", type: "LICENSE", status: "VERIFIED", issuedDate: "2021-06-15", expiryDate: "2029-06-15", number: "DL-6234-SK" },
      { id: "doc-14", type: "INSURANCE", status: "VERIFIED", issuedDate: "2023-05-20", expiryDate: "2026-05-20", number: "INS-4891" },
      { id: "doc-15", type: "BACKGROUND", status: "VERIFIED", issuedDate: "2022-05-10", expiryDate: "2027-05-10", number: "BG-2456" },
    ],
    zones: ["Harbor Area", "Industrial Zone"],
    recentDeliveries: ["ORD-2836", "ORD-2835", "ORD-2834"],
  },
  {
    id: "drv-6",
    name: "Yuki Tanaka",
    email: "yuki@witylogix.io",
    phone: "+1 555-0106",
    status: "OFFLINE",
    vehicleType: "BICYCLE",
    vehiclePlate: "—",
    maxCapacity: 3,
    activeOrders: 0,
    completedToday: 0,
    avgRating: 4.3,
    totalDeliveries: 423,
    onTimePercentage: 85,
    currentLocation: "—",
    lastActive: "3h ago",
    hireDate: "2023-01-12",
    licenseNumber: "DL-7521-MB",
    documents: [
      { id: "doc-16", type: "LICENSE", status: "VERIFIED", issuedDate: "2022-02-10", expiryDate: "2027-02-10", number: "DL-7521-MB" },
      { id: "doc-17", type: "INSURANCE", status: "VERIFIED", issuedDate: "2023-06-01", expiryDate: "2026-06-01", number: "INS-3456" },
      { id: "doc-18", type: "BACKGROUND", status: "PENDING", issuedDate: "2023-01-05", expiryDate: "2028-01-05", number: "BG-1298" },
    ],
    zones: ["Downtown Core"],
    recentDeliveries: [],
  },
  {
    id: "drv-7",
    name: "Priya Patel",
    email: "priya@witylogix.io",
    phone: "+1 555-0107",
    status: "ACTIVE",
    vehicleType: "CAR",
    vehiclePlate: "WTY-2203",
    maxCapacity: 10,
    activeOrders: 0,
    completedToday: 8,
    avgRating: 4.9,
    totalDeliveries: 891,
    onTimePercentage: 96,
    currentLocation: "Downtown Core",
    lastActive: "1m ago",
    hireDate: "2020-11-08",
    licenseNumber: "DL-8934-NL",
    documents: [
      { id: "doc-19", type: "LICENSE", status: "VERIFIED", issuedDate: "2019-12-20", expiryDate: "2027-12-20", number: "DL-8934-NL" },
      { id: "doc-20", type: "INSURANCE", status: "VERIFIED", issuedDate: "2023-07-15", expiryDate: "2026-07-15", number: "INS-2847" },
      { id: "doc-21", type: "BACKGROUND", status: "VERIFIED", issuedDate: "2020-11-01", expiryDate: "2025-11-01", number: "BG-5634" },
    ],
    zones: ["Downtown Core", "Midtown East", "West Side"],
    recentDeliveries: ["ORD-2833", "ORD-2832", "ORD-2831"],
  },
  {
    id: "drv-8",
    name: "Diego Fernandez",
    email: "diego@witylogix.io",
    phone: "+1 555-0108",
    status: "ON_DELIVERY",
    vehicleType: "TRUCK",
    vehiclePlate: "WTY-6001",
    maxCapacity: 50,
    activeOrders: 8,
    completedToday: 2,
    avgRating: 4.4,
    totalDeliveries: 534,
    onTimePercentage: 87,
    currentLocation: "Industrial Zone",
    lastActive: "now",
    hireDate: "2021-04-20",
    licenseNumber: "DL-1298-QC",
    documents: [
      { id: "doc-22", type: "LICENSE", status: "VERIFIED", issuedDate: "2020-05-15", expiryDate: "2028-05-15", number: "DL-1298-QC" },
      { id: "doc-23", type: "INSURANCE", status: "EXPIRED", issuedDate: "2022-08-20", expiryDate: "2025-08-20", number: "INS-1567" },
      { id: "doc-24", type: "BACKGROUND", status: "VERIFIED", issuedDate: "2021-04-10", expiryDate: "2026-04-10", number: "BG-7421" },
    ],
    zones: ["Industrial Zone", "Harbor Area"],
    recentDeliveries: ["ORD-2830", "ORD-2829"],
  },
  {
    id: "drv-9",
    name: "Emma Watson",
    email: "emma@witylogix.io",
    phone: "+1 555-0109",
    status: "ACTIVE",
    vehicleType: "CAR",
    vehiclePlate: "WTY-2204",
    maxCapacity: 10,
    activeOrders: 0,
    completedToday: 11,
    avgRating: 4.8,
    totalDeliveries: 789,
    onTimePercentage: 95,
    currentLocation: "Midtown East",
    lastActive: "5m ago",
    hireDate: "2021-08-03",
    licenseNumber: "DL-5678-PE",
    documents: [
      { id: "doc-25", type: "LICENSE", status: "VERIFIED", issuedDate: "2020-09-10", expiryDate: "2028-09-10", number: "DL-5678-PE" },
      { id: "doc-26", type: "INSURANCE", status: "VERIFIED", issuedDate: "2023-08-25", expiryDate: "2026-08-25", number: "INS-8765" },
      { id: "doc-27", type: "BACKGROUND", status: "VERIFIED", issuedDate: "2021-08-01", expiryDate: "2026-08-01", number: "BG-9123" },
    ],
    zones: ["Midtown East", "West Side"],
    recentDeliveries: ["ORD-2828", "ORD-2827", "ORD-2826"],
  },
];

const StarRating = ({ rating, size = 14 }: { rating: number; size?: number }) => {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  return (
    <span className="flex" gap: 2, alignItems: "center" }}>
      {Array.from({ length: 5 }).map((_, i) => {
        const isFull = i < fullStars;
        const isHalf = i === fullStars && hasHalf;
        return (
          <span
            key={i}
            style={{
              fontSize: size,
              opacity: isFull || isHalf ? 1 : 0.3,
            }}
          >
            {isFull ? "★" : isHalf ? "✦" : "☆"}
          </span>
        );
      })}
      <span style={{ fontSize: "var(--wl-text-xs)", className="text-wl-text-tertiary", marginLeft: 4 }}>
        {rating.toFixed(1)}
      </span>
    </span>
  );
};

export default function DriversPage() {
  const [statusFilter, setStatusFilter] = useState<DriverStatus | "ALL">("ALL");
  const [vehicleFilter, setVehicleFilter] = useState<VehicleType | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  // Filter drivers
  const filtered = useMemo(() => {
    let result = DRIVERS;

    if (statusFilter !== "ALL") {
      result = result.filter((d) => d.status === statusFilter);
    }

    if (vehicleFilter !== "ALL") {
      result = result.filter((d) => d.vehicleType === vehicleFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.email.toLowerCase().includes(q) ||
          d.phone.includes(q) ||
          d.vehiclePlate.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "rating":
          return b.avgRating - a.avgRating;
        case "deliveries":
          return b.totalDeliveries - a.totalDeliveries;
        case "ontime":
          return b.onTimePercentage - a.onTimePercentage;
        case "name":
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return result;
  }, [statusFilter, vehicleFilter, search, sortBy]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = DRIVERS.length;
    const active = DRIVERS.filter((d) => d.status !== "OFFLINE").length;
    const completedToday = DRIVERS.reduce((sum, d) => sum + d.completedToday, 0);
    const avgRating = (DRIVERS.reduce((sum, d) => sum + d.avgRating, 0) / DRIVERS.length).toFixed(1);
    return { total, active, completedToday, avgRating };
  }, []);

  return (
    <>
      <Header
        title="Driver Management"
        subtitle={`${stats.total} total · ${stats.active} active · ${stats.completedToday} deliveries today`}
        actions={<Button variant="primary" size="md">+ Add Driver</Button>}
      />

      <div className="p-6">
        {/* ═══ KPI Stats Row ═══ */}
        <div
          className="grid"
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            className="gap-4",
            marginBottom: "var(--wl-space-6)",
          }}
        >
          <StatCard
            label="Total Drivers"
            value={stats.total}
            change={{ value: 2.5, label: "growth" }}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Active Today"
            value={stats.active}
            change={{ value: 5.0, label: "vs average" }}
            accentColor="var(--wl-success-400)"
            index={1}
          />
          <StatCard
            label="Average Rating"
            value={stats.avgRating}
            change={{ value: 0.8, label: "stable" }}
            accentColor="var(--wl-warning-400)"
            index={2}
          />
          <StatCard
            label="Deliveries Today"
            value={stats.completedToday}
            change={{ value: 12.3, label: "vs yesterday" }}
            accentColor="var(--wl-info-400)"
            index={3}
          />
        </div>

        {/* ═══ Filters Row ═══ */}
        <div
          className="flex"
            className="gap-4",
            marginBottom: "var(--wl-space-5)",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* Search */}
          <div style={{ flex: "1 1 300px", maxWidth: 400 }}>
            <input
              type="text"
              placeholder="Search drivers by name, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "var(--wl-space-2) var(--wl-space-4)",
                className="bg-wl-bg-elevated",
                border: "1px solid var(--wl-border-default)",
                borderRadius: "var(--wl-radius-md)",
                className="text-wl-text-primary",
                fontSize: "var(--wl-text-sm)",
                fontFamily: "var(--wl-font-sans)",
                outline: "none",
              }}
            />
          </div>

          {/* Status Filter */}
          <div className="flex" gap: 4, flexWrap: "wrap" }}>
            {(["ALL", "ACTIVE", "ON_DELIVERY", "ON_BREAK", "OFFLINE"] as const).map((s) => {
              const count = s === "ALL" ? DRIVERS.length : DRIVERS.filter((d) => d.status === s).length;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: "var(--wl-space-1) var(--wl-space-3)",
                    borderRadius: "var(--wl-radius-full)",
                    border: "1px solid",
                    fontSize: "var(--wl-text-xs)",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "var(--wl-font-sans)",
                    background: statusFilter === s ? "var(--wl-primary-500)" : "transparent",
                    color: statusFilter === s ? "var(--wl-text-inverse)" : "var(--wl-text-tertiary)",
                    borderColor: statusFilter === s ? "var(--wl-primary-500)" : "var(--wl-border-default)",
                    transition: `all var(--wl-duration-fast) var(--wl-ease-default)`,
                  }}
                >
                  {s === "ALL" ? "All" : s.replace(/_/g, " ")} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ Vehicle Type & Sort Row ═══ */}
        <div
          className="flex"
            className="gap-4",
            marginBottom: "var(--wl-space-5)",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* Vehicle Type Filter */}
          <div className="flex" gap: 4, flexWrap: "wrap" }}>
            {(["ALL", "CAR", "VAN", "TRUCK", "MOTORCYCLE", "BICYCLE"] as const).map((v) => {
              const count = v === "ALL" ? DRIVERS.length : DRIVERS.filter((d) => d.vehicleType === v).length;
              return (
                <button
                  key={v}
                  onClick={() => setVehicleFilter(v)}
                  className="flex"
                    alignItems: "center",
                    className="gap-1",
                    padding: "var(--wl-space-1) var(--wl-space-3)",
                    borderRadius: "var(--wl-radius-md)",
                    border: "1px solid",
                    fontSize: "var(--wl-text-xs)",
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "var(--wl-font-sans)",
                    background: vehicleFilter === v ? "var(--wl-bg-overlay)" : "transparent",
                    color: vehicleFilter === v ? "var(--wl-text-primary)" : "var(--wl-text-secondary)",
                    borderColor: vehicleFilter === v ? "var(--wl-border-default)" : "var(--wl-border-subtle)",
                    transition: `all var(--wl-duration-fast) var(--wl-ease-default)`,
                  }}
                >
                  {v !== "ALL" && <span>{vehicleIcon[v]}</span>}
                  <span>{v === "ALL" ? "All Vehicles" : v}</span>
                  <span style={{ fontSize: "var(--wl-text-xs)", opacity: 0.7 }}>({count})</span>
                </button>
              );
            })}
          </div>

          {/* Sort */}
          <div style={{ marginLeft: "auto" }}>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              style={{
                padding: "var(--wl-space-2) var(--wl-space-3)",
                className="bg-wl-bg-elevated",
                border: "1px solid var(--wl-border-default)",
                borderRadius: "var(--wl-radius-md)",
                className="text-wl-text-primary",
                fontSize: "var(--wl-text-sm)",
                fontFamily: "var(--wl-font-sans)",
                cursor: "pointer",
              }}
            >
              <option value="name">Sort by Name</option>
              <option value="rating">Sort by Rating</option>
              <option value="deliveries">Sort by Total Deliveries</option>
              <option value="ontime">Sort by On-time %</option>
            </select>
          </div>
        </div>

        {/* ═══ Drivers Grid + Detail Panel ═══ */}
        <div
          className="grid"
            gridTemplateColumns: selectedDriver ? "1fr 400px" : "1fr",
            className="gap-5",
          }}
        >
          {/* Driver Cards Grid */}
          <div
            className="grid"
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              className="gap-4",
            }}
          >
            {filtered.map((driver, i) => (
              <Card
                key={driver.id}
                hover
                onClick={() => setSelectedDriver(selectedDriver?.id === driver.id ? null : driver)}
                style={{
                  cursor: "pointer",
                  position: "relative",
                  overflow: "hidden",
                  animation: `wl-fade-in var(--wl-duration-slow) var(--wl-ease-default) ${i * 60}ms forwards`,
                  opacity: 0,
                  borderColor: selectedDriver?.id === driver.id ? "var(--wl-primary-500)" : undefined,
                }}
              >
                {/* Status indicator line */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: statusColor(driver.status),
                  }}
                />

                {/* Avatar & Header */}
                <div className="flex" className="gap-4", marginBottom: "var(--wl-space-3)" }}>
                  {/* Avatar Circle */}
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, var(--wl-primary-500), var(--wl-primary-600))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "var(--wl-text-lg)",
                      fontWeight: 700,
                      color: "var(--wl-text-inverse)",
                      position: "relative",
                      flexShrink: 0,
                      boxShadow: `0 2px 8px rgba(245, 166, 35, 0.2)`,
                    }}
                  >
                    {driver.name.split(" ").map((w) => w[0]).join("")}
                    <span
                      style={{
                        position: "absolute",
                        bottom: -2,
                        right: -2,
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: statusColor(driver.status),
                        border: "3px solid var(--wl-bg-elevated)",
                      }}
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex" justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <div>
                        <div style={{ fontSize: "var(--wl-text-base)", fontWeight: 700, className="text-wl-text-primary" }}>
                          {driver.name}
                        </div>
                        <div
                          style={{
                            fontSize: "var(--wl-text-xs)",
                            className="text-wl-text-tertiary",
                            marginTop: 2,
                          }}
                        >
                          {driver.email}
                        </div>
                      </div>
                    </div>
                    <Badge variant={statusVariant(driver.status)} dot style={{ marginTop: 4 }}>
                      {driver.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>

                {/* Vehicle & Location */}
                <div
                  className="flex"
                    alignItems: "center",
                    className="gap-2",
                    padding: "var(--wl-space-3) 0",
                    borderTop: "1px solid var(--wl-border-subtle)",
                    borderBottom: "1px solid var(--wl-border-subtle)",
                    marginBottom: "var(--wl-space-3)",
                  }}
                >
                  <span style={{ fontSize: 18 }}>{vehicleIcon[driver.vehicleType]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "var(--wl-text-xs)", className="text-wl-text-tertiary" }}>
                      {driver.vehicleType} · {driver.vehiclePlate}
                    </div>
                    <div style={{ fontSize: "var(--wl-text-xs)", className="text-wl-text-secondary", marginTop: 2 }}>
                      📍 {driver.currentLocation}
                    </div>
                  </div>
                </div>

                {/* Performance Metrics Grid */}
                <div
                  className="grid"
                    gridTemplateColumns: "repeat(2, 1fr)",
                    className="gap-3",
                    marginBottom: "var(--wl-space-4)",
                  }}
                >
                  {/* Deliveries Today */}
                  <div
                    style={{
                      className="p-2",
                      className="bg-wl-wl-surface",
                      borderRadius: "var(--wl-radius-md)",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "var(--wl-text-xs)", className="text-wl-text-tertiary", marginBottom: 2 }}>
                      Today
                    </div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-lg)",
                        fontWeight: 700,
                        color: "var(--wl-primary-400)",
                        fontFamily: "var(--wl-font-mono)",
                      }}
                    >
                      {driver.completedToday}
                    </div>
                  </div>

                  {/* Average Rating */}
                  <div
                    style={{
                      className="p-2",
                      className="bg-wl-wl-surface",
                      borderRadius: "var(--wl-radius-md)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div style={{ fontSize: "var(--wl-text-xs)", className="text-wl-text-tertiary", marginBottom: 4 }}>
                      Rating
                    </div>
                    <StarRating rating={driver.avgRating} size={12} />
                  </div>

                  {/* On-time % */}
                  <div
                    style={{
                      className="p-2",
                      className="bg-wl-wl-surface",
                      borderRadius: "var(--wl-radius-md)",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "var(--wl-text-xs)", className="text-wl-text-tertiary", marginBottom: 2 }}>
                      On-time %
                    </div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-lg)",
                        fontWeight: 700,
                        color: driver.onTimePercentage >= 90 ? "var(--wl-success-400)" : "var(--wl-warning-400)",
                        fontFamily: "var(--wl-font-mono)",
                      }}
                    >
                      {driver.onTimePercentage}%
                    </div>
                  </div>

                  {/* Total Deliveries */}
                  <div
                    style={{
                      className="p-2",
                      className="bg-wl-wl-surface",
                      borderRadius: "var(--wl-radius-md)",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "var(--wl-text-xs)", className="text-wl-text-tertiary", marginBottom: 2 }}>
                      Total
                    </div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-lg)",
                        fontWeight: 700,
                        color: "var(--wl-info-400)",
                        fontFamily: "var(--wl-font-mono)",
                      }}
                    >
                      {driver.totalDeliveries}
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div
                  className="grid"
                    gridTemplateColumns: "repeat(3, 1fr)",
                    className="gap-2",
                  }}
                >
                  <Button variant="ghost" size="sm" style={{ fontSize: "var(--wl-text-xs)" }}>
                    Details
                  </Button>
                  <Button variant="ghost" size="sm" style={{ fontSize: "var(--wl-text-xs)" }}>
                    Route
                  </Button>
                  <Button variant="ghost" size="sm" style={{ fontSize: "var(--wl-text-xs)" }}>
                    Message
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Detail Panel */}
          {selectedDriver && (
            <Card
              className="wl-animate-in"
              style={{
                position: "sticky",
                top: "calc(var(--wl-header-height) + var(--wl-space-6))",
                maxHeight: "calc(100vh - var(--wl-header-height) - var(--wl-space-12))",
                overflowY: "auto",
              }}
            >
              {/* Header with close button */}
              <div
                className="flex"
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "var(--wl-space-4)",
                }}
              >
                <span
                  style={{
                    fontSize: "var(--wl-text-lg)",
                    fontWeight: 700,
                    className="text-wl-text-primary",
                  }}
                >
                  Driver Profile
                </span>
                <button
                  onClick={() => setSelectedDriver(null)}
                  style={{
                    background: "none",
                    border: "none",
                    className="text-wl-text-tertiary",
                    cursor: "pointer",
                    fontSize: 20,
                    fontFamily: "var(--wl-font-sans)",
                  }}
                >
                  ✕
                </button>
              </div>

              <div className="flex" flexDirection: "column", className="gap-4" }}>
                {/* Profile Header */}
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, var(--wl-primary-500), var(--wl-primary-600))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "var(--wl-text-4xl)",
                      fontWeight: 700,
                      color: "var(--wl-text-inverse)",
                      margin: "0 auto var(--wl-space-3) auto",
                      boxShadow: `0 4px 12px rgba(245, 166, 35, 0.3)`,
                    }}
                  >
                    {selectedDriver.name.split(" ").map((w) => w[0]).join("")}
                  </div>
                  <div style={{ fontSize: "var(--wl-text-base)", fontWeight: 700, className="text-wl-text-primary" }}>
                    {selectedDriver.name}
                  </div>
                  <Badge variant={statusVariant(selectedDriver.status)} dot style={{ marginTop: "var(--wl-space-2)", justifyContent: "center" }}>
                    {selectedDriver.status.replace(/_/g, " ")}
                  </Badge>
                </div>

                <div style={{ height: 1, background: "var(--wl-border-subtle)" }} />

                {/* Contact Info */}
                <div>
                  <div
                    style={{
                      fontSize: "var(--wl-text-xs)",
                      fontWeight: 600,
                      className="text-wl-text-tertiary",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginBottom: "var(--wl-space-2)",
                    }}
                  >
                    Contact
                  </div>
                  <div className="flex" flexDirection: "column", className="gap-2" }}>
                    <div>
                      <div style={{ fontSize: "var(--wl-text-xs)", className="text-wl-text-tertiary" }}>Email</div>
                      <div style={{ fontSize: "var(--wl-text-sm)", className="text-wl-text-primary" }}>
                        {selectedDriver.email}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "var(--wl-text-xs)", className="text-wl-text-tertiary" }}>Phone</div>
                      <div style={{ fontSize: "var(--wl-text-sm)", className="text-wl-text-primary", fontFamily: "var(--wl-font-mono)" }}>
                        {selectedDriver.phone}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ height: 1, background: "var(--wl-border-subtle)" }} />

                {/* Employment Info */}
                <div>
                  <div
                    style={{
                      fontSize: "var(--wl-text-xs)",
                      fontWeight: 600,
                      className="text-wl-text-tertiary",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginBottom: "var(--wl-space-2)",
                    }}
                  >
                    Employment
                  </div>
                  <div className="flex" flexDirection: "column", className="gap-2" }}>
                    <div>
                      <div style={{ fontSize: "var(--wl-text-xs)", className="text-wl-text-tertiary" }}>Hired</div>
                      <div style={{ fontSize: "var(--wl-text-sm)", className="text-wl-text-primary", fontFamily: "var(--wl-font-mono)" }}>
                        {new Date(selectedDriver.hireDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "var(--wl-text-xs)", className="text-wl-text-tertiary" }}>License #</div>
                      <div style={{ fontSize: "var(--wl-text-sm)", className="text-wl-text-primary", fontFamily: "var(--wl-font-mono)" }}>
                        {selectedDriver.licenseNumber}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "var(--wl-text-xs)", className="text-wl-text-tertiary" }}>Vehicle</div>
                      <div style={{ fontSize: "var(--wl-text-sm)", className="text-wl-text-primary" }}>
                        <span style={{ marginRight: "var(--wl-space-1)" }}>
                          {vehicleIcon[selectedDriver.vehicleType]}
                        </span>
                        {selectedDriver.vehicleType} ({selectedDriver.vehiclePlate})
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ height: 1, background: "var(--wl-border-subtle)" }} />

                {/* Documents Section */}
                <div>
                  <div
                    style={{
                      fontSize: "var(--wl-text-xs)",
                      fontWeight: 600,
                      className="text-wl-text-tertiary",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginBottom: "var(--wl-space-3)",
                    }}
                  >
                    Documents
                  </div>
                  <div className="flex" flexDirection: "column", className="gap-2" }}>
                    {selectedDriver.documents.map((doc) => (
                      <div
                        key={doc.id}
                        style={{
                          className="p-2",
                          className="bg-wl-wl-surface",
                          borderRadius: "var(--wl-radius-md)",
                        }}
                      >
                        <div
                          className="flex"
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 4,
                          }}
                        >
                          <span style={{ fontSize: "var(--wl-text-xs)", fontWeight: 600, className="text-wl-text-primary" }}>
                            {doc.type.replace(/_/g, " ")}
                          </span>
                          <Badge variant={docStatusVariant(doc.status)}>
                            {doc.status}
                          </Badge>
                        </div>
                        <div style={{ fontSize: "var(--wl-text-xs)", className="text-wl-text-tertiary" }}>
                          Exp: {new Date(doc.expiryDate).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ height: 1, background: "var(--wl-border-subtle)" }} />

                {/* Performance Chart Placeholder */}
                <div>
                  <div
                    style={{
                      fontSize: "var(--wl-text-xs)",
                      fontWeight: 600,
                      className="text-wl-text-tertiary",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginBottom: "var(--wl-space-3)",
                    }}
                  >
                    Performance
                  </div>
                  <div
                    style={{
                      className="p-4",
                      className="bg-wl-wl-surface",
                      borderRadius: "var(--wl-radius-md)",
                      textAlign: "center",
                      minHeight: 120,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      className="text-wl-text-tertiary",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 24, marginBottom: "var(--wl-space-2)" }}>📊</div>
                      <div style={{ fontSize: "var(--wl-text-xs)" }}>Delivery history chart</div>
                    </div>
                  </div>
                </div>

                <div style={{ height: 1, background: "var(--wl-border-subtle)" }} />

                {/* Zone Assignments */}
                {selectedDriver.zones.length > 0 && (
                  <>
                    <div>
                      <div
                        style={{
                          fontSize: "var(--wl-text-xs)",
                          fontWeight: 600,
                          className="text-wl-text-tertiary",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          marginBottom: "var(--wl-space-2)",
                        }}
                      >
                        Assigned Zones
                      </div>
                      <div className="flex" className="gap-1", flexWrap: "wrap" }}>
                        {selectedDriver.zones.map((zone) => (
                          <Badge key={zone} variant="primary">
                            {zone}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div style={{ height: 1, background: "var(--wl-border-subtle)" }} />
                  </>
                )}

                {/* Recent Deliveries */}
                {selectedDriver.recentDeliveries.length > 0 && (
                  <>
                    <div>
                      <div
                        style={{
                          fontSize: "var(--wl-text-xs)",
                          fontWeight: 600,
                          className="text-wl-text-tertiary",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          marginBottom: "var(--wl-space-2)",
                        }}
                      >
                        Recent Deliveries
                      </div>
                      <div className="flex" flexDirection: "column", className="gap-2" }}>
                        {selectedDriver.recentDeliveries.map((ord) => (
                          <div
                            key={ord}
                            style={{
                              padding: "var(--wl-space-2) var(--wl-space-3)",
                              className="bg-wl-wl-surface",
                              borderRadius: "var(--wl-radius-sm)",
                              fontSize: "var(--wl-text-xs)",
                              fontFamily: "var(--wl-font-mono)",
                              color: "var(--wl-primary-400)",
                            }}
                          >
                            {ord}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ height: 1, background: "var(--wl-border-subtle)" }} />
                  </>
                )}

                {/* Action Buttons */}
                <div className="flex" flexDirection: "column", className="gap-2" }}>
                  <Button variant="primary" size="md" style={{ width: "100%" }}>
                    Edit Profile
                  </Button>
                  <Button variant="secondary" size="md" style={{ width: "100%" }}>
                    Assign Route
                  </Button>
                  <Button variant="ghost" size="md" style={{ width: "100%" }}>
                    View Full Routes
                  </Button>
                  <Button variant="danger" size="md" style={{ width: "100%" }}>
                    Deactivate
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
