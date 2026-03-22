'use client';

import { useState } from 'react';
import { useApiList, useApiMutation } from '@/hooks/use-api';
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
  Server,
  TestTube,
  ChevronRight,
} from 'lucide-react';

interface AuthProvider {
  id: string;
  name: string;
  type: 'auth0' | 'clerk' | 'cognito' | 'firebase' | 'oidc' | 'saml';
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

const mockProviders: AuthProvider[] = [
  {
    id: "auth0-prod",
    name: "Auth0",
    type: "auth0",
    status: "connected",
    icon: "🔐",
    capabilities: ["SSO", "MFA", "Social Login", "Role Mapping"],
    config: {
      domain: "witylogix.auth0.com",
      clientId: "abc123***",
      callbackUrl: "https://app.witylogix.com/auth/callback",
    },
  },
  {
    id: "clerk-dev",
    name: "Clerk",
    type: "clerk",
    status: "disconnected",
    icon: "🎫",
    capabilities: ["SSO", "Multi-org", "Session Management"],
  },
  {
    id: "cognito-dev",
    name: "AWS Cognito",
    type: "cognito",
    status: "disconnected",
    icon: "☁️",
    capabilities: ["User Pools", "Identity Federation", "MFA"],
  },
  {
    id: "firebase-test",
    name: "Firebase Auth",
    type: "firebase",
    status: "disconnected",
    icon: "🔥",
    capabilities: ["Email/Password", "Social", "Phone Auth"],
  },
  {
    id: "oidc-generic",
    name: "Generic OIDC",
    type: "oidc",
    status: "disconnected",
    icon: "🔑",
    capabilities: ["Custom Providers", "Enterprise SSO"],
  },
  {
    id: "saml-enterprise",
    name: "SAML 2.0",
    type: "saml",
    status: "disconnected",
    icon: "🏢",
    capabilities: ["Enterprise SSO", "Okta", "Azure AD"],
  },
];

const roleMapping = [
  { externalRole: "admin", witylogixRole: "SUPER_ADMIN" },
  { externalRole: "manager", witylogixRole: "ADMIN" },
  { externalRole: "dispatcher", witylogixRole: "DISPATCHER" },
  { externalRole: "viewer", witylogixRole: "VIEWER" },
  { externalRole: "driver", witylogixRole: "DRIVER" },
];

export default function AuthProvidersPage() {
  const [providers, setProviders] = useState<AuthProvider[]>(mockProviders);
  const [activeTab, setActiveTab] = useState("providers");
  const [selectedProvider, setSelectedProvider] = useState<AuthProvider | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [activeProvider, setActiveProvider] = useState<string>("auth0-prod");
  const [testResult, setTestResult] = useState<{ status: "success" | "error"; message: string } | null>(null);
  const [jitProvisioning, setJitProvisioning] = useState(true);

  const handleTestConnection = (providerId: string) => {
    setTimeout(() => {
      setTestResult({
        status: "success",
        message: "Connection successful! Auth provider is reachable and properly configured.",
      });
    }, 1500);
  };

  const handleConfigSave = () => {
    setIsConfigModalOpen(false);
    if (selectedProvider) {
      setProviders((prev) =>
        prev.map((p) => (p.id === selectedProvider.id ? { ...p, status: "connected" } : p))
      );
      setActiveProvider(selectedProvider.id);
    }
  };

  const handleDeleteProvider = (providerId: string) => {
    setProviders((prev) => prev.filter((p) => p.id !== providerId));
    if (activeProvider === providerId) {
      setActiveProvider(providers[0]?.id || "");
    }
  };

  const tabs = [
    { id: "providers", label: "Providers", count: providers.length },
    { id: "role-mapping", label: "Role Mapping", icon: "🔗" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

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
            {/* Active Provider Info */}
            {providers.find((p) => p.id === activeProvider) && (
              <Card className="mb-8 border-l-4 border-l-emerald-500 bg-[#12121a] border border-[#1e1e2e]">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <Badge variant="success">Active Provider</Badge>
                      <span className="text-base font-semibold text-[var(--wl-text-primary)]">
                        {providers.find((p) => p.id === activeProvider)?.name}
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
                      onClick={() => {
                        setSelectedProvider(provider);
                        setIsConfigModalOpen(true);
                      }}
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
                      {roleMapping.map((mapping, idx) => (
                        <tr
                          key={idx}
                          className={cn(
                            "border-b border-[#1e1e2e]",
                            idx % 2 === 1 && "bg-[#1a1a2e]"
                          )}
                        >
                          <td className="py-4 px-4 text-white">
                            <code className="bg-[#0a0a0f] px-2 py-1 rounded text-xs text-gray-400">
                              {mapping.externalRole}
                            </code>
                          </td>
                          <td className="py-4 px-4 text-white">
                            <Badge variant="primary">{mapping.witylogixRole}</Badge>
                          </td>
                          <td className="py-4 px-4 text-gray-400 text-xs">
                            {mapping.witylogixRole === "SUPER_ADMIN" && "Full access"}
                            {mapping.witylogixRole === "ADMIN" && "Manage team, config"}
                            {mapping.witylogixRole === "DISPATCHER" && "Dispatch, track"}
                            {mapping.witylogixRole === "VIEWER" && "View-only access"}
                            {mapping.witylogixRole === "DRIVER" && "Driver app access"}
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
            <Input placeholder="e.g., witylogix.auth0.com" defaultValue={selectedProvider?.config?.domain || ""} />
          </div>

          {/* Client ID */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Client ID
            </label>
            <div className="flex gap-2">
              <Input
                type={showSecrets[selectedProvider?.id || ""] ? "text" : "password"}
                placeholder="Your client ID"
                defaultValue={selectedProvider?.config?.clientId || ""}
                className="flex-1"
              />
              <Button
                variant="ghost"
                onClick={() =>
                  setShowSecrets((prev) => ({
                    ...prev,
                    [selectedProvider?.id || ""]: !prev[selectedProvider?.id || ""],
                  }))
                }
              >
                {showSecrets[selectedProvider?.id || ""] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                type={showSecrets[selectedProvider?.id || ""] ? "text" : "password"}
                placeholder="Your client secret"
                defaultValue={selectedProvider?.config?.clientSecret || ""}
                className="flex-1"
              />
              <Button
                variant="ghost"
                onClick={() =>
                  setShowSecrets((prev) => ({
                    ...prev,
                    [selectedProvider?.id || ""]: !prev[selectedProvider?.id || ""],
                  }))
                }
              >
                {showSecrets[selectedProvider?.id || ""] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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

      {/* Role Mapping Modal */}
      <Modal
        isOpen={isMappingModalOpen}
        onClose={() => setIsMappingModalOpen(false)}
        title="Edit Role Mapping"
        size="md"
        footer={
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setIsMappingModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setIsMappingModalOpen(false)}>
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
