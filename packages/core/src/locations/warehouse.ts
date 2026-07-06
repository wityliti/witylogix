/**
 * Warehouse Management Module
 *
 * Implements warehouse capacity tracking, routing optimization, and coverage analysis.
 */

import type {
  Location,
  LocationWithDistance,
  Coordinates,
  WarehouseCapacity,
  CoverageArea,
  WarehouseAssignment,
} from "./types";
import { calculateDistance } from "./geo-fence";

/**
 * Calculate warehouse capacity metrics
 *
 * @param location Location with capacity info
 * @param activeShipments Number of active shipments
 * @returns WarehouseCapacity metrics
 */
export function calculateCapacity(
  location: Location,
  activeShipments: number,
): WarehouseCapacity {
  if (!location.capacity) {
    return {
      totalSlots: 0,
      usedSlots: activeShipments,
      available: 0,
      utilizationPercent: 0,
    };
  }

  const usedSlots = Math.min(activeShipments, location.capacity.totalSlots);
  const available = Math.max(0, location.capacity.totalSlots - usedSlots);
  const utilizationPercent =
    location.capacity.totalSlots > 0
      ? (usedSlots / location.capacity.totalSlots) * 100
      : 0;

  return {
    totalSlots: location.capacity.totalSlots,
    usedSlots,
    available,
    utilizationPercent: Math.round(utilizationPercent * 100) / 100,
  };
}

/**
 * Find the nearest warehouse to a given location
 *
 * @param coordinates Target coordinates
 * @param warehouses Array of warehouse locations
 * @returns Nearest warehouse with calculated distance, or null if no warehouses
 */
export function findNearestWarehouse(
  coordinates: Coordinates,
  warehouses: Location[],
): (Location & { distance: number }) | null {
  if (warehouses.length === 0) {
    return null;
  }

  let nearest = warehouses[0];
  let minDistance = calculateDistance(coordinates, warehouses[0].coordinates);

  for (let i = 1; i < warehouses.length; i++) {
    const warehouse = warehouses[i];
    const distance = calculateDistance(coordinates, warehouse.coordinates);

    if (distance < minDistance) {
      minDistance = distance;
      nearest = warehouse;
    }
  }

  return {
    ...nearest,
    distance: minDistance / 1000, // Convert to kilometers
  };
}

/**
 * Find all warehouses within a specified distance
 *
 * @param coordinates Center coordinates
 * @param maxDistanceKm Maximum distance in kilometers
 * @param warehouses Array of warehouse locations
 * @returns Array of warehouses within distance, sorted by distance
 */
export function findWarehousesInRange(
  coordinates: Coordinates,
  maxDistanceKm: number,
  warehouses: Location[],
): LocationWithDistance[] {
  const maxDistanceMeters = maxDistanceKm * 1000;
  const results: LocationWithDistance[] = [];

  for (const warehouse of warehouses) {
    const distance = calculateDistance(coordinates, warehouse.coordinates);

    if (distance <= maxDistanceMeters) {
      results.push({
        ...warehouse,
        distance: distance / 1000, // Convert to kilometers
      });
    }
  }

  // Sort by distance
  results.sort((a, b) => a.distance - b.distance);

  return results;
}

/**
 * Sort locations by distance from origin
 *
 * @param origin Origin coordinates
 * @param locations Array of locations to sort
 * @returns Sorted array of locations with distances
 */
export function sortByDistance(
  origin: Coordinates,
  locations: Location[],
): LocationWithDistance[] {
  const results = locations.map((location) => ({
    ...location,
    distance: calculateDistance(origin, location.coordinates) / 1000, // km
  }));

  results.sort((a, b) => a.distance - b.distance);

  return results;
}

/**
 * Calculate total coverage area of warehouses and identify gaps
 *
 * @param warehouses Array of warehouse locations
 * @returns Coverage analysis with total area and gap points
 */
export function calculateCoverageArea(warehouses: Location[]): CoverageArea {
  if (warehouses.length === 0) {
    return {
      totalAreaKm2: 0,
      gaps: [],
      warehouses: [],
    };
  }

  // Calculate bounding box of all warehouses
  let minLat = warehouses[0].coordinates.lat;
  let maxLat = warehouses[0].coordinates.lat;
  let minLng = warehouses[0].coordinates.lng;
  let maxLng = warehouses[0].coordinates.lng;

  for (const warehouse of warehouses) {
    minLat = Math.min(minLat, warehouse.coordinates.lat);
    maxLat = Math.max(maxLat, warehouse.coordinates.lat);
    minLng = Math.min(minLng, warehouse.coordinates.lng);
    maxLng = Math.max(maxLng, warehouse.coordinates.lng);
  }

  // Calculate area in square kilometers (simplified using degree approximation)
  const latDiff = maxLat - minLat;
  const lngDiff = maxLng - minLng;

  // Approximate: 1 degree of latitude = 111.32 km, longitude varies by latitude
  const avgLat = (minLat + maxLat) / 2;
  const latKm = latDiff * 111.32;
  const lngKm = lngDiff * 111.32 * Math.cos(degreesToRadians(avgLat));
  const totalAreaKm2 = latKm * lngKm;

  // Find gaps by checking grid points
  const gridSize = 10; // 10x10 grid
  const gaps: Coordinates[] = [];

  for (let i = 0; i <= gridSize; i++) {
    for (let j = 0; j <= gridSize; j++) {
      const lat = minLat + (maxLat - minLat) * (i / gridSize);
      const lng = minLng + (maxLng - minLng) * (j / gridSize);
      const point = { lat, lng };

      // Check if point is far from all warehouses
      let nearWarehouse = false;

      for (const warehouse of warehouses) {
        const distance = calculateDistance(point, warehouse.coordinates);
        if (distance < 5000) {
          // Less than 5km
          nearWarehouse = true;
          break;
        }
      }

      if (!nearWarehouse) {
        gaps.push(point);
      }
    }
  }

  return {
    totalAreaKm2: Math.round(totalAreaKm2 * 100) / 100,
    gaps,
    warehouses,
  };
}

/**
 * Assign an order to the nearest warehouse with available capacity
 *
 * @param order Order with delivery address coordinates
 * @param warehouses Array of available warehouses
 * @returns Warehouse assignment with distance
 */
export function assignToNearestWarehouse(
  order: { deliveryAddress: Coordinates },
  warehouses: Location[],
): WarehouseAssignment {
  const inRangeWarehouses = findWarehousesInRange(
    order.deliveryAddress,
    100,
    warehouses,
  );

  if (inRangeWarehouses.length === 0) {
    // If no warehouses in range, find the absolute nearest
    const nearest = findNearestWarehouse(order.deliveryAddress, warehouses);
    if (!nearest) {
      throw new Error("No warehouses available for assignment");
    }

    return {
      warehouse: nearest,
      distance: nearest.distance,
      estimatedTime: calculateEstimatedDeliveryTime(nearest.distance),
    };
  }

  // Use the nearest warehouse from those in range
  const warehouse = inRangeWarehouses[0];

  return {
    warehouse,
    distance: warehouse.distance,
    estimatedTime: calculateEstimatedDeliveryTime(warehouse.distance),
  };
}

/**
 * Estimate delivery time based on distance
 * Assumes average speed of 30 km/h for delivery routes
 *
 * @param distanceKm Distance in kilometers
 * @returns Estimated time in minutes
 */
function calculateEstimatedDeliveryTime(distanceKm: number): number {
  const avgSpeedKmH = 30;
  const timeMinutes = (distanceKm / avgSpeedKmH) * 60;
  return Math.ceil(timeMinutes);
}

/**
 * Convert degrees to radians
 */
function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get warehouse statistics summary
 *
 * @param warehouses Array of warehouse locations
 * @returns Summary statistics
 */
export function getWarehouseStats(warehouses: Location[]): {
  total: number;
  active: number;
  totalCapacity: number;
  avgUtilization: number;
} {
  const activeWarehouses = warehouses.filter((w) => w.isActive);
  const totalCapacity = warehouses.reduce(
    (sum, w) => sum + (w.capacity?.totalSlots || 0),
    0,
  );
  const totalUsed = warehouses.reduce(
    (sum, w) => sum + (w.capacity?.usedSlots || 0),
    0,
  );

  return {
    total: warehouses.length,
    active: activeWarehouses.length,
    totalCapacity,
    avgUtilization: totalCapacity > 0 ? (totalUsed / totalCapacity) * 100 : 0,
  };
}
