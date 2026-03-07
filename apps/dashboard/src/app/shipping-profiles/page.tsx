"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════
   SHIPPING PROFILES PAGE — Delivery method & rate management
   ═══════════════════════════════════════════════════════════ */

type DeliveryMethod = "LOCAL_DELIVERY" | "STORE_PICKUP" | "STANDARD_SHIPPING" | "EXPRESS_SHIPPING" | "SAME_DAY";
type RateType = "FLAT" | "WEIGHT_BASED" | "DISTANCE_BASED" | "ZONE_BASED" | "TIERED" | "CALCULATED";

interface ShippingProfile {
  id: string;
  name: string;
  description: string | null;
  deliveryMethod: DeliveryMethod;
  isDefault: boolean;
  isActive: boolean;
  processingTimeHours: number;
  rateType: RateType;
  flatRate: number | null;
  freeShippingAbove: number | null;
  minOrderAmount: number | null;
  linkedLocations: number;
  totalShipments: number;
  revenue: number;
  calendarRules: number;
}

const deliveryMethodEmoji = (m: DeliveryMethod): string => {
  const map: Record<DeliveryMethod, string> = {
    LOCAL_DELIVERY: "🚗",
    STORE_PICKUP: "🏪",
    STANDARD_SHIPPING: "📬",
    EXPRESS_SHIPPING: "🚀",
    SAME_DAY: "⚡",
  };
  return map[m];
};

const deliveryMethodLabel = (m: DeliveryMethod): string => {
  const map: Record<DeliveryMethod, string> = {
    LOCAL_DELIVERY: "Local Delivery",
    STORE_PICKUP: "Store Pickup",
    STANDARD_SHIPPING: "Standard Shipping",
    EXPRESS_SHIPPING: "Express Shipping",
    SAME_DAY: "Same Day",
  };
  return map[m];
};

const deliveryMethodVariant = (m: DeliveryMethod): "info" | "success" | "primary" | "warning" | "default" => {
  const map: Record<DeliveryMethod, "info" | "success" | "primary" | "warning" | "default"> = {
    LOCAL_DELIVERY: "primary",
    STORE_PICKUP: "success",
    STANDARD_SHIPPING: "info",
    EXPRESS_SHIPPING: "warning",
    SAME_DAY: "primary",
  };
  return map[m];
};

const rateTypeLabel = (r: RateType): string => {
  const map: Record<RateType, string> = {
    FLAT: "Flat Rate",
    WEIGHT_BASED: "Weight-Based",
    DISTANCE_BASED: "Distance-Based",
    ZONE_BASED: "Zone-Based",
    TIERED: "Tiered",
    CALCULATED: "Calculated",
  };
  return map[r];
};

// Mock shipping profiles data
const SHIPPING_PROFILES: ShippingProfile[] = [
  {
    id: "sp-1",
    name: "Local Same-Day Delivery",
    description: "Fast delivery for orders within city limits",
    deliveryMethod: "SAME_DAY",
    isDefault: true,
    isActive: true,
    processingTimeHours: 1,
    rateType: "DISTANCE_BASED",
    flatRate: null,
    freeShippingAbove: 150,
    minOrderAmount: 25,
    linkedLocations: 3,
    totalShipments: 4821,
    revenue: 38568,
    calendarRules: 5,
  },
  {
    id: "sp-2",
    name: "Express Regional Shipping",
    description: "Next-day delivery across provinces",
    deliveryMethod: "EXPRESS_SHIPPING",
    isDefault: false,
    isActive: true,
    processingTimeHours: 2,
    rateType: "ZONE_BASED",
    flatRate: 12.99,
    freeShippingAbove: 200,
    minOrderAmount: 50,
    linkedLocations: 2,
    totalShipments: 2156,
    revenue: 28004,
    calendarRules: 3,
  },
  {
    id: "sp-3",
    name: "Standard Ground Shipping",
    description: "Economy shipping across Canada",
    deliveryMethod: "STANDARD_SHIPPING",
    isDefault: false,
    isActive: true,
    processingTimeHours: 24,
    rateType: "WEIGHT_BASED",
    flatRate: 8.99,
    freeShippingAbove: 300,
    minOrderAmount: 30,
    linkedLocations: 4,
    totalShipments: 7342,
    revenue: 66078,
    calendarRules: 2,
  },
  {
    id: "sp-4",
    name: "Store Pickup",
    description: "Customer pickup at selected locations",
    deliveryMethod: "STORE_PICKUP",
    isDefault: false,
    isActive: true,
    processingTimeHours: 4,
    rateType: "FLAT",
    flatRate: 0,
    freeShippingAbove: null,
    minOrderAmount: 15,
    linkedLocations: 5,
    totalShipments: 3891,
    revenue: 0,
    calendarRules: 1,
  },
  {
    id: "sp-5",
    name: "Local Delivery Standard",
    description: "Regular delivery within service area",
    deliveryMethod: "LOCAL_DELIVERY",
    isDefault: false,
    isActive: true,
    processingTimeHours: 3,
    rateType: "TIERED",
    flatRate: 6.99,
    freeShippingAbove: 100,
    minOrderAmount: 20,
    linkedLocations: 2,
    totalShipments: 2634,
    revenue: 18411,
    calendarRules: 4,
  },
  {
    id: "sp-6",
    name: "International Shipping",
    description: "Shipping to select international destinations",
    deliveryMethod: "STANDARD_SHIPPING",
    isDefault: false,
    isActive: false,
    processingTimeHours: 48,
    rateType: "CALCULATED",
    flatRate: null,
    freeShippingAbove: null,
    minOrderAmount: 100,
    linkedLocations: 1,
    totalShipments: 156,
    revenue: 3276,
    calendarRules: 0,
  },
];

export default function ShippingProfilesPage() {
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryMethod | "ALL">("ALL");
  const [rateTypeFilter, setRateTypeFilter] = useState<RateType | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<ShippingProfile | null>(null);

  const filtered = useMemo(() => {
    return SHIPPING_PROFILES.filter((profile) => {
      if (deliveryFilter !== "ALL" && profile.deliveryMethod !== deliveryFilter) return false;
      if (rateTypeFilter !== "ALL" && profile.rateType !== rateTypeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          profile.name.toLowerCase().includes(q) ||
          (profile.description && profile.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [deliveryFilter, rateTypeFilter, search]);

  const stats = {
    totalProfiles: SHIPPING_PROFILES.length,
    activeProfiles: SHIPPING_PROFILES.filter((p) => p.isActive).length,
    monthlyRevenue: SHIPPING_PROFILES.reduce((sum, p) => sum + p.revenue, 0),
    avgFlatRate: Math.round(
      (SHIPPING_PROFILES.filter((p) => p.flatRate !== null && p.flatRate > 0).reduce(
        (sum, p) => sum + (p.flatRate || 0),
        0
      ) /
        SHIPPING_PROFILES.filter((p) => p.flatRate !== null && p.flatRate > 0).length) *
        100
    ) / 100,
  };

  return (
    <>
      <Header
        title="Shipping Profiles"
        subtitle={`${stats.totalProfiles} total · ${stats.activeProfiles} active`}
        actions={
          <Button variant="primary" size="md">
            + Add Profile
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
          <StatCard label="Total Profiles" value={stats.totalProfiles} index={0} accentColor="var(--wl-primary-500)" />
          <StatCard label="Active" value={stats.activeProfiles} index={1} accentColor="var(--wl-success-400)" />
          <StatCard label="Revenue This Month" value={formatCurrency(stats.monthlyRevenue)} index={2} accentColor="var(--wl-info-400)" />
          <StatCard label="Avg Flat Rate" value={formatCurrency(stats.avgFlatRate)} index={3} accentColor="var(--wl-warning-400)" />
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
              placeholder="Search profiles, descriptions..."
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

          {/* Delivery Method Filter Pills */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {(["ALL", "LOCAL_DELIVERY", "STORE_PICKUP", "STANDARD_SHIPPING", "EXPRESS_SHIPPING", "SAME_DAY"] as const).map((m) => {
              const count =
                m === "ALL" ? SHIPPING_PROFILES.length : SHIPPING_PROFILES.filter((p) => p.deliveryMethod === m).length;
              return (
                <button
                  key={m}
                  onClick={() => setDeliveryFilter(m)}
                  style={{
                    padding: "var(--wl-space-1) var(--wl-space-3)",
                    borderRadius: "var(--wl-radius-full)",
                    border: "1px solid",
                    fontSize: "var(--wl-text-xs)",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "var(--wl-font-sans)",
                    transition: `all var(--wl-duration-fast) var(--wl-ease-default)`,
                    background: deliveryFilter === m ? "var(--wl-primary-500)" : "transparent",
                    color: deliveryFilter === m ? "var(--wl-text-inverse)" : "var(--wl-text-tertiary)",
                    borderColor: deliveryFilter === m ? "var(--wl-primary-500)" : "var(--wl-border-default)",
                  }}
                >
                  {m === "ALL" ? "All Methods" : deliveryMethodLabel(m as DeliveryMethod).split(" ")[0]}
                  <span style={{ marginLeft: 4, opacity: 0.7 }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Rate Type Filter Pills */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: "var(--wl-space-5)" }}>
          {(["ALL", "FLAT", "WEIGHT_BASED", "DISTANCE_BASED", "ZONE_BASED", "TIERED", "CALCULATED"] as const).map((r) => {
            const count =
              r === "ALL" ? SHIPPING_PROFILES.length : SHIPPING_PROFILES.filter((p) => p.rateType === r).length;
            return (
              <button
                key={r}
                onClick={() => setRateTypeFilter(r)}
                style={{
                  padding: "var(--wl-space-1) var(--wl-space-3)",
                  borderRadius: "var(--wl-radius-full)",
                  border: "1px solid",
                  fontSize: "var(--wl-text-xs)",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--wl-font-sans)",
                  transition: `all var(--wl-duration-fast) var(--wl-ease-default)`,
                  background: rateTypeFilter === r ? "var(--wl-primary-500)" : "transparent",
                  color: rateTypeFilter === r ? "var(--wl-text-inverse)" : "var(--wl-text-tertiary)",
                  borderColor: rateTypeFilter === r ? "var(--wl-primary-500)" : "var(--wl-border-default)",
                }}
              >
                {r === "ALL" ? "All Rate Types" : rateTypeLabel(r as RateType).split(" ")[0]}
                <span style={{ marginLeft: 4, opacity: 0.7 }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Profiles Grid + Detail */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: selectedProfile ? "1fr 420px" : "1fr",
            gap: "var(--wl-space-5)",
          }}
        >
          {/* Profiles Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "var(--wl-space-4)",
            }}
          >
            {filtered.map((profile, i) => (
              <Card
                key={profile.id}
                hover
                onClick={() => setSelectedProfile(selectedProfile?.id === profile.id ? null : profile)}
                style={{
                  cursor: "pointer",
                  position: "relative",
                  overflow: "hidden",
                  animation: `wl-fade-in var(--wl-duration-slow) var(--wl-ease-default) ${i * 60}ms forwards`,
                  opacity: 0,
                  borderColor: selectedProfile?.id === profile.id ? "var(--wl-primary-500)" : undefined,
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
                    background: profile.isActive ? "var(--wl-success-400)" : "var(--wl-danger-400)",
                  }}
                />

                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--wl-space-3)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: "var(--wl-space-2)", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: "var(--wl-text-base)", fontWeight: 700, color: "var(--wl-text-primary)" }}>
                        {profile.name}
                      </span>
                      {profile.isDefault && (
                        <span style={{ fontSize: 14, opacity: 0.8, color: "var(--wl-primary-400)" }}>★</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "var(--wl-space-2)", flexWrap: "wrap" }}>
                      <Badge variant={profile.isActive ? "success" : "default"} dot>
                        {profile.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {profile.description && (
                  <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-secondary)", marginBottom: "var(--wl-space-3)", lineHeight: 1.4 }}>
                    {profile.description}
                  </div>
                )}

                {/* Method & Rate Badges */}
                <div style={{ display: "flex", gap: "var(--wl-space-2)", flexWrap: "wrap", marginBottom: "var(--wl-space-3)" }}>
                  <Badge variant={deliveryMethodVariant(profile.deliveryMethod)} dot>
                    {deliveryMethodEmoji(profile.deliveryMethod)} {deliveryMethodLabel(profile.deliveryMethod)}
                  </Badge>
                  <Badge variant="default" dot>
                    {rateTypeLabel(profile.rateType)}
                  </Badge>
                </div>

                {/* Rate & Thresholds */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "var(--wl-space-3)",
                    padding: "var(--wl-space-3)",
                    background: "var(--wl-bg-surface)",
                    borderRadius: "var(--wl-radius-md)",
                    marginBottom: "var(--wl-space-3)",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 10, color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Flat Rate</div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-base)",
                        fontWeight: 700,
                        fontFamily: "var(--wl-font-mono)",
                        color: profile.flatRate && profile.flatRate > 0 ? "var(--wl-primary-400)" : "var(--wl-text-tertiary)",
                      }}
                    >
                      {profile.flatRate !== null ? (profile.flatRate > 0 ? formatCurrency(profile.flatRate) : "FREE") : "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Free Above</div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-base)",
                        fontWeight: 700,
                        fontFamily: "var(--wl-font-mono)",
                        color: profile.freeShippingAbove ? "var(--wl-success-400)" : "var(--wl-text-tertiary)",
                      }}
                    >
                      {profile.freeShippingAbove ? formatCurrency(profile.freeShippingAbove) : "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Processing Time</div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-base)",
                        fontWeight: 700,
                        fontFamily: "var(--wl-font-mono)",
                        color: "var(--wl-text-secondary)",
                      }}
                    >
                      {profile.processingTimeHours}h
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Min Order</div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-base)",
                        fontWeight: 700,
                        fontFamily: "var(--wl-font-mono)",
                        color: "var(--wl-text-secondary)",
                      }}
                    >
                      {profile.minOrderAmount ? formatCurrency(profile.minOrderAmount) : "—"}
                    </div>
                  </div>
                </div>

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
                    <div style={{ fontSize: 10, color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Linked Locations</div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-base)",
                        fontWeight: 700,
                        fontFamily: "var(--wl-font-mono)",
                        color: "var(--wl-primary-400)",
                      }}
                    >
                      {profile.linkedLocations}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Total Shipments</div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-base)",
                        fontWeight: 700,
                        fontFamily: "var(--wl-font-mono)",
                        color: "var(--wl-success-400)",
                      }}
                    >
                      {profile.totalShipments}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Revenue</div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-base)",
                        fontWeight: 700,
                        fontFamily: "var(--wl-font-mono)",
                        color: "var(--wl-info-400)",
                      }}
                    >
                      {formatCurrency(profile.revenue)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Calendar Rules</div>
                    <div
                      style={{
                        fontSize: "var(--wl-text-base)",
                        fontWeight: 700,
                        fontFamily: "var(--wl-font-mono)",
                        color: "var(--wl-warning-400)",
                      }}
                    >
                      {profile.calendarRules}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Profile Detail Panel */}
          {selectedProfile && (
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
                      {selectedProfile.name}
                    </span>
                    {selectedProfile.isDefault && (
                      <span style={{ fontSize: 16, color: "var(--wl-primary-400)" }}>★</span>
                    )}
                  </div>
                  <Badge variant={selectedProfile.isActive ? "success" : "default"} dot>
                    {selectedProfile.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <button
                  onClick={() => setSelectedProfile(null)}
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

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-4)", flex: 1 }}>
                {/* Description */}
                {selectedProfile.description && (
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
                      Description
                    </div>
                    <div style={{ fontSize: "var(--wl-text-sm)", color: "var(--wl-text-primary)", lineHeight: 1.5 }}>
                      {selectedProfile.description}
                    </div>
                  </div>
                )}

                <div style={{ height: 1, background: "var(--wl-border-subtle)" }} />

                {/* Delivery Method & Rate Type */}
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
                    Configuration
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--wl-space-2)", marginBottom: "var(--wl-space-3)" }}>
                    <div>
                      <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Delivery Method</div>
                      <div style={{ fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-primary)" }}>
                        {deliveryMethodEmoji(selectedProfile.deliveryMethod)} {deliveryMethodLabel(selectedProfile.deliveryMethod)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Rate Type</div>
                      <div style={{ fontSize: "var(--wl-text-sm)", fontWeight: 600, color: "var(--wl-text-primary)" }}>
                        {rateTypeLabel(selectedProfile.rateType)}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ height: 1, background: "var(--wl-border-subtle)" }} />

                {/* Rate Configuration */}
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
                    Rate Configuration
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--wl-space-3)" }}>
                    <div>
                      <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Flat Rate</div>
                      <div
                        style={{
                          fontSize: "var(--wl-text-base)",
                          fontWeight: 700,
                          fontFamily: "var(--wl-font-mono)",
                          color: selectedProfile.flatRate && selectedProfile.flatRate > 0 ? "var(--wl-primary-400)" : "var(--wl-text-tertiary)",
                        }}
                      >
                        {selectedProfile.flatRate !== null ? (selectedProfile.flatRate > 0 ? formatCurrency(selectedProfile.flatRate) : "FREE") : "—"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Free Shipping Above</div>
                      <div
                        style={{
                          fontSize: "var(--wl-text-base)",
                          fontWeight: 700,
                          fontFamily: "var(--wl-font-mono)",
                          color: selectedProfile.freeShippingAbove ? "var(--wl-success-400)" : "var(--wl-text-tertiary)",
                        }}
                      >
                        {selectedProfile.freeShippingAbove ? formatCurrency(selectedProfile.freeShippingAbove) : "—"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Min Order Amount</div>
                      <div
                        style={{
                          fontSize: "var(--wl-text-base)",
                          fontWeight: 700,
                          fontFamily: "var(--wl-font-mono)",
                          color: selectedProfile.minOrderAmount ? "var(--wl-text-primary)" : "var(--wl-text-tertiary)",
                        }}
                      >
                        {selectedProfile.minOrderAmount ? formatCurrency(selectedProfile.minOrderAmount) : "—"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Processing Time</div>
                      <div
                        style={{
                          fontSize: "var(--wl-text-base)",
                          fontWeight: 700,
                          fontFamily: "var(--wl-font-mono)",
                          color: "var(--wl-text-primary)",
                        }}
                      >
                        {selectedProfile.processingTimeHours}h
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ height: 1, background: "var(--wl-border-subtle)" }} />

                {/* Linked Locations */}
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
                    Linked Locations
                  </div>
                  <div
                    style={{
                      background: "var(--wl-bg-overlay)",
                      border: "1px solid var(--wl-border-default)",
                      borderRadius: "var(--wl-radius-md)",
                      padding: "var(--wl-space-3)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--wl-space-2)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)" }}>
                      <div
                        style={{
                          fontSize: "var(--wl-text-sm)",
                          fontWeight: 700,
                          fontFamily: "var(--wl-font-mono)",
                          color: "var(--wl-primary-400)",
                        }}
                      >
                        {selectedProfile.linkedLocations}
                      </div>
                      <div style={{ fontSize: "var(--wl-text-sm)", color: "var(--wl-text-secondary)" }}>
                        location{selectedProfile.linkedLocations !== 1 ? "s" : ""} active
                      </div>
                    </div>
                    <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--wl-space-2)" }}>
                      {Array.from({ length: selectedProfile.linkedLocations }, (_, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "var(--wl-space-2)",
                            background: "var(--wl-bg-surface)",
                            borderRadius: "var(--wl-radius-sm)",
                            fontSize: "var(--wl-text-xs)",
                            color: "var(--wl-text-secondary)",
                          }}
                        >
                          Location {i + 1}
                        </div>
                      ))}
                    </div>
                  </div>
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
                      <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Total Shipments</div>
                      <div
                        style={{
                          fontSize: "var(--wl-text-lg)",
                          fontWeight: 700,
                          fontFamily: "var(--wl-font-mono)",
                          color: "var(--wl-success-400)",
                        }}
                      >
                        {selectedProfile.totalShipments}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Revenue</div>
                      <div
                        style={{
                          fontSize: "var(--wl-text-lg)",
                          fontWeight: 700,
                          fontFamily: "var(--wl-font-mono)",
                          color: "var(--wl-info-400)",
                        }}
                      >
                        {formatCurrency(selectedProfile.revenue)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)", marginBottom: 4 }}>Calendar Rules</div>
                      <div
                        style={{
                          fontSize: "var(--wl-text-lg)",
                          fontWeight: 700,
                          fontFamily: "var(--wl-font-mono)",
                          color: "var(--wl-warning-400)",
                        }}
                      >
                        {selectedProfile.calendarRules}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ height: 1, background: "var(--wl-border-subtle)" }} />

                {/* Calendar Rules Summary */}
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
                    Calendar Rules
                  </div>
                  <div
                    style={{
                      background: "var(--wl-bg-overlay)",
                      border: "1px solid var(--wl-border-default)",
                      borderRadius: "var(--wl-radius-md)",
                      padding: "var(--wl-space-3)",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "var(--wl-text-sm)", fontWeight: 700, fontFamily: "var(--wl-font-mono)", color: "var(--wl-warning-400)", marginBottom: 4 }}>
                      {selectedProfile.calendarRules}
                    </div>
                    <div style={{ fontSize: "var(--wl-text-xs)", color: "var(--wl-text-tertiary)" }}>
                      active rule{selectedProfile.calendarRules !== 1 ? "s" : ""}
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
                    Duplicate
                  </Button>
                  <Button variant={selectedProfile.isActive ? "ghost" : "secondary"} size="sm">
                    {selectedProfile.isActive ? "Deactivate" : "Activate"}
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
