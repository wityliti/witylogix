'use client';

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { cn, formatRelativeTime, formatNumber } from "@/lib/utils";
import { useApiList, useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Header } from "@/components/layout/header";
import {
  Mail,
  MessageSquare,
  MessageCircle,
  Bell,
  Plus,
  Copy,
  Pause,
  Play,
  Trash2,
  TrendingUp,
  Send,
  Map as MapIcon,
  List,
  ExternalLink,
} from "lucide-react";

const CampaignReachMap = dynamic(
  () =>
    import("./components/campaign-reach-map").then((m) => m.CampaignReachMap),
  { ssr: false },
);

type CampaignType = "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";
type CampaignStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "SENDING"
  | "COMPLETED"
  | "PAUSED";

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
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

const typeVariant = (
  t: CampaignType,
): "success" | "warning" | "danger" | "info" | "primary" | "default" =>
  ({ EMAIL: "info", SMS: "success", WHATSAPP: "primary", PUSH: "warning" } as const)[t] ?? "default";

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

const typeIcon = (t: CampaignType) =>
  ({
    EMAIL: <Mail size={14} />,
    SMS: <MessageSquare size={14} />,
    WHATSAPP: <MessageCircle size={14} />,
    PUSH: <Bell size={14} />,
  } as const)[t];

// ── Create Campaign Modal ─────────────────────────────────────

function CreateCampaignModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CampaignType>("EMAIL");
  const [templateId, setTemplateId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { execute, loading } = useApiMutation<Campaign>(
    "POST",
    "/api/v4/campaigns",
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    try {
      await execute({
        name: name.trim(),
        type,
        templateId: templateId.trim() || undefined,
        scheduledAt: scheduledAt || undefined,
      });
      onCreated();
      onClose();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to create campaign",
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-wl-bg-elevated border border-wl-border-default rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-wl-text-primary">
            New Campaign
          </h2>
          <button
            onClick={onClose}
            className="text-wl-text-tertiary hover:text-wl-text-primary transition-colors text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-wl-text-secondary mb-1.5 uppercase tracking-wide">
              Campaign Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Summer Re-engagement"
              className="w-full px-3 py-2 rounded-lg bg-wl-bg-sunken border border-wl-border-default text-wl-text-primary text-sm placeholder:text-wl-text-tertiary focus:outline-none focus:border-wl-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-wl-text-secondary mb-1.5 uppercase tracking-wide">
              Channel *
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CampaignType)}
              className="w-full px-3 py-2 rounded-lg bg-wl-bg-sunken border border-wl-border-default text-wl-text-primary text-sm"
            >
              <option value="EMAIL">Email</option>
              <option value="SMS">SMS</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="PUSH">Push Notification</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-wl-text-secondary mb-1.5 uppercase tracking-wide">
              Template ID{" "}
              <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              placeholder="UUID of a notification template"
              className="w-full px-3 py-2 rounded-lg bg-wl-bg-sunken border border-wl-border-default text-wl-text-primary text-sm placeholder:text-wl-text-tertiary font-mono focus:outline-none focus:border-wl-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-wl-text-secondary mb-1.5 uppercase tracking-wide">
              Schedule For{" "}
              <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-wl-bg-sunken border border-wl-border-default text-wl-text-primary text-sm focus:outline-none focus:border-wl-primary-500"
            />
          </div>

          {submitError && (
            <p className="text-sm text-wl-danger-400 bg-wl-danger-500/10 rounded-lg px-3 py-2">
              {submitError}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              disabled={loading || !name.trim()}
            >
              {loading ? "Creating…" : "Create Campaign"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function CampaignsPage() {
  const router = useRouter();
  const { items, loading, error, refetch } = useApiList<Campaign>(
    "/api/v4/campaigns",
  );
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [filterType, setFilterType] = useState<CampaignType | "ALL">("ALL");
  const [filterStatus, setFilterStatus] = useState<CampaignStatus | "ALL">(
    "ALL",
  );
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDeleteCampaignId, setPendingDeleteCampaignId] = useState<string | null>(null);

  const filteredCampaigns = useMemo(
    () =>
      items.filter(
        (c) =>
          (filterType === "ALL" || c.type === filterType) &&
          (filterStatus === "ALL" || c.status === filterStatus),
      ),
    [items, filterType, filterStatus],
  );

  const stats = useMemo(() => {
    const active = items.filter(
      (c) => c.status === "SENDING" || c.status === "SCHEDULED",
    ).length;
    const totalSent = items.reduce((sum, c) => sum + (c.sent ?? 0), 0);
    const totalOpened = items.reduce((sum, c) => sum + (c.opened ?? 0), 0);
    const totalClicked = items.reduce((sum, c) => sum + (c.clicked ?? 0), 0);
    const avgOpenRate =
      totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : "0";
    const avgClickRate =
      totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : "0";
    return { active, totalSent, avgOpenRate, avgClickRate };
  }, [items]);

  const runAction = async (
    id: string,
    action: () => Promise<unknown>,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    setActionLoading(id);
    setActionError(null);
    try {
      await action();
      refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <TableSkeleton rows={10} columns={6} />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="min-h-screen bg-wl-bg-root p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Campaigns</h1>
          <p className="text-gray-400">Create and manage marketing campaigns</p>
        </div>

      {/* Stats row */}
      {statsLoading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Active Campaigns"
            value={summaryStats.active}
            icon={<Send size={18} />}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Total Sent"
            value={formatNumber(summaryStats.totalSent)}
            icon={<TrendingUp size={18} />}
            accentColor="var(--wl-info-500)"
            index={1}
          />
          <StatCard
            label="Avg. Open Rate"
            value={`${summaryStats.openRate}%`}
            icon={<Mail size={18} />}
            accentColor="var(--wl-success-500)"
            index={2}
          />
          <StatCard
            label="Avg. Click Rate"
            value={`${summaryStats.clickRate}%`}
            icon={<TrendingUp size={18} />}
            accentColor="var(--wl-warning-500)"
            index={3}
          />
        </div>
      )}

        {/* Controls Card */}
        <Card className="bg-wl-bg-surface border-wl-border-default mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">Filters & Actions</CardTitle>
              <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
                <Plus size={16} className="mr-2" />
                New Campaign
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase">Campaign Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as CampaignType | "ALL")}
                  className="w-full px-3 py-2 rounded-lg bg-wl-bg-elevated border border-wl-border-default text-white text-sm"
                >
                  <option value="ALL">All Types</option>
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="PUSH">Push</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as CampaignStatus | "ALL")}
                  className="w-full px-3 py-2 rounded-lg bg-wl-bg-elevated border border-wl-border-default text-white text-sm"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="SENDING">Sending</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Campaigns Table */}
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardHeader>
            <CardTitle className="text-white">Campaigns ({filteredCampaigns.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default">
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Campaign Name</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Type</th>
                    <th className="text-left py-3 px-4 text-gray-400 font-semibold">Status</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">Recipients</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">Sent</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">Opened</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">Clicked</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">Created</th>
                    <th className="text-right py-3 px-4 text-gray-400 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCampaigns.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-gray-400">
                        No campaigns found. Create your first campaign to get started.
                      </td>
                    </tr>
                  ) : (
                    filteredCampaigns.map((campaign) => (
                      <tr
                        key={campaign.id}
                        className={cn(
                          "border-b border-wl-border-default hover:bg-wl-bg-elevated transition-colors",
                          selectedId === campaign.id && "bg-blue-500/10"
                        )}
                        onClick={() => setSelectedId(campaign.id)}
                      >
                        <td className="py-3 px-4 text-white font-medium">{campaign.name}</td>
                        <td className="py-3 px-4">
                          <Badge variant={typeVariant(campaign.type)} className="inline-flex items-center gap-1">
                            {typeIcon(campaign.type)}
                            {campaign.type}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={statusVariant(campaign.status)}>{campaign.status}</Badge>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-300">{formatNumber(campaign.recipients)}</td>
                        <td className="py-3 px-4 text-right text-gray-300">{formatNumber(campaign.sent)}</td>
                        <td className="py-3 px-4 text-right text-gray-300">
                          {formatNumber(campaign.opened)} ({campaign.sent > 0 ? ((campaign.opened / campaign.sent) * 100).toFixed(0) : "0"}%)
                        </td>
                        <td className="py-3 px-4 text-right text-gray-300">
                          {formatNumber(campaign.clicked)} ({campaign.sent > 0 ? ((campaign.clicked / campaign.sent) * 100).toFixed(0) : "0"}%)
                        </td>
                        <td className="py-3 px-4 text-right text-gray-400 text-xs">{formatRelativeTime(campaign.createdAt)}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" className="p-1">
                              <Copy size={14} className="text-gray-400" />
                            </Button>
                            {campaign.status === "SENDING" && (
                              <Button variant="ghost" size="sm" className="p-1">
                                <Pause size={14} className="text-gray-400" />
                              </Button>
                            )}
                            {campaign.status === "DRAFT" && (
                              <Button variant="ghost" size="sm" className="p-1">
                                <Trash2 size={14} className="text-red-500" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
