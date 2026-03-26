/**
 * Metafields module
 * Export all metafields types and classes
 */

export { MetafieldType, EntityType } from './types.js';
export type {
  MetafieldValue,
  MetafieldValidation,
  MetafieldDefinitionData,
  ValidationResult,
  BulkMetafieldPayload,
} from './types.js';

export { MetafieldManager } from './manager.js';

export default {
  MetafieldManager,
};
