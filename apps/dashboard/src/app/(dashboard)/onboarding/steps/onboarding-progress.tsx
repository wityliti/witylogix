"use client";

import { cn } from "@/lib/utils";
import { OnboardingStep, OnboardingSubStep } from "../types";

interface OnboardingProgressProps {
  currentStep: OnboardingStep;
  currentSubStep: OnboardingSubStep;
}

const STEP_LABELS: Record<OnboardingStep, string> = {
  "verify-email": "Verify",
  "choose-deployment": "Deploy",
  "configure-workspace": "Configure",
};

const SUB_STEP_LABELS: Record<OnboardingSubStep, { label: string; order: number }> = {
  "company-info": { label: "Company", order: 1 },
  "industry": { label: "Industry", order: 2 },
  "goals": { label: "Goals", order: 3 },
  "integrations": { label: "Integrations", order: 4 },
  "dashboard-layout": { label: "Dashboard", order: 5 },
  "data-import": { label: "Data", order: 6 },
  "review": { label: "Review", order: 7 },
};

const MAIN_STEPS: OnboardingStep[] = [
  OnboardingStep.VERIFY_EMAIL,
  OnboardingStep.CHOOSE_DEPLOYMENT,
  OnboardingStep.CONFIGURE_WORKSPACE,
];

const CONFIGURE_SUB_STEPS: OnboardingSubStep[] = [
  OnboardingSubStep.COMPANY_INFO,
  OnboardingSubStep.INDUSTRY,
  OnboardingSubStep.GOALS,
  OnboardingSubStep.INTEGRATIONS,
  OnboardingSubStep.DASHBOARD_LAYOUT,
  OnboardingSubStep.DATA_IMPORT,
  OnboardingSubStep.REVIEW,
];

export function OnboardingProgress({
  currentStep,
  currentSubStep,
}: OnboardingProgressProps) {
  // Calculate progress percentage
  const isConfigureStep = currentStep === "configure-workspace";
  const totalSubSteps = CONFIGURE_SUB_STEPS.length;
  const currentSubStepIndex = CONFIGURE_SUB_STEPS.indexOf(currentSubStep);

  let progressPercent = 0;
  if (currentStep === "verify-email") {
    progressPercent = 15;
  } else if (currentStep === "choose-deployment") {
    progressPercent = 30;
  } else if (isConfigureStep) {
    // 30% to 95% for configure steps
    progressPercent = 30 + ((currentSubStepIndex + 1) / totalSubSteps) * 65;
  }

  const getNextSubStep = (): OnboardingSubStep | null => {
    if (!isConfigureStep) return null;
    const nextIndex = currentSubStepIndex + 1;
    return nextIndex < CONFIGURE_SUB_STEPS.length ? CONFIGURE_SUB_STEPS[nextIndex] : null;
  };

  const nextSubStep = getNextSubStep();

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Main Progress Bar */}
      <div className="flex flex-col gap-2">
        {/* Progress Fill */}
        <div className="w-full h-1 bg-wl-bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-wl-primary-500 to-wl-primary-600 transition-all duration-500"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>

        {/* Progress Percentage */}
        <div className="flex justify-between items-center px-0.5">
          <span className="text-xs font-semibold text-wl-text-secondary">
            {Math.round(Math.min(progressPercent, 100))}%
          </span>
        </div>
      </div>

      {/* Step Indicators (for non-configure steps) */}
      {!isConfigureStep && (
        <div className="flex items-center gap-2 justify-between">
          {MAIN_STEPS.map((step, index) => {
            const isCompleted =
              MAIN_STEPS.indexOf(currentStep) > index;
            const isActive = currentStep === step;

            return (
              <div key={step} className="flex items-center flex-1">
                {index > 0 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 mx-1",
                      isCompleted
                        ? "bg-wl-primary-500"
                        : "bg-wl-border-subtle"
                    )}
                  />
                )}
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0",
                    isCompleted || isActive
                      ? "bg-wl-primary-500 text-wl-text-inverse"
                      : "bg-wl-bg-surface border border-wl-border-default text-wl-text-tertiary"
                  )}
                >
                  {index + 1}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sub-step Indicators (for configure step) */}
      {isConfigureStep && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {CONFIGURE_SUB_STEPS.map((subStep, index) => {
            const isCompleted =
              CONFIGURE_SUB_STEPS.indexOf(currentSubStep) > index;
            const isActive = currentSubStep === subStep;
            const label = SUB_STEP_LABELS[subStep].label;

            return (
              <div key={subStep} className="flex items-center gap-1.5">
                {index > 0 && (
                  <div className="w-1 h-1 rounded-full bg-wl-border-subtle" />
                )}
                <button
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-300",
                    isCompleted || isActive
                      ? "bg-wl-primary-500 text-wl-text-inverse"
                      : "bg-wl-bg-surface text-wl-text-tertiary hover:text-wl-text-secondary"
                  )}
                >
                  {label}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Next Step Label */}
      {nextSubStep && (
        <div className="flex items-center gap-2 text-xs text-wl-text-tertiary">
          <span className="font-medium">UP NEXT:</span>
          <span>{SUB_STEP_LABELS[nextSubStep].label}</span>
        </div>
      )}
    </div>
  );
}
