"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApiList } from "@/hooks/use-api";
import dynamic from "next/dynamic";
import { Map as MapIcon, List } from "lucide-react";
import { LoadingSkeleton, ErrorState } from "@/components/ui/loading";

const DriverPerformanceMapView = dynamic(
  () => import("./components/driver-performance-map-view"),
  { ssr: false },
);

/* ═══════════════════════════════════════════════════════════
   DRIVER PERFORMANCE LEADERBOARD
   Displays driver scoring, rankings, and performance metrics
   ═══════════════════════════════════════════════════════════ */

type ScoringPeriod = "daily" | "weekly" | "monthly" | "all_time";
type DriverTier = "platinum" | "gold" | "silver" | "bronze";
type TrendDirection = "up" | "down" | "stable";

interface DriverPerformance {
  id: string;
  rank: number;
  name: string;
  avatar?: string;
  compositeScore: number;
  tier: DriverTier;
  trendDirection: TrendDirection;
  trendPercent: number;
  onTimePercent: number;
  customerRating: number;
  podCompliance: number;
  deliveriesCount: number;
}

// ─── Helper Functions ──────────────────────────────────────

const getTierColor = (
  tier: DriverTier,
): "primary" | "warning" | "default" | "success" => {
  const tierMap: Record<
    DriverTier,
    "primary" | "warning" | "default" | "success"
  > = {
    platinum: "primary",
    gold: "warning",
    silver: "default",
    bronze: "warning",
  };
  return tierMap[tier];
};

const getTierBg = (tier: DriverTier): string => {
  const bgMap: Record<DriverTier, string> = {
    platinum: "bg-gradient-to-br from-purple-600 to-purple-800 text-white",
    gold: "bg-gradient-to-br from-amber-500 to-amber-700 text-white",
    silver: "bg-gradient-to-br from-gray-400 to-gray-600 text-white",
    bronze: "bg-gradient-to-br from-orange-500 to-orange-700 text-white",
  };
  return bgMap[tier];
};

const getTrendIndicator = (
  direction: TrendDirection,
  percent: number,
): string => {
  if (direction === "up") return `↑ +${percent}%`;
  if (direction === "down") return `↓ ${percent}%`;
  return "→ —";
};

const getTrendColor = (direction: TrendDirection): string => {
  if (direction === "up") return "text-wl-success-500";
  if (direction === "down") return "text-wl-danger-500";
  return "text-wl-text-secondary";
};

const formatRating = (rating: number): string => rating.toFixed(1);

// ─── Main Component ────────────────────────────────────────

export default function DriverPerformancePage() {
  const [period, setPeriod] = useState<ScoringPeriod>("weekly");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [selectedDriver, setSelectedDriver] =
    useState<DriverPerformance | null>(null);

  const {
    items: drivers,
    loading,
    error,
    refetch,
  } = useApiList<DriverPerformance>(
    `/api/v4/driver-scoring/leaderboard?period=${period}`,
  );

  // Calculate stats
  const topThree = drivers.slice(0, 3);
  const avgScore =
    drivers.length > 0
      ? (
          drivers.reduce((sum, d) => sum + d.compositeScore, 0) / drivers.length
        ).toFixed(1)
      : "0";
  const avgOnTime =
    drivers.length > 0
      ? (
          drivers.reduce((sum, d) => sum + d.onTimePercent, 0) / drivers.length
        ).toFixed(1)
      : "0";
  const totalDeliveries = drivers.reduce(
    (sum, d) => sum + d.deliveriesCount,
    0,
  );

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <ErrorState
        message={error?.message ?? "Failed to load driver performance"}
        onRetry={refetch}
      />
    );
  }

  return (
    <>
      <Header
        title="Driver Performance"
        subtitle={`${drivers.length} drivers tracked · Top performer: ${topThree[0]?.name ?? "N/A"}`}
        actions={
          <div className="flex gap-2">
            <div className="flex gap-1 border border-wl-border-default rounded-md p-0.5 bg-wl-bg-root">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5",
                  viewMode === "list"
                    ? "bg-wl-info-500 text-white"
                    : "text-wl-text-secondary hover:text-white",
                )}
              >
                <List className="w-3.5 h-3.5" /> List
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5",
                  viewMode === "map"
                    ? "bg-wl-info-500 text-white"
                    : "text-wl-text-secondary hover:text-white",
                )}
              >
                <MapIcon className="w-3.5 h-3.5" /> Map
              </button>
            </div>
            <Button variant="secondary" size="md">
              Export
            </Button>
            <Button variant="primary" size="md">
              Recalculate
            </Button>
          </div>
        }
      />

      <div className="p-6">
        {/* Period Selector */}
        <div className="flex gap-2 mb-6">
          {(["daily", "weekly", "monthly", "all_time"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-all duration-fast",
                period === p
                  ? "bg-wl-info-500 text-white"
                  : "bg-wl-bg-elevated text-wl-neutral-300 hover:text-white",
              )}
            >
              {p === "daily" && "Daily"}
              {p === "weekly" && "Weekly"}
              {p === "monthly" && "Monthly"}
              {p === "all_time" && "All Time"}
            </button>
          ))}
        </div>

        {!loading && drivers.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-center">
            <List className="w-10 h-10 text-wl-text-tertiary" />
            <p className="text-sm font-medium text-wl-text-secondary">
              No performance data for this period
            </p>
            <p className="text-xs text-wl-text-tertiary">
              Scores will appear once drivers complete deliveries
            </p>
            <Button variant="secondary" size="md" onClick={refetch}>
              Refresh
            </Button>
          </div>
        )}

        {!loading &&
          drivers.length > 0 &&
          (viewMode === "map" ? (
            <div className="h-[600px]">
              <DriverPerformanceMapView drivers={drivers} />
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-6">
                <StatCard
                  label="Average Score"
                  value={avgScore}
                  accentColor="var(--blue-500)"
                  index={0}
                />
                <StatCard
                  label="Avg On-Time %"
                  value={`${avgOnTime}%`}
                  accentColor="var(--emerald-500)"
                  index={1}
                />
                <StatCard
                  label="Total Deliveries"
                  value={totalDeliveries}
                  accentColor="var(--blue-500)"
                  index={2}
                />
                <StatCard
                  label="Top Tier Drivers"
                  value={
                    drivers.filter(
                      (d) => d.tier === "platinum" || d.tier === "gold",
                    ).length
                  }
                  accentColor="var(--amber-500)"
                  index={3}
                />
              </div>

              {/* Podium Section */}
              <Card className="mb-6 p-6">
                <h3 className="text-lg font-semibold text-wl-text-primary mb-4">
                  Top 3 Drivers
                </h3>
                <div className="flex gap-4 items-flex-end justify-center">
                  {/* Silver (2nd) */}
                  {topThree[1] && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-20 h-28 bg-gradient-to-br from-gray-400 to-gray-600 rounded-t-lg flex items-end justify-center pb-2">
                        <span className="text-xl font-bold text-white">2</span>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-white">
                          {topThree[1].name}
                        </p>
                        <p className="text-xs text-wl-neutral-300">
                          {topThree[1].compositeScore}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Gold (1st) */}
                  {topThree[0] && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-24 h-36 bg-gradient-to-br from-amber-500 to-amber-700 rounded-t-lg flex items-end justify-center pb-2 shadow-lg">
                        <span className="text-2xl font-bold text-white">
                          🏆
                        </span>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-white">
                          {topThree[0].name}
                        </p>
                        <p className="text-xs text-wl-neutral-300">
                          {topThree[0].compositeScore}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Bronze (3rd) */}
                  {topThree[2] && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-20 h-24 bg-gradient-to-br from-orange-500 to-orange-700 rounded-t-lg flex items-end justify-center pb-2">
                        <span className="text-xl font-bold text-white">3</span>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-white">
                          {topThree[2].name}
                        </p>
                        <p className="text-xs text-wl-neutral-300">
                          {topThree[2].compositeScore}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Leaderboard Table */}
              <Card className="overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-wl-border-default bg-wl-bg-elevated">
                        <th className="p-3 px-4 text-center font-semibold text-wl-neutral-300 w-12">
                          Rank
                        </th>
                        <th className="p-3 px-4 text-left font-semibold text-wl-neutral-300">
                          Driver Name
                        </th>
                        <th className="p-3 px-4 text-center font-semibold text-wl-neutral-300">
                          Composite Score
                        </th>
                        <th className="p-3 px-4 text-center font-semibold text-wl-neutral-300">
                          Tier
                        </th>
                        <th className="p-3 px-4 text-center font-semibold text-wl-neutral-300">
                          On-Time %
                        </th>
                        <th className="p-3 px-4 text-center font-semibold text-wl-neutral-300">
                          Rating
                        </th>
                        <th className="p-3 px-4 text-center font-semibold text-wl-neutral-300">
                          POD %
                        </th>
                        <th className="p-3 px-4 text-center font-semibold text-wl-neutral-300">
                          Trend
                        </th>
                        <th className="p-3 px-4 text-center font-semibold text-wl-neutral-300">
                          Deliveries
                        </th>
                        <th className="p-3 px-4 text-center font-semibold text-wl-neutral-300">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {drivers.map((driver, idx) => (
                        <tr
                          key={driver.id}
                          onClick={() => setSelectedDriver(driver)}
                          className={cn(
                            "border-b border-wl-border-default transition-colors duration-fast cursor-pointer",
                            idx % 2 === 0
                              ? "bg-transparent hover:bg-wl-bg-elevated/50"
                              : "bg-wl-bg-elevated hover:bg-wl-bg-surface",
                            selectedDriver?.id === driver.id &&
                              "bg-wl-bg-surface ring-1 ring-wl-info-500",
                          )}
                        >
                          <td className="p-3 px-4 text-center font-bold text-white">
                            #{driver.rank}
                          </td>
                          <td className="p-3 px-4 text-white font-semibold">
                            {driver.name}
                          </td>
                          <td className="p-3 px-4 text-center">
                            <span className="font-bold text-white">
                              {driver.compositeScore.toFixed(1)}
                            </span>
                            <span className="text-xs text-wl-text-secondary ml-1">
                              /100
                            </span>
                          </td>
                          <td className="p-3 px-4 text-center">
                            <Badge
                              variant={getTierColor(driver.tier)}
                              className="capitalize"
                            >
                              {driver.tier}
                            </Badge>
                          </td>
                          <td className="p-3 px-4 text-center text-white font-semibold">
                            {driver.onTimePercent.toFixed(1)}%
                          </td>
                          <td className="p-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-white font-semibold">
                                {formatRating(driver.customerRating)}
                              </span>
                              <span className="text-wl-neutral-300">⭐</span>
                            </div>
                          </td>
                          <td className="p-3 px-4 text-center text-white font-semibold">
                            {driver.podCompliance.toFixed(1)}%
                          </td>
                          <td
                            className={cn(
                              "p-3 px-4 text-center font-semibold",
                              getTrendColor(driver.trendDirection),
                            )}
                          >
                            {getTrendIndicator(
                              driver.trendDirection,
                              driver.trendPercent,
                            )}
                          </td>
                          <td className="p-3 px-4 text-center text-white font-semibold">
                            {driver.deliveriesCount}
                          </td>
                          <td className="p-3 px-4 text-center">
                            <Button variant="secondary" size="sm">
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Score Breakdown Chart for Selected Driver */}
              {selectedDriver && (
                <Card className="mt-6 p-6">
                  <h3 className="text-lg font-semibold text-wl-text-primary mb-4">
                    Score Breakdown: {selectedDriver.name}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {/* On-Time Score */}
                    <div className="flex flex-col items-center gap-3">
                      <div
                        className="relative w-24 h-24 rounded-full border-4 border-wl-border-default flex items-center justify-center"
                        style={{
                          background: `conic-gradient(var(--emerald-500) 0deg ${selectedDriver.onTimePercent * 3.6}deg, var(--wl-bg-overlay) ${selectedDriver.onTimePercent * 3.6}deg)`,
                        }}
                      >
                        <div className="w-20 h-20 rounded-full bg-wl-bg-surface flex items-center justify-center">
                          <span className="font-bold text-white">
                            {selectedDriver.onTimePercent.toFixed(0)}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-wl-neutral-300">
                        On-Time
                      </p>
                    </div>

                    {/* Rating Score */}
                    <div className="flex flex-col items-center gap-3">
                      <div
                        className="relative w-24 h-24 rounded-full border-4 border-wl-border-default flex items-center justify-center"
                        style={{
                          background: `conic-gradient(var(--blue-500) 0deg ${(selectedDriver.customerRating / 5) * 360}deg, var(--wl-bg-overlay) ${(selectedDriver.customerRating / 5) * 360}deg)`,
                        }}
                      >
                        <div className="w-20 h-20 rounded-full bg-wl-bg-surface flex items-center justify-center">
                          <span className="font-bold text-white">
                            {formatRating(selectedDriver.customerRating)}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-wl-neutral-300">
                        Rating
                      </p>
                    </div>

                    {/* POD Compliance */}
                    <div className="flex flex-col items-center gap-3">
                      <div
                        className="relative w-24 h-24 rounded-full border-4 border-wl-border-default flex items-center justify-center"
                        style={{
                          background: `conic-gradient(var(--amber-500) 0deg ${selectedDriver.podCompliance * 3.6}deg, var(--wl-bg-overlay) ${selectedDriver.podCompliance * 3.6}deg)`,
                        }}
                      >
                        <div className="w-20 h-20 rounded-full bg-wl-bg-surface flex items-center justify-center">
                          <span className="font-bold text-white">
                            {selectedDriver.podCompliance.toFixed(0)}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-wl-neutral-300">
                        POD %
                      </p>
                    </div>

                    {/* Deliveries */}
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-24 h-24 rounded-full border-4 border-wl-border-default flex items-center justify-center bg-wl-bg-elevated">
                        <span className="text-2xl font-bold text-white">
                          {selectedDriver.deliveriesCount}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-wl-neutral-300">
                        Deliveries
                      </p>
                    </div>

                    {/* Composite Score */}
                    <div className="flex flex-col items-center gap-3">
                      <div
                        className="relative w-24 h-24 rounded-full border-4 border-wl-border-default flex items-center justify-center"
                        style={{
                          background: `conic-gradient(var(--blue-500) 0deg ${selectedDriver.compositeScore * 3.6}deg, var(--wl-bg-overlay) ${selectedDriver.compositeScore * 3.6}deg)`,
                        }}
                      >
                        <div className="w-20 h-20 rounded-full bg-wl-bg-surface flex items-center justify-center flex-col">
                          <span className="font-bold text-white">
                            {selectedDriver.compositeScore.toFixed(0)}
                          </span>
                          <span className="text-xs text-wl-text-secondary">
                            /100
                          </span>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-wl-neutral-300">
                        Score
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </>
          ))}
      </div>
    </>
  );
}
