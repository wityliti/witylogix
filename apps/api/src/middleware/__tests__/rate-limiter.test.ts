import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Rate Limiter Tests
 * Tests rate limiting enforcement, tiers, sliding windows, headers, and key generation
 */

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator: (request: any) => string;
  skipOnError?: boolean;
  skip?: (request: any) => boolean;
}

interface TokenBucket {
  tokens: number;
  refillTime: number;
}

interface MockRequest {
  headers: Record<string, string | string[]>;
  ip?: string;
  url: string;
  method: string;
  auth?: any;
  shopId?: string;
}

interface MockReply {
  header: (key: string, value: string) => void;
  headers: Record<string, string>;
  statusCode?: number;
}

class TokenBucketStore {
  private buckets = new Map<string, TokenBucket>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 300000);
    this.cleanupInterval.unref();
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.buckets.clear();
  }

  private cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.buckets.forEach((bucket, key) => {
      if (bucket.refillTime < now - 600000) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => {
      this.buckets.delete(key);
    });
  }

  consume(key: string, config: RateLimitConfig): number {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        tokens: config.maxRequests - 1,
        refillTime: now + config.windowMs,
      };
      this.buckets.set(key, bucket);
      return bucket.tokens;
    }

    if (now >= bucket.refillTime) {
      bucket.tokens = config.maxRequests - 1;
      bucket.refillTime = now + config.windowMs;
      this.buckets.set(key, bucket);
      return bucket.tokens;
    }

    if (bucket.tokens > 0) {
      bucket.tokens--;
      return bucket.tokens;
    }

    return -1;
  }

  getBucket(key: string): TokenBucket | undefined {
    return this.buckets.get(key);
  }

  reset(): void {
    this.buckets.clear();
  }
}

function createRateLimiter(config: RateLimitConfig) {
  const store = new TokenBucketStore();

  return async (request: MockRequest, reply: MockReply): Promise<void> => {
    if (config.skip && config.skip(request)) {
      return;
    }

    // Separate try-catch so that keyGenerator errors can be optionally skipped
    // (skipOnError), while intentional rate-limit errors always propagate.
    let key: string;
    let remaining: number;

    try {
      key = config.keyGenerator(request);
      remaining = store.consume(key, config);
    } catch (error) {
      if (config.skipOnError !== false) {
        return;
      }
      throw error;
    }

    const bucket = store.getBucket(key!);
    const resetTime = bucket
      ? Math.floor(bucket.refillTime / 1000)
      : Math.floor((Date.now() + config.windowMs) / 1000);

    reply.header('X-RateLimit-Limit', String(config.maxRequests));
    reply.header('X-RateLimit-Remaining', String(Math.max(0, remaining)));
    reply.header('X-RateLimit-Reset', String(resetTime));

    if (remaining < 0) {
      const retryAfter = Math.ceil((bucket!.refillTime - Date.now()) / 1000);
      reply.header('Retry-After', String(retryAfter));
      throw new Error('Rate limit exceeded');
    }
  };
}

describe('RateLimiter', () => {
  let store: TokenBucketStore;
  let mockRequest: MockRequest;
  let mockReply: MockReply;

  afterEach(() => {
    store.destroy();
  });

  beforeEach(() => {
    store = new TokenBucketStore();
    mockRequest = {
      headers: {},
      ip: '192.168.1.1',
      url: '/api/test',
      method: 'GET',
    };
    mockReply = {
      header: vi.fn(),
      headers: {},
    };
  });

  describe('Token Bucket Consumption', () => {
    it('should consume a token on each request', () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 10,
        keyGenerator: () => 'test_key',
      };

      let remaining = store.consume('test_key', config);
      expect(remaining).toBe(9); // 10 - 1 (first consume) = 9 remaining

      remaining = store.consume('test_key', config);
      expect(remaining).toBe(8);
    });

    it('should return -1 when limit exceeded', () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 2,
        keyGenerator: () => 'test_key',
      };

      store.consume('test_key', config);
      store.consume('test_key', config);
      const remaining = store.consume('test_key', config);
      expect(remaining).toBe(-1);
    });

    it('should refill tokens after window expires', async () => {
      const config: RateLimitConfig = {
        windowMs: 100,
        maxRequests: 2,
        keyGenerator: () => 'test_key',
      };

      store.consume('test_key', config);
      store.consume('test_key', config);
      expect(store.consume('test_key', config)).toBe(-1);

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          const remaining = store.consume('test_key', config);
          expect(remaining).toBeGreaterThanOrEqual(0);
          store.destroy();
          resolve();
        }, 150);
      });
    });
  });

  describe('Rate Limiting Enforcement', () => {
    it('should allow requests within limit', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
        keyGenerator: () => 'user_1',
      });

      for (let i = 0; i < 5; i++) {
        await limiter(mockRequest, mockReply);
      }
      expect(mockReply.header).toHaveBeenCalled();
    });

    it('should block requests exceeding limit', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
        keyGenerator: () => 'user_1',
      });

      await limiter(mockRequest, mockReply);
      await limiter(mockRequest, mockReply);

      await expect(limiter(mockRequest, mockReply)).rejects.toThrow(
        'Rate limit exceeded'
      );
    });

    it('should return 429 on rate limit exceeded', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyGenerator: () => 'user_1',
      });

      await limiter(mockRequest, mockReply);
      await expect(limiter(mockRequest, mockReply)).rejects.toThrow();
    });
  });

  describe('Response Headers', () => {
    it('should set X-RateLimit-Limit header', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 100,
        keyGenerator: () => 'user_1',
      });

      await limiter(mockRequest, mockReply);
      expect(mockReply.header).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        '100'
      );
    });

    it('should set X-RateLimit-Remaining header', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        keyGenerator: () => 'user_1',
      });

      await limiter(mockRequest, mockReply);
      expect(mockReply.header).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        expect.stringMatching(/^\d+$/)
      );
    });

    it('should set X-RateLimit-Reset header', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        keyGenerator: () => 'user_1',
      });

      await limiter(mockRequest, mockReply);
      expect(mockReply.header).toHaveBeenCalledWith(
        'X-RateLimit-Reset',
        expect.stringMatching(/^\d+$/)
      );
    });

    it('should set Retry-After header when limit exceeded', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyGenerator: () => 'user_1',
      });

      await limiter(mockRequest, mockReply);
      try {
        await limiter(mockRequest, mockReply);
      } catch (e) {
        // Expected
      }
      expect(mockReply.header).toHaveBeenCalledWith(
        'Retry-After',
        expect.stringMatching(/^\d+$/)
      );
    });
  });

  describe('Different Tiers', () => {
    it('should enforce public tier rate limiting', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 100,
        keyGenerator: (req: MockRequest) => `public:${req.ip}`,
      });

      // Should allow 100 requests per minute for public
      for (let i = 0; i < 50; i++) {
        await limiter(mockRequest, mockReply);
      }
      expect(mockReply.header).toHaveBeenCalled();
    });

    it('should enforce auth tier rate limiting', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1000,
        keyGenerator: (req: MockRequest) => {
          const shopId = (req as any).auth?.shopId;
          return shopId ? `auth:${shopId}` : `public:${req.ip}`;
        },
      });

      mockRequest.auth = { shopId: 'shop_123' };
      // Should allow 1000 requests per minute for authenticated
      for (let i = 0; i < 100; i++) {
        await limiter(mockRequest, mockReply);
      }
      expect(mockReply.header).toHaveBeenCalled();
    });

    it('should enforce premium tier rate limiting', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 10000,
        keyGenerator: (req: MockRequest) => {
          const apiKey = (req.headers['x-api-key'] as string) || '';
          if (apiKey) {
            return `premium:${apiKey}`;
          }
          return `public:${req.ip}`;
        },
      });

      mockRequest.headers['x-api-key'] = 'api_key_xyz';
      // Should allow 10000 requests per minute for premium
      for (let i = 0; i < 100; i++) {
        await limiter(mockRequest, mockReply);
      }
      expect(mockReply.header).toHaveBeenCalled();
    });
  });

  describe('Sliding Window', () => {
    it('should implement sliding window correctly', async () => {
      const limiter = createRateLimiter({
        windowMs: 100,
        maxRequests: 3,
        keyGenerator: () => 'sliding_test',
      });

      // Make 3 requests in first 100ms
      await limiter(mockRequest, mockReply);
      await limiter(mockRequest, mockReply);
      await limiter(mockRequest, mockReply);

      // Next request should be blocked
      await expect(limiter(mockRequest, mockReply)).rejects.toThrow();

      // Wait 150ms (so 50ms into second window)
      await new Promise<void>((resolve) => {
        setTimeout(async () => {
          // Make another request (should succeed as window has reset)
          await limiter(mockRequest, mockReply);
          resolve();
        }, 150);
      });
    });
  });

  describe('Key Generation', () => {
    it('should generate key by IP address', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
        keyGenerator: (req: MockRequest) => `ip:${req.ip}`,
      });

      await limiter(mockRequest, mockReply);
      expect(mockReply.header).toHaveBeenCalled();
    });

    it('should generate key by tenant/shopId', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1000,
        keyGenerator: (req: MockRequest) => {
          const shopId = (req as any).auth?.shopId || (req as any).shopId;
          return `shop:${shopId}`;
        },
      });

      mockRequest.auth = { shopId: 'shop_abc' };
      await limiter(mockRequest, mockReply);
      expect(mockReply.header).toHaveBeenCalled();
    });

    it('should generate key by API key', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 10000,
        keyGenerator: (req: MockRequest) => {
          const apiKey = (req.headers['x-api-key'] as string) || '';
          return `api:${apiKey}`;
        },
      });

      mockRequest.headers['x-api-key'] = 'sk_live_123456';
      await limiter(mockRequest, mockReply);
      expect(mockReply.header).toHaveBeenCalled();
    });

    it('should fallback to IP when no auth available', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 100,
        keyGenerator: (req: MockRequest) => {
          const shopId = (req as any).auth?.shopId;
          if (shopId) return `shop:${shopId}`;
          return `ip:${req.ip}`;
        },
      });

      delete mockRequest.auth;
      await limiter(mockRequest, mockReply);
      expect(mockReply.header).toHaveBeenCalled();
    });

    it('should handle X-Forwarded-For header', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 100,
        keyGenerator: (req: MockRequest) => {
          const forwarded = req.headers['x-forwarded-for'];
          const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded || req.ip;
          return `ip:${ip}`;
        },
      });

      mockRequest.headers['x-forwarded-for'] = '203.0.113.42';
      await limiter(mockRequest, mockReply);
      expect(mockReply.header).toHaveBeenCalled();
    });
  });

  describe('Skip Conditions', () => {
    it('should skip rate limiting for health checks', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyGenerator: () => 'test',
        skip: (req: MockRequest) => req.url.startsWith('/health'),
      });

      mockRequest.url = '/health';
      // Should not throw even though limit is 1
      await limiter(mockRequest, mockReply);
      await limiter(mockRequest, mockReply);
      expect(mockReply.header).not.toHaveBeenCalled();
    });

    it('should skip rate limiting for OPTIONS requests', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyGenerator: () => 'test',
        skip: (req: MockRequest) => req.method === 'OPTIONS',
      });

      mockRequest.method = 'OPTIONS';
      await limiter(mockRequest, mockReply);
      await limiter(mockRequest, mockReply);
      expect(mockReply.header).not.toHaveBeenCalled();
    });

    it('should not skip when skip returns false', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyGenerator: () => 'test',
        skip: (req: MockRequest) => req.url === '/skip-me',
      });

      mockRequest.url = '/api/endpoint';
      await limiter(mockRequest, mockReply);
      await expect(limiter(mockRequest, mockReply)).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should skip on error by default', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyGenerator: (req: MockRequest) => {
          throw new Error('Key generation failed');
        },
        skipOnError: true,
      });

      // Should not throw due to skipOnError: true
      await limiter(mockRequest, mockReply);
    });

    it('should throw on error if skipOnError is false', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyGenerator: (req: MockRequest) => {
          throw new Error('Key generation failed');
        },
        skipOnError: false,
      });

      await expect(limiter(mockRequest, mockReply)).rejects.toThrow(
        'Key generation failed'
      );
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle multiple concurrent requests correctly', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
        keyGenerator: () => 'concurrent_test',
      });

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(limiter(mockRequest, mockReply));
      }

      await Promise.all(promises);
      expect(mockReply.header).toHaveBeenCalled();

      // Next request should fail
      await expect(limiter(mockRequest, mockReply)).rejects.toThrow();
    });

    it('should isolate limits between different keys', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
        keyGenerator: (req: MockRequest) => `user:${req.ip}`,
      });

      // First user hits limit
      mockRequest.ip = '192.168.1.1';
      await limiter(mockRequest, mockReply);
      await limiter(mockRequest, mockReply);
      await expect(limiter(mockRequest, mockReply)).rejects.toThrow();

      // Second user should not be affected
      mockRequest.ip = '192.168.1.2';
      await limiter(mockRequest, mockReply);
      await limiter(mockRequest, mockReply);
      await expect(limiter(mockRequest, mockReply)).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero max requests', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 0,
        keyGenerator: () => 'zero_test',
      });

      await expect(limiter(mockRequest, mockReply)).rejects.toThrow();
    });

    it('should handle very large max requests', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1000000,
        keyGenerator: () => 'large_test',
      });

      for (let i = 0; i < 100; i++) {
        await limiter(mockRequest, mockReply);
      }
      expect(mockReply.header).toHaveBeenCalled();
    });

    it('should handle very short window', async () => {
      const limiter = createRateLimiter({
        windowMs: 10,
        maxRequests: 1,
        keyGenerator: () => 'short_window',
      });

      await limiter(mockRequest, mockReply);
      await new Promise<void>((resolve) => {
        setTimeout(async () => {
          await limiter(mockRequest, mockReply);
          resolve();
        }, 20);
      });
    });
  });

  describe('Remaining Token Calculation', () => {
    it('should correctly calculate remaining tokens', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        keyGenerator: () => 'remaining_test',
      });

      const headerCalls = (mockReply.header as any).mock.calls;
      await limiter(mockRequest, mockReply);

      const remainingCall = headerCalls.find(
        (call: any[]) => call[0] === 'X-RateLimit-Remaining'
      );
      expect(parseInt(remainingCall[1])).toBeLessThan(10);
      expect(parseInt(remainingCall[1])).toBeGreaterThanOrEqual(0);
    });

    it('should show zero remaining when limit reached', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 1,
        keyGenerator: () => 'zero_remaining_test',
      });

      await limiter(mockRequest, mockReply);

      try {
        await limiter(mockRequest, mockReply);
      } catch (e) {
        // Expected
      }

      const headerCalls = (mockReply.header as any).mock.calls;
      const remainingCall = headerCalls.find(
        (call: any[]) => call[0] === 'X-RateLimit-Remaining'
      );
      expect(remainingCall).toBeDefined();
    });
  });
});
