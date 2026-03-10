"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Package,
  Truck,
  User,
  Globe,
  Zap,
  Server,
} from "lucide-react";

interface EventCardProps {
  id: string;
  type: string;
  source: "api" | "webhook" | "workflow" | "system";
  timestamp: string;
  entityType?: string;
  status?: "processed" | "pending" | "failed";
  payload: Record<string, unknown>;
  correlationId?: string;
}

const eventTypeIcons: Record<string, React.ReactNode> = {
  order: <Package className="w-4 h-4" />,
  shipment: <Truck className="w-4 h-4" />,
  driver: <User className="w-4 h-4" />,
  webhook: <Globe className="w-4 h-4" />,
  workflow: <Zap className="w-4 h-4" />,
  system: <Server className="w-4 h-4" />,
};

const sourceColors: Record<string, string> = {
  api: "primary",
  webhook: "info",
  workflow: "success",
  system: "warning",
};

const statusColors: Record<string, string> = {
  processed: "success",
  pending: "warning",
  failed: "danger",
};

export function EventCard({
  id,
  type,
  source,
  timestamp,
  entityType = "system",
  status = "processed",
  payload,
  correlationId,
}: EventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const icon = eventTypeIcons[entityType] || eventTypeIcons.system;
  const relativeTime = formatRelativeTime(timestamp);
  const absoluteTime = new Date(timestamp).toLocaleString();

  return (
    <Card
      className={cn(
        "hover:border-wl-border-default transition-all duration-200",
        expanded && "border-wl-border-default"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-wl-border-subtle">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Icon */}
          <div className="flex-shrink-0 text-wl-text-secondary mt-1">{icon}</div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title and Type */}
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-wl-text-primary truncate">
                {type}
              </h4>
              <Badge variant={sourceColors[source] as any} className="text-xs">
                {source}
              </Badge>
              {status && (
                <Badge
                  variant={statusColors[status] as any}
                  dot
                  className="text-xs"
                >
                  {status}
                </Badge>
              )}
            </div>

            {/* Timestamp */}
            <Tooltip content={absoluteTime}>
              <p className="text-xs text-wl-text-secondary mt-1.5">
                {relativeTime}
              </p>
            </Tooltip>

            {/* Entity Type and Correlation ID */}
            <div className="flex items-center gap-3 mt-2 text-xs text-wl-text-tertiary flex-wrap">
              <span className="inline-block">
                Entity: <span className="text-wl-text-secondary">{entityType}</span>
              </span>
              {correlationId && (
                <span className="inline-block">
                  Correlation:{" "}
                  <span className="text-wl-text-secondary font-mono truncate max-w-[200px]">
                    {correlationId}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Tooltip content={copied ? "Copied!" : "Copy event ID"}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="px-2 py-1 h-auto"
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
          </Tooltip>

          <button
            onClick={() => setExpanded(!expanded)}
            className={cn(
              "flex items-center justify-center",
              "w-8 h-8 rounded-md",
              "text-wl-text-secondary hover:text-wl-text-primary hover:bg-wl-bg-overlay",
              "transition-colors duration-200"
            )}
            aria-label={expanded ? "Collapse payload" : "Expand payload"}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Payload Preview */}
      {!expanded && (
        <div className="pt-4 pb-0">
          <PayloadPreview payload={payload} />
        </div>
      )}

      {/* Expanded Payload */}
      {expanded && (
        <div className="pt-4">
          <div className="bg-wl-bg-sunken rounded-md p-4 font-mono text-xs overflow-x-auto max-h-96 overflow-y-auto">
            <pre className="text-wl-text-secondary whitespace-pre-wrap break-words">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>

          {/* Event ID Display */}
          <div className="mt-3 pt-3 border-t border-wl-border-subtle">
            <p className="text-xs text-wl-text-tertiary mb-1">Event ID:</p>
            <p className="font-mono text-xs text-wl-text-secondary break-all select-all">
              {id}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ─────────────────────────────────────────
   Payload Preview Component
   ───────────────────────────────────────── */

interface PayloadPreviewProps {
  payload: Record<string, unknown>;
}

function PayloadPreview({ payload }: PayloadPreviewProps) {
  const preview = JSON.stringify(payload).slice(0, 120);
  const truncated = JSON.stringify(payload).length > 120;

  return (
    <div className="text-xs text-wl-text-tertiary font-mono">
      <span className="text-wl-text-secondary">{preview}</span>
      {truncated && <span>...</span>}
    </div>
  );
}

/* ─────────────────────────────────────────
   Utilities
   ───────────────────────────────────────── */

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const seconds = Math.floor((now.getTime() - time.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return time.toLocaleDateString();
}
