"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { CheckCircle2, Circle, LogIn, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

type StepStatus = "completed" | "active" | "pending";

interface OnboardingStep {
  id: string;
  title: string;
  description?: string;
  status: StepStatus;
  icon: "provider" | "credentials" | "configure";
}

interface PartnerOnboardingStepsProps extends HTMLAttributes<HTMLDivElement> {
  steps: OnboardingStep[];
  currentStep?: number;
  isCompact?: boolean; // Show horizontal on desktop, vertical on mobile (default)
}

const stepIcons = {
  provider: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
    </svg>
  ),
  credentials: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  configure: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

const PartnerOnboardingSteps = forwardRef<
  HTMLDivElement,
  PartnerOnboardingStepsProps
>(
  (
    {
      steps,
      currentStep = 0,
      isCompact = false,
      className,
      ...props
    },
    ref
  ) => {
    const isHorizontal = !isCompact; // Horizontal by default

    return (
      <Card ref={ref} className={className} {...props}>
        <div className={cn(
          "flex gap-4 p-6",
          isHorizontal ? "flex-row items-start" : "flex-col"
        )}>
          {steps.map((step, index) => {
            const isCompleted = step.status === "completed";
            const isActive = step.status === "active" || index === currentStep;
            const isPending = step.status === "pending";

            return (
              <div key={step.id} className="flex-1">
                <div
                  className={cn(
                    "flex gap-3",
                    isHorizontal ? "flex-col items-center text-center" : "flex-row items-start"
                  )}
                >
                  {/* Step indicator */}
                  <div
                    className={cn(
                      "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all",
                      isCompleted
                        ? "bg-wl-success-500/20 text-wl-success-400"
                        : isActive
                          ? "bg-wl-primary-500/20 text-wl-primary-400 ring-2 ring-wl-primary-400/30"
                          : "bg-wl-bg-surface text-wl-text-secondary"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : isActive ? (
                      <Circle className="w-5 h-5" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>

                  {/* Step content */}
                  <div className={cn(isHorizontal ? "flex-1" : "flex-1 min-w-0")}>
                    <h4 className={cn(
                      "font-semibold transition-colors",
                      isActive
                        ? "text-wl-text-primary"
                        : isCompleted
                          ? "text-wl-success-400"
                          : "text-wl-text-secondary"
                    )}>
                      {step.title}
                    </h4>
                    {step.description && (
                      <p className="text-xs text-wl-text-secondary mt-1">
                        {step.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Connector line */}
                {index < steps.length - 1 && isHorizontal && (
                  <div
                    className={cn(
                      "h-1 mt-3 rounded-full transition-all",
                      isCompleted || isActive
                        ? "bg-wl-primary-400"
                        : "bg-wl-border-subtle"
                    )}
                  />
                )}

                {/* Vertical connector */}
                {index < steps.length - 1 && !isHorizontal && (
                  <div
                    className={cn(
                      "absolute left-5 w-0.5 h-6 ml-5 mt-2 transition-all",
                      isCompleted || isActive
                        ? "bg-wl-primary-400"
                        : "bg-wl-border-subtle"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Status summary */}
        <div className="px-6 py-4 border-t border-wl-border-subtle bg-wl-bg-surface/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-wl-text-secondary">
              Step {currentStep + 1} of {steps.length}
            </span>
            {currentStep === steps.length - 1 ? (
              <span className="text-wl-success-400 font-medium">
                ✓ Setup Complete
              </span>
            ) : (
              <span className="text-wl-primary-400 font-medium">
                In Progress
              </span>
            )}
          </div>
        </div>
      </Card>
    );
  }
);

PartnerOnboardingSteps.displayName = "PartnerOnboardingSteps";

export { PartnerOnboardingSteps };
export type { PartnerOnboardingStepsProps, OnboardingStep, StepStatus };
