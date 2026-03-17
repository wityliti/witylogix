"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEnvelopes, useAuditTrail } from "@/hooks/use-esignatures";

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

function EnvelopeTable({ envelopes }: { envelopes: any[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailEnvelopeId, setDetailEnvelopeId] = useState<string | null>(null);

  const selectedEnvelope = envelopes.find((e) => e.id === detailEnvelopeId);
  const { events: auditEvents } = useAuditTrail(detailEnvelopeId || "");

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
      <Card className={cn("bg-wl-bg-elevated border-wl-border-subtle")}>
        <CardHeader className={cn("border-b border-wl-border-subtle")}>
          <div
            className={cn("flex items-center justify-between")}
          >
            <CardTitle className={cn("text-base")}>
              Envelopes ({envelopes.length})
            </CardTitle>
            {selectedIds.size > 0 && (
              <div className={cn("flex items-center gap-2")}>
                <span className={cn("text-sm text-wl-text-secondary")}>
                  {selectedIds.size} selected
                </span>
                <Button variant="secondary" size="sm">
                  Delete
                </Button>
                <Button variant="secondary" size="sm">
                  Void
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className={cn("overflow-x-auto")}>
            <table className={cn("w-full text-sm")}>
              <thead>
                <tr className={cn("border-b border-wl-border-subtle")}>
                  <th className={cn("text-left py-3 px-4 w-10")}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === envelopes.length && envelopes.length > 0}
                      onChange={toggleSelectAll}
                      className={cn("w-4 h-4 rounded border-wl-border-subtle")}
                    />
                  </th>
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
                    Sender
                  </th>
                  <th
                    className={cn(
                      "text-left py-3 px-4 font-medium text-wl-text-secondary"
                    )}
                  >
                    Status
                  </th>
                  <th
                    className={cn(
                      "text-left py-3 px-4 font-medium text-wl-text-secondary"
                    )}
                  >
                    Signers
                  </th>
                  <th
                    className={cn(
                      "text-left py-3 px-4 font-medium text-wl-text-secondary"
                    )}
                  >
                    Completion
                  </th>
                  <th
                    className={cn(
                      "text-left py-3 px-4 font-medium text-wl-text-secondary"
                    )}
                  >
                    Created
                  </th>
                  <th className={cn("w-10")}></th>
                </tr>
              </thead>
              <tbody>
                {envelopes.map((env) => (
                  <tr
                    key={env.id}
                    className={cn(
                      "border-b border-wl-border-subtle hover:bg-wl-bg-overlay transition-colors"
                    )}
                  >
                    <td className={cn("py-3 px-4")}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(env.id)}
                        onChange={() => toggleSelect(env.id)}
                        className={cn("w-4 h-4 rounded border-wl-border-subtle")}
                      />
                    </td>
                    <td className={cn("py-3 px-4 text-wl-text-primary font-medium")}>
                      <button
                        onClick={() => setDetailEnvelopeId(env.id)}
                        className={cn("hover:underline text-wl-brand")}
                      >
                        {env.name}
                      </button>
                    </td>
                    <td className={cn("py-3 px-4 text-wl-text-secondary")}>
                      {env.sender.name}
                    </td>
                    <td className={cn("py-3 px-4")}>
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
                    <td className={cn("py-3 px-4 text-wl-text-secondary")}>
                      {env.recipients.length}
                    </td>
                    <td className={cn("py-3 px-4")}>
                      <div className={cn("flex items-center gap-2")}>
                        <div className={cn("w-20 h-1.5 bg-wl-bg-overlay rounded-full overflow-hidden")}>
                          <div
                            className={cn("h-full bg-wl-status-success transition-all")}
                            style={{ width: `${env.completionRate}%` }}
                          />
                        </div>
                        <span className={cn("text-xs text-wl-text-secondary min-w-fit")}>
                          {env.completionRate}%
                        </span>
                      </div>
                    </td>
                    <td className={cn("py-3 px-4 text-wl-text-secondary text-xs")}>
                      {new Date(env.createdDate).toLocaleDateString()}
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

      {/* Detail Drawer */}
      {selectedEnvelope && (
        <Card className={cn("mt-6 bg-wl-bg-elevated border-wl-border-subtle")}>
          <CardHeader className={cn("border-b border-wl-border-subtle flex flex-row items-center justify-between")}>
            <div>
              <CardTitle className={cn("text-base")}>
                {selectedEnvelope.name}
              </CardTitle>
              <p className={cn("text-xs text-wl-text-secondary mt-1")}>
                ID: {selectedEnvelope.id}
              </p>
            </div>
            <button
              onClick={() => setDetailEnvelopeId(null)}
              className={cn("text-wl-text-secondary hover:text-wl-text-primary")}
            >
              ✕
            </button>
          </CardHeader>
          <CardContent className={cn("pt-6")}>
            <div className={cn("grid grid-cols-2 gap-6")}>
              {/* Left Column */}
              <div className={cn("space-y-6")}>
                <div>
                  <h3 className={cn("text-sm font-semibold text-wl-text-secondary mb-3")}>
                    Recipients
                  </h3>
                  <div className={cn("space-y-2")}>
                    {selectedEnvelope.recipients.map((r: any) => (
                      <div
                        key={r.id}
                        className={cn(
                          "p-3 bg-wl-bg-overlay rounded-md border border-wl-border-subtle"
                        )}
                      >
                        <div
                          className={cn(
                            "flex items-center justify-between mb-1"
                          )}
                        >
                          <p className={cn("text-sm font-medium text-wl-text-primary")}>
                            {r.name}
                          </p>
                          <Badge variant={r.status === "SIGNED" ? "success" : "warning"}>
                            {r.status}
                          </Badge>
                        </div>
                        <p className={cn("text-xs text-wl-text-secondary")}>
                          {r.email}
                        </p>
                        {r.role && (
                          <p className={cn("text-xs text-wl-text-secondary mt-1")}>
                            Role: {r.role}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className={cn("text-sm font-semibold text-wl-text-secondary mb-3")}>
                    Details
                  </h3>
                  <div className={cn("space-y-2 text-sm")}>
                    <div className={cn("flex justify-between")}>
                      <span className={cn("text-wl-text-secondary")}>Created:</span>
                      <span className={cn("text-wl-text-primary font-medium")}>
                        {new Date(selectedEnvelope.createdDate).toLocaleDateString()}
                      </span>
                    </div>
                    {selectedEnvelope.sentDate && (
                      <div className={cn("flex justify-between")}>
                        <span className={cn("text-wl-text-secondary")}>Sent:</span>
                        <span className={cn("text-wl-text-primary font-medium")}>
                          {new Date(selectedEnvelope.sentDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {selectedEnvelope.completedDate && (
                      <div className={cn("flex justify-between")}>
                        <span className={cn("text-wl-text-secondary")}>Completed:</span>
                        <span className={cn("text-wl-text-primary font-medium")}>
                          {new Date(selectedEnvelope.completedDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    <div className={cn("flex justify-between")}>
                      <span className={cn("text-wl-text-secondary")}>Documents:</span>
                      <span className={cn("text-wl-text-primary font-medium")}>
                        {selectedEnvelope.documentCount}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Audit Trail */}
              <div>
                <h3 className={cn("text-sm font-semibold text-wl-text-secondary mb-3")}>
                  Timeline
                </h3>
                <div className={cn("space-y-3")}>
                  {auditEvents.slice(0, 6).map((evt: any) => (
                    <div
                      key={evt.id}
                      className={cn(
                        "p-3 bg-wl-bg-overlay rounded-md border-l-2 border-wl-border-active"
                      )}
                    >
                      <div className={cn("flex items-start justify-between mb-1")}>
                        <p className={cn("text-xs font-semibold text-wl-text-primary")}>
                          {evt.action}
                        </p>
                        <span className={cn("text-xs text-wl-text-secondary")}>
                          {new Date(evt.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className={cn("text-xs text-wl-text-secondary")}>
                        by {evt.actor.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default function EnvelopesPage() {
  const { envelopes, loading } = useEnvelopes();
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
      ? envelopes
      : envelopes.filter((e) => e.status === filterStatus);

  return (
    <div className={cn("p-6 space-y-6")}>
      {/* Header */}
      <div className={cn("flex items-center justify-between")}>
        <div>
          <h1 className={cn("text-2xl font-bold text-wl-text-primary")}>
            Envelope Management
          </h1>
          <p className={cn("text-sm text-wl-text-secondary mt-1")}>
            Create, send, and track document envelopes
          </p>
        </div>
        <Button variant="primary">
          Create Envelope
        </Button>
      </div>

      {/* Filters */}
      <Card className={cn("bg-wl-bg-elevated border-wl-border-subtle")}>
        <CardContent className={cn("pt-6")}>
          <div className={cn("flex items-center gap-4")}>
            <label className={cn("text-sm font-medium text-wl-text-secondary")}>
              Filter by Status:
            </label>
            <div className={cn("flex gap-2")}>
              {statusOptions.map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    filterStatus === status
                      ? "bg-wl-brand text-white"
                      : "bg-wl-bg-overlay text-wl-text-secondary hover:text-wl-text-primary"
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

      {/* Create Envelope Wizard Info */}
      <Card className={cn("bg-wl-bg-elevated border-wl-border-subtle border-2 border-wl-status-info")}>
        <CardHeader>
          <CardTitle className={cn("text-base text-wl-status-info")}>
            Envelope Creation Wizard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className={cn("space-y-2 text-sm text-wl-text-secondary")}>
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
          <p className={cn("text-xs text-wl-text-secondary mt-4")}>
            Click "Create Envelope" button above to start the process.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
