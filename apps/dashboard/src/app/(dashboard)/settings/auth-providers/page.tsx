'use client';

import { useState, useEffect } from 'react';
import { useApiList, useApiMutation } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Tabs } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
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
} from 'lucide-react';

interface AuthProvider {
  id: string;
  name: string;
  type: string;
  status: 'connected' | 'disconnected';
  icon: string;
  capabilities: string[];
  config?: {
    domain?: string;
    clientId?: string;
    clientSecret?: string;
    callbackUrl?: string;
  };
}

const PROVIDER_ICONS: Record<string, string> = {
  auth0: "🔐", clerk: "🎫", cognito: "☁️", firebase: "🔥", oidc: "🔑", saml: "🏢",
};

function normalizeProvider(raw: any): AuthProvider {
  return {
    id: raw.id ?? "",
    name: raw.name ?? raw.type ?? "",
    type: (raw.type ?? "oidc") as AuthProvider["type"],
    status: raw.isActive ? "connected" : (raw.status ?? "disconnected"),
    icon: raw.icon ?? PROVIDER_ICONS[raw.type] ?? "🔑",
    capabilities: raw.capabilities ?? [],
    config: raw.config,
  };
}

function normalizeProvider(raw: Record<string, unknown>): AuthProvider {
  const type = (raw.type as string) ?? 'CUSTOM_OAUTH';
  const meta = TYPE_META[type] ?? { icon: '🔑', capabilities: [] };
  return {
    id: raw.id as string,
    name: (raw.name as string) ?? type,
    type,
    status: (raw.enabled as boolean) ? 'connected' : 'disconnected',
    icon: meta.icon,
    capabilities: meta.capabilities,
    config: {
      domain: (raw.authUrl as string | undefined),
      clientId: (raw.clientId as string | undefined),
      callbackUrl: (raw.redirectUri as string | undefined),
    },
  };
}

const PLATFORM_ROLES = [
  { role: 'SUPER_ADMIN', description: 'Full access to all features and settings' },
  { role: 'ADMIN', description: 'Manage team members, configurations, and reports' },
  { role: 'DISPATCHER', description: 'Dispatch orders, track deliveries, manage routes' },
  { role: 'VIEWER', description: 'Read-only access to dashboard and reports' },
  { role: 'DRIVER', description: 'Driver app access for assigned deliveries' },
];

export default function AuthProvidersPage() {
  const { items: rawProviders, loading, error, refetch } = useApiList<any>("/api/v4/auth-providers");
  const [providers, setProviders] = useState<AuthProvider[]>([]);
  const [activeTab, setActiveTab] = useState("providers");

  useEffect(() => {
    if (rawProviders.length > 0) {
      setProviders(rawProviders.map(normalizeProvider));
    }
  }, [rawProviders]);
  const [selectedProvider, setSelectedProvider] = useState<AuthProvider | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [activeProvider, setActiveProvider] = useState<string>('');
  const [testResult, setTestResult] = useState<{ status: "success" | "error"; message: string } | null>(null);
  const [jitProvisioning, setJitProvisioning] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [configForm, setConfigForm] = useState({ domain: '', clientId: '', clientSecret: '' });

  const handleTestConnection = async (providerId: string) => {
    setTestResult(null);
    try {
      await api.post(`/api/v4/auth-providers/${providerId}/test`, {});
      setTestResult({ status: "success", message: "Connection successful! Auth provider is reachable and properly configured." });
    } catch {
      setTestResult({ status: "error", message: "Connection failed. Check your provider configuration." });
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const activeProviderObj = providers.find((p) => p.id === activeProvider) ?? providers.find((p) => p.status === 'connected');

  const handleTestConnection = async (providerId: string) => {
    setIsTesting(true);
    setTestResult(null);
    try {
      await testConnection({ id: providerId });
      setTestResult({ status: 'success', message: 'Connection successful! Auth provider is reachable and properly configured.' });
    } catch {
      setTestResult({ status: 'error', message: 'Connection test failed. Check your configuration.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleOpenConfig = (provider: AuthProvider | null) => {
    setSelectedProvider(provider);
    setConfigForm({
      domain: provider?.config?.domain ?? '',
      clientId: provider?.config?.clientId ?? '',
      clientSecret: '',
    });
    setIsConfigModalOpen(true);
  };

  const handleConfigSave = async () => {
    try {
      await createProvider({
        ...(selectedProvider ? { id: selectedProvider.id } : {}),
        type: selectedProvider?.type ?? 'CUSTOM_OAUTH',
        name: selectedProvider?.name,
        authUrl: configForm.domain,
        clientId: configForm.clientId,
        clientSecret: configForm.clientSecret,
      });
    } catch {
      // ignore — refetch will reflect actual state
    }
    setIsConfigModalOpen(false);
    await refetch();
    if (selectedProvider) setActiveProvider(selectedProvider.id);
  };

  const handleDeleteProvider = async (providerId: string) => {
    try {
      await deleteProvider({ id: providerId });
      await refetch();
      if (activeProvider === providerId) setActiveProvider('');
    } catch {
      // silently fail — refetch will reflect actual state
    }
  };

  const tabs = [
    { id: "providers", label: "Providers", count: providers.length },
    { id: "role-mapping", label: "Role Mapping", icon: "🔗" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Header
        title="Authentication Providers"
        subtitle="Configure SSO providers, role mapping, and authentication settings"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} variant="underline" />
        </div>

        {/* PROVIDERS TAB */}
        {activeTab === "providers" && (
          <div>
            {/* Empty state */}
            {providers.length === 0 && (
              <Card className="mb-8 bg-[#12121a] border border-[#1e1e2e]">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Shield className="w-12 h-12 text-gray-500 mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">No auth providers configured</h3>
                  <p className="text-gray-400 text-sm mb-6">Connect an SSO provider to enable single sign-on for your team.</p>
                  <Button variant="primary" onClick={() => handleOpenConfig(null)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Auth Provider
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Active Provider Info */}
            {activeProviderObj && (
              <Card className="mb-8 border-l-4 border-l-emerald-500 bg-[#12121a] border border-[#1e1e2e]">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <Badge variant="success">Active Provider</Badge>
                      <span className="text-base font-semibold text-[var(--wl-text-primary)]">
                        {activeProviderObj.name}
                      </span>
                    </div>
                    <span className="text-sm text-[var(--wl-text-tertiary)]">
                      All SSO authentication requests route through this provider
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Providers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {providers.map((provider) => (
                <Card
                  key={provider.id}
                  className={cn(
                    "bg-[#12121a] border border-[#1e1e2e]",
                    activeProvider === provider.id && "border-2 border-emerald-500"
                  )}
                >
                  {/* Active Indicator */}
                  {activeProvider === provider.id && (
                    <div className="absolute -top-0.5 right-4 bg-emerald-500 text-white px-3 py-1 rounded-b text-xs font-semibold">
                      ACTIVE
                    </div>
                  )}

                  <CardHeader>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="text-4xl">{provider.icon}</div>
                      <div>
                        {provider.status === "connected" ? (
                          <Badge variant="success">Connected</Badge>
                        ) : (
                          <Badge variant="warning">Disconnected</Badge>
                        )}
                      </div>
                    </div>
                    <CardTitle className="text-xl mb-1 text-white">{provider.name}</CardTitle>
                    <CardDescription className="text-gray-400">Provider ID: {provider.id}</CardDescription>
                  </CardHeader>

                  <CardContent>
                    <div className="mb-6">
                      <div className="text-sm font-semibold text-gray-400 mb-2">
                        Capabilities
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {provider.capabilities.map((cap) => (
                          <Badge key={cap} variant="info" className="text-xs">
                            {cap}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {provider.config && (
                      <div className="bg-[#1a1a2e] p-4 rounded-lg mb-4">
                        {provider.config.domain && (
                          <div className="text-sm text-gray-400 mb-2">
                            <strong>Domain:</strong> {provider.config.domain}
                          </div>
                        )}
                        {provider.config.clientId && (
                          <div className="text-sm text-gray-400 mb-2">
                            <strong>Client ID:</strong> {provider.config.clientId}
                          </div>
                        )}
                        {provider.config.callbackUrl && (
                          <div className="text-sm text-gray-400">
                            <strong>Callback URL:</strong> {provider.config.callbackUrl}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="flex gap-2 pt-0">
                    <Button
                      variant={provider.status === "connected" ? "secondary" : "primary"}
                      onClick={() => handleOpenConfig(provider)}
                      className="flex-1"
                    >
                      {provider.status === "connected" ? "Reconfigure" : "Connect"}
                    </Button>
                    {provider.status === "connected" && (
                      <Button
                        variant="ghost"
                        onClick={() => handleTestConnection(provider.id)}
                        className="flex-1 flex items-center justify-center gap-2"
                      >
                        <TestTube className="w-4 h-4" />
                        Test
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      onClick={() => handleDeleteProvider(provider.id)}
                      className="p-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>

            {/* Test Result */}
            {testResult && (
              <Card
                className={cn(
                  "mb-8 border-l-4 bg-[#12121a] border border-[#1e1e2e]",
                  testResult.status === "success"
                    ? "border-l-emerald-500"
                    : "border-l-red-500"
                )}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    {testResult.status === "success" ? (
                      <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
                    )}
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {testResult.status === "success" ? "Connection Successful" : "Connection Failed"}
                      </div>
                      <div className="text-sm text-gray-400">
                        {testResult.message}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ROLE MAPPING TAB */}
        {activeTab === "role-mapping" && (
          <div>
            <Card className="mb-8 bg-[#12121a] border border-[#1e1e2e]">
              <CardHeader>
                <CardTitle className="text-white">Role Mapping Configuration</CardTitle>
                <CardDescription className="text-gray-400">
                  Map external authentication provider roles to Witylogix platform roles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto mb-6">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b-2 border-[#1e1e2e]">
                        <th className="py-4 px-4 text-left text-gray-400 font-semibold">
                          External Role
                        </th>
                        <th className="py-4 px-4 text-left text-gray-400 font-semibold">
                          Witylogix Role
                        </th>
                        <th className="py-4 px-4 text-left text-gray-400 font-semibold">
                          Permissions
                        </th>
                        <th className="py-4 px-4 text-center text-gray-400 font-semibold">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {PLATFORM_ROLES.map((r, idx) => (
                        <tr
                          key={r.role}
                          className={cn(
                            "border-b border-[#1e1e2e]",
                            idx % 2 === 1 && "bg-[#1a1a2e]"
                          )}
                        >
                          <td className="py-4 px-4 text-white">
                            <code className="bg-[#0a0a0f] px-2 py-1 rounded text-xs text-gray-400">
                              {r.role.toLowerCase()}
                            </code>
                          </td>
                          <td className="py-4 px-4 text-white">
                            <Badge variant="primary">{r.role}</Badge>
                          </td>
                          <td className="py-4 px-4 text-gray-400 text-xs">
                            {r.description}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <Button variant="ghost" className="p-1 text-xs">
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
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === "settings" && (
          <div>
            <Card className="mb-8 bg-[#12121a] border border-[#1e1e2e]">
              <CardHeader>
                <CardTitle className="text-white">Authentication Settings</CardTitle>
                <CardDescription className="text-gray-400">Configure global SSO and security options</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-8">
                  {/* JIT Provisioning */}
                  <div className="flex items-center justify-between pb-6 border-b border-[#1e1e2e]">
                    <div>
                      <div className="text-sm font-semibold text-white mb-1">
                        Just-In-Time Provisioning
                      </div>
                      <div className="text-sm text-gray-400">
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

                  {/* MFA Required */}
                  <div className="flex items-center justify-between pb-6 border-b border-[#1e1e2e]">
                    <div>
                      <div className="text-sm font-semibold text-white mb-1">
                        Enforce MFA for All Users
                      </div>
                      <div className="text-sm text-gray-400">
                        Require multi-factor authentication on login
                      </div>
                    </div>
                    <Button variant="secondary" className="min-w-[100px]">Disabled</Button>
                  </div>

                  {/* Session Timeout */}
                  <div className="flex items-start justify-between pb-6 border-b border-[#1e1e2e]">
                    <div>
                      <div className="text-sm font-semibold text-white mb-1">
                        Session Timeout
                      </div>
                      <div className="text-sm text-gray-400">
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

                  {/* IP Whitelisting */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white mb-1">
                        IP Whitelist
                      </div>
                      <div className="text-sm text-gray-400">
                        Restrict access to specific IP addresses (optional)
                      </div>
                    </div>
                    <Button variant="secondary">Manage IPs</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Config Modal */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        title={`${selectedProvider?.status === "connected" ? "Reconfigure" : "Connect"} ${selectedProvider?.name}`}
        size="lg"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setIsConfigModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfigSave}>
              Save Configuration
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-6">
          {/* Domain/Tenant */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Domain / Tenant
            </label>
            <Input
              placeholder="e.g., witylogix.auth0.com"
              value={configForm.domain}
              onChange={(e) => setConfigForm((f) => ({ ...f, domain: e.target.value }))}
            />
          </div>

          {/* Client ID */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Client ID
            </label>
            <div className="flex gap-2">
              <Input
                type={showSecrets['clientId'] ? "text" : "password"}
                placeholder="Your client ID"
                value={configForm.clientId}
                onChange={(e) => setConfigForm((f) => ({ ...f, clientId: e.target.value }))}
                className="flex-1"
              />
              <Button
                variant="ghost"
                onClick={() => setShowSecrets((prev) => ({ ...prev, clientId: !prev['clientId'] }))}
              >
                {showSecrets['clientId'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Client Secret */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Client Secret
            </label>
            <div className="flex gap-2">
              <Input
                type={showSecrets['clientSecret'] ? "text" : "password"}
                placeholder="Your client secret"
                value={configForm.clientSecret}
                onChange={(e) => setConfigForm((f) => ({ ...f, clientSecret: e.target.value }))}
                className="flex-1"
              />
              <Button
                variant="ghost"
                onClick={() => setShowSecrets((prev) => ({ ...prev, clientSecret: !prev['clientSecret'] }))}
              >
                {showSecrets['clientSecret'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Callback URL */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Callback URL
            </label>
            <div className="flex gap-2">
              <Input
                readOnly
                value="https://app.witylogix.com/auth/callback"
                className="flex-1 bg-[#1a1a2e]"
              />
              <Button
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText("https://app.witylogix.com/auth/callback");
                }}
                title="Copy to clipboard"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Use this URL in your auth provider settings
            </p>
          </div>
        </div>
      </Modal>

    </div>
  );
}
