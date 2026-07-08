/**
 * Security Headers Middleware — OWASP security hardening.
 *
 * Applies HTTP security headers to prevent common attacks:
 * - Clickjacking (X-Frame-Options)
 * - MIME type sniffing (X-Content-Type-Options)
 * - XSS (X-XSS-Protection)
 * - Insecure transport (HSTS)
 * - Referrer leakage (Referrer-Policy)
 * - Camera/microphone/geolocation access (Permissions-Policy)
 *
 * Key features:
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - Strict-Transport-Security (HSTS) with includeSubDomains
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy for browser features
 * - Cache-Control for sensitive endpoints
 * - Per-route header overrides
 *
 * @example
 * const middleware = new SecurityHeadersMiddleware({
 *   hstsMaxAge: 31536000,
 *   hstsIncludeSubDomains: true,
 * });
 * const headers = middleware.getHeaders();
 */

/**
 * Security headers configuration.
 */
export interface SecurityHeadersConfig {
  /** Enable HSTS header */
  enableHsts?: boolean;
  /** HSTS max age in seconds (default: 1 year) */
  hstsMaxAge?: number;
  /** Include subdomains in HSTS */
  hstsIncludeSubDomains?: boolean;
  /** Enable HSTS preload list submission */
  hstsPreload?: boolean;
  /** X-Frame-Options value (DENY, SAMEORIGIN, ALLOW-FROM) */
  frameOptions?: "DENY" | "SAMEORIGIN";
  /** Enable X-Content-Type-Options: nosniff */
  enableXContentTypeOptions?: boolean;
  /** Enable X-XSS-Protection (deprecated but still useful) */
  enableXXssProtection?: boolean;
  /** Referrer-Policy value */
  referrerPolicy?:
    | "no-referrer"
    | "no-referrer-when-downgrade"
    | "same-origin"
    | "origin"
    | "strict-origin"
    | "origin-when-cross-origin"
    | "strict-origin-when-cross-origin";
  /** Permissions to disable (camera, microphone, geolocation, etc.) */
  disabledPermissions?: string[];
  /** Cache control for sensitive endpoints */
  cacheControl?: string;
  /** Enable Expect-CT header */
  enableExpectCt?: boolean;
}

/**
 * Route-specific security header overrides.
 */
export interface SecurityHeaderOverride {
  /** Route pattern (string or RegExp) */
  pattern: string | RegExp;
  /** Headers to set for this route */
  headers: Record<string, string>;
  /** Headers to remove for this route */
  remove?: string[];
}

/**
 * Security headers middleware manager.
 */
export class SecurityHeadersMiddleware {
  private config: Required<SecurityHeadersConfig>;
  private overrides: SecurityHeaderOverride[] = [];

  /**
   * Initialize security headers middleware.
   * @param config - Configuration options
   */
  constructor(config: SecurityHeadersConfig = {}) {
    this.config = {
      enableHsts: config.enableHsts !== false,
      hstsMaxAge: config.hstsMaxAge || 31536000, // 1 year
      hstsIncludeSubDomains: config.hstsIncludeSubDomains !== false,
      hstsPreload: config.hstsPreload || false,
      frameOptions: config.frameOptions || "DENY",
      enableXContentTypeOptions: config.enableXContentTypeOptions !== false,
      enableXXssProtection: config.enableXXssProtection !== false,
      referrerPolicy:
        config.referrerPolicy || "strict-origin-when-cross-origin",
      disabledPermissions: config.disabledPermissions || [
        "camera",
        "microphone",
        "geolocation",
        "usb",
        "magnetometer",
        "gyroscope",
        "accelerometer",
      ],
      cacheControl:
        config.cacheControl || "public, max-age=3600, must-revalidate",
      enableExpectCt: config.enableExpectCt !== false,
    };
  }

  /**
   * Build HSTS header value.
   * @returns HSTS header value
   */
  private buildHstsHeader(): string {
    const parts: string[] = [`max-age=${this.config.hstsMaxAge}`];

    if (this.config.hstsIncludeSubDomains) {
      parts.push("includeSubDomains");
    }

    if (this.config.hstsPreload) {
      parts.push("preload");
    }

    return parts.join("; ");
  }

  /**
   * Build Permissions-Policy header value.
   * @returns Permissions-Policy header value
   */
  private buildPermissionsPolicyHeader(): string {
    const policies = this.config.disabledPermissions.map(
      (permission) => `${permission}=()`,
    );
    return policies.join(", ");
  }

  /**
   * Get all security headers.
   * @param path - Optional path for route-specific overrides
   * @returns Object with security headers
   */
  getHeaders(path?: string): Record<string, string> {
    const headers: Record<string, string> = {};

    // X-Content-Type-Options: prevent MIME sniffing
    if (this.config.enableXContentTypeOptions) {
      headers["X-Content-Type-Options"] = "nosniff";
    }

    // X-Frame-Options: prevent clickjacking
    headers["X-Frame-Options"] = this.config.frameOptions;

    // X-XSS-Protection: legacy XSS protection (deprecated but still useful)
    if (this.config.enableXXssProtection) {
      headers["X-XSS-Protection"] = "0"; // 0 = disable (modern browsers use CSP)
    }

    // Referrer-Policy: control referrer leakage
    headers["Referrer-Policy"] = this.config.referrerPolicy;

    // Permissions-Policy: disable browser features
    headers["Permissions-Policy"] = this.buildPermissionsPolicyHeader();

    // Strict-Transport-Security: force HTTPS
    if (this.config.enableHsts) {
      headers["Strict-Transport-Security"] = this.buildHstsHeader();
    }

    // Cache-Control: for sensitive endpoints
    if (this.config.cacheControl) {
      headers["Cache-Control"] = this.config.cacheControl;
    }

    // Expect-CT: Certificate Transparency enforcement
    if (this.config.enableExpectCt) {
      headers["Expect-CT"] = `max-age=${this.config.hstsMaxAge}`;
    }

    // Apply route-specific overrides
    if (path) {
      const override = this.findOverride(path);
      if (override) {
        // Merge override headers
        Object.assign(headers, override.headers);

        // Remove specified headers
        if (override.remove) {
          for (const headerName of override.remove) {
            delete headers[headerName];
          }
        }
      }
    }

    return headers;
  }

  /**
   * Find matching override for a path.
   * @param path - Request path
   * @returns Matching override or undefined
   */
  private findOverride(path: string): SecurityHeaderOverride | undefined {
    return this.overrides.find((override) => {
      if (typeof override.pattern === "string") {
        return this.pathMatches(path, override.pattern);
      }
      return override.pattern.test(path);
    });
  }

  /**
   * Check if path matches pattern (* is wildcard).
   * @param path - Actual path
   * @param pattern - Pattern with wildcards
   * @returns true if path matches
   */
  private pathMatches(path: string, pattern: string): boolean {
    const regexPattern = pattern.replace(/\./g, "\\.").replace(/\*/g, ".*");
    return new RegExp(`^${regexPattern}$`).test(path);
  }

  /**
   * Add route-specific header override.
   * @param override - Override configuration
   */
  addOverride(override: SecurityHeaderOverride): void {
    this.overrides.push(override);
  }

  /**
   * Create middleware for Express.js.
   * @returns Express middleware function
   */
  expressMiddleware() {
    return (req: any, res: any, next: any) => {
      const headers = this.getHeaders(req.path);
      Object.entries(headers).forEach(([key, value]) => {
        res.set(key, value);
      });
      next();
    };
  }

  /**
   * Create middleware for Fastify.
   * @returns Fastify hook function
   */
  fastifyHook() {
    return async (request: any, reply: any) => {
      const headers = this.getHeaders(request.url);
      Object.entries(headers).forEach(([key, value]) => {
        reply.header(key, value);
      });
    };
  }

  /**
   * Disable a specific security feature.
   * @param feature - Feature to disable
   */
  disableFeature(feature: keyof SecurityHeadersConfig): void {
    if (feature === "enableHsts") {
      this.config.enableHsts = false;
    } else if (feature === "enableXContentTypeOptions") {
      this.config.enableXContentTypeOptions = false;
    } else if (feature === "enableXXssProtection") {
      this.config.enableXXssProtection = false;
    } else if (feature === "enableExpectCt") {
      this.config.enableExpectCt = false;
    }
  }

  /**
   * Update HSTS configuration.
   * @param config - New HSTS config
   */
  updateHstsConfig(config: {
    maxAge?: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  }): void {
    if (config.maxAge !== undefined) {
      this.config.hstsMaxAge = config.maxAge;
    }
    if (config.includeSubDomains !== undefined) {
      this.config.hstsIncludeSubDomains = config.includeSubDomains;
    }
    if (config.preload !== undefined) {
      this.config.hstsPreload = config.preload;
    }
  }

  /**
   * Update disabled permissions.
   * @param permissions - Array of permissions to disable
   */
  updateDisabledPermissions(permissions: string[]): void {
    this.config.disabledPermissions = permissions;
  }

  /**
   * Get current configuration.
   * @returns Current configuration
   */
  getConfig(): SecurityHeadersConfig {
    return { ...this.config };
  }
}
