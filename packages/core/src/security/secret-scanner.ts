/**
 * Secret Scanner — Detection of leaked secrets in requests.
 *
 * Scans request bodies for leaked secrets:
 * - API keys (AWS, GitHub, Stripe, etc.)
 * - Passwords in URLs or bodies
 * - Database credentials
 * - Private tokens
 *
 * Key features:
 * - Pattern matching for common secret formats
 * - Alert/block modes
 * - Redaction in logs
 * - Custom secret patterns
 * - Entropy-based detection (high-entropy strings)
 *
 * @example
 * const scanner = new SecretScanner({ mode: "block" });
 * const result = scanner.scanString("aws_access_key_id=AKIAIOSFODNN7EXAMPLE");
 */

/**
 * Secret scanner configuration.
 */
export interface SecretScannerConfig {
  /** Mode: "alert" (log only) or "block" (reject request) */
  mode?: "alert" | "block";
  /** Enable entropy-based detection */
  entropyDetection?: boolean;
  /** Entropy threshold (0-1, default 0.7) */
  entropyThreshold?: number;
  /** Custom secret patterns to detect */
  customPatterns?: Array<{ name: string; pattern: RegExp }>;
}

/**
 * Secret detection result.
 */
export interface SecretDetectionResult {
  /** Whether secrets were detected */
  secretsFound: boolean;
  /** Array of detected secrets */
  secrets: Array<{
    type: string;
    pattern: string;
    value?: string; // Never exposed
    location: string;
    confidence: number; // 0-100
  }>;
  /** Redacted version of input */
  redacted?: string;
  /** Recommended action */
  action: "ALLOW" | "ALERT" | "BLOCK";
  /** Message for user */
  message?: string;
}

/**
 * Secret pattern definition.
 */
interface SecretPattern {
  name: string;
  pattern: RegExp;
  entropy?: boolean; // Should apply entropy check
}

/**
 * Scanner for detecting leaked secrets in requests.
 */
export class SecretScanner {
  private config: Required<SecretScannerConfig>;
  private patterns: SecretPattern[] = [];

  /**
   * Initialize secret scanner.
   * @param config - Configuration options
   */
  constructor(config: SecretScannerConfig = {}) {
    this.config = {
      mode: config.mode || "alert",
      entropyDetection: config.entropyDetection !== false,
      entropyThreshold: config.entropyThreshold || 0.7,
      customPatterns: config.customPatterns || [],
    };

    this.initializePatterns();
    this.addCustomPatterns();
  }

  /**
   * Initialize built-in secret patterns.
   */
  private initializePatterns(): void {
    this.patterns = [
      // AWS
      {
        name: "AWS Access Key",
        pattern: /AKIA[0-9A-Z]{16}/,
      },
      {
        name: "AWS Secret Key",
        pattern: /aws_secret_access_key\s*=\s*[A-Za-z0-9/+=]{40}/,
      },

      // GitHub
      {
        name: "GitHub Token",
        pattern: /ghp_[a-zA-Z0-9_]{36,255}/,
      },
      {
        name: "GitHub OAuth Token",
        pattern: /gho_[a-zA-Z0-9_]{36,255}/,
      },
      {
        name: "GitHub Personal Access Token",
        pattern: /github_pat_[a-zA-Z0-9_]{36,255}/,
      },

      // Stripe
      {
        name: "Stripe Secret Key",
        pattern: /sk_live_[a-zA-Z0-9]{20,}/,
      },
      {
        name: "Stripe Publishable Key",
        pattern: /pk_live_[a-zA-Z0-9]{20,}/,
      },

      // Google
      {
        name: "Google API Key",
        pattern: /AIza[0-9A-Za-z\\-_]{35}/,
      },

      // Database credentials in URLs
      {
        name: "MongoDB URI",
        pattern:
          /mongodb(?:\+srv)?:\/\/[^@:]+:[^@]+@[^\s/]+(?:\/[^\s?]*)?(?:\?[^\s]*)*/,
      },
      {
        name: "PostgreSQL URI",
        pattern:
          /postgres(?:ql)?:\/\/[^@:]+:[^@]+@[^\s/]+(?:\/[^\s?]*)?(?:\?[^\s]*)*/,
      },
      {
        name: "MySQL URI",
        pattern:
          /mysql:\/\/[^@:]+:[^@]+@[^\s/]+(?:\/[^\s?]*)?(?:\?[^\s]*)*/,
      },

      // Private Keys
      {
        name: "RSA Private Key",
        pattern: /-----BEGIN RSA PRIVATE KEY-----/,
      },
      {
        name: "OpenSSH Private Key",
        pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/,
      },
      {
        name: "PGP Private Key",
        pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/,
      },

      // Generic patterns
      {
        name: "Password Parameter",
        pattern: /password\s*[:=]\s*['""]([^'""\s]+)['""]?/i,
      },
      {
        name: "API Key Parameter",
        pattern: /api[_-]?key\s*[:=]\s*['""]?([a-zA-Z0-9_-]+)['""]?/i,
      },
      {
        name: "Authorization Header",
        pattern: /authorization:\s*bearer\s+[a-zA-Z0-9._-]+/i,
      },

      // JWT Tokens
      {
        name: "JWT Token",
        pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/,
      },

      // Common secret variables
      {
        name: "Secret Variable",
        pattern: /secret\s*[:=]\s*['""]?([^\s'"",}]+)['""]?/i,
      },
      {
        name: "Token Variable",
        pattern: /token\s*[:=]\s*['""]?([^\s'"",}]+)['""]?/i,
      },
    ];
  }

  /**
   * Add custom secret patterns.
   */
  private addCustomPatterns(): void {
    for (const custom of this.config.customPatterns) {
      this.patterns.push({
        name: custom.name,
        pattern: custom.pattern,
      });
    }
  }

  /**
   * Calculate Shannon entropy of a string.
   * Measures randomness (0-1 scale).
   * @param str - String to analyze
   * @returns Entropy value (0-1)
   */
  private calculateEntropy(str: string): number {
    const len = str.length;
    if (len === 0) return 0;

    const frequency: Record<string, number> = {};
    for (const char of str) {
      frequency[char] = (frequency[char] || 0) + 1;
    }

    let entropy = 0;
    for (const count of Object.values(frequency)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    // Normalize to 0-1
    return Math.min(entropy / 8, 1);
  }

  /**
   * Check if string is high-entropy secret.
   * @param str - String to check
   * @returns true if entropy exceeds threshold
   */
  private isHighEntropy(str: string): boolean {
    if (!this.config.entropyDetection) {
      return false;
    }

    // Skip very short strings and spaces
    if (str.length < 32 || str.includes(" ")) {
      return false;
    }

    const entropy = this.calculateEntropy(str);
    return entropy > this.config.entropyThreshold;
  }

  /**
   * Scan a string for secrets.
   * @param value - String to scan
   * @param fieldName - Field name (for context)
   * @returns Detection result
   */
  scanString(value: string, fieldName?: string): SecretDetectionResult {
    const secrets: SecretDetectionResult["secrets"] = [];

    // Pattern matching
    for (const patternDef of this.patterns) {
      const match = patternDef.pattern.exec(value);
      if (match) {
        secrets.push({
          type: patternDef.name,
          pattern: patternDef.pattern.source,
          location: fieldName || "request_body",
          confidence: 95,
        });
      }
    }

    // Entropy-based detection
    if (this.config.entropyDetection) {
      const parts = value.split(/[\s,;:|='""\[\]{}()]/);
      for (const part of parts) {
        if (this.isHighEntropy(part)) {
          secrets.push({
            type: "High Entropy String",
            pattern: "<entropy_check>",
            location: fieldName || "request_body",
            confidence: 75,
          });
          break;
        }
      }
    }

    // Determine action
    let action: SecretDetectionResult["action"] = "ALLOW";
    let message: string | undefined;

    if (secrets.length > 0) {
      action = this.config.mode === "block" ? "BLOCK" : "ALERT";
      message =
        this.config.mode === "block"
          ? `Potential secret detected: ${secrets[0].type}. Request blocked.`
          : `Potential secret detected: ${secrets[0].type}. Review recommended.`;
    }

    return {
      secretsFound: secrets.length > 0,
      secrets,
      action,
      message,
    };
  }

  /**
   * Scan an object recursively.
   * @param obj - Object to scan
   * @returns Detection result
   */
  scanObject(obj: unknown): SecretDetectionResult {
    const allSecrets: SecretDetectionResult["secrets"] = [];
    const redactedObj = this.scanObjectRecursive(obj, "", allSecrets);

    let action: SecretDetectionResult["action"] = "ALLOW";
    let message: string | undefined;

    if (allSecrets.length > 0) {
      action = this.config.mode === "block" ? "BLOCK" : "ALERT";
      message =
        this.config.mode === "block"
          ? `Potential secrets detected (${allSecrets.length}). Request blocked.`
          : `Potential secrets detected (${allSecrets.length}). Review recommended.`;
    }

    return {
      secretsFound: allSecrets.length > 0,
      secrets: allSecrets,
      redacted: JSON.stringify(redactedObj),
      action,
      message,
    };
  }

  /**
   * Recursively scan object.
   */
  private scanObjectRecursive(
    obj: unknown,
    path: string,
    secrets: SecretDetectionResult["secrets"],
    depth: number = 0
  ): unknown {
    // Prevent deep recursion
    if (depth > 10) {
      return obj;
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === "string") {
      const result = this.scanString(obj, path);
      if (result.secretsFound) {
        secrets.push(...result.secrets);
        return "[REDACTED]";
      }
      return obj;
    }

    if (typeof obj === "number" || typeof obj === "boolean") {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item, idx) =>
        this.scanObjectRecursive(item, `${path}[${idx}]`, secrets, depth + 1)
      );
    }

    if (typeof obj === "object") {
      const scanned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        const fieldPath = path ? `${path}.${key}` : key;
        scanned[key] = this.scanObjectRecursive(
          value,
          fieldPath,
          secrets,
          depth + 1
        );
      }
      return scanned;
    }

    return obj;
  }

  /**
   * Redact secrets from a string.
   * @param value - String containing potential secrets
   * @returns Redacted string
   */
  redactString(value: string): string {
    let redacted = value;

    for (const patternDef of this.patterns) {
      redacted = redacted.replace(patternDef.pattern, `[REDACTED_${patternDef.name.toUpperCase()}]`);
    }

    return redacted;
  }

  /**
   * Get scanner mode.
   */
  getMode(): "alert" | "block" {
    return this.config.mode;
  }

  /**
   * Set scanner mode.
   */
  setMode(mode: "alert" | "block"): void {
    this.config.mode = mode;
  }

  /**
   * Get list of detection patterns.
   */
  getPatterns(): string[] {
    return this.patterns.map((p) => p.name);
  }
}
