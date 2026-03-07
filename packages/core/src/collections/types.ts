/**
 * Collection Management Types
 * Defines types for product collections and grouping
 */

/**
 * Collection type (manual or automatic)
 */
export type CollectionType = 'manual' | 'auto';

/**
 * Sorting options for collection products
 */
export type SortOrder =
  | 'manual'
  | 'best-selling'
  | 'alpha-asc'
  | 'alpha-desc'
  | 'price-asc'
  | 'price-desc'
  | 'created-desc';

/**
 * Rule condition for automatic collections
 */
export type RuleCondition = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than';

/**
 * Rule for automatic collection evaluation
 */
export interface CollectionRule {
  column: string;
  relation: 'and' | 'or';
  condition: RuleCondition;
  value: string | number | boolean;
}

/**
 * Collection interface (database representation)
 */
export interface Collection {
  id: string;
  shopId: string;
  externalId?: string;
  title: string;
  description?: string;
  type: CollectionType;
  sortOrder: SortOrder;
  imageUrl?: string;
  isActive: boolean;
  rules?: CollectionRule[];
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Collection product (association)
 */
export interface CollectionProduct {
  id: string;
  collectionId: string;
  productId: string;
  position: number;
  createdAt: Date;
}

/**
 * Collection with products
 */
export interface CollectionWithProducts extends Collection {
  products: CollectionProduct[];
}

/**
 * Request to create a collection
 */
export interface CreateCollectionRequest {
  title: string;
  description?: string;
  type?: CollectionType;
  sortOrder?: SortOrder;
  imageUrl?: string;
  isActive?: boolean;
  rules?: CollectionRule[];
}

/**
 * Request to update a collection
 */
export interface UpdateCollectionRequest {
  title?: string;
  description?: string;
  type?: CollectionType;
  sortOrder?: SortOrder;
  imageUrl?: string;
  isActive?: boolean;
  rules?: CollectionRule[];
}

/**
 * Request to add products to collection
 */
export interface AddProductsRequest {
  productIds: string[];
}

/**
 * Request to reorder products in collection
 */
export interface ReorderProductsRequest {
  items: Array<{
    productId: string;
    position: number;
  }>;
}

/**
 * Shopify collection sync data
 */
export interface ShopifyCollectionData {
  id: string;
  title: string;
  handle: string;
  description?: string;
  image?: {
    src: string;
  };
  rules?: CollectionRule[];
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

/**
 * Collection list response
 */
export interface CollectionListResponse {
  collections: Collection[];
  total: number;
  limit: number;
  offset: number;
}
