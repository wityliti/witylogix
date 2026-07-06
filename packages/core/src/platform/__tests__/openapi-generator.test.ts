/**
 * OpenAPI Generator Test Suite
 * 20+ comprehensive tests covering spec generation, schema conversion, and validation
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  OpenAPIGenerator,
  type OpenAPIGeneratorConfig,
  type OpenAPIDocument,
  zodToJsonSchema,
  validateOpenAPISpec,
  createOpenAPIConfig,
} from "../openapi-generator";
import { z } from "zod";

// ─── Test Fixtures ──────────────────────────────────────────────

const mockFastifyInstance = {
  routes: [
    {
      url: "/orders",
      method: "GET",
    },
    {
      url: "/orders/:id",
      method: "GET",
    },
    {
      url: "/orders",
      method: "POST",
    },
    {
      url: "/orders/:id",
      method: "PUT",
    },
    {
      url: "/orders/:id",
      method: "DELETE",
    },
    {
      url: "/drivers",
      method: "GET",
    },
    {
      url: "/drivers/:id",
      method: "GET",
    },
    {
      url: "/drivers",
      method: "POST",
    },
    {
      url: "/shipments/:shipmentId/tracking",
      method: "GET",
    },
    {
      url: "/api/v1/integration/shopify/webhook",
      method: "POST",
    },
  ],
} as any;

const testConfig: OpenAPIGeneratorConfig = {
  title: "Test API",
  version: "1.0.0",
  description: "Test OpenAPI specification",
  baseUrl: "http://localhost:3000",
  contact: {
    name: "Test Support",
    email: "test@example.com",
  },
};

// ─── Zod to JSON Schema Converter Tests ──────────────────────────

describe("zodToJsonSchema", () => {
  it("should convert string schema", () => {
    const schema = z.string();
    const jsonSchema = zodToJsonSchema(schema);

    expect(jsonSchema.type).toBe("string");
  });

  it("should convert number schema", () => {
    const schema = z.number();
    const jsonSchema = zodToJsonSchema(schema);

    expect(jsonSchema.type).toBe("number");
  });

  it("should convert boolean schema", () => {
    const schema = z.boolean();
    const jsonSchema = zodToJsonSchema(schema);

    expect(jsonSchema.type).toBe("boolean");
  });

  it("should convert array schema", () => {
    const schema = z.array(z.string());
    const jsonSchema = zodToJsonSchema(schema);

    expect(jsonSchema.type).toBe("array");
    expect(jsonSchema.items).toBeDefined();
  });

  it("should convert enum schema", () => {
    const schema = z.enum(["small", "medium", "large"]);
    const jsonSchema = zodToJsonSchema(schema);

    expect(jsonSchema.enum).toEqual(["small", "medium", "large"]);
  });

  it("should convert date schema", () => {
    const schema = z.date();
    const jsonSchema = zodToJsonSchema(schema);

    expect(jsonSchema.type).toBe("string");
    expect(jsonSchema.format).toBe("date-time");
  });

  it("should convert object schema with properties", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      email: z.string().email(),
    });

    const jsonSchema = zodToJsonSchema(schema);

    expect(jsonSchema.type).toBe("object");
    expect(jsonSchema.properties).toBeDefined();
    expect(jsonSchema.properties.name).toBeDefined();
    expect(jsonSchema.properties.age).toBeDefined();
    expect(jsonSchema.properties.email).toBeDefined();
  });
});

// ─── OpenAPI Generator Tests ────────────────────────────────────

describe("OpenAPIGenerator", () => {
  let generator: OpenAPIGenerator;

  beforeEach(() => {
    generator = new OpenAPIGenerator(testConfig);
  });

  describe("Basic Specification Generation", () => {
    it("should create OpenAPI generator with config", () => {
      expect(generator).toBeDefined();
    });

    it("should generate valid OpenAPI spec", () => {
      const spec = generator.generateSpec(mockFastifyInstance);

      expect(spec).toBeDefined();
      expect(spec.openapi).toBe("3.1.0");
      expect(spec.info.title).toBe("Test API");
      expect(spec.info.version).toBe("1.0.0");
    });

    it("should include info section with contact", () => {
      const spec = generator.generateSpec(mockFastifyInstance);

      expect(spec.info.contact).toBeDefined();
      expect(spec.info.contact?.name).toBe("Test Support");
      expect(spec.info.contact?.email).toBe("test@example.com");
    });

    it("should include servers", () => {
      const spec = generator.generateSpec(mockFastifyInstance);

      expect(spec.servers).toBeDefined();
      expect(spec.servers.length).toBeGreaterThan(0);
      expect(spec.servers[0].url).toContain("localhost");
    });

    it("should include paths from routes", () => {
      const spec = generator.generateSpec(mockFastifyInstance);

      expect(spec.paths).toBeDefined();
      expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
    });
  });

  describe("Path Normalization", () => {
    it("should normalize path with single parameter", () => {
      const spec = generator.generateSpec(mockFastifyInstance);

      expect(spec.paths["/orders/{id}"]).toBeDefined();
    });

    it("should normalize path with multiple parameters", () => {
      const spec = generator.generateSpec(mockFastifyInstance);

      expect(spec.paths["/shipments/{shipmentId}/tracking"]).toBeDefined();
    });

    it("should handle paths without parameters", () => {
      const spec = generator.generateSpec(mockFastifyInstance);

      expect(spec.paths["/orders"]).toBeDefined();
    });
  });

  describe("Route Tagging", () => {
    it("should extract tags from route paths", () => {
      const spec = generator.generateSpec(mockFastifyInstance);

      expect(spec.tags).toBeDefined();
      expect(spec.tags?.length).toBeGreaterThan(0);

      const tagNames = spec.tags?.map((t) => t.name) ?? [];
      expect(tagNames).toContain("Orders");
    });

    it("should skip internal routes in tags", () => {
      const spec = generator.generateSpec(mockFastifyInstance);

      const tagNames = spec.tags?.map((t) => t.name) ?? [];
      expect(tagNames).not.toContain("Health");
      expect(tagNames).not.toContain("Metrics");
    });

    it("should group operations by tag", () => {
      const spec = generator.generateSpec(mockFastifyInstance);

      const ordersOps = Object.entries(spec.paths["/orders"] ?? {}).filter(
        ([method]) => method !== "parameters",
      );

      for (const [_, op] of ordersOps) {
        expect(op.tags).toContain("Orders");
      }
    });
  });

  describe("Operation Building", () => {
    it("should build GET operation with query parameters", () => {
      const spec = generator.generateSpec(mockFastifyInstance);

      const getOp = spec.paths["/orders"]?.get;

      expect(getOp).toBeDefined();
      expect(getOp?.parameters).toBeDefined();

      const paramNames = getOp?.parameters?.map((p: any) => p.name) ?? [];
      expect(paramNames).toContain("limit");
      expect(paramNames).toContain("offset");
    });

    it("should build POST operation with request body", () => {
      const spec = generator.generateSpec(mockFastifyInstance);

      const postOp = spec.paths["/orders"]?.post;

      expect(postOp).toBeDefined();
      expect(postOp?.requestBody).toBeDefined();
      expect(postOp?.requestBody?.content["application/json"]).toBeDefined();
    });

    it("should build DELETE operation", () => {
      const spec = generator.generateSpec(mockFastifyInstance);

      const delOp = spec.paths["/orders/{id}"]?.delete;

      expect(delOp).toBeDefined();
      expect(delOp?.responses).toBeDefined();
    });

    it("should include responses for all operations", () => {
      const spec = generator.generateSpec(mockFastifyInstance);

      for (const [path, methods] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(methods)) {
          if (method !== "parameters") {
            expect(operation.responses).toBeDefined();
            expect(operation.responses["200"]).toBeDefined();
          }
        }
      }
    });

    it("should generate operation IDs", () => {
      const spec = generator.generateSpec(mockFastifyInstance);

      const getOp = spec.paths["/orders"]?.get;

      expect(getOp?.operationId).toBeDefined();
      expect(typeof getOp?.operationId).toBe("string");
    });

    it("should generate summaries", () => {
      const spec = generator.generateSpec(mockFastifyInstance);

      const getOp = spec.paths["/orders"]?.get;

      expect(getOp?.summary).toBeDefined();
      expect(typeof getOp?.summary).toBe("string");
    });
  });

  describe("Components and Security", () => {
    it("should include security schemes", () => {
      const spec = generator.generateSpec(mockFastifyInstance);

      expect(spec.components.securitySchemes).toBeDefined();
      expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
      expect(spec.components.securitySchemes.apiKey).toBeDefined();
    });

    it("should include bearer auth scheme", () => {
      const spec = generator.generateSpec(mockFastifyInstance);

      const bearer = spec.components.securitySchemes.bearerAuth;

      expect(bearer.type).toBe("http");
      expect(bearer.scheme).toBe("bearer");
      expect(bearer.bearerFormat).toBe("JWT");
    });

    it("should include API key scheme", () => {
      const spec = generator.generateSpec(mockFastifyInstance);

      const apiKey = spec.components.securitySchemes.apiKey;

      expect(apiKey.type).toBe("apiKey");
      expect(apiKey.in).toBe("header");
      expect(apiKey.name).toBe("X-API-Key");
    });

    it("should apply default security requirement", () => {
      const spec = generator.generateSpec(mockFastifyInstance);

      expect(spec.security).toBeDefined();
      expect(spec.security?.length).toBeGreaterThan(0);
    });
  });

  describe("JSON Serialization", () => {
    it("should serialize spec to JSON", () => {
      const spec = generator.generateSpec(mockFastifyInstance);

      const json = generator.toJSON(spec);

      expect(json).toBeDefined();
      expect(typeof json).toBe("string");

      const parsed = JSON.parse(json);
      expect(parsed.openapi).toBe("3.1.0");
    });

    it("should produce valid JSON", () => {
      const spec = generator.generateSpec(mockFastifyInstance);

      const json = generator.toJSON(spec);

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it("should include all spec properties in JSON", () => {
      const spec = generator.generateSpec(mockFastifyInstance);

      const json = generator.toJSON(spec);
      const parsed = JSON.parse(json);

      expect(parsed.info).toBeDefined();
      expect(parsed.servers).toBeDefined();
      expect(parsed.paths).toBeDefined();
      expect(parsed.components).toBeDefined();
    });
  });

  describe("Swagger UI Generation", () => {
    it("should generate Swagger UI HTML", () => {
      const html = generator.generateSwaggerUI("/api/docs/spec");

      expect(html).toBeDefined();
      expect(typeof html).toBe("string");
      expect(html).toContain("DOCTYPE");
      expect(html).toContain("redoc");
    });

    it("should include spec URL in HTML", () => {
      const specUrl = "/api/docs/spec";
      const html = generator.generateSwaggerUI(specUrl);

      expect(html).toContain(specUrl);
    });
  });
});

// ─── Specification Validation Tests ────────────────────────────

describe("OpenAPI Specification Validation", () => {
  it("should validate correct spec", () => {
    const spec: OpenAPIDocument = {
      openapi: "3.1.0",
      info: {
        title: "Test API",
        version: "1.0.0",
      },
      servers: [{ url: "http://localhost:3000" }],
      paths: {
        "/test": {
          get: {
            responses: {
              "200": {
                description: "Success",
              },
            },
          },
        },
      },
      components: {
        schemas: {},
        securitySchemes: {},
      },
    };

    const errors = validateOpenAPISpec(spec);

    expect(errors).toEqual([]);
  });

  it("should catch missing openapi version", () => {
    const spec: any = {
      info: {
        title: "Test API",
        version: "1.0.0",
      },
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {},
      },
    };

    const errors = validateOpenAPISpec(spec);

    expect(errors.some((e) => e.includes("openapi"))).toBe(true);
  });

  it("should catch missing info", () => {
    const spec: any = {
      openapi: "3.1.0",
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {},
      },
    };

    const errors = validateOpenAPISpec(spec);

    expect(errors.some((e) => e.includes("info"))).toBe(true);
  });

  it("should catch missing paths", () => {
    const spec: any = {
      openapi: "3.1.0",
      info: {
        title: "Test API",
        version: "1.0.0",
      },
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {},
      },
    };

    const errors = validateOpenAPISpec(spec);

    expect(errors.some((e) => e.includes("No paths"))).toBe(true);
  });
});

// ─── Configuration Helper Tests ─────────────────────────────────

describe("OpenAPI Configuration Helpers", () => {
  it("should create config with defaults", () => {
    const config = createOpenAPIConfig();

    expect(config.title).toBeDefined();
    expect(config.version).toBeDefined();
    expect(config.baseUrl).toBeDefined();
    expect(config.contact).toBeDefined();
  });

  it("should allow config overrides", () => {
    const config = createOpenAPIConfig({
      title: "Custom API",
      version: "2.0.0",
    });

    expect(config.title).toBe("Custom API");
    expect(config.version).toBe("2.0.0");
  });

  it("should use environment URL", () => {
    process.env.API_URL = "https://api.example.com";

    const config = createOpenAPIConfig();

    expect(config.baseUrl).toContain("api.example.com");

    delete process.env.API_URL;
  });
});
