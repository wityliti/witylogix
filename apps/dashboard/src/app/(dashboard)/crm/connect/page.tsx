mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
"use client";
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
import { useCallback, useMemo, useState } from "react";
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
import { useRouter, useSearchParams } from "next/navigation";
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
import { cn } from "@/lib/utils";
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
import { Header } from "@/components/layout/header";
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
import { Badge } from "@/components/ui/badge";
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
import { Button } from "@/components/ui/button";
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
import { CrmPlatformCard } from "@/components/crm/crm-platform-card";
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
import { useCrmConnection } from "@/hooks/use-crm-connection";
import { useApiList } from '@/hooks/use-api';
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
/* ═══════════════════════════════════════════════════════════
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
   CRM Connection Wizard — OAuth2 flows with compound components
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
   ═══════════════════════════════════════════════════════════ */
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
// Types for wizard step management
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
interface WizardStep {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  id: number;
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  title: string;
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  description: string;
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  isComplete: boolean;
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  isActive: boolean;
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  isAccessible: boolean;
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
interface SyncConfig {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  direction: "in" | "out" | "bidirectional";
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  objectTypes: string[];
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
// Wizard component structure
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
interface WizardProps {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  children: React.ReactNode;
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  activeStep: number;
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  onStepChange: (step: number) => void;
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
interface WizardStepProps {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  stepId: number;
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  title: string;
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  children: React.ReactNode;
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
interface WizardNavProps {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  steps: WizardStep[];
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  activeStep: number;
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  onStepClick: (step: number) => void;
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
interface WizardContentProps {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  children: React.ReactNode;
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
// Compound Wizard Components
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
function Wizard({ children, activeStep, onStepChange }: WizardProps) {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  return (
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    <div className={cn("flex h-screen bg-wl-bg-root")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      {/* Sidebar Navigation */}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      <div
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        className={cn(
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          "w-64 border-r border-wl-border-subtle",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          "bg-wl-bg-elevated overflow-y-auto",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          "flex flex-col"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        )}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      >
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        {children}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  );
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
function WizardNav({ steps, activeStep, onStepClick }: WizardNavProps) {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  const handleKeyDown = useCallback(
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    (e: React.KeyboardEvent, step: number) => {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      if (e.key === "Enter" || e.key === " ") {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        e.preventDefault();
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        onStepClick(step);
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      }
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    },
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    [onStepClick]
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  );
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  return (
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    <nav className={cn("p-6 space-y-2 flex-1")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      <h3
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        className={cn(
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          "text-xs font-bold",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          "text-wl-text-secondary uppercase",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          "tracking-wider mb-4 px-3"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        )}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      >
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        Setup Steps
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      </h3>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      {steps.map((step, index) => (
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        <div key={step.id}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          {/* Step Button */}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          <button
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
            onClick={() => onStepClick(step.id)}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
            onKeyDown={(e) => handleKeyDown(e, step.id)}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
            disabled={!step.isAccessible}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
            className={cn(
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              "w-full text-left px-3 py-3 rounded-md",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              "transition-all duration-base ease-default",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              "relative group",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              step.isActive
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                ? "bg-wl-primary-500/20 border border-wl-primary-500"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                : "hover:bg-wl-bg-overlay",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              !step.isAccessible && "opacity-50 cursor-not-allowed"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
            )}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          >
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
            <div className={cn("flex items-center gap-3")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              {/* Step Number or Checkmark */}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              <div
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                className={cn(
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  "w-6 h-6 rounded-full",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  "flex items-center justify-center",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  "text-xs font-bold",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  step.isComplete
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    ? "bg-wl-success-500 text-white"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    : step.isActive
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      ? "bg-wl-primary-500 text-white"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      : "bg-wl-bg-surface border border-wl-border-default text-wl-text-secondary"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                )}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              >
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                {step.isComplete ? (
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  <svg
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    width="14"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    height="14"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    viewBox="0 0 24 24"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    fill="none"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    stroke="currentColor"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    strokeWidth="3"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    strokeLinecap="round"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    strokeLinejoin="round"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  >
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    <polyline points="20 6 9 17 4 12"></polyline>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  </svg>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                ) : (
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  index + 1
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                )}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              <div className={cn("flex-1 min-w-0")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                <p
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  className={cn(
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    "text-sm font-semibold",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    "truncate",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    step.isActive ? "text-wl-text-primary" : "text-wl-text-secondary"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  )}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                >
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  {step.title}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                </p>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
            </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          </button>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          {/* Step Connector */}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          {index < steps.length - 1 && (
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
            <div
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              className={cn(
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                "ml-7 h-2 w-0.5",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                "bg-wl-border-subtle",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                step.isComplete && "bg-wl-success-500"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              )}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
            />
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          )}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      ))}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    </nav>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  );
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
function WizardContent({ children }: WizardContentProps) {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  return (
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    <div className={cn("flex-1 flex flex-col", "overflow-hidden")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      {children}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  );
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
function WizardStep({ stepId, title, children }: WizardStepProps) {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  return (
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    <div className={cn("flex-1 flex flex-col", "overflow-y-auto")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      <Header title={title} />
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      <div
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        className={cn(
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          "flex-1 overflow-y-auto",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          "px-6 py-5",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          "max-w-4xl mx-auto w-full"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        )}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      >
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        {children}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  );
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
// Main Page Component
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
export default function CrmConnectPage() {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
  const { items, loading, error, refetch, pagination } = useApiList<CRMConnection>(/api/v4/crm/connect);

  if (loading) return <TableSkeleton rows={10} columns={6} />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

mport { ErrorState } from '@/components/ui/error-state';
  const router = useRouter();
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  const searchParams = useSearchParams();
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  const { initiateOAuth } = useCrmConnection();
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  // Wizard state
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  const [activeStep, setActiveStep] = useState(
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    parseInt(searchParams.get("step") || "1")
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  );
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  // Form state
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    direction: "bidirectional",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    objectTypes: ["contacts", "deals", "companies"],
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  });
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  const [testResults, setTestResults] = useState<{
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    success: boolean;
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    message: string;
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  } | null>(null);
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  const [isEnabled, setIsEnabled] = useState(false);
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  const [syncSchedule, setSyncSchedule] = useState("hourly");
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  // Platform data
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  const platforms = useMemo(
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    () => [
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        id: "salesforce",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        name: "Salesforce",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        description: "Connect to Salesforce CRM for contact and deal management",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        logo: "salesforce",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        isConnected: false,
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      },
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        id: "hubspot",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        name: "HubSpot",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        description: "Sync with HubSpot for marketing and sales automation",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        logo: "hubspot",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        isConnected: false,
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      },
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        id: "zoho",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        name: "Zoho CRM",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        description: "Integrate with Zoho for comprehensive CRM operations",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        logo: "zoho",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        isConnected: false,
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      },
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        id: "pipedrive",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        name: "Pipedrive",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        description: "Connect Pipedrive for sales pipeline management",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        logo: "pipedrive",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        isConnected: false,
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      },
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        id: "ms-dynamics",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        name: "Dynamics 365",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        description: "Integrate Microsoft Dynamics 365 for enterprise CRM",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        logo: "dynamics",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        isConnected: false,
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      },
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    ],
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    []
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  );
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  // Wizard steps configuration
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  const steps = useMemo<WizardStep[]>(
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    () => [
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        id: 1,
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        title: "Select Platform",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        description: "Choose your CRM platform",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        isComplete: completedSteps.has(1),
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        isActive: activeStep === 1,
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        isAccessible: true,
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      },
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        id: 2,
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        title: "OAuth Authorization",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        description: "Authorize access to your CRM",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        isComplete: completedSteps.has(2),
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        isActive: activeStep === 2,
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        isAccessible: selectedPlatform !== null,
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      },
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        id: 3,
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        title: "Configure Sync",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        description: "Set up sync direction and objects",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        isComplete: completedSteps.has(3),
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        isActive: activeStep === 3,
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        isAccessible: selectedPlatform !== null && completedSteps.has(2),
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      },
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        id: 4,
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        title: "Test Connection",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        description: "Verify credentials and pull sample data",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        isComplete: completedSteps.has(4),
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        isActive: activeStep === 4,
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        isAccessible: selectedPlatform !== null && completedSteps.has(3),
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      },
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        id: 5,
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        title: "Review & Activate",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        description: "Summary and enable connection",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        isComplete: completedSteps.has(5),
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        isActive: activeStep === 5,
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        isAccessible: selectedPlatform !== null && completedSteps.has(4),
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      },
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    ],
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    [activeStep, completedSteps, selectedPlatform]
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  );
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  // Handle step change with keyboard navigation
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  const handleStepChange = useCallback(
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    (step: number) => {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      const stepDef = steps.find((s) => s.id === step);
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      if (stepDef?.isAccessible) {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        setActiveStep(step);
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      }
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    },
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    [steps]
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  );
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  // Next/Previous navigation
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  const handleNext = useCallback(() => {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    if (activeStep < 5) {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      const newStep = activeStep + 1;
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      setCompletedSteps((prev) => new Set([...prev, activeStep]));
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      handleStepChange(newStep);
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    }
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  }, [activeStep, handleStepChange]);
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  const handlePrevious = useCallback(() => {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    if (activeStep > 1) {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      handleStepChange(activeStep - 1);
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    }
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  }, [activeStep, handleStepChange]);
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  // Handle platform selection
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  const handleSelectPlatform = useCallback((platformId: string) => {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    setSelectedPlatform(platformId);
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  }, []);
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  // Handle OAuth initiation
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  const handleStartOAuth = useCallback(() => {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    if (!selectedPlatform) return;
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    // In a real implementation, you'd get these from environment variables
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    const oauthConfig = {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      platformId: selectedPlatform,
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      clientId: process.env.NEXT_PUBLIC_CRM_CLIENT_ID || "",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      redirectUri: `${window.location.origin}/api/integrations/crm/oauth/callback`,
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      scope: ["contacts", "deals"],
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    };
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    initiateOAuth(oauthConfig);
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  }, [selectedPlatform, initiateOAuth]);
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  // Handle sync configuration
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  const handleUpdateSyncConfig = useCallback(
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    (config: Partial<SyncConfig>) => {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      setSyncConfig((prev) => ({ ...prev, ...config }));
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    },
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    []
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  );
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  // Handle test connection
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  const handleTestConnection = useCallback(async () => {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    setTestResults({ success: true, message: "Connection test successful!" });
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  }, []);
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  // Handle activation
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  const handleActivate = useCallback(() => {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    setCompletedSteps((prev) => new Set([...prev, 5]));
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    // In a real implementation, make API call to activate
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    setTimeout(() => {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      router.push("/dashboard/crm");
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    }, 1500);
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  }, [router]);
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  return (
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    <Wizard activeStep={activeStep} onStepChange={handleStepChange}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      <WizardNav
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        steps={steps}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        activeStep={activeStep}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        onStepClick={handleStepChange}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      />
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      <WizardContent>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        {/* Step 1: Platform Selection */}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        {activeStep === 1 && (
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          <WizardStep stepId={1} title="Select CRM Platform">
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
            <div className={cn("space-y-6")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              <p className={cn("text-wl-text-secondary", "leading-relaxed")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                Choose which CRM platform you want to connect to Witylogix.
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              </p>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              <div
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                className={cn(
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  "grid grid-cols-1 md:grid-cols-2 gap-4",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  "auto-rows-max"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                )}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              >
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                {platforms.map((platform) => (
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  <CrmPlatformCard
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    key={platform.id}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    platform={platform}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    onSelect={handleSelectPlatform}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    isSelected={selectedPlatform === platform.id}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  />
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                ))}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              <div className={cn("flex justify-end gap-3 pt-6")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                <Button variant="ghost" onClick={() => router.push("/dashboard/crm")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  Cancel
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                </Button>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                <Button
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  disabled={!selectedPlatform}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  onClick={handleNext}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                >
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  Next
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                </Button>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
            </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          </WizardStep>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        )}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        {/* Step 2: OAuth Authorization */}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        {activeStep === 2 && selectedPlatform && (
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          <WizardStep stepId={2} title="OAuth Authorization">
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
            <div className={cn("space-y-6 max-w-2xl")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              <Card>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                <CardHeader>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  <CardTitle>Connect to {platforms.find((p) => p.id === selectedPlatform)?.name}</CardTitle>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                </CardHeader>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                <CardContent className={cn("space-y-4")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  <p className={cn("text-wl-text-secondary")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    You'll be redirected to {platforms.find((p) => p.id === selectedPlatform)?.name} to authorize
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    access. We'll never store your credentials.
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  </p>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  <div
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    className={cn(
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      "bg-wl-info-500/10 border border-wl-info-500/30",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      "rounded-md p-4"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    )}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  >
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    <p className={cn("text-sm text-wl-info-400", "m-0")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      We're requesting access to manage contacts, deals, and company records.
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    </p>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                </CardContent>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              </Card>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              <div className={cn("flex justify-between gap-3 pt-6")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                <Button variant="ghost" onClick={handlePrevious}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  Back
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                </Button>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                <Button onClick={handleStartOAuth}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  Authorize with {platforms.find((p) => p.id === selectedPlatform)?.name}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                </Button>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
            </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          </WizardStep>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        )}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        {/* Step 3: Configure Sync */}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        {activeStep === 3 && selectedPlatform && (
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          <WizardStep stepId={3} title="Configure Sync Settings">
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
            <div className={cn("space-y-6 max-w-2xl")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              <Card>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                <CardHeader>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  <CardTitle>Sync Direction</CardTitle>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                </CardHeader>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                <CardContent className={cn("space-y-4")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  <div className={cn("space-y-3")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    {[
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        value: "in",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        label: "Pull from CRM",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        desc: "Sync data from your CRM to Witylogix",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      },
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        value: "out",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        label: "Push to CRM",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        desc: "Sync data from Witylogix to your CRM",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      },
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        value: "bidirectional",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        label: "Bidirectional",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        desc: "Keep data synchronized both ways",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      },
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    ].map((option) => (
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      <label
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        key={option.value}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        className={cn(
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          "flex items-start gap-3 p-3 rounded-md",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          "border cursor-pointer transition-all duration-base",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          syncConfig.direction === option.value
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                            ? "border-wl-primary-500 bg-wl-primary-500/10"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                            : "border-wl-border-subtle hover:border-wl-border-default"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        )}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      >
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        <input
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          type="radio"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          name="direction"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          value={option.value}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          checked={syncConfig.direction === option.value}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          onChange={(e) =>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                            handleUpdateSyncConfig({
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                              direction: e.target.value as "in" | "out" | "bidirectional",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                            })
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          }
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          className={cn("mt-1")}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        />
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        <div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          <p className={cn("font-semibold text-wl-text-primary", "m-0")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                            {option.label}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          </p>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          <p className={cn("text-sm text-wl-text-tertiary", "mt-0.5")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                            {option.desc}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          </p>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      </label>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    ))}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                </CardContent>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              </Card>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              <Card>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                <CardHeader>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  <CardTitle>Objects to Sync</CardTitle>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                </CardHeader>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                <CardContent className={cn("space-y-3")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  {["contacts", "deals", "companies"].map((obj) => (
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    <label
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      key={obj}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      className={cn("flex items-center gap-3 cursor-pointer")}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    >
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      <input
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        type="checkbox"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        checked={syncConfig.objectTypes.includes(obj)}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        onChange={(e) => {
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          const newTypes = e.target.checked
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                            ? [...syncConfig.objectTypes, obj]
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                            : syncConfig.objectTypes.filter((t) => t !== obj);
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          handleUpdateSyncConfig({ objectTypes: newTypes });
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        }}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        className={cn("rounded")}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      />
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      <span className={cn("capitalize text-wl-text-primary", "font-medium")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        {obj}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      </span>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    </label>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  ))}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                </CardContent>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              </Card>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              <div className={cn("flex justify-between gap-3 pt-6")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                <Button variant="ghost" onClick={handlePrevious}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  Back
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                </Button>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                <Button onClick={handleNext}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  Next
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                </Button>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
            </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          </WizardStep>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        )}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        {/* Step 4: Test Connection */}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        {activeStep === 4 && selectedPlatform && (
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          <WizardStep stepId={4} title="Test Connection">
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
            <div className={cn("space-y-6 max-w-2xl")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              <p className={cn("text-wl-text-secondary")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                Verify your connection and pull sample data from your CRM.
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              </p>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              {testResults && (
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                <Card
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  className={cn(
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    testResults.success && "border-wl-success-500 bg-wl-success-500/5"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  )}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                >
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  <CardContent className={cn("pt-5")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    <div className={cn("flex items-start gap-3")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      {testResults.success ? (
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        <svg
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          width="20"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          height="20"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          viewBox="0 0 24 24"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          fill="none"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          stroke="currentColor"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          strokeWidth="2"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          strokeLinecap="round"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          strokeLinejoin="round"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          className="text-wl-success-400 mt-0.5 flex-shrink-0"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        >
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          <polyline points="20 6 9 17 4 12"></polyline>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        </svg>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      ) : (
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        <svg
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          width="20"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          height="20"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          viewBox="0 0 24 24"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          fill="none"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          stroke="currentColor"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          strokeWidth="2"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          className="text-wl-danger-400 mt-0.5 flex-shrink-0"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        >
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          <circle cx="12" cy="12" r="10"></circle>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          <line x1="15" y1="9" x2="9" y2="15"></line>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          <line x1="9" y1="9" x2="15" y2="15"></line>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        </svg>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      )}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      <p
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        className={cn(
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          "m-0",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          testResults.success
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                            ? "text-wl-success-400"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                            : "text-wl-danger-400"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        )}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      >
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        {testResults.message}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      </p>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  </CardContent>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                </Card>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              )}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              <div className={cn("flex justify-between gap-3 pt-6")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                <Button variant="ghost" onClick={handlePrevious}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  Back
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                </Button>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                <div className={cn("flex gap-3")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  <Button variant="secondary" onClick={handleTestConnection}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    Test Connection
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  </Button>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  <Button disabled={!testResults?.success} onClick={handleNext}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    Next
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  </Button>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
            </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          </WizardStep>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        )}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        {/* Step 5: Review & Activate */}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        {activeStep === 5 && selectedPlatform && (
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          <WizardStep stepId={5} title="Review & Activate">
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
            <div className={cn("space-y-6 max-w-2xl")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              <Card>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                <CardHeader>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  <CardTitle>Connection Summary</CardTitle>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                </CardHeader>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                <CardContent className={cn("space-y-4")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  <div className={cn("grid grid-cols-2 gap-4")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    <div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      <p className={cn("text-sm text-wl-text-tertiary", "mb-1")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        Platform
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      </p>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      <p className={cn("font-semibold text-wl-text-primary")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        {platforms.find((p) => p.id === selectedPlatform)?.name}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      </p>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    <div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      <p className={cn("text-sm text-wl-text-tertiary", "mb-1")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        Sync Direction
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      </p>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      <Badge variant="primary" className="capitalize">
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        {syncConfig.direction}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      </Badge>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  <div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    <p className={cn("text-sm text-wl-text-tertiary", "mb-2")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      Objects
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    </p>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    <div className={cn("flex gap-2 flex-wrap")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      {syncConfig.objectTypes.map((obj) => (
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        <Badge key={obj} variant="info" className="capitalize">
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          {obj}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        </Badge>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      ))}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                </CardContent>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              </Card>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              <Card>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                <CardHeader>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  <CardTitle>Activation Settings</CardTitle>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                </CardHeader>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                <CardContent className={cn("space-y-4")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  <label className={cn("flex items-center gap-3 cursor-pointer")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    <input
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      type="checkbox"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      checked={isEnabled}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      onChange={(e) => setIsEnabled(e.target.checked)}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    />
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    <span className={cn("text-wl-text-primary", "font-medium")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      Enable this integration
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    </span>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  </label>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  {isEnabled && (
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    <div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      <label className={cn("block text-sm text-wl-text-secondary mb-2")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        Sync Schedule
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      </label>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      <select
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        value={syncSchedule}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        onChange={(e) => setSyncSchedule(e.target.value)}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        className={cn(
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          "w-full px-3 py-2 rounded-md",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          "bg-wl-bg-surface border border-wl-border-default",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          "text-wl-text-primary",
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                          "focus:outline-none focus:border-wl-primary-500"
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        )}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      >
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        <option value="hourly">Every hour</option>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        <option value="daily">Daily</option>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        <option value="weekly">Weekly</option>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                        <option value="monthly">Monthly</option>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                      </select>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                    </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  )}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                </CardContent>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              </Card>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';

mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              <div className={cn("flex justify-between gap-3 pt-6")}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                <Button variant="ghost" onClick={handlePrevious}>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  Back
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                </Button>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                <Button
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  disabled={!isEnabled}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  onClick={handleActivate}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                >
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                  Activate Connection
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
                </Button>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
              </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
            </div>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
          </WizardStep>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
        )}
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
      </WizardContent>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
    </Wizard>
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
  );
mport { TableSkeleton } from '@/components/ui/loading-skeleton';
mport { ErrorState } from '@/components/ui/error-state';
}
