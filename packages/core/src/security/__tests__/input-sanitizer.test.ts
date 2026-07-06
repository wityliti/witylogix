/**
 * Input Sanitizer Tests — XSS, SQL injection, and path traversal prevention.
 *
 * Tests cover:
 * - HTML entity encoding/decoding
 * - XSS payload detection and stripping
 * - SQL injection pattern detection
 * - Path traversal detection
 * - Unicode normalization
 * - Recursive object sanitization
 *
 * Run with: npm test -- input-sanitizer.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { InputSanitizer } from "../input-sanitizer";

describe("InputSanitizer", () => {
  let sanitizer: InputSanitizer;

  beforeEach(() => {
    sanitizer = new InputSanitizer({
      allowedTags: ["b", "i", "em", "strong"],
    });
  });

  describe("HTML Entity Encoding", () => {
    it("should encode special characters", () => {
      const encoded = sanitizer.encodeHtmlEntities(
        '<script>alert("xss")</script>',
      );
      expect(encoded).toContain("&lt;");
      expect(encoded).toContain("&gt;");
      expect(encoded).not.toContain("<script>");
    });

    it("should encode quotes", () => {
      const encoded = sanitizer.encodeHtmlEntities('attribute="value"');
      expect(encoded).toContain("&quot;");
    });

    it("should encode ampersand", () => {
      const encoded = sanitizer.encodeHtmlEntities("Tom & Jerry");
      expect(encoded).toContain("&amp;");
    });
  });

  describe("HTML Entity Decoding", () => {
    it("should decode HTML entities", () => {
      const decoded = sanitizer.decodeHtmlEntities("&lt;script&gt;");
      expect(decoded).toBe("<script>");
    });

    it("should decode quotes", () => {
      const decoded = sanitizer.decodeHtmlEntities("&quot;hello&quot;");
      expect(decoded).toBe('"hello"');
    });
  });

  describe("XSS Detection", () => {
    it("should detect script tags", () => {
      const result = sanitizer.sanitizeString('<script>alert("xss")</script>');
      expect(result.threats.some((t) => t.type === "XSS")).toBe(true);
    });

    it("should detect event handlers", () => {
      const result = sanitizer.sanitizeString(
        '<img src="x" onerror="alert(\'xss\')">',
      );
      expect(result.threats.some((t) => t.type === "XSS")).toBe(true);
    });

    it("should detect javascript: protocol", () => {
      const result = sanitizer.sanitizeString('<a href="javascript:void(0)">');
      expect(result.threats.some((t) => t.type === "XSS")).toBe(true);
    });

    it("should detect data: URIs", () => {
      const result = sanitizer.sanitizeString(
        '<img src="data:text/html,<script>alert(1)</script>">',
      );
      expect(result.threats.some((t) => t.type === "XSS")).toBe(true);
    });
  });

  describe("XSS Stripping", () => {
    it("should strip script tags", () => {
      const result = sanitizer.sanitizeString(
        "Hello <script>alert('xss')</script> world",
      );
      expect(result.value).not.toContain("<script>");
      expect(result.value).toContain("Hello");
      expect(result.value).toContain("world");
    });

    it("should strip event handlers", () => {
      const result = sanitizer.sanitizeString(
        "<div onclick=\"alert('xss')\">content</div>",
      );
      expect(result.value).not.toContain("onclick");
    });
  });

  describe("SQL Injection Detection", () => {
    it("should detect SQL injection patterns", () => {
      const result = sanitizer.sanitizeString("'; DROP TABLE users; --");
      expect(result.threats.some((t) => t.type === "SQL_INJECTION")).toBe(true);
    });

    it("should detect UNION-based injection", () => {
      const result = sanitizer.sanitizeString(
        "1' UNION SELECT * FROM users --",
      );
      expect(result.threats.some((t) => t.type === "SQL_INJECTION")).toBe(true);
    });

    it("should allow normal text with quotes", () => {
      const result = sanitizer.sanitizeString("I don't like this");
      // Should not trigger false positive for normal text
      expect(result.threats.length).toBe(0);
    });
  });

  describe("Path Traversal Detection", () => {
    it("should detect ../ sequences", () => {
      const result = sanitizer.sanitizeString("../../etc/passwd");
      expect(result.threats.some((t) => t.type === "PATH_TRAVERSAL")).toBe(
        true,
      );
    });

    it("should detect encoded traversal", () => {
      const result = sanitizer.sanitizeString("..%2f..%2fetc%2fpasswd");
      expect(result.threats.some((t) => t.type === "PATH_TRAVERSAL")).toBe(
        true,
      );
    });
  });

  describe("Unicode Normalization", () => {
    it("should normalize Unicode to NFC", () => {
      const denormalized = "café"; // é as separate combining character
      const result = sanitizer.sanitizeString(denormalized);
      expect(result.value).toBe(denormalized.normalize("NFC"));
    });

    it("should detect mixed scripts (Cyrillic + Latin)", () => {
      const result = sanitizer.sanitizeString("привет a");
      expect(result.threats.some((t) => t.type === "UNICODE_ATTACK")).toBe(
        true,
      );
    });
  });

  describe("String Sanitization", () => {
    it("should not modify safe strings", () => {
      const safe = "Hello, World!";
      const result = sanitizer.sanitizeString(safe);
      expect(result.value).toBe(safe);
      expect(result.modified).toBe(false);
    });

    it("should mark modified input", () => {
      const result = sanitizer.sanitizeString('<script>alert("xss")</script>');
      expect(result.modified).toBe(true);
    });

    it("should enforce max length", () => {
      const shortSanitizer = new InputSanitizer({ maxLength: 10 });
      const result = shortSanitizer.sanitizeString(
        "This is a very long string",
      );
      expect(result.value.length).toBeLessThanOrEqual(10);
    });
  });

  describe("Object Sanitization", () => {
    it("should sanitize string values in object", () => {
      const obj = {
        name: "<script>alert('xss')</script>",
        email: "test@example.com",
      };
      const result = sanitizer.sanitizeObject(obj);
      expect((result.value as any).name).not.toContain("<script>");
    });

    it("should handle nested objects", () => {
      const obj = {
        user: {
          name: "John",
          profile: {
            bio: "<img onerror='alert(1)'>",
          },
        },
      };
      const result = sanitizer.sanitizeObject(obj);
      const sanitized = result.value as any;
      expect(sanitized.user.profile.bio).not.toContain("onerror");
    });

    it("should handle arrays", () => {
      const obj = {
        items: ["<script>xss</script>", "normal text"],
      };
      const result = sanitizer.sanitizeObject(obj);
      const sanitized = result.value as any;
      expect(sanitized.items[0]).not.toContain("<script>");
    });

    it("should sanitize object keys", () => {
      const obj: Record<string, string> = {
        "<script>key</script>": "value",
      };
      const result = sanitizer.sanitizeObject(obj);
      const sanitized = result.value as Record<string, string>;
      const keys = Object.keys(sanitized);
      expect(keys[0]).not.toContain("<script>");
    });

    it("should prevent deep recursion attacks", () => {
      const obj: any = { level1: {} };
      let current = obj.level1;

      // Create deeply nested object
      for (let i = 0; i < 20; i++) {
        current.nested = {};
        current = current.nested;
      }

      expect(() => {
        sanitizer.sanitizeObject(obj);
      }).not.toThrow();
    });
  });

  describe("Configuration Options", () => {
    it("should disable SQL injection detection", () => {
      const noSql = new InputSanitizer({ detectSqlInjection: false });
      const result = noSql.sanitizeString("'; DROP TABLE users; --");
      expect(result.threats.some((t) => t.type === "SQL_INJECTION")).toBe(
        false,
      );
    });

    it("should disable path traversal detection", () => {
      const noPath = new InputSanitizer({ detectPathTraversal: false });
      const result = noPath.sanitizeString("../../etc/passwd");
      expect(result.threats.some((t) => t.type === "PATH_TRAVERSAL")).toBe(
        false,
      );
    });

    it("should disable Unicode normalization", () => {
      const noUnicode = new InputSanitizer({ normalizeUnicode: false });
      const original = "café";
      const result = noUnicode.sanitizeString(original);
      expect(result.modified).toBe(false);
    });
  });

  describe("Type Handling", () => {
    it("should pass through non-string types", () => {
      const result = sanitizer.sanitizeObject(123);
      expect(result.value).toBe(123);
      expect(result.modified).toBe(false);
    });

    it("should pass through null and undefined", () => {
      expect(sanitizer.sanitizeObject(null).value).toBeNull();
      expect(sanitizer.sanitizeObject(undefined).value).toBeUndefined();
    });
  });
});
