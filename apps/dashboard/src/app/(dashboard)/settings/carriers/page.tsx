"use client";

import { useApiQuery } from "@/hooks/use-api";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ChevronLeft,
  Package,
  CheckCircle2,
  AlertCircle,
  Info,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────

interface CarrierAdapter {
  name: string;
  label: string;
  enabled: boolean;
  configSource: "env";
}

interface CarrierAdaptersResponse {
  data: CarrierAdapter[];
  total: number;
}

// ─── Static carrier metadata ────────────────────────────────

const CARRIER_META: Record<
  string,
  { coverage: string; services: string[]; configVars: string[] }
> = {
  USPS: {
    coverage: "Domestic US (all states)",
    services: [
      "Priority Mail Express",
      "Priority Mail",
      "Ground Advantage",
      "First Class",
    ],
    configVars: ["USPS_CONSUMER_KEY", "USPS_CONSUMER_SECRET"],
  },
  ONTRAC: {
    coverage: "Western US (CA, OR, WA, AZ, CO, ID, NV, UT)",
    services: [
      "Sunrise (Next Day AM)",
      "C10 (Next Day 10AM)",
      "H2 (Next Day Noon)",
      "Ground",
    ],
    configVars: ["ONTRAC_ACCOUNT", "ONTRAC_PASSWORD"],
  },
};

// ─── All known carriers (to show unconfigured ones too) ─────

const ALL_CARRIERS = [
  { name: "USPS", label: "USPS (Web Tools API v3)" },
  { name: "ONTRAC", label: "OnTrac (Western US)" },
];

// ─── Page ───────────────────────────────────────────────────

export default function CarriersSettingsPage() {
  const { data, loading, error, refetch } =
    useApiQuery<CarrierAdaptersResponse>("/api/v4/carriers/adapters");

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const configuredNames = new Set((data?.data ?? []).map((c) => c.name));

  // Merge: show all known carriers, mark configured ones
  const rows = ALL_CARRIERS.map((known) => {
    const live = (data?.data ?? []).find((c) => c.name === known.name);
    return {
      name: known.name,
      label: live?.label ?? known.label,
      configured: configuredNames.has(known.name),
      enabled: live?.enabled ?? false,
      meta: CARRIER_META[known.name],
    };
  });

  const configuredCount = rows.filter((r) => r.configured).length;

  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title="Carrier Coverage"
        subtitle="Native carrier adapters configured via environment variables"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back */}
        <Link href="/settings">
          <Button
            variant="ghost"
            size="sm"
            className="mb-6 text-wl-text-secondary hover:text-white gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Settings
          </Button>
        </Link>

        {/* Summary */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Package className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <p className="text-sm text-wl-text-secondary">
              {configuredCount} of {rows.length} carriers configured
            </p>
          </div>
        </div>

        {/* Coverage Matrix */}
        <div className="space-y-4">
          {rows.map((carrier) => (
            <Card
              key={carrier.name}
              className="bg-wl-bg-surface border-white/10"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    {carrier.configured ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-wl-text-tertiary shrink-0" />
                    )}
                    {carrier.label}
                  </CardTitle>
                  <Badge
                    variant="default"
                    className={
                      carrier.configured
                        ? "border-green-500/40 text-green-400 bg-green-500/10"
                        : "border-wl-border-strong text-wl-text-tertiary"
                    }
                  >
                    {carrier.configured ? "Configured" : "Not configured"}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {carrier.meta && (
                  <>
                    <div>
                      <p className="text-xs text-wl-text-tertiary uppercase tracking-wider mb-1">
                        Coverage
                      </p>
                      <p className="text-sm text-wl-neutral-300">
                        {carrier.meta.coverage}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-wl-text-tertiary uppercase tracking-wider mb-1">
                        Services
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {carrier.meta.services.map((svc) => (
                          <Badge
                            key={svc}
                            variant="default"
                            className="text-xs border-white/10 text-wl-text-secondary"
                          >
                            {svc}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {!carrier.configured && (
                      <div className="mt-3 p-3 rounded-md bg-white/5 border border-white/10">
                        <div className="flex gap-2">
                          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs text-blue-300 font-medium mb-1">
                              Set these env vars to enable:
                            </p>
                            <ul className="space-y-0.5">
                              {carrier.meta.configVars.map((v) => (
                                <li
                                  key={v}
                                  className="text-xs font-mono text-wl-text-secondary"
                                >
                                  {v}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer note */}
        <p className="mt-6 text-xs text-wl-text-tertiary text-center">
          Carrier adapters are configured via environment variables. Restart the
          API server after updating env vars.
        </p>
      </div>
    </div>
  );
}
