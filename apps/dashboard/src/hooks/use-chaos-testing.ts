'use client';

import { useState, useCallback, useEffect } from 'react';

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
  const [isLoading, setIsLoading] = useState(false);

  const fetchScenarios = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/chaos/scenarios');
      const data = await response.json();
      setScenarios(data);
    } catch (error) {
      console.error('Failed to fetch chaos scenarios:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createScenario = useCallback(
    async (scenario: Omit<ChaosScenario, 'id' | 'createdAt'>) => {
      try {
        const response = await fetch('/api/chaos/scenarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scenario),
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
      const response = await fetch(`/api/chaos/scenarios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
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
      await fetch(`/api/chaos/scenarios/${id}`, { method: 'DELETE' });
      setScenarios((prev) => prev.filter((s) => s.id !== id));
    } catch (error) {
      console.error('Failed to delete scenario:', error);
      throw error;
    }
  }, []);

  const executeScenario = useCallback(async (scenarioId: string) => {
    try {
      const response = await fetch(`/api/chaos/scenarios/${scenarioId}/execute`, {
        method: 'POST',
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
        const response = await fetch(`/api/chaos/executions/${executionId}`);
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
      await fetch(`/api/chaos/executions/${executionId}/stop`, { method: 'POST' });
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
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = useCallback(async (filters?: { scenarioId?: string; status?: string }) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters?.scenarioId) params.append('scenarioId', filters.scenarioId);
      if (filters?.status) params.append('status', filters.status);

      const response = await fetch(`/api/chaos/results?${params}`);
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Failed to fetch chaos history:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { results, isLoading, fetchHistory };
}
