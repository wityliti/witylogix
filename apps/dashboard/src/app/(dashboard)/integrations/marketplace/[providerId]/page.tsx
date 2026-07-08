"use client";

import { useState, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { LoadingSkeleton, ErrorState } from "@/components/ui/loading";
import { useApiQuery, useApiMutation } from "@/hooks/use-api";
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
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   INTEGRATION DETAIL PAGE — fetches from /api/v4/integrations/marketplace/:slug
   ═══════════════════════════════════════════════════════════ */

interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "password" | "url" | "textarea";
  required: boolean;
  helpUrl?: string;
}

interface IntegrationAppMeta {
  slug: string;
  name: string;
  description: string;
  longDescription?: string;
  category: string;
  subcategory?: string;
  logoUrl?: string;
  websiteUrl?: string;
  docsUrl?: string;
  authType: "API_KEY" | "OAUTH" | "NONE" | "MULTI_CREDENTIAL";
  credentialFields: CredentialField[];
  capabilities: string[];
  status: "AVAILABLE" | "COMING_SOON" | "BETA" | "DEPRECATED";
  isBuiltIn: boolean;
  version: string;
}

interface MarketplaceDetailResponse {
  app: IntegrationAppMeta;
  installed: boolean;
  installation: {
    isEnabled: boolean;
    healthStatus: string;
    lastSyncAt: string | null;
    installedAt: string;
  } | null;
}

const AUTH_LABEL: Record<string, string> = {
  API_KEY: "API Key",
  OAUTH: "OAuth 2.0",
  NONE: "No Authentication",
  MULTI_CREDENTIAL: "Multiple Credentials",
};

const STATUS_VARIANT: Record<string, "success" | "info" | "default" | "warning"> = {
  AVAILABLE: "success",
  BETA: "info",
  COMING_SOON: "default",
  DEPRECATED: "warning",
};

export default function ProviderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.providerId as string;

  const {
    data: detail,
    loading,
    error,
    refetch,
  } = useApiQuery<MarketplaceDetailResponse>(`/api/v4/integrations/marketplace/${slug}`);

  const { execute: installIntegration } = useApiMutation<{ integration: { id: string } }>(
    "POST",
    `/api/v4/integrations/${slug}/install`
  );

  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [authStep, setAuthStep] = useState<"details" | "credentials" | "installing" | "success" | "error">(
    "details"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  const provider = detail?.app;
  const isInstalled = detail?.installed ?? false;

  const credentialFields = useMemo(
    () => provider?.credentialFields ?? [],
    [provider]
  );

  const canSubmit = useMemo(
    () => credentialFields.filter((f) => f.required).every((f) => !!credentials[f.key]?.trim()),
    [credentialFields, credentials]
  );

  if (loading) return <LoadingSkeleton />;
  if (error || !provider) {
    return (
      <ErrorState
        message={error?.message ?? "Integration not found"}
        onRetry={refetch}
      />
    );
  }

  const handleConnect = () => {
    setCredentials({});
    setInstallError(null);
    setAuthStep("details");
    setIsConnectDialogOpen(true);
  };

  const handleCredentialsSubmit = async () => {
    setIsSubmitting(true);
    setInstallError(null);
    setAuthStep("installing");
    try {
      await installIntegration({ credentials, config: {} });
      setAuthStep("success");
      void refetch();
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : "Installation failed");
      setAuthStep("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setIsConnectDialogOpen(false);
    setAuthStep("details");
    setCredentials({});
    router.push("/integrations/connected");
  };

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
              <div className={cn("w-24 h-24 rounded-lg bg-wl-bg-elevated flex items-center justify-center flex-shrink-0")}>
                {provider.logoUrl ? (
                  <img src={provider.logoUrl} alt={provider.name} className="w-16 h-16 object-contain" />
                ) : (
                  <span className="text-5xl">📦</span>
                )}
              </div>

              <div className={cn("flex-1 min-w-0")}>
                <div className={cn("flex items-center gap-3 mb-3")}>
                  <h1 className={cn("text-2xl font-bold text-white")}>{provider.name}</h1>
                  {provider.status === "BETA" && <Badge variant="info">Beta</Badge>}
                </div>

                <p className={cn("text-wl-text-secondary mb-4")}>
                  {provider.longDescription ?? provider.description}
                </p>

                <div className={cn("flex flex-wrap gap-2")}>
                  <Badge variant={STATUS_VARIANT[provider.status] ?? "default"}>
                    {provider.status.replace(/_/g, " ")}
                  </Badge>
                  <Badge variant="info">
                    Auth: {AUTH_LABEL[provider.authType] ?? provider.authType}
                  </Badge>
                  {isInstalled && (
                    <Badge variant="success">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  )}
                </div>
              </div>

              <div>
                {isInstalled ? (
                  <Button variant="secondary" onClick={() => router.push("/integrations/connected")}>
                    Manage
                  </Button>
                ) : provider.status === "COMING_SOON" || provider.status === "DEPRECATED" ? (
                  <Button variant="ghost" disabled>
                    {provider.status === "COMING_SOON" ? "Coming Soon" : "Deprecated"}
                  </Button>
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
            {/* Capabilities / Features */}
            {provider.capabilities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Features</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={cn("grid grid-cols-2 gap-3")}>
                    {provider.capabilities.map((cap) => (
                      <div key={cap} className={cn("flex items-center gap-2 p-2 rounded bg-wl-bg-elevated")}>
                        <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span className="text-sm text-white">{cap}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Credential Fields preview */}
            {credentialFields.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Required Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={cn("space-y-2")}>
                    {credentialFields.map((field) => (
                      <div key={field.key} className={cn("flex items-center gap-2 p-3 rounded border border-wl-border-default")}>
                        <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <span className="text-sm text-white">
                          {field.label}
                          {field.required && <span className="text-red-400 ml-1">*</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <aside className={cn("space-y-6")}>
            <Card>
              <CardHeader>
                <CardTitle>Integration Info</CardTitle>
              </CardHeader>
              <CardContent className={cn("space-y-4")}>
                <div>
                  <div className={cn("text-xs text-wl-text-tertiary uppercase tracking-wide mb-1")}>Category</div>
                  <div className={cn("text-sm font-medium text-white")}>{provider.category}</div>
                </div>
                {provider.subcategory && (
                  <div>
                    <div className={cn("text-xs text-wl-text-tertiary uppercase tracking-wide mb-1")}>Type</div>
                    <div className={cn("text-sm font-medium text-white capitalize")}>{provider.subcategory}</div>
                  </div>
                )}
                <div>
                  <div className={cn("text-xs text-wl-text-tertiary uppercase tracking-wide mb-1")}>Authentication</div>
                  <div className={cn("text-sm font-medium text-white")}>
                    {AUTH_LABEL[provider.authType] ?? provider.authType}
                  </div>
                </div>
                <div>
                  <div className={cn("text-xs text-wl-text-tertiary uppercase tracking-wide mb-1")}>Version</div>
                  <div className={cn("text-sm font-mono text-white")}>{provider.version}</div>
                </div>
              </CardContent>
            </Card>

            {provider.docsUrl && (
              <Button
                variant="ghost"
                className={cn("w-full justify-start")}
                onClick={() => window.open(provider.docsUrl, "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Documentation
              </Button>
            )}

            {provider.websiteUrl && (
              <Button
                variant="ghost"
                className={cn("w-full justify-start")}
                onClick={() => window.open(provider.websiteUrl, "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Provider Website
              </Button>
            )}
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

            <div className={cn("space-y-3 bg-wl-bg-elevated p-4 rounded-lg")}>
              <div>
                <div className={cn("text-xs text-wl-text-tertiary uppercase tracking-wide")}>Provider</div>
                <div className={cn("text-sm font-medium text-white")}>{provider.name}</div>
              </div>
              <div>
                <div className={cn("text-xs text-wl-text-tertiary uppercase tracking-wide")}>Authentication Type</div>
                <div className={cn("text-sm font-medium text-white")}>
                  {AUTH_LABEL[provider.authType] ?? provider.authType}
                </div>
              </div>
              <div>
                <div className={cn("text-xs text-wl-text-tertiary uppercase tracking-wide")}>Permissions Requested</div>
                <div className={cn("text-sm text-white space-y-1 mt-1")}>
                  <div className={cn("flex items-center gap-2")}>
                    <Check className="w-3 h-3 text-emerald-500" />
                    Read access to {provider.name} data
                  </div>
                  <div className={cn("flex items-center gap-2")}>
                    <Check className="w-3 h-3 text-emerald-500" />
                    Write access to selected resources
                  </div>
                </div>
              </div>
            </div>

            <div className={cn("flex gap-2 pt-4")}>
              <Button variant="ghost" className="flex-1" onClick={() => setIsConnectDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1" onClick={() => setAuthStep("credentials")}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {authStep === "credentials" && (
          <div className={cn("space-y-4")}>
            <p className={cn("text-sm text-wl-text-secondary")}>
              {provider.authType === "OAUTH"
                ? `You'll be redirected to authenticate with ${provider.name}`
                : `Enter your ${provider.name} credentials`}
            </p>

            {credentialFields.length > 0 ? (
              <div className={cn("space-y-3")}>
                {credentialFields.map((field) => {
                  const isSecret = field.type === "password";
                  const visible = showSecret[field.key];
                  return (
                    <div key={field.key}>
                      <Input
                        label={`${field.label}${field.required ? " *" : ""}`}
                        type={isSecret && !visible ? "password" : "text"}
                        value={credentials[field.key] ?? ""}
                        onChange={(e) =>
                          setCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))
                        }
                        placeholder={field.placeholder}
                        icon={
                          isSecret ? (
                            <button
                              type="button"
                              onClick={() =>
                                setShowSecret((prev) => ({ ...prev, [field.key]: !prev[field.key] }))
                              }
                              className="text-wl-text-tertiary hover:text-white"
                            >
                              {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          ) : undefined
                        }
                      />
                      {field.helpUrl && (
                        <a
                          href={field.helpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:underline mt-1 inline-block"
                        >
                          Where to find this?
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={cn("text-sm text-wl-text-tertiary bg-wl-bg-elevated p-3 rounded-lg")}>
                This integration requires no credentials.
              </p>
            )}

            <div className={cn("flex gap-2 pt-4")}>
              <Button variant="ghost" className="flex-1" onClick={() => setAuthStep("details")}>
                Back
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleCredentialsSubmit}
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? (
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

        {authStep === "installing" && (
          <div className={cn("space-y-4 text-center py-6")}>
            <Loader2 className="w-8 h-8 mx-auto text-blue-500 animate-spin" />
            <p className={cn("text-white font-medium")}>Installing integration…</p>
            <p className={cn("text-sm text-wl-text-tertiary")}>Verifying credentials and connecting to {provider.name}</p>
          </div>
        )}

        {authStep === "success" && (
          <div className={cn("space-y-4 text-center py-6")}>
            <CheckCircle className="w-12 h-12 mx-auto text-emerald-500" />
            <h3 className={cn("text-lg font-semibold text-white")}>All set!</h3>
            <p className={cn("text-sm text-wl-text-tertiary")}>
              {provider.name} has been successfully connected to your Witylogix account.
            </p>
            <Button variant="primary" className="w-full mt-4" onClick={handleSuccessClose}>
              View Connected Integrations
            </Button>
          </div>
        )}

        {authStep === "error" && (
          <div className={cn("space-y-4 text-center py-6")}>
            <AlertCircle className="w-8 h-8 mx-auto text-red-500" />
            <p className={cn("text-white font-medium")}>Connection failed</p>
            <p className={cn("text-sm text-red-400")}>{installError}</p>
            <Button variant="ghost" className="w-full mt-4" onClick={() => setAuthStep("credentials")}>
              Try Again
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
