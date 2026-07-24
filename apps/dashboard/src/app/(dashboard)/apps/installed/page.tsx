"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Package, Trash2, ExternalLink } from "lucide-react";

interface InstalledApp {
  id: string;
  oauthClientId: string;
  orgId: string;
  shopId: string | null;
  status: "ACTIVE" | "REVOKED";
  scopes: string[];
  installedAt: string;
  revokedAt: string | null;
  client: {
    id: string;
    name: string;
    description: string | null;
    logoUrl: string | null;
    homepageUrl: string | null;
  };
}

interface InstallationsResponse {
  installations: InstalledApp[];
}

export default function InstalledAppsPage() {
  const [installations, setInstallations] = useState<InstalledApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const fetchInstallations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<InstallationsResponse>(
        "/api/v4/oauth/installations",
      );
      setInstallations(res.installations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInstallations();
  }, [fetchInstallations]);

  const handleRevoke = async (installation: InstalledApp) => {
    setRevokingId(installation.id);
    try {
      await api.delete(`/api/v4/oauth/installations/${installation.id}`);
      setRevokeError(null);
      await fetchInstallations();
    } catch (err) {
      setRevokeError(
        err instanceof Error ? err.message : "Failed to uninstall app",
      );
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div>
      <Header
        title="Installed apps"
        subtitle="Third-party apps that have access to your account via OAuth."
      />

      <div className="p-6 space-y-6">
        {loading && <TableSkeleton rows={3} />}
        {error && (
          <ErrorState message={error.message} onRetry={fetchInstallations} />
        )}
        {revokeError && (
          <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/50 text-red-400 text-sm">
            {revokeError}
          </div>
        )}

        {!loading && !error && installations.length === 0 && (
          <EmptyState
            icon={<Package className="w-10 h-10" />}
            title="No apps installed yet"
            description="When you authorize a third-party app to access your Witylogix data, it will show up here."
          />
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {installations.map((installation) => {
            const { client } = installation;
            const isRevoking = revokingId === installation.id;
            return (
              <Card
                key={installation.id}
                className="hover:border-wl-border-strong transition-colors"
              >
                <CardHeader className="flex-row items-start gap-3">
                  {client.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={client.logoUrl}
                      alt=""
                      className="w-10 h-10 rounded-md object-cover shrink-0 bg-wl-bg-surface"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-wl-bg-surface text-wl-text-secondary flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <span className="truncate">{client.name}</span>
                      {client.homepageUrl && (
                        <a
                          href={client.homepageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-wl-text-tertiary hover:text-wl-text-primary shrink-0"
                          aria-label="Open developer homepage"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </CardTitle>
                    {client.description && (
                      <CardDescription className="line-clamp-2">
                        {client.description}
                      </CardDescription>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {installation.scopes.map((scope) => (
                      <Badge
                        key={scope}
                        variant="default"
                        className="font-mono text-[11px]"
                      >
                        {scope}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-xs text-wl-text-tertiary">
                    Installed{" "}
                    {new Date(installation.installedAt).toLocaleDateString(
                      undefined,
                      {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      },
                    )}
                  </div>
                  {confirmRevokeId === installation.id ? (
                    <div className="space-y-2">
                      <p className="text-xs text-wl-text-secondary">
                        Uninstall <strong>{client.name}</strong>? Access tokens
                        will be revoked and webhooks will stop.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="flex-1"
                          onClick={() => setConfirmRevokeId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          className="flex-1"
                          disabled={isRevoking}
                          onClick={() => {
                            setConfirmRevokeId(null);
                            handleRevoke(installation);
                          }}
                        >
                          {isRevoking ? "Uninstalling…" : "Confirm"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmRevokeId(installation.id)}
                      className="w-full"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Uninstall
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
