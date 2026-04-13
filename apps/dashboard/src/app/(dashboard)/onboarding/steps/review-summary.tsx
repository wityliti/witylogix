"use client";

import { cn } from "@/lib/utils";
import {
  Cloud,
  Server,
  Building2,
  Zap,
  PlugZap,
  LayoutGrid,
  Database,
  Check,
  ChevronDown,
  ChevronUp,
  Edit2,
  Rocket,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { OnboardingData, DeploymentType, Industry, Goal } from "../types";

interface ReviewSummaryProps {
  data: OnboardingData;
  onEdit: (section: string) => void;
  onComplete: () => void;
  isLoading?: boolean;
}

const GOAL_LABELS: Record<Goal, string> = {
  "route-optimization": "Route Optimization",
  "fleet-tracking": "Fleet Tracking",
  "last-mile": "Last-Mile Delivery",
  "multi-carrier": "Multi-Carrier Support",
  "order-management": "Order Management",
  notifications: "Notifications",
  analytics: "Analytics & Reporting",
  "erp-integration": "ERP Integration",
  "driver-management": "Driver Management",
  compliance: "Compliance & Safety",
};

const INDUSTRY_LABELS: Record<Industry, string> = {
  ecommerce: "E-Commerce",
  "food-beverage": "Food & Beverage",
  healthcare: "Healthcare",
  logistics: "Logistics",
  "field-service": "Field Service",
  manufacturing: "Manufacturing",
  courier: "Courier",
  grocery: "Grocery",
  custom: "Custom",
};

interface ReviewSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string; [key: string]: unknown }>;
}

const REVIEW_SECTIONS: ReviewSection[] = [
  { id: "deployment", title: "Deployment", icon: Cloud },
  { id: "company", title: "Company", icon: Building2 },
  { id: "goals", title: "Goals", icon: Zap },
  { id: "integrations", title: "Integrations", icon: PlugZap },
  { id: "dashboard", title: "Dashboard Layout", icon: LayoutGrid },
  { id: "data", title: "Data", icon: Database },
];

export function ReviewSummary({
  data,
  onEdit,
  onComplete,
  isLoading = false,
}: ReviewSummaryProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["company", "goals", "integrations", "dashboard"])
  );

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  return (
    <div className="flex flex-col gap-6 py-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-wl-text-primary m-0">
          Review your setup
        </h2>
        <p className="text-sm text-wl-text-secondary m-0">
          Everything looks good!
        </p>
      </div>

      {/* Summary Alert */}
      <div className="p-4 rounded-lg bg-wl-success-500/10 border border-wl-success-500/20 flex gap-3 items-start">
        <Check className="w-4 h-4 text-wl-success-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-wl-success-300 m-0 mb-1">
            Ready to launch
          </p>
          <p className="text-xs text-wl-success-200 m-0">
            Your workspace configuration is complete. Click below to finalize
            and start using Witylogix.
          </p>
        </div>
      </div>

      {/* Review Sections */}
      <div className="flex flex-col gap-3 max-h-[450px] overflow-y-auto">
        {/* Deployment Section */}
        {data.deploymentType && (
          <div className="rounded-lg border border-wl-border-default bg-wl-bg-surface/50 overflow-hidden">
            <button
              onClick={() => toggleSection("deployment")}
              className={cn(
                "w-full px-4 py-3 flex items-center justify-between",
                "hover:bg-wl-bg-surface/70 transition-colors",
                "border-b border-wl-border-subtle"
              )}
            >
              <div className="flex items-center gap-3">
                <Cloud className="w-4 h-4 text-wl-text-tertiary" />
                <span className="text-sm font-semibold text-wl-text-primary">
                  Deployment
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="primary">
                  {data.deploymentType === "cloud" ? "Cloud" : "Self-Managed"}
                </Badge>
                {expandedSections.has("deployment") ? (
                  <ChevronUp className="w-4 h-4 text-wl-text-tertiary" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-wl-text-tertiary" />
                )}
              </div>
            </button>
            {expandedSections.has("deployment") && (
              <div className="px-4 py-3 flex items-start justify-between">
                <div className="text-xs text-wl-text-secondary">
                  <p className="m-0 mb-1">
                    {data.deploymentType === "cloud"
                      ? "Fully managed SaaS deployment"
                      : "Self-managed on your infrastructure"}
                  </p>
                </div>
                <button
                  onClick={() => onEdit("deployment")}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-wl-primary-400 hover:bg-wl-primary-500/10 transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit
                </button>
              </div>
            )}
          </div>
        )}

        {/* Company Section */}
        <div className="rounded-lg border border-wl-border-default bg-wl-bg-surface/50 overflow-hidden">
          <button
            onClick={() => toggleSection("company")}
            className={cn(
              "w-full px-4 py-3 flex items-center justify-between",
              "hover:bg-wl-bg-surface/70 transition-colors",
              "border-b border-wl-border-subtle"
            )}
          >
            <div className="flex items-center gap-3">
              <Building2 className="w-4 h-4 text-wl-text-tertiary" />
              <span className="text-sm font-semibold text-wl-text-primary">
                Company
              </span>
            </div>
            {expandedSections.has("company") ? (
              <ChevronUp className="w-4 h-4 text-wl-text-tertiary" />
            ) : (
              <ChevronDown className="w-4 h-4 text-wl-text-tertiary" />
            )}
          </button>
          {expandedSections.has("company") && (
            <div className="px-4 py-3 flex items-start justify-between">
              <div className="text-xs text-wl-text-secondary space-y-1.5">
                <div>
                  <p className="m-0 text-wl-text-tertiary">Company Name</p>
                  <p className="m-0 font-medium text-wl-text-primary">
                    {data.companyName || "—"}
                  </p>
                </div>
                {data.industry && (
                  <div>
                    <p className="m-0 text-wl-text-tertiary">Industry</p>
                    <p className="m-0 font-medium text-wl-text-primary">
                      {INDUSTRY_LABELS[data.industry] || data.industry}
                    </p>
                  </div>
                )}
                {data.companySize && (
                  <div>
                    <p className="m-0 text-wl-text-tertiary">Company Size</p>
                    <p className="m-0 font-medium text-wl-text-primary">
                      {data.companySize} employees
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={() => onEdit("company")}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-wl-primary-400 hover:bg-wl-primary-500/10 transition-colors"
              >
                <Edit2 className="w-3 h-3" />
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Goals Section */}
        {data.goals.length > 0 && (
          <div className="rounded-lg border border-wl-border-default bg-wl-bg-surface/50 overflow-hidden">
            <button
              onClick={() => toggleSection("goals")}
              className={cn(
                "w-full px-4 py-3 flex items-center justify-between",
                "hover:bg-wl-bg-surface/70 transition-colors",
                "border-b border-wl-border-subtle"
              )}
            >
              <div className="flex items-center gap-3">
                <Zap className="w-4 h-4 text-wl-text-tertiary" />
                <span className="text-sm font-semibold text-wl-text-primary">
                  Goals
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-wl-text-tertiary">
                  {data.goals.length}
                </span>
                {expandedSections.has("goals") ? (
                  <ChevronUp className="w-4 h-4 text-wl-text-tertiary" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-wl-text-tertiary" />
                )}
              </div>
            </button>
            {expandedSections.has("goals") && (
              <div className="px-4 py-3">
                <div className="flex flex-wrap gap-2 mb-3">
                  {data.goals.map((goal) => (
                    <Badge key={goal} variant="info">
                      {GOAL_LABELS[goal] || goal}
                    </Badge>
                  ))}
                </div>
                <button
                  onClick={() => onEdit("goals")}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-wl-primary-400 hover:bg-wl-primary-500/10 transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit
                </button>
              </div>
            )}
          </div>
        )}

        {/* Integrations Section */}
        {data.integrations.length > 0 && (
          <div className="rounded-lg border border-wl-border-default bg-wl-bg-surface/50 overflow-hidden">
            <button
              onClick={() => toggleSection("integrations")}
              className={cn(
                "w-full px-4 py-3 flex items-center justify-between",
                "hover:bg-wl-bg-surface/70 transition-colors",
                "border-b border-wl-border-subtle"
              )}
            >
              <div className="flex items-center gap-3">
                <PlugZap className="w-4 h-4 text-wl-text-tertiary" />
                <span className="text-sm font-semibold text-wl-text-primary">
                  Integrations
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-wl-text-tertiary">
                  {data.integrations.length}
                </span>
                {expandedSections.has("integrations") ? (
                  <ChevronUp className="w-4 h-4 text-wl-text-tertiary" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-wl-text-tertiary" />
                )}
              </div>
            </button>
            {expandedSections.has("integrations") && (
              <div className="px-4 py-3">
                <div className="flex flex-wrap gap-2 mb-3">
                  {data.integrations.slice(0, 5).map((integration) => (
                    <Badge key={integration} variant="default">
                      {integration}
                    </Badge>
                  ))}
                  {data.integrations.length > 5 && (
                    <Badge variant="default">
                      +{data.integrations.length - 5} more
                    </Badge>
                  )}
                </div>
                <button
                  onClick={() => onEdit("integrations")}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-wl-primary-400 hover:bg-wl-primary-500/10 transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit
                </button>
              </div>
            )}
          </div>
        )}

        {/* Dashboard Section */}
        {data.dashboardLayout && (
          <div className="rounded-lg border border-wl-border-default bg-wl-bg-surface/50 overflow-hidden">
            <button
              onClick={() => toggleSection("dashboard")}
              className={cn(
                "w-full px-4 py-3 flex items-center justify-between",
                "hover:bg-wl-bg-surface/70 transition-colors",
                "border-b border-wl-border-subtle"
              )}
            >
              <div className="flex items-center gap-3">
                <LayoutGrid className="w-4 h-4 text-wl-text-tertiary" />
                <span className="text-sm font-semibold text-wl-text-primary">
                  Dashboard Layout
                </span>
              </div>
              {expandedSections.has("dashboard") ? (
                <ChevronUp className="w-4 h-4 text-wl-text-tertiary" />
              ) : (
                <ChevronDown className="w-4 h-4 text-wl-text-tertiary" />
              )}
            </button>
            {expandedSections.has("dashboard") && (
              <div className="px-4 py-3">
                <div className="text-xs text-wl-text-secondary mb-3">
                  <p className="m-0 font-medium text-wl-text-primary capitalize">
                    {data.dashboardLayout.replace(/-/g, " ")}
                  </p>
                </div>
                <button
                  onClick={() => onEdit("dashboard")}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-wl-primary-400 hover:bg-wl-primary-500/10 transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Complete Action */}
      <div className="flex flex-col gap-4 pt-4 border-t border-wl-border-subtle">
        <Button
          onClick={onComplete}
          disabled={isLoading}
          variant="primary"
          size="lg"
          className="w-full gap-2"
        >
          <Rocket className="w-4 h-4" />
          {isLoading ? "Setting up your workspace..." : "Complete Setup"}
        </Button>

        {isLoading && (
          <div className="flex flex-col gap-2">
            <div className="h-1 bg-wl-bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-wl-primary-500 animate-pulse rounded-full"
                style={{
                  animation: "progress 2s ease-in-out infinite",
                }}
              />
            </div>
            <p className="text-xs text-wl-text-tertiary text-center m-0">
              Setting up your workspace...
            </p>
          </div>
        )}

        <p className="text-xs text-wl-text-tertiary text-center m-0">
          This will create your workspace and you'll be redirected to your
          dashboard
        </p>
      </div>

      <style>{`
        @keyframes progress {
          0%, 100% { width: 0; }
          50% { width: 100%; }
        }
      `}</style>
    </div>
  );
}
