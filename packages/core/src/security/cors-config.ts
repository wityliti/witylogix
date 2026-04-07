/**
 * CORS (Cross-Origin Resource Sharing) Configuration — OWASP compliance.
 *
 * Manages whitelist-based origin validation, per-route CORS overrides, and
 * preflight caching. Supports wildcard subdomain matching and credentials control.
 *
 * Key features:
 * - Whitelist-based origin validation (not allow-all)
 * - Wildcard subdomain matching (*.witylogix.com)
 * - Per-route CORS overrides
 * - Preflight caching (Access-Control-Max-Age)
 * - Credentials support control
 * - Method and header restrictions
 *
 * @example
 * const corsManager = new CorsManager([
 *   "https://app.witylogix.com",
 *   "https://*.witylogix.com",
 * ]);
 * const headers = corsManager.getHeaders("https://dashboard.witylogix.com", "POST");
 */

/**
 * CORS configuration for a specific route.
 */
export interface CorsPolicyOverride {
  /** Route pattern (e.g., "/api/public/*") */
  pattern: RegExp | string;
  /** Allowed origins for this route */
  origins: string[];
  /** Allow credentials (cookies, auth headers) */
  credentials: boolean;
  /** Preflight cache duration in seconds */
  maxAge: number;
  /** Allowed HTTP methods */
  methods: string[];
  /** Allowed request headers */
  allowedHeaders: string[];
  /** Headers to expose to client */
  exposedHeaders: string[];
}

/**
 * CORS request context for validation.
 */
export interface CorsContext {
  /** Request origin header */
  origin: string;
  /** Request method (GET, POST, etc.) */
  method: string;
  /** Requested headers (Access-Control-Request-Headers) */
  requestHeaders: string[];
  /** Is this a preflight request (OPTIONS) */
  isPreflight: boolean;
  /** Route path being accessed */
  path: string;
}

/**
 * Result of CORS validation.
 */
export interface CorsValidationResult {
  /** Whether origin is allowed */
  allowed: boolean;
  /** Headers to include in response */
  headers: Record<string, string>;
  /** Reason for rejection (if not allowed) */
  reason?: string;
}

/**
 * Manager for CORS policies and validation.
 */
export class CorsManager {
  private whitelist: string[] = [];
  private overrides: CorsPolicyOverride[] = [];
  private defaultMaxAge: number = 3600; // 1 hour
  private defaultCredentials: boolean = true;
  private defaultMethods: string[] = [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ];
  private defaultAllowedHeaders: string[] = [
    "Content-Type",
    "Authorization",
    "X-Tenant-ID",
    "X-Request-ID",
  ];
  private defaultExposedHeaders: string[] = [
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset",
  ];

  /**
   * Initialize CORS manager.
   * @param whitelist - Array of allowed origins (supports wildcards)
   * @param options - Configuration options
   */
  constructor(
    whitelist: string[] = [],
    options?: {
      maxAge?: number;
      credentials?: boolean;
      methods?: string[];
      allowedHeaders?: string[];
      exposedHeaders?: string[];
    }
  ) {
    this.whitelist = whitelist;

    if (options?.maxAge) this.defaultMaxAge = options.maxAge;
    if (options?.credentials !== undefined)
      this.defaultCredentials = options.credentials;
    if (options?.methods) this.defaultMethods = options.methods;
    if (options?.allowedHeaders) this.defaultAllowedHeaders = options.allowedHeaders;
    if (options?.exposedHeaders) this.defaultExposedHeaders = options.exposedHeaders;
  }

  /**
   * Check if origin matches a whitelist entry.
   * Supports wildcard subdomains (*.witylogix.com).
   * @param origin - Origin to check
   * @param pattern - Whitelist pattern
   * @returns true if origin matches pattern
   */
  private originMatches(origin: string, pattern: string): boolean {
    // Exact match
    if (origin === pattern) {
      return true;
    }

    // Wildcard origin (allow any)
    if (pattern === "*") {
      return true;
    }

    // Wildcard subdomain matching (https://*.example.com or *.example.com)
    if (pattern.includes("*.")) {
      // Extract protocol and domain from pattern
      const patternProtocol = pattern.includes("://") ? pattern.split("://")[0] : null;
      const patternDomain = pattern.includes("://")
        ? pattern.split("://")[1].replace("*.", "")
        : pattern.replace("*.", "");

      const originProtocol = origin.split("://")[0];
      const originDomain = origin.split("://")[1];

      if (!originDomain) {
        return false;
      }

      // If pattern specifies a protocol, it must match
      if (patternProtocol && patternProtocol !== originProtocol) {
        return false;
      }

      // Check if origin domain is a subdomain of the pattern domain
      // Do not match the bare domain itself (e.g. witylogix.com should not match *.witylogix.com)
      return originDomain.endsWith(`.${patternDomain}`);
    }

    // Regex pattern (if pattern is provided as RegExp)
    if (pattern instanceof RegExp) {
      return pattern.test(origin);
    }

    return false;
  }

  /**
   * Check if origin is in whitelist.
   * @param origin - Origin to validate
   * @returns true if origin is whitelisted
   */
  private isOriginAllowed(origin: string): boolean {
    if (!origin) {
      return false;
    }

    return this.whitelist.some((pattern) => this.originMatches(origin, pattern));
  }

  /**
   * Find matching route override for a path.
   * @param path - Request path
   * @returns Matching override or undefined
   */
  private findOverride(path: string): CorsPolicyOverride | undefined {
    return this.overrides.find((override) => {
      if (typeof override.pattern === "string") {
        return this.pathMatches(path, override.pattern);
      } else {
        return override.pattern.test(path);
      }
    });
  }

  /**
   * Simple path pattern matching (* is wildcard).
   * @param path - Actual path
   * @param pattern - Pattern with wildcards
   * @returns true if path matches pattern
   */
  private pathMatches(path: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\./g, "\\.")
      .replace(/\*/g, ".*");
    return new RegExp(`^${regexPattern}$`).test(path);
  }

  /**
   * Validate a CORS request.
   * @param context - CORS request context
   * @returns Validation result with headers
   */
  validateRequest(context: CorsContext): CorsValidationResult {
    // Find matching override or use defaults
    const override = this.findOverride(context.path);
    const policy = override || this.getDefaultPolicy();

    // Check if origin is allowed (override origins take precedence)
    const isOverrideAllowed = override
      ? override.origins.some((o) => this.originMatches(context.origin, o))
      : false;

    if (!isOverrideAllowed && !this.isOriginAllowed(context.origin)) {
      return {
        allowed: false,
        headers: {},
        reason: "Origin not in whitelist",
      };
    }

    // Check method allowed
    if (!policy.methods.includes(context.method)) {
      return {
        allowed: false,
        headers: {},
        reason: `Method ${context.method} not allowed`,
      };
    }

    // Check requested headers
    for (const header of context.requestHeaders) {
      if (!this.headerAllowed(header, policy.allowedHeaders)) {
        return {
          allowed: false,
          headers: {},
          reason: `Header ${header} not allowed`,
        };
      }
    }

    // Build response headers
    const headers: Record<string, string> = {
      "Access-Control-Allow-Origin": context.origin,
      "Access-Control-Allow-Methods": policy.methods.join(", "),
      "Access-Control-Allow-Headers": policy.allowedHeaders.join(", "),
      "Access-Control-Expose-Headers": policy.exposedHeaders.join(", "),
      "Access-Control-Max-Age": String(policy.maxAge),
    };

    if (policy.credentials) {
      headers["Access-Control-Allow-Credentials"] = "true";
    }

    return {
      allowed: true,
      headers,
    };
  }

  /**
   * Check if a header is in the allowed list.
   * Supports wildcard matching.
   * @param header - Header name to check
   * @param allowedHeaders - List of allowed headers
   * @returns true if header is allowed
   */
  private headerAllowed(header: string, allowedHeaders: string[]): boolean {
    const normalized = header.toLowerCase();
    return allowedHeaders.some((allowed) => {
      if (allowed === "*") {
        return true;
      }
      return allowed.toLowerCase() === normalized;
    });
  }

  /**
   * Get default CORS policy.
   * @returns Default policy object
   */
  private getDefaultPolicy(): Omit<CorsPolicyOverride, "pattern"> {
    return {
      origins: this.whitelist,
      credentials: this.defaultCredentials,
      maxAge: this.defaultMaxAge,
      methods: this.defaultMethods,
      allowedHeaders: this.defaultAllowedHeaders,
      exposedHeaders: this.defaultExposedHeaders,
    };
  }

  /**
   * Get CORS headers for a successful request.
   * @param origin - Request origin
   * @param method - Request method
   * @param path - Request path
   * @returns CORS headers
   */
  getHeaders(origin: string, method: string, path: string = "/"): Record<string, string> {
    const context: CorsContext = {
      origin,
      method,
      requestHeaders: [],
      isPreflight: false,
      path,
    };

    const result = this.validateRequest(context);
    return result.headers;
  }

  /**
   * Register a route-specific CORS policy override.
   * @param override - Override configuration
   */
  addOverride(override: CorsPolicyOverride): void {
    this.overrides.push(override);
  }

  /**
   * Add origin to whitelist.
   * @param origin - Origin to whitelist
   */
  addOrigin(origin: string): void {
    if (!this.whitelist.includes(origin)) {
      this.whitelist.push(origin);
    }
  }

  /**
   * Remove origin from whitelist.
   * @param origin - Origin to remove
   */
  removeOrigin(origin: string): void {
    this.whitelist = this.whitelist.filter((o) => o !== origin);
  }

  /**
   * Get current whitelist.
   * @returns Array of whitelisted origins
   */
  getWhitelist(): string[] {
    return [...this.whitelist];
  }

  /**
   * Check if origin is in whitelist.
   * @param origin - Origin to check
   * @returns true if origin is whitelisted
   */
  isWhitelisted(origin: string): boolean {
    return this.isOriginAllowed(origin);
  }
}
