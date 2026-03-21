"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { cn, formatRelativeTime, formatNumber } from "@/lib/utils";
import { useApiList } from "@/hooks/use-api";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import {
  Mail,
  MessageSquare,
  MessageCircle,
  Bell,
  Plus,
  Copy,
  Pause,
  Trash2,
  TrendingUp,
  Send,
} from "lucide-react";

type CampaignType = "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";
type CampaignStatus = "DRAFT" | "SCHEDULED" | "SENDING" | "COMPLETED";

interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  recipients: number;
  sent: number;
  opened: number;
  clicked: number;
  createdAt: string;
  sentAt?: string;
}

const typeVariant = (t: CampaignType): "success" | "warning" | "danger" | "info" | "primary" | "default" => {
  const map: Record<CampaignType, "success" | "warning" | "danger" | "info" | "primary" | "default"> = {
    EMAIL: "info",
    SMS: "success",
    WHATSAPP: "primary",
    PUSH: "warning",
  };
  return map[t];
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

const typeIcon = (t: CampaignType) => {
  const icons: Record<CampaignType, React.ReactNode> = {
    EMAIL: <Mail size={14} />,
    SMS: <MessageSquare size={14} />,
    WHATSAPP: <MessageCircle size={14} />,
    PUSH: <Bell size={14} />,
  };
  return icons[t];
};

export default function CampaignsPage() {
  const { items, loading, error, refetch } = useApiList<Campaign>("/api/v4/campaigns");

  if (loading) return <TableSkeleton rows={10} columns={6} />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [filterType, setFilterType] = useState<CampaignType | "ALL">("ALL");
  const [filterStatus, setFilterStatus] = useState<CampaignStatus | "ALL">("ALL");
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const filteredCampaigns = useMemo(() => {
    return items.filter(
      (c) =>
        (filterType === "ALL" || c.type === filterType) &&
        (filterStatus === "ALL" || c.status === filterStatus)
    );
  }, [items, filterType, filterStatus]);

  const stats = useMemo(() => {
    const active = items.filter((c) => c.status !== "DRAFT").length;
    const totalSent = items.reduce((sum, c) => sum + c.sent, 0);
    const totalOpened = items.reduce((sum, c) => sum + c.opened, 0);
    const totalClicked = items.reduce((sum, c) => sum + c.clicked, 0);

    const avgOpenRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : "0";
    const avgClickRate = totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : "0";

    return { active, totalSent, avgOpenRate, avgClickRate };
  }, [items]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Campaigns</h1>
          <p className="text-gray-400">Create and manage marketing campaigns</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Active Campaigns"
            value={stats.active}
            icon={<Send size={18} />}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Total Sent"
            value={formatNumber(stats.totalSent)}
            icon={<TrendingUp size={18} />}
            accentColor="var(--wl-info-500)"
            index={1}
          />
          <StatCard
            label="Avg. Open Rate"
            value={`${stats.avgOpenRate}%`}
            icon={<Mail size={18} />}
            accentColor="var(--wl-success-500)"
            index={2}
          />
          <StatCard
            label="Avg. Click Rate"
            value={`${stats.avgClickRate}%`}
            icon={<TrendingUp size={18} />}
            accentColor="var(--wl-warning-500)"
            index={3}
          />
        </div>

        {/* Controls Card */}
        <Card className="bg-[#12121a] border-[#1e1e2e] mb-6">
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
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-[#1e1e2e] text-white text-sm"
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
                  className="w-full px-3 py-2 rounded-lg bg-[#1a1a2e] border border-[#1e1e2e] text-white text-sm"
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
        <Card className="bg-[#12121a] border-[#1e1e2e]">
          <CardHeader>
            <CardTitle className="text-white">Campaigns ({filteredCampaigns.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e1e2e]">
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
                          "border-b border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors",
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
    </div>
  );
}
