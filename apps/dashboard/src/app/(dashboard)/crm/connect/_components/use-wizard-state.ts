"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import type { WizardStep, SyncConfig } from "./types";
import { DEFAULT_SYNC_CONFIG, DEFAULT_SYNC_SCHEDULE } from "./constants";

export function useWizardState() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Wizard state
  const [activeStep, setActiveStep] = useState(
    parseInt(searchParams.get("step") || "1"),
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
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  // Handle step change with accessibility checks
  const handleStepChange = useCallback((step: number, steps: WizardStep[]) => {
    const stepDef = steps.find((s) => s.id === step);
    if (stepDef?.isAccessible) {
      setActiveStep(step);
    }
  }, []);

  // Next/Previous navigation
  const handleNext = useCallback(
    (steps: WizardStep[]) => {
      if (activeStep < 5) {
        const newStep = activeStep + 1;
        setCompletedSteps((prev) => new Set([...prev, activeStep]));
        handleStepChange(newStep, steps);
      }
    },
    [activeStep, handleStepChange],
  );

  const handlePrevious = useCallback(
    (steps: WizardStep[]) => {
      if (activeStep > 1) {
        handleStepChange(activeStep - 1, steps);
      }
    },
    [activeStep, handleStepChange],
  );

  // Handle platform selection
  const handleSelectPlatform = useCallback((platformId: string) => {
    setSelectedPlatform(platformId);
  }, []);

  // Handle sync configuration
  const handleUpdateSyncConfig = useCallback((config: Partial<SyncConfig>) => {
    setSyncConfig((prev) => ({ ...prev, ...config }));
  }, []);

  // Handle test connection — calls real sync-status endpoint to verify OAuth completed
  const handleTestConnection = useCallback(async () => {
    setTestResults(null);
    try {
      await api.get("/api/v4/crm/sync/status");
      setTestResults({
        success: true,
        message: "Connection verified — CRM is accessible.",
      });
    } catch {
      setTestResults({
        success: false,
        message: "CRM not reachable. Complete the OAuth step first.",
      });
    }
  }, []);

  // Handle activation — triggers initial full sync then navigates
  const handleActivate = useCallback(async () => {
    setActivating(true);
    setActivateError(null);
    try {
      await api.post("/api/v4/crm/sync", {
        recordType: undefined,
        incremental: false,
      });
      setCompletedSteps((prev) => new Set([...prev, 5]));
      router.push("/crm");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Activation failed";
      setActivateError(msg);
    } finally {
      setActivating(false);
    }
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
    activating,
    activateError,
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
