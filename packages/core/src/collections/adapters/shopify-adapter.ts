/**
 * Shopify Collection Platform Adapter
 * Handles Shopify GraphQL API calls for collection CRUD operations
 * Normalizes Shopify format to Witylogix generic format
 */

import {
  CollectionPlatformAdapter,
  Collection,
  CollectionRule,
} from "../types";

// ─── TYPES ─────────────────────────────────────────────────────────────

interface ShopifyConfig {
  shopUrl: string; // e.g., "myshop.myshopify.com"
  accessToken: string; // Shopify Admin API access token
}

interface RateLimitInfo {
  used: number;
  remaining: number;
  resetAt: Date;
}

interface ShopifyGraphQLError {
  message: string;
  extensions?: {
    code?: string;
  };
}

interface ShopifyGraphQLResponse<T> {
  data?: T;
  errors?: ShopifyGraphQLError[];
}

// ─── SHOPIFY GRAPHQL QUERIES & MUTATIONS ──────────────────────────────

const SHOPIFY_COLLECTION_QUERY = `
  query GetCollection($id: ID!) {
    collection(id: $id) {
      id
      title
      handle
      description
      descriptionHtml
      image {
        src
        altText
      }
      products(first: 1) {
        totalCount
      }
      ruleSet {
        appliedDisjunctively
        rules {
          column
          relation
          condition
          value
        }
      }
    }
  }
`;

const SHOPIFY_COLLECTION_PRODUCTS_QUERY = `
  query GetCollectionProducts($id: ID!, $first: Int!, $after: String) {
    collection(id: $id) {
      products(first: $first, after: $after) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            title
            handle
          }
        }
      }
    }
  }
`;

const SHOPIFY_UPDATE_COLLECTION_RULES_MUTATION = `
  mutation UpdateCollectionRules($id: ID!, $input: CollectionInput!) {
    collectionUpdate(input: $input) {
      collection {
        id
        title
        ruleSet {
          appliedDisjunctively
          rules {
            column
            relation
            condition
            value
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// ─── SHOPIFY ADAPTER IMPLEMENTATION ────────────────────────────────────

export class ShopifyCollectionAdapter implements CollectionPlatformAdapter {
  private config: ShopifyConfig;
  private rateLimitInfo: RateLimitInfo = {
    used: 0,
    remaining: 40,
    resetAt: new Date(),
  };

  constructor(config: ShopifyConfig) {
    this.config = config;
  }

  /**
   * Sync a collection from Shopify
   */
  async syncCollection(
    shopId: string,
    externalCollectionId: string,
  ): Promise<Collection> {
    const response = await this.executeGraphQL<{
      collection: {
        id: string;
        title: string;
        handle: string;
        description: string;
        image?: {
          src: string;
        };
        products: {
          totalCount: number;
        };
        ruleSet?: {
          appliedDisjunctively: boolean;
          rules: Array<{
            column: string;
            relation: "and" | "or";
            condition: string;
            value: string;
          }>;
        };
      };
    }>(SHOPIFY_COLLECTION_QUERY, {
      id: externalCollectionId,
    });

    if (!response.data?.collection) {
      throw new Error(
        `Failed to fetch collection ${externalCollectionId} from Shopify`,
      );
    }

    const collection = response.data.collection;

    // Parse rules if present
    let rules: CollectionRule[] | undefined;
    if (collection.ruleSet?.rules && collection.ruleSet.rules.length > 0) {
      rules = collection.ruleSet.rules.map((rule) => ({
        column: rule.column,
        relation: rule.relation,
        condition: rule.condition as any,
        value: rule.value,
      }));
    }

    return {
      id: "", // Will be set by collection manager
      shopId,
      externalId: externalCollectionId,
      source: "SHOPIFY",
      title: collection.title,
      description: collection.description,
      type: rules && rules.length > 0 ? "auto" : "manual",
      sortOrder: "manual",
      imageUrl: collection.image?.src,
      isActive: true,
      rules,
      productCount: collection.products.totalCount,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Fetch products from a Shopify collection
   */
  async fetchProducts(
    externalCollectionId: string,
    limit: number = 20,
    cursor?: string,
  ): Promise<{
    products: Array<{
      externalId: string;
      title: string;
    }>;
    nextCursor?: string;
  }> {
    const response = await this.executeGraphQL<{
      collection: {
        products: {
          pageInfo: {
            hasNextPage: boolean;
            endCursor: string | null;
          };
          edges: Array<{
            node: {
              id: string;
              title: string;
              handle: string;
            };
          }>;
        };
      };
    }>(SHOPIFY_COLLECTION_PRODUCTS_QUERY, {
      id: externalCollectionId,
      first: limit,
      after: cursor || null,
    });

    if (!response.data?.collection?.products) {
      throw new Error(
        `Failed to fetch products for collection ${externalCollectionId}`,
      );
    }

    const productsData = response.data.collection.products;

    return {
      products: productsData.edges.map((edge) => ({
        externalId: edge.node.id,
        title: edge.node.title,
      })),
      nextCursor: productsData.pageInfo.hasNextPage
        ? productsData.pageInfo.endCursor || undefined
        : undefined,
    };
  }

  /**
   * Push collection rules to Shopify
   */
  async pushRules(
    externalCollectionId: string,
    rules: CollectionRule[],
  ): Promise<void> {
    if (!rules || rules.length === 0) {
      return; // No rules to push
    }

    const ruleInput = rules.map((rule) => ({
      column: rule.column,
      relation: rule.relation,
      condition: rule.condition,
      value: String(rule.value),
    }));

    const response = await this.executeGraphQL<{
      collectionUpdate: {
        collection: {
          id: string;
        };
        userErrors: Array<{
          field: string[];
          message: string;
        }>;
      };
    }>(SHOPIFY_UPDATE_COLLECTION_RULES_MUTATION, {
      id: externalCollectionId,
      input: {
        id: externalCollectionId,
        ruleSet: {
          appliedDisjunctively: false, // AND logic by default
          rules: ruleInput,
        },
      },
    });

    if (response.errors || response.data?.collectionUpdate.userErrors.length) {
      const errorMsg =
        response.errors?.[0]?.message ||
        response.data?.collectionUpdate.userErrors[0]?.message;
      throw new Error(
        `Failed to push rules to Shopify collection: ${errorMsg}`,
      );
    }
  }

  /**
   * Get rate limit info from last API call
   */
  getRateLimitInfo(): Promise<{
    used: number;
    remaining: number;
    resetAt: Date;
  }> {
    return Promise.resolve(this.rateLimitInfo);
  }

  /**
   * Execute a Shopify GraphQL query or mutation
   */
  private async executeGraphQL<T>(
    query: string,
    variables: Record<string, any> = {},
  ): Promise<ShopifyGraphQLResponse<T>> {
    const url = `https://${this.config.shopUrl}/admin/api/2024-01/graphql.json`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": this.config.accessToken,
        },
        body: JSON.stringify({
          query,
          variables: Object.entries(variables).reduce(
            (acc, [key, value]) => {
              if (value !== null && value !== undefined) {
                acc[key] = value;
              }
              return acc;
            },
            {} as Record<string, any>,
          ),
        }),
      });

      // Extract rate limit info from headers
      const rateLimitHeader = response.headers.get(
        "X-Shopify-Shop-Api-Call-Limit",
      );
      if (rateLimitHeader) {
        const [used, limit] = rateLimitHeader.split("/").map(Number);
        this.rateLimitInfo = {
          used,
          remaining: limit - used,
          resetAt: new Date(Date.now() + 1000), // Simplified: 1 second reset
        };
      }

      if (!response.ok) {
        throw new Error(
          `Shopify API returned ${response.status}: ${response.statusText}`,
        );
      }

      const data: ShopifyGraphQLResponse<T> = await response.json();

      if (data.errors) {
        const errorMsg = data.errors.map((e) => e.message).join("; ");
        throw new Error(`Shopify GraphQL error: ${errorMsg}`);
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        `Failed to execute Shopify GraphQL query: ${String(error)}`,
      );
    }
  }

  /**
   * Validate Shopify access and connectivity
   */
  async validateConnection(): Promise<boolean> {
    try {
      const testQuery = `
        query {
          shop {
            name
          }
        }
      `;

      const response = await this.executeGraphQL<{
        shop: {
          name: string;
        };
      }>(testQuery);

      return !!response.data?.shop?.name;
    } catch (error) {
      console.error("Shopify connection validation failed:", error);
      return false;
    }
  }

  /**
   * Check if approaching rate limit and implement backoff if needed
   */
  async ensureRateLimit(): Promise<void> {
    if (this.rateLimitInfo.remaining < 5) {
      // Back off if low on API calls
      const waitTime = Math.max(
        1000,
        (this.rateLimitInfo.resetAt.getTime() - Date.now()) / 2,
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
}

// ─── FACTORY FUNCTION ──────────────────────────────────────────────────

/**
 * Create a Shopify collection adapter instance
 */
export function createShopifyAdapter(
  shopUrl: string,
  accessToken: string,
): ShopifyCollectionAdapter {
  return new ShopifyCollectionAdapter({
    shopUrl,
    accessToken,
  });
}

/**
 * Create adapter from Shopify app credentials (stored in database)
 */
export function createShopifyAdapterFromCredentials(credentials: {
  shopUrl: string;
  accessToken: string;
}): ShopifyCollectionAdapter {
  return createShopifyAdapter(credentials.shopUrl, credentials.accessToken);
}
