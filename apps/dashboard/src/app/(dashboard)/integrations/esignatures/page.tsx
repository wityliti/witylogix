'use client';

import { useState } from 'react';
import { useApiList } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  ChevronLeft,
  Plus,
  Settings,
  Power,
  CheckCircle2,
  AlertCircle,
  Copy,
  FileText,
  Send,
  Eye,
  PenTool,
  Clock,
  Archive,
  Trash2,
  DownloadCloud,
  ScrollText,
  Zap,
} from 'lucide-react';

interface ESignatureProvider {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: "connected" | "disconnected" | "error";
  connectedAt?: string;
  lastSync?: string;
  templates?: number;
  envelopes?: number;
}

interface EnvelopeWorkflow {
  id: string;
  documentName: string;
  status: "sent" | "viewed" | "signed" | "completed" | "voided" | "declined";
  signers: Signer[];
  createdAt: string;
  dueDate?: string;
  progress: number;
}

interface Signer {
  id: string;
  email: string;
  name: string;
  status: "pending" | "viewed" | "signed" | "declined";
  order: number;
}

interface SigningTemplate {
  id: string;
  name: string;
  provider: string;
  fields: number;
  signers: number;
  created: string;
  usage: number;
}

interface WebhookEvent {
  id: string;
  event: string;
  timestamp: string;
  envelope: string;
  status: "success" | "failed";
  details: string;
}

interface AuditEntry {
  id: string;
  action: string;
  user: string;
  timestamp: string;
  details: string;
  ipAddress: string;
}

const providers: ESignatureProvider[] = [
  {
    id: "docusign",
    name: "DocuSign",
    icon: <FileText className="w-5 h-5" />,
    status: "connected",
    connectedAt: "2025-11-10",
    lastSync: "2026-03-12 14:32",
    templates: 12,
    envelopes: 1245,
  },
  {
    id: "adobesign",
    name: "Adobe Sign",
    icon: <PenTool className="w-5 h-5" />,
    status: "connected",
    connectedAt: "2025-10-15",
    lastSync: "2026-03-12 14:28",
    templates: 8,
    envelopes: 687,
  },
  {
    id: "pandadoc",
    name: "PandaDoc",
    icon: <ScrollText className="w-5 h-5" />,
    status: "connected",
    connectedAt: "2025-09-20",
    lastSync: "2026-03-12 14:35",
    templates: 15,
    envelopes: 421,
  },
  {
    id: "hellosign",
    name: "HelloSign",
    icon: <Zap className="w-5 h-5" />,
    status: "disconnected",
    templates: 0,
    envelopes: 0,
  },
];

const envelopes: EnvelopeWorkflow[] = [
  {
    id: "env-001",
    documentName: "Shipping Agreement 2026-03-12",
    status: "completed",
    signers: [
      { id: "s1", email: "john@customer.com", name: "John Smith", status: "signed", order: 1 },
      { id: "s2", email: "manager@company.com", name: "Manager", status: "signed", order: 2 },
    ],
    createdAt: "2026-03-10",
    progress: 100,
  },
  {
    id: "env-002",
    documentName: "Service Agreement Q2 2026",
    status: "signed",
    signers: [
      { id: "s1", email: "client@enterprise.com", name: "Enterprise Client", status: "signed", order: 1 },
      { id: "s2", email: "legal@company.com", name: "Legal Team", status: "signed", order: 2 },
      { id: "s3", email: "director@company.com", name: "Director", status: "pending", order: 3 },
    ],
    createdAt: "2026-03-08",
    dueDate: "2026-03-15",
    progress: 66,
  },
  {
    id: "env-003",
    documentName: "Contract Amendment",
    status: "viewed",
    signers: [
      { id: "s1", email: "alex@partner.com", name: "Alex Partner", status: "viewed", order: 1 },
      { id: "s2", email: "compliance@company.com", name: "Compliance", status: "pending", order: 2 },
    ],
    createdAt: "2026-03-11",
    dueDate: "2026-03-20",
    progress: 25,
  },
  {
    id: "env-004",
    documentName: "NDA - Confidentiality",
    status: "sent",
    signers: [
      { id: "s1", email: "partner@vendor.com", name: "Vendor Partner", status: "pending", order: 1 },
      { id: "s2", email: "legal@vendor.com", name: "Vendor Legal", status: "pending", order: 2 },
    ],
    createdAt: "2026-03-12",
    dueDate: "2026-03-19",
    progress: 0,
  },
  {
    id: "env-005",
    documentName: "Invoice Signature Required",
    status: "declined",
    signers: [
      { id: "s1", email: "finance@customer.com", name: "Finance Director", status: "declined", order: 1 },
    ],
    createdAt: "2026-03-06",
    progress: 0,
  },
];

const templates: SigningTemplate[] = [
  {
    id: "tpl-001",
    name: "Standard Shipping Agreement",
    provider: "DocuSign",
    fields: 8,
    signers: 2,
    created: "2025-12-01",
    usage: 245,
  },
  {
    id: "tpl-002",
    name: "Service Agreement",
    provider: "DocuSign",
    fields: 12,
    signers: 3,
    created: "2025-11-15",
    usage: 189,
  },
  {
    id: "tpl-003",
    name: "Confidentiality Agreement",
    provider: "Adobe Sign",
    fields: 6,
    signers: 2,
    created: "2025-10-20",
    usage: 67,
  },
  {
    id: "tpl-004",
    name: "Authorization Form",
    provider: "PandaDoc",
    fields: 5,
    signers: 1,
    created: "2025-09-10",
    usage: 412,
  },
  {
    id: "tpl-005",
    name: "Quote & Order",
    provider: "PandaDoc",
    fields: 10,
    signers: 2,
    created: "2025-08-05",
    usage: 156,
  },
];

const webhookEvents: WebhookEvent[] = [
  {
    id: "whk-001",
    event: "envelope.sent",
    timestamp: "2026-03-12 14:32:15",
    envelope: "Service Agreement Q2 2026",
    status: "success",
    details: "Envelope sent to 3 signers",
  },
  {
    id: "whk-002",
    event: "recipient.signed",
    timestamp: "2026-03-12 14:28:42",
    envelope: "Shipping Agreement 2026-03-12",
    status: "success",
    details: "Document signed by John Smith",
  },
  {
    id: "whk-003",
    event: "envelope.completed",
    timestamp: "2026-03-12 14:25:30",
    envelope: "Shipping Agreement 2026-03-12",
    status: "success",
    details: "All required signatures received",
  },
  {
    id: "whk-004",
    event: "recipient.viewed",
    timestamp: "2026-03-11 09:15:22",
    envelope: "Contract Amendment",
    status: "success",
    details: "Viewed by Alex Partner",
  },
  {
    id: "whk-005",
    event: "recipient.declined",
    timestamp: "2026-03-06 16:45:08",
    envelope: "Invoice Signature Required",
    status: "success",
    details: "Declined by Finance Director",
  },
];

const auditLog: AuditEntry[] = [
  {
    id: "audit-001",
    action: "Document Sent",
    user: "admin@company.com",
    timestamp: "2026-03-12 14:30:00",
    details: "Sent Service Agreement to 3 recipients",
    ipAddress: "192.168.1.100",
  },
  {
    id: "audit-002",
    action: "Template Created",
    user: "legal@company.com",
    timestamp: "2026-03-12 10:15:00",
    details: "Created new template: Standard Shipping Agreement",
    ipAddress: "192.168.1.105",
  },
  {
    id: "audit-003",
    action: "Document Voided",
    user: "manager@company.com",
    timestamp: "2026-03-11 16:42:00",
    details: "Voided envelope env-012 (Outdated Agreement)",
    ipAddress: "192.168.1.110",
  },
  {
    id: "audit-004",
    action: "Settings Updated",
    user: "admin@company.com",
    timestamp: "2026-03-11 09:20:00",
    details: "Updated webhook configuration",
    ipAddress: "192.168.1.100",
  },
  {
    id: "audit-005",
    action: "API Key Rotated",
    user: "admin@company.com",
    timestamp: "2026-03-10 14:00:00",
    details: "Rotated DocuSign API credentials",
    ipAddress: "192.168.1.100",
  },
];

const getStatusBadgeVariant = (status: string): "success" | "warning" | "danger" | "info" | "default" | "primary" => {
  switch (status) {
    case "completed":
    case "signed":
      return "success";
    case "viewed":
      return "info";
    case "sent":
      return "default";
    case "pending":
      return "warning";
    case "declined":
    case "voided":
      return "danger";
    default:
      return "default";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
    case "signed":
      return <CheckCircle2 className="w-4 h-4" />;
    case "viewed":
      return <Eye className="w-4 h-4" />;
    case "sent":
      return <Send className="w-4 h-4" />;
    case "pending":
      return <Clock className="w-4 h-4" />;
    case "declined":
    case "voided":
      return <AlertCircle className="w-4 h-4" />;
    default:
      return null;
  }
};

export default function ESignaturesPage() {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    providers: true,
    envelopes: true,
    templates: true,
    webhooks: true,
    audit: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] to-[#12121a]">
      <Header
        title="E-Signatures Integrations"
        subtitle="Manage document signing workflows, templates, and audit trails"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <Link href="/integrations">
          <Button
            variant="ghost"
            className="mb-8 text-gray-400 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Integrations
          </Button>
        </Link>

        {/* Providers Section */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("providers")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">
                E-Signature Providers
              </h2>
              <Badge variant="primary" className="bg-blue-500/30 text-blue-500">
                {providers.filter((p) => p.status === "connected").length} connected
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-gray-400 transition-transform",
                expandedSections.providers ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.providers && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {providers.map((provider) => (
                <Card key={provider.id} className="hover:border-blue-500/50">
                  <CardContent className="pt-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="text-blue-500 text-2xl">{provider.icon}</div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            {provider.name}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">
                            {provider.status === "connected" && `Connected on ${provider.connectedAt}`}
                            {provider.status === "disconnected" && "Not connected"}
                            {provider.status === "error" && "Connection error"}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={
                          provider.status === "connected"
                            ? "success"
                            : provider.status === "error"
                              ? "danger"
                              : "default"
                        }
                        className={cn(
                          provider.status === "connected" &&
                            "bg-green-500/20 text-green-400 border border-green-500/50",
                          provider.status === "error" && "bg-red-500/20 text-red-400 border border-red-500/50"
                        )}
                      >
                        {provider.status === "connected" && (
                          <>
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Connected
                          </>
                        )}
                        {provider.status === "disconnected" && "Disconnected"}
                        {provider.status === "error" && (
                          <>
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Error
                          </>
                        )}
                      </Badge>
                    </div>

                    {/* Stats Grid */}
                    {provider.status === "connected" && (
                      <>
                        <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-[#1e1e2e]">
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">
                              Templates
                            </p>
                            <p className="text-2xl font-bold text-white mt-1">
                              {provider.templates}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">
                              Envelopes
                            </p>
                            <p className="text-2xl font-bold text-white mt-1">
                              {provider.envelopes?.toLocaleString()}
                            </p>
                          </div>
                        </div>

                        <div className="mb-6">
                          <p className="text-xs font-medium text-gray-500 uppercase">
                            Last Sync
                          </p>
                          <p className="text-sm text-white mt-1 flex items-center gap-2">
                            <Clock className="w-3 h-3 text-green-500" />
                            {provider.lastSync}
                          </p>
                        </div>
                      </>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      {provider.status === "connected" ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1 bg-[#12121a] hover:bg-[#1a1a2e]"
                          >
                            <Settings className="w-4 h-4 mr-2" />
                            Settings
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            className="flex-1 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                          >
                            <Power className="w-4 h-4 mr-2" />
                            Disconnect
                          </Button>
                        </>
                      ) : provider.status === "error" ? (
                        <Button
                          variant="primary"
                          size="sm"
                          className="flex-1 bg-blue-500 hover:bg-blue-500/90"
                        >
                          <AlertCircle className="w-4 h-4 mr-2" />
                          Reconnect
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          className="flex-1 bg-blue-500 hover:bg-blue-500/90"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Connect
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Envelope Workflow Section */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("envelopes")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">
                Document Envelopes
              </h2>
              <Badge variant="info" className="bg-blue-500/20 text-blue-400">
                {envelopes.length} total
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-gray-400 transition-transform",
                expandedSections.envelopes ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.envelopes && (
            <div className="space-y-4">
              {envelopes.map((envelope) => (
                <Card key={envelope.id} className="bg-[#1a1a2e]">
                  <CardContent className="pt-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-white">
                          {envelope.documentName}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Created {envelope.createdAt}
                          {envelope.dueDate && ` • Due ${envelope.dueDate}`}
                        </p>
                      </div>
                      <Badge
                        variant={getStatusBadgeVariant(envelope.status)}
                        className={cn(
                          "capitalize flex items-center gap-1",
                          envelope.status === "completed" || envelope.status === "signed"
                            ? "bg-green-500/20 text-green-400"
                            : envelope.status === "viewed"
                              ? "bg-blue-500/20 text-blue-400"
                              : envelope.status === "sent"
                                ? "bg-gray-500/20 text-gray-400"
                                  : "bg-red-500/20 text-red-400"
                        )}
                      >
                        {getStatusIcon(envelope.status)}
                        {envelope.status}
                      </Badge>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-6 pb-6 border-b border-[#1e1e2e]">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-gray-500 uppercase">
                          Completion
                        </p>
                        <p className="text-sm font-bold text-white">{envelope.progress}%</p>
                      </div>
                      <div className="w-full h-2 bg-[#12121a] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-500/70"
                          style={{ width: `${envelope.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Signers */}
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-500 uppercase mb-3">
                        Signing Order
                      </p>
                      <div className="space-y-2">
                        {envelope.signers.map((signer) => (
                          <div key={signer.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#12121a] flex items-center justify-center text-xs font-semibold">
                                {signer.order}
                              </div>
                              <div>
                                <p className="font-medium text-white">{signer.name}</p>
                                <p className="text-xs text-gray-500">{signer.email}</p>
                              </div>
                            </div>
                            <div className={cn("px-2 py-1 rounded text-xs font-semibold capitalize",
                              signer.status === "signed"
                                ? "bg-green-500/20 text-green-400"
                                : signer.status === "viewed"
                                  ? "bg-blue-500/20 text-blue-400"
                                  : signer.status === "declined"
                                    ? "bg-red-500/20 text-red-400"
                                    : "bg-gray-500/20 text-gray-400"
                            )}>
                              {signer.status}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-4 border-t border-[#1e1e2e]">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 bg-[#12121a] hover:bg-[#1a1a2e]"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 bg-[#12121a] hover:bg-[#1a1a2e]"
                      >
                        <DownloadCloud className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                      {envelope.status === "sent" || envelope.status === "viewed" ? (
                        <Button
                          variant="danger"
                          size="sm"
                          className="flex-1 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Void
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Templates Section */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("templates")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">
                Signing Templates
              </h2>
              <Badge variant="default" className="bg-[#12121a]">
                {templates.length} templates
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-gray-400 transition-transform",
                expandedSections.templates ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.templates && (
            <div className="space-y-4">
              {templates.map((template) => (
                <Card key={template.id} className="bg-[#1a1a2e]">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-white">
                          {template.name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {template.provider} • Created {template.created}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-500">{template.usage}</p>
                        <p className="text-xs text-gray-500">times used</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-[#1e1e2e]">
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">
                          Fields
                        </p>
                        <p className="text-lg font-bold text-white mt-1">
                          {template.fields}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">
                          Signers
                        </p>
                        <p className="text-lg font-bold text-white mt-1">
                          {template.signers}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">
                          Status
                        </p>
                        <Badge variant="success" className="mt-1 bg-green-500/20 text-green-400">
                          Active
                        </Badge>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1 bg-blue-500 hover:bg-blue-500/90"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Use Template
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 bg-[#12121a] hover:bg-[#1a1a2e]"
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button
                variant="primary"
                className="w-full bg-blue-500 hover:bg-blue-500/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Template
              </Button>
            </div>
          )}
        </div>

        {/* Webhook Events Section */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("webhooks")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">
                Webhook Event Log
              </h2>
              <Badge variant="success" className="bg-green-500/20 text-green-400">
                All delivered
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-gray-400 transition-transform",
                expandedSections.webhooks ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.webhooks && (
            <Card className="bg-[#1a1a2e]">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {webhookEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start justify-between p-4 bg-[#12121a] rounded-lg border border-[#1e1e2e]"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            variant="success"
                            className="bg-green-500/20 text-green-400 text-xs flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Success
                          </Badge>
                          <code className="text-xs font-mono text-blue-500">
                            {event.event}
                          </code>
                        </div>
                        <p className="text-sm text-white font-medium">
                          {event.envelope}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {event.details}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono text-gray-500">
                          {event.timestamp}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Audit Trail Section */}
        <div>
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("audit")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">
                Audit Trail
              </h2>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-gray-400 transition-transform",
                expandedSections.audit ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.audit && (
            <Card className="bg-[#1a1a2e]">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {auditLog.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-4 p-4 bg-[#12121a] rounded-lg border border-[#1e1e2e]"
                    >
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-white">
                            {entry.action}
                          </h4>
                          <span className="text-xs font-mono text-gray-500">
                            {entry.ipAddress}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 mb-1">
                          {entry.details}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{entry.user}</span>
                          <span>•</span>
                          <span>{entry.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
