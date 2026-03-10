/**
 * URL Shortener — Internal tracking URL shortening service
 */

import crypto from "crypto";
import { ShortUrlResult } from "./types.js";

/**
 * Shortened URL record
 */
export interface ShortenedUrl {
  code: string;
  originalUrl: string;
  shortUrl: string;
  createdAt: Date;
  expiresAt: Date;
  clicks: number;
}

/**
 * In-memory URL store (in production, use a database)
 */
const urlStore = new Map<string, ShortenedUrl>();

/**
 * URL Shortener service
 */
export class UrlShortener {
  private baseUrl: string;
  private expirationDays: number = 90;

  constructor(baseUrl: string = "https://track.witylogix.com") {
    this.baseUrl = baseUrl;
  }

  /**
   * Generate a short code
   */
  private generateCode(length: number = 8): string {
    return crypto
      .randomBytes(length)
      .toString("hex")
      .substring(0, length);
  }

  /**
   * Shorten a URL
   */
  shortenUrl(originalUrl: string): ShortUrlResult {
    try {
      // Validate URL
      try {
        new URL(originalUrl);
      } catch {
        throw new Error("Invalid URL format");
      }

      // Check if URL already shortened
      for (const [, record] of urlStore) {
        if (
          record.originalUrl === originalUrl &&
          record.expiresAt > new Date()
        ) {
          return {
            originalUrl,
            shortUrl: record.shortUrl,
            code: record.code,
          };
        }
      }

      // Generate new short code
      let code: string;
      let attempts = 0;
      const maxAttempts = 10;

      do {
        code = this.generateCode();
        attempts++;
      } while (urlStore.has(code) && attempts < maxAttempts);

      if (attempts >= maxAttempts) {
        throw new Error("Failed to generate unique short code");
      }

      // Create shortened URL record
      const shortUrl = `${this.baseUrl}/${code}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.expirationDays);

      const record: ShortenedUrl = {
        code,
        originalUrl,
        shortUrl,
        createdAt: new Date(),
        expiresAt,
        clicks: 0,
      };

      urlStore.set(code, record);

      return {
        originalUrl,
        shortUrl,
        code,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`URL shortening failed: ${errorMessage}`);
    }
  }

  /**
   * Resolve a short code to original URL
   */
  resolveUrl(code: string): string | null {
    const record = urlStore.get(code);

    if (!record) {
      return null;
    }

    // Check if expired
    if (record.expiresAt < new Date()) {
      urlStore.delete(code);
      return null;
    }

    // Increment click count
    record.clicks++;
    urlStore.set(code, record);

    return record.originalUrl;
  }

  /**
   * Get statistics for a short URL
   */
  getStats(code: string): ShortenedUrl | null {
    const record = urlStore.get(code);
    if (!record) {
      return null;
    }

    return { ...record };
  }

  /**
   * Delete a shortened URL
   */
  deleteUrl(code: string): boolean {
    return urlStore.delete(code);
  }

  /**
   * List all shortened URLs
   */
  listUrls(): ShortenedUrl[] {
    return Array.from(urlStore.values()).filter((r) => r.expiresAt > new Date());
  }

  /**
   * Clean up expired URLs
   */
  cleanupExpired(): number {
    const now = new Date();
    let removed = 0;

    for (const [code, record] of urlStore) {
      if (record.expiresAt < now) {
        urlStore.delete(code);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Clear all URLs (for testing)
   */
  clearAll(): void {
    urlStore.clear();
  }

  /**
   * Set expiration duration
   */
  setExpirationDays(days: number): void {
    this.expirationDays = days;
  }

  /**
   * Batch shorten URLs
   */
  shortenBatch(urls: string[]): ShortUrlResult[] {
    return urls.map((url) => {
      try {
        return this.shortenUrl(url);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          originalUrl: url,
          shortUrl: "",
          code: "",
        };
      }
    });
  }
}
