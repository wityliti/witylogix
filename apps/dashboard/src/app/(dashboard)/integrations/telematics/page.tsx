'use client';

import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function TelematicsPage() {
  return (
    <>
      <Header
        title="Telematics Providers"
        subtitle="Configure vehicle tracking and telemetry data integration"
        actions={<Button variant="primary">Add Connection</Button>}
      />

      <div className={cn("p-6 bg-wl-bg-root space-y-6")}>
        {/* Overview */}
        <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4")}>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Connected Providers</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-white")}>0</div>
              <p className={cn("text-xs text-gray-300 mt-1")}>providers active</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tracked Vehicles</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-white")}>0</div>
              <p className={cn("text-xs text-gray-300 mt-1")}>total mapped devices</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Total Records</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-white")}>0</div>
              <p className={cn("text-xs text-gray-300 mt-1")}>synced total</p>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Errors/Week</CardTitle>
            </CardHeader>
            <div className={cn("p-4 pt-0")}>
              <div className={cn("text-2xl font-bold text-gray-500")}>—</div>
              <p className={cn("text-xs text-gray-300 mt-1")}>no active providers</p>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Connected Providers</CardTitle>
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
                        "p-3 rounded border border-wl-border-default hover:border-blue-400 text-left transition"
                      )}
                    >
                      <p className={cn("font-semibold text-white")}>{provider.name}</p>
                    </button>
                  ))}
                </div>
              )}

              {wizardStep === "credentials" && (
                <div className={cn("space-y-4")}>
                  <p className={cn("text-sm text-gray-300")}>
                    Step 1: Enter credentials for {TELEMATICS_PROVIDERS.find((p) => p.id === wizardProvider)?.name}
                  </p>
                  <div>
                    <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                      API Key
                    </label>
                    <input
                      type="password"
                      placeholder="Enter API key"
                      className={cn(
                        "w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-sm outline-none"
                      )}
                    />
                  </div>
                  <div>
                    <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                      Account ID
                    </label>
                    <input
                      type="text"
                      placeholder="Enter account ID"
                      className={cn(
                        "w-full px-3 py-2 bg-wl-bg-elevated border border-wl-border-default rounded text-white text-sm outline-none"
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
                  <p className={cn("text-sm text-gray-300")}>
                    Step 2: Testing connection...
                  </p>
                  <div className={cn("bg-wl-bg-surface p-3 rounded border border-wl-border-default")}>
                    <p className={cn("text-xs text-gray-400 mb-2")}>✓ Authentication successful</p>
                    <p className={cn("text-xs text-gray-400 mb-2")}>✓ API endpoint reachable</p>
                    <p className={cn("text-xs text-gray-400 mb-2")}>✓ Rate limits OK</p>
                    <p className={cn("text-xs text-emerald-500")}>Connection test passed!</p>
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
                  <div className={cn("bg-emerald-500/10 border border-emerald-500 p-3 rounded text-sm text-emerald-600")}>
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

        <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-6")}>
          {/* Provider Grid */}
          <div className={cn("lg:col-span-2 space-y-4")}>
            <div className={cn("flex items-center justify-between")}>
              <h2 className={cn("text-lg font-semibold text-white")}>Connected Providers</h2>
              <Button variant="secondary" size="sm">
                Sync All
              </Button>
            </div>

            <div className={cn("grid grid-cols-1 gap-3")}>
              {TELEMATICS_PROVIDERS.map((provider) => (
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
                        <p className={cn("text-xs text-gray-300")}>
                          {provider.vehicleMappings.length} vehicle{provider.vehicleMappings.length !== 1 ? "s" : ""} mapped
                        </p>
                      </div>
                      <ConnectionStatusBadge status={provider.status} />
                    </div>

                    <div className={cn("grid grid-cols-4 gap-3")}>
                      <div>
                        <p className={cn("text-xs text-gray-300")}>Last Sync</p>
                        <p className={cn("text-sm font-semibold text-white")}>{provider.lastSync}</p>
                      </div>
                      <div>
                        <p className={cn("text-xs text-gray-300")}>Freshness</p>
                        <p className={cn("text-sm font-semibold text-white")}>{provider.syncStats.dataFreshness}</p>
                      </div>
                      <div>
                        <p className={cn("text-xs text-gray-300")}>Total Synced</p>
                        <p className={cn("text-sm font-semibold text-white")}>
                          {(provider.syncStats.totalRecords / 1000).toFixed(0)}k
                        </p>
                      </div>
                      <div>
                        <p className={cn("text-xs text-gray-300")}>Errors</p>
                        <p className={cn("text-sm font-semibold text-amber-500")}>
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
                      <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                        Connection Status
                      </label>
                      <div className={cn("flex items-center gap-2")}>
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            selected.status === "CONNECTED"
                              ? "bg-emerald-500"
                              : selected.status === "ERROR"
                                ? "bg-red-500"
                                : "bg-gray-300"
                          )}
                        />
                        <p className={cn("text-sm text-white")}>{selected.status}</p>
                      </div>
                    </div>

                    <div>
                      <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                        Poll Interval
                      </label>
                      <p className={cn("text-sm font-mono text-white")}>{selected.pollInterval} seconds</p>
                    </div>

                    <div>
                      <label className={cn("text-xs font-semibold text-gray-400 block mb-2")}>
                        Batch Size
                      </label>
                      <p className={cn("text-sm font-mono text-white")}>{selected.batchSize} records</p>
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
                          <p className={cn("text-sm font-semibold text-white")}>{dataType.name}</p>
                          <p className={cn("text-xs text-gray-300")}>{dataType.frequency}</p>
                        </div>
                        <div
                          className={cn(
                            "w-3 h-3 rounded-full mt-1",
                            dataType.enabled ? "bg-emerald-500" : "bg-wl-bg-elevated"
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
                  <p className={cn("text-gray-300")}>Select a provider to view details</p>
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
                  <tr className={cn("border-b border-wl-border-default")}>
                    <th className={cn("text-left p-4 text-xs font-semibold text-gray-300")}>
                      Witylogix Vehicle
                    </th>
                    <th className={cn("text-left p-4 text-xs font-semibold text-gray-300")}>
                      Device ID
                    </th>
                    <th className={cn("text-left p-4 text-xs font-semibold text-gray-300")}>
                      Device Name
                    </th>
                    <th className={cn("text-left p-4 text-xs font-semibold text-gray-300")}>
                      Last Sync
                    </th>
                    <th className={cn("text-left p-4 text-xs font-semibold text-gray-300")}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selected.vehicleMappings.map((mapping) => (
                    <tr key={mapping.witylogixId} className={cn("border-b border-wl-border-default hover:bg-wl-bg-surface")}>
                      <td className={cn("p-4")}>
                        <div>
                          <p className={cn("font-semibold text-white text-sm")}>{mapping.witylogixName}</p>
                          <p className={cn("text-xs text-gray-300")}>{mapping.witylogixId}</p>
                        </div>
                      </td>
                      <td className={cn("p-4 font-mono text-xs text-white")}>{mapping.deviceId}</td>
                      <td className={cn("p-4 text-white")}>{mapping.deviceName}</td>
                      <td className={cn("p-4 text-xs text-gray-300")}>{mapping.lastSync}</td>
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
                  <div key={mapping.witylogixId} className={cn("p-3 rounded bg-wl-bg-surface border border-wl-border-default")}>
                    <p className={cn("font-semibold text-white text-sm mb-3")}>{mapping.witylogixName}</p>
                    <div className={cn("space-y-2 text-xs")}>
                      <div className={cn("flex justify-between")}>
                        <span className={cn("text-gray-300")}>Position</span>
                        <span className={cn("text-white font-mono")}>37.7749°N, 122.4194°W</span>
                      </div>
                      <div className={cn("flex justify-between")}>
                        <span className={cn("text-gray-300")}>Speed</span>
                        <span className={cn("text-white font-mono")}>32 mph</span>
                      </div>
                      <div className={cn("flex justify-between")}>
                        <span className={cn("text-gray-300")}>Fuel Level</span>
                        <span className={cn("text-white font-mono")}>78%</span>
                      </div>
                      <div className={cn("flex justify-between")}>
                        <span className={cn("text-gray-300")}>Engine Hours</span>
                        <span className={cn("text-white font-mono")}>2,340 h</span>
                      </div>
                      <div className={cn("flex justify-between")}>
                        <span className={cn("text-gray-300")}>Last Update</span>
                        <span className={cn("text-white font-mono")}>15s ago</span>
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
