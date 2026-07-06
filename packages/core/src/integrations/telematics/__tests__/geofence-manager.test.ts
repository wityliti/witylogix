/**
 * Geofence Manager Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  GeofenceManager,
  type CircleGeofence,
  type PolygonGeofence,
} from "../geofence-manager.js";
import type { WitylogixVehiclePosition } from "../telematics-types.js";

describe("GeofenceManager", () => {
  let manager: GeofenceManager;

  beforeEach(() => {
    manager = new GeofenceManager();
  });

  describe("Circle Geofence CRUD", () => {
    it("should add a circle geofence", () => {
      const geofence = manager.addCircleGeofence(
        "zone-1",
        "Warehouse",
        { lat: 40.7128, lng: -74.006 },
        500,
      );

      expect(geofence).toBeDefined();
      expect(geofence.name).toBe("Warehouse");
      expect(geofence.type).toBe("circle");
      expect(geofence.radius).toBe(500);
    });

    it("should get a geofence by ID", () => {
      manager.addCircleGeofence(
        "zone-1",
        "Warehouse",
        { lat: 40.7128, lng: -74.006 },
        500,
      );

      const geofence = manager.getGeofence("zone-1");

      expect(geofence).toBeDefined();
      expect(geofence?.name).toBe("Warehouse");
    });

    it("should get all geofences", () => {
      manager.addCircleGeofence(
        "zone-1",
        "Warehouse",
        { lat: 40.7128, lng: -74.006 },
        500,
      );
      manager.addCircleGeofence(
        "zone-2",
        "Depot",
        { lat: 40.7614, lng: -73.9776 },
        300,
      );

      const geofences = manager.getAllGeofences();

      expect(geofences).toHaveLength(2);
    });

    it("should update a geofence", () => {
      manager.addCircleGeofence(
        "zone-1",
        "Warehouse",
        { lat: 40.7128, lng: -74.006 },
        500,
      );

      manager.updateGeofence("zone-1", { name: "Main Warehouse", radius: 600 });
      const updated = manager.getGeofence("zone-1");

      expect(updated?.name).toBe("Main Warehouse");
      expect(updated?.type === "circle" && updated.radius).toBe(600);
    });

    it("should remove a geofence", () => {
      manager.addCircleGeofence(
        "zone-1",
        "Warehouse",
        { lat: 40.7128, lng: -74.006 },
        500,
      );

      const removed = manager.removeGeofence("zone-1");

      expect(removed).toBe(true);
      expect(manager.getGeofence("zone-1")).toBeUndefined();
    });
  });

  describe("Polygon Geofence CRUD", () => {
    it("should add a polygon geofence", () => {
      const points = [
        { lat: 40.7128, lng: -74.006 },
        { lat: 40.7614, lng: -73.9776 },
        { lat: 40.6895, lng: -73.8699 },
      ];

      const geofence = manager.addPolygonGeofence(
        "zone-1",
        "Service Area",
        points,
      );

      expect(geofence).toBeDefined();
      expect(geofence.type).toBe("polygon");
      expect(geofence.points).toHaveLength(3);
    });

    it("should reject polygon with less than 3 points", () => {
      const points = [
        { lat: 40.7128, lng: -74.006 },
        { lat: 40.7614, lng: -73.9776 },
      ];

      expect(() =>
        manager.addPolygonGeofence("zone-1", "Invalid", points),
      ).toThrow();
    });
  });

  describe("Point-in-Geofence Detection", () => {
    it("should detect point inside circle", () => {
      manager.addCircleGeofence(
        "zone-1",
        "Warehouse",
        { lat: 40.7128, lng: -74.006 },
        500,
      );

      // Very close to center (within 500m)
      const inside = manager.isPointInGeofence(40.7128, -74.006, "zone-1");

      expect(inside).toBeDefined();
      expect(inside?.name).toBe("Warehouse");
    });

    it("should detect point outside circle", () => {
      manager.addCircleGeofence(
        "zone-1",
        "Warehouse",
        { lat: 40.7128, lng: -74.006 },
        500,
      );

      // Far away point (NYC to LA is ~4000km)
      const outside = manager.isPointInGeofence(34.0522, -118.2437, "zone-1");

      expect(outside).toBeNull();
    });

    it("should detect point inside polygon", () => {
      const points = [
        { lat: 40.7, lng: -74.0 },
        { lat: 40.72, lng: -74.0 },
        { lat: 40.71, lng: -74.02 },
      ];

      manager.addPolygonGeofence("zone-1", "Area", points);

      // Point inside triangle
      const inside = manager.isPointInGeofence(40.71, -74.01, "zone-1");

      expect(inside).toBeDefined();
    });

    it("should find all geofences containing a point", () => {
      manager.addCircleGeofence(
        "zone-1",
        "Large Area",
        { lat: 40.7128, lng: -74.006 },
        2000,
      );
      manager.addCircleGeofence(
        "zone-2",
        "Small Area",
        { lat: 40.7128, lng: -74.006 },
        500,
      );

      const geofences = manager.getGeofencesContainingPoint(40.7128, -74.006);

      expect(geofences).toHaveLength(2);
    });
  });

  describe("Geofence Events", () => {
    it("should detect geofence entry", () => {
      manager.addCircleGeofence(
        "zone-1",
        "Warehouse",
        { lat: 40.7128, lng: -74.006 },
        500,
      );

      const position: WitylogixVehiclePosition = {
        vehicleId: "vehicle-1",
        lat: 40.7128,
        lng: -74.006,
        heading: 0,
        speed: 10,
        timestamp: new Date(),
        provider: "test",
        accuracy: 10,
      };

      const events = manager.detectGeofenceEvents(position);

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe("enter");
      expect(events[0].geofenceName).toBe("Warehouse");
    });

    it("should detect geofence exit", () => {
      manager.addCircleGeofence(
        "zone-1",
        "Warehouse",
        { lat: 40.7128, lng: -74.006 },
        500,
      );

      // First enter
      const entryPos: WitylogixVehiclePosition = {
        vehicleId: "vehicle-1",
        lat: 40.7128,
        lng: -74.006,
        heading: 0,
        speed: 0,
        timestamp: new Date(),
        provider: "test",
        accuracy: 10,
      };

      manager.detectGeofenceEvents(entryPos);

      // Then exit
      const exitPos: WitylogixVehiclePosition = {
        vehicleId: "vehicle-1",
        lat: 34.0522,
        lng: -118.2437,
        heading: 90,
        speed: 60,
        timestamp: new Date(Date.now() + 1000),
        provider: "test",
        accuracy: 10,
      };

      const events = manager.detectGeofenceEvents(exitPos);

      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e) => e.eventType === "exit")).toBe(true);
    });

    it("should track dwell time in geofence", () => {
      manager.addCircleGeofence(
        "zone-1",
        "Warehouse",
        { lat: 40.7128, lng: -74.006 },
        500,
      );

      const startTime = new Date();
      const pos: WitylogixVehiclePosition = {
        vehicleId: "vehicle-1",
        lat: 40.7128,
        lng: -74.006,
        heading: 0,
        speed: 0,
        timestamp: startTime,
        provider: "test",
        accuracy: 10,
      };

      manager.detectGeofenceEvents(pos);

      // Still inside after 10 minutes
      const dwellPos: WitylogixVehiclePosition = {
        vehicleId: "vehicle-1",
        lat: 40.7128,
        lng: -74.006,
        heading: 0,
        speed: 0,
        timestamp: new Date(startTime.getTime() + 10 * 60 * 1000),
        provider: "test",
        accuracy: 10,
      };

      const events = manager.detectGeofenceEvents(dwellPos);

      const dwellEvent = events.find((e) => e.eventType === "dwell");
      expect(dwellEvent).toBeDefined();
    });
  });

  describe("Batch Operations", () => {
    it("should batch check positions against geofences", () => {
      manager.addCircleGeofence(
        "zone-1",
        "Warehouse",
        { lat: 40.7128, lng: -74.006 },
        500,
      );
      manager.addCircleGeofence(
        "zone-2",
        "Depot",
        { lat: 40.7614, lng: -73.9776 },
        300,
      );

      const positions: WitylogixVehiclePosition[] = [
        {
          vehicleId: "vehicle-1",
          lat: 40.7128,
          lng: -74.006,
          heading: 0,
          speed: 10,
          timestamp: new Date(),
          provider: "test",
          accuracy: 10,
        },
        {
          vehicleId: "vehicle-2",
          lat: 34.0522,
          lng: -118.2437,
          heading: 90,
          speed: 50,
          timestamp: new Date(),
          provider: "test",
          accuracy: 10,
        },
      ];

      const results = manager.batchCheckPositions(positions);

      expect(results.has("vehicle-1")).toBe(true);
      expect(results.has("vehicle-2")).toBe(false);
    });
  });

  describe("Tags and Filtering", () => {
    it("should filter geofences by tag", () => {
      manager.addCircleGeofence(
        "zone-1",
        "Warehouse",
        { lat: 40.7128, lng: -74.006 },
        500,
        ["high-priority", "shipping"],
      );
      manager.addCircleGeofence(
        "zone-2",
        "Depot",
        { lat: 40.7614, lng: -73.9776 },
        300,
        ["low-priority"],
      );

      const filtered = manager.getGeofencesByTag("high-priority");

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("Warehouse");
    });
  });

  describe("GeoJSON Import/Export", () => {
    it("should export geofences as GeoJSON", () => {
      manager.addCircleGeofence(
        "zone-1",
        "Warehouse",
        { lat: 40.7128, lng: -74.006 },
        500,
      );
      manager.addPolygonGeofence("zone-2", "Area", [
        { lat: 40.7, lng: -74.0 },
        { lat: 40.72, lng: -74.0 },
        { lat: 40.71, lng: -74.02 },
      ]);

      const geojson = manager.exportAsGeoJSON();

      expect(geojson.type).toBe("FeatureCollection");
      expect(geojson.features).toHaveLength(2);
    });

    it("should import geofences from GeoJSON", () => {
      const geojson = {
        type: "FeatureCollection" as const,
        features: [
          {
            type: "Feature" as const,
            id: "zone-1",
            geometry: {
              type: "Circle" as const,
              center: [-74.006, 40.7128] as [number, number],
              radius: 500,
            },
            properties: { name: "Warehouse", tags: ["shipping"] },
          },
        ],
      };

      manager.importFromGeoJSON(geojson);

      const imported = manager.getGeofence("zone-1");
      expect(imported).toBeDefined();
      expect(imported?.name).toBe("Warehouse");
    });
  });

  describe("State Management", () => {
    it("should clear all geofences", () => {
      manager.addCircleGeofence(
        "zone-1",
        "Warehouse",
        { lat: 40.7128, lng: -74.006 },
        500,
      );
      manager.addCircleGeofence(
        "zone-2",
        "Depot",
        { lat: 40.7614, lng: -73.9776 },
        300,
      );

      manager.clearAllGeofences();

      expect(manager.getGeofenceCount()).toBe(0);
    });

    it("should reset vehicle state", () => {
      manager.addCircleGeofence(
        "zone-1",
        "Warehouse",
        { lat: 40.7128, lng: -74.006 },
        500,
      );

      const pos: WitylogixVehiclePosition = {
        vehicleId: "vehicle-1",
        lat: 40.7128,
        lng: -74.006,
        heading: 0,
        speed: 0,
        timestamp: new Date(),
        provider: "test",
        accuracy: 10,
      };

      manager.detectGeofenceEvents(pos);

      manager.resetVehicleState("vehicle-1");

      // Next entry should be detected
      const events = manager.detectGeofenceEvents(pos);
      expect(events.some((e) => e.eventType === "enter")).toBe(true);
    });

    it("should count geofences", () => {
      expect(manager.getGeofenceCount()).toBe(0);

      manager.addCircleGeofence(
        "zone-1",
        "Warehouse",
        { lat: 40.7128, lng: -74.006 },
        500,
      );
      expect(manager.getGeofenceCount()).toBe(1);

      manager.addCircleGeofence(
        "zone-2",
        "Depot",
        { lat: 40.7614, lng: -73.9776 },
        300,
      );
      expect(manager.getGeofenceCount()).toBe(2);
    });
  });
});
