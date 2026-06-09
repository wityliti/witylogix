"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Play,
  Lock,
  Code,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface ApiEndpoint {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  tag: string;
  description: string;
  authentication: "bearer" | "api_key" | "public";
  parameters?: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  requestBody?: {
    type: string;
    example: Record<string, unknown>;
  };
  responses: Array<{
    code: number;
    description: string;
    example: Record<string, unknown>;
  }>;
}

const API_ENDPOINTS: ApiEndpoint[] = [
  {
    id: "orders-list",
    method: "GET",
    path: "/api/v1/orders",
    tag: "Orders",
    description: "Retrieve a list of all orders",
    authentication: "bearer",
    parameters: [
      {
        name: "limit",
        type: "integer",
        required: false,
        description: "Maximum number of results to return (default: 20, max: 100)",
      },
      {
        name: "offset",
        type: "integer",
        required: false,
        description: "Number of results to skip",
      },
      {
        name: "status",
        type: "string",
        required: false,
        description: "Filter by order status",
      },
    ],
    responses: [
      {
        code: 200,
        description: "Successful response",
        example: {
          data: [
            {
              id: "ord-001",
              orderNumber: "ORD-2026-8945",
              status: "in_transit",
              totalAmount: 2450.0,
              items: 8,
              createdAt: "2026-03-12T14:32:10Z",
            },
          ],
          pagination: { limit: 20, offset: 0, total: 1245 },
        },
      },
      {
        code: 401,
        description: "Unauthorized - Invalid or missing authentication token",
        example: { error: "Invalid Bearer token" },
      },
    ],
  },
  {
    id: "orders-create",
    method: "POST",
    path: "/api/v1/orders",
    tag: "Orders",
    description: "Create a new order",
    authentication: "bearer",
    requestBody: {
      type: "application/json",
      example: {
        customerId: "cust-001",
        items: [
          { productId: "prod-123", quantity: 2, price: 450.0 },
          { productId: "prod-456", quantity: 1, price: 550.0 },
        ],
        shippingAddress: {
          street: "123 Main St",
          city: "San Francisco",
          state: "CA",
          zipCode: "94105",
          country: "US",
        },
      },
    },
    responses: [
      {
        code: 201,
        description: "Order created successfully",
        example: {
          id: "ord-002",
          orderNumber: "ORD-2026-8946",
          status: "pending",
          totalAmount: 1450.0,
          createdAt: "2026-03-12T14:35:22Z",
        },
      },
      {
        code: 400,
        description: "Invalid request parameters",
        example: { error: "Missing required field: customerId" },
      },
    ],
  },
  {
    id: "orders-update",
    method: "PUT",
    path: "/api/v1/orders/:id",
    tag: "Orders",
    description: "Update an existing order",
    authentication: "bearer",
    parameters: [
      {
        name: "id",
        type: "string",
        required: true,
        description: "Order ID to update",
      },
    ],
    requestBody: {
      type: "application/json",
      example: {
        status: "shipped",
        trackingNumber: "TRACK-123456789",
      },
    },
    responses: [
      {
        code: 200,
        description: "Order updated successfully",
        example: { success: true, updated: true },
      },
      {
        code: 404,
        description: "Order not found",
        example: { error: "Order not found" },
      },
    ],
  },
  {
    id: "routes-create",
    method: "POST",
    path: "/api/v1/routes",
    tag: "Routes",
    description: "Create an optimized delivery route",
    authentication: "bearer",
    requestBody: {
      type: "application/json",
      example: {
        driverId: "driver-001",
        stops: [
          { address: "123 Main St, SF", orderId: "ord-001", sequence: 1 },
          { address: "456 Oak Ave, SF", orderId: "ord-002", sequence: 2 },
        ],
      },
    },
    responses: [
      {
        code: 201,
        description: "Route created successfully",
        example: {
          id: "route-001",
          driverId: "driver-001",
          stops: 2,
          totalDistance: 12.5,
          estimatedDuration: "45m",
          optimized: true,
        },
      },
    ],
  },
  {
    id: "webhooks-test",
    method: "POST",
    path: "/api/v1/webhooks/test",
    tag: "Webhooks",
    description: "Test a webhook endpoint",
    authentication: "api_key",
    requestBody: {
      type: "application/json",
      example: {
        url: "https://example.com/webhook",
        event: "order.created",
        payload: { id: "ord-001" },
      },
    },
    responses: [
      {
        code: 200,
        description: "Webhook test successful",
        example: { statusCode: 200, responseTime: "145ms" },
      },
    ],
  },
  {
    id: "health-check",
    method: "GET",
    path: "/api/v1/health",
    tag: "System",
    description: "Check API health status (public endpoint)",
    authentication: "public",
    responses: [
      {
        code: 200,
        description: "API is healthy",
        example: {
          status: "healthy",
          timestamp: "2026-03-12T14:35:22Z",
          services: { api: "up", db: "up", cache: "up" },
        },
      },
    ],
  },
];

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-blue-600/20 text-blue-500",
    POST: "bg-emerald-600/20 text-emerald-500",
    PUT: "bg-amber-600/20 text-amber-500",
    DELETE: "bg-red-600/20 text-red-500",
    PATCH: "bg-blue-600/20 text-blue-500",
  };

  return (
    <span
      className={cn(
        "px-2 py-1 rounded text-xs font-bold uppercase tracking-wider",
        colors[method]
      )}
    >
      {method}
    </span>
  );
}

function AuthBadge({ auth }: { auth: string }) {
  const badges: Record<string, { variant: string; label: string }> = {
    bearer: { variant: "warning", label: "Bearer Token" },
    api_key: { variant: "info", label: "API Key" },
    public: { variant: "success", label: "Public" },
  };

  const badge = badges[auth];

  return <Badge variant={badge.variant as any}>{badge.label}</Badge>;
}

function EndpointCard({
  endpoint,
  expanded,
  onToggle,
}: {
  endpoint: ApiEndpoint;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [authToken, setAuthToken] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const curlCommand = `curl -X ${endpoint.method} "https://api.witylogix.com${endpoint.path}" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json"`;

  return (
    <Card className="mb-4">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 hover:bg-wl-bg-elevated transition-colors flex items-start justify-between text-left"
      >
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <MethodBadge method={endpoint.method} />
            <code className="text-sm font-mono text-white break-all">
              {endpoint.path}
            </code>
          </div>
          <p className="text-sm text-gray-400">
            {endpoint.description}
          </p>
        </div>

        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
          <AuthBadge auth={endpoint.authentication} />
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-5 py-4 border-t border-wl-border-default space-y-6">
          {/* Parameters */}
          {endpoint.parameters && endpoint.parameters.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">
                Parameters
              </h4>
              <div className="space-y-3">
                {endpoint.parameters.map((param, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-wl-bg-elevated rounded-lg border border-wl-border-default"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-mono text-blue-500">
                        {param.name}
                      </code>
                      <span className="text-xs text-gray-400">
                        {param.type}
                      </span>
                      {param.required && (
                        <Badge variant="danger">Required</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">
                      {param.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Request Body */}
          {endpoint.requestBody && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">
                Request Body
              </h4>
              <div className="relative">
                <pre className="p-4 bg-wl-bg-elevated rounded-lg border border-wl-border-default overflow-x-auto text-xs text-gray-400">
                  <code>
                    {JSON.stringify(endpoint.requestBody.example, null, 2)}
                  </code>
                </pre>
                <button
                  onClick={() =>
                    handleCopy(
                      JSON.stringify(endpoint.requestBody?.example, null, 2)
                    )
                  }
                  className="absolute top-2 right-2 p-2 hover:bg-wl-bg-elevated rounded transition-colors"
                >
                  <Copy className="w-4 h-4 text-gray-400 hover:text-white" />
                </button>
              </div>
            </div>
          )}

          {/* Responses */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">
              Responses
            </h4>
            <div className="space-y-3">
              {endpoint.responses.map((response, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "p-4 rounded-lg border",
                    response.code >= 200 && response.code < 300
                      ? "bg-emerald-600/30 border-emerald-500/30"
                      : "bg-red-600/30 border-red-500/30"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span
                        className={cn(
                          "text-sm font-bold",
                          response.code >= 200 && response.code < 300
                            ? "text-emerald-500"
                            : "text-red-500"
                        )}
                      >
                        {response.code}
                      </span>
                      <p className="text-sm text-gray-400 mt-0.5">
                        {response.description}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        handleCopy(JSON.stringify(response.example, null, 2))
                      }
                      className="p-2 hover:bg-wl-bg-elevated rounded transition-colors"
                    >
                      <Copy className="w-4 h-4 text-gray-400 hover:text-white" />
                    </button>
                  </div>
                  <pre className="p-3 bg-wl-bg-elevated rounded text-xs text-gray-400 overflow-x-auto">
                    <code>{JSON.stringify(response.example, null, 2)}</code>
                  </pre>
                </div>
              ))}
            </div>
          </div>

          {/* Try It Out */}
          <div className="p-4 bg-blue-600/5 rounded-lg border border-blue-600/20">
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Code className="w-4 h-4" />
              Try It Out
            </h4>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
                  Authorization Token
                </label>
                <input
                  type="password"
                  placeholder="Enter your Bearer token"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm bg-wl-bg-elevated border border-wl-border-default text-white placeholder-gray-500 focus:outline-none focus:border-wl-border-default-focus"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
                  cURL Command
                </label>
                <div className="relative">
                  <pre className="p-3 bg-wl-bg-elevated rounded-lg border border-wl-border-default text-xs text-gray-400 overflow-x-auto">
                    <code>{curlCommand}</code>
                  </pre>
                  <button
                    onClick={() => handleCopy(curlCommand)}
                    className="absolute top-2 right-2 p-2 hover:bg-wl-bg-elevated rounded transition-colors"
                  >
                    <Copy className="w-4 h-4 text-gray-400 hover:text-white" />
                  </button>
                </div>
              </div>

              <Button
                variant="primary"
                size="md"
                className="w-full"
                disabled={!authToken && endpoint.authentication !== "public"}
              >
                <Play className="w-4 h-4" />
                Execute Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export default function ApiDocsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const tags = Array.from(new Set(API_ENDPOINTS.map(e => e.tag)));
  const filteredEndpoints = selectedTag
    ? API_ENDPOINTS.filter(e => e.tag === selectedTag)
    : API_ENDPOINTS;

  return (
    <div className="min-h-screen bg-wl-bg-surface">
      <Header
        title="API Documentation"
        subtitle="Witylogix Logistics API v1.0"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="md">
              Download Spec
            </Button>
            <Button variant="secondary" size="md">
              API Keys
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Introduction */}
        <Card>
          <CardContent className="pt-5">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    REST API
                  </p>
                  <p className="text-sm text-gray-400 mt-0.5">
                    RESTful API for managing orders, routes, drivers, and integrations
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    Authentication
                  </p>
                  <p className="text-sm text-gray-400 mt-0.5">
                    Bearer Token or API Key via Authorization header
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    Rate Limiting
                  </p>
                  <p className="text-sm text-gray-400 mt-0.5">
                    1000 requests per minute per API key
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tags Filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedTag(null)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              !selectedTag
                ? "bg-blue-600 text-white"
                : "bg-wl-bg-elevated text-gray-400 hover:text-white hover:bg-wl-bg-elevated"
            )}
          >
            All Endpoints ({API_ENDPOINTS.length})
          </button>
          {tags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                selectedTag === tag
                  ? "bg-blue-600 text-white"
                  : "bg-wl-bg-elevated text-gray-400 hover:text-white hover:bg-wl-bg-elevated"
              )}
            >
              {tag} (
              {API_ENDPOINTS.filter(e => e.tag === tag).length})
            </button>
          ))}
        </div>

        {/* Endpoints */}
        <div>
          {filteredEndpoints.map(endpoint => (
            <EndpointCard
              key={endpoint.id}
              endpoint={endpoint}
              expanded={expandedId === endpoint.id}
              onToggle={() =>
                setExpandedId(
                  expandedId === endpoint.id ? null : endpoint.id
                )
              }
            />
          ))}
        </div>

        {/* Footer */}
        <Card className="bg-blue-600/40 border border-blue-500/30">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-blue-500">
                  Need Help?
                </h4>
                <p className="text-sm text-gray-400 mt-1">
                  Visit our <a href="#" className="text-blue-500 hover:underline">full API documentation</a> or contact{" "}
                  <a href="#" className="text-blue-500 hover:underline">support@witylogix.com</a>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
