/**
 * Field mapping engine for transforming platform-specific order data
 * to unified Witylogix order model and vice versa.
 *
 * Supports built-in transformers and custom JavaScript transforms.
 *
 * @module sync/field-mapper
 */

import type {
  FieldMapping,
  PlatformOrder,
  Address,
  OrderItem,
  SyncConfig,
} from "./sync-types.js";

/**
 * Built-in transformer functions for common data conversions
 */
export interface TransformerRegistry {
  [key: string]: (value: unknown) => unknown;
}

/**
 * Field mapper for bidirectional platform and Witylogix order conversion
 */
export class FieldMapper {
  private transformers: TransformerRegistry = {};
  private config: SyncConfig;

  /**
   * Initialize field mapper with sync configuration
   * @param config - Sync configuration with field mappings
   */
  constructor(config: SyncConfig) {
    this.config = config;
    this.initializeBuiltInTransformers();
  }

  /**
   * Initialize built-in transformer functions
   */
  private initializeBuiltInTransformers(): void {
    // Currency conversion transformer
    this.transformers["currency_convert"] = (value: unknown) => {
      if (typeof value !== "number") return value;
      return parseFloat(value.toFixed(2));
    };

    // Date format transformer (ISO 8601)
    this.transformers["date_format_iso"] = (value: unknown) => {
      if (typeof value === "string") {
        const date = new Date(value);
        return date.toISOString();
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    };

    // Date format transformer (Unix timestamp)
    this.transformers["date_format_unix"] = (value: unknown) => {
      if (typeof value === "string") {
        return new Date(value).getTime();
      }
      if (value instanceof Date) {
        return value.getTime();
      }
      return value;
    };

    // Status mapping transformer
    this.transformers["status_map_default"] = (value: unknown) => {
      const statusMap: Record<string, string> = {
        pending: "pending",
        processing: "processing",
        shipped: "shipped",
        delivered: "delivered",
        cancelled: "cancelled",
        refunded: "refunded",
      };
      return statusMap[String(value).toLowerCase()] || String(value);
    };

    // Address normalization transformer
    this.transformers["address_normalize"] = (value: unknown) => {
      if (typeof value === "string") {
        return value.trim().toUpperCase();
      }
      return value;
    };

    // Email normalization
    this.transformers["email_normalize"] = (value: unknown) => {
      if (typeof value === "string") {
        return value.toLowerCase().trim();
      }
      return value;
    };

    // Phone number normalization
    this.transformers["phone_normalize"] = (value: unknown) => {
      if (typeof value === "string") {
        return value.replace(/\D/g, "");
      }
      return value;
    };

    // Boolean conversion
    this.transformers["bool_convert"] = (value: unknown) => {
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        return (
          value.toLowerCase() === "true" || value === "1" || value === "yes"
        );
      }
      return Boolean(value);
    };

    // Number conversion with rounding
    this.transformers["number_round_2"] = (value: unknown) => {
      const num =
        typeof value === "string" ? parseFloat(value) : (value as number);
      return isNaN(num) ? 0 : Math.round(num * 100) / 100;
    };

    // String trimming
    this.transformers["string_trim"] = (value: unknown) => {
      return typeof value === "string" ? value.trim() : value;
    };

    // URL encoding
    this.transformers["url_encode"] = (value: unknown) => {
      return typeof value === "string" ? encodeURIComponent(value) : value;
    };

    // URL decoding
    this.transformers["url_decode"] = (value: unknown) => {
      return typeof value === "string" ? decodeURIComponent(value) : value;
    };

    // JSON stringification
    this.transformers["json_stringify"] = (value: unknown) => {
      return JSON.stringify(value);
    };

    // JSON parsing
    this.transformers["json_parse"] = (value: unknown) => {
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    };
  }

  /**
   * Register a custom transformer function
   * @param name - Transformer function name
   * @param fn - Transformer function
   */
  public registerTransformer(
    name: string,
    fn: (value: unknown) => unknown,
  ): void {
    this.transformers[name] = fn;
  }

  /**
   * Get value from nested object using dot notation
   * @param obj - Object to traverse
   * @param path - Dot-notation path
   * @returns Value at path or undefined
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split(".");
    let value: unknown = obj;

    for (const key of keys) {
      if (value && typeof value === "object") {
        value = (value as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Set value in nested object using dot notation
   * @param obj - Object to modify
   * @param path - Dot-notation path
   * @param value - Value to set
   */
  private setNestedValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const keys = path.split(".");
    const lastKey = keys.pop();

    if (!lastKey) return;

    let current: Record<string, unknown> = obj;
    for (const key of keys) {
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }

    current[lastKey] = value;
  }

  /**
   * Apply transformer to a value
   * @param value - Value to transform
   * @param transformerName - Name of transformer function
   * @returns Transformed value
   */
  private applyTransformer(value: unknown, transformerName: string): unknown {
    const transformer = this.transformers[transformerName];
    if (!transformer) {
      console.warn(`Transformer not found: ${transformerName}`);
      return value;
    }
    try {
      return transformer(value);
    } catch (error) {
      console.error(`Transformer error for ${transformerName}:`, error);
      return value;
    }
  }

  /**
   * Execute custom JavaScript transformer
   * @param value - Value to transform
   * @param code - JavaScript code as string
   * @returns Transformed value
   */
  private executeCustomTransformer(value: unknown, code: string): unknown {
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function("value", `return (${code})(value)`);
      return fn(value);
    } catch (error) {
      console.error(`Custom transformer execution error:`, error);
      return value;
    }
  }

  /**
   * Map platform data to unified Witylogix order format
   * @param platformData - Raw platform-specific order data
   * @param orderId - Witylogix order ID
   * @param externalOrderId - External platform order ID
   * @returns Mapped order in unified format
   */
  public mapToUnified(
    platformData: Record<string, unknown>,
    orderId: string,
    externalOrderId: string,
  ): PlatformOrder {
    const order: Partial<PlatformOrder> = {
      orderId,
      externalOrderId,
      platformType: this.config.platformType,
      tenantId: this.config.tenantId,
      items: [],
    };

    // Apply field mappings
    for (const mapping of this.config.fieldMappings) {
      const sourceValue = this.getNestedValue(
        platformData,
        mapping.sourceField,
      );

      // Skip required field validation during mapping, will validate after
      if (sourceValue === undefined && !mapping.required) {
        continue;
      }

      let transformedValue = sourceValue;

      // Apply transformer if specified
      if (mapping.transformer) {
        if (
          mapping.transformer.includes("=>") ||
          mapping.transformer.includes("function")
        ) {
          // Custom JavaScript transformer
          transformedValue = this.executeCustomTransformer(
            sourceValue,
            mapping.transformer,
          );
        } else {
          // Built-in transformer name
          transformedValue = this.applyTransformer(
            sourceValue,
            mapping.transformer,
          );
        }
      }

      this.setNestedValue(order, mapping.targetField, transformedValue);
    }

    return order as PlatformOrder;
  }

  /**
   * Map Witylogix order to platform-specific format (reverse mapping)
   * @param order - Witylogix order
   * @returns Platform-specific order data
   */
  public mapToExternal(order: PlatformOrder): Record<string, unknown> {
    const platformData: Record<string, unknown> = {};

    // Create reverse mappings
    for (const mapping of this.config.fieldMappings) {
      const unifiedValue = this.getNestedValue(order, mapping.targetField);

      if (unifiedValue === undefined) {
        continue;
      }

      let transformedValue = unifiedValue;

      // For outbound, apply transformer in reverse context if needed
      if (mapping.transformer) {
        // Most transformers are one-way, but some support reverse
        if (mapping.transformer === "currency_convert") {
          transformedValue = this.applyTransformer(
            unifiedValue,
            "currency_convert",
          );
        } else if (mapping.transformer === "date_format_iso") {
          // Already in ISO format, keep as-is
          transformedValue = unifiedValue;
        }
      }

      this.setNestedValue(platformData, mapping.sourceField, transformedValue);
    }

    return platformData;
  }

  /**
   * Validate that all required fields are mapped
   * @param platformData - Platform data to validate
   * @throws Error if required fields are missing
   */
  public validateRequiredFields(platformData: Record<string, unknown>): void {
    const missing: string[] = [];

    for (const mapping of this.config.fieldMappings) {
      if (mapping.required) {
        const value = this.getNestedValue(platformData, mapping.sourceField);
        if (value === undefined || value === null || value === "") {
          missing.push(mapping.sourceField);
        }
      }
    }

    if (missing.length > 0) {
      throw new Error(`Required fields missing: ${missing.join(", ")}`);
    }
  }

  /**
   * Type-check a value against expected data type
   * @param value - Value to check
   * @param expectedType - Expected data type
   * @returns Whether type matches
   */
  public typeCheck(
    value: unknown,
    expectedType: "string" | "number" | "boolean" | "date" | "object" | "array",
  ): boolean {
    if (value === null || value === undefined) {
      return false;
    }

    switch (expectedType) {
      case "string":
        return typeof value === "string";
      case "number":
        return typeof value === "number" && !isNaN(value);
      case "boolean":
        return typeof value === "boolean";
      case "date":
        return (
          value instanceof Date ||
          (typeof value === "string" && !isNaN(Date.parse(value)))
        );
      case "object":
        return typeof value === "object" && !Array.isArray(value);
      case "array":
        return Array.isArray(value);
      default:
        return false;
    }
  }

  /**
   * Preview mapped data without persisting
   * @param platformData - Platform data to map
   * @param orderId - Order ID
   * @param externalOrderId - External order ID
   * @returns Preview of mapped data with any warnings
   */
  public preview(
    platformData: Record<string, unknown>,
    orderId: string,
    externalOrderId: string,
  ): { data: PlatformOrder; warnings: string[] } {
    const warnings: string[] = [];

    try {
      this.validateRequiredFields(platformData);
    } catch (error) {
      warnings.push(`Validation error: ${(error as Error).message}`);
    }

    // Check for type mismatches
    for (const mapping of this.config.fieldMappings) {
      const value = this.getNestedValue(platformData, mapping.sourceField);
      if (value !== undefined && !this.typeCheck(value, mapping.dataType)) {
        warnings.push(
          `Type mismatch in field ${mapping.sourceField}: expected ${mapping.dataType}, got ${typeof value}`,
        );
      }
    }

    const data = this.mapToUnified(platformData, orderId, externalOrderId);

    return { data, warnings };
  }
}
