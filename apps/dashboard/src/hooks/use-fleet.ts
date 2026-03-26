'use client';

import { useApiList, useApiQuery, ApiFilters, UseApiListResult, UseApiQueryResult } from './use-api';

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

export interface FleetFilters extends ApiFilters {
  status?: string;
  type?: string;
  fuelType?: string;
}

export function useVehicles(filters?: FleetFilters): UseApiListResult<Vehicle> {
  return useApiList<Vehicle>('/api/v4/fleet/vehicles', filters);
}

export function useVehicleDetail(id: string | null): UseApiQueryResult<Vehicle> {
  return useApiQuery<Vehicle>(id ? `/api/v4/fleet/vehicles/${id}` : null);
}

export function useMaintenanceEvents(filters?: ApiFilters): UseApiListResult<MaintenanceEvent> {
  return useApiList<MaintenanceEvent>('/api/v4/fleet/maintenance', filters);
}

export function useFuelTransactions(filters?: ApiFilters): UseApiListResult<FuelTransaction> {
  return useApiList<FuelTransaction>('/api/v4/fleet/fuel-transactions', filters);
}

export function useFuelCards(filters?: ApiFilters): UseApiListResult<FuelCard> {
  return useApiList<FuelCard>('/api/v4/fleet/fuel-cards', filters);
}

export function useFleetOverview(): UseApiQueryResult<FleetOverviewData> {
  return useApiQuery<FleetOverviewData>('/api/v4/fleet/overview');
}

export function useFleetHealth(): UseApiQueryResult<FleetHealthMetrics> {
  return useApiQuery<FleetHealthMetrics>('/api/v4/fleet/health');
}

export function useActivityFeed(filters?: ApiFilters): UseApiListResult<ActivityFeed> {
  return useApiList<ActivityFeed>('/api/v4/fleet/activity', filters);
}

export const VEHICLE_TYPES = ["sedan", "truck", "van", "suv", "semi"];
export const VEHICLE_STATUSES = ["active", "maintenance", "retired", "idle"];
export const FUEL_TYPES = ["gasoline", "diesel", "electric", "hybrid"];
export const MAINTENANCE_TYPES = ["oil-change", "tire-rotation", "inspection", "repair", "alignment"];
