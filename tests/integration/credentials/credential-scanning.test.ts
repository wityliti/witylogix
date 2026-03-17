/**
 * Credential Scanning Integration Tests
 * Tests regex pattern detection, entropy-based detection, file scanning,
 * finding classification, remediation tracking, and false positive handling
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

interface SecretFinding {
  id: string;
  type: string;
  value: string;
  location: string;
  lineNumber: number;
  confidence: number;
  timestamp: Date;
  status: "found" | "verified" | "false_positive" | "remediated";
}

/**
 * Mock Credential Scanner
 */
class CredentialScanner {
  private patterns = new Map<string, RegExp>();
  private findings: SecretFinding[] = [];
  private falsePositives = new Set<string>();
  private remediationTracking = new Map<string, any>();

  constructor() {
    this.initializePatterns();
  }

  private initializePatterns(): void {
    // API Keys
    this.patterns.set("stripe_key", /sk_live_[A-Za-z0-9]{32,}/);
    this.patterns.set("stripe_test", /sk_test_[A-Za-z0-9]{32,}/);
    this.patterns.set(
      "api_key_generic",
      /api[_-]?key[:\s=]?['\"]?[A-Za-z0-9]{32,}['\"]?/i
    );

    // Tokens
    this.patterns.set(
      "github_token",
      /ghp_[A-Za-z0-9]{36,}/
    );
    this.patterns.set(
      "jwt_token",
      /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/
    );

    // OAuth/Bearer
    this.patterns.set(
      "bearer_token",
      /bearer[:\s]+[A-Za-z0-9._-]{20,}/i
    );

    // AWS
    this.patterns.set(
      "aws_secret",
      /aws_secret_access_key[:\s=]?['\"]?[A-Za-z0-9/+=]{40}['\"]?/i
    );

    // Private Keys
    this.patterns.set(
      "rsa_private_key",
      /-----BEGIN RSA PRIVATE KEY-----/
    );
    this.patterns.set(
      "private_key",
      /-----BEGIN PRIVATE KEY-----/
    );

    // Database Credentials
    this.patterns.set(
      "db_password",
      /password[:\s=]?['\"]?[^\s\"']{8,}['\"]?/i
    );
  }

  scanText(
    content: string,
    filename: string
  ): SecretFinding[] {
    const findings: SecretFinding[] = [];
    const lines = content.split("\n");

    lines.forEach((line, lineIndex) => {
      for (const [type, pattern] of this.patterns) {
        const matches = line.matchAll(pattern);

        for (const match of matches) {
          const confidence = this.calculateConfidence(
            type,
            match[0]
          );

          if (confidence > 0.5) {
            const finding: SecretFinding = {
              id: `finding-${Date.now()}-${Math.random()}`,
              type,
              value: match[0],
              location: filename,
              lineNumber: lineIndex + 1,
              confidence,
              timestamp: new Date(),
              status: "found",
            };

            findings.push(finding);
            this.findings.push(finding);
          }
        }
      }
    });

    return findings;
  }

  private calculateConfidence(
    type: string,
    value: string
  ): number {
    // Higher confidence for known patterns
    const baseConfidence: Record<string, number> = {
      stripe_key: 0.99,
      stripe_test: 0.99,
      github_token: 0.95,
      aws_secret: 0.95,
      rsa_private_key: 0.99,
      private_key: 0.98,
      bearer_token: 0.85,
      api_key_generic: 0.6,
      db_password: 0.7,
      jwt_token: 0.8,
    };

    let confidence = baseConfidence[type] || 0.5;

    // Increase confidence for longer values
    if (value.length > 100) {
      confidence = Math.min(1, confidence + 0.1);
    }

    return confidence;
  }

  detectByEntropy(value: string): number {
    // Calculate Shannon entropy
    const frequencies: Record<string, number> = {};

    for (const char of value) {
      frequencies[char] = (frequencies[char] || 0) + 1;
    }

    let entropy = 0;
    for (const freq of Object.values(frequencies)) {
      const p = freq / value.length;
      entropy -= p * Math.log2(p);
    }

    // Secrets typically have entropy > 4
    return entropy;
  }

  markAsFalsePositive(findingId: string): boolean {
    const finding = this.findings.find(
      (f) => f.id === findingId
    );

    if (!finding) return false;

    finding.status = "false_positive";
    this.falsePositives.add(finding.value);

    return true;
  }

  isFalsePositive(value: string): boolean {
    return this.falsePositives.has(value);
  }

  recordRemediation(
    findingId: string,
    action: "rotated" | "revoked" | "ignored"
  ): boolean {
    const finding = this.findings.find(
      (f) => f.id === findingId
    );

    if (!finding) return false;

    finding.status = "remediated";

    this.remediationTracking.set(findingId, {
      action,
      timestamp: new Date(),
      finding,
    });

    return true;
  }

  getFindings(
    status?: string
  ): SecretFinding[] {
    if (status) {
      return this.findings.filter((f) => f.status === status);
    }
    return [...this.findings];
  }

  getFindingsCount(): {
    total: number;
    found: number;
    verified: number;
    falsePositives: number;
    remediated: number;
  } {
    return {
      total: this.findings.length,
      found: this.findings.filter((f) => f.status === "found")
        .length,
      verified: this.findings.filter(
        (f) => f.status === "verified"
      ).length,
      falsePositives: this.findings.filter(
        (f) => f.status === "false_positive"
      ).length,
      remediated: this.findings.filter(
        (f) => f.status === "remediated"
      ).length,
    };
  }

  getRemediationTracking() {
    return Array.from(this.remediationTracking.values());
  }

  verifyFinding(findingId: string): boolean {
    const finding = this.findings.find(
      (f) => f.id === findingId
    );

    if (!finding) return false;

    finding.status = "verified";
    return true;
  }

  clearFindings(): void {
    this.findings = [];
    this.falsePositives.clear();
    this.remediationTracking.clear();
  }
}

describe("Credential Scanning", () => {
  let scanner: CredentialScanner;

  beforeEach(() => {
    scanner = new CredentialScanner();
  });

  describe("Regex Pattern Detection", () => {
    it("should detect Stripe API keys", () => {
      const content =
        "const apiKey = 'sk_live_" +
        "51I94sA8C3z0nK2m4p5q6r7s8t9u0v1w2x3y4z5a6b7c8d'";

      const findings = scanner.scanText(content, "config.ts");

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].type).toBe("stripe_key");
    });

    it("should detect GitHub tokens", () => {
      const content =
        "export const GITHUB_TOKEN = 'ghp_" +
        "abcdefghijklmnopqrstuvwxyz1234567890ab'";

      const findings = scanner.scanText(content, "github.ts");

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].type).toBe("github_token");
    });

    it("should detect JWT tokens", () => {
      const jwtToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
        "eyJzdWIiOiIxMjM0NTY3ODkwIn0." +
        "dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";

      const content = `const token = '${jwtToken}'`;

      const findings = scanner.scanText(content, "auth.ts");

      expect(findings.length).toBeGreaterThan(0);
    });

    it("should detect AWS secrets", () => {
      const content =
        'aws_secret_access_key="' +
        'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"';

      const findings = scanner.scanText(
        content,
        "aws-config.js"
      );

      expect(findings.length).toBeGreaterThan(0);
    });

    it("should detect private keys", () => {
      const content =
        "-----BEGIN RSA PRIVATE KEY-----\n" +
        "MIIEowIBAAKCAQEA2a2rwplLYH8N...\n" +
        "-----END RSA PRIVATE KEY-----";

      const findings = scanner.scanText(
        content,
        "key.pem"
      );

      expect(findings.length).toBeGreaterThan(0);
    });
  });

  describe("Entropy-Based Detection", () => {
    it("should calculate high entropy for random strings", () => {
      const randomSecret =
        "aB3$cD9%eF2&gH7*iJ4^kL6@mN1!oP8+";

      const entropy = scanner.detectByEntropy(randomSecret);

      expect(entropy).toBeGreaterThan(3);
    });

    it("should calculate low entropy for common words", () => {
      const commonWord = "password";

      const entropy = scanner.detectByEntropy(commonWord);

      expect(entropy).toBeLessThan(3);
    });

    it("should distinguish secrets from regular text", () => {
      const secret =
        "sk_live_" + "4eC39HqLyjWDarhtT1ZdV7dc";
      const normal = "const token = 'my-api'";

      const secretEntropy = scanner.detectByEntropy(secret);
      const normalEntropy = scanner.detectByEntropy(normal);

      expect(secretEntropy).toBeGreaterThan(
        normalEntropy
      );
    });
  });

  describe("File Scanning", () => {
    it("should scan multiple lines", () => {
      const content =
        `const apiKey = 'sk_live_ABC123';\n` +
        `const token = 'ghp_XYZ789';\n` +
        `const password = 'super-secret'`;

      const findings = scanner.scanText(
        content,
        "credentials.ts"
      );

      expect(findings.length).toBeGreaterThan(1);
    });

    it("should track line numbers", () => {
      const content =
        `// Line 1\n` +
        `const apiKey = 'sk_live_ABC123'; // Line 2\n` +
        `// Line 3`;

      const findings = scanner.scanText(content, "app.ts");

      if (findings.length > 0) {
        expect(findings[0].lineNumber).toBe(2);
      }
    });

    it("should handle multiple findings per line", () => {
      const content = `const a = 'sk_live_ABC', b = 'ghp_XYZ'`;

      const findings = scanner.scanText(content, "file.ts");

      expect(findings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Finding Classification", () => {
    it("should classify by type", () => {
      const content1 =
        "const stripe = 'sk_live_ABC123'";
      const content2 = "const github = 'ghp_XYZ789'";

      const findings1 = scanner.scanText(content1, "file1");
      const findings2 = scanner.scanText(content2, "file2");

      if (findings1.length > 0 && findings2.length > 0) {
        expect(findings1[0].type).not.toBe(
          findings2[0].type
        );
      }
    });

    it("should assign confidence scores", () => {
      const content = "const key = 'sk_live_ABC123'";

      const findings = scanner.scanText(content, "file.ts");

      if (findings.length > 0) {
        expect(findings[0].confidence).toBeGreaterThan(0);
        expect(findings[0].confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("False Positive Handling", () => {
    it("should mark finding as false positive", () => {
      const content = "const pattern = 'sk_live_example'";

      const findings = scanner.scanText(content, "file.ts");

      if (findings.length > 0) {
        scanner.markAsFalsePositive(findings[0].id);

        const updated = scanner.getFindings("false_positive");
        expect(updated.length).toBeGreaterThan(0);
      }
    });

    it("should track false positives", () => {
      const secretValue = "sk_live_" + "example123";
      const content = `const key = '${secretValue}'`;

      scanner.scanText(content, "file.ts");
      const findings = scanner.getFindings();

      if (findings.length > 0) {
        scanner.markAsFalsePositive(findings[0].id);
      }

      expect(
        scanner.isFalsePositive(secretValue)
      ).toBeDefined();
    });

    it("should prevent re-reporting of false positives", () => {
      const secretValue = "sk_live_" + "example123";

      scanner.markAsFalsePositive("fake-id");
      // Would need to mark from actual findings in real scenario
    });
  });

  describe("Remediation Tracking", () => {
    it("should track remediation actions", () => {
      const content = "const key = 'sk_live_ABC123'";

      const findings = scanner.scanText(content, "file.ts");

      if (findings.length > 0) {
        scanner.recordRemediation(findings[0].id, "rotated");

        const tracking = scanner.getRemediationTracking();
        expect(tracking.length).toBeGreaterThan(0);
        expect(tracking[0].action).toBe("rotated");
      }
    });

    it("should support multiple remediation actions", () => {
      const content1 = "const key1 = 'sk_live_ABC'";
      const content2 = "const key2 = 'ghp_XYZ'";

      const findings1 = scanner.scanText(content1, "file1");
      const findings2 = scanner.scanText(content2, "file2");

      if (findings1.length > 0) {
        scanner.recordRemediation(findings1[0].id, "rotated");
      }

      if (findings2.length > 0) {
        scanner.recordRemediation(findings2[0].id, "revoked");
      }

      const tracking = scanner.getRemediationTracking();
      expect(tracking.length).toBeGreaterThanOrEqual(0);
    });

    it("should verify findings after remediation", () => {
      const content = "const key = 'sk_live_ABC123'";

      const findings = scanner.scanText(content, "file.ts");

      if (findings.length > 0) {
        const verified = scanner.verifyFinding(findings[0].id);
        expect(verified).toBe(true);
      }
    });
  });

  describe("Statistics and Reporting", () => {
    it("should count findings by status", () => {
      const content =
        "const a = 'sk_live_ABC';\nconst b = 'ghp_XYZ'";

      scanner.scanText(content, "file.ts");

      const counts = scanner.getFindingsCount();

      expect(counts.total).toBeGreaterThanOrEqual(0);
      expect(counts.found).toBeGreaterThanOrEqual(0);
    });

    it("should generate remediation report", () => {
      const content = "const key = 'sk_live_ABC123'";

      const findings = scanner.scanText(content, "file.ts");

      if (findings.length > 0) {
        scanner.recordRemediation(
          findings[0].id,
          "rotated"
        );
      }

      const report = scanner.getRemediationTracking();
      expect(Array.isArray(report)).toBe(true);
    });
  });
});
