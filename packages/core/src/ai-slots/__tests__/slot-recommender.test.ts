/**
 * Slot Recommender Tests
 *
 * Tests for the ML-powered slot recommendation engine
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SlotRecommender, type TimeSlot } from "../slot-recommender.js";
import { DemandPredictor } from "../demand-predictor.js";
import {
  DriverAvailabilityPredictor,
  type DriverShift,
  type ZoneCoverage,
} from "../driver-availability.js";
import type {
  HistoricalDeliveryData,
  CustomerPreference,
  ZoneCongestion,
  WeatherImpact,
} from "../types.js";

describe("SlotRecommender", () => {
  let recommender: SlotRecommender;
  const testDate = new Date("2026-03-15");

  beforeEach(() => {
    recommender = new SlotRecommender();
  });

  it("should recommend slots for a customer", () => {
    // Setup
    const slots: TimeSlot[] = [
      {
        id: "slot_1",
        name: "09:00 - 12:00",
        startTime: new Date("2026-03-15T09:00:00"),
        endTime: new Date("2026-03-15T12:00:00"),
        zoneId: "zone_1",
        isActive: true,
      },
      {
        id: "slot_2",
        name: "14:00 - 17:00",
        startTime: new Date("2026-03-15T14:00:00"),
        endTime: new Date("2026-03-15T17:00:00"),
        zoneId: "zone_1",
        isActive: true,
      },
    ];

    recommender.setAvailableSlots(slots);

    // Test
    const recommendations = recommender.recommendSlots({
      customerId: "cust_123",
      zoneId: "zone_1",
      date: testDate,
      maxSlots: 5,
    });

    // Verify
    expect(recommendations).toBeDefined();
    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations.length).toBeLessThanOrEqual(2);
    expect(recommendations[0]).toHaveProperty("slotId");
    expect(recommendations[0]).toHaveProperty("score");
    expect(recommendations[0]).toHaveProperty("reasoning");
  });

  it("should rank slots by score", () => {
    const slots: TimeSlot[] = [
      {
        id: "slot_1",
        name: "09:00 - 12:00",
        startTime: new Date("2026-03-15T09:00:00"),
        endTime: new Date("2026-03-15T12:00:00"),
        zoneId: "zone_1",
        isActive: true,
      },
      {
        id: "slot_2",
        name: "14:00 - 17:00",
        startTime: new Date("2026-03-15T14:00:00"),
        endTime: new Date("2026-03-15T17:00:00"),
        zoneId: "zone_1",
        isActive: true,
      },
    ];

    recommender.setAvailableSlots(slots);

    const recommendations = recommender.recommendSlots({
      customerId: "cust_123",
      zoneId: "zone_1",
      date: testDate,
    });

    // Scores should be in descending order
    for (let i = 0; i < recommendations.length - 1; i++) {
      expect(recommendations[i]!.score).toBeGreaterThanOrEqual(
        recommendations[i + 1]!.score,
      );
    }
  });

  it("should consider customer preferences", () => {
    const slots: TimeSlot[] = [
      {
        id: "slot_1",
        name: "09:00 - 12:00",
        startTime: new Date("2026-03-15T09:00:00"),
        endTime: new Date("2026-03-15T12:00:00"),
        zoneId: "zone_1",
        isActive: true,
      },
    ];

    recommender.setAvailableSlots(slots);

    const preference: CustomerPreference = {
      customerId: "cust_123",
      averageDeliveryValue: 50,
      preferredHours: [10], // Prefers 10 AM slot
      preferredDays: [0, 1, 2, 3, 4, 5, 6],
      successRate: 0.95,
      totalOrders: 20,
      lastOrderDate: new Date(),
      averageDeliveryDuration: 30,
    };

    const recommendations = recommender.recommendSlots({
      customerId: "cust_123",
      zoneId: "zone_1",
      date: testDate,
      customerPreference: preference,
    });

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]!.customerPreferenceMatch).toBeGreaterThan(0.3);
  });

  it("should return empty array for no matching slots", () => {
    recommender.setAvailableSlots([]);

    const recommendations = recommender.recommendSlots({
      customerId: "cust_123",
      zoneId: "zone_1",
      date: testDate,
    });

    expect(recommendations).toEqual([]);
  });

  it("should include driver availability in scoring", () => {
    const slots: TimeSlot[] = [
      {
        id: "slot_1",
        name: "09:00 - 12:00",
        startTime: new Date("2026-03-15T09:00:00"),
        endTime: new Date("2026-03-15T12:00:00"),
        zoneId: "zone_1",
        isActive: true,
      },
    ];

    const shifts: DriverShift[] = [
      {
        driverId: "driver_1",
        date: testDate,
        startHour: 9,
        endHour: 17,
        zoneId: "zone_1",
        vehicleType: "car",
        packageCapacity: 35,
        noShowHistory: 0.05,
      },
    ];

    recommender.setAvailableSlots(slots);
    recommender.setDriverShifts(shifts);

    const recommendations = recommender.recommendSlots({
      customerId: "cust_123",
      zoneId: "zone_1",
      date: testDate,
    });

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]!.driverAvailability).toBeGreaterThan(0);
  });

  it("should handle weather impact", () => {
    const slots: TimeSlot[] = [
      {
        id: "slot_1",
        name: "09:00 - 12:00",
        startTime: new Date("2026-03-15T09:00:00"),
        endTime: new Date("2026-03-15T12:00:00"),
        zoneId: "zone_1",
        isActive: true,
      },
    ];

    const weather: WeatherImpact = {
      date: testDate,
      zoneId: "zone_1",
      condition: "rainy",
      temperature: 15,
      windSpeed: 20,
      visibility: 5,
      deliveryDelayFactor: 1.3,
    };

    recommender.setAvailableSlots(slots);
    recommender.setWeatherData([weather]);

    const recommendations = recommender.recommendSlots({
      customerId: "cust_123",
      zoneId: "zone_1",
      date: testDate,
    });

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]!.weatherImpact).toBeCloseTo(0.3, 1);
  });

  it("should provide reasoning for recommendations", () => {
    const slots: TimeSlot[] = [
      {
        id: "slot_1",
        name: "09:00 - 12:00",
        startTime: new Date("2026-03-15T09:00:00"),
        endTime: new Date("2026-03-15T12:00:00"),
        zoneId: "zone_1",
        isActive: true,
      },
    ];

    recommender.setAvailableSlots(slots);

    const recommendations = recommender.recommendSlots({
      customerId: "cust_123",
      zoneId: "zone_1",
      date: testDate,
    });

    expect(recommendations[0]!.reasoning).toBeDefined();
    expect(recommendations[0]!.reasoning.length).toBeGreaterThan(0);
  });

  it("should respect maxSlots parameter", () => {
    const slots: TimeSlot[] = [];

    for (let i = 0; i < 10; i++) {
      slots.push({
        id: `slot_${i}`,
        name: `${9 + i}:00 - ${12 + i}:00`,
        startTime: new Date(`2026-03-15T${9 + i}:00:00`),
        endTime: new Date(`2026-03-15T${12 + i}:00:00`),
        zoneId: "zone_1",
        isActive: true,
      });
    }

    recommender.setAvailableSlots(slots);

    const recommendations = recommender.recommendSlots({
      customerId: "cust_123",
      zoneId: "zone_1",
      date: testDate,
      maxSlots: 3,
    });

    expect(recommendations.length).toBeLessThanOrEqual(3);
  });

  it("should get top recommendation", () => {
    const slots: TimeSlot[] = [
      {
        id: "slot_1",
        name: "09:00 - 12:00",
        startTime: new Date("2026-03-15T09:00:00"),
        endTime: new Date("2026-03-15T12:00:00"),
        zoneId: "zone_1",
        isActive: true,
      },
      {
        id: "slot_2",
        name: "14:00 - 17:00",
        startTime: new Date("2026-03-15T14:00:00"),
        endTime: new Date("2026-03-15T17:00:00"),
        zoneId: "zone_1",
        isActive: true,
      },
    ];

    recommender.setAvailableSlots(slots);

    const top = recommender.getTopRecommendation({
      customerId: "cust_123",
      zoneId: "zone_1",
      date: testDate,
    });

    expect(top).toBeDefined();
    expect(top).toHaveProperty("slotId");
    expect(top!.score).toBeGreaterThan(0);
  });

  it("should clear caches", () => {
    recommender.clear();

    // Should work without errors after clearing
    const recommendations = recommender.recommendSlots({
      customerId: "cust_123",
      zoneId: "zone_1",
      date: testDate,
    });

    expect(recommendations).toEqual([]);
  });
});
