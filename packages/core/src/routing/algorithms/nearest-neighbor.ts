/**
 * Nearest-neighbor algorithm for the Traveling Salesman Problem (TSP).
 *
 * Builds an initial solution by greedily selecting the closest unvisited stop
 * at each step. This provides a reasonable starting point for local search
 * improvements (e.g., 2-opt).
 *
 * Time complexity: O(n²)
 * Space complexity: O(n)
 */

/**
 * Build a nearest-neighbor route starting from a depot.
 *
 * The algorithm:
 * 1. Start at the depot (index 0 in distance matrix)
 * 2. From current location, find the closest unvisited stop
 * 3. Move to that stop and mark as visited
 * 4. Repeat until all stops are visited
 * 5. Return to depot
 *
 * @param distanceMatrix - n×n matrix of distances between all points (including depot at index 0)
 * @param depotIndex - Index of the depot in the distance matrix (default: 0)
 * @returns Array of indices representing the route order (includes depot at start and end)
 *
 * @example
 * const matrix = [
 *   [0,   10, 15, 20],  // depot
 *   [10,  0,  35, 25],  // stop 1
 *   [15,  35, 0,  30],  // stop 2
 *   [20,  25, 30, 0]    // stop 3
 * ];
 * const route = nearestNeighbor(matrix, 0);
 * // Could return [0, 1, 3, 2, 0] (depot -> stop1 -> stop3 -> stop2 -> depot)
 */
export function nearestNeighbor(
  distanceMatrix: number[][],
  depotIndex: number = 0,
): number[] {
  const n = distanceMatrix.length;

  if (n === 0) {
    return [];
  }

  if (n === 1) {
    return [depotIndex];
  }

  if (depotIndex < 0 || depotIndex >= n) {
    throw new Error(`Invalid depot index: ${depotIndex}`);
  }

  const route: number[] = [depotIndex];
  const visited = new Set<number>();
  visited.add(depotIndex);

  let currentIndex = depotIndex;

  // Visit all remaining stops
  while (visited.size < n) {
    let nearestIndex = -1;
    let nearestDistance = Infinity;

    // Find the closest unvisited stop
    for (let i = 0; i < n; i++) {
      if (
        !visited.has(i) &&
        distanceMatrix[currentIndex][i] < nearestDistance
      ) {
        nearestDistance = distanceMatrix[currentIndex][i];
        nearestIndex = i;
      }
    }

    if (nearestIndex === -1) {
      // This shouldn't happen if distanceMatrix is valid
      throw new Error(
        "Could not find nearest neighbor (distance matrix may be invalid)",
      );
    }

    route.push(nearestIndex);
    visited.add(nearestIndex);
    currentIndex = nearestIndex;
  }

  // Return to depot
  route.push(depotIndex);

  return route;
}

/**
 * Build multiple nearest-neighbor routes starting from different initial stops.
 * Returns the best route found across all starting points.
 *
 * This approach improves solution quality by trying different greedy sequences
 * and selecting the one with minimum total distance.
 *
 * Time complexity: O(n³)
 *
 * @param distanceMatrix - n×n distance matrix (including depot)
 * @param depotIndex - Index of the depot (default: 0)
 * @param numTries - Number of different starting points to try (default: all unique stops)
 * @returns The best route found (array of indices)
 *
 * @example
 * const bestRoute = multiStartNearestNeighbor(matrix, 0, 3);
 * // Tries starting from depot and first 3 non-depot stops, returns best
 */
export function multiStartNearestNeighbor(
  distanceMatrix: number[][],
  depotIndex: number = 0,
  numTries?: number,
): number[] {
  const n = distanceMatrix.length;

  if (n <= 1) {
    return [depotIndex];
  }

  const tries = numTries ?? n - 1; // Try all non-depot stops by default
  const nonDepotIndices = Array.from({ length: n }, (_, i) => i).filter(
    (i) => i !== depotIndex,
  );

  let bestRoute = nearestNeighbor(distanceMatrix, depotIndex);
  let bestDistance = calculateRouteCost(bestRoute, distanceMatrix);

  // Try starting from each non-depot stop
  for (let t = 0; t < Math.min(tries, nonDepotIndices.length); t++) {
    const startIndex = nonDepotIndices[t];
    const route = nearestNeighborFromStart(
      distanceMatrix,
      depotIndex,
      startIndex,
    );
    const distance = calculateRouteCost(route, distanceMatrix);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestRoute = route;
    }
  }

  return bestRoute;
}

/**
 * Nearest-neighbor starting from a specific stop (not the depot).
 *
 * After visiting all stops, returns to the depot.
 *
 * @param distanceMatrix - n×n distance matrix
 * @param depotIndex - Index of the depot
 * @param startIndex - Index of the stop to start from (must not be depot)
 * @returns Route starting and ending at depot, with initial stop being startIndex
 */
export function nearestNeighborFromStart(
  distanceMatrix: number[][],
  depotIndex: number,
  startIndex: number,
): number[] {
  const n = distanceMatrix.length;

  if (startIndex === depotIndex) {
    return nearestNeighbor(distanceMatrix, depotIndex);
  }

  const route: number[] = [depotIndex, startIndex];
  const visited = new Set<number>();
  visited.add(depotIndex);
  visited.add(startIndex);

  let currentIndex = startIndex;

  // Visit remaining stops
  while (visited.size < n) {
    let nearestIndex = -1;
    let nearestDistance = Infinity;

    for (let i = 0; i < n; i++) {
      if (
        !visited.has(i) &&
        distanceMatrix[currentIndex][i] < nearestDistance
      ) {
        nearestDistance = distanceMatrix[currentIndex][i];
        nearestIndex = i;
      }
    }

    if (nearestIndex === -1) {
      throw new Error("Could not find nearest neighbor");
    }

    route.push(nearestIndex);
    visited.add(nearestIndex);
    currentIndex = nearestIndex;
  }

  // Return to depot
  route.push(depotIndex);

  return route;
}

/**
 * Calculate the total cost (distance) of a route.
 *
 * @param route - Array of indices representing the route
 * @param distanceMatrix - n×n distance matrix
 * @returns Total distance of the route
 */
function calculateRouteCost(
  route: number[],
  distanceMatrix: number[][],
): number {
  let totalCost = 0;

  for (let i = 0; i < route.length - 1; i++) {
    totalCost += distanceMatrix[route[i]][route[i + 1]];
  }

  return totalCost;
}
