'use client';

/**
 * Chaos testing hooks — back-ended by /api/v4/chaos/*.
 * Uses api.get/post/delete (auth-aware); on error: empty state + error prop.
 */

import { useState, useCallback, useEffect } from 'react';
import { api } from '@/lib/api';

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
  startTime?: Date;
  endTime?: Date;
  metrics: {
    requestsImpacted: number;
    errorRate: number;
    latencyMs: number;
    circuitBreakerTrips: number;
  };
  assertions: {
    name: string;
    expected?: string;
    actual?: string;
    passed: boolean;
  }[];
}

export interface ChaosResult {
  id: string;
  scenarioId: string;
  executionId?: string;
  status: 'passed' | 'failed' | 'partial';
  duration: number;
  findings: string[];
  metricsBeforeDuring?: {
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

// ── Scenarios ────────────────────────────────────────────────

export function useChaosScenarios() {
  const [scenarios, setScenarios] = useState<ChaosScenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const fetchScenarios = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const res = await api.get<{ data: ChaosScenario[] }>('/api/v4/chaos/scenarios');
      setScenarios(
        (res.data ?? []).map((s) => ({ ...s, createdAt: new Date(s.createdAt as unknown as string) })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenarios');
      setScenarios([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createScenario = useCallback(
    async (scenario: Omit<ChaosScenario, 'id' | 'createdAt'>): Promise<ChaosScenario> => {
      const res = await api.post<{ data: ChaosScenario }>('/api/v4/chaos/scenarios', scenario);
      const created = { ...res.data, createdAt: new Date(res.data.createdAt as unknown as string) };
      setScenarios((prev) => [...prev, created]);
      return created;
    },
    [],
  );

  const deleteScenario = useCallback(async (id: string) => {
    await api.delete(`/api/v4/chaos/scenarios/${id}`);
    setScenarios((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const executeScenario = useCallback(async (scenarioId: string): Promise<ChaosExecution> => {
    const res = await api.post<{ data: ChaosExecution }>(
      `/api/v4/chaos/scenarios/${scenarioId}/execute`,
    );
    return res.data;
  }, []);

  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  return { scenarios, isLoading, error, fetchScenarios, createScenario, deleteScenario, executeScenario };
}

// ── Single execution (polled every 2s while running) ─────────

export function useChaosExecution(executionId: string) {
  const [execution, setExecution] = useState<ChaosExecution | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!executionId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      setIsLoading(true);
      try {
        const res = await api.get<{ data: ChaosExecution }>(`/api/v4/chaos/executions/${executionId}`);
        if (alive) setExecution(res.data);
      } catch {
        // execution not found yet — keep polling
      } finally {
        if (alive) setIsLoading(false);
      }
      if (alive && execution?.status === 'running') {
        timer = setTimeout(poll, 2_000);
      }
    };
    poll();

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [executionId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { execution, isLoading };
}

// ── History ──────────────────────────────────────────────────

export function useChaosHistory() {
  const [results, setResults] = useState<ChaosResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const res = await api.get<{ data: ChaosResult[] }>('/api/v4/chaos/history');
      setResults(
        (res.data ?? []).map((r) => ({ ...r, createdAt: new Date(r.createdAt as unknown as string) })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { results, isLoading, error, fetchHistory };
}
