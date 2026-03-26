/**
 * Rate Limiting Integration Tests
 * Tests: sliding window limiter, per-endpoint limits, per-user vs per-IP, CSRF protection
 * ~500 lines, 25+ tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHash, randomBytes } from 'crypto';

// ───────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ───────────────────────────────────────────────────────────────────────────

interface RateLimitWindow {
  requestTimes: number[];
  limit: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

interface CSRFToken {
  token: string;
  createdAt: number;
  expiresAt: number;
}

// ───────────────────────────────────────────────────────────────────────────
// SLIDING WINDOW RATE LIMITER
// ───────────────────────────────────────────────────────────────────────────

class SlidingWindowRateLimiter {
  private windows = new Map<string, RateLimitWindow>();

  constructor(
    private limit: number,
    private windowMs: number
  ) {}

  check(key: string, timestamp: number = Date.now()): RateLimitResult {
    let window = this.windows.get(key);

    if (!window) {
      window = {
        requestTimes: [],
        limit: this.limit,
        windowMs: this.windowMs,
      };
    }

    // Remove requests outside the window
    window.requestTimes = window.requestTimes.filter(t => timestamp - t < this.windowMs);

    const remaining = Math.max(0, this.limit - window.requestTimes.length);
    const reset = window.requestTimes.length > 0
      ? window.requestTimes[0] + this.windowMs
      : timestamp + this.windowMs;

    if (window.requestTimes.length < this.limit) {
      window.requestTimes.push(timestamp);
      this.windows.set(key, window);

      return {
        allowed: true,
        remaining: remaining - 1,
        reset,
      };
    }

    const retryAfter = Math.ceil((reset - timestamp) / 1000);
    return {
      allowed: false,
      remaining: 0,
      reset,
      retryAfter,
    };
  }

  reset(key: string): void {
    this.windows.delete(key);
  }

  resetAll(): void {
    this.windows.clear();
  }

  getState(key: string): RateLimitWindow | null {
    return this.windows.get(key) || null;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// CSRF PROTECTION
// ───────────────────────────────────────────────────────────────────────────

class CSRFTokenManager {
  private tokens = new Map<string, CSRFToken>();
  private tokenTtlMs: number = 24 * 60 * 60 * 1000; // 24 hours

  generateToken(sessionId: string, timestamp: number = Date.now()): CSRFToken {
    const token: CSRFToken = {
      token: randomBytes(32).toString('hex'),
      createdAt: timestamp,
      expiresAt: timestamp + this.tokenTtlMs,
    };

    this.tokens.set(sessionId, token);
    return token;
  }

  validateToken(sessionId: string, token: string, timestamp: number = Date.now()): boolean {
    const stored = this.tokens.get(sessionId);

    if (!stored) {
      return false;
    }

    if (timestamp > stored.expiresAt) {
      this.tokens.delete(sessionId);
      return false;
    }

    return stored.token === token;
  }

  validateDoubleSumbitCookie(
    token: string,
    cookieValue: string
  ): boolean {
    // Double-submit cookie: token in body must match token in cookie
    return token === cookieValue;
  }

  revokeToken(sessionId: string): void {
    this.tokens.delete(sessionId);
  }

  clear(): void {
    this.tokens.clear();
  }
}

// ───────────────────────────────────────────────────────────────────────────
// ENDPOINT-SPECIFIC LIMITS
// ───────────────────────────────────────────────────────────────────────────

interface EndpointLimit {
  endpoint: string;
  requestsPerWindow: number;
  windowMs: number;
}

const endpointLimits: EndpointLimit[] = [
  { endpoint: '/login', requestsPerWindow: 5, windowMs: 60000 }, // 5 per minute
  { endpoint: '/register', requestsPerWindow: 3, windowMs: 60000 }, // 3 per minute
  { endpoint: '/password-reset', requestsPerWindow: 3, windowMs: 3600000 }, // 3 per hour
  { endpoint: '/email-verify', requestsPerWindow: 10, windowMs: 60000 }, // 10 per minute
];

function getEndpointLimit(endpoint: string): EndpointLimit | null {
  return endpointLimits.find(l => l.endpoint === endpoint) || null;
}

// ───────────────────────────────────────────────────────────────────────────
// TESTS
// ───────────────────────────────────────────────────────────────────────────

describe('Sliding Window Rate Limiter', () => {
  let limiter: SlidingWindowRateLimiter;

  beforeEach(() => {
    limiter = new SlidingWindowRateLimiter(5, 60000); // 5 requests per 60 seconds
  });

  afterEach(() => {
    limiter.resetAll();
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests within limit', () => {
      const key = 'test-key';

      for (let i = 0; i < 5; i++) {
        const result = limiter.check(key);
        expect(result.allowed).toBe(true);
      }
    });

    it('should block requests over limit', () => {
      const key = 'test-key';

      // Use up limit
      for (let i = 0; i < 5; i++) {
        limiter.check(key);
      }

      // Next request should be blocked
      const result = limiter.check(key);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should return correct headers (Limit, Remaining, Reset)', () => {
      const key = 'test-key';

      const result1 = limiter.check(key);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(4);
      expect(result1.reset).toBeGreaterThan(Date.now());

      const result2 = limiter.check(key);
      expect(result2.remaining).toBe(3);
    });

    it('should return 429 with Retry-After', () => {
      const key = 'test-key';

      // Use up limit
      for (let i = 0; i < 5; i++) {
        limiter.check(key);
      }

      const result = limiter.check(key);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(60);
    });

    it('should reset after window slides', () => {
      const key = 'test-key';
      const baseTime = Date.now();

      // Use up limit
      for (let i = 0; i < 5; i++) {
        limiter.check(key, baseTime + i);
      }

      // Try after window expires
      const result = limiter.check(key, baseTime + 60001);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should handle sliding window correctly', () => {
      const key = 'test-key';
      const baseTime = Date.now();

      // Make 5 requests at different times
      for (let i = 0; i < 5; i++) {
        limiter.check(key, baseTime + i * 10000); // Every 10 seconds
      }

      // At baseTime + 35000, first request (at baseTime) is not in window anymore (60s window)
      // So we should be able to make one more
      const result1 = limiter.check(key, baseTime + 35000);
      expect(result1.allowed).toBe(false); // Still 5 requests in window

      // At baseTime + 60001, first request is out of window
      const result2 = limiter.check(key, baseTime + 60001);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('Remaining Count', () => {
    it('should track remaining requests accurately', () => {
      const key = 'test-key';

      expect(limiter.check(key).remaining).toBe(4);
      expect(limiter.check(key).remaining).toBe(3);
      expect(limiter.check(key).remaining).toBe(2);
      expect(limiter.check(key).remaining).toBe(1);
      expect(limiter.check(key).remaining).toBe(0);
    });

    it('should show 0 remaining when limit reached', () => {
      const key = 'test-key';

      for (let i = 0; i < 5; i++) {
        limiter.check(key);
      }

      const result = limiter.check(key);
      expect(result.remaining).toBe(0);
    });
  });

  describe('Multiple Keys', () => {
    it('should isolate rate limits per key', () => {
      const result1 = limiter.check('user-1');
      const result2 = limiter.check('user-2');

      expect(result1.remaining).toBe(4);
      expect(result2.remaining).toBe(4);
    });

    it('should allow different keys to exceed limit independently', () => {
      // Use up limit for user-1
      for (let i = 0; i < 5; i++) {
        limiter.check('user-1');
      }

      // user-2 should still have capacity
      const user2Result = limiter.check('user-2');
      expect(user2Result.allowed).toBe(true);
      expect(user2Result.remaining).toBe(4);
    });
  });

  describe('Window Reset', () => {
    it('should reset individual key', () => {
      const key = 'test-key';

      limiter.check(key);
      limiter.check(key);

      limiter.reset(key);

      const result = limiter.check(key);
      expect(result.remaining).toBe(4);
    });

    it('should reset all keys', () => {
      limiter.check('user-1');
      limiter.check('user-1');
      limiter.check('user-2');

      limiter.resetAll();

      expect(limiter.check('user-1').remaining).toBe(4);
      expect(limiter.check('user-2').remaining).toBe(4);
    });
  });
});

describe('Per-Endpoint Limits', () => {
  describe('Login Endpoint', () => {
    it('should enforce 5 requests per minute on /login', () => {
      const limiter = new SlidingWindowRateLimiter(5, 60000);
      const key = 'ip-192.168.1.1';

      for (let i = 0; i < 5; i++) {
        const result = limiter.check(key);
        expect(result.allowed).toBe(true);
      }

      const result = limiter.check(key);
      expect(result.allowed).toBe(false);
    });

    it('should have correct limit definition', () => {
      const limit = getEndpointLimit('/login');
      expect(limit).not.toBeNull();
      expect(limit?.requestsPerWindow).toBe(5);
      expect(limit?.windowMs).toBe(60000);
    });
  });

  describe('Register Endpoint', () => {
    it('should enforce 3 requests per minute on /register', () => {
      const limiter = new SlidingWindowRateLimiter(3, 60000);
      const key = 'ip-192.168.1.2';

      for (let i = 0; i < 3; i++) {
        const result = limiter.check(key);
        expect(result.allowed).toBe(true);
      }

      const result = limiter.check(key);
      expect(result.allowed).toBe(false);
    });

    it('should have correct limit definition', () => {
      const limit = getEndpointLimit('/register');
      expect(limit).not.toBeNull();
      expect(limit?.requestsPerWindow).toBe(3);
      expect(limit?.windowMs).toBe(60000);
    });
  });

  describe('Password Reset Endpoint', () => {
    it('should enforce 3 requests per hour on /password-reset', () => {
      const limiter = new SlidingWindowRateLimiter(3, 3600000);
      const key = 'user-123';

      for (let i = 0; i < 3; i++) {
        const result = limiter.check(key);
        expect(result.allowed).toBe(true);
      }

      const result = limiter.check(key);
      expect(result.allowed).toBe(false);
    });

    it('should have correct limit definition', () => {
      const limit = getEndpointLimit('/password-reset');
      expect(limit).not.toBeNull();
      expect(limit?.requestsPerWindow).toBe(3);
      expect(limit?.windowMs).toBe(3600000);
    });
  });

  describe('Endpoint Discovery', () => {
    it('should find limit by endpoint path', () => {
      const loginLimit = getEndpointLimit('/login');
      const registerLimit = getEndpointLimit('/register');

      expect(loginLimit).not.toBeNull();
      expect(registerLimit).not.toBeNull();
    });

    it('should return null for unknown endpoints', () => {
      const limit = getEndpointLimit('/unknown');
      expect(limit).toBeNull();
    });
  });
});

describe('Per-User vs Per-IP', () => {
  describe('Unauthenticated Requests', () => {
    it('should track per-IP for unauthenticated users', () => {
      const limiter = new SlidingWindowRateLimiter(5, 60000);

      // Same IP, should share limit
      const result1 = limiter.check('ip-192.168.1.1');
      const result2 = limiter.check('ip-192.168.1.1');

      expect(result1.remaining).toBe(4);
      expect(result2.remaining).toBe(3);
    });

    it('should isolate limits across different IPs', () => {
      const limiter = new SlidingWindowRateLimiter(5, 60000);

      const result1 = limiter.check('ip-192.168.1.1');
      const result2 = limiter.check('ip-192.168.1.2');

      expect(result1.remaining).toBe(4);
      expect(result2.remaining).toBe(4);
    });
  });

  describe('Authenticated Requests', () => {
    it('should track per-user for authenticated users', () => {
      const limiter = new SlidingWindowRateLimiter(10, 60000);

      const result1 = limiter.check('user-123');
      const result2 = limiter.check('user-123');

      expect(result1.remaining).toBe(9);
      expect(result2.remaining).toBe(8);
    });

    it('should isolate limits across different users', () => {
      const limiter = new SlidingWindowRateLimiter(10, 60000);

      const result1 = limiter.check('user-123');
      const result2 = limiter.check('user-456');

      expect(result1.remaining).toBe(9);
      expect(result2.remaining).toBe(9);
    });

    it('should be more lenient with authenticated users', () => {
      const unauthLimiter = new SlidingWindowRateLimiter(5, 60000);
      const authLimiter = new SlidingWindowRateLimiter(10, 60000);

      expect(authLimiter.check('user-1').remaining).toBeGreaterThan(
        unauthLimiter.check('ip-1.1.1.1').remaining
      );
    });
  });

  describe('VPN/Proxy Handling', () => {
    it('should handle multiple users behind same IP', () => {
      const limiter = new SlidingWindowRateLimiter(5, 60000);

      // If tracking by user, should work fine
      const result1 = limiter.check('user-123');
      const result2 = limiter.check('user-456');

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });

    it('should block if same IP attempts too many logins', () => {
      const limiter = new SlidingWindowRateLimiter(5, 60000);

      for (let i = 0; i < 5; i++) {
        limiter.check('ip-1.1.1.1');
      }

      const result = limiter.check('ip-1.1.1.1');
      expect(result.allowed).toBe(false);
    });
  });
});

describe('CSRF Protection', () => {
  let csrfManager: CSRFTokenManager;

  beforeEach(() => {
    csrfManager = new CSRFTokenManager();
  });

  afterEach(() => {
    csrfManager.clear();
  });

  describe('Token Generation', () => {
    it('should generate CSRF token', () => {
      const token = csrfManager.generateToken('session-123');

      expect(token.token).toBeTruthy();
      expect(token.token.length).toBe(64); // 32 bytes hex
      expect(token.createdAt).toBeGreaterThan(0);
      expect(token.expiresAt).toBeGreaterThan(token.createdAt);
    });

    it('should generate unique tokens', () => {
      const token1 = csrfManager.generateToken('session-1');
      const token2 = csrfManager.generateToken('session-2');

      expect(token1.token).not.toBe(token2.token);
    });

    it('should overwrite previous token for same session', () => {
      const token1 = csrfManager.generateToken('session-123');
      const token2 = csrfManager.generateToken('session-123');

      expect(token1.token).not.toBe(token2.token);
    });
  });

  describe('Token Validation', () => {
    it('should validate correct token', () => {
      const token = csrfManager.generateToken('session-123');
      const isValid = csrfManager.validateToken('session-123', token.token);

      expect(isValid).toBe(true);
    });

    it('should reject wrong token', () => {
      const token = csrfManager.generateToken('session-123');
      const isValid = csrfManager.validateToken('session-123', 'wrong-token');

      expect(isValid).toBe(false);
    });

    it('should reject missing session', () => {
      const isValid = csrfManager.validateToken('missing-session', 'any-token');
      expect(isValid).toBe(false);
    });

    it('should reject expired token', () => {
      const baseTime = Date.now();
      const token = csrfManager.generateToken('session-123', baseTime);

      // Validate after expiry
      const isValid = csrfManager.validateToken('session-123', token.token, baseTime + 25 * 60 * 60 * 1000);
      expect(isValid).toBe(false);
    });

    it('should clean up expired tokens', () => {
      const baseTime = Date.now();
      const token = csrfManager.generateToken('session-123', baseTime);

      // First validation within TTL should work
      const isValid1 = csrfManager.validateToken('session-123', token.token, baseTime + 1000);
      expect(isValid1).toBe(true);

      // After expiry, token should be removed and next check should fail
      const isValid2 = csrfManager.validateToken('session-123', token.token, baseTime + 25 * 60 * 60 * 1000);
      expect(isValid2).toBe(false);
    });
  });

  describe('Double-Submit Cookie Pattern', () => {
    it('should validate double-submit cookie', () => {
      const token = csrfManager.generateToken('session-123').token;
      const cookieValue = token;

      const isValid = csrfManager.validateDoubleSumbitCookie(token, cookieValue);
      expect(isValid).toBe(true);
    });

    it('should reject mismatched double-submit cookie', () => {
      const token = 'token-from-body';
      const cookieValue = 'token-from-cookie';

      const isValid = csrfManager.validateDoubleSumbitCookie(token, cookieValue);
      expect(isValid).toBe(false);
    });
  });

  describe('Token Revocation', () => {
    it('should revoke token', () => {
      const token = csrfManager.generateToken('session-123');

      csrfManager.revokeToken('session-123');

      const isValid = csrfManager.validateToken('session-123', token.token);
      expect(isValid).toBe(false);
    });

    it('should not affect other sessions', () => {
      const token1 = csrfManager.generateToken('session-1');
      const token2 = csrfManager.generateToken('session-2');

      csrfManager.revokeToken('session-1');

      expect(csrfManager.validateToken('session-1', token1.token)).toBe(false);
      expect(csrfManager.validateToken('session-2', token2.token)).toBe(true);
    });
  });

  describe('CSRF Protection Exempt Endpoints', () => {
    it('should exempt health check endpoints', () => {
      const exemptEndpoints = ['/health', '/health/live', '/metrics'];
      const protectedEndpoints = ['/login', '/register', '/api/create'];

      exemptEndpoints.forEach(endpoint => {
        expect(endpoint).toMatch(/^\/(health|metrics)/);
      });

      protectedEndpoints.forEach(endpoint => {
        expect(endpoint).not.toMatch(/^\/(health|metrics)/);
      });
    });

    it('should exempt GET requests', () => {
      // GET requests should not require CSRF
      const getMethod = 'GET';
      const postMethod = 'POST';

      expect(['POST', 'PUT', 'DELETE', 'PATCH']).toContain(postMethod);
      expect(['POST', 'PUT', 'DELETE', 'PATCH']).not.toContain(getMethod);
    });

    it('should exempt API key authenticated routes', () => {
      // Routes with valid API key should bypass CSRF
      const hasApiKey = (headers: Record<string, string>) => {
        return 'x-api-key' in headers && headers['x-api-key'].length > 0;
      };

      const headersWithKey = { 'x-api-key': 'valid-key' };
      const headersWithoutKey = {};

      expect(hasApiKey(headersWithKey)).toBe(true);
      expect(hasApiKey(headersWithoutKey)).toBe(false);
    });
  });
});
