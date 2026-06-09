'use client';

import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2 } from 'lucide-react';

export default function ERPPage() {
  return (
    <>
      <Header
        title="ERP & Accounting Providers"
        subtitle="Configure accounting software integrations and data synchronization"
        actions={
          <Link href="/integrations/marketplace">
            <Button variant="primary" size="sm">Browse Marketplace</Button>
          </Link>
        }
      />

      <div className={cn("p-6 space-y-6")}>
        {/* Overview */}
        <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4")}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Connected</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-white")}>
                {ERP_PROVIDERS.filter((p) => p.status === "CONNECTED").length}
              </div>
              <p className={cn("text-xs text-gray-500 mt-1")}>providers active</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Synced Entities</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-white")}>
                {ERP_PROVIDERS.reduce(
                  (sum, p) => sum + p.syncEntities.filter((e) => e.enabled).length,
                  0
                )}
              </div>
              <p className={cn("text-xs text-gray-500 mt-1")}>entity types</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Records</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-white")}>
                {(
                  ERP_PROVIDERS.reduce(
                    (sum, p) => sum + p.syncEntities.reduce((s, e) => s + e.count, 0),
                    0
                  ) / 1000
                ).toFixed(0)}
                <span className="text-xs text-gray-500">k</span>
              </div>
              <p className={cn("text-xs text-gray-500 mt-1")}>synced records</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Sync Health</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-emerald-500")}>
                99.8
                <span className="text-xs text-gray-500">%</span>
              </div>
              <p className={cn("text-xs text-gray-500 mt-1")}>success rate</p>
            </div>
          </Card>
        </div>

        <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-6")}>
          {/* Provider Grid */}
          <div className={cn("lg:col-span-2 space-y-4")}>
            <div className={cn("flex items-center justify-between")}>
              <h2 className={cn("text-lg font-semibold text-white")}>ERP Providers</h2>
              <Button variant="secondary" size="sm">
                Force Sync All
              </Button>
            </div>

            <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-3")}>
              {ERP_PROVIDERS.map((provider) => (
                <Card
                  key={provider.id}
                  className={cn(
                    "cursor-pointer transition-all hover:border-blue-400",
                    selectedProvider === provider.id && "border-blue-500 bg-wl-bg-surface"
                  )}
                  onClick={() => setSelectedProvider(provider.id)}
                >
                  <div className={cn("p-4")}>
                    <div className={cn("flex items-start justify-between mb-3")}>
                      <div>
                        <h3 className={cn("font-semibold text-white")}>{provider.name}</h3>
                        <p className={cn("text-xs text-gray-500")}>
                          {provider.syncEntities.filter((e) => e.enabled).length} entities enabled
                        </p>
                      </div>
                      <StatusBadge status={provider.status} />
                    </div>

                    <div className={cn("grid grid-cols-2 gap-2 text-xs mb-3")}>
                      <div>
                        <p className={cn("text-gray-500")}>Last Sync</p>
                        <p className={cn("font-semibold text-white")}>{provider.lastSync}</p>
                      </div>
                      <div>
                        <p className={cn("text-gray-500")}>Direction</p>
                        <p className={cn("font-semibold text-white")}>
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
                      <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                        Status
                      </label>
                      <div className={cn("flex items-center gap-2")}>
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            selected.status === "CONNECTED"
                              ? "bg-emerald-500"
                              : selected.status === "EXPIRED"
                                ? "bg-amber-500"
                                : "bg-red-500"
                          )}
                        />
                        <p className={cn("text-sm text-white")}>{selected.status}</p>
                      </div>
                    </div>

                    {selected.tokenExpiry && (
                      <div>
                        <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                          Token Expires
                        </label>
                        <p className={cn("text-sm text-white")}>{selected.tokenExpiry}</p>
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
                      <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                        Sync Direction
                      </label>
                      <p className={cn("text-sm text-white")}>
                        {selected.syncDirection.replace(/_/g, " ")}
                      </p>
                    </div>

                    <div>
                      <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                        Conflict Resolution
                      </label>
                      <p className={cn("text-sm text-white")}>
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
                  <p className={cn("text-gray-500")}>Select a provider to view details</p>
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
                      "flex items-center justify-between p-3 rounded bg-wl-bg-surface border border-wl-border-default"
                    )}
                  >
                    <div className={cn("flex-1")}>
                      <p className={cn("font-semibold text-white")}>{entity.name}</p>
                      <p className={cn("text-xs text-gray-500")}>{entity.count.toLocaleString()} records</p>
                    </div>
                    <div
                      className={cn(
                        "w-3 h-3 rounded-full",
                        entity.enabled ? "bg-emerald-500" : "border-wl-border-default"
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
                  <tr className={cn("border-b border-wl-border-default")}>
                    <th className={cn("text-left p-4 text-xs font-semibold text-gray-500")}>
                      Witylogix Field
                    </th>
                    <th className={cn("text-left p-4 text-xs font-semibold text-gray-500")}>
                      ERP Field
                    </th>
                    <th className={cn("text-left p-4 text-xs font-semibold text-gray-500")}>
                      Data Type
                    </th>
                    <th className={cn("text-left p-4 text-xs font-semibold text-gray-500")}>
                      Auto Mapped
                    </th>
                    <th className={cn("text-left p-4 text-xs font-semibold text-gray-500")}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selected.fieldMappings.map((mapping) => (
                    <tr key={mapping.witylogixField} className={cn("border-b border-wl-border-default hover:bg-wl-bg-surface")}>
                      <td className={cn("p-4 font-mono text-xs text-white")}>{mapping.witylogixField}</td>
                      <td className={cn("p-4 font-mono text-xs text-white")}>{mapping.erpField}</td>
                      <td className={cn("p-4 text-xs text-gray-500")}>
                        <Badge variant="info">{mapping.dataType}</Badge>
                      </td>
                      <td className={cn("p-4")}>
                        <div
                          className={cn(
                            "w-3 h-3 rounded-full",
                            mapping.autoMapped ? "bg-emerald-500" : "text-gray-500"
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

            <div className={cn("p-4 pt-4 border-t border-wl-border-default")}>
              <Button variant="secondary" size="sm">
                Auto-Map All Fields
              </Button>
            </div>
          </Card>
        )}

        {/* Sync Log */}
        <Card>
          <CardHeader>
            <CardTitle>ERP Providers</CardTitle>
          </CardHeader>
          <div className={cn("overflow-x-auto")}>
            <table className={cn("w-full text-sm")}>
              <thead>
                <tr className={cn("border-b border-wl-border-default")}>
                  <th className={cn("text-left p-4 text-xs font-semibold text-gray-500")}>
                    Timestamp
                  </th>
                  <th className={cn("text-left p-4 text-xs font-semibold text-gray-500")}>
                    Entity
                  </th>
                  <th className={cn("text-left p-4 text-xs font-semibold text-gray-500")}>
                    Status
                  </th>
                  <th className={cn("text-left p-4 text-xs font-semibold text-gray-500")}>
                    Records
                  </th>
                  <th className={cn("text-left p-4 text-xs font-semibold text-gray-500")}>
                    Errors
                  </th>
                </tr>
              </thead>
              <tbody>
                {SYNC_LOG.map((operation) => (
                  <tr key={operation.id} className={cn("border-b border-wl-border-default hover:bg-wl-bg-surface")}>
                    <td className={cn("p-4 text-xs text-gray-500")}>{operation.timestamp}</td>
                    <td className={cn("p-4 font-semibold text-white")}>{operation.entity}</td>
                    <td className={cn("p-4")}>
                      <SyncStatusBadge status={operation.status} />
                    </td>
                    <td className={cn("p-4 text-white")}>{operation.recordsAffected}</td>
                    <td className={cn("p-4")}>
                      {operation.errors > 0 ? (
                        <span className={cn("text-amber-500 font-semibold")}>{operation.errors}</span>
                      ) : (
                        <span className={cn("text-gray-500")}>—</span>
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
