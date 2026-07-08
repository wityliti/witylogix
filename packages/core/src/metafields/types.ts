/**
 * Metafields Types
 * Custom metadata system for polymorphic entities
 */

export enum MetafieldType {
  STRING = "STRING",
  NUMBER = "NUMBER",
  BOOLEAN = "BOOLEAN",
  JSON = "JSON",
  DATE = "DATE",
}

export enum EntityType {
  ORDER = "ORDER",
  SHIPMENT = "SHIPMENT",
  CUSTOMER = "CUSTOMER",
  PRODUCT = "PRODUCT",
  DRIVER = "DRIVER",
}

/**
 * A metafield value
 */
export interface MetafieldValue {
  namespace: string;
  key: string;
  value: string | number | boolean | Record<string, any> | Date;
  type: MetafieldType | string;
}

/**
 * Metafield validation rules
 */
export interface MetafieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  regex?: string;
  enum?: (string | number | boolean)[];
  custom?: (value: any) => boolean | string; // Returns true if valid, error message if invalid
}

/**
 * Metafield definition (schema)
 */
export interface MetafieldDefinitionData {
  id?: string;
  shopId: string;
  namespace: string;
  key: string;
  name: string;
  description?: string;
  type: MetafieldType | string;
  entityType: EntityType | string;
  validations?: MetafieldValidation;
  required?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Bulk set payload
 */
export interface BulkMetafieldPayload {
  namespace: string;
  key: string;
  value: string | number | boolean | Record<string, any> | Date;
  type: MetafieldType | string;
}
