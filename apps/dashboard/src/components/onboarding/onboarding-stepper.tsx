"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: "completed" | "active" | "pending";
  substeps?: number;
}

interface OnboardingStepperProps extends HTMLAttributes<HTMLDivElement> {
  steps: StepConfig[];
  currentStep: number;
  percentage?: number;
}

const OnboardingStepper = forwardRef<HTMLDivElement, OnboardingStepperProps>(
  ({ steps, currentStep, percentage, className, ...props }, ref) => {
    return (
      <>
        <style>{`
          @keyframes pulse-ring {
            0% {
              box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4);
            }
            70% {
              box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
            }
          }
          .stepper-pulse {
            animation: pulse-ring 2s infinite;
          }
        `}</style>
        <div
          ref={ref}
          className={cn(
            "w-full px-4 py-6 md:px-6",
            "bg-wl-bg-surface border border-wl-border-subtle rounded-lg",
            className,
          )}
          {...props}
        >
          {/* Header with percentage */}
          {percentage !== undefined && (
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-wl-text-primary tracking-wider">
                ONBOARDING PROGRESS
              </h3>
              <div className="text-xs font-semibold text-wl-text-secondary">
                {percentage}% Complete
              </div>
            </div>
          )}

          {/* Steps container */}
          <div className="flex gap-1 md:gap-2 items-center overflow-x-auto pb-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="flex items-center gap-2 flex-shrink-0"
              >
                {/* Step circle with icon/checkmark */}
                <div className="relative flex-shrink-0">
                  <div
                    className={cn(
                      "w-10 md:w-12 h-10 md:h-12",
                      "rounded-full flex items-center justify-center",
                      "transition-all duration-base ease-default",
                      step.status === "completed"
                        ? "bg-wl-success-500/20 border border-wl-success-500"
                        : step.status === "active"
                          ? "bg-wl-primary-500/20 border-2 border-wl-primary-500 stepper-pulse"
                          : "bg-wl-bg-overlay border border-wl-border-subtle",
                    )}
                  >
                    {step.status === "completed" ? (
                      <Check
                        className="w-5 h-5 md:w-6 md:h-6 text-wl-success-400"
                        strokeWidth={3}
                      />
                    ) : (
                      <div
                        className={cn(
                          "text-xs md:text-sm font-semibold",
                          step.status === "active"
                            ? "text-wl-primary-400"
                            : "text-wl-text-tertiary",
                        )}
                      >
                        {step.icon}
                      </div>
                    )}
                  </div>
                </div>

                {/* Step label (hidden on mobile, shown on md+) */}
                <div className="hidden md:block flex-shrink-0">
                  <div className="text-xs font-semibold text-wl-text-primary tracking-wider">
                    {step.label}
                  </div>
                  {step.substeps && (
                    <div className="text-xs text-wl-text-tertiary mt-1">
                      {Array.from({ length: step.substeps }).map((_, i) => (
                        <span
                          key={i}
                          className={cn(
                            "inline-block w-1.5 h-1.5 rounded-full mx-0.5",
                            i < currentStep && step.status === "active"
                              ? "bg-wl-primary-400"
                              : "bg-wl-border-subtle",
                          )}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Progress line (between steps) */}
                {index < steps.length - 1 && (
                  <div className="h-1 flex-grow mx-1 md:mx-2 flex-shrink-0 max-w-[60px]">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-base",
                        step.status === "completed"
                          ? "bg-wl-success-500"
                          : "bg-wl-border-subtle",
                      )}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Mobile label for current step */}
          <div className="md:hidden mt-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-wl-text-primary tracking-wider">
                {steps[currentStep]?.label}
              </div>
              <div className="text-xs text-wl-text-tertiary mt-1">
                Step {currentStep + 1} of {steps.length}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  },
);

OnboardingStepper.displayName = "OnboardingStepper";

export { OnboardingStepper };
export type { OnboardingStepperProps, StepConfig };
