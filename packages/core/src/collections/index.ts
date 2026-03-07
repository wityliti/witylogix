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
  ShopifyCollectionData,
  PaginationOptions,
  CollectionListResponse,
} from './types';
