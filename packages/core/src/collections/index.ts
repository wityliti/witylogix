/**
 * Collection Manager - Barrel Export
 */

export { CollectionManager, collectionManager, CollectionNotFoundError, CollectionError } from './collection-manager';
export type {
  CollectionType,
  SortOrder,
  RuleCondition,
  CollectionRule,
  Collection,
  CollectionProduct,
  CollectionWithProducts,
  CreateCollectionRequest,
  UpdateCollectionRequest,
  AddProductsRequest,
  ReorderProductsRequest,
  PlatformCollectionData,
  ShopifyCollectionData,
  PaginationOptions,
  CollectionListResponse,
  CollectionPlatformAdapter,
} from './types';
