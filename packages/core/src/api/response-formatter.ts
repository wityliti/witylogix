/**
 * Response Formatter — Standard API response format and error codes.
 *
 * Features:
 * - Consistent success response format
 * - Consistent error response format with error codes
 * - HTTP status code mapping
 * - HATEOAS link helpers for navigation
 * - Error details for better debugging
 *
 * Usage:
 *   const response = new ApiResponse();
 *   response.success(data);
 *   response.error("VALIDATION_ERROR", "Invalid input");
 */

interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    requestId?: string;
    version?: string;
  };
}

interface ErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: ErrorDetail[];
    timestamp: string;
    requestId?: string;
  };
}

interface HateoasLink {
  rel: string;
  href: string;
  method?: string;
  title?: string;
}

/**
 * Standard error codes.
 */
export enum ApiErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = "BAD_REQUEST",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  UNPROCESSABLE_ENTITY = "UNPROCESSABLE_ENTITY",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  VALIDATION_ERROR = "VALIDATION_ERROR",

  // Server errors (5xx)
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  NOT_IMPLEMENTED = "NOT_IMPLEMENTED",

  // Business logic errors
  TENANT_NOT_FOUND = "TENANT_NOT_FOUND",
  INVALID_PLAN = "INVALID_PLAN",
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
  RESOURCE_LOCKED = "RESOURCE_LOCKED",
}

/**
 * Map error codes to HTTP status codes.
 */
const ERROR_STATUS_MAP: Record<ApiErrorCode, number> = {
  [ApiErrorCode.BAD_REQUEST]: 400,
  [ApiErrorCode.UNAUTHORIZED]: 401,
  [ApiErrorCode.FORBIDDEN]: 403,
  [ApiErrorCode.NOT_FOUND]: 404,
  [ApiErrorCode.CONFLICT]: 409,
  [ApiErrorCode.UNPROCESSABLE_ENTITY]: 422,
  [ApiErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ApiErrorCode.VALIDATION_ERROR]: 400,
  [ApiErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ApiErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ApiErrorCode.NOT_IMPLEMENTED]: 501,
  [ApiErrorCode.TENANT_NOT_FOUND]: 404,
  [ApiErrorCode.INVALID_PLAN]: 400,
  [ApiErrorCode.QUOTA_EXCEEDED]: 429,
  [ApiErrorCode.RESOURCE_LOCKED]: 423,
};

/**
 * Standard API response formatter.
 */
export class ApiResponse {
  private requestId?: string;
  private version?: string;

  constructor(requestId?: string, version?: string) {
    this.requestId = requestId;
    this.version = version;
  }

  /**
   * Format success response.
   */
  success<T>(data: T, metadata?: any): SuccessResponse<T> {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: this.requestId,
        version: this.version,
        ...metadata,
      },
    };
  }

  /**
   * Format error response.
   */
  error(
    code: ApiErrorCode | string,
    message: string,
    details?: ErrorDetail[],
  ): ErrorResponse {
    const statusCode = this.getStatusCode(code as ApiErrorCode);

    return {
      success: false,
      error: {
        code: code as string,
        message,
        statusCode,
        details,
        timestamp: new Date().toISOString(),
        requestId: this.requestId,
      },
    };
  }

  /**
   * Get HTTP status code for error code.
   */
  private getStatusCode(code: ApiErrorCode): number {
    return ERROR_STATUS_MAP[code] || 500;
  }

  /**
   * Get HTTP status code for error.
   */
  getStatusCodeForError(code: string): number {
    return ERROR_STATUS_MAP[code as ApiErrorCode] || 500;
  }

  /**
   * Format validation error with field details.
   */
  validationError(
    message: string,
    fieldErrors: Record<string, string | string[]>,
  ): ErrorResponse {
    const details: ErrorDetail[] = Object.entries(fieldErrors).map(
      ([field, messages]) => ({
        field,
        message: Array.isArray(messages) ? messages.join(", ") : messages,
        code: "FIELD_VALIDATION_ERROR",
      }),
    );

    return this.error(ApiErrorCode.VALIDATION_ERROR, message, details);
  }

  /**
   * Format pagination response with metadata.
   */
  paginated<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
    metadata?: any,
  ): SuccessResponse<T[]> {
    return this.success(data, {
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
      ...metadata,
    });
  }

  /**
   * Format cursor-paginated response.
   */
  cursorPaginated<T>(
    data: T[],
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor?: string;
      endCursor?: string;
    },
    metadata?: any,
  ): SuccessResponse<T[]> {
    return this.success(data, {
      pageInfo,
      ...metadata,
    });
  }

  /**
   * Create HATEOAS link.
   */
  createLink(
    rel: string,
    href: string,
    method?: string,
    title?: string,
  ): HateoasLink {
    return {
      rel,
      href,
      method,
      title,
    };
  }

  /**
   * Add HATEOAS links to response.
   */
  withLinks<T>(data: T, links: HateoasLink[]): SuccessResponse<T> {
    const response = this.success(data);
    (response as any)._links = links;
    return response;
  }

  /**
   * Format list response with standard pagination metadata.
   */
  list<T>(
    items: T[],
    metadata?: {
      total?: number;
      page?: number;
      limit?: number;
      links?: HateoasLink[];
    },
  ): SuccessResponse<T[]> {
    const response = this.success(items, {
      count: items.length,
      ...metadata,
    });

    if (metadata?.links) {
      (response as any)._links = metadata.links;
    }

    return response;
  }

  /**
   * Format created response (201 Created).
   */
  created<T>(
    data: T,
    location?: string,
  ): SuccessResponse<T> & { statusCode: number } {
    const response = this.success(data) as any;
    response.statusCode = 201;
    if (location) {
      response.headers = { Location: location };
    }
    return response;
  }

  /**
   * Format no content response (204 No Content).
   */
  noContent(): { success: true; statusCode: number } {
    return {
      success: true,
      statusCode: 204,
    };
  }
}

export type { SuccessResponse, ErrorResponse, ErrorDetail, HateoasLink };
