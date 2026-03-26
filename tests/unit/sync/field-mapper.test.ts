/**
 * Unit tests for Field Mapper
 *
 * @module tests/unit/sync/field-mapper.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { FieldMapper } from "../../../packages/core/src/sync/field-mapper.js";
import type { SyncConfig } from "../../../packages/core/src/sync/sync-types.js";
import { PlatformType, SyncDirection, ConflictStrategy } from "../../../packages/core/src/sync/sync-types.js";

describe("FieldMapper", () => {
  let mapper: FieldMapper;
  let config: SyncConfig;

  beforeEach(() => {
    config = {
      configId: "config_1",
      tenantId: "tenant_1",
      platformType: PlatformType.SHOPIFY,
      direction: SyncDirection.INBOUND,
      conflictStrategy: ConflictStrategy.LAST_WRITE_WINS,
      fieldMappings: [
        {
          sourceField: "id",
          targetField: "externalOrderId",
          required: true,
          dataType: "string",
        },
        {
          sourceField: "email",
          targetField: "customerEmail",
          transformer: "email_normalize",
          required: true,
          dataType: "string",
        },
        {
          sourceField: "created_at",
          targetField: "createdAt",
          transformer: "date_format_iso",
          required: true,
          dataType: "date",
        },
        {
          sourceField: "total_price",
          targetField: "totalAmount",
          transformer: "currency_convert",
          required: true,
          dataType: "number",
        },
        {
          sourceField: "status",
          targetField: "status",
          transformer: "status_map_default",
          required: true,
          dataType: "string",
        },
      ],
      syncInterval: 300000,
      maxBatchSize: 500,
      autoRetry: true,
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mapper = new FieldMapper(config);
  });

  it("should map platform data to unified format", () => {
    const platformData = {
      id: "shop_123",
      email: "  CUSTOMER@EXAMPLE.COM  ",
      created_at: "2026-01-15T10:30:00Z",
      total_price: 99.99,
      status: "pending",
    };

    const order = mapper.mapToUnified(platformData, "order_1", "shop_123");

    expect(order.orderId).toBe("order_1");
    expect(order.externalOrderId).toBe("shop_123");
    expect(order.customerEmail).toBe("customer@example.com");
    expect(order.totalAmount).toBe(99.99);
  });

  it("should apply email normalization", () => {
    const platformData = {
      id: "shop_123",
      email: "  CUSTOMER@EXAMPLE.COM  ",
      created_at: "2026-01-15T10:30:00Z",
      total_price: 99.99,
      status: "pending",
    };

    const order = mapper.mapToUnified(platformData, "order_1", "shop_123");
    expect(order.customerEmail).toBe("customer@example.com");
  });

  it("should apply date ISO formatting", () => {
    const platformData = {
      id: "shop_123",
      email: "customer@example.com",
      created_at: "2026-01-15T10:30:00Z",
      total_price: 99.99,
      status: "pending",
    };

    const order = mapper.mapToUnified(platformData, "order_1", "shop_123");
    expect(order.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("should apply status mapping", () => {
    const platformData = {
      id: "shop_123",
      email: "customer@example.com",
      created_at: "2026-01-15T10:30:00Z",
      total_price: 99.99,
      status: "PENDING",
    };

    const order = mapper.mapToUnified(platformData, "order_1", "shop_123");
    expect(order.status).toBe("pending");
  });

  it("should handle nested fields with dot notation", () => {
    const mappingConfig = { ...config };
    mappingConfig.fieldMappings.push({
      sourceField: "customer.first_name",
      targetField: "customerFirstName",
      required: false,
      dataType: "string",
    });

    const nestedMapper = new FieldMapper(mappingConfig);

    const platformData = {
      id: "shop_123",
      email: "customer@example.com",
      created_at: "2026-01-15T10:30:00Z",
      total_price: 99.99,
      status: "pending",
      customer: {
        first_name: "John",
      },
    };

    const order = nestedMapper.mapToUnified(platformData, "order_1", "shop_123");
    expect(order.customerFirstName).toBe("John");
  });

  it("should validate required fields", () => {
    const platformData = {
      id: "shop_123",
      // email is missing but required
      created_at: "2026-01-15T10:30:00Z",
      total_price: 99.99,
      status: "pending",
    };

    expect(() => {
      mapper.validateRequiredFields(platformData);
    }).toThrow();
  });

  it("should type-check values", () => {
    expect(mapper.typeCheck("string value", "string")).toBe(true);
    expect(mapper.typeCheck(123, "number")).toBe(true);
    expect(mapper.typeCheck(true, "boolean")).toBe(true);
    expect(mapper.typeCheck([], "array")).toBe(true);
    expect(mapper.typeCheck({}, "object")).toBe(true);
    expect(mapper.typeCheck("2026-01-15", "date")).toBe(true);

    expect(mapper.typeCheck(123, "string")).toBe(false);
    expect(mapper.typeCheck("string", "number")).toBe(false);
  });

  it("should register custom transformers", () => {
    mapper.registerTransformer("custom_double", (value: unknown) => {
      return typeof value === "number" ? value * 2 : value;
    });

    const customConfig = { ...config };
    customConfig.fieldMappings = [
      {
        sourceField: "value",
        targetField: "value",
        transformer: "custom_double",
        required: true,
        dataType: "number",
      },
    ];

    const customMapper = new FieldMapper(customConfig);
    mapper.registerTransformer("custom_double", (value: unknown) => {
      return typeof value === "number" ? value * 2 : value;
    });

    const platformData = { value: 50 };
    const order = customMapper.mapToUnified(platformData, "order_1", "ext_1");
    expect(order.totalAmount).toBe(100);
  });

  it("should preview mapped data with warnings", () => {
    const platformData = {
      id: "shop_123",
      email: "customer@example.com",
      created_at: "2026-01-15T10:30:00Z",
      total_price: "not_a_number",
      status: "pending",
    };

    const preview = mapper.preview(platformData, "order_1", "shop_123");
    expect(preview.warnings.length).toBeGreaterThan(0);
    expect(preview.data).toBeDefined();
  });

  it("should map unified order back to external format", () => {
    const platformData = {
      id: "shop_123",
      email: "customer@example.com",
      created_at: "2026-01-15T10:30:00Z",
      total_price: 99.99,
      status: "pending",
    };

    const order = mapper.mapToUnified(platformData, "order_1", "shop_123");
    const external = mapper.mapToExternal(order);

    expect(external.id).toBe("shop_123");
    expect(external.email).toBe("customer@example.com");
  });

  it("should support currency conversion", () => {
    const platformData = {
      id: "shop_123",
      email: "customer@example.com",
      created_at: "2026-01-15T10:30:00Z",
      total_price: 99.999,
      status: "pending",
    };

    const order = mapper.mapToUnified(platformData, "order_1", "shop_123");
    expect(order.totalAmount).toBe(100.00);
  });

  it("should handle phone number normalization", () => {
    const mappingConfig = { ...config };
    mappingConfig.fieldMappings.push({
      sourceField: "phone",
      targetField: "shippingAddress.phone",
      transformer: "phone_normalize",
      required: false,
      dataType: "string",
    });

    const phoneMapper = new FieldMapper(mappingConfig);
    mapper.registerTransformer("phone_normalize", (value: unknown) => {
      if (typeof value === "string") {
        return value.replace(/\D/g, "");
      }
      return value;
    });

    const platformData = {
      id: "shop_123",
      email: "customer@example.com",
      created_at: "2026-01-15T10:30:00Z",
      total_price: 99.99,
      status: "pending",
      phone: "(123) 456-7890",
    };

    const order = phoneMapper.mapToUnified(platformData, "order_1", "shop_123");
    expect(order.shippingAddress?.phone).toBe("1234567890");
  });

  it("should handle address normalization", () => {
    const mappingConfig = { ...config };
    mappingConfig.fieldMappings.push({
      sourceField: "shipping_address_line1",
      targetField: "shippingAddress.line1",
      transformer: "address_normalize",
      required: false,
      dataType: "string",
    });

    const addressMapper = new FieldMapper(mappingConfig);
    mapper.registerTransformer("address_normalize", (value: unknown) => {
      if (typeof value === "string") {
        return value.trim().toUpperCase();
      }
      return value;
    });

    const platformData = {
      id: "shop_123",
      email: "customer@example.com",
      created_at: "2026-01-15T10:30:00Z",
      total_price: 99.99,
      status: "pending",
      shipping_address_line1: "  123 main street  ",
    };

    const order = addressMapper.mapToUnified(platformData, "order_1", "shop_123");
    expect(order.shippingAddress?.line1).toBe("123 MAIN STREET");
  });

  it("should apply number rounding", () => {
    const mappingConfig = { ...config };
    mappingConfig.fieldMappings = [
      {
        sourceField: "total",
        targetField: "totalAmount",
        transformer: "number_round_2",
        required: true,
        dataType: "number",
      },
    ];

    const roundMapper = new FieldMapper(mappingConfig);
    mapper.registerTransformer("number_round_2", (value: unknown) => {
      const num = typeof value === "string" ? parseFloat(value) : (value as number);
      return isNaN(num) ? 0 : Math.round(num * 100) / 100;
    });

    const platformData = { total: 99.9999 };
    const order = roundMapper.mapToUnified(platformData, "order_1", "ext_1");
    expect(order.totalAmount).toBe(100.00);
  });

  it("should handle JSON stringification", () => {
    const mappingConfig = { ...config };
    mappingConfig.fieldMappings = [
      {
        sourceField: "metadata",
        targetField: "metadata",
        transformer: "json_stringify",
        required: false,
        dataType: "object",
      },
    ];

    const jsonMapper = new FieldMapper(mappingConfig);

    const platformData = {
      id: "shop_123",
      email: "customer@example.com",
      created_at: "2026-01-15T10:30:00Z",
      total_price: 99.99,
      status: "pending",
      metadata: { key: "value" },
    };

    const order = jsonMapper.mapToUnified(platformData, "order_1", "shop_123");
    expect(typeof order.metadata).toBe("string");
  });

  it("should handle custom JavaScript transformers", () => {
    const mappingConfig = { ...config };
    mappingConfig.fieldMappings = [
      {
        sourceField: "value",
        targetField: "totalAmount",
        transformer: "(value) => typeof value === 'number' ? value * 1.1 : value",
        required: true,
        dataType: "number",
      },
    ];

    const customTransformMapper = new FieldMapper(mappingConfig);

    const platformData = {
      id: "shop_123",
      email: "customer@example.com",
      created_at: "2026-01-15T10:30:00Z",
      total_price: 99.99,
      status: "pending",
      value: 100,
    };

    const order = customTransformMapper.mapToUnified(platformData, "order_1", "shop_123");
    expect(order.totalAmount).toBe(110);
  });
});
