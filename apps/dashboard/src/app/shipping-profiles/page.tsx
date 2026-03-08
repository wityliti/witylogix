"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
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

      <div className={cn("p-6")}>
        {/* KPI Stats */}
        <div className={cn("grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6")}>
          <StatCard label="Total Profiles" value={stats.totalProfiles} index={0} accentColor="var(--wl-primary-500)" />
          <StatCard label="Active" value={stats.activeProfiles} index={1} accentColor="var(--wl-success-400)" />
          <StatCard label="Revenue This Month" value={formatCurrency(stats.monthlyRevenue)} index={2} accentColor="var(--wl-info-400)" />
          <StatCard label="Avg Flat Rate" value={formatCurrency(stats.avgFlatRate)} index={3} accentColor="var(--wl-warning-400)" />
        </div>

        {/* Filters Bar */}
        <div className={cn("flex gap-4 mb-5 items-center flex-wrap")}>
          {/* Search */}
          <div className={cn("flex-1 min-w-[300px] max-w-[400px]")}>
            <input
              type="text"
              placeholder="Search profiles, descriptions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn("w-full p-2 px-4 bg-wl-bg-elevated border border-wl-border-default rounded-lg text-wl-text-primary text-sm font-sans outline-none")}
            />
          </div>

          {/* Delivery Method Filter Pills */}
          <div className={cn("flex gap-1 flex-wrap")}>
            {(["ALL", "LOCAL_DELIVERY", "STORE_PICKUP", "STANDARD_SHIPPING", "EXPRESS_SHIPPING", "SAME_DAY"] as const).map((m) => {
              const count =
                m === "ALL" ? SHIPPING_PROFILES.length : SHIPPING_PROFILES.filter((p) => p.deliveryMethod === m).length;
              return (
                <button
                  key={m}
                  onClick={() => setDeliveryFilter(m)}
                  className={cn("px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer font-sans transition-all duration-200")}
                  style={{
                    background: deliveryFilter === m ? "var(--wl-primary-500)" : "transparent",
                    color: deliveryFilter === m ? "var(--wl-text-inverse)" : "var(--wl-text-tertiary)",
                    borderColor: deliveryFilter === m ? "var(--wl-primary-500)" : "var(--wl-border-default)",
                  }}
                >
                  {m === "ALL" ? "All Methods" : deliveryMethodLabel(m as DeliveryMethod).split(" ")[0]}
                  <span className="ml-1 opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Rate Type Filter Pills */}
        <div className={cn("flex gap-1 flex-wrap mb-5")}>
          {(["ALL", "FLAT", "WEIGHT_BASED", "DISTANCE_BASED", "ZONE_BASED", "TIERED", "CALCULATED"] as const).map((r) => {
            const count =
              r === "ALL" ? SHIPPING_PROFILES.length : SHIPPING_PROFILES.filter((p) => p.rateType === r).length;
            return (
              <button
                key={r}
                onClick={() => setRateTypeFilter(r)}
                className={cn("px-3 py-1 rounded-lg border text-xs font-semibold cursor-pointer font-sans transition-all")}
                style={{
                  background: rateTypeFilter === r ? "var(--wl-primary-500)" : "transparent",
                  color: rateTypeFilter === r ? "var(--wl-text-inverse)" : "var(--wl-text-tertiary)",
                  borderColor: rateTypeFilter === r ? "var(--wl-primary-500)" : "var(--wl-border-default)",
                }}
              >
                {r === "ALL" ? "All Rate Types" : rateTypeLabel(r as RateType).split(" ")[0]}
                <span className="ml-1 opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Profiles Grid + Detail */}
        <div className={cn("grid gap-5")} style={{ gridTemplateColumns: selectedProfile ? "1fr 420px" : "1fr" }}>

          {/* Profiles Grid */}
          <div className={cn("grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4")}>
            {filtered.map((profile, i) => (
              <Card
                key={profile.id}
                hover
                onClick={() => setSelectedProfile(selectedProfile?.id === profile.id ? null : profile)}
                className={cn("cursor-pointer relative overflow-hidden flex flex-col")}
                style={{
                  animation: `wl-fade-in var(--wl-duration-slow) var(--wl-ease-default) ${i * 60}ms forwards`,
                  opacity: 0,
                  borderColor: selectedProfile?.id === profile.id ? "var(--wl-primary-500)" : undefined,
                }}
              >
                {/* Status indicator line */}
                <div
                  className={cn("absolute top-0 left-0 right-0 h-0.5")}
                  style={{
                    background: profile.isActive ? "var(--wl-success-400)" : "var(--wl-danger-400)",
                  }}
                />

                {/* Header */}
                <div className={cn("flex justify-between items-start mb-3")}>
                  <div className={cn("flex-1 min-w-0")}>
                    <div className={cn("flex gap-2 items-center mb-1")}>
                      <span className={cn("text-base font-bold text-wl-text-primary")}>
                        {profile.name}
                      </span>
                      {profile.isDefault && (
                        <span className={cn("opacity-80 text-wl-primary-400")}>★</span>
                      )}
                    </div>
                    <div className={cn("flex gap-2 flex-wrap")}>
                      <Badge variant={profile.isActive ? "success" : "default"} dot>
                        {profile.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {profile.description && (
                  <div className={cn("text-xs text-wl-text-secondary mb-3")} style={{ lineHeight: 1.4 }}>
                    {profile.description}
                  </div>
                )}

                {/* Method & Rate Badges */}
                <div className={cn("flex gap-2 flex-wrap mb-3")}>
                  <Badge variant={deliveryMethodVariant(profile.deliveryMethod)} dot>
                    {deliveryMethodEmoji(profile.deliveryMethod)} {deliveryMethodLabel(profile.deliveryMethod)}
                  </Badge>
                  <Badge variant="default" dot>
                    {rateTypeLabel(profile.rateType)}
                  </Badge>
                </div>

                {/* Rate & Thresholds */}
                <div className={cn("grid grid-cols-2 gap-3 p-3 bg-wl-bg-surface rounded-lg mb-3")}>
                  <div>
                      <div className={cn("text-[10px] text-wl-text-tertiary mb-1")}>Flat Rate</div>
                    <div className={cn("text-base font-bold")} style={{ fontFamily: "var(--wl-font-mono)", color: profile.flatRate && profile.flatRate > 0 ? "var(--wl-primary-400)" : "var(--wl-text-tertiary)" }}>
                      {profile.flatRate !== null ? (profile.flatRate > 0 ? formatCurrency(profile.flatRate) : "FREE") : "—"}
                    </div>
                  </div>
                  <div>
                    <div className={cn("text-[10px] text-wl-text-tertiary mb-1")}>Free Above</div>
                    <div className={cn("text-base font-bold")} style={{ fontFamily: "var(--wl-font-mono)", color: profile.freeShippingAbove ? "var(--wl-success-400)" : "var(--wl-text-tertiary)" }}>
                      {profile.freeShippingAbove ? formatCurrency(profile.freeShippingAbove) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className={cn("text-[10px] text-wl-text-tertiary mb-1")}>Processing Time</div>
                    <div className={cn("text-base font-bold text-wl-text-secondary")} style={{ fontFamily: "var(--wl-font-mono)" }}>
                      {profile.processingTimeHours}h
                    </div>
                  </div>
                  <div>
                    <div className={cn("text-[10px] text-wl-text-tertiary mb-1")}>Min Order</div>
                    <div className={cn("text-base font-bold text-wl-text-secondary")} style={{ fontFamily: "var(--wl-font-mono)" }}>
                      {profile.minOrderAmount ? formatCurrency(profile.minOrderAmount) : "—"}
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className={cn("grid grid-cols-2 gap-3 p-3 border-t border-b border-wl-border-subtle mb-3")}>
                  <div>
                    <div className={cn("text-[10px] text-wl-text-tertiary mb-1")}>Linked Locations</div>
                    <div className={cn("text-base font-bold text-wl-primary-400")} style={{ fontFamily: "var(--wl-font-mono)" }}>
                      {profile.linkedLocations}
                    </div>
                  </div>
                  <div>
                    <div className={cn("text-[10px] text-wl-text-tertiary mb-1")}>Total Shipments</div>
                    <div className={cn("text-base font-bold text-wl-success-400")} style={{ fontFamily: "var(--wl-font-mono)" }}>
                      {profile.totalShipments}
                    </div>
                  </div>
                  <div>
                    <div className={cn("text-[10px] text-wl-text-tertiary mb-1")}>Revenue</div>
                    <div className={cn("text-base font-bold text-wl-info-400")} style={{ fontFamily: "var(--wl-font-mono)" }}>
                      {formatCurrency(profile.revenue)}
                    </div>
                  </div>
                  <div>
                    <div className={cn("text-[10px] text-wl-text-tertiary mb-1")}>Calendar Rules</div>
                    <div className={cn("text-base font-bold text-wl-warning-400")} style={{ fontFamily: "var(--wl-font-mono)" }}>
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
              <div className={cn("flex justify-between items-start mb-4")}>
                <div>
                  <div className={cn("flex gap-2 items-center mb-1")}>
                    <span className={cn("text-lg font-bold text-wl-text-primary")}>
                      {selectedProfile.name}
                    </span>
                    {selectedProfile.isDefault && (
                      <span className={cn("text-wl-primary-400")}>★</span>
                    )}
                  </div>
                  <Badge variant={selectedProfile.isActive ? "success" : "default"} dot>
                    {selectedProfile.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <button
                  onClick={() => setSelectedProfile(null)}
                  className={cn("bg-none border-none text-wl-text-tertiary cursor-pointer text-lg font-sans")}
                >
                  ✕
                </button>
              </div>

              <div className={cn("flex flex-col gap-4 flex-1")}>
                {/* Description */}
                {selectedProfile.description && (
                  <div>
                    <div className={cn("text-xs font-semibold text-wl-text-tertiary uppercase tracking-widest mb-2")}>
                      Description
                    </div>
                    <div className={cn("text-sm text-wl-text-primary")} style={{ lineHeight: 1.5 }}>
                      {selectedProfile.description}
                    </div>
                  </div>
                )}

                <div className={cn("h-px bg-wl-border-subtle")} />

                {/* Delivery Method & Rate Type */}
                <div>
                  <div className={cn("text-xs font-semibold text-wl-text-tertiary uppercase tracking-widest mb-2")}>
                    Configuration
                  </div>
                  <div className={cn("grid grid-cols-2 gap-2 mb-3")}>
                    <div>
                      <div className={cn("text-xs text-wl-text-tertiary mb-1")}>Delivery Method</div>
                      <div className={cn("text-sm font-semibold text-wl-text-primary")}>
                        {deliveryMethodEmoji(selectedProfile.deliveryMethod)} {deliveryMethodLabel(selectedProfile.deliveryMethod)}
                      </div>
                    </div>
                    <div>
                      <div className={cn("text-xs text-wl-text-tertiary mb-1")}>Rate Type</div>
                      <div className={cn("text-sm font-semibold text-wl-text-primary")}>
                        {rateTypeLabel(selectedProfile.rateType)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={cn("h-px bg-wl-border-subtle")} />

                {/* Rate Configuration */}
                <div>
                  <div className={cn("text-xs font-semibold text-wl-text-tertiary uppercase tracking-widest mb-3")}>
                    Rate Configuration
                  </div>
                  <div className={cn("grid grid-cols-2 gap-3")}>
                    <div>
                      <div className={cn("text-xs text-wl-text-tertiary mb-1")}>Flat Rate</div>
                      <div className={cn("text-base font-bold")} style={{ fontFamily: "var(--wl-font-mono)", color: selectedProfile.flatRate && selectedProfile.flatRate > 0 ? "var(--wl-primary-400)" : "var(--wl-text-tertiary)" }}>
                        {selectedProfile.flatRate !== null ? (selectedProfile.flatRate > 0 ? formatCurrency(selectedProfile.flatRate) : "FREE") : "—"}
                      </div>
                    </div>
                    <div>
                      <div className={cn("text-xs text-wl-text-tertiary mb-1")}>Free Shipping Above</div>
                      <div className={cn("text-base font-bold")} style={{ fontFamily: "var(--wl-font-mono)", color: selectedProfile.freeShippingAbove ? "var(--wl-success-400)" : "var(--wl-text-tertiary)" }}>
                        {selectedProfile.freeShippingAbove ? formatCurrency(selectedProfile.freeShippingAbove) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className={cn("text-xs text-wl-text-tertiary mb-1")}>Min Order Amount</div>
                      <div className={cn("text-base font-bold")} style={{ fontFamily: "var(--wl-font-mono)", color: selectedProfile.minOrderAmount ? "var(--wl-text-primary)" : "var(--wl-text-tertiary)" }}>
                        {selectedProfile.minOrderAmount ? formatCurrency(selectedProfile.minOrderAmount) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className={cn("text-xs text-wl-text-tertiary mb-1")}>Processing Time</div>
                      <div className={cn("text-base font-bold text-wl-text-primary")} style={{ fontFamily: "var(--wl-font-mono)" }}>
                        {selectedProfile.processingTimeHours}h
                      </div>
                    </div>
                  </div>
                </div>

                <div className={cn("h-px bg-wl-border-subtle")} />

                {/* Linked Locations */}
                <div>
                  <div className={cn("text-xs font-semibold text-wl-text-tertiary uppercase tracking-widest mb-2")}>
                    Linked Locations
                  </div>
                  <div className={cn("bg-wl-bg-overlay border border-wl-border-default rounded-lg p-3 flex flex-col gap-2")}>
                    <div className={cn("flex items-center gap-2")}>
                      <div className={cn("text-sm font-bold text-wl-primary-400")} style={{ fontFamily: "var(--wl-font-mono)" }}>
                        {selectedProfile.linkedLocations}
                      </div>
                      <div className={cn("text-sm text-wl-text-secondary")}>
                        location{selectedProfile.linkedLocations !== 1 ? "s" : ""} active
                      </div>
                    </div>
                    <div className={cn("text-xs text-wl-text-tertiary grid grid-cols-2 gap-2")}>
                      {Array.from({ length: selectedProfile.linkedLocations }, (_, i) => (
                        <div
                          key={i}
                          className={cn("p-2 bg-wl-bg-surface rounded text-xs text-wl-text-secondary")}
                        >
                          Location {i + 1}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={cn("h-px bg-wl-border-subtle")} />

                {/* Performance Stats */}
                <div>
                  <div className={cn("text-xs font-semibold text-wl-text-tertiary uppercase tracking-widest mb-3")}>
                    Performance
                  </div>
                  <div className={cn("grid grid-cols-2 gap-3")}>
                    <div>
                      <div className={cn("text-xs text-wl-text-tertiary mb-1")}>Total Shipments</div>
                      <div className={cn("text-lg font-bold text-wl-success-400")} style={{ fontFamily: "var(--wl-font-mono)" }}>
                        {selectedProfile.totalShipments}
                      </div>
                    </div>
                    <div>
                      <div className={cn("text-xs text-wl-text-tertiary mb-1")}>Revenue</div>
                      <div className={cn("text-lg font-bold text-wl-info-400")} style={{ fontFamily: "var(--wl-font-mono)" }}>
                        {formatCurrency(selectedProfile.revenue)}
                      </div>
                    </div>
                    <div>
                      <div className={cn("text-xs text-wl-text-tertiary mb-1")}>Calendar Rules</div>
                      <div className={cn("text-lg font-bold text-wl-warning-400")} style={{ fontFamily: "var(--wl-font-mono)" }}>
                        {selectedProfile.calendarRules}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={cn("h-px bg-wl-border-subtle")} />

                {/* Action Buttons */}
                <div className={cn("flex gap-2 flex-wrap mt-auto pt-4 border-t border-wl-border-subtle")}>
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
