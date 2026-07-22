"use client";

import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import type { CO2TrackerProps } from "@witylogix/core/analytics";

/**
 * CO2 Tracker Component
 *
 * Displays carbon impact metrics with savings visualization,
 * target progress, and vehicle breakdown.
 */
export function CO2Tracker({ data, dateRange, isLoading, onExport }: CO2TrackerProps) {
  const savingsPercentage = useMemo(() => {
    if (!data.plannedTotal) return 0;
    return (data.savedTotal / data.plannedTotal) * 100;
  }, [data]);

  const targetProgress = useMemo(() => {
    if (!data.targetSavings) return 0;
    return (data.savedTotal / data.targetSavings) * 100;
  }, [data]);

  const avgDailySavings = useMemo(() => {
    if (!data.trend || data.trend.length === 0) return 0;
    const total = data.trend.reduce((sum, point) => sum + point.value, 0);
    return Math.round(total / data.trend.length);
  }, [data]);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>CO2 Impact Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-wl-text-secondary">
            Loading CO2 data...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>CO2 Impact Tracker</CardTitle>
            <p className="text-sm text-wl-text-secondary mt-1">
              Carbon footprint reduction from optimized routing
            </p>
          </div>
          <button
            onClick={onExport}
            className="p-2 hover:bg-wl-bg-elevated rounded-md transition-colors text-wl-text-secondary hover:text-wl-text-primary"
            title="Export CO2 data"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Main metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Planned CO2 */}
          <div className="p-4 bg-wl-bg-elevated rounded-lg border border-wl-neutral-800">
            <p className="text-xs text-wl-text-secondary uppercase tracking-wide mb-2">
              Planned Emissions
            </p>
            <p className="text-2xl font-bold text-wl-text-primary">
              {data.plannedTotal.toLocaleString()}
            </p>
            <p className="text-xs text-wl-text-secondary mt-1">kg CO2</p>
          </div>

          {/* Actual CO2 */}
          <div className="p-4 bg-wl-bg-elevated rounded-lg border border-wl-neutral-800">
            <p className="text-xs text-wl-text-secondary uppercase tracking-wide mb-2">
              Actual Emissions
            </p>
            <p className="text-2xl font-bold text-wl-info-400">
              {data.actualTotal.toLocaleString()}
            </p>
            <p className="text-xs text-wl-text-secondary mt-1">kg CO2</p>
          </div>

          {/* Savings */}
          <div className="p-4 bg-wl-bg-elevated rounded-lg border border-wl-neutral-800 border-wl-success-700">
            <p className="text-xs text-wl-text-secondary uppercase tracking-wide mb-2">
              Total Saved
            </p>
            <p className="text-2xl font-bold text-wl-success-400">
              {data.savedTotal.toLocaleString()}
            </p>
            <p className="text-xs text-wl-success-400 mt-1">{Math.round(savingsPercentage)}% reduction</p>
          </div>

          {/* Avg Daily */}
          <div className="p-4 bg-wl-bg-elevated rounded-lg border border-wl-neutral-800">
            <p className="text-xs text-wl-text-secondary uppercase tracking-wide mb-2">
              Avg Daily Savings
            </p>
            <p className="text-2xl font-bold text-wl-text-primary">{avgDailySavings}</p>
            <p className="text-xs text-wl-text-secondary mt-1">kg CO2/day</p>
          </div>
        </div>

        {/* Target progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-wl-text-primary">Target Progress</p>
              <p className="text-xs text-wl-text-secondary mt-1">
                {data.savedTotal.toLocaleString()} of {data.targetSavings.toLocaleString()} kg CO2
              </p>
            </div>
            <Badge variant={targetProgress >= 100 ? "success" : "info"} className="ml-2">
              {Math.round(targetProgress)}%
            </Badge>
          </div>
          <div className="w-full h-3 bg-wl-bg-elevated rounded-full overflow-hidden border border-wl-neutral-800">
            <div
              className={`h-full transition-all duration-300 ${
                targetProgress >= 100 ? "bg-wl-success-500" : "bg-wl-primary-500"
              }`}
              style={{ width: `${Math.min(targetProgress, 100)}%` }}
            />
          </div>
        </div>

        {/* Vehicle breakdown */}
        <div>
          <p className="text-sm font-semibold text-wl-text-primary mb-3">Savings by Vehicle Type</p>
          <div className="space-y-3">
            {data.vehicleBreakdown.map((vehicle, index) => (
              <div
                key={index}
                className="p-3 bg-wl-bg-elevated rounded-lg border border-wl-neutral-800"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-wl-text-primary">{vehicle.type}</span>
                  <span className="text-sm font-semibold text-wl-success-400">
                    {vehicle.savedCO2 > 0 ? "+" : ""}{vehicle.savedCO2.toLocaleString()} kg
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-wl-text-secondary">Planned</p>
                    <p className="text-wl-text-primary font-medium">
                      {vehicle.plannedCO2.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-wl-text-secondary">Actual</p>
                    <p className="text-wl-text-primary font-medium">
                      {vehicle.actualCO2.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-wl-text-secondary">Reduction</p>
                    <p className="text-wl-success-400 font-medium">
                      {vehicle.plannedCO2 > 0
                        ? Math.round((vehicle.savedCO2 / vehicle.plannedCO2) * 100)
                        : 0}
                      %
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
