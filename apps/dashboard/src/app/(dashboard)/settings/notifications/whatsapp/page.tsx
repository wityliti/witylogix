'use client';

import { useState } from 'react';
import { useApiList, useApiMutation } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Header } from '@/components/layout/header';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Edit,
  Trash2,
  Plus,
  Sync,
  CheckCircle,
  AlertCircle,
  Clock,
  Eye,
} from 'lucide-react';

type TemplateCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
type TemplateStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ComponentType = 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
type ComponentSubType = 'text' | 'image' | 'video' | 'document' | 'quick_reply' | 'url' | 'phone';

interface WhatsAppButton {
  type: 'quick_reply' | 'url' | 'phone';
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

export default function WhatsAppPage() {
  const { items: templates, loading, error, refetch } = useApiList<WhatsAppTemplate>('/api/v4/notifications/whatsapp-templates');
  const { execute: deleteTemplate } = useApiMutation('DELETE', '/api/v4/notifications/whatsapp-templates/:id');
  const { execute: syncTemplates } = useApiMutation('POST', '/api/v4/notifications/whatsapp-templates/sync');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const TEMPLATES: WhatsAppTemplate[] = templates ?? [
  {
    id: "wa1",
    name: "Order Confirmation",
    category: "UTILITY",
    status: "APPROVED",
    language: "en",
    components: [
      {
        type: "HEADER",
        subType: "text",
        text: "Order {{order_id}} Confirmed",
      },
      {
        type: "BODY",
        text: "Hi {{customer_name}},\n\nYour order has been confirmed and will be processed shortly.\n\nOrder Date: {{order_date}}\nEstimated Delivery: {{delivery_date}}",
      },
      {
        type: "FOOTER",
        text: "Thank you for your order!",
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "url",
            text: "Track Order",
            value: "{{tracking_url}}",
          },
        ],
      },
    ],
    variables: [
      { placeholder: "1", variable: "order_id" },
      { placeholder: "2", variable: "customer_name" },
      { placeholder: "3", variable: "order_date" },
      { placeholder: "4", variable: "delivery_date" },
      { placeholder: "5", variable: "tracking_url" },
    ],
    createdAt: new Date("2026-02-01"),
    lastEdited: new Date("2026-03-10"),
  },
  {
    id: "wa2",
    name: "Delivery Status Update",
    category: "UTILITY",
    status: "APPROVED",
    language: "en",
    components: [
      {
        type: "HEADER",
        subType: "text",
        text: "Your delivery is on the way!",
      },
      {
        type: "BODY",
        text: "Hi {{customer_name}},\n\nYour order is out for delivery.\n\nDriver: {{driver_name}}\nEstimated arrival: {{eta}}\n\nTrack your package in real time.",
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "url",
            text: "Track Now",
            value: "{{tracking_url}}",
          },
          {
            type: "phone",
            text: "Call Driver",
            value: "{{driver_phone}}",
          },
        ],
      },
    ],
    variables: [
      { placeholder: "1", variable: "customer_name" },
      { placeholder: "2", variable: "driver_name" },
      { placeholder: "3", variable: "eta" },
      { placeholder: "4", variable: "tracking_url" },
      { placeholder: "5", variable: "driver_phone" },
    ],
    createdAt: new Date("2026-02-05"),
    lastEdited: new Date("2026-03-09"),
  },
  {
    id: "wa3",
    name: "Delivery Confirmation",
    category: "UTILITY",
    status: "PENDING",
    language: "en",
    components: [
      {
        type: "BODY",
        text: "Your order {{order_id}} has been delivered.\n\nThank you for shopping with us!",
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "quick_reply",
            text: "Rate Delivery",
            value: "rate",
          },
          {
            type: "quick_reply",
            text: "Report Issue",
            value: "issue",
          },
        ],
      },
    ],
    variables: [{ placeholder: "1", variable: "order_id" }],
    createdAt: new Date("2026-03-08"),
    lastEdited: new Date("2026-03-08"),
  },
  {
    id: "wa4",
    name: "Delivery Failed",
    category: "UTILITY",
    status: "REJECTED",
    language: "en",
    components: [
      {
        type: "BODY",
        text: "We couldn't deliver your order {{order_id}}.\n\nReason: {{reason}}\n\nPlease contact us to reschedule.",
      },
    ],
    variables: [
      { placeholder: "1", variable: "order_id" },
      { placeholder: "2", variable: "reason" },
    ],
    rejectionReason:
      "Template violates Meta's guidelines. Avoid negative language in business templates.",
    createdAt: new Date("2026-03-05"),
    lastEdited: new Date("2026-03-05"),
  },
];

const getStatusIcon = (status: TemplateStatus) => {
  switch (status) {
    case "APPROVED":
      return <CheckCircle className="w-4 h-4 text-[var(--wl-success)]" />;
    case "PENDING":
      return <Clock className="w-4 h-4 text-[var(--wl-warning)]" />;
    case "REJECTED":
      return <AlertCircle className="w-4 h-4 text-[var(--wl-danger)]" />;
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
    template?.category || "UTILITY"
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="border border-[var(--wl-border)] w-full max-w-2xl mx-4 max-h-96 overflow-y-auto">
        <CardHeader>
          <CardTitle>
            {template ? "Edit WhatsApp Template" : "Create WhatsApp Template"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
              Template Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Order Confirmation"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-[var(--wl-text-primary)] block mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TemplateCategory)}
              className="w-full px-3 py-2 bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] border border-[var(--wl-border)] rounded-md text-sm"
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

export default function WhatsAppTemplatePage() {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(TEMPLATES);
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | "all">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate>();
  const [syncing, setSyncing] = useState(false);

  const filteredTemplates =
    selectedCategory === "all"
      ? templates
      : templates.filter((t) => t.category === selectedCategory);

  const handleSync = async () => {
    setSyncing(true);
    try {
      // API call to sync with Meta Business API
      await new Promise((resolve) => setTimeout(resolve, 2000));
      // Update template statuses based on Meta API response
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = (templateId: string) => {
    setTemplates(templates.filter((t) => t.id !== templateId));
  };

  return (
    <div className="min-h-screen bg-[var(--wl-bg-primary)]">
      <Header
        title="WhatsApp Template Manager"
        subtitle="Create and manage WhatsApp Business templates"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Filter & Actions */}
        <Card className="border border-[var(--wl-border)] mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-3">
                  Filter by Category
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["all", "UTILITY", "MARKETING", "AUTHENTICATION"] as const).map(
                    (category) => (
                      <button
                        key={category}
                        onClick={() => setSelectedCategory(category as typeof selectedCategory)}
                        className={cn(
                          "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                          selectedCategory === category
                            ? "bg-[var(--wl-primary)] text-white"
                            : "bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] hover:bg-[var(--wl-bg-tertiary)]"
                        )}
                      >
                        {category === "all" ? "All" : category}
                      </button>
                    )
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={handleSync}
                  disabled={syncing}
                >
                  <Sync className={cn("w-4 h-4 mr-2", syncing && "animate-spin")} />
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
        <Card className="border border-[var(--wl-border)]">
          <CardHeader>
            <CardTitle>
              {filteredTemplates.length} Template
              {filteredTemplates.length !== 1 ? "s" : ""}
            </CardTitle>
            <CardDescription>
              {selectedCategory === "all"
                ? "All WhatsApp templates"
                : `${selectedCategory} templates`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
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
                  {filteredTemplates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <p className="text-[var(--wl-text-secondary)] text-sm">
                          No templates found
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTemplates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium text-[var(--wl-text-primary)]">
                              {template.name}
                            </p>
                            <p className="text-xs text-[var(--wl-text-secondary)] mt-1">
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
                                  "text-[var(--wl-success)]",
                                template.status === "PENDING" &&
                                  "text-[var(--wl-warning)]",
                                template.status === "REJECTED" &&
                                  "text-[var(--wl-danger)]"
                              )}
                            >
                              {template.status}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-[var(--wl-text-secondary)]">
                            {template.variables.length}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-[var(--wl-text-secondary)]">
                            {template.language.toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-[var(--wl-text-secondary)]">
                            {template.lastEdited.toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            {template.status === "REJECTED" && (
                              <button
                                className="p-2 hover:bg-[var(--wl-bg-secondary)] rounded-lg transition-colors"
                                title={template.rejectionReason}
                              >
                                <AlertCircle className="w-4 h-4 text-[var(--wl-danger)]" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedTemplate(template);
                                setIsModalOpen(true);
                              }}
                              className="p-2 hover:bg-[var(--wl-bg-secondary)] rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4 text-[var(--wl-text-secondary)]" />
                            </button>
                            <button
                              onClick={() => handleDelete(template.id)}
                              className="p-2 hover:bg-[var(--wl-danger)]/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-[var(--wl-danger)]" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Template Detail Cards */}
        <div className="mt-8">
          <h3 className="text-lg font-bold text-[var(--wl-text-primary)] mb-4">
            Template Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredTemplates.map((template) => (
              <Card key={template.id} className="border border-[var(--wl-border)]">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-base">{template.name}</CardTitle>
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
                      className="p-3 bg-[var(--wl-bg-secondary)] rounded-lg border border-[var(--wl-border)]"
                    >
                      <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase mb-2">
                        {component.type}
                      </p>
                      {component.text && (
                        <p className="text-sm text-[var(--wl-text-primary)] whitespace-pre-wrap">
                          {component.text}
                        </p>
                      )}
                      {component.buttons && (
                        <div className="space-y-2 mt-2">
                          {component.buttons.map((btn, bidx) => (
                            <div
                              key={bidx}
                              className="flex items-center gap-2 text-xs text-[var(--wl-text-secondary)]"
                            >
                              <span className="px-2 py-1 bg-[var(--wl-primary)]/10 rounded text-[var(--wl-primary)]">
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
                    <div className="p-3 bg-[var(--wl-danger)]/10 border border-[var(--wl-danger)]/30 rounded-lg">
                      <p className="text-xs font-semibold text-[var(--wl-danger)] mb-1">
                        Rejection Reason:
                      </p>
                      <p className="text-xs text-[var(--wl-text-secondary)]">
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
            if (selectedTemplate) {
              setTemplates(
                templates.map((t) =>
                  t.id === template.id ? template : t
                )
              );
            } else {
              setTemplates([
                ...templates,
                {
                  ...template,
                  id: `wa${Date.now()}`,
                  status: "PENDING",
                  createdAt: new Date(),
                },
              ]);
            }
          }}
        />
      </main>
    </div>
  );
}
