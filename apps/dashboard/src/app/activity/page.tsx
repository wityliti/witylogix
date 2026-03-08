"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  Calendar,
  Search,
  FileJson,
  Download,
  Zap,
  Package,
  MapPin,
  UserCheck,
  TrendingUp,
  Settings,
  User,
  Lock,
  AlertCircle,
  Copy,
} from "lucide-react";

// Types
interface ActivityLogEntry {
  id: string;
  timestamp: string;
  action: string;
  actionType: "create" | "update" | "delete" | "login" | "export";
  entityType: string;
  entityId: string;
  entityName?: string;
  actorType: "user" | "system" | "webhook" | "api";
  actorId: string | null;
  actorName?: string;
  changes: Record<string, { from?: unknown; to?: unknown }>;
  ipAddress?: string;
  status: "success" | "error" | "pending";
}

// Mock data generator
const generateMockActivityLogs = (): ActivityLogEntry[] => {
  const entityTypes = ["order", "shipment", "driver", "route", "zone", "user", "shop", "setting"];
  const actions = ["Create", "Update", "Delete", "Login", "Export", "StatusChange", "Assign"];
  const actionTypeMap: Record<string, ActivityLogEntry["actionType"]> = {
    Create: "create",
    Update: "update",
    Delete: "delete",
    Login: "login",
    Export: "export",
    StatusChange: "update",
    Assign: "update",
  };
  const actorTypes: Array<"user" | "system" | "webhook" | "api"> = ["user", "system", "webhook", "api"];
  const actorNames: Record<string, string> = {
    "user-001": "Sarah Chen",
    "user-002": "Marcus Johnson",
    "user-003": "Emily Rodriguez",
    "user-004": "David Park",
    "system-001": "System Auto",
    "webhook-001": "Shopify Webhook",
    "api-001": "REST API Client",
  };

  const logs: ActivityLogEntry[] = [];
  const now = new Date();

  for (let i = 0; i < 60; i++) {
    const timestamp = new Date(now.getTime() - i * 3 * 60 * 1000);
    const entityType = entityTypes[Math.floor(Math.random() * entityTypes.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const actionType = actionTypeMap[action] || "update";
    const actorType = actorTypes[Math.floor(Math.random() * actorTypes.length)];

    const actorIdPrefix =
      actorType === "user" ? "user" : actorType === "system" ? "system" : actorType === "webhook" ? "webhook" : "api";
    const actorId = actorType === "user" ? `${actorIdPrefix}-${String(Math.floor(Math.random() * 4) + 1).padStart(3, "0")}` : null;

    const changes =
      actionType === "update"
        ? {
            status: { from: "PENDING", to: "IN_TRANSIT" },
            lastUpdated: { to: timestamp.toISOString() },
          }
        : {};

    logs.push({
      id: `activity-${i}`,
      timestamp: timestamp.toISOString(),
      action,
      actionType,
      entityType,
      entityId: `${entityType}-${String(i + 1000).padStart(5, "0")}`,
      entityName: `${entityType === "order" ? "Order" : entityType === "shipment" ? "Shipment" : entityType === "driver" ? "Driver" : "Item"} #${Math.floor(Math.random() * 9000) + 1000}`,
      actorType,
      actorId,
      actorName: actorId ? actorNames[actorId] || `${actorType} Actor` : `${actorType === "system" ? "System" : "Webhook"} Process`,
      changes,
      ipAddress: actorType === "user" ? `192.168.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}` : undefined,
      status: Math.random() > 0.05 ? "success" : Math.random() > 0.5 ? "error" : "pending",
    });
  }

  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

// Helper functions
const getActionColor = (actionType: ActivityLogEntry["actionType"]): string => {
  switch (actionType) {
    case "create":
      return "#10b981";
    case "update":
      return "#3b82f6";
    case "delete":
      return "#ef4444";
    case "login":
      return "#8b5cf6";
    case "export":
      return "#f59e0b";
    default:
      return "#6b7280";
  }
};

const getActionIcon = (actionType: ActivityLogEntry["actionType"]) => {
  switch (actionType) {
    case "create":
      return <Zap className="w-4 h-4" />;
    case "update":
      return <TrendingUp className="w-4 h-4" />;
    case "delete":
      return <AlertCircle className="w-4 h-4" />;
    case "login":
      return <Lock className="w-4 h-4" />;
    case "export":
      return <Download className="w-4 h-4" />;
    default:
      return <FileJson className="w-4 h-4" />;
  }
};

const getEntityIcon = (entityType: string) => {
  switch (entityType) {
    case "order":
    case "shipment":
      return <Package className="w-4 h-4" />;
    case "route":
    case "zone":
      return <MapPin className="w-4 h-4" />;
    case "driver":
    case "user":
      return <UserCheck className="w-4 h-4" />;
    case "setting":
      return <Settings className="w-4 h-4" />;
    default:
      return <FileJson className="w-4 h-4" />;
  }
};

// Stats Cards
const StatsBar = ({ logs }: { logs: ActivityLogEntry[] }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const logsToday = logs.filter((l) => new Date(l.timestamp) >= today).length;

  const actorCounts: Record<string, number> = {};
  logs.forEach((l) => {
    const actor = l.actorName || "Unknown";
    actorCounts[actor] = (actorCounts[actor] || 0) + 1;
  });
  const mostActiveActor = Object.entries(actorCounts).sort((a, b) => b[1] - a[1])[0];

  const entityCounts: Record<string, number> = {};
  logs.forEach((l) => {
    entityCounts[l.entityType] = (entityCounts[l.entityType] || 0) + 1;
  });
  const mostChangedEntity = Object.entries(entityCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-fadeInUp">
      {[
        { label: "Events Today", value: logsToday.toString(), icon: TrendingUp, color: "#10b981" },
        { label: "Total Events", value: logs.length.toString(), icon: Zap, color: "#6366f1" },
        { label: "Most Active", value: mostActiveActor?.[0] || "N/A", icon: UserCheck, color: "#8b5cf6" },
        { label: "Most Changed", value: mostChangedEntity?.[0] || "N/A", icon: Package, color: "#f59e0b" },
      ].map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <Card key={idx} className="bg-wl-bg-surface border border-wl-border">
            <CardContent className="p-4 flex gap-3 items-start">
              <div
                className="p-2 rounded flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: stat.color + "15" }}
              >
                <Icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-wl-text-secondary text-xs font-semibold uppercase tracking-wide">
                  {stat.label}
                </p>
                <p className="text-wl-text-primary text-lg font-bold mt-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {stat.value}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

// Filter Bar
const FilterBar = ({
  onFilterChange,
}: {
  onFilterChange: (filters: {
    entityType: string;
    actionType: string;
    actor: string;
    dateFrom: string;
    dateTo: string;
    search: string;
  }) => void;
}) => {
  const [filters, setFilters] = useState({
    entityType: "",
    actionType: "",
    actor: "",
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    dateTo: new Date().toISOString().split("T")[0],
    search: "",
  });

  const handleChange = (key: string, value: string) => {
    const updated = { ...filters, [key]: value };
    setFilters(updated);
    onFilterChange(updated);
  };

  return (
    <Card className="bg-wl-bg-surface border border-wl-border mb-6">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-wl-text-secondary text-xs font-semibold uppercase tracking-wide mb-2">
              Entity Type
            </label>
            <select
              value={filters.entityType}
              onChange={(e) => handleChange("entityType", e.target.value)}
              className="w-full px-3 py-2 bg-wl-bg-base text-wl-text-primary border border-wl-border-subtle rounded text-sm cursor-pointer"
            >
              <option value="">All Types</option>
              <option value="order">Order</option>
              <option value="shipment">Shipment</option>
              <option value="driver">Driver</option>
              <option value="route">Route</option>
              <option value="zone">Zone</option>
              <option value="user">User</option>
              <option value="shop">Shop</option>
              <option value="setting">Setting</option>
            </select>
          </div>

          <div>
            <label className="block text-wl-text-secondary text-xs font-semibold uppercase tracking-wide mb-2">
              Action Type
            </label>
            <select
              value={filters.actionType}
              onChange={(e) => handleChange("actionType", e.target.value)}
              className="w-full px-3 py-2 bg-wl-bg-base text-wl-text-primary border border-wl-border-subtle rounded text-sm cursor-pointer"
            >
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="login">Login</option>
              <option value="export">Export</option>
            </select>
          </div>

          <div>
            <label className="block text-wl-text-secondary text-xs font-semibold uppercase tracking-wide mb-2">
              From Date
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleChange("dateFrom", e.target.value)}
              className="w-full px-3 py-2 bg-wl-bg-base text-wl-text-primary border border-wl-border-subtle rounded text-sm"
            />
          </div>

          <div>
            <label className="block text-wl-text-secondary text-xs font-semibold uppercase tracking-wide mb-2">
              To Date
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleChange("dateTo", e.target.value)}
              className="w-full px-3 py-2 bg-wl-bg-base text-wl-text-primary border border-wl-border-subtle rounded text-sm"
            />
          </div>

          <div className="md:col-span-2 lg:col-span-2">
            <label className="block text-wl-text-secondary text-xs font-semibold uppercase tracking-wide mb-2">
              Search
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Entity ID..."
                value={filters.search}
                onChange={(e) => handleChange("search", e.target.value)}
                className="w-full px-3 py-2 bg-wl-bg-base text-wl-text-primary border border-wl-border-subtle rounded text-sm pl-8"
              />
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-wl-text-secondary pointer-events-none" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Timeline View Component
const TimelineView = ({ logs }: { logs: ActivityLogEntry[] }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-0">
      {logs.map((log, idx) => (
        <div
          key={log.id}
          className={cn(
            "cursor-pointer transition-all border-l-2 border-b border-wl-border-subtle p-4 hover:bg-wl-bg-surface hover:translate-x-1",
            idx % 2 === 0 ? "bg-wl-bg-base" : "bg-wl-bg-surface"
          )}
          style={{
            borderLeftColor: getActionColor(log.actionType),
          }}
        >
          <div className="flex gap-3 items-start">
            <div
              className="p-2 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ backgroundColor: getActionColor(log.actionType) + "15" }}
            >
              {getActionIcon(log.actionType)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-bold text-wl-text-primary">
                  {log.action}
                </span>
                <span className="text-xs text-wl-text-secondary">
                  {new Date(log.timestamp).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                <Badge
                  variant={log.status === "success" ? "success" : log.status === "error" ? "danger" : "info"}
                  className="text-xs"
                >
                  {log.status}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-2 text-xs">
                <div>
                  <span className="text-wl-text-secondary block mb-1 font-semibold uppercase tracking-wide">
                    Entity
                  </span>
                  <code className="bg-wl-bg-base px-1.5 py-1 rounded text-wl-brand-primary font-mono text-xs cursor-pointer">
                    {log.entityId}
                  </code>
                  {log.entityName && <p className="text-wl-text-secondary mt-1">{log.entityName}</p>}
                </div>

                <div>
                  <span className="text-wl-text-secondary block mb-1 font-semibold uppercase tracking-wide">
                    Type
                  </span>
                  <div className="flex items-center gap-1">
                    {getEntityIcon(log.entityType)}
                    <span className="text-wl-text-primary font-medium">
                      {log.entityType.charAt(0).toUpperCase() + log.entityType.slice(1)}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-wl-text-secondary block mb-1 font-semibold uppercase tracking-wide">
                    Actor
                  </span>
                  <div className="flex items-center gap-1">
                    {log.actorType === "user" ? <User className="w-3.5 h-3.5" /> : <Settings className="w-3.5 h-3.5" />}
                    <span className="text-wl-text-primary">{log.actorName}</span>
                  </div>
                </div>

                {log.ipAddress && (
                  <div>
                    <span className="text-wl-text-secondary block mb-1 font-semibold uppercase tracking-wide">
                      IP
                    </span>
                    <code className="text-wl-text-secondary font-mono">
                      {log.ipAddress}
                    </code>
                  </div>
                )}
              </div>

              {Object.keys(log.changes).length > 0 && (
                <button
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  className="mt-3 bg-transparent border-none text-wl-brand-primary text-xs font-semibold cursor-pointer flex items-center gap-1 p-0 hover:opacity-80"
                >
                  {expandedId === log.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {expandedId === log.id ? "Hide" : "View"} Changes ({Object.keys(log.changes).length})
                </button>
              )}

              {expandedId === log.id && (
                <pre className="mt-3 bg-wl-bg-base p-3 rounded text-xs overflow-auto max-h-56 text-wl-text-monospace font-mono border border-wl-border-subtle">
                  {JSON.stringify(log.changes, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Table View Component
const TableView = ({ logs }: { logs: ActivityLogEntry[] }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-wl-border-subtle bg-wl-bg-surface">
            {["Timestamp", "Action", "Entity", "Type", "Actor", "Status"].map((header) => (
              <th
                key={header}
                className="px-3 py-3 text-left text-wl-text-secondary font-semibold text-xs uppercase tracking-wide"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((log, idx) => (
            <tr
              key={log.id}
              className={cn(
                "border-b border-wl-border-subtle transition-all hover:bg-wl-bg-surface",
                idx % 2 === 0 ? "bg-wl-bg-base" : "bg-wl-bg-surface"
              )}
            >
              <td className="px-3 py-3 text-wl-text-secondary text-xs">
                {new Date(log.timestamp).toLocaleDateString()}{" "}
                <span className="text-wl-text-secondary">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </td>
              <td className="px-3 py-3">
                <Badge variant="default" style={{ backgroundColor: getActionColor(log.actionType) + "20", color: getActionColor(log.actionType) }} className="text-xs">
                  {log.action}
                </Badge>
              </td>
              <td className="px-3 py-3 text-wl-text-primary font-medium">
                <code className="font-mono text-xs">
                  {log.entityId}
                </code>
                {log.entityName && <p className="text-wl-text-secondary mt-1 text-xs">{log.entityName}</p>}
              </td>
              <td className="px-3 py-3 text-wl-text-primary">
                <div className="flex items-center gap-1">
                  {getEntityIcon(log.entityType)}
                  <span className="text-xs font-medium">
                    {log.entityType.charAt(0).toUpperCase() + log.entityType.slice(1)}
                  </span>
                </div>
              </td>
              <td className="px-3 py-3 text-wl-text-secondary text-xs">
                {log.actorName}
              </td>
              <td className="px-3 py-3">
                <Badge
                  variant={log.status === "success" ? "success" : log.status === "error" ? "danger" : "info"}
                  className="text-xs"
                >
                  {log.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Main Page
export default function ActivityLogPage() {
  const [viewMode, setViewMode] = useState<"timeline" | "table">("timeline");
  const [filters, setFilters] = useState({
    entityType: "",
    actionType: "",
    actor: "",
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    dateTo: new Date().toISOString().split("T")[0],
    search: "",
  });

  const allLogs = useMemo(() => generateMockActivityLogs(), []);

  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      const matchesEntityType = !filters.entityType || log.entityType === filters.entityType;
      const matchesActionType = !filters.actionType || log.actionType === filters.actionType;
      const matchesSearch = !filters.search || log.entityId.toLowerCase().includes(filters.search.toLowerCase()) || log.entityName?.toLowerCase().includes(filters.search.toLowerCase());
      const logDate = new Date(log.timestamp).toISOString().split("T")[0];
      const matchesDateRange = logDate >= filters.dateFrom && logDate <= filters.dateTo;

      return matchesEntityType && matchesActionType && matchesSearch && matchesDateRange;
    });
  }, [allLogs, filters]);

  const handleExport = () => {
    const csv = [["Timestamp", "Action", "Entity ID", "Entity Type", "Actor", "Status", "Changes"]];
    filteredLogs.forEach((log) => {
      csv.push([
        new Date(log.timestamp).toISOString(),
        log.action,
        log.entityId,
        log.entityType,
        log.actorName || "N/A",
        log.status,
        JSON.stringify(log.changes),
      ]);
    });
    const csvString = csv.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvString], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <div className="bg-wl-bg-base">
      <Header
        title="Activity Log"
        subtitle="Complete audit trail of all system events"
        actions={
          <Button variant="primary" size="sm" onClick={handleExport}>
            <Download className="w-3.5 h-3.5 mr-1" />
            Export CSV
          </Button>
        }
      />

      <main className="flex-1 p-6 max-w-7xl mx-auto">
        <StatsBar logs={allLogs} />

        <FilterBar onFilterChange={setFilters} />

        <Card className="bg-transparent border-none shadow-none mb-6">
          <Tabs
            tabs={[
              { id: "timeline", label: "Timeline", count: filteredLogs.length },
              { id: "table", label: "Table", count: filteredLogs.length },
            ]}
            activeTab={viewMode}
            onChange={(id) => setViewMode(id as "timeline" | "table")}
            variant="pills"
          />
        </Card>

        <Card className="bg-wl-bg-surface border border-wl-border">
          {filteredLogs.length > 0 ? (
            <>
              <div className="px-4 py-3 border-b border-wl-border-subtle text-xs text-wl-text-secondary">
                Showing {filteredLogs.length} of {allLogs.length} events
              </div>
              <CardContent className="p-0">
                {viewMode === "timeline" ? <TimelineView logs={filteredLogs} /> : <TableView logs={filteredLogs} />}
              </CardContent>
            </>
          ) : (
            <CardContent className="p-12 text-center flex flex-col items-center justify-center">
              <FileJson className="w-12 h-12 text-wl-text-secondary mb-3 opacity-30" />
              <p className="text-wl-text-primary font-medium mb-1">
                No activity logs found
              </p>
              <p className="text-wl-text-secondary text-sm">
                Try adjusting your filters to see more activity
              </p>
            </CardContent>
          )}
        </Card>
      </main>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
