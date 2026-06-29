"use client";

import { useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import {
  ArrowLeft,
  Copy,
  Eye,
  EyeOff,
  MapPin,
  TrendingUp,
  CheckCircle,
  Settings,
} from "lucide-react";

const PartnersMapView = dynamic(() => import("../components/partners-map-view"), { ssr: false });
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useApiQuery } from "@/hooks/use-api";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";

/* ═══════════════════════════════════════════════════════════
   PARTNER DETAIL PAGE — Wired to /api/v4/integrations
   ═══════════════════════════════════════════════════════════ */

interface InstalledIntegration {
  slug: string;
  name: string;
  description: string;
  category: string;
  logoUrl?: string;
  isEnabled: boolean;
  healthStatus: string | null;
  lastSyncAt: string | null;
  credentials: Record<string, unknown>;
  config: Record<string, unknown>;
  installedAt: string;
  updatedAt: string;
}

interface IntegrationsResponse {
  integrations: InstalledIntegration[];
  counts: Record<string, number>;
}

interface KPICardProps {
  label: string;
  value: number | string;
  suffix?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

function KPICard({ label, value, suffix, icon: Icon }: KPICardProps) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-wl-neutral-300">
          {label}
        </span>
        {Icon && (
          <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center text-blue-400">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-white">{value}</span>
        {suffix && <span className="text-sm text-wl-neutral-300">{suffix}</span>}
      </div>
    </Card>
  );
}

const PARTNER_TABS = [
  { id: "overview", label: "Overview" },
  { id: "settings", label: "Settings" },
  { id: "sla", label: "SLA" },
];

export default function PartnerDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: integrationsData, loading, error, refetch } = useApiQuery<IntegrationsResponse>(
    "/api/v4/integrations"
  );

  const { data: partnerStatsData } = useApiQuery<{
    stats: Array<{ provider: string; activeDeliveries: number; totalDeliveries: number; successRate: number | null }>;
  }>("/api/v4/couriers/partner-stats");

  const partner = useMemo(
    () => integrationsData?.integrations.find((i) => i.slug === params.id) ?? null,
    [integrationsData, params.id]
  );

  const partnerStat = useMemo(() => {
    const slug = params.id;
    return (
      partnerStatsData?.stats.find((s) => s.provider === slug || s.provider === slug.replace(/-/g, "_")) ??
      null
    );
  }, [partnerStatsData, params.id]);

  const cfg = (partner?.config ?? {}) as Record<string, unknown>;
  const creds = (partner?.credentials ?? {}) as Record<string, unknown>;
  const serviceAreas = Array.isArray(cfg.serviceAreas) ? (cfg.serviceAreas as string[]) : [];

  const handleCopy = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  if (loading) return <TableSkeleton rows={6} columns={4} />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;
  if (!partner) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Button variant="ghost" size="md" onClick={() => router.back()} className="gap-2 w-fit">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Card className="flex flex-col items-center gap-4 py-16">
          <Settings className="w-12 h-12 text-wl-neutral-300/50" />
          <p className="text-wl-text-secondary">Partner &quot;{params.id}&quot; not found or not installed.</p>
          <Button variant="primary" size="md" onClick={() => router.push("/dashboard/partners/onboard")}>
            Install Partner
          </Button>
        </Card>
      </div>
    );
  }

  const apiKey = String(creds.apiKey ?? "");
  const apiSecret = String(creds.apiSecret ?? "");
  const webhookSecret = String(creds.webhookSecret ?? "");
  const baseUrl = String(cfg.baseUrl ?? "");
  const maxDeliveryTime = typeof cfg.maxDeliveryTime === "number" ? cfg.maxDeliveryTime : null;
  const maxDistance = typeof cfg.maxDistance === "number" ? cfg.maxDistance : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="md" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-white">{partner.name}</h1>
          <p className="text-wl-neutral-300 flex items-center gap-2">
            {partner.category}
            <Badge
              variant={
                partner.healthStatus === "HEALTHY"
                  ? "success"
                  : partner.healthStatus === "UNHEALTHY"
                  ? "danger"
                  : partner.isEnabled
                  ? "info"
                  : "default"
              }
            >
              {partner.isEnabled
                ? (partner.healthStatus?.toLowerCase() ?? "active")
                : "disabled"}
            </Badge>
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <Tabs
        tabs={PARTNER_TABS}
        activeTab={activeTab}
        onChange={setActiveTab}
        className="w-full"
      />

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              label="Active Deliveries"
              value={partnerStat ? partnerStat.activeDeliveries : "—"}
              icon={TrendingUp}
            />
            <KPICard
              label="Success Rate"
              value={partnerStat?.successRate != null ? `${partnerStat.successRate}%` : "—"}
              icon={CheckCircle}
            />
            <KPICard
              label="Health Status"
              value={partner.healthStatus ?? "Unknown"}
              icon={CheckCircle}
            />
            <KPICard
              label="Installed"
              value={new Date(partner.installedAt).toLocaleDateString()}
            />
          </div>

          {/* Service Areas */}
          <Card>
            <CardHeader>
              <CardTitle>Service Coverage</CardTitle>
            </CardHeader>
            <CardContent>
              {serviceAreas.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {serviceAreas.map((area) => (
                      <span
                        key={area}
                        className="inline-flex items-center px-3 py-2 rounded-full bg-blue-500/20 text-blue-400 text-sm font-medium"
                      >
                        <MapPin className="w-3 h-3 mr-1.5" />
                        {area}
                      </span>
                    ))}
                  </div>
                  <div className="h-64 rounded-lg overflow-hidden border border-wl-border-default">
                    <PartnersMapView
                      partners={[{
                        id: partner.slug,
                        name: partner.name,
                        status: partner.isEnabled && partner.healthStatus !== "UNHEALTHY" ? "active" : "inactive",
                        serviceAreas,
                      }]}
                    />
                  </div>
                </>
              ) : (
                <p className="text-wl-text-secondary text-sm">No service areas configured yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Integration Details */}
          <Card>
            <CardHeader>
              <CardTitle>Integration Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-wl-text-secondary mb-1">Slug</dt>
                  <dd className="text-white font-mono">{partner.slug}</dd>
                </div>
                <div>
                  <dt className="text-wl-text-secondary mb-1">Category</dt>
                  <dd className="text-white">{partner.category}</dd>
                </div>
                <div>
                  <dt className="text-wl-text-secondary mb-1">Last Sync</dt>
                  <dd className="text-white">
                    {partner.lastSyncAt
                      ? new Date(partner.lastSyncAt).toLocaleString()
                      : "Never"}
                  </dd>
                </div>
                <div>
                  <dt className="text-wl-text-secondary mb-1">Last Updated</dt>
                  <dd className="text-white">{new Date(partner.updatedAt).toLocaleString()}</dd>
                </div>
              </dl>
              {partner.description && (
                <p className="mt-4 text-sm text-wl-text-secondary border-t border-wl-border-default pt-4">
                  {partner.description}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Credentials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* API Key */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">API Key</label>
                <div className="flex gap-2">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey || "Not configured"}
                    readOnly
                    className="flex-1 font-mono text-xs"
                  />
                  <Button variant="secondary" size="md" onClick={() => setShowApiKey(!showApiKey)}>
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  {apiKey && (
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => handleCopy(apiKey, "apiKey")}
                    >
                      {copiedField === "apiKey" ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* API Secret */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">API Secret</label>
                <div className="flex gap-2">
                  <Input
                    type={showApiSecret ? "text" : "password"}
                    value={apiSecret || "Not configured"}
                    readOnly
                    className="flex-1 font-mono text-xs"
                  />
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => setShowApiSecret(!showApiSecret)}
                  >
                    {showApiSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  {apiSecret && (
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => handleCopy(apiSecret, "apiSecret")}
                    >
                      {copiedField === "apiSecret" ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Base URL */}
              {baseUrl && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white">Base URL</label>
                  <div className="flex gap-2">
                    <Input type="text" value={baseUrl} readOnly className="flex-1 font-mono text-xs" />
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => handleCopy(baseUrl, "baseUrl")}
                    >
                      {copiedField === "baseUrl" ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Webhook Secret */}
              {webhookSecret && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white">Webhook Secret</label>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      value={webhookSecret}
                      readOnly
                      className="flex-1 font-mono text-xs"
                    />
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={() => handleCopy(webhookSecret, "webhookSecret")}
                    >
                      {copiedField === "webhookSecret" ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-wl-border-default">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => router.push(`/dashboard/partners/onboard`)}
                >
                  Reconfigure Credentials
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Service Areas */}
          <Card>
            <CardHeader>
              <CardTitle>Service Areas</CardTitle>
            </CardHeader>
            <CardContent>
              {serviceAreas.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-4">
                  {serviceAreas.map((area) => (
                    <span
                      key={area}
                      className="inline-flex items-center px-3 py-2 rounded-full bg-blue-500/20 text-blue-400 text-sm font-medium"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-wl-text-secondary text-sm mb-4">No service areas configured.</p>
              )}
              <Button variant="secondary" size="md">
                Manage Service Areas
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SLA Tab */}
      {activeTab === "sla" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Service Level Agreement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-wl-bg-surface border border-wl-border-default">
                  <span className="text-xs font-semibold uppercase tracking-wider text-wl-text-secondary">
                    Max Delivery Time
                  </span>
                  <p className="text-2xl font-bold text-white mt-2">
                    {maxDeliveryTime != null ? `${maxDeliveryTime} min` : "Not configured"}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-wl-bg-surface border border-wl-border-default">
                  <span className="text-xs font-semibold uppercase tracking-wider text-wl-text-secondary">
                    Max Distance
                  </span>
                  <p className="text-2xl font-bold text-white mt-2">
                    {maxDistance != null ? `${maxDistance} km` : "Not configured"}
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "p-4 rounded-lg border",
                  partner.healthStatus === "HEALTHY" || partner.isEnabled
                    ? "bg-emerald-500/10 border-emerald-500/20"
                    : "bg-red-500/10 border-red-500/20"
                )}
              >
                <p
                  className={cn(
                    "text-sm",
                    partner.healthStatus === "HEALTHY" || partner.isEnabled
                      ? "text-emerald-400"
                      : "text-red-400"
                  )}
                >
                  {partner.healthStatus === "HEALTHY"
                    ? "Integration is healthy and meeting SLA requirements"
                    : partner.isEnabled
                    ? "Integration is active"
                    : "Integration is disabled — no SLA monitoring active"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
