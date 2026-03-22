'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { WizardStep, SyncConfig } from './types';
import { DEFAULT_SYNC_CONFIG, DEFAULT_SYNC_SCHEDULE } from './constants';

export function useWizardState() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Wizard state
  const [activeStep, setActiveStep] = useState(
    parseInt(searchParams.get('step') || '1')
  );
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Form state
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(DEFAULT_SYNC_CONFIG);
  const [testResults, setTestResults] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [syncSchedule, setSyncSchedule] = useState(DEFAULT_SYNC_SCHEDULE);

  // Handle step change with accessibility checks
  const handleStepChange = useCallback(
    (step: number, steps: WizardStep[]) => {
      const stepDef = steps.find((s) => s.id === step);
      if (stepDef?.isAccessible) {
        setActiveStep(step);
      }
    },
    []
  );

  // Next/Previous navigation
  const handleNext = useCallback(
    (steps: WizardStep[]) => {
      if (activeStep < 5) {
        const newStep = activeStep + 1;
        setCompletedSteps((prev) => new Set([...prev, activeStep]));
        handleStepChange(newStep, steps);
      }
    },
    [activeStep, handleStepChange]
  );

  const handlePrevious = useCallback(
    (steps: WizardStep[]) => {
      if (activeStep > 1) {
        handleStepChange(activeStep - 1, steps);
      }
    },
    [activeStep, handleStepChange]
  );

  // Handle platform selection
  const handleSelectPlatform = useCallback((platformId: string) => {
    setSelectedPlatform(platformId);
  }, []);

  // Handle sync configuration
  const handleUpdateSyncConfig = useCallback(
    (config: Partial<SyncConfig>) => {
      setSyncConfig((prev) => ({ ...prev, ...config }));
    },
    []
  );

  // Handle test connection
  const handleTestConnection = useCallback(async () => {
    setTestResults({ success: true, message: 'Connection test successful!' });
  }, []);

  // Handle activation
  const handleActivate = useCallback(() => {
    setCompletedSteps((prev) => new Set([...prev, 5]));
    // In a real implementation, make API call to activate
    setTimeout(() => {
      router.push('/dashboard/crm');
    }, 1500);
  }, [router]);

  return {
    // State
    activeStep,
    completedSteps,
    selectedPlatform,
    syncConfig,
    testResults,
    isEnabled,
    syncSchedule,
    // Setters
    setActiveStep,
    setSyncConfig,
    setTestResults,
    setIsEnabled,
    setSyncSchedule,
    // Handlers
    handleStepChange,
    handleNext,
    handlePrevious,
    handleSelectPlatform,
    handleUpdateSyncConfig,
    handleTestConnection,
    handleActivate,
  };
}
