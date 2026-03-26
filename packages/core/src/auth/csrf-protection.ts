/**
 * CSRF Protection
 *
 * Double-submit cookie pattern for CSRF token generation and validation.
 * Suitable for server-side rendered and SPA applications.
 */

import { randomBytes } from 'crypto';

export interface CSRFConfig {
  cookieName?: string;
  headerName?: string;
  paramName?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  maxAge?: number;
  excludeUrls?: string[];
}

/**
 * CSRF Token Manager
 */
export class CSRFTokenManager {
  private config: Required<CSRFConfig>;
  private tokenStore: Map<string, { token: string; expiresAt: number }> = new Map();

  constructor(config: CSRFConfig = {}) {
    this.config = {
      cookieName: config.cookieName || '__Host-csrf-token',
      headerName: config.headerName || 'X-CSRF-Token',
      paramName: config.paramName || '_csrf',
      secure: config.secure !== false,
      httpOnly: config.httpOnly !== false,
      sameSite: config.sameSite || 'Strict',
      maxAge: config.maxAge || 3600000, // 1 hour
      excludeUrls: config.excludeUrls || [],
    };

    this.setupCleanup();
  }

  /**
   * Generate a new CSRF token
   * @param sessionId Session identifier (e.g., user ID)
   * @returns Generated token
   */
  generateToken(sessionId: string): string {
    const token = randomBytes(32).toString('hex');
    const expiresAt = Date.now() + this.config.maxAge;

    this.tokenStore.set(`${sessionId}:${token}`, {
      token,
      expiresAt,
    });

    return token;
  }

  /**
   * Validate a CSRF token using double-submit cookie pattern
   * @param sessionId Session identifier
   * @param cookieToken Token from cookie
   * @param submitToken Token from form/header
   * @returns True if tokens match and are valid
   */
  validateToken(sessionId: string, cookieToken: string, submitToken: string): boolean {
    // Tokens must match
    if (cookieToken !== submitToken) {
      return false;
    }

    // Check if token exists and is not expired
    const stored = this.tokenStore.get(`${sessionId}:${cookieToken}`);
    if (!stored) {
      return false;
    }

    if (Date.now() > stored.expiresAt) {
      this.tokenStore.delete(`${sessionId}:${cookieToken}`);
      return false;
    }

    return true;
  }

  /**
   * Refresh a CSRF token
   * @param sessionId Session identifier
   * @param oldToken Old token to invalidate
   * @returns New token
   */
  refreshToken(sessionId: string, oldToken: string): string {
    this.tokenStore.delete(`${sessionId}:${oldToken}`);
    return this.generateToken(sessionId);
  }

  /**
   * Revoke a CSRF token
   * @param sessionId Session identifier
   * @param token Token to revoke
   */
  revokeToken(sessionId: string, token: string): void {
    this.tokenStore.delete(`${sessionId}:${token}`);
  }

  /**
   * Revoke all tokens for a session
   * @param sessionId Session identifier
   */
  revokeAllTokens(sessionId: string): void {
    const keysToDelete: string[] = [];

    this.tokenStore.forEach((_, key) => {
      if (key.startsWith(`${sessionId}:`)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.tokenStore.delete(key));
  }

  /**
   * Check if a URL should be excluded from CSRF validation
   */
  shouldExclude(url: string): boolean {
    return this.config.excludeUrls.some((excludeUrl) => url.startsWith(excludeUrl));
  }

  /**
   * Get cookie options
   */
  getCookieOptions() {
    return {
      name: this.config.cookieName,
      httpOnly: this.config.httpOnly,
      secure: this.config.secure,
      sameSite: this.config.sameSite,
      maxAge: this.config.maxAge,
    };
  }

  /**
   * Get configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Setup automatic cleanup of expired tokens
   */
  private setupCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      this.tokenStore.forEach((data, key) => {
        if (data.expiresAt < now) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach((key) => this.tokenStore.delete(key));
    }, 600000); // 10 minutes
  }

  /**
   * Clear all tokens (for testing)
   */
  clearAllTokens(): void {
    this.tokenStore.clear();
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalTokens: this.tokenStore.size,
      config: this.config,
    };
  }
}

/**
 * Express middleware factory for CSRF protection
 */
export function createCSRFMiddleware(config?: CSRFConfig) {
  const manager = new CSRFTokenManager(config);

  // Middleware to generate and validate tokens
  return {
    /**
     * Generation middleware - add to all routes that need CSRF protection
     */
    generateToken: (req: any, res: any, next: any) => {
      if (manager.shouldExclude(req.path)) {
        return next();
      }

      // Check if we should generate a new token
      if (!req.cookies?.[manager.getConfig().cookieName]) {
        const sessionId = req.session?.id || req.user?.id || 'anonymous';
        const token = manager.generateToken(sessionId);

        const cookieOptions = manager.getCookieOptions();
        res.cookie(cookieOptions.name, token, {
          httpOnly: cookieOptions.httpOnly,
          secure: cookieOptions.secure,
          sameSite: cookieOptions.sameSite,
          maxAge: cookieOptions.maxAge,
        });

        // Also set as template variable for forms
        res.locals.csrfToken = token;
      }

      next();
    },

    /**
     * Validation middleware - add to routes that modify data (POST, PUT, DELETE, PATCH)
     */
    validateToken: (req: any, res: any, next: any) => {
      if (
        manager.shouldExclude(req.path) ||
        ['GET', 'HEAD', 'OPTIONS'].includes(req.method)
      ) {
        return next();
      }

      const cookieToken = req.cookies?.[manager.getConfig().cookieName];
      const headerToken =
        req.headers[manager.getConfig().headerName.toLowerCase()] ||
        req.headers[manager.getConfig().headerName.replace(/-/g, '_').toLowerCase()];
      const bodyToken = req.body?.[manager.getConfig().paramName];

      const submitToken = headerToken || bodyToken;
      const sessionId = req.session?.id || req.user?.id || 'anonymous';

      if (!cookieToken || !submitToken) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'CSRF token missing',
        });
      }

      if (!manager.validateToken(sessionId, cookieToken, submitToken as string)) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'CSRF token invalid',
        });
      }

      next();
    },

    /**
     * Get the manager instance
     */
    getManager: () => manager,
  };
}

// Singleton instance
let instance: CSRFTokenManager | null = null;

/**
 * Get or create CSRF token manager instance
 */
export function getCSRFTokenManager(config?: CSRFConfig): CSRFTokenManager {
  if (!instance) {
    instance = new CSRFTokenManager(config);
  }
  return instance;
}

/**
 * Reset token manager instance (for testing)
 */
export function resetCSRFTokenManager(): void {
  instance = null;
}

export { CSRFTokenManager };
