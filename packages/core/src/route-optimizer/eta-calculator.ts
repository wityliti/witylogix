/**
 * ETA (Estimated Time of Arrival) calculator for delivery routes.
 *
 * Computes:
 * - Base travel time from distance matrix
 * - Service time at stops
 * - Traffic delays
 * - Safety buffers
 * - Arrival time estimates
 */

import type { GeoPoint, DistanceMatrix, ETAResult, Stop } from "./types.js";
import { estimateTravelTime } from "./distance-matrix.js";

/**
 * Configuration for ETA calculation.
 */
export interface ETAConfiguration {
  /** Average speed in km/h */
  speedKmh: number;

  /** Safety buffer as percentage of travel time (0-1) */
  safetyBufferPercent: number;

  /** Confidence level for estimates (0-1) */
  confidence: number;

  /** Traffic factor multiplier */
  trafficFactor: number;
}

/**
 * Default ETA configuration.
 */
const DEFAULT_CONFIG: ETAConfiguration = {
  speedKmh: 60,
  safetyBufferPercent: 0.15, // 15% buffer
  confidence: 0.85,
  trafficFactor: 1.0,
};

/**
 * Calculate ETA from one point to another.
 *
 * Considers:
 * - Base travel time (from distance)
 * - Service time at destination
 * - Traffic delays
 * - Safety buffer
 *
 * @param from - Starting point
 * @param to - Destination point
 * @param departureTime - Time leaving the origin
 * @param serviceTime - Service duration in minutes
 * @param config - ETA configuration
 * @returns Complete ETA result
 *
 * @example
 * const eta = calculateETA(
 *   { latitude: 40.7128, longitude: -74.0060 },
 *   { latitude: 40.7580, longitude: -73.9855 },
 *   new Date(),
 *   5, // 5 minute service
 *   { speedKmh: 60, safetyBufferPercent: 0.15, confidence: 0.85, trafficFactor: 1.2 }
 * );
 */
export function calculateETA(
  from: GeoPoint,
  to: GeoPoint,
  departureTime: Date,
  serviceTime: number,
  config: Partial<ETAConfiguration> = {}
): ETAResult {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Calculate travel time
  const baseTravelTimeSeconds = estimateTravelTime(
    from,
    to,
    finalConfig.speedKmh,
    finalConfig.trafficFactor
  );

  // Traffic delay
  const trafficDelaySeconds = baseTravelTimeSeconds * (finalConfig.trafficFactor - 1);

  // Service time
  const serviceTimeSeconds = serviceTime * 60;

  // Safety buffer (applied to travel time)
  const bufferSeconds = baseTravelTimeSeconds * finalConfig.safetyBufferPercent;

  // Total ETA
  const totalETASeconds = baseTravelTimeSeconds + trafficDelaySeconds + bufferSeconds + serviceTimeSeconds;

  // Estimated arrival time
  const estimatedArrivalTime = new Date(departureTime.getTime() + totalETASeconds * 1000);

  return {
    baseTravelTimeSeconds,
    serviceTimeSeconds,
    trafficDelaySeconds,
    bufferSeconds,
    totalETASeconds,
    estimatedArrivalTime,
    confidence: finalConfig.confidence,
  };
}

/**
 * Calculate ETA using a pre-computed distance matrix.
 *
 * More efficient when working with multiple routes/stops,
 * as the matrix is computed once and reused.
 *
 * @param fromIndex - Index of origin in distance matrix
 * @param toIndex - Index of destination in distance matrix
 * @param departureTime - Time leaving the origin
 * @param serviceTime - Service duration in minutes
 * @param matrix - Pre-computed distance matrix
 * @param config - ETA configuration
 * @returns Complete ETA result
 */
export function calculateETAFromMatrix(
  fromIndex: number,
  toIndex: number,
  departureTime: Date,
  serviceTime: number,
  matrix: DistanceMatrix,
  config: Partial<ETAConfiguration> = {}
): ETAResult {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (fromIndex < 0 || fromIndex >= matrix.points.length) {
    throw new Error(`Invalid from index: ${fromIndex}`);
  }
  if (toIndex < 0 || toIndex >= matrix.points.length) {
    throw new Error(`Invalid to index: ${toIndex}`);
  }

  // Get base travel time from matrix (already in seconds)
  let baseTravelTimeSeconds = matrix.durations[fromIndex][toIndex];

  // Apply custom speed if different from matrix
  if (finalConfig.speedKmh !== DEFAULT_CONFIG.speedKmh) {
    const distanceMeters = matrix.distances[fromIndex][toIndex];
    baseTravelTimeSeconds = estimateTravelTime(
      matrix.points[fromIndex],
      matrix.points[toIndex],
      finalConfig.speedKmh,
      1.0
    );
  }

  // Traffic delay
  const trafficDelaySeconds = baseTravelTimeSeconds * (finalConfig.trafficFactor - 1);

  // Service time
  const serviceTimeSeconds = serviceTime * 60;

  // Safety buffer (applied to travel time)
  const bufferSeconds = baseTravelTimeSeconds * finalConfig.safetyBufferPercent;

  // Total ETA
  const totalETASeconds = baseTravelTimeSeconds + trafficDelaySeconds + bufferSeconds + serviceTimeSeconds;

  // Estimated arrival time
  const estimatedArrivalTime = new Date(departureTime.getTime() + totalETASeconds * 1000);

  return {
    baseTravelTimeSeconds,
    serviceTimeSeconds,
    trafficDelaySeconds,
    bufferSeconds,
    totalETASeconds,
    estimatedArrivalTime,
    confidence: finalConfig.confidence,
  };
}

/**
 * Recalculate ETA from current position.
 *
 * Useful for real-time tracking updates.
 * Adjusts ETA based on actual progress.
 *
 * @param currentPosition - Current geographic position
 * @param nextStop - Next stop destination
 * @param currentTime - Current time (for calculating remaining time)
 * @param remainingStops - Remaining stops after next
 * @param matrix - Distance matrix for quick lookup
 * @param config - ETA configuration
 * @returns Updated ETA result
 */
export function recalculateETAFromPosition(
  currentPosition: GeoPoint,
  nextStop: Stop,
  currentTime: Date,
  remainingStops: Stop[],
  matrix: DistanceMatrix,
  config: Partial<ETAConfiguration> = {}
): ETAResult {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Calculate ETA to next stop from current position
  const eta = calculateETA(
    currentPosition,
    nextStop.location,
    currentTime,
    nextStop.serviceDuration,
    finalConfig
  );

  // If there are remaining stops, adjust confidence (less certain for far-future arrivals)
  if (remainingStops.length > 0) {
    const adjustedConfidence = Math.max(0.5, finalConfig.confidence - remainingStops.length * 0.05);
    return {
      ...eta,
      confidence: adjustedConfidence,
    };
  }

  return eta;
}

/**
 * Validate an ETA result for consistency.
 *
 * Checks that all time components sum correctly
 * and values are non-negative.
 *
 * @param eta - ETA result to validate
 * @throws Error if validation fails
 */
export function validateETAResult(eta: ETAResult): void {
  if (eta.baseTravelTimeSeconds < 0) {
    throw new Error("Base travel time cannot be negative");
  }
  if (eta.serviceTimeSeconds < 0) {
    throw new Error("Service time cannot be negative");
  }
  if (eta.trafficDelaySeconds < 0) {
    throw new Error("Traffic delay cannot be negative");
  }
  if (eta.bufferSeconds < 0) {
    throw new Error("Buffer cannot be negative");
  }
  if (eta.confidence < 0 || eta.confidence > 1) {
    throw new Error("Confidence must be between 0 and 1");
  }

  // Verify total is sum of parts
  const expectedTotal =
    eta.baseTravelTimeSeconds + eta.trafficDelaySeconds + eta.bufferSeconds + eta.serviceTimeSeconds;
  const tolerance = 1; // 1 second tolerance for floating point errors
  if (Math.abs(eta.totalETASeconds - expectedTotal) > tolerance) {
    throw new Error(
      `ETA total (${eta.totalETASeconds}) does not match sum of components (${expectedTotal})`
    );
  }
}

/**
 * Format ETA result as human-readable string.
 *
 * @param eta - ETA result
 * @returns Formatted string
 *
 * @example
 * const eta = calculateETA(...);
 * console.log(formatETAForDisplay(eta));
 * // Output: "5m 30s (arrival: 14:32, confidence: 85%)"
 */
export function formatETAForDisplay(eta: ETAResult): string {
  const totalMinutes = Math.floor(eta.totalETASeconds / 60);
  const totalSeconds = Math.floor(eta.totalETASeconds % 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  let timeStr = "";
  if (hours > 0) {
    timeStr = `${hours}h ${minutes}m`;
  } else {
    timeStr = `${minutes}m ${totalSeconds}s`;
  }

  const arrivalStr = eta.estimatedArrivalTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const confidencePercent = Math.round(eta.confidence * 100);

  return `${timeStr} (arrival: ${arrivalStr}, confidence: ${confidencePercent}%)`;
}

/**
 * Create a modified ETA configuration based on current conditions.
 *
 * Useful for adjusting ETAs based on real-time traffic or time of day.
 *
 * @param baseConfig - Base configuration
 * @param peakHourFactor - Traffic factor for peak hours (default: 1.3)
 * @param currentTime - Current time to determine if peak hours
 * @returns Modified configuration
 */
export function adjustETAConfigForTime(
  baseConfig: Partial<ETAConfiguration>,
  peakHourFactor: number = 1.3,
  currentTime: Date = new Date()
): ETAConfiguration {
  const finalConfig = { ...DEFAULT_CONFIG, ...baseConfig };
  const hour = currentTime.getHours();

  // Peak hours: 8-10am, 12-1pm, 5-7pm
  const isPeakHour =
    (hour >= 8 && hour < 10) || (hour >= 12 && hour < 13) || (hour >= 17 && hour < 19);

  if (isPeakHour) {
    finalConfig.trafficFactor *= peakHourFactor;
    finalConfig.confidence = Math.max(0.5, finalConfig.confidence - 0.1);
  }

  return finalConfig;
}
