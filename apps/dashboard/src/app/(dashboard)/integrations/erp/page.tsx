"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/* ═══════════════════════════════════════════════════════════
   ERP & ACCOUNTING PROVIDER CONFIGURATION PAGE
   Integration: QuickBooks, Xero, SAP, Oracle NetSuite, MS Dynamics 365, Sage, FreshBooks, Wave
   ═══════════════════════════════════════════════════════════ */

type OAuthStatus = "CONNECTED" | "DISCONNECTED" | "EXPIRED" | "ERROR";
type SyncDirection = "TO_ERP" | "FROM_ERP" | "BIDIRECTIONAL";
type ConflictResolution = "WITYLOGIX_WINS" | "ERP_WINS" | "MANUAL_REVIEW";

interface FieldMapping {
  witylogixField: string;
  erpField: string;
  dataType: string;
  autoMapped: boolean;
}

interface SyncOperation {
  id: string;
  timestamp: string;
  entity: string;
  status: "SUCCESS" | "FAILED" | "IN_PROGRESS";
  recordsAffected: number;
  errors: number;
}

interface ERPProvider {
  id: string;
  name: string;
  category: string;
  status: OAuthStatus;
  tokenExpiry?: string;
  lastSync: string;
  syncEntities: { name: string; enabled: boolean; count: number }[];
  syncDirection: SyncDirection;
  fieldMappings: FieldMapping[];
  conflictResolution: ConflictResolution;
}

const ERP_PROVIDERS: ERPProvider[] = [
  {
    id: "quickbooks",
    name: "QuickBooks",
    category: "Accounting",
    status: "CONNECTED",
    tokenExpiry: "2026-06-12",
    lastSync: "2 hours ago",
    syncEntities: [
      { name: "Invoices", enabled: true, count: 1240 },
      { name: "Customers", enabled: true, count: 342 },
      { name: "Products", enabled: true, count: 856 },
      { name: "Payments", enabled: true, count: 3420 },
      { name: "Expenses", enabled: false, count: 0 },
    ],
    syncDirection: "BIDIRECTIONAL",
    fieldMappings: [
      { witylogixField: "order_id", erpField: "invoice_number", dataType: "string", autoMapped: true },
      { witylogixField: "customer_name", erpField: "customer_name", dataType: "string", autoMapped: true },
      { witylogixField: "total_amount", erpField: "total", dataType: "decimal", autoMapped: true },
      { witylogixField: "created_date", erpField: "invoice_date", dataType: "date", autoMapped: true },
      { witylogixField: "status", erpField: "status", dataType: "enum", autoMapped: false },
    ],
    conflictResolution: "WITYLOGIX_WINS",
  },
  {
    id: "xero",
    name: "Xero",
    category: "Accounting",
    status: "CONNECTED",
    tokenExpiry: "2026-04-20",
    lastSync: "5 hours ago",
    syncEntities: [
      { name: "Invoices", enabled: true, count: 892 },
      { name: "Customers", enabled: true, count: 267 },
      { name: "Products", enabled: true, count: 543 },
      { name: "Payments", enabled: true, count: 2156 },
      { name: "Bank Feeds", enabled: true, count: 450 },
    ],
    syncDirection: "BIDIRECTIONAL",
    fieldMappings: [
      { witylogixField: "order_id", erpField: "invoice_number", dataType: "string", autoMapped: true },
      { witylogixField: "customer_name", erpField: "contact_name", dataType: "string", autoMapped: true },
      { witylogixField: "total_amount", erpField: "total", dataType: "decimal", autoMapped: true },
      { witylogixField: "line_items", erpField: "line_items", dataType: "array", autoMapped: true },
    ],
    conflictResolution: "ERP_WINS",
  },
  {
    id: "sap",
    name: "SAP",
    category: "ERP",
    status: "CONNECTED",
    tokenExpiry: "2026-08-30",
    lastSync: "12 hours ago",
    syncEntities: [
      { name: "Purchase Orders", enabled: true, count: 2340 },
      { name: "Sales Orders", enabled: true, count: 3120 },
      { name: "Materials", enabled: true, count: 5820 },
      { name: "Vendors", enabled: true, count: 834 },
      { name: "Customers", enabled: true, count: 1456 },
    ],
    syncDirection: "BIDIRECTIONAL",
    fieldMappings: [
      { witylogixField: "order_id", erpField: "so_number", dataType: "string", autoMapped: true },
      { witylogixField: "vendor_id", erpField: "vendor_code", dataType: "string", autoMapped: true },
      { witylogixField: "quantity", erpField: "qty_ordered", dataType: "integer", autoMapped: true },
    ],
    conflictResolution: "MANUAL_REVIEW",
  },
  {
    id: "netsuite",
    name: "Oracle NetSuite",
    category: "ERP",
    status: "EXPIRED",
    tokenExpiry: "2024-03-01",
    lastSync: "30 days ago",
    syncEntities: [
      { name: "Transactions", enabled: true, count: 8920 },
      { name: "Customers", enabled: true, count: 2134 },
      { name: "Items", enabled: true, count: 7654 },
      { name: "Accounts", enabled: false, count: 0 },
    ],
    syncDirection: "TO_ERP",
    fieldMappings: [
      { witylogixField: "transaction_id", erpField: "transaction_id", dataType: "string", autoMapped: true },
    ],
    conflictResolution: "WITYLOGIX_WINS",
  },
  {
    id: "dynamics365",
    name: "Microsoft Dynamics 365",
    category: "ERP",
    status: "DISCONNECTED",
    lastSync: "N/A",
    syncEntities: [
      { name: "Sales Orders", enabled: false, count: 0 },
      { name: "Customers", enabled: false, count: 0 },
      { name: "Products", enabled: false, count: 0 },
    ],
    syncDirection: "BIDIRECTIONAL",
    fieldMappings: [],
    conflictResolution: "WITYLOGIX_WINS",
  },
  {
    id: "sage",
    name: "Sage",
    category: "Accounting",
    status: "CONNECTED",
    tokenExpiry: "2026-05-15",
    lastSync: "3 hours ago",
    syncEntities: [
      { name: "Invoices", enabled: true, count: 654 },
      { name: "Customers", enabled: true, count: 189 },
      { name: "Suppliers", enabled: true, count: 234 },
      { name: "Accounts", enabled: true, count: 450 },
    ],
    syncDirection: "BIDIRECTIONAL",
    fieldMappings: [
      { witylogixField: "invoice_number", erpField: "invoice_number", dataType: "string", autoMapped: true },
    ],
    conflictResolution: "ERP_WINS",
  },
  {
    id: "freshbooks",
    name: "FreshBooks",
    category: "Accounting",
    status: "ERROR",
    lastSync: "6 hours ago",
    syncEntities: [
      { name: "Invoices", enabled: true, count: 523 },
      { name: "Clients", enabled: true, count: 145 },
      { name: "Expenses", enabled: false, count: 0 },
    ],
    syncDirection: "TO_ERP",
    fieldMappings: [
      { witylogixField: "invoice_id", erpField: "invoice_id", dataType: "string", autoMapped: true },
    ],
    conflictResolution: "MANUAL_REVIEW",
  },
  {
    id: "wave",
    name: "Wave",
    category: "Accounting",
    status: "CONNECTED",
    tokenExpiry: "2026-07-22",
    lastSync: "1 hour ago",
    syncEntities: [
      { name: "Invoices", enabled: true, count: 412 },
      { name: "Customers", enabled: true, count: 98 },
      { name: "Payments", enabled: true, count: 1240 },
    ],
    syncDirection: "BIDIRECTIONAL",
    fieldMappings: [
      { witylogixField: "customer_id", erpField: "customer_id", dataType: "string", autoMapped: true },
    ],
    conflictResolution: "WITYLOGIX_WINS",
  },
];

const SYNC_LOG: SyncOperation[] = [
  { id: "sync-1", timestamp: "2 minutes ago", entity: "Invoices", status: "SUCCESS", recordsAffected: 156, errors: 0 },
  { id: "sync-2", timestamp: "15 minutes ago", entity: "Customers", status: "SUCCESS", recordsAffected: 23, errors: 0 },
  { id: "sync-3", timestamp: "45 minutes ago", entity: "Payments", status: "SUCCESS", recordsAffected: 89, errors: 2 },
  { id: "sync-4", timestamp: "2 hours ago", entity: "Invoices", status: "SUCCESS", recordsAffected: 312, errors: 0 },
  { id: "sync-5", timestamp: "5 hours ago", entity: "Products", status: "FAILED", recordsAffected: 0, errors: 45 },
];

function StatusBadge({ status }: { status: OAuthStatus }) {
  const variants: Record<OAuthStatus, "success" | "warning" | "danger" | "default"> = {
    CONNECTED: "success",
    DISCONNECTED: "default",
    EXPIRED: "warning",
    ERROR: "danger",
  };
  return <Badge variant={variants[status]}>{status.replace(/_/g, " ")}</Badge>;
}

function SyncStatusBadge({ status }: { status: "SUCCESS" | "FAILED" | "IN_PROGRESS" }) {
  const variants: Record<typeof status, "success" | "danger" | "info"> = {
    SUCCESS: "success",
    FAILED: "danger",
    IN_PROGRESS: "info",
  };
  return <Badge variant={variants}>{status.replace(/_/g, " ")}</Badge>;
}

export default function ERPPage() {
  const [selectedProvider, setSelectedProvider] = useState<string | null>("quickbooks");
  const [showFieldMapping, setShowFieldMapping] = useState(false);

  const selected = selectedProvider ? ERP_PROVIDERS.find((p) => p.id === selectedProvider) : null;

  return (
    <>
      <Header
        title="ERP & Accounting Providers"
        subtitle="Configure accounting software integrations and data synchronization"
        actions={<Button variant="primary">Add Provider</Button>}
      />

      <div className={cn("p-6 space-y-6")}>
        {/* Overview */}
        <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4")}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Connected</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-wl-text-primary")}>
                {ERP_PROVIDERS.filter((p) => p.status === "CONNECTED").length}
              </div>
              <p className={cn("text-xs text-wl-text-tertiary mt-1")}>providers active</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Synced Entities</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-wl-text-primary")}>
                {ERP_PROVIDERS.reduce(
                  (sum, p) => sum + p.syncEntities.filter((e) => e.enabled).length,
                  0
                )}
              </div>
              <p className={cn("text-xs text-wl-text-tertiary mt-1")}>entity types</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Records</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-wl-text-primary")}>
                {(
                  ERP_PROVIDERS.reduce(
                    (sum, p) => sum + p.syncEntities.reduce((s, e) => s + e.count, 0),
                    0
                  ) / 1000
                ).toFixed(0)}
                <span className="text-xs text-wl-text-tertiary">k</span>
              </div>
              <p className={cn("text-xs text-wl-text-tertiary mt-1")}>synced records</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Sync Health</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-wl-success-500")}>
                99.8
                <span className="text-xs text-wl-text-tertiary">%</span>
              </div>
              <p className={cn("text-xs text-wl-text-tertiary mt-1")}>success rate</p>
            </div>
          </Card>
        </div>

        <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-6")}>
          {/* Provider Grid */}
          <div className={cn("lg:col-span-2 space-y-4")}>
            <div className={cn("flex items-center justify-between")}>
              <h2 className={cn("text-lg font-semibold text-wl-text-primary")}>ERP Providers</h2>
              <Button variant="secondary" size="sm">
                Force Sync All
              </Button>
            </div>

            <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-3")}>
              {ERP_PROVIDERS.map((provider) => (
                <Card
                  key={provider.id}
                  className={cn(
                    "cursor-pointer transition-all hover:border-wl-primary-400",
                    selectedProvider === provider.id && "border-wl-primary-500 bg-wl-bg-surface"
                  )}
                  onClick={() => setSelectedProvider(provider.id)}
                >
                  <div className={cn("p-4")}>
                    <div className={cn("flex items-start justify-between mb-3")}>
                      <div>
                        <h3 className={cn("font-semibold text-wl-text-primary")}>{provider.name}</h3>
                        <p className={cn("text-xs text-wl-text-tertiary")}>
                          {provider.syncEntities.filter((e) => e.enabled).length} entities enabled
                        </p>
                      </div>
                      <StatusBadge status={provider.status} />
                    </div>

                    <div className={cn("grid grid-cols-2 gap-2 text-xs mb-3")}>
                      <div>
                        <p className={cn("text-wl-text-tertiary")}>Last Sync</p>
                        <p className={cn("font-semibold text-wl-text-primary")}>{provider.lastSync}</p>
                      </div>
                      <div>
                        <p className={cn("text-wl-text-tertiary")}>Direction</p>
                        <p className={cn("font-semibold text-wl-text-primary")}>
                          {provider.syncDirection.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>

                    <Button variant="ghost" size="sm" className="w-full">
                      Configure
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Detail Panel */}
          <div className={cn("space-y-4")}>
            {selected ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>OAuth Connection</CardTitle>
                  </CardHeader>
                  <div className={cn("p-4 pt-0 space-y-3")}>
                    <div>
                      <label className={cn("text-xs font-semibold text-wl-text-secondary block mb-2")}>
                        Status
                      </label>
                      <div className={cn("flex items-center gap-2")}>
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            selected.status === "CONNECTED"
                              ? "bg-wl-success-500"
                              : selected.status === "EXPIRED"
                                ? "bg-wl-warning-500"
                                : "bg-wl-danger-500"
                          )}
                        />
                        <p className={cn("text-sm text-wl-text-primary")}>{selected.status}</p>
                      </div>
                    </div>

                    {selected.tokenExpiry && (
                      <div>
                        <label className={cn("text-xs font-semibold text-wl-text-secondary block mb-2")}>
                          Token Expires
                        </label>
                        <p className={cn("text-sm text-wl-text-primary")}>{selected.tokenExpiry}</p>
                      </div>
                    )}

                    <Button
                      variant={selected.status === "CONNECTED" ? "ghost" : "primary"}
                      size="sm"
                      className="w-full"
                    >
                      {selected.status === "CONNECTED" ? "Reconnect" : "Connect"}
                    </Button>
                  </div>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Sync Configuration</CardTitle>
                  </CardHeader>
                  <div className={cn("p-4 pt-0 space-y-3")}>
                    <div>
                      <label className={cn("text-xs font-semibold text-wl-text-secondary block mb-2")}>
                        Sync Direction
                      </label>
                      <p className={cn("text-sm text-wl-text-primary")}>
                        {selected.syncDirection.replace(/_/g, " ")}
                      </p>
                    </div>

                    <div>
                      <label className={cn("text-xs font-semibold text-wl-text-secondary block mb-2")}>
                        Conflict Resolution
                      </label>
                      <p className={cn("text-sm text-wl-text-primary")}>
                        {selected.conflictResolution.replace(/_/g, " ")}
                      </p>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowFieldMapping(!showFieldMapping)}
                    >
                      Edit Mapping
                    </Button>
                  </div>
                </Card>
              </>
            ) : (
              <Card>
                <div className={cn("p-8 text-center")}>
                  <p className={cn("text-wl-text-tertiary")}>Select a provider to view details</p>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Sync Entities Configuration */}
        {selected && (
          <Card>
            <CardHeader>
              <CardTitle>Sync Entities Configuration</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("space-y-2")}>
                {selected.syncEntities.map((entity) => (
                  <div
                    key={entity.name}
                    className={cn(
                      "flex items-center justify-between p-3 rounded bg-wl-bg-surface border border-wl-border-subtle"
                    )}
                  >
                    <div className={cn("flex-1")}>
                      <p className={cn("font-semibold text-wl-text-primary")}>{entity.name}</p>
                      <p className={cn("text-xs text-wl-text-tertiary")}>{entity.count.toLocaleString()} records</p>
                    </div>
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full",
                        entity.enabled ? "bg-wl-success-500" : "bg-wl-border-subtle"
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Field Mapping Table */}
        {selected && selected.fieldMappings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Field Mapping</CardTitle>
            </CardHeader>
            <div className={cn("overflow-x-auto")}>
              <table className={cn("w-full text-sm")}>
                <thead>
                  <tr className={cn("border-b border-wl-border-subtle")}>
                    <th className={cn("text-left p-4 text-xs font-semibold text-wl-text-tertiary")}>
                      Witylogix Field
                    </th>
                    <th className={cn("text-left p-4 text-xs font-semibold text-wl-text-tertiary")}>
                      ERP Field
                    </th>
                    <th className={cn("text-left p-4 text-xs font-semibold text-wl-text-tertiary")}>
                      Data Type
                    </th>
                    <th className={cn("text-left p-4 text-xs font-semibold text-wl-text-tertiary")}>
                      Auto Mapped
                    </th>
                    <th className={cn("text-left p-4 text-xs font-semibold text-wl-text-tertiary")}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selected.fieldMappings.map((mapping) => (
                    <tr key={mapping.witylogixField} className={cn("border-b border-wl-border-subtle hover:bg-wl-bg-surface")}>
                      <td className={cn("p-4 font-mono text-xs text-wl-text-primary")}>{mapping.witylogixField}</td>
                      <td className={cn("p-4 font-mono text-xs text-wl-text-primary")}>{mapping.erpField}</td>
                      <td className={cn("p-4 text-xs text-wl-text-tertiary")}>
                        <Badge variant="info">{mapping.dataType}</Badge>
                      </td>
                      <td className={cn("p-4")}>
                        <div
                          className={cn(
                            "w-3 h-3 rounded-full",
                            mapping.autoMapped ? "bg-wl-success-500" : "bg-wl-text-tertiary"
                          )}
                        />
                      </td>
                      <td className={cn("p-4")}>
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={cn("p-4 pt-4 border-t border-wl-border-subtle")}>
              <Button variant="secondary" size="sm">
                Auto-Map All Fields
              </Button>
            </div>
          </Card>
        )}

        {/* Sync Log */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Sync Operations</CardTitle>
          </CardHeader>
          <div className={cn("overflow-x-auto")}>
            <table className={cn("w-full text-sm")}>
              <thead>
                <tr className={cn("border-b border-wl-border-subtle")}>
                  <th className={cn("text-left p-4 text-xs font-semibold text-wl-text-tertiary")}>
                    Timestamp
                  </th>
                  <th className={cn("text-left p-4 text-xs font-semibold text-wl-text-tertiary")}>
                    Entity
                  </th>
                  <th className={cn("text-left p-4 text-xs font-semibold text-wl-text-tertiary")}>
                    Status
                  </th>
                  <th className={cn("text-left p-4 text-xs font-semibold text-wl-text-tertiary")}>
                    Records
                  </th>
                  <th className={cn("text-left p-4 text-xs font-semibold text-wl-text-tertiary")}>
                    Errors
                  </th>
                </tr>
              </thead>
              <tbody>
                {SYNC_LOG.map((operation) => (
                  <tr key={operation.id} className={cn("border-b border-wl-border-subtle hover:bg-wl-bg-surface")}>
                    <td className={cn("p-4 text-xs text-wl-text-tertiary")}>{operation.timestamp}</td>
                    <td className={cn("p-4 font-semibold text-wl-text-primary")}>{operation.entity}</td>
                    <td className={cn("p-4")}>
                      <SyncStatusBadge status={operation.status} />
                    </td>
                    <td className={cn("p-4 text-wl-text-primary")}>{operation.recordsAffected}</td>
                    <td className={cn("p-4")}>
                      {operation.errors > 0 ? (
                        <span className={cn("text-wl-warning-500 font-semibold")}>{operation.errors}</span>
                      ) : (
                        <span className={cn("text-wl-text-tertiary")}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
