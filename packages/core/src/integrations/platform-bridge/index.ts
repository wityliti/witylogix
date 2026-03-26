/**
 * Platform Bridge Exports
 * Multi-platform e-commerce integration abstraction layer
 */

export {
  DataNormalizer,
  createDataNormalizer,
} from './data-normalizer.js';

export {
  WebhookNormalizer,
  createWebhookNormalizer,
} from './webhook-normalizer.js';

export {
  PlatformSource,
  type UnifiedOrder,
  type UnifiedProduct,
  type UnifiedCustomer,
  type UnifiedLineItem,
  type UnifiedAddress,
  type UnifiedImage,
  type UnifiedProductVariant,
  type UnifiedWebhookEvent,
  type FieldMapping,
  type NormalizerConfig,
  type NormalizationError,
  type NormalizationResult,
  type PlatformWebhookTopics,
  type SyncDirection,
  type SyncConfig,
  type SyncStatus,
} from './types.js';
