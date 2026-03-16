'use client';

import { useState, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════
   USE-PRODUCT-SYNC — Hooks for field mapping & sync config
   ═══════════════════════════════════════════════════════════ */

interface Field {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  required: boolean;
  sampleValue?: string;
}

interface Mapping {
  id: string;
  sourceFieldId: string;
  targetFieldId: string;
  transformer:
    | 'direct'
    | 'uppercase'
    | 'lowercase'
    | 'currency'
    | 'date'
    | 'custom';
  customJS?: string;
}

interface SyncSchedule {
  interval: 'realtime' | '5m' | '15m' | '30m' | '1h' | 'daily';
  direction: 'inbound' | 'outbound' | 'bidirectional';
  concurrencyLimit: number;
  nextSyncAt: string;
  paused: boolean;
}

interface PreviewProduct {
  source: Record<string, unknown>;
  target: Record<string, unknown>;
}

// ============================================================================
// useFieldMappings — CRUD for field mappings
// ============================================================================

export function useFieldMappings(platformId: string) {
  const [mappings, setMappings] = useState<Mapping[]>([
    {
      id: 'mapping-1',
      sourceFieldId: 'sf-title',
      targetFieldId: 'wl-name',
      transformer: 'direct',
    },
    {
      id: 'mapping-2',
      sourceFieldId: 'sf-inventory',
      targetFieldId: 'wl-qty',
      transformer: 'direct',
    },
  ]);

  const addMapping = useCallback(
    (sourceFieldId: string, targetFieldId: string) => {
      const newMapping: Mapping = {
        id: `mapping-${Date.now()}`,
        sourceFieldId,
        targetFieldId,
        transformer: 'direct',
      };
      setMappings((prev) => [...prev, newMapping]);
    },
    []
  );

  const removeMapping = useCallback((mappingId: string) => {
    setMappings((prev) => prev.filter((m) => m.id !== mappingId));
  }, []);

  const updateTransformer = useCallback(
    (
      mappingId: string,
      transformer: Mapping['transformer'],
      customJS?: string
    ) => {
      setMappings((prev) =>
        prev.map((m) =>
          m.id === mappingId ? { ...m, transformer, customJS } : m
        )
      );
    },
    []
  );

  const autoMapFields = useCallback((sourceFields: Field[], targetFields: Field[]) => {
    const newMappings: Mapping[] = [];

    sourceFields.forEach((sourceField) => {
      // Try to find exact match by name
      let target = targetFields.find(
        (tf) => tf.name.toLowerCase() === sourceField.name.toLowerCase()
      );

      // If no exact match, try to find by type match and similar names
      if (!target) {
        const similarNames = sourceFields.filter((sf) =>
          sourceField.name.toLowerCase().includes(
            sf.name.toLowerCase().split(' ')[0]
          ) ||
          sf.name.toLowerCase().includes(sourceField.name.toLowerCase().split(' ')[0])
        );

        target = targetFields.find(
          (tf) =>
            tf.type === sourceField.type &&
            !newMappings.some((m) => m.targetFieldId === tf.id)
        );
      }

      // Fallback: any available target with same type
      if (!target && sourceField.type !== 'boolean') {
        target = targetFields.find(
          (tf) =>
            tf.type === sourceField.type &&
            !newMappings.some((m) => m.targetFieldId === tf.id)
        );
      }

      if (target && !newMappings.some((m) => m.targetFieldId === target!.id)) {
        newMappings.push({
          id: `mapping-${Date.now()}-${sourceField.id}`,
          sourceFieldId: sourceField.id,
          targetFieldId: target.id,
          transformer: 'direct',
        });
      }
    });

    setMappings((prev) => [...prev, ...newMappings]);
  }, []);

  const saveMappings = useCallback((templateName?: string) => {
    // In a real app, this would save to backend
    const data = {
      platformId,
      mappings,
      templateName,
      savedAt: new Date().toISOString(),
    };

    // Simulate saving
    console.log('Saving mappings:', data);

    // Could also save to localStorage for demo
    if (templateName) {
      const templates = JSON.parse(localStorage.getItem('mapping-templates') || '{}');
      templates[templateName] = {
        mappings,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem('mapping-templates', JSON.stringify(templates));
    }
  }, [platformId, mappings]);

  return {
    mappings,
    addMapping,
    removeMapping,
    updateTransformer,
    autoMapFields,
    saveMappings,
  };
}

// ============================================================================
// useSyncSchedule — Get/set schedule config
// ============================================================================

export function useSyncSchedule(platformId: string) {
  const [schedule, setScheduleState] = useState<SyncSchedule>({
    interval: '30m',
    direction: 'inbound',
    concurrencyLimit: 10,
    nextSyncAt: new Date(Date.now() + 30 * 60000).toISOString(),
    paused: false,
  });

  const setSchedule = useCallback((newSchedule: SyncSchedule) => {
    setScheduleState(newSchedule);

    // Simulate saving to backend
    const data = {
      platformId,
      schedule: newSchedule,
      savedAt: new Date().toISOString(),
    };

    console.log('Saving schedule:', data);

    // Could save to localStorage for demo
    localStorage.setItem(`sync-schedule-${platformId}`, JSON.stringify(data));
  }, [platformId]);

  return {
    schedule,
    setSchedule,
  };
}

// ============================================================================
// useProductPreview — Preview mapped product data
// ============================================================================

export function useProductPreview(
  platformId: string,
  mappings: Mapping[]
): { previewProduct: PreviewProduct | null } {
  // Mock source product data based on platform
  const getSourceProduct = (): Record<string, unknown> => {
    if (platformId.includes('shopify')) {
      return {
        id: 'gid://shopify/Product/12345',
        title: 'Premium Cardboard Box',
        product_type: 'Packaging',
        vendor: 'PackPro Inc',
        price: 24.99,
        weight: 0.5,
        inventory_qty: 500,
        status: 'active',
      };
    } else if (platformId.includes('wix')) {
      return {
        product_id: 'WX-98765',
        product_name: 'Standard Box',
        category: 'Boxes',
        sale_price: 19.99,
        quantity: 250,
      };
    } else if (platformId.includes('amazon')) {
      return {
        sku: 'PACK-001',
        asin: 'B0C3X5Y8Z1',
        product_name: 'Eco Shipping Box',
        price: 22.5,
        fba_qty: 150,
      };
    }
    return {};
  };

  // Apply transformations
  const applyTransformer = (
    value: unknown,
    transformer: Mapping['transformer'],
    customJS?: string
  ): unknown => {
    const strValue = String(value);

    switch (transformer) {
      case 'uppercase':
        return strValue.toUpperCase();
      case 'lowercase':
        return strValue.toLowerCase();
      case 'currency':
        return `$${Number(value).toFixed(2)}`;
      case 'date':
        return new Date(value as string).toISOString();
      case 'custom':
        try {
          // Safe evaluation for custom JS
          const fn = new Function('value', `return ${customJS || 'value'}`);
          return fn(value);
        } catch {
          return value;
        }
      case 'direct':
      default:
        return value;
    }
  };

  // Build target product from mappings
  const sourceProduct = getSourceProduct();
  const targetProduct: Record<string, unknown> = {};

  mappings.forEach((mapping) => {
    const sourceValue = sourceProduct[mapping.sourceFieldId] ||
      sourceProduct[
        Object.keys(sourceProduct).find(
          (k) => k.toLowerCase().includes(mapping.sourceFieldId.split('-')[1])
        ) || ''
      ];

    if (sourceValue !== undefined) {
      targetProduct[mapping.targetFieldId] = applyTransformer(
        sourceValue,
        mapping.transformer,
        mapping.customJS
      );
    }
  });

  const previewProduct: PreviewProduct = {
    source: sourceProduct,
    target: targetProduct,
  };

  return {
    previewProduct,
  };
}
