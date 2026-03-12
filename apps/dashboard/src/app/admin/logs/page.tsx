"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Search,
  X,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
  Info,
  Play,
  Copy,
  Download,
} from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "error" | "warn" | "info";
  service: string;
  message: string;
  stackTrace?: string;
  metadata?: Record<string, any>;
}

const mockLogs: LogEntry[] = [
  {
    id: "log-001",
    timestamp: "2026-03-12 14:32:15",
    level: "error",
    service: "API Server",
    message: "Database connection pool exhausted",
    stackTrace:
      "Error: ENOMEM: Cannot allocate memory, spawn\n    at ChildProcess.spawn (internal/child_process.js:323:12)\n    at spawn (/app/node_modules/spawn-cmd/index.js:45:3)\n    at DatabasePool.connect (/app/src/db/pool.ts:89:15)",
    metadata: {
      poolSize: 10,
      activeConnections: 15,
      waitingRequests: 28,
    },
  },
  {
    id: "log-002",
    timestamp: "2026-03-12 14:31:45",
    level: "warn",
    service: "Worker Service",
    message: "Job queue processing falling behind",
    metadata: {
      queueDepth: 4521,
      processingRate: 120,
      estimatedCatchUpTime: "37 minutes",
    },
  },
  {
    id: "log-003",
    timestamp: "2026-03-12 14:30:32",
    level: "error",
    service: "Integration Service",
    message: "Stripe webhook validation failed",
    stackTrace:
      "ValidationError: Invalid signature\n    at validateWebhookSignature (/app/src/integrations/stripe.ts:145:21)\n    at handleWebhook (/app/src/integrations/stripe.ts:98:15)",
    metadata: {
      webhookId: "evt_1234567890",
      signature: "t=1234567890,v1=...",
    },
  },
  {
    id: "log-004",
    timestamp: "2026-03-12 14:29:10",
    level: "info",
    service: "Scheduler",
    message: "Nightly batch job started",
    metadata: {
      jobId: "batch-daily-001",
      recordsToProcess: 45230,
    },
  },
  {
    id: "log-005",
    timestamp: "2026-03-12 14:28:45",
    level: "error",
    service: "API Server",
    message: "Request timeout: /api/orders/bulk-export",
    metadata: {
      endpoint: "/api/orders/bulk-export",
      method: "POST",
      duration: "30045ms",
      timeout: 30000,
    },
  },
  {
    id: "log-006",
    timestamp: "2026-03-12 14:27:22",
    level: "warn",
    service: "Redis Cache",
    message: "Memory usage above 80%",
    metadata: {
      usedMemory: "3.2GB",
      maxMemory: "4GB",
      evictedKeys: 1234,
    },
  },
  {
    id: "log-007",
    timestamp: "2026-03-12 14:26:00",
    level: "info",
    service: "API Server",
    message: "Deployment completed successfully",
    metadata: {
      version: "v4.9.2",
      duration: "2m 15s",
      rollbackAvailable: true,
    },
  },
  {
    id: "log-008",
    timestamp: "2026-03-12 14:15:33",
    level: "error",
    service: "Dashboard",
    message: "Failed to render page component",
    stackTrace:
      "RenderError: Component render failed\n    at renderComponent (/app/src/components/OrdersPage.tsx:145:12)\n    at Object.render (/app/node_modules/react/render.js:89:3)",
    metadata: {
      component: "OrdersPage",
      page: "/orders",
      userId: "user-12345",
    },
  },
];

function LogLevelBadge({ level }: { level: "error" | "warn" | "info" }) {
  const variants: Record<typeof level, any> = {
    error: "danger",
    warn: "warning",
    info: "info",
  };

  const labels: Record<typeof level, string> = {
    error: "Error",
    warn: "Warning",
    info: "Info",
  };

  const icons: Record<typeof level, any> = {
    error: AlertCircle,
    warn: AlertTriangle,
    info: Info,
  };

  const Icon = icons[level];

  return (
    <Badge variant={variants[level]} dot>
      {labels[level]}
    </Badge>
  );
}

function LogDetailModal({
  log,
  onClose,
}: {
  log: LogEntry;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="sticky top-0 bg-wl-bg-elevated border-b border-wl-border-subtle flex items-center justify-between">
          <div>
            <CardTitle>Log Details</CardTitle>
            <p className="text-xs text-wl-text-tertiary mt-1">ID: {log.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-wl-bg-overlay rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-wl-bg-overlay rounded-lg">
            <div>
              <p className="text-xs text-wl-text-tertiary uppercase tracking-wider">
                Timestamp
              </p>
              <p className="text-sm font-semibold text-wl-text-primary mt-1">
                {log.timestamp}
              </p>
            </div>
            <div>
              <p className="text-xs text-wl-text-tertiary uppercase tracking-wider">
                Service
              </p>
              <p className="text-sm font-semibold text-wl-text-primary mt-1">
                {log.service}
              </p>
            </div>
          </div>

          {/* Level and Message */}
          <div>
            <p className="text-xs text-wl-text-tertiary uppercase tracking-wider mb-2">
              Level
            </p>
            <LogLevelBadge level={log.level} />
          </div>

          <div>
            <p className="text-xs text-wl-text-tertiary uppercase tracking-wider mb-2">
              Message
            </p>
            <div className="p-3 bg-wl-bg-overlay rounded-lg border border-wl-border-subtle">
              <p className="text-sm text-wl-text-primary break-words">
                {log.message}
              </p>
            </div>
          </div>

          {/* Stack Trace */}
          {log.stackTrace && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-wl-text-tertiary uppercase tracking-wider">
                  Stack Trace
                </p>
                <button
                  onClick={() => handleCopy(log.stackTrace || "")}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-wl-text-secondary hover:text-wl-text-primary transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="p-3 bg-wl-bg-overlay rounded-lg border border-wl-border-subtle text-xs text-wl-text-secondary overflow-x-auto">
                <code>{log.stackTrace}</code>
              </pre>
            </div>
          )}

          {/* Metadata */}
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div>
              <p className="text-xs text-wl-text-tertiary uppercase tracking-wider mb-2">
                Metadata
              </p>
              <div className="p-3 bg-wl-bg-overlay rounded-lg border border-wl-border-subtle">
                {Object.entries(log.metadata).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex justify-between py-1 border-b border-wl-border-subtle last:border-b-0"
                  >
                    <span className="text-xs text-wl-text-secondary">{key}:</span>
                    <span className="text-xs text-wl-text-primary font-medium">
                      {typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t border-wl-border-subtle">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleCopy(JSON.stringify(log, null, 2))}
            >
              <Copy className="w-4 h-4" />
              Copy JSON
            </Button>
            <Button variant="ghost" size="sm">
              Export
            </Button>
            <Button variant="ghost" size="sm">
              View Related
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LogsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const levels = [
    { id: "error", label: "Error", color: "wl-danger-400" },
    { id: "warn", label: "Warning", color: "wl-warning-400" },
    { id: "info", label: "Info", color: "wl-info-400" },
  ];

  const services = Array.from(new Set(mockLogs.map(log => log.service)));
  const levelCounts = {
    error: mockLogs.filter(l => l.level === "error").length,
    warn: mockLogs.filter(l => l.level === "warn").length,
    info: mockLogs.filter(l => l.level === "info").length,
  };

  const filteredLogs = useMemo(() => {
    return mockLogs.filter(log => {
      const matchesSearch =
        log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.service.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLevel = !selectedLevel || log.level === selectedLevel;
      const matchesService = !selectedService || log.service === selectedService;

      return matchesSearch && matchesLevel && matchesService;
    });
  }, [searchQuery, selectedLevel, selectedService]);

  return (
    <div className="min-h-screen bg-wl-bg-surface">
      <Header
        title="Error Logs"
        subtitle="View and search application logs and errors"
        actions={
          <div className="flex gap-2">
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-wl-bg-overlay hover:bg-wl-border-subtle transition-colors cursor-pointer">
              <div
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  autoRefresh ? "bg-wl-success-400" : "bg-wl-text-tertiary"
                )}
              />
              <span className="text-sm font-medium text-wl-text-secondary">
                Auto-refresh (10s)
              </span>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="hidden"
              />
            </label>
            <Button variant="secondary" size="md">
              <Download className="w-4 h-4" />
              Export Logs
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {levels.map(level => (
            <Card key={level.id}>
              <CardContent className="pt-5">
                <p className="text-xs text-wl-text-tertiary uppercase tracking-wider mb-2">
                  {level.label}
                </p>
                <span className="text-3xl font-bold text-wl-text-primary">
                  {levelCounts[level.id as keyof typeof levelCounts]}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-5 space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-wl-text-tertiary" />
              <input
                type="text"
                placeholder="Search logs by message or service..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-wl-bg-overlay border border-wl-border-subtle rounded-lg text-sm text-wl-text-primary placeholder-wl-text-tertiary focus:outline-none focus:border-wl-border-focus"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
              <div>
                <label className="text-xs text-wl-text-tertiary uppercase tracking-wider block mb-2">
                  Severity
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedLevel(null)}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                      !selectedLevel
                        ? "bg-wl-primary-500 text-wl-text-inverse"
                        : "bg-wl-bg-overlay text-wl-text-secondary hover:text-wl-text-primary"
                    )}
                  >
                    All
                  </button>
                  {levels.map(level => (
                    <button
                      key={level.id}
                      onClick={() => setSelectedLevel(level.id)}
                      className={cn(
                        "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                        selectedLevel === level.id
                          ? "bg-wl-primary-500 text-wl-text-inverse"
                          : "bg-wl-bg-overlay text-wl-text-secondary hover:text-wl-text-primary"
                      )}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-wl-text-tertiary uppercase tracking-wider block mb-2">
                  Service
                </label>
                <select
                  value={selectedService || ""}
                  onChange={(e) =>
                    setSelectedService(e.target.value || null)
                  }
                  className="px-3 py-1 rounded-md text-xs bg-wl-bg-overlay border border-wl-border-subtle text-wl-text-primary focus:outline-none focus:border-wl-border-focus"
                >
                  <option value="">All Services</option>
                  {services.map(service => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Logs ({filteredLogs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-subtle">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">
                      Level
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">
                      Service
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">
                      Message
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(log => (
                    <tr
                      key={log.id}
                      className="border-b border-wl-border-subtle hover:bg-wl-bg-overlay transition-colors"
                    >
                      <td className="px-5 py-3 text-wl-text-secondary whitespace-nowrap">
                        {log.timestamp}
                      </td>
                      <td className="px-5 py-3">
                        <LogLevelBadge level={log.level} />
                      </td>
                      <td className="px-5 py-3 text-wl-text-secondary">
                        {log.service}
                      </td>
                      <td className="px-5 py-3 text-wl-text-secondary max-w-xs truncate">
                        {log.message}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-wl-bg-overlay text-wl-text-secondary hover:text-wl-text-primary transition-colors"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredLogs.length === 0 && (
                <div className="p-6 text-center text-wl-text-tertiary">
                  No logs found matching your filters.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <LogDetailModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}
