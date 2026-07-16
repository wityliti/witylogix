"use client";

import { useState, useCallback, useMemo } from "react";
import { Search, Plus, Grid2x2, List, Filter } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/use-api";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import {
  PartnerCard,
  PartnerStatsWidget,
  type PartnerStatus,
  type PartnerCategory,
} from "@/components/partners";

interface InstalledIntegration {
  slug: string;
  name: string;
  description: string;
  category: string;
  logoUrl?: string;
  isEnabled: boolean;
  healthStatus: string | null;
  lastSyncAt: string | null;
  config: Record<string, unknown>;
  installedAt: string;
  updatedAt: string;
}

interface IntegrationsResponse {
  integrations: InstalledIntegration[];
  counts: Record<string, number>;
}

interface PartnerStat {
  provider: string;
  activeDeliveries: number;
  totalDeliveries: number;
  successRate: number | null;
}

interface PartnerStatsResponse {
  stats: PartnerStat[];
}

interface Partner {
  id: string;
  name: string;
  category: PartnerCategory;
  status: PartnerStatus;
  logoUrl?: string;
  averageDeliveryTime: number;
  successRate: number;
  activeDeliveries: number;
  rating: number;
  totalRatings: number;
}

const ROUTING_SLUGS = new Set(["onfleet", "stuart", "uber-direct", "lalamove", "doordash-drive"]);

function healthToSuccessRate(healthStatus: string | null): number {
  switch (healthStatus) {
    case "HEALTHY": return 100;
    case "DEGRADED": return 75;
    case "UNHEALTHY": case "ERROR": return 50;
    default: return 0;
  }
}

function integrationToPartner(
  i: InstalledIntegration,
  statsByProvider: Map<string, PartnerStat>
): Partner {
  const cfg = (i.config ?? {}) as Record<string, unknown>;
  const stat = statsByProvider.get(i.slug) ?? statsByProvider.get(i.slug.replace(/-/g, "_"));
  return {
    id: i.slug,
    name: i.name,
    category: "courier" as PartnerCategory,
    status: i.isEnabled
      ? i.healthStatus === "UNHEALTHY" || i.healthStatus === "ERROR"
        ? "inactive"
        : "active"
      : ("inactive" as PartnerStatus),
    logoUrl: i.logoUrl,
    averageDeliveryTime: typeof cfg.maxDeliveryTime === "number" ? cfg.maxDeliveryTime : 30,
    successRate: stat?.successRate ?? healthToSuccessRate(i.healthStatus),
    activeDeliveries: stat?.activeDeliveries ?? 0,
    rating: typeof cfg.rating === "number" ? cfg.rating : 0,
    totalRatings: typeof cfg.totalRatings === "number" ? cfg.totalRatings : 0,
  };
}

type ViewMode = "grid" | "list";
type SortBy = "name" | "rating" | "deliveries";

export default function PartnersPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<PartnerStatus | "">("");
  const [sortBy, setSortBy] = useState<SortBy>("name");

  const {
    data: integrationsData,
    loading: integrationsLoading,
    error: integrationsError,
    refetch,
  } = useApiQuery<IntegrationsResponse>("/api/v4/integrations");

  const {
    data: partnerStatsData,
    loading: statsLoading,
  } = useApiQuery<PartnerStatsResponse>("/api/v4/couriers/partner-stats");

  const statsByProvider = useMemo<Map<string, PartnerStat>>(() => {
    const map = new Map<string, PartnerStat>();
    for (const stat of partnerStatsData?.stats ?? []) {
      map.set(stat.provider, stat);
    }
    return map;
  }, [partnerStatsData]);

  const partners = useMemo<Partner[]>(() => {
    const installed = integrationsData?.integrations ?? [];
    return installed
      .filter((i) => i.category === "ROUTING" || ROUTING_SLUGS.has(i.slug))
      .map((i) => integrationToPartner(i, statsByProvider));
  }, [integrationsData, statsByProvider]);

  const filtered = useMemo(() => {
    let result = partners;

    if (searchQuery) {
      result = result.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedStatus) {
      result = result.filter((p) => p.status === selectedStatus);
    }

    const sorted = [...result];
    if (sortBy === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "rating") {
      sorted.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === "deliveries") {
      sorted.sort((a, b) => b.activeDeliveries - a.activeDeliveries);
    }

    return sorted;
  }, [partners, searchQuery, selectedStatus, sortBy]);

  const stats = useMemo(() => {
    const active = partners.filter((p) => p.status === "active").length;
    const totalDeliveries = partners.reduce((sum, p) => sum + p.activeDeliveries, 0);
    const avgSuccessRate =
      partners.length > 0
        ? partners.reduce((sum, p) => sum + p.successRate, 0) / partners.length
        : 0;
    return {
      totalPartners: partners.length,
      activeCouriers: active,
      deliveriesThisMonth: totalDeliveries,
      averageCostPerDelivery: avgSuccessRate,
    };
  }, [partners]);

  const handleViewDetails = useCallback(
    (id: string) => router.push(`/partners/${id}`),
    [router]
  );
  const handleConfigure = useCallback(
    (id: string) => router.push(`/partners/${id}?tab=settings`),
    [router]
  );
  const handleAddPartner = useCallback(
    () => router.push("/partners/onboard"),
    [router]
  );
  const handleCompare = useCallback(
    () => router.push("/partners/compare"),
    [router]
  );

  const loading = integrationsLoading || statsLoading;

  if (loading && !integrationsData) return <TableSkeleton rows={10} columns={6} />;
  if (integrationsError) return <ErrorState message={integrationsError.message} onRetry={refetch} />;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-white">Courier Partners</h1>
          <p className="text-wl-text-secondary">Manage and monitor your delivery partners</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={handleCompare}>
            <Grid2x2 className="w-4 h-4" />
            Compare
          </Button>
          <Button variant="primary" size="lg" onClick={handleAddPartner}>
            <Plus className="w-4 h-4" />
            Add Partner
          </Button>
        </div>
      </div>

      {/* Stats Widget */}
      <PartnerStatsWidget
        totalPartners={stats.totalPartners}
        activeCouriers={stats.activeCouriers}
        deliveriesThisMonth={stats.deliveriesThisMonth}
        averageCostPerDelivery={stats.averageCostPerDelivery}
        isLoading={loading}
      />

      {/* Filters & Controls */}
      <Card className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search partners..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            icon={<Search className="w-4 h-4" />}
            className="w-full"
          />
        </div>

        <div className="flex gap-3 items-center">
          <select
            value={selectedStatus as string}
            onChange={(e) => setSelectedStatus((e.target.value as PartnerStatus) || "")}
            className="px-3 py-2 bg-wl-bg-surface border border-wl-border-default rounded-md text-white text-sm cursor-pointer focus:outline-none"
            aria-label="Filter by status"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-3 py-2 bg-wl-bg-surface border border-wl-border-default rounded-md text-white text-sm cursor-pointer focus:outline-none"
            aria-label="Sort by"
          >
            <option value="name">Name</option>
            <option value="rating">Rating</option>
            <option value="deliveries">Active Deliveries</option>
          </select>

          <div className="flex items-center gap-2 border border-wl-border-default rounded-md p-2">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-1.5 rounded transition-colors",
                viewMode === "grid"
                  ? "bg-blue-500/20 text-blue-400"
                  : "text-wl-text-secondary hover:text-white"
              )}
              title="Grid view"
            >
              <Grid2x2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "p-1.5 rounded transition-colors",
                viewMode === "list"
                  ? "bg-blue-500/20 text-blue-400"
                  : "text-wl-text-secondary hover:text-white"
              )}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Partners Grid/List */}
      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-4 py-16">
          <Filter className="w-12 h-12 text-wl-text-tertiary" />
          <div className="flex flex-col items-center gap-2">
            <h3 className="text-lg font-semibold text-white">No partners found</h3>
            <p className="text-sm text-wl-text-secondary">
              {partners.length === 0
                ? "Add a courier partner to get started"
                : "Try adjusting your search filters"}
            </p>
          </div>
          {partners.length === 0 && (
            <Button variant="primary" size="md" onClick={handleAddPartner}>
              <Plus className="w-4 h-4" />
              Add Partner
            </Button>
          )}
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((partner) => (
            <PartnerCard
              key={partner.id}
              {...partner}
              onViewDetails={handleViewDetails}
              onConfigure={handleConfigure}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((partner) => (
            <Card key={partner.id} className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-4 flex-1">
                {partner.logoUrl ? (
                  <div className="w-12 h-12 rounded-md bg-wl-bg-surface flex items-center justify-center">
                    <img
                      src={partner.logoUrl}
                      alt={partner.name}
                      className="w-10 h-10 object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-md bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-black font-bold text-sm">
                    {partner.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-white">{partner.name}</h3>
                  <p className="text-sm text-wl-text-secondary">
                    {partner.activeDeliveries} active deliveries · {partner.successRate}% success
                    rate{partner.rating > 0 ? ` · ${partner.rating.toFixed(1)}★` : ""}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => handleViewDetails(partner.id)}>
                  Details
                </Button>
                <Button variant="primary" size="sm" onClick={() => handleConfigure(partner.id)}>
                  Configure
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="text-sm text-wl-text-secondary text-center">
        Showing {filtered.length} of {partners.length} partners
      </div>
    </div>
  );
}
