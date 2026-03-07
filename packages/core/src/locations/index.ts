/**
 * Locations Module
 * 
 * Comprehensive location management system with geo-fencing, warehouse operations,
 * and advanced location features for the Witylogix platform.
 * 
 * Re-exports all types and utilities for easy access.
 */

// Export all types
export type {
  Coordinates,
  LocationType,
  OperatingHours,
  ContactInfo,
  WarehouseCapacity,
  GeoFenceType,
  GeoFence,
  GeoFenceCheck,
  Location,
  NormalizedAddress,
  LocationSearchFilter,
  LocationWithDistance,
  BoundingBox,
  CoverageArea,
  WarehouseAssignment,
} from './types';

// Export geo-fence utilities
export {
  calculateDistance,
  isPointInCircle,
  isPointInPolygon,
  checkGeoFence,
  findNearestPoint,
  createCircleFence,
  createPolygonFence,
  isValidPolygon,
  getBoundingBox,
} from './geo-fence';

// Export warehouse utilities
export {
  calculateCapacity,
  findNearestWarehouse,
  findWarehousesInRange,
  sortByDistance,
  calculateCoverageArea,
  assignToNearestWarehouse,
  getWarehouseStats,
} from './warehouse';

// Export address utilities
export {
  validateCoordinates,
  coordinatesToString,
  parseAddressComponents,
  normalizeAddress,
  formatAddress,
  estimateGeocode,
  isValidAddress,
  addressesMatch,
  extractPostalCode,
} from './address';

import type {
  Location,
  Coordinates,
  LocationSearchFilter,
  LocationWithDistance,
  WarehouseCapacity,
  GeoFence,
  GeoFenceCheck,
  NormalizedAddress,
} from './types';

import {
  calculateDistance,
  checkGeoFence,
  isPointInPolygon,
  isPointInCircle,
} from './geo-fence';

import {
  calculateCapacity,
  findNearestWarehouse,
  findWarehousesInRange,
  sortByDistance,
  assignToNearestWarehouse,
} from './warehouse';

import {
  validateCoordinates,
  normalizeAddress,
  estimateGeocode,
} from './address';

/**
 * LocationService
 * 
 * Main service class combining all location-related functionality.
 * Provides a convenient API for location management, geo-fencing, and warehouse operations.
 */
export class LocationService {
  /**
   * Check if a location is within a geo-fence
   */
  static checkGeofence(point: Coordinates, fence: GeoFence): GeoFenceCheck {
    return checkGeoFence(point, fence);
  }

  /**
   * Find nearby locations
   */
  static findNearby(
    center: Coordinates,
    locations: Location[],
    maxDistanceKm: number = 10
  ): LocationWithDistance[] {
    return findWarehousesInRange(center, maxDistanceKm, locations);
  }

  /**
   * Sort locations by distance
   */
  static sortByDistance(origin: Coordinates, locations: Location[]): LocationWithDistance[] {
    return sortByDistance(origin, locations);
  }

  /**
   * Find nearest location
   */
  static findNearest(
    origin: Coordinates,
    locations: Location[]
  ): (Location & { distance: number }) | null {
    return findNearestWarehouse(origin, locations);
  }

  /**
   * Get warehouse capacity
   */
  static getCapacity(location: Location, activeShipments: number): WarehouseCapacity {
    return calculateCapacity(location, activeShipments);
  }

  /**
   * Validate location coordinates
   */
  static validateCoordinates(lat: number, lng: number): boolean {
    return validateCoordinates(lat, lng);
  }

  /**
   * Normalize address
   */
  static normalizeAddress(address: string): NormalizedAddress {
    return normalizeAddress(address);
  }

  /**
   * Assign order to nearest warehouse
   */
  static assignWarehouse(order: { deliveryAddress: Coordinates }, warehouses: Location[]) {
    return assignToNearestWarehouse(order, warehouses);
  }

  /**
   * Calculate distance between two points in kilometers
   */
  static distance(from: Coordinates, to: Coordinates): number {
    return calculateDistance(from, to) / 1000; // Convert meters to km
  }

  /**
   * Estimate geocoding (stub function)
   */
  static estimateGeocode(address: string): Coordinates | null {
    return estimateGeocode(address);
  }

  /**
   * Search for locations based on filters
   */
  static search(locations: Location[], filters: LocationSearchFilter): Location[] {
    return locations.filter((location) => {
      // Filter by type
      if (filters.type && location.type !== filters.type) {
        return false;
      }

      // Filter by active status
      if (filters.isActive !== undefined && location.isActive !== filters.isActive) {
        return false;
      }

      // Filter by distance from coordinates
      if (filters.nearCoordinates && filters.maxDistance !== undefined) {
        const distance = calculateDistance(filters.nearCoordinates, location.coordinates);
        const maxDistanceMeters = filters.maxDistance * 1000;

        if (distance > maxDistanceMeters) {
          return false;
        }
      }

      // Filter by text search (name or address)
      if (filters.query) {
        const query = filters.query.toLowerCase();
        const matchesName = location.name.toLowerCase().includes(query);
        const matchesAddress = location.address.toLowerCase().includes(query);

        if (!matchesName && !matchesAddress) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Validate location object
   */
  static validateLocation(location: Partial<Location>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!location.id) errors.push('ID is required');
    if (!location.shopId) errors.push('Shop ID is required');
    if (!location.name) errors.push('Name is required');
    if (!location.type) errors.push('Type is required');
    if (!location.address) errors.push('Address is required');
    if (!location.coordinates) errors.push('Coordinates are required');
    else if (!validateCoordinates(location.coordinates.lat, location.coordinates.lng)) {
      errors.push('Invalid coordinates');
    }

    if (!location.operatingHours) errors.push('Operating hours are required');
    if (!location.contactInfo) errors.push('Contact info is required');

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
