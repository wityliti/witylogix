"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  Calendar,
  Search,
  FileJson,
  Zap,
  Package,
  MapPin,
  UserCheck,
  TrendingUp,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────

interface ActivityLogEntry {
  id: string;
  timestamp: string;
  action: string;
  entityType: string;
  entityId: string;
  actorType: string;
  actorId: string | null;
  actorName?: string;
  changes: Record<string, unknown>;
  ipAddress?: string;
  shipmentId?: string;
}

interface ActivityStats {
  totalEvents: number;
  eventsToday: number;
  uniqueActors: number;
  mostActiveEntity: string;
}

// ─── Mock Data ──────────────────────────────────────────

const generateMockActivityLogs = (): ActivityLogEntry[] => {
  const entityTypes = ["shipment", "order", "location", "driver", "route"];
  const actions = ["CREATE", "UPDATE", "DELETE", "STATUS_CHANGE", "ASSIGN"];
  const actorTypes = ["USER", "SYSTEM", "WEBHOOK", "API", "CRON"];
  const actorNames: Record<string, string> = {
    "user-001": "Sarah Chen",
    "user-002": "Marcus Johnson",
    "user-003": "Emily Rodriguez",
    "system-001": "System Auto",
    "webhook-001": "Shopify Webhook",
  };

  const logs: ActivityLogEntry[] = [];
  const now = new Date();

  for (let i = 0; i < 45; i++) {
    const timestamp = new Date(now.getTime() - i * 2 * 60 * 1000); // Every 2 minutes
    const entityType = entityTypes[Math.floor(Math.random() * entityTypes.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const actorType = actorTypes[Math.floor(Math.random() * actorTypes.length)];

    const actorIdPrefix =
      actorType === "USER"
        ? "user"
        : actorType === "SYSTEM"
          ? "system"
          : "webhook";
    const actorId = `${actorIdPrefix}-${String(Math.floor(Math.random() * 3) + 1).padStart(3, "0")}`;

    const changes = {
      ...(action === "UPDATE" && {
        status: { from: "PENDING", to: "ASSIGNED" },
        updatedAt: timestamp.toISOString(),
      }),
      ...(action === "ASSIGN" && {
        driverId: { from: null, to: "driver-42" },
      }),
      ...(action === "STATUS_CHANGE" && {
        currentStatus: { from: "PENDING", to: "OUT_FOR_DELIVERY" },
      }),
    };

    logs.push({
      id: `activity-${i}`,
      timestamp: timestamp.toISOString(),
      action,
      entityType,
      entityId: `${entityType}-${String(i + 100).padStart(5, "0")}`,
      actorType,
      actorId: actorType === "SYSTEM" || actorType === "WEBHOOK" ? null : actorId,
      actorName:
        actorNames[actorId] ||
        actorNames[`${actorType.toLowerCase()}-001`] ||
        `${actorType} Actor`,
      changes,
      ipAddress:
        actorType === "USER"
          ? `192.168.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`
          : undefined,
      shipmentId:
        entityType === "shipment"
          ? `shipment-${String(Math.floor(Math.random() * 999) + 1).padStart(5, "0")}`
          : undefined,
    });
  }

  return logs.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
};

// ─── Action Badge Color Map ──────────────────────────────

const getActionBadgeVariant = (
  action: string
): "success" | "warning" | "danger" | "info" | "primary" | "default" => {
  const variantMap: Record<string, "success" | "warning" | "danger" | "info" | "primary" | "default"> = {
    CREATE: "success",
    UPDATE: "info",
    DELETE: "danger",
    STATUS_CHANGE: "primary",
    ASSIGN: "warning",
  };
  return variantMap[action] || "default";
};

// ─── Action Icon Component ──────────────────────────────

const ActionIcon = ({ action }: { action: string }) => {
  const iconClass =
    "w-4 h-4 transition-transform duration-300 group-hover:scale-110";
  switch (action) {
    case "CREATE":
      return <Zap className={`${iconClass} text-emerald-500`} />;
    case "UPDATE":
      return <TrendingUp className={`${iconClass} text-blue-500`} />;
    case "DELETE":
      return <FileJson className={`${iconClass} text-red-500`} />;
    case "STATUS_CHANGE":
      return <Package className={`${iconClass} text-purple-500`} />;
    case "ASSIGN":
      return <UserCheck className={`${iconClass} text-orange-500`} />;
    default:
      return <MapPin className={`${iconClass} text-gray-500`} />;
  }
};

// ─── Collapsible Changes Viewer ──────────────────────────

const ChangesViewer = ({ changes }: { changes: Record<string, unknown> }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (Object.keys(changes).length === 0) {
    return (
      <span
        className="text-xs px-2 py-1 rounded"
        style={{ backgroundColor: "var(--wl-bg-surface)", color: "var(--wl-text-muted)" }}
      >
        No changes
      </span>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs font-medium flex items-center gap-1 transition-colors hover:opacity-75"
        style={{ color: "var(--wl-text-secondary)" }}
      >
        {isOpen ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
        {isOpen ? "Hide changes" : `View changes (${Object.keys(changes).length})`}
      </button>
      {isOpen && (
        <pre
          className="text-xs p-3 rounded overflow-x-auto max-h-48 overflow-y-auto wl-animate-in"
          style={{
            backgroundColor: "var(--wl-bg-surface)",
            color: "var(--wl-text-monospace)",
            fontFamily: "var(--wl-font-mono)",
            border: "1px solid var(--wl-border-subtle)",
          }}
        >
          {JSON.stringify(changes, null, 2)}
        </pre>
      )}
    </div>
  );
};

// ─── Entity Icon ────────────────────────────────────────

const EntityIcon = ({ entityType }: { entityType: string }) => {
  const iconMap: Record<string, JSX.Element> = {
    shipment: <Package className="w-4 h-4" />,
    order: <Package className="w-4 h-4" />,
    location: <MapPin className="w-4 h-4" />,
    driver: <UserCheck className="w-4 h-4" />,
    route: <TrendingUp className="w-4 h-4" />,
  };
  return iconMap[entityType] || <FileJson className="w-4 h-4" />;
};

// ─── Filter Bar Component ─────────────────────────────────

interface FilterBarProps {
  entityTypes: string[];
  actions: string[];
  selectedEntityType: string;
  selectedAction: string;
  searchQuery: string;
  dateRange: { from: string; to: string };
  onEntityTypeChange: (type: string) => void;
  onActionChange: (action: string) => void;
  onSearchChange: (query: string) => void;
  onDateRangeChange: (from: string, to: string) => void;
}

const FilterBar = ({
  entityTypes,
  actions,
  selectedEntityType,
  selectedAction,
  searchQuery,
  dateRange,
  onEntityTypeChange,
  onActionChange,
  onSearchChange,
  onDateRangeChange,
}: FilterBarProps) => {
  return (
    <div
      className="p-4 rounded-lg space-y-3 mb-6 wl-animate-in"
      style={{
        backgroundColor: "var(--wl-bg-surface)",
        border: "1px solid var(--wl-border-subtle)",
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Entity Type Filter */}
        <div className="flex flex-col gap-1">
          <label
            className="text-xs font-semibold"
            style={{ color: "var(--wl-text-secondary)" }}
          >
            Entity Type
          </label>
          <select
            value={selectedEntityType}
            onChange={(e) => onEntityTypeChange(e.target.value)}
            className="text-sm px-3 py-2 rounded border transition-all focus:outline-none"
            style={{
              backgroundColor: "var(--wl-bg-base)",
              borderColor: "var(--wl-border-subtle)",
              color: "var(--wl-text-primary)",
            }}
          >
            <option value="">All Types</option>
            {entityTypes.map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Action Filter */}
        <div className="flex flex-col gap-1">
          <label
            className="text-xs font-semibold"
            style={{ color: "var(--wl-text-secondary)" }}
          >
            Action
          </label>
          <select
            value={selectedAction}
            onChange={(e) => onActionChange(e.target.value)}
            className="text-sm px-3 py-2 rounded border transition-all focus:outline-none"
            style={{
              backgroundColor: "var(--wl-bg-base)",
              borderColor: "var(--wl-border-subtle)",
              color: "var(--wl-text-primary)",
            }}
          >
            <option value="">All Actions</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>

        {/* Date From */}
        <div className="flex flex-col gap-1">
          <label
            className="text-xs font-semibold"
            style={{ color: "var(--wl-text-secondary)" }}
          >
            From Date
          </label>
          <input
            type="datetime-local"
            value={dateRange.from}
            onChange={(e) => onDateRangeChange(e.target.value, dateRange.to)}
            className="text-sm px-3 py-2 rounded border transition-all focus:outline-none"
            style={{
              backgroundColor: "var(--wl-bg-base)",
              borderColor: "var(--wl-border-subtle)",
              color: "var(--wl-text-primary)",
            }}
          />
        </div>

        {/* Date To */}
        <div className="flex flex-col gap-1">
          <label
            className="text-xs font-semibold"
            style={{ color: "var(--wl-text-secondary)" }}
          >
            To Date
          </label>
          <input
            type="datetime-local"
            value={dateRange.to}
            onChange={(e) => onDateRangeChange(dateRange.from, e.target.value)}
            className="text-sm px-3 py-2 rounded border transition-all focus:outline-none"
            style={{
              backgroundColor: "var(--wl-bg-base)",
              borderColor: "var(--wl-border-subtle)",
              color: "var(--wl-text-primary)",
            }}
          />
        </div>

        {/* Search */}
        <div className="flex flex-col gap-1">
          <label
            className="text-xs font-semibold"
            style={{ color: "var(--wl-text-secondary)" }}
          >
            Search Entity ID
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded border pr-8 transition-all focus:outline-none"
              style={{
                backgroundColor: "var(--wl-bg-base)",
                borderColor: "var(--wl-border-subtle)",
                color: "var(--wl-text-primary)",
              }}
            />
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Stats Cards Component ──────────────────────────────

interface StatsCardsProps {
  stats: ActivityStats;
  totalActors: number;
}

const StatsCards = ({ stats, totalActors }: StatsCardsProps) => {
  const cardData = [
    {
      title: "Total Events",
      value: stats.totalEvents.toLocaleString(),
      icon: Zap,
      color: "var(--wl-brand-primary)",
    },
    {
      title: "Events Today",
      value: stats.eventsToday,
      icon: TrendingUp,
      color: "var(--wl-success)",
    },
    {
      title: "Unique Actors",
      value: totalActors,
      icon: UserCheck,
      color: "var(--wl-warning)",
    },
    {
      title: "Most Active Entity",
      value: stats.mostActiveEntity || "N/A",
      icon: Package,
      color: "var(--wl-info)",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cardData.map((card, idx) => {
        const Icon = card.icon;
        return (
          <Card
            key={idx}
            style={{
              animationDelay: `${idx * 50}ms`,
              backgroundColor: "var(--wl-bg-surface)",
              borderColor: "var(--wl-border-subtle)",
              animation: "wl-animate-in",
              transition: "all",
            }}
          >
            <CardHeader style={{ paddingBottom: "0.75rem" }}>
              <div className="flex items-start justify-between">
                <div>
                  <p
                    className="text-xs font-medium mb-1"
                    style={{ color: "var(--wl-text-secondary)" }}
                  >
                    {card.title}
                  </p>
                  <p
                    className="text-2xl font-bold"
                    style={{ color: card.color }}
                  >
                    {card.value}
                  </p>
                </div>
                <div
                  className="p-2 rounded-lg opacity-20"
                  style={{ backgroundColor: card.color }}
                >
                  <Icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
              </div>
            </CardHeader>
          </Card>
        );
      })}
    </div>
  );
};

// ─── Activity Timeline Component ─────────────────────────

interface TimelineProps {
  logs: ActivityLogEntry[];
}

const ActivityTimeline = ({ logs }: TimelineProps) => {
  return (
    <div className="space-y-0">
      {logs.map((log, idx) => (
        <div
          key={log.id}
          className="wl-animate-in group transition-all duration-200 hover:opacity-100"
          style={{
            animationDelay: `${idx * 30}ms`,
            opacity: 0.9,
          }}
        >
          <div
            className="p-4 border-l-4 pl-6 relative"
            style={{
              backgroundColor: "var(--wl-bg-surface)",
              borderLeftColor: getActionBadgeVariant(log.action).includes("danger")
                ? "var(--wl-danger)"
                : getActionBadgeVariant(log.action).includes("success")
                  ? "var(--wl-success)"
                  : getActionBadgeVariant(log.action).includes("warning")
                    ? "var(--wl-warning)"
                    : "var(--wl-brand-primary)",
              borderBottom: "1px solid var(--wl-border-subtle)",
            }}
          >
            {/* Timeline dot */}
            <div
              className="absolute -left-3.5 top-5 w-7 h-7 rounded-full flex items-center justify-center transition-all group-hover:scale-125 group-hover:shadow-lg"
              style={{
                backgroundColor: "var(--wl-bg-base)",
                border: "2px solid var(--wl-border-subtle)",
              }}
            >
              <ActionIcon action={log.action} />
            </div>

            {/* Content */}
            <div className="space-y-3">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  {/* Timestamp */}
                  <time
                    dateTime={log.timestamp}
                    className="text-xs font-mono"
                    style={{
                      color: "var(--wl-text-secondary)",
                      fontFamily: "var(--wl-font-mono)",
                    }}
                  >
                    {new Date(log.timestamp).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </time>

                  {/* Action Badge */}
                  <Badge variant={getActionBadgeVariant(log.action)}>
                    {log.action}
                  </Badge>
                </div>

                {/* Entity Type Badge */}
                <Badge
                  variant="default"
                  style={{
                    backgroundColor: "var(--wl-bg-base)",
                    color: "var(--wl-text-primary)",
                    border: "1px solid var(--wl-border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    fontSize: "0.75rem",
                  }}
                >
                  <EntityIcon entityType={log.entityType} />
                  {log.entityType.charAt(0).toUpperCase() + log.entityType.slice(1)}
                </Badge>
              </div>

              {/* Entity ID and Actor Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <p
                    className="text-xs font-semibold mb-1"
                    style={{ color: "var(--wl-text-secondary)" }}
                  >
                    Entity ID
                  </p>
                  <code
                    className="text-xs px-2 py-1 rounded inline-block"
                    style={{
                      backgroundColor: "var(--wl-bg-base)",
                      color: "var(--wl-text-monospace)",
                      fontFamily: "var(--wl-font-mono)",
                      border: "1px solid var(--wl-border-subtle)",
                    }}
                  >
                    {log.entityId}
                  </code>
                </div>

                <div>
                  <p
                    className="text-xs font-semibold mb-1"
                    style={{ color: "var(--wl-text-secondary)" }}
                  >
                    Actor
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="default"
                      style={{
                        backgroundColor: "var(--wl-bg-base)",
                        color: "var(--wl-text-primary)",
                        border: "1px solid var(--wl-border-subtle)",
                        fontSize: "0.75rem",
                      }}
                    >
                      {log.actorType}
                    </Badge>
                    {log.actorName && (
                      <span
                        className="text-xs"
                        style={{ color: "var(--wl-text-secondary)" }}
                      >
                        {log.actorName}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <p
                    className="text-xs font-semibold mb-1"
                    style={{ color: "var(--wl-text-secondary)" }}
                  >
                    IP Address
                  </p>
                  <code
                    className="text-xs"
                    style={{
                      color: "var(--wl-text-monospace)",
                      fontFamily: "var(--wl-font-mono)",
                    }}
                  >
                    {log.ipAddress || "—"}
                  </code>
                </div>
              </div>

              {/* Changes Viewer */}
              <div className="pt-2 border-t" style={{ borderColor: "var(--wl-border-subtle)" }}>
                <ChangesViewer changes={log.changes} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Main Page Component ────────────────────────────────

export default function ActivityLogPage() {
  const [selectedEntityType, setSelectedEntityType] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

  // Generate mock logs
  const allLogs = useMemo(() => generateMockActivityLogs(), []);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      const matchesEntityType =
        !selectedEntityType || log.entityType === selectedEntityType;
      const matchesAction =
        !selectedAction || log.action === selectedAction;
      const matchesSearch =
        !searchQuery || log.entityId.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesEntityType && matchesAction && matchesSearch;
    });
  }, [allLogs, selectedEntityType, selectedAction, searchQuery]);

  // Calculate stats
  const stats: ActivityStats = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const uniqueActors = new Set(
      allLogs.map((log) => log.actorId || log.actorType)
    ).size;

    const entityTypeCounts = allLogs.reduce(
      (acc, log) => {
        acc[log.entityType] = (acc[log.entityType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const mostActiveEntity = Object.entries(entityTypeCounts).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0];

    return {
      totalEvents: allLogs.length,
      eventsToday: allLogs.filter(
        (log) => new Date(log.timestamp) >= startOfDay
      ).length,
      uniqueActors,
      mostActiveEntity: mostActiveEntity || "N/A",
    };
  }, [allLogs]);

  const uniqueEntityTypes = [
    ...new Set(allLogs.map((log) => log.entityType)),
  ];
  const uniqueActions = [...new Set(allLogs.map((log) => log.action))];
  const uniqueActors = new Set(
    allLogs.map((log) => log.actorId || log.actorType)
  ).size;

  return (
    <div style={{ backgroundColor: "var(--wl-bg-base)" }}>
      <Header title="Activity Logs" subtitle="Complete audit trail of all system events" />

      <main className="flex-1 p-6 max-w-7xl mx-auto">
        {/* Stats Cards */}
        <StatsCards stats={stats} totalActors={uniqueActors} />

        {/* Filter Bar */}
        <FilterBar
          entityTypes={uniqueEntityTypes}
          actions={uniqueActions}
          selectedEntityType={selectedEntityType}
          selectedAction={selectedAction}
          searchQuery={searchQuery}
          dateRange={dateRange}
          onEntityTypeChange={setSelectedEntityType}
          onActionChange={setSelectedAction}
          onSearchChange={setSearchQuery}
          onDateRangeChange={(from, to) => setDateRange({ from, to })}
        />

        {/* Activity Count Info */}
        <div
          className="mb-4 p-3 rounded-lg text-sm"
          style={{
            backgroundColor: "var(--wl-bg-surface)",
            color: "var(--wl-text-secondary)",
            border: "1px solid var(--wl-border-subtle)",
          }}
        >
          Showing {filteredLogs.length} of {allLogs.length} activity logs
          {selectedEntityType && ` in ${selectedEntityType}`}
          {selectedAction && ` with action ${selectedAction}`}
        </div>

        {/* Activity Timeline */}
        <Card
          style={{
            backgroundColor: "transparent",
            border: "none",
            boxShadow: "none",
          }}
        >
          {filteredLogs.length > 0 ? (
            <ActivityTimeline logs={filteredLogs} />
          ) : (
            <div
              className="p-12 text-center rounded-lg"
              style={{
                backgroundColor: "var(--wl-bg-surface)",
                border: "1px solid var(--wl-border-subtle)",
              }}
            >
              <FileJson
                className="w-12 h-12 mx-auto mb-3 opacity-30"
                style={{ color: "var(--wl-text-secondary)" }}
              />
              <p
                className="font-medium mb-1"
                style={{ color: "var(--wl-text-primary)" }}
              >
                No activity logs found
              </p>
              <p
                className="text-sm"
                style={{ color: "var(--wl-text-secondary)" }}
              >
                Try adjusting your filters to see more activity
              </p>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
