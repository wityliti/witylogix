"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

const DRIVER_LEADERBOARD: DriverPerformance[] = [
  {
    id: "drv-001",
    rank: 1,
    name: "Sarah Chen",
    compositeScore: 98.5,
    tier: "platinum",
    trendDirection: "up",
    trendPercent: 3.2,
    onTimePercent: 99.2,
    customerRating: 4.9,
    podCompliance: 99.8,
    deliveriesCount: 342,
  },
  {
    id: "drv-002",
    rank: 2,
    name: "Marcus Johnson",
    compositeScore: 96.2,
    tier: "platinum",
    trendDirection: "up",
    trendPercent: 2.1,
    onTimePercent: 97.8,
    customerRating: 4.8,
    podCompliance: 98.5,
    deliveriesCount: 318,
  },
  {
    id: "drv-003",
    rank: 3,
    name: "Elena Rodriguez",
    compositeScore: 94.8,
    tier: "gold",
    trendDirection: "stable",
    trendPercent: 0.5,
    onTimePercent: 96.5,
    customerRating: 4.7,
    podCompliance: 97.2,
    deliveriesCount: 295,
  },
  {
    id: "drv-004",
    rank: 4,
    name: "James Liu",
    compositeScore: 92.1,
    tier: "gold",
    trendDirection: "up",
    trendPercent: 1.8,
    onTimePercent: 94.2,
    customerRating: 4.6,
    podCompliance: 95.8,
    deliveriesCount: 267,
  },
  {
    id: "drv-005",
    rank: 5,
    name: "Priya Kapoor",
    compositeScore: 90.3,
    tier: "gold",
    trendDirection: "down",
    trendPercent: -1.2,
    onTimePercent: 92.1,
    customerRating: 4.5,
    podCompliance: 94.3,
    deliveriesCount: 248,
  },
  {
    id: "drv-006",
    rank: 6,
    name: "Michael Torres",
    compositeScore: 88.7,
    tier: "silver",
    trendDirection: "up",
    trendPercent: 2.3,
    onTimePercent: 90.5,
    customerRating: 4.4,
    podCompliance: 92.1,
    deliveriesCount: 231,
  },
  {
    id: "drv-007",
    rank: 7,
    name: "Yuki Tanaka",
    compositeScore: 87.2,
    tier: "silver",
    trendDirection: "stable",
    trendPercent: 0.1,
    onTimePercent: 88.9,
    customerRating: 4.3,
    podCompliance: 90.7,
    deliveriesCount: 219,
  },
  {
    id: "drv-008",
    rank: 8,
    name: "Carlos Martinez",
    compositeScore: 85.9,
    tier: "silver",
    trendDirection: "down",
    trendPercent: -2.1,
    onTimePercent: 87.3,
    customerRating: 4.2,
    podCompliance: 89.2,
    deliveriesCount: 203,
  },
  {
    id: "drv-009",
    rank: 9,
    name: "Jessica Williams",
    compositeScore: 83.4,
    tier: "bronze",
    trendDirection: "up",
    trendPercent: 3.5,
    onTimePercent: 85.1,
    customerRating: 4.1,
    podCompliance: 87.5,
    deliveriesCount: 187,
  },
  {
    id: "drv-010",
    rank: 10,
    name: "David Kim",
    compositeScore: 81.6,
    tier: "bronze",
    trendDirection: "down",
    trendPercent: -1.8,
    onTimePercent: 83.2,
    customerRating: 4.0,
    podCompliance: 85.8,
    deliveriesCount: 172,
  },
  {
    id: "drv-011",
    rank: 11,
    name: "Olivia Martin",
    compositeScore: 79.8,
    tier: "bronze",
    trendDirection: "stable",
    trendPercent: 0.3,
    onTimePercent: 81.5,
    customerRating: 3.9,
    podCompliance: 84.1,
    deliveriesCount: 156,
  },
  {
    id: "drv-012",
    rank: 12,
    name: "Robert Anderson",
    compositeScore: 77.5,
    tier: "bronze",
    trendDirection: "down",
    trendPercent: -2.4,
    onTimePercent: 79.2,
    customerRating: 3.8,
    podCompliance: 82.3,
    deliveriesCount: 141,
  },
  {
    id: "drv-013",
    rank: 13,
    name: "Emma Thompson",
    compositeScore: 75.2,
    tier: "bronze",
    trendDirection: "up",
    trendPercent: 1.5,
    onTimePercent: 77.8,
    customerRating: 3.7,
    podCompliance: 80.5,
    deliveriesCount: 128,
  },
  {
    id: "drv-014",
    rank: 14,
    name: "Alexander Petrov",
    compositeScore: 73.1,
    tier: "bronze",
    trendDirection: "down",
    trendPercent: -3.2,
    onTimePercent: 75.3,
    customerRating: 3.6,
    podCompliance: 78.7,
    deliveriesCount: 115,
  },
  {
    id: "drv-015",
    rank: 15,
    name: "Lisa Zhang",
    compositeScore: 71.4,
    tier: "bronze",
    trendDirection: "stable",
    trendPercent: 0.0,
    onTimePercent: 73.5,
    customerRating: 3.5,
    podCompliance: 76.9,
    deliveriesCount: 102,
  },
];

// ─── Helper Functions ──────────────────────────────────────

const getTierColor = (tier: DriverTier): "primary" | "warning" | "default" | "success" => {
  const tierMap: Record<DriverTier, "primary" | "warning" | "default" | "success"> = {
    platinum: "primary",
    gold: "warning",
    silver: "default",
    bronze: "info",
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

const getTrendIndicator = (direction: TrendDirection, percent: number): string => {
  if (direction === "up") return `↑ +${percent}%`;
  if (direction === "down") return `↓ ${percent}%`;
  return "→ —";
};

const getTrendColor = (direction: TrendDirection): string => {
  if (direction === "up") return "text-wl-success-400";
  if (direction === "down") return "text-wl-danger-400";
  return "text-wl-text-tertiary";
};

const formatRating = (rating: number): string => rating.toFixed(1);

// ─── Main Component ────────────────────────────────────────

export default function DriverPerformancePage() {
  const [period, setPeriod] = useState<ScoringPeriod>("weekly");
  const [selectedDriver, setSelectedDriver] = useState<DriverPerformance | null>(
    DRIVER_LEADERBOARD[0] || null
  );

  // Calculate stats
  const topThree = DRIVER_LEADERBOARD.slice(0, 3);
  const avgScore =
    DRIVER_LEADERBOARD.length > 0
      ? (DRIVER_LEADERBOARD.reduce((sum, d) => sum + d.compositeScore, 0) / DRIVER_LEADERBOARD.length).toFixed(1)
      : "0";
  const avgOnTime =
    DRIVER_LEADERBOARD.length > 0
      ? (DRIVER_LEADERBOARD.reduce((sum, d) => sum + d.onTimePercent, 0) / DRIVER_LEADERBOARD.length).toFixed(1)
      : "0";
  const totalDeliveries = DRIVER_LEADERBOARD.reduce((sum, d) => sum + d.deliveriesCount, 0);

  return (
    <>
      <Header
        title="Driver Performance"
        subtitle={`${DRIVER_LEADERBOARD.length} drivers tracked · Top performer: ${topThree[0]?.name}`}
        actions={
          <div className="flex gap-2">
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
                  ? "bg-wl-primary-500 text-wl-text-inverse"
                  : "bg-wl-bg-overlay text-wl-text-secondary hover:text-wl-text-primary"
              )}
            >
              {p === "daily" && "Daily"}
              {p === "weekly" && "Weekly"}
              {p === "monthly" && "Monthly"}
              {p === "all_time" && "All Time"}
            </button>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mb-6">
          <StatCard
            label="Average Score"
            value={avgScore}
            change={{ value: 2.1, label: "vs last period" }}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Avg On-Time %"
            value={`${avgOnTime}%`}
            change={{ value: 1.3, label: "vs last period" }}
            accentColor="var(--wl-success-400)"
            index={1}
          />
          <StatCard
            label="Total Deliveries"
            value={totalDeliveries}
            change={{ value: 8.5, label: "this period" }}
            accentColor="var(--wl-info-400)"
            index={2}
          />
          <StatCard
            label="Top Tier Drivers"
            value={DRIVER_LEADERBOARD.filter((d) => d.tier === "platinum" || d.tier === "gold").length}
            change={{ value: 0.5, label: "vs last period" }}
            accentColor="var(--wl-warning-400)"
            index={3}
          />
        </div>

        {/* Podium Section */}
        <Card className="mb-6 p-6">
          <h3 className="text-lg font-semibold text-wl-text-primary mb-4">Top 3 Drivers</h3>
          <div className="flex gap-4 items-flex-end justify-center">
            {/* Silver (2nd) */}
            {topThree[1] && (
              <div className="flex flex-col items-center gap-2">
                <div className="w-20 h-28 bg-gradient-to-br from-gray-400 to-gray-600 rounded-t-lg flex items-end justify-center pb-2">
                  <span className="text-xl font-bold text-white">2</span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-wl-text-primary">{topThree[1].name}</p>
                  <p className="text-xs text-wl-text-secondary">{topThree[1].compositeScore}</p>
                </div>
              </div>
            )}

            {/* Gold (1st) */}
            {topThree[0] && (
              <div className="flex flex-col items-center gap-2">
                <div className="w-24 h-36 bg-gradient-to-br from-amber-500 to-amber-700 rounded-t-lg flex items-end justify-center pb-2 shadow-lg">
                  <span className="text-2xl font-bold text-white">🏆</span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-wl-text-primary">{topThree[0].name}</p>
                  <p className="text-xs text-wl-text-secondary">{topThree[0].compositeScore}</p>
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
                  <p className="text-sm font-semibold text-wl-text-primary">{topThree[2].name}</p>
                  <p className="text-xs text-wl-text-secondary">{topThree[2].compositeScore}</p>
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
                <tr className="border-b border-wl-border-subtle bg-wl-bg-overlay">
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary w-12">
                    Rank
                  </th>
                  <th className="p-3 px-4 text-left font-semibold text-wl-text-secondary">
                    Driver Name
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                    Composite Score
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                    Tier
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                    On-Time %
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                    Rating
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                    POD %
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                    Trend
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                    Deliveries
                  </th>
                  <th className="p-3 px-4 text-center font-semibold text-wl-text-secondary">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {DRIVER_LEADERBOARD.map((driver, idx) => (
                  <tr
                    key={driver.id}
                    onClick={() => setSelectedDriver(driver)}
                    className={cn(
                      "border-b border-wl-border-subtle transition-colors duration-fast cursor-pointer",
                      idx % 2 === 0 ? "bg-transparent hover:bg-wl-bg-overlay/50" : "bg-wl-bg-overlay hover:bg-wl-bg-elevated",
                      selectedDriver?.id === driver.id && "bg-wl-bg-elevated ring-1 ring-wl-primary-500"
                    )}
                  >
                    <td className="p-3 px-4 text-center font-bold text-wl-text-primary">
                      #{driver.rank}
                    </td>
                    <td className="p-3 px-4 text-wl-text-primary font-semibold">
                      {driver.name}
                    </td>
                    <td className="p-3 px-4 text-center">
                      <span className="font-bold text-wl-text-primary">
                        {driver.compositeScore.toFixed(1)}
                      </span>
                      <span className="text-xs text-wl-text-tertiary ml-1">/100</span>
                    </td>
                    <td className="p-3 px-4 text-center">
                      <Badge variant={getTierColor(driver.tier)} className="capitalize">
                        {driver.tier}
                      </Badge>
                    </td>
                    <td className="p-3 px-4 text-center text-wl-text-primary font-semibold">
                      {driver.onTimePercent.toFixed(1)}%
                    </td>
                    <td className="p-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-wl-text-primary font-semibold">
                          {formatRating(driver.customerRating)}
                        </span>
                        <span className="text-wl-text-secondary">⭐</span>
                      </div>
                    </td>
                    <td className="p-3 px-4 text-center text-wl-text-primary font-semibold">
                      {driver.podCompliance.toFixed(1)}%
                    </td>
                    <td className={cn("p-3 px-4 text-center font-semibold", getTrendColor(driver.trendDirection))}>
                      {getTrendIndicator(driver.trendDirection, driver.trendPercent)}
                    </td>
                    <td className="p-3 px-4 text-center text-wl-text-primary font-semibold">
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
                <div className="relative w-24 h-24 rounded-full border-4 border-wl-border-subtle flex items-center justify-center"
                  style={{
                    background: `conic-gradient(var(--wl-success-400) 0deg ${selectedDriver.onTimePercent * 3.6}deg, var(--wl-bg-overlay) ${selectedDriver.onTimePercent * 3.6}deg)`,
                  }}
                >
                  <div className="w-20 h-20 rounded-full bg-wl-bg-surface flex items-center justify-center">
                    <span className="font-bold text-wl-text-primary">{selectedDriver.onTimePercent.toFixed(0)}</span>
                  </div>
                </div>
                <p className="text-sm font-semibold text-wl-text-secondary">On-Time</p>
              </div>

              {/* Rating Score */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-24 h-24 rounded-full border-4 border-wl-border-subtle flex items-center justify-center"
                  style={{
                    background: `conic-gradient(var(--wl-primary-500) 0deg ${(selectedDriver.customerRating / 5) * 360}deg, var(--wl-bg-overlay) ${(selectedDriver.customerRating / 5) * 360}deg)`,
                  }}
                >
                  <div className="w-20 h-20 rounded-full bg-wl-bg-surface flex items-center justify-center">
                    <span className="font-bold text-wl-text-primary">{formatRating(selectedDriver.customerRating)}</span>
                  </div>
                </div>
                <p className="text-sm font-semibold text-wl-text-secondary">Rating</p>
              </div>

              {/* POD Compliance */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-24 h-24 rounded-full border-4 border-wl-border-subtle flex items-center justify-center"
                  style={{
                    background: `conic-gradient(var(--wl-warning-400) 0deg ${selectedDriver.podCompliance * 3.6}deg, var(--wl-bg-overlay) ${selectedDriver.podCompliance * 3.6}deg)`,
                  }}
                >
                  <div className="w-20 h-20 rounded-full bg-wl-bg-surface flex items-center justify-center">
                    <span className="font-bold text-wl-text-primary">{selectedDriver.podCompliance.toFixed(0)}</span>
                  </div>
                </div>
                <p className="text-sm font-semibold text-wl-text-secondary">POD %</p>
              </div>

              {/* Deliveries */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-24 h-24 rounded-full border-4 border-wl-border-subtle flex items-center justify-center bg-wl-bg-overlay">
                  <span className="text-2xl font-bold text-wl-text-primary">{selectedDriver.deliveriesCount}</span>
                </div>
                <p className="text-sm font-semibold text-wl-text-secondary">Deliveries</p>
              </div>

              {/* Composite Score */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-24 h-24 rounded-full border-4 border-wl-border-subtle flex items-center justify-center"
                  style={{
                    background: `conic-gradient(var(--wl-info-400) 0deg ${selectedDriver.compositeScore * 3.6}deg, var(--wl-bg-overlay) ${selectedDriver.compositeScore * 3.6}deg)`,
                  }}
                >
                  <div className="w-20 h-20 rounded-full bg-wl-bg-surface flex items-center justify-center flex-col">
                    <span className="font-bold text-wl-text-primary">{selectedDriver.compositeScore.toFixed(0)}</span>
                    <span className="text-xs text-wl-text-tertiary">/100</span>
                  </div>
                </div>
                <p className="text-sm font-semibold text-wl-text-secondary">Score</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
