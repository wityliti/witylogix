"use client";

import { useState, useCallback, useMemo } from "react";
import { Search, Plus, Grid2x2, List, Filter } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
import { useApiList } from '@/hooks/use-api';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
  PartnerCard,
  PartnerStatsWidget,
  type PartnerStatus,
  type PartnerCategory,
} from "@/components/partners";

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



type ViewMode = "grid" | "list";

export default function PartnersPage() {
  const { items, loading, error, refetch, pagination } = useApiList<Partner>('/api/v4/partners');

  if (loading) return <TableSkeleton rows={10} columns={6} />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<PartnerCategory | "">(
    ""
  );
  const [selectedStatus, setSelectedStatus] = useState<PartnerStatus | "">("");
  const [sortBy, setSortBy] = useState<"name" | "rating" | "deliveries">(
    "name"
  );
  const [isLoading] = useState(false);

  const filtered = useMemo(() => {
    let result = MOCK_PARTNERS;

    if (searchQuery) {
      result = result.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedCategory) {
      result = result.filter((p) => p.category === selectedCategory);
    }

    if (selectedStatus) {
      result = result.filter((p) => p.status === selectedStatus);
    }

    if (sortBy === "name") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "rating") {
      result.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === "deliveries") {
      result.sort((a, b) => b.activeDeliveries - a.activeDeliveries);
    }

    return result;
  }, [searchQuery, selectedCategory, selectedStatus, sortBy]);

  const stats = useMemo(() => {
    const active = MOCK_PARTNERS.filter((p) => p.status === "active").length;
    const totalDeliveries = MOCK_PARTNERS.reduce(
      (sum, p) => sum + p.activeDeliveries,
      0
    );
    const avgCost = (totalDeliveries * 3.5) / active; // Mock calculation

    return {
      totalPartners: MOCK_PARTNERS.length,
      activeCouriers: active,
      deliveriesThisMonth: totalDeliveries,
      averageCostPerDelivery: avgCost,
    };
  }, []);

  const handleViewDetails = useCallback((id: string) => {
    router.push(`/dashboard/partners/${id}`);
  }, [router]);

  const handleConfigure = useCallback((id: string) => {
    router.push(`/dashboard/partners/${id}?tab=settings`);
  }, [router]);

  const handleAddPartner = useCallback(() => {
    router.push("/dashboard/partners/onboard");
  }, [router]);

  const handleCompare = useCallback(() => {
    router.push("/dashboard/partners/compare");
  }, [router]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-wl-text-primary">
            Courier Partners
          </h1>
          <p className="text-wl-text-secondary">
            Manage and monitor your delivery partners
          </p>
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
        isLoading={isLoading}
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

        <div className="flex gap-3">
          <Select
            value={selectedCategory as string}
            onChange={(value) =>
              setSelectedCategory(
                (value as PartnerCategory) || ("")
              )
            }
            label="Category"
            className="w-40"
          >
            <option value="">All Categories</option>
            <option value="courier">Courier</option>
            <option value="freight">Freight</option>
            <option value="same-day">Same-Day</option>
            <option value="scheduled">Scheduled</option>
          </Select>

          <Select
            value={selectedStatus as string}
            onChange={(value) =>
              setSelectedStatus((value as PartnerStatus) || "")
            }
            label="Status"
            className="w-32"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="inactive">Inactive</option>
          </Select>

          <Select
            value={sortBy}
            onChange={(value) =>
              setSortBy(value as "name" | "rating" | "deliveries")
            }
            label="Sort By"
            className="w-40"
          >
            <option value="name">Name</option>
            <option value="rating">Rating</option>
            <option value="deliveries">Active Deliveries</option>
          </Select>

          <div className="flex items-center gap-2 border border-wl-border-subtle rounded-md p-2">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "p-1.5 rounded transition-colors",
                viewMode === "grid"
                  ? "bg-wl-primary-500/20 text-wl-primary-400"
                  : "text-wl-text-secondary hover:text-wl-text-primary"
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
                  ? "bg-wl-primary-500/20 text-wl-primary-400"
                  : "text-wl-text-secondary hover:text-wl-text-primary"
              )}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Partners Grid/List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="h-96 animate-pulse bg-wl-bg-surface" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-4 py-16">
          <Filter className="w-12 h-12 text-wl-text-secondary/50" />
          <div className="flex flex-col items-center gap-2">
            <h3 className="text-lg font-semibold text-wl-text-secondary">
              No partners found
            </h3>
            <p className="text-sm text-wl-text-secondary/75">
              Try adjusting your search filters
            </p>
          </div>
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
            <Card
              key={partner.id}
              className="flex items-center justify-between gap-4 p-4"
            >
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
                  <div className="w-12 h-12 rounded-md bg-gradient-to-br from-wl-primary-500 to-wl-primary-600 flex items-center justify-center text-wl-text-inverse font-bold text-sm">
                    {partner.name.substring(0, 2).toUpperCase()}
                  </div>
                )}

                <div className="flex-1">
                  <h3 className="font-semibold text-wl-text-primary">
                    {partner.name}
                  </h3>
                  <p className="text-sm text-wl-text-secondary">
                    {partner.activeDeliveries} active deliveries • {partner.successRate}%
                    success rate • {partner.rating.toFixed(1)}★
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleViewDetails(partner.id)}
                >
                  Details
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleConfigure(partner.id)}
                >
                  Configure
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Results count */}
      <div className="text-sm text-wl-text-secondary text-center">
        Showing {filtered.length} of {MOCK_PARTNERS.length} partners
      </div>
    </div>
  );
}
