/**
 * Geofence Auto-Events Worker — WIT-140
 *
 * BullMQ repeatable job that runs every 30 seconds (configurable via
 * GEOFENCE_CHECK_INTERVAL_MS env var) and auto-triggers `delivery.arrived`
 * events when a driver enters the delivery address geofence radius.
 *
 * Design:
 * - Fetches all active shipments (IN_TRANSIT or OUT_FOR_DELIVERY) that have
 *   a driver assigned, a known delivery location, and no prior geofence trigger.
 * - Gets driver positions from Redis GEO (populated by the driver location API).
 * - Uses haversine distance to check proximity.
 * - On entry: writes a DeliveryEvent (arrived) and advances shipment to ARRIVED.
 *   Uses a Redis dedup key (60s TTL) to prevent double-fire within a burst.
 * - Radius is configurable per shop via shops.settings.geofenceRadiusMeters
 *   (default: 150m, min: 50m, max: 500m).
 */

import { Worker, type Job } from "bullmq";
import { prisma } from "@witylogix/db";
import { getRedis } from "../lib/redis.js";
import { getQueueConnection, registerWorker } from "../lib/queue.js";
import type { GeofenceJobData } from "../lib/queue.js";

// ─── Constants ───────────────────────────────────────────────

export const GEOFENCE_DEFAULT_RADIUS_M = 150;
export const GEOFENCE_MIN_RADIUS_M = 50;
export const GEOFENCE_MAX_RADIUS_M = 500;
export const GEOFENCE_DEDUP_TTL_S = 60;

const DRIVER_GEO_KEY = "driver:locations";
const ACTIVE_STATUSES = ["IN_TRANSIT", "OUT_FOR_DELIVERY"] as const;

// ─── Haversine Distance ──────────────────────────────────────

/**
 * Returns distance in metres between two WGS-84 coordinates.
 * Accurate to ~0.3% — sufficient for geofence proximity checks.
 */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000; // Earth radius in metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Geofence Check ──────────────────────────────────────────

/**
 * Clamp geofence radius from shop settings to the allowed range.
 */
export function resolveGeofenceRadius(shopSettings: unknown): number {
  const settings =
    shopSettings && typeof shopSettings === "object" ? shopSettings : {};
  const raw = (settings as Record<string, unknown>).geofenceRadiusMeters;
  if (typeof raw !== "number" || isNaN(raw)) return GEOFENCE_DEFAULT_RADIUS_M;
  return Math.min(GEOFENCE_MAX_RADIUS_M, Math.max(GEOFENCE_MIN_RADIUS_M, raw));
}

/**
 * Build the Redis dedup key for a driver/delivery pair.
 * TTL = GEOFENCE_DEDUP_TTL_S (60s) — same trigger within 60s is a no-op.
 */
export function geofenceDedupKey(driverId: string, shipmentId: string): string {
  return `geofence:dedup:${driverId}:${shipmentId}`;
}

// ─── Core Job Logic ──────────────────────────────────────────

export async function runGeofenceCheck(): Promise<{
  checked: number;
  triggered: number;
  skipped: number;
}> {
  const redis = getRedis();
  let checked = 0;
  let triggered = 0;
  let skipped = 0;

  // 1. Fetch all active shipments with driver + delivery location
  const shipments = await prisma.shipment.findMany({
    where: {
      status: { in: ACTIVE_STATUSES as unknown as any },
      driverId: { not: null },
      deliveryLocation: { not: null },
      geofenceTriggeredAt: null,
    },
    select: {
      id: true,
      shopId: true,
      driverId: true,
      deliveryLocation: true,
      shop: { select: { settings: true } },
    },
  });

  if (shipments.length === 0) return { checked, triggered, skipped };

  // 2. Collect unique driverIds to batch-fetch positions
  const driverIds = [...new Set(shipments.map((s) => s.driverId as string))];

  // Fetch driver positions via Redis GEO (GEOPOS returns [lng, lat] or null)
  const positions = await redis.geopos(DRIVER_GEO_KEY, ...driverIds);
  const driverPositions = new Map<string, { lat: number; lng: number }>();

  driverIds.forEach((driverId, idx) => {
    const pos = positions[idx];
    if (pos && pos[0] != null && pos[1] != null) {
      driverPositions.set(driverId, {
        lng: parseFloat(pos[0]),
        lat: parseFloat(pos[1]),
      });
    }
  });

  // 3. Check each shipment
  for (const shipment of shipments) {
    checked++;
    const driverId = shipment.driverId as string;
    const driverPos = driverPositions.get(driverId);

    if (!driverPos) {
      skipped++;
      continue; // No known position for this driver
    }

    // Parse delivery location: { lat, lng }
    const loc = shipment.deliveryLocation as Record<string, unknown> | null;
    if (!loc || typeof loc.lat !== "number" || typeof loc.lng !== "number") {
      skipped++;
      continue;
    }

    const radiusM = resolveGeofenceRadius(shipment.shop?.settings);
    const distanceM = haversineMeters(
      driverPos.lat,
      driverPos.lng,
      loc.lat,
      loc.lng,
    );

    if (distanceM > radiusM) {
      skipped++;
      continue; // Driver is outside the geofence
    }

    // 4. Dedup check — prevent re-trigger within 60s
    const dedupKey = geofenceDedupKey(driverId, shipment.id);
    const alreadyFired = await redis.exists(dedupKey);
    if (alreadyFired) {
      skipped++;
      continue;
    }

    // 5. Emit arrived event and advance shipment status
    const eventId = `geofence:${shipment.id}:${Date.now()}`;
    const now = new Date();

    try {
      await prisma.$transaction([
        prisma.deliveryEvent.create({
          data: {
            id: eventId,
            shopId: shipment.shopId,
            shipmentId: shipment.id,
            eventType: "arrived",
            payload: {
              source: "geofence",
              distanceMeters: Math.round(distanceM),
              radiusMeters: radiusM,
              driverLat: driverPos.lat,
              driverLng: driverPos.lng,
            },
            deviceCapturedAt: now,
            deviceTimezone: "UTC",
            gpsLat: driverPos.lat,
            gpsLng: driverPos.lng,
          },
        }),
        prisma.shipment.update({
          where: { id: shipment.id },
          data: {
            status: "ARRIVED",
            geofenceTriggeredAt: now,
          },
        }),
      ]);

      // Set dedup key after successful write
      await redis.set(dedupKey, "1", "EX", GEOFENCE_DEDUP_TTL_S);
      triggered++;
    } catch (err: any) {
      // Log but don't throw — one failure shouldn't stop the rest
      console.error(
        `[geofence-worker] Failed to emit arrived event for shipment ${shipment.id}:`,
        err?.message,
      );
      skipped++;
    }
  }

  return { checked, triggered, skipped };
}

// ─── Worker Bootstrap ────────────────────────────────────────

export function startGeofenceWorker(): Worker {
  const connection = getQueueConnection();

  const worker = new Worker<GeofenceJobData>(
    "geofence",
    async (_job: Job<GeofenceJobData>) => {
      const result = await runGeofenceCheck();
      if (result.triggered > 0) {
        console.info(
          `[geofence-worker] checked=${result.checked} triggered=${result.triggered} skipped=${result.skipped}`,
        );
      }
      return result;
    },
    {
      connection,
      concurrency: 1, // Only one geofence scan at a time
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`[geofence-worker] Job ${job?.id} failed:`, err.message);
  });

  registerWorker(worker);
  return worker;
}
