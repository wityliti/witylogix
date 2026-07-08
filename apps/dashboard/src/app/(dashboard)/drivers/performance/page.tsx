"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApiQuery } from "@/hooks/use-api";
import { LoadingSkeleton, ErrorState } from "@/components/ui/loading";

/* ═══════════════════════════════════════════════════════════
   DRIVER PERFORMANCE LEADERBOARD
   Real data from /api/v4/driver-scoring/leaderboard
   ═══════════════════════════════════════════════════════════ */

type ScoringPeriod = "daily" | "weekly" | "monthly" | "all_time";
type DriverTier = "platinum" | "gold" | "silver" | "bronze";
type TrendDirection = "up" | "down" | "stable";

// API response shape from DriverLeaderboardEntry
interface LeaderboardEntry {
  driverId: string;
  tenantId: string;
  compositeScore: number;
  breakdown: {
    onTimeScore: number;
    customerRatingScore: number;
    podComplianceScore: number;
    routeEfficiencyScore: number;
    reliabilityScore: number;
  };
  tier: DriverTier;
  rank: number;
  trend: TrendDirection;
  previousScore: number | null;
  calculatedAt: string;
  driverName: string;
  avatar: string | null;
  deliveriesThisPeriod: number;
}

// ─── Mapped driver shape used by table/chart ───────────────
interface MappedDriver extends LeaderboardEntry {
  id: string;
  name: string;
  onTimePercent: number;
  customerRating: number;
  podCompliance: number;
  deliveriesCount: number;
  trendDirection: TrendDirection;
  trendPercent: number;
}

// ─── Helper Functions ──────────────────────────────────────

const formatRating = (rating: number): string => rating.toFixed(2);

const getTrendIndicator = (
  direction: TrendDirection,
  percent: number,
): string => {
  if (direction === "up") return `↑ ${percent.toFixed(1)}%`;
  if (direction === "down") return `↓ ${percent.toFixed(1)}%`;
  return "→";
};

const getTierColor = (
  tier: DriverTier,
): "primary" | "warning" | "default" | "success" => {
  const m: Record<DriverTier, "primary" | "warning" | "default" | "success"> = {
    platinum: "primary",
    gold: "warning",
    silver: "default",
    bronze: "warning",
  };
  return m[tier];
};

const getTrendLabel = (
  direction: TrendDirection,
  prev: number | null,
  current: number,
): string => {
  if (direction === "up" && prev !== null)
    return `↑ +${(current - prev).toFixed(1)}`;
  if (direction === "down" && prev !== null)
    return `↓ ${(current - prev).toFixed(1)}`;
  if (direction === "up") return "↑";
  if (direction === "down") return "↓";
  return "→";
};

const getTrendColor = (direction: TrendDirection): string => {
  if (direction === "up") return "text-emerald-400";
  if (direction === "down") return "text-red-400";
  return "text-gray-400";
};

const PERIOD_LABELS: Record<ScoringPeriod, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  all_time: "All Time",
};

// ─── Main Component ────────────────────────────────────────

export default function DriverPerformancePage() {
  const [period, setPeriod] = useState<ScoringPeriod>("weekly");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const {
    data: rawDrivers,
    loading,
    error,
    refetch,
  } = useApiQuery<LeaderboardEntry[]>(
    `/api/v4/driver-scoring/leaderboard?period=${period}&limit=100`,
  );

  const driverList = rawDrivers ?? [];

  const drivers: MappedDriver[] = driverList.map((d) => ({
    ...d,
    id: d.driverId,
    name: d.driverName,
    onTimePercent: d.breakdown.onTimeScore,
    customerRating: d.breakdown.customerRatingScore / 20, // 0-100 score → 0-5 rating
    podCompliance: d.breakdown.podComplianceScore,
    deliveriesCount: d.deliveriesThisPeriod,
    trendDirection: d.trend,
    trendPercent:
      d.previousScore != null
        ? Math.abs(d.compositeScore - d.previousScore)
        : 0,
  }));

  const setSelectedDriver = (driver: MappedDriver | null) =>
    setSelectedId(driver?.driverId ?? null);
  const selectedDriver = useMemo(
    () => drivers.find((d) => d.driverId === selectedId) ?? null,
    [drivers, selectedId],
  );

  const topThree = drivers.slice(0, 3);

  const avgScore = useMemo(
    () =>
      driverList.length > 0
        ? (
            driverList.reduce((s, d) => s + d.compositeScore, 0) /
            driverList.length
          ).toFixed(1)
        : "—",
    [driverList],
  );

  const avgOnTime = useMemo(
    () =>
      driverList.length > 0
        ? (
            driverList.reduce((s, d) => s + d.breakdown.onTimeScore, 0) /
            driverList.length
          ).toFixed(1)
        : "—",
    [driverList],
  );

  const totalDeliveries = useMemo(
    () => driverList.reduce((s, d) => s + d.deliveriesThisPeriod, 0),
    [driverList],
  );

  const topTierCount = useMemo(
    () =>
      driverList.filter((d) => d.tier === "platinum" || d.tier === "gold")
        .length,
    [driverList],
  );

  if (loading) return <LoadingSkeleton />;
  if (error)
    return (
      <ErrorState
        message={error?.message ?? "Failed to load driver performance"}
        onRetry={refetch}
      />
    );

  return (
    <>
      <Header
        title="Driver Performance"
        subtitle={`${driverList.length} drivers · ${PERIOD_LABELS[period]} · Top: ${topThree[0]?.driverName ?? "—"}`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="md" onClick={refetch}>
              Refresh
            </Button>
          </div>
        }
      />

      <div className="p-6">
        {/* Period Selector */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(["daily", "weekly", "monthly", "all_time"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                period === p
                  ? "bg-blue-500 text-white"
                  : "bg-wl-bg-elevated text-gray-300 hover:text-white",
              )}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

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
              drivers.filter((d) => d.tier === "platinum" || d.tier === "gold")
                .length
            }
            accentColor="var(--amber-500)"
            index={3}
          />
        </div>

        {/* Empty state */}
        {driverList.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-sm text-white/30">
              No driver performance data for this period
            </p>
            <Button variant="secondary" size="sm" onClick={refetch}>
              Refresh
            </Button>
          </div>
        )}

        {/* Podium */}
        {topThree.length > 0 && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Top 3 Drivers
              </h3>
              <div className="flex gap-4 items-end justify-center flex-wrap">
                {topThree[1] && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-20 h-28 bg-gradient-to-br from-gray-400 to-gray-600 rounded-t-lg flex items-end justify-center pb-2">
                      <span className="text-xl font-bold text-white">2</span>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white">
                        {topThree[1].driverName}
                      </p>
                      <p className="text-xs text-gray-300">
                        {topThree[1].compositeScore.toFixed(1)}
                      </p>
                    </div>
                  </div>
                )}
                {topThree[0] && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-24 h-36 bg-gradient-to-br from-amber-500 to-amber-700 rounded-t-lg flex items-end justify-center pb-2 shadow-lg">
                      <span className="text-2xl font-bold text-white">🏆</span>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white">
                        {topThree[0].driverName}
                      </p>
                      <p className="text-xs text-gray-300">
                        {topThree[0].compositeScore.toFixed(1)}
                      </p>
                    </div>
                  </div>
                )}
                {topThree[2] && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-20 h-24 bg-gradient-to-br from-orange-500 to-orange-700 rounded-t-lg flex items-end justify-center pb-2">
                      <span className="text-xl font-bold text-white">3</span>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white">
                        {topThree[2].driverName}
                      </p>
                      <p className="text-xs text-gray-300">
                        {topThree[2].compositeScore.toFixed(1)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Leaderboard Table */}
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-wl-border-default bg-wl-bg-elevated">
                  <th className="p-3 px-4 text-center font-semibold text-gray-300 w-12">
                    Rank
                  </th>
                  <th className="p-3 px-4 text-left font-semibold text-gray-300">
                    Driver Name
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-300">
                    Composite Score
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-300">
                    Tier
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-300">
                    On-Time %
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-300">
                    Rating
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-300">
                    POD %
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-300">
                    Trend
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-300">
                    Deliveries
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-gray-300">
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
                        "bg-wl-bg-surface ring-1 ring-blue-500",
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
                      <span className="text-xs text-gray-400 ml-1">/100</span>
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
                        <span className="text-gray-300">⭐</span>
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
            <h3 className="text-lg font-semibold text-white mb-4">
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
                <p className="text-sm font-semibold text-gray-300">On-Time</p>
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
                <p className="text-sm font-semibold text-gray-300">Rating</p>
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
                <p className="text-sm font-semibold text-gray-300">POD %</p>
              </div>

              {/* Deliveries */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-24 h-24 rounded-full border-4 border-wl-border-default flex items-center justify-center bg-wl-bg-elevated">
                  <span className="text-2xl font-bold text-white">
                    {selectedDriver.deliveriesCount}
                  </span>
                </div>
                <p className="text-sm font-semibold text-gray-300">
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
                    <span className="text-xs text-gray-400">/100</span>
                  </div>
                </div>
                <p className="text-sm font-semibold text-gray-300">Score</p>
              </div>
            </div>
          </Card>
        )}

        {/* Score Breakdown for Selected Driver */}
        {selectedDriver && (
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Score Breakdown — {selectedDriver.driverName}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {[
                  {
                    label: "On-Time",
                    value: selectedDriver.breakdown.onTimeScore,
                    color: "#34d399",
                  },
                  {
                    label: "Rating",
                    value: selectedDriver.breakdown.customerRatingScore,
                    color: "#fbbf24",
                  },
                  {
                    label: "POD",
                    value: selectedDriver.breakdown.podComplianceScore,
                    color: "#60a5fa",
                  },
                  {
                    label: "Efficiency",
                    value: selectedDriver.breakdown.routeEfficiencyScore,
                    color: "#818cf8",
                  },
                  {
                    label: "Reliability",
                    value: selectedDriver.breakdown.reliabilityScore,
                    color: "#a78bfa",
                  },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex flex-col items-center gap-3">
                    <div
                      className="relative w-20 h-20 rounded-full flex items-center justify-center"
                      style={{
                        background: `conic-gradient(${color} 0deg ${value * 3.6}deg, rgba(255,255,255,0.05) ${value * 3.6}deg)`,
                      }}
                    >
                      <div className="w-16 h-16 rounded-full bg-[#12121a] flex items-center justify-center">
                        <span className="font-bold text-white text-sm">
                          {value.toFixed(0)}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-gray-300">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
