"use client";

import { useMemo } from "react";
import { Header } from "../../../components/layout/header";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { StatCard } from "../../../components/ui/stat-card";
import { cn, formatNumber, formatRelativeTime } from "../../../lib/utils";
import {
  Edit,
  Copy,
  Archive,
  Mail,
  CheckCircle,
  AlertCircle,
  LogOut,
  BarChart3,
  Clock,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   CAMPAIGN DETAIL PAGE — Detailed view of a single campaign
   ═══════════════════════════════════════════════════════════ */

type CampaignType = "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";
type CampaignStatus = "DRAFT" | "SCHEDULED" | "SENDING" | "COMPLETED";
type EventType = "sent" | "delivered" | "opened" | "clicked" | "bounced" | "unsubscribed";

interface TimelineEvent {
  timestamp: string;
  type: EventType;
  count: number;
  description: string;
}

interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  createdAt: string;
  sentAt?: string;
  completedAt?: string;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
  };
  timeline: TimelineEvent[];
  audienceBreakdown: { label: string; value: number; color: string }[];
  templatePreview: string;
}

const CAMPAIGN: Campaign = {
  id: "camp-1",
  name: "Spring Collection Launch",
  type: "EMAIL",
  status: "COMPLETED",
  createdAt: "2026-02-28T10:30:00Z",
  sentAt: "2026-03-01T08:00:00Z",
  completedAt: "2026-03-02T16:00:00Z",
  stats: {
    sent: 5234,
    delivered: 5100,
    opened: 1870,
    clicked: 234,
    bounced: 134,
    unsubscribed: 45,
  },
  timeline: [
    {
      timestamp: "2026-03-01T08:00:00Z",
      type: "sent",
      count: 5234,
      description: "Campaign sent to all recipients",
    },
    {
      timestamp: "2026-03-01T09:15:00Z",
      type: "delivered",
      count: 5100,
      description: "Emails delivered successfully",
    },
    {
      timestamp: "2026-03-01T12:30:00Z",
      type: "opened",
      count: 847,
      description: "First opens recorded",
    },
    {
      timestamp: "2026-03-01T15:45:00Z",
      type: "clicked",
      count: 102,
      description: "Users clicking on links",
    },
    {
      timestamp: "2026-03-02T10:00:00Z",
      type: "opened",
      count: 1023,
      description: "Additional opens over 24 hours",
    },
    {
      timestamp: "2026-03-02T16:00:00Z",
      type: "completed",
      count: 1,
      description: "Campaign reporting complete",
    },
  ],
  audienceBreakdown: [
    { label: "Delivered", value: 5100, color: "#22c55e" },
    { label: "Bounced", value: 134, color: "#ef4444" },
  ],
  templatePreview: `<div style="max-width: 600px; margin: 0 auto; font-family: sans-serif;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white;">
    <h1 style="margin: 0; font-size: 32px;">Spring Collection Launch</h1>
    <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Discover our newest arrivals</p>
  </div>
  <div style="padding: 40px 20px; background: #f5f5f5;">
    <h2 style="margin: 0 0 15px 0;">Hello Customer,</h2>
    <p style="margin: 0 0 20px 0; line-height: 1.6;">
      We're excited to introduce our Spring Collection 2026 with exclusive styles and premium quality products.
    </p>
    <p style="margin: 0 0 30px 0; text-align: center;">
      <a href="#" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: bold;">Shop Now</a>
    </p>
    <p style="margin: 0; color: #666; font-size: 12px;">
      Have questions? Reply to this email or contact our support team.
    </p>
  </div>
</div>`,
};

const statusVariant = (s: CampaignStatus): "success" | "warning" | "danger" | "info" | "primary" | "default" => {
  const map: Record<CampaignStatus, "success" | "warning" | "danger" | "info" | "primary" | "default"> = {
    DRAFT: "default",
    SCHEDULED: "info",
    SENDING: "warning",
    COMPLETED: "success",
  };
  return map[s];
};

const typeVariant = (t: CampaignType): "success" | "warning" | "danger" | "info" | "primary" | "default" => {
  const map: Record<CampaignType, "success" | "warning" | "danger" | "info" | "primary" | "default"> = {
    EMAIL: "info",
    SMS: "success",
    WHATSAPP: "primary",
    PUSH: "warning",
  };
  return map[t];
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
  return icons[type];
};

export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  const campaign = CAMPAIGN;
  const deliveryRate = ((campaign.stats.delivered / campaign.stats.sent) * 100).toFixed(1);
  const openRate = ((campaign.stats.opened / campaign.stats.delivered) * 100).toFixed(1);
  const clickRate = ((campaign.stats.clicked / campaign.stats.opened) * 100).toFixed(1);

  const pieChartPercentages = useMemo(() => {
    const total = campaign.audienceBreakdown.reduce((sum, item) => sum + item.value, 0);
    return campaign.audienceBreakdown.map((item) => ({
      ...item,
      percentage: ((item.value / total) * 100).toFixed(1),
    }));
  }, []);

  return (
    <div className="min-h-screen bg-wl-bg-primary">
      <Header
        title={campaign.name}
        description={`${campaign.type} campaign • Created ${formatRelativeTime(campaign.createdAt)}`}
      />

      <div className="p-8 w-full mx-auto">
        {/* Header with Status */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Badge variant={typeVariant(campaign.type)}>{campaign.type}</Badge>
            <Badge variant={statusVariant(campaign.status)}>{campaign.status}</Badge>
            {campaign.sentAt && (
              <span className="text-sm text-wl-text-secondary">
                Sent {formatRelativeTime(campaign.sentAt)}
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
            value={formatNumber(campaign.stats.sent)}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Delivered"
            value={formatNumber(campaign.stats.delivered)}
            change={{ value: parseInt(deliveryRate), label: "delivery rate" }}
            accentColor="var(--wl-success-500)"
            index={1}
          />
          <StatCard
            label="Opened"
            value={formatNumber(campaign.stats.opened)}
            change={{ value: parseInt(openRate), label: "open rate" }}
            accentColor="var(--wl-info-500)"
            index={2}
          />
          <StatCard
            label="Clicked"
            value={formatNumber(campaign.stats.clicked)}
            change={{ value: parseInt(clickRate), label: "click rate" }}
            accentColor="var(--wl-warning-500)"
            index={3}
          />
          <StatCard
            label="Bounced"
            value={formatNumber(campaign.stats.bounced)}
            accentColor="var(--wl-danger-500)"
            index={4}
          />
          <StatCard
            label="Unsubscribed"
            value={formatNumber(campaign.stats.unsubscribed)}
            accentColor="var(--wl-neutral-500)"
            index={5}
          />
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {campaign.timeline.map((event, idx) => (
                  <div
                    key={idx}
                    className={cn("flex gap-3", {
                      "pb-3 border-b border-wl-border-subtle": idx < campaign.timeline.length - 1,
                    })}
                  >
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0"
                      style={{
                        background: "rgba(245, 166, 35, 0.12)",
                        color: "var(--wl-primary-400)",
                      }}
                    >
                      {eventTypeIcon(event.type)}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-wl-text-primary mb-0.5">
                        {event.description}
                      </div>
                      <div className="text-xs text-wl-text-secondary">
                        {formatRelativeTime(event.timestamp)} • {formatNumber(event.count)} events
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Audience Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Audience Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center mb-6 h-40">
                {/* Simple pie chart using SVG */}
                <svg
                  width="140"
                  height="140"
                  viewBox="0 0 140 140"
                  style={{ transform: "rotate(-90deg)" }}
                >
                  {pieChartPercentages.reduce((acc, item, idx, arr) => {
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
                {pieChartPercentages.map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{
                          background: item.color,
                        }}
                      />
                      <span className="text-sm">{item.label}</span>
                    </div>
                    <div className="flex gap-3 items-center">
                      <span className="text-sm font-medium">
                        {formatNumber(item.value)}
                      </span>
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

        {/* Template Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Template Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-wl-bg-primary border border-wl-border-subtle rounded-md p-6 overflow-x-auto">
              <div
                className="bg-white rounded-md overflow-hidden min-w-[400px]"
                dangerouslySetInnerHTML={{ __html: campaign.templatePreview }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
