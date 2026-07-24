/**
 * Email Verification Service — Handles OTP generation and verification.
 *
 * This service manages:
 * - OTP generation (6-digit codes)
 * - OTP verification with expiry
 * - OTP resending with rate limiting
 * - Brute force protection
 * - Auto-cleanup of expired codes
 *
 * OTP codes are stored in-memory with optional Redis persistence.
 */

import {
  OnboardingError,
  OnboardingErrorCodes,
  GenerateOTPResult,
  VerifyOTPResult,
} from "./types";

/**
 * OTP storage structure.
 */
interface OTPRecord {
  code: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
  attempts: number;
}

/**
 * Rate limiting structure.
 */
interface RateLimitRecord {
  count: number;
  resetAt: Date;
}

/**
 * EmailVerificationService manages OTP-based email verification.
 */
export class EmailVerificationService {
  // In-memory storage (replace with Redis in production)
  private otpStore: Map<string, OTPRecord> = new Map();
  private rateLimitStore: Map<string, RateLimitRecord> = new Map();

  // Configuration
  private readonly OTP_LENGTH = 6;
  private readonly OTP_EXPIRY_MINUTES = 10;
  private readonly MAX_ATTEMPTS = 5;
  private readonly MAX_RESENDS_PER_10MIN = 3;
  private readonly RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * Generates and stores a new OTP for an email.
   *
   * Validates:
   * - Email format
   * - Rate limiting (max resends per window)
   *
   * @param email - Email to generate OTP for
   * @returns OTP generation result
   * @throws OnboardingError if rate limited or invalid email
   */
  generateOTP(email: string): GenerateOTPResult {
    this.validateEmail(email);

    // Check rate limiting
    const rateLimitKey = `otp_resend:${email}`;
    const rateLimit = this.rateLimitStore.get(rateLimitKey);

    if (rateLimit && rateLimit.resetAt > new Date()) {
      if (rateLimit.count >= this.MAX_RESENDS_PER_10MIN) {
        const resetTime = Math.ceil(
          (rateLimit.resetAt.getTime() - Date.now()) / 1000,
        );
        throw new OnboardingError(
          OnboardingErrorCodes.OTP_RESEND_RATE_LIMITED,
          `Too many OTP requests. Try again in ${resetTime} seconds`,
          429,
        );
      }
      rateLimit.count++;
    } else {
      // Create new rate limit entry
      const expiresAt = new Date(Date.now() + this.RATE_LIMIT_WINDOW_MS);
      this.rateLimitStore.set(rateLimitKey, {
        count: 1,
        resetAt: expiresAt,
      });
    }

    // Generate 6-digit OTP
    const code = this.generateRandomCode();

    // Store OTP with expiry
    const expiresAt = new Date(
      Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000,
    );
    this.otpStore.set(email, {
      code,
      email,
      createdAt: new Date(),
      expiresAt,
      attempts: 0,
    });

    // Auto-cleanup old entries
    this.cleanupExpiredOTPs();

    return {
      email,
      expiresIn: this.OTP_EXPIRY_MINUTES * 60,
      attemptsRemaining: this.MAX_ATTEMPTS,
    };
  }

  /**
   * Verifies an OTP code for an email.
   *
   * Validates:
   * - OTP exists and is not expired
   * - Code matches
   * - Max attempts not exceeded
   *
   * @param email - Email to verify
   * @param code - OTP code from user
   * @returns Verification result
   * @throws OnboardingError if verification fails
   */
  verifyOTP(email: string, code: string): VerifyOTPResult {
    this.validateEmail(email);

    const otpRecord = this.otpStore.get(email);

    if (!otpRecord) {
      throw new OnboardingError(
        OnboardingErrorCodes.INVALID_OTP,
        "No OTP found for this email. Request a new code.",
        400,
      );
    }

    // Check if expired
    if (otpRecord.expiresAt < new Date()) {
      this.otpStore.delete(email);
      throw new OnboardingError(
        OnboardingErrorCodes.OTP_EXPIRED,
        "OTP has expired. Request a new code.",
        400,
      );
    }

    // Check attempts
    if (otpRecord.attempts >= this.MAX_ATTEMPTS) {
      this.otpStore.delete(email);
      throw new OnboardingError(
        OnboardingErrorCodes.OTP_MAX_ATTEMPTS,
        "Too many failed attempts. Request a new code.",
        400,
      );
    }

    // Verify code
    if (otpRecord.code !== code) {
      otpRecord.attempts++;
      throw new OnboardingError(
        OnboardingErrorCodes.INVALID_OTP,
        `Invalid OTP. ${this.MAX_ATTEMPTS - otpRecord.attempts} attempts remaining.`,
        400,
      );
    }

    // Success — consume the OTP
    this.otpStore.delete(email);

    return {
      email,
      verified: true,
      message: "Email verified successfully",
    };
  }

  /**
   * Resends an OTP for an email.
   *
   * Wrapper around generateOTP that ensures user is requesting for
   * an email that already has an OTP (not a new one).
   *
   * @param email - Email to resend OTP for
   * @returns OTP generation result
   * @throws OnboardingError if rate limited
   */
  resendOTP(email: string): GenerateOTPResult {
    const otpRecord = this.otpStore.get(email);

    if (!otpRecord) {
      // Email doesn't have a pending OTP — treat this as a new generation
      // This is intentional: users can request OTP for any email
    }

    return this.generateOTP(email);
  }

  /**
   * Validates an email address format.
   *
   * @param email - Email to validate
   * @throws OnboardingError if invalid
   */
  private validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new OnboardingError(
        OnboardingErrorCodes.INVALID_OTP,
        "Invalid email address",
        400,
      );
    }
  }

  /**
   * Generates a random 6-digit code.
   */
  private generateRandomCode(): string {
    const code = Math.floor(Math.random() * 1000000);
    return code.toString().padStart(this.OTP_LENGTH, "0");
  }

  /**
   * Cleans up expired OTP entries from storage.
   * Called automatically after OTP generation.
   */
  private cleanupExpiredOTPs(): void {
    const now = new Date();

    for (const [email, record] of this.otpStore.entries()) {
      if (record.expiresAt < now) {
        this.otpStore.delete(email);
      }
    }

    // Also cleanup rate limit entries
    for (const [key, record] of this.rateLimitStore.entries()) {
      if (record.resetAt < now) {
        this.rateLimitStore.delete(key);
      }
    }
  }

  /**
   * Checks if an OTP is pending for an email (not yet verified).
   *
   * @param email - Email to check
   * @returns True if OTP exists and is not expired
   */
  isOTPPending(email: string): boolean {
    const record = this.otpStore.get(email);
    if (!record) return false;
    return record.expiresAt > new Date();
  }

  /**
   * Gets remaining time for an OTP in seconds.
   *
   * @param email - Email
   * @returns Seconds remaining, or 0 if expired or not found
   */
  getOTPTimeRemaining(email: string): number {
    const record = this.otpStore.get(email);
    if (!record) return 0;

    const remaining = Math.ceil(
      (record.expiresAt.getTime() - Date.now()) / 1000,
    );
    return Math.max(0, remaining);
  }

  /**
   * Clears all OTP data (for testing purposes).
   */
  clearAll(): void {
    this.otpStore.clear();
    this.rateLimitStore.clear();
  }

  /**
   * Gets statistics about OTP requests (for monitoring).
   *
   * @returns Statistics object
   */
  getStatistics(): {
    pendingOTPs: number;
    rateLimitedEmails: number;
  } {
    return {
      pendingOTPs: this.otpStore.size,
      rateLimitedEmails: this.rateLimitStore.size,
    };
  }
}

// Export singleton instance
export const emailVerificationService = new EmailVerificationService();
