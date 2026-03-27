"use client";

import { use, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { cn, formatNumber, formatRelativeTime } from "@/lib/utils";
import { useApiQuery } from '@/hooks/use-api';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import {
  Edit,
  Copy,
  Archive,
  Mail,
  CheckCircle,
  AlertCircle,
  LogOut,
  BarChart3,
} from "lucide-react";

type CampaignType = "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";
type CampaignStatus = "DRAFT" | "SCHEDULED" | "SENDING" | "COMPLETED";
type EventType = "sent" | "delivered" | "opened" | "clicked" | "bounced" | "unsubscribed";

interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  created_at: string;
  sent_at?: string;
  completed_at?: string;
  stats: {
    delivered: number;
    opened: number;
    clicked: number;
    failed: number;
    total_events: number;
  };
}

const statusVariant = (s: CampaignStatus): "success" | "warning" | "danger" | "info" | "primary" | "default" => {
  const map: Record<CampaignStatus, "success" | "warning" | "danger" | "info" | "primary" | "default"> = {
    DRAFT: "default",
    SCHEDULED: "info",
    SENDING: "warning",
    COMPLETED: "success",
  };
  return map[s] ?? "default";
};

const typeVariant = (t: CampaignType): "success" | "warning" | "danger" | "info" | "primary" | "default" => {
  const map: Record<CampaignType, "success" | "warning" | "danger" | "info" | "primary" | "default"> = {
    EMAIL: "info",
    SMS: "success",
    WHATSAPP: "primary",
    PUSH: "warning",
  };
  return map[t] ?? "default";
};

const eventTypeIcon = (type: EventType) => {
  const icons: Record<EventType, React.ReactNode> = {
    sent: <Mail size={16} />,
    delivered: <CheckCircle size={16} />,
    opened: <Mail size={16} />,
    clicked: <BarChart3 size={16} />,
    bounced: <AlertCircle size={16} />,
    unsubscribed: <LogOut size={16} />,
  };
  return icons[type] ?? null;
};

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: campaign, loading, error } = useApiQuery<Campaign>(`/api/v4/campaigns/${id}`);

  if (loading) {
    return (
      <div className="min-h-screen bg-wl-bg-primary p-8">
        <TableSkeleton rows={6} />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-wl-bg-primary p-8">
        <ErrorState message="Failed to load campaign." />
      </div>
    );
  }

  const sent = campaign.stats.total_events || 0;
  const delivered = campaign.stats.delivered || 0;
  const opened = campaign.stats.opened || 0;
  const clicked = campaign.stats.clicked || 0;
  const failed = campaign.stats.failed || 0;

  const deliveryRate = sent > 0 ? ((delivered / sent) * 100).toFixed(1) : "0.0";
  const openRate = delivered > 0 ? ((opened / delivered) * 100).toFixed(1) : "0.0";
  const clickRate = opened > 0 ? ((clicked / opened) * 100).toFixed(1) : "0.0";

  const audienceBreakdown = [
    { label: "Delivered", value: delivered, color: "#22c55e", percentage: sent > 0 ? ((delivered / sent) * 100).toFixed(1) : "0" },
    { label: "Failed", value: failed, color: "#ef4444", percentage: sent > 0 ? ((failed / sent) * 100).toFixed(1) : "0" },
  ];

  return (
    <div className="min-h-screen bg-wl-bg-primary">
      <Header
        title={campaign.name}
        subtitle={`${campaign.type} campaign • Created ${formatRelativeTime(campaign.created_at)}`}
      />

      <div className="p-8 w-full mx-auto">
        {/* Header with Status */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Badge variant={typeVariant(campaign.type)}>{campaign.type}</Badge>
            <Badge variant={statusVariant(campaign.status)}>{campaign.status}</Badge>
            {campaign.sent_at && (
              <span className="text-sm text-wl-text-secondary">
                Sent {formatRelativeTime(campaign.sent_at)}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="md">
              <Edit size={16} />
              Edit
            </Button>
            <Button variant="secondary" size="md">
              <Copy size={16} />
              Duplicate
            </Button>
            <Button variant="secondary" size="md">
              <Archive size={16} />
              Archive
            </Button>
          </div>
        </div>

        {/* Performance Stats */}
        <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <StatCard
            label="Sent"
            value={formatNumber(sent)}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Delivered"
            value={formatNumber(delivered)}
            change={{ value: parseInt(deliveryRate), label: "delivery rate" }}
            accentColor="var(--wl-success-500)"
            index={1}
          />
          <StatCard
            label="Opened"
            value={formatNumber(opened)}
            change={{ value: parseInt(openRate), label: "open rate" }}
            accentColor="var(--wl-info-500)"
            index={2}
          />
          <StatCard
            label="Clicked"
            value={formatNumber(clicked)}
            change={{ value: parseInt(clickRate), label: "click rate" }}
            accentColor="var(--wl-warning-500)"
            index={3}
          />
          <StatCard
            label="Failed"
            value={formatNumber(failed)}
            accentColor="var(--wl-danger-500)"
            index={4}
          />
        </div>

        {/* Audience Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Audience Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center mb-6 h-40">
              <svg
                width="140"
                height="140"
                viewBox="0 0 140 140"
                style={{ transform: "rotate(-90deg)" }}
              >
                {audienceBreakdown.reduce((acc, item, idx, arr) => {
                  const prev = arr.slice(0, idx).reduce((sum, p) => sum + parseFloat(p.percentage), 0);
                  const startAngle = (prev / 100) * 360;
                  const endAngle = ((prev + parseFloat(item.percentage)) / 100) * 360;
                  const startRad = (startAngle * Math.PI) / 180;
                  const endRad = (endAngle * Math.PI) / 180;
                  const x1 = 70 + 60 * Math.cos(startRad);
                  const y1 = 70 + 60 * Math.sin(startRad);
                  const x2 = 70 + 60 * Math.cos(endRad);
                  const y2 = 70 + 60 * Math.sin(endRad);
                  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
                  return [
                    ...acc,
                    <path
                      key={`slice-${idx}`}
                      d={`M 70,70 L ${x1},${y1} A 60,60 0 ${largeArc},1 ${x2},${y2} Z`}
                      fill={item.color}
                      style={{ opacity: 0.8 }}
                    />,
                  ];
                }, [] as React.ReactNode[])}
              </svg>
            </div>
            <div className="flex flex-col gap-2">
              {audienceBreakdown.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ background: item.color }} />
                    <span className="text-sm">{item.label}</span>
                  </div>
                  <div className="flex gap-3 items-center">
                    <span className="text-sm font-medium">{formatNumber(item.value)}</span>
                    <span className="text-xs text-wl-text-secondary text-right" style={{ minWidth: "35px" }}>
                      {item.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
