import { useState, useCallback, useMemo } from 'react';

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

      setIsOptimizing(true);
      setOptimizationProgress(0);

      try {
        // Simulate optimization process
        const results: OptimizationResult[] = [];
        const providerCount = state.selectedProviders.length;

        for (let i = 0; i < providerCount; i++) {
          setOptimizationProgress(Math.round(((i + 1) / providerCount) * 100));

          // Simulate API call delay
          await new Promise((resolve) => setTimeout(resolve, 800));

          const provider = state.selectedProviders[i];
          const totalDistance = Math.random() * 50 + 10;
          const totalDuration = Math.random() * 120 + 30;

          results.push({
            provider,
            totalDistance,
            totalDuration,
            fuelEstimate: totalDistance * 0.07,
            costEstimate: totalDistance * 2.5,
            stopSequence: state.stops.map((s, idx) => ({
              ...s,
              sequence: idx + 1,
              arrivalEta: new Date(
                Date.now() + (idx + 1) * 15 * 60000
              ).toLocaleTimeString(),
            })),
          });
        }

        setState((prev) => ({
          ...prev,
          results,
          selectedResult: results[0],
        }));
      } finally {
        setIsOptimizing(false);
        setOptimizationProgress(0);
      }
    },
    [state.stops, state.selectedProviders]
  );

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

  const saveRoute = useCallback(async () => {
    if (!state.selectedResult) {
      throw new Error('No optimization result selected');
    }

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      id: `route-${Date.now()}`,
      ...state.selectedResult,
      assignedDriver: state.assignedDriver,
      schedule: state.dispatchSchedule,
      template: state.template,
    };
  }, [state.selectedResult, state.assignedDriver, state.dispatchSchedule, state.template]);

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
