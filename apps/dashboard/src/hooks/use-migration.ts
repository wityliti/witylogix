'use client';

import { useState, useCallback, useEffect } from 'react';

export interface MigrationStep {
  step: 1 | 2 | 3 | 4 | 5;
  status: 'pending' | 'active' | 'completed' | 'failed';
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform?: string;
  required: boolean;
}

export interface Migration {
  id: string;
  sourceProvider: string;
  targetProvider: string;
  status: 'planning' | 'shadow' | 'executing' | 'completed' | 'rolled_back' | 'failed';
  progress: number;
  startTime?: Date;
  endTime?: Date;
  requestsMigrated: number;
  errorRate: number;
  latencyComparison: {
    sourceAvg: number;
    targetAvg: number;
  };
  dataDiffCount: number;
}

export interface MigrationValidation {
  schemaMatch: boolean;
  dataIntegrity: boolean;
  performanceAcceptable: boolean;
  details: Record<string, unknown>;
}

export interface ShadowModeComparison {
  requestId: string;
  sourceResponse: Record<string, unknown>;
  targetResponse: Record<string, unknown>;
  diff: string[];
  matched: boolean;
}

export interface MigrationHistory {
  id: string;
  sourceProvider: string;
  targetProvider: string;
  completedAt: Date;
  status: 'success' | 'partial' | 'failed';
  totalRequests: number;
  failedRequests: number;
  duration: number;
}

export function useMigrations() {
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMigrations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/migrations');
      const data = await response.json();
      setMigrations(data);
    } catch (error) {
      console.error('Failed to fetch migrations:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createMigration = useCallback(
    async (sourceProvider: string, targetProvider: string) => {
      try {
        const response = await fetch('/api/migrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceProvider, targetProvider }),
        });
        const newMigration = await response.json();
        setMigrations((prev) => [...prev, newMigration]);
        return newMigration;
      } catch (error) {
        console.error('Failed to create migration:', error);
        throw error;
      }
    },
    []
  );

  useEffect(() => {
    fetchMigrations();
  }, [fetchMigrations]);

  return {
    migrations,
    isLoading,
    fetchMigrations,
    createMigration,
  };
}

export function useMigrationWizard(initialMigrationId?: string) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [sourceProvider, setSourceProvider] = useState('');
  const [targetProvider, setTargetProvider] = useState('');
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [shadowModeEnabled, setShadowModeEnabled] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validation, setValidation] = useState<MigrationValidation | null>(null);

  const moveToStep = useCallback((step: 1 | 2 | 3 | 4 | 5) => {
    setCurrentStep(step);
  }, []);

  const updateFieldMappings = useCallback((mappings: FieldMapping[]) => {
    setFieldMappings(mappings);
  }, []);

  const validateMigration = useCallback(async () => {
    if (!sourceProvider || !targetProvider) {
      console.error('Source and target providers must be selected');
      return;
    }

    setIsValidating(true);
    try {
      const response = await fetch('/api/migrations/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceProvider,
          targetProvider,
          fieldMappings,
        }),
      });
      const result = await response.json();
      setValidation(result);
      return result;
    } catch (error) {
      console.error('Failed to validate migration:', error);
      throw error;
    } finally {
      setIsValidating(false);
    }
  }, [sourceProvider, targetProvider, fieldMappings]);

  const startMigration = useCallback(async () => {
    try {
      const response = await fetch('/api/migrations/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceProvider,
          targetProvider,
          fieldMappings,
          shadowModeEnabled,
        }),
      });
      return await response.json();
    } catch (error) {
      console.error('Failed to start migration:', error);
      throw error;
    }
  }, [sourceProvider, targetProvider, fieldMappings, shadowModeEnabled]);

  return {
    currentStep,
    moveToStep,
    sourceProvider,
    setSourceProvider,
    targetProvider,
    setTargetProvider,
    fieldMappings,
    updateFieldMappings,
    shadowModeEnabled,
    setShadowModeEnabled,
    isValidating,
    validation,
    validateMigration,
    startMigration,
  };
}

export function useShadowMode(migrationId: string) {
  const [comparisons, setComparisons] = useState<ShadowModeComparison[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchComparisons = async () => {
      try {
        const response = await fetch(`/api/migrations/${migrationId}/shadow-mode`);
        const data = await response.json();
        setComparisons(data);
      } catch (error) {
        console.error('Failed to fetch shadow mode comparisons:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchComparisons();

    const interval = setInterval(fetchComparisons, 3000);

    return () => clearInterval(interval);
  }, [migrationId]);

  const getMatchPercentage = useCallback(() => {
    if (comparisons.length === 0) return 0;
    const matched = comparisons.filter((c) => c.matched).length;
    return Math.round((matched / comparisons.length) * 100);
  }, [comparisons]);

  return {
    comparisons,
    isLoading,
    matchPercentage: getMatchPercentage(),
  };
}
