"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { formatRelativeTime, cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════
   NOTIFICATION TEMPLATES PAGE — Template management + preview
   MIGRATION STATUS: Inline styles → Tailwind CSS (COMPLETE)
   ═══════════════════════════════════════════════════════════ */

type NotificationChannel = "EMAIL" | "SMS" | "WHATSAPP" | "PUSH" | "WEBHOOK";

interface Variable {
  name: string;
  description: string;
  required: boolean;
}

interface NotificationTemplate {
  id: string;
  name: string;
  slug: string;
  channel: NotificationChannel;
  eventType: string;
  subject?: string;
  bodyTemplate: string;
  variables: Variable[];
  isActive: boolean;
  version: number;
  lastUpdated: string;
}

const TEMPLATES: NotificationTemplate[] = [
  {
    id: "tpl-1",
    name: "Shipment Created",
    slug: "shipment-created",
    channel: "EMAIL",
    eventType: "shipment.created",
    subject: "Your shipment {{shipmentId}} has been created",
    bodyTemplate:
      "Hi {{customerName}},\n\nYour shipment #{{shipmentId}} has been created and is being processed.\n\n{{#if estimatedDelivery}}Expected delivery: {{formatDate estimatedDelivery}}{{/if}}\n\nTrack your package: {{trackingUrl}}\n\nThank you!",
    variables: [
      { name: "customerName", description: "Customer full name", required: true },
      { name: "shipmentId", description: "Shipment ID", required: true },
      { name: "estimatedDelivery", description: "Estimated delivery date", required: false },
      { name: "trackingUrl", description: "Public tracking URL", required: true },
    ],
    isActive: true,
    version: 3,
    lastUpdated: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "tpl-2",
    name: "Shipment Delivered",
    slug: "shipment-delivered",
    channel: "SMS",
    eventType: "shipment.delivered",
    bodyTemplate:
      "Hi {{customerName}}, your package #{{shipmentId}} has been delivered. Thank you for using our service!",
    variables: [
      { name: "customerName", description: "Customer full name", required: true },
      { name: "shipmentId", description: "Shipment ID", required: true },
    ],
    isActive: true,
    version: 2,
    lastUpdated: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: "tpl-3",
    name: "Shipment Failed",
    slug: "shipment-failed",
    channel: "EMAIL",
    eventType: "shipment.failed",
    subject: "Delivery attempt failed for shipment {{shipmentId}}",
    bodyTemplate:
      "Hi {{customerName}},\n\nWe encountered an issue delivering your shipment #{{shipmentId}}.\n\nReason: {{failureReason}}\n\nOur team will contact you shortly to arrange a new delivery.\n\nContact: {{supportPhone}}\nEmail: {{supportEmail}}\n\nWe apologize for the inconvenience.",
    variables: [
      { name: "customerName", description: "Customer full name", required: true },
      { name: "shipmentId", description: "Shipment ID", required: true },
      { name: "failureReason", description: "Reason for delivery failure", required: true },
      { name: "supportPhone", description: "Support phone number", required: true },
      { name: "supportEmail", description: "Support email address", required: true },
    ],
    isActive: true,
    version: 1,
    lastUpdated: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: "tpl-4",
    name: "Order Confirmation",
    slug: "order-confirmation",
    channel: "EMAIL",
    eventType: "order.created",
    subject: "Order #{{orderNumber}} confirmed",
    bodyTemplate:
      "Thank you {{customerName}} for your order!\n\nOrder ID: {{orderNumber}}\nTotal: {{orderTotal}}\nItems: {{itemCount}}\n\nEstimated delivery: {{estimatedDelivery}}\n\nTrack your order: {{trackingLink}}\n\nQuestions? Contact {{supportEmail}}",
    variables: [
      { name: "customerName", description: "Customer name", required: true },
      { name: "orderNumber", description: "Order number", required: true },
      { name: "orderTotal", description: "Order total amount", required: true },
      { name: "itemCount", description: "Number of items", required: true },
      { name: "estimatedDelivery", description: "Estimated delivery date", required: false },
      { name: "trackingLink", description: "Link to tracking page", required: true },
      { name: "supportEmail", description: "Customer support email", required: true },
    ],
    isActive: true,
    version: 4,
    lastUpdated: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: "tpl-5",
    name: "Order Assigned",
    slug: "order-assigned",
    channel: "SMS",
    eventType: "order.assigned",
    bodyTemplate:
      "Hi {{customerName}}, your order #{{orderNumber}} has been assigned to driver {{driverName}} ({{driverPhone}}). Your delivery is coming!",
    variables: [
      { name: "customerName", description: "Customer name", required: true },
      { name: "orderNumber", description: "Order number", required: true },
      { name: "driverName", description: "Driver name", required: true },
      { name: "driverPhone", description: "Driver phone number", required: true },
    ],
    isActive: true,
    version: 1,
    lastUpdated: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "tpl-6",
    name: "Driver Assigned",
    slug: "driver-assigned",
    channel: "WHATSAPP",
    eventType: "driver.assigned",
    bodyTemplate:
      "Hello {{driverName}},\n\nYou have been assigned to delivery order #{{orderNumber}}.\n\nRecipient: {{recipientName}}\nAddress: {{deliveryAddress}}\n\nClick here to start: {{routeLink}}",
    variables: [
      { name: "driverName", description: "Driver name", required: true },
      { name: "orderNumber", description: "Order number", required: true },
      { name: "recipientName", description: "Recipient name", required: true },
      { name: "deliveryAddress", description: "Delivery address", required: true },
      { name: "routeLink", description: "Link to route", required: true },
    ],
    isActive: true,
    version: 2,
    lastUpdated: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: "tpl-7",
    name: "Delivery Approaching",
    slug: "delivery-approaching",
    channel: "PUSH",
    eventType: "delivery.approaching",
    subject: "Driver nearby",
    bodyTemplate: "Hi {{customerName}}, driver {{driverName}} is {{minutesAway}} minutes away from your location!",
    variables: [
      { name: "customerName", description: "Customer name", required: true },
      { name: "driverName", description: "Driver name", required: true },
      { name: "minutesAway", description: "Minutes until arrival", required: true },
    ],
    isActive: true,
    version: 1,
    lastUpdated: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: "tpl-8",
    name: "Payment Received",
    slug: "payment-received",
    channel: "EMAIL",
    eventType: "payment.received",
    subject: "Payment received - Invoice {{invoiceNumber}}",
    bodyTemplate:
      "Thank you {{businessName}}!\n\nWe have received your payment.\n\nAmount: {{amount}}\nMethod: {{paymentMethod}}\nDate: {{paymentDate}}\n\nInvoice: {{invoiceLink}}\n\nReference: {{transactionId}}",
    variables: [
      { name: "businessName", description: "Business/customer name", required: true },
      { name: "amount", description: "Payment amount", required: true },
      { name: "paymentMethod", description: "Payment method used", required: true },
      { name: "paymentDate", description: "Date of payment", required: true },
      { name: "invoiceLink", description: "Link to invoice", required: true },
      { name: "transactionId", description: "Transaction/reference ID", required: true },
    ],
    isActive: true,
    version: 1,
    lastUpdated: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: "tpl-9",
    name: "Proof Uploaded",
    slug: "delivery-proof-uploaded",
    channel: "EMAIL",
    eventType: "delivery.proof_uploaded",
    subject: "Delivery proof for order {{orderNumber}}",
    bodyTemplate:
      "Hi {{recipientName}},\n\nDelivery proof for order #{{orderNumber}} has been uploaded.\n\nDelivery Date: {{deliveryDate}}\nDriver: {{driverName}}\n\nView proof: {{proofLink}}\n\nThank you!",
    variables: [
      { name: "recipientName", description: "Recipient name", required: true },
      { name: "orderNumber", description: "Order number", required: true },
      { name: "deliveryDate", description: "Delivery date", required: true },
      { name: "driverName", description: "Driver name", required: true },
      { name: "proofLink", description: "Link to delivery proof", required: true },
    ],
    isActive: true,
    version: 1,
    lastUpdated: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
  {
    id: "tpl-10",
    name: "Webhook Alert",
    slug: "webhook-order-created",
    channel: "WEBHOOK",
    eventType: "order.created",
    bodyTemplate:
      '{\n  "event": "order.created",\n  "orderId": "{{orderId}}",\n  "customerEmail": "{{customerEmail}}",\n  "orderTotal": {{orderTotal}},\n  "items": {{itemsJson}},\n  "timestamp": "{{timestamp}}",\n  "retailerId": "{{retailerId}}"\n}',
    variables: [
      { name: "orderId", description: "Order ID", required: true },
      { name: "customerEmail", description: "Customer email", required: true },
      { name: "orderTotal", description: "Order total", required: true },
      { name: "itemsJson", description: "Items as JSON array", required: true },
      { name: "timestamp", description: "Event timestamp", required: true },
      { name: "retailerId", description: "Retailer ID", required: true },
    ],
    isActive: true,
    version: 1,
    lastUpdated: new Date(Date.now() - 9 * 86400000).toISOString(),
  },
  {
    id: "tpl-11",
    name: "In Transit Update",
    slug: "in-transit-update",
    channel: "SMS",
    eventType: "shipment.in_transit",
    bodyTemplate:
      "Your package {{shipmentId}} is on its way! Current location: {{currentLocation}}. Track: {{trackingUrl}}",
    variables: [
      { name: "shipmentId", description: "Shipment ID", required: true },
      { name: "currentLocation", description: "Current location", required: true },
      { name: "trackingUrl", description: "Tracking URL", required: true },
    ],
    isActive: true,
    version: 2,
    lastUpdated: new Date(Date.now() - 11 * 86400000).toISOString(),
  },
  {
    id: "tpl-12",
    name: "Cancellation Notice",
    slug: "order-cancelled",
    channel: "EMAIL",
    eventType: "order.cancelled",
    subject: "Order #{{orderNumber}} has been cancelled",
    bodyTemplate:
      "Hi {{customerName}},\n\nYour order #{{orderNumber}} has been cancelled.\n\nReason: {{cancellationReason}}\n\nRefund status: {{refundStatus}}\nRefund amount: {{refundAmount}}\n\nIf you have questions, contact us at {{supportEmail}}",
    variables: [
      { name: "customerName", description: "Customer name", required: true },
      { name: "orderNumber", description: "Order number", required: true },
      { name: "cancellationReason", description: "Reason for cancellation", required: true },
      { name: "refundStatus", description: "Refund processing status", required: true },
      { name: "refundAmount", description: "Refund amount", required: true },
      { name: "supportEmail", description: "Support email", required: true },
    ],
    isActive: false,
    version: 1,
    lastUpdated: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: "tpl-13",
    name: "Rating Request",
    slug: "rating-request",
    channel: "PUSH",
    eventType: "delivery.completed",
    subject: "Rate your delivery",
    bodyTemplate:
      "Hi {{customerName}}, how was your delivery experience? Rate driver {{driverName}} and help us improve: {{ratingLink}}",
    variables: [
      { name: "customerName", description: "Customer name", required: true },
      { name: "driverName", description: "Driver name", required: true },
      { name: "ratingLink", description: "Link to rating form", required: true },
    ],
    isActive: true,
    version: 1,
    lastUpdated: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
  {
    id: "tpl-14",
    name: "System Alert",
    slug: "system-alert",
    channel: "WEBHOOK",
    eventType: "system.alert",
    bodyTemplate:
      '{"alert_type": "{{alertType}}", "severity": "{{severity}}", "message": "{{alertMessage}}", "timestamp": "{{timestamp}}", "service": "{{affectedService}}"}',
    variables: [
      { name: "alertType", description: "Type of alert", required: true },
      { name: "severity", description: "Severity level", required: true },
      { name: "alertMessage", description: "Alert message", required: true },
      { name: "timestamp", description: "Alert timestamp", required: true },
      { name: "affectedService", description: "Affected service", required: true },
    ],
    isActive: true,
    version: 1,
    lastUpdated: new Date(Date.now() - 13 * 86400000).toISOString(),
  },
  {
    id: "tpl-15",
    name: "Promo Announcement",
    slug: "promo-announcement",
    channel: "EMAIL",
    eventType: "promo.announced",
    subject: "Exclusive offer for {{customerName}}: {{promoTitle}}",
    bodyTemplate:
      "Hi {{customerName}},\n\nWe have an exclusive offer just for you!\n\nPromo: {{promoTitle}}\nDiscount: {{discountPercent}}% off\nValid until: {{expiryDate}}\n\nShop now: {{promoLink}}\n\nCode: {{promoCode}}",
    variables: [
      { name: "customerName", description: "Customer name", required: true },
      { name: "promoTitle", description: "Promotion title", required: true },
      { name: "discountPercent", description: "Discount percentage", required: true },
      { name: "expiryDate", description: "Expiry date", required: true },
      { name: "promoLink", description: "Link to promotion", required: true },
      { name: "promoCode", description: "Promo code", required: true },
    ],
    isActive: true,
    version: 1,
    lastUpdated: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
];

const channelVariant = (channel: NotificationChannel): "success" | "warning" | "danger" | "info" | "primary" | "default" => {
  const map: Record<NotificationChannel, "success" | "warning" | "danger" | "info" | "primary" | "default"> = {
    EMAIL: "info",
    SMS: "success",
    WHATSAPP: "primary",
    PUSH: "warning",
    WEBHOOK: "default",
  };
  return map[channel];
};

const channelIcon: Record<NotificationChannel, string> = {
  EMAIL: "✉️",
  SMS: "💬",
  WHATSAPP: "💭",
  PUSH: "🔔",
  WEBHOOK: "🔗",
};

export default function NotificationsPage() {
  const [channelFilter, setChannelFilter] = useState<NotificationChannel | "ALL">("ALL");
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);

  const filtered = useMemo(() => {
    return TEMPLATES.filter((t) => {
      if (channelFilter !== "ALL" && t.channel !== channelFilter) return false;
      return true;
    });
  }, [channelFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = TEMPLATES.length;
    const active = TEMPLATES.filter((t) => t.isActive).length;
    const channels = new Set(TEMPLATES.map((t) => t.channel)).size;
    const eventTypes = new Set(TEMPLATES.map((t) => t.eventType)).size;

    return { total, active, channels, eventTypes };
  }, []);

  const truncateText = (text: string, length: number) => {
    return text.length > length ? text.substring(0, length) + "..." : text;
  };

  const highlightVariables = (text: string) => {
    const parts = text.split(/({{[^}]+}})/);
    return parts.map((part, idx) => {
      if (part.match(/({{[^}]+}})/)) {
        return (
          <span key={idx} className="text-wl-primary-400">
            {part}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <>
      <Header
        title="Notification Templates"
        subtitle={`${TEMPLATES.length} total · ${stats.active} active`}
        actions={
          <Button variant="primary" size="md">
            + New Template
          </Button>
        }
      />

      <div className="p-6">
        {/* KPI Stats Row */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6">
          <StatCard label="Total Templates" value={stats.total} accentColor="var(--wl-primary-500)" index={0} />
          <StatCard label="Active Templates" value={stats.active} accentColor="var(--wl-success-400)" index={1} />
          <StatCard label="Channels Used" value={stats.channels} accentColor="var(--wl-info-400)" index={2} />
          <StatCard label="Event Types" value={stats.eventTypes} accentColor="var(--wl-warning-400)" index={3} />
        </div>

        {/* Channel Filter Pills */}
        <div className="flex gap-1 mb-5 flex-wrap">
          {(["ALL", "EMAIL", "SMS", "WHATSAPP", "PUSH", "WEBHOOK"] as const).map((c) => {
            const count = c === "ALL" ? TEMPLATES.length : TEMPLATES.filter((t) => t.channel === c).length;
            return (
              <button
                key={c}
                onClick={() => setChannelFilter(c)}
                className={cn(
                  "px-3 py-1 rounded-full border text-xs font-semibold cursor-pointer transition-all",
                  channelFilter === c
                    ? "bg-wl-primary-500 text-wl-text-inverse border-wl-primary-500"
                    : "bg-transparent text-wl-text-tertiary border-wl-border-default"
                )}
              >
                {c === "ALL" ? "All Channels" : c} <span className="ml-1 opacity-70">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Templates Grid + Detail Panel */}
        <div className={cn(
          "grid gap-5",
          selectedTemplate ? "grid-cols-[1fr_480px]" : "grid-cols-1"
        )}>
          {/* Templates Grid */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
            {filtered.map((template, i) => (
              <Card
                key={template.id}
                hover
                onClick={() => setSelectedTemplate(selectedTemplate?.id === template.id ? null : template)}
                className="cursor-pointer relative overflow-hidden opacity-0"
                style={{
                  {/* Intentional inline: dynamic animation delay and borderColor */}
                  animation: `wl-fade-in var(--wl-duration-slow) var(--wl-ease-default) ${i * 60}ms forwards`,
                  borderColor: selectedTemplate?.id === template.id ? "var(--wl-primary-500)" : undefined,
                }}
              >
                {/* Active indicator line */}
                <div
                  className={cn(
                    "absolute top-0 left-0 right-0 h-0.5",
                    template.isActive ? "bg-wl-success-400" : "bg-wl-border-subtle"
                  )}
                />

                {/* Template Name and Status */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-base font-bold text-wl-text-primary mb-1">
                      {template.name}
                    </div>
                    <div className="text-xs text-wl-text-tertiary font-mono">
                      {template.slug}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "flex items-center justify-center w-6 h-6 rounded-full text-xs",
                      template.isActive ? "bg-wl-success-bg text-wl-success-400" : "bg-wl-border-subtle text-wl-text-tertiary"
                    )}
                  >
                    {template.isActive ? "●" : "○"}
                  </div>
                </div>

                {/* Channel Badge and Event Type */}
                <div className="flex gap-2 mb-3 items-center flex-wrap">
                  <Badge variant={channelVariant(template.channel)}>
                    <span className="mr-1">{channelIcon[template.channel]}</span>
                    {template.channel}
                  </Badge>
                  <span className="text-xs px-2 py-0.5 rounded bg-wl-info-bg text-wl-info-400 font-mono">
                    {template.eventType}
                  </span>
                </div>

                {/* Version */}
                <div className="text-xs text-wl-text-tertiary mb-3">
                  Version {template.version}
                </div>

                {/* Body Preview */}
                <div className="bg-wl-bg-overlay p-3 rounded-md mb-3 border-l-2 border-wl-primary-400">
                  <div className="text-xs font-mono text-wl-text-secondary line-clamp-5">
                    {highlightVariables(truncateText(template.bodyTemplate, 100))}
                  </div>
                </div>

                {/* Last Updated */}
                <div className="text-xs text-wl-text-tertiary mb-4">
                  Updated {formatRelativeTime(template.lastUpdated)}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 flex-wrap">
                  <Button variant="secondary" size="sm" className="flex-1">
                    Edit
                  </Button>
                  <Button variant="secondary" size="sm" className="flex-1">
                    Preview
                  </Button>
                  <Button variant="ghost" size="sm" className="flex-1">
                    Duplicate
                  </Button>
                  {template.isActive && (
                    <Button variant="ghost" size="sm" className="flex-1">
                      Deactivate
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Template Detail Panel */}
          {selectedTemplate && (
            <Card className="sticky top-24 max-h-[calc(100vh-var(--wl-header-height)-var(--wl-space-12))] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <div className="text-lg font-bold text-wl-text-primary">
                    {selectedTemplate.name}
                  </div>
                  <div className="text-xs text-wl-text-tertiary mt-0.5">
                    {selectedTemplate.slug}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="bg-none border-none text-wl-text-tertiary cursor-pointer text-lg font-sans"
                >
                  ✕
                </button>
              </div>

              <div className="flex gap-2 mb-4">
                <Badge variant={channelVariant(selectedTemplate.channel)}>
                  <span className="mr-1">{channelIcon[selectedTemplate.channel]}</span>
                  {selectedTemplate.channel}
                </Badge>
                <Badge variant="info">{selectedTemplate.eventType}</Badge>
                {selectedTemplate.isActive && <Badge variant="success">Active</Badge>}
                {!selectedTemplate.isActive && <Badge variant="default">Inactive</Badge>}
              </div>

              <div className="h-px bg-wl-border-subtle mb-4" />

              {/* Template Body (Code Editor Look) */}
              <div className="mb-4">
                <div className="text-xs font-semibold text-wl-text-tertiary uppercase mb-2 tracking-wider">
                  Template Body
                </div>
                <div className="bg-wl-bg-overlay p-3 rounded-md border border-wl-border-subtle font-mono text-xs text-wl-text-secondary line-height-6 max-h-48 overflow-y-auto whitespace-pre-wrap break-words">
                  {highlightVariables(selectedTemplate.bodyTemplate)}
                </div>
              </div>

              {/* Subject if exists */}
              {selectedTemplate.subject && (
                <div className="mb-4">
                  <div className="text-xs font-semibold text-wl-text-tertiary uppercase mb-2 tracking-wider">
                    Subject
                  </div>
                  <div className="bg-wl-bg-surface p-3 rounded-md text-sm text-wl-text-secondary font-mono whitespace-pre-wrap break-words">
                    {highlightVariables(selectedTemplate.subject)}
                  </div>
                </div>
              )}

              <div className="h-px bg-wl-border-subtle mb-4" />

              {/* Variables */}
              <div className="mb-4">
                <div className="text-xs font-semibold text-wl-text-tertiary uppercase mb-3 tracking-wider">
                  Variables ({selectedTemplate.variables.length})
                </div>
                <div className="flex flex-col gap-2">
                  {selectedTemplate.variables.map((v) => (
                    <div
                      key={v.name}
                      className="p-2 bg-wl-bg-surface rounded-md border border-wl-border-subtle"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <code className="text-xs font-semibold text-wl-primary-400 font-mono">
                          {`{{${v.name}}}`}
                        </code>
                        {v.required ? (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-wl-danger-bg text-wl-danger-400 font-semibold">
                            Required
                          </span>
                        ) : (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-wl-info-bg text-wl-info-400 font-medium">
                            Optional
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-wl-text-tertiary line-clamp-2">
                        {v.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-px bg-wl-border-subtle mb-4" />

              {/* Version Info */}
              <div className="mb-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-wl-text-tertiary">
                      Version
                    </div>
                    <div className="text-base font-bold font-mono text-wl-text-primary">
                      v{selectedTemplate.version}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-wl-text-tertiary">
                      Last Updated
                    </div>
                    <div className="text-sm font-semibold text-wl-text-secondary">
                      {formatRelativeTime(selectedTemplate.lastUpdated)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-px bg-wl-border-subtle mb-4" />

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                <Button variant="primary" size="sm" className="w-full">
                  Edit Template
                </Button>
                <Button variant="secondary" size="sm" className="w-full">
                  Preview
                </Button>
                <Button variant="secondary" size="sm" className="w-full">
                  Duplicate
                </Button>
                {selectedTemplate.isActive && (
                  <Button variant="ghost" size="sm" className="w-full">
                    Deactivate
                  </Button>
                )}
                {!selectedTemplate.isActive && (
                  <Button variant="ghost" size="sm" className="w-full">
                    Activate
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
