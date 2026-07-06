/**
 * Route Optimization Worker — dispatches to the routing provider.
 *
 * Phase 1: Uses Distance Matrix + nearest-neighbor heuristic
 * Phase 2: Will dispatch to OR-Tools VRP solver microservice
 *
 * Multi-provider support:
 *   When ROUTING_BYOK=true, the worker reads the tenant's chosen provider
 *   and credentials from shop.settings.routing. If the tenant hasn't
 *   configured anything, falls back to the deployer's default provider
 *   and metering kicks in automatically.
 *
 * Flow:
 *   1. Fetch order locations from PostGIS
 *   2. Resolve routing provider (tenant choice → deployer fallback + metering)
 *   3. Build distance matrix via routing provider
 *   4. Apply optimization (heuristic now, OR-Tools later)
 *   5. Update route with optimized stop sequence and ETAs
 */

import { Worker, type Job } from "bullmq";
import { forTenant } from "@witylogix/db";
import {
  createRoutingProvider,
  type RoutingCredentials,
} from "@witylogix/core/routing";
import { getConfig } from "../lib/config.js";
import type { OptimizationJobData } from "../lib/queue.js";
import { registerWorker } from "../lib/queue.js";

// ─── Nearest-Neighbor Heuristic ─────────────────────────────

function nearestNeighborTSP(
  distanceMatrix: number[][],
  startIndex: number = 0,
): number[] {
  const n = distanceMatrix.length;
  const visited = new Set<number>([startIndex]);
  const tour = [startIndex];
  let current = startIndex;

  while (visited.size < n) {
    let nearest = -1;
    let nearestDist = Infinity;

    for (let i = 0; i < n; i++) {
      if (!visited.has(i) && distanceMatrix[current][i] < nearestDist) {
        nearest = i;
        nearestDist = distanceMatrix[current][i];
      }
    }

    if (nearest === -1) break;
    visited.add(nearest);
    tour.push(nearest);
    current = nearest;
  }

  return tour;
}

// ─── Worker ─────────────────────────────────────────────────

import { getQueueConnection } from "../lib/queue.js";

export function startOptimizationWorker(): Worker {
  const config = getConfig();
  const connection = getQueueConnection();

  const worker = new Worker<OptimizationJobData>(
    "optimization",
    async (job: Job<OptimizationJobData>) => {
      const { shopId, routeId, depot, orderIds, options } = job.data;
      const db = forTenant(shopId);

      job.updateProgress(10);

      // 1. Fetch order locations
      const orderLocations = await db.$queryRaw<
        Array<{
          id: string;
          lat: number;
          lng: number;
          address: string | null;
        }>
      >`
        SELECT
          id::text,
          ST_Y(delivery_location) as lat,
          ST_X(delivery_location) as lng,
          address_line1 as address
        FROM orders
        WHERE id = ANY(${orderIds}::uuid[])
          AND delivery_location IS NOT NULL
        ORDER BY array_position(${orderIds}::uuid[], id)
      `;

      if (orderLocations.length < 2) {
        await db.route.update({
          where: { id: routeId },
          data: { status: "OPTIMIZED" },
        });
        return { message: "Too few geolocated orders to optimize" };
      }

      job.updateProgress(20);

      // 2. Resolve routing provider (multi-provider, BYOK-aware)
      //    Reads the tenant's chosen provider + credentials from
      //    shop.settings.routing. Falls back to deployer default
      //    with automatic metering when BYOK is enabled.
      let tenantCredentials: RoutingCredentials | undefined;
      if (config.ROUTING_BYOK) {
        const shop = await db.shop.findUnique({
          where: { id: shopId },
          select: { settings: true },
        });
        const settings = (shop?.settings ?? {}) as Record<string, unknown>;

        // New format: settings.routing = { provider, apiKey, baseUrl }
        const routing = (settings.routing ?? {}) as Record<string, unknown>;
        if (routing.provider || routing.apiKey || routing.baseUrl) {
          tenantCredentials = {
            provider: routing.provider as any,
            apiKey: routing.apiKey as string | undefined,
            baseUrl: routing.baseUrl as string | undefined,
          };
        }
        // Legacy fallback: settings.mapboxAccessToken
        else if (typeof settings.mapboxAccessToken === "string") {
          tenantCredentials = { apiKey: settings.mapboxAccessToken };
        }
      }

      const resolved = createRoutingProvider(tenantCredentials, shopId);
      const routing = resolved.instance;

      job.updateProgress(30);

      // 3. Build points array (depot + orders)
      const points = [
        { lat: depot.lat, lng: depot.lng },
        ...orderLocations.map((o) => ({ lat: o.lat, lng: o.lng })),
      ];

      // 4. Get distance matrix from routing provider
      let matrix: number[][];

      try {
        const result = await routing.getDistanceMatrix(
          points.map((p) => ({ latitude: p.lat, longitude: p.lng })),
        );
        matrix = result.durations; // Use durations for time-optimal routing
      } catch (err) {
        console.error("[optimization-worker] Matrix API failed:", err);
        // Fallback: use Haversine distances
        matrix = buildHaversineMatrix(points);
      }

      job.updateProgress(60);

      // 5. Optimize with nearest-neighbor (Phase 1)
      const optimizedIndices = nearestNeighborTSP(matrix, 0);

      // Remove depot from result (index 0)
      const orderSequence = optimizedIndices
        .filter((i) => i > 0)
        .map((i) => i - 1); // Map back to order indices

      job.updateProgress(80);

      // 6. Calculate ETAs along the optimized route
      const optimizedOrder: Array<{
        sequence: number;
        orderId: string;
        lat: number;
        lng: number;
        eta: string;
        type: string;
      }> = [];
      let cumulativeDuration = 0;
      const startTime = new Date();

      for (let seq = 0; seq < orderSequence.length; seq++) {
        const orderIdx = orderSequence[seq];
        const order = orderLocations[orderIdx];
        const prevIdx = seq === 0 ? 0 : orderSequence[seq - 1] + 1;
        const currentIdx = orderIdx + 1;

        cumulativeDuration += matrix[prevIdx][currentIdx];
        // Add 5 min service time per stop
        cumulativeDuration += 300;

        const eta = new Date(startTime.getTime() + cumulativeDuration * 1000);

        optimizedOrder.push({
          sequence: seq,
          orderId: order.id,
          lat: order.lat,
          lng: order.lng,
          eta: eta.toISOString(),
          type: "DELIVERY",
        });
      }

      // 7. Calculate total route metrics
      let totalDistance = 0;
      let totalDuration = 0;
      for (let i = 0; i < optimizedIndices.length - 1; i++) {
        totalDuration += matrix[optimizedIndices[i]][optimizedIndices[i + 1]];
        // Distance estimation (duration * avg speed 40km/h)
        totalDistance +=
          (matrix[optimizedIndices[i]][optimizedIndices[i + 1]] / 3600) *
          40 *
          1000;
      }

      // 8. Update route
      await db.$transaction(async (tx) => {
        await tx.route.update({
          where: { id: routeId },
          data: {
            status: "OPTIMIZED",
            optimizedOrder,
            totalDistance: Math.round(totalDistance),
            totalDuration: Math.round(totalDuration),
          },
        });

        // Update stop sequences
        for (const stop of optimizedOrder) {
          await tx.routeStop.updateMany({
            where: { routeId, orderId: stop.orderId },
            data: {
              sequence: stop.sequence,
              estimatedArrival: new Date(stop.eta),
            },
          });
        }
      });

      job.updateProgress(100);
      return {
        routeId,
        stopsOptimized: optimizedOrder.length,
        totalDuration: Math.round(totalDuration),
        totalDistance: Math.round(totalDistance),
      };
    },
    {
      connection,
      concurrency: 2, // CPU-intensive, limit concurrency
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`[optimization-worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("completed", (job, result) => {
    console.info(`[optimization-worker] Job ${job.id} completed:`, result);
  });

  registerWorker(worker);
  console.info("[optimization-worker] Started");
  return worker;
}

// ─── Helpers ────────────────────────────────────────────────

function buildHaversineMatrix(
  points: Array<{ lat: number; lng: number }>,
): number[][] {
  const n = points.length;
  const matrix: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0),
  );

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const dist = haversineDistance(points[i], points[j]);
        // Estimate duration assuming 30 km/h average (urban delivery)
        matrix[i][j] = (dist / 30) * 3600;
      }
    }
  }

  return matrix;
}

function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
