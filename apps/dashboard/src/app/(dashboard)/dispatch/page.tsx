"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Zap, Plus, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatsBar } from "./components/stats-bar";
import { DispatchMap } from "./components/dispatch-map";
import { RouteTimeline } from "./components/route-timeline";
import { StopDetailPanel } from "./components/stop-detail-panel";
import { DriverCard } from "./components/driver-card";
import { createDispatchService } from "@witylogix/core/dispatch";
import type { Route, Stop, Driver, DispatchStats } from "@witylogix/core/dispatch";

/**
 * Route Timeline Dispatcher Dashboard
 *
 * Main page for real-time route dispatch management.
 * Features:
 * - Top stats bar (active drivers, stops, distance, time)
 * - Full-width layout with map (60%) and timeline (40%)
 * - Real-time route updates via WebSocket
 * - Drag-and-drop route reassignment
 * - Stop detail sidebar with action buttons
 */
export default function DispatchPage() {
  // State
  const [routes, setRoutes] = useState<Route[]>([]);
  const [drivers, setDrivers] = useState<Map<string, Driver>>(new Map());
  const [stats, setStats] = useState<DispatchStats | null>(null);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"unscheduled" | "scheduled">("unscheduled");
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  // Initialize dispatch service (normally injected)
  const dispatchService = useMemo(
    () => createDispatchService("default-shop"),
    []
  );

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [activeRoutes, activeDrivers, dispatchStats] = await Promise.all([
          dispatchService.getActiveRoutes(),
          dispatchService.getActiveDrivers(),
          dispatchService.getDispatchStats(),
        ]);

        setRoutes(activeRoutes);

        // Build driver map
        const driverMap = new Map<string, Driver>();
        for (const driver of activeDrivers) {
          driverMap.set(driver.id, driver);
        }
        setDrivers(driverMap);

        setStats(dispatchStats);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load dispatch data";
        setError(errorMessage);
        console.error("Dispatch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Set up periodic refresh (every 30 seconds)
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [dispatchService]);

  // Handle actions
  const handleOptimizeRoutes = useCallback(async () => {
    try {
      // Get unscheduled orders and available drivers
      const unscheduledOrders = await dispatchService.getUnscheduledOrders();
      const availableDriverIds = Array.from(drivers.keys()).filter(
        (id) => drivers.get(id)?.status !== "offline"
      );

      if (unscheduledOrders.length === 0) {
        setError("No unscheduled orders available for optimization");
        return;
      }

      const result = await dispatchService.optimizeRoutes({
        unscheduledOrderIds: unscheduledOrders,
        availableDriverIds,
        shopId: "default-shop",
        date: new Date(),
      });

      setRoutes(result.routes);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Optimization failed";
      setError(errorMessage);
    }
  }, [dispatchService, drivers]);

  const handleReassignStop = useCallback(
    async (stopId: string) => {
      // In a real implementation, this would open a modal to select target route
      console.log("Reassign stop:", stopId);
    },
    []
  );

  const handleSkipStop = useCallback(
    async (stopId: string) => {
      try {
        await dispatchService.skipStop(stopId, "Skipped by dispatcher");
        // Refresh routes
        const updated = await dispatchService.getActiveRoutes();
        setRoutes(updated);
        setSelectedStop(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to skip stop";
        setError(errorMessage);
      }
    },
    [dispatchService]
  );

  const handlePrioritizeStop = useCallback(async (stopId: string) => {
    console.log("Prioritize stop:", stopId);
  }, []);

  // Calculate counts
  const unscheduledCount = useMemo(() => {
    // In a real app, track unscheduled orders separately
    return Math.max(0, (stats?.totalStops || 0) - routes.length);
  }, [stats, routes]);

  const scheduledCount = useMemo(() => {
    return routes.length;
  }, [routes]);

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-primary">
      {/* Header */}
      <div className="bg-wl-bg-primary border-b border-wl-border-subtle sticky top-0 z-30">
        <div className="max-w-full mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-wl-text-primary tracking-tight">
                Route Dispatcher
              </h1>
              <p className="text-sm text-wl-text-secondary mt-2">
                Real-time dispatch management and route optimization
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="md"
                onClick={handleOptimizeRoutes}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Plan Routes
              </Button>
              <Button
                variant="primary"
                size="md"
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New Order
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={(value) => setTab(value as "unscheduled" | "scheduled")}>
            <TabsList>
              <TabsTrigger value="unscheduled">
                Unscheduled ({unscheduledCount})
              </TabsTrigger>
              <TabsTrigger value="scheduled">
                Scheduled ({scheduledCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Stats Bar */}
      <StatsBar stats={stats || { activeDrivers: 0, totalStops: 0, totalDistance: 0, estimatedHours: 0, onRouteOrders: 0, completedOrders: 0, failedOrders: 0, averageETA: 0 }} isLoading={isLoading} />

      {/* Error message */}
      {error && (
        <div className="mx-6 mt-6 p-4 bg-wl-danger-bg border border-wl-danger-400/30 rounded-lg">
          <p className="text-sm text-wl-danger-400">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs text-wl-danger-400/60 hover:text-wl-danger-400 mt-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 max-w-full mx-auto w-full px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-280px)]">
          {/* Map - 60% on desktop */}
          <div className="lg:col-span-2">
            <DispatchMap
              routes={routes}
              drivers={drivers}
              selectedStop={selectedStop}
              onStopSelect={setSelectedStop}
              isLoading={isLoading}
              error={error}
            />
          </div>

          {/* Right panel - 40% */}
          <div className="flex flex-col gap-6 overflow-y-auto">
            {/* Timeline */}
            <div className="flex-1 overflow-y-auto">
              <RouteTimeline
                routes={routes}
                selectedStop={selectedStop}
                onStopSelect={setSelectedStop}
                isLoading={isLoading}
              />
            </div>

            {/* Stop detail or drivers list */}
            {selectedStop ? (
              <StopDetailPanel
                stop={selectedStop}
                onClose={() => setSelectedStop(null)}
                onReassign={handleReassignStop}
                onSkip={handleSkipStop}
                onPrioritize={handlePrioritizeStop}
              />
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-wl-text-primary mb-3 flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Active Drivers
                  </h3>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {Array.from(drivers.values())
                    .filter((d) => d.status !== "offline")
                    .map((driver) => {
                      const driverRoute = routes.find((r) => r.driverId === driver.id) || null;
                      return (
                        <DriverCard
                          key={driver.id}
                          driver={driver}
                          route={driverRoute}
                          isSelected={selectedDriver === driver.id}
                          onClick={() => setSelectedDriver(driver.id)}
                        />
                      );
                    })}

                  {Array.from(drivers.values()).filter((d) => d.status !== "offline").length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm text-wl-text-secondary">
                        No active drivers
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
