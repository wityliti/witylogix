/**
 * Clarke-Wright savings algorithm for the Vehicle Routing Problem (VRP).
 *
 * The algorithm merges individual routes (each stop its own route initially)
 * by greedily selecting the merge with the highest "savings" value.
 * Savings = distance to depot from stop i + distance to depot from stop j
 *         - distance between stops i and j
 *
 * This approach naturally balances workload across vehicles and respects
 * capacity constraints, making it well-suited for real-world delivery problems.
 *
 * Time complexity: O(n² log n) for computing and sorting savings
 * Space complexity: O(n²)
 */

import type { OptimizationStop, Vehicle } from "../constraints.js";
import { checkCapacity } from "../constraints.js";

/**
 * Represents a merge candidate (savings) between two routes.
 */
interface SavingsPair {
  i: number; // Stop index i
  j: number; // Stop index j
  saving: number; // Savings value (higher = better)
  iEndsRoute: number; // Index of route ending with stop i
  jStartsRoute: number; // Index of route starting with stop j
}

/**
 * Apply Clarke-Wright savings algorithm to build multi-vehicle routes.
 *
 * Algorithm:
 * 1. Start with each stop as its own route (from depot to stop and back)
 * 2. Compute savings s[i][j] for merging routes ending at stop i with routes starting at stop j
 * 3. Sort savings in descending order
 * 4. For each saving in order:
 *    a. If the merge is feasible (vehicle capacity, time window, etc.)
 *    b. Merge the two routes
 * 5. Return the final set of routes, one per vehicle
 *
 * @param stops - All stops to visit
 * @param depot - Warehouse location
 * @param vehicles - Available vehicles
 * @param distanceMatrix - Pre-computed distance matrix (including depot at index 0)
 * @returns Array of routes, one per vehicle (unassigned stops may be included)
 *
 * @example
 * const routes = clarkeWrightSavings(stops, depot, vehicles, distanceMatrix);
 * // Returns merged routes respecting capacity and vehicle constraints
 */
export function clarkeWrightSavings(
  stops: OptimizationStop[],
  depot: { lat: number; lng: number },
  vehicles: Vehicle[],
  distanceMatrix: number[][],
): number[][] {
  const n = stops.length;

  if (n === 0) {
    return [];
  }

  if (vehicles.length === 0) {
    // No vehicles, can't assign anything
    return [];
  }

  // Start with each stop as its own route
  // routes[i] contains the stop indices for route i
  const routes: number[][] = stops.map((_, i) => [i]);

  // Track which vehicle is assigned to each route (if any)
  const routeToVehicle: number[] = Array(n).fill(-1);

  // Compute savings matrix
  const savingsList: SavingsPair[] = [];

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const saving = computeSaving(distanceMatrix, i, j);
        if (saving > 0) {
          savingsList.push({
            i,
            j,
            saving,
            iEndsRoute: i,
            jStartsRoute: j,
          });
        }
      }
    }
  }

  // Sort savings in descending order
  savingsList.sort((a, b) => b.saving - a.saving);

  // Merge routes greedily
  for (const pair of savingsList) {
    const routeI = findRouteContaining(routes, pair.i);
    const routeJ = findRouteContaining(routes, pair.j);

    if (routeI === routeJ || routeI === -1 || routeJ === -1) {
      // Can't merge routes that are the same or if stop not found
      continue;
    }

    // Check if we can merge these routes
    if (
      canMergeRoutes(
        routes[routeI],
        routes[routeJ],
        stops,
        vehicles,
        distanceMatrix,
      )
    ) {
      // Merge route J into route I (append)
      routes[routeI] = [...routes[routeI], ...routes[routeJ]];
      routes[routeJ] = [];
    }
  }

  // Remove empty routes and filter to valid assignments
  return routes.filter((route) => route.length > 0);
}

/**
 * Compute the Clarke-Wright savings for merging two stops.
 *
 * Savings = distance(depot, i) + distance(depot, j) - distance(i, j)
 *
 * @param distanceMatrix - Distance matrix with depot at index 0
 * @param i - First stop index (1-indexed in the matrix, 0 = depot)
 * @param j - Second stop index
 * @returns Savings value
 */
function computeSaving(
  distanceMatrix: number[][],
  i: number,
  j: number,
): number {
  // In distanceMatrix, depot is at index 0, stops at 1 onwards
  const depotIndex = 0;

  const distDepotI = distanceMatrix[depotIndex][i + 1]; // +1 because stops are offset
  const distDepotJ = distanceMatrix[depotIndex][j + 1];
  const distIJ = distanceMatrix[i + 1][j + 1];

  return distDepotI + distDepotJ - distIJ;
}

/**
 * Find which route contains a given stop index.
 *
 * @param routes - Array of routes
 * @param stopIndex - Stop index to find
 * @returns Route index, or -1 if not found
 */
function findRouteContaining(routes: number[][], stopIndex: number): number {
  for (let r = 0; r < routes.length; r++) {
    if (routes[r].includes(stopIndex)) {
      return r;
    }
  }
  return -1;
}

/**
 * Check if two routes can be merged given constraints.
 *
 * Simplified feasibility check:
 * - Check if combined weight/volume exceeds a reasonable limit
 * - In a full implementation, would also check time windows, skills, etc.
 *
 * @param route1 - First route (stop indices)
 * @param route2 - Second route (stop indices)
 * @param stops - All stops
 * @param vehicles - Available vehicles
 * @param distanceMatrix - Distance matrix
 * @returns true if routes can be merged, false otherwise
 */
function canMergeRoutes(
  route1: number[],
  route2: number[],
  stops: OptimizationStop[],
  vehicles: Vehicle[],
  distanceMatrix: number[][],
): boolean {
  // Can't exceed max stops for any vehicle
  const totalStops = route1.length + route2.length;
  const maxStopsPerVehicle = Math.max(...vehicles.map((v) => v.maxStops));

  if (totalStops > maxStopsPerVehicle) {
    return false;
  }

  // Check if combined stops fit in largest vehicle capacity
  const combinedStops = [
    ...route1.map((idx) => stops[idx]),
    ...route2.map((idx) => stops[idx]),
  ];

  const largestVehicle = vehicles.reduce((prev, current) =>
    current.capacity.weight > prev.capacity.weight ? current : prev,
  );

  return checkCapacity(largestVehicle, combinedStops);
}

/**
 * Assign routes to vehicles trying to balance workload and respect constraints.
 *
 * Uses a greedy assignment: for each route, assign to the vehicle with
 * the most remaining capacity.
 *
 * @param routes - Routes from Clarke-Wright (each route is array of stop indices)
 * @param stops - All stops
 * @param vehicles - Available vehicles
 * @returns Assignment of routes to vehicle indices (or -1 if unassigned)
 */
export function assignRoutesToVehicles(
  routes: number[][],
  stops: OptimizationStop[],
  vehicles: Vehicle[],
): number[] {
  const routeToVehicle: number[] = Array(routes.length).fill(-1);
  const vehicleUsed = Array(vehicles.length).fill(false);
  const vehicleLoads: Array<{ weight: number; volume: number }> = vehicles.map(
    () => ({
      weight: 0,
      volume: 0,
    }),
  );

  // Sort routes by size (largest first) for better packing
  const sortedRouteIndices = routes
    .map((_, i) => i)
    .sort((a, b) => routes[b].length - routes[a].length);

  for (const routeIdx of sortedRouteIndices) {
    const route = routes[routeIdx];
    const routeStops = route.map((idx) => stops[idx]);

    let bestVehicle = -1;
    let bestRemainingCapacity = -Infinity;

    // Find vehicle with best fit (most remaining capacity after assignment)
    for (let v = 0; v < vehicles.length; v++) {
      const vehicle = vehicles[v];

      // Calculate load if we assign this route
      let routeWeight = 0;
      let routeVolume = 0;
      for (const stop of routeStops) {
        routeWeight += stop.weight ?? 0;
        routeVolume += stop.volume ?? 0;
      }

      const newWeight = vehicleLoads[v].weight + routeWeight;
      const newVolume = vehicleLoads[v].volume + routeVolume;

      // Check if this vehicle can take the route
      if (
        newWeight <= vehicle.capacity.weight &&
        newVolume <= vehicle.capacity.volume &&
        route.length <= vehicle.maxStops
      ) {
        const remainingCapacity = vehicle.capacity.weight - newWeight;

        if (remainingCapacity > bestRemainingCapacity) {
          bestRemainingCapacity = remainingCapacity;
          bestVehicle = v;
        }
      }
    }

    if (bestVehicle >= 0) {
      routeToVehicle[routeIdx] = bestVehicle;
      vehicleUsed[bestVehicle] = true;

      // Update vehicle load
      for (const stop of routeStops) {
        vehicleLoads[bestVehicle].weight += stop.weight ?? 0;
        vehicleLoads[bestVehicle].volume += stop.volume ?? 0;
      }
    }
    // else: route remains unassigned
  }

  return routeToVehicle;
}

/**
 * Calculate total savings from a solution.
 *
 * @param routes - Routes (each is array of stop indices)
 * @param distanceMatrix - Distance matrix
 * @returns Total distance of all routes
 */
export function calculateTotalDistance(
  routes: number[][],
  distanceMatrix: number[][],
): number {
  let totalDistance = 0;

  for (const route of routes) {
    // Add distance from depot to first stop
    if (route.length > 0) {
      totalDistance += distanceMatrix[0][route[0] + 1];

      // Add distances between consecutive stops
      for (let i = 0; i < route.length - 1; i++) {
        totalDistance += distanceMatrix[route[i] + 1][route[i + 1] + 1];
      }

      // Add distance from last stop back to depot
      totalDistance += distanceMatrix[route[route.length - 1] + 1][0];
    }
  }

  return totalDistance;
}
