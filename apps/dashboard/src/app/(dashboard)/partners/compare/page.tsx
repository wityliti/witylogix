"use client";

import { useState, useCallback, useMemo } from "react";
import { ArrowLeft, Star, CheckCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/use-api";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";

interface InstalledIntegration {
  slug: string;
  name: string;
  category: string;
  isEnabled: boolean;
  config: Record<string, unknown>;
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

interface Courier {
  id: string;
  name: string;
  priceRange: { min: number; max: number };
  deliverySpeed: string;
  coverageAreas: number;
  successRate: number;
  rating: number;
  totalRatings: number;
  features: {
    realTimeTracking: boolean;
    proofOfDelivery: boolean;
    insurance: boolean;
  };
}

const ROUTING_SLUGS = new Set(["onfleet", "stuart", "uber-direct", "lalamove", "doordash-drive"]);

function healthToRate(healthStatus: string | undefined): number {
  switch (healthStatus) {
    case "HEALTHY": return 100;
    case "DEGRADED": return 75;
    case "ERROR": case "UNHEALTHY": return 50;
    default: return 0;
  }
}

function integrationToCourier(
  i: InstalledIntegration,
  statsByProvider: Map<string, PartnerStat>
): Courier {
  const cfg = (i.config ?? {}) as Record<string, unknown>;
  const stat = statsByProvider.get(i.slug) ?? statsByProvider.get(i.slug.replace(/-/g, "_"));
  return {
    id: i.slug,
    name: i.name,
    priceRange: {
      min: typeof cfg.minPrice === "number" ? cfg.minPrice : 2.5,
      max: typeof cfg.maxPrice === "number" ? cfg.maxPrice : 10.0,
    },
    deliverySpeed:
      typeof cfg.deliverySpeed === "string" ? cfg.deliverySpeed : "2-4 hours",
    coverageAreas: typeof cfg.coverageAreas === "number" ? cfg.coverageAreas : 0,
    successRate:
      stat?.successRate ??
      (typeof cfg.successRate === "number"
        ? cfg.successRate
        : healthToRate(cfg.healthStatus as string | undefined)),
    rating: typeof cfg.rating === "number" ? cfg.rating : 0,
    totalRatings: typeof cfg.totalRatings === "number" ? cfg.totalRatings : 0,
    features: {
      realTimeTracking:
        typeof cfg.realTimeTracking === "boolean" ? cfg.realTimeTracking : true,
      proofOfDelivery:
        typeof cfg.proofOfDelivery === "boolean" ? cfg.proofOfDelivery : true,
      insurance: typeof cfg.insurance === "boolean" ? cfg.insurance : false,
    },
  };
}

export default function ComparePage() {
  const router = useRouter();
  const [selectedCouriers, setSelectedCouriers] = useState<string[]>([]);

  const { data: integrationsData, loading: intLoading, error, refetch } =
    useApiQuery<IntegrationsResponse>("/api/v4/integrations");

  const { data: partnerStatsData, loading: statsLoading } =
    useApiQuery<PartnerStatsResponse>("/api/v4/couriers/partner-stats");

  const statsByProvider = useMemo<Map<string, PartnerStat>>(() => {
    const map = new Map<string, PartnerStat>();
    for (const stat of partnerStatsData?.stats ?? []) {
      map.set(stat.provider, stat);
    }
    return map;
  }, [partnerStatsData]);

  const couriers = useMemo<Courier[]>(() => {
    const installed = integrationsData?.integrations ?? [];
    return installed
      .filter((i) => i.category === "ROUTING" || ROUTING_SLUGS.has(i.slug))
      .map((i) => integrationToCourier(i, statsByProvider));
  }, [integrationsData, statsByProvider]);

  const handleToggleCourier = useCallback((courierId: string) => {
    setSelectedCouriers((prev) => {
      if (prev.includes(courierId)) {
        return prev.filter((id) => id !== courierId);
      } else if (prev.length < 4) {
        return [...prev, courierId];
      }
      return prev;
    });
  }, []);

  const comparisonCouriers = useMemo(() => {
    return couriers.filter((c) => selectedCouriers.includes(c.id));
  }, [couriers, selectedCouriers]);

  const canAddMore = selectedCouriers.length < 4;
  const loading = intLoading || statsLoading;

  if (loading && !integrationsData) return <TableSkeleton rows={6} columns={4} />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="md" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-white">Compare Couriers</h1>
        <p className="text-wl-text-secondary">Select up to 4 couriers to compare side-by-side</p>
      </div>

      {/* Courier Selection Grid */}
      {couriers.length === 0 ? (
        <Card className="py-12 text-center">
          <div className="flex flex-col items-center gap-2">
            <p className="text-wl-text-secondary">No courier integrations installed yet.</p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push("/partners/onboard")}
            >
              Add a Courier
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {couriers.map((courier) => {
            const isSelected = selectedCouriers.includes(courier.id);
            const isDisabled = !isSelected && !canAddMore;

            return (
              <Card
                key={courier.id}
                hover
                onClick={() => !isDisabled && handleToggleCourier(courier.id)}
                className={cn(
                  "cursor-pointer transition-all",
                  isSelected && "ring-2 ring-wl-info-400 bg-wl-info-500/10",
                  isDisabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <CardContent className="pt-0">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{courier.name}</h3>
                      {courier.rating > 0 ? (
                        <div className="flex items-center gap-1 mt-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                "w-3 h-3",
                                i < Math.floor(courier.rating)
                                  ? "fill-amber-400 text-wl-warning-400"
                                  : "text-wl-text-tertiary"
                              )}
                            />
                          ))}
                          <span className="text-xs text-wl-text-secondary ml-1">
                            {courier.rating.toFixed(1)}
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-wl-text-tertiary mt-1">No ratings yet</p>
                      )}
                    </div>

                    {isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-wl-info-500 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-4 h-4 text-black" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-wl-border-default flex-shrink-0" />
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-wl-text-secondary">Price Range:</span>
                      <span className="text-white font-medium">
                        ${courier.priceRange.min} – ${courier.priceRange.max}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-wl-text-secondary">Speed:</span>
                      <span className="text-white font-medium">{courier.deliverySpeed}</span>
                    </div>
                    {courier.coverageAreas > 0 && (
                      <div className="flex justify-between">
                        <span className="text-wl-text-secondary">Coverage:</span>
                        <span className="text-white font-medium">{courier.coverageAreas} areas</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-wl-text-secondary">Success Rate:</span>
                      <span className="text-white font-medium">
                        {courier.successRate > 0 ? `${courier.successRate}%` : "—"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Comparison Table */}
      {comparisonCouriers.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Detailed Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-wl-border-default">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-wl-text-secondary">
                      Feature
                    </th>
                    {comparisonCouriers.map((courier) => (
                      <th
                        key={courier.id}
                        className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-wl-text-secondary"
                      >
                        <div className="flex items-center justify-center gap-2">
                          {courier.name}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleCourier(courier.id);
                            }}
                            className="hover:text-wl-danger-400 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-wl-border-subtle">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-white">Price Range</td>
                    {comparisonCouriers.map((courier) => (
                      <td key={courier.id} className="px-4 py-3 text-center text-white">
                        <span className="inline-flex items-center px-2 py-1 rounded bg-wl-info-500/20 text-wl-info-400 text-xs font-semibold">
                          ${courier.priceRange.min} – ${courier.priceRange.max}
                        </span>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-white">Delivery Speed</td>
                    {comparisonCouriers.map((courier) => (
                      <td key={courier.id} className="px-4 py-3 text-center text-white">
                        {courier.deliverySpeed}
                      </td>
                    ))}
                  </tr>
                  {comparisonCouriers.some((c) => c.coverageAreas > 0) && (
                    <tr>
                      <td className="px-4 py-3 font-semibold text-white">Coverage Areas</td>
                      {comparisonCouriers.map((courier) => (
                        <td key={courier.id} className="px-4 py-3 text-center text-white">
                          {courier.coverageAreas > 0 ? courier.coverageAreas : "—"}
                        </td>
                      ))}
                    </tr>
                  )}
                  <tr>
                    <td className="px-4 py-3 font-semibold text-white">Success Rate</td>
                    {comparisonCouriers.map((courier) => (
                      <td key={courier.id} className="px-4 py-3 text-center text-white">
                        {courier.successRate > 0 ? (
                          <span className="inline-flex items-center px-2 py-1 rounded bg-wl-success-500/20 text-wl-success-400 text-xs font-semibold">
                            {courier.successRate}%
                          </span>
                        ) : (
                          <span className="text-wl-text-tertiary text-sm">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-white">Rating</td>
                    {comparisonCouriers.map((courier) => (
                      <td key={courier.id} className="px-4 py-3 text-center text-white">
                        {courier.rating > 0 ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={cn(
                                    "w-3 h-3",
                                    i < Math.floor(courier.rating)
                                      ? "fill-amber-400 text-wl-warning-400"
                                      : "text-wl-text-tertiary"
                                  )}
                                />
                              ))}
                            </div>
                            <span className="text-xs">{courier.rating.toFixed(1)}</span>
                          </div>
                        ) : (
                          <span className="text-wl-text-tertiary text-sm">No ratings</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-white">Real-time Tracking</td>
                    {comparisonCouriers.map((courier) => (
                      <td key={courier.id} className="px-4 py-3 text-center text-white">
                        {courier.features.realTimeTracking ? (
                          <span className="inline-flex items-center px-2 py-1 rounded bg-wl-success-500/20 text-wl-success-400 text-xs font-semibold gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Yes
                          </span>
                        ) : (
                          <span className="text-wl-text-secondary text-sm">No</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-white">Proof of Delivery</td>
                    {comparisonCouriers.map((courier) => (
                      <td key={courier.id} className="px-4 py-3 text-center text-white">
                        {courier.features.proofOfDelivery ? (
                          <span className="inline-flex items-center px-2 py-1 rounded bg-wl-success-500/20 text-wl-success-400 text-xs font-semibold gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Yes
                          </span>
                        ) : (
                          <span className="text-wl-text-secondary text-sm">No</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-semibold text-white">Insurance</td>
                    {comparisonCouriers.map((courier) => (
                      <td key={courier.id} className="px-4 py-3 text-center text-white">
                        {courier.features.insurance ? (
                          <span className="inline-flex items-center px-2 py-1 rounded bg-wl-success-500/20 text-wl-success-400 text-xs font-semibold gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Yes
                          </span>
                        ) : (
                          <span className="text-wl-text-secondary text-sm">No</span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {comparisonCouriers.length === 0 && couriers.length > 0 && (
        <Card className="py-12 text-center">
          <div className="flex flex-col items-center gap-2">
            <p className="text-wl-text-secondary">Select couriers above to compare them</p>
          </div>
        </Card>
      )}
    </div>
  );
}
