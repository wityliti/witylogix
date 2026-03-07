import { Header } from "../../../components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import Link from "next/link";
import {
  ChevronLeft,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  Calendar,
} from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  masked: string;
  created: string;
  lastUsed: string;
  expiresAt: string | null;
  scopes: string[];
  status: "active" | "revoked" | "expired";
}

const mockApiKeys: ApiKey[] = [
  {
    id: "key-001",
    name: "Production Integration",
    key: "wl_live_xxxxxxxxxxxxxxxxxxxxxxxx",
    masked: "wl_live_****...xxxx",
    created: "2024-01-15",
    lastUsed: "2026-03-06",
    expiresAt: null,
    scopes: ["shipments:read", "shipments:write", "shipments:delete"],
    status: "active",
  },
  {
    id: "key-002",
    name: "Staging Testing",
    key: "wl_test_xxxxxxxxxxxxxxxxxxxxxxxx",
    masked: "wl_test_****...xxxx",
    created: "2024-02-20",
    lastUsed: "2026-02-28",
    expiresAt: "2026-08-20",
    scopes: ["shipments:read", "drivers:read", "reports:read"],
    status: "active",
  },
  {
    id: "key-003",
    name: "Mobile App Integration",
    key: "wl_live_yyyyyyyyyyyyyyyyyyyyyyyy",
    masked: "wl_live_****...yyyy",
    created: "2024-03-10",
    lastUsed: "2024-06-15",
    expiresAt: "2025-12-31",
    scopes: ["tracking:read", "drivers:read"],
    status: "expired",
  },
];

export default function ApiKeysPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--wl-bg-primary)] to-[var(--wl-bg-secondary)]">
      <Header
        title="API Keys"
        subtitle="Manage your API keys and authentication tokens"
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <Link href="/settings">
          <Button
            variant="ghost"
            className="mb-8 text-[var(--wl-text-secondary)] hover:text-[var(--wl-text-primary)]"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>
        </Link>

        {/* Create New Key Section */}
        <Card className="mb-8 bg-[var(--wl-bg-tertiary)] border-[var(--wl-primary)]/30">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--wl-text-primary)] mb-1">
                  Create a New API Key
                </h3>
                <p className="text-sm text-[var(--wl-text-secondary)]">
                  Generate a new API key to integrate with your applications
                </p>
              </div>
              <Button className="bg-[var(--wl-primary)] hover:bg-[var(--wl-primary)]/90 whitespace-nowrap">
                <Plus className="w-4 h-4 mr-2" />
                New API Key
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* API Keys List */}
        <div className="space-y-4">
          {mockApiKeys.map((apiKey) => (
            <Card key={apiKey.id} className="hover:border-[var(--wl-primary)]/50">
              <CardContent className="pt-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-[var(--wl-text-primary)]">
                        {apiKey.name}
                      </h3>
                      <Badge
                        variant={
                          apiKey.status === "active" ? "default" : "secondary"
                        }
                        className={
                          apiKey.status === "active"
                            ? "bg-[var(--wl-success)] text-white"
                            : apiKey.status === "expired"
                              ? "bg-[var(--wl-error)] text-white"
                              : ""
                        }
                      >
                        {apiKey.status.charAt(0).toUpperCase() +
                          apiKey.status.slice(1)}
                      </Badge>
                    </div>
                    <p className="text-sm text-[var(--wl-text-tertiary)]">
                      Created on{" "}
                      {new Date(apiKey.created).toLocaleDateString()}
                    </p>
                  </div>

                  {apiKey.status === "active" && (
                    <Button
                      variant="ghost"
                      className="text-[var(--wl-error)] hover:bg-[var(--wl-error)]/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {/* Key Display */}
                <div className="bg-[var(--wl-bg-secondary)] rounded-lg p-4 mb-6 font-mono text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--wl-text-secondary)]">
                      {apiKey.masked}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[var(--wl-primary)] hover:bg-[var(--wl-bg-tertiary)]"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 pb-6 border-b border-[var(--wl-border)]">
                  <div>
                    <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                      Last Used
                    </p>
                    <p className="text-sm text-[var(--wl-text-primary)] mt-1">
                      {new Date(apiKey.lastUsed).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                      Expires
                    </p>
                    <p className="text-sm text-[var(--wl-text-primary)] mt-1">
                      {apiKey.expiresAt
                        ? new Date(apiKey.expiresAt).toLocaleDateString()
                        : "Never"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                      Environment
                    </p>
                    <p className="text-sm text-[var(--wl-text-primary)] mt-1">
                      {apiKey.key.includes("live") ? "Production" : "Sandbox"}
                    </p>
                  </div>
                </div>

                {/* Scopes */}
                <div>
                  <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase mb-3">
                    Scopes & Permissions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {apiKey.scopes.map((scope) => (
                      <Badge
                        key={scope}
                        variant="outline"
                        className="border-[var(--wl-border)] text-[var(--wl-text-secondary)]"
                      >
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Documentation Section */}
        <Card className="mt-12 bg-[var(--wl-bg-tertiary)] border-0">
          <CardHeader>
            <CardTitle>API Documentation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[var(--wl-text-secondary)] mb-6">
              Learn how to authenticate requests using your API keys and explore
              available endpoints.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Button
                variant="outline"
                className="border-[var(--wl-border)] text-[var(--wl-text-primary)] hover:bg-[var(--wl-bg-secondary)]"
              >
                View API Docs
              </Button>
              <Button
                variant="outline"
                className="border-[var(--wl-border)] text-[var(--wl-text-primary)] hover:bg-[var(--wl-bg-secondary)]"
              >
                Example Code
              </Button>
              <Button
                variant="outline"
                className="border-[var(--wl-border)] text-[var(--wl-text-primary)] hover:bg-[var(--wl-bg-secondary)]"
              >
                Rate Limits
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
