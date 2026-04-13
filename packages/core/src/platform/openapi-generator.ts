/**
 * OpenAPI 3.1 Specification Generator
 *
 * Introspects Fastify routes and generates a complete OpenAPI specification
 * with:
 * - Automatic schema extraction from Zod validators
 * - Path/query/body parameter documentation
 * - Security scheme definitions (Bearer, API Key)
 * - Route grouping by prefix (tags)
 * - Swagger UI middleware
 */

import type { FastifyInstance } from "fastify";
import type { ZodSchema } from "zod";

// ─── Types ──────────────────────────────────────────────────────

export interface OpenAPIDocument {
  openapi: "3.1.0";
  info: {
    title: string;
    version: string;
    description?: string;
    contact?: {
      name?: string;
      email?: string;
      url?: string;
    };
    license?: {
      name: string;
      url?: string;
    };
  };
  servers: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, Record<string, any>>;
  components: {
    schemas: Record<string, any>;
    securitySchemes: Record<string, any>;
  };
  security?: Array<Record<string, string[]>>;
  tags?: Array<{
    name: string;
    description?: string;
  }>;
}

export interface OpenAPIGeneratorConfig {
  title: string;
  version: string;
  description?: string;
  baseUrl?: string;
  contact?: {
    name?: string;
    email?: string;
    url?: string;
  };
}

export interface OpenAPIRouteInfo {
  path: string;
  method: string;
  handler?: Function;
  schema?: {
    params?: ZodSchema;
    query?: ZodSchema;
    body?: ZodSchema;
    response?: Record<number, ZodSchema>;
  };
  tags?: string[];
  description?: string;
}

// ─── JSON Schema Converter ───────────────────────────────────────

export function zodToJsonSchema(schema: ZodSchema): Record<string, any> {
  const result: Record<string, any> = {};

  // Basic type inference from Zod schema
  // Zod stores type info in _def.typeName (e.g. "ZodString", "ZodArray")
  const def = (schema as any)._def;
  const zodType =
    (schema as any)._type ||
    (def?.typeName ? def.typeName.replace("Zod", "").toLowerCase() : undefined);

  switch (zodType) {
    case "string":
      result.type = "string";
      if ((schema as any).minLength !== undefined) {
        result.minLength = (schema as any).minLength;
      }
      if ((schema as any).maxLength !== undefined) {
        result.maxLength = (schema as any).maxLength;
      }
      break;

    case "number":
      result.type = (schema as any).isInt ? "integer" : "number";
      if ((schema as any).minValue !== undefined) {
        result.minimum = (schema as any).minValue;
      }
      if ((schema as any).maxValue !== undefined) {
        result.maximum = (schema as any).maxValue;
      }
      break;

    case "boolean":
      result.type = "boolean";
      break;

    case "array":
      result.type = "array";
      if ((schema as any).element || def?.type) {
        result.items = zodToJsonSchema(
          ((schema as any).element || def.type) as ZodSchema,
        );
      }
      break;

    case "object": {
      result.type = "object";
      result.properties = {};
      result.required = [];

      // Zod stores shape as a function in _def.shape() or as a direct property
      const rawShape = (schema as any).shape;
      const shape =
        typeof rawShape === "function" ? rawShape() : (rawShape ?? {});
      for (const [key, fieldSchema] of Object.entries(shape)) {
        result.properties[key] = zodToJsonSchema(fieldSchema as ZodSchema);

        // Check if field is optional
        const field = fieldSchema as any;
        if (field.isOptional !== true && field._def?.innerType === undefined) {
          result.required.push(key);
        }
      }

      if (result.required.length === 0) {
        delete result.required;
      }
      break;
    }

    case "enum":
      result.enum = (schema as any).options ?? def?.values ?? [];
      break;

    case "date":
      result.type = "string";
      result.format = "date-time";
      break;

    case "null":
    case "nativenull":
      result.type = "null";
      break;

    case "undefined":
      // Skip undefined types
      break;

    default:
      // Fallback for complex types
      result.type = "object";
      break;
  }

  return result;
}

// ─── OpenAPI Generator ──────────────────────────────────────────

export class OpenAPIGenerator {
  private config: OpenAPIGeneratorConfig;
  private schemas: Map<string, Record<string, any>> = new Map();
  private tags: Set<string> = new Set();

  constructor(config: OpenAPIGeneratorConfig) {
    this.config = {
      baseUrl: "http://localhost:3000",
      ...config,
    };
  }

  /**
   * Generate complete OpenAPI specification from Fastify instance
   */
  public generateSpec(fastifyInstance: FastifyInstance): OpenAPIDocument {
    const paths: Record<string, Record<string, any>> = {};

    // Extract routes from Fastify
    const routes = fastifyInstance.routes ?? [];

    for (const route of routes) {
      // Skip internal routes
      if (
        route.url.startsWith("/metrics") ||
        route.url.startsWith("/health") ||
        route.url.startsWith("/api/docs")
      ) {
        continue;
      }

      const path = this.normalizePath(route.url);
      const method = (route.method ?? "GET").toLowerCase();
      const tag = this.extractTag(route.url);

      if (tag) {
        this.tags.add(tag);
      }

      if (!paths[path]) {
        paths[path] = {};
      }

      paths[path][method] = this.buildOperation(route, tag);
    }

    const doc: OpenAPIDocument = {
      openapi: "3.1.0",
      info: {
        title: this.config.title,
        version: this.config.version,
        description: this.config.description,
        contact: this.config.contact,
        license: {
          name: "Proprietary",
        },
      },
      servers: [
        {
          url: this.config.baseUrl!,
          description: "API Server",
        },
      ],
      paths,
      components: {
        schemas: Object.fromEntries(this.schemas),
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "JWT token in Authorization header",
          },
          apiKey: {
            type: "apiKey",
            in: "header",
            name: "X-API-Key",
            description: "API key authentication",
          },
        },
      },
      security: [{ bearerAuth: [] }],
      tags: Array.from(this.tags).map((name) => ({
        name,
        description: `Operations related to ${name.toLowerCase()}`,
      })),
    };

    return doc;
  }

  /**
   * Convert OpenAPI spec to JSON
   */
  public toJSON(doc: OpenAPIDocument): string {
    return JSON.stringify(doc, null, 2);
  }

  /**
   * Generate Swagger UI HTML
   */
  public generateSwaggerUI(specUrl: string): string {
    return `<!DOCTYPE html>
<html>
  <head>
    <title>Witylogix API</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>
      body {
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <redoc spec-url='${specUrl}'></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc@latest/bundles/redoc.standalone.js"> </script>
  </body>
</html>`;
  }

  /**
   * Build OpenAPI operation object for a route
   */
  private buildOperation(route: any, tag?: string): Record<string, any> {
    const method = (route.method ?? "GET").toUpperCase();
    const pathSegments = route.url.split("/").filter(Boolean);
    const pathParams = this.extractPathParams(route.url);

    const operation: Record<string, any> = {
      summary: this.generateSummary(method, pathSegments),
      description: `${method} ${route.url}`,
      operationId: this.generateOperationId(method, route.url),
    };

    if (tag) {
      operation.tags = [tag];
    }

    // Parameters (path + query)
    const parameters: any[] = [];

    // Path parameters
    for (const paramName of pathParams) {
      parameters.push({
        name: paramName,
        in: "path",
        required: true,
        schema: {
          type: "string",
        },
      });
    }

    // Query parameters (generic, can be overridden per route)
    if (method === "GET" && !pathParams.includes("id")) {
      parameters.push({
        name: "limit",
        in: "query",
        schema: {
          type: "integer",
          default: 20,
        },
        description: "Number of items to return",
      });

      parameters.push({
        name: "offset",
        in: "query",
        schema: {
          type: "integer",
          default: 0,
        },
        description: "Number of items to skip",
      });
    }

    if (parameters.length > 0) {
      operation.parameters = parameters;
    }

    // Request body (POST, PUT, PATCH)
    if (["POST", "PUT", "PATCH"].includes(method)) {
      operation.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              additionalProperties: true,
            },
          },
        },
      };
    }

    // Responses
    operation.responses = {
      "200": {
        description: "Successful response",
        content: {
          "application/json": {
            schema: {
              type: "object",
            },
          },
        },
      },
      "400": {
        description: "Bad request",
      },
      "401": {
        description: "Unauthorized",
      },
      "404": {
        description: "Not found",
      },
      "500": {
        description: "Internal server error",
      },
    };

    return operation;
  }

  /**
   * Extract path parameters from URL pattern (e.g., :id, {id})
   */
  private extractPathParams(path: string): string[] {
    const params: string[] = [];
    const paramRegex = /[:{](\w+)[}]?/g;
    let match: RegExpExecArray | null;

    // eslint-disable-next-line no-cond-assign
    while ((match = paramRegex.exec(path)) !== null) {
      params.push(match[1]);
    }

    return params;
  }

  /**
   * Normalize path for OpenAPI (convert :id to {id})
   */
  private normalizePath(path: string): string {
    return path.replace(/:(\w+)/g, "{$1}");
  }

  /**
   * Extract tag from route path (first segment after /api/)
   */
  private extractTag(path: string): string | undefined {
    const match = path.match(/\/(?:api\/)?(\w+)/);
    if (match && match[1] && match[1] !== "health" && match[1] !== "metrics") {
      return match[1].charAt(0).toUpperCase() + match[1].slice(1);
    }
    return undefined;
  }

  /**
   * Generate operation ID from method and path
   */
  private generateOperationId(method: string, path: string): string {
    const segments = path.split("/").filter(Boolean);
    const verb = this.methodToVerb(method);
    const resource = segments[segments.length - 1] || segments[0] || "resource";

    return `${verb}${resource.charAt(0).toUpperCase()}${resource.slice(1)}`;
  }

  /**
   * Convert HTTP method to verb
   */
  private methodToVerb(method: string): string {
    const verbs: Record<string, string> = {
      GET: "get",
      POST: "create",
      PUT: "update",
      PATCH: "patch",
      DELETE: "delete",
    };

    return verbs[method] || method.toLowerCase();
  }

  /**
   * Generate human-readable summary
   */
  private generateSummary(method: string, pathSegments: string[]): string {
    const resource = pathSegments[pathSegments.length - 1] || "resource";
    const action = this.methodToAction(method);

    return `${action} ${resource}`;
  }

  /**
   * Convert HTTP method to action
   */
  private methodToAction(method: string): string {
    const actions: Record<string, string> = {
      GET: "Retrieve",
      POST: "Create",
      PUT: "Update",
      PATCH: "Modify",
      DELETE: "Delete",
    };

    return actions[method] || method;
  }
}

// ─── Fastify Plugin ─────────────────────────────────────────────

export async function serveSwaggerUI(
  fastify: FastifyInstance,
  config: OpenAPIGeneratorConfig,
): Promise<void> {
  const generator = new OpenAPIGenerator(config);

  // Lazy-load routes after all are registered
  fastify.addHook("onReady", async () => {
    const spec = generator.generateSpec(fastify);

    // Serve OpenAPI spec JSON
    fastify.get("/api/docs/spec", async (request, reply) => {
      return spec;
    });

    // Serve Swagger UI HTML
    fastify.get("/api/docs", async (request, reply) => {
      const html = generator.generateSwaggerUI("/api/docs/spec");
      reply.type("text/html").send(html);
    });

    // Serve ReDoc (alternative documentation UI)
    fastify.get("/api/docs/redoc", async (_request, reply) => {
      const html = `<!DOCTYPE html>
<html>
  <head>
    <title>Witylogix API - ReDoc</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>
      body {
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <redoc spec-url='/api/docs/spec'></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc@latest/bundles/redoc.standalone.js"> </script>
  </body>
</html>`;
      reply.type("text/html").send(html);
    });
  });
}

/**
 * Utility function to create a config with defaults
 */
export function createOpenAPIConfig(
  overrides?: Partial<OpenAPIGeneratorConfig>,
): OpenAPIGeneratorConfig {
  return {
    title: "Witylogix Platform API",
    version: "4.0.0",
    description: "Last-mile delivery logistics SaaS platform",
    baseUrl: process.env.API_URL || "http://localhost:3000",
    contact: {
      name: "Witylogix Support",
      email: "support@witylogix.com",
      url: "https://witylogix.com",
    },
    ...overrides,
  };
}

/**
 * Export OpenAPI spec to JSON file
 */
export async function exportOpenAPISpec(
  fastify: FastifyInstance,
  config: OpenAPIGeneratorConfig,
  filePath: string,
): Promise<void> {
  const generator = new OpenAPIGenerator(config);
  const spec = generator.generateSpec(fastify);
  const json = generator.toJSON(spec);

  const fs = await import("fs").then((m) => m.promises);
  await fs.writeFile(filePath, json, "utf-8");
}

/**
 * Validate OpenAPI spec conformance
 */
export function validateOpenAPISpec(doc: OpenAPIDocument): string[] {
  const errors: string[] = [];

  if (!doc.openapi) {
    errors.push("Missing openapi version");
  }

  if (!doc.info || !doc.info.title || !doc.info.version) {
    errors.push("Missing required info (title, version)");
  }

  if (!doc.paths || Object.keys(doc.paths).length === 0) {
    errors.push("No paths defined in specification");
  }

  for (const [path, methods] of Object.entries(doc.paths)) {
    if (!path.startsWith("/")) {
      errors.push(`Path must start with /: ${path}`);
    }

    for (const [method, operation] of Object.entries(methods)) {
      if (!operation.responses) {
        errors.push(`${method.toUpperCase()} ${path} missing responses`);
      }
    }
  }

  return errors;
}
