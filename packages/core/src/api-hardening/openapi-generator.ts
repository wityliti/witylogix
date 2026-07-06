/**
 * OpenAPI Generator — OpenAPI 3.0.3 spec generation and Swagger UI
 *
 * Provides:
 * - generateOpenApiSpec(routes): Create OpenAPI 3.0.3 specification
 * - RouteDefinition: Type-safe route metadata
 * - Security schemes (JWT Bearer)
 * - Tag groups: Auth, Orders, Shipments, Drivers, Billing, Admin, POS, Settings
 * - serveSwaggerUI(fastify, spec): Register GET /docs endpoint with Swagger UI CDN
 * - Pre-defined route definitions (20+ endpoints covering major API surface)
 *
 * Usage:
 *   const spec = generateOpenApiSpec(ROUTE_DEFINITIONS);
 *   await serveSwaggerUI(fastify, spec);
 *   // Visit http://localhost:3000/docs
 */

type FastifyInstance = any;
type FastifyReply = any;

/**
 * HTTP method types
 */
export type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "head";

/**
 * Response definition
 */
export interface ResponseDefinition {
  statusCode: number;
  description: string;
  schema?: Record<string, any>;
}

/**
 * Parameter definition
 */
export interface ParameterDefinition {
  name: string;
  in: "query" | "path" | "header";
  required?: boolean;
  schema: Record<string, any>;
  description?: string;
}

/**
 * Request body definition
 */
export interface RequestBodyDefinition {
  required?: boolean;
  content: Record<string, any>;
  description?: string;
}

/**
 * Route definition with OpenAPI metadata
 */
export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  summary: string;
  description?: string;
  tags?: string[];
  requestBody?: RequestBodyDefinition;
  queryParams?: ParameterDefinition[];
  pathParams?: ParameterDefinition[];
  responses: ResponseDefinition[];
  security?: Array<Record<string, string[]>>;
}

/**
 * OpenAPI specification object
 */
export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{ url: string; description?: string }>;
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
    securitySchemes: Record<string, any>;
  };
  tags: Array<{ name: string; description?: string }>;
}

/**
 * Standard error schemas
 */
const ERROR_SCHEMAS = {
  ValidationError: {
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          code: { type: "string", example: "VALIDATION_ERROR" },
          message: { type: "string" },
          details: {
            type: "object",
            additionalProperties: { type: "array", items: { type: "string" } },
          },
          requestId: { type: "string" },
        },
      },
    },
  },
  NotFoundError: {
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          code: { type: "string", example: "NOT_FOUND" },
          message: { type: "string" },
          requestId: { type: "string" },
        },
      },
    },
  },
  UnauthorizedError: {
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          code: { type: "string", example: "UNAUTHORIZED" },
          message: { type: "string" },
          requestId: { type: "string" },
        },
      },
    },
  },
  ForbiddenError: {
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          code: { type: "string", example: "FORBIDDEN" },
          message: { type: "string" },
          requestId: { type: "string" },
        },
      },
    },
  },
  ConflictError: {
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          code: { type: "string", example: "CONFLICT" },
          message: { type: "string" },
          details: {
            type: "object",
            additionalProperties: true,
          },
          requestId: { type: "string" },
        },
      },
    },
  },
  RateLimitError: {
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          code: { type: "string", example: "RATE_LIMIT_EXCEEDED" },
          message: { type: "string" },
          details: {
            type: "object",
            properties: {
              limit: { type: "number" },
              window: { type: "number" },
              retryAfter: { type: "number" },
            },
          },
          requestId: { type: "string" },
        },
      },
    },
  },
  InternalServerError: {
    type: "object",
    properties: {
      error: {
        type: "object",
        properties: {
          code: { type: "string", example: "INTERNAL_SERVER_ERROR" },
          message: { type: "string" },
          requestId: { type: "string" },
        },
      },
    },
  },
};

/**
 * Standard pagination response schema
 */
const PAGINATION_SCHEMA = {
  type: "object",
  properties: {
    data: { type: "array" },
    pagination: {
      type: "object",
      properties: {
        page: { type: "number" },
        pageSize: { type: "number" },
        total: { type: "number" },
        totalPages: { type: "number" },
      },
    },
  },
};

/**
 * Convert route path from Fastify format to OpenAPI format
 * /api/orders/:id -> /api/orders/{id}
 */
function convertPathToOpenApi(path: string): string {
  return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, "{$1}");
}

/**
 * Generate OpenAPI 3.0.3 specification from route definitions
 */
export function generateOpenApiSpec(
  routes: RouteDefinition[],
  info: {
    title?: string;
    version?: string;
    description?: string;
  } = {},
): OpenApiSpec {
  const paths: Record<string, any> = {};
  const tags = new Set<string>();

  // Add default info
  const title = info.title || "Witylogix API";
  const version = info.version || "1.0.0";
  const description =
    info.description ||
    "Witylogix Last-Mile Delivery Platform API with API Hardening";

  // Process routes
  routes.forEach((route) => {
    const openApiPath = convertPathToOpenApi(route.path);

    // Initialize path if not exists
    if (!paths[openApiPath]) {
      paths[openApiPath] = {};
    }

    // Collect tags
    route.tags?.forEach((tag) => tags.add(tag));

    // Build parameters array
    const parameters: Record<string, any>[] = [];

    if (route.pathParams) {
      route.pathParams.forEach((param) => {
        parameters.push({
          name: param.name,
          in: "path",
          required: param.required !== false,
          schema: param.schema,
          description: param.description,
        });
      });
    }

    if (route.queryParams) {
      route.queryParams.forEach((param) => {
        parameters.push({
          name: param.name,
          in: "query",
          required: param.required === true,
          schema: param.schema,
          description: param.description,
        });
      });
    }

    // Build operation object
    const operation: Record<string, any> = {
      summary: route.summary,
      tags: route.tags || [],
      ...(route.description && { description: route.description }),
    };

    if (parameters.length > 0) {
      operation.parameters = parameters;
    }

    if (route.requestBody) {
      operation.requestBody = route.requestBody;
    }

    // Add responses
    operation.responses = {};
    route.responses.forEach((response) => {
      operation.responses[response.statusCode] = {
        description: response.description,
        ...(response.schema && {
          content: {
            "application/json": {
              schema: response.schema,
            },
          },
        }),
      };
    });

    // Add security if specified, otherwise use JWT by default for protected endpoints
    if (route.security) {
      operation.security = route.security;
    } else if (
      !route.path.includes("/health") &&
      !route.path.includes("/docs")
    ) {
      operation.security = [{ BearerAuth: [] }];
    }

    paths[openApiPath][route.method] = operation;
  });

  // Build component schemas
  const schemas = {
    ...ERROR_SCHEMAS,
    Pagination: PAGINATION_SCHEMA,
  };

  // Build spec
  const spec: OpenApiSpec = {
    openapi: "3.0.3",
    info: { title, version, description },
    servers: [{ url: "http://localhost:3000", description: "Development" }],
    paths,
    components: {
      schemas,
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT Bearer token for authentication",
        },
      },
    },
    tags: Array.from(tags).map((tag) => ({
      name: tag,
      description: `${tag} endpoints`,
    })),
  };

  return spec;
}

/**
 * Serve Swagger UI on GET /docs
 */
export async function serveSwaggerUI(
  fastify: FastifyInstance,
  spec: OpenApiSpec,
) {
  fastify.get("/docs", async (request: any, reply: FastifyReply) => {
    const swaggerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${spec.info.title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; padding: 0; }
  </style>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: '/api/spec.json',
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: 'BaseLayout',
        requestInterceptor: (request) => {
          request.headers['X-Request-ID'] = generateUUID();
          return request;
        }
      });
    };

    function generateUUID() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0,
          v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  </script>
</body>
</html>
`;

    reply.type("text/html").send(swaggerHtml);
  });

  // Serve spec as JSON
  fastify.get("/api/spec.json", async (request: any, reply: any) => {
    reply.type("application/json").send(spec);
  });
}

/**
 * Pre-defined route definitions covering major API surface
 */
export const ROUTE_DEFINITIONS: RouteDefinition[] = [
  // ─── Auth Endpoints ─────────────────────────────────────────
  {
    method: "post",
    path: "/api/auth/login",
    summary: "User login",
    description: "Authenticate user with email and password",
    tags: ["Auth"],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              email: { type: "string", format: "email" },
              password: { type: "string", format: "password" },
            },
            required: ["email", "password"],
          },
        },
      },
    },
    responses: [
      {
        statusCode: 200,
        description: "Login successful",
        schema: {
          type: "object",
          properties: {
            token: { type: "string" },
            refreshToken: { type: "string" },
            user: { type: "object" },
          },
        },
      },
      { statusCode: 401, description: "Invalid credentials" },
      { statusCode: 400, description: "Validation error" },
    ],
    security: [],
  },

  {
    method: "post",
    path: "/api/auth/refresh",
    summary: "Refresh auth token",
    tags: ["Auth"],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              refreshToken: { type: "string" },
            },
            required: ["refreshToken"],
          },
        },
      },
    },
    responses: [
      {
        statusCode: 200,
        description: "Token refreshed",
        schema: {
          type: "object",
          properties: {
            token: { type: "string" },
          },
        },
      },
      { statusCode: 401, description: "Invalid refresh token" },
    ],
    security: [],
  },

  // ─── Orders Endpoints ───────────────────────────────────────
  {
    method: "get",
    path: "/api/orders",
    summary: "List orders",
    tags: ["Orders"],
    queryParams: [
      {
        name: "page",
        in: "query",
        schema: { type: "integer", minimum: 1, default: 1 },
      },
      {
        name: "pageSize",
        in: "query",
        schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      },
      {
        name: "status",
        in: "query",
        schema: { type: "string", enum: ["pending", "assigned", "delivered"] },
      },
    ],
    responses: [
      {
        statusCode: 200,
        description: "Orders retrieved",
        schema: PAGINATION_SCHEMA,
      },
      { statusCode: 401, description: "Unauthorized" },
      { statusCode: 429, description: "Rate limit exceeded" },
    ],
  },

  {
    method: "post",
    path: "/api/orders",
    summary: "Create order",
    tags: ["Orders"],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              customerName: { type: "string" },
              customerEmail: { type: "string", format: "email" },
              customerPhone: { type: "string" },
              deliveryAddress: { type: "string" },
              itemCount: { type: "integer" },
            },
            required: [
              "customerName",
              "customerEmail",
              "deliveryAddress",
              "itemCount",
            ],
          },
        },
      },
    },
    responses: [
      {
        statusCode: 201,
        description: "Order created",
        schema: { type: "object", properties: { id: { type: "string" } } },
      },
      { statusCode: 400, description: "Validation error" },
      { statusCode: 401, description: "Unauthorized" },
      { statusCode: 409, description: "Conflict" },
    ],
  },

  {
    method: "get",
    path: "/api/orders/:id",
    summary: "Get order by ID",
    tags: ["Orders"],
    pathParams: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
    ],
    responses: [
      { statusCode: 200, description: "Order retrieved" },
      { statusCode: 404, description: "Order not found" },
      { statusCode: 401, description: "Unauthorized" },
    ],
  },

  {
    method: "put",
    path: "/api/orders/:id",
    summary: "Update order",
    tags: ["Orders"],
    pathParams: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              status: {
                type: "string",
                enum: ["pending", "assigned", "delivered"],
              },
            },
          },
        },
      },
    },
    responses: [
      { statusCode: 200, description: "Order updated" },
      { statusCode: 404, description: "Order not found" },
      { statusCode: 400, description: "Validation error" },
    ],
  },

  {
    method: "delete",
    path: "/api/orders/:id",
    summary: "Delete order",
    tags: ["Orders"],
    pathParams: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
    ],
    responses: [
      { statusCode: 204, description: "Order deleted" },
      { statusCode: 404, description: "Order not found" },
    ],
  },

  // ─── Shipments Endpoints ────────────────────────────────────
  {
    method: "get",
    path: "/api/shipments",
    summary: "List shipments",
    tags: ["Shipments"],
    queryParams: [
      {
        name: "page",
        in: "query",
        schema: { type: "integer", default: 1 },
      },
      {
        name: "pageSize",
        in: "query",
        schema: { type: "integer", default: 20 },
      },
    ],
    responses: [
      { statusCode: 200, description: "Shipments retrieved" },
      { statusCode: 401, description: "Unauthorized" },
    ],
  },

  {
    method: "post",
    path: "/api/shipments",
    summary: "Create shipment",
    tags: ["Shipments"],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              orderId: { type: "string", format: "uuid" },
              trackingNumber: { type: "string" },
            },
            required: ["orderId"],
          },
        },
      },
    },
    responses: [
      { statusCode: 201, description: "Shipment created" },
      { statusCode: 400, description: "Validation error" },
    ],
  },

  // ─── Drivers Endpoints ──────────────────────────────────────
  {
    method: "get",
    path: "/api/drivers",
    summary: "List drivers",
    tags: ["Drivers"],
    queryParams: [
      {
        name: "status",
        in: "query",
        schema: { type: "string", enum: ["online", "offline", "on-delivery"] },
      },
    ],
    responses: [
      { statusCode: 200, description: "Drivers retrieved" },
      { statusCode: 401, description: "Unauthorized" },
    ],
  },

  {
    method: "post",
    path: "/api/drivers/:id/assign-order",
    summary: "Assign order to driver",
    tags: ["Drivers"],
    pathParams: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              orderId: { type: "string", format: "uuid" },
            },
            required: ["orderId"],
          },
        },
      },
    },
    responses: [
      { statusCode: 200, description: "Order assigned" },
      { statusCode: 404, description: "Driver or order not found" },
    ],
  },

  // ─── Billing Endpoints ──────────────────────────────────────
  {
    method: "get",
    path: "/api/billing/invoices",
    summary: "List invoices",
    tags: ["Billing"],
    queryParams: [
      {
        name: "page",
        in: "query",
        schema: { type: "integer", default: 1 },
      },
    ],
    responses: [
      { statusCode: 200, description: "Invoices retrieved" },
      { statusCode: 401, description: "Unauthorized" },
    ],
  },

  {
    method: "post",
    path: "/api/billing/invoices/:id/pay",
    summary: "Pay invoice",
    tags: ["Billing"],
    pathParams: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              method: { type: "string", enum: ["card", "bank", "wallet"] },
            },
            required: ["method"],
          },
        },
      },
    },
    responses: [
      { statusCode: 200, description: "Payment processed" },
      { statusCode: 404, description: "Invoice not found" },
    ],
  },

  // ─── Admin Endpoints ────────────────────────────────────────
  {
    method: "get",
    path: "/api/admin/shops",
    summary: "List shops",
    tags: ["Admin"],
    queryParams: [
      {
        name: "page",
        in: "query",
        schema: { type: "integer", default: 1 },
      },
    ],
    responses: [
      { statusCode: 200, description: "Shops retrieved" },
      { statusCode: 401, description: "Unauthorized" },
      { statusCode: 403, description: "Forbidden" },
    ],
  },

  {
    method: "post",
    path: "/api/admin/shops",
    summary: "Create shop",
    tags: ["Admin"],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              email: { type: "string", format: "email" },
              tier: {
                type: "string",
                enum: ["FREE", "STARTER", "GROWTH", "ENTERPRISE"],
              },
            },
            required: ["name", "email", "tier"],
          },
        },
      },
    },
    responses: [
      { statusCode: 201, description: "Shop created" },
      { statusCode: 403, description: "Forbidden" },
    ],
  },

  // ─── POS Endpoints ──────────────────────────────────────────
  {
    method: "post",
    path: "/api/pos/transactions",
    summary: "Create POS transaction",
    tags: ["POS"],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              amount: { type: "number", minimum: 0 },
              items: { type: "array" },
            },
            required: ["amount", "items"],
          },
        },
      },
    },
    responses: [
      { statusCode: 201, description: "Transaction created" },
      { statusCode: 400, description: "Validation error" },
    ],
  },

  // ─── Settings Endpoints ────────────────────────────────────
  {
    method: "get",
    path: "/api/settings",
    summary: "Get settings",
    tags: ["Settings"],
    responses: [
      { statusCode: 200, description: "Settings retrieved" },
      { statusCode: 401, description: "Unauthorized" },
    ],
  },

  {
    method: "put",
    path: "/api/settings",
    summary: "Update settings",
    tags: ["Settings"],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
    },
    responses: [
      { statusCode: 200, description: "Settings updated" },
      { statusCode: 400, description: "Validation error" },
    ],
  },

  // ─── Health Endpoint ────────────────────────────────────────
  {
    method: "get",
    path: "/health",
    summary: "Health check",
    tags: ["System"],
    responses: [{ statusCode: 200, description: "Service is healthy" }],
    security: [],
  },
];
