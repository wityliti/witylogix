import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Metafields Manager Tests
 * Tests CRUD operations, validation, unique constraints, bulk operations, namespace scoping
 */

type MetafieldType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'DATE';

interface Metafield {
  id: string;
  key: string;
  type: MetafieldType;
  value: any;
  namespace: string;
  resourceId: string;
  resourceType: string;
  unique?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MetafieldDefinition {
  key: string;
  type: MetafieldType;
  namespace: string;
  description?: string;
  unique?: boolean;
  required?: boolean;
}

class MetafieldsManager {
  private fields: Map<string, Metafield> = new Map();
  private definitions: Map<string, MetafieldDefinition> = new Map();
  private uniqueIndex: Map<string, Set<any>> = new Map();
  private idCounter = 0;

  private getMetafieldKey(
    resourceId: string,
    namespace: string,
    key: string
  ): string {
    return `${resourceId}:${namespace}:${key}`;
  }

  private getUniqueIndexKey(namespace: string, key: string): string {
    return `${namespace}:${key}`;
  }

  private validateValue(value: any, type: MetafieldType): void {
    switch (type) {
      case 'STRING':
        if (typeof value !== 'string') {
          throw new Error(`Invalid STRING value: expected string, got ${typeof value}`);
        }
        break;
      case 'NUMBER':
        if (typeof value !== 'number') {
          throw new Error(`Invalid NUMBER value: expected number, got ${typeof value}`);
        }
        break;
      case 'BOOLEAN':
        if (typeof value !== 'boolean') {
          throw new Error(`Invalid BOOLEAN value: expected boolean, got ${typeof value}`);
        }
        break;
      case 'JSON':
        if (typeof value !== 'object' || value === null) {
          throw new Error(`Invalid JSON value: expected object, got ${typeof value}`);
        }
        break;
      case 'DATE':
        if (!(value instanceof Date) && typeof value !== 'string') {
          throw new Error(`Invalid DATE value: expected Date or string, got ${typeof value}`);
        }
        if (typeof value === 'string') {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            throw new Error(`Invalid DATE value: invalid date string`);
          }
        }
        break;
    }
  }

  defineMetafield(definition: MetafieldDefinition): void {
    const defKey = this.getUniqueIndexKey(definition.namespace, definition.key);
    this.definitions.set(defKey, definition);

    if (definition.unique) {
      this.uniqueIndex.set(defKey, new Set());
    }
  }

  create(
    resourceId: string,
    resourceType: string,
    namespace: string,
    key: string,
    value: any
  ): Metafield {
    // Validate type
    const defKey = this.getUniqueIndexKey(namespace, key);
    const definition = this.definitions.get(defKey);
    if (!definition) {
      throw new Error(`Metafield definition not found: ${namespace}:${key}`);
    }

    this.validateValue(value, definition.type);

    // Check unique constraint
    if (definition.unique) {
      const indexKey = this.getUniqueIndexKey(namespace, key);
      const index = this.uniqueIndex.get(indexKey);
      if (index && index.has(value)) {
        throw new Error(`Unique constraint violated: ${key} with value ${value} already exists`);
      }
    }

    const metafieldKey = this.getMetafieldKey(resourceId, namespace, key);
    if (this.fields.has(metafieldKey)) {
      throw new Error(`Metafield already exists: ${metafieldKey}`);
    }

    const metafield: Metafield = {
      id: `mf_${++this.idCounter}`,
      key,
      type: definition.type,
      value,
      namespace,
      resourceId,
      resourceType,
      unique: definition.unique,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.fields.set(metafieldKey, metafield);

    // Add to unique index
    if (definition.unique) {
      const indexKey = this.getUniqueIndexKey(namespace, key);
      const index = this.uniqueIndex.get(indexKey);
      if (index) {
        index.add(value);
      }
    }

    return metafield;
  }

  read(resourceId: string, namespace: string, key: string): Metafield | null {
    const metafieldKey = this.getMetafieldKey(resourceId, namespace, key);
    return this.fields.get(metafieldKey) || null;
  }

  update(
    resourceId: string,
    namespace: string,
    key: string,
    value: any
  ): Metafield {
    const metafieldKey = this.getMetafieldKey(resourceId, namespace, key);
    const metafield = this.fields.get(metafieldKey);
    if (!metafield) {
      throw new Error(`Metafield not found: ${metafieldKey}`);
    }

    const defKey = this.getUniqueIndexKey(namespace, key);
    const definition = this.definitions.get(defKey);
    if (!definition) {
      throw new Error(`Metafield definition not found: ${namespace}:${key}`);
    }

    this.validateValue(value, definition.type);

    // Check unique constraint
    if (definition.unique) {
      const indexKey = this.getUniqueIndexKey(namespace, key);
      const index = this.uniqueIndex.get(indexKey);
      if (index && index.has(value) && metafield.value !== value) {
        throw new Error(`Unique constraint violated: value ${value} already exists`);
      }
      // Update index
      if (index) {
        index.delete(metafield.value);
        index.add(value);
      }
    }

    metafield.value = value;
    metafield.updatedAt = new Date();

    return metafield;
  }

  delete(resourceId: string, namespace: string, key: string): void {
    const metafieldKey = this.getMetafieldKey(resourceId, namespace, key);
    const metafield = this.fields.get(metafieldKey);
    if (!metafield) {
      throw new Error(`Metafield not found: ${metafieldKey}`);
    }

    // Remove from unique index
    const defKey = this.getUniqueIndexKey(namespace, key);
    const definition = this.definitions.get(defKey);
    if (definition?.unique) {
      const index = this.uniqueIndex.get(defKey);
      if (index) {
        index.delete(metafield.value);
      }
    }

    this.fields.delete(metafieldKey);
  }

  getByNamespace(resourceId: string, namespace: string): Metafield[] {
    const results: Metafield[] = [];
    for (const metafield of this.fields.values()) {
      if (metafield.resourceId === resourceId && metafield.namespace === namespace) {
        results.push(metafield);
      }
    }
    return results;
  }

  getByResource(resourceId: string): Metafield[] {
    const results: Metafield[] = [];
    for (const metafield of this.fields.values()) {
      if (metafield.resourceId === resourceId) {
        results.push(metafield);
      }
    }
    return results;
  }

  bulkCreate(
    resourceId: string,
    resourceType: string,
    namespace: string,
    data: Record<string, any>
  ): Metafield[] {
    const results: Metafield[] = [];
    for (const [key, value] of Object.entries(data)) {
      results.push(this.create(resourceId, resourceType, namespace, key, value));
    }
    return results;
  }

  bulkUpdate(
    resourceId: string,
    namespace: string,
    data: Record<string, any>
  ): Metafield[] {
    const results: Metafield[] = [];
    for (const [key, value] of Object.entries(data)) {
      results.push(this.update(resourceId, namespace, key, value));
    }
    return results;
  }

  bulkDelete(resourceId: string, namespace: string, keys: string[]): void {
    for (const key of keys) {
      this.delete(resourceId, namespace, key);
    }
  }
}

describe('MetafieldsManager', () => {
  let manager: MetafieldsManager;

  beforeEach(() => {
    manager = new MetafieldsManager();
  });

  describe('Define Metafields', () => {
    it('should define a metafield', () => {
      manager.defineMetafield({
        key: 'custom_color',
        type: 'STRING',
        namespace: 'products',
      });
      // No error should be thrown
      expect(true).toBe(true);
    });

    it('should define metafield with unique constraint', () => {
      manager.defineMetafield({
        key: 'sku',
        type: 'STRING',
        namespace: 'products',
        unique: true,
      });
      expect(true).toBe(true);
    });
  });

  describe('Create Operations', () => {
    beforeEach(() => {
      manager.defineMetafield({
        key: 'color',
        type: 'STRING',
        namespace: 'products',
      });
    });

    it('should create a metafield', () => {
      const field = manager.create('prod_1', 'product', 'products', 'color', 'red');
      expect(field.value).toBe('red');
      expect(field.key).toBe('color');
      expect(field.namespace).toBe('products');
      expect(field.id).toBeDefined();
    });

    it('should set createdAt and updatedAt', () => {
      const before = new Date();
      const field = manager.create('prod_1', 'product', 'products', 'color', 'red');
      const after = new Date();
      expect(field.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(field.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should reject creation of duplicate metafield', () => {
      manager.create('prod_1', 'product', 'products', 'color', 'red');
      expect(() =>
        manager.create('prod_1', 'product', 'products', 'color', 'blue')
      ).toThrow('Metafield already exists');
    });

    it('should reject undefined metafield definitions', () => {
      expect(() =>
        manager.create('prod_1', 'product', 'products', 'undefined_key', 'value')
      ).toThrow('Metafield definition not found');
    });
  });

  describe('Read Operations', () => {
    beforeEach(() => {
      manager.defineMetafield({
        key: 'color',
        type: 'STRING',
        namespace: 'products',
      });
      manager.create('prod_1', 'product', 'products', 'color', 'red');
    });

    it('should read a metafield', () => {
      const field = manager.read('prod_1', 'products', 'color');
      expect(field).not.toBeNull();
      expect(field?.value).toBe('red');
    });

    it('should return null for non-existent metafield', () => {
      const field = manager.read('prod_1', 'products', 'nonexistent');
      expect(field).toBeNull();
    });

    it('should return null for wrong resource', () => {
      const field = manager.read('prod_2', 'products', 'color');
      expect(field).toBeNull();
    });
  });

  describe('Update Operations', () => {
    beforeEach(() => {
      manager.defineMetafield({
        key: 'color',
        type: 'STRING',
        namespace: 'products',
      });
      manager.create('prod_1', 'product', 'products', 'color', 'red');
    });

    it('should update a metafield', () => {
      const updated = manager.update('prod_1', 'products', 'color', 'blue');
      expect(updated.value).toBe('blue');
    });

    it('should update updatedAt timestamp', () => {
      const before = new Date();
      manager.update('prod_1', 'products', 'color', 'blue');
      const field = manager.read('prod_1', 'products', 'color');
      expect(field?.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('should reject update of non-existent metafield', () => {
      expect(() =>
        manager.update('prod_999', 'products', 'color', 'blue')
      ).toThrow('Metafield not found');
    });
  });

  describe('Delete Operations', () => {
    beforeEach(() => {
      manager.defineMetafield({
        key: 'color',
        type: 'STRING',
        namespace: 'products',
      });
      manager.create('prod_1', 'product', 'products', 'color', 'red');
    });

    it('should delete a metafield', () => {
      manager.delete('prod_1', 'products', 'color');
      const field = manager.read('prod_1', 'products', 'color');
      expect(field).toBeNull();
    });

    it('should reject deletion of non-existent metafield', () => {
      expect(() =>
        manager.delete('prod_999', 'products', 'color')
      ).toThrow('Metafield not found');
    });
  });

  describe('Validation - STRING Type', () => {
    beforeEach(() => {
      manager.defineMetafield({
        key: 'description',
        type: 'STRING',
        namespace: 'products',
      });
    });

    it('should accept string values', () => {
      const field = manager.create('prod_1', 'product', 'products', 'description', 'A great product');
      expect(field.value).toBe('A great product');
    });

    it('should reject non-string values', () => {
      expect(() =>
        manager.create('prod_1', 'product', 'products', 'description', 123)
      ).toThrow('Invalid STRING value');
    });

    it('should accept empty strings', () => {
      const field = manager.create('prod_1', 'product', 'products', 'description', '');
      expect(field.value).toBe('');
    });
  });

  describe('Validation - NUMBER Type', () => {
    beforeEach(() => {
      manager.defineMetafield({
        key: 'rating',
        type: 'NUMBER',
        namespace: 'products',
      });
    });

    it('should accept number values', () => {
      const field = manager.create('prod_1', 'product', 'products', 'rating', 4.5);
      expect(field.value).toBe(4.5);
    });

    it('should reject non-number values', () => {
      expect(() =>
        manager.create('prod_1', 'product', 'products', 'rating', '4.5')
      ).toThrow('Invalid NUMBER value');
    });

    it('should accept integers', () => {
      const field = manager.create('prod_2', 'product', 'products', 'rating', 5);
      expect(field.value).toBe(5);
    });

    it('should accept negative numbers', () => {
      const field = manager.create('prod_3', 'product', 'products', 'rating', -10);
      expect(field.value).toBe(-10);
    });
  });

  describe('Validation - BOOLEAN Type', () => {
    beforeEach(() => {
      manager.defineMetafield({
        key: 'in_stock',
        type: 'BOOLEAN',
        namespace: 'products',
      });
    });

    it('should accept boolean true', () => {
      const field = manager.create('prod_1', 'product', 'products', 'in_stock', true);
      expect(field.value).toBe(true);
    });

    it('should accept boolean false', () => {
      const field = manager.create('prod_1', 'product', 'products', 'in_stock', false);
      expect(field.value).toBe(false);
    });

    it('should reject non-boolean values', () => {
      expect(() =>
        manager.create('prod_1', 'product', 'products', 'in_stock', 1)
      ).toThrow('Invalid BOOLEAN value');
    });
  });

  describe('Validation - JSON Type', () => {
    beforeEach(() => {
      manager.defineMetafield({
        key: 'metadata',
        type: 'JSON',
        namespace: 'products',
      });
    });

    it('should accept JSON objects', () => {
      const data = { brand: 'Acme', category: 'Electronics' };
      const field = manager.create('prod_1', 'product', 'products', 'metadata', data);
      expect(field.value).toEqual(data);
    });

    it('should reject non-object values', () => {
      expect(() =>
        manager.create('prod_1', 'product', 'products', 'metadata', 'not an object')
      ).toThrow('Invalid JSON value');
    });

    it('should reject null', () => {
      expect(() =>
        manager.create('prod_1', 'product', 'products', 'metadata', null)
      ).toThrow('Invalid JSON value');
    });
  });

  describe('Validation - DATE Type', () => {
    beforeEach(() => {
      manager.defineMetafield({
        key: 'launch_date',
        type: 'DATE',
        namespace: 'products',
      });
    });

    it('should accept Date objects', () => {
      const date = new Date('2024-03-06');
      const field = manager.create('prod_1', 'product', 'products', 'launch_date', date);
      expect(field.value).toEqual(date);
    });

    it('should accept valid date strings', () => {
      const field = manager.create('prod_1', 'product', 'products', 'launch_date', '2024-03-06');
      expect(field.value).toBe('2024-03-06');
    });

    it('should reject invalid date strings', () => {
      expect(() =>
        manager.create('prod_1', 'product', 'products', 'launch_date', 'invalid-date')
      ).toThrow('Invalid DATE value');
    });

    it('should reject non-date values', () => {
      expect(() =>
        manager.create('prod_1', 'product', 'products', 'launch_date', 12345)
      ).toThrow('Invalid DATE value');
    });
  });

  describe('Unique Constraint Handling', () => {
    beforeEach(() => {
      manager.defineMetafield({
        key: 'sku',
        type: 'STRING',
        namespace: 'products',
        unique: true,
      });
    });

    it('should enforce unique constraint on creation', () => {
      manager.create('prod_1', 'product', 'products', 'sku', 'SKU-001');
      expect(() =>
        manager.create('prod_2', 'product', 'products', 'sku', 'SKU-001')
      ).toThrow('Unique constraint violated');
    });

    it('should allow same value for different resources in different namespaces', () => {
      manager.defineMetafield({
        key: 'sku',
        type: 'STRING',
        namespace: 'orders',
        unique: true,
      });
      manager.create('prod_1', 'product', 'products', 'sku', 'SKU-001');
      // Should not throw - different namespace
      const field = manager.create('ord_1', 'order', 'orders', 'sku', 'SKU-001');
      expect(field.value).toBe('SKU-001');
    });

    it('should allow update to same value', () => {
      manager.create('prod_1', 'product', 'products', 'sku', 'SKU-001');
      // Should not throw - updating with same value
      const updated = manager.update('prod_1', 'products', 'sku', 'SKU-001');
      expect(updated.value).toBe('SKU-001');
    });

    it('should enforce unique constraint on update', () => {
      manager.create('prod_1', 'product', 'products', 'sku', 'SKU-001');
      manager.create('prod_2', 'product', 'products', 'sku', 'SKU-002');
      expect(() =>
        manager.update('prod_2', 'products', 'sku', 'SKU-001')
      ).toThrow('Unique constraint violated');
    });

    it('should update unique index on value change', () => {
      manager.create('prod_1', 'product', 'products', 'sku', 'SKU-001');
      manager.update('prod_1', 'products', 'sku', 'SKU-002');
      // Should be able to create with old value now
      const field = manager.create('prod_2', 'product', 'products', 'sku', 'SKU-001');
      expect(field.value).toBe('SKU-001');
    });

    it('should remove from unique index on deletion', () => {
      manager.create('prod_1', 'product', 'products', 'sku', 'SKU-001');
      manager.delete('prod_1', 'products', 'sku');
      // Should be able to create with same value
      const field = manager.create('prod_2', 'product', 'products', 'sku', 'SKU-001');
      expect(field.value).toBe('SKU-001');
    });
  });

  describe('Namespace Scoping', () => {
    beforeEach(() => {
      manager.defineMetafield({
        key: 'custom_field',
        type: 'STRING',
        namespace: 'products',
      });
      manager.defineMetafield({
        key: 'custom_field',
        type: 'STRING',
        namespace: 'orders',
      });
    });

    it('should scope metafields to namespaces', () => {
      manager.create('res_1', 'resource', 'products', 'custom_field', 'product value');
      manager.create('res_1', 'resource', 'orders', 'custom_field', 'order value');
      
      const productField = manager.read('res_1', 'products', 'custom_field');
      const orderField = manager.read('res_1', 'orders', 'custom_field');
      
      expect(productField?.value).toBe('product value');
      expect(orderField?.value).toBe('order value');
    });

    it('should get metafields by namespace', () => {
      manager.defineMetafield({
        key: 'size',
        type: 'STRING',
        namespace: 'products',
      });
      manager.create('prod_1', 'product', 'products', 'custom_field', 'value1');
      manager.create('prod_1', 'product', 'products', 'size', 'large');
      manager.create('prod_1', 'product', 'orders', 'custom_field', 'value2');
      
      const productFields = manager.getByNamespace('prod_1', 'products');
      expect(productFields).toHaveLength(2);
      expect(productFields.every(f => f.namespace === 'products')).toBe(true);
    });
  });

  describe('Bulk Operations', () => {
    beforeEach(() => {
      manager.defineMetafield({
        key: 'color',
        type: 'STRING',
        namespace: 'products',
      });
      manager.defineMetafield({
        key: 'size',
        type: 'STRING',
        namespace: 'products',
      });
      manager.defineMetafield({
        key: 'price',
        type: 'NUMBER',
        namespace: 'products',
      });
    });

    it('should bulk create metafields', () => {
      const fields = manager.bulkCreate('prod_1', 'product', 'products', {
        color: 'red',
        size: 'large',
        price: 99.99,
      });
      expect(fields).toHaveLength(3);
      expect(fields[0].value).toBe('red');
      expect(fields[2].value).toBe(99.99);
    });

    it('should bulk update metafields', () => {
      manager.bulkCreate('prod_1', 'product', 'products', {
        color: 'red',
        size: 'large',
      });
      const updated = manager.bulkUpdate('prod_1', 'products', {
        color: 'blue',
        size: 'small',
      });
      expect(updated).toHaveLength(2);
      expect(updated[0].value).toBe('blue');
      expect(updated[1].value).toBe('small');
    });

    it('should bulk delete metafields', () => {
      manager.bulkCreate('prod_1', 'product', 'products', {
        color: 'red',
        size: 'large',
        price: 99.99,
      });
      manager.bulkDelete('prod_1', 'products', ['color', 'size']);
      const remaining = manager.getByNamespace('prod_1', 'products');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].key).toBe('price');
    });
  });

  describe('Get Operations', () => {
    beforeEach(() => {
      manager.defineMetafield({
        key: 'color',
        type: 'STRING',
        namespace: 'products',
      });
      manager.defineMetafield({
        key: 'custom',
        type: 'STRING',
        namespace: 'products',
      });
      manager.defineMetafield({
        key: 'tracking',
        type: 'STRING',
        namespace: 'orders',
      });
    });

    it('should get all metafields for a resource', () => {
      manager.create('res_1', 'resource', 'products', 'color', 'red');
      manager.create('res_1', 'resource', 'products', 'custom', 'value');
      manager.create('res_1', 'resource', 'orders', 'tracking', 'track123');
      
      const fields = manager.getByResource('res_1');
      expect(fields).toHaveLength(3);
    });

    it('should return empty array for resource with no metafields', () => {
      const fields = manager.getByResource('nonexistent');
      expect(fields).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle metafields with special characters in keys', () => {
      manager.defineMetafield({
        key: 'custom-field_123',
        type: 'STRING',
        namespace: 'products',
      });
      const field = manager.create('prod_1', 'product', 'products', 'custom-field_123', 'value');
      expect(field.key).toBe('custom-field_123');
    });

    it('should handle very long string values', () => {
      manager.defineMetafield({
        key: 'description',
        type: 'STRING',
        namespace: 'products',
      });
      const longString = 'a'.repeat(10000);
      const field = manager.create('prod_1', 'product', 'products', 'description', longString);
      expect(field.value).toBe(longString);
    });

    it('should handle complex JSON objects', () => {
      manager.defineMetafield({
        key: 'metadata',
        type: 'JSON',
        namespace: 'products',
      });
      const complex = {
        nested: {
          deep: {
            value: [1, 2, 3],
          },
        },
        array: ['a', 'b', 'c'],
      };
      const field = manager.create('prod_1', 'product', 'products', 'metadata', complex);
      expect(field.value).toEqual(complex);
    });
  });
});
