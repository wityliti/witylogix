"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlannedActualChart } from "./components/planned-actual-chart";
import { DriverLeaderboard } from "./components/driver-leaderboard";
import { EfficiencyHeatmap } from "./components/efficiency-heatmap";
import { CO2Tracker } from "./components/co2-tracker";
import { SLACompliance } from "./components/sla-compliance";
import type {
  RoutePerformanceSummary,
  PlannedVsActualDataPoint,
  DriverLeaderboardEntry,
  EfficiencyHeatmapCell,
  CO2TrackerData,
  SLAComplianceData,
} from "@witylogix/core/analytics";

/**
 * Route Performance Analytics Dashboard
 *
 * Planned-vs-Actual Analytics Dashboard for Sprint 4.6
 * Benchmarking against Route4Me and Routific with comprehensive
 * metrics on delivery efficiency, driver performance, and SLA compliance.
 */

// Mock API functions (in production, these would call actual endpoints)
async function fetchSummaryMetrics(): Promise<RoutePerformanceSummary> {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 300));
  return {
    onTimePercentage: 94.3,
    avgDeliveryTime: 24,
    co2Savings: 1250,
    slaCompliance: 92.8,
    totalDeliveries: 3853,
    period: "30d",
  };
}

async function fetchPlannedVsActualData(): Promise<PlannedVsActualDataPoint[]> {
  await new Promise(resolve => setTimeout(resolve, 300));
  const data: PlannedVsActualDataPoint[] = [];
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      timestamp: date.toISOString().split("T")[0],
      plannedDuration: Math.round(115 + Math.random() * 20),
      actualDuration: Math.round(120 + Math.random() * 25),
      variance: Math.round(5 + Math.random() * 15),
      onTimePercentage: Math.round(90 + Math.random() * 8),
      deliveryCount: Math.round(15 + Math.random() * 20),
    });
  }
  return data;
}

async function fetchDriverLeaderboard(): Promise<DriverLeaderboardEntry[]> {
  await new Promise(resolve => setTimeout(resolve, 300));
  const drivers = [
    { name: "Priya Patel", avatar: "https://i.pravatar.cc/150?img=1" },
    { name: "Ahmed Khalil", avatar: "https://i.pravatar.cc/150?img=2" },
    { name: "Carlos Martinez", avatar: "https://i.pravatar.cc/150?img=3" },
    { name: "Sofia Lindberg", avatar: "https://i.pravatar.cc/150?img=4" },
    { name: "Marcus Johnson", avatar: "https://i.pravatar.cc/150?img=5" },
    { name: "Lisa Thompson", avatar: "https://i.pravatar.cc/150?img=6" },
    { name: "David Chen", avatar: "https://i.pravatar.cc/150?img=7" },
    { name: "Isabella Rodriguez", avatar: "https://i.pravatar.cc/150?img=8" },
  ];

  return drivers.map((driver, index) => ({
    rank: index + 1,
    driverId: `driver-${index + 1}`,
    driverName: driver.name,
    driverAvatarUrl: driver.avatar,
    deliveriesCompleted: Math.round(450 - index * 20),
    onTimePercentage: Math.round(9800 - index * 150) / 100,
    avgTimePerStop: Math.round((19 + index * 1.2) * 10) / 10,
    customerRatingAvg: Math.round((4.9 - index * 0.08) * 100) / 100,
    firstAttemptRate: Math.round(9750 - index * 100) / 100,
    compositeScore: Math.round((95 - index * 2) * 100) / 100,
    trend: ["up", "neutral", "down"][Math.floor(Math.random() * 3)] as "up" | "neutral" | "down",
    trendValue: Math.round((Math.random() - 0.5) * 10 * 100) / 100,
  }));
}

async function fetchEfficiencyHeatmap(): Promise<EfficiencyHeatmapCell[]> {
  await new Promise(resolve => setTimeout(resolve, 300));
  const data: EfficiencyHeatmapCell[] = [];
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const baseEfficiency = hour >= 8 && hour <= 18 ? 85 : 65;
      const randomVariation = Math.round(Math.random() * 20 - 10);

      data.push({
        dayOfWeek: day as any,
        dayName: dayNames[day],
        hour,
        efficiency: Math.max(50, Math.min(100, baseEfficiency + randomVariation)),
        deliveryCount: Math.round(Math.random() * 30 + 5),
        avgTimeVariance: Math.round(Math.random() * 20 - 10),
      });
    }
  }
  return data;
}

async function fetchCO2Data(): Promise<CO2TrackerData> {
  await new Promise(resolve => setTimeout(resolve, 300));
  const trend = [];
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    trend.push({
      date: date.toISOString().split("T")[0],
      value: Math.round(450 + Math.random() * 100),
    });
  }

  return {
    plannedTotal: 12450,
    actualTotal: 12100,
    savedTotal: 350,
    targetSavings: 500,
    trend,
    vehicleBreakdown: [
      { type: "Van", plannedCO2: 7800, actualCO2: 7450, savedCO2: 350 },
      { type: "Truck (Small)", plannedCO2: 3200, actualCO2: 3100, savedCO2: 100 },
      { type: "Motorcycle", plannedCO2: 1450, actualCO2: 1550, savedCO2: -100 },
    ],
  };
}

async function fetchSLACompliance(): Promise<SLAComplianceData> {
  await new Promise(resolve => setTimeout(resolve, 300));
  const trend = [];
  const now = new Date();

  for (let i = 13; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    trend.push({
      date: date.toISOString().split("T")[0],
      overall: Math.round(9200 + Math.random() * 600) / 100,
      premium: Math.round(9700 + Math.random() * 300) / 100,
      standard: Math.round(9300 + Math.random() * 400) / 100,
      economy: Math.round(8800 + Math.random() * 800) / 100,
    });
  }

  return {
    overall: 92.3,
    byTier: {
      premium: { percentage: 97.8, count: 1245 },
      standard: { percentage: 93.2, count: 3421 },
      economy: { percentage: 88.5, count: 2187 },
    },
    trend,
  };
}

export default function RoutePerformancePage() {
  const [period, setPeriod] = useState<"24h" | "7d" | "30d">("30d");
  const [isLoading, setIsLoading] = useState(true);

  // Summary metrics
  const [summary, setSummary] = useState<RoutePerformanceSummary | null>(null);

  // Chart data
  const [plannedVsActual, setPlannedVsActual] = useState<PlannedVsActualDataPoint[]>([]);
  const [drivers, setDrivers] = useState<DriverLeaderboardEntry[]>([]);
  const [heatmap, setHeatmap] = useState<EfficiencyHeatmapCell[]>([]);
  const [co2, setCO2] = useState<CO2TrackerData | null>(null);
  const [sla, setSLA] = useState<SLAComplianceData | null>(null);

  // Load all data on mount and when period changes
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [summaryData, pvaData, driversData, heatmapData, co2Data, slaData] =
          await Promise.all([
            fetchSummaryMetrics(),
            fetchPlannedVsActualData(),
            fetchDriverLeaderboard(),
            fetchEfficiencyHeatmap(),
            fetchCO2Data(),
            fetchSLACompliance(),
          ]);

        setSummary(summaryData);
        setPlannedVsActual(pvaData);
        setDrivers(driversData);
        setHeatmap(heatmapData);
        setCO2(co2Data);
        setSLA(slaData);
      } catch (error) {
        console.error("Error loading analytics data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [period]);

  const dateRange = {
    from: new Date(Date.now() - (period === "24h" ? 1 : period === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000),
    to: new Date(),
  };

  const KPI = [
    {
      label: "On-Time Rate",
      value: summary?.onTimePercentage.toFixed(1) ?? "—",
      unit: "%",
      change: { value: 2.1, label: "improvement" },
      accentColor: "var(--wl-success-400)",
    },
    {
      label: "Avg Delivery Time",
      value: summary?.avgDeliveryTime ?? "—",
      unit: "m",
      change: { value: -3.2, label: "faster" },
      accentColor: "var(--wl-info-400)",
    },
    {
      label: "CO2 Saved",
      value: summary?.co2Savings ?? "—",
      unit: "kg",
      change: { value: 18.5, label: "vs target" },
      accentColor: "var(--wl-success-500)",
    },
    {
      label: "SLA Compliance",
      value: summary?.slaCompliance.toFixed(1) ?? "—",
      unit: "%",
      change: { value: 1.8, label: "improvement" },
      accentColor: "var(--wl-primary-400)",
    },
  ];

  return (
    <>
      <Header title="Route Performance Analytics" />

      <div className={cn("min-h-screen bg-wl-bg-root")}>
        <div className={cn("max-w-full px-6 py-6")}>
          {/* Period selector */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-wl-text-primary">
              Planned vs Actual Analytics
            </h2>
            <div className="flex gap-2">
              {["24h", "7d", "30d"].map(p => (
                <Button
                  key={p}
                  variant={period === p ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setPeriod(p as any)}
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>

          {/* KPI Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {KPI.map((kpi, idx) => (
              <StatCard
                key={idx}
                label={kpi.label}
                value={`${kpi.value}${kpi.unit}`}
                change={kpi.change}
                accentColor={kpi.accentColor}
              />
            ))}
          </div>

          {/* Main charts grid */}
          <div className="space-y-8">
            {/* Planned vs Actual Chart */}
            <PlannedActualChart
              data={plannedVsActual}
              dateRange={dateRange}
              isLoading={isLoading}
            />

            {/* Driver Leaderboard & Efficiency Heatmap */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <DriverLeaderboard
                data={drivers}
                dateRange={dateRange}
                period={period}
                onPeriodChange={setPeriod}
                isLoading={isLoading}
              />
              <EfficiencyHeatmap data={heatmap} dateRange={dateRange} isLoading={isLoading} />
            </div>

            {/* CO2 & SLA Compliance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {co2 && <CO2Tracker data={co2} dateRange={dateRange} isLoading={isLoading} />}
              {sla && <SLACompliance data={sla} dateRange={dateRange} isLoading={isLoading} />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
