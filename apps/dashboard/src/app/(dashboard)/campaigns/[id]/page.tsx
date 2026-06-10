'use client';

import { use, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { cn, formatNumber, formatRelativeTime } from "@/lib/utils";
import { useApiQuery, useApiList } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import {
  Edit,
  Copy,
  Archive,
  Mail,
  CheckCircle,
  AlertCircle,
  LogOut,
  BarChart3,
  Users,
  Map as MapIcon,
  ArrowLeft,
  Send,
  Pause,
  Play,
} from "lucide-react";

const CampaignReachMap = dynamic(
  () =>
    import("../components/campaign-reach-map").then((m) => m.CampaignReachMap),
  { ssr: false },
);

type CampaignType = "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";
type CampaignStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "SENDING"
  | "COMPLETED"
  | "PAUSED";
type EventType =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "unsubscribed";

interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  failedCount: number;
  bouncedCount: number;
  unsubscribedCount: number;
  audienceFilter: Record<string, unknown>;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface CampaignEvent {
  id: string;
  type: EventType;
  recipient: string;
  occurred_at: string;
}

interface CampaignRecipient {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status: string;
  sent_at?: string;
}

const statusVariant = (
  s: CampaignStatus,
): "success" | "warning" | "danger" | "info" | "primary" | "default" =>
  ({
    DRAFT: "default",
    SCHEDULED: "info",
    SENDING: "warning",
    PAUSED: "danger",
    COMPLETED: "success",
  } as const)[s] ?? "default";

const typeVariant = (
  t: CampaignType,
): "success" | "warning" | "danger" | "info" | "primary" | "default" =>
  ({
    EMAIL: "info",
    SMS: "success",
    WHATSAPP: "primary",
    PUSH: "warning",
  } as const)[t] ?? "default";

const eventIcon = (type: EventType) => {
  const icons: Record<EventType, React.ReactNode> = {
    sent: <Send size={14} className="text-wl-text-tertiary" />,
    delivered: <CheckCircle size={14} className="text-wl-success-400" />,
    opened: <Mail size={14} className="text-wl-info-400" />,
    clicked: <BarChart3 size={14} className="text-wl-primary-400" />,
    bounced: <AlertCircle size={14} className="text-wl-danger-400" />,
    unsubscribed: <LogOut size={14} className="text-wl-warning-400" />,
  };
  return icons[type] ?? null;
};

type ActiveTab = "overview" | "events" | "recipients" | "map";

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: campaign,
    loading,
    error,
    refetch,
  } = useApiQuery<Campaign>(`/api/v4/campaigns/${id}`);

  const { items: events, loading: eventsLoading } =
    useApiList<CampaignEvent>(
      activeTab === "events" ? `/api/v4/campaigns/${id}/events` : null,
    );

  const { items: recipients, loading: recipientsLoading } =
    useApiList<CampaignRecipient>(
      activeTab === "recipients"
        ? `/api/v4/campaigns/${id}/recipients`
        : null,
    );

  const runAction = async (action: () => Promise<unknown>) => {
    setActionLoading(true);
    setActionError(null);
    try {
      await action();
      refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  const pieData = useMemo(() => {
    if (!campaign) return [];
    const sent = campaign.stats.total_events || 0;
    const { delivered, opened, failed } = campaign.stats;
    return [
      {
        label: "Opened",
        value: opened,
        color: "var(--wl-info-500)",
        pct: sent > 0 ? ((opened / sent) * 100).toFixed(1) : "0",
      },
      {
        label: "Delivered (not opened)",
        value: Math.max(0, delivered - opened),
        color: "var(--wl-success-500)",
        pct:
          sent > 0
            ? (((delivered - opened) / sent) * 100).toFixed(1)
            : "0",
      },
      {
        label: "Failed",
        value: failed,
        color: "var(--wl-danger-500)",
        pct: sent > 0 ? ((failed / sent) * 100).toFixed(1) : "0",
      },
    ];
  }, [campaign]);

  if (loading) {
    return (
      <div className="min-h-screen bg-wl-bg-root p-8">
        <TableSkeleton rows={6} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [mapId, setMapId] = useState<string | null>(null);
  const handleMapReady = useCallback((mid: string) => setMapId(mid), []);

  const {
    data: campaign,
    loading,
    error,
    refetch,
  } = useApiQuery<Campaign>(`/api/v4/campaigns/${id}`);

  // API returns { data: ReachPoint[] }; useApiQuery unwraps to ReachPoint[]
  const { data: reachPoints, loading: geoLoading } = useApiQuery<ReachPoint[]>(
    `/api/v4/campaigns/${id}/geo`
  );

  if (loading) return <CampaignSkeleton />;

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-wl-bg-root p-8">
        <ErrorState message="Failed to load campaign." onRetry={refetch} />
      </div>
    );
  }

  const sent = campaign.stats.total_events || 0;
  const { delivered, opened, clicked, failed } = campaign.stats;
  const deliveryRate =
    sent > 0 ? ((delivered / sent) * 100).toFixed(1) : "0.0";
  const openRate =
    delivered > 0 ? ((opened / delivered) * 100).toFixed(1) : "0.0";
  const clickRate =
    opened > 0 ? ((clicked / opened) * 100).toFixed(1) : "0.0";

  const tabs: { key: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <BarChart3 size={14} /> },
    { key: "events", label: "Events", icon: <CheckCircle size={14} /> },
    { key: "recipients", label: "Recipients", icon: <Users size={14} /> },
    { key: "map", label: "Reach Map", icon: <MapIcon size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title={campaign.name}
        subtitle={`${campaign.type} campaign • Created ${formatRelativeTime(campaign.created_at)}`}
      />

      <div className="p-6 max-w-7xl mx-auto">
        {/* Back */}
        <button
          onClick={() => router.push("/campaigns")}
          className="flex items-center gap-1.5 text-wl-text-tertiary hover:text-wl-text-secondary text-sm mb-6 transition-colors"
        >
          <ArrowLeft size={14} />
          All Campaigns
        </button>

        {/* Status / Actions bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Badge variant={typeVariant(campaign.type)}>{campaign.type}</Badge>
            <Badge variant={statusVariant(campaign.status)}>
              {campaign.status}
            </Badge>
            {campaign.sent_at && (
              <span className="text-sm text-wl-text-secondary">
                Sent {formatRelativeTime(campaign.sent_at)}
              </span>
            )}
          </div>

          {actionError && (
            <p className="text-sm text-wl-danger-400">{actionError}</p>
          )}

          <div className="flex gap-2">
            {campaign.status === "DRAFT" && (
              <Button
                variant="primary"
                size="md"
                disabled={actionLoading}
                onClick={() =>
                  runAction(() => api.post(`/api/v4/campaigns/${id}/send`, {}))
                }
              >
                <Send size={14} className="mr-1" />
                Send Now
              </Button>
            )}
            {campaign.status === "SENDING" && (
              <Button
                variant="secondary"
                size="md"
                disabled={actionLoading}
                onClick={() =>
                  runAction(() =>
                    api.post(`/api/v4/campaigns/${id}/pause`, {}),
                  )
                }
              >
                <Pause size={14} className="mr-1" />
                Pause
              </Button>
            )}
            {campaign.status === "PAUSED" && (
              <Button
                variant="secondary"
                size="md"
                disabled={actionLoading}
                onClick={() =>
                  runAction(() =>
                    api.post(`/api/v4/campaigns/${id}/resume`, {}),
                  )
                }
              >
                <Play size={14} className="mr-1" />
                Resume
              </Button>
            )}
            <Button
              variant="secondary"
              size="md"
              disabled={actionLoading}
              onClick={() =>
                runAction(async () => {
                  await api.post(`/api/v4/campaigns`, {
                    name: `${campaign.name} (copy)`,
                    type: campaign.type,
                  });
                  router.push("/campaigns");
                })
              }
            >
              <Copy size={14} className="mr-1" />
              Duplicate
            </Button>
            {["DRAFT", "COMPLETED"].includes(campaign.status) && (
              <Button
                variant="secondary"
                size="md"
                disabled={actionLoading}
                onClick={() =>
                  runAction(async () => {
                    await api.delete(`/api/v4/campaigns/${id}`);
                    router.push("/campaigns");
                  })
                }
              >
                <Archive size={14} className="mr-1" />
                Archive
              </Button>
            )}
            <Button variant="secondary" size="md">
              <Edit size={14} className="mr-1" />
              Edit
            </Button>
          </div>
        }
      />

        {/* Stats row */}
        <div
          className="grid gap-4 mb-8"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          }}
        >
          <StatCard
            label="Sent"
            value={formatNumber(sent)}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Delivered"
            value={formatNumber(delivered)}
            change={{ value: parseFloat(deliveryRate), label: "delivery rate" }}
            accentColor="var(--wl-success-500)"
            index={1}
          />
          <StatCard
            label="Opened"
            value={formatNumber(opened)}
            change={{ value: parseFloat(openRate), label: "open rate" }}
            accentColor="var(--wl-info-500)"
            index={2}
          />
          <StatCard
            label="Clicked"
            value={formatNumber(clicked)}
            change={{ value: parseFloat(clickRate), label: "click rate" }}
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

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-wl-border-default">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors -mb-px border-b-2",
                activeTab === tab.key
                  ? "text-wl-primary-400 border-wl-primary-500"
                  : "text-wl-text-secondary border-transparent hover:text-wl-text-primary",
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {activeTab === "overview" && (
          <Card className="bg-wl-bg-surface border-wl-border-default">
            <CardHeader>
              <CardTitle className="text-wl-text-primary">
                Audience Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <svg
                  width="160"
                  height="160"
                  viewBox="0 0 140 140"
                  style={{ transform: "rotate(-90deg)" }}
                  className="flex-shrink-0"
                >
                  {sent === 0 ? (
                    <circle
                      cx="70"
                      cy="70"
                      r="55"
                      fill="none"
                      stroke="var(--wl-border-default)"
                      strokeWidth="20"
                    />
                  ) : (
                    pieData.reduce(
                      (
                        acc: { els: React.ReactNode[]; offset: number },
                        item,
                        idx,
                      ) => {
                        const pct = parseFloat(item.pct);
                        const circ = 2 * Math.PI * 55;
                        const dash = (pct / 100) * circ;
                        const el = (
                          <circle
                            key={idx}
                            cx="70"
                            cy="70"
                            r="55"
                            fill="none"
                            stroke={item.color}
                            strokeWidth="20"
                            strokeDasharray={`${dash} ${circ - dash}`}
                            strokeDashoffset={-acc.offset}
                            style={{ opacity: 0.85 }}
                          />
                        );
                        return {
                          els: [...acc.els, el],
                          offset: acc.offset + dash,
                        };
                      },
                      { els: [], offset: 0 },
                    ).els
                  )}
                </svg>

                <div className="flex-1 space-y-3">
                  {pieData.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-sm"
                          style={{ background: item.color, opacity: 0.85 }}
                        />
                        <span className="text-sm text-wl-text-secondary">
                          {item.label}
                        </span>
                      </div>
                      <div className="flex gap-3 items-center">
                        <span className="text-sm font-medium text-wl-text-primary">
                          {formatNumber(item.value)}
                        </span>
                        <span className="text-xs text-wl-text-tertiary w-10 text-right">
                          {item.pct}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Events tab */}
        {activeTab === "events" && (
          <Card className="bg-wl-bg-surface border-wl-border-default">
            <CardHeader>
              <CardTitle className="text-wl-text-primary">
                Campaign Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              {eventsLoading ? (
                <TableSkeleton rows={8} columns={3} />
              ) : events.length === 0 ? (
                <div className="text-center py-12 text-wl-text-tertiary">
                  <CheckCircle size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium text-wl-text-secondary">
                    No events yet
                  </p>
                  <p className="text-sm mt-1">
                    Events will appear once the campaign starts sending.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-wl-border-default">
                        <th className="text-left py-3 px-4 text-wl-text-tertiary font-semibold">
                          Event
                        </th>
                        <th className="text-left py-3 px-4 text-wl-text-tertiary font-semibold">
                          Recipient
                        </th>
                        <th className="text-right py-3 px-4 text-wl-text-tertiary font-semibold">
                          When
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((ev) => (
                        <tr
                          key={ev.id}
                          className="border-b border-wl-border-default hover:bg-wl-bg-elevated transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2 text-wl-text-primary">
                              {eventIcon(ev.type)}
                              <span className="capitalize">{ev.type}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-wl-text-secondary font-mono text-xs">
                            {ev.recipient}
                          </td>
                          <td className="py-3 px-4 text-right text-wl-text-tertiary text-xs">
                            {formatRelativeTime(ev.occurred_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recipients tab */}
        {activeTab === "recipients" && (
          <Card className="bg-wl-bg-surface border-wl-border-default">
            <CardHeader>
              <CardTitle className="text-wl-text-primary">Recipients</CardTitle>
            </CardHeader>
            <CardContent>
              {recipientsLoading ? (
                <TableSkeleton rows={8} columns={4} />
              ) : recipients.length === 0 ? (
                <div className="text-center py-12 text-wl-text-tertiary">
                  <Users size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium text-wl-text-secondary">
                    No recipients
                  </p>
                  <p className="text-sm mt-1">
                    Recipients are added when the campaign is sent.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-wl-border-default">
                        <th className="text-left py-3 px-4 text-wl-text-tertiary font-semibold">
                          Name
                        </th>
                        <th className="text-left py-3 px-4 text-wl-text-tertiary font-semibold">
                          Contact
                        </th>
                        <th className="text-left py-3 px-4 text-wl-text-tertiary font-semibold">
                          Status
                        </th>
                        <th className="text-right py-3 px-4 text-wl-text-tertiary font-semibold">
                          Sent At
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipients.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-wl-border-default hover:bg-wl-bg-elevated transition-colors"
                        >
                          <td className="py-3 px-4 text-wl-text-primary font-medium">
                            {r.name}
                          </td>
                          <td className="py-3 px-4 text-wl-text-secondary text-xs font-mono">
                            {r.email ?? r.phone ?? "—"}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={
                                r.status === "delivered"
                                  ? "success"
                                  : r.status === "failed"
                                    ? "danger"
                                    : "default"
                              }
                            >
                              {r.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right text-wl-text-tertiary text-xs">
                            {r.sent_at ? formatRelativeTime(r.sent_at) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Reach Map tab */}
        {activeTab === "map" && (
          <div className="h-[520px]">
            <CampaignReachMap />
          </div>
        )}
      </div>
    </div>
  );
}
