"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useApiList } from "@/hooks/use-api";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Trash2 } from "lucide-react";

interface Envelope {
  id: string;
  name: string;
  status: string;
  sender: {
    name: string;
    email: string;
  };
  recipients: Array<{
    id: string;
    name: string;
    email: string;
    status: string;
    role?: string;
  }>;
  createdDate: string;
  sentDate?: string;
  completedDate?: string;
  documentCount: number;
  completionRate: number;
}

function EnvelopeTable({ envelopes }: { envelopes: Envelope[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailEnvelopeId, setDetailEnvelopeId] = useState<string | null>(null);

  const selectedEnvelope = envelopes.find((e) => e.id === detailEnvelopeId);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === envelopes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(envelopes.map((e) => e.id)));
    }
  };

  return (
    <>
      <Card className="bg-wl-bg-surface border-wl-border-default">
        <CardHeader className="border-b border-wl-border-default">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-white">
              Envelopes ({envelopes.length})
            </CardTitle>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-wl-text-secondary">
                  {selectedIds.size} selected
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Trash2 size={14} /> Delete
                </Button>
                <Button variant="secondary" size="sm">
                  Void
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-wl-border-default">
                  <th className="text-left py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.size === envelopes.length &&
                        envelopes.length > 0
                      }
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-wl-border-default accent-blue-500"
                    />
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-wl-text-secondary">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-wl-text-secondary">
                    Sender
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-wl-text-secondary">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-wl-text-secondary">
                    Signers
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-wl-text-secondary">
                    Completion
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-wl-text-secondary">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {envelopes.map((env) => (
                  <tr
                    key={env.id}
                    className="border-b border-wl-border-default hover:bg-wl-bg-elevated transition-colors"
                  >
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(env.id)}
                        onChange={() => toggleSelect(env.id)}
                        className="w-4 h-4 rounded border-wl-border-default accent-blue-500"
                      />
                    </td>
                    <td className="py-3 px-4 text-white font-medium">
                      <button
                        onClick={() => setDetailEnvelopeId(env.id)}
                        className="hover:underline text-blue-500"
                      >
                        {env.name}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-wl-text-secondary">
                      {env.sender.name}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          env.status === "COMPLETED"
                            ? "success"
                            : env.status === "SIGNED"
                              ? "info"
                              : env.status === "SENT"
                                ? "warning"
                                : env.status === "PENDING"
                                  ? "default"
                                  : "danger"
                        }
                      >
                        {env.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-wl-text-secondary">
                      {env.recipients.length}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-wl-bg-elevated rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-all"
                            style={{ width: `${env.completionRate}%` }}
                          />
                        </div>
                        <span className="text-xs text-wl-text-secondary min-w-fit">
                          {env.completionRate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-wl-text-secondary text-xs">
                      {new Date(env.createdDate).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      {selectedEnvelope && (
        <Card className="mt-6 bg-wl-bg-surface border-wl-border-default">
          <CardHeader className="border-b border-wl-border-default flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base text-white">
                {selectedEnvelope.name}
              </CardTitle>
              <p className="text-xs text-wl-text-secondary mt-1">
                ID: {selectedEnvelope.id}
              </p>
            </div>
            <button
              onClick={() => setDetailEnvelopeId(null)}
              className="text-wl-text-secondary hover:text-white transition-colors"
            >
              ✕
            </button>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-wl-text-secondary mb-3">
                    Recipients
                  </h3>
                  <div className="space-y-2">
                    {selectedEnvelope.recipients.map((r) => (
                      <div
                        key={r.id}
                        className="p-3 bg-wl-bg-elevated rounded-lg border border-wl-border-default"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-white">
                            {r.name}
                          </p>
                          <Badge
                            variant={
                              r.status === "SIGNED" ? "success" : "warning"
                            }
                          >
                            {r.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-wl-text-secondary">
                          {r.email}
                        </p>
                        {r.role && (
                          <p className="text-xs text-wl-text-secondary mt-1">
                            Role: {r.role}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-wl-text-secondary mb-3">
                    Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-wl-text-secondary">Created:</span>
                      <span className="text-white font-medium">
                        {new Date(
                          selectedEnvelope.createdDate,
                        ).toLocaleDateString()}
                      </span>
                    </div>
                    {selectedEnvelope.sentDate && (
                      <div className="flex justify-between">
                        <span className="text-wl-text-secondary">Sent:</span>
                        <span className="text-white font-medium">
                          {new Date(
                            selectedEnvelope.sentDate,
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {selectedEnvelope.completedDate && (
                      <div className="flex justify-between">
                        <span className="text-wl-text-secondary">
                          Completed:
                        </span>
                        <span className="text-white font-medium">
                          {new Date(
                            selectedEnvelope.completedDate,
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-wl-text-secondary">Documents:</span>
                      <span className="text-white font-medium">
                        {selectedEnvelope.documentCount}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Actions */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-wl-text-secondary mb-3">
                  Actions
                </h3>
                <Button variant="primary" className="w-full text-xs">
                  Download Documents
                </Button>
                <Button variant="secondary" className="w-full text-xs">
                  Send Reminder
                </Button>
                <Button variant="secondary" className="w-full text-xs">
                  View Timeline
                </Button>
                <Button variant="ghost" className="w-full text-xs">
                  Cancel Envelope
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default function EnvelopesPage() {
  const {
    items: data,
    loading,
    error,
    refetch,
  } = useApiList<Envelope>("/api/v4/envelopes");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const statusOptions = [
    "ALL",
    "DRAFT",
    "SENT",
    "VIEWED",
    "SIGNED",
    "COMPLETED",
    "EXPIRED",
  ];

  const filteredEnvelopes =
    filterStatus === "ALL"
      ? data
      : data.filter((e) => e.status === filterStatus);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="min-h-screen bg-wl-bg-root p-6 space-y-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Envelope Management
            </h1>
            <p className="text-wl-text-secondary">
              Create, send, and track document envelopes
            </p>
          </div>
          <Button variant="primary" className="flex items-center gap-2">
            <Plus size={16} /> Create Envelope
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-wl-text-secondary text-sm font-medium">
                Total Envelopes
              </span>
              <FileText className="text-blue-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-white">{data.length}</p>
          </CardContent>
        </Card>

        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-wl-text-secondary text-sm font-medium">
                Completed
              </span>
              <div className="w-5 h-5 rounded-full bg-emerald-500"></div>
            </div>
            <p className="text-3xl font-bold text-white">
              {data.filter((e) => e.status === "COMPLETED").length}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-wl-text-secondary text-sm font-medium">
                Pending
              </span>
              <div className="w-5 h-5 rounded-full bg-amber-500"></div>
            </div>
            <p className="text-3xl font-bold text-white">
              {
                data.filter((e) =>
                  ["DRAFT", "SENT", "VIEWED"].includes(e.status),
                ).length
              }
            </p>
          </CardContent>
        </Card>

        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-wl-text-secondary text-sm font-medium">
                Avg. Completion
              </span>
              <div className="w-5 h-5 rounded-full bg-blue-500"></div>
            </div>
            <p className="text-3xl font-bold text-white">
              {data.length > 0
                ? Math.round(
                    data.reduce((sum, e) => sum + e.completionRate, 0) /
                      data.length,
                  )
                : 0}
              %
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-wl-bg-surface border-wl-border-default">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-wl-text-secondary">
              Filter by Status:
            </label>
            <div className="flex gap-2 flex-wrap">
              {statusOptions.map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    filterStatus === status
                      ? "bg-blue-500 text-white"
                      : "bg-wl-bg-elevated text-wl-text-secondary hover:text-white",
                  )}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Envelopes Table */}
      <EnvelopeTable envelopes={filteredEnvelopes} />

      {/* Info Card */}
      <Card className="bg-wl-bg-surface border-wl-border-default border-2 border-blue-500/20">
        <CardHeader>
          <CardTitle className="text-base text-blue-400">
            Envelope Creation Wizard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm text-wl-text-secondary">
            <li>
              <strong>Step 1:</strong> Upload documents (PDF, DOCX, or images)
            </li>
            <li>
              <strong>Step 2:</strong> Add signers and other recipients
            </li>
            <li>
              <strong>Step 3:</strong> Place signature fields on documents
            </li>
            <li>
              <strong>Step 4:</strong> Review settings and send envelope
            </li>
          </ol>
          <p className="text-xs text-wl-text-secondary mt-4">
            Click "Create Envelope" button above to start the process.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
