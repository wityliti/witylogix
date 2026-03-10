/**
 * Tests for Error Classes
 */

import { describe, it, expect } from 'vitest';
import {
  ApiError,
  AuthError,
  NotFoundError,
  RateLimitError,
  BadRequestError,
  ServerError,
  NetworkError,
  ConfigError,
} from '../src/errors';

describe('Error Classes', () => {
  describe('ApiError', () => {
    it('should have correct name', () => {
      const error = new ApiError('Test error', { status: 400, code: 'TEST_ERROR' });
      expect(error.name).toBe('ApiError');
    });

    it('should include status and code', () => {
      const error = new ApiError('Test error', { status: 400, code: 'TEST_ERROR' });
      expect(error.status).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
    });

    it('should include message', () => {
      const error = new ApiError('Test error message', { status: 400, code: 'TEST_ERROR' });
      expect(error.message).toBe('Test error message');
    });

    it('should include details if provided', () => {
      const details = { field: 'email', reason: 'Invalid email' };
      const error = new ApiError('Test error', { status: 400, code: 'VALIDATION_ERROR', details });
      expect(error.details).toEqual(details);
    });

    it('should use default code if not provided', () => {
      const error = new ApiError('Test error', { status: 400 });
      expect(error.code).toBe('UNKNOWN_ERROR');
    });

    it('should serialize to JSON correctly', () => {
      const error = new ApiError('Test error', { status: 400, code: 'TEST_ERROR' });
      const json = error.toJSON();
      expect(json.code).toBe('TEST_ERROR');
      expect(json.message).toBe('Test error');
    });

    it('should create AuthError from 401 response', () => {
      const error = ApiError.fromResponse(401, { code: 'UNAUTHORIZED', message: 'Invalid key' });
      expect(error).toBeInstanceOf(AuthError);
      expect(error.name).toBe('AuthError');
    });

    it('should create AuthError from 403 response', () => {
      const error = ApiError.fromResponse(403, { code: 'FORBIDDEN', message: 'Access denied' });
      expect(error).toBeInstanceOf(AuthError);
      expect(error.name).toBe('AuthError');
    });

    it('should create NotFoundError from 404 response', () => {
      const error = ApiError.fromResponse(404, { code: 'NOT_FOUND', message: 'Not found' });
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.name).toBe('NotFoundError');
    });

    it('should create RateLimitError from 429 response', () => {
      const error = ApiError.fromResponse(429, { code: 'RATE_LIMITED', message: 'Too many requests' });
      expect(error).toBeInstanceOf(RateLimitError);
      expect(error.name).toBe('RateLimitError');
    });

    it('should create BadRequestError from 4xx response', () => {
      const error = ApiError.fromResponse(400, { code: 'BAD_REQUEST', message: 'Invalid input' });
      expect(error).toBeInstanceOf(BadRequestError);
      expect(error.name).toBe('BadRequestError');
    });

    it('should create ServerError from 5xx response', () => {
      const error = ApiError.fromResponse(500, { code: 'SERVER_ERROR', message: 'Internal error' });
      expect(error).toBeInstanceOf(ServerError);
      expect(error.name).toBe('ServerError');
    });

    it('should parse response body correctly', () => {
      const error = ApiError.fromResponse(400, {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: { field: 'email' },
      });
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Validation failed');
      expect(error.details).toEqual({ field: 'email' });
    });

    it('should use default message if not in response body', () => {
      const error = ApiError.fromResponse(400, {});
      expect(error.message).toBe('HTTP 400');
    });

    it('should use default code if not in response body', () => {
      const error = ApiError.fromResponse(400, {});
      expect(error.code).toBe('HTTP_400');
    });
  });

  describe('AuthError', () => {
    it('should have correct name', () => {
      const error = new AuthError('Unauthorized', { status: 401 });
      expect(error.name).toBe('AuthError');
    });

    it('should inherit from ApiError', () => {
      const error = new AuthError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' });
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(401);
    });
  });

  describe('NotFoundError', () => {
    it('should have correct name', () => {
      const error = new NotFoundError('Not found', { status: 404 });
      expect(error.name).toBe('NotFoundError');
    });

    it('should inherit from ApiError', () => {
      const error = new NotFoundError('Not found', { status: 404, code: 'NOT_FOUND' });
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(404);
    });
  });

  describe('RateLimitError', () => {
    it('should have correct name', () => {
      const error = new RateLimitError('Rate limited', { status: 429 });
      expect(error.name).toBe('RateLimitError');
    });

    it('should inherit from ApiError', () => {
      const error = new RateLimitError('Rate limited', { status: 429, code: 'RATE_LIMITED' });
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(429);
    });

    it('should include retryAfter property', () => {
      const error = new RateLimitError('Rate limited', { status: 429, retryAfter: 5000 });
      expect(error.retryAfter).toBe(5000);
    });

    it('should default to 429 status', () => {
      const error = new RateLimitError('Rate limited');
      expect(error.status).toBe(429);
    });
  });

  describe('BadRequestError', () => {
    it('should have correct name', () => {
      const error = new BadRequestError('Bad request', { status: 400 });
      expect(error.name).toBe('BadRequestError');
    });

    it('should inherit from ApiError', () => {
      const error = new BadRequestError('Bad request', { status: 400, code: 'BAD_REQUEST' });
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(400);
    });

    it('should work with validation error details', () => {
      const details = { email: ['Invalid email format'], name: ['Required field'] };
      const error = new BadRequestError('Validation failed', {
        status: 400,
        code: 'VALIDATION_ERROR',
        details,
      });
      expect(error.details).toEqual(details);
    });
  });

  describe('ServerError', () => {
    it('should have correct name', () => {
      const error = new ServerError('Server error', { status: 500 });
      expect(error.name).toBe('ServerError');
    });

    it('should inherit from ApiError', () => {
      const error = new ServerError('Server error', { status: 500, code: 'SERVER_ERROR' });
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(500);
    });

    it('should work with 503 status', () => {
      const error = new ServerError('Service unavailable', { status: 503, code: 'SERVICE_UNAVAILABLE' });
      expect(error.status).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('NetworkError', () => {
    it('should have correct name', () => {
      const error = new NetworkError('Network timeout');
      expect(error.name).toBe('NetworkError');
    });

    it('should not inherit from ApiError', () => {
      const error = new NetworkError('Network timeout');
      expect(error).not.toBeInstanceOf(ApiError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should include message', () => {
      const error = new NetworkError('Failed to fetch');
      expect(error.message).toBe('Failed to fetch');
    });

    it('should work with timeout errors', () => {
      const error = new NetworkError('Request timeout after 30000ms');
      expect(error.message).toContain('timeout');
    });
  });

  describe('ConfigError', () => {
    it('should have correct name', () => {
      const error = new ConfigError('Invalid configuration');
      expect(error.name).toBe('ConfigError');
    });

    it('should not inherit from ApiError', () => {
      const error = new ConfigError('Invalid configuration');
      expect(error).not.toBeInstanceOf(ApiError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should include message', () => {
      const error = new ConfigError('baseUrl is required');
      expect(error.message).toBe('baseUrl is required');
    });
  });

  describe('error instanceof checks', () => {
    it('should correctly identify error types', () => {
      const apiError = new ApiError('Error', { status: 500 });
      const authError = new AuthError('Unauthorized', { status: 401 });
      const networkError = new NetworkError('Network failed');

      expect(apiError instanceof ApiError).toBe(true);
      expect(authError instanceof ApiError).toBe(true);
      expect(authError instanceof AuthError).toBe(true);
      expect(networkError instanceof ApiError).toBe(false);
      expect(networkError instanceof NetworkError).toBe(true);
    });
  });

  describe('error response parsing edge cases', () => {
    it('should handle response with only message', () => {
      const error = ApiError.fromResponse(400, { message: 'Bad request' });
      expect(error.message).toBe('Bad request');
      expect(error.code).toBe('HTTP_400');
    });

    it('should handle response with only code', () => {
      const error = ApiError.fromResponse(400, { code: 'CUSTOM_ERROR' });
      expect(error.code).toBe('CUSTOM_ERROR');
      expect(error.message).toBe('HTTP 400');
    });

    it('should handle empty response body', () => {
      const error = ApiError.fromResponse(500, {});
      expect(error.message).toBe('HTTP 500');
      expect(error.code).toBe('HTTP_500');
    });

    it('should handle complex nested details', () => {
      const details = {
        form: {
          email: ['Invalid format'],
          password: ['Too short'],
        },
        meta: {
          timestamp: '2024-03-10T12:00:00Z',
        },
      };
      const error = ApiError.fromResponse(400, {
        code: 'VALIDATION_ERROR',
        message: 'Form validation failed',
        details,
      });
      expect(error.details).toEqual(details);
    });
  });
});
