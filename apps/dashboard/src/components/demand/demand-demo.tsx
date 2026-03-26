"use client";

import { useState } from "react";
import { ZoneHeatmap } from "./zone-heatmap";
import { DemandForecastChart } from "./demand-forecast-chart";
import { CapacityBarChart } from "./capacity-bar-chart";
import { ScheduleGrid } from "./schedule-grid";
import type {
  ZoneHeatmapData,
  DemandForecastData,
  CapacityData,
  DriverScheduleSlot,
} from "./types";

/**
 * Demand visualization demo component
 * Shows all demand components with mock data
 */
export function DemandDemo() {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  // Mock zone heatmap data
  const zoneHeatmapData: ZoneHeatmapData[] = [
    {
      zone: { id: "z1", name: "Downtown", latitude: 40.7128, longitude: -74.006 },
      predictedDemand: 850,
      confidence: 0.92,
      historicalAverage: 780,
    },
    {
      zone: { id: "z2", name: "Midtown", latitude: 40.753, longitude: -73.9855 },
      predictedDemand: 1200,
      confidence: 0.88,
      historicalAverage: 950,
    },
    {
      zone: { id: "z3", name: "Uptown", latitude: 40.7829, longitude: -73.9654 },
      predictedDemand: 620,
      confidence: 0.85,
      historicalAverage: 650,
    },
    {
      zone: { id: "z4", name: "West Side", latitude: 40.7505, longitude: -74.0029 },
      predictedDemand: 950,
      confidence: 0.9,
      historicalAverage: 880,
    },
    {
      zone: { id: "z5", name: "East Side", latitude: 40.7614, longitude: -73.9776 },
      predictedDemand: 1050,
      confidence: 0.87,
      historicalAverage: 920,
    },
    {
      zone: { id: "z6", name: "Financial", latitude: 40.7074, longitude: -74.0113 },
      predictedDemand: 1450,
      confidence: 0.93,
      historicalAverage: 1380,
    },
  ];

  // Mock demand forecast data
  const demandForecastData: DemandForecastData[] = Array.from({ length: 24 }, (_, i) => {
    const now = new Date();
    const timestamp = new Date(now.getTime() + i * 3600000);
    const baseValue = 800 + Math.sin(i / 4) * 300 + Math.random() * 200;
    const predicted = Math.round(baseValue);
    const actual = i < 12 ? Math.round(baseValue + (Math.random() - 0.5) * 150) : undefined;
    const anomaly = i === 8 || i === 15;

    return {
      timestamp,
      predicted,
      actual,
      confidence: 0.75 + Math.random() * 0.2,
      anomaly,
    };
  });

  // Mock capacity data
  const capacityData: CapacityData[] = [
    {
      zoneId: "z1",
      zoneName: "Downtown",
      currentCapacity: 850,
      recommendedCapacity: 950,
      utilizationRate: 0.89,
    },
    {
      zoneId: "z2",
      zoneName: "Midtown",
      currentCapacity: 1000,
      recommendedCapacity: 1300,
      utilizationRate: 0.77,
    },
    {
      zoneId: "z3",
      zoneName: "Uptown",
      currentCapacity: 600,
      recommendedCapacity: 700,
      utilizationRate: 0.86,
    },
    {
      zoneId: "z4",
      zoneName: "West Side",
      currentCapacity: 900,
      recommendedCapacity: 1100,
      utilizationRate: 0.82,
    },
    {
      zoneId: "z5",
      zoneName: "East Side",
      currentCapacity: 950,
      recommendedCapacity: 1200,
      utilizationRate: 0.79,
    },
    {
      zoneId: "z6",
      zoneName: "Financial",
      currentCapacity: 1300,
      recommendedCapacity: 1500,
      utilizationRate: 0.87,
    },
  ];

  // Mock schedule grid data
  const scheduleGridData: DriverScheduleSlot[] = [
    {
      driverId: "d1",
      driverName: "John Smith",
      timeSlot: new Date(new Date().setHours(6, 0, 0)),
      zoneId: "z1",
      zoneName: "Downtown",
      utilizationRate: 0.85,
    },
    {
      driverId: "d1",
      driverName: "John Smith",
      timeSlot: new Date(new Date().setHours(6, 30, 0)),
      zoneId: "z1",
      zoneName: "Downtown",
      utilizationRate: 0.88,
    },
    {
      driverId: "d1",
      driverName: "John Smith",
      timeSlot: new Date(new Date().setHours(7, 0, 0)),
      zoneId: "z2",
      zoneName: "Midtown",
      utilizationRate: 0.9,
    },
    {
      driverId: "d2",
      driverName: "Sarah Johnson",
      timeSlot: new Date(new Date().setHours(6, 0, 0)),
      zoneId: "z3",
      zoneName: "Uptown",
      utilizationRate: 0.72,
    },
    {
      driverId: "d2",
      driverName: "Sarah Johnson",
      timeSlot: new Date(new Date().setHours(7, 0, 0)),
      zoneId: "z3",
      zoneName: "Uptown",
      utilizationRate: 0.75,
    },
    {
      driverId: "d3",
      driverName: "Mike Davis",
      timeSlot: new Date(new Date().setHours(6, 30, 0)),
      zoneId: "z4",
      zoneName: "West Side",
      utilizationRate: 0.8,
    },
    {
      driverId: "d3",
      driverName: "Mike Davis",
      timeSlot: new Date(new Date().setHours(7, 30, 0)),
      zoneId: "z5",
      zoneName: "East Side",
      utilizationRate: 0.83,
    },
  ];

  return (
    <div className="w-full space-y-8 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-wl-text-primary">
          Demand Visualization Demo
        </h1>
        <p className="text-sm text-wl-text-tertiary mt-2">
          Real-time demand insights, forecasts, and capacity planning tools
        </p>
      </div>

      {/* Zone Heatmap */}
      <div className="space-y-2">
        <div>
          <h2 className="text-lg font-semibold text-wl-text-primary">Zone Demand Heatmap</h2>
          <p className="text-xs text-wl-text-tertiary mt-1">
            Color-coded zone demand with confidence levels
          </p>
        </div>
        <ZoneHeatmap
          data={zoneHeatmapData}
          onZoneSelect={setSelectedZone}
          cellSize={140}
          showLegend={true}
        />
        {selectedZone && (
          <p className="text-xs text-wl-primary-400">
            Selected zone: {selectedZone}
          </p>
        )}
      </div>

      {/* Demand Forecast Chart */}
      <div className="space-y-2">
        <div>
          <h2 className="text-lg font-semibold text-wl-text-primary">
            Demand Forecast (24-Hour)
          </h2>
          <p className="text-xs text-wl-text-tertiary mt-1">
            Predicted vs actual delivery counts with confidence band
          </p>
        </div>
        <DemandForecastChart
          data={demandForecastData}
          config={{
            height: 300,
            showGrid: true,
            showLegend: true,
            timeFormat: "hourly",
          }}
          onAnomalyClick={(idx, data) => {
            console.log("Anomaly clicked:", idx, data);
          }}
        />
      </div>

      {/* Capacity Bar Chart */}
      <div className="space-y-2">
        <div>
          <h2 className="text-lg font-semibold text-wl-text-primary">
            Zone Capacity Comparison
          </h2>
          <p className="text-xs text-wl-text-tertiary mt-1">
            Current capacity vs recommended capacity per zone
          </p>
        </div>
        <CapacityBarChart
          data={capacityData}
          onBarClick={(zoneId) => {
            console.log("Bar clicked:", zoneId);
          }}
        />
      </div>

      {/* Schedule Grid */}
      <div className="space-y-2">
        <div>
          <h2 className="text-lg font-semibold text-wl-text-primary">
            Driver Schedule Grid
          </h2>
          <p className="text-xs text-wl-text-tertiary mt-1">
            Time-based schedule with zone assignments and utilization rates
          </p>
        </div>
        <ScheduleGrid
          slots={scheduleGridData}
          onSlotClick={(slot) => {
            console.log("Slot clicked:", slot);
          }}
        />
      </div>
    </div>
  );
}
