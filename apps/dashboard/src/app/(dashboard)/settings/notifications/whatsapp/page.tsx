"use client";

import { useState } from "react";
import { useApiList, useApiMutation } from "@/hooks/use-api";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Header } from "@/components/layout/header";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Edit,
  Trash2,
  Plus,
  RefreshCw as Sync,
  CheckCircle,
  AlertCircle,
  Clock,
  Eye,
} from "lucide-react";

type TemplateCategory = "UTILITY" | "MARKETING" | "AUTHENTICATION";
type TemplateStatus = "PENDING" | "APPROVED" | "REJECTED";
type ComponentType = "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
type ComponentSubType =
  | "text"
  | "image"
  | "video"
  | "document"
  | "quick_reply"
  | "url"
  | "phone";

interface WhatsAppButton {
  type: "quick_reply" | "url" | "phone";
  text: string;
  value: string;
}

interface WhatsAppComponent {
  type: ComponentType;
  subType?: ComponentSubType;
  text?: string;
  buttons?: WhatsAppButton[];
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  status: TemplateStatus;
  language: string;
  components: WhatsAppComponent[];
  variables: Array<{ placeholder: string; variable: string }>;
  createdAt: Date;
  lastEdited: Date;
  rejectionReason?: string;
}

const getStatusIcon = (status: TemplateStatus) => {
  switch (status) {
    case "APPROVED":
      return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    case "PENDING":
      return <Clock className="w-4 h-4 text-amber-500" />;
    case "REJECTED":
      return <AlertCircle className="w-4 h-4 text-red-500" />;
  }
};

const getStatusVariant = (status: TemplateStatus) => {
  switch (status) {
    case "APPROVED":
      return "success";
    case "PENDING":
      return "warning";
    case "REJECTED":
      return "danger";
    default:
      return "default";
  }
};

interface TemplateModalProps {
  template?: WhatsAppTemplate;
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: WhatsAppTemplate) => void;
}

const TemplateModal = ({
  template,
  isOpen,
  onClose,
  onSave,
}: TemplateModalProps) => {
  const [name, setName] = useState(template?.name || "");
  const [category, setCategory] = useState<TemplateCategory>(
    template?.category || "UTILITY",
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="border border-wl-border-default bg-wl-bg-surface w-full max-w-2xl mx-4 max-h-96 overflow-y-auto">
        <CardHeader>
          <CardTitle>
            {template ? "Edit WhatsApp Template" : "Create WhatsApp Template"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-white block mb-2">
              Template Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Order Confirmation"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-white block mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TemplateCategory)}
              className="w-full px-3 py-2 bg-wl-bg-elevated text-white border border-wl-border-default rounded-md text-sm"
            >
              <option value="UTILITY">Utility</option>
              <option value="MARKETING">Marketing</option>
              <option value="AUTHENTICATION">Authentication</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onSave({
                  ...template!,
                  name,
                  category,
                  lastEdited: new Date(),
                });
                onClose();
              }}
            >
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default function WhatsAppPage() {
  const {
    items: templates,
    loading,
    error,
    refetch,
  } = useApiList<WhatsAppTemplate>("/api/v4/notifications/whatsapp-templates");
  const { execute: deleteTemplate } = useApiMutation(
    "DELETE",
    "/api/v4/notifications/whatsapp-templates/:id",
  );
  const { execute: syncTemplates } = useApiMutation(
    "POST",
    "/api/v4/notifications/whatsapp-templates/sync",
  );

  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncTemplates({});
      refetch();
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteTemplate({ id });
    refetch();
  };

  const TEMPLATES: WhatsAppTemplate[] = templates ?? [];

  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title="WhatsApp Template Manager"
        subtitle="Create and manage WhatsApp Business templates"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Filter & Actions */}
        <Card className="border border-wl-border-default bg-wl-bg-surface mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Filter by Category
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    ["all", "UTILITY", "MARKETING", "AUTHENTICATION"] as const
                  ).map((category) => (
                    <button
                      key={category}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                        category === "all"
                          ? "bg-blue-500 text-white"
                          : "bg-wl-bg-elevated text-white hover:bg-wl-bg-overlay",
                      )}
                    >
                      {category === "all" ? "All" : category}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={handleSync}
                  disabled={syncing}
                >
                  <Sync
                    className={cn("w-4 h-4 mr-2", syncing && "animate-spin")}
                  />
                  {syncing ? "Syncing..." : "Sync with Meta"}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setSelectedTemplate(undefined);
                    setIsModalOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Template
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Templates Table */}
        <Card className="border border-wl-border-default bg-wl-bg-surface">
          <CardHeader>
            <CardTitle>
              {TEMPLATES.length} Template
              {TEMPLATES.length !== 1 ? "s" : ""}
            </CardTitle>
            <CardDescription>All WhatsApp templates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Variables</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Last Edited</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TEMPLATES.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <p className="text-gray-400 text-sm">
                          No templates found
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    TEMPLATES.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {template.name}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              ID: {template.id}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">{template.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(template.status)}
                            <span
                              className={cn(
                                "text-sm font-medium",
                                template.status === "APPROVED" &&
                                  "text-emerald-500",
                                template.status === "PENDING" &&
                                  "text-amber-500",
                                template.status === "REJECTED" &&
                                  "text-red-500",
                              )}
                            >
                              {template.status}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-400">
                            {template.variables.length}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-400">
                            {template.language.toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-400">
                            {template.lastEdited.toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            {template.status === "REJECTED" && (
                              <button
                                className="p-2 hover:bg-wl-bg-elevated rounded-lg transition-colors"
                                title={template.rejectionReason}
                              >
                                <AlertCircle className="w-4 h-4 text-red-500" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedTemplate(template);
                                setIsModalOpen(true);
                              }}
                              className="p-2 hover:bg-wl-bg-elevated rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4 text-gray-400" />
                            </button>
                            <button
                              onClick={() => handleDelete(template.id)}
                              className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Template Detail Cards */}
        <div className="mt-8">
          <h3 className="text-lg font-bold text-white mb-4">
            Template Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TEMPLATES.map((template) => (
              <Card
                key={template.id}
                className="border border-wl-border-default bg-wl-bg-surface"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-base">
                        {template.name}
                      </CardTitle>
                      <CardDescription>
                        Category: {template.category}
                      </CardDescription>
                    </div>
                    <Badge variant={getStatusVariant(template.status) as any}>
                      {template.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {template.components.map((component, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-wl-bg-elevated rounded-lg border border-wl-border-default"
                    >
                      <p className="text-xs font-semibold text-gray-400 uppercase mb-2">
                        {component.type}
                      </p>
                      {component.text && (
                        <p className="text-sm text-white whitespace-pre-wrap">
                          {component.text}
                        </p>
                      )}
                      {component.buttons && (
                        <div className="space-y-2 mt-2">
                          {component.buttons.map((btn, bidx) => (
                            <div
                              key={bidx}
                              className="flex items-center gap-2 text-xs text-gray-400"
                            >
                              <span className="px-2 py-1 bg-blue-500/10 rounded text-blue-500">
                                [{btn.type}]
                              </span>
                              <span>{btn.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {template.rejectionReason && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-xs font-semibold text-red-500 mb-1">
                        Rejection Reason:
                      </p>
                      <p className="text-xs text-gray-400">
                        {template.rejectionReason}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Template Modal */}
        <TemplateModal
          template={selectedTemplate}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={(template) => {
            setIsModalOpen(false);
            refetch();
          }}
        />
      </main>
    </div>
  );
}
