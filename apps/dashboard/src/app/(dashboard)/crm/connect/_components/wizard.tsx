'use client';

import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import type { WizardStep } from './types';

/* ═══════════════════════════════════════════════════════════
   Wizard Compound Components for CRM Connection Setup
   ═══════════════════════════════════════════════════════════ */

// Wizard component structure
interface WizardProps {
  children: React.ReactNode;
  activeStep: number;
  onStepChange: (step: number) => void;
}

interface WizardStepProps {
  stepId: number;
  title: string;
  children: React.ReactNode;
}

interface WizardNavProps {
  steps: WizardStep[];
  activeStep: number;
  onStepClick: (step: number) => void;
}

interface WizardContentProps {
  children: React.ReactNode;
}

// Compound Wizard Components
export function Wizard({ children, activeStep, onStepChange }: WizardProps) {
  return (
    <div className={cn('flex h-screen bg-wl-bg-root')}>
      {/* Sidebar Navigation */}
      <div
        className={cn(
          'w-64 border-r border-wl-border-default',
          'bg-wl-bg-surface overflow-y-auto',
          'flex flex-col'
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function WizardNav({ steps, activeStep, onStepClick }: WizardNavProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, step: number) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onStepClick(step);
      }
    },
    [onStepClick]
  );

  return (
    <nav className={cn('p-6 space-y-2 flex-1')}>
      <h3
        className={cn(
          'text-xs font-bold',
          'text-wl-text-secondary uppercase',
          'tracking-wider mb-4 px-3'
        )}
      >
        Setup Steps
      </h3>
      {steps.map((step, index) => (
        <div key={step.id}>
          {/* Step Button */}
          <button
            onClick={() => onStepClick(step.id)}
            onKeyDown={(e) => handleKeyDown(e, step.id)}
            disabled={!step.isAccessible}
            className={cn(
              'w-full text-left px-3 py-3 rounded-md',
              'transition-all duration-base ease-default',
              'relative group',
              step.isActive
                ? 'bg-wl-info-500/20 border border-wl-info-500'
                : 'hover:bg-wl-bg-elevated',
              !step.isAccessible && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div className={cn('flex items-center gap-3')}>
              {/* Step Number or Checkmark */}
              <div
                className={cn(
                  'w-6 h-6 rounded-full',
                  'flex items-center justify-center',
                  'text-xs font-bold',
                  step.isComplete
                    ? 'bg-wl-success-500 text-white'
                    : step.isActive
                    ? 'bg-wl-info-500 text-white'
                    : 'bg-wl-bg-surface border border-wl-border-default text-wl-text-secondary'
                )}
              >
                {step.isComplete ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <div className={cn('flex-1 min-w-0')}>
                <p
                  className={cn(
                    'text-sm font-semibold',
                    'truncate',
                    step.isActive ? 'text-wl-text-primary' : 'text-wl-text-secondary'
                  )}
                >
                  {step.title}
                </p>
              </div>
            </div>
          </button>

          {/* Step Connector */}
          {index < steps.length - 1 && (
            <div
              className={cn(
                'ml-7 h-2 w-0.5',
                'bg-wl-bg-elevated',
                step.isComplete && 'bg-wl-success-500'
              )}
            />
          )}
        </div>
      ))}
    </nav>
  );
}

export function WizardContent({ children }: WizardContentProps) {
  return (
    <div className={cn('flex-1 flex flex-col', 'overflow-hidden')}>
      {children}
    </div>
  );
}

export function WizardStep({ stepId, title, children }: WizardStepProps) {
  return (
    <div className={cn('flex-1 flex flex-col', 'overflow-y-auto')}>
      <Header title={title} />
      <div
        className={cn(
          'flex-1 overflow-y-auto',
          'px-6 py-5',
          'max-w-4xl mx-auto w-full'
        )}
      >
        {children}
      </div>
    </div>
  );
}
