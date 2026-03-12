"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import {
  BarChart3,
  TrendingUp,
  Clock,
  AlertCircle,
  Plus,
  Settings,
  Eye,
  Pause,
  Play,
  Trash2,
  RefreshCw,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   ANALYTICS INTEGRATIONS — Dashboard for analytics providers
   ═══════════════════════════════════════════════════════════ */

type AnalyticsProvider = "tableau" | "powerbi" | "looker" | "qlik" | "ga";
type ConnectionStatus = "CONNECTED" | "DISCONNECTED" | "ERROR" | "AUTHENTICATING";
type ReportFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY";

interface AnalyticsConnection {
  id: string;
  provider: AnalyticsProvider;
  name: string;
  status: ConnectionStatus;
  lastSync: string;
  nextSync: string;
  dashboardCount: number;
  embedCount: number;
  errorMessage?: string;
}

interface ScheduledReport {
  id: string;
  title: string;
  provider: AnalyticsProvider;
  frequency: ReportFrequency;
  nextRun: string;
  lastRun: string;
  status: "ACTIVE" | "PAUSED" | "ERROR";
  recipients: string[];
  format: "PDF" | "EMAIL" | "SCHEDULED_EXPORT";
}

interface QueryMetrics {
  provider: AnalyticsProvider;
  successRate: number;
  avgResponseTime: number;
  queriesRun: number;
  apiCallsUsed: number;
  embedViews: number;
}

interface DataSource {
  id: string;
  name: string;
  provider: AnalyticsProvider;
  type: "DATABASE" | "DATAWAREHOUSE" | "API" | "FILE";
  lastRefresh: string;
  refreshSchedule: string;
  status: "SYNCED" | "SYNCING" | "STALE" | "FAILED";
}

const ANALYTICS_PROVIDERS = [
  {
    slug: "tableau",
    name: "Tableau",
    icon: "📊",
    description: "Visual analytics and business intelligence",
    color: "#1F1F1F",
  },
  {
    slug: "powerbi",
    name: "Power BI",
    icon: "📈",
    description: "Microsoft business analytics platform",
    color: "#FFB900",
  },
  {
    slug: "looker",
    name: "Looker",
    icon: "🔍",
    description: "Modern data exploration platform",
    color: "#4285F4",
  },
  {
    slug: "qlik",
    name: "Qlik Sense",
    icon: "⚡",
    description: "Associative analytics engine",
    color: "#A2D500",
  },
  {
    slug: "ga",
    name: "Google Analytics 4",
    icon: "📍",
    description: "Web and app analytics platform",
    color: "#E37400",
  },
];

const CONNECTIONS: AnalyticsConnection[] = [
  {
    id: "conn-1",
    provider: "tableau",
    name: "Tableau Cloud - Sales Analytics",
    status: "CONNECTED",
    lastSync: "2 minutes ago",
    nextSync: "in 28 minutes",
    dashboardCount: 12,
    embedCount: 8,
  },
  {
    id: "conn-2",
    provider: "powerbi",
    name: "Power BI - Operations Dashboard",
    status: "CONNECTED",
    lastSync: "5 minutes ago",
    nextSync: "in 25 minutes",
    dashboardCount: 15,
    embedCount: 6,
  },
  {
    id: "conn-3",
    provider: "looker",
    name: "Looker - Data Exploration",
    status: "CONNECTED",
    lastSync: "12 minutes ago",
    nextSync: "in 18 minutes",
    dashboardCount: 8,
    embedCount: 4,
  },
  {
    id: "conn-4",
    provider: "qlik",
    name: "Qlik Sense - Regional Analysis",
    status: "ERROR",
    lastSync: "2 hours ago",
    nextSync: "pending",
    dashboardCount: 5,
    embedCount: 2,
    errorMessage: "Authentication token expired",
  },
  {
    id: "conn-5",
    provider: "ga",
    name: "Google Analytics - Web Traffic",
    status: "CONNECTED",
    lastSync: "1 minute ago",
    nextSync: "in 59 minutes",
    dashboardCount: 10,
    embedCount: 12,
  },
];

const SCHEDULED_REPORTS: ScheduledReport[] = [
  {
    id: "rpt-1",
    title: "Weekly Sales Summary",
    provider: "tableau",
    frequency: "WEEKLY",
    nextRun: "Mon, Mar 18 - 09:00 AM",
    lastRun: "Mon, Mar 11 - 09:02 AM",
    status: "ACTIVE",
    recipients: ["sales@company.com", "exec@company.com"],
    format: "PDF",
  },
  {
    id: "rpt-2",
    title: "Daily Operations Report",
    provider: "powerbi",
    frequency: "DAILY",
    nextRun: "Tomorrow - 06:00 AM",
    lastRun: "Today - 06:01 AM",
    status: "ACTIVE",
    recipients: ["ops-team@company.com"],
    format: "EMAIL",
  },
  {
    id: "rpt-3",
    title: "Monthly Performance Analysis",
    provider: "looker",
    frequency: "MONTHLY",
    nextRun: "Apr 1 - 10:00 AM",
    lastRun: "Mar 1 - 10:05 AM",
    status: "ACTIVE",
    recipients: ["leadership@company.com"],
    format: "SCHEDULED_EXPORT",
  },
  {
    id: "rpt-4",
    title: "Quarterly Business Review",
    provider: "qlik",
    frequency: "QUARTERLY",
    nextRun: "Apr 1 - 02:00 PM",
    lastRun: "Jan 1 - 02:15 PM",
    status: "PAUSED",
    recipients: ["exec@company.com", "board@company.com"],
    format: "PDF",
  },
];

const QUERY_METRICS: QueryMetrics[] = [
  {
    provider: "tableau",
    successRate: 99.8,
    avgResponseTime: 245,
    queriesRun: 8420,
    apiCallsUsed: 2840,
    embedViews: 5620,
  },
  {
    provider: "powerbi",
    successRate: 99.5,
    avgResponseTime: 312,
    queriesRun: 6250,
    apiCallsUsed: 2100,
    embedViews: 3240,
  },
  {
    provider: "looker",
    successRate: 99.9,
    avgResponseTime: 198,
    queriesRun: 4120,
    apiCallsUsed: 1850,
    embedViews: 2810,
  },
  {
    provider: "qlik",
    successRate: 92.3,
    avgResponseTime: 450,
    queriesRun: 3200,
    apiCallsUsed: 950,
    embedViews: 1420,
  },
  {
    provider: "ga",
    successRate: 99.9,
    avgResponseTime: 156,
    queriesRun: 12450,
    apiCallsUsed: 3620,
    embedViews: 8940,
  },
];

const DATA_SOURCES: DataSource[] = [
  {
    id: "ds-1",
    name: "Sales Data Warehouse",
    provider: "powerbi",
    type: "DATAWAREHOUSE",
    lastRefresh: "2 hours ago",
    refreshSchedule: "Every 4 hours",
    status: "SYNCED",
  },
  {
    id: "ds-2",
    name: "Customer Analytics DB",
    provider: "tableau",
    type: "DATABASE",
    lastRefresh: "30 minutes ago",
    refreshSchedule: "Every 1 hour",
    status: "SYNCED",
  },
  {
    id: "ds-3",
    name: "Looker Derived Tables",
    provider: "looker",
    type: "API",
    lastRefresh: "45 minutes ago",
    refreshSchedule: "Every 2 hours",
    status: "SYNCED",
  },
  {
    id: "ds-4",
    name: "Regional Metrics Export",
    provider: "qlik",
    type: "FILE",
    lastRefresh: "5 hours ago",
    refreshSchedule: "Daily at 03:00 AM",
    status: "STALE",
  },
  {
    id: "ds-5",
    name: "Google Analytics Events",
    provider: "ga",
    type: "API",
    lastRefresh: "5 minutes ago",
    refreshSchedule: "Real-time streaming",
    status: "SYNCED",
  },
];

const connectionStatusVariant = (
  status: ConnectionStatus
): "success" | "warning" | "danger" | "info" | "default" => {
  const map: Record<
    ConnectionStatus,
    "success" | "warning" | "danger" | "info" | "default"
  > = {
    CONNECTED: "success",
    DISCONNECTED: "warning",
    ERROR: "danger",
    AUTHENTICATING: "info",
  };
  return map[status];
};

const dataSourceStatusVariant = (
  status: string
): "success" | "warning" | "danger" | "info" | "default" => {
  const map: Record<string, "success" | "warning" | "danger" | "info" | "default"> = {
    SYNCED: "success",
    SYNCING: "info",
    STALE: "warning",
    FAILED: "danger",
  };
  return map[status] ?? "default";
};

export default function AnalyticsIntegrationsPage() {
  const [expandedConnection, setExpandedConnection] = useState<string | null>(
    "conn-1"
  );
  const [selectedProvider, setSelectedProvider] = useState<AnalyticsProvider | null>(null);
  const [showReportForm, setShowReportForm] = useState(false);
  const [view, setView] = useState<"connections" | "reports" | "metrics">(
    "connections"
  );

  const activeConnections = useMemo(
    () => CONNECTIONS.filter((c) => c.status === "CONNECTED"),
    []
  );
  const errorConnections = useMemo(
    () => CONNECTIONS.filter((c) => c.status === "ERROR"),
    []
  );

  const totalDashboards = useMemo(
    () => CONNECTIONS.reduce((sum, c) => sum + c.dashboardCount, 0),
    []
  );
  const totalEmbeds = useMemo(
    () => CONNECTIONS.reduce((sum, c) => sum + c.embedCount, 0),
    []
  );

  const totalApiCalls = useMemo(
    () => QUERY_METRICS.reduce((sum, m) => sum + m.apiCallsUsed, 0),
    []
  );
  const totalEmbedViews = useMemo(
    () => QUERY_METRICS.reduce((sum, m) => sum + m.embedViews, 0),
    []
  );

  return (
    <>
      <Header
        title="Analytics Integrations"
        subtitle="Manage analytics providers, dashboards, and scheduled reports"
        actions={
          <div className={cn("flex gap-2")}>
            <Button
              variant="primary"
              onClick={() => setShowReportForm(true)}
              size="sm"
            >
              <Plus size={14} className={cn("mr-1")} />
              New Report
            </Button>
          </div>
        }
      />

      <div className={cn("p-6")}>
        {/* Top Stats */}
        <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4 mb-6")}>
          <StatCard
            label="Active Connections"
            value={activeConnections.length}
            icon={<BarChart3 size={16} />}
            accentColor="var(--wl-success-500)"
            index={0}
          />
          <StatCard
            label="Connected Dashboards"
            value={totalDashboards}
            change={{ value: 12, label: "this month" }}
            icon={<TrendingUp size={16} />}
            accentColor="var(--wl-primary-500)"
            index={1}
          />
          <StatCard
            label="API Usage"
            value={`${Math.floor(totalApiCalls / 1000)}K`}
            change={{ value: 8, label: "vs last month" }}
            icon={<RefreshCw size={16} />}
            accentColor="var(--wl-info-500)"
            index={2}
          />
          <StatCard
            label="Embed Views"
            value={totalEmbedViews.toLocaleString()}
            change={{ value: 24, label: "vs last week" }}
            icon={<Eye size={16} />}
            accentColor="var(--wl-warning-500)"
            index={3}
          />
        </div>

        {/* View Toggle */}
        <div className={cn("flex gap-2 mb-6 bg-wl-bg-overlay rounded-md p-1 w-fit")}>
          {(["connections", "reports", "metrics"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-3 py-1 rounded-sm border-none text-xs font-semibold cursor-pointer capitalize",
                view === v
                  ? "bg-wl-primary-500 text-wl-text-inverse"
                  : "bg-transparent text-wl-text-tertiary"
              )}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Connections View */}
        {view === "connections" && (
          <div className={cn("space-y-4")}>
            {/* Provider Grid */}
            <div className={cn("mb-8")}>
              <h3 className={cn("text-sm font-semibold text-wl-text-primary mb-4")}>
                Available Providers
              </h3>
              <div className={cn("grid grid-cols-1 md:grid-cols-5 gap-3")}>
                {ANALYTICS_PROVIDERS.map((provider) => {
                  const connection = CONNECTIONS.find(
                    (c) => c.provider === provider.slug
                  );
                  return (
                    <div
                      key={provider.slug}
                      className={cn(
                        "p-4 rounded-lg border cursor-pointer transition-all",
                        connection?.status === "CONNECTED"
                          ? "border-wl-success-400 border-opacity-30 bg-[rgba(16,185,129,0.08)]"
                          : connection?.status === "ERROR"
                            ? "border-wl-danger-400 border-opacity-30 bg-[rgba(239,68,68,0.08)]"
                            : "border-wl-border-subtle hover:border-wl-primary-400"
                      )}
                      onClick={() => setSelectedProvider(provider.slug as AnalyticsProvider)}
                    >
                      <div className={cn("flex items-center justify-between mb-2")}>
                        <span className={cn("text-2xl")}>{provider.icon}</span>
                        {connection && (
                          <Badge variant={connectionStatusVariant(connection.status)} dot>
                            {connection.status === "CONNECTED" ? "Connected" : connection.status}
                          </Badge>
                        )}
                      </div>
                      <p className={cn("text-sm font-semibold text-wl-text-primary")}>
                        {provider.name}
                      </p>
                      <p className={cn("text-xs text-wl-text-tertiary mt-1")}>
                        {provider.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Connection Cards */}
            <div className={cn("space-y-3")}>
              <div className={cn("flex items-center justify-between mb-4")}>
                <h3 className={cn("text-sm font-semibold text-wl-text-primary")}>
                  Configured Connections ({CONNECTIONS.length})
                </h3>
                {errorConnections.length > 0 && (
                  <Badge variant="danger">
                    <AlertCircle size={12} className={cn("mr-1")} />
                    {errorConnections.length} error{errorConnections.length !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>

              {CONNECTIONS.map((connection, idx) => {
                const provider = ANALYTICS_PROVIDERS.find(
                  (p) => p.slug === connection.provider
                );
                const isExpanded = expandedConnection === connection.id;

                return (
                  <Card
                    key={connection.id}
                    className={cn(
                      "cursor-pointer transition-all wl-animate-in",
                      isExpanded && "ring-1 ring-wl-primary-400"
                    )}
                    style={{ animationDelay: `${idx * 40}ms` }}
                    onClick={() =>
                      setExpandedConnection(
                        isExpanded ? null : connection.id
                      )
                    }
                  >
                    <div className={cn("p-4")}>
                      <div className={cn("flex items-start justify-between mb-3")}>
                        <div className={cn("flex items-center gap-3 flex-1")}>
                          <span className={cn("text-2xl")}>{provider?.icon}</span>
                          <div className={cn("flex-1 min-w-0")}>
                            <p className={cn("text-sm font-semibold text-wl-text-primary")}>
                              {connection.name}
                            </p>
                            <p className={cn("text-xs text-wl-text-tertiary mt-1")}>
                              {connection.dashboardCount} dashboards • {connection.embedCount} embeds
                            </p>
                          </div>
                        </div>
                        <div className={cn("flex items-center gap-2 shrink-0")}>
                          <Badge variant={connectionStatusVariant(connection.status)} dot>
                            {connection.status === "CONNECTED"
                              ? "Connected"
                              : connection.status === "ERROR"
                                ? "Error"
                                : "Disconnected"}
                          </Badge>
                        </div>
                      </div>

                      <div className={cn("flex items-center justify-between text-xs text-wl-text-tertiary mb-3")}>
                        <span>
                          Last sync: {connection.lastSync}
                        </span>
                        <span>
                          Next: {connection.nextSync}
                        </span>
                      </div>

                      {connection.status === "ERROR" && connection.errorMessage && (
                        <div className={cn("mb-3 p-2 rounded bg-[rgba(239,68,68,0.1)] border border-wl-danger-400 border-opacity-30")}>
                          <p className={cn("text-xs text-wl-danger-400")}>
                            {connection.errorMessage}
                          </p>
                        </div>
                      )}

                      {isExpanded && (
                        <div className={cn("border-t border-wl-border-subtle pt-3 mt-3")}>
                          <div className={cn("grid grid-cols-3 gap-3 mb-4")}>
                            <div>
                              <p className={cn("text-xs text-wl-text-tertiary mb-1")}>Dashboards</p>
                              <p className={cn("text-lg font-bold text-wl-text-primary")}>
                                {connection.dashboardCount}
                              </p>
                            </div>
                            <div>
                              <p className={cn("text-xs text-wl-text-tertiary mb-1")}>Embeds</p>
                              <p className={cn("text-lg font-bold text-wl-text-primary")}>
                                {connection.embedCount}
                              </p>
                            </div>
                            <div>
                              <p className={cn("text-xs text-wl-text-tertiary mb-1")}>Status</p>
                              <p
                                className={cn(
                                  "text-lg font-bold",
                                  connection.status === "CONNECTED"
                                    ? "text-wl-success-400"
                                    : "text-wl-danger-400"
                                )}
                              >
                                {connection.status === "CONNECTED" ? "Live" : "Error"}
                              </p>
                            </div>
                          </div>

                          {/* Dashboard Preview */}
                          <div className={cn("bg-wl-bg-surface rounded p-3 mb-4")}>
                            <p className={cn("text-xs font-semibold text-wl-text-primary mb-2")}>
                              Dashboard Thumbnails
                            </p>
                            <div className={cn("grid grid-cols-4 gap-2")}>
                              {Array.from({ length: Math.min(4, connection.dashboardCount) }).map(
                                (_, i) => (
                                  <div
                                    key={i}
                                    className={cn(
                                      "aspect-square rounded bg-wl-bg-elevated border border-wl-border-subtle flex items-center justify-center"
                                    )}
                                  >
                                    <BarChart3
                                      size={20}
                                      className={cn("text-wl-text-tertiary opacity-50")}
                                    />
                                  </div>
                                )
                              )}
                            </div>
                          </div>

                          <div className={cn("flex gap-2")}>
                            <Button
                              variant={
                                connection.status === "ERROR"
                                  ? "primary"
                                  : "secondary"
                              }
                              size="sm"
                            >
                              {connection.status === "ERROR"
                                ? "Reconnect"
                                : "Configure"}
                            </Button>
                            <Button variant="ghost" size="sm">
                              <RefreshCw size={14} className={cn("mr-1")} />
                              Sync Now
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Settings size={14} />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Reports View */}
        {view === "reports" && (
          <div className={cn("space-y-3")}>
            <div className={cn("flex items-center justify-between mb-4")}>
              <h3 className={cn("text-sm font-semibold text-wl-text-primary")}>
                Scheduled Reports ({SCHEDULED_REPORTS.length})
              </h3>
              <Button variant="primary" size="sm" onClick={() => setShowReportForm(true)}>
                <Plus size={14} className={cn("mr-1")} />
                Create Report
              </Button>
            </div>

            {SCHEDULED_REPORTS.map((report, idx) => {
              const provider = ANALYTICS_PROVIDERS.find(
                (p) => p.slug === report.provider
              );
              return (
                <Card
                  key={report.id}
                  className={cn("wl-animate-in")}
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className={cn("p-4")}>
                    <div className={cn("flex items-start justify-between mb-3")}>
                      <div className={cn("flex items-center gap-3 flex-1 min-w-0")}>
                        <span className={cn("text-xl shrink-0")}>{provider?.icon}</span>
                        <div className={cn("min-w-0")}>
                          <p className={cn("text-sm font-semibold text-wl-text-primary truncate")}>
                            {report.title}
                          </p>
                          <p className={cn("text-xs text-wl-text-tertiary mt-1")}>
                            {report.frequency} • {report.format}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          report.status === "ACTIVE"
                            ? "success"
                            : report.status === "PAUSED"
                              ? "warning"
                              : "danger"
                        }
                        dot
                      >
                        {report.status}
                      </Badge>
                    </div>

                    <div className={cn("bg-wl-bg-surface rounded p-3 mb-3")}>
                      <div className={cn("grid grid-cols-2 gap-3 text-xs")}>
                        <div>
                          <p className={cn("text-wl-text-tertiary mb-1")}>Next Run</p>
                          <p className={cn("font-semibold text-wl-text-primary")}>
                            {report.nextRun}
                          </p>
                        </div>
                        <div>
                          <p className={cn("text-wl-text-tertiary mb-1")}>Last Run</p>
                          <p className={cn("font-semibold text-wl-text-primary")}>
                            {report.lastRun}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className={cn("mb-3")}>
                      <p className={cn("text-xs text-wl-text-tertiary mb-2")}>
                        Recipients ({report.recipients.length})
                      </p>
                      <div className={cn("flex flex-wrap gap-1")}>
                        {report.recipients.map((recipient) => (
                          <span
                            key={recipient}
                            className={cn(
                              "text-xs px-2 py-1 rounded bg-wl-bg-elevated text-wl-text-secondary"
                            )}
                          >
                            {recipient}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className={cn("flex gap-2")}>
                      <Button
                        variant={report.status === "PAUSED" ? "primary" : "secondary"}
                        size="sm"
                      >
                        {report.status === "PAUSED" ? (
                          <>
                            <Play size={14} className={cn("mr-1")} />
                            Resume
                          </>
                        ) : (
                          <>
                            <Pause size={14} className={cn("mr-1")} />
                            Pause
                          </>
                        )}
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Settings size={14} />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Trash2 size={14} className={cn("text-wl-danger-400")} />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Metrics View */}
        {view === "metrics" && (
          <div className={cn("space-y-4")}>
            <h3 className={cn("text-sm font-semibold text-wl-text-primary mb-4")}>
              API & Usage Metrics
            </h3>

            {/* Data Sources */}
            <div className={cn("mb-6")}>
              <h4 className={cn("text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-3")}>
                Data Source Sync Status
              </h4>
              <div className={cn("space-y-2")}>
                {DATA_SOURCES.map((source, idx) => (
                  <Card key={source.id} className={cn("wl-animate-in")} style={{ animationDelay: `${idx * 30}ms` }}>
                    <div className={cn("p-3 flex items-center justify-between")}>
                      <div className={cn("flex items-center gap-3 flex-1 min-w-0")}>
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            source.status === "SYNCED"
                              ? "bg-wl-success-400"
                              : source.status === "SYNCING"
                                ? "bg-wl-info-400"
                                : source.status === "STALE"
                                  ? "bg-wl-warning-400"
                                  : "bg-wl-danger-400"
                          )}
                        />
                        <div className={cn("min-w-0")}>
                          <p className={cn("text-sm font-semibold text-wl-text-primary")}>
                            {source.name}
                          </p>
                          <p className={cn("text-xs text-wl-text-tertiary mt-0.5")}>
                            {source.type} • Refreshes {source.refreshSchedule}
                          </p>
                        </div>
                      </div>
                      <div className={cn("flex items-center gap-3 text-right shrink-0")}>
                        <div>
                          <p className={cn("text-xs text-wl-text-tertiary")}>Last Refresh</p>
                          <p className={cn("text-xs font-semibold text-wl-text-primary")}>
                            {source.lastRefresh}
                          </p>
                        </div>
                        <Badge variant={dataSourceStatusVariant(source.status)} dot>
                          {source.status}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Query Metrics */}
            <div>
              <h4 className={cn("text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-3")}>
                Query Performance
              </h4>
              <div className={cn("grid grid-cols-1 md:grid-cols-5 gap-3")}>
                {QUERY_METRICS.map((metrics, idx) => {
                  const provider = ANALYTICS_PROVIDERS.find(
                    (p) => p.slug === metrics.provider
                  );
                  return (
                    <Card
                      key={`${metrics.provider}-metrics`}
                      className={cn("wl-animate-in")}
                      style={{ animationDelay: `${idx * 40}ms` }}
                    >
                      <div className={cn("p-3")}>
                        <div className={cn("flex items-center gap-2 mb-3")}>
                          <span className={cn("text-lg")}>{provider?.icon}</span>
                          <p className={cn("text-xs font-semibold text-wl-text-primary")}>
                            {provider?.name}
                          </p>
                        </div>

                        <div className={cn("space-y-2 text-xs")}>
                          <div>
                            <p className={cn("text-wl-text-tertiary mb-0.5")}>Success Rate</p>
                            <p className={cn("font-bold text-wl-success-400")}>
                              {metrics.successRate}%
                            </p>
                          </div>
                          <div>
                            <p className={cn("text-wl-text-tertiary mb-0.5")}>Avg Response</p>
                            <p className={cn("font-bold text-wl-text-primary")}>
                              {metrics.avgResponseTime}ms
                            </p>
                          </div>
                          <div>
                            <p className={cn("text-wl-text-tertiary mb-0.5")}>Queries Run</p>
                            <p className={cn("font-bold text-wl-text-primary")}>
                              {(metrics.queriesRun / 1000).toFixed(1)}K
                            </p>
                          </div>
                          <div>
                            <p className={cn("text-wl-text-tertiary mb-0.5")}>API Calls</p>
                            <p className={cn("font-bold text-wl-text-primary")}>
                              {(metrics.apiCallsUsed / 1000).toFixed(1)}K
                            </p>
                          </div>
                          <div>
                            <p className={cn("text-wl-text-tertiary mb-0.5")}>Embed Views</p>
                            <p className={cn("font-bold text-wl-text-primary")}>
                              {(metrics.embedViews / 1000).toFixed(1)}K
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
