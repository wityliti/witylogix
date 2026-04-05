import { describe, it, expect, vi, beforeEach } from "vitest";
import { USPSAdapter } from "../usps-adapter.js";
import type { ShipmentRequest } from "../types.js";

const makeRequest = (overrides?: Partial<ShipmentRequest>): ShipmentRequest => ({
  shipmentId: "test-ship-1",
  from: {
    name: "Acme Warehouse",
    street1: "100 Main St",
    city: "Los Angeles",
    state: "CA",
    zip: "90001",
    country: "US",
  },
  to: {
    name: "Bob Smith",
    street1: "456 Elm Ave",
    city: "New York",
    state: "NY",
    zip: "10001",
    country: "US",
  },
  weight: { value: 2, unit: "lb" },
  ...overrides,
});

const makeAdapter = () =>
  new USPSAdapter({ consumerKey: "test-key", consumerSecret: "test-secret" });

describe("USPSAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("validateConfig", () => {
    it("throws if consumerKey missing", async () => {
      const adapter = new USPSAdapter({ consumerKey: "", consumerSecret: "s" } as never);
      await expect(adapter.validateConfig()).rejects.toThrow(
        "USPS adapter requires consumerKey and consumerSecret"
      );
    });

    it("throws if consumerSecret missing", async () => {
      const adapter = new USPSAdapter({ consumerKey: "k", consumerSecret: "" } as never);
      await expect(adapter.validateConfig()).rejects.toThrow(
        "USPS adapter requires consumerKey and consumerSecret"
      );
    });
  });

  describe("getRates", () => {
    it("returns mapped rates from API response", async () => {
      const adapter = makeAdapter();
      // Mock authenticate
      vi.spyOn(adapter as never, "authenticate").mockResolvedValue(undefined);
      (adapter as never).accessToken = "tok";
      (adapter as never).tokenExpiresAt = Date.now() + 60_000;

      vi.spyOn(adapter as never, "request").mockResolvedValue({
        rateOptions: [
          {
            rates: [
              {
                SKU: "PRIORITY_MAIL",
                description: "Priority Mail",
                priceType: "RETAIL",
                price: 8.5,
                maxWeight: 70,
                fees: [],
                startDate: "2026-01-01",
                endDate: "2026-12-31",
              },
              {
                SKU: "USPS_GROUND_ADVANTAGE",
                description: "Ground Advantage",
                priceType: "RETAIL",
                price: 5.25,
                maxWeight: 70,
                fees: [],
                startDate: "2026-01-01",
                endDate: "2026-12-31",
              },
            ],
            totalBasePrice: 8.5,
          },
        ],
      });

      const rates = await adapter.getRates(makeRequest());
      expect(rates).toHaveLength(2);

      const priority = rates.find((r) => r.rateId === "PRIORITY_MAIL");
      expect(priority).toBeDefined();
      expect(priority!.carrier).toBe("USPS");
      expect(priority!.service).toBe("PRIORITY");
      expect(priority!.price).toBe(850); // $8.50 → 850 cents
      expect(priority!.currency).toBe("USD");
      expect(priority!.estimatedDays).toBe(2);

      const ground = rates.find((r) => r.rateId === "USPS_GROUND_ADVANTAGE");
      expect(ground!.service).toBe("GROUND");
      expect(ground!.price).toBe(525);
      expect(ground!.estimatedDays).toBe(5);
    });

    it("returns empty array when rateOptions is empty", async () => {
      const adapter = makeAdapter();
      (adapter as never).accessToken = "tok";
      (adapter as never).tokenExpiresAt = Date.now() + 60_000;

      vi.spyOn(adapter as never, "request").mockResolvedValue({ rateOptions: [] });

      const rates = await adapter.getRates(makeRequest());
      expect(rates).toHaveLength(0);
    });
  });

  describe("createShipment", () => {
    it("returns label with tracking number and PDF bytes", async () => {
      const adapter = makeAdapter();
      (adapter as never).accessToken = "tok";
      (adapter as never).tokenExpiresAt = Date.now() + 60_000;

      const fakeBase64 = Buffer.from("fake-pdf").toString("base64");

      vi.spyOn(adapter as never, "request").mockResolvedValue({
        labelMetadata: {
          trackingNumber: "9400111899223282607816",
          SKU: "PRIORITY_MAIL",
          postage: 8.5,
          weight: 2,
          mailingDate: "2026-04-04",
          labelImage: fakeBase64,
          labelAddress: {
            streetAddress: "456 Elm Ave",
            city: "New York",
            ZIPCode: "10001",
            state: "NY",
          },
          routingInformation: "",
          constructCode: "",
        },
      });

      const label = await adapter.createShipment(makeRequest(), "PRIORITY_MAIL");
      expect(label.trackingNumber).toBe("9400111899223282607816");
      expect(label.carrier).toBe("USPS");
      expect(label.service).toBe("PRIORITY");
      expect(label.format).toBe("PDF");
      expect(label.labelBytes).toEqual(Buffer.from("fake-pdf"));
    });
  });

  describe("track", () => {
    it("maps tracking events and sets DELIVERED status", async () => {
      const adapter = makeAdapter();
      (adapter as never).accessToken = "tok";
      (adapter as never).tokenExpiresAt = Date.now() + 60_000;

      vi.spyOn(adapter as never, "request").mockResolvedValue({
        TrackSummary: {
          EventTime: "10:00 am",
          EventDate: "April 4, 2026",
          Event: "DELIVERED",
          EventCity: "NEW YORK",
          EventState: "NY",
          EventZIPCode: "10001",
          EventCountry: "",
          GMT: "",
          GMTOffset: "",
        },
        TrackDetail: [
          {
            EventTime: "8:00 am",
            EventDate: "April 4, 2026",
            Event: "Out for Delivery",
            EventCity: "NEW YORK",
            EventState: "NY",
            EventZIPCode: "10001",
            EventCountry: "",
            GMT: "",
            GMTOffset: "",
          },
        ],
      });

      const result = await adapter.track("9400111899223282607816");
      expect(result.carrier).toBe("USPS");
      expect(result.status).toBe("DELIVERED");
      expect(result.events).toHaveLength(2);
      expect(result.events.some((e) => e.status === "OUT_FOR_DELIVERY")).toBe(true);
    });
  });

  describe("validateAddress", () => {
    it("returns valid address with corrections", async () => {
      const adapter = makeAdapter();
      (adapter as never).accessToken = "tok";
      (adapter as never).tokenExpiresAt = Date.now() + 60_000;

      vi.spyOn(adapter as never, "request").mockResolvedValue({
        address: {
          streetAddress: "456 ELM AVE",
          city: "NEW YORK",
          state: "NY",
          postalCode: "10001",
          countryISOCode: "US",
        },
        corrections: [{ originalValue: "Elm Ave", correctedValue: "ELM AVE" }],
      });

      const result = await adapter.validateAddress({
        name: "Bob Smith",
        street1: "456 Elm Ave",
        city: "New York",
        state: "NY",
        zip: "10001",
        country: "US",
      });

      expect(result.valid).toBe(true);
      expect(result.address?.street1).toBe("456 ELM AVE");
      expect(result.messages).toHaveLength(1);
    });

    it("returns invalid when API throws", async () => {
      const adapter = makeAdapter();
      (adapter as never).accessToken = "tok";
      (adapter as never).tokenExpiresAt = Date.now() + 60_000;

      vi.spyOn(adapter as never, "request").mockRejectedValue(new Error("Not found"));

      const result = await adapter.validateAddress({
        name: "X",
        street1: "Bad Rd",
        city: "Nowhere",
        state: "XX",
        zip: "00000",
        country: "US",
      });

      expect(result.valid).toBe(false);
    });
  });

  describe("cancelShipment", () => {
    it("returns false (USPS does not support API cancellation)", async () => {
      const adapter = makeAdapter();
      const result = await adapter.cancelShipment("some-label-id");
      expect(result).toBe(false);
    });
  });
});
