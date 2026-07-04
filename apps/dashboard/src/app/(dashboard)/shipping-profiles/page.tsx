"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { formatCurrency } from "@/lib/utils";
import { useApiList } from "@/hooks/use-api";

type DeliveryMethod =
  | "LOCAL_DELIVERY"
  | "STORE_PICKUP"
  | "STANDARD_SHIPPING"
  | "EXPRESS_SHIPPING"
  | "SAME_DAY";
type RateType =
  | "FLAT"
  | "WEIGHT_BASED"
  | "DISTANCE_BASED"
  | "ZONE_BASED"
  | "TIERED"
  | "CALCULATED";

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
  createdAt: string;
  updatedAt: string;
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

const deliveryMethodVariant = (
  m: DeliveryMethod,
): "info" | "success" | "primary" | "warning" | "default" => {
  const map: Record<
    DeliveryMethod,
    "info" | "success" | "primary" | "warning" | "default"
  > = {
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

export default function ShippingProfilesPage() {
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryMethod | "ALL">(
    "ALL",
  );
  const [search, setSearch] = useState("");

  const {
    items: profiles,
    loading,
    error,
    refetch,
    pagination,
    setPage,
  } = useApiList<ShippingProfile>("/api/v4/shipping-profiles", { limit: 50 });

  const filtered = useMemo(() => {
    return profiles.filter((profile) => {
      if (deliveryFilter !== "ALL" && profile.deliveryMethod !== deliveryFilter)
        return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          profile.name.toLowerCase().includes(q) ||
          (profile.description && profile.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [profiles, deliveryFilter, search]);

  const stats = useMemo(
    () => ({
      totalProfiles: pagination.total,
      activeProfiles: profiles.filter((p) => p.isActive).length,
      defaultProfiles: profiles.filter((p) => p.isDefault).length,
    }),
    [profiles, pagination.total],
  );

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

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
        <div
          className={cn(
            "grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6",
          )}
        >
          <StatCard
            label="Total Profiles"
            value={stats.totalProfiles}
            index={0}
            accentColor="var(--wl-primary-500)"
          />
          <StatCard
            label="Active"
            value={stats.activeProfiles}
            index={1}
            accentColor="var(--wl-success-400)"
          />
          <StatCard
            label="Default Profiles"
            value={stats.defaultProfiles}
            index={2}
            accentColor="var(--wl-info-400)"
          />
        </div>

        {/* Filters Bar */}
        <div className={cn("flex gap-4 mb-5 items-center flex-wrap")}>
          <div className={cn("flex-1 min-w-[300px] max-w-[400px]")}>
            <input
              type="text"
              placeholder="Search profiles, descriptions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                "w-full p-2 px-4 bg-wl-bg-elevated border border-wl-border-default rounded-lg text-white text-sm font-sans outline-none",
              )}
            />
          </div>

          {/* Delivery Method Filter Pills */}
          <div className={cn("flex gap-1 flex-wrap")}>
            {(
              [
                "ALL",
                "LOCAL_DELIVERY",
                "STORE_PICKUP",
                "STANDARD_SHIPPING",
                "EXPRESS_SHIPPING",
                "SAME_DAY",
              ] as const
            ).map((m) => {
              const count =
                m === "ALL"
                  ? profiles.length
                  : profiles.filter((p) => p.deliveryMethod === m).length;
              return (
                <button
                  key={m}
                  onClick={() => setDeliveryFilter(m)}
                  className={cn(
                    "px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer font-sans transition-all duration-200",
                    deliveryFilter === m
                      ? "bg-blue-500 text-wl-text-primary border-blue-500"
                      : "bg-transparent text-wl-text-secondary border-wl-border-default",
                  )}
                >
                  {m === "ALL"
                    ? "All Methods"
                    : deliveryMethodLabel(m as DeliveryMethod).split(" ")[0]}
                  <span className="ml-1 opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Profiles Grid */}
        <div
          className={cn(
            "grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4",
          )}
        >
          {filtered.map((profile, i) => (
            <Link key={profile.id} href={`/shipping-profiles/${profile.id}`}>
              <Card
                hover
                className={cn(
                  "cursor-pointer relative overflow-hidden flex flex-col opacity-0",
                )}
                style={{
                  animation: `wl-fade-in var(--wl-duration-slow) var(--wl-ease-default) ${i * 60}ms forwards`,
                }}
              >
                {/* Status indicator line */}
                <div
                  className={cn(
                    "absolute top-0 left-0 right-0 h-0.5",
                    profile.isActive ? "bg-emerald-500" : "bg-red-500",
                  )}
                />

                {/* Header */}
                <div className={cn("flex justify-between items-start mb-3")}>
                  <div className={cn("flex-1 min-w-0")}>
                    <div className={cn("flex gap-2 items-center mb-1")}>
                      <span className={cn("text-base font-bold text-white")}>
                        {profile.name}
                      </span>
                      {profile.isDefault && (
                        <span className={cn("opacity-80 text-blue-500")}>
                          ★
                        </span>
                      )}
                    </div>
                    <div className={cn("flex gap-2 flex-wrap")}>
                      <Badge
                        variant={profile.isActive ? "success" : "default"}
                        dot
                      >
                        {profile.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {profile.description && (
                  <div
                    className={cn(
                      "text-xs text-wl-neutral-300 mb-3 leading-relaxed",
                    )}
                  >
                    {profile.description}
                  </div>
                )}

                {/* Method & Rate Badges */}
                <div className={cn("flex gap-2 flex-wrap mb-3")}>
                  <Badge
                    variant={deliveryMethodVariant(profile.deliveryMethod)}
                    dot
                  >
                    {deliveryMethodEmoji(profile.deliveryMethod)}{" "}
                    {deliveryMethodLabel(profile.deliveryMethod)}
                  </Badge>
                  <Badge variant="default" dot>
                    {rateTypeLabel(profile.rateType)}
                  </Badge>
                </div>

                {/* Rate & Thresholds */}
                <div
                  className={cn(
                    "grid grid-cols-2 gap-3 p-3 bg-wl-bg-surface rounded-lg mb-3",
                  )}
                >
                  <div>
                    <div
                      className={cn("text-[10px] text-wl-text-secondary mb-1")}
                    >
                      Flat Rate
                    </div>
                    <div
                      className={cn(
                        "text-base font-bold font-mono",
                        profile.flatRate && profile.flatRate > 0
                          ? "text-blue-500"
                          : "text-wl-text-secondary",
                      )}
                    >
                      {profile.flatRate !== null
                        ? profile.flatRate > 0
                          ? formatCurrency(Number(profile.flatRate))
                          : "FREE"
                        : "—"}
                    </div>
                  </div>

                  <div>
                    <div
                      className={cn("text-[10px] text-wl-text-secondary mb-1")}
                    >
                      Free Above
                    </div>
                    <div
                      className={cn(
                        "text-base font-bold font-mono",
                        profile.freeShippingAbove
                          ? "text-emerald-500"
                          : "text-wl-text-secondary",
                      )}
                    >
                      {profile.freeShippingAbove
                        ? formatCurrency(Number(profile.freeShippingAbove))
                        : "—"}
                    </div>
                  </div>

                  <div>
                    <div
                      className={cn("text-[10px] text-wl-text-secondary mb-1")}
                    >
                      Processing Time
                    </div>
                    <div
                      className={cn(
                        "text-base font-bold font-mono text-wl-neutral-300",
                      )}
                    >
                      {profile.processingTimeHours}h
                    </div>
                  </div>

                  <div>
                    <div
                      className={cn("text-[10px] text-wl-text-secondary mb-1")}
                    >
                      Min Order
                    </div>
                    <div
                      className={cn(
                        "text-base font-bold font-mono text-wl-neutral-300",
                      )}
                    >
                      {profile.minOrderAmount
                        ? formatCurrency(Number(profile.minOrderAmount))
                        : "—"}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-wl-text-tertiary">
              No shipping profiles found
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <Button
              variant="secondary"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPage(pagination.page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-wl-text-secondary self-center">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPage(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
