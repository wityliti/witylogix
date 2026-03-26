"use client";

import { cn } from "@/lib/utils";
import {
  Truck,
  Users,
  BarChart3,
  Settings,
  RotateCcw,
  DollarSign,
  Star,
  Shield,
  Briefcase,
  Activity,
  Check,
} from "lucide-react";
import type { OnboardingData } from "../types";

interface DashboardLayoutProps {
  data: OnboardingData;
  onSelect: (layout: string) => void;
}

interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className: string }>;
  color: string;
  keywords: string[];
}

const DASHBOARD_PRESETS: LayoutPreset[] = [
  {
    id: "last-mile-ops",
    name: "Last-Mile Operations",
    description: "Real-time tracking, route optimization, POD",
    icon: Truck,
    color: "from-wl-primary-500 to-wl-primary-600",
    keywords: ["delivery", "tracking", "route"],
  },
  {
    id: "customer-view",
    name: "Last-Mile Customer View",
    description: "Customer tracking links, notifications, ETA",
    icon: Users,
    color: "from-wl-success-500 to-wl-success-600",
    keywords: ["customer", "tracking", "notifications"],
  },
  {
    id: "fleet-management",
    name: "Fleet Management",
    description: "Vehicle tracking, maintenance, fuel, compliance",
    icon: Truck,
    color: "from-wl-info-500 to-wl-info-600",
    keywords: ["fleet", "vehicles", "maintenance"],
  },
  {
    id: "analytics-performance",
    name: "Analytics & Performance",
    description: "KPIs, delivery metrics, SLA tracking",
    icon: BarChart3,
    color: "from-wl-warning-500 to-wl-warning-600",
    keywords: ["analytics", "kpi", "metrics"],
  },
  {
    id: "operations",
    name: "Operations Dashboard",
    description: "Orders, dispatch, driver management",
    icon: Settings,
    color: "from-wl-neutral-400 to-wl-neutral-500",
    keywords: ["operations", "orders", "dispatch"],
  },
  {
    id: "returns",
    name: "Returns Management",
    description: "Return requests, reverse logistics, refunds",
    icon: RotateCcw,
    color: "from-wl-danger-500 to-wl-danger-600",
    keywords: ["returns", "refunds", "reverse"],
  },
  {
    id: "driver-performance",
    name: "Driver Performance",
    description: "Scorecards, route adherence, delivery speed",
    icon: Activity,
    color: "from-wl-info-400 to-wl-info-500",
    keywords: ["driver", "performance", "scoring"],
  },
  {
    id: "financial",
    name: "Financial & Cost Control",
    description: "Invoicing, cost per delivery, margin analysis",
    icon: DollarSign,
    color: "from-wl-success-500 to-wl-success-600",
    keywords: ["financial", "cost", "invoicing"],
  },
  {
    id: "customer-experience",
    name: "Customer Experience",
    description: "NPS, feedback, communication, tracking",
    icon: Star,
    color: "from-wl-primary-400 to-wl-primary-500",
    keywords: ["customer", "experience", "feedback"],
  },
  {
    id: "compliance",
    name: "Compliance & Safety",
    description: "ELD, HOS, DVIR, safety scoring",
    icon: Shield,
    color: "from-wl-danger-400 to-wl-danger-500",
    keywords: ["compliance", "safety", "eld"],
  },
  {
    id: "executive",
    name: "Executive Summary",
    description: "High-level KPIs, trends, comparisons",
    icon: Briefcase,
    color: "from-wl-primary-600 to-wl-primary-700",
    keywords: ["executive", "summary", "kpi"],
  },
];

export function DashboardLayout({
  data,
  onSelect,
}: DashboardLayoutProps) {
  const selected = data.dashboardLayout;

  return (
    <div className="flex flex-col gap-6 py-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-wl-text-primary m-0">
          Choose your dashboard
        </h2>
        <p className="text-sm text-wl-text-secondary m-0">
          Pick your preferred dashboard layout
        </p>
      </div>

      {/* Layout Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[550px] overflow-y-auto">
        {DASHBOARD_PRESETS.map((preset) => {
          const Icon = preset.icon;
          const isSelected = selected === preset.id;

          return (
            <button
              key={preset.id}
              onClick={() => onSelect(preset.id)}
              className={cn(
                "relative p-5 rounded-lg border-2 transition-all duration-300",
                "flex flex-col gap-3 text-left group",
                "bg-wl-bg-surface/50 backdrop-blur-sm",
                isSelected
                  ? "border-wl-primary-500 shadow-lg shadow-wl-primary-500/20"
                  : "border-wl-border-default hover:border-wl-border-strong"
              )}
            >
              {/* Checkmark */}
              {isSelected && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-wl-primary-500 flex items-center justify-center">
                  <Check className="w-3 h-3 text-wl-text-inverse" />
                </div>
              )}

              {/* Icon */}
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center",
                  `bg-gradient-to-br ${preset.color}`,
                  isSelected && "shadow-md"
                )}
              >
                <Icon className="w-5 h-5 text-wl-text-inverse" />
              </div>

              {/* Content */}
              <div className="flex flex-col gap-1 flex-1">
                <h3 className="font-semibold text-sm text-wl-text-primary m-0 leading-tight">
                  {preset.name}
                </h3>
                <p className="text-xs text-wl-text-tertiary m-0 leading-relaxed">
                  {preset.description}
                </p>
              </div>

              {/* Preview Placeholder */}
              <div className="w-full h-20 rounded bg-wl-bg-overlay/50 border border-wl-border-subtle flex items-center justify-center">
                <div className="flex flex-col gap-1.5 w-4/5">
                  <div className="h-1.5 bg-wl-border-subtle rounded-full" />
                  <div className="h-1 bg-wl-border-subtle rounded-full w-3/4" />
                  <div className="h-1 bg-wl-border-subtle rounded-full w-2/3" />
                </div>
              </div>

              {/* Hover Highlight */}
              {!isSelected && (
                <div
                  className={cn(
                    "absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100",
                    "transition-opacity duration-300 pointer-events-none",
                    "bg-gradient-to-br from-wl-primary-500/5 to-transparent"
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Selection Info */}
      {selected && (
        <div className="p-4 rounded-lg bg-wl-primary-500/10 border border-wl-primary-500/20 animate-in fade-in duration-300">
          <div className="flex gap-2 items-start">
            <Check className="w-4 h-4 text-wl-primary-400 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-wl-text-primary m-0">
                {DASHBOARD_PRESETS.find((p) => p.id === selected)?.name}
              </p>
              <p className="text-xs text-wl-text-secondary m-0">
                You can customize your dashboard after launch
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-wl-text-tertiary">
        <span>UP NEXT: Setup</span>
        <span>→</span>
        <span>Complete</span>
      </div>
    </div>
  );
}
