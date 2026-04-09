/**
 * Cursor-Based Pagination — Opaque cursor generation and validation.
 *
 * Features:
 * - Base64-encoded opaque cursors with HMAC signing
 * - Forward/backward pagination support
 * - Configurable page sizes (max 100, default 25)
 * - Optional total count (expensive, opt-in)
 * - Prisma-compatible cursor generation
 * - Standardized response format
 *
 * Usage:
 *   const paginator = new CursorPaginator();
 *   const result = await paginator.paginate(items, config);
 *   // { data: [...], pageInfo: { hasNextPage, ... } }
 */

import crypto from "crypto";

interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
  totalCount?: number;
}

interface PaginationConfig {
  pageSize?: number;
  cursor?: string;
  backward?: boolean;
  includeTotalCount?: boolean;
  secretKey?: string;
}

interface PaginatedResponse<T> {
  data: T[];
  pageInfo: PageInfo;
}

interface CursorData {
  index: number;
  timestamp: number;
  signature: string;
}

/**
 * Cursor-based paginator with opaque cursors.
 */
export class CursorPaginator {
  private secretKey: string;
  private maxPageSize: number;
  private defaultPageSize: number;

  constructor(secretKey: string = "default-secret-key", defaultPageSize: number = 25) {
    this.secretKey = secretKey;
    this.maxPageSize = 100;
    this.defaultPageSize = Math.min(defaultPageSize, this.maxPageSize);
  }

  /**
   * Paginate array of items using cursor-based pagination.
   */
  async paginate<T>(
    items: T[],
    config: PaginationConfig = {}
  ): Promise<PaginatedResponse<T>> {
    const pageSize = Math.min(
      config.pageSize || this.defaultPageSize,
      this.maxPageSize
    );

    let startIndex = 0;
    let hasPreviousPage = false;

    // Parse cursor if provided
    if (config.cursor) {
      const cursorData = this.decodeCursor(config.cursor);
      if (cursorData) {
        startIndex = config.backward ? Math.max(0, cursorData.index - pageSize) : cursorData.index;
        hasPreviousPage = startIndex > 0;
      }
    }

    // Get page of items (fetch one extra to detect hasNextPage)
    const endIndex = startIndex + pageSize + 1;
    const pageItems = items.slice(startIndex, endIndex);
    const hasNextPage = pageItems.length > pageSize;

    // Return only the requested page size
    const data = pageItems.slice(0, pageSize);

    // Generate cursors
    const startCursor = data.length > 0 ? this.encodeCursor(startIndex) : undefined;
    const endCursor =
      data.length > 0
        ? this.encodeCursor(startIndex + data.length)
        : undefined;

    // Build response
    const response: PaginatedResponse<T> = {
      data,
      pageInfo: {
        hasNextPage,
        hasPreviousPage,
        startCursor,
        endCursor,
      },
    };

    // Optionally include total count (expensive operation)
    if (config.includeTotalCount) {
      response.pageInfo.totalCount = items.length;
    }

    return response;
  }

  /**
   * Paginate Prisma query results.
   */
  async paginatePrismaQuery<T>(
    queryFn: (take: number, skip?: number) => Promise<T[]>,
    config: PaginationConfig = {}
  ): Promise<PaginatedResponse<T>> {
    const pageSize = Math.min(
      config.pageSize || this.defaultPageSize,
      this.maxPageSize
    );

    let skip = 0;

    // Parse cursor if provided
    if (config.cursor) {
      const cursorData = this.decodeCursor(config.cursor);
      if (cursorData) {
        skip = config.backward
          ? Math.max(0, cursorData.index - pageSize)
          : cursorData.index;
      }
    }

    // Fetch one extra item to detect hasNextPage
    const items = await queryFn(pageSize + 1, skip);
    const hasNextPage = items.length > pageSize;
    const data = items.slice(0, pageSize);

    const startCursor = data.length > 0 ? this.encodeCursor(skip) : undefined;
    const endCursor =
      data.length > 0 ? this.encodeCursor(skip + data.length - 1) : undefined;

    const response: PaginatedResponse<T> = {
      data,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: skip > 0,
        startCursor,
        endCursor,
      },
    };

    // Optionally fetch total count
    if (config.includeTotalCount) {
      // For Prisma, this would be a separate count query
      // The caller would pass countFn or similar
      response.pageInfo.totalCount = undefined; // Would be set by caller
    }

    return response;
  }

  /**
   * Encode cursor as opaque base64 string with HMAC signature.
   */
  private encodeCursor(index: number): string {
    const timestamp = Date.now();
    const data = JSON.stringify({ index, timestamp });

    // Generate HMAC signature
    const signature = crypto
      .createHmac("sha256", this.secretKey)
      .update(data)
      .digest("hex");

    // Combine and encode
    const combined = JSON.stringify({ index, timestamp, signature });
    return Buffer.from(combined).toString("base64");
  }

  /**
   * Decode and validate cursor.
   */
  private decodeCursor(cursor: string): CursorData | null {
    try {
      const decoded = Buffer.from(cursor, "base64").toString("utf-8");
      const data: CursorData = JSON.parse(decoded);

      // Verify signature
      const verified = this.verifyCursorSignature(data);
      if (!verified) {
        return null; // Invalid signature
      }

      // Check timestamp (optional: reject very old cursors)
      const maxCursorAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      if (Date.now() - data.timestamp > maxCursorAge) {
        return null; // Cursor too old
      }

      return data;
    } catch {
      return null; // Invalid cursor format
    }
  }

  /**
   * Verify cursor signature.
   */
  private verifyCursorSignature(data: CursorData): boolean {
    const { signature, ...payload } = data;
    const payloadStr = JSON.stringify({
      index: payload.index,
      timestamp: payload.timestamp,
    });

    const expectedSignature = crypto
      .createHmac("sha256", this.secretKey)
      .update(payloadStr)
      .digest("hex");

    return signature === expectedSignature;
  }

  /**
   * Generate cursor from item position.
   */
  generateCursor(index: number): string {
    return this.encodeCursor(index);
  }

  /**
   * Parse cursor to get position (for testing/debugging).
   */
  parseCursor(cursor: string): { index?: number; valid: boolean } {
    const data = this.decodeCursor(cursor);
    return {
      index: data?.index,
      valid: data !== null,
    };
  }
}

export type { PageInfo, PaginationConfig, PaginatedResponse };
