"use client";

import { useState } from "react";
import Link from "next/link";
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
import { cn } from "@/lib/utils";
import {
  Copy,
  Eye,
  Edit,
  Trash2,
  Mail,
  MessageSquare,
  Bell,
  Smartphone,
  Clock,
  Plus,
} from "lucide-react";

type EventType =
  | "order_confirmed"
  | "delivery_scheduled"
  | "out_for_delivery"
  | "delivery_arriving"
  | "delivered"
  | "delivery_failed"
  | "rescheduled";

type Channel = "email" | "sms" | "whatsapp" | "push";

interface NotificationTemplate {
  id: string;
  eventType: EventType;
  channel: Channel;
  name: string;
  preview: string;
  status: "active" | "draft";
  lastEdited: Date;
  createdAt: Date;
}

const TEMPLATES: NotificationTemplate[] = [
  {
    id: "t1",
    eventType: "order_confirmed",
    channel: "email",
    name: "Order Confirmation Email",
    preview: "Your order {{orderId}} has been confirmed",
    status: "active",
    lastEdited: new Date("2026-03-10"),
    createdAt: new Date("2026-02-01"),
  },
  {
    id: "t2",
    eventType: "order_confirmed",
    channel: "sms",
    name: "Order Confirmation SMS",
    preview: "Order confirmed! Track: {{trackingUrl}}",
    status: "active",
    lastEdited: new Date("2026-03-10"),
    createdAt: new Date("2026-02-01"),
  },
  {
    id: "t3",
    eventType: "delivery_scheduled",
    channel: "email",
    name: "Delivery Scheduled Email",
    preview: "Your delivery is scheduled for {{deliveryDate}}",
    status: "active",
    lastEdited: new Date("2026-03-09"),
    createdAt: new Date("2026-02-05"),
  },
  {
    id: "t4",
    eventType: "delivery_scheduled",
    channel: "sms",
    name: "Delivery Scheduled SMS",
    preview: "Delivery on {{deliveryDate}} {{timeWindow}}",
    status: "draft",
    lastEdited: new Date("2026-03-08"),
    createdAt: new Date("2026-02-10"),
  },
  {
    id: "t5",
    eventType: "out_for_delivery",
    channel: "push",
    name: "Out for Delivery Push",
    preview: "Your delivery is on the way",
    status: "active",
    lastEdited: new Date("2026-03-07"),
    createdAt: new Date("2026-02-15"),
  },
  {
    id: "t6",
    eventType: "delivered",
    channel: "email",
    name: "Delivery Completed Email",
    preview: "Your order has been delivered",
    status: "active",
    lastEdited: new Date("2026-03-06"),
    createdAt: new Date("2026-02-20"),
  },
  {
    id: "t7",
    eventType: "delivery_failed",
    channel: "whatsapp",
    name: "Delivery Failed WhatsApp",
    preview: "We couldn't deliver your package",
    status: "active",
    lastEdited: new Date("2026-03-05"),
    createdAt: new Date("2026-02-25"),
  },
  {
    id: "t8",
    eventType: "rescheduled",
    channel: "sms",
    name: "Rescheduled SMS",
    preview: "Your delivery has been rescheduled",
    status: "draft",
    lastEdited: new Date("2026-03-04"),
    createdAt: new Date("2026-03-01"),
  },
];

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  order_confirmed: "Order Confirmed",
  delivery_scheduled: "Delivery Scheduled",
  out_for_delivery: "Out for Delivery",
  delivery_arriving: "Delivery Arriving",
  delivered: "Delivered",
  delivery_failed: "Delivery Failed",
  rescheduled: "Rescheduled",
};

const CHANNEL_ICONS: Record<Channel, React.ReactNode> = {
  email: <Mail className="w-4 h-4" />,
  sms: <MessageSquare className="w-4 h-4" />,
  whatsapp: <MessageSquare className="w-4 h-4" />,
  push: <Bell className="w-4 h-4" />,
};

export default function NotificationTemplatesPage() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>(TEMPLATES);
  const [selectedEvent, setSelectedEvent] = useState<EventType | "all">("all");

  const filteredTemplates =
    selectedEvent === "all"
      ? templates
      : templates.filter((t) => t.eventType === selectedEvent);

  const handleDuplicate = (template: NotificationTemplate) => {
    const newTemplate: NotificationTemplate = {
      ...template,
      id: `t${Date.now()}`,
      name: `${template.name} (Copy)`,
      status: "draft",
      createdAt: new Date(),
      lastEdited: new Date(),
    };
    setTemplates([...templates, newTemplate]);
  };

  const handleDelete = (templateId: string) => {
    setTemplates(templates.filter((t) => t.id !== templateId));
  };

  const handleToggleStatus = (templateId: string) => {
    setTemplates(
      templates.map((t) =>
        t.id === templateId
          ? { ...t, status: t.status === "active" ? "draft" : "active" }
          : t
      )
    );
  };

  const eventTypes: (EventType | "all")[] = [
    "all",
    "order_confirmed",
    "delivery_scheduled",
    "out_for_delivery",
    "delivery_arriving",
    "delivered",
    "delivery_failed",
    "rescheduled",
  ];

  return (
    <div className="min-h-screen bg-[var(--wl-bg-primary)]">
      <Header
        title="Notification Templates"
        subtitle="Manage and customize notification templates"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Filter Bar */}
        <Card className="border border-[var(--wl-border)] mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-3">
                  Filter by Event
                </p>
                <div className="flex flex-wrap gap-2">
                  {eventTypes.map((eventType) => (
                    <button
                      key={eventType}
                      onClick={() => setSelectedEvent(eventType)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                        selectedEvent === eventType
                          ? "bg-[var(--wl-primary)] text-white"
                          : "bg-[var(--wl-bg-secondary)] text-[var(--wl-text-primary)] hover:bg-[var(--wl-bg-tertiary)]"
                      )}
                    >
                      {eventType === "all"
                        ? "All Events"
                        : EVENT_TYPE_LABELS[eventType]}
                    </button>
                  ))}
                </div>
              </div>
              <Link href="/settings/notifications/templates/new">
                <Button variant="primary" size="md">
                  <Plus className="w-4 h-4 mr-2" />
                  New Template
                </Button>
              </Link>
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
              {selectedEvent === "all"
                ? "All notification templates"
                : `Templates for ${EVENT_TYPE_LABELS[selectedEvent]}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Name & Preview</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Edited</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTemplates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <p className="text-[var(--wl-text-secondary)] text-sm">
                          No templates found
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTemplates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell>
                          <span className="text-sm font-medium text-[var(--wl-text-primary)]">
                            {EVENT_TYPE_LABELS[template.eventType]}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--wl-text-secondary)]">
                              {CHANNEL_ICONS[template.channel]}
                            </span>
                            <span className="text-sm capitalize text-[var(--wl-text-primary)]">
                              {template.channel}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium text-[var(--wl-text-primary)]">
                              {template.name}
                            </p>
                            <p className="text-xs text-[var(--wl-text-secondary)] mt-1 truncate">
                              {template.preview}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              template.status === "active"
                                ? "success"
                                : "warning"
                            }
                          >
                            {template.status === "active"
                              ? "Active"
                              : "Draft"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs text-[var(--wl-text-secondary)]">
                            <Clock className="w-3 h-3" />
                            {template.lastEdited.toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Link
                              href={`/settings/notifications/templates/${template.id}`}
                            >
                              <button className="p-2 hover:bg-[var(--wl-bg-secondary)] rounded-lg transition-colors">
                                <Edit className="w-4 h-4 text-[var(--wl-text-secondary)]" />
                              </button>
                            </Link>
                            <button
                              onClick={() => handleDuplicate(template)}
                              className="p-2 hover:bg-[var(--wl-bg-secondary)] rounded-lg transition-colors"
                            >
                              <Copy className="w-4 h-4 text-[var(--wl-text-secondary)]" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(template.id)}
                              className="p-2 hover:bg-[var(--wl-bg-secondary)] rounded-lg transition-colors"
                            >
                              <Eye className="w-4 h-4 text-[var(--wl-text-secondary)]" />
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

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
          <Card className="border border-[var(--wl-border)]">
            <CardContent className="pt-6">
              <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
                Total Templates
              </p>
              <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
                {templates.length}
              </p>
            </CardContent>
          </Card>
          <Card className="border border-[var(--wl-border)]">
            <CardContent className="pt-6">
              <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
                Active
              </p>
              <p className="text-2xl font-bold text-[var(--wl-success)]">
                {templates.filter((t) => t.status === "active").length}
              </p>
            </CardContent>
          </Card>
          <Card className="border border-[var(--wl-border)]">
            <CardContent className="pt-6">
              <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
                Draft
              </p>
              <p className="text-2xl font-bold text-[var(--wl-warning)]">
                {templates.filter((t) => t.status === "draft").length}
              </p>
            </CardContent>
          </Card>
          <Card className="border border-[var(--wl-border)]">
            <CardContent className="pt-6">
              <p className="text-xs font-semibold text-[var(--wl-text-secondary)] uppercase tracking-wide mb-2">
                Event Types
              </p>
              <p className="text-2xl font-bold text-[var(--wl-text-primary)]">
                {new Set(templates.map((t) => t.eventType)).size}
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
