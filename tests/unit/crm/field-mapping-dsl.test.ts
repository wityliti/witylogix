/**
 * Unit tests for Field Mapping DSL
 *
 * @module tests/unit/crm/field-mapping-dsl.test.ts
 */

import { describe, it, expect } from "vitest";
import { FieldMappingDSL } from "../../../packages/core/src/crm/crm-sync-engine-v3.js";

describe("FieldMappingDSL", () => {
  describe("Basic Mapping", () => {
    it("should create direct field mapping", () => {
      const dsl = new FieldMappingDSL();

      dsl.map("email").to("emailAddress");

      const rules = dsl.getRules();

      expect(rules.length).toBe(1);
      expect(rules[0].sourceField).toBe("email");
      expect(rules[0].targetField).toBe("emailAddress");
      expect(rules[0].required).toBe(true);
    });

    it("should create multiple mappings", () => {
      const dsl = new FieldMappingDSL();

      dsl.map("firstName").to("first_name");
      dsl.map("lastName").to("last_name");
      dsl.map("email").to("emailAddress");

      const rules = dsl.getRules();

      expect(rules.length).toBe(3);
    });

    it("should handle nested field paths", () => {
      const dsl = new FieldMappingDSL();

      dsl.map("contact.email").to("customer.emailAddress");

      const rules = dsl.getRules();

      expect(rules[0].sourceField).toBe("contact.email");
      expect(rules[0].targetField).toBe("customer.emailAddress");
    });
  });

  describe("Transformations", () => {
    it("should apply transformation function", () => {
      const dsl = new FieldMappingDSL();

      const toUpperCase = (value: unknown) => (value as string).toUpperCase();
      dsl.map("name").transform(toUpperCase).to("NAME");

      const rules = dsl.getRules();

      expect(rules[0].transform).toBeDefined();
      expect(rules[0].transform!("hello")).toBe("HELLO");
    });

    it("should apply numeric transformation", () => {
      const dsl = new FieldMappingDSL();

      const currencyConvert = (value: unknown) => (value as number) * 1.1;
      dsl.map("amount").transform(currencyConvert).to("total");

      const rules = dsl.getRules();

      expect(rules[0].transform!(100)).toBe(110);
    });

    it("should support context in transformations", () => {
      const dsl = new FieldMappingDSL();

      const transform = (value: unknown, context?: Record<string, unknown>) => {
        const multiplier = (context?.multiplier as number) || 1;
        return (value as number) * multiplier;
      };

      dsl.map("price").transform(transform).to("total");

      const rules = dsl.getRules();

      expect(rules[0].transform!(100, { multiplier: 2 })).toBe(200);
    });

    it("should chain transformations with conditions", () => {
      const dsl = new FieldMappingDSL();

      const notEmpty = (value: unknown) =>
        value !== null && value !== undefined && value !== "";
      const toUpperCase = (value: unknown) => (value as string).toUpperCase();

      dsl
        .map("company")
        .when(notEmpty)
        .transform(toUpperCase)
        .to("COMPANY_NAME");

      const rules = dsl.getRules();

      expect(rules[0].condition).toBeDefined();
      expect(rules[0].transform).toBeDefined();
      expect(rules[0].condition!("test")).toBe(true);
      expect(rules[0].condition!("")).toBe(false);
      expect(rules[0].transform!("hello")).toBe("HELLO");
    });
  });

  describe("Conditions", () => {
    it("should apply condition predicate", () => {
      const dsl = new FieldMappingDSL();

      const isPositive = (value: unknown) => (value as number) > 0;
      dsl.map("amount").when(isPositive).to("validAmount");

      const rules = dsl.getRules();

      expect(rules[0].condition).toBeDefined();
      expect(rules[0].condition!(10)).toBe(true);
      expect(rules[0].condition!(-5)).toBe(false);
    });

    it("should support common predicates", () => {
      const dsl = new FieldMappingDSL();

      const notEmpty = (value: unknown) =>
        value !== null && value !== undefined && value !== "";
      const isEmail = (value: unknown) =>
        typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

      dsl.map("email").when(isEmail).to("validEmail");
      dsl.map("name").when(notEmpty).to("displayName");

      const rules = dsl.getRules();

      expect(rules.length).toBe(2);
      expect(rules[0].condition!("test@example.com")).toBe(true);
      expect(rules[0].condition!("invalid")).toBe(false);
      expect(rules[1].condition!("John")).toBe(true);
      expect(rules[1].condition!("")).toBe(false);
    });
  });

  describe("Data Types", () => {
    it("should set data type for field", () => {
      const dsl = new FieldMappingDSL();

      dsl.map("email").asType("string").to("emailAddress");
      dsl.map("amount").asType("number").to("total");
      dsl.map("isActive").asType("boolean").to("active");
      dsl.map("createdAt").asType("date").to("createdDate");

      const rules = dsl.getRules();

      expect(rules[0].dataType).toBe("string");
      expect(rules[1].dataType).toBe("number");
      expect(rules[2].dataType).toBe("boolean");
      expect(rules[3].dataType).toBe("date");
    });
  });

  describe("Required Fields", () => {
    it("should mark field as required by default", () => {
      const dsl = new FieldMappingDSL();

      dsl.map("email").to("emailAddress");

      const rules = dsl.getRules();

      expect(rules[0].required).toBe(true);
    });

    it("should mark field as optional", () => {
      const dsl = new FieldMappingDSL();

      dsl.map("phone").optional().to("phoneNumber");

      const rules = dsl.getRules();

      expect(rules[0].required).toBe(false);
    });

    it("should support optional with other modifiers", () => {
      const dsl = new FieldMappingDSL();

      const notEmpty = (value: unknown) =>
        value !== null && value !== undefined && value !== "";

      dsl.map("nickname").optional().when(notEmpty).to("displayNickname");

      const rules = dsl.getRules();

      expect(rules[0].required).toBe(false);
      expect(rules[0].condition).toBeDefined();
    });
  });

  describe("Complex Mappings", () => {
    it("should create realistic contact mapping", () => {
      const dsl = new FieldMappingDSL();

      const notEmpty = (value: unknown) =>
        value !== null && value !== undefined && value !== "";
      const normalizeEmail = (value: unknown) =>
        (value as string).toLowerCase().trim();

      dsl.map("email").transform(normalizeEmail).to("emailAddress");
      dsl.map("firstName").asType("string").to("firstName");
      dsl.map("lastName").asType("string").to("lastName");
      dsl.map("phone").optional().to("phoneNumber");
      dsl.map("company").optional().when(notEmpty).to("companyName");

      const rules = dsl.getRules();

      expect(rules.length).toBe(5);
      expect(rules[0].transform!("  TEST@EXAMPLE.COM  ")).toBe(
        "test@example.com",
      );
      expect(rules[2].required).toBe(true);
      expect(rules[3].required).toBe(false);
    });

    it("should create realistic deal mapping", () => {
      const dsl = new FieldMappingDSL();

      const minAmount = (value: unknown) => (value as number) >= 0;
      const convertCurrency = (value: unknown) => (value as number) * 1.1;

      dsl.map("dealName").to("name");
      dsl
        .map("amount")
        .when(minAmount)
        .transform(convertCurrency)
        .asType("number")
        .to("totalAmount");
      dsl.map("stage").to("status");
      dsl.map("closeDate").asType("date").to("expectedCloseDate");
      dsl.map("owner").optional().to("ownerId");

      const rules = dsl.getRules();

      expect(rules.length).toBe(5);
      expect(rules[1].condition!(500)).toBe(true);
      expect(rules[1].condition!(-100)).toBe(false);
      expect(rules[1].transform!(1000)).toBe(1100);
    });
  });

  describe("DSL Fluency", () => {
    it("should support fluent chaining", () => {
      const dsl = new FieldMappingDSL();

      dsl.map("email").asType("string").to("emailAddress").getRules();

      const rules = dsl.getRules();

      expect(rules.length).toBe(1);
    });

    it("should clear rules", () => {
      const dsl = new FieldMappingDSL();

      dsl.map("email").to("emailAddress");
      dsl.map("name").to("displayName");

      expect(dsl.getRules().length).toBe(2);

      dsl.clear();

      expect(dsl.getRules().length).toBe(0);
    });

    it("should reuse DSL for multiple configurations", () => {
      const dsl = new FieldMappingDSL();

      // First mapping configuration
      dsl.map("email").to("emailAddress");
      dsl.map("name").to("displayName");

      const rules1 = dsl.getRules();
      expect(rules1.length).toBe(2);

      // Clear and create second configuration
      dsl.clear();
      dsl.map("phone").to("phoneNumber");
      dsl.map("address").to("locationAddress");

      const rules2 = dsl.getRules();
      expect(rules2.length).toBe(2);
      expect(rules2[0].sourceField).toBe("phone");
    });
  });

  describe("Error Handling", () => {
    it("should throw error if source or target missing", () => {
      const dsl = new FieldMappingDSL();

      expect(() => {
        dsl.map("").to("target");
      }).toThrow();
    });

    it("should throw error if target missing", () => {
      const dsl = new FieldMappingDSL();

      expect(() => {
        dsl.map("source").to("");
      }).toThrow();
    });

    it("should handle transformation errors gracefully", () => {
      const dsl = new FieldMappingDSL();

      const badTransform = () => {
        throw new Error("Transform failed");
      };

      dsl.map("value").transform(badTransform).to("result");

      const rules = dsl.getRules();

      expect(() => {
        rules[0].transform!("test");
      }).toThrow("Transform failed");
    });
  });
});
