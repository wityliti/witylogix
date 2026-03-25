'use client';

import { useState, useCallback, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

const DEMO_CHAOS_SCENARIOS: ChaosScenario[] = [
  {
    id: 'demo-cs-1',
    name: 'Carrier API Latency Spike',
    provider: 'fedex',
    faultType: 'latency',
    severity: 'medium',
    duration: 30,
    targetEndpoints: ['/rates', '/tracking'],
    createdAt: new Date('2026-03-20T10:00:00Z'),
  },
  {
    id: 'demo-cs-2',
    name: 'Label Generation Timeout',
    provider: 'ups',
    faultType: 'timeout',
    severity: 'high',
    duration: 60,
    targetEndpoints: ['/labels/create'],
    createdAt: new Date('2026-03-18T14:30:00Z'),
  },
  {
    id: 'demo-cs-3',
    name: 'Partial Tracking Failure',
    provider: 'usps',
    faultType: 'partial_failure',
    severity: 'low',
    duration: 15,
    targetEndpoints: ['/tracking/status'],
    createdAt: new Date('2026-03-15T09:00:00Z'),
  },
];

const DEMO_CHAOS_RESULTS: ChaosResult[] = [
  {
    id: 'demo-cr-1',
    scenarioId: 'demo-cs-1',
    executionId: 'demo-exec-1',
    status: 'passed',
    duration: 30,
    findings: ['Circuit breaker tripped at 500ms threshold', 'Fallback cache served stale rates within SLA'],
    metricsBeforeDuring: {
      before: { p99Latency: 120, errorRate: 0.1 },
      during: { p99Latency: 2400, errorRate: 4.2 },
      after: { p99Latency: 135, errorRate: 0.2 },
    },
    createdAt: new Date('2026-03-20T10:01:00Z'),
  },
  {
    id: 'demo-cr-2',
    scenarioId: 'demo-cs-2',
    executionId: 'demo-exec-2',
    status: 'failed',
    duration: 60,
    findings: ['Timeout not handled gracefully — user saw 502', 'Retry queue backed up to 1200 items'],
    metricsBeforeDuring: {
      before: { p99Latency: 200, errorRate: 0.3 },
      during: { p99Latency: 5000, errorRate: 18.5 },
      after: { p99Latency: 250, errorRate: 1.1 },
    },
    createdAt: new Date('2026-03-18T14:32:00Z'),
  },
];

export interface ChaosScenario {
  id: string;
  name: string;
  provider: string;
  faultType: 'latency' | 'error' | 'timeout' | 'partial_failure';
  severity: 'low' | 'medium' | 'high';
  duration: number;
  targetEndpoints?: string[];
  createdAt: Date;
}

export interface ChaosExecution {
  id: string;
  scenarioId: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  progress: number;
  startTime: Date;
  endTime?: Date;
  metrics: {
    requestsImpacted: number;
    errorRate: number;
    latencyMs: number;
    circuitBreakerTrips: number;
  };
  assertions: {
    name: string;
    expected: string;
    actual: string;
    passed: boolean;
  }[];
}

export interface ChaosResult {
  id: string;
  scenarioId: string;
  executionId: string;
  status: 'passed' | 'failed' | 'partial';
  duration: number;
  findings: string[];
  metricsBeforeDuring: {
    before: Record<string, number>;
    during: Record<string, number>;
    after: Record<string, number>;
  };
  createdAt: Date;
}

export interface RecurringSchedule {
  id: string;
  scenarioId: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  enabled: boolean;
}

export function useChaosScenarios() {
  const [scenarios, setScenarios] = useState<ChaosScenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchScenarios = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v4/chaos/scenarios`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await response.json();
      setScenarios(data);
    } catch (error) {
      console.error('Failed to fetch chaos scenarios:', error);
      setScenarios(DEMO_CHAOS_SCENARIOS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createScenario = useCallback(
    async (scenario: Omit<ChaosScenario, 'id' | 'createdAt'>) => {
      try {
        const response = await fetch(`${API_BASE}/api/v4/chaos/scenarios`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scenario),
          signal: AbortSignal.timeout(5000),
        });
        const newScenario = await response.json();
        setScenarios((prev) => [...prev, newScenario]);
        return newScenario;
      } catch (error) {
        console.error('Failed to create scenario:', error);
        throw error;
      }
    },
    []
  );

  const updateScenario = useCallback(async (id: string, updates: Partial<ChaosScenario>) => {
    try {
      const response = await fetch(`${API_BASE}/api/v4/chaos/scenarios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
        signal: AbortSignal.timeout(5000),
      });
      const updated = await response.json();
      setScenarios((prev) => prev.map((s) => (s.id === id ? updated : s)));
      return updated;
    } catch (error) {
      console.error('Failed to update scenario:', error);
      throw error;
    }
  }, []);

  const deleteScenario = useCallback(async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/v4/chaos/scenarios/${id}`, { method: 'DELETE', signal: AbortSignal.timeout(5000) });
      setScenarios((prev) => prev.filter((s) => s.id !== id));
    } catch (error) {
      console.error('Failed to delete scenario:', error);
      throw error;
    }
  }, []);

  const executeScenario = useCallback(async (scenarioId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/v4/chaos/scenarios/${scenarioId}/execute`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to execute scenario:', error);
      throw error;
    }
  }, []);

  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  return {
    scenarios,
    isLoading,
    fetchScenarios,
    createScenario,
    updateScenario,
    deleteScenario,
    executeScenario,
  };
}

export function useChaosExecution(executionId: string) {
  const [execution, setExecution] = useState<ChaosExecution | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchExecution = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/v4/chaos/executions/${executionId}`, {
          signal: AbortSignal.timeout(5000),
        });
        const data = await response.json();
        setExecution(data);
      } catch (error) {
        console.error('Failed to fetch execution:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExecution();

    const interval = setInterval(fetchExecution, 2000);

    return () => clearInterval(interval);
  }, [executionId]);

  const stopExecution = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/v4/chaos/executions/${executionId}/stop`, { method: 'POST', signal: AbortSignal.timeout(5000) });
      if (execution) {
        setExecution({ ...execution, status: 'stopped' });
      }
    } catch (error) {
      console.error('Failed to stop execution:', error);
      throw error;
    }
  }, [executionId, execution]);

  return { execution, isLoading, stopExecution };
}

export function useChaosHistory() {
  const [results, setResults] = useState<ChaosResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = useCallback(async (filters?: { scenarioId?: string; status?: string }) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters?.scenarioId) params.append('scenarioId', filters.scenarioId);
      if (filters?.status) params.append('status', filters.status);

      const response = await fetch(`${API_BASE}/api/v4/chaos/results?${params}`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Failed to fetch chaos history:', error);
      setResults(DEMO_CHAOS_RESULTS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { results, isLoading, fetchHistory };
}
