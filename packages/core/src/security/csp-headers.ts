/**
 * Content Security Policy (CSP) Headers — OWASP security hardening.
 *
 * Manages strict Content Security Policy directives to prevent XSS, clickjacking,
 * and other injection attacks. Supports per-environment policies with nonce generation
 * for inline scripts and report-only mode for testing.
 *
 * Key features:
 * - Nonce generation for inline script/style execution
 * - Environment-aware policies (dev permissive, prod strict)
 * - Report-only mode for testing without blocking
 * - Report URI configuration for CSP violation tracking
 * - Per-route policy overrides
 *
 * @example
 * const cspManager = new CspManager(CspEnvironment.PRODUCTION);
 * const nonce = cspManager.generateNonce();
 * const headers = cspManager.getHeaders(nonce);
 * res.set(headers);
 */

/**
 * Environment types for CSP policy strictness.
 */
export enum CspEnvironment {
  /** Development: more permissive, localhost allowed */
  DEVELOPMENT = "development",
  /** Staging: moderately strict */
  STAGING = "staging",
  /** Production: strictest policy */
  PRODUCTION = "production",
}

/**
 * CSP violation report event.
 */
export interface CspViolationReport {
  /** Document URI where violation occurred */
  "document-uri": string;
  /** Violated directive */
  "violated-directive": string;
  /** Effective directive that was triggered */
  "effective-directive": string;
  /** Original policy from Content-Security-Policy header */
  "original-policy": string;
  /** URI of resource that violated CSP */
  "blocked-uri"?: string;
  /** Type of resource (script, style, img, etc.) */
  "source-file": string;
  /** Line number where violation occurred */
  "line-number": number;
  /** Column number where violation occurred */
  "column-number": number;
  /** Status code of resource (if applicable) */
  "status-code": number;
}

/**
 * CSP directive configuration.
 */
interface CspDirectives {
  "default-src": string[];
  "script-src": string[];
  "style-src": string[];
  "img-src": string[];
  "font-src": string[];
  "connect-src": string[];
  "media-src": string[];
  "object-src": string[];
  "frame-src": string[];
  "form-action": string[];
  "base-uri": string[];
  "frame-ancestors": string[];
  "upgrade-insecure-requests"?: boolean;
  "block-all-mixed-content"?: boolean;
}

/**
 * Manager for Content Security Policy headers.
 * Generates nonces, builds policies, and handles reports.
 */
export class CspManager {
  private environment: CspEnvironment;
  private reportUri: string;
  private reportOnly: boolean;
  private nonces: Set<string> = new Set();

  /**
   * Initialize CSP manager.
   * @param environment - Policy strictness level
   * @param reportUri - URI for CSP violation reports (optional)
   * @param reportOnly - Report-only mode (don't enforce, just report)
   */
  constructor(
    environment: CspEnvironment = CspEnvironment.PRODUCTION,
    reportUri?: string,
    reportOnly: boolean = false
  ) {
    this.environment = environment;
    this.reportUri = reportUri || "/api/security/csp-report";
    this.reportOnly = reportOnly;
  }

  /**
   * Generate a cryptographically random nonce for inline scripts/styles.
   * Nonces are tracked and valid for single use per request.
   * @returns Base64-encoded 16-byte random nonce
   */
  generateNonce(): string {
    const randomBytes = new Uint8Array(16);
    crypto.getRandomValues(randomBytes);
    const nonce = Buffer.from(randomBytes).toString("base64");
    this.nonces.add(nonce);
    return nonce;
  }

  /**
   * Validate a nonce and mark it as used (one-time use).
   * @param nonce - Nonce to validate
   * @returns true if nonce is valid and unused
   */
  validateNonce(nonce: string): boolean {
    if (!this.nonces.has(nonce)) {
      return false;
    }
    this.nonces.delete(nonce);
    return true;
  }

  /**
   * Build CSP directives for current environment.
   * @param nonce - Optional nonce for inline scripts
   * @returns CSP directives object
   */
  private buildDirectives(nonce?: string): CspDirectives {
    const directives: CspDirectives = {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'"],
      "img-src": ["'self'", "data:", "https:"],
      "font-src": ["'self'", "data:"],
      "connect-src": ["'self'"],
      "media-src": ["'none'"],
      "object-src": ["'none'"],
      "frame-src": ["'self'"],
      "form-action": ["'self'"],
      "base-uri": ["'self'"],
      "frame-ancestors": ["'none'"],
      "upgrade-insecure-requests": true,
      "block-all-mixed-content": true,
    };

    // Add nonce if provided
    if (nonce) {
      directives["script-src"].push(`'nonce-${nonce}'`);
      directives["style-src"].push(`'nonce-${nonce}'`);
    }

    // Environment-specific overrides
    switch (this.environment) {
      case CspEnvironment.DEVELOPMENT:
        directives["script-src"].push("'unsafe-inline'", "localhost:*");
        directives["style-src"].push("'unsafe-inline'", "localhost:*");
        directives["connect-src"].push("localhost:*", "ws://localhost:*");
        break;

      case CspEnvironment.STAGING:
        directives["script-src"].push(
          "https://cdn.staging.witylogix.com",
          "https://cdn.jsdelivr.net"
        );
        directives["style-src"].push(
          "https://cdn.staging.witylogix.com",
          "https://fonts.googleapis.com"
        );
        directives["connect-src"].push("https://api.staging.witylogix.com");
        break;

      case CspEnvironment.PRODUCTION:
        directives["script-src"].push("https://cdn.witylogix.com");
        directives["style-src"].push(
          "https://cdn.witylogix.com",
          "https://fonts.googleapis.com"
        );
        directives["connect-src"].push("https://api.witylogix.com");
        directives["font-src"].push("https://fonts.gstatic.com");
        break;
    }

    return directives;
  }

  /**
   * Serialize CSP directives to header string.
   * @param directives - CSP directives
   * @returns Formatted CSP header string
   */
  private serializeDirectives(directives: CspDirectives): string {
    const parts: string[] = [];

    for (const [key, value] of Object.entries(directives)) {
      if (typeof value === "boolean" && value) {
        parts.push(key);
      } else if (Array.isArray(value)) {
        parts.push(`${key} ${value.join(" ")}`);
      }
    }

    if (this.reportUri) {
      parts.push(`report-uri ${this.reportUri}`);
    }

    return parts.join("; ");
  }

  /**
   * Get CSP headers for response.
   * @param nonce - Optional nonce for inline scripts
   * @returns Object with CSP header(s)
   */
  getHeaders(nonce?: string): Record<string, string> {
    const directives = this.buildDirectives(nonce);
    const policy = this.serializeDirectives(directives);

    const headerName = this.reportOnly
      ? "Content-Security-Policy-Report-Only"
      : "Content-Security-Policy";

    return {
      [headerName]: policy,
    };
  }

  /**
   * Parse and validate a CSP violation report from client.
   * @param report - Raw report data from csp-report endpoint
   * @returns Parsed violation report
   * @throws Error if report is malformed
   */
  parseViolationReport(report: unknown): CspViolationReport {
    if (typeof report !== "object" || report === null) {
      throw new Error("Invalid CSP report: not an object");
    }

    const data = report as Record<string, unknown>;
    const required = [
      "document-uri",
      "violated-directive",
      "effective-directive",
      "source-file",
      "line-number",
      "column-number",
      "status-code",
    ];

    for (const field of required) {
      if (!(field in data)) {
        throw new Error(`Missing required CSP report field: ${field}`);
      }
    }

    return {
      "document-uri": String(data["document-uri"]),
      "violated-directive": String(data["violated-directive"]),
      "effective-directive": String(data["effective-directive"]),
      "original-policy": String(data["original-policy"] || ""),
      "blocked-uri": data["blocked-uri"] ? String(data["blocked-uri"]) : undefined,
      "source-file": String(data["source-file"]),
      "line-number": Number(data["line-number"]),
      "column-number": Number(data["column-number"]),
      "status-code": Number(data["status-code"]),
    };
  }

  /**
   * Set report-only mode (don't enforce, just report violations).
   * Useful for testing policies before full deployment.
   */
  setReportOnly(enabled: boolean): void {
    this.reportOnly = enabled;
  }

  /**
   * Get current environment.
   */
  getEnvironment(): CspEnvironment {
    return this.environment;
  }
}
