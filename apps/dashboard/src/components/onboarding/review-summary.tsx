"use client";

import { forwardRef, useState, type HTMLAttributes } from "react";
import { ChevronDown, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ReviewSummarySection {
  id: string;
  title: string;
  content: React.ReactNode;
  onEdit?: () => void;
}

interface ReviewSummaryProps extends HTMLAttributes<HTMLDivElement> {
  deployment?: {
    type: "cloud" | "self-managed";
  };
  company?: {
    name: string;
    size: string;
    website?: string;
  };
  industry?: {
    label: string;
    custom?: string;
  };
  goals?: string[];
  integrations?: {
    ids: string[];
    count: number;
    topNames?: string[];
  };
  dashboard?: {
    name: string;
    preview?: string;
  };
  data?: {
    driversAdded?: number;
    vehiclesAdded?: number;
    csvImported?: boolean;
  };
  onEditDeployment?: () => void;
  onEditCompany?: () => void;
  onEditIndustry?: () => void;
  onEditGoals?: () => void;
  onEditIntegrations?: () => void;
  onEditDashboard?: () => void;
  onEditData?: () => void;
}

const ReviewSummary = forwardRef<HTMLDivElement, ReviewSummaryProps>(
  (
    {
      deployment,
      company,
      industry,
      goals,
      integrations,
      dashboard,
      data,
      onEditDeployment,
      onEditCompany,
      onEditIndustry,
      onEditGoals,
      onEditIntegrations,
      onEditDashboard,
      onEditData,
      className,
      ...props
    },
    ref,
  ) => {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(
      new Set([
        "deployment",
        "company",
        "industry",
        "goals",
        "integrations",
        "dashboard",
        "data",
      ]),
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

    const renderSection = (
      id: string,
      title: string,
      content: React.ReactNode,
      onEdit?: () => void,
    ) => {
      const isExpanded = expandedSections.has(id);
      return (
        <div
          key={id}
          className="border border-wl-border-subtle rounded-lg overflow-hidden"
        >
          {/* Header */}
          <button
            onClick={() => toggleSection(id)}
            className="w-full flex items-center justify-between gap-3 p-4 bg-wl-bg-overlay hover:bg-wl-bg-surface/50 transition-colors text-left"
          >
            <h3 className="text-sm font-semibold text-wl-text-primary">
              {title}
            </h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="gap-1 px-2 py-1"
                >
                  <Edit2 className="w-3 h-3" />
                  <span className="text-xs">Edit</span>
                </Button>
              )}
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-wl-text-tertiary transition-transform flex-shrink-0",
                  isExpanded && "rotate-180",
                )}
              />
            </div>
          </button>

          {/* Content */}
          {isExpanded && (
            <div className="border-t border-wl-border-subtle p-4 bg-wl-bg-surface/30 space-y-3">
              {content}
            </div>
          )}
        </div>
      );
    };

    return (
      <div ref={ref} className={cn("w-full space-y-3", className)} {...props}>
        {/* Deployment */}
        {deployment &&
          renderSection(
            "deployment",
            "Deployment",
            <div className="flex items-center gap-2">
              <Badge variant={deployment.type === "cloud" ? "info" : "default"}>
                {deployment.type === "cloud" ? "Cloud Hosted" : "Self-Managed"}
              </Badge>
              <p className="text-xs text-wl-text-tertiary">
                {deployment.type === "cloud"
                  ? "Managed by Witylogix"
                  : "Hosted on your infrastructure"}
              </p>
            </div>,
            onEditDeployment,
          )}

        {/* Company */}
        {company &&
          renderSection(
            "company",
            "Company Information",
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-wl-text-tertiary mb-1">Name</p>
                <p className="text-sm font-medium text-wl-text-primary">
                  {company.name}
                </p>
              </div>
              <div>
                <p className="text-xs text-wl-text-tertiary mb-1">Size</p>
                <p className="text-sm font-medium text-wl-text-primary">
                  {company.size}
                </p>
              </div>
              {company.website && (
                <div>
                  <p className="text-xs text-wl-text-tertiary mb-1">Website</p>
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-wl-primary-400 hover:text-wl-primary-300 truncate"
                  >
                    {company.website}
                  </a>
                </div>
              )}
            </div>,
            onEditCompany,
          )}

        {/* Industry */}
        {industry &&
          renderSection(
            "industry",
            "Industry",
            <div className="flex items-center gap-2">
              <Badge variant="primary">{industry.label}</Badge>
              {industry.custom && (
                <p className="text-xs text-wl-text-tertiary">
                  ({industry.custom})
                </p>
              )}
            </div>,
            onEditIndustry,
          )}

        {/* Goals */}
        {goals &&
          goals.length > 0 &&
          renderSection(
            "goals",
            "Goals",
            <div className="flex flex-wrap gap-2">
              {goals.map((goal) => (
                <Badge key={goal} variant="default">
                  {goal}
                </Badge>
              ))}
            </div>,
            onEditGoals,
          )}

        {/* Integrations */}
        {integrations &&
          renderSection(
            "integrations",
            "Integrations",
            <div className="space-y-2">
              <p className="text-sm font-semibold text-wl-text-primary">
                {integrations.count} integration
                {integrations.count !== 1 ? "s" : ""} selected
              </p>
              {integrations.topNames && integrations.topNames.length > 0 && (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {integrations.topNames.slice(0, 5).map((name) => (
                      <Badge key={name} variant="default" className="text-xs">
                        {name}
                      </Badge>
                    ))}
                  </div>
                  {integrations.count > 5 && (
                    <p className="text-xs text-wl-text-tertiary">
                      +{integrations.count - 5} more
                    </p>
                  )}
                </>
              )}
            </div>,
            onEditIntegrations,
          )}

        {/* Dashboard */}
        {dashboard &&
          renderSection(
            "dashboard",
            "Dashboard Layout",
            <div className="space-y-2">
              <p className="text-sm font-medium text-wl-text-primary">
                {dashboard.name}
              </p>
              {dashboard.preview && (
                <div className="w-full aspect-video bg-wl-bg-overlay rounded border border-wl-border-subtle overflow-hidden p-2">
                  <div
                    dangerouslySetInnerHTML={{ __html: dashboard.preview }}
                    className="w-full h-full"
                  />
                </div>
              )}
            </div>,
            onEditDashboard,
          )}

        {/* Data */}
        {data &&
          renderSection(
            "data",
            "Data Import",
            <div className="space-y-2">
              {data.driversAdded !== undefined && (
                <p className="text-sm text-wl-text-primary">
                  <span className="font-semibold">{data.driversAdded}</span>{" "}
                  driver{data.driversAdded !== 1 ? "s" : ""} added
                </p>
              )}
              {data.vehiclesAdded !== undefined && (
                <p className="text-sm text-wl-text-primary">
                  <span className="font-semibold">{data.vehiclesAdded}</span>{" "}
                  vehicle{data.vehiclesAdded !== 1 ? "s" : ""} added
                </p>
              )}
              {data.csvImported && (
                <Badge variant="success" className="w-fit">
                  CSV imported
                </Badge>
              )}
            </div>,
            onEditData,
          )}
      </div>
    );
  },
);

ReviewSummary.displayName = "ReviewSummary";

export { ReviewSummary };
export type { ReviewSummaryProps };
