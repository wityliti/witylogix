"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Plus,
  Copy,
  Trash2,
  Key,
  Calendar,
  Clock,
  AlertCircle,
} from "lucide-react";

interface APIKey {
  id: string;
  name: string;
  key: string;
  masked: string;
  createdAt: string;
  lastUsed?: string;
  scopes: string[];
  requestsPerDay: number;
}

const INITIAL_KEYS: APIKey[] = [
  {
    id: "key-001",
    name: "Production API Key",
    key: "wl_live_51234567890abcdef",
    masked: "wl_live_••••••••••••••••••••••••••••••••",
    createdAt: "2025-01-15",
    lastUsed: "2 hours ago",
    scopes: ["orders:read", "orders:write", "deliveries:read"],
    requestsPerDay: 5240,
  },
  {
    id: "key-002",
    name: "Development API Key",
    key: "wl_test_test1234567890abcdef",
    masked: "wl_test_••••••••••••••••••••••••••••••••",
    createdAt: "2025-02-10",
    lastUsed: "30 minutes ago",
    scopes: ["*"],
    requestsPerDay: 342,
  },
];

export default function APIKeysPage() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>(INITIAL_KEYS);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const AVAILABLE_SCOPES = [
    { id: "orders:read", label: "Read Orders" },
    { id: "orders:write", label: "Write Orders" },
    { id: "deliveries:read", label: "Read Deliveries" },
    { id: "deliveries:write", label: "Write Deliveries" },
    { id: "drivers:read", label: "Read Drivers" },
    { id: "drivers:write", label: "Write Drivers" },
    { id: "webhooks:read", label: "Read Webhooks" },
    { id: "webhooks:write", label: "Write Webhooks" },
  ];

  const copyToClipboard = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateKey = () => {
    if (!newKeyName) return;
    const newKey: APIKey = {
      id: `key-${Date.now()}`,
      name: newKeyName,
      key: `wl_live_${Math.random().toString(36).substring(2, 18)}`,
      masked: "wl_live_••••••••••••••••••••••••••••••••",
      createdAt: new Date().toISOString().split("T")[0],
      scopes: selectedScopes.length > 0 ? selectedScopes : ["*"],
      requestsPerDay: 0,
    };
    setApiKeys([...apiKeys, newKey]);
    setNewKeyName("");
    setSelectedScopes([]);
    setShowCreateDialog(false);
  };

  const revokeKey = (id: string) => {
    setApiKeys((prev) => prev.filter((key) => key.id !== id));
    setDeleteConfirmId(null);
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  return (
    <div className="min-h-screen bg-[var(--wl-bg-primary)]">
      <Header
        title="API Keys"
        subtitle="Manage API keys for programmatic access"
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Create Key Button */}
          <div className="flex justify-end">
            <Button variant="primary" onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create New Key
            </Button>
          </div>

          {/* Create Dialog */}
          {showCreateDialog && (
            <Card className="border-[var(--wl-primary)]/50 bg-[var(--wl-bg-secondary)]">
              <CardHeader>
                <CardTitle>Create New API Key</CardTitle>
                <CardDescription>Generate a new API key for your application</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
                    Key Name
                  </label>
                  <Input
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g., Mobile App Integration"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-3">
                    Scopes (Permissions)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {AVAILABLE_SCOPES.map((scope) => (
                      <label key={scope.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedScopes.includes(scope.id)}
                          onChange={() => toggleScope(scope.id)}
                          className="w-4 h-4 rounded border-[var(--wl-border)] text-[var(--wl-primary)] cursor-pointer"
                        />
                        <span className="text-sm text-[var(--wl-text-secondary)]">
                          {scope.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="bg-[var(--wl-info)]/10 border border-[var(--wl-info)]/30 rounded-lg p-3 flex gap-2">
                  <AlertCircle className="w-4 h-4 text-[var(--wl-info)] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[var(--wl-text-secondary)]">
                    Store your API key securely. You won't be able to see it again after creation.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex gap-3">
                <Button
                  variant="primary"
                  onClick={handleCreateKey}
                  disabled={!newKeyName}
                >
                  Create API Key
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowCreateDialog(false);
                    setNewKeyName("");
                    setSelectedScopes([]);
                  }}
                >
                  Cancel
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* API Keys List */}
          <Card>
            <CardHeader>
              <CardTitle>Your API Keys</CardTitle>
              <CardDescription>
                {apiKeys.length} {apiKeys.length === 1 ? "key" : "keys"} available
              </CardDescription>
            </CardHeader>
            <CardContent>
              {apiKeys.length > 0 ? (
                <div className="space-y-4">
                  {apiKeys.map((apiKey) => (
                    <div
                      key={apiKey.id}
                      className="p-4 border border-[var(--wl-border)] rounded-lg hover:bg-[var(--wl-bg-secondary)]/50 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Key className="w-4 h-4 text-[var(--wl-text-secondary)]" />
                            <p className="font-semibold text-[var(--wl-text-primary)]">
                              {apiKey.name}
                            </p>
                          </div>
                          <p className="text-xs text-[var(--wl-text-secondary)] font-mono">
                            {apiKey.masked}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => copyToClipboard(apiKey.key, apiKey.id)}
                          >
                            <Copy className="w-3.5 h-3.5" />
                            {copiedId === apiKey.id ? "Copied!" : "Copy"}
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setDeleteConfirmId(apiKey.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-4 sm:items-center text-xs text-[var(--wl-text-secondary)] mb-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>Created: {apiKey.createdAt}</span>
                        </div>
                        {apiKey.lastUsed && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Last used: {apiKey.lastUsed}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 mb-2">
                        {apiKey.scopes.map((scope) => (
                          <Badge key={scope} variant="info" className="text-xs">
                            {scope}
                          </Badge>
                        ))}
                      </div>

                      <div className="text-xs text-[var(--wl-text-secondary)]">
                        <span className="font-semibold">{apiKey.requestsPerDay}</span> requests today
                      </div>

                      {deleteConfirmId === apiKey.id && (
                        <div className="mt-4 p-3 bg-[var(--wl-danger)]/10 border border-[var(--wl-danger)]/30 rounded-lg flex items-center justify-between gap-3">
                          <p className="text-xs text-[var(--wl-text-primary)]">
                            Are you sure? This action cannot be undone.
                          </p>
                          <div className="flex gap-2">
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => revokeKey(apiKey.id)}
                            >
                              Confirm
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setDeleteConfirmId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Key className="w-12 h-12 text-[var(--wl-text-secondary)] mx-auto mb-3 opacity-30" />
                  <p className="text-[var(--wl-text-secondary)]">
                    No API keys created yet
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Documentation Link */}
          <Card className="bg-[var(--wl-info)]/5 border border-[var(--wl-info)]/30">
            <CardContent className="pt-6">
              <p className="text-sm text-[var(--wl-text-secondary)]">
                Learn how to use the Witylogix API in our{" "}
                <a
                  href="#"
                  className="text-[var(--wl-primary)] hover:underline font-semibold"
                >
                  API documentation
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
