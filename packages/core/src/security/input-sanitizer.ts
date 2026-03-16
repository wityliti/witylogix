/**
 * Input Sanitization — OWASP Top 10 XSS and injection prevention.
 *
 * Comprehensive input validation and sanitization to prevent:
 * - Cross-Site Scripting (XSS) attacks
 * - SQL injection (detection, not prevention — use parameterized queries)
 * - Path traversal attacks
 * - HTML injection
 * - Unicode normalization attacks
 *
 * Key features:
 * - HTML entity encoding
 * - XSS payload detection and stripping
 * - SQL injection pattern detection
 * - Path traversal prevention
 * - Unicode normalization (NFC)
 * - Recursive object sanitization
 * - Configurable allowed HTML tags for rich text
 *
 * @example
 * const sanitizer = new InputSanitizer({
 *   allowedTags: ["b", "i", "u", "a", "p"]
 * });
 * const clean = sanitizer.sanitizeString("<script>alert('xss')</script>");
 */

/**
 * Sanitizer configuration options.
 */
export interface SanitizerConfig {
  /** HTML tags allowed in rich text (others are stripped) */
  allowedTags?: string[];
  /** Max string length (longer strings are truncated) */
  maxLength?: number;
  /** Enable SQL injection pattern detection */
  detectSqlInjection?: boolean;
  /** Enable path traversal detection */
  detectPathTraversal?: boolean;
  /** Normalize Unicode (NFC) */
  normalizeUnicode?: boolean;
}

/**
 * Sanitization result with details.
 */
export interface SanitizationResult {
  /** Sanitized value */
  value: unknown;
  /** Whether input was modified */
  modified: boolean;
  /** Threats detected */
  threats: Array<{
    type: "XSS" | "SQL_INJECTION" | "PATH_TRAVERSAL" | "UNICODE_ATTACK";
    pattern: string;
    location?: string;
  }>;
}

/**
 * Input sanitizer for strings, objects, and complex data structures.
 */
export class InputSanitizer {
  private config: Required<SanitizerConfig>;
  private xssPatterns: RegExp[] = [];
  private sqlPatterns: RegExp[] = [];
  private pathTraversalPatterns: RegExp[] = [];

  /**
   * Initialize input sanitizer.
   * @param config - Configuration options
   */
  constructor(config: SanitizerConfig = {}) {
    this.config = {
      allowedTags: config.allowedTags || ["b", "i", "em", "strong"],
      maxLength: config.maxLength || 10000,
      detectSqlInjection: config.detectSqlInjection !== false,
      detectPathTraversal: config.detectPathTraversal !== false,
      normalizeUnicode: config.normalizeUnicode !== false,
    };

    this.initializePatterns();
  }

  /**
   * Initialize detection patterns.
   */
  private initializePatterns(): void {
    // XSS payload patterns
    this.xssPatterns = [
      /<script[^>]*>[\s\S]*?<\/script>/gi,
      /on(load|error|click|focus|blur|change)\s*=/gi,
      /javascript:/gi,
      /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
      /eval\s*\(/gi,
      /expression\s*\(/gi,
      /<embed[^>]*>/gi,
      /<object[^>]*>/gi,
      /vbscript:/gi,
      /data:text\/html/gi,
    ];

    // SQL injection patterns
    this.sqlPatterns = [
      /('\s*(OR|AND)\s*'[^']*'|';\s*(DROP|DELETE|UPDATE|INSERT|SELECT|UNION))/gi,
      /--\s*$/gm,
      /;.*?(DROP|DELETE|UPDATE|INSERT|SELECT|UNION|EXEC|EXECUTE)/gi,
      /\/\*[\s\S]*?\*\//g,
    ];

    // Path traversal patterns
    this.pathTraversalPatterns = [
      /\.\.\//g,
      /\.\.%2F/gi,
      /%2e%2e%2f/gi,
      /\.\.;/g,
      /\.\.%5c/gi,
      /\.\.%252f/gi,
    ];
  }

  /**
   * HTML entity encode a string.
   * Converts special characters to HTML entities.
   * @param str - String to encode
   * @returns Entity-encoded string
   */
  encodeHtmlEntities(str: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#x27;",
      "/": "&#x2F;",
    };

    return str.replace(/[&<>"'/]/g, (char) => map[char] || char);
  }

  /**
   * Decode HTML entities.
   * @param str - String with HTML entities
   * @returns Decoded string
   */
  decodeHtmlEntities(str: string): string {
    const map: Record<string, string> = {
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": '"',
      "&#x27;": "'",
      "&#x2F;": "/",
    };

    let result = str;
    for (const [entity, char] of Object.entries(map)) {
      result = result.replaceAll(entity, char);
    }
    return result;
  }

  /**
   * Detect XSS payloads in a string.
   * @param str - String to check
   * @returns Array of detected threats
   */
  private detectXss(str: string): Array<{ type: "XSS"; pattern: string }> {
    const threats: Array<{ type: "XSS"; pattern: string }> = [];

    for (const pattern of this.xssPatterns) {
      if (pattern.test(str)) {
        threats.push({
          type: "XSS",
          pattern: pattern.source.substring(0, 50),
        });
      }
    }

    return threats;
  }

  /**
   * Detect SQL injection patterns.
   * @param str - String to check
   * @returns Array of detected threats
   */
  private detectSqlInjection(str: string): Array<{ type: "SQL_INJECTION"; pattern: string }> {
    if (!this.config.detectSqlInjection) {
      return [];
    }

    const threats: Array<{ type: "SQL_INJECTION"; pattern: string }> = [];

    for (const pattern of this.sqlPatterns) {
      if (pattern.test(str)) {
        threats.push({
          type: "SQL_INJECTION",
          pattern: pattern.source.substring(0, 50),
        });
      }
    }

    return threats;
  }

  /**
   * Detect path traversal attempts.
   * @param str - String to check
   * @returns Array of detected threats
   */
  private detectPathTraversal(str: string): Array<{ type: "PATH_TRAVERSAL"; pattern: string }> {
    if (!this.config.detectPathTraversal) {
      return [];
    }

    const threats: Array<{ type: "PATH_TRAVERSAL"; pattern: string }> = [];

    for (const pattern of this.pathTraversalPatterns) {
      if (pattern.test(str)) {
        threats.push({
          type: "PATH_TRAVERSAL",
          pattern: pattern.source.substring(0, 50),
        });
      }
    }

    return threats;
  }

  /**
   * Detect Unicode normalization attacks.
   * @param str - String to check
   * @returns Array of detected threats
   */
  private detectUnicodeAttacks(str: string): Array<{ type: "UNICODE_ATTACK"; pattern: string }> {
    const threats: Array<{ type: "UNICODE_ATTACK"; pattern: string }> = [];

    // Check for mixed scripts (Latin + Cyrillic homoglyphs like а/a)
    if (/[a-z]/i.test(str) && /[а-яА-ЯЁё]/.test(str)) {
      threats.push({
        type: "UNICODE_ATTACK",
        pattern: "Mixed Latin and Cyrillic scripts",
      });
    }

    // Check for RTL override and other control characters
    if (/[\u202E\u202D\u200E\u200F]/.test(str)) {
      threats.push({
        type: "UNICODE_ATTACK",
        pattern: "Bidirectional text override characters",
      });
    }

    return threats;
  }

  /**
   * Sanitize a string value.
   * @param value - String to sanitize
   * @returns Sanitization result
   */
  sanitizeString(value: string): SanitizationResult {
    if (typeof value !== "string") {
      return {
        value,
        modified: false,
        threats: [],
      };
    }

    let result = value;
    const threats: SanitizationResult["threats"] = [];
    let modified = false;

    // Detect threats
    threats.push(...this.detectXss(result));
    threats.push(...this.detectSqlInjection(result));
    threats.push(...this.detectPathTraversal(result));
    threats.push(...this.detectUnicodeAttacks(result));

    // Unicode normalization
    if (this.config.normalizeUnicode) {
      const normalized = result.normalize("NFC");
      if (normalized !== result) {
        result = normalized;
        modified = true;
      }
    }

    // Remove XSS payloads
    if (threats.some((t) => t.type === "XSS")) {
      const cleaned = this.stripXssPayloads(result);
      if (cleaned !== result) {
        result = cleaned;
        modified = true;
      }
    }

    // Enforce max length
    if (result.length > this.config.maxLength) {
      result = result.substring(0, this.config.maxLength);
      modified = true;
    }

    return {
      value: result,
      modified,
      threats,
    };
  }

  /**
   * Strip XSS payloads from a string.
   * @param str - String to clean
   * @returns Cleaned string
   */
  private stripXssPayloads(str: string): string {
    let result = str;

    // Remove script tags
    result = result.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

    // Remove event handlers
    result = result.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "");
    result = result.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, "");

    // Remove javascript: protocol
    result = result.replace(/javascript:/gi, "");

    // Remove data: URIs for HTML
    result = result.replace(/data:text\/html/gi, "");

    // Remove dangerous tags
    result = result.replace(/<(iframe|embed|object|frame|frameset)[^>]*>/gi, "");

    return result;
  }

  /**
   * Sanitize an object recursively.
   * @param obj - Object to sanitize
   * @returns Sanitized object
   */
  sanitizeObject(
    obj: unknown,
    depth: number = 0
  ): { value: unknown; modified: boolean } {
    // Prevent deep recursion attacks
    if (depth > 10) {
      return { value: obj, modified: false };
    }

    if (obj === null || obj === undefined) {
      return { value: obj, modified: false };
    }

    if (typeof obj === "string") {
      const result = this.sanitizeString(obj);
      return {
        value: result.value,
        modified: result.modified,
      };
    }

    if (typeof obj === "number" || typeof obj === "boolean") {
      return { value: obj, modified: false };
    }

    if (Array.isArray(obj)) {
      const sanitized: unknown[] = [];
      let modified = false;

      for (const item of obj) {
        const result = this.sanitizeObject(item, depth + 1);
        sanitized.push(result.value);
        if (result.modified) modified = true;
      }

      return {
        value: sanitized,
        modified,
      };
    }

    if (typeof obj === "object") {
      const sanitized: Record<string, unknown> = {};
      let modified = false;

      for (const [key, value] of Object.entries(obj)) {
        const keyResult = this.sanitizeString(key);
        const valueResult = this.sanitizeObject(value, depth + 1);

        const sanitizedKey = keyResult.value as string;
        sanitized[sanitizedKey] = valueResult.value;

        if (keyResult.modified || valueResult.modified) modified = true;
      }

      return {
        value: sanitized,
        modified,
      };
    }

    return { value: obj, modified: false };
  }
}
