"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";

/* ═══════════════════════════════════════════════════════════
   LOCATIONS PAGE — Warehouse & store management with filtering
   ═══════════════════════════════════════════════════════════ */

type LocationType = "WAREHOUSE" | "STORE" | "HUB" | "DEPOT" | "PICKUP_POINT";
type LocationStatus = "ACTIVE" | "INACTIVE" | "MAINTENANCE";

interface Location {
  id: string;
  name: string;
  type: LocationType;
  addressLine1: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  phone: string | null;
  email: string | null;
  isDefault: boolean;
  latitude: number;
  longitude: number;
  activeShipments: number;
  totalProcessed: number;
  avgPrepTime: number;
  operatingHours: Record<string, { open: string; close: string }> | null;
  status: LocationStatus;
}

const typeVariant = (t: LocationType): "info" | "success" | "primary" | "warning" | "default" => {
  const map: Record<LocationType, "info" | "success" | "primary" | "warning" | "default"> = {
    WAREHOUSE: "info",
    STORE: "success",
    HUB: "primary",
    DEPOT: "warning",
    PICKUP_POINT: "default",
  };
  return map[t];
};

const statusVariant = (s: LocationStatus): "success" | "warning" | "danger" => {
  const map: Record<LocationStatus, "success" | "warning" | "danger"> = {
    ACTIVE: "success",
    INACTIVE: "danger",
    MAINTENANCE: "warning",
  };
  return map[s];
};

const typeLabel = (t: LocationType): string => {
  const map: Record<LocationType, string> = {
    WAREHOUSE: "Warehouse",
    STORE: "Store",
    HUB: "Hub",
    DEPOT: "Depot",
    PICKUP_POINT: "Pickup Point",
  };
  return map[t];
};

// Mock locations data
const LOCATIONS: Location[] = [
  {
    id: "loc-1",
    name: "Downtown Distribution Hub",
    type: "HUB",
    addressLine1: "123 Commerce St",
    city: "Toronto",
    province: "ON",
    postalCode: "M5H 2R2",
    country: "Canada",
    phone: "+1 416-555-0101",
    email: "downtown@witylogix.io",
    isDefault: true,
    latitude: 43.6629,
    longitude: -79.3957,
    activeShipments: 287,
    totalProcessed: 12450,
    avgPrepTime: 18,
    operatingHours: {
      Monday: { open: "06:00", close: "22:00" },
      Tuesday: { open: "06:00", close: "22:00" },
      Wednesday: { open: "06:00", close: "22:00" },
      Thursday: { open: "06:00", close: "22:00" },
      Friday: { open: "06:00", close: "23:00" },
      Saturday: { open: "08:00", close: "20:00" },
      Sunday: { open: "08:00", close: "20:00" },
    },
    status: "ACTIVE",
  },
  {
    id: "loc-2",
    name: "Midtown Warehouse",
    type: "WAREHOUSE",
    addressLine1: "456 Industrial Ave",
    city: "Toronto",
    province: "ON",
    postalCode: "M4H 1L3",
    country: "Canada",
    phone: "+1 416-555-0102",
    email: "midtown@witylogix.io",
    isDefault: false,
    latitude: 43.7315,
    longitude: -79.3794,
    activeShipments: 156,
    totalProcessed: 8921,
    avgPrepTime: 22,
    operatingHours: {
      Monday: { open: "05:00", close: "23:00" },
      Tuesday: { open: "05:00", close: "23:00" },
      Wednesday: { open: "05:00", close: "23:00" },
      Thursday: { open: "05:00", close: "23:00" },
      Friday: { open: "05:00", close: "23:00" },
      Saturday: { open: "07:00", close: "22:00" },
      Sunday: { open: "07:00", close: "22:00" },
    },
    status: "ACTIVE",
  },
  {
    id: "loc-3",
    name: "Yorkville Retail Store",
    type: "STORE",
    addressLine1: "789 Bloor St W",
    city: "Toronto",
    province: "ON",
    postalCode: "M6G 1L9",
    country: "Canada",
    phone: "+1 416-555-0103",
    email: "yorkville@witylogix.io",
    isDefault: false,
    latitude: 43.6729,
    longitude: -79.4047,
    activeShipments: 42,
    totalProcessed: 3280,
    avgPrepTime: 12,
    operatingHours: {
      Monday: { open: "09:00", close: "21:00" },
      Tuesday: { open: "09:00", close: "21:00" },
      Wednesday: { open: "09:00", close: "21:00" },
      Thursday: { open: "09:00", close: "21:00" },
      Friday: { open: "09:00", close: "22:00" },
      Saturday: { open: "09:00", close: "22:00" },
      Sunday: { open: "10:00", close: "20:00" },
    },
    status: "ACTIVE",
  },
  {
    id: "loc-4",
    name: "Scarborough Depot",
    type: "DEPOT",
    addressLine1: "321 McCowan Rd",
    city: "Scarborough",
    province: "ON",
    postalCode: "M1S 4Z9",
    country: "Canada",
    phone: "+1 416-555-0104",
    email: "scarborough@witylogix.io",
    isDefault: false,
    latitude: 43.7710,
    longitude: -79.2187,
    activeShipments: 89,
    totalProcessed: 5640,
    avgPrepTime: 20,
    operatingHours: {
      Monday: { open: "06:00", close: "21:00" },
      Tuesday: { open: "06:00", close: "21:00" },
      Wednesday: { open: "06:00", close: "21:00" },
      Thursday: { open: "06:00", close: "21:00" },
      Friday: { open: "06:00", close: "22:00" },
      Saturday: { open: "08:00", close: "18:00" },
      Sunday: { open: "closed", close: "closed" },
    },
    status: "ACTIVE",
  },
  {
    id: "loc-5",
    name: "North York Pickup Point",
    type: "PICKUP_POINT",
    addressLine1: "654 Sheppard Ave E",
    city: "North York",
    province: "ON",
    postalCode: "M2N 5Y7",
    country: "Canada",
    phone: "+1 416-555-0105",
    email: "northyork@witylogix.io",
    isDefault: false,
    latitude: 43.7667,
    longitude: -79.4099,
    activeShipments: 18,
    totalProcessed: 1240,
    avgPrepTime: 8,
    operatingHours: {
      Monday: { open: "07:00", close: "19:00" },
      Tuesday: { open: "07:00", close: "19:00" },
      Wednesday: { open: "07:00", close: "19:00" },
      Thursday: { open: "07:00", close: "19:00" },
      Friday: { open: "07:00", close: "19:00" },
      Saturday: { open: "09:00", close: "17:00" },
      Sunday: { open: "closed", close: "closed" },
    },
    status: "ACTIVE",
  },
  {
    id: "loc-6",
    name: "Etobicoke Hub",
    type: "HUB",
    addressLine1: "987 The Queensway",
    city: "Etobicoke",
    province: "ON",
    postalCode: "M8Y 1J3",
    country: "Canada",
    phone: "+1 416-555-0106",
    email: "etobicoke@witylogix.io",
    isDefault: false,
    latitude: 43.6354,
    longitude: -79.4871,
    activeShipments: 123,
    totalProcessed: 7580,
    avgPrepTime: 19,
    operatingHours: {
      Monday: { open: "06:00", close: "22:00" },
      Tuesday: { open: "06:00", close: "22:00" },
      Wednesday: { open: "06:00", close: "22:00" },
      Thursday: { open: "06:00", close: "22:00" },
      Friday: { open: "06:00", close: "23:00" },
      Saturday: { open: "08:00", close: "20:00" },
      Sunday: { open: "08:00", close: "20:00" },
    },
    status: "ACTIVE",
  },
  {
    id: "loc-7",
    name: "Mississauga Warehouse",
    type: "WAREHOUSE",
    addressLine1: "111 Matheson Blvd",
    city: "Mississauga",
    province: "ON",
    postalCode: "L4Z 1X8",
    country: "Canada",
    phone: "+1 905-555-0107",
    email: "mississauga@witylogix.io",
    isDefault: false,
    latitude: 43.5890,
    longitude: -79.6441,
    activeShipments: 201,
    totalProcessed: 10230,
    avgPrepTime: 24,
    operatingHours: {
      Monday: { open: "05:00", close: "23:00" },
      Tuesday: { open: "05:00", close: "23:00" },
      Wednesday: { open: "05:00", close: "23:00" },
      Thursday: { open: "05:00", close: "23:00" },
      Friday: { open: "05:00", close: "23:00" },
      Saturday: { open: "07:00", close: "21:00" },
      Sunday: { open: "07:00", close: "21:00" },
    },
    status: "INACTIVE",
  },
  {
    id: "loc-8",
    name: "Brampton Retail Store",
    type: "STORE",
    addressLine1: "222 Queen St",
    city: "Brampton",
    province: "ON",
    postalCode: "L6Y 1L2",
    country: "Canada",
    phone: "+1 905-555-0108",
    email: "brampton@witylogix.io",
    isDefault: false,
    latitude: 43.7315,
    longitude: -79.7624,
    activeShipments: 31,
    totalProcessed: 2150,
    avgPrepTime: 14,
    operatingHours: null,
    status: "MAINTENANCE",
  },
];

export default function LocationsPage() {
  const [typeFilter, setTypeFilter] = useState<LocationType | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  const filtered = useMemo(() => {
    return LOCATIONS.filter((loc) => {
      if (typeFilter !== "ALL" && loc.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          loc.name.toLowerCase().includes(q) ||
          loc.addressLine1.toLowerCase().includes(q) ||
          loc.city.toLowerCase().includes(q) ||
          loc.province.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [typeFilter, search]);

  const stats = {
    totalLocations: LOCATIONS.length,
    activeLocations: LOCATIONS.filter((l) => l.status === "ACTIVE").length,
    totalShipments: LOCATIONS.reduce((sum, l) => sum + l.activeShipments, 0),
    avgPrepTime: Math.round(LOCATIONS.reduce((sum, l) => sum + l.avgPrepTime, 0) / LOCATIONS.length),
  };

  return (
    <>
      <Header
        title="Locations"
        subtitle={`${stats.totalLocations} total · ${stats.activeLocations} active`}
        actions={
          <Button variant="primary" size="md">
            + Add Location
          </Button>
        }
      />

      <div style={{ padding: "var(--wl-space-6)" }}>
        {/* KPI Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "var(--wl-space-4)",
            marginBottom: "var(--wl-space-6)",
          }}
        >
          <StatCard label="Total Locations" value={stats.totalLocations} index={0} accentColor="var(--wl-primary-500)" />
          <StatCard label="Active" value={stats.activeLocations} index={1} accentColor="var(--wl-success-400)" />
          <StatCard label="Shipments Today" value={stats.totalShipments} index={2} accentColor="var(--wl-info-400)" />
          <StatCard label="Avg Prep Time" value={`${stats.avgPrepTime}m`} index={3} accentColor="var(--wl-warning-400)" />
        </div>

        {/* Filters Bar */}
        <div
          style={{
            display: "flex",
            gap: "var(--wl-space-4)",
            marginBottom: "var(--wl-space-5)",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* Search */}
          <div style={{ flex: "1 1 300px", maxWidth: 400 }}>
            <input
              type="text"
              placeholder="Search locations, cities, addresses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "var(--wl-space-2) var(--wl-space-4)",
                background: "var(--wl-bg-elevated)",
                border: "1px solid var(--wl-border-default)",
                borderRadius: "var(--wl-radius-md)",
                color: "var(--wl-text-primary)",
                fontSize: "var(--wl-text-sm)",
                fontFamily: "var(--wl-font-sans)",
                outline: "none",
              }}
            />
          </div>

          {/* Type Filter Pills */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {(["ALL", "WAREHOUSE", "STORE", "HUB", "DEPOT", "PICKUP_POINT"] as const).map((t) => {
              const count =
                t === "ALL" ? LOCATIONS.length : LOCATIONS.filter((loc) => loc.type === t).length;
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  style={{
                    padding: "var(--wl-space-1) var(--wl-space-3)",
                    borderRadius: "var(--wl-radius-full)",
                    border: "1px solid",
                    fontSize: "var(--wl-text-xs)",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "var(--wl-font-sans)",
                    transition: `all var(--wl-duration-fast) var(--wl-ease-default)`,
                    background: typeFilter === t ? "var(--wl-primary-500)" : "transparent",
                    color: typeFilter === t ? "var(--wl-text-inverse)" : "var(--wl-text-tertiary)",
                    borderColor: typeFilter === t ? "var(--wl-primary-500)" : "var(--wl-border-default)",
                  }}
                >
                  {t === "ALL" ? "All Types" : typeLabel(t as LocationType)}
                  <span style={{ marginLeft: 4, opacity: 0.7 }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Locations Grid + Detail */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: selectedLocation ? "1fr 420px" : "1fr",
            gap: "var(--wl-space-5)",
          }}
        >
          {/* Locations Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "var(--wl-space-4)",
            }}
          >
            {filtered.map((location, i) => (
              <Card
                key={location.id}
                hover
                onClick={() => setSelectedLocation(selectedLocation?.id === location.id ? null : location)}
                style={{
                  cursor: "pointer",
                  position: "relative",
                  overflow: "hidden",
                  animation: `wl-fade-in var(--wl-duration-slow) var(--wl-ease-default) ${i * 60}ms forwards`,
                  opacity: 0,
                  borderColor: selectedLocation?.id === location.id ? "var(--wl-primary-500)" : undefined,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Status indicator line */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background:
                      location.status === "ACTIVE"
                        ? "var(--wl-success-400)"
                        : location.status === "MAINTENANCE"
                          ? "var(--wl-warning-400)"
                          : "var(--wl-danger-400)",
                  }}
                />

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--wl-space-3)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: "var(--wl-space-2)", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: "var(--wl-text-base)", fontWeight: 700, color: "var(--wl-text-primary)" }}>
                        {location.name}
                      </span>
                      {location.isDefault && (
                        <span style={{ fontSize: 14, opacity: 0.8, color: "var(--wl-primary-400)" }}>★</span>
                      )}
                    </div>
                    <Badge variant={typeVariant(location.type)} dot>
                      {typeLabel(location.type)}
                    </Badge>
                  </div>
                </div>

                {/* Address */}
                <div style={{ marginBottom: "var(--wl-space-3)", fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)" }}>
                  <div>{location.addressLine1}</div>
                  <div>
                    {location.city}, {location.province} {location.postalCode}
                  </div>
                </div>

                {/* Status badge */}
                <Badge
                  variant={statusVariant(location.status)}
                  dot
                  style={{ marginBottom: "var(--wl-space-3)", width: "fit-content" }}
                >
                  {location.status}
                </Badge>

                {/* Stats Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "var(--wl-space-3)",
                    padding: "var(--wl-space-3) 0",
                    borderTop: "1px solid var(--wl-border-subtle)",
                    borderBottom: "1px solid var(--wl-border-subtle)",
                    marginBottom: "var(--wl-space-3)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 10, color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Active Shipments</div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-base)",
                        fontWeight: 700,
                        fontFamily: "var(--wl-font-mono)",
                        color: location.activeShipments > 0 ? "var(--wl-primary-400)" : "var(--wl-text-tertiary)",
                      }}
                    >
                      {location.activeShipments}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Total Processed</div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-base)",
                        fontWeight: 700,
                        fontFamily: "var(--wl-font-mono)",
                        color: "var(--wl-success-400)",
                      }}
                    >
                      {location.totalProcessed}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Avg Prep Time</div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-base)",
                        fontWeight: 700,
                        fontFamily: "var(--wl-font-mono)",
                        color: "var(--wl-text-secondary)",
                      }}
                    >
                      {location.avgPrepTime}m
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Status</div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-xs)",
                        fontWeight: 600,
                        color:
                          location.status === "ACTIVE"
                            ? "var(--wl-success-400)"
                            : location.status === "MAINTENANCE"
                              ? "var(--wl-warning-400)"
                              : "var(--wl-danger-400)",
                      }}
                    >
                      {location.status}
                    </div>
                  </div>
                </div>

                {/* Operating Hours Preview */}
                {location.operatingHours && (
                  <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)" }}>
                    <div style={{ marginBottom: 4, fontWeight: 600, color: "var(--wl-text-secondary)" }}>Hours</div>
                    <div>Mon: {location.operatingHours.Monday.open} - {location.operatingHours.Monday.close}</div>
                    <div>Sat: {location.operatingHours.Saturday.open} - {location.operatingHours.Saturday.close}</div>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Location Detail Panel */}
          {selectedLocation && (
            <Card
              className="wl-animate-in"
              style={{
                position: "sticky",
                top: "calc(var(--wl-header-height) + var(--wl-space-6))",
                maxHeight: "calc(100vh - var(--wl-header-height) - var(--wl-space-12))",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--wl-space-4)" }}>
                <div>
                  <div style={{ display: "flex", gap: "var(--wl-space-2)", alignItems: "center", marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: "var(--wl-text-lg)",
                        fontWeight: 700,
                        color: "var(--wl-text-primary)",
                      }}
                    >
                      {selectedLocation.name}
                    </span>
                    {selectedLocation.isDefault && (
                      <span style={{ fontSize: 16, color: "var(--wl-primary-400)" }}>★</span>
                    )}
                  </div>
                  <Badge variant={typeVariant(selectedLocation.type)} dot>
                    {typeLabel(selectedLocation.type)}
                  </Badge>
                </div>
                <button
                  onClick={() => setSelectedLocation(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--wl-text-tertiary)",
                    cursor: "pointer",
                    fontSize: 18,
                    fontFamily: "var(--wl-font-sans)",
                  }}
                >
                  ✕
                </button>
              </div>

              <Badge
                variant={statusVariant(selectedLocation.status)}
                dot
                style={{ marginBottom: "var(--wl-space-4)", width: "fit-content" }}
              >
                {selectedLocation.status}
              </Badge>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-4)", flex: 1 }}>
                {/* Address Info */}
                <div>
                  <div
                    style={{
                      fontSize: "var(--wl-text-xs)",
                      fontWeight: 600,
                      color: "var(--wl-text-tertiary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginBottom: "var(--wl-space-2)",
                    }}
                  >
                    Address
                  </div>
                  <div style={{ fontSize: "var(--wl-text-sm)", color: "var(--wl-text-primary)", fontWeight: 500 }}>
                    {selectedLocation.addressLine1}
                  </div>
                  <div style={{ fontSize: "var(--wl-text-sm)", color: "var(--wl-text-secondary)" }}>
                    {selectedLocation.city}, {selectedLocation.province} {selectedLocation.postalCode}
                  </div>
                  <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", marginTop: 4 }}>
                    {selectedLocation.country}
                  </div>
                </div>

                <div style={{ height: 1, background: "var(--wl-border-subtle)" }} />

                {/* Contact Info */}
                <div>
                  <div
                    style={{
                      fontSize: "var(--wl-text-xs)",
                      fontWeight: 600,
                      color: "var(--wl-text-tertiary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginBottom: "var(--wl-space-2)",
                    }}
                  >
                    Contact
                  </div>
                  {selectedLocation.phone && (
                    <div style={{ fontSize: "var(--wl-text-sm)", color: "var(--wl-text-secondary)", marginBottom: 4, fontFamily: "var(--wl-font-mono)" }}>
                      {selectedLocation.phone}
                    </div>
                  )}
                  {selectedLocation.email && (
                    <div style={{ fontSize: "var(--wl-text-sm)", color: "var(--wl-text-secondary)", fontFamily: "var(--wl-font-mono)" }}>
                      {selectedLocation.email}
                    </div>
                  )}
                </div>

                <div style={{ height: 1, background: "var(--wl-border-subtle)" }} />

                {/* Performance Stats */}
                <div>
                  <div
                    style={{
                      fontSize: "var(--wl-text-xs)",
                      fontWeight: 600,
                      color: "var(--wl-text-tertiary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginBottom: "var(--wl-space-3)",
                    }}
                  >
                    Performance
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--wl-space-3)" }}>
                    <div>
                      <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Active Shipments</div>
                      <div
                        style={{
                          fontSize: "var(--wl-text-lg)",
                          fontWeight: 700,
                          fontFamily: "var(--wl-font-mono)",
                          color: "var(--wl-primary-400)",
                        }}
                      >
                        {selectedLocation.activeShipments}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Total Processed</div>
                      <div
                        style={{
                          fontSize: "var(--wl-text-lg)",
                          fontWeight: 700,
                          fontFamily: "var(--wl-font-mono)",
                          color: "var(--wl-success-400)",
                        }}
                      >
                        {selectedLocation.totalProcessed}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Avg Prep Time</div>
                      <div
                        style={{
                          fontSize: "var(--wl-text-lg)",
                          fontWeight: 700,
                          fontFamily: "var(--wl-font-mono)",
                          color: "var(--wl-text-secondary)",
                        }}
                      >
                        {selectedLocation.avgPrepTime}m
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ height: 1, background: "var(--wl-border-subtle)" }} />

                {/* Operating Hours */}
                {selectedLocation.operatingHours && (
                  <div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-xs)",
                        fontWeight: 600,
                        color: "var(--wl-text-tertiary)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        marginBottom: "var(--wl-space-3)",
                      }}
                    >
                      Operating Hours
                    </div>
                    <div style={{ fontSize: "var(--wl-text-xs)", overflowX: "auto" }}>
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: "var(--wl-text-xs)",
                        }}
                      >
                        <tbody>
                          {Object.entries(selectedLocation.operatingHours).map(([day, hours]) => (
                            <tr key={day} style={{ borderBottom: "1px solid var(--wl-border-subtle)" }}>
                              <td
                                style={{
                                  padding: "var(--wl-space-2) 0",
                                  paddingRight: "var(--wl-space-3)",
                                  color: "var(--wl-text-secondary)",
                                  fontWeight: 500,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {day}
                              </td>
                              <td
                                style={{
                                  padding: "var(--wl-space-2) 0",
                                  color:
                                    hours.open === "closed"
                                      ? "var(--wl-text-tertiary)"
                                      : "var(--wl-text-primary)",
                                  fontFamily: hours.open === "closed" ? "var(--wl-font-sans)" : "var(--wl-font-mono)",
                                }}
                              >
                                {hours.open === "closed" ? "Closed" : `${hours.open} - ${hours.close}`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div style={{ height: 1, background: "var(--wl-border-subtle)" }} />

                {/* Map Placeholder */}
                <div>
                  <div
                    style={{
                      fontSize: "var(--wl-text-xs)",
                      fontWeight: 600,
                      color: "var(--wl-text-tertiary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginBottom: "var(--wl-space-3)",
                    }}
                  >
                    Location
                  </div>
                  <div
                    style={{
                      background: "var(--wl-bg-overlay)",
                      border: "1px solid var(--wl-border-default)",
                      borderRadius: "var(--wl-radius-md)",
                      padding: "var(--wl-space-4)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 140,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: "var(--wl-space-2)", opacity: 0.5 }}>⊙</div>
                    <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", marginBottom: 4 }}>
                      Coordinates
                    </div>
                    <div style={{ fontSize: "var(--wl-text-xs)", fontFamily: "var(--wl-font-mono)", color: "var(--wl-text-primary)", fontWeight: 600 }}>
                      {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div
                  style={{
                    display: "flex",
                    gap: "var(--wl-space-2)",
                    flexWrap: "wrap",
                    marginTop: "auto",
                    paddingTop: "var(--wl-space-4)",
                    borderTop: "1px solid var(--wl-border-subtle)",
                  }}
                >
                  <Button variant="primary" size="sm">
                    Edit
                  </Button>
                  <Button variant="secondary" size="sm">
                    {selectedLocation.status === "ACTIVE" ? "Deactivate" : "Activate"}
                  </Button>
                  {!selectedLocation.isDefault && (
                    <Button variant="ghost" size="sm">
                      Set Default
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
