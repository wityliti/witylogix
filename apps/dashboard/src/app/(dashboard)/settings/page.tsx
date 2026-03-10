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
import { Switch } from "@/components/ui/switch";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  User,
  Building2,
  CreditCard,
  Zap,
  Key,
  Upload,
  Copy,
  Trash2,
  Plus,
  Check,
  AlertCircle,
} from "lucide-react";

interface APIKey {
  id: string;
  name: string;
  key: string;
  masked: string;
  createdAt: string;
  lastUsed?: string;
}

const mockAPIKeys: APIKey[] = [
  {
    id: "key-001",
    name: "Production API Key",
    key: "wl_live_51234567890abcdef",
    masked: "wl_live_••••••••••••••••••••••••••••••••",
    createdAt: "2025-01-15",
    lastUsed: "2 hours ago",
  },
  {
    id: "key-002",
    name: "Development API Key",
    key: "wl_test_test1234567890abcdef",
    masked: "wl_test_••••••••••••••••••••••••••••••••",
    createdAt: "2025-02-10",
    lastUsed: "30 minutes ago",
  },
  {
    id: "key-003",
    name: "Staging API Key",
    key: "sk_stage_stage1234567890abcdef",
    masked: "sk_stage_•••••••••••••••••••••••••••••••",
    createdAt: "2025-02-05",
  },
];

interface IntegrationPlatform {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: "connected" | "disconnected";
  connectedAt?: string;
}

const integrations: IntegrationPlatform[] = [
  {
    id: "stripe",
    name: "Stripe",
    icon: <CreditCard className="w-5 h-5" />,
    status: "connected",
    connectedAt: "2025-01-20",
  },
  {
    id: "shopify",
    name: "Shopify",
    icon: <Zap className="w-5 h-5" />,
    status: "connected",
    connectedAt: "2025-02-01",
  },
  {
    id: "twilio",
    name: "Twilio",
    icon: <Key className="w-5 h-5" />,
    status: "disconnected",
  },
  {
    id: "slack",
    name: "Slack",
    icon: <AlertCircle className="w-5 h-5" />,
    status: "connected",
    connectedAt: "2025-02-15",
  },
];

// Profile Tab Content
const ProfileTab = () => {
  const [profile, setProfile] = useState({
    name: "Sarah Chen",
    email: "sarah.chen@witylogix.com",
    timezone: "America/New_York",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate save
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profile Information</CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Upload */}
          <div>
            <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-3">
              Avatar
            </label>
            <div className="flex items-center gap-6">
              <img
                src={profile.avatar}
                alt="Avatar"
                className="w-24 h-24 rounded-full border-2 border-[var(--wl-border)]"
              />
              <Button variant="secondary" size="sm">
                <Upload className="w-4 h-4 mr-2" />
                Upload Photo
              </Button>
            </div>
          </div>

          {/* Name Field */}
          <div>
            <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
              Full Name
            </label>
            <Input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              placeholder="Your full name"
            />
          </div>

          {/* Email Field */}
          <div>
            <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
              Email Address
            </label>
            <Input
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              placeholder="your.email@example.com"
            />
          </div>

          {/* Timezone Field */}
          <div>
            <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
              Timezone
            </label>
            <select
              value={profile.timezone}
              onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
              className="w-full px-3 py-2 bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] border border-[var(--wl-border)] rounded-md text-sm"
            >
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="Europe/London">London (GMT)</option>
              <option value="Europe/Paris">Paris (CET)</option>
              <option value="Asia/Tokyo">Tokyo (JST)</option>
              <option value="Australia/Sydney">Sydney (AEDT)</option>
            </select>
          </div>
        </CardContent>

        <CardFooter className="flex gap-3">
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
          <Button variant="secondary">Cancel</Button>
        </CardFooter>
      </Card>
    </div>
  );
};

// Organization Tab Content
const OrganizationTab = () => {
  const [org, setOrg] = useState({
    name: "Witylogix Inc.",
    logo: "https://api.dicebear.com/7.x/icons/svg?seed=witylogix",
    businessAddress: "123 Tech Street, San Francisco, CA 94105",
    defaultCurrency: "USD",
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Organization Details</CardTitle>
          <CardDescription>Manage your organization information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo Upload */}
          <div>
            <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-3">
              Organization Logo
            </label>
            <div className="flex items-center gap-6">
              <img
                src={org.logo}
                alt="Logo"
                className="w-20 h-20 rounded-lg border border-[var(--wl-border)]"
              />
              <Button variant="secondary" size="sm">
                <Upload className="w-4 h-4 mr-2" />
                Upload Logo
              </Button>
            </div>
          </div>

          {/* Organization Name */}
          <div>
            <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
              Organization Name
            </label>
            <Input
              type="text"
              value={org.name}
              onChange={(e) => setOrg({ ...org, name: e.target.value })}
              placeholder="Your organization name"
            />
          </div>

          {/* Business Address */}
          <div>
            <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
              Business Address
            </label>
            <Input
              type="text"
              value={org.businessAddress}
              onChange={(e) => setOrg({ ...org, businessAddress: e.target.value })}
              placeholder="Full business address"
            />
          </div>

          {/* Default Currency */}
          <div>
            <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
              Default Currency
            </label>
            <select
              value={org.defaultCurrency}
              onChange={(e) => setOrg({ ...org, defaultCurrency: e.target.value })}
              className="w-full px-3 py-2 bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] border border-[var(--wl-border)] rounded-md text-sm"
            >
              <option value="USD">US Dollar (USD)</option>
              <option value="EUR">Euro (EUR)</option>
              <option value="GBP">British Pound (GBP)</option>
              <option value="JPY">Japanese Yen (JPY)</option>
              <option value="CAD">Canadian Dollar (CAD)</option>
              <option value="AUD">Australian Dollar (AUD)</option>
            </select>
          </div>
        </CardContent>

        <CardFooter className="flex gap-3">
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
          <Button variant="secondary">Cancel</Button>
        </CardFooter>
      </Card>
    </div>
  );
};

// Billing Tab Content
const BillingTab = () => {
  return (
    <div className="space-y-6">
      {/* Current Plan Card */}
      <Card className="border-l-4 border-l-[var(--wl-primary)]">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="text-lg">Current Plan</CardTitle>
            <Badge variant="success">Pro Plan</Badge>
          </div>
          <CardDescription>
            Active since January 15, 2025
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-[var(--wl-bg-secondary)] rounded-lg">
              <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-1">
                Monthly Cost
              </p>
              <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
                $299
              </p>
            </div>
            <div className="p-4 bg-[var(--wl-bg-secondary)] rounded-lg">
              <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-1">
                Billing Cycle
              </p>
              <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
                Monthly
              </p>
            </div>
            <div className="p-4 bg-[var(--wl-bg-secondary)] rounded-lg">
              <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-1">
                Next Billing
              </p>
              <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
                Apr 15
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Usage Statistics</CardTitle>
          <CardDescription>Your current plan limits and usage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Orders/month */}
          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="text-sm font-semibold text-[var(--wl-text-primary)]">
                Orders per Month
              </label>
              <span className="text-xs text-[var(--wl-text-secondary)]">
                8,450 / 10,000
              </span>
            </div>
            <div className="w-full bg-[var(--wl-bg-secondary)] rounded-full h-2">
              <div
                className="bg-[var(--wl-primary)] h-2 rounded-full transition-all"
                style={{ width: "84.5%" }}
              />
            </div>
          </div>

          {/* Drivers */}
          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="text-sm font-semibold text-[var(--wl-text-primary)]">
                Active Drivers
              </label>
              <span className="text-xs text-[var(--wl-text-secondary)]">
                45 / 100
              </span>
            </div>
            <div className="w-full bg-[var(--wl-bg-secondary)] rounded-full h-2">
              <div
                className="bg-[var(--wl-primary)] h-2 rounded-full transition-all"
                style={{ width: "45%" }}
              />
            </div>
          </div>

          {/* API Calls */}
          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="text-sm font-semibold text-[var(--wl-text-primary)]">
                API Calls per Month
              </label>
              <span className="text-xs text-[var(--wl-text-secondary)]">
                2.8M / 5M
              </span>
            </div>
            <div className="w-full bg-[var(--wl-bg-secondary)] rounded-full h-2">
              <div
                className="bg-[var(--wl-warning)] h-2 rounded-full transition-all"
                style={{ width: "56%" }}
              />
            </div>
          </div>
        </CardContent>

        <CardFooter>
          <Button variant="primary">
            Upgrade Plan
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

// Integrations Tab Content
const IntegrationsTab = () => {
  const [connectedIntegrations, setConnectedIntegrations] = useState<string[]>(
    integrations
      .filter((i) => i.status === "connected")
      .map((i) => i.id)
  );

  const toggleIntegration = (id: string) => {
    setConnectedIntegrations((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connected Integrations</CardTitle>
          <CardDescription>
            Manage third-party integrations with Witylogix
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {integrations.map((integration) => {
              const isConnected = connectedIntegrations.includes(integration.id);
              return (
                <div
                  key={integration.id}
                  className="flex items-center justify-between p-4 border border-[var(--wl-border)] rounded-lg hover:bg-[var(--wl-bg-secondary)] transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-[var(--wl-bg-secondary)] rounded-lg">
                      {integration.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--wl-text-primary)]">
                        {integration.name}
                      </p>
                      {isConnected && integration.connectedAt && (
                        <p className="text-xs text-[var(--wl-text-secondary)]">
                          Connected on {integration.connectedAt}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isConnected && (
                      <Badge variant="success" className="flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Connected
                      </Badge>
                    )}
                    <Button
                      variant={isConnected ? "secondary" : "primary"}
                      size="sm"
                      onClick={() => toggleIntegration(integration.id)}
                    >
                      {isConnected ? "Disconnect" : "Connect"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// API Keys Tab Content
const APIKeysTab = () => {
  const [apiKeys, setApiKeys] = useState<APIKey[]>(mockAPIKeys);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const revokeKey = (id: string) => {
    setApiKeys((prev) => prev.filter((key) => key.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="primary">
          <Plus className="w-4 h-4 mr-2" />
          Create New Key
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API Keys</CardTitle>
          <CardDescription>
            Manage your API keys for programmatic access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {apiKeys.length > 0 ? (
              apiKeys.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className="p-4 border border-[var(--wl-border)] rounded-lg hover:bg-[var(--wl-bg-secondary)] transition-all"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p className="font-semibold text-[var(--wl-text-primary)]">
                        {apiKey.name}
                      </p>
                      <p className="text-xs text-[var(--wl-text-secondary)] mt-1 font-mono">
                        {apiKey.masked}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => copyToClipboard(apiKey.key, apiKey.id)}
                        className="flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copiedId === apiKey.id ? "Copied!" : "Copy"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => revokeKey(apiKey.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-6 text-xs text-[var(--wl-text-secondary)]">
                    <div>
                      <span className="font-semibold">Created:</span> {apiKey.createdAt}
                    </div>
                    {apiKey.lastUsed && (
                      <div>
                        <span className="font-semibold">Last Used:</span> {apiKey.lastUsed}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Key className="w-12 h-12 text-[var(--wl-text-secondary)] mx-auto mb-3 opacity-30" />
                <p className="text-[var(--wl-text-secondary)]">
                  No API keys created yet
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Main Settings Page
export default function SettingsPageDashboard() {
  const [activeTab, setActiveTab] = useState("profile");

  const tabs = [
    { id: "profile", label: "Profile", icon: <User className="w-4 h-4" /> },
    { id: "organization", label: "Organization", icon: <Building2 className="w-4 h-4" /> },
    { id: "billing", label: "Billing", icon: <CreditCard className="w-4 h-4" /> },
    { id: "integrations", label: "Integrations", icon: <Zap className="w-4 h-4" /> },
    { id: "api-keys", label: "API Keys", icon: <Key className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[var(--wl-bg-primary)]">
      <Header
        title="Settings"
        subtitle="Manage your dashboard settings and preferences"
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-[var(--wl-bg-secondary)]">
          <CardContent className="pt-6">
            <Tabs
              tabs={tabs}
              activeTab={activeTab}
              onChange={setActiveTab}
              variant="underline"
              size="md"
            />
          </CardContent>
        </Card>

        <div className="mt-8">
          {activeTab === "profile" && <ProfileTab />}
          {activeTab === "organization" && <OrganizationTab />}
          {activeTab === "billing" && <BillingTab />}
          {activeTab === "integrations" && <IntegrationsTab />}
          {activeTab === "api-keys" && <APIKeysTab />}
        </div>
      </main>
    </div>
  );
}
