"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";

type NodeStatus = "active" | "idle" | "error";

interface FlowNode {
  id: string;
  label: string;
  status: NodeStatus;
  throughput: number;
  unit: string;
  details?: {
    itemsProcessed: number;
    avgTime: string;
    successRate: number;
    lastUpdate: string;
  };
}

interface SupplyChainFlowProps {
  nodes?: FlowNode[];
  onNodeClick?: (nodeId: string) => void;
  className?: string;
}

const defaultNodes: FlowNode[] = [
  {
    id: "supplier",
    label: "Supplier",
    status: "active",
    throughput: 1250,
    unit: "units/day",
    details: {
      itemsProcessed: 12500,
      avgTime: "2.3 days",
      successRate: 99.8,
      lastUpdate: "2 mins ago",
    },
  },
  {
    id: "warehouse",
    label: "Warehouse",
    status: "active",
    throughput: 1200,
    unit: "units/day",
    details: {
      itemsProcessed: 11850,
      avgTime: "1.1 days",
      successRate: 99.5,
      lastUpdate: "Just now",
    },
  },
  {
    id: "pick-pack",
    label: "Pick & Pack",
    status: "active",
    throughput: 980,
    unit: "units/day",
    details: {
      itemsProcessed: 9800,
      avgTime: "4.5 hours",
      successRate: 98.2,
      lastUpdate: "1 min ago",
    },
  },
  {
    id: "ship",
    label: "Ship",
    status: "idle",
    throughput: 450,
    unit: "units/day",
    details: {
      itemsProcessed: 4500,
      avgTime: "8.2 hours",
      successRate: 99.9,
      lastUpdate: "15 mins ago",
    },
  },
  {
    id: "customer",
    label: "Customer",
    status: "active",
    throughput: 380,
    unit: "units/day",
    details: {
      itemsProcessed: 3800,
      avgTime: "1.2 days",
      successRate: 97.5,
      lastUpdate: "5 mins ago",
    },
  },
];

export function SupplyChainFlow({
  nodes = defaultNodes,
  onNodeClick,
  className,
}: SupplyChainFlowProps) {
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

  const getStatusColor = (status: NodeStatus): string => {
    switch (status) {
      case "active":
        return "var(--wl-success-500)";
      case "idle":
        return "var(--wl-warning-500)";
      case "error":
        return "var(--wl-danger-500)";
    }
  };

  const getStatusLabel = (status: NodeStatus): string => {
    switch (status) {
      case "active":
        return "Active";
      case "idle":
        return "Idle";
      case "error":
        return "Error";
    }
  };

  const getStatusVariant = (
    status: NodeStatus,
  ): "success" | "warning" | "danger" => {
    switch (status) {
      case "active":
        return "success";
      case "idle":
        return "warning";
      case "error":
        return "danger";
    }
  };

  const toggleExpanded = (nodeId: string) => {
    setExpandedNode(expandedNode === nodeId ? null : nodeId);
    onNodeClick?.(nodeId);
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-4 bg-wl-bg-surface p-6 rounded-lg border border-wl-border-subtle",
        className,
      )}
    >
      {/* Title */}
      <div>
        <h3 className="text-base font-semibold text-wl-text-primary mb-1">
          Supply Chain Flow
        </h3>
        <p className="text-xs text-wl-text-secondary">
          Real-time pipeline visualization and throughput metrics
        </p>
      </div>

      {/* Flow diagram */}
      <div className="flex items-center justify-between gap-2 mb-4">
        {nodes.map((node, idx) => (
          <div key={node.id} className="flex items-center flex-1">
            {/* Node */}
            <div className="flex-1">
              <button
                onClick={() => toggleExpanded(node.id)}
                className={cn(
                  "w-full p-3 rounded-lg border-2 transition-all duration-200 cursor-pointer",
                  "hover:border-wl-border-strong hover:shadow-md",
                  expandedNode === node.id
                    ? "border-wl-primary-500 bg-wl-primary-500/10 shadow-md"
                    : "border-wl-border-subtle bg-wl-bg-overlay",
                )}
              >
                <div className="flex items-start gap-2">
                  {/* Status dot with pulse */}
                  <div className="flex-shrink-0 pt-0.5">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        node.status === "active" && "animate-pulse",
                      )}
                      style={{ backgroundColor: getStatusColor(node.status) }}
                    />
                  </div>

                  {/* Node content */}
                  <div className="flex-1 text-left">
                    <h4 className="text-sm font-semibold text-wl-text-primary">
                      {node.label}
                    </h4>
                    <div className="text-xs text-wl-text-secondary mt-1">
                      {node.throughput.toLocaleString()} {node.unit}
                    </div>
                  </div>

                  {/* Status badge */}
                  <Badge
                    variant={getStatusVariant(node.status)}
                    className="flex-shrink-0 text-xs"
                  >
                    {getStatusLabel(node.status)}
                  </Badge>
                </div>
              </button>

              {/* Expanded details panel */}
              {expandedNode === node.id && node.details && (
                <div className="mt-2 p-3 bg-wl-bg-overlay rounded-lg border border-wl-border-subtle text-xs space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-wl-text-secondary">
                        Items Processed
                      </span>
                      <p className="font-semibold text-wl-text-primary mt-1">
                        {node.details.itemsProcessed.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-wl-text-secondary">
                        Avg Processing Time
                      </span>
                      <p className="font-semibold text-wl-text-primary mt-1">
                        {node.details.avgTime}
                      </p>
                    </div>
                    <div>
                      <span className="text-wl-text-secondary">
                        Success Rate
                      </span>
                      <p className="font-semibold text-wl-success-400 mt-1">
                        {node.details.successRate}%
                      </p>
                    </div>
                    <div>
                      <span className="text-wl-text-secondary">
                        Last Update
                      </span>
                      <p className="font-semibold text-wl-text-primary mt-1">
                        {node.details.lastUpdate}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Arrow connector (not after last node) */}
            {idx < nodes.length - 1 && (
              <div className="flex-shrink-0 px-3">
                <svg
                  width="40"
                  height="24"
                  viewBox="0 0 40 24"
                  className="overflow-visible"
                  aria-hidden="true"
                >
                  {/* Animated flow line */}
                  <defs>
                    <style>{`
                      @keyframes flow {
                        0% { strokeDashoffset: 8; }
                        100% { strokeDashoffset: 0; }
                      }
                      .flow-line {
                        animation: flow 2s linear infinite;
                      }
                    `}</style>
                  </defs>

                  {/* Line with animation */}
                  <line
                    x1="0"
                    y1="12"
                    x2="32"
                    y2="12"
                    stroke="var(--wl-primary-500)"
                    strokeWidth="2"
                  />

                  {/* Arrow head */}
                  <polygon
                    points="40,12 32,8 32,16"
                    fill="var(--wl-primary-500)"
                  />

                  {/* Dashed animated overlay */}
                  <line
                    x1="0"
                    y1="12"
                    x2="32"
                    y2="12"
                    stroke="var(--wl-primary-400)"
                    strokeWidth="1.5"
                    strokeDasharray="4,4"
                    className="flow-line"
                    opacity="0.6"
                  />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3 pt-4 border-t border-wl-border-subtle">
        <div className="p-3 bg-wl-bg-overlay rounded-lg">
          <p className="text-xs text-wl-text-secondary">Total Throughput</p>
          <p className="text-sm font-semibold text-wl-text-primary mt-1">
            {nodes.reduce((sum, n) => sum + n.throughput, 0).toLocaleString()}
          </p>
          <p className="text-xs text-wl-text-secondary mt-1">units/day</p>
        </div>

        <div className="p-3 bg-wl-bg-overlay rounded-lg">
          <p className="text-xs text-wl-text-secondary">Active Nodes</p>
          <p className="text-sm font-semibold text-wl-success-400 mt-1">
            {nodes.filter((n) => n.status === "active").length}
          </p>
          <p className="text-xs text-wl-text-secondary mt-1">
            of {nodes.length}
          </p>
        </div>

        <div className="p-3 bg-wl-bg-overlay rounded-lg">
          <p className="text-xs text-wl-text-secondary">Avg Efficiency</p>
          <p className="text-sm font-semibold text-wl-text-primary mt-1">
            98.2%
          </p>
          <p className="text-xs text-wl-success-400 mt-1">+0.3%</p>
        </div>

        <div className="p-3 bg-wl-bg-overlay rounded-lg">
          <p className="text-xs text-wl-text-secondary">Last Sync</p>
          <p className="text-sm font-semibold text-wl-text-primary mt-1">
            Just now
          </p>
          <p className="text-xs text-wl-text-secondary mt-1">Live data</p>
        </div>
      </div>
    </div>
  );
}
