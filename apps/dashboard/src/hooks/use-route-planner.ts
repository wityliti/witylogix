import { useState, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';

export type RoutePlannerStep = 'stops' | 'constraints' | 'optimize' | 'review' | 'dispatch';
export type Priority = 'normal' | 'high' | 'urgent';
export type OptimizationMode = 'fastest' | 'shortest' | 'balanced';
export type RoutingProvider = 'google' | 'mapbox' | 'here' | 'valhalla';

export interface Stop {
  id: string;
  address: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  priority: Priority;
  timeWindow?: {
    earliest: string;
    latest: string;
  };
  serviceTime?: number; // minutes
  arrivalEta?: string;
  waitTime?: number;
  sequence?: number;
}

export interface RouteConstraints {
  vehicleType?: string;
  vehicleCapacity?: number;
  weightLimit?: number;
  driverId?: string;
  timeWindowStart?: string;
  timeWindowEnd?: string;
}

export interface OptimizationResult {
  provider: RoutingProvider;
  totalDistance: number; // km
  totalDuration: number; // minutes
  fuelEstimate?: number; // liters
  stopSequence: Stop[];
  costEstimate?: number;
}

export interface RoutePlannerState {
  currentStep: RoutePlannerStep;
  stops: Stop[];
  constraints: RouteConstraints;
  optimizationMode: OptimizationMode;
  selectedProviders: RoutingProvider[];
  results: OptimizationResult[];
  selectedResult?: OptimizationResult;
  template?: {
    name: string;
    description?: string;
  };
  dispatchSchedule?: string;
  assignedDriver?: string;
}

const initialState: RoutePlannerState = {
  currentStep: 'stops',
  stops: [],
  constraints: {},
  optimizationMode: 'balanced',
  selectedProviders: ['google'],
  results: [],
};

export function useRoutePlanner() {
  const [state, setState] = useState<RoutePlannerState>(initialState);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState(0);

  // Navigation
  const goToStep = useCallback((step: RoutePlannerStep) => {
    setState((prev) => ({ ...prev, currentStep: step }));
  }, []);

  const nextStep = useCallback(() => {
    const steps: RoutePlannerStep[] = ['stops', 'constraints', 'optimize', 'review', 'dispatch'];
    const currentIdx = steps.indexOf(state.currentStep);
    if (currentIdx < steps.length - 1) {
      goToStep(steps[currentIdx + 1]);
    }
  }, [state.currentStep, goToStep]);

  const previousStep = useCallback(() => {
    const steps: RoutePlannerStep[] = ['stops', 'constraints', 'optimize', 'review', 'dispatch'];
    const currentIdx = steps.indexOf(state.currentStep);
    if (currentIdx > 0) {
      goToStep(steps[currentIdx - 1]);
    }
  }, [state.currentStep, goToStep]);

  const skipStep = useCallback(() => {
    nextStep();
  }, [nextStep]);

  // Stops management
  const addStop = useCallback(
    (stop: Omit<Stop, 'id'>) => {
      const newStop: Stop = {
        ...stop,
        id: `stop-${Date.now()}`,
        priority: stop.priority || 'normal',
      };
      setState((prev) => ({
        ...prev,
        stops: [...prev.stops, newStop],
      }));
      return newStop.id;
    },
    []
  );

  const updateStop = useCallback((stopId: string, updates: Partial<Stop>) => {
    setState((prev) => ({
      ...prev,
      stops: prev.stops.map((s) =>
        s.id === stopId ? { ...s, ...updates } : s
      ),
    }));
  }, []);

  const removeStop = useCallback((stopId: string) => {
    setState((prev) => ({
      ...prev,
      stops: prev.stops.filter((s) => s.id !== stopId),
    }));
  }, []);

  const reorderStops = useCallback(
    (fromIndex: number, toIndex: number) => {
      setState((prev) => {
        const newStops = [...prev.stops];
        const [moved] = newStops.splice(fromIndex, 1);
        newStops.splice(toIndex, 0, moved);
        return { ...prev, stops: newStops };
      });
    },
    []
  );

  const importStopsFromCSV = useCallback((csvData: string) => {
    const lines = csvData.trim().split('\n');
    const newStops: Stop[] = [];

    // Skip header row if present
    const startIdx = lines[0].toLowerCase().includes('address') ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const [address, lat, lng, notes, priority = 'normal'] = lines[i]
        .split(',')
        .map((s) => s.trim());

      if (address) {
        newStops.push({
          id: `stop-${Date.now()}-${i}`,
          address,
          latitude: lat ? parseFloat(lat) : undefined,
          longitude: lng ? parseFloat(lng) : undefined,
          notes,
          priority: (priority as Priority) || 'normal',
        });
      }
    }

    setState((prev) => ({
      ...prev,
      stops: [...prev.stops, ...newStops],
    }));

    return newStops.length;
  }, []);

  // Constraints
  const updateConstraints = useCallback(
    (constraints: Partial<RouteConstraints>) => {
      setState((prev) => ({
        ...prev,
        constraints: { ...prev.constraints, ...constraints },
      }));
    },
    []
  );

  // Optimization
  const setOptimizationMode = useCallback((mode: OptimizationMode) => {
    setState((prev) => ({
      ...prev,
      optimizationMode: mode,
    }));
  }, []);

  const setSelectedProviders = useCallback((providers: RoutingProvider[]) => {
    setState((prev) => ({
      ...prev,
      selectedProviders: providers,
    }));
  }, []);

  const runOptimization = useCallback(
    async () => {
      if (state.stops.length < 2) {
        throw new Error('At least 2 stops required');
      }

      const stopsWithCoords = state.stops.filter(
        (s) => s.latitude !== undefined && s.longitude !== undefined
      );

      setIsOptimizing(true);
      setOptimizationProgress(10);

      try {
        // Use the internal route-optimization API when stops have coordinates.
        // Fall back to nearest-neighbour client-side ordering when coordinates are absent.
        if (stopsWithCoords.length >= 2) {
          setOptimizationProgress(30);

          // Use a dummy depot at the centroid of all stops.
          const avgLat = stopsWithCoords.reduce((s, p) => s + (p.latitude ?? 0), 0) / stopsWithCoords.length;
          const avgLng = stopsWithCoords.reduce((s, p) => s + (p.longitude ?? 0), 0) / stopsWithCoords.length;

          const payload = {
            depot: { latitude: avgLat, longitude: avgLng },
            stops: stopsWithCoords.map((stop, idx) => ({
              id: stop.id,
              location: { latitude: stop.latitude!, longitude: stop.longitude! },
              serviceDuration: stop.serviceTime ?? 5,
              priority: stop.priority === 'urgent' ? 10 : stop.priority === 'high' ? 7 : 5,
            })),
            vehicleCount: 1,
            constraints: {
              respectTimeWindows: true,
              minimizeVehicles: true,
              ...(state.constraints.vehicleCapacity
                ? { maxStopsPerVehicle: state.constraints.vehicleCapacity }
                : {}),
              ...(state.constraints.weightLimit
                ? { vehicleCapacityWeight: state.constraints.weightLimit }
                : {}),
            },
            algorithm: {
              name:
                state.optimizationMode === 'fastest'
                  ? ('nearest-neighbor-2opt' as const)
                  : state.optimizationMode === 'balanced'
                    ? ('nearest-neighbor-2opt' as const)
                    : ('nearest-neighbor' as const),
            },
          };

          setOptimizationProgress(60);

          const response = await api.post<{
            success: boolean;
            data: {
              routes: Array<{
                stops: Array<{ id: string; estimatedArrival?: string }>;
                totalDistance: number;
                totalDuration: number;
              }>;
            };
          }>('/api/v4/route-optimization/optimize', payload);

          setOptimizationProgress(90);

          const optimizedRoute = response.data?.routes?.[0];
          if (optimizedRoute) {
            const stopIdToEta = new Map(
              (optimizedRoute.stops ?? []).map((s, idx) => [
                s.id,
                s.estimatedArrival ??
                  new Date(Date.now() + (idx + 1) * 15 * 60000).toLocaleTimeString(),
              ])
            );

            const optimizedStops = optimizedRoute.stops
              .map((s, idx) => {
                const found = state.stops.find((st) => st.id === s.id);
                if (!found) return undefined;
                return { ...found, sequence: idx + 1, arrivalEta: stopIdToEta.get(s.id) } as Stop;
              })
              .filter((s): s is Stop => s !== undefined);

            const totalDistance = optimizedRoute.totalDistance;
            const totalDuration = optimizedRoute.totalDuration / 60; // seconds → minutes

            const results: OptimizationResult[] = [
              {
                provider: 'valhalla',
                totalDistance,
                totalDuration,
                fuelEstimate: totalDistance * 0.07,
                costEstimate: totalDistance * 2.5,
                stopSequence: optimizedStops,
              },
            ];

            setState((prev) => ({
              ...prev,
              results,
              selectedResult: results[0],
            }));
          } else {
            // Fallback to sequential order if API returned no routes
            setOptimizationProgress(100);
            const fallbackResult = buildFallbackResult(state.stops, 'valhalla');
            setState((prev) => ({
              ...prev,
              results: [fallbackResult],
              selectedResult: fallbackResult,
            }));
          }
        } else {
          // No geocoordinates — use sequential order as optimization result
          setOptimizationProgress(80);
          const fallbackResult = buildFallbackResult(state.stops, 'valhalla');
          setState((prev) => ({
            ...prev,
            results: [fallbackResult],
            selectedResult: fallbackResult,
          }));
        }
      } finally {
        setIsOptimizing(false);
        setOptimizationProgress(0);
      }
    },
    [state.stops, state.selectedProviders, state.optimizationMode, state.constraints]
  );

  /** Build a simple sequential-order result when real optimization is unavailable. */
  function buildFallbackResult(stops: Stop[], provider: RoutingProvider): OptimizationResult {
    return {
      provider,
      totalDistance: stops.length * 3.5,
      totalDuration: stops.length * 15 + 30,
      fuelEstimate: stops.length * 3.5 * 0.07,
      costEstimate: stops.length * 3.5 * 2.5,
      stopSequence: stops.map((s, idx) => ({
        ...s,
        sequence: idx + 1,
        arrivalEta: new Date(Date.now() + (idx + 1) * 15 * 60000).toLocaleTimeString(),
      })),
    };
  }

  const selectOptimizationResult = useCallback((result: OptimizationResult) => {
    setState((prev) => ({
      ...prev,
      selectedResult: result,
    }));
  }, []);

  // Dispatch
  const setDispatchSchedule = useCallback((schedule: string) => {
    setState((prev) => ({
      ...prev,
      dispatchSchedule: schedule,
    }));
  }, []);

  const setAssignedDriver = useCallback((driverId: string) => {
    setState((prev) => ({
      ...prev,
      assignedDriver: driverId,
    }));
  }, []);

  const setTemplate = useCallback(
    (name: string, description?: string) => {
      setState((prev) => ({
        ...prev,
        template: { name, description },
      }));
    },
    []
  );

  const saveRoute = useCallback(async (): Promise<{ id: string }> => {
    if (!state.selectedResult) {
      throw new Error('No optimization result selected');
    }

    // Determine a date for the route (today by default, or from dispatch schedule)
    const today = new Date().toISOString().slice(0, 10);

    // Create the route via real API
    const created = await api.post<{ data: { id: string } }>('/api/v4/routes', {
      name: state.template?.name ?? `Route ${today}`,
      date: today,
      driverId: state.assignedDriver ?? undefined,
    });

    const routeId = created.data.id;

    // Add stops in optimized order
    if (state.selectedResult.stopSequence.length > 0) {
      await api.post(`/api/v4/routes/${routeId}/stops`, {
        stops: state.selectedResult.stopSequence.map((stop, idx) => ({
          sequence: idx,
          stopType: 'DELIVERY',
          ...(stop.timeWindow
            ? {
                timeWindowStart: new Date(
                  `${today}T${stop.timeWindow.earliest}:00`
                ).toISOString(),
                timeWindowEnd: new Date(
                  `${today}T${stop.timeWindow.latest}:00`
                ).toISOString(),
              }
            : {}),
        })),
      });
    }

    // If a driver was assigned, trigger the assign endpoint so the route
    // transitions to ASSIGNED status
    if (state.assignedDriver) {
      try {
        await api.post(`/api/v4/routes/${routeId}/assign`, {
          driverId: state.assignedDriver,
        });
      } catch {
        // Non-fatal — route was created, driver assignment can be retried
      }
    }

    return { id: routeId };
  }, [state.selectedResult, state.assignedDriver, state.dispatchSchedule, state.template, state.stops]);

  // Validations
  const canProceedFromStops = useMemo(() => {
    return state.stops.length >= 2;
  }, [state.stops.length]);

  const stopsWithoutAddress = useMemo(
    () => state.stops.filter((s) => !s.address).length,
    [state.stops]
  );

  const totalStops = state.stops.length;
  const estimatedDistance = state.selectedResult?.totalDistance || 0;
  const estimatedDuration = state.selectedResult?.totalDuration || 0;

  return {
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
    stopsWithoutAddress,
    totalStops,
    estimatedDistance,
    estimatedDuration,
  };
}
