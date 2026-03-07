"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import {
import { cn } from "@/lib/utils";
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
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        className="gap-4",
        marginBottom: "var(--wl-space-6)",
      }}
    >
      {[
        { label: "Events Today", value: logsToday.toString(), icon: TrendingUp, color: "#10b981" },
        { label: "Total Events", value: logs.length.toString(), icon: Zap, color: "#6366f1" },
        { label: "Most Active", value: mostActiveActor?.[0] || "N/A", icon: UserCheck, color: "#8b5cf6" },
        { label: "Most Changed", value: mostChangedEntity?.[0] || "N/A", icon: Package, color: "#f59e0b" },
      ].map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <Card
            key={idx}
            style={{
              className="bg-wl-bg-surface",
              borderColor: "var(--wl-border-subtle)",
              animation: `fadeInUp 0.4s ease-out ${idx * 50}ms both`,
            }}
          >
            <CardContent style={{ className="p-4", display: "flex", className="gap-3", alignItems: "flex-start" }}>
              <div
                style={{
                  className="p-2",
                  borderRadius: "var(--wl-radius-md)",
                  backgroundColor: stat.color + "15",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon style={{ color: stat.color, width: "20px", height: "20px" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ className="text-wl-text-secondary", fontSize: "var(--wl-text-xs)", fontWeight: 600, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {stat.label}
                </p>
                <p
                  style={{
                    className="text-wl-text-primary",
                    fontSize: "var(--wl-text-lg)",
                    fontWeight: 700,
                    margin: "var(--wl-space-1) 0 0 0",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
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
    <Card
      style={{
        className="bg-wl-bg-surface",
        borderColor: "var(--wl-border-subtle)",
        marginBottom: "var(--wl-space-6)",
      }}
    >
      <CardContent style={{ className="p-4" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            className="gap-3",
          }}
        >
          <div>
            <label style={{ display: "block", fontSize: "var(--wl-text-xs)", fontWeight: 600, className="text-wl-text-secondary", marginBottom: "var(--wl-space-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Entity Type
            </label>
            <select
              value={filters.entityType}
              onChange={(e) => handleChange("entityType", e.target.value)}
              style={{
                width: "100%",
                padding: "var(--wl-space-2) var(--wl-space-3)",
                backgroundColor: "var(--wl-bg-base)",
                className="text-wl-text-primary",
                border: "1px solid var(--wl-border-subtle)",
                borderRadius: "var(--wl-radius-md)",
                fontSize: "var(--wl-text-sm)",
                cursor: "pointer",
              }}
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
            <label style={{ display: "block", fontSize: "var(--wl-text-xs)", fontWeight: 600, className="text-wl-text-secondary", marginBottom: "var(--wl-space-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Action Type
            </label>
            <select
              value={filters.actionType}
              onChange={(e) => handleChange("actionType", e.target.value)}
              style={{
                width: "100%",
                padding: "var(--wl-space-2) var(--wl-space-3)",
                backgroundColor: "var(--wl-bg-base)",
                className="text-wl-text-primary",
                border: "1px solid var(--wl-border-subtle)",
                borderRadius: "var(--wl-radius-md)",
                fontSize: "var(--wl-text-sm)",
                cursor: "pointer",
              }}
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
            <label style={{ display: "block", fontSize: "var(--wl-text-xs)", fontWeight: 600, className="text-wl-text-secondary", marginBottom: "var(--wl-space-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              From Date
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleChange("dateFrom", e.target.value)}
              style={{
                width: "100%",
                padding: "var(--wl-space-2) var(--wl-space-3)",
                backgroundColor: "var(--wl-bg-base)",
                className="text-wl-text-primary",
                border: "1px solid var(--wl-border-subtle)",
                borderRadius: "var(--wl-radius-md)",
                fontSize: "var(--wl-text-sm)",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "var(--wl-text-xs)", fontWeight: 600, className="text-wl-text-secondary", marginBottom: "var(--wl-space-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              To Date
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleChange("dateTo", e.target.value)}
              style={{
                width: "100%",
                padding: "var(--wl-space-2) var(--wl-space-3)",
                backgroundColor: "var(--wl-bg-base)",
                className="text-wl-text-primary",
                border: "1px solid var(--wl-border-subtle)",
                borderRadius: "var(--wl-radius-md)",
                fontSize: "var(--wl-text-sm)",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "var(--wl-text-xs)", fontWeight: 600, className="text-wl-text-secondary", marginBottom: "var(--wl-space-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Search
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Entity ID..."
                value={filters.search}
                onChange={(e) => handleChange("search", e.target.value)}
                style={{
                  width: "100%",
                  padding: "var(--wl-space-2) var(--wl-space-3) var(--wl-space-2) var(--wl-space-8)",
                  backgroundColor: "var(--wl-bg-base)",
                  className="text-wl-text-primary",
                  border: "1px solid var(--wl-border-subtle)",
                  borderRadius: "var(--wl-radius-md)",
                  fontSize: "var(--wl-text-sm)",
                }}
              />
              <Search style={{ position: "absolute", left: "var(--wl-space-2)", top: "50%", transform: "translateY(-50%)", width: "16px", height: "16px", className="text-wl-text-secondary", pointerEvents: "none" }} />
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {logs.map((log, idx) => (
        <div
          key={log.id}
          style={{
            borderLeft: `3px solid ${getActionColor(log.actionType)}`,
            backgroundColor: idx % 2 === 0 ? "var(--wl-bg-base)" : "var(--wl-bg-surface)",
            className="p-4",
            cursor: "pointer",
            transition: "all 0.2s",
            borderBottom: "1px solid var(--wl-border-subtle)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--wl-bg-surface)";
            (e.currentTarget as HTMLDivElement).style.transform = "translateX(4px)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.backgroundColor = idx % 2 === 0 ? "var(--wl-bg-base)" : "var(--wl-bg-surface)";
            (e.currentTarget as HTMLDivElement).style.transform = "translateX(0)";
          }}
        >
          <div style={{ display: "flex", className="gap-3", alignItems: "flex-start" }}>
            <div
              style={{
                className="p-2",
                borderRadius: "var(--wl-radius-md)",
                backgroundColor: getActionColor(log.actionType) + "15",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: "2px",
              }}
            >
              {getActionIcon(log.actionType)}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", className="gap-2", flexWrap: "wrap" }}>
                <span style={{ fontSize: "var(--wl-text-sm)", fontWeight: 700, className="text-wl-text-primary" }}>
                  {log.action}
                </span>
                <span style={{ fontSize: "var(--wl-text-xs)", className="text-wl-text-secondary" }}>
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
                  style={{ fontSize: "var(--wl-text-xs)" }}
                >
                  {log.status}
                </Badge>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", className="gap-3", marginTop: "var(--wl-space-2)", fontSize: "var(--wl-text-xs)" }}>
                <div>
                  <span style={{ className="text-wl-text-secondary", display: "block", marginBottom: "2px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Entity
                  </span>
                  <code
                    style={{
                      backgroundColor: "var(--wl-bg-base)",
                      padding: "2px 6px",
                      borderRadius: "var(--wl-radius-sm)",
                      color: "var(--wl-brand-primary)",
                      fontFamily: "JetBrains Mono, monospace",
                      cursor: "pointer",
                    }}
                  >
                    {log.entityId}
                  </code>
                  {log.entityName && <p style={{ className="text-wl-text-secondary", margin: "2px 0 0 0" }}>{log.entityName}</p>}
                </div>

                <div>
                  <span style={{ className="text-wl-text-secondary", display: "block", marginBottom: "2px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Type
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    {getEntityIcon(log.entityType)}
                    <span style={{ className="text-wl-text-primary", fontWeight: 500 }}>
                      {log.entityType.charAt(0).toUpperCase() + log.entityType.slice(1)}
                    </span>
                  </div>
                </div>

                <div>
                  <span style={{ className="text-wl-text-secondary", display: "block", marginBottom: "2px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Actor
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    {log.actorType === "user" ? <User style={{ width: "14px", height: "14px" }} /> : <Settings style={{ width: "14px", height: "14px" }} />}
                    <span style={{ className="text-wl-text-primary" }}>{log.actorName}</span>
                  </div>
                </div>

                {log.ipAddress && (
                  <div>
                    <span style={{ className="text-wl-text-secondary", display: "block", marginBottom: "2px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      IP
                    </span>
                    <code style={{ className="text-wl-text-secondary", fontFamily: "JetBrains Mono, monospace" }}>
                      {log.ipAddress}
                    </code>
                  </div>
                )}
              </div>

              {Object.keys(log.changes).length > 0 && (
                <button
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  style={{
                    marginTop: "var(--wl-space-3)",
                    background: "transparent",
                    border: "none",
                    color: "var(--wl-brand-primary)",
                    fontSize: "var(--wl-text-xs)",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: 0,
                  }}
                >
                  {expandedId === log.id ? <ChevronUp style={{ width: "14px", height: "14px" }} /> : <ChevronDown style={{ width: "14px", height: "14px" }} />}
                  {expandedId === log.id ? "Hide" : "View"} Changes ({Object.keys(log.changes).length})
                </button>
              )}

              {expandedId === log.id && (
                <pre
                  style={{
                    marginTop: "var(--wl-space-3)",
                    backgroundColor: "var(--wl-bg-base)",
                    className="p-3",
                    borderRadius: "var(--wl-radius-md)",
                    fontSize: "var(--wl-text-xs)",
                    overflow: "auto",
                    maxHeight: "200px",
                    color: "var(--wl-text-monospace)",
                    fontFamily: "JetBrains Mono, monospace",
                    border: "1px solid var(--wl-border-subtle)",
                    margin: "var(--wl-space-3) 0 0 0",
                  }}
                >
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
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "var(--wl-text-sm)",
        }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid var(--wl-border-subtle)", className="bg-wl-bg-surface" }}>
            {["Timestamp", "Action", "Entity", "Type", "Actor", "Status"].map((header) => (
              <th
                key={header}
                style={{
                  className="p-3",
                  textAlign: "left",
                  className="text-wl-text-secondary",
                  fontWeight: 600,
                  fontSize: "var(--wl-text-xs)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
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
              style={{
                borderBottom: "1px solid var(--wl-border-subtle)",
                backgroundColor: idx % 2 === 0 ? "var(--wl-bg-base)" : "var(--wl-bg-surface)",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLTableRowElement).style.backgroundColor = "var(--wl-bg-surface)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLTableRowElement).style.backgroundColor = idx % 2 === 0 ? "var(--wl-bg-base)" : "var(--wl-bg-surface)";
              }}
            >
              <td style={{ className="p-3", className="text-wl-text-secondary", fontSize: "var(--wl-text-xs)" }}>
                {new Date(log.timestamp).toLocaleDateString()}{" "}
                <span style={{ className="text-wl-text-secondary" }}>
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </td>
              <td style={{ className="p-3" }}>
                <Badge variant="default" style={{ backgroundColor: getActionColor(log.actionType) + "20", color: getActionColor(log.actionType), fontSize: "var(--wl-text-xs)" }}>
                  {log.action}
                </Badge>
              </td>
              <td style={{ className="p-3", className="text-wl-text-primary", fontWeight: 500 }}>
                <code style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "var(--wl-text-xs)" }}>
                  {log.entityId}
                </code>
                {log.entityName && <p style={{ className="text-wl-text-secondary", margin: "2px 0 0 0", fontSize: "var(--wl-text-xs)" }}>{log.entityName}</p>}
              </td>
              <td style={{ className="p-3", className="text-wl-text-primary" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  {getEntityIcon(log.entityType)}
                  <span style={{ fontSize: "var(--wl-text-xs)", fontWeight: 500 }}>
                    {log.entityType.charAt(0).toUpperCase() + log.entityType.slice(1)}
                  </span>
                </div>
              </td>
              <td style={{ className="p-3", className="text-wl-text-secondary", fontSize: "var(--wl-text-xs)" }}>
                {log.actorName}
              </td>
              <td style={{ className="p-3" }}>
                <Badge
                  variant={log.status === "success" ? "success" : log.status === "error" ? "danger" : "info"}
                  style={{ fontSize: "var(--wl-text-xs)" }}
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
    <div style={{ backgroundColor: "var(--wl-bg-base)" }}>
      <Header
        title="Activity Log"
        subtitle="Complete audit trail of all system events"
        actions={
          <Button variant="primary" size="sm" onClick={handleExport}>
            <Download style={{ width: "14px", height: "14px", marginRight: "4px" }} />
            Export CSV
          </Button>
        }
      />

      <main style={{ flex: 1, className="p-6", maxWidth: "1400px", margin: "0 auto" }}>
        <StatsBar logs={allLogs} />

        <FilterBar onFilterChange={setFilters} />

        <Card
          style={{
            backgroundColor: "transparent",
            border: "none",
            boxShadow: "none",
            marginBottom: "var(--wl-space-6)",
          }}
        >
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

        <Card
          style={{
            className="bg-wl-bg-surface",
            borderColor: "var(--wl-border-subtle)",
          }}
        >
          {filteredLogs.length > 0 ? (
            <>
              <div
                style={{
                  padding: "var(--wl-space-3) var(--wl-space-4)",
                  borderBottom: "1px solid var(--wl-border-subtle)",
                  fontSize: "var(--wl-text-xs)",
                  className="text-wl-text-secondary",
                }}
              >
                Showing {filteredLogs.length} of {allLogs.length} events
              </div>
              <CardContent style={{ padding: 0 }}>
                {viewMode === "timeline" ? <TimelineView logs={filteredLogs} /> : <TableView logs={filteredLogs} />}
              </CardContent>
            </>
          ) : (
            <CardContent
              style={{
                className="p-12",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileJson style={{ width: "48px", height: "48px", className="text-wl-text-secondary", marginBottom: "var(--wl-space-3)", opacity: 0.3 }} />
              <p style={{ className="text-wl-text-primary", fontWeight: 500, margin: 0, marginBottom: "4px" }}>
                No activity logs found
              </p>
              <p style={{ className="text-wl-text-secondary", fontSize: "var(--wl-text-sm)", margin: 0 }}>
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
      `}</style>
    </div>
  );
}
