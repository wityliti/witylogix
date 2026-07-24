/**
 * Data Mapper
 * Transforms MongoDB documents to PostgreSQL records
 */

import { CollectionMapping, FieldTransform } from "./types.js";

/**
 * Built-in field transformers
 */
export const BuiltInTransformers = {
  /**
   * Convert MongoDB ObjectId to string
   */
  objectIdToString: (value: any): string => {
    if (!value) return "";
    return String(value);
  },

  /**
   * Convert date to ISO string
   */
  dateToISO: (value: any): string => {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    return date.toISOString();
  },

  /**
   * Convert nested object to JSON string
   */
  nestedToJson: (value: any): string => {
    if (!value) return "{}";
    return JSON.stringify(value);
  },

  /**
   * Convert array to PostgreSQL array format
   */
  arrayToPostgres: (value: any[]): string => {
    if (!Array.isArray(value)) return "[]";
    return JSON.stringify(value);
  },

  /**
   * Convert MongoDB reference to foreign key
   */
  mongoRefToFk: (value: any): string => {
    if (!value) return "";
    if (typeof value === "object" && value.$oid) {
      return value.$oid;
    }
    return String(value);
  },

  /**
   * Convert enum value with mapping
   */
  enumMapper:
    (mapping: Record<string, string>) =>
    (value: any): string => {
      if (!value) return "";
      return mapping[String(value)] || String(value);
    },

  /**
   * Default string conversion
   */
  toString: (value: any): string => {
    if (value === null || value === undefined) return "";
    return String(value);
  },

  /**
   * Default number conversion
   */
  toNumber: (value: any): number => {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  },

  /**
   * Default boolean conversion
   */
  toBoolean: (value: any): boolean => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      return value.toLowerCase() === "true" || value === "1";
    }
    return !!value;
  },
};

/**
 * Default collection mappings
 */
export const DefaultMappings: Record<string, CollectionMapping> = {
  orders: {
    mongoCollection: "orders",
    prismaModel: "Order",
    fieldMap: [
      {
        sourceField: "_id",
        targetField: "id",
        transformer: BuiltInTransformers.objectIdToString,
      },
      { sourceField: "shopId", targetField: "shopId" },
      { sourceField: "status", targetField: "status" },
      {
        sourceField: "totalPrice",
        targetField: "totalPrice",
        transformer: BuiltInTransformers.toNumber,
      },
      {
        sourceField: "createdAt",
        targetField: "createdAt",
        transformer: BuiltInTransformers.dateToISO,
      },
      {
        sourceField: "updatedAt",
        targetField: "updatedAt",
        transformer: BuiltInTransformers.dateToISO,
      },
    ],
  },

  shipments: {
    mongoCollection: "shipments",
    prismaModel: "Shipment",
    fieldMap: [
      {
        sourceField: "_id",
        targetField: "id",
        transformer: BuiltInTransformers.objectIdToString,
      },
      {
        sourceField: "orderId",
        targetField: "orderId",
        transformer: BuiltInTransformers.mongoRefToFk,
      },
      { sourceField: "status", targetField: "status" },
      {
        sourceField: "items",
        targetField: "items",
        transformer: BuiltInTransformers.arrayToPostgres,
      },
      {
        sourceField: "createdAt",
        targetField: "createdAt",
        transformer: BuiltInTransformers.dateToISO,
      },
      {
        sourceField: "updatedAt",
        targetField: "updatedAt",
        transformer: BuiltInTransformers.dateToISO,
      },
    ],
  },

  customers: {
    mongoCollection: "customers",
    prismaModel: "Customer",
    fieldMap: [
      {
        sourceField: "_id",
        targetField: "id",
        transformer: BuiltInTransformers.objectIdToString,
      },
      { sourceField: "shopId", targetField: "shopId" },
      { sourceField: "email", targetField: "email" },
      { sourceField: "name", targetField: "name" },
      { sourceField: "phone", targetField: "phone" },
      {
        sourceField: "createdAt",
        targetField: "createdAt",
        transformer: BuiltInTransformers.dateToISO,
      },
      {
        sourceField: "updatedAt",
        targetField: "updatedAt",
        transformer: BuiltInTransformers.dateToISO,
      },
    ],
  },

  products: {
    mongoCollection: "products",
    prismaModel: "Product",
    fieldMap: [
      {
        sourceField: "_id",
        targetField: "id",
        transformer: BuiltInTransformers.objectIdToString,
      },
      { sourceField: "shopId", targetField: "shopId" },
      { sourceField: "sku", targetField: "sku" },
      { sourceField: "name", targetField: "name" },
      { sourceField: "description", targetField: "description" },
      {
        sourceField: "createdAt",
        targetField: "createdAt",
        transformer: BuiltInTransformers.dateToISO,
      },
      {
        sourceField: "updatedAt",
        targetField: "updatedAt",
        transformer: BuiltInTransformers.dateToISO,
      },
    ],
  },

  users: {
    mongoCollection: "users",
    prismaModel: "User",
    fieldMap: [
      {
        sourceField: "_id",
        targetField: "id",
        transformer: BuiltInTransformers.objectIdToString,
      },
      { sourceField: "email", targetField: "email" },
      { sourceField: "name", targetField: "name" },
      {
        sourceField: "createdAt",
        targetField: "createdAt",
        transformer: BuiltInTransformers.dateToISO,
      },
      {
        sourceField: "updatedAt",
        targetField: "updatedAt",
        transformer: BuiltInTransformers.dateToISO,
      },
    ],
  },

  zones: {
    mongoCollection: "zones",
    prismaModel: "Zone",
    fieldMap: [
      {
        sourceField: "_id",
        targetField: "id",
        transformer: BuiltInTransformers.objectIdToString,
      },
      { sourceField: "shopId", targetField: "shopId" },
      { sourceField: "name", targetField: "name" },
      {
        sourceField: "geometry",
        targetField: "geometry",
        transformer: BuiltInTransformers.nestedToJson,
      },
      {
        sourceField: "createdAt",
        targetField: "createdAt",
        transformer: BuiltInTransformers.dateToISO,
      },
      {
        sourceField: "updatedAt",
        targetField: "updatedAt",
        transformer: BuiltInTransformers.dateToISO,
      },
    ],
  },

  drivers: {
    mongoCollection: "drivers",
    prismaModel: "Driver",
    fieldMap: [
      {
        sourceField: "_id",
        targetField: "id",
        transformer: BuiltInTransformers.objectIdToString,
      },
      { sourceField: "shopId", targetField: "shopId" },
      { sourceField: "name", targetField: "name" },
      { sourceField: "email", targetField: "email" },
      { sourceField: "phone", targetField: "phone" },
      { sourceField: "status", targetField: "status" },
      {
        sourceField: "createdAt",
        targetField: "createdAt",
        transformer: BuiltInTransformers.dateToISO,
      },
      {
        sourceField: "updatedAt",
        targetField: "updatedAt",
        transformer: BuiltInTransformers.dateToISO,
      },
    ],
  },
};

/**
 * DataMapper: Transform MongoDB documents to PostgreSQL records
 */
export class DataMapper {
  /**
   * Map a MongoDB document to a PostgreSQL record
   */
  mapDocument(document: any, mapping: CollectionMapping): any {
    const record: any = {};

    // Apply field mappings
    for (const fieldTransform of mapping.fieldMap) {
      const value = this.getNestedValue(document, fieldTransform.sourceField);

      if (value === undefined && !fieldTransform.optional) {
        // Skip if value is undefined and field is optional
        if (fieldTransform.optional) continue;
        // Use default if available
        const defaultValue =
          mapping.defaultValues?.[fieldTransform.targetField];
        if (defaultValue !== undefined) {
          record[fieldTransform.targetField] = defaultValue;
          continue;
        }
      }

      // Apply transformer if provided
      let transformedValue = value;
      if (fieldTransform.transformer && value !== undefined && value !== null) {
        transformedValue = fieldTransform.transformer(value, document);
      }

      record[fieldTransform.targetField] = transformedValue;
    }

    // Add default values for missing fields
    if (mapping.defaultValues) {
      for (const [field, defaultValue] of Object.entries(
        mapping.defaultValues,
      )) {
        if (!(field in record)) {
          record[field] = defaultValue;
        }
      }
    }

    // Apply custom transforms if provided
    if (mapping.transforms) {
      for (const transform of mapping.transforms) {
        record = transform(record, document);
      }
    }

    // Apply post-processing
    if (mapping.postProcess) {
      return mapping.postProcess(record);
    }

    return record;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    const keys = path.split(".");
    let value = obj;

    for (const key of keys) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = value[key];
    }

    return value;
  }

  /**
   * Get default mapping for a collection
   */
  getDefaultMapping(collectionName: string): CollectionMapping | undefined {
    return DefaultMappings[collectionName.toLowerCase()];
  }

  /**
   * Create a field transform with built-in transformer
   */
  createFieldTransform(
    sourceField: string,
    targetField: string,
    transformer?: string,
  ): FieldTransform {
    let transformFn: any;

    if (transformer && typeof transformer === "string") {
      transformFn = (BuiltInTransformers as any)[transformer];
    }

    return {
      sourceField,
      targetField,
      transformer: transformFn,
    };
  }
}

export default DataMapper;
