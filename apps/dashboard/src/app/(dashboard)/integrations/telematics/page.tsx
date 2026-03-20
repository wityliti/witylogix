'use client';

import { useState } from 'react';
import { useApiList } from '@/hooks/use-api';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/* ═══════════════════════════════════════════════════════════
   TELEMATICS PROVIDER CONFIGURATION PAGE
   Integration: Samsara, Geotab, Flespi, Verizon Connect, Trimble, Fleetio, etc.
   ═══════════════════════════════════════════════════════════ */

type ConnectionStatus = "CONNECTED" | "DISCONNECTED" | "ERROR";

interface VehicleMapping {
  witylogixId: string;
  witylogixName: string;
  deviceId: string;
  deviceName: string;
  lastSync: string;
}

interface DataTypeConfig {
  name: string;
  enabled: boolean;
  frequency: string;
}

interface TelematicsProvider {
  id: string;
  name: string;
  status: ConnectionStatus;
  connectionTime: string;
  lastSync: string;
  pollInterval: number;
  batchSize: number;
  apiKey: string;
  accountId: string;
  dataTypes: DataTypeConfig[];
  vehicleMappings: VehicleMapping[];
  syncStats: {
    totalRecords: number;
    errorsThisWeek: number;
    dataFreshness: string;
  };
}

const TELEMATICS_PROVIDERS: TelematicsProvider[] = [
  {
    id: "samsara",
    name: "Samsara",
    status: "CONNECTED",
    connectionTime: "2 hours ago",
    lastSync: "30 seconds ago",
    pollInterval: 60,
    batchSize: 500,
    apiKey: "samsara_key_****",
    accountId: "SAM-4892-2024",
    dataTypes: [
      { name: "GPS Position", enabled: true, frequency: "Every 30 seconds" },
      { name: "Diagnostics", enabled: true, frequency: "Every 5 minutes" },
      { name: "Fuel Data", enabled: true, frequency: "Every hour" },
      { name: "Driver Behavior", enabled: true, frequency: "Real-time" },
      { name: "Vehicle Health", enabled: false, frequency: "Daily" },
    ],
    vehicleMappings: [
      { witylogixId: "VEH-001", witylogixName: "Van-01 (Downtown)", deviceId: "SAM-VAN-001", deviceName: "Samsara Van 001", lastSync: "30s ago" },
      { witylogixId: "VEH-002", witylogixName: "Truck-01 (Warehouse)", deviceId: "SAM-TRK-001", deviceName: "Samsara Truck 001", lastSync: "32s ago" },
      { witylogixId: "VEH-003", witylogixName: "Car-01 (Sales)", deviceId: "SAM-CAR-001", deviceName: "Samsara Car 001", lastSync: "31s ago" },
    ],
    syncStats: {
      totalRecords: 124580,
      errorsThisWeek: 3,
      dataFreshness: "Real-time",
    },
  },
  {
    id: "geotab",
    name: "Geotab",
    status: "CONNECTED",
    connectionTime: "5 hours ago",
    lastSync: "2 minutes ago",
    pollInterval: 120,
    batchSize: 250,
    apiKey: "geotab_key_****",
    accountId: "GEO-7234-2024",
    dataTypes: [
      { name: "GPS Position", enabled: true, frequency: "Every 60 seconds" },
      { name: "Diagnostics", enabled: true, frequency: "Every 10 minutes" },
      { name: "Fuel Data", enabled: false, frequency: "Every 2 hours" },
      { name: "Driver Behavior", enabled: true, frequency: "Every 5 minutes" },
      { name: "Vehicle Health", enabled: true, frequency: "Every hour" },
    ],
    vehicleMappings: [
      { witylogixId: "VEH-004", witylogixName: "Van-02 (Downtown)", deviceId: "GEO-VAN-002", deviceName: "Geotab Van 002", lastSync: "1m ago" },
      { witylogixId: "VEH-005", witylogixName: "Truck-02 (Warehouse)", deviceId: "GEO-TRK-002", deviceName: "Geotab Truck 002", lastSync: "2m ago" },
    ],
    syncStats: {
      totalRecords: 89340,
      errorsThisWeek: 7,
      dataFreshness: "5 minutes",
    },
  },
  {
    id: "flespi",
    name: "Flespi",
    status: "CONNECTED",
    connectionTime: "1 day ago",
    lastSync: "45 seconds ago",
    pollInterval: 45,
    batchSize: 1000,
    apiKey: "flespi_key_****",
    accountId: "FLES-5678-2024",
    dataTypes: [
      { name: "GPS Position", enabled: true, frequency: "Every 15 seconds" },
      { name: "Diagnostics", enabled: true, frequency: "Every 2 minutes" },
      { name: "Fuel Data", enabled: true, frequency: "Every 30 minutes" },
      { name: "Driver Behavior", enabled: false, frequency: "Real-time" },
      { name: "Vehicle Health", enabled: true, frequency: "Every 30 minutes" },
    ],
    vehicleMappings: [
      { witylogixId: "VEH-006", witylogixName: "Motorcycle-01", deviceId: "FLES-MTO-001", deviceName: "Flespi Moto 001", lastSync: "45s ago" },
    ],
    syncStats: {
      totalRecords: 54920,
      errorsThisWeek: 1,
      dataFreshness: "Real-time",
    },
  },
  {
    id: "verizon",
    name: "Verizon Connect",
    status: "ERROR",
    connectionTime: "Failed 3 hours ago",
    lastSync: "3 hours ago",
    pollInterval: 180,
    batchSize: 500,
    apiKey: "verizon_key_****",
    accountId: "VER-9012-2024",
    dataTypes: [
      { name: "GPS Position", enabled: true, frequency: "Every 90 seconds" },
      { name: "Diagnostics", enabled: true, frequency: "Every 15 minutes" },
      { name: "Fuel Data", enabled: false, frequency: "Daily" },
      { name: "Driver Behavior", enabled: true, frequency: "Every 10 minutes" },
      { name: "Vehicle Health", enabled: false, frequency: "Daily" },
    ],
    vehicleMappings: [
      { witylogixId: "VEH-007", witylogixName: "Van-03 (Uptown)", deviceId: "VER-VAN-003", deviceName: "Verizon Van 003", lastSync: "3h ago" },
    ],
    syncStats: {
      totalRecords: 28540,
      errorsThisWeek: 24,
      dataFreshness: "3 hours",
    },
  },
  {
    id: "trimble",
    name: "Trimble MAPS",
    status: "DISCONNECTED",
    connectionTime: "Never",
    lastSync: "N/A",
    pollInterval: 300,
    batchSize: 100,
    apiKey: "trimble_key_****",
    accountId: "TRIM-3456-2024",
    dataTypes: [
      { name: "GPS Position", enabled: false, frequency: "Every 2 minutes" },
      { name: "Diagnostics", enabled: false, frequency: "Every 30 minutes" },
      { name: "Fuel Data", enabled: false, frequency: "Daily" },
      { name: "Driver Behavior", enabled: false, frequency: "Every hour" },
      { name: "Vehicle Health", enabled: false, frequency: "Daily" },
    ],
    vehicleMappings: [],
    syncStats: {
      totalRecords: 0,
      errorsThisWeek: 0,
      dataFreshness: "N/A",
    },
  },
  {
    id: "fleetio",
    name: "Fleetio",
    status: "CONNECTED",
    connectionTime: "12 hours ago",
    lastSync: "5 minutes ago",
    pollInterval: 300,
    batchSize: 200,
    apiKey: "fleetio_key_****",
    accountId: "FLEET-2468-2024",
    dataTypes: [
      { name: "GPS Position", enabled: true, frequency: "Every 5 minutes" },
      { name: "Diagnostics", enabled: true, frequency: "Every 30 minutes" },
      { name: "Fuel Data", enabled: true, frequency: "Every hour" },
      { name: "Driver Behavior", enabled: false, frequency: "Every hour" },
      { name: "Vehicle Health", enabled: true, frequency: "Every 2 hours" },
    ],
    vehicleMappings: [
      { witylogixId: "VEH-008", witylogixName: "Truck-03 (South)", deviceId: "FLEET-TRK-003", deviceName: "Fleetio Truck 003", lastSync: "5m ago" },
    ],
    syncStats: {
      totalRecords: 18920,
      errorsThisWeek: 2,
      dataFreshness: "5 minutes",
    },
  },
];

function ConnectionStatusBadge({ status }: { status: ConnectionStatus }) {
  const variants: Record<ConnectionStatus, "success" | "warning" | "danger" | "default"> = {
    CONNECTED: "success",
    DISCONNECTED: "default",
    ERROR: "danger",
  };
  return <Badge variant={variants[status]}>{status}</Badge>;
}

export default function TelematicsPage() {
  const [selectedProvider, setSelectedProvider] = useState<string | null>("samsara");
  const [wizardStep, setWizardStep] = useState<"select" | "credentials" | "test" | "complete">("select");
  const [wizardProvider, setWizardProvider] = useState<string | null>(null);

  const selected = selectedProvider ? TELEMATICS_PROVIDERS.find((p) => p.id === selectedProvider) : null;

  return (
    <>
      <Header
        title="Telematics Providers"
        subtitle="Configure vehicle tracking and telemetry data integration"
        actions={
          <Button variant="primary" onClick={() => setWizardStep("select")}>
            Add Connection
          </Button>
        }
      />

      <div className={cn("p-6 space-y-6")}>
        {/* Overview */}
        <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4")}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Connected Providers</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-wl-text-primary")}>
                {TELEMATICS_PROVIDERS.filter((p) => p.status === "CONNECTED").length}
              </div>
              <p className={cn("text-xs text-wl-text-tertiary mt-1")}>out of {TELEMATICS_PROVIDERS.length}</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tracked Vehicles</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-wl-text-primary")}>
                {TELEMATICS_PROVIDERS.reduce((sum, p) => sum + p.vehicleMappings.length, 0)}
              </div>
              <p className={cn("text-xs text-wl-text-tertiary mt-1")}>total mapped devices</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Records</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-wl-text-primary")}>
                {(TELEMATICS_PROVIDERS.reduce((sum, p) => sum + p.syncStats.totalRecords, 0) / 1000).toFixed(0)}
                <span className="text-xs text-wl-text-tertiary">k</span>
              </div>
              <p className={cn("text-xs text-wl-text-tertiary mt-1")}>synced total</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Errors/Week</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-wl-warning-500")}>
                {TELEMATICS_PROVIDERS.reduce((sum, p) => sum + p.syncStats.errorsThisWeek, 0)}
              </div>
              <p className={cn("text-xs text-wl-text-tertiary mt-1")}>across all providers</p>
            </div>
          </Card>
        </div>

        {/* Connection Wizard Modal */}
        {wizardStep !== "select" && (
          <Card className={cn("border-wl-primary-400")}>
            <CardHeader>
              <CardTitle>Connection Wizard</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              {wizardStep === "select" && (
                <div className={cn("grid grid-cols-2 gap-3")}>
                  {TELEMATICS_PROVIDERS.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => {
                        setWizardProvider(provider.id);
                        setWizardStep("credentials");
                      }}
                      className={cn(
                        "p-3 rounded border border-wl-border-default hover:border-wl-primary-400 text-left transition"
                      )}
                    >
                      <p className={cn("font-semibold text-wl-text-primary")}>{provider.name}</p>
                    </button>
                  ))}
                </div>
              )}

              {wizardStep === "credentials" && (
                <div className={cn("space-y-4")}>
                  <p className={cn("text-sm text-wl-text-tertiary")}>
                    Step 1: Enter credentials for {TELEMATICS_PROVIDERS.find((p) => p.id === wizardProvider)?.name}
                  </p>
                  <div>
                    <label className={cn("text-xs font-semibold text-wl-text-secondary block mb-2")}>
                      API Key
                    </label>
                    <input
                      type="password"
                      placeholder="Enter API key"
                      className={cn(
                        "w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-wl-text-primary text-sm outline-none"
                      )}
                    />
                  </div>
                  <div>
                    <label className={cn("text-xs font-semibold text-wl-text-secondary block mb-2")}>
                      Account ID
                    </label>
                    <input
                      type="text"
                      placeholder="Enter account ID"
                      className={cn(
                        "w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-wl-text-primary text-sm outline-none"
                      )}
                    />
                  </div>
                  <div className={cn("flex gap-2")}>
                    <Button
                      variant="secondary"
                      onClick={() => setWizardStep("test")}
                      className="flex-1"
                    >
                      Test Connection
                    </Button>
                    <Button variant="ghost" onClick={() => setWizardStep("select")} className="flex-1">
                      Back
                    </Button>
                  </div>
                </div>
              )}

              {wizardStep === "test" && (
                <div className={cn("space-y-4")}>
                  <p className={cn("text-sm text-wl-text-tertiary")}>
                    Step 2: Testing connection...
                  </p>
                  <div className={cn("bg-wl-bg-surface p-3 rounded border border-wl-border-subtle")}>
                    <p className={cn("text-xs text-wl-text-secondary mb-2")}>✓ Authentication successful</p>
                    <p className={cn("text-xs text-wl-text-secondary mb-2")}>✓ API endpoint reachable</p>
                    <p className={cn("text-xs text-wl-text-secondary mb-2")}>✓ Rate limits OK</p>
                    <p className={cn("text-xs text-wl-success-500")}>Connection test passed!</p>
                  </div>
                  <div className={cn("flex gap-2")}>
                    <Button
                      variant="primary"
                      onClick={() => setWizardStep("complete")}
                      className="flex-1"
                    >
                      Save Connection
                    </Button>
                    <Button variant="ghost" onClick={() => setWizardStep("credentials")} className="flex-1">
                      Back
                    </Button>
                  </div>
                </div>
              )}

              {wizardStep === "complete" && (
                <div className={cn("space-y-4")}>
                  <div className={cn("bg-wl-success-500/10 border border-wl-success-500 p-3 rounded text-sm text-wl-success-600")}>
                    <p className={cn("font-semibold mb-1")}>✓ Connection established</p>
                    <p className={cn("text-xs")}>Your provider has been successfully connected and initial data sync has started.</p>
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => setWizardStep("select")}
                    className="w-full"
                  >
                    Done
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}

        <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-6")}>
          {/* Provider Grid */}
          <div className={cn("lg:col-span-2 space-y-4")}>
            <div className={cn("flex items-center justify-between")}>
              <h2 className={cn("text-lg font-semibold text-wl-text-primary")}>Connected Providers</h2>
              <Button variant="secondary" size="sm">
                Sync All
              </Button>
            </div>

            <div className={cn("grid grid-cols-1 gap-3")}>
              {TELEMATICS_PROVIDERS.map((provider) => (
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
                          {provider.vehicleMappings.length} vehicle{provider.vehicleMappings.length !== 1 ? "s" : ""} mapped
                        </p>
                      </div>
                      <ConnectionStatusBadge status={provider.status} />
                    </div>

                    <div className={cn("grid grid-cols-4 gap-3")}>
                      <div>
                        <p className={cn("text-xs text-wl-text-tertiary")}>Last Sync</p>
                        <p className={cn("text-sm font-semibold text-wl-text-primary")}>{provider.lastSync}</p>
                      </div>
                      <div>
                        <p className={cn("text-xs text-wl-text-tertiary")}>Freshness</p>
                        <p className={cn("text-sm font-semibold text-wl-text-primary")}>{provider.syncStats.dataFreshness}</p>
                      </div>
                      <div>
                        <p className={cn("text-xs text-wl-text-tertiary")}>Total Synced</p>
                        <p className={cn("text-sm font-semibold text-wl-text-primary")}>
                          {(provider.syncStats.totalRecords / 1000).toFixed(0)}k
                        </p>
                      </div>
                      <div>
                        <p className={cn("text-xs text-wl-text-tertiary")}>Errors</p>
                        <p className={cn("text-sm font-semibold text-wl-warning-500")}>
                          {provider.syncStats.errorsThisWeek}
                        </p>
                      </div>
                    </div>
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
                    <CardTitle>Configuration</CardTitle>
                  </CardHeader>
                  <div className={cn("p-4 pt-0 space-y-4")}>
                    <div>
                      <label className={cn("text-xs font-semibold text-wl-text-secondary block mb-2")}>
                        Connection Status
                      </label>
                      <div className={cn("flex items-center gap-2")}>
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            selected.status === "CONNECTED"
                              ? "bg-wl-success-500"
                              : selected.status === "ERROR"
                                ? "bg-wl-danger-500"
                                : "bg-wl-text-tertiary"
                          )}
                        />
                        <p className={cn("text-sm text-wl-text-primary")}>{selected.status}</p>
                      </div>
                    </div>

                    <div>
                      <label className={cn("text-xs font-semibold text-wl-text-secondary block mb-2")}>
                        Poll Interval
                      </label>
                      <p className={cn("text-sm font-mono text-wl-text-primary")}>{selected.pollInterval} seconds</p>
                    </div>

                    <div>
                      <label className={cn("text-xs font-semibold text-wl-text-secondary block mb-2")}>
                        Batch Size
                      </label>
                      <p className={cn("text-sm font-mono text-wl-text-primary")}>{selected.batchSize} records</p>
                    </div>

                    <div className={cn("flex gap-2")}>
                      <Button variant="secondary" size="sm" className="flex-1">
                        Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="flex-1">
                        Disconnect
                      </Button>
                    </div>
                  </div>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Data Types Enabled</CardTitle>
                  </CardHeader>
                  <div className={cn("p-4 pt-0 space-y-2")}>
                    {selected.dataTypes.map((dataType) => (
                      <div key={dataType.name} className={cn("flex items-start justify-between p-2 rounded hover:bg-wl-bg-elevated transition")}>
                        <div>
                          <p className={cn("text-sm font-semibold text-wl-text-primary")}>{dataType.name}</p>
                          <p className={cn("text-xs text-wl-text-tertiary")}>{dataType.frequency}</p>
                        </div>
                        <div
                          className={cn(
                            "w-3 h-3 rounded-full mt-1",
                            dataType.enabled ? "bg-wl-success-500" : "bg-wl-border-subtle"
                          )}
                        />
                      </div>
                    ))}
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

        {/* Vehicle Mapping */}
        {selected && selected.vehicleMappings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Mapping</CardTitle>
            </CardHeader>
            <div className={cn("overflow-x-auto")}>
              <table className={cn("w-full text-sm")}>
                <thead>
                  <tr className={cn("border-b border-wl-border-subtle")}>
                    <th className={cn("text-left p-4 text-xs font-semibold text-wl-text-tertiary")}>
                      Witylogix Vehicle
                    </th>
                    <th className={cn("text-left p-4 text-xs font-semibold text-wl-text-tertiary")}>
                      Device ID
                    </th>
                    <th className={cn("text-left p-4 text-xs font-semibold text-wl-text-tertiary")}>
                      Device Name
                    </th>
                    <th className={cn("text-left p-4 text-xs font-semibold text-wl-text-tertiary")}>
                      Last Sync
                    </th>
                    <th className={cn("text-left p-4 text-xs font-semibold text-wl-text-tertiary")}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selected.vehicleMappings.map((mapping) => (
                    <tr key={mapping.witylogixId} className={cn("border-b border-wl-border-subtle hover:bg-wl-bg-surface")}>
                      <td className={cn("p-4")}>
                        <div>
                          <p className={cn("font-semibold text-wl-text-primary text-sm")}>{mapping.witylogixName}</p>
                          <p className={cn("text-xs text-wl-text-tertiary")}>{mapping.witylogixId}</p>
                        </div>
                      </td>
                      <td className={cn("p-4 font-mono text-xs text-wl-text-primary")}>{mapping.deviceId}</td>
                      <td className={cn("p-4 text-wl-text-primary")}>{mapping.deviceName}</td>
                      <td className={cn("p-4 text-xs text-wl-text-tertiary")}>{mapping.lastSync}</td>
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
          </Card>
        )}

        {/* Real-time Data Preview */}
        {selected && selected.status === "CONNECTED" && (
          <Card>
            <CardHeader>
              <CardTitle>Real-time Data Preview</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4")}>
                {selected.vehicleMappings.slice(0, 3).map((mapping) => (
                  <div key={mapping.witylogixId} className={cn("p-3 rounded bg-wl-bg-surface border border-wl-border-subtle")}>
                    <p className={cn("font-semibold text-wl-text-primary text-sm mb-3")}>{mapping.witylogixName}</p>
                    <div className={cn("space-y-2 text-xs")}>
                      <div className={cn("flex justify-between")}>
                        <span className={cn("text-wl-text-tertiary")}>Position</span>
                        <span className={cn("text-wl-text-primary font-mono")}>37.7749°N, 122.4194°W</span>
                      </div>
                      <div className={cn("flex justify-between")}>
                        <span className={cn("text-wl-text-tertiary")}>Speed</span>
                        <span className={cn("text-wl-text-primary font-mono")}>32 mph</span>
                      </div>
                      <div className={cn("flex justify-between")}>
                        <span className={cn("text-wl-text-tertiary")}>Fuel Level</span>
                        <span className={cn("text-wl-text-primary font-mono")}>78%</span>
                      </div>
                      <div className={cn("flex justify-between")}>
                        <span className={cn("text-wl-text-tertiary")}>Engine Hours</span>
                        <span className={cn("text-wl-text-primary font-mono")}>2,340 h</span>
                      </div>
                      <div className={cn("flex justify-between")}>
                        <span className={cn("text-wl-text-tertiary")}>Last Update</span>
                        <span className={cn("text-wl-text-primary font-mono")}>15s ago</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
