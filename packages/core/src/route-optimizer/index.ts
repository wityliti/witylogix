/**
 * Route Optimization Engine for Witylogix
 *
 * Provides route optimization, ETA calculation, and distance matrix management.
 *
 * Key Components:
 * - RouteOptimizer: Main optimization engine with multiple algorithms
 * - Distance Matrix Calculator: Efficient distance/duration computation with caching
 * - ETA Calculator: Arrival time predictions with traffic factors
 *
 * Usage:
 * ```typescript
 * import { RouteOptimizer } from '@witylogix/core/route-optimizer';
 *
 * const optimizer = new RouteOptimizer();
 * const result = await optimizer.optimize({
 *   depot: { latitude: 40.7128, longitude: -74.0060 },
 *   stops: [...],
 *   vehicleCount: 3,
 *   constraints: { respectTimeWindows: true }
 * });
 * ```
 */

export * from "./types.js";
export * from "./distance-matrix.js";
export * from "./eta-calculator.js";
export { RouteOptimizer } from "./optimizer.js";
