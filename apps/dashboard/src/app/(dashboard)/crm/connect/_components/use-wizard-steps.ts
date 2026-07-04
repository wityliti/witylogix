"use client";

import { useMemo } from "react";
import type { WizardStep } from "./types";

interface UseWizardStepsProps {
  activeStep: number;
  completedSteps: Set<number>;
  selectedPlatform: string | null;
}

export function useWizardSteps({
  activeStep,
  completedSteps,
  selectedPlatform,
}: UseWizardStepsProps): WizardStep[] {
  return useMemo<WizardStep[]>(
    () => [
      {
        id: 1,
        title: "Select Platform",
        description: "Choose your CRM platform",
        isComplete: completedSteps.has(1),
        isActive: activeStep === 1,
        isAccessible: true,
      },
      {
        id: 2,
        title: "OAuth Authorization",
        description: "Authorize access to your CRM",
        isComplete: completedSteps.has(2),
        isActive: activeStep === 2,
        isAccessible: selectedPlatform !== null,
      },
      {
        id: 3,
        title: "Configure Sync",
        description: "Set up sync direction and objects",
        isComplete: completedSteps.has(3),
        isActive: activeStep === 3,
        isAccessible: selectedPlatform !== null && completedSteps.has(2),
      },
      {
        id: 4,
        title: "Test Connection",
        description: "Verify credentials and pull sample data",
        isComplete: completedSteps.has(4),
        isActive: activeStep === 4,
        isAccessible: selectedPlatform !== null && completedSteps.has(3),
      },
      {
        id: 5,
        title: "Review & Activate",
        description: "Summary and enable connection",
        isComplete: completedSteps.has(5),
        isActive: activeStep === 5,
        isAccessible: selectedPlatform !== null && completedSteps.has(4),
      },
    ],
    [activeStep, completedSteps, selectedPlatform],
  );
}
