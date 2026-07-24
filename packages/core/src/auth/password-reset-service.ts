/**
 * Password Reset Service
 *
 * Handles password reset flows with secure token generation, validation,
 * and password hashing. Includes rate limiting to prevent abuse.
 */

import { randomBytes, scryptSync } from "crypto";
import { EventEmitter } from "events";

export interface ResetToken {
  token: string;
  email: string;
  expiresAt: number;
  used: boolean;
  createdAt: number;
}

export interface PasswordResetResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

class PasswordResetService extends EventEmitter {
  private tokens: Map<string, ResetToken> = new Map();
  private rateLimits: Map<string, number[]> = new Map();
  private rateLimitConfig: RateLimitConfig = {
    maxRequests: 3,
    windowMs: 3600000, // 1 hour
  };

  constructor() {
    super();
    this.setupCleanup();
  }

  /**
   * Generate a secure password reset token
   * @param email User email address
   * @returns Generated token and expiry time
   */
  generateResetToken(email: string): { token: string; expiresAt: number } {
    const token = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 3600000; // 1 hour expiry

    const resetToken: ResetToken = {
      token,
      email,
      expiresAt,
      used: false,
      createdAt: Date.now(),
    };

    this.tokens.set(token, resetToken);
    this.emit("token-generated", { email, token, expiresAt });

    return { token, expiresAt };
  }

  /**
   * Request password reset with rate limiting
   * @param email User email address
   * @returns Token generation result with rate limit check
   */
  requestPasswordReset(email: string): {
    success: boolean;
    token?: string;
    expiresAt?: number;
    error?: string;
    retryAfter?: number;
  } {
    // Check rate limit
    const now = Date.now();
    const windowStart = now - this.rateLimitConfig.windowMs;

    let emailRequests = this.rateLimits.get(email) || [];
    emailRequests = emailRequests.filter(
      (timestamp) => timestamp > windowStart,
    );

    if (emailRequests.length >= this.rateLimitConfig.maxRequests) {
      const retryAfter = Math.ceil(
        (Math.min(...emailRequests) + this.rateLimitConfig.windowMs - now) /
          1000,
      );
      return {
        success: false,
        error: `Too many reset requests. Please try again in ${retryAfter} seconds.`,
        retryAfter,
      };
    }

    // Record this request
    emailRequests.push(now);
    this.rateLimits.set(email, emailRequests);

    const { token, expiresAt } = this.generateResetToken(email);

    return {
      success: true,
      token,
      expiresAt,
    };
  }

  /**
   * Validate a password reset token
   * @param token Reset token to validate
   * @returns Validation result with email if valid
   */
  validateResetToken(token: string): {
    valid: boolean;
    email?: string;
    error?: string;
  } {
    const resetToken = this.tokens.get(token);

    if (!resetToken) {
      return {
        valid: false,
        error: "Invalid reset token. Please request a new password reset.",
      };
    }

    if (resetToken.used) {
      return {
        valid: false,
        error: "This reset token has already been used.",
      };
    }

    if (Date.now() > resetToken.expiresAt) {
      this.tokens.delete(token);
      return {
        valid: false,
        error:
          "This reset token has expired. Please request a new password reset.",
      };
    }

    return {
      valid: true,
      email: resetToken.email,
    };
  }

  /**
   * Hash password using scrypt
   * @param password Raw password to hash
   * @returns Hashed password
   */
  hashPassword(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const hashed = scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hashed}`;
  }

  /**
   * Verify a password against a hash
   * @param password Password to verify
   * @param hash Password hash to compare against
   * @returns True if password matches
   */
  verifyPassword(password: string, hash: string): boolean {
    const [salt, hashed] = hash.split(":");
    if (!salt || !hashed) return false;

    const computed = scryptSync(password, salt, 64).toString("hex");
    return computed === hashed;
  }

  /**
   * Reset password and invalidate token
   * @param token Reset token
   * @param newPassword New password in plaintext
   * @param onSessionRevoke Callback to revoke user sessions
   * @returns Password reset result
   */
  async resetPassword(
    token: string,
    newPassword: string,
    onSessionRevoke?: (email: string) => Promise<void>,
  ): Promise<PasswordResetResult> {
    // Validate token
    const validation = this.validateResetToken(token);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.error || "Invalid token",
        error: validation.error,
      };
    }

    // Validate password
    if (!newPassword || newPassword.length < 8) {
      return {
        success: false,
        message: "Password must be at least 8 characters long",
        error: "Invalid password",
      };
    }

    const resetToken = this.tokens.get(token)!;
    const email = validation.email!;

    try {
      // Hash new password
      const hashedPassword = this.hashPassword(newPassword);

      // Mark token as used
      resetToken.used = true;

      // Revoke all sessions for this user
      if (onSessionRevoke) {
        await onSessionRevoke(email);
      }

      this.emit("password-reset", { email, timestamp: Date.now() });

      return {
        success: true,
        message: "Password has been reset successfully",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        message: "Failed to reset password",
        error: errorMessage,
      };
    }
  }

  /**
   * Get token info (for debugging/testing)
   * @param token Reset token
   * @returns Token information if exists
   */
  getTokenInfo(token: string): ResetToken | null {
    return this.tokens.get(token) || null;
  }

  /**
   * Delete token (for cleanup)
   * @param token Reset token to delete
   */
  deleteToken(token: string): void {
    this.tokens.delete(token);
  }

  /**
   * Setup automatic cleanup of expired tokens
   */
  private setupCleanup(): void {
    // Clean up expired tokens every 10 minutes
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
      const windowStart = now - this.rateLimitConfig.windowMs;
      this.rateLimits.forEach((requests, email) => {
        const validRequests = requests.filter((ts) => ts > windowStart);
        if (validRequests.length === 0) {
          this.rateLimits.delete(email);
        } else {
          this.rateLimits.set(email, validRequests);
        }
      });
    }, 600000); // 10 minutes
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
      totalRateLimits: this.rateLimits.size,
      rateLimitConfig: this.rateLimitConfig,
    };
  }
}

// Singleton instance
let instance: PasswordResetService | null = null;

/**
 * Get or create password reset service instance
 */
export function getPasswordResetService(): PasswordResetService {
  if (!instance) {
    instance = new PasswordResetService();
  }
  return instance;
}

/**
 * Reset service instance (for testing)
 */
export function resetPasswordResetService(): void {
  instance = null;
}

export { PasswordResetService };
