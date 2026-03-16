/**
 * Request Validator — Zod-based validation middleware factory.
 *
 * Provides flexible validation for:
 * - Request body (JSON)
 * - Query parameters
 * - Path parameters
 * - Headers
 *
 * Features:
 * - Detailed error messages with field paths
 * - Type-safe validated request objects
 * - Unknown field stripping option
 * - Common reusable schemas (pagination, sort, filter, date range)
 *
 * Usage:
 *   const validator = new RequestValidator();
 *   const result = await validator.validateBody(data, schema);
 */

interface ValidationError {
  field: string;
  message: string;
  code: string;
}

interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

interface ValidatorOptions {
  stripUnknown?: boolean;
  abortEarly?: boolean;
  context?: Record<string, any>;
}

/**
 * Common pagination schema structure.
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

/**
 * Common sort schema structure.
 */
export interface SortParams {
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * Common filter schema structure.
 */
export interface FilterParams {
  [key: string]: string | number | boolean | null;
}

/**
 * Common date range schema structure.
 */
export interface DateRangeParams {
  startDate?: string | Date;
  endDate?: string | Date;
}

/**
 * Zod-based request validator with middleware factory.
 */
export class RequestValidator {
  private stripUnknown: boolean;
  private abortEarly: boolean;

  constructor(options: ValidatorOptions = {}) {
    this.stripUnknown = options.stripUnknown ?? false;
    this.abortEarly = options.abortEarly ?? false;
  }

  /**
   * Validate request body against schema.
   */
  async validateBody<T>(
    data: unknown,
    schema: { validate: (data: unknown, options?: any) => { error?: any; value?: T } },
    options: ValidatorOptions = {}
  ): Promise<ValidationResult<T>> {
    try {
      const result = schema.validate(data, {
        abortEarly: options.abortEarly ?? this.abortEarly,
        stripUnknown: options.stripUnknown ?? this.stripUnknown,
        context: options.context,
      });

      if (result.error) {
        const errors = this.parseValidationError(result.error);
        return { success: false, errors };
      }

      return { success: true, data: result.value };
    } catch (err: any) {
      return {
        success: false,
        errors: [
          {
            field: "root",
            message: err.message || "Validation failed",
            code: "VALIDATION_ERROR",
          },
        ],
      };
    }
  }

  /**
   * Validate query parameters.
   */
  async validateQuery<T>(
    query: Record<string, any>,
    schema: { validate: (data: unknown, options?: any) => { error?: any; value?: T } },
    options: ValidatorOptions = {}
  ): Promise<ValidationResult<T>> {
    return this.validateBody(query, schema, {
      ...options,
      stripUnknown: options.stripUnknown ?? true, // Query params usually ignore unknown
    });
  }

  /**
   * Validate path parameters.
   */
  async validateParams<T>(
    params: Record<string, any>,
    schema: { validate: (data: unknown, options?: any) => { error?: any; value?: T } },
    options: ValidatorOptions = {}
  ): Promise<ValidationResult<T>> {
    return this.validateBody(params, schema, options);
  }

  /**
   * Validate headers.
   */
  async validateHeaders<T>(
    headers: Record<string, any>,
    schema: { validate: (data: unknown, options?: any) => { error?: any; value?: T } },
    options: ValidatorOptions = {}
  ): Promise<ValidationResult<T>> {
    // Normalize header names to lowercase
    const normalizedHeaders: Record<string, any> = {};
    for (const [key, value] of Object.entries(headers)) {
      normalizedHeaders[key.toLowerCase()] = value;
    }

    return this.validateBody(normalizedHeaders, schema, {
      ...options,
      stripUnknown: options.stripUnknown ?? true,
    });
  }

  /**
   * Parse Zod/Joi validation errors into consistent format.
   */
  private parseValidationError(error: any): ValidationError[] {
    const errors: ValidationError[] = [];

    if (error.details) {
      // Joi format
      error.details.forEach((detail: any) => {
        errors.push({
          field: detail.path.join("."),
          message: detail.message,
          code: detail.code || "VALIDATION_ERROR",
        });
      });
    } else if (error.errors) {
      // Custom format
      error.errors.forEach((err: any) => {
        errors.push({
          field: err.field || "unknown",
          message: err.message,
          code: err.code || "VALIDATION_ERROR",
        });
      });
    } else {
      // Generic error
      errors.push({
        field: "unknown",
        message: error.message || "Validation failed",
        code: "VALIDATION_ERROR",
      });
    }

    return errors;
  }

  /**
   * Create pagination schema validator.
   */
  createPaginationSchema() {
    return {
      validate: (data: unknown) => {
        const obj = data as any;
        const page = obj?.page ? parseInt(obj.page, 10) : 1;
        const limit = obj?.limit ? parseInt(obj.limit, 10) : 25;

        if (page < 1) {
          return { error: { message: "page must be >= 1" } };
        }
        if (limit < 1 || limit > 100) {
          return { error: { message: "limit must be between 1 and 100" } };
        }

        return {
          value: { page, limit } as PaginationParams,
        };
      },
    };
  }

  /**
   * Create sort schema validator.
   */
  createSortSchema(allowedFields: string[]) {
    return {
      validate: (data: unknown) => {
        const obj = data as any;
        const sortBy = obj?.sortBy || "createdAt";
        const sortOrder = obj?.sortOrder || "desc";

        if (!allowedFields.includes(sortBy)) {
          return {
            error: { message: `sortBy must be one of: ${allowedFields.join(", ")}` },
          };
        }
        if (!["asc", "desc"].includes(sortOrder)) {
          return { error: { message: "sortOrder must be 'asc' or 'desc'" } };
        }

        return {
          value: { sortBy, sortOrder } as SortParams,
        };
      },
    };
  }

  /**
   * Create filter schema validator.
   */
  createFilterSchema(allowedFields: string[]) {
    return {
      validate: (data: unknown) => {
        const obj = data as any || {};
        const filtered: FilterParams = {};

        for (const field of allowedFields) {
          if (field in obj) {
            filtered[field] = obj[field];
          }
        }

        return { value: filtered };
      },
    };
  }

  /**
   * Create date range schema validator.
   */
  createDateRangeSchema() {
    return {
      validate: (data: unknown) => {
        const obj = data as any;
        const startDate = obj?.startDate ? new Date(obj.startDate) : undefined;
        const endDate = obj?.endDate ? new Date(obj.endDate) : undefined;

        if (startDate && isNaN(startDate.getTime())) {
          return { error: { message: "startDate must be a valid ISO date" } };
        }
        if (endDate && isNaN(endDate.getTime())) {
          return { error: { message: "endDate must be a valid ISO date" } };
        }
        if (startDate && endDate && startDate > endDate) {
          return {
            error: { message: "startDate must be before endDate" },
          };
        }

        return {
          value: { startDate, endDate } as DateRangeParams,
        };
      },
    };
  }
}

export type { ValidationError, ValidationResult };
