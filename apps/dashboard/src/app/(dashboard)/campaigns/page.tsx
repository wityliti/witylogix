"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { Table } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn, formatRelativeTime, formatNumber } from "@/lib/utils";
import {
import { useApiList } from '@/hooks/use-api';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
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

/* ═══════════════════════════════════════════════════════════
   items PAGE — Campaign management dashboard
   ═══════════════════════════════════════════════════════════ */

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
  const { items, loading, error, refetch, pagination } = useApiList<Campaign>('/api/v4/campaigns');

  if (loading) return <TableSkeleton rows={10} columns={6} />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [filterType, setFilterType] = useState<CampaignType | "ALL">("ALL");
  const [filterStatus, setFilterStatus] = useState<CampaignStatus | "ALL">("ALL");
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignType, setNewCampaignType] = useState<CampaignType>("EMAIL");
  const [newCampaignTemplate, setNewCampaignTemplate] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const filteredCampaigns = useMemo(() => {
    return items.filter(
      (c) =>
        (filterType === "ALL" || c.type === filterType) &&
        (filterStatus === "ALL" || c.status === filterStatus)
    );
  }, [filterType, filterStatus]);

  const stats = useMemo(() => {
    const active = items.filter((c) => c.status !== "DRAFT").length;
    const totalSent = items.reduce((sum, c) => sum + c.sent, 0);
    const totalOpened = items.reduce((sum, c) => sum + c.opened, 0);
    const totalClicked = items.reduce((sum, c) => sum + c.clicked, 0);

    const avgOpenRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : "0";
    const avgClickRate = totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : "0";

    return { active, totalSent, avgOpenRate, avgClickRate };
  }, []);

  const handleCreateCampaign = () => {
    if (newCampaignName.trim()) {
      console.log("Creating campaign:", { newCampaignName, newCampaignType, newCampaignTemplate });
      setIsCreateOpen(false);
      setNewCampaignName("");
      setNewCampaignTemplate("");
    }
  };

  const handleDuplicate = (campaign: Campaign) => {
    console.log("Duplicating campaign:", campaign.id);
  };

  const handlePause = (campaign: Campaign) => {
    console.log("Pausing campaign:", campaign.id);
  };

  const handleDelete = (campaign: Campaign) => {
    console.log("Deleting campaign:", campaign.id);
  };

  return (
    <div className="min-h-screen bg-wl-bg-primary">
      <Header title="Campaigns" description="Create and manage marketing campaigns" />

      <div className="p-8 w-full mx-auto">
        {/* Stats Row */}
        <div className="grid grid-cols-auto-fit gap-4 mb-8" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
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
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters & Actions</CardTitle>
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus size={16} />
              New Campaign
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-auto-fit gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <Select
                label="Campaign Type"
                value={filterType}
                onChange={(v) => setFilterType(v as CampaignType | "ALL")}
                options={[
                  { value: "ALL", label: "All Types" },
                  { value: "EMAIL", label: "Email" },
                  { value: "SMS", label: "SMS" },
                  { value: "WHATSAPP", label: "WhatsApp" },
                  { value: "PUSH", label: "Push" },
                ]}
              />
              <Select
                label="Status"
                value={filterStatus}
                onChange={(v) => setFilterStatus(v as CampaignStatus | "ALL")}
                options={[
                  { value: "ALL", label: "All Statuses" },
                  { value: "DRAFT", label: "Draft" },
                  { value: "SCHEDULED", label: "Scheduled" },
                  { value: "SENDING", label: "Sending" },
                  { value: "COMPLETED", label: "Completed" },
                ]}
              />
            </div>
          </CardContent>
        </Card>

        {/* Campaigns Table */}
        <Card>
          <CardHeader>
            <CardTitle>Campaigns ({filteredCampaigns.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table
              columns={[
                {
                  key: "name",
                  header: "Campaign Name",
                  render: (c: Campaign) => (
                    <div className="flex items-center gap-2">
                      <span>{c.name}</span>
                    </div>
                  ),
                  width: "25%",
                },
                {
                  key: "type",
                  header: "Type",
                  render: (c: Campaign) => (
                    <Badge variant={typeVariant(c.type)} className="inline-flex items-center gap-1">
                      {typeIcon(c.type)}
                      {c.type}
                    </Badge>
                  ),
                  width: "12%",
                },
                {
                  key: "status",
                  header: "Status",
                  render: (c: Campaign) => <Badge variant={statusVariant(c.status)}>{c.status}</Badge>,
                  width: "12%",
                },
                {
                  key: "recipients",
                  header: "Recipients",
                  render: (c: Campaign) => formatNumber(c.recipients),
                  width: "12%",
                  align: "right",
                },
                {
                  key: "sent",
                  header: "Sent",
                  render: (c: Campaign) => formatNumber(c.sent),
                  width: "10%",
                  align: "right",
                },
                {
                  key: "opened",
                  header: "Opened",
                  render: (c: Campaign) => {
                    const rate = c.sent > 0 ? ((c.opened / c.sent) * 100).toFixed(0) : "0";
                    return `${formatNumber(c.opened)} (${rate}%)`;
                  },
                  width: "10%",
                  align: "right",
                },
                {
                  key: "clicked",
                  header: "Clicked",
                  render: (c: Campaign) => {
                    const rate = c.sent > 0 ? ((c.clicked / c.sent) * 100).toFixed(0) : "0";
                    return `${formatNumber(c.clicked)} (${rate}%)`;
                  },
                  width: "10%",
                  align: "right",
                },
                {
                  key: "createdAt",
                  header: "Created",
                  render: (c: Campaign) => formatRelativeTime(c.createdAt),
                  width: "12%",
                  align: "right",
                },
                {
                  key: "actions",
                  header: "Actions",
                  render: (c: Campaign) => (
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicate(c)}
                        className="px-2 py-1"
                      >
                        <Copy size={14} />
                      </Button>
                      {c.status === "SENDING" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePause(c)}
                          className="px-2 py-1"
                        >
                          <Pause size={14} />
                        </Button>
                      )}
                      {c.status === "DRAFT" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(c)}
                          className="px-2 py-1 text-wl-danger-400"
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  ),
                  width: "10%",
                  align: "right",
                },
              ]}
              data={filteredCampaigns}
              selectedId={selectedId}
              onRowClick={(campaign) => setSelectedId(campaign.id)}
              emptyMessage="No campaigns found. Create your first campaign to get started."
            />
          </CardContent>
        </Card>
      </div>

      {/* Create Campaign Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Campaign"
        size="md"
        footer={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={() => setIsCreateOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCampaign}
              disabled={!newCampaignName.trim()}
              className="flex-1"
            >
              Create Campaign
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Campaign Name"
            placeholder="e.g., Spring Sale 2026"
            value={newCampaignName}
            onChange={setNewCampaignName}
          />
          <Select
            label="Channel"
            value={newCampaignType}
            onChange={(v) => setNewCampaignType(v as CampaignType)}
            options={[
              { value: "EMAIL", label: "Email" },
              { value: "SMS", label: "SMS" },
              { value: "WHATSAPP", label: "WhatsApp" },
              { value: "PUSH", label: "Push Notification" },
            ]}
          />
          <Select
            label="Template"
            value={newCampaignTemplate}
            onChange={setNewCampaignTemplate}
            options={[
              { value: "", label: "Select a template..." },
              { value: "promotional", label: "Promotional" },
              { value: "transactional", label: "Transactional" },
              { value: "newsletter", label: "Newsletter" },
              { value: "blank", label: "Blank" },
            ]}
          />
        </div>
      </Modal>
    </div>
  );
}
