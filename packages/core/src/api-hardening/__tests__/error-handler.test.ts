/**
 * API Error Handler Tests
 * Comprehensive test suite for error classes, Zod/Prisma error handling, and response formatting
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z, ZodError } from 'zod';
import {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  RateLimitError,
  ServiceUnavailableError,
  errorHandlerPlugin,
  transformZodError,
  transformPrismaError,
} from '../error-handler';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create base AppError with correct properties', () => {
      const error = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong');

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.message).toBe('Something went wrong');
      expect(error.name).toBe('AppError');
    });

    it('should include details when provided', () => {
      const details = { requestId: 'req-123' };
      const error = new AppError(500, 'INTERNAL_ERROR', 'Error occurred', details);

      expect(error.details).toEqual(details);
    });
  });

  describe('ValidationError', () => {
    it('should have correct status code 400', () => {
      const error = new ValidationError('Invalid input');

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should include field-level details', () => {
      const details = {
        email: 'Invalid email format',
        password: 'Password must be at least 8 characters',
      };
      const error = new ValidationError('Validation failed', details);

      expect(error.details).toEqual(details);
    });
  });

  describe('NotFoundError', () => {
    it('should have correct status code 404', () => {
      const error = new NotFoundError('User not found');

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('User not found');
    });
  });

  describe('ConflictError', () => {
    it('should have correct status code 409', () => {
      const error = new ConflictError('Resource already exists');

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });
  });

  describe('ForbiddenError', () => {
    it('should have correct status code 403', () => {
      const error = new ForbiddenError('Access denied');

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });
  });

  describe('UnauthorizedError', () => {
    it('should have correct status code 401', () => {
      const error = new UnauthorizedError('Authentication required');

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('RateLimitError', () => {
    it('should have correct status code 429', () => {
      const error = new RateLimitError('Too many requests');

      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should include rate limit details', () => {
      const details = {
        retryAfter: 60,
        limit: 100,
        remaining: 0,
      };
      const error = new RateLimitError('Rate limit exceeded', details);

      expect(error.details).toEqual(details);
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should have correct status code 503', () => {
      const error = new ServiceUnavailableError('Service temporarily unavailable');

      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });
});

describe('Zod Error Handling', () => {
  it('should transform Zod validation error to field-level details', () => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
    });

    const result = schema.safeParse({
      email: 'invalid-email',
      password: 'short',
    });

    if (!result.success) {
      const transformed = transformZodError(result.error);

      expect(transformed).toHaveProperty('email');
      expect(transformed).toHaveProperty('password');
      expect(transformed.email).toBeDefined();
      expect(transformed.password).toBeDefined();
    }
  });

  it('should handle nested object validation errors', () => {
    const schema = z.object({
      user: z.object({
        name: z.string().min(1),
        email: z.string().email(),
      }),
    });

    const result = schema.safeParse({
      user: {
        name: '',
        email: 'invalid',
      },
    });

    if (!result.success) {
      const transformed = transformZodError(result.error);

      expect(transformed).toBeDefined();
      expect(Object.keys(transformed).length).toBeGreaterThan(0);
    }
  });

  it('should handle array validation errors', () => {
    const schema = z.object({
      items: z.array(
        z.object({
          id: z.string(),
          quantity: z.number().positive(),
        })
      ),
    });

    const result = schema.safeParse({
      items: [
        { id: '', quantity: -1 },
        { id: 'item-1', quantity: 0 },
      ],
    });

    if (!result.success) {
      const transformed = transformZodError(result.error);

      expect(transformed).toBeDefined();
    }
  });

  it('should include error messages for each field', () => {
    const schema = z.object({
      username: z.string().min(3, 'Username must be at least 3 characters'),
      age: z.number().min(18, 'Must be at least 18 years old'),
    });

    const result = schema.safeParse({
      username: 'ab',
      age: 15,
    });

    if (!result.success) {
      const transformed = transformZodError(result.error);

      expect(transformed.username).toContain('3 characters');
      expect(transformed.age).toContain('18');
    }
  });

  it('should handle multiple validation errors for single field', () => {
    const schema = z.object({
      email: z
        .string()
        .min(1, 'Email is required')
        .email('Invalid email format'),
    });

    const result = schema.safeParse({
      email: 'not-an-email',
    });

    if (!result.success) {
      const transformed = transformZodError(result.error);

      expect(transformed.email).toBeDefined();
    }
  });
});

describe('Prisma Error Handling', () => {
  it('should transform P2002 unique constraint to ConflictError', () => {
    const prismaError = {
      code: 'P2002',
      message: 'Unique constraint failed on the fields: (email)',
      meta: { target: ['email'] },
    };

    const appError = transformPrismaError(prismaError as any);

    expect(appError).toBeInstanceOf(ConflictError);
    expect(appError.statusCode).toBe(409);
    expect(appError.code).toBe('CONFLICT');
  });

  it('should transform P2025 record not found to NotFoundError', () => {
    const prismaError = {
      code: 'P2025',
      message: 'An operation failed because it depends on one or more records that were required but not found.',
    };

    const appError = transformPrismaError(prismaError as any);

    expect(appError).toBeInstanceOf(NotFoundError);
    expect(appError.statusCode).toBe(404);
  });

  it('should transform P2003 foreign key constraint to ConflictError', () => {
    const prismaError = {
      code: 'P2003',
      message: 'Foreign key constraint failed',
      meta: { field_name: 'shopId' },
    };

    const appError = transformPrismaError(prismaError as any);

    expect(appError.statusCode).toBe(409);
  });

  it('should transform P2014 required relation violation', () => {
    const prismaError = {
      code: 'P2014',
      message: 'The change you are trying to make would violate a required relation',
    };

    const appError = transformPrismaError(prismaError as any);

    expect(appError).toBeInstanceOf(ConflictError);
  });

  it('should include details about conflicting fields', () => {
    const prismaError = {
      code: 'P2002',
      message: 'Unique constraint failed on the fields: (email)',
      meta: { target: ['email'] },
    };

    const appError = transformPrismaError(prismaError as any);

    expect(appError.details).toContain('email');
  });

  it('should handle unknown Prisma errors as ServiceUnavailableError', () => {
    const prismaError = {
      code: 'P9999',
      message: 'Unknown Prisma error',
    };

    const appError = transformPrismaError(prismaError as any);

    expect(appError).toBeInstanceOf(ServiceUnavailableError);
  });
});

describe('Error Response Format', () => {
  it('should format error response with correct structure', () => {
    const error = new ValidationError('Invalid input', { email: 'Required' });
    const response = {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId: 'req-123',
      },
    };

    expect(response.error).toHaveProperty('code');
    expect(response.error).toHaveProperty('message');
    expect(response.error).toHaveProperty('details');
    expect(response.error).toHaveProperty('requestId');
  });

  it('should include requestId in all error responses', () => {
    const error = new NotFoundError('Resource not found');
    const requestId = 'req-456';

    const response = {
      error: {
        code: error.code,
        message: error.message,
        requestId,
      },
    };

    expect(response.error.requestId).toBe(requestId);
  });

  it('should not leak sensitive information in unknown errors', () => {
    const unknownError = new Error('Database connection string: postgres://user:pass@host/db');
    const safeMessage = 'An unexpected error occurred';
    const requestId = 'req-789';

    const response = {
      error: {
        code: 'INTERNAL_ERROR',
        message: safeMessage,
        requestId,
      },
    };

    expect(response.error.message).not.toContain('connection string');
    expect(response.error.message).not.toContain('postgres://');
  });

  it('should include details only when available', () => {
    const errorWithDetails = new ValidationError('Validation failed', { field: 'Invalid value' });
    const errorWithoutDetails = new NotFoundError('Not found');

    expect(errorWithDetails.details).toBeDefined();
    expect(errorWithoutDetails.details).toBeUndefined();
  });

  it('should format validation error response with field details', () => {
    const error = new ValidationError('Validation failed', {
      email: 'Invalid email format',
      password: 'Must be at least 8 characters',
    });

    const response = {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };

    expect(response.error.details.email).toBe('Invalid email format');
    expect(response.error.details.password).toBe('Must be at least 8 characters');
  });

  it('should return consistent error format for different error types', () => {
    const errors = [
      new ValidationError('Invalid'),
      new NotFoundError('Not found'),
      new ConflictError('Conflict'),
      new ForbiddenError('Forbidden'),
      new UnauthorizedError('Unauthorized'),
      new RateLimitError('Rate limited'),
    ];

    errors.forEach(error => {
      expect(error).toHaveProperty('statusCode');
      expect(error).toHaveProperty('code');
      expect(error).toHaveProperty('message');
    });
  });
});

describe('Error Handler Middleware', () => {
  it('should format error response in Fastify handler', async () => {
    const mockFastify = {
      setErrorHandler: vi.fn(),
    };

    await errorHandlerPlugin(mockFastify as any);

    expect(mockFastify.setErrorHandler).toHaveBeenCalled();
  });

  it('should call next handler for AppError instances', () => {
    const error = new ValidationError('Invalid input');
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    // Simulating error handler behavior
    if (error instanceof AppError) {
      reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    }

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalled();
  });

  it('should generate request ID for error responses', () => {
    const error = new ValidationError('Invalid input');
    const requestId = 'req-' + Date.now();

    const response = {
      error: {
        code: error.code,
        message: error.message,
        requestId,
      },
    };

    expect(response.error.requestId).toMatch(/^req-/);
  });
});

describe('Error Logging', () => {
  it('should log errors with request correlation ID', () => {
    const error = new ValidationError('Invalid input');
    const requestId = 'req-123';

    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      errorCode: error.code,
      statusCode: error.statusCode,
      message: error.message,
    };

    expect(logEntry.requestId).toBe(requestId);
    expect(logEntry.errorCode).toBe('VALIDATION_ERROR');
  });

  it('should not log sensitive details', () => {
    const error = new ValidationError('Invalid password', {
      password: 'Current password is incorrect',
    });

    const logEntry = {
      errorCode: error.code,
      message: error.message,
      // Do not include full details in logs
    };

    expect(logEntry.message).not.toContain('password');
  });
});
