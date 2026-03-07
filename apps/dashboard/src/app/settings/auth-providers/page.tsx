"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
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
} from "lucide-react";

interface AuthProvider {
  id: string;
  name: string;
  type: "auth0" | "clerk" | "cognito" | "firebase" | "oidc" | "saml";
  status: "connected" | "disconnected";
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
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, var(--wl-bg-primary) 0%, var(--wl-bg-secondary) 100%)" }}>
      <Header
        title="Authentication Providers"
        subtitle="Configure SSO providers, role mapping, and authentication settings"
      />

      <div style={{ maxWidth: "1300px", margin: "0 auto", padding: "2rem 1rem" }}>
        {/* Navigation Tabs */}
        <div style={{ marginBottom: "2rem" }}>
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} variant="underline" />
        </div>

        {/* PROVIDERS TAB */}
        {activeTab === "providers" && (
          <div>
            {/* Active Provider Info */}
            {providers.find((p) => p.id === activeProvider) && (
              <Card style={{ marginBottom: "2rem", borderLeft: "4px solid var(--wl-success)" }}>
                <CardContent style={{ paddingTop: "1.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <Badge variant="success">Active Provider</Badge>
                      <span style={{ fontSize: "1rem", fontWeight: "600", color: "var(--wl-text-primary)" }}>
                        {providers.find((p) => p.id === activeProvider)?.name}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.875rem", color: "var(--wl-text-tertiary)" }}>
                      All SSO authentication requests route through this provider
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Providers Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
                gap: "1.5rem",
                marginBottom: "2rem",
              }}
            >
              {providers.map((provider) => (
                <Card
                  key={provider.id}
                  style={{
                    position: "relative",
                    borderColor: activeProvider === provider.id ? "var(--wl-success)" : "var(--wl-border)",
                    borderWidth: activeProvider === provider.id ? "2px" : "1px",
                  }}
                >
                  {/* Active Indicator */}
                  {activeProvider === provider.id && (
                    <div
                      style={{
                        position: "absolute",
                        top: "-2px",
                        right: "1rem",
                        background: "var(--wl-success)",
                        color: "white",
                        padding: "0.25rem 0.75rem",
                        borderRadius: "0 0 0.5rem 0.5rem",
                        fontSize: "0.75rem",
                        fontWeight: "600",
                      }}
                    >
                      ACTIVE
                    </div>
                  )}

                  <CardHeader>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1rem" }}>
                      <div style={{ fontSize: "2.5rem" }}>{provider.icon}</div>
                      <div>
                        {provider.status === "connected" ? (
                          <Badge variant="success">Connected</Badge>
                        ) : (
                          <Badge variant="warning">Disconnected</Badge>
                        )}
                      </div>
                    </div>
                    <CardTitle style={{ fontSize: "1.25rem", marginBottom: "0.25rem" }}>
                      {provider.name}
                    </CardTitle>
                    <CardDescription>Provider ID: {provider.id}</CardDescription>
                  </CardHeader>

                  <CardContent>
                    <div style={{ marginBottom: "1.5rem" }}>
                      <div style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--wl-text-secondary)", marginBottom: "0.5rem" }}>
                        Capabilities
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                        {provider.capabilities.map((cap) => (
                          <Badge key={cap} variant="info" style={{ fontSize: "0.75rem" }}>
                            {cap}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {provider.config && (
                      <div style={{ background: "var(--wl-bg-tertiary)", padding: "1rem", borderRadius: "0.5rem", marginBottom: "1rem" }}>
                        {provider.config.domain && (
                          <div style={{ fontSize: "0.85rem", color: "var(--wl-text-secondary)", marginBottom: "0.5rem" }}>
                            <strong>Domain:</strong> {provider.config.domain}
                          </div>
                        )}
                        {provider.config.clientId && (
                          <div style={{ fontSize: "0.85rem", color: "var(--wl-text-secondary)", marginBottom: "0.5rem" }}>
                            <strong>Client ID:</strong> {provider.config.clientId}
                          </div>
                        )}
                        {provider.config.callbackUrl && (
                          <div style={{ fontSize: "0.85rem", color: "var(--wl-text-secondary)" }}>
                            <strong>Callback URL:</strong> {provider.config.callbackUrl}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>

                  <CardFooter style={{ display: "flex", gap: "0.5rem", paddingTop: 0 }}>
                    <Button
                      variant={provider.status === "connected" ? "secondary" : "primary"}
                      onClick={() => {
                        setSelectedProvider(provider);
                        setIsConfigModalOpen(true);
                      }}
                      style={{ flex: 1 }}
                    >
                      {provider.status === "connected" ? "Reconfigure" : "Connect"}
                    </Button>
                    {provider.status === "connected" && (
                      <Button
                        variant="ghost"
                        onClick={() => handleTestConnection(provider.id)}
                        style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                      >
                        <TestTube className="w-4 h-4" />
                        Test
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      onClick={() => handleDeleteProvider(provider.id)}
                      style={{ padding: "0.5rem" }}
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
                style={{
                  borderLeft: `4px solid ${testResult.status === "success" ? "var(--wl-success)" : "var(--wl-danger)"}`,
                  marginBottom: "2rem",
                }}
              >
                <CardContent style={{ paddingTop: "1.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    {testResult.status === "success" ? (
                      <CheckCircle className="w-6 h-6" style={{ color: "var(--wl-success)" }} />
                    ) : (
                      <AlertCircle className="w-6 h-6" style={{ color: "var(--wl-danger)" }} />
                    )}
                    <div>
                      <div style={{ fontSize: "0.9rem", fontWeight: "600", color: "var(--wl-text-primary)" }}>
                        {testResult.status === "success" ? "Connection Successful" : "Connection Failed"}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "var(--wl-text-secondary)" }}>
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
            <Card style={{ marginBottom: "2rem" }}>
              <CardHeader>
                <CardTitle>Role Mapping Configuration</CardTitle>
                <CardDescription>
                  Map external authentication provider roles to Witylogix platform roles
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  style={{
                    overflowX: "auto",
                    marginBottom: "1.5rem",
                  }}
                >
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.9rem",
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: "2px solid var(--wl-border)" }}>
                        <th style={{ padding: "1rem", textAlign: "left", color: "var(--wl-text-secondary)", fontWeight: "600" }}>
                          External Role
                        </th>
                        <th style={{ padding: "1rem", textAlign: "left", color: "var(--wl-text-secondary)", fontWeight: "600" }}>
                          Witylogix Role
                        </th>
                        <th style={{ padding: "1rem", textAlign: "left", color: "var(--wl-text-secondary)", fontWeight: "600" }}>
                          Permissions
                        </th>
                        <th style={{ padding: "1rem", textAlign: "center", color: "var(--wl-text-secondary)", fontWeight: "600" }}>
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {roleMapping.map((mapping, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: "1px solid var(--wl-border)",
                            background: idx % 2 === 0 ? "transparent" : "var(--wl-bg-tertiary)",
                          }}
                        >
                          <td style={{ padding: "1rem", color: "var(--wl-text-primary)" }}>
                            <code style={{ background: "var(--wl-bg-secondary)", padding: "0.25rem 0.5rem", borderRadius: "0.25rem", fontSize: "0.85rem" }}>
                              {mapping.externalRole}
                            </code>
                          </td>
                          <td style={{ padding: "1rem", color: "var(--wl-text-primary)" }}>
                            <Badge variant="primary">{mapping.witylogixRole}</Badge>
                          </td>
                          <td style={{ padding: "1rem", color: "var(--wl-text-secondary)", fontSize: "0.85rem" }}>
                            {mapping.witylogixRole === "SUPER_ADMIN" && "Full access"}
                            {mapping.witylogixRole === "ADMIN" && "Manage team, config"}
                            {mapping.witylogixRole === "DISPATCHER" && "Dispatch, track"}
                            {mapping.witylogixRole === "VIEWER" && "View-only access"}
                            {mapping.witylogixRole === "DRIVER" && "Driver app access"}
                          </td>
                          <td style={{ padding: "1rem", textAlign: "center" }}>
                            <Button
                              variant="ghost"
                              onClick={() => setIsMappingModalOpen(true)}
                              style={{ padding: "0.25rem", fontSize: "0.85rem" }}
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
            <Card style={{ marginBottom: "2rem" }}>
              <CardHeader>
                <CardTitle>Authentication Settings</CardTitle>
                <CardDescription>Configure global SSO and security options</CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
                  {/* JIT Provisioning */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "1.5rem", borderBottom: "1px solid var(--wl-border)" }}>
                    <div>
                      <div style={{ fontSize: "0.95rem", fontWeight: "600", color: "var(--wl-text-primary)", marginBottom: "0.25rem" }}>
                        Just-In-Time Provisioning
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "var(--wl-text-secondary)" }}>
                        Automatically create users on first SSO login
                      </div>
                    </div>
                    <Button
                      variant={jitProvisioning ? "primary" : "secondary"}
                      onClick={() => setJitProvisioning(!jitProvisioning)}
                      style={{ minWidth: "100px" }}
                    >
                      {jitProvisioning ? "Enabled" : "Disabled"}
                    </Button>
                  </div>

                  {/* MFA Required */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "1.5rem", borderBottom: "1px solid var(--wl-border)" }}>
                    <div>
                      <div style={{ fontSize: "0.95rem", fontWeight: "600", color: "var(--wl-text-primary)", marginBottom: "0.25rem" }}>
                        Enforce MFA for All Users
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "var(--wl-text-secondary)" }}>
                        Require multi-factor authentication on login
                      </div>
                    </div>
                    <Button variant="secondary" style={{ minWidth: "100px" }}>Disabled</Button>
                  </div>

                  {/* Session Timeout */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", paddingBottom: "1.5rem", borderBottom: "1px solid var(--wl-border)" }}>
                    <div>
                      <div style={{ fontSize: "0.95rem", fontWeight: "600", color: "var(--wl-text-primary)", marginBottom: "0.25rem" }}>
                        Session Timeout
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "var(--wl-text-secondary)" }}>
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
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: "0.95rem", fontWeight: "600", color: "var(--wl-text-primary)", marginBottom: "0.25rem" }}>
                        IP Whitelist
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "var(--wl-text-secondary)" }}>
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
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => setIsConfigModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfigSave}>
              Save Configuration
            </Button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Domain/Tenant */}
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "var(--wl-text-primary)", marginBottom: "0.5rem" }}>
              Domain / Tenant
            </label>
            <Input placeholder="e.g., witylogix.auth0.com" defaultValue={selectedProvider?.config?.domain || ""} />
          </div>

          {/* Client ID */}
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "var(--wl-text-primary)", marginBottom: "0.5rem" }}>
              Client ID
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <Input
                type={showSecrets[selectedProvider?.id || ""] ? "text" : "password"}
                placeholder="Your client ID"
                defaultValue={selectedProvider?.config?.clientId || ""}
                style={{ flex: 1 }}
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
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "var(--wl-text-primary)", marginBottom: "0.5rem" }}>
              Client Secret
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <Input
                type={showSecrets[selectedProvider?.id || ""] ? "text" : "password"}
                placeholder="Your client secret"
                defaultValue={selectedProvider?.config?.clientSecret || ""}
                style={{ flex: 1 }}
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
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "var(--wl-text-primary)", marginBottom: "0.5rem" }}>
              Callback URL
            </label>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <Input
                readOnly
                value="https://app.witylogix.com/auth/callback"
                style={{ flex: 1, background: "var(--wl-bg-tertiary)" }}
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
            <p style={{ fontSize: "0.75rem", color: "var(--wl-text-tertiary)", marginTop: "0.5rem" }}>
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
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => setIsMappingModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => setIsMappingModalOpen(false)}>
              Save Mapping
            </Button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "var(--wl-text-primary)", marginBottom: "0.5rem" }}>
              External Role Claim
            </label>
            <Input placeholder="e.g., admin, manager, viewer" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", color: "var(--wl-text-primary)", marginBottom: "0.5rem" }}>
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
