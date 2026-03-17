/**
 * useFleet — Comprehensive fleet management hooks
 *
 * Provides hooks for:
 * - Fleet overview & metrics
 * - Vehicle inventory & filtering
 * - Maintenance calendar & scheduling
 * - Fuel analytics & transactions
 * - Fleet health scoring
 */

import { useState, useCallback, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════
   TYPES & INTERFACES
   ═══════════════════════════════════════════════════════════ */

export interface Vehicle {
  id: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  type: "sedan" | "truck" | "van" | "suv" | "semi";
  status: "active" | "maintenance" | "retired" | "idle";
  mileage: number;
  assignedDriver?: string;
  healthScore: number;
  fuelType: "gasoline" | "diesel" | "electric" | "hybrid";
  licensePlate: string;
  registrationExpiry: string;
  nextMaintenanceDate: string;
  lastMaintenanceDate: string;
  insuranceProvider: string;
  insuranceExpiry: string;
  purchaseDate: string;
  purchasePrice: number;
}

export interface FleetOverviewData {
  totalVehicles: number;
  activeVehicles: number;
  maintenanceVehicles: number;
  retiredVehicles: number;
  utilizationRate: number;
  fleetCostMTD: number;
  maintenanceCompliancePercent: number;
  fuelSpendTrend: Array<{ date: string; spend: number }>;
  vehiclesByStatus: Record<string, number>;
}

export interface MaintenanceEvent {
  id: string;
  vehicleId: string;
  type: "oil-change" | "tire-rotation" | "inspection" | "repair" | "alignment";
  scheduledDate: string;
  completedDate?: string;
  vendor: string;
  estimatedCost: number;
  actualCost?: number;
  status: "scheduled" | "in-progress" | "completed" | "overdue";
  notes: string;
}

export interface FuelTransaction {
  id: string;
  vehicleId: string;
  driverId: string;
  amount: number;
  gallons: number;
  price: number;
  date: string;
  station: string;
  mpg: number;
  location: { lat: number; lng: number };
  anomalyScore: number;
  flagged: boolean;
}

export interface FuelCard {
  id: string;
  cardNumber: string;
  provider: string;
  status: "active" | "blocked" | "expired";
  dailyLimit: number;
  monthlyLimit: number;
  assignedVehicles: string[];
  expiryDate: string;
}

export interface FleetHealthMetrics {
  overallScore: number;
  fuelEfficiency: number;
  safetyScore: number;
  maintenanceScore: number;
  utilizationScore: number;
  vehicleScores: Record<string, number>;
}

export interface ActivityFeed {
  id: string;
  type: "maintenance" | "fuel" | "assignment" | "alert";
  vehicleId: string;
  title: string;
  description: string;
  timestamp: string;
  icon: string;
}

/* ═══════════════════════════════════════════════════════════
   MOCK DATA
   ═══════════════════════════════════════════════════════════ */

const MOCK_VEHICLES: Vehicle[] = [
  {
    id: "veh-001",
    vin: "1HGBH41JXMN109186",
    make: "Honda",
    model: "Accord",
    year: 2022,
    type: "sedan",
    status: "active",
    mileage: 45230,
    assignedDriver: "John Smith",
    healthScore: 95,
    fuelType: "gasoline",
    licensePlate: "ABC-1234",
    registrationExpiry: "2026-12-31",
    nextMaintenanceDate: "2026-04-15",
    lastMaintenanceDate: "2026-01-10",
    insuranceProvider: "State Farm",
    insuranceExpiry: "2026-09-15",
    purchaseDate: "2022-03-15",
    purchasePrice: 28500,
  },
  {
    id: "veh-002",
    vin: "2HGBH41JXMN109187",
    make: "Toyota",
    model: "Camry",
    year: 2021,
    type: "sedan",
    status: "maintenance",
    mileage: 62100,
    assignedDriver: "Sarah Johnson",
    healthScore: 72,
    fuelType: "hybrid",
    licensePlate: "XYZ-5678",
    registrationExpiry: "2025-08-20",
    nextMaintenanceDate: "2026-03-20",
    lastMaintenanceDate: "2025-12-05",
    insuranceProvider: "Geico",
    insuranceExpiry: "2026-11-10",
    purchaseDate: "2021-06-20",
    purchasePrice: 32000,
  },
  {
    id: "veh-003",
    vin: "3HGBH41JXMN109188",
    make: "Chevrolet",
    model: "Silverado",
    year: 2020,
    type: "truck",
    status: "active",
    mileage: 89500,
    assignedDriver: "Mike Davis",
    healthScore: 88,
    fuelType: "diesel",
    licensePlate: "DEF-9012",
    registrationExpiry: "2025-07-15",
    nextMaintenanceDate: "2026-05-01",
    lastMaintenanceDate: "2025-10-20",
    insuranceProvider: "Progressive",
    insuranceExpiry: "2026-05-20",
    purchaseDate: "2020-02-10",
    purchasePrice: 45000,
  },
  {
    id: "veh-004",
    vin: "4HGBH41JXMN109189",
    make: "Ford",
    model: "Transit",
    year: 2019,
    type: "van",
    status: "active",
    mileage: 125300,
    assignedDriver: "Emma Wilson",
    healthScore: 82,
    fuelType: "gasoline",
    licensePlate: "GHI-3456",
    registrationExpiry: "2025-05-10",
    nextMaintenanceDate: "2026-04-10",
    lastMaintenanceDate: "2025-11-15",
    insuranceProvider: "Allstate",
    insuranceExpiry: "2026-08-30",
    purchaseDate: "2019-08-05",
    purchasePrice: 38000,
  },
  {
    id: "veh-005",
    vin: "5HGBH41JXMN109190",
    make: "Nissan",
    model: "Rogue",
    year: 2023,
    type: "suv",
    status: "active",
    mileage: 18900,
    assignedDriver: "Alex Martinez",
    healthScore: 98,
    fuelType: "gasoline",
    licensePlate: "JKL-7890",
    registrationExpiry: "2027-03-25",
    nextMaintenanceDate: "2026-06-01",
    lastMaintenanceDate: "2025-09-01",
    insuranceProvider: "Safeco",
    insuranceExpiry: "2027-02-10",
    purchaseDate: "2023-01-20",
    purchasePrice: 35000,
  },
  {
    id: "veh-006",
    vin: "6HGBH41JXMN109191",
    make: "Tesla",
    model: "Model 3",
    year: 2023,
    type: "sedan",
    status: "active",
    mileage: 12500,
    assignedDriver: undefined,
    healthScore: 94,
    fuelType: "electric",
    licensePlate: "MNO-1234",
    registrationExpiry: "2027-02-15",
    nextMaintenanceDate: "2026-08-15",
    lastMaintenanceDate: "2025-06-10",
    insuranceProvider: "State Farm",
    insuranceExpiry: "2027-01-20",
    purchaseDate: "2023-05-10",
    purchasePrice: 52000,
  },
  {
    id: "veh-007",
    vin: "7HGBH41JXMN109192",
    make: "Peterbilt",
    model: "579",
    year: 2018,
    type: "semi",
    status: "idle",
    mileage: 245600,
    assignedDriver: undefined,
    healthScore: 65,
    fuelType: "diesel",
    licensePlate: "PQR-5678",
    registrationExpiry: "2025-04-10",
    nextMaintenanceDate: "2026-02-01",
    lastMaintenanceDate: "2025-08-20",
    insuranceProvider: "TravelCenters",
    insuranceExpiry: "2026-03-30",
    purchaseDate: "2018-11-15",
    purchasePrice: 95000,
  },
];

const MOCK_MAINTENANCE: MaintenanceEvent[] = [
  {
    id: "maint-001",
    vehicleId: "veh-001",
    type: "oil-change",
    scheduledDate: "2026-04-15",
    vendor: "Les Schwab Tire Center",
    estimatedCost: 65,
    status: "scheduled",
    notes: "Regular 5,000 mile service",
  },
  {
    id: "maint-002",
    vehicleId: "veh-002",
    type: "inspection",
    scheduledDate: "2026-03-20",
    vendor: "Firestone Complete Auto Care",
    estimatedCost: 150,
    status: "in-progress",
    notes: "Annual inspection for registration",
  },
  {
    id: "maint-003",
    vehicleId: "veh-003",
    type: "tire-rotation",
    scheduledDate: "2026-02-15",
    completedDate: "2026-02-14",
    vendor: "Goodyear Auto Service",
    estimatedCost: 85,
    actualCost: 85,
    status: "completed",
    notes: "Rotation and balance",
  },
  {
    id: "maint-004",
    vehicleId: "veh-004",
    type: "oil-change",
    scheduledDate: "2026-01-10",
    vendor: "Jiffy Lube",
    estimatedCost: 45,
    status: "overdue",
    notes: "OVERDUE - Schedule immediately",
  },
  {
    id: "maint-005",
    vehicleId: "veh-005",
    type: "alignment",
    scheduledDate: "2026-05-01",
    vendor: "Midas",
    estimatedCost: 120,
    status: "scheduled",
    notes: "Four-wheel alignment",
  },
];

const MOCK_FUEL_TRANSACTIONS: FuelTransaction[] = [
  {
    id: "fuel-001",
    vehicleId: "veh-001",
    driverId: "driver-001",
    amount: 52.40,
    gallons: 12.3,
    price: 4.26,
    date: "2026-03-17",
    station: "Shell - Main St",
    mpg: 28.5,
    location: { lat: 40.7128, lng: -74.006 },
    anomalyScore: 0.1,
    flagged: false,
  },
  {
    id: "fuel-002",
    vehicleId: "veh-002",
    driverId: "driver-002",
    amount: 48.50,
    gallons: 11.2,
    price: 4.33,
    date: "2026-03-16",
    station: "Chevron - Downtown",
    mpg: 32.1,
    location: { lat: 40.7225, lng: -73.9857 },
    anomalyScore: 0.2,
    flagged: false,
  },
  {
    id: "fuel-003",
    vehicleId: "veh-003",
    driverId: "driver-003",
    amount: 125.60,
    gallons: 28.5,
    price: 4.40,
    date: "2026-03-15",
    station: "TA/Petro - Highway",
    mpg: 8.2,
    location: { lat: 40.6892, lng: -74.1445 },
    anomalyScore: 0.3,
    flagged: false,
  },
  {
    id: "fuel-004",
    vehicleId: "veh-001",
    driverId: "driver-001",
    amount: 67.80,
    gallons: 15.8,
    price: 4.29,
    date: "2026-03-14",
    station: "Exxon - Harbor",
    mpg: 18.5,
    location: { lat: 40.645, lng: -74.0921 },
    anomalyScore: 0.75,
    flagged: true,
  },
];

const MOCK_FUEL_CARDS: FuelCard[] = [
  {
    id: "card-001",
    cardNumber: "****1234",
    provider: "Shell",
    status: "active",
    dailyLimit: 500,
    monthlyLimit: 10000,
    assignedVehicles: ["veh-001", "veh-002"],
    expiryDate: "2026-12-31",
  },
  {
    id: "card-002",
    cardNumber: "****5678",
    provider: "Chevron",
    status: "active",
    dailyLimit: 600,
    monthlyLimit: 12000,
    assignedVehicles: ["veh-003", "veh-004"],
    expiryDate: "2027-06-30",
  },
  {
    id: "card-003",
    cardNumber: "****9012",
    provider: "Shell",
    status: "blocked",
    dailyLimit: 300,
    monthlyLimit: 6000,
    assignedVehicles: ["veh-007"],
    expiryDate: "2025-12-31",
  },
];

const MOCK_ACTIVITY: ActivityFeed[] = [
  {
    id: "act-001",
    type: "maintenance",
    vehicleId: "veh-003",
    title: "Tire rotation completed",
    description: "Tire rotation and balance completed at Goodyear Auto Service",
    timestamp: "2026-02-14T14:30:00Z",
    icon: "CheckCircle2",
  },
  {
    id: "act-002",
    type: "fuel",
    vehicleId: "veh-001",
    title: "Fuel transaction",
    description: "12.3 gallons purchased at Shell - Main St",
    timestamp: "2026-03-17T09:15:00Z",
    icon: "Fuel",
  },
  {
    id: "act-003",
    type: "assignment",
    vehicleId: "veh-005",
    title: "Vehicle assigned",
    description: "Nissan Rogue assigned to Alex Martinez",
    timestamp: "2026-03-16T16:45:00Z",
    icon: "Truck",
  },
  {
    id: "act-004",
    type: "alert",
    vehicleId: "veh-004",
    title: "Maintenance overdue",
    description: "Oil change overdue since 2026-01-10",
    timestamp: "2026-03-15T08:00:00Z",
    icon: "AlertTriangle",
  },
];

/* ═══════════════════════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════════════════════ */

export function useFleetOverview(): FleetOverviewData {
  const active = MOCK_VEHICLES.filter((v) => v.status === "active").length;
  const maintenance = MOCK_VEHICLES.filter((v) => v.status === "maintenance").length;
  const retired = MOCK_VEHICLES.filter((v) => v.status === "retired").length;
  const utilization = (active / MOCK_VEHICLES.length) * 100;

  const fuelSpend = MOCK_FUEL_TRANSACTIONS.reduce((sum, t) => sum + t.amount, 0);
  const maintenanceCompliance = 85;

  return {
    totalVehicles: MOCK_VEHICLES.length,
    activeVehicles: active,
    maintenanceVehicles: maintenance,
    retiredVehicles: retired,
    utilizationRate: Math.round(utilization),
    fleetCostMTD: 45230,
    maintenanceCompliancePercent: maintenanceCompliance,
    fuelSpendTrend: [
      { date: "2026-03-10", spend: 1240 },
      { date: "2026-03-11", spend: 1480 },
      { date: "2026-03-12", spend: 1320 },
      { date: "2026-03-13", spend: 1560 },
      { date: "2026-03-14", spend: 1650 },
      { date: "2026-03-15", spend: 1420 },
      { date: "2026-03-16", spend: 1380 },
      { date: "2026-03-17", spend: 1210 },
    ],
    vehiclesByStatus: {
      active: active,
      maintenance: maintenance,
      retired: retired,
      idle: MOCK_VEHICLES.filter((v) => v.status === "idle").length,
    },
  };
}

export function useVehicles(
  filters?: {
    type?: string;
    status?: string;
    fuelType?: string;
    ageRange?: [number, number];
    search?: string;
  }
): Vehicle[] {
  return useMemo(() => {
    let result = [...MOCK_VEHICLES];

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (v) =>
          v.make.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q) ||
          v.licensePlate.includes(q) ||
          v.vin.includes(q)
      );
    }

    if (filters?.type) {
      result = result.filter((v) => v.type === filters.type);
    }

    if (filters?.status) {
      result = result.filter((v) => v.status === filters.status);
    }

    if (filters?.fuelType) {
      result = result.filter((v) => v.fuelType === filters.fuelType);
    }

    if (filters?.ageRange) {
      const [minAge, maxAge] = filters.ageRange;
      const currentYear = new Date().getFullYear();
      result = result.filter((v) => {
        const age = currentYear - v.year;
        return age >= minAge && age <= maxAge;
      });
    }

    return result;
  }, [filters]);
}

export function useVehicleDetail(vehicleId: string): Vehicle | undefined {
  return MOCK_VEHICLES.find((v) => v.id === vehicleId);
}

export function useMaintenanceCalendar(year?: number, month?: number): MaintenanceEvent[] {
  return useMemo(() => {
    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month !== undefined ? month : now.getMonth();

    return MOCK_MAINTENANCE.filter((m) => {
      const mDate = new Date(m.scheduledDate);
      return mDate.getFullYear() === targetYear && mDate.getMonth() === targetMonth;
    });
  }, [year, month]);
}

export function useMaintenanceSchedule(vehicleId?: string): MaintenanceEvent[] {
  return useMemo(() => {
    let result = [...MOCK_MAINTENANCE];

    if (vehicleId) {
      result = result.filter((m) => m.vehicleId === vehicleId);
    }

    // Sort by date, overdue first
    result.sort((a, b) => {
      if (a.status === "overdue" && b.status !== "overdue") return -1;
      if (a.status !== "overdue" && b.status === "overdue") return 1;
      return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
    });

    return result;
  }, [vehicleId]);
}

export function useFuelAnalytics(): {
  totalSpend: number;
  avgMpg: number;
  idleTimePercent: number;
  pricePerGallon: number;
  topConsumers: Array<{ vehicleId: string; spend: number }>;
  anomalies: FuelTransaction[];
} {
  return useMemo(() => {
    const totalSpend = MOCK_FUEL_TRANSACTIONS.reduce((sum, t) => sum + t.amount, 0);
    const avgMpg =
      MOCK_FUEL_TRANSACTIONS.reduce((sum, t) => sum + t.mpg, 0) / MOCK_FUEL_TRANSACTIONS.length;
    const pricePerGallon =
      MOCK_FUEL_TRANSACTIONS.reduce((sum, t) => sum + t.price, 0) / MOCK_FUEL_TRANSACTIONS.length;
    const anomalies = MOCK_FUEL_TRANSACTIONS.filter((t) => t.flagged);

    const vehicleSpend: Record<string, number> = {};
    MOCK_FUEL_TRANSACTIONS.forEach((t) => {
      vehicleSpend[t.vehicleId] = (vehicleSpend[t.vehicleId] || 0) + t.amount;
    });

    const topConsumers = Object.entries(vehicleSpend)
      .map(([vehicleId, spend]) => ({ vehicleId, spend }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 5);

    return {
      totalSpend,
      avgMpg: Math.round(avgMpg * 10) / 10,
      idleTimePercent: 18,
      pricePerGallon: Math.round(pricePerGallon * 100) / 100,
      topConsumers,
      anomalies,
    };
  }, []);
}

export function useFuelTransactions(filters?: {
  vehicleId?: string;
  driverId?: string;
  dateRange?: [string, string];
  flaggedOnly?: boolean;
}): FuelTransaction[] {
  return useMemo(() => {
    let result = [...MOCK_FUEL_TRANSACTIONS];

    if (filters?.vehicleId) {
      result = result.filter((t) => t.vehicleId === filters.vehicleId);
    }

    if (filters?.driverId) {
      result = result.filter((t) => t.driverId === filters.driverId);
    }

    if (filters?.flaggedOnly) {
      result = result.filter((t) => t.flagged);
    }

    if (filters?.dateRange) {
      const [start, end] = filters.dateRange;
      result = result.filter((t) => t.date >= start && t.date <= end);
    }

    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filters]);
}

export function useFleetCosts(): {
  mtdSpend: number;
  fuelSpend: number;
  maintenanceSpend: number;
  insuranceMonthly: number;
  avgCostPerVehicle: number;
} {
  return useMemo(() => {
    const fuelSpend = MOCK_FUEL_TRANSACTIONS.reduce((sum, t) => sum + t.amount, 0);
    const maintenanceSpend = MOCK_MAINTENANCE.filter((m) => m.status === "completed")
      .reduce((sum, m) => sum + (m.actualCost || m.estimatedCost), 0);

    return {
      mtdSpend: 45230,
      fuelSpend,
      maintenanceSpend,
      insuranceMonthly: 3200,
      avgCostPerVehicle: 45230 / MOCK_VEHICLES.length,
    };
  }, []);
}

export function useFleetHealth(): FleetHealthMetrics {
  return useMemo(() => {
    const avgHealth = MOCK_VEHICLES.reduce((sum, v) => sum + v.healthScore, 0) / MOCK_VEHICLES.length;

    const vehicleScores: Record<string, number> = {};
    MOCK_VEHICLES.forEach((v) => {
      vehicleScores[v.id] = v.healthScore;
    });

    return {
      overallScore: Math.round(avgHealth),
      fuelEfficiency: 82,
      safetyScore: 88,
      maintenanceScore: 85,
      utilizationScore: 78,
      vehicleScores,
    };
  }, []);
}

export function useActivityFeed(limit?: number): ActivityFeed[] {
  const items = [...MOCK_ACTIVITY].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return limit ? items.slice(0, limit) : items;
}

/* ═══════════════════════════════════════════════════════════
   UTILITY EXPORTS
   ═══════════════════════════════════════════════════════════ */

export const VEHICLE_TYPES = ["sedan", "truck", "van", "suv", "semi"];
export const VEHICLE_STATUSES = ["active", "maintenance", "retired", "idle"];
export const FUEL_TYPES = ["gasoline", "diesel", "electric", "hybrid"];
export const MAINTENANCE_TYPES = ["oil-change", "tire-rotation", "inspection", "repair", "alignment"];
