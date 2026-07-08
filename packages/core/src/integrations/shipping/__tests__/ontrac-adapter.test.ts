import { describe, it, expect, vi, beforeEach } from "vitest";
import { OnTracAdapter } from "../ontrac-adapter.js";
import type { ShipmentRequest } from "../types.js";

const makeRequest = (
  overrides?: Partial<ShipmentRequest>,
): ShipmentRequest => ({
  shipmentId: "ontrac-test-1",
  from: {
    name: "West Coast Warehouse",
    street1: "100 Harbor Blvd",
    city: "Los Angeles",
    state: "CA",
    zip: "90001",
    country: "US",
  },
  to: {
    name: "Alice Jones",
    street1: "789 Oak St",
    city: "San Francisco",
    state: "CA",
    zip: "94102",
    country: "US",
  },
  weight: { value: 1.5, unit: "lb" },
  ...overrides,
});

const makeAdapter = () =>
  new OnTracAdapter({ account: "test-acct", password: "test-pass" });

describe("OnTracAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("validateConfig", () => {
    it("throws if account missing", async () => {
      const adapter = new OnTracAdapter({
        account: "",
        password: "p",
      } as never);
      await expect(adapter.validateConfig()).rejects.toThrow(
        "OnTrac adapter requires account and password",
      );
    });

    it("throws if password missing", async () => {
      const adapter = new OnTracAdapter({
        account: "a",
        password: "",
      } as never);
      await expect(adapter.validateConfig()).rejects.toThrow(
        "OnTrac adapter requires account and password",
      );
    });
  });

  describe("getRates", () => {
    it("returns mapped rates for Western US shipment", async () => {
      const adapter = makeAdapter();

      vi.spyOn(adapter as never, "request").mockResolvedValue({
        Rates: [
          {
            ServiceCode: "G",
            ServiceDesc: "OnTrac Ground",
            ShipDate: "2026-04-04",
            DeliveryDate: "2026-04-06",
            Charges: 6.5,
            FuelSurcharge: 0.75,
            TransitDays: 2,
            Zone: "2",
          },
          {
            ServiceCode: "S",
            ServiceDesc: "OnTrac Sunrise",
            ShipDate: "2026-04-04",
            DeliveryDate: "2026-04-05",
            Charges: 18.0,
            FuelSurcharge: 2.0,
            TransitDays: 1,
            Zone: "2",
          },
        ],
      });

      const rates = await adapter.getRates(makeRequest());
      expect(rates).toHaveLength(2);

      const ground = rates.find((r) => r.rateId === "G");
      expect(ground).toBeDefined();
      expect(ground!.carrier).toBe("ONTRAC");
      expect(ground!.service).toBe("GROUND");
      expect(ground!.price).toBe(725); // (6.50 + 0.75) * 100
      expect(ground!.estimatedDays).toBe(2);

      const sunrise = rates.find((r) => r.rateId === "S");
      expect(sunrise!.service).toBe("OVERNIGHT");
      expect(sunrise!.price).toBe(2000); // (18.00 + 2.00) * 100
      expect(sunrise!.estimatedDays).toBe(1);
    });

    it("skips rates with errors", async () => {
      const adapter = makeAdapter();

      vi.spyOn(adapter as never, "request").mockResolvedValue({
        Rates: [
          {
            ServiceCode: "G",
            ServiceDesc: "Ground",
            ShipDate: "2026-04-04",
            DeliveryDate: "2026-04-06",
            Charges: 6.5,
            FuelSurcharge: 0.5,
            TransitDays: 2,
            Zone: "2",
          },
          {
            ServiceCode: "X",
            ServiceDesc: "Unknown",
            Charges: 0,
            FuelSurcharge: 0,
            TransitDays: 0,
            ShipDate: "",
            DeliveryDate: "",
            Zone: "",
            Error: "Service not available for this route",
          },
        ],
      });

      const rates = await adapter.getRates(makeRequest());
      expect(rates).toHaveLength(1);
      expect(rates[0].rateId).toBe("G");
    });
  });

  describe("createShipment", () => {
    it("returns label with OnTrac tracking number", async () => {
      const adapter = makeAdapter();
      const fakeBase64 = Buffer.from("ontrac-pdf-label").toString("base64");

      vi.spyOn(adapter as never, "request").mockResolvedValue({
        Shipment: {
          ID: "OT-12345",
          Tracking: "D10000001234567",
          ShipDate: "2026-04-04",
          ServiceCode: "G",
          Label: fakeBase64,
          Charges: 7.25,
        },
      });

      const label = await adapter.createShipment(makeRequest(), "G");
      expect(label.labelId).toBe("OT-12345");
      expect(label.trackingNumber).toBe("D10000001234567");
      expect(label.carrier).toBe("ONTRAC");
      expect(label.service).toBe("GROUND");
      expect(label.labelBytes).toEqual(Buffer.from("ontrac-pdf-label"));
    });

    it("throws on shipment creation error", async () => {
      const adapter = makeAdapter();

      vi.spyOn(adapter as never, "request").mockResolvedValue({
        Shipment: {
          ID: "",
          Tracking: "",
          ShipDate: "",
          ServiceCode: "G",
          Label: "",
          Charges: 0,
          Error: "Invalid ZIP code",
        },
      });

      await expect(adapter.createShipment(makeRequest(), "G")).rejects.toThrow(
        "OnTrac shipment creation failed: Invalid ZIP code",
      );
    });
  });

  describe("track", () => {
    it("returns DELIVERED status and events", async () => {
      const adapter = makeAdapter();

      vi.spyOn(adapter as never, "request").mockResolvedValue({
        Shipments: [
          {
            Tracking: "D10000001234567",
            Status: "Delivered",
            Description: "Package delivered",
            ServiceCode: "G",
            Delivered: true,
            Residential: true,
            ScheduledDelivery: "2026-04-06",
            Events: [
              {
                Status: "PU",
                Description: "Picked up",
                City: "LOS ANGELES",
                State: "CA",
                Zip: "90001",
                Date: "04/04/2026 09:00:00 AM",
                StatusCode: "PU",
              },
              {
                Status: "Delivered",
                Description: "Delivered",
                City: "SAN FRANCISCO",
                State: "CA",
                Zip: "94102",
                Date: "04/06/2026 02:30:00 PM",
                StatusCode: "DL",
              },
            ],
          },
        ],
      });

      const result = await adapter.track("D10000001234567");
      expect(result.carrier).toBe("ONTRAC");
      expect(result.status).toBe("DELIVERED");
      expect(result.events).toHaveLength(2);
      expect(result.events[0].status).toBe("PICKED_UP");
      expect(result.deliveryDate).toBeDefined();
    });

    it("returns UNKNOWN status for unrecognized tracking number", async () => {
      const adapter = makeAdapter();

      vi.spyOn(adapter as never, "request").mockResolvedValue({
        Shipments: [],
      });

      const result = await adapter.track("NOTFOUND");
      expect(result.status).toBe("UNKNOWN");
      expect(result.events).toHaveLength(0);
    });
  });

  describe("validateAddress", () => {
    it("returns valid for Western US state", async () => {
      const adapter = makeAdapter();
      const result = await adapter.validateAddress({
        name: "Test",
        street1: "123 Main",
        city: "Portland",
        state: "OR",
        zip: "97201",
        country: "US",
      });
      expect(result.valid).toBe(true);
    });

    it("returns invalid for non-Western US state", async () => {
      const adapter = makeAdapter();
      const result = await adapter.validateAddress({
        name: "Test",
        street1: "123 Main",
        city: "Dallas",
        state: "TX",
        zip: "75201",
        country: "US",
      });
      expect(result.valid).toBe(false);
      expect(result.messages?.[0]).toContain(
        "OnTrac only covers Western US states",
      );
    });
  });

  describe("cancelShipment", () => {
    it("returns true on successful cancellation", async () => {
      const adapter = makeAdapter();
      vi.spyOn(adapter as never, "request").mockResolvedValue({});
      const result = await adapter.cancelShipment("OT-12345");
      expect(result).toBe(true);
    });

    it("returns false when cancellation fails", async () => {
      const adapter = makeAdapter();
      vi.spyOn(adapter as never, "request").mockRejectedValue(
        new Error("Not found"),
      );
      const result = await adapter.cancelShipment("OT-99999");
      expect(result).toBe(false);
    });
  });
});
