"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEnvelopes, useEsigAnalytics } from "@/hooks/use-esignatures";

/**
 * E-Signatures Page - Professional Dark Theme
 * Document signing queue, completed signatures, templates, status tracking
 */

function Icon({ d, size = 24 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

interface KPICard {
  label: string;
  value: number | string;
  unit?: string;
  trend?: "up" | "down";
  trendValue?: string;
  icon: string;
}

function KPICardComponent({ card }: { card: KPICard }) {
  return (
    <Card className={cn("bg-[#12121a] border-[#1e1e2e]")}>
      <CardContent className={cn("pt-6")}>
        <div className={cn("flex items-start justify-between")}>
          <div className={cn("flex-1")}>
            <p className={cn("text-sm font-medium text-gray-400 mb-2")}>
              {card.label}
            </p>
            <div className={cn("flex items-baseline gap-2")}>
              <span className={cn("text-3xl font-bold text-white")}>
                {card.value}
              </span>
              {card.unit && (
                <span className={cn("text-sm text-gray-400")}>
                  {card.unit}
                </span>
              )}
            </div>
            {card.trend && (
              <div className={cn("mt-2 text-xs")}>
                <span
                  className={cn(
                    card.trend === "up"
                      ? "text-emerald-400"
                      : "text-amber-400"
                  )}
                >
                  {card.trend === "up" ? "↑" : "↓"} {card.trendValue || "0%"}
                </span>
              </div>
            )}
          </div>
          <div className={cn("text-gray-400 opacity-20 ml-4")}>
            <Icon d={card.icon} size={32} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CompletionRateChart({ rate }: { rate: number }) {
  return (
    <Card className={cn("bg-[#12121a] border-[#1e1e2e]")}>
      <CardHeader>
        <CardTitle className={cn("text-base text-white")}>Completion Rate</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("space-y-4")}>
          <div className={cn("flex items-end justify-between")}>
            <div>
              <p className={cn("text-4xl font-bold text-white")}>
                {Math.round(rate)}%
              </p>
              <p className={cn("text-sm text-gray-400 mt-1")}>
                Average completion rate
              </p>
            </div>
            <div className={cn("w-32 h-32 flex items-center justify-center")}>
              <svg width="120" height="120" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="#2a2a3e"
                  strokeWidth="8"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="8"
                  strokeDasharray={`${(rate / 100) * 339.3} 339.3`}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                />
                <text
                  x="60"
                  y="65"
                  textAnchor="middle"
                  className={cn("text-base font-bold")}
                  fill="white"
                >
                  {Math.round(rate)}%
                </text>
              </svg>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentEnvelopesTable({ envelopes }: { envelopes: Record<string, unknown>[] }) {
  return (
    <Card className={cn("bg-[#12121a] border-[#1e1e2e]")}>
      <CardHeader>
        <CardTitle className={cn("text-base text-white")}>Recent Envelopes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("overflow-x-auto")}>
          <table className={cn("w-full text-sm")}>
            <thead>
              <tr className={cn("border-b border-[#1e1e2e]")}>
                <th className={cn("text-left py-3 px-4 font-medium text-gray-400")}>
                  Name
                </th>
                <th className={cn("text-left py-3 px-4 font-medium text-gray-400")}>
                  Sender
                </th>
                <th className={cn("text-left py-3 px-4 font-medium text-gray-400")}>
                  Status
                </th>
                <th className={cn("text-left py-3 px-4 font-medium text-gray-400")}>
                  Completion
                </th>
              </tr>
            </thead>
            <tbody>
              {envelopes.slice(0, 5).map((env) => (
                <tr
                  key={env.id}
                  className={cn(
                    "border-b border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors"
                  )}
                >
                  <td className={cn("py-3 px-4 text-white font-medium")}>
                    {env.name}
                  </td>
                  <td className={cn("py-3 px-4 text-gray-400")}>
                    {env.sender.name}
                  </td>
                  <td className={cn("py-3 px-4")}>
                    <Badge
                      variant={
                        env.status === "COMPLETED"
                          ? "success"
                          : env.status === "SIGNED"
                            ? "info"
                            : env.status === "SENT"
                              ? "warning"
                              : "default"
                      }
                    >
                      {env.status}
                    </Badge>
                  </td>
                  <td className={cn("py-3 px-4")}>
                    <div className={cn("flex items-center gap-2")}>
                      <div className={cn("flex-1 h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden")}>
                        <div
                          className={cn("h-full bg-emerald-500 transition-all")}
                          style={{ width: `${env.completionRate}%` }}
                        />
                      </div>
                      <span className={cn("text-xs text-gray-400 min-w-fit")}>
                        {env.completionRate}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateUsageCard({ templates }: { templates: Record<string, unknown>[] }) {
  return (
    <Card className={cn("bg-[#12121a] border-[#1e1e2e]")}>
      <CardHeader>
        <CardTitle className={cn("text-base text-white")}>Template Usage</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("space-y-4")}>
          {templates.map((tpl) => (
            <div
              key={tpl.name}
              className={cn("flex items-center justify-between")}
            >
              <span className={cn("text-sm text-gray-400")}>
                {tpl.name}
              </span>
              <span className={cn("text-sm font-medium text-white")}>
                {tpl.count}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ESignaturesPage() {
  const { envelopes, loading: envelopesLoading } = useEnvelopes();
  const { analytics, loading: analyticsLoading } = useEsigAnalytics();

  const mockTemplates = [
    { name: "Service Agreement", count: 12 },
    { name: "NDA", count: 8 },
    { name: "Proposal Form", count: 15 },
  ];

  const kpiCards: KPICard[] = [
    {
      label: "Envelopes Sent",
      value: analytics?.totalEnvelopes || 0,
      icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
      trend: "up",
      trendValue: "12%",
    },
    {
      label: "Pending Signatures",
      value: analytics?.pendingEnvelopes || 0,
      icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
      trend: "down",
      trendValue: "4%",
    },
    {
      label: "Completed",
      value: analytics?.completedEnvelopes || 0,
      icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
      trend: "up",
      trendValue: "8%",
    },
    {
      label: "Avg Sign Time",
      value: analytics?.avgCompletionTime || 0,
      unit: "days",
      icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    },
  ];

  return (
    <div className={cn("p-6 space-y-6 bg-[#0a0a0f] min-h-[calc(100vh-var(--header-height))]")}>
      {/* Header with Action */}
      <div className={cn("flex items-center justify-between")}>
        <div>
          <h1 className={cn("text-2xl font-bold text-white")}>
            E-Signature Overview
          </h1>
          <p className={cn("text-sm text-gray-400 mt-1")}>
            Track and manage digital document signing
          </p>
        </div>
        <Button variant="primary">
          + Create Envelope
        </Button>
      </div>

      {/* KPI Cards */}
      <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4")}>
        {kpiCards.map((card, idx) => (
          <KPICardComponent key={idx} card={card} />
        ))}
      </div>

      {/* Charts and Tables */}
      <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-6")}>
        <div className={cn("lg:col-span-2")}>
          <CompletionRateChart rate={analytics?.completionRate || 0} />
        </div>
        <div>
          <TemplateUsageCard templates={mockTemplates} />
        </div>
      </div>

      {/* Recent Envelopes */}
      <RecentEnvelopesTable envelopes={envelopes} />

      {/* Additional Stats */}
      <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4")}>
        <Card className={cn("bg-[#12121a] border-[#1e1e2e]")}>
          <CardContent className={cn("pt-6")}>
            <p className={cn("text-sm font-medium text-gray-400 mb-2")}>
              Decline Rate
            </p>
            <p className={cn("text-2xl font-bold text-white")}>
              {analytics?.declineRate || 0}%
            </p>
            <p className={cn("text-xs text-gray-400 mt-2")}>
              Of total envelopes
            </p>
          </CardContent>
        </Card>
        <Card className={cn("bg-[#12121a] border-[#1e1e2e]")}>
          <CardContent className={cn("pt-6")}>
            <p className={cn("text-sm font-medium text-gray-400 mb-2")}>
              Avg Signers per Envelope
            </p>
            <p className={cn("text-2xl font-bold text-white")}>
              {analytics?.avgSignersPerEnvelope || 0}
            </p>
            <p className={cn("text-xs text-gray-400 mt-2")}>
              Across all envelopes
            </p>
          </CardContent>
        </Card>
        <Card className={cn("bg-[#12121a] border-[#1e1e2e]")}>
          <CardContent className={cn("pt-6")}>
            <p className={cn("text-sm font-medium text-gray-400 mb-2")}>
              Active Templates
            </p>
            <p className={cn("text-2xl font-bold text-white")}>
              {mockTemplates.length}
            </p>
            <p className={cn("text-xs text-gray-400 mt-2")}>
              Ready to use
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
