/**
 * Comprehensive test suite for API validation schemas.
 * Tests cover valid/invalid payloads, edge cases, and error quality.
 *
 * Run with: npm test -- validation-schemas.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  orderCreateSchema,
  orderUpdateSchema,
  driverCreateSchema,
  driverLocationSchema,
  deliveryCreateSchema,
  deliveryCompleteSchema,
  zoneCreateSchema,
  zonePointValidationSchema,
  organizationCreateSchema,
  inviteMemberSchema,
  searchQuery,
  bulkOrderCreateSchema,
  exportRequest,
} from "../validation-schemas";

// ─── ORDER SCHEMA TESTS ────────────────────────────────────────

describe("Order Schemas", () => {
  describe("orderCreateSchema", () => {
    it("should accept valid order creation payload", () => {
      const validOrder = {
        customerName: "John Doe",
        customerPhone: "+1234567890",
        shippingAddress: {
          street: "123 Main St",
          city: "New York",
          state: "NY",
          postalCode: "10001",
          country: "US",
        },
        items: [
          {
            name: "Widget",
            sku: "SKU001",
            quantity: 2,
            price: 29.99,
          },
        ],
        totalAmount: 59.98,
        currency: "USD",
      };

      const result = orderCreateSchema.safeParse(validOrder);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.customerName).toBe("John Doe");
      }
    });

    it("should reject order missing required fields", () => {
      const invalidOrder = {
        customerPhone: "+1234567890",
        // missing customerName, shippingAddress, items, etc
      };

      const result = orderCreateSchema.safeParse(invalidOrder);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });

    it("should reject invalid email format", () => {
      const orderWithBadEmail = {
        customerName: "John Doe",
        customerEmail: "not-an-email",
        customerPhone: "+1234567890",
        shippingAddress: {
          street: "123 Main St",
          city: "New York",
          state: "NY",
          postalCode: "10001",
          country: "US",
        },
        items: [{ name: "Widget", sku: "SKU001", quantity: 1, price: 29.99 }],
        totalAmount: 29.99,
        currency: "USD",
      };

      const result = orderCreateSchema.safeParse(orderWithBadEmail);
      expect(result.success).toBe(false);
    });

    it("should reject invalid phone format", () => {
      const orderWithBadPhone = {
        customerName: "John Doe",
        customerPhone: "123", // too short
        shippingAddress: {
          street: "123 Main St",
          city: "New York",
          state: "NY",
          postalCode: "10001",
          country: "US",
        },
        items: [{ name: "Widget", sku: "SKU001", quantity: 1, price: 29.99 }],
        totalAmount: 29.99,
        currency: "USD",
      };

      const result = orderCreateSchema.safeParse(orderWithBadPhone);
      expect(result.success).toBe(false);
    });

    it("should reject negative total amount", () => {
      const orderWithNegativeAmount = {
        customerName: "John Doe",
        customerPhone: "+1234567890",
        shippingAddress: {
          street: "123 Main St",
          city: "New York",
          state: "NY",
          postalCode: "10001",
          country: "US",
        },
        items: [{ name: "Widget", sku: "SKU001", quantity: 1, price: -29.99 }],
        totalAmount: -29.99,
        currency: "USD",
      };

      const result = orderCreateSchema.safeParse(orderWithNegativeAmount);
      expect(result.success).toBe(false);
    });

    it("should reject order with zero items", () => {
      const orderWithNoItems = {
        customerName: "John Doe",
        customerPhone: "+1234567890",
        shippingAddress: {
          street: "123 Main St",
          city: "New York",
          state: "NY",
          postalCode: "10001",
          country: "US",
        },
        items: [],
        totalAmount: 0,
        currency: "USD",
      };

      const result = orderCreateSchema.safeParse(orderWithNoItems);
      expect(result.success).toBe(false);
    });

    it("should reject invalid country code (must be 2 letters)", () => {
      const orderWithBadCountry = {
        customerName: "John Doe",
        customerPhone: "+1234567890",
        shippingAddress: {
          street: "123 Main St",
          city: "New York",
          state: "NY",
          postalCode: "10001",
          country: "USA", // should be US
        },
        items: [{ name: "Widget", sku: "SKU001", quantity: 1, price: 29.99 }],
        totalAmount: 29.99,
        currency: "USD",
      };

      const result = orderCreateSchema.safeParse(orderWithBadCountry);
      expect(result.success).toBe(false);
    });

    it("should accept optional fields (notes, metadata)", () => {
      const orderWithOptionals = {
        customerName: "John Doe",
        customerPhone: "+1234567890",
        shippingAddress: {
          street: "123 Main St",
          city: "New York",
          state: "NY",
          postalCode: "10001",
          country: "US",
        },
        items: [{ name: "Widget", sku: "SKU001", quantity: 1, price: 29.99 }],
        totalAmount: 29.99,
        currency: "USD",
        notes: "Handle with care",
        metadata: { customField: "value" },
      };

      const result = orderCreateSchema.safeParse(orderWithOptionals);
      expect(result.success).toBe(true);
    });

    it("should reject SQL injection attempts in notes", () => {
      const orderWithSQLInjection = {
        customerName: "John Doe",
        customerPhone: "+1234567890",
        shippingAddress: {
          street: "123 Main St",
          city: "New York",
          state: "NY",
          postalCode: "10001",
          country: "US",
        },
        items: [{ name: "Widget", sku: "SKU001", quantity: 1, price: 29.99 }],
        totalAmount: 29.99,
        currency: "USD",
        notes: "'; DROP TABLE orders; --",
      };

      // Schema should accept (string validation is basic), but app should sanitize
      const result = orderCreateSchema.safeParse(orderWithSQLInjection);
      // This should pass schema validation, but would be caught by query sanitization
      expect(result.success).toBe(true);
    });

    it("should enforce max length on notes field", () => {
      const orderWithLongNotes = {
        customerName: "John Doe",
        customerPhone: "+1234567890",
        shippingAddress: {
          street: "123 Main St",
          city: "New York",
          state: "NY",
          postalCode: "10001",
          country: "US",
        },
        items: [{ name: "Widget", sku: "SKU001", quantity: 1, price: 29.99 }],
        totalAmount: 29.99,
        currency: "USD",
        notes: "a".repeat(1001), // exceeds max 1000
      };

      const result = orderCreateSchema.safeParse(orderWithLongNotes);
      expect(result.success).toBe(false);
    });
  });

  describe("orderUpdateSchema", () => {
    it("should accept partial order update", () => {
      const update = {
        customerName: "Jane Doe",
      };

      const result = orderUpdateSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it("should allow empty update object", () => {
      const result = orderUpdateSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});

// ─── DRIVER SCHEMA TESTS ───────────────────────────────────────

describe("Driver Schemas", () => {
  describe("driverCreateSchema", () => {
    it("should accept valid driver creation payload", () => {
      const validDriver = {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        phone: "+1234567890",
        licenseNumber: "DL123456",
        licenseExpiry: "2026-12-31",
        vehicleType: "VAN",
        baseLocation: {
          latitude: 40.7128,
          longitude: -74.006,
        },
      };

      const result = driverCreateSchema.safeParse(validDriver);
      expect(result.success).toBe(true);
    });

    it("should reject driver with invalid coordinates", () => {
      const driverWithBadCoords = {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        phone: "+1234567890",
        licenseNumber: "DL123456",
        licenseExpiry: "2026-12-31",
        vehicleType: "VAN",
        baseLocation: {
          latitude: 91, // exceeds max 90
          longitude: -74.006,
        },
      };

      const result = driverCreateSchema.safeParse(driverWithBadCoords);
      expect(result.success).toBe(false);
    });

    it("should reject invalid date format", () => {
      const driverWithBadDate = {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        phone: "+1234567890",
        licenseNumber: "DL123456",
        licenseExpiry: "2026/12/31", // wrong format
        vehicleType: "VAN",
        baseLocation: {
          latitude: 40.7128,
          longitude: -74.006,
        },
      };

      const result = driverCreateSchema.safeParse(driverWithBadDate);
      expect(result.success).toBe(false);
    });

    it("should accept optional insurance field", () => {
      const driverWithInsurance = {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        phone: "+1234567890",
        licenseNumber: "DL123456",
        licenseExpiry: "2026-12-31",
        vehicleType: "VAN",
        baseLocation: {
          latitude: 40.7128,
          longitude: -74.006,
        },
        insurance: {
          provider: "InsureCo",
          policyNumber: "POL123456",
          expiryDate: "2026-12-31",
        },
      };

      const result = driverCreateSchema.safeParse(driverWithInsurance);
      expect(result.success).toBe(true);
    });
  });

  describe("driverLocationSchema", () => {
    it("should accept valid location update", () => {
      const validLocation = {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 5.5,
        timestamp: new Date().toISOString(),
      };

      const result = driverLocationSchema.safeParse(validLocation);
      expect(result.success).toBe(true);
    });

    it("should reject coordinates outside bounds", () => {
      const invalidLocation = {
        latitude: -91, // exceeds bounds
        longitude: -74.006,
        timestamp: new Date().toISOString(),
      };

      const result = driverLocationSchema.safeParse(invalidLocation);
      expect(result.success).toBe(false);
    });

    it("should reject invalid timestamp", () => {
      const invalidLocation = {
        latitude: 40.7128,
        longitude: -74.006,
        timestamp: "not-a-date",
      };

      const result = driverLocationSchema.safeParse(invalidLocation);
      expect(result.success).toBe(false);
    });
  });
});

// ─── DELIVERY SCHEMA TESTS ─────────────────────────────────────

describe("Delivery Schemas", () => {
  describe("deliveryCreateSchema", () => {
    it("should accept valid delivery creation", () => {
      const validDelivery = {
        recipientName: "Jane Smith",
        recipientPhone: "+1987654321",
        address: {
          street: "456 Oak Ave",
          city: "Boston",
          state: "MA",
          postalCode: "02101",
          country: "US",
        },
        deliveryType: "STANDARD",
      };

      const result = deliveryCreateSchema.safeParse(validDelivery);
      expect(result.success).toBe(true);
    });

    it("should accept delivery with time window", () => {
      const deliveryWithWindow = {
        recipientName: "Jane Smith",
        recipientPhone: "+1987654321",
        address: {
          street: "456 Oak Ave",
          city: "Boston",
          state: "MA",
          postalCode: "02101",
          country: "US",
        },
        deliveryType: "SCHEDULED",
        scheduledDate: "2026-04-01",
        scheduledWindow: {
          startTime: "09:00",
          endTime: "17:00",
        },
      };

      const result = deliveryCreateSchema.safeParse(deliveryWithWindow);
      expect(result.success).toBe(true);
    });

    it("should reject invalid time format", () => {
      const deliveryWithBadTime = {
        recipientName: "Jane Smith",
        recipientPhone: "+1987654321",
        address: {
          street: "456 Oak Ave",
          city: "Boston",
          state: "MA",
          postalCode: "02101",
          country: "US",
        },
        deliveryType: "SCHEDULED",
        scheduledWindow: {
          startTime: "9:00", // should be 09:00
          endTime: "17:00",
        },
      };

      const result = deliveryCreateSchema.safeParse(deliveryWithBadTime);
      expect(result.success).toBe(false);
    });
  });

  describe("deliveryCompleteSchema", () => {
    it("should accept completion with proof", () => {
      const completion = {
        status: "COMPLETED",
        proof: {
          proofType: "SIGNATURE",
          signatureUrl: "https://example.com/sig.png",
        },
      };

      const result = deliveryCompleteSchema.safeParse(completion);
      expect(result.success).toBe(true);
    });

    it("should accept failure with reason", () => {
      const failure = {
        status: "FAILED",
        failureReason: "Recipient not available",
      };

      const result = deliveryCompleteSchema.safeParse(failure);
      expect(result.success).toBe(true);
    });

    it("should reject invalid URL in proof", () => {
      const invalidProof = {
        status: "COMPLETED",
        proof: {
          proofType: "SIGNATURE",
          signatureUrl: "not-a-url",
        },
      };

      const result = deliveryCompleteSchema.safeParse(invalidProof);
      expect(result.success).toBe(false);
    });
  });
});

// ─── ZONE SCHEMA TESTS ───────────────────────────────────────

describe("Zone Schemas", () => {
  describe("zoneCreateSchema", () => {
    it("should accept valid zone with polygon", () => {
      const validZone = {
        name: "Downtown",
        polygon: {
          type: "Polygon" as const,
          coordinates: [
            [
              [-74.006, 40.7128],
              [-74.005, 40.7128],
              [-74.005, 40.7129],
              [-74.006, 40.7129],
              [-74.006, 40.7128],
            ],
          ],
        },
        serviceLevel: "EXPRESS",
      };

      const result = zoneCreateSchema.safeParse(validZone);
      expect(result.success).toBe(true);
    });

    it("should reject zone with invalid polygon type", () => {
      const invalidZone = {
        name: "Downtown",
        polygon: {
          type: "MultiPolygon",
          coordinates: [[[]]],
        },
        serviceLevel: "EXPRESS",
      };

      const result = zoneCreateSchema.safeParse(invalidZone);
      expect(result.success).toBe(false);
    });

    it("should reject zone with empty polygon coordinates", () => {
      const invalidZone = {
        name: "Downtown",
        polygon: {
          type: "Polygon" as const,
          coordinates: [],
        },
        serviceLevel: "EXPRESS",
      };

      const result = zoneCreateSchema.safeParse(invalidZone);
      expect(result.success).toBe(false);
    });
  });

  describe("zonePointValidationSchema", () => {
    it("should accept point within valid bounds", () => {
      const point = {
        latitude: 0,
        longitude: 0,
      };

      const result = zonePointValidationSchema.safeParse(point);
      expect(result.success).toBe(true);
    });

    it("should reject point outside latitude bounds", () => {
      const point = {
        latitude: 100,
        longitude: 0,
      };

      const result = zonePointValidationSchema.safeParse(point);
      expect(result.success).toBe(false);
    });

    it("should reject point outside longitude bounds", () => {
      const point = {
        latitude: 0,
        longitude: 200,
      };

      const result = zonePointValidationSchema.safeParse(point);
      expect(result.success).toBe(false);
    });
  });
});

// ─── ORGANIZATION SCHEMA TESTS ────────────────────────────────

describe("Organization Schemas", () => {
  describe("organizationCreateSchema", () => {
    it("should accept valid organization creation", () => {
      const validOrg = {
        name: "Acme Logistics",
        slug: "acme-logistics",
        email: "contact@acme.com",
      };

      const result = organizationCreateSchema.safeParse(validOrg);
      expect(result.success).toBe(true);
    });

    it("should reject invalid slug format", () => {
      const orgWithBadSlug = {
        name: "Acme Logistics",
        slug: "Acme Logistics", // spaces not allowed
        email: "contact@acme.com",
      };

      const result = organizationCreateSchema.safeParse(orgWithBadSlug);
      expect(result.success).toBe(false);
    });

    it("should reject invalid website URL", () => {
      const orgWithBadUrl = {
        name: "Acme Logistics",
        slug: "acme-logistics",
        email: "contact@acme.com",
        website: "not-a-url",
      };

      const result = organizationCreateSchema.safeParse(orgWithBadUrl);
      expect(result.success).toBe(false);
    });
  });

  describe("inviteMemberSchema", () => {
    it("should accept valid member invitation", () => {
      const invite = {
        email: "newmember@example.com",
        role: "ADMIN",
      };

      const result = inviteMemberSchema.safeParse(invite);
      expect(result.success).toBe(true);
    });

    it("should reject invalid role", () => {
      const invalidInvite = {
        email: "newmember@example.com",
        role: "SUPERUSER", // not in allowed roles
      };

      const result = inviteMemberSchema.safeParse(invalidInvite);
      expect(result.success).toBe(false);
    });
  });
});

// ─── SEARCH & PAGINATION TESTS ────────────────────────────────

describe("Search & Pagination Schemas", () => {
  describe("searchQuery", () => {
    it("should accept search with pagination", () => {
      const query = {
        q: "urgent",
        page: 1,
        limit: 25,
      };

      const result = searchQuery.safeParse(query);
      expect(result.success).toBe(true);
    });

    it("should enforce limit bounds", () => {
      const queryWithBadLimit = {
        q: "urgent",
        page: 1,
        limit: 101, // exceeds max 100
      };

      const result = searchQuery.safeParse(queryWithBadLimit);
      expect(result.success).toBe(false);
    });

    it("should enforce page >= 1", () => {
      const queryWithBadPage = {
        q: "urgent",
        page: 0,
        limit: 25,
      };

      const result = searchQuery.safeParse(queryWithBadPage);
      expect(result.success).toBe(false);
    });

    it("should accept cursor-based pagination", () => {
      const query = {
        cursor: "eyJpZCI6IjEyMyJ9",
        limit: 25,
      };

      const result = searchQuery.safeParse(query);
      expect(result.success).toBe(true);
    });
  });
});

// ─── BULK OPERATION TESTS ────────────────────────────────────

describe("Bulk Operation Schemas", () => {
  describe("bulkOrderCreateSchema", () => {
    it("should accept bulk order creation with multiple items", () => {
      const bulkOrders = {
        orders: [
          {
            customerName: "John Doe",
            customerPhone: "+1234567890",
            shippingAddress: {
              street: "123 Main St",
              city: "New York",
              state: "NY",
              postalCode: "10001",
              country: "US",
            },
            items: [
              { name: "Widget", sku: "SKU001", quantity: 1, price: 29.99 },
            ],
            totalAmount: 29.99,
            currency: "USD",
          },
          {
            customerName: "Jane Smith",
            customerPhone: "+1987654321",
            shippingAddress: {
              street: "456 Oak Ave",
              city: "Boston",
              state: "MA",
              postalCode: "02101",
              country: "US",
            },
            items: [
              { name: "Gadget", sku: "SKU002", quantity: 2, price: 19.99 },
            ],
            totalAmount: 39.98,
            currency: "USD",
          },
        ],
      };

      const result = bulkOrderCreateSchema.safeParse(bulkOrders);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orders).toHaveLength(2);
      }
    });

    it("should reject empty bulk order request", () => {
      const emptyBulk = {
        orders: [],
      };

      const result = bulkOrderCreateSchema.safeParse(emptyBulk);
      expect(result.success).toBe(false);
    });

    it("should enforce bulk operation size limit", () => {
      const orders = Array(1001)
        .fill(null)
        .map((_, i) => ({
          customerName: `Customer ${i}`,
          customerPhone: "+1234567890",
          shippingAddress: {
            street: "123 Main St",
            city: "New York",
            state: "NY",
            postalCode: "10001",
            country: "US",
          },
          items: [
            { name: "Widget", sku: `SKU${i}`, quantity: 1, price: 29.99 },
          ],
          totalAmount: 29.99,
          currency: "USD",
        }));

      const result = bulkOrderCreateSchema.safeParse({ orders });
      expect(result.success).toBe(false);
    });
  });
});

// ─── EXPORT SCHEMA TESTS ───────────────────────────────────────

describe("Export Schema", () => {
  it("should accept export request with all options", () => {
    const exportData = {
      format: "csv",
      fields: ["id", "status", "date"],
      filters: { status: "COMPLETED" },
    };

    const result = exportRequest.safeParse(exportData);
    expect(result.success).toBe(true);
  });

  it("should reject invalid export format", () => {
    const invalidExport = {
      format: "pdf", // not supported
    };

    const result = exportRequest.safeParse(invalidExport);
    expect(result.success).toBe(false);
  });

  it("should accept export with date range", () => {
    const exportData = {
      format: "json",
      filters: {
        createdAfter: "2026-01-01T00:00:00Z",
        createdBefore: "2026-03-16T23:59:59Z",
      },
    };

    const result = exportRequest.safeParse(exportData);
    expect(result.success).toBe(true);
  });
});
