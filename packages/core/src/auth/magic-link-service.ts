/**
 * Magic Link Service
 *
 * Handles password-less authentication via magic links.
 * Generates secure tokens and validates them with time-based expiry.
 */

import { randomBytes } from "crypto";
import { EventEmitter } from "events";

export interface MagicLinkToken {
  token: string;
  email: string;
  expiresAt: number;
  used: boolean;
  createdAt: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface MagicLinkConfig {
  expiryMs: number; // Default: 15 minutes
  maxRequests: number; // Default: 5 per hour
  windowMs: number; // Default: 1 hour
}

class MagicLinkService extends EventEmitter {
  private tokens: Map<string, MagicLinkToken> = new Map();
  private rateLimits: Map<string, number[]> = new Map();
  private config: MagicLinkConfig = {
    expiryMs: 900000, // 15 minutes
    maxRequests: 5,
    windowMs: 3600000, // 1 hour
  };

  constructor(config?: Partial<MagicLinkConfig>) {
    super();
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.setupCleanup();
  }

  /**
   * Generate a magic link token
   * @param email User email address
   * @param ipAddress Optional IP address for tracking
   * @param userAgent Optional user agent for tracking
   * @returns Generated token and expiry time
   */
  generateToken(email: string, ipAddress?: string, userAgent?: string): string {
    const tokenBytes = randomBytes(32);
    const token = tokenBytes.toString("base64url");

    const magicLinkToken: MagicLinkToken = {
      token,
      email,
      expiresAt: Date.now() + this.config.expiryMs,
      used: false,
      createdAt: Date.now(),
      ipAddress,
      userAgent,
    };

    this.tokens.set(token, magicLinkToken);
    this.emit("token-generated", {
      email,
      token,
      expiresAt: magicLinkToken.expiresAt,
    });

    return token;
  }

  /**
   * Generate a magic link URL
   * @param email User email address
   * @param baseUrl Base URL for the magic link
   * @param ipAddress Optional IP address for tracking
   * @param userAgent Optional user agent for tracking
   * @returns Full magic link URL or error
   */
  generateMagicLink(
    email: string,
    baseUrl: string = "http://localhost:3000",
    ipAddress?: string,
    userAgent?: string,
  ): {
    success: boolean;
    link?: string;
    token?: string;
    error?: string;
    retryAfter?: number;
  } {
    // Check rate limit
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    let emailRequests = this.rateLimits.get(email) || [];
    emailRequests = emailRequests.filter(
      (timestamp) => timestamp > windowStart,
    );

    if (emailRequests.length >= this.config.maxRequests) {
      const retryAfter = Math.ceil(
        (Math.min(...emailRequests) + this.config.windowMs - now) / 1000,
      );
      return {
        success: false,
        error: `Too many magic link requests. Please try again in ${retryAfter} seconds.`,
        retryAfter,
      };
    }

    // Record this request
    emailRequests.push(now);
    this.rateLimits.set(email, emailRequests);

    // Generate token
    const token = this.generateToken(email, ipAddress, userAgent);

    // Build magic link URL
    const url = new URL(baseUrl);
    url.pathname = "/magic-link";
    url.searchParams.set("token", token);

    return {
      success: true,
      link: url.toString(),
      token,
    };
  }

  /**
   * Validate a magic link token
   * @param token Token to validate
   * @returns Validation result with email if valid
   */
  validateMagicLink(token: string): {
    valid: boolean;
    email?: string;
    error?: string;
  } {
    const magicLink = this.tokens.get(token);

    if (!magicLink) {
      return {
        valid: false,
        error: "Invalid magic link. Please request a new one.",
      };
    }

    if (magicLink.used) {
      return {
        valid: false,
        error: "This magic link has already been used.",
      };
    }

    if (Date.now() > magicLink.expiresAt) {
      this.tokens.delete(token);
      return {
        valid: false,
        error: "This magic link has expired. Please request a new one.",
      };
    }

    return {
      valid: true,
      email: magicLink.email,
    };
  }

  /**
   * Consume a magic link token and authenticate the user
   * @param token Token to consume
   * @returns Authentication result
   */
  consumeMagicLink(token: string): {
    success: boolean;
    email?: string;
    error?: string;
  } {
    const validation = this.validateMagicLink(token);

    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    const magicLink = this.tokens.get(token)!;
    magicLink.used = true;

    this.emit("link-consumed", {
      email: magicLink.email,
      token,
      timestamp: Date.now(),
    });

    return {
      success: true,
      email: magicLink.email,
    };
  }

  /**
   * Get token info (for debugging/testing)
   * @param token Magic link token
   * @returns Token information if exists
   */
  getTokenInfo(token: string): MagicLinkToken | null {
    return this.tokens.get(token) || null;
  }

  /**
   * Delete token (for cleanup)
   * @param token Token to delete
   */
  deleteToken(token: string): void {
    this.tokens.delete(token);
  }

  /**
   * Revoke all tokens for an email
   * @param email Email address
   */
  revokeEmailTokens(email: string): void {
    const tokensToDelete: string[] = [];

    this.tokens.forEach((token, key) => {
      if (token.email === email) {
        tokensToDelete.push(key);
      }
    });

    tokensToDelete.forEach((key) => this.tokens.delete(key));
  }

  /**
   * Setup automatic cleanup of expired tokens
   */
  private setupCleanup(): void {
    // Clean up expired tokens every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const expiredTokens: string[] = [];

      this.tokens.forEach((token, key) => {
        if (token.expiresAt < now) {
          expiredTokens.push(key);
        }
      });

      expiredTokens.forEach((key) => this.tokens.delete(key));

      // Also clean up old rate limit entries
      const windowStart = now - this.config.windowMs;
      this.rateLimits.forEach((requests, email) => {
        const validRequests = requests.filter((ts) => ts > windowStart);
        if (validRequests.length === 0) {
          this.rateLimits.delete(email);
        } else {
          this.rateLimits.set(email, validRequests);
        }
      });
    }, 300000); // 5 minutes
  }

  /**
   * Clear all tokens (useful for testing)
   */
  clearAllTokens(): void {
    this.tokens.clear();
    this.rateLimits.clear();
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalTokens: this.tokens.size,
      usedTokens: Array.from(this.tokens.values()).filter((t) => t.used).length,
      totalRateLimits: this.rateLimits.size,
      config: this.config,
    };
  }

  /**
   * Update configuration
   * @param config Partial configuration to update
   */
  updateConfig(config: Partial<MagicLinkConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Singleton instance
let instance: MagicLinkService | null = null;

/**
 * Get or create magic link service instance
 */
export function getMagicLinkService(
  config?: Partial<MagicLinkConfig>,
): MagicLinkService {
  if (!instance) {
    instance = new MagicLinkService(config);
  }
  return instance;
}

/**
 * Reset service instance (for testing)
 */
export function resetMagicLinkService(): void {
  instance = null;
}

export { MagicLinkService };
