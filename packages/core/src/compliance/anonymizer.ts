/**
 * Data Anonymizer Service
 * Implements anonymization and pseudonymization strategies for PII
 * Supports multiple strategies: hashing, redaction, generalization
 */

import { createHash } from "crypto";
import {
  AnonymizationConfig,
  AnonymizationReportData,
  ComplianceError,
  DatabaseRecord,
  PIIField,
} from "./types";

/**
 * Data Anonymizer
 * Handles anonymization of personally identifiable information
 */
export class DataAnonymizer {
  private readonly DEFAULT_SALT = "witylogix-anonymization-salt";
  private processingStats = {
    total: 0,
    successCount: 0,
    errorCount: 0,
    fieldStats: new Map<string, number>(),
    strategyStats: new Map<string, number>(),
  };

  /**
   * Anonymize a single record according to configuration
   *
   * @param record - The database record to anonymize
   * @param config - Anonymization configuration with strategy
   * @param piiFields - Array of PII field definitions
   * @returns Anonymized record
   */
  anonymizeRecord(
    record: DatabaseRecord,
    config: AnonymizationConfig,
    piiFields: PIIField[],
  ): DatabaseRecord {
    const anonymized = { ...record };

    for (const field of piiFields) {
      if (
        anonymized[field.fieldName] !== undefined &&
        anonymized[field.fieldName] !== null
      ) {
        try {
          anonymized[field.fieldName] = this.applyMaskingStrategy(
            anonymized[field.fieldName],
            field.maskingStrategy,
            config,
          );
          this.updateFieldStats(field.fieldName);
          this.updateStrategyStats(field.maskingStrategy);
        } catch (error) {
          console.error(`Error anonymizing field ${field.fieldName}:`, error);
        }
      }
    }

    this.processingStats.successCount++;
    return anonymized;
  }

  /**
   * Apply the appropriate masking strategy to a value
   * @private
   */
  private applyMaskingStrategy(
    value: unknown,
    strategy: string,
    config: AnonymizationConfig,
  ): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    const stringValue = String(value);

    switch (strategy) {
      case "hash":
        return this.hashPII(stringValue, config.salt || this.DEFAULT_SALT);
      case "pseudonymize":
        return this.pseudonymizePII(
          stringValue,
          config.salt || this.DEFAULT_SALT,
        );
      case "redact":
        return this.redactField(stringValue, config.visibleCharacters || 0);
      case "generalize":
        return this.generalizeValue(
          stringValue,
          config.generalizationLevel || "city",
        );
      default:
        return value;
    }
  }

  /**
   * Hash PII using SHA-256 with salt
   * One-way function suitable for irreversible anonymization
   *
   * @param value - The value to hash
   * @param salt - Salt for hashing
   * @returns SHA-256 hash with salt
   */
  hashPII(value: string, salt: string): string {
    if (!value) return "";
    const salted = `${salt}:${value}`;
    return createHash("sha256").update(salted).digest("hex");
  }

  /**
   * Pseudonymize PII with deterministic hashing
   * Maintains consistency for linking records while hiding identity
   *
   * @param value - The value to pseudonymize
   * @param salt - Salt for pseudonymization
   * @returns Deterministic hash with prefix
   */
  pseudonymizePII(value: string, salt: string): string {
    if (!value) return "PSEUDO_NULL";
    const hash = this.hashPII(value, salt);
    return `PSEUDO_${hash.substring(0, 16)}`;
  }

  /**
   * Redact field by showing only last N characters
   * "John Doe" with visibleChars=4 becomes "***Doe"
   *
   * @param value - The value to redact
   * @param visibleChars - Number of characters to keep visible at end
   * @returns Partially redacted value
   */
  redactField(value: string, visibleChars: number): string {
    if (!value || value.length === 0) return "";
    if (visibleChars <= 0) return "*".repeat(value.length);
    if (visibleChars >= value.length) return value;

    const redactedLength = value.length - visibleChars;
    return "*".repeat(redactedLength) + value.substring(redactedLength);
  }

  /**
   * Generalize location data to reduce specificity
   * "123 Main St, Springfield, IL 62701" -> "Springfield, IL"
   *
   * @param address - Full address to generalize
   * @param level - Generalization level (city, region, country)
   * @returns Generalized location
   */
  generalizeLocation(
    address: string,
    level: "city" | "region" | "country" = "city",
  ): string {
    if (!address) return "";

    const parts = address.split(",").map((p) => p.trim());

    switch (level) {
      case "country":
        // Return only country (typically last part)
        return parts[parts.length - 1] || "";
      case "region":
        // Return state/region and country
        return parts.slice(-2).join(", ") || "";
      case "city":
      default:
        // Return city and region
        return parts.slice(-3, -1).join(", ") || "";
    }
  }

  /**
   * Generalize a value based on type inference
   * @private
   */
  private generalizeValue(
    value: string,
    level: "city" | "region" | "country",
  ): string {
    // Check if it looks like an address
    if (value.includes(",") || value.includes("St") || value.includes("Ave")) {
      return this.generalizeLocation(value, level);
    }
    // For other values, apply simple redaction
    return this.redactField(value, 2);
  }

  /**
   * Anonymize records in batch with progress tracking
   * Useful for large-scale anonymization operations
   *
   * @param records - Array of records to anonymize
   * @param config - Anonymization configuration
   * @param piiFields - Array of PII field definitions
   * @returns Array of anonymized records
   */
  anonymizeInBatch(
    records: DatabaseRecord[],
    config: AnonymizationConfig,
    piiFields: PIIField[],
  ): DatabaseRecord[] {
    this.processingStats.total = records.length;
    this.processingStats.successCount = 0;
    this.processingStats.errorCount = 0;
    this.processingStats.fieldStats.clear();
    this.processingStats.strategyStats.clear();

    const anonymized = records.map((record) => {
      try {
        return this.anonymizeRecord(record, config, piiFields);
      } catch (error) {
        this.processingStats.errorCount++;
        console.error("Batch anonymization error:", error);
        return record;
      }
    });

    return anonymized;
  }

  /**
   * Generate anonymization report with statistics
   * @returns AnonymizationReportData with processing statistics
   */
  generateAnonymizationReport(): AnonymizationReportData {
    const fieldStats: Record<string, number> = {};
    const strategyStats: Record<string, number> = {};

    for (const [field, count] of this.processingStats.fieldStats.entries()) {
      fieldStats[field] = count;
    }

    for (const [
      strategy,
      count,
    ] of this.processingStats.strategyStats.entries()) {
      strategyStats[strategy] = count;
    }

    const successRate =
      this.processingStats.total > 0
        ? (this.processingStats.successCount / this.processingStats.total) * 100
        : 0;

    return {
      timestamp: new Date(),
      totalProcessed: this.processingStats.total,
      fieldsAnonymized: fieldStats,
      strategiesUsed: strategyStats,
      successRate,
      duration: 0, // Would be set by caller
      errors: [],
    };
  }

  /**
   * Update field anonymization statistics
   * @private
   */
  private updateFieldStats(fieldName: string): void {
    const current = this.processingStats.fieldStats.get(fieldName) || 0;
    this.processingStats.fieldStats.set(fieldName, current + 1);
  }

  /**
   * Update strategy usage statistics
   * @private
   */
  private updateStrategyStats(strategy: string): void {
    const current = this.processingStats.strategyStats.get(strategy) || 0;
    this.processingStats.strategyStats.set(strategy, current + 1);
  }

  /**
   * Reset anonymization statistics
   */
  resetStats(): void {
    this.processingStats.total = 0;
    this.processingStats.successCount = 0;
    this.processingStats.errorCount = 0;
    this.processingStats.fieldStats.clear();
    this.processingStats.strategyStats.clear();
  }

  /**
   * Validate anonymization configuration
   * @param config - Configuration to validate
   * @returns Validation result with any errors
   */
  validateConfig(config: AnonymizationConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!config.strategy) errors.push("Missing anonymization strategy");
    if (
      !["hash", "pseudonymize", "redact", "generalize"].includes(
        config.strategy,
      )
    ) {
      errors.push(`Invalid strategy: ${config.strategy}`);
    }
    if (config.retentionDays < 0)
      errors.push("retentionDays must be non-negative");
    if (config.visibleCharacters && config.visibleCharacters < 0) {
      errors.push("visibleCharacters must be non-negative");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
