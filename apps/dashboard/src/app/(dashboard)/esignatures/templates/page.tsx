"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useApiList } from "@/hooks/use-api";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Grid3x3, List, Plus } from "lucide-react";

interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  documentCount: number;
  signatureFields: number;
  usageCount: number;
  version: number;
  lastUsed?: string;
  createdDate: string;
  updatedDate: string;
  isActive: boolean;
}

const categoryColors: Record<
  string,
  "primary" | "success" | "info" | "warning" | "danger" | "default"
> = {
  NDA: "primary",
  EMPLOYMENT: "success",
  CONTRACT: "info",
  FINANCIAL: "warning",
  REAL_ESTATE: "danger",
  HEALTHCARE: "default",
  CUSTOM: "default",
};

function TemplateGrid({
  templates,
  viewMode,
}: {
  templates: Template[];
  viewMode: "grid" | "list";
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );

  if (viewMode === "list") {
    return (
      <>
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardHeader className="border-b border-wl-border-default">
            <CardTitle className="text-base text-white">Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default">
                    <th className="text-left py-3 px-4 font-medium text-gray-400">
                      Name
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-400">
                      Category
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-400">
                      Documents
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-400">
                      Fields
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-400">
                      Usage
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-400">
                      Version
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-400">
                      Last Used
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((tpl) => (
                    <tr
                      key={tpl.id}
                      className="border-b border-wl-border-default hover:bg-wl-bg-elevated transition-colors cursor-pointer"
                      onClick={() => setSelectedTemplate(tpl)}
                    >
                      <td className="py-3 px-4 text-white font-medium">
                        <button className="hover:underline text-blue-500">
                          {tpl.name}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={categoryColors[tpl.category] || "default"}
                        >
                          {tpl.category}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-gray-400">
                        {tpl.documentCount}
                      </td>
                      <td className="py-3 px-4 text-gray-400">
                        {tpl.signatureFields}
                      </td>
                      <td className="py-3 px-4 text-gray-400">
                        {tpl.usageCount}x
                      </td>
                      <td className="py-3 px-4 text-gray-400">
                        v{tpl.version}
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-xs">
                        {tpl.lastUsed
                          ? new Date(tpl.lastUsed).toLocaleDateString()
                          : "Never"}
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((tpl) => (
          <Card
            key={tpl.id}
            className="bg-wl-bg-surface border-wl-border-default hover:border-blue-500/30 transition-colors cursor-pointer"
            onClick={() => setSelectedTemplate(tpl)}
          >
            <div className="h-32 bg-gradient-to-br from-blue-500/10 to-emerald-500/10 flex items-center justify-center border-b border-wl-border-default">
              <FileText className="text-blue-500" size={48} />
            </div>
            <CardContent className="pt-4">
              <h3 className="font-semibold text-white mb-2">{tpl.name}</h3>
              <div className="flex items-center justify-between mb-3">
                <Badge variant={categoryColors[tpl.category] || "default"}>
                  {tpl.category}
                </Badge>
                {tpl.isActive && <Badge variant="success">Active</Badge>}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-gray-400 mb-3">
                <div>
                  <p className="font-medium">Docs</p>
                  <p>{tpl.documentCount}</p>
                </div>
                <div>
                  <p className="font-medium">Fields</p>
                  <p>{tpl.signatureFields}</p>
                </div>
                <div>
                  <p className="font-medium">Used</p>
                  <p>{tpl.usageCount}x</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 text-xs"
                >
                  Use
                </Button>
                <Button variant="ghost" size="sm" className="flex-1 text-xs">
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
  template: Template;
  onClose: () => void;
}) {
  return (
    <Card className="mt-6 bg-wl-bg-surface border-wl-border-default">
      <CardHeader className="border-b border-wl-border-default flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base text-white">
            {template.name}
          </CardTitle>
          <p className="text-xs text-gray-400 mt-1">ID: {template.id}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-3 gap-6">
          {/* General Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-3">
              General
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-400 text-xs">Category</p>
                <Badge
                  variant={categoryColors[template.category] || "default"}
                  className="mt-1"
                >
                  {template.category}
                </Badge>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Description</p>
                <p className="text-white text-sm">{template.description}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Status</p>
                <Badge
                  variant={template.isActive ? "success" : "default"}
                  className="mt-1"
                >
                  {template.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Usage Stats */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Usage</h3>
            <div className="space-y-3">
              <div className="p-3 bg-wl-bg-elevated rounded-lg border border-wl-border-default">
                <p className="text-xs text-gray-400 mb-1">Total Usage</p>
                <p className="text-2xl font-bold text-white">
                  {template.usageCount}
                </p>
                <p className="text-xs text-gray-400 mt-1">times used</p>
              </div>
              <div className="p-3 bg-wl-bg-elevated rounded-lg border border-wl-border-default">
                <p className="text-xs text-gray-400 mb-1">Last Used</p>
                <p className="text-sm font-medium text-white">
                  {template.lastUsed
                    ? new Date(template.lastUsed).toLocaleDateString()
                    : "Never"}
                </p>
              </div>
            </div>
          </div>

          {/* Version & Fields */}
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-3">
              Details
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-gray-400 text-xs">Version</p>
                <p className="text-white font-medium mt-1">
                  v{template.version}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Documents</p>
                <p className="text-white font-medium mt-1">
                  {template.documentCount}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Signature Fields</p>
                <p className="text-white font-medium mt-1">
                  {template.signatureFields}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Created</p>
                <p className="text-white text-xs mt-1">
                  {new Date(template.createdDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-2 justify-end">
          <Button variant="secondary" className="text-xs">
            View Documents
          </Button>
          <Button variant="secondary" className="text-xs">
            Edit Template
          </Button>
          <Button variant="primary" className="text-xs">
            Use Template
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TemplatesPage() {
  const {
    items: data,
    loading,
    error,
    refetch,
  } = useApiList<Template>("/api/v4/signing-templates");
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
      ? data
      : data.filter((t) => t.category === filterCategory);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="min-h-screen bg-wl-bg-root p-6 space-y-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Template Library
            </h1>
            <p className="text-gray-400">
              Manage and organize signing templates
            </p>
          </div>
          <Button variant="primary" className="flex items-center gap-2">
            <Plus size={16} /> Create Template
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">
                Total Templates
              </span>
              <FileText className="text-blue-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-white">{data.length}</p>
            <p className="text-gray-400 text-xs mt-2">Available templates</p>
          </CardContent>
        </Card>

        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Active</span>
              <div className="w-5 h-5 rounded-full bg-emerald-500"></div>
            </div>
            <p className="text-3xl font-bold text-white">
              {data.filter((t) => t.isActive).length}
            </p>
            <p className="text-gray-400 text-xs mt-2">Ready to use</p>
          </CardContent>
        </Card>

        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">
                Avg. Usage
              </span>
              <div className="w-5 h-5 rounded-full bg-blue-500"></div>
            </div>
            <p className="text-3xl font-bold text-white">
              {data.length > 0
                ? Math.round(
                    data.reduce((sum, t) => sum + t.usageCount, 0) /
                      data.length,
                  )
                : 0}
            </p>
            <p className="text-gray-400 text-xs mt-2">Times used</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className="bg-wl-bg-surface border-wl-border-default">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-400">
                Filter:
              </label>
              <div className="flex gap-2 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      filterCategory === cat
                        ? "bg-blue-500 text-white"
                        : "bg-wl-bg-elevated text-gray-400 hover:text-white",
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 border-l border-wl-border-default pl-4">
              <label className="text-sm font-medium text-gray-400">View:</label>
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === "grid"
                    ? "bg-blue-500 text-white"
                    : "hover:bg-wl-bg-elevated text-gray-400",
                )}
                title="Grid view"
              >
                <Grid3x3 size={18} />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "p-1.5 rounded transition-colors",
                  viewMode === "list"
                    ? "bg-blue-500 text-white"
                    : "hover:bg-wl-bg-elevated text-gray-400",
                )}
                title="List view"
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates */}
      {filteredTemplates.length > 0 ? (
        <TemplateGrid templates={filteredTemplates} viewMode={viewMode} />
      ) : (
        <Card className="bg-wl-bg-surface border-wl-border-default text-center py-12">
          <CardContent className="space-y-4">
            <FileText className="mx-auto text-gray-600" size={48} />
            <p className="text-gray-400">No templates found in this category</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
