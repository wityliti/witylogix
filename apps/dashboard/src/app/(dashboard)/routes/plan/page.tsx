'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronLeft, ChevronRight, Zap, Map, List } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { StopListEditor, RouteSummary, RouteOptimizerControls } from '@/components/routes';
import { useRoutePlanner } from '@/hooks/use-route-planner';
import { useApiList } from '@/hooks/use-api';
import type { StopMarker } from '@/components/map/route-stop-markers-layer';

const WLMap = dynamic(() => import('@/components/map/wl-map').then((m) => m.WLMap), {
  ssr: false,
  loading: () => <div className="h-full bg-wl-bg-root animate-pulse rounded-xl" />,
});
const RoutePolylineLayer = dynamic(
  () => import('@/components/map/route-polyline-layer').then((m) => m.RoutePolylineLayer),
  { ssr: false },
);
const RouteStopMarkersLayer = dynamic(
  () => import('@/components/map/route-stop-markers-layer').then((m) => m.RouteStopMarkersLayer),
  { ssr: false },
);

interface ApiDriver {
  id: string;
  name: string;
  status: string;
  vehicleType: string;
}

interface DriverOption {
  id: string;
  name: string;
  vehicleType?: string | null;
  status?: string;
  isActive?: boolean;
}

type StepType = 'stops' | 'constraints' | 'optimize' | 'review' | 'dispatch';

const STEPS: { id: StepType; label: string; description: string }[] = [
  { id: 'stops', label: 'Add Stops', description: 'Define delivery locations' },
  { id: 'constraints', label: 'Constraints', description: 'Set vehicle & time limits' },
  { id: 'optimize', label: 'Optimize', description: 'Calculate best route' },
  { id: 'review', label: 'Review', description: 'Check route details' },
  { id: 'dispatch', label: 'Dispatch', description: 'Assign & schedule' },
];

const MAP_STEPS: StepType[] = ['optimize', 'review', 'dispatch'];

export default function RoutePlanningPage() {
  const {
    state,
    goToStep,
    nextStep,
    previousStep,
    skipStep,
    addStop,
    updateStop,
    removeStop,
    reorderStops,
    importStopsFromCSV,
    updateConstraints,
    setOptimizationMode,
    setSelectedProviders,
    runOptimization,
    selectOptimizationResult,
    setDispatchSchedule,
    setAssignedDriver,
    setTemplate,
    saveRoute,
    isOptimizing,
    optimizationProgress,
    canProceedFromStops,
  } = useRoutePlanner();

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);

  const { items: drivers } = useApiList<ApiDriver>('/api/v4/drivers');

  const { items: drivers } = useApiList<DriverOption>('/api/v4/drivers', { limit: 100 });
  const activeDrivers = drivers.filter((d) => d.isActive !== false);

  const currentStepIdx = STEPS.findIndex((s) => s.id === state.currentStep);

  // Build map data from optimized result's stop sequence
  const mapStops: StopMarker[] = (state.selectedResult?.stopSequence ?? [])
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s, idx) => ({
      id: s.id,
      sequence: idx + 1,
      lat: s.latitude!,
      lng: s.longitude!,
      status: 'PENDING' as const,
      address: s.address,
    }));

  const polylineCoords: Array<[number, number]> = mapStops.map((s) => [s.lng, s.lat]);

  const mapCenter: [number, number] =
    mapStops.length > 0 ? [mapStops[0].lng, mapStops[0].lat] : [0, 20];

  const showMapToggle = MAP_STEPS.includes(state.currentStep) && mapStops.length > 0;

  const handleNextStep = async () => {
    if (state.currentStep === 'optimize' && state.results.length === 0) {
      try {
        await runOptimization();
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Optimization failed');
        return;
      }
    }
    nextStep();
  };

  const handleSaveRoute = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await saveRoute();
      window.location.href = result?.id ? `/routes/${result.id}` : '/routes';
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save route');
      setIsSaving(false);
    }
  };

  return (
    <>
      <Header
        title="Plan Route"
        subtitle={`Step ${currentStepIdx + 1} of ${STEPS.length}`}
        actions={
          <Link href="/routes">
            <Button variant="ghost" size="md">
              Cancel
            </Button>
          </Link>
        }
      />

      <div className="p-6">
        {/* ═══ Step Indicator ═══ */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {STEPS.map((step, idx) => {
              const isActive = step.id === state.currentStep;
              const isCompleted = idx < currentStepIdx;

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <button
                    onClick={() => idx <= currentStepIdx && goToStep(step.id)}
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold',
                      'transition-colors cursor-pointer',
                      isActive
                        ? 'bg-blue-500 text-white ring-2 ring-offset-2 ring-blue-500'
                        : isCompleted
                          ? 'bg-emerald-500 text-white'
                          : 'bg-wl-bg-surface border-2 border-wl-border-default text-wl-text-secondary',
                    )}
                  >
                    {isCompleted ? '✓' : idx + 1}
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 mx-2',
                        isCompleted || isActive ? 'bg-blue-500' : 'bg-wl-border-default',
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex justify-between">
            {STEPS.map((step) => {
              const isActive = step.id === state.currentStep;
              return (
                <div key={step.id} className="flex-1 text-center">
                  <div
                    className={cn(
                      'text-sm font-semibold',
                      isActive ? 'text-blue-500' : 'text-wl-text-secondary',
                    )}
                  >
                    {step.label}
                  </div>
                  <div className="text-xs text-wl-text-tertiary">{step.description}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ Map toggle bar (optimize/review/dispatch with results) ═══ */}
        {showMapToggle && (
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center bg-wl-bg-overlay rounded-lg p-1 border border-wl-border-default">
              <button
                onClick={() => setShowMap(false)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  !showMap
                    ? 'bg-wl-bg-elevated text-wl-text-primary shadow-sm'
                    : 'text-wl-text-secondary hover:text-wl-text-primary',
                )}
              >
                <List className="w-3.5 h-3.5" /> List
              </button>
              <button
                onClick={() => setShowMap(true)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  showMap
                    ? 'bg-wl-bg-elevated text-wl-text-primary shadow-sm'
                    : 'text-wl-text-secondary hover:text-wl-text-primary',
                )}
              >
                <Map className="w-3.5 h-3.5" /> Map
              </button>
            </div>
            <span className="text-xs text-wl-text-tertiary">{mapStops.length} stops mapped</span>
          </div>
        )}

        {/* ═══ Map panel (replaces list view when toggled) ═══ */}
        {showMap && showMapToggle && (
          <div className="mb-6 h-[480px] rounded-xl overflow-hidden border border-wl-border-default">
            <WLMap center={mapCenter} zoom={11}>
              {polylineCoords.length >= 2 && (
                <RoutePolylineLayer
                  coordinates={polylineCoords}
                  variant="planned"
                  fitBounds
                  fitPadding={60}
                />
              )}
              <RouteStopMarkersLayer
                stops={mapStops}
                fitBounds={polylineCoords.length < 2}
              />
            </WLMap>
          </div>
        )}

        {/* ═══ Step Content ═══ */}
        {!showMap && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Main Content */}
            <div className="lg:col-span-2">
              {/* STEP 1: STOPS */}
              {state.currentStep === 'stops' && (
                <Card className="p-6 border-wl-border-default bg-wl-bg-surface">
                  <div className="mb-4">
                    <h2 className="text-lg font-bold text-wl-text-primary mb-1">Add Delivery Stops</h2>
                    <p className="text-sm text-wl-text-secondary">
                      Search for addresses and add them to your route. You can drag to reorder or import from CSV.
                    </p>
                  </div>
                  <StopListEditor
                    stops={state.stops}
                    onAddStop={addStop}
                    onUpdateStop={updateStop}
                    onRemoveStop={removeStop}
                    onReorderStops={reorderStops}
                    onImportCSV={importStopsFromCSV}
                  />
                </Card>
              )}

              {/* STEP 2: CONSTRAINTS */}
              {state.currentStep === 'constraints' && (
                <Card className="p-6 border-wl-border-default bg-wl-bg-surface">
                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-wl-text-primary mb-1">Route Constraints</h2>
                    <p className="text-sm text-wl-text-secondary">
                      Set vehicle specifications and driver preferences to optimize your route.
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-wl-text-primary mb-3">Vehicle Type</label>
                      <select
                        value={state.constraints.vehicleType || ''}
                        onChange={(e) => updateConstraints({ vehicleType: e.target.value })}
                        className={cn(
                          'w-full px-4 py-2 rounded-md text-sm',
                          'bg-wl-bg-root text-wl-text-primary',
                          'border border-wl-border-default',
                          'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors',
                        )}
                      >
                        <option value="">Select vehicle type...</option>
                        <option value="bicycle">Bicycle</option>
                        <option value="motorcycle">Motorcycle</option>
                        <option value="car">Car</option>
                        <option value="van">Van</option>
                        <option value="truck">Truck</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-wl-text-primary mb-3">
                        Vehicle Capacity (items)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={state.constraints.vehicleCapacity || ''}
                        onChange={(e) =>
                          updateConstraints({
                            vehicleCapacity: e.target.value ? parseInt(e.target.value) : undefined,
                          })
                        }
                        placeholder="e.g., 20"
                        className={cn(
                          'w-full px-4 py-2 rounded-md text-sm',
                          'bg-wl-bg-root text-wl-text-primary',
                          'border border-wl-border-default',
                          'placeholder:text-wl-text-tertiary',
                          'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors',
                        )}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-wl-text-primary mb-3">Weight Limit (kg)</label>
                      <input
                        type="number"
                        min="0"
                        value={state.constraints.weightLimit || ''}
                        onChange={(e) =>
                          updateConstraints({
                            weightLimit: e.target.value ? parseInt(e.target.value) : undefined,
                          })
                        }
                        placeholder="e.g., 500"
                        className={cn(
                          'w-full px-4 py-2 rounded-md text-sm',
                          'bg-wl-bg-root text-wl-text-primary',
                          'border border-wl-border-default',
                          'placeholder:text-wl-text-tertiary',
                          'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors',
                        )}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-wl-text-primary mb-3">
                        Preferred Driver (Optional)
                      </label>
                      <select
                        value={state.constraints.driverId || ''}
                        onChange={(e) => updateConstraints({ driverId: e.target.value })}
                        className={cn(
                          'w-full px-4 py-2 rounded-md text-sm',
                          'bg-wl-bg-root text-wl-text-primary',
                          'border border-wl-border-default',
                          'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors',
                        )}
                      >
                        <option value="">Any driver</option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.vehicleType})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </Card>
              )}

              {/* STEP 3: OPTIMIZE */}
              {state.currentStep === 'optimize' && (
                <Card className="p-6 border-wl-border-default bg-wl-bg-surface">
                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-wl-text-primary mb-1">Optimize Route</h2>
                    <p className="text-sm text-wl-text-secondary">
                      Configure optimization settings and run the route optimizer.
                    </p>
                  </div>
                  <RouteOptimizerControls
                    optimizationMode={state.optimizationMode}
                    selectedProviders={state.selectedProviders}
                    isOptimizing={isOptimizing}
                    progress={optimizationProgress}
                    results={state.results}
                    selectedResult={state.selectedResult}
                    vehicleType={state.constraints.vehicleType}
                    vehicleCapacity={state.constraints.vehicleCapacity}
                    weightLimit={state.constraints.weightLimit}
                    onSetOptimizationMode={setOptimizationMode}
                    onSetSelectedProviders={setSelectedProviders}
                    onRunOptimization={runOptimization}
                    onSelectResult={selectOptimizationResult}
                    onUpdateConstraints={updateConstraints}
                  />
                  {saveError && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500 text-red-500 rounded-md text-sm">
                      {saveError}
                    </div>
                  )}
                </Card>
              )}

              {/* STEP 4: REVIEW */}
              {state.currentStep === 'review' && (
                <Card className="p-6 border-wl-border-default bg-wl-bg-surface">
                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-wl-text-primary mb-1">Review Route</h2>
                    <p className="text-sm text-wl-text-secondary">
                      Check the optimized route details before dispatching.
                    </p>
                  </div>
                  <RouteSummary result={state.selectedResult} stops={state.stops} />
                </Card>
              )}

              {/* STEP 5: DISPATCH */}
              {state.currentStep === 'dispatch' && (
                <Card className="p-6 border-wl-border-default bg-wl-bg-surface">
                  <div className="mb-6">
                    <h2 className="text-lg font-bold text-wl-text-primary mb-1">Dispatch & Schedule</h2>
                    <p className="text-sm text-wl-text-secondary">
                      Assign driver, save as template, and schedule the route.
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-wl-text-primary mb-3">Assign Driver</label>
                      <select
                        value={state.assignedDriver || ''}
                        onChange={(e) => setAssignedDriver(e.target.value)}
                        className={cn(
                          'w-full px-4 py-2 rounded-md text-sm',
                          'bg-wl-bg-root text-wl-text-primary',
                          'border border-wl-border-default',
                          'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors',
                        )}
                      >
                        <option value="">Select a driver...</option>
                        {drivers
                          .filter((d) => d.status === 'AVAILABLE' || d.status === 'OFFLINE')
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} ({d.vehicleType})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-wl-text-primary mb-3">Schedule</label>
                      <select
                        value={state.dispatchSchedule || ''}
                        onChange={(e) => setDispatchSchedule(e.target.value)}
                        className={cn(
                          'w-full px-4 py-2 rounded-md text-sm',
                          'bg-wl-bg-root text-wl-text-primary',
                          'border border-wl-border-default',
                          'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors',
                        )}
                      >
                        <option value="">Dispatch immediately</option>
                        <option value="tomorrow-9am">Tomorrow at 9:00 AM</option>
                        <option value="tomorrow-2pm">Tomorrow at 2:00 PM</option>
                        <option value="custom">Pick date & time</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-wl-text-primary mb-3">
                        Save as Template (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="Template name..."
                        onChange={(e) => setTemplate(e.target.value, undefined)}
                        className={cn(
                          'w-full px-4 py-2 rounded-md text-sm',
                          'bg-wl-bg-root text-wl-text-primary',
                          'border border-wl-border-default',
                          'placeholder:text-wl-text-tertiary',
                          'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors',
                        )}
                      />
                    </div>
                  </div>
                </Card>
              )}
            </div>

            {/* Sidebar: Route Summary & Stats */}
            <div className="flex flex-col gap-4">
              <Card className="p-4 bg-wl-bg-surface border-wl-border-default sticky top-6">
                <div className="text-sm font-semibold text-wl-text-primary mb-4">Route Summary</div>

                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-wl-text-tertiary uppercase tracking-wider">Stops</div>
                    <div className="text-2xl font-bold text-blue-500">{state.stops.length}</div>
                  </div>

                  {/* Driver Assignment Section */}
                  <div>
                    <label className="block text-sm font-semibold text-white mb-3">
                      Preferred Driver (Optional)
                    </label>
                    <select
                      value={state.constraints.driverId || ''}
                      onChange={(e) =>
                        updateConstraints({ driverId: e.target.value })
                      }
                      className={cn(
                        'w-full px-4 py-2 rounded-md text-sm',
                        'bg-[#0a0a0f] text-white',
                        'border border-[#1e1e2e]',
                        'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
                        'transition-colors'
                      )}
                    >
                      <option value="">Any driver</option>
                      {activeDrivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}{d.vehicleType ? ` (${d.vehicleType})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </Card>

              {state.currentStep === 'stops' && !canProceedFromStops && (
                <Card className="p-3 bg-amber-500/10 border border-amber-500/30">
                  <div className="text-sm text-amber-500">Add at least 2 stops to proceed</div>
                </Card>
              )}

              {state.currentStep === 'optimize' && state.results.length === 0 && (
                <Card className="p-3 bg-blue-500/10 border border-blue-500/30">
                  <div className="text-sm text-blue-400">
                    Click &quot;Optimize Route&quot; to calculate routes
                  </div>
                )}
              </Card>
            )}

            {/* STEP 4: REVIEW */}
            {state.currentStep === 'review' && (
              <Card className="p-6 border-[#1e1e2e] bg-[#12121a]">
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-white mb-1">
                    Review Route
                  </h2>
                  <p className="text-sm text-gray-400">
                    Check the optimized route details before dispatching.
                  </p>
                </div>

                <RouteSummary
                  result={state.selectedResult}
                  stops={state.stops}
                />
              </Card>
            )}

            {/* STEP 5: DISPATCH */}
            {state.currentStep === 'dispatch' && (
              <Card className="p-6 border-[#1e1e2e] bg-[#12121a]">
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-white mb-1">
                    Dispatch & Schedule
                  </h2>
                  <p className="text-sm text-gray-400">
                    Assign driver, save as template, and schedule the route.
                  </p>
                </div>

                <div className="space-y-6">
                  {/* Driver Assignment */}
                  <div>
                    <label className="block text-sm font-semibold text-white mb-3">
                      Assign Driver
                    </label>
                    <select
                      value={state.assignedDriver || ''}
                      onChange={(e) => setAssignedDriver(e.target.value)}
                      className={cn(
                        'w-full px-4 py-2 rounded-md text-sm',
                        'bg-[#0a0a0f] text-white',
                        'border border-[#1e1e2e]',
                        'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
                        'transition-colors'
                      )}
                    >
                      <option value="">Select a driver...</option>
                      {activeDrivers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}{d.vehicleType ? ` (${d.vehicleType})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Schedule */}
                  <div>
                    <label className="block text-sm font-semibold text-white mb-3">
                      Schedule
                    </label>
                    <select
                      value={state.dispatchSchedule || ''}
                      onChange={(e) => setDispatchSchedule(e.target.value)}
                      className={cn(
                        'w-full px-4 py-2 rounded-md text-sm',
                        'bg-[#0a0a0f] text-white',
                        'border border-[#1e1e2e]',
                        'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
                        'transition-colors'
                      )}
                    >
                      <option value="">Dispatch immediately</option>
                      <option value="tomorrow-9am">Tomorrow at 9:00 AM</option>
                      <option value="tomorrow-2pm">Tomorrow at 2:00 PM</option>
                      <option value="custom">Pick date & time</option>
                    </select>
                  </div>

                  {/* Save as Template */}
                  <div>
                    <label className="block text-sm font-semibold text-white mb-3">
                      Save as Template (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Template name..."
                      onChange={(e) => setTemplate(e.target.value, undefined)}
                      className={cn(
                        'w-full px-4 py-2 rounded-md text-sm',
                        'bg-[#0a0a0f] text-white',
                        'border border-[#1e1e2e]',
                        'placeholder-gray-400',
                        'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
                        'transition-colors'
                      )}
                    />
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ═══ Bottom Navigation ═══ */}
        <div className="flex gap-3 justify-between mt-6">
          <Button variant="secondary" size="md" onClick={previousStep} disabled={currentStepIdx === 0}>
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>

          <div className="flex gap-3">
            {state.currentStep !== 'dispatch' && (
              <Button variant="ghost" size="md" onClick={skipStep}>
                Skip
              </Button>
            )}

            {state.currentStep === 'dispatch' ? (
              <Button
                variant="primary"
                size="md"
                onClick={handleSaveRoute}
                disabled={isSaving || !state.assignedDriver}
              >
                <Zap className="w-4 h-4" />
                {isSaving ? 'Dispatching...' : 'Dispatch Route'}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={handleNextStep}
                disabled={
                  (state.currentStep === 'stops' && !canProceedFromStops) ||
                  (state.currentStep === 'optimize' && isOptimizing)
                }
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
