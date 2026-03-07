"use client";

import { useState, useMemo } from "react";
import { Header } from "../../components/layout/header";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { StatCard } from "../../components/ui/stat-card";
import { Table } from "../../components/ui/table";
import { Modal } from "../../components/ui/modal";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { formatRelativeTime, formatNumber } from "../../lib/utils";
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

/* ═══════════════════════════════════════════════════════════
   CAMPAIGNS PAGE — Campaign management dashboard
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

const CAMPAIGNS: Campaign[] = [
  {
    id: "camp-1",
    name: "Spring Collection Launch",
    type: "EMAIL",
    status: "COMPLETED",
    recipients: 5234,
    sent: 5234,
    opened: 1847,
    clicked: 234,
    createdAt: "2026-02-28T10:30:00Z",
    sentAt: "2026-03-01T08:00:00Z",
  },
  {
    id: "camp-2",
    name: "Flash Sale - 24 Hours",
    type: "SMS",
    status: "SENDING",
    recipients: 8900,
    sent: 4450,
    opened: 2670,
    clicked: 535,
    createdAt: "2026-03-06T14:15:00Z",
    sentAt: "2026-03-06T15:00:00Z",
  },
  {
    id: "camp-3",
    name: "Loyalty Program Benefits",
    type: "WHATSAPP",
    status: "COMPLETED",
    recipients: 3456,
    sent: 3456,
    opened: 2347,
    clicked: 412,
    createdAt: "2026-03-03T09:45:00Z",
    sentAt: "2026-03-04T10:00:00Z",
  },
  {
    id: "camp-4",
    name: "Weekend Delivery Reminder",
    type: "PUSH",
    status: "SCHEDULED",
    recipients: 12000,
    sent: 0,
    opened: 0,
    clicked: 0,
    createdAt: "2026-03-05T16:20:00Z",
  },
  {
    id: "camp-5",
    name: "New Product Alert",
    type: "EMAIL",
    status: "DRAFT",
    recipients: 0,
    sent: 0,
    opened: 0,
    clicked: 0,
    createdAt: "2026-03-06T11:00:00Z",
  },
  {
    id: "camp-6",
    name: "Order Status Updates",
    type: "SMS",
    status: "COMPLETED",
    recipients: 15670,
    sent: 15670,
    opened: 0,
    clicked: 3134,
    createdAt: "2026-03-01T08:00:00Z",
    sentAt: "2026-03-02T09:00:00Z",
  },
  {
    id: "camp-7",
    name: "Customer Feedback Survey",
    type: "WHATSAPP",
    status: "SENDING",
    recipients: 4500,
    sent: 2250,
    opened: 1576,
    clicked: 281,
    createdAt: "2026-03-04T13:30:00Z",
    sentAt: "2026-03-05T14:00:00Z",
  },
  {
    id: "camp-8",
    name: "App Download Promotion",
    type: "PUSH",
    status: "COMPLETED",
    recipients: 28000,
    sent: 28000,
    opened: 16800,
    clicked: 4200,
    createdAt: "2026-02-25T10:00:00Z",
    sentAt: "2026-02-26T12:00:00Z",
  },
  {
    id: "camp-9",
    name: "Re-engagement Campaign",
    type: "EMAIL",
    status: "SCHEDULED",
    recipients: 6800,
    sent: 0,
    opened: 0,
    clicked: 0,
    createdAt: "2026-03-02T15:45:00Z",
  },
];

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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [filterType, setFilterType] = useState<CampaignType | "ALL">("ALL");
  const [filterStatus, setFilterStatus] = useState<CampaignStatus | "ALL">("ALL");
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignType, setNewCampaignType] = useState<CampaignType>("EMAIL");
  const [newCampaignTemplate, setNewCampaignTemplate] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const filteredCampaigns = useMemo(() => {
    return CAMPAIGNS.filter(
      (c) =>
        (filterType === "ALL" || c.type === filterType) &&
        (filterStatus === "ALL" || c.status === filterStatus)
    );
  }, [filterType, filterStatus]);

  const stats = useMemo(() => {
    const active = CAMPAIGNS.filter((c) => c.status !== "DRAFT").length;
    const totalSent = CAMPAIGNS.reduce((sum, c) => sum + c.sent, 0);
    const totalOpened = CAMPAIGNS.reduce((sum, c) => sum + c.opened, 0);
    const totalClicked = CAMPAIGNS.reduce((sum, c) => sum + c.clicked, 0);

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
    <div style={{ minHeight: "100vh", background: "var(--wl-bg-primary)" }}>
      <Header title="Campaigns" description="Create and manage marketing campaigns" />

      <div style={{ padding: "var(--wl-space-8)", maxWidth: "100%", margin: "0 auto" }}>
        {/* Stats Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "var(--wl-space-4)",
            marginBottom: "var(--wl-space-8)",
          }}
        >
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
        <Card style={{ marginBottom: "var(--wl-space-6)" }}>
          <CardHeader>
            <CardTitle>Filters & Actions</CardTitle>
            <Button
              onClick={() => setIsCreateOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--wl-space-2)",
              }}
            >
              <Plus size={16} />
              New Campaign
            </Button>
          </CardHeader>
          <CardContent>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "var(--wl-space-4)",
              }}
            >
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
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--wl-space-2)" }}>
                      <span>{c.name}</span>
                    </div>
                  ),
                  width: "25%",
                },
                {
                  key: "type",
                  header: "Type",
                  render: (c: Campaign) => (
                    <Badge variant={typeVariant(c.type)} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
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
                    <div style={{ display: "flex", gap: "var(--wl-space-2)", justifyContent: "flex-end" }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicate(c)}
                        style={{ padding: "4px 8px" }}
                      >
                        <Copy size={14} />
                      </Button>
                      {c.status === "SENDING" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePause(c)}
                          style={{ padding: "4px 8px" }}
                        >
                          <Pause size={14} />
                        </Button>
                      )}
                      {c.status === "DRAFT" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(c)}
                          style={{ padding: "4px 8px", color: "var(--wl-danger-400)" }}
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
          <div style={{ display: "flex", gap: "var(--wl-space-3)" }}>
            <Button
              variant="secondary"
              onClick={() => setIsCreateOpen(false)}
              style={{ flex: 1 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCampaign}
              disabled={!newCampaignName.trim()}
              style={{ flex: 1 }}
            >
              Create Campaign
            </Button>
          </div>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--wl-space-4)" }}>
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
