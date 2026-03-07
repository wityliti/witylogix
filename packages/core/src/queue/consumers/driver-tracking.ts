/**
 * Driver tracking consumer — processes GPS location updates for active drivers.
 *
 * Flow:
 *   1. Validate GPS coordinates and driver information
 *   2. Update driver position in database
 *   3. Check for geofence violations (destination zone, restricted areas)
 *   4. Update route ETAs based on current position and traffic
 *   5. Emit real-time location event to connected clients
 */

import type {
  QueueJobPayload,
  QueueJobMetadata,
  JobProcessingResult,
  DriverTrackingJob,
} from "../types.js";
import {
  QueueConsumer,
  QueueValidationError,
  QueueTransientError,
  QueuePermanentError,
} from "../consumer.js";
import type { ConsumerConfig } from "../types.js";

/**
 * Geofence violation types.
 */
export type GeofenceViolationType = "exit_destination" | "enter_restricted" | "location_anomaly";

/**
 * Driver tracking consumer implementation.
 */
export class DriverTrackingConsumer extends QueueConsumer {
  constructor(config: ConsumerConfig) {
    super(config);
  }

  /**
   * Validate driver tracking payload and coordinates.
   *
   * @param job Job payload
   * @throws QueueValidationError if validation fails
   */
  protected async validateJob(job: QueueJobPayload): Promise<void> {
    await super.validateJob(job);

    if (job.type !== "driver_tracking") {
      throw new QueueValidationError(
        `Expected driver_tracking, got ${job.type}`,
      );
    }

    const { data } = job as {
      type: "driver_tracking";
      data: DriverTrackingJob;
    };
    const { payload } = data;

    // Validate coordinates are valid numbers
    if (
      typeof payload.latitude !== "number" ||
      typeof payload.longitude !== "number"
    ) {
      throw new QueueValidationError("Latitude and longitude must be numbers");
    }

    // Validate latitude and longitude ranges
    if (payload.latitude < -90 || payload.latitude > 90) {
      throw new QueueValidationError(
        `Invalid latitude: ${payload.latitude}. Must be between -90 and 90`,
      );
    }

    if (payload.longitude < -180 || payload.longitude > 180) {
      throw new QueueValidationError(
        `Invalid longitude: ${payload.longitude}. Must be between -180 and 180`,
      );
    }

    // Validate optional fields if present
    if (payload.speed !== undefined && payload.speed < 0) {
      throw new QueueValidationError("Speed cannot be negative");
    }

    if (payload.accuracy !== undefined && payload.accuracy <= 0) {
      throw new QueueValidationError("Accuracy must be greater than zero");
    }

    if (payload.timestamp > Date.now() + 60000) {
      // Allow 60s clock skew
      throw new QueueValidationError("Timestamp is in the future");
    }
  }

  /**
   * Process driver location update — update position, check geofences, emit events.
   *
   * @param job Driver tracking job
   * @param metadata Job execution metadata
   * @returns Processing result
   */
  async process(
    job: QueueJobPayload,
    metadata: QueueJobMetadata,
  ): Promise<JobProcessingResult> {
    const { data } = job as {
      type: "driver_tracking";
      data: DriverTrackingJob;
    };
    const { driverId, companyId, payload } = data;
    const jobId = metadata.jobId;

    try {
      console.log(
        `[DriverTrackingConsumer] Processing location for driver ${driverId} (${payload.latitude}, ${payload.longitude})`,
      );

      // Step 1: Update driver position in database
      await this.updateDriverPosition(driverId, companyId, payload);

      // Step 2: Check for geofence violations
      const violations = await this.checkGeofenceViolations(
        driverId,
        companyId,
        payload,
      );

      // Step 3: Handle any violations
      if (violations.length > 0) {
        await this.handleGeofenceViolations(driverId, companyId, violations);
      }

      // Step 4: Update route ETAs if on active route
      if (payload.routeId) {
        await this.updateRouteETAs(
          companyId,
          payload.routeId,
          payload.latitude,
          payload.longitude,
        );
      }

      // Step 5: Emit real-time location event
      await this.emitLocationEvent(driverId, companyId, payload);

      // Calculate processing time
      const processingTimeMs = Date.now() - metadata.processingStartedAt!;

      return {
        success: true,
        jobId,
        processingTimeMs,
        data: {
          driverId,
          location: {
            latitude: payload.latitude,
            longitude: payload.longitude,
          },
          accuracy: payload.accuracy,
          speed: payload.speed,
          violationCount: violations.length,
        },
      };
    } catch (error) {
      if (error instanceof QueueValidationError) {
        throw new QueuePermanentError(
          `Invalid tracking data: ${error.message}`,
          { driverId },
        );
      }

      if (
        error instanceof Error &&
        (error.message.includes("database") ||
          error.message.includes("spatial"))
      ) {
        throw new QueueTransientError(
          `Database/spatial error: ${error.message}`,
          { driverId, coordinates: [payload.latitude, payload.longitude] },
        );
      }

      throw new QueueTransientError(
        `Error processing location: ${error instanceof Error ? error.message : String(error)}`,
        { driverId },
      );
    }
  }

  /**
   * Update driver current position in database.
   *
   * @param driverId Driver identifier
   * @param companyId Company identifier
   * @param payload Location payload
   */
  private async updateDriverPosition(
    driverId: string,
    companyId: string,
    payload: DriverTrackingJob["payload"],
  ): Promise<void> {
    try {
      console.log(
        `[DriverTrackingConsumer] Updating position for driver ${driverId}`,
      );

      // TODO: Update driver position when database available
      // await prisma.driver.update({
      //   where: { id: driverId },
      //   data: {
      //     currentLocation: {
      //       create: {
      //         latitude: payload.latitude,
      //         longitude: payload.longitude,
      //         heading: payload.heading,
      //         speed: payload.speed,
      //         accuracy: payload.accuracy,
      //         recordedAt: new Date(payload.timestamp),
      //       },
      //     },
      //     lastLocationUpdate: new Date(payload.timestamp),
      //   },
      // });

      await this.simulateAsyncOperation(30);
    } catch (error) {
      throw new QueueTransientError(
        `Failed to update driver position: ${error instanceof Error ? error.message : String(error)}`,
        { driverId },
      );
    }
  }

  /**
   * Check for geofence violations at current location.
   *
   * @param driverId Driver identifier
   * @param companyId Company identifier
   * @param payload Location payload
   * @returns Array of violations detected
   */
  private async checkGeofenceViolations(
    driverId: string,
    companyId: string,
    payload: DriverTrackingJob["payload"],
  ): Promise<
    Array<{
      type: GeofenceViolationType;
      details: Record<string, unknown>;
    }>
  > {
    try {
      console.log(
        `[DriverTrackingConsumer] Checking geofences for driver ${driverId}`,
      );

      const violations: Array<{
        type: GeofenceViolationType;
        details: Record<string, unknown>;
      }> = [];

      // Check if driver has exited destination geofence
      if (payload.orderId) {
        const inDestination = await this.isInDestinationZone(
          payload.orderId,
          payload.latitude,
          payload.longitude,
        );

        if (!inDestination) {
          violations.push({
            type: "exit_destination",
            details: { orderId: payload.orderId },
          });
        }
      }

      // Check for entry into restricted areas
      const restrictedArea = await this.checkRestrictedAreas(
        companyId,
        payload.latitude,
        payload.longitude,
      );

      if (restrictedArea) {
        violations.push({
          type: "enter_restricted",
          details: { areaId: restrictedArea },
        });
      }

      // Check for location anomalies (sudden jumps)
      const isAnomaly = await this.detectLocationAnomaly(
        driverId,
        payload.latitude,
        payload.longitude,
        payload.timestamp,
      );

      if (isAnomaly) {
        violations.push({
          type: "location_anomaly",
          details: { detector: "distance_threshold" },
        });
      }

      await this.simulateAsyncOperation(40);

      return violations;
    } catch (error) {
      console.error(
        `[DriverTrackingConsumer] Error checking geofences:`,
        error,
      );
      return [];
    }
  }

  /**
   * Check if location is within order destination zone.
   *
   * @param orderId Order identifier
   * @param latitude Current latitude
   * @param longitude Current longitude
   * @returns True if within destination zone
   */
  private async isInDestinationZone(
    orderId: string,
    latitude: number,
    longitude: number,
  ): Promise<boolean> {
    try {
      // TODO: Query destination zone from database using PostGIS
      // const order = await prisma.order.findUnique({
      //   where: { id: orderId },
      //   select: { destinationLocation: true },
      // });
      //
      // if (!order) return false;
      //
      // const distance = calculateDistance(
      //   latitude,
      //   longitude,
      //   order.destinationLocation.lat,
      //   order.destinationLocation.lng,
      // );
      //
      // return distance <= 100; // 100 meters threshold

      await this.simulateAsyncOperation(25);
      return true;
    } catch (error) {
      console.error(
        `[DriverTrackingConsumer] Error checking destination zone:`,
        error,
      );
      return false;
    }
  }

  /**
   * Check if location is in restricted area.
   *
   * @param companyId Company identifier
   * @param latitude Location latitude
   * @param longitude Location longitude
   * @returns Restricted area ID if found, null otherwise
   */
  private async checkRestrictedAreas(
    companyId: string,
    latitude: number,
    longitude: number,
  ): Promise<string | null> {
    try {
      // TODO: Query restricted areas using PostGIS point-in-polygon
      // const restrictedArea = await prisma.restrictedArea.findFirst({
      //   where: {
      //     companyId,
      //     polygon: {
      //       contains: {
      //         latitude,
      //         longitude,
      //       },
      //     },
      //   },
      //   select: { id: true },
      // });

      await this.simulateAsyncOperation(30);
      return null;
    } catch (error) {
      console.error(
        `[DriverTrackingConsumer] Error checking restricted areas:`,
        error,
      );
      return null;
    }
  }

  /**
   * Detect location anomalies (sudden jumps).
   *
   * @param driverId Driver identifier
   * @param latitude Current latitude
   * @param longitude Current longitude
   * @param timestamp Current timestamp
   * @returns True if anomaly detected
   */
  private async detectLocationAnomaly(
    driverId: string,
    latitude: number,
    longitude: number,
    timestamp: number,
  ): Promise<boolean> {
    try {
      // TODO: Fetch last known position and compare distance/time
      // const lastLocation = await prisma.driverLocation.findFirst({
      //   where: { driverId },
      //   orderBy: { recordedAt: "desc" },
      //   take: 1,
      // });
      //
      // if (!lastLocation) return false;
      //
      // const distance = calculateDistance(
      //   latitude,
      //   longitude,
      //   lastLocation.latitude,
      //   lastLocation.longitude,
      // );
      //
      // const timeDiffSeconds = (timestamp - lastLocation.recordedAt.getTime()) / 1000;
      // const speedMps = distance / timeDiffSeconds;
      // const speedKmh = speedMps * 3.6;
      //
      // // Flag if speed exceeds 200 km/h (likely GPS anomaly)
      // return speedKmh > 200;

      await this.simulateAsyncOperation(20);
      return false;
    } catch (error) {
      console.error(
        `[DriverTrackingConsumer] Error detecting anomaly:`,
        error,
      );
      return false;
    }
  }

  /**
   * Handle detected geofence violations.
   *
   * @param driverId Driver identifier
   * @param companyId Company identifier
   * @param violations Violations to handle
   */
  private async handleGeofenceViolations(
    driverId: string,
    companyId: string,
    violations: Array<{
      type: GeofenceViolationType;
      details: Record<string, unknown>;
    }>,
  ): Promise<void> {
    try {
      console.log(
        `[DriverTrackingConsumer] Handling ${violations.length} geofence violations`,
      );

      for (const violation of violations) {
        // TODO: Log violations and emit alerts
        // await prisma.geofenceViolation.create({
        //   data: {
        //     driverId,
        //     type: violation.type,
        //     details: violation.details,
        //     detectedAt: new Date(),
        //   },
        // });

        // Emit alert event
        // await eventBus.publish("geofence:violation", {
        //   driverId,
        //   type: violation.type,
        //   details: violation.details,
        // });
      }

      await this.simulateAsyncOperation(35);
    } catch (error) {
      console.error(
        `[DriverTrackingConsumer] Error handling violations:`,
        error,
      );
    }
  }

  /**
   * Update estimated time of arrival for active route.
   *
   * @param companyId Company identifier
   * @param routeId Route identifier
   * @param latitude Current latitude
   * @param longitude Current longitude
   */
  private async updateRouteETAs(
    companyId: string,
    routeId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    try {
      console.log(
        `[DriverTrackingConsumer] Updating ETAs for route ${routeId}`,
      );

      // TODO: Calculate new ETAs based on current position and routing service
      // const route = await prisma.route.findUnique({
      //   where: { id: routeId },
      //   include: { stops: { orderBy: { sequence: "asc" } } },
      // });
      //
      // if (!route) return;
      //
      // const updatedStops = await calculateETAs(
      //   { latitude, longitude },
      //   route.stops,
      // );
      //
      // for (const stop of updatedStops) {
      //   await prisma.routeStop.update({
      //     where: { id: stop.id },
      //     data: { estimatedArrival: stop.eta },
      //   });
      // }

      await this.simulateAsyncOperation(45);
    } catch (error) {
      console.error(
        `[DriverTrackingConsumer] Error updating ETAs:`,
        error,
      );
    }
  }

  /**
   * Emit real-time location event to connected clients.
   *
   * @param driverId Driver identifier
   * @param companyId Company identifier
   * @param payload Location payload
   */
  private async emitLocationEvent(
    driverId: string,
    companyId: string,
    payload: DriverTrackingJob["payload"],
  ): Promise<void> {
    try {
      console.log(
        `[DriverTrackingConsumer] Emitting location event for driver ${driverId}`,
      );

      // TODO: Emit via WebSocket or real-time pub/sub
      // await realtimeManager.publish(`driver:${driverId}:location`, {
      //   driverId,
      //   latitude: payload.latitude,
      //   longitude: payload.longitude,
      //   heading: payload.heading,
      //   speed: payload.speed,
      //   accuracy: payload.accuracy,
      //   timestamp: payload.timestamp,
      // });

      await this.simulateAsyncOperation(15);
    } catch (error) {
      console.error(
        `[DriverTrackingConsumer] Error emitting location event:`,
        error,
      );
      // Don't fail the job for event emission errors
    }
  }

  /**
   * Simulate async operation for testing (remove in production).
   *
   * @param ms Milliseconds to wait
   */
  private async simulateAsyncOperation(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
