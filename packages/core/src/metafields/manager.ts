/**
 * Metafield Manager
 * Handles custom metadata for polymorphic entities
 */

import {
  MetafieldType,
  EntityType,
  MetafieldValue,
  MetafieldValidation,
  ValidationResult,
  BulkMetafieldPayload,
  MetafieldDefinitionData,
} from './types.js';

/**
 * Local types (not from @prisma/client)
 */
interface MetafieldRecord {
  id: string;
  shopId: string;
  namespace: string;
  key: string;
  value: string;
  type: string;
  entityType: string;
  entityId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MetafieldDefinitionRecord {
  id: string;
  shopId: string;
  namespace: string;
  key: string;
  name: string;
  description?: string | null;
  type: string;
  entityType: string;
  validations?: Record<string, any> | null;
  required: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * MetafieldManager: Manages custom metadata
 */
export class MetafieldManager {
  private db: any; // Database client (Prisma-like)

  constructor(db: any) {
    this.db = db;
  }

  /**
   * Set a single metafield
   */
  async setMetafield(
    entityType: string,
    entityId: string,
    namespace: string,
    key: string,
    value: any,
    type: MetafieldType | string,
    shopId: string
  ): Promise<MetafieldRecord> {
    // Validate the value
    const validation = await this.validateValue(
      value,
      type,
      shopId,
      namespace,
      key
    );

    if (!validation.valid) {
      throw new Error(
        `Validation failed for ${namespace}.${key}: ${validation.errors.join(', ')}`
      );
    }

    // Serialize the value
    const serializedValue = this.serializeValue(value, type);

    // Upsert the metafield
    const metafield = await this.db.metafield.upsert({
      where: {
        shopId_namespace_key_entityType_entityId: {
          shopId,
          namespace,
          key,
          entityType,
          entityId,
        },
      },
      update: {
        value: serializedValue,
        type: String(type),
        updatedAt: new Date(),
      },
      create: {
        shopId,
        namespace,
        key,
        value: serializedValue,
        type: String(type),
        entityType,
        entityId,
      },
    });

    return metafield;
  }

  /**
   * Get a single metafield value
   */
  async getMetafield(
    entityType: string,
    entityId: string,
    namespace: string,
    key: string,
    shopId: string
  ): Promise<any | null> {
    const metafield = await this.db.metafield.findUnique({
      where: {
        shopId_namespace_key_entityType_entityId: {
          shopId,
          namespace,
          key,
          entityType,
          entityId,
        },
      },
    });

    if (!metafield) {
      return null;
    }

    return this.deserializeValue(metafield.value, metafield.type);
  }

  /**
   * Get all metafields for an entity
   */
  async getMetafields(
    entityType: string,
    entityId: string,
    shopId: string,
    namespace?: string
  ): Promise<MetafieldValue[]> {
    const where: any = {
      shopId,
      entityType,
      entityId,
    };

    if (namespace) {
      where.namespace = namespace;
    }

    const metafields = await this.db.metafield.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    return metafields.map((mf: MetafieldRecord) => ({
      namespace: mf.namespace,
      key: mf.key,
      value: this.deserializeValue(mf.value, mf.type),
      type: mf.type,
    }));
  }

  /**
   * Delete a metafield
   */
  async deleteMetafield(
    entityType: string,
    entityId: string,
    namespace: string,
    key: string,
    shopId: string
  ): Promise<boolean> {
    const result = await this.db.metafield.delete({
      where: {
        shopId_namespace_key_entityType_entityId: {
          shopId,
          namespace,
          key,
          entityType,
          entityId,
        },
      },
    });

    return !!result;
  }

  /**
   * Validate a value against its type and definition rules
   */
  async validateValue(
    value: any,
    type: MetafieldType | string,
    shopId: string,
    namespace: string,
    key: string
  ): Promise<ValidationResult> {
    const errors: string[] = [];

    // Type validation
    if (!this.validateType(value, type)) {
      errors.push(
        `Value must be of type ${type}, got ${typeof value}`
      );
      return { valid: false, errors };
    }

    // Check definition validations
    const definition = await this.db.metafieldDefinition.findUnique({
      where: {
        shopId_namespace_key_entityType: {
          shopId,
          namespace,
          key,
          entityType: '', // Will be overridden by unique constraint
        },
      },
    });

    if (definition?.validations) {
      const validationErrors = this.checkValidationRules(
        value,
        definition.validations as MetafieldValidation
      );
      errors.push(...validationErrors);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Bulk set metafields for an entity
   */
  async bulkSet(
    entityType: string,
    entityId: string,
    shopId: string,
    metafields: BulkMetafieldPayload[]
  ): Promise<MetafieldRecord[]> {
    const results: MetafieldRecord[] = [];

    for (const mf of metafields) {
      const result = await this.setMetafield(
        entityType,
        entityId,
        mf.namespace,
        mf.key,
        mf.value,
        mf.type,
        shopId
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Create a metafield definition
   */
  async createDefinition(
    definition: MetafieldDefinitionData
  ): Promise<MetafieldDefinitionRecord> {
    return this.db.metafieldDefinition.create({
      data: {
        shopId: definition.shopId,
        namespace: definition.namespace,
        key: definition.key,
        name: definition.name,
        description: definition.description,
        type: definition.type,
        entityType: definition.entityType,
        validations: definition.validations || null,
        required: definition.required || false,
      },
    });
  }

  /**
   * Get a metafield definition
   */
  async getDefinition(
    shopId: string,
    namespace: string,
    key: string,
    entityType: string
  ): Promise<MetafieldDefinitionRecord | null> {
    return this.db.metafieldDefinition.findUnique({
      where: {
        shopId_namespace_key_entityType: {
          shopId,
          namespace,
          key,
          entityType,
        },
      },
    });
  }

  /**
   * Private helper: Validate type matches value
   */
  private validateType(value: any, type: MetafieldType | string): boolean {
    switch (type) {
      case MetafieldType.STRING:
        return typeof value === 'string';
      case MetafieldType.NUMBER:
        return typeof value === 'number';
      case MetafieldType.BOOLEAN:
        return typeof value === 'boolean';
      case MetafieldType.JSON:
        return typeof value === 'object' && value !== null;
      case MetafieldType.DATE:
        return value instanceof Date || typeof value === 'string';
      default:
        return false;
    }
  }

  /**
   * Private helper: Serialize value to string
   */
  private serializeValue(value: any, type: MetafieldType | string): string {
    if (type === MetafieldType.JSON) {
      return JSON.stringify(value);
    }
    if (type === MetafieldType.DATE) {
      return (value instanceof Date ? value : new Date(value)).toISOString();
    }
    return String(value);
  }

  /**
   * Private helper: Deserialize value from string
   */
  private deserializeValue(
    value: string,
    type: MetafieldType | string
  ): any {
    switch (type) {
      case MetafieldType.STRING:
        return value;
      case MetafieldType.NUMBER:
        return Number(value);
      case MetafieldType.BOOLEAN:
        return value === 'true' || value === '1';
      case MetafieldType.JSON:
        return JSON.parse(value);
      case MetafieldType.DATE:
        return new Date(value);
      default:
        return value;
    }
  }

  /**
   * Private helper: Check validation rules
   */
  private checkValidationRules(
    value: any,
    validations: MetafieldValidation
  ): string[] {
    const errors: string[] = [];

    // String validations
    if (typeof value === 'string') {
      if (
        validations.minLength !== undefined &&
        value.length < validations.minLength
      ) {
        errors.push(
          `String length must be at least ${validations.minLength}`
        );
      }
      if (
        validations.maxLength !== undefined &&
        value.length > validations.maxLength
      ) {
        errors.push(
          `String length must be at most ${validations.maxLength}`
        );
      }
      if (validations.regex) {
        const re = new RegExp(validations.regex);
        if (!re.test(value)) {
          errors.push(`String does not match pattern ${validations.regex}`);
        }
      }
    }

    // Numeric validations
    if (typeof value === 'number') {
      if (validations.min !== undefined && value < validations.min) {
        errors.push(`Number must be at least ${validations.min}`);
      }
      if (validations.max !== undefined && value > validations.max) {
        errors.push(`Number must be at most ${validations.max}`);
      }
    }

    // Enum validation
    if (validations.enum && !validations.enum.includes(value)) {
      errors.push(
        `Value must be one of: ${validations.enum.join(', ')}`
      );
    }

    // Custom validation
    if (validations.custom) {
      const result = validations.custom(value);
      if (typeof result === 'string') {
        errors.push(result);
      } else if (!result) {
        errors.push('Custom validation failed');
      }
    }

    return errors;
  }
}

export default MetafieldManager;
