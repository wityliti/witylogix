"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTemplates } from "@/hooks/use-esignatures";

function Icon({ d, size = 24 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

const categoryColors: Record<string, string> = {
  NDA: "primary",
  EMPLOYMENT: "success",
  CONTRACT: "info",
  FINANCIAL: "warning",
  REAL_ESTATE: "danger",
  HEALTHCARE: "default",
  CUSTOM: "default",
};

function TemplateGrid({ templates }: { templates: any[] }) {
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  if (viewMode === "list") {
    return (
      <>
        <Card className={cn("bg-wl-bg-elevated border-wl-border-subtle")}>
          <CardHeader className={cn("border-b border-wl-border-subtle")}>
            <CardTitle className={cn("text-base")}>Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("overflow-x-auto")}>
              <table className={cn("w-full text-sm")}>
                <thead>
                  <tr className={cn("border-b border-wl-border-subtle")}>
                    <th
                      className={cn(
                        "text-left py-3 px-4 font-medium text-wl-text-secondary"
                      )}
                    >
                      Name
                    </th>
                    <th
                      className={cn(
                        "text-left py-3 px-4 font-medium text-wl-text-secondary"
                      )}
                    >
                      Category
                    </th>
                    <th
                      className={cn(
                        "text-left py-3 px-4 font-medium text-wl-text-secondary"
                      )}
                    >
                      Documents
                    </th>
                    <th
                      className={cn(
                        "text-left py-3 px-4 font-medium text-wl-text-secondary"
                      )}
                    >
                      Fields
                    </th>
                    <th
                      className={cn(
                        "text-left py-3 px-4 font-medium text-wl-text-secondary"
                      )}
                    >
                      Usage
                    </th>
                    <th
                      className={cn(
                        "text-left py-3 px-4 font-medium text-wl-text-secondary"
                      )}
                    >
                      Version
                    </th>
                    <th
                      className={cn(
                        "text-left py-3 px-4 font-medium text-wl-text-secondary"
                      )}
                    >
                      Last Used
                    </th>
                    <th className={cn("w-10")}></th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((tpl) => (
                    <tr
                      key={tpl.id}
                      className={cn(
                        "border-b border-wl-border-subtle hover:bg-wl-bg-overlay transition-colors"
                      )}
                    >
                      <td className={cn("py-3 px-4 text-wl-text-primary font-medium")}>
                        <button
                          onClick={() => setSelectedTemplate(tpl)}
                          className={cn("hover:underline text-wl-brand")}
                        >
                          {tpl.name}
                        </button>
                      </td>
                      <td className={cn("py-3 px-4")}>
                        <Badge variant={categoryColors[tpl.category] as any}>
                          {tpl.category}
                        </Badge>
                      </td>
                      <td className={cn("py-3 px-4 text-wl-text-secondary")}>
                        {tpl.documentCount}
                      </td>
                      <td className={cn("py-3 px-4 text-wl-text-secondary")}>
                        {tpl.signatureFields}
                      </td>
                      <td className={cn("py-3 px-4 text-wl-text-secondary")}>
                        {tpl.usageCount}x
                      </td>
                      <td className={cn("py-3 px-4 text-wl-text-secondary")}>
                        v{tpl.version}
                      </td>
                      <td className={cn("py-3 px-4 text-wl-text-secondary text-xs")}>
                        {tpl.lastUsed
                          ? new Date(tpl.lastUsed).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td className={cn("py-3 px-4")}>
                        <button className={cn("text-wl-text-secondary hover:text-wl-text-primary")}>
                          <Icon d="M12 5v14m7-7H5" size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {selectedTemplate && (
          <TemplateDetailCard
            template={selectedTemplate}
            onClose={() => setSelectedTemplate(null)}
          />
        )}
      </>
    );
  }

  // Grid view
  return (
    <>
      <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4")}>
        {templates.map((tpl) => (
          <Card
            key={tpl.id}
            className={cn(
              "bg-wl-bg-elevated border-wl-border-subtle hover:border-wl-border-active transition-colors cursor-pointer"
            )}
            onClick={() => setSelectedTemplate(tpl)}
          >
            <div
              className={cn(
                "h-32 bg-gradient-to-br from-wl-brand/20 to-wl-status-success/20 flex items-center justify-center"
              )}
            >
              <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" size={48} />
            </div>
            <CardContent className={cn("pt-4")}>
              <h3 className={cn("font-semibold text-wl-text-primary mb-2")}>
                {tpl.name}
              </h3>
              <div className={cn("flex items-center justify-between mb-3")}>
                <Badge variant={categoryColors[tpl.category] as any}>
                  {tpl.category}
                </Badge>
                {tpl.isActive && (
                  <Badge variant="success">Active</Badge>
                )}
              </div>
              <div
                className={cn(
                  "grid grid-cols-3 gap-2 text-xs text-wl-text-secondary mb-3"
                )}
              >
                <div>
                  <p className={cn("font-medium")}>Docs</p>
                  <p>{tpl.documentCount}</p>
                </div>
                <div>
                  <p className={cn("font-medium")}>Fields</p>
                  <p>{tpl.signatureFields}</p>
                </div>
                <div>
                  <p className={cn("font-medium")}>Used</p>
                  <p>{tpl.usageCount}x</p>
                </div>
              </div>
              <div className={cn("flex gap-2")}>
                <Button variant="secondary" size="sm" className={cn("flex-1")}>
                  Use
                </Button>
                <Button variant="ghost" size="sm" className={cn("flex-1")}>
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedTemplate && (
        <TemplateDetailCard
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
        />
      )}
    </>
  );
}

function TemplateDetailCard({
  template,
  onClose,
}: {
  template: any;
  onClose: () => void;
}) {
  return (
    <Card className={cn("mt-6 bg-wl-bg-elevated border-wl-border-subtle")}>
      <CardHeader className={cn("border-b border-wl-border-subtle flex flex-row items-center justify-between")}>
        <div>
          <CardTitle className={cn("text-base")}>{template.name}</CardTitle>
          <p className={cn("text-xs text-wl-text-secondary mt-1")}>
            ID: {template.id}
          </p>
        </div>
        <button
          onClick={onClose}
          className={cn("text-wl-text-secondary hover:text-wl-text-primary")}
        >
          ✕
        </button>
      </CardHeader>
      <CardContent className={cn("pt-6")}>
        <div className={cn("grid grid-cols-3 gap-6")}>
          {/* General Info */}
          <div>
            <h3 className={cn("text-sm font-semibold text-wl-text-secondary mb-3")}>
              General
            </h3>
            <div className={cn("space-y-3 text-sm")}>
              <div>
                <p className={cn("text-wl-text-secondary text-xs")}>
                  Category
                </p>
                <Badge
                  variant={categoryColors[template.category] as any}
                  className={cn("mt-1")}
                >
                  {template.category}
                </Badge>
              </div>
              <div>
                <p className={cn("text-wl-text-secondary text-xs mb-1")}>
                  Description
                </p>
                <p className={cn("text-wl-text-primary")}>
                  {template.description}
                </p>
              </div>
              <div>
                <p className={cn("text-wl-text-secondary text-xs")}>Status</p>
                <Badge
                  variant={template.isActive ? "success" : "default"}
                  className={cn("mt-1")}
                >
                  {template.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Usage Stats */}
          <div>
            <h3 className={cn("text-sm font-semibold text-wl-text-secondary mb-3")}>
              Usage
            </h3>
            <div className={cn("space-y-3")}>
              <div className={cn("p-3 bg-wl-bg-overlay rounded-md")}>
                <p className={cn("text-xs text-wl-text-secondary mb-1")}>
                  Total Usage
                </p>
                <p className={cn("text-2xl font-bold text-wl-text-primary")}>
                  {template.usageCount}
                </p>
                <p className={cn("text-xs text-wl-text-secondary mt-1")}>
                  times used
                </p>
              </div>
              <div className={cn("p-3 bg-wl-bg-overlay rounded-md")}>
                <p className={cn("text-xs text-wl-text-secondary mb-1")}>
                  Last Used
                </p>
                <p className={cn("text-sm font-medium text-wl-text-primary")}>
                  {template.lastUsed
                    ? new Date(template.lastUsed).toLocaleDateString()
                    : "Never"}
                </p>
              </div>
            </div>
          </div>

          {/* Version & Fields */}
          <div>
            <h3 className={cn("text-sm font-semibold text-wl-text-secondary mb-3")}>
              Details
            </h3>
            <div className={cn("space-y-3 text-sm")}>
              <div>
                <p className={cn("text-wl-text-secondary text-xs")}>
                  Version
                </p>
                <p className={cn("text-wl-text-primary font-medium mt-1")}>
                  v{template.version}
                </p>
              </div>
              <div>
                <p className={cn("text-wl-text-secondary text-xs")}>
                  Documents
                </p>
                <p className={cn("text-wl-text-primary font-medium mt-1")}>
                  {template.documentCount}
                </p>
              </div>
              <div>
                <p className={cn("text-wl-text-secondary text-xs")}>
                  Signature Fields
                </p>
                <p className={cn("text-wl-text-primary font-medium mt-1")}>
                  {template.signatureFields}
                </p>
              </div>
              <div>
                <p className={cn("text-wl-text-secondary text-xs")}>
                  Created
                </p>
                <p className={cn("text-wl-text-primary text-xs mt-1")}>
                  {new Date(template.createdDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Version History */}
        <div className={cn("mt-6 pt-6 border-t border-wl-border-subtle")}>
          <h3 className={cn("text-sm font-semibold text-wl-text-secondary mb-3")}>
            Version History
          </h3>
          <div className={cn("space-y-2 text-xs")}>
            {[
              { v: template.version, date: template.updatedDate, status: "Current" },
              {
                v: template.version - 1,
                date: "2026-02-01T10:00:00Z",
                status: "Previous",
              },
              { v: 1, date: template.createdDate, status: "Original" },
            ].map((ver, idx) => (
              <div
                key={idx}
                className={cn(
                  "p-2 bg-wl-bg-overlay rounded flex items-center justify-between"
                )}
              >
                <span>v{ver.v}</span>
                <span className={cn("text-wl-text-secondary")}>
                  {new Date(ver.date).toLocaleDateString()}
                </span>
                <Badge variant={ver.status === "Current" ? "success" : "default"}>
                  {ver.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className={cn("mt-6 flex gap-2 justify-end")}>
          <Button variant="secondary">View Documents</Button>
          <Button variant="secondary">Edit Template</Button>
          <Button variant="primary">Use Template</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TemplatesPage() {
  const { templates, loading } = useTemplates();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");

  const categories = [
    "ALL",
    "NDA",
    "EMPLOYMENT",
    "CONTRACT",
    "FINANCIAL",
    "REAL_ESTATE",
    "HEALTHCARE",
  ];

  const filteredTemplates =
    filterCategory === "ALL"
      ? templates
      : templates.filter((t) => t.category === filterCategory);

  return (
    <div className={cn("p-6 space-y-6")}>
      {/* Header */}
      <div className={cn("flex items-center justify-between")}>
        <div>
          <h1 className={cn("text-2xl font-bold text-wl-text-primary")}>
            Template Library
          </h1>
          <p className={cn("text-sm text-wl-text-secondary mt-1")}>
            Manage and organize signing templates
          </p>
        </div>
        <Button variant="primary">
          Create Template
        </Button>
      </div>

      {/* Controls */}
      <Card className={cn("bg-wl-bg-elevated border-wl-border-subtle")}>
        <CardContent className={cn("pt-6")}>
          <div className={cn("flex items-center justify-between gap-4")}>
            <div className={cn("flex items-center gap-4")}>
              <label className={cn("text-sm font-medium text-wl-text-secondary")}>
                Filter:
              </label>
              <div className={cn("flex gap-2")}>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      filterCategory === cat
                        ? "bg-wl-brand text-white"
                        : "bg-wl-bg-overlay text-wl-text-secondary hover:text-wl-text-primary"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className={cn("flex items-center gap-2 border-l border-wl-border-subtle pl-4")}>
              <label className={cn("text-sm font-medium text-wl-text-secondary")}>
                View:
              </label>
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === "grid"
                    ? "bg-wl-brand text-white"
                    : "hover:bg-wl-bg-overlay text-wl-text-secondary"
                )}
                title="Grid view"
              >
                <Icon d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm2 0v12h12V6H6z" size={18} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === "list"
                    ? "bg-wl-brand text-white"
                    : "hover:bg-wl-bg-overlay text-wl-text-secondary"
                )}
                title="List view"
              >
                <Icon d="M4 6h16M4 12h16M4 18h16" size={18} />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates */}
      <TemplateGrid templates={filteredTemplates} />

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <Card className={cn("bg-wl-bg-elevated border-wl-border-subtle text-center py-12")}>
          <CardContent className={cn("space-y-4")}>
            <Icon d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" size={48} />
            <p className={cn("text-wl-text-secondary")}>
              No templates found in this category
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
