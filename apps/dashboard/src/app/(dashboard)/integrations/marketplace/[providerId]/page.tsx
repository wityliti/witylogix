"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { useApiQuery } from '@/hooks/use-api';
import { useParams } from 'next/navigation';

/* ═══════════════════════════════════════════════════════════
   INTEGRATION DETAIL PAGE
   Single provider configuration & setup
   ═══════════════════════════════════════════════════════════ */

type AuthType = "oauth2" | "api_key" | "basic_auth" | "custom";
type Status = "AVAILABLE" | "CONNECTED" | "COMING_SOON" | "BETA";

interface ProviderDetails {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  longDescription: string;
  status: Status;
  authType: AuthType;
  popular: boolean;
  connected: boolean;
  features: string[];
  supportedOperations: string[];
  webhookSupported: boolean;
  webhookUrl?: string;
  documentationUrl: string;
  setupInstructions: string[];
}

// Sample provider data
const PROVIDERS: Record<string, ProviderDetails> = {
  hubspot: {
    id: "crm-1",
    slug: "hubspot",
    name: "HubSpot",
    category: "CRM",
    description: "Customer relationship management platform",
    longDescription:
      "HubSpot is a comprehensive CRM platform that helps businesses manage customer interactions, sales pipelines, and marketing campaigns. Integrating HubSpot with Witylogix enables seamless synchronization of customer data and logistics information.",
    status: "AVAILABLE",
    authType: "oauth2",
    popular: true,
    connected: false,
    features: [
      "Contact Management",
      "Deal Tracking",
      "Email Integration",
      "Analytics",
      "Custom Fields",
      "Workflow Automation",
    ],
    supportedOperations: [
      "Create Contact",
      "Update Deal",
      "Get Company Info",
      "Create Task",
      "Send Email",
      "Update Pipeline",
    ],
    webhookSupported: true,
    webhookUrl: "https://api.witylogix.com/webhooks/hubspot",
    documentationUrl: "https://developers.hubspot.com",
    setupInstructions: [
      "Visit HubSpot and sign in to your account",
      "Navigate to Settings > Integrations",
      "Authorize Witylogix to access your account",
      "Select the scopes you want to grant",
      "Review and confirm the permissions",
      "You're all set! Data will start syncing.",
    ],
  },
  sendgrid: {
    id: "email-1",
    slug: "sendgrid",
    name: "SendGrid",
    category: "EMAIL",
    description: "Transactional email delivery service",
    longDescription:
      "SendGrid provides reliable email delivery with advanced tracking and analytics. Integrate with Witylogix to send transactional emails, delivery notifications, and customer communications.",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    connected: true,
    features: [
      "Email Delivery",
      "Template Engine",
      "Analytics",
      "Bounce Management",
      "List Management",
      "Webhook Support",
    ],
    supportedOperations: [
      "Send Email",
      "Get Contact",
      "Update Contact",
      "Delete Contact",
      "Get Analytics",
      "Create Campaign",
    ],
    webhookSupported: true,
    webhookUrl: "https://api.witylogix.com/webhooks/sendgrid",
    documentationUrl: "https://sendgrid.com/docs",
    setupInstructions: [
      "Log in to your SendGrid account",
      "Navigate to Settings > API Keys",
      "Create a new API key or use an existing one",
      "Copy your API key",
      "Paste it in the configuration form below",
      "Test the connection to verify",
    ],
  },
  twilio: {
    id: "sms-1",
    slug: "twilio",
    name: "Twilio",
    category: "SMS",
    description: "Programmable SMS and voice APIs",
    longDescription:
      "Twilio provides programmable communication APIs for SMS, voice, and more. Integrate with Witylogix to send SMS notifications, make voice calls, and handle customer communications.",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    connected: true,
    features: [
      "SMS Messaging",
      "Voice Calls",
      "WhatsApp Integration",
      "Call Recording",
      "IVR Support",
      "Number Intelligence",
    ],
    supportedOperations: [
      "Send SMS",
      "Make Call",
      "Get Message Status",
      "Record Call",
      "Send WhatsApp",
      "Get Call Recording",
    ],
    webhookSupported: true,
    webhookUrl: "https://api.witylogix.com/webhooks/twilio",
    documentationUrl: "https://www.twilio.com/docs",
    setupInstructions: [
      "Sign in to your Twilio account",
      "Find your Account SID and Auth Token",
      "Go to Account Info in your dashboard",
      "Copy the Account SID and Auth Token",
      "Enter them in the configuration form",
      "Verify by sending a test SMS",
    ],
  },
  mapbox: {
    id: "routing-1",
    slug: "mapbox",
    name: "Mapbox",
    category: "ROUTING",
    description: "Maps, routing and optimization APIs",
    longDescription:
      "Mapbox provides powerful mapping and routing APIs for route optimization, turn-by-turn navigation, and location services. Integrate with Witylogix for advanced routing capabilities.",
    status: "AVAILABLE",
    authType: "api_key",
    popular: true,
    connected: true,
    features: [
      "Route Optimization",
      "Geocoding",
      "Static Maps",
      "Turn-by-Turn Navigation",
      "Distance Matrix",
      "Traffic Data",
    ],
    supportedOperations: [
      "Get Route",
      "Geocode Address",
      "Get Matrix",
      "Get Directions",
      "Create Map",
      "Get Traffic",
    ],
    webhookSupported: false,
    documentationUrl: "https://docs.mapbox.com",
    setupInstructions: [
      "Create or sign in to your Mapbox account",
      "Go to Account > Tokens",
      "Create a new access token",
      "Copy the token (keep it secret!)",
      "Paste in the configuration form",
      "Your routes are ready to optimize",
    ],
  },
};

export default function ProviderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const providerId = params.providerId as string;

  const provider = PROVIDERS[providerId];

  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [authStep, setAuthStep] = useState<"details" | "credentials" | "testing" | "success">(
    "details"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [testResult, setTestResult] = useState<"pending" | "success" | "error">(
    "pending"
  );
  const [formData, setFormData] = useState({
    accountSid: "",
    authToken: "",
    apiKey: "",
    username: "",
    password: "",
  });

  if (!provider) {
    return (
      <div className={cn("p-6 text-center text-wl-text-tertiary")}>
        <div className="text-lg font-semibold mb-2">Provider not found</div>
        <Link href="/integrations/marketplace">
          <Button variant="secondary">Back to Marketplace</Button>
        </Link>
      </div>
    );
  }

  const handleConnect = () => {
    setIsConnectDialogOpen(true);
    setAuthStep("details");
  };

  const handleCredentialsSubmit = async () => {
    setIsLoading(true);
    setAuthStep("testing");

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    setTestResult("success");
    setIsLoading(false);
  };

  const handleTestConnection = async () => {
    setIsLoading(true);
    setTestResult("pending");

    // Simulate connection test
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setTestResult("success");
    setIsLoading(false);
  };

  const handleSuccessClose = () => {
    setIsConnectDialogOpen(false);
    setAuthStep("details");
    setFormData({ accountSid: "", authToken: "", apiKey: "", username: "", password: "" });
  };

  const statusColor =
    provider.status === "CONNECTED"
      ? "success"
      : provider.status === "BETA"
        ? "info"
        : provider.status === "COMING_SOON"
          ? "default"
          : "primary";

  return (
    <>
      <Header
        title={provider.name}
        subtitle={`${provider.category} Integration`}
        actions={
          <Link href="/integrations/marketplace">
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
        }
      />

      <div className={cn("p-6 max-w-4xl mx-auto space-y-6")}>
        {/* Header Card */}
        <Card>
          <CardContent className="pt-6">
            <div className={cn("flex items-start gap-6")}>
              <div
                className={cn(
                  "w-24 h-24 rounded-lg bg-wl-bg-surface flex items-center justify-center flex-shrink-0"
                )}
              >
                <span className="text-5xl">📦</span>
              </div>

              <div className={cn("flex-1 min-w-0")}>
                <div className={cn("flex items-center gap-3 mb-3")}>
                  <h1 className={cn("text-2xl font-bold text-wl-text-primary")}>
                    {provider.name}
                  </h1>
                  {provider.popular && (
                    <Badge variant="primary">Popular</Badge>
                  )}
                </div>

                <p className={cn("text-wl-text-secondary mb-4")}>
                  {provider.longDescription}
                </p>

                <div className={cn("flex flex-wrap gap-2")}>
                  <Badge variant={statusColor}>
                    {provider.status.replace(/_/g, " ")}
                  </Badge>
                  <Badge variant="info">
                    Auth: {provider.authType.replace(/_/g, " ")}
                  </Badge>
                  {provider.connected && (
                    <Badge variant="success">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                </div>
              </div>

              <div>
                {provider.connected ? (
                  <Button variant="secondary">Manage</Button>
                ) : (
                  <Button variant="primary" onClick={handleConnect}>
                    Connect Integration
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Two Column Layout */}
        <div className={cn("grid grid-cols-3 gap-6")}>
          {/* Main Content */}
          <div className={cn("col-span-2 space-y-6")}>
            {/* Features */}
            <Card>
              <CardHeader>
                <CardTitle>Features</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn("grid grid-cols-2 gap-3")}>
                  {provider.features.map((feature) => (
                    <div
                      key={feature}
                      className={cn("flex items-center gap-2 p-2 rounded bg-wl-bg-surface")}
                    >
                      <CheckCircle className="w-4 h-4 text-wl-success-400 flex-shrink-0" />
                      <span className="text-sm text-wl-text-primary">{feature}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Supported Operations */}
            <Card>
              <CardHeader>
                <CardTitle>Supported Operations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={cn("space-y-2")}>
                  {provider.supportedOperations.map((op) => (
                    <div
                      key={op}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded border border-wl-border-subtle"
                      )}
                    >
                      <CheckCircle className="w-4 h-4 text-wl-primary-400 flex-shrink-0" />
                      <span className="text-sm text-wl-text-primary">{op}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Setup Instructions */}
            <Card>
              <CardHeader>
                <CardTitle>Setup Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className={cn("space-y-3")}>
                  {provider.setupInstructions.map((instruction, idx) => (
                    <li key={idx} className={cn("flex gap-4")}>
                      <span
                        className={cn(
                          "flex-shrink-0 w-6 h-6 rounded-full bg-wl-primary-500 text-wl-text-inverse",
                          "flex items-center justify-center text-xs font-semibold"
                        )}
                      >
                        {idx + 1}
                      </span>
                      <span className={cn("text-sm text-wl-text-primary pt-0.5")}>
                        {instruction}
                      </span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <aside className={cn("space-y-6")}>
            {/* Quick Info */}
            <Card>
              <CardHeader>
                <CardTitle>Integration Info</CardTitle>
              </CardHeader>
              <CardContent className={cn("space-y-4")}>
                <div>
                  <div className={cn("text-xs text-wl-text-tertiary uppercase tracking-wide mb-1")}>
                    Category
                  </div>
                  <div className={cn("text-sm font-medium text-wl-text-primary")}>
                    {provider.category}
                  </div>
                </div>
                <div>
                  <div className={cn("text-xs text-wl-text-tertiary uppercase tracking-wide mb-1")}>
                    Authentication
                  </div>
                  <div className={cn("text-sm font-medium text-wl-text-primary")}>
                    {provider.authType.replace(/_/g, " ")}
                  </div>
                </div>
                <div>
                  <div className={cn("text-xs text-wl-text-tertiary uppercase tracking-wide mb-1")}>
                    Webhooks
                  </div>
                  <div className={cn("text-sm font-medium text-wl-text-primary")}>
                    {provider.webhookSupported ? "Supported" : "Not supported"}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Webhook URL */}
            {provider.webhookSupported && provider.webhookUrl && (
              <Card>
                <CardHeader>
                  <CardTitle>Webhook URL</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={cn("space-y-2")}>
                    <p className={cn("text-xs text-wl-text-tertiary mb-2")}>
                      Use this URL for webhook configuration:
                    </p>
                    <div
                      className={cn(
                        "flex items-center gap-2 p-2 bg-wl-bg-surface rounded border border-wl-border-subtle"
                      )}
                    >
                      <code className={cn("flex-1 text-xs text-wl-text-secondary truncate")}>
                        {provider.webhookUrl}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(provider.webhookUrl!);
                        }}
                        className={cn(
                          "p-1 hover:bg-wl-bg-overlay rounded transition-all"
                        )}
                      >
                        <Copy className="w-4 h-4 text-wl-text-tertiary" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Documentation Link */}
            <Button
              variant="ghost"
              className={cn("w-full justify-start")}
              onClick={() => window.open(provider.documentationUrl, "_blank")}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Documentation
            </Button>
          </aside>
        </div>
      </div>

      {/* Connect Dialog */}
      <Modal
        isOpen={isConnectDialogOpen}
        onClose={() => setIsConnectDialogOpen(false)}
        title={`Connect ${provider.name}`}
        size="lg"
      >
        {authStep === "details" && (
          <div className={cn("space-y-4")}>
            <p className={cn("text-sm text-wl-text-secondary")}>
              Review the integration details before connecting:
            </p>

            <div className={cn("space-y-3 bg-wl-bg-surface p-4 rounded-lg")}>
              <div>
                <div className={cn("text-xs text-wl-text-tertiary uppercase tracking-wide")}>
                  Provider
                </div>
                <div className={cn("text-sm font-medium text-wl-text-primary")}>
                  {provider.name}
                </div>
              </div>
              <div>
                <div className={cn("text-xs text-wl-text-tertiary uppercase tracking-wide")}>
                  Authentication Type
                </div>
                <div className={cn("text-sm font-medium text-wl-text-primary")}>
                  {provider.authType === "oauth2"
                    ? "OAuth 2.0"
                    : provider.authType === "api_key"
                      ? "API Key"
                      : provider.authType === "basic_auth"
                        ? "Basic Authentication"
                        : "Custom"}
                </div>
              </div>
              <div>
                <div className={cn("text-xs text-wl-text-tertiary uppercase tracking-wide")}>
                  Permissions Requested
                </div>
                <div className={cn("text-sm text-wl-text-primary space-y-1 mt-1")}>
                  <div className={cn("flex items-center gap-2")}>
                    <Check className="w-3 h-3 text-wl-success-400" />
                    Read access to {provider.name} data
                  </div>
                  <div className={cn("flex items-center gap-2")}>
                    <Check className="w-3 h-3 text-wl-success-400" />
                    Write access to selected resources
                  </div>
                  {provider.webhookSupported && (
                    <div className={cn("flex items-center gap-2")}>
                      <Check className="w-3 h-3 text-wl-success-400" />
                      Webhook configuration
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={cn("flex gap-2 pt-4")}>
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setIsConnectDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => setAuthStep("credentials")}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {authStep === "credentials" && (
          <div className={cn("space-y-4")}>
            <p className={cn("text-sm text-wl-text-secondary")}>
              {provider.authType === "oauth2"
                ? "You'll be redirected to authenticate with " + provider.name
                : "Enter your " + provider.name + " credentials"}
            </p>

            {provider.authType === "oauth2" ? (
              <Button
                variant="primary"
                className="w-full"
                onClick={handleCredentialsSubmit}
              >
                Authorize with {provider.name}
              </Button>
            ) : provider.authType === "api_key" ? (
              <div className={cn("space-y-3")}>
                <Input
                  label="API Key"
                  type={showApiKey ? "text" : "password"}
                  value={formData.apiKey}
                  onChange={(e) =>
                    setFormData({ ...formData, apiKey: e.target.value })
                  }
                  placeholder="Enter your API key"
                  icon={
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="text-wl-text-tertiary hover:text-wl-text-primary"
                    >
                      {showApiKey ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  }
                />
                <div className={cn("text-xs text-wl-text-tertiary")}>
                  Your API key is encrypted and never shared
                </div>
              </div>
            ) : provider.authType === "basic_auth" ? (
              <div className={cn("space-y-3")}>
                <Input
                  label="Username"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  placeholder="Enter username"
                />
                <Input
                  label="Password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="Enter password"
                />
              </div>
            ) : null}

            <div className={cn("flex gap-2 pt-4")}>
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setAuthStep("details")}
              >
                Back
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleCredentialsSubmit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  "Connect"
                )}
              </Button>
            </div>
          </div>
        )}

        {authStep === "testing" && (
          <div className={cn("space-y-4 text-center py-6")}>
            {testResult === "pending" && (
              <>
                <Loader2 className="w-8 h-8 mx-auto text-wl-primary-400 animate-spin" />
                <p className={cn("text-wl-text-primary font-medium")}>
                  Testing connection...
                </p>
                <p className={cn("text-sm text-wl-text-tertiary")}>
                  Verifying your credentials with {provider.name}
                </p>
              </>
            )}

            {testResult === "success" && (
              <>
                <CheckCircle className="w-8 h-8 mx-auto text-wl-success-400" />
                <p className={cn("text-wl-text-primary font-medium")}>
                  Connection successful!
                </p>
                <p className={cn("text-sm text-wl-text-tertiary")}>
                  Your integration is ready to use
                </p>
                <Button
                  variant="primary"
                  className="w-full mt-4"
                  onClick={() => setAuthStep("success")}
                >
                  Complete Setup
                </Button>
              </>
            )}

            {testResult === "error" && (
              <>
                <AlertCircle className="w-8 h-8 mx-auto text-wl-danger-400" />
                <p className={cn("text-wl-text-primary font-medium")}>
                  Connection failed
                </p>
                <p className={cn("text-sm text-wl-text-tertiary")}>
                  Please check your credentials and try again
                </p>
                <Button
                  variant="ghost"
                  className="w-full mt-4"
                  onClick={() => setAuthStep("credentials")}
                >
                  Try Again
                </Button>
              </>
            )}
          </div>
        )}

        {authStep === "success" && (
          <div className={cn("space-y-4 text-center py-6")}>
            <div className={cn("flex justify-center")}>
              <CheckCircle className="w-12 h-12 text-wl-success-400" />
            </div>
            <h3 className={cn("text-lg font-semibold text-wl-text-primary")}>
              All set!
            </h3>
            <p className={cn("text-sm text-wl-text-tertiary")}>
              {provider.name} has been successfully connected to your Witylogix
              account. You can now use this integration in your workflows.
            </p>

            <Button
              variant="primary"
              className="w-full mt-4"
              onClick={handleSuccessClose}
            >
              Close
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
