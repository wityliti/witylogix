"use client";

import { useState } from "react";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  AlertCircle,
  Copy,
  Trash2,
  Plus,
  Eye,
  EyeOff,
  Shield,
  TestTube,
} from "lucide-react";

interface AuthProvider {
  id: string;
  provider: string;
  displayName: string;
  description: string | null;
  isEnabled: boolean;
  isDefault: boolean;
  level: string;
  lastValidatedAt: string | null;
  lastValidationError: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreateProviderBody {
  name: string;
  type: string;
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  authUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  scopes?: string[];
  enabled?: boolean;
}

const PROVIDER_LABELS: Record<
  string,
  { label: string; icon: string; capabilities: string[] }
> = {
  auth0: {
    label: "Auth0",
    icon: "🔐",
    capabilities: ["SSO", "MFA", "Social Login", "Role Mapping"],
  },
  clerk: {
    label: "Clerk",
    icon: "🎫",
    capabilities: ["SSO", "Multi-org", "Session Management"],
  },
  cognito: {
    label: "AWS Cognito",
    icon: "☁️",
    capabilities: ["User Pools", "Identity Federation", "MFA"],
  },
  firebase_auth: {
    label: "Firebase Auth",
    icon: "🔥",
    capabilities: ["Email/Password", "Social", "Phone Auth"],
  },
  okta: {
    label: "Okta",
    icon: "🔒",
    capabilities: ["Enterprise SSO", "MFA", "Lifecycle"],
  },
  generic_oidc: {
    label: "Generic OIDC",
    icon: "🔑",
    capabilities: ["Custom Providers", "Enterprise SSO"],
  },
  saml: {
    label: "SAML 2.0",
    icon: "🏢",
    capabilities: ["Enterprise SSO", "Okta", "Azure AD"],
  },
  local: {
    label: "Local Auth",
    icon: "🖥️",
    capabilities: ["Username/Password", "No external deps"],
  },
};

const ROLE_MAPPING = [
  {
    externalRole: "admin",
    witylogixRole: "SUPER_ADMIN",
    permissions: "Full access",
  },
  {
    externalRole: "manager",
    witylogixRole: "ADMIN",
    permissions: "Manage team, config",
  },
  {
    externalRole: "dispatcher",
    witylogixRole: "DISPATCHER",
    permissions: "Dispatch, track",
  },
  {
    externalRole: "viewer",
    witylogixRole: "VIEWER",
    permissions: "View-only access",
  },
  {
    externalRole: "driver",
    witylogixRole: "DRIVER",
    permissions: "Driver app access",
  },
];

export default function AuthProvidersPage() {
  const { data, loading, error, refetch } = useApiQuery<{
    data: AuthProvider[];
    total: number;
  }>("/api/v4/auth-providers");

  const [activeTab, setActiveTab] = useState("providers");
  const [selectedProvider, setSelectedProvider] = useState<AuthProvider | null>(
    null,
  );
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  type TestResult = { status: "success" | "error"; message: string };
  const [testResults, setTestResults] = useState<Record<string, TestResult>>(
    {},
  );
  const [testingId, setTestingId] = useState<string | null>(null);
  const [jitProvisioning, setJitProvisioning] = useState(true);

  // New provider form state
  const [newProvider, setNewProvider] = useState({
    name: "",
    type: "auth0",
    clientId: "",
    clientSecret: "",
    redirectUri: "",
  });
  const [saving, setSaving] = useState(false);

  const providers: AuthProvider[] = data?.data ?? [];

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const handleTestConnection = async (provider: AuthProvider) => {
    setTestingId(provider.id);
    try {
      await api.post(`/api/v4/auth-providers/${provider.id}/test`, {});
      setTestResults((prev: Record<string, TestResult>) => ({
        ...prev,
        [provider.id]: {
          status: "success",
          message:
            "Connection successful! Provider is reachable and configured.",
        },
      }));
    } catch {
      setTestResults((prev: Record<string, TestResult>) => ({
        ...prev,
        [provider.id]: {
          status: "error",
          message:
            "Connection failed. Check your credentials and configuration.",
        },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteProvider = async (id: string) => {
    try {
      await api.delete(`/api/v4/auth-providers/${id}`);
      refetch();
    } catch {
      // Error surfaced by toast/refetch
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await api.put(`/api/v4/auth-providers/${id}/default`, {});
      refetch();
    } catch {
      // Error surfaced
    }
  };

  const handleCreateProvider = async () => {
    setSaving(true);
    try {
      const body: CreateProviderBody = {
        name: newProvider.name,
        type: newProvider.type,
        clientId: newProvider.clientId,
        clientSecret: newProvider.clientSecret,
        redirectUri: newProvider.redirectUri || undefined,
        enabled: true,
      };
      await api.post("/api/v4/auth-providers", body);
      setIsAddModalOpen(false);
      setNewProvider({
        name: "",
        type: "auth0",
        clientId: "",
        clientSecret: "",
        redirectUri: "",
      });
      refetch();
    } catch {
      // Error surfaced
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "providers", label: "Providers", count: providers.length },
    { id: "role-mapping", label: "Role Mapping" },
    { id: "settings", label: "Settings" },
  ];

  const defaultProvider = providers.find((p) => p.isDefault);

  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title="Authentication Providers"
        subtitle="Configure SSO providers, role mapping, and authentication settings"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={setActiveTab}
            variant="underline"
          />
        </div>

        {/* PROVIDERS TAB */}
        {activeTab === "providers" && (
          <div>
            {defaultProvider && (
              <Card className="mb-8 border-l-4 border-l-emerald-500 bg-wl-bg-surface border border-wl-border-default">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Badge variant="success">Active Provider</Badge>
                      <span className="text-base font-semibold text-[var(--wl-text-primary)]">
                        {PROVIDER_LABELS[defaultProvider.provider]?.label ??
                          defaultProvider.displayName}
                      </span>
                    </div>
                    <span className="text-sm text-[var(--wl-text-tertiary)]">
                      All SSO authentication requests route through this
                      provider
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {providers.length === 0 ? (
              <Card className="bg-wl-bg-surface border border-wl-border-default">
                <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                  <Shield className="w-12 h-12 text-wl-text-tertiary" />
                  <p className="text-lg font-semibold text-white">
                    No auth providers configured
                  </p>
                  <p className="text-sm text-wl-text-secondary text-center max-w-md">
                    Connect an SSO provider to enable single sign-on for your
                    team.
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => setIsAddModalOpen(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Provider
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {providers.map((provider) => {
                    const meta = PROVIDER_LABELS[provider.provider];
                    const testResult = testResults[provider.id];
                    return (
                      <Card
                        key={provider.id}
                        className={cn(
                          "bg-wl-bg-surface border border-wl-border-default relative",
                          provider.isDefault && "border-2 border-emerald-500",
                        )}
                      >
                        {provider.isDefault && (
                          <div className="absolute -top-0.5 right-4 bg-emerald-500 text-white px-3 py-1 rounded-b text-xs font-semibold">
                            ACTIVE
                          </div>
                        )}
                        <CardHeader>
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="text-4xl">{meta?.icon ?? "🔐"}</div>
                            <div>
                              {provider.isEnabled ? (
                                <Badge variant="success">Enabled</Badge>
                              ) : (
                                <Badge variant="warning">Disabled</Badge>
                              )}
                            </div>
                          </div>
                          <CardTitle className="text-xl mb-1 text-white">
                            {meta?.label ?? provider.displayName}
                          </CardTitle>
                          <CardDescription className="text-wl-text-secondary">
                            {provider.displayName}
                          </CardDescription>
                        </CardHeader>

                        <CardContent>
                          {meta?.capabilities && (
                            <div className="mb-4">
                              <div className="text-sm font-semibold text-wl-text-secondary mb-2">
                                Capabilities
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {meta.capabilities.map((cap) => (
                                  <Badge
                                    key={cap}
                                    variant="info"
                                    className="text-xs"
                                  >
                                    {cap}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {provider.lastValidatedAt && (
                            <p className="text-xs text-wl-text-tertiary">
                              Last validated:{" "}
                              {new Date(
                                provider.lastValidatedAt,
                              ).toLocaleString()}
                            </p>
                          )}
                          {provider.lastValidationError && (
                            <p className="text-xs text-red-400 mt-1">
                              {provider.lastValidationError}
                            </p>
                          )}
                          {testResult && (
                            <div
                              className={cn(
                                "mt-3 p-2 rounded text-xs flex items-center gap-2",
                                testResult.status === "success"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : "bg-red-500/10 text-red-400",
                              )}
                            >
                              {testResult.status === "success" ? (
                                <CheckCircle className="w-3 h-3 flex-shrink-0" />
                              ) : (
                                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                              )}
                              {testResult.message}
                            </div>
                          )}
                        </CardContent>

                        <CardFooter className="flex gap-2 pt-0 flex-wrap">
                          {!provider.isDefault && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleSetDefault(provider.id)}
                              className="flex-1"
                            >
                              Set Default
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTestConnection(provider)}
                            disabled={testingId === provider.id}
                            className="flex-1 flex items-center justify-center gap-1"
                          >
                            <TestTube className="w-3 h-3" />
                            {testingId === provider.id ? "Testing…" : "Test"}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteProvider(provider.id)}
                            className="p-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>

                <Button
                  variant="secondary"
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Provider
                </Button>
              </>
            )}
          </div>
        )}

        {/* ROLE MAPPING TAB */}
        {activeTab === "role-mapping" && (
          <Card className="mb-8 bg-wl-bg-surface border border-wl-border-default">
            <CardHeader>
              <CardTitle className="text-white">
                Role Mapping Configuration
              </CardTitle>
              <CardDescription className="text-wl-text-secondary">
                Map external authentication provider roles to Witylogix platform
                roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-wl-border-default">
                      <th className="py-4 px-4 text-left text-wl-text-secondary font-semibold">
                        External Role
                      </th>
                      <th className="py-4 px-4 text-left text-wl-text-secondary font-semibold">
                        Witylogix Role
                      </th>
                      <th className="py-4 px-4 text-left text-wl-text-secondary font-semibold">
                        Permissions
                      </th>
                      <th className="py-4 px-4 text-center text-wl-text-secondary font-semibold">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROLE_MAPPING.map((mapping, idx) => (
                      <tr
                        key={idx}
                        className={cn(
                          "border-b border-wl-border-default",
                          idx % 2 === 1 && "bg-wl-bg-elevated",
                        )}
                      >
                        <td className="py-4 px-4">
                          <code className="bg-wl-bg-root px-2 py-1 rounded text-xs text-wl-text-secondary">
                            {mapping.externalRole}
                          </code>
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant="primary">
                            {mapping.witylogixRole}
                          </Badge>
                        </td>
                        <td className="py-4 px-4 text-wl-text-secondary text-xs">
                          {mapping.permissions}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Button
                            variant="ghost"
                            onClick={() => setIsMappingModalOpen(true)}
                            className="p-1 text-xs"
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="secondary">Add Custom Mapping</Button>
            </CardFooter>
          </Card>
        )}

        {/* SETTINGS TAB */}
        {activeTab === "settings" && (
          <Card className="mb-8 bg-wl-bg-surface border border-wl-border-default">
            <CardHeader>
              <CardTitle className="text-white">
                Authentication Settings
              </CardTitle>
              <CardDescription className="text-wl-text-secondary">
                Configure global SSO and security options
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-8">
                <div className="flex items-center justify-between pb-6 border-b border-wl-border-default">
                  <div>
                    <div className="text-sm font-semibold text-white mb-1">
                      Just-In-Time Provisioning
                    </div>
                    <div className="text-sm text-wl-text-secondary">
                      Automatically create users on first SSO login
                    </div>
                  </div>
                  <Button
                    variant={jitProvisioning ? "primary" : "secondary"}
                    onClick={() => setJitProvisioning(!jitProvisioning)}
                    className="min-w-[100px]"
                  >
                    {jitProvisioning ? "Enabled" : "Disabled"}
                  </Button>
                </div>

                <div className="flex items-center justify-between pb-6 border-b border-wl-border-default">
                  <div>
                    <div className="text-sm font-semibold text-white mb-1">
                      Enforce MFA for All Users
                    </div>
                    <div className="text-sm text-wl-text-secondary">
                      Require multi-factor authentication on login
                    </div>
                  </div>
                  <Button variant="secondary" className="min-w-[100px]">
                    Disabled
                  </Button>
                </div>

                <div className="flex items-start justify-between pb-6 border-b border-wl-border-default">
                  <div>
                    <div className="text-sm font-semibold text-white mb-1">
                      Session Timeout
                    </div>
                    <div className="text-sm text-wl-text-secondary">
                      Auto-logout after period of inactivity
                    </div>
                  </div>
                  <Select
                    options={[
                      { value: "15", label: "15 minutes" },
                      { value: "30", label: "30 minutes" },
                      { value: "60", label: "1 hour" },
                      { value: "480", label: "8 hours" },
                    ]}
                    defaultValue="30"
                    onChange={() => {}}
                  />
                </div>

                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold text-white mb-1">
                      IP Whitelist
                    </div>
                    <div className="text-sm text-wl-text-secondary">
                      Restrict access to specific IP addresses (optional)
                    </div>
                  </div>
                  <Button variant="secondary">Manage IPs</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Provider Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Authentication Provider"
        size="lg"
        footer={
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateProvider}
              disabled={
                saving ||
                !newProvider.name ||
                !newProvider.clientId ||
                !newProvider.clientSecret
              }
            >
              {saving ? "Saving…" : "Add Provider"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-6">
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Provider Type
            </label>
            <Select
              options={Object.entries(PROVIDER_LABELS).map(([value, meta]) => ({
                value,
                label: meta.label,
              }))}
              defaultValue="auth0"
              onValueChange={(val: string) =>
                setNewProvider((p: typeof newProvider) => ({ ...p, type: val }))
              }
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Display Name
            </label>
            <Input
              placeholder="e.g., Company Auth0"
              value={newProvider.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewProvider((p: typeof newProvider) => ({
                  ...p,
                  name: e.target.value,
                }))
              }
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Client ID
            </label>
            <Input
              placeholder="Your client ID"
              value={newProvider.clientId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewProvider((p: typeof newProvider) => ({
                  ...p,
                  clientId: e.target.value,
                }))
              }
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Client Secret
            </label>
            <div className="flex gap-2">
              <Input
                type={showSecrets["new"] ? "text" : "password"}
                placeholder="Your client secret"
                value={newProvider.clientSecret}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewProvider((p: typeof newProvider) => ({
                    ...p,
                    clientSecret: e.target.value,
                  }))
                }
                className="flex-1"
              />
              <Button
                variant="ghost"
                onClick={() =>
                  setShowSecrets((prev: Record<string, boolean>) => ({
                    ...prev,
                    new: !prev["new"],
                  }))
                }
              >
                {showSecrets["new"] ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Redirect URI (optional)
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="/api/v4/auth-providers/callback"
                value={newProvider.redirectUri}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewProvider((p: typeof newProvider) => ({
                    ...p,
                    redirectUri: e.target.value,
                  }))
                }
                className="flex-1"
              />
              <Button
                variant="ghost"
                onClick={() =>
                  navigator.clipboard.writeText(newProvider.redirectUri)
                }
                title="Copy"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Role Mapping Edit Modal */}
      <Modal
        isOpen={isMappingModalOpen}
        onClose={() => setIsMappingModalOpen(false)}
        title="Edit Role Mapping"
        size="md"
        footer={
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={() => setIsMappingModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => setIsMappingModalOpen(false)}
            >
              Save Mapping
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-6">
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              External Role Claim
            </label>
            <Input placeholder="e.g., admin, manager, viewer" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Map to Witylogix Role
            </label>
            <Select
              options={[
                { value: "SUPER_ADMIN", label: "Super Admin" },
                { value: "ADMIN", label: "Admin" },
                { value: "DISPATCHER", label: "Dispatcher" },
                { value: "VIEWER", label: "Viewer" },
                { value: "DRIVER", label: "Driver" },
              ]}
              defaultValue="ADMIN"
              onChange={() => {}}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
