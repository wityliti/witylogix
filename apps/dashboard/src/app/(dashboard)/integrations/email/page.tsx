"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useApiList } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  FileText,
  RefreshCw,
  Plus,
} from "lucide-react";

interface IntegrationConnection {
  id: string;
  providerName: string;
  status: "connected" | "disconnected" | "error" | "pending";
  lastSyncTime?: string;
  apiCallsCount: number;
  errorCount: number;
  uptime: number;
  category: string;
}

interface NotificationTemplate {
  id: string;
  name: string;
  channel: string;
}

const EMAIL_SLUGS = new Set([
  "sendgrid",
  "mailgun",
  "aws_ses",
  "postmark",
  "resend",
  "smtp",
]);

function statusVariant(
  s: string,
): "success" | "danger" | "warning" | "default" {
  if (s === "connected") return "success";
  if (s === "error") return "danger";
  if (s === "pending") return "warning";
  return "default";
}

function timeSince(iso?: string) {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function EmailIntegrationsPage() {
  const {
    items: allComm,
    loading,
    error,
    refetch,
  } = useApiList<IntegrationConnection>(
    "/api/v4/integrations/connections?category=communication",
    { limit: 100 },
  );
  const { pagination: templatePagination } = useApiList<NotificationTemplate>(
    "/api/v4/notification-templates",
    { limit: 1 },
  );

  const providers = useMemo(
    () => allComm.filter((c) => EMAIL_SLUGS.has(c.id.toLowerCase())),
    [allComm],
  );

  const stats = useMemo(
    () => ({
      total: providers.length,
      healthy: providers.filter((p) => p.status === "connected").length,
      errors: providers.filter((p) => p.status === "error").length,
      templates: templatePagination.total,
    }),
    [providers, templatePagination.total],
  );

  if (loading && allComm.length === 0) return <LoadingSkeleton />;
  if (error && allComm.length === 0)
    return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      <Header
        title="Email Integrations"
        subtitle="Manage email delivery providers and transactional templates"
        actions={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={refetch}
              disabled={loading}
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
            <Link href="/integrations/marketplace?category=COMMUNICATION">
              <Button variant="primary" size="sm">
                <Plus className="w-4 h-4 mr-1" /> Add Provider
              </Button>
            </Link>
          </div>
        }
      />

      <div className="p-6 bg-wl-bg-root space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Active Providers",
              value: stats.total,
              icon: Mail,
              color: "text-blue-400",
            },
            {
              label: "Healthy",
              value: stats.healthy,
              icon: CheckCircle2,
              color: "text-emerald-400",
            },
            {
              label: "With Errors",
              value: stats.errors,
              icon: AlertCircle,
              color: "text-red-400",
            },
            {
              label: "Templates",
              value: stats.templates,
              icon: FileText,
              color: "text-wl-text-primary",
            },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <Card
                key={s.label}
                className="bg-wl-bg-surface border-wl-border-default"
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <Icon className={cn("w-5 h-5 shrink-0", s.color)} />
                  <div>
                    <p className="text-xs text-wl-text-muted">{s.label}</p>
                    <p className="text-xl font-bold text-wl-text-primary">
                      {s.value}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardHeader>
            <CardTitle>Email Providers</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {providers.length === 0 ? (
              <div className="p-12 text-center">
                <Mail className="w-12 h-12 text-wl-text-muted mx-auto mb-4 opacity-40" />
                <p className="text-wl-text-secondary mb-1">
                  No email providers configured
                </p>
                <p className="text-sm text-wl-text-muted mb-6 max-w-sm mx-auto">
                  Connect SendGrid, Mailgun, Postmark, AWS SES, Resend, and more
                  to send transactional emails for order confirmations and
                  delivery updates.
                </p>
                <Link href="/integrations/marketplace?category=COMMUNICATION">
                  <Button variant="primary">Browse Marketplace</Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-wl-border-default">
                {providers.map((conn) => (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-wl-bg-overlay transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-wl-bg-overlay flex items-center justify-center text-xs font-bold text-wl-text-secondary uppercase">
                        {conn.providerName.slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-wl-text-primary">
                          {conn.providerName}
                        </p>
                        <p className="text-xs text-wl-text-muted">
                          Last used: {timeSince(conn.lastSyncTime)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-wl-text-muted hidden sm:block">
                        {conn.apiCallsCount.toLocaleString()} calls
                      </span>
                      <Badge variant={statusVariant(conn.status)} dot>
                        {conn.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Email Templates</CardTitle>
              <Link href="/settings/notifications/templates">
                <Button variant="ghost" size="sm" className="text-xs">
                  Manage →
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {stats.templates === 0 ? (
              <p className="text-sm text-wl-text-muted text-center py-4">
                No notification templates yet.
              </p>
            ) : (
              <p className="text-sm text-wl-text-secondary">
                {stats.templates} template{stats.templates !== 1 ? "s" : ""}{" "}
                configured.{" "}
                <Link
                  href="/settings/notifications/templates"
                  className="text-blue-400 hover:underline"
                >
                  View all →
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
