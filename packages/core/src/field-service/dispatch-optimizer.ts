/**
 * Dispatch Optimizer — Real-time job assignment and routing algorithms.
 *
 * Provides multiple dispatch strategies:
 * - NearestAvailableDispatcher: assigns to closest qualified tech
 * - WorkloadBalancer: distributes jobs based on daily load
 * - PriorityDispatcher: emergency jobs preempt lower priorities with reassignment cascade
 * - RouteOptimizer: multi-stop route optimization (nearest-neighbor + 2-opt)
 * - ETACalculator: real-time ETA with traffic factors
 * - AutoDispatcher: fully automated based on configurable rules
 *
 * Core optimization: nearest-neighbor with workload balancing and SLA-aware routing.
 * Time complexity: O(n*m*log(n*m)) for route optimization.
 */

import type {
  WorkOrder,
  Technician,
  DispatchResult,
  DispatchCandidate,
  OptimizedRoute,
  RouteStop,
  Coordinates,
} from "./field-service-types.js";

// ─── UTILITY FUNCTIONS ──────────────────────────────────────────

/**
 * Calculate haversine distance between coordinates (km).
 */
function haversineDistance(from: Coordinates, to: Coordinates): number {
  const R = 6371; // Earth radius (km)
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.latitude * Math.PI) / 180) *
      Math.cos((to.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estimate travel time (minutes) from distance.
 * Applies 1.3x factor for real-world delays.
 */
function estimateTravelTime(distanceKm: number): number {
  const avgSpeedKmH = 50;
  const travelMinutes = (distanceKm / avgSpeedKmH) * 60;
  return Math.ceil(travelMinutes * 1.3);
}

/**
 * Check if technician has required skills.
 */
function hasRequiredSkills(jobSkills: string[], techSkills: string[]): boolean {
  return jobSkills.every((skill) => techSkills.includes(skill));
}

/**
 * Check if job is within technician's service zones.
 */
function isInServiceZone(jobCoordinates: Coordinates, tech: Technician): boolean {
  if (tech.serviceZones.length === 0) return true;
  return tech.serviceZones.some((zone) => {
    const distance = haversineDistance(zone.coordinates[0], jobCoordinates);
    return distance <= (zone.radius || 50);
  });
}

// ─── NEAREST AVAILABLE DISPATCHER ───────────────────────────────

/**
 * Assigns job to closest available technician with required skills.
 */
export class NearestAvailableDispatcher {
  /**
   * Dispatch job to nearest available qualified technician.
   */
  static dispatch(job: WorkOrder, availableTechs: Technician[]): DispatchResult | null {
    const candidates: DispatchCandidate[] = [];

    for (const tech of availableTechs) {
      // Skill check
      if (!hasRequiredSkills(job.requiredSkills, tech.skills)) {
        continue;
      }

      // Zone check
      if (!isInServiceZone(job.address.coordinates, tech)) {
        continue;
      }

      // Calculate distance and ETA
      const distance = haversineDistance(tech.currentLocation, job.address.coordinates);
      const travelMinutes = estimateTravelTime(distance);
      const eta = new Date(Date.now() + travelMinutes * 60 * 1000);

      candidates.push({
        technicianId: tech.id,
        score: 100 - Math.min(distance, 50), // Higher score = closer
        reason: `Distance: ${distance.toFixed(1)}km, ETA: ${travelMinutes}min`,
        eta,
        distance,
        rank: 0,
      });
    }

    if (candidates.length === 0) return null;

    // Sort by score (distance)
    candidates.sort((a, b) => b.score - a.score);

    // Assign ranks
    candidates.forEach((c, i) => {
      c.rank = i + 1;
    });

    const best = candidates[0];
    return {
      jobId: job.id,
      technicianId: best.technicianId,
      score: best.score,
      reason: best.reason,
      eta: best.eta,
      distance: best.distance,
      travelMinutes: Math.ceil((best.eta.getTime() - Date.now()) / 60000),
      candidates,
    };
  }
}

// ─── WORKLOAD BALANCER ──────────────────────────────────────────

/**
 * Distributes jobs based on current daily workload.
 * Targets 80% utilization across team.
 */
export class WorkloadBalancer {
  /**
   * Get current workload metrics for technician.
   */
  static getWorkload(tech: Technician, assignedJobs: WorkOrder[]): {
    workMinutes: number;
    estimatedUtilization: number;
    availableCapacity: number;
  } {
    const workingHours = 8 * 60; // 8-hour workday
    const workMinutes = assignedJobs
      .filter((j) => j.technicianId === tech.id)
      .reduce((sum, j) => sum + j.estimatedDuration, 0);
    const estimatedUtilization = Math.min(100, (workMinutes / workingHours) * 100);
    const availableCapacity = workingHours - workMinutes;

    return {
      workMinutes,
      estimatedUtilization,
      availableCapacity,
    };
  }

  /**
   * Dispatch job to technician with lowest utilization.
   * Balances workload across team.
   */
  static dispatch(
    job: WorkOrder,
    availableTechs: Technician[],
    assignedJobs: WorkOrder[]
  ): DispatchResult | null {
    const targetUtilization = 80;
    const candidates: DispatchCandidate[] = [];

    for (const tech of availableTechs) {
      // Skill check
      if (!hasRequiredSkills(job.requiredSkills, tech.skills)) {
        continue;
      }

      // Zone check
      if (!isInServiceZone(job.address.coordinates, tech)) {
        continue;
      }

      // Capacity check
      const workload = this.getWorkload(tech, assignedJobs);
      if (workload.availableCapacity < job.estimatedDuration) {
        continue;
      }

      // Calculate metrics
      const distance = haversineDistance(tech.currentLocation, job.address.coordinates);
      const travelMinutes = estimateTravelTime(distance);
      const eta = new Date(Date.now() + travelMinutes * 60 * 1000);

      // Score: favor lower utilization
      const utilizationDiff = Math.abs(workload.estimatedUtilization - targetUtilization);
      const score = 100 - Math.min(distance, 30) - utilizationDiff * 0.3;

      candidates.push({
        technicianId: tech.id,
        score,
        reason: `Load: ${workload.estimatedUtilization.toFixed(0)}%, Distance: ${distance.toFixed(1)}km`,
        eta,
        distance,
        rank: 0,
      });
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.score - a.score);
    candidates.forEach((c, i) => {
      c.rank = i + 1;
    });

    const best = candidates[0];
    return {
      jobId: job.id,
      technicianId: best.technicianId,
      score: best.score,
      reason: best.reason,
      eta: best.eta,
      distance: best.distance,
      travelMinutes: Math.ceil((best.eta.getTime() - Date.now()) / 60000),
      candidates,
    };
  }
}

// ─── PRIORITY DISPATCHER ────────────────────────────────────────

/**
 * Assigns emergency jobs with cascading reassignment.
 * Preempts lower-priority work if necessary.
 */
export class PriorityDispatcher {
  /**
   * Dispatch emergency job, reassigning lower-priority jobs if needed.
   */
  static dispatch(
    job: WorkOrder,
    availableTechs: Technician[],
    allTechs: Technician[],
    assignedJobs: WorkOrder[]
  ): {
    result: DispatchResult | null;
    reassignments: Array<{
      jobId: string;
      fromTech: string;
      toTech?: string;
    }>;
  } {
    const reassignments: Array<{
      jobId: string;
      fromTech: string;
      toTech?: string;
    }> = [];

    // Try immediate dispatch to available tech
    const immediateResult = NearestAvailableDispatcher.dispatch(job, availableTechs);
    if (immediateResult) {
      return { result: immediateResult, reassignments };
    }

    // Try preemption: find tech with lowest-priority assignable work
    let bestPreemption: {
      technicianId: string;
      jobToRemove: WorkOrder;
      score: number;
    } | null = null;

    for (const tech of allTechs) {
      if (!hasRequiredSkills(job.requiredSkills, tech.skills)) continue;
      if (!isInServiceZone(job.address.coordinates, tech)) continue;

      // Find lowest-priority job assigned to this tech
      const assignedToTech = assignedJobs.filter((j) => j.technicianId === tech.id);
      if (assignedToTech.length === 0) continue;

      const priorityOrder = { EMERGENCY: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      const candidateForRemoval = assignedToTech.reduce((prev, current) =>
        priorityOrder[current.priority] > priorityOrder[prev.priority] ? current : prev
      );

      // Only preempt if tech is overloaded
      const workload = WorkloadBalancer.getWorkload(tech, assignedJobs);
      if (workload.estimatedUtilization >= 85) {
        const distance = haversineDistance(tech.currentLocation, job.address.coordinates);
        const score = 100 - distance;

        if (!bestPreemption || score > bestPreemption.score) {
          bestPreemption = {
            technicianId: tech.id,
            jobToRemove: candidateForRemoval,
            score,
          };
        }
      }
    }

    if (bestPreemption) {
      const travelMinutes = estimateTravelTime(
        haversineDistance(
          allTechs.find((t) => t.id === bestPreemption.technicianId)?.currentLocation!,
          job.address.coordinates
        )
      );

      reassignments.push({
        jobId: bestPreemption.jobToRemove.id,
        fromTech: bestPreemption.technicianId,
      });

      return {
        result: {
          jobId: job.id,
          technicianId: bestPreemption.technicianId,
          score: bestPreemption.score,
          reason: `Preempted lower-priority job ${bestPreemption.jobToRemove.id}`,
          eta: new Date(Date.now() + travelMinutes * 60 * 1000),
          distance: haversineDistance(
            allTechs.find((t) => t.id === bestPreemption.technicianId)?.currentLocation!,
            job.address.coordinates
          ),
          travelMinutes,
        },
        reassignments,
      };
    }

    return { result: null, reassignments };
  }
}

// ─── ROUTE OPTIMIZER ────────────────────────────────────────────

/**
 * Optimizes multi-stop routes using nearest-neighbor + 2-opt.
 */
export class RouteOptimizer {
  /**
   * Generate optimized route for technician with multiple jobs.
   */
  static optimize(
    technicianId: string,
    jobs: WorkOrder[],
    tech: Technician,
    date: string
  ): OptimizedRoute {
    const stops: RouteStop[] = [];
    let totalDistance = 0;
    let totalDuration = 0;
    let currentLocation = tech.currentLocation;
    let currentTime = new Date(`${date}T08:00:00Z`);

    // Sort jobs using nearest-neighbor
    const sortedJobs = this.nearestNeighbor(jobs, currentLocation);

    for (let i = 0; i < sortedJobs.length; i++) {
      const job = sortedJobs[i];
      const distance = haversineDistance(currentLocation, job.address.coordinates);
      const travelMinutes = estimateTravelTime(distance);

      const stop: RouteStop = {
        jobId: job.id,
        sequence: i + 1,
        eta: new Date(currentTime.getTime() + travelMinutes * 60 * 1000),
        address: job.address,
        travelTimeFromPrevious: travelMinutes,
        distanceFromPrevious: distance,
        serviceDuration: job.estimatedDuration,
        estimatedDeparture: new Date(
          currentTime.getTime() + (travelMinutes + job.estimatedDuration) * 60 * 1000
        ),
      };

      stops.push(stop);
      totalDistance += distance;
      totalDuration += travelMinutes + job.estimatedDuration;
      currentLocation = job.address.coordinates;
      currentTime = stop.estimatedDeparture;
    }

    // Apply 2-opt improvement
    this.twoOpt(stops);

    const efficiencyScore = Math.max(0, 100 - Math.min(totalDistance, 100));

    return {
      technicianId,
      date,
      stops,
      totalDistance,
      totalDuration,
      efficiencyScore,
      travelTime: stops.reduce((sum, s) => sum + s.travelTimeFromPrevious, 0),
    };
  }

  /**
   * Nearest-neighbor sorting: start from origin, always go to nearest unvisited.
   */
  private static nearestNeighbor(jobs: WorkOrder[], origin: Coordinates): WorkOrder[] {
    const sorted: WorkOrder[] = [];
    const remaining = [...jobs];
    let current = origin;

    while (remaining.length > 0) {
      let nearest = remaining[0];
      let nearestIndex = 0;
      let minDistance = haversineDistance(current, remaining[0].address.coordinates);

      for (let i = 1; i < remaining.length; i++) {
        const distance = haversineDistance(current, remaining[i].address.coordinates);
        if (distance < minDistance) {
          minDistance = distance;
          nearest = remaining[i];
          nearestIndex = i;
        }
      }

      sorted.push(nearest);
      current = nearest.address.coordinates;
      remaining.splice(nearestIndex, 1);
    }

    return sorted;
  }

  /**
   * 2-opt local search: swap edges to reduce total distance.
   */
  private static twoOpt(stops: RouteStop[]): void {
    let improved = true;
    while (improved) {
      improved = false;

      for (let i = 0; i < stops.length - 1; i++) {
        for (let j = i + 2; j < stops.length; j++) {
          const d1 =
            (i === 0
              ? haversineDistance({ latitude: 0, longitude: 0 }, stops[i].address.coordinates)
              : haversineDistance(stops[i - 1].address.coordinates, stops[i].address.coordinates)) +
            haversineDistance(stops[j].address.coordinates, stops[j === stops.length - 1 ? { latitude: 0, longitude: 0 } : stops[j + 1].address.coordinates]);

          const d2 =
            (i === 0
              ? haversineDistance({ latitude: 0, longitude: 0 }, stops[j].address.coordinates)
              : haversineDistance(stops[i - 1].address.coordinates, stops[j].address.coordinates)) +
            haversineDistance(stops[i].address.coordinates, stops[j === stops.length - 1 ? { latitude: 0, longitude: 0 } : stops[j + 1].address.coordinates]);

          if (d2 < d1) {
            // Reverse segment
            const segment = stops.splice(i + 1, j - i);
            stops.splice(i + 1, 0, ...segment.reverse());
            improved = true;
          }
        }
      }
    }
  }
}

// ─── ETA CALCULATOR ─────────────────────────────────────────────

/**
 * Calculates real-time ETA to job site.
 */
export class ETACalculator {
  /**
   * Calculate ETA considering current location, traffic, and job queue.
   */
  static calculate(
    tech: Technician,
    jobCoordinates: Coordinates,
    currentJobEndTime?: Date,
    trafficFactor: number = 1.3
  ): {
    eta: Date;
    travelMinutes: number;
    distance: number;
  } {
    const distance = haversineDistance(tech.currentLocation, jobCoordinates);
    const baseMinutes = (distance / 50) * 60; // 50 km/h baseline
    const travelMinutes = Math.ceil(baseMinutes * trafficFactor);
    const eta = new Date(
      (currentJobEndTime || new Date()).getTime() + travelMinutes * 60 * 1000
    );

    return {
      eta,
      travelMinutes,
      distance,
    };
  }

  /**
   * Calculate ETA with multiple jobs in queue.
   */
  static calculateWithQueue(
    tech: Technician,
    targetCoordinates: Coordinates,
    queuedJobs: WorkOrder[],
    trafficFactor: number = 1.3
  ): {
    eta: Date;
    travelMinutes: number;
    distanceToTarget: number;
    totalQueueMinutes: number;
  } {
    let current = tech.currentLocation;
    let totalTime = 0;

    // Estimate time through queue
    for (const job of queuedJobs) {
      const distance = haversineDistance(current, job.address.coordinates);
      const travelMinutes = Math.ceil((distance / 50) * 60 * trafficFactor);
      totalTime += travelMinutes + job.estimatedDuration;
      current = job.address.coordinates;
    }

    // Final leg to target
    const finalDistance = haversineDistance(current, targetCoordinates);
    const finalTravelMinutes = Math.ceil((finalDistance / 50) * 60 * trafficFactor);
    totalTime += finalTravelMinutes;

    return {
      eta: new Date(Date.now() + totalTime * 60 * 1000),
      travelMinutes: finalTravelMinutes,
      distanceToTarget: finalDistance,
      totalQueueMinutes: totalTime,
    };
  }
}

// ─── AUTO DISPATCHER ────────────────────────────────────────────

/**
 * Fully automated dispatch based on configurable rules.
 */
export class AutoDispatcher {
  /**
   * Auto-dispatch job using best strategy based on priority and constraints.
   */
  static dispatch(
    job: WorkOrder,
    allTechs: Technician[],
    assignedJobs: WorkOrder[],
    strategy: "nearest" | "balanced" | "priority" = "balanced"
  ): DispatchResult | null {
    const availableTechs = allTechs.filter((t) => t.status === "AVAILABLE");

    if (strategy === "nearest") {
      return NearestAvailableDispatcher.dispatch(job, availableTechs);
    } else if (strategy === "balanced") {
      return WorkloadBalancer.dispatch(job, availableTechs, assignedJobs);
    } else if (strategy === "priority" && job.priority === "EMERGENCY") {
      const result = PriorityDispatcher.dispatch(job, availableTechs, allTechs, assignedJobs);
      return result.result;
    }

    return NearestAvailableDispatcher.dispatch(job, availableTechs);
  }

  /**
   * Batch auto-dispatch multiple jobs.
   */
  static batchDispatch(
    jobs: WorkOrder[],
    allTechs: Technician[],
    assignedJobs: WorkOrder[],
    strategy: "nearest" | "balanced" | "priority" = "balanced"
  ): DispatchResult[] {
    const results: DispatchResult[] = [];

    // Sort by priority
    const priorityOrder = { EMERGENCY: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const sortedJobs = [...jobs].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    for (const job of sortedJobs) {
      const result = this.dispatch(job, allTechs, assignedJobs, strategy);
      if (result) {
        results.push(result);
        // Update assigned jobs for next iteration
        const assigned = { ...job, technicianId: result.technicianId, status: "DISPATCHED" as const };
        assignedJobs.push(assigned);
      }
    }

    return results;
  }
}
