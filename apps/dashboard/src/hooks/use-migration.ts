'use client';

import { useState, useCallback } from 'react';

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
  return {
    migrations: [] as Migration[],
    isLoading: false,
    fetchMigrations: async () => {},
    createMigration: async (_src: string, _tgt: string): Promise<Migration> => {
      throw new Error('Migration API not available');
    },
  };
}

export function useMigrationWizard(_initialMigrationId?: string) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [sourceProvider, setSourceProvider] = useState('');
  const [targetProvider, setTargetProvider] = useState('');
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [shadowModeEnabled, setShadowModeEnabled] = useState(false);
  const [isValidating] = useState(false);
  const [validation] = useState<MigrationValidation | null>(null);

  const moveToStep = useCallback((step: 1 | 2 | 3 | 4 | 5) => {
    setCurrentStep(step);
  }, []);

  const updateFieldMappings = useCallback((mappings: FieldMapping[]) => {
    setFieldMappings(mappings);
  }, []);

  const validateMigration = useCallback(async (): Promise<MigrationValidation> => {
    throw new Error('Migration validation not available');
  }, []);

  const startMigration = useCallback(async (): Promise<Migration> => {
    throw new Error('Migration execution not available');
  }, []);

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

export function useShadowMode(_migrationId: string) {
  const getMatchPercentage = useCallback(() => 0, []);

  return {
    comparisons: [] as ShadowModeComparison[],
    isLoading: false,
    matchPercentage: getMatchPercentage(),
  };
}
