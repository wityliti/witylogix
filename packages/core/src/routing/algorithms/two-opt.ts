/**
 * 2-opt local search algorithm for the Traveling Salesman Problem.
 *
 * Improves an existing route by reversing sub-tours.
 * A 2-opt move removes two edges and reconnects the tour,
 * potentially reducing total distance.
 *
 * This is a simple but effective local search that can significantly
 * improve a nearest-neighbor initial solution.
 *
 * Time complexity: O(n²) per iteration, typically 10-100 iterations
 * Space complexity: O(n)
 */

/**
 * Apply 2-opt improvements to an existing route.
 *
 * The algorithm:
 * 1. Take the current route
 * 2. Try reversing every possible sub-tour segment
 * 3. If reversal reduces total distance, accept it
 * 4. Repeat until no improvement found or max iterations reached
 *
 * The depot (first and last element) is never moved.
 *
 * @param route - Initial route as array of indices (including depot at start/end)
 * @param distanceMatrix - n×n distance matrix
 * @param maxIterations - Maximum number of improvement iterations (default: 100)
 * @returns Improved route with same depot positions
 *
 * @example
 * const initialRoute = [0, 1, 3, 2, 0];  // depot->1->3->2->depot
 * const improved = twoOpt(initialRoute, distanceMatrix, 100);
 * // Could return [0, 2, 3, 1, 0] with lower total distance
 */
export function twoOpt(
  route: number[],
  distanceMatrix: number[][],
  maxIterations: number = 100,
): number[] {
  // Make a copy to avoid modifying the input
  let currentRoute = [...route];
  let improved = true;
  let iteration = 0;

  while (improved && iteration < maxIterations) {
    improved = false;
    iteration++;

    // Try all possible 2-opt swaps
    // Skip the depot positions (0 and length-1)
    for (let i = 1; i < currentRoute.length - 2; i++) {
      for (let j = i + 2; j < currentRoute.length - 1; j++) {
        const delta = calculateTwoOptDelta(currentRoute, distanceMatrix, i, j);

        if (delta < -1e-10) {
          // Significant improvement found
          currentRoute = reverseTour(currentRoute, i, j);
          improved = true;
        }
      }
    }
  }

  return currentRoute;
}

/**
 * Calculate the change in tour length from a 2-opt move.
 * Negative delta means the move improves the tour.
 *
 * When we 2-opt edges (i, i+1) and (j, j+1), we:
 * - Remove: distance[route[i]][route[i+1]] + distance[route[j]][route[j+1]]
 * - Add:    distance[route[i]][route[j]] + distance[route[i+1]][route[j+1]]
 *
 * @param route - Current route
 * @param distanceMatrix - Distance matrix
 * @param i - First edge endpoint index
 * @param j - Second edge endpoint index (must have j > i+1)
 * @returns Change in total distance (negative = improvement)
 */
function calculateTwoOptDelta(
  route: number[],
  distanceMatrix: number[][],
  i: number,
  j: number,
): number {
  const a = route[i];
  const b = route[i + 1];
  const c = route[j];
  const d = route[j + 1];

  // Current edges
  const currentDistance = distanceMatrix[a][b] + distanceMatrix[c][d];

  // New edges after 2-opt (segment i+1...j gets reversed)
  const newDistance = distanceMatrix[a][c] + distanceMatrix[b][d];

  return newDistance - currentDistance;
}

/**
 * Reverse a segment of the tour (2-opt move).
 *
 * Reverses the sub-tour from index i+1 to j (inclusive).
 *
 * @param route - Current route
 * @param i - Start edge index
 * @param j - End edge index
 * @returns New route with reversed segment
 */
function reverseTour(route: number[], i: number, j: number): number[] {
  const newRoute = route.slice();

  // Reverse the segment from i+1 to j
  let left = i + 1;
  let right = j;

  while (left < right) {
    [newRoute[left], newRoute[right]] = [newRoute[right], newRoute[left]];
    left++;
    right--;
  }

  return newRoute;
}

/**
 * Apply 2-opt with first-improvement strategy.
 * Accepts the first improvement found and restarts, rather than
 * trying all possibilities before accepting. Often faster in practice.
 *
 * @param route - Initial route
 * @param distanceMatrix - Distance matrix
 * @param maxIterations - Maximum improvement iterations
 * @returns Improved route
 */
export function twoOptFirstImprovement(
  route: number[],
  distanceMatrix: number[][],
  maxIterations: number = 100,
): number[] {
  let currentRoute = [...route];
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;
    let foundImprovement = false;

    // Try all possible 2-opt swaps, return immediately on first improvement
    for (let i = 1; i < currentRoute.length - 2 && !foundImprovement; i++) {
      for (let j = i + 2; j < currentRoute.length - 1 && !foundImprovement; j++) {
        const delta = calculateTwoOptDelta(currentRoute, distanceMatrix, i, j);

        if (delta < -1e-10) {
          currentRoute = reverseTour(currentRoute, i, j);
          foundImprovement = true;
        }
      }
    }

    // If no improvement found in this pass, we're done
    if (!foundImprovement) {
      break;
    }
  }

  return currentRoute;
}

/**
 * Apply 2-opt with best-improvement strategy.
 * Finds the single best move in each iteration before accepting.
 * Often finds better solutions but requires more computation.
 *
 * @param route - Initial route
 * @param distanceMatrix - Distance matrix
 * @param maxIterations - Maximum improvement iterations
 * @returns Improved route
 */
export function twoOptBestImprovement(
  route: number[],
  distanceMatrix: number[][],
  maxIterations: number = 100,
): number[] {
  let currentRoute = [...route];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let bestDelta = -1e-10; // Only accept improvements
    let bestI = -1;
    let bestJ = -1;

    // Find the best 2-opt move
    for (let i = 1; i < currentRoute.length - 2; i++) {
      for (let j = i + 2; j < currentRoute.length - 1; j++) {
        const delta = calculateTwoOptDelta(currentRoute, distanceMatrix, i, j);

        if (delta < bestDelta) {
          bestDelta = delta;
          bestI = i;
          bestJ = j;
        }
      }
    }

    // If no improvement found, we're done
    if (bestI === -1) {
      break;
    }

    // Apply the best move
    currentRoute = reverseTour(currentRoute, bestI, bestJ);
  }

  return currentRoute;
}

/**
 * Calculate total tour distance.
 *
 * @param route - Route as array of indices
 * @param distanceMatrix - Distance matrix
 * @returns Total distance
 */
export function calculateTourDistance(route: number[], distanceMatrix: number[][]): number {
  let totalDistance = 0;

  for (let i = 0; i < route.length - 1; i++) {
    totalDistance += distanceMatrix[route[i]][route[i + 1]];
  }

  return totalDistance;
}
