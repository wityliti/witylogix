'use client';

/**
 * Driver-specific API hooks for the dashboard
 */

import { useApiMutation, useApiList, useApiQuery, ApiFilters, UseApiQueryResult, UseApiMutationResult, UseApiListResult } from './use-api';

/**
 * Driver status enum
 */
export enum DriverStatus {
  OFFLINE = 'offline',
  ONLINE = 'online',
  ON_DELIVERY = 'on_delivery',
  ON_BREAK = 'on_break',
  UNAVAILABLE = 'unavailable',
}

/**
 * Driver type
 */
export interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: DriverStatus;
  avatar?: string;
  licenseNumber: string;
  licenseExpiry: string;
  vehicle: Vehicle;
  rating: number;
  totalDeliveries: number;
  completionRate: number;
  currentLocation?: Location;
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Vehicle information
 */
export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  vin: string;
  capacity: number;
  currentLoad?: number;
}

/**
 * Location coordinates
 */
export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: string;
}

/**
 * Driver location with metadata
 */
export interface DriverLocation extends Location {
  driverId: string;
  driverName: string;
  status: DriverStatus;
}

/**
 * Driver filters
 */
export interface DriverFilters extends ApiFilters {
  status?: DriverStatus;
  rating?: number;
}

/**
 * Hook to fetch paginated drivers with filtering and sorting
 * @param filters - Driver filter options
 * @returns List of drivers with pagination
 */
export function useDrivers(
  filters?: DriverFilters,
): UseApiListResult<Driver> {
  return useApiList<Driver>('/api/v4/drivers', filters);
}

/**
 * Hook to fetch a single driver by ID
 * @param id - Driver ID
 * @returns Single driver
 */
export function useDriver(
  id: string | null,
): UseApiQueryResult<Driver> {
  return useApiQuery<Driver>(id ? `/drivers/${id}` : null);
}

/**
 * Hook to fetch driver locations for map display
 * @returns Array of driver locations
 */
export function useDriverLocations(): UseApiQueryResult<DriverLocation[]> {
  return useApiQuery<DriverLocation[]>('/api/v4/drivers/locations');
}

/**
 * Hook to update driver status
 * @param id - Driver ID
 * @returns Mutation to update driver status
 */
export function useUpdateDriverStatus(
  id: string,
): UseApiMutationResult<Driver> {
  return useApiMutation<Driver>('PATCH', `/drivers/${id}/status`);
}
