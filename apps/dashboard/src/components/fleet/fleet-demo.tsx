"use client";

import { useState } from "react";
import { VehicleStatusCard } from "./vehicle-status-card";
import { FuelConsumptionChart } from "./fuel-consumption-chart";
import { MaintenanceSchedule } from "./maintenance-schedule";
import { SpeedHistoryChart } from "./speed-history-chart";
import { FleetHealthGauge } from "./fleet-health-gauge";
import { Card } from "@/components/ui/card";

/**
 * Fleet Components Demo Page
 * Showcases all fleet management components with sample data
 */
export function FleetDemo() {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  // Sample vehicle data
  const sampleVehicles = [
    {
      id: "VEH-001",
      name: "Delivery Van 1",
      plate: "DL-01-AB-1234",
      make: "Maruti",
      model: "Eeco",
      year: 2022,
      status: "moving" as const,
      latitude: 28.6139,
      longitude: 77.209,
      address: "Sector 12, Noida, Delhi NCR",
      speed: 42,
      fuelLevel: 75,
      lastUpdate: new Date(Date.now() - 5 * 60000).toISOString(),
      diagnosticsCount: 0,
    },
    {
      id: "VEH-002",
      name: "Delivery Van 2",
      plate: "DL-02-AB-5678",
      make: "Tata",
      model: "Ace",
      year: 2021,
      status: "idle" as const,
      latitude: 28.5355,
      longitude: 77.391,
      address: "GIP Mall, Noida",
      speed: 0,
      fuelLevel: 45,
      lastUpdate: new Date(Date.now() - 15 * 60000).toISOString(),
      diagnosticsCount: 2,
    },
    {
      id: "VEH-003",
      name: "Truck 1",
      plate: "DL-03-AB-9999",
      make: "Ashok Leyland",
      model: "16T",
      year: 2020,
      status: "stopped" as const,
      latitude: 28.4595,
      longitude: 77.0266,
      address: "Sector 18, Gurugram",
      speed: 0,
      fuelLevel: 30,
      lastUpdate: new Date(Date.now() - 2 * 3600000).toISOString(),
      diagnosticsCount: 1,
    },
  ];

  // Sample fuel consumption data
  const fuelConsumptionData = [
    {
      name: "Van 1",
      color: "#3b82f6",
      data: [
        { date: "2024-03-05", consumption: 45 },
        { date: "2024-03-06", consumption: 52 },
        { date: "2024-03-07", consumption: 48 },
        { date: "2024-03-08", consumption: 61 },
        { date: "2024-03-09", consumption: 55 },
        { date: "2024-03-10", consumption: 67 },
        { date: "2024-03-11", consumption: 58 },
      ],
    },
    {
      name: "Van 2",
      color: "#10b981",
      data: [
        { date: "2024-03-05", consumption: 38 },
        { date: "2024-03-06", consumption: 42 },
        { date: "2024-03-07", consumption: 45 },
        { date: "2024-03-08", consumption: 50 },
        { date: "2024-03-09", consumption: 48 },
        { date: "2024-03-10", consumption: 55 },
        { date: "2024-03-11", consumption: 52 },
      ],
    },
  ];

  // Sample maintenance data
  const maintenanceItems = [
    {
      id: "MAINT-001",
      vehicleId: "VEH-001",
      vehicleName: "Delivery Van 1",
      serviceType: "oil-change" as const,
      dueDate: "2024-03-15",
      status: "due-soon" as const,
      priority: "high" as const,
      mileageThreshold: 50000,
      currentMileage: 47800,
    },
    {
      id: "MAINT-002",
      vehicleId: "VEH-002",
      vehicleName: "Delivery Van 2",
      serviceType: "tire-rotation" as const,
      dueDate: "2024-03-10",
      status: "overdue" as const,
      priority: "critical" as const,
      mileageThreshold: 30000,
      currentMileage: 30500,
    },
    {
      id: "MAINT-003",
      vehicleId: "VEH-003",
      vehicleName: "Truck 1",
      serviceType: "brake-inspection" as const,
      dueDate: "2024-03-25",
      status: "scheduled" as const,
      priority: "medium" as const,
      mileageThreshold: 100000,
      currentMileage: 95200,
    },
    {
      id: "MAINT-004",
      vehicleId: "VEH-001",
      vehicleName: "Delivery Van 1",
      serviceType: "fluid-check" as const,
      dueDate: "2024-03-20",
      status: "scheduled" as const,
      priority: "low" as const,
    },
  ];

  // Sample speed history data
  const speedHistoryData = Array.from({ length: 24 }, (_, i) => ({
    timestamp: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
    speed: Math.min(100, Math.floor(Math.random() * 80 + 20)),
  }));

  return (
    <div className="w-full space-y-8 p-6 bg-wl-bg-surface min-h-screen">
      <div>
        <h1 className="text-3xl font-bold text-wl-text-primary mb-2">
          Fleet Management Components
        </h1>
        <p className="text-wl-text-secondary">
          Comprehensive showcase of fleet telematics and vehicle management components
        </p>
      </div>

      {/* Vehicle Status Cards */}
      <div>
        <h2 className="text-xl font-semibold text-wl-text-primary mb-4">
          Vehicle Status Cards
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sampleVehicles.map((vehicle) => (
            <VehicleStatusCard
              key={vehicle.id}
              {...vehicle}
              onClick={setSelectedVehicleId}
            />
          ))}
        </div>
      </div>

      {/* Fuel Consumption Chart */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-wl-text-primary mb-4">
          Fuel Consumption Analysis
        </h2>
        <FuelConsumptionChart
          series={fuelConsumptionData}
          range="7"
          showAverage
          height={350}
        />
      </Card>

      {/* Speed History Chart */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-wl-text-primary mb-4">
          Speed History - Van 1
        </h2>
        <SpeedHistoryChart
          data={speedHistoryData}
          speedLimit={80}
          height={350}
          showViolations
        />
      </Card>

      {/* Maintenance Schedule */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-wl-text-primary mb-4">
          Maintenance Schedule
        </h2>
        <MaintenanceSchedule
          items={maintenanceItems}
          sortBy="urgency"
          onServiceClick={(id) => console.log("Service clicked:", id)}
        />
      </Card>

      {/* Fleet Health Gauge */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-wl-text-primary mb-4">
          Fleet Health Overview
        </h2>
        <div className="flex justify-center">
          <div className="w-full max-w-sm">
            <FleetHealthGauge
              vehicleHealth={88}
              fuelEfficiency={76}
              driverBehavior={82}
              maintenanceCompliance={91}
              height={350}
              showLegend
            />
          </div>
        </div>
      </Card>

      {/* Info Section */}
      {selectedVehicleId && (
        <Card className="p-6 border-wl-primary-400/30 bg-wl-primary-500/5">
          <h3 className="text-sm font-semibold text-wl-primary-400 mb-2">
            Selected Vehicle
          </h3>
          <p className="text-wl-text-secondary">
            Vehicle ID: {selectedVehicleId}
          </p>
        </Card>
      )}
    </div>
  );
}
