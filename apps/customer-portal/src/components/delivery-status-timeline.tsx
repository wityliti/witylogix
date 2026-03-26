'use client';

import { useState } from 'react';
import { ChevronDown, CheckCircle2, Clock, MapPin, Package, Truck, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DeliveryStepDetail } from '@/types';

interface DeliveryStatusTimelineProps {
  steps: DeliveryStepDetail[];
}

const stepMetadata = {
  ordered: { label: 'Ordered', icon: Package, color: 'text-wl-text-secondary' },
  confirmed: { label: 'Confirmed', icon: CheckCircle2, color: 'text-wl-info-500' },
  dispatched: { label: 'Dispatched', icon: Truck, color: 'text-wl-primary-500' },
  'out-for-delivery': { label: 'Out for Delivery', icon: Truck, color: 'text-wl-warning-500' },
  nearby: { label: 'Nearby', icon: MapPin, color: 'text-wl-success-500' },
  delivered: { label: 'Delivered', icon: Home, color: 'text-wl-success-500' },
};

/**
 * Vertical delivery status timeline with expandable details
 */
export function DeliveryStatusTimeline({ steps }: DeliveryStatusTimelineProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  if (steps.length === 0) {
    return (
      <div className={cn(
        'rounded-lg border border-wl-border-subtle',
        'bg-wl-bg-surface p-6 text-center'
      )}>
        <p className="text-sm text-wl-text-secondary">No delivery steps yet</p>
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-lg border border-wl-border-subtle',
      'bg-wl-bg-surface overflow-hidden'
    )}>
      <div className="divide-y divide-wl-border-subtle">
        {steps.map((step, index) => {
          const metadata = stepMetadata[step.step as keyof typeof stepMetadata];
          if (!metadata) return null;

          const Icon = metadata.icon;
          const isCompleted = step.status === 'completed';
          const isCurrent = step.status === 'current';
          const isPending = step.status === 'pending';
          const isExpandable = !!step.expandedInfo;
          const isExpanded = expandedStep === step.step;

          return (
            <div key={step.step}>
              {/* Step Header */}
              <button
                onClick={() => {
                  if (isExpandable) {
                    setExpandedStep(isExpanded ? null : step.step);
                  }
                }}
                disabled={!isExpandable}
                className={cn(
                  'w-full px-6 py-4 flex items-center gap-4',
                  'transition-colors',
                  isExpandable && 'hover:bg-wl-bg-elevated cursor-pointer',
                  !isExpandable && 'cursor-default'
                )}
              >
                {/* Timeline Indicator */}
                <div className="relative flex flex-col items-center">
                  {/* Circle */}
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    'transition-all duration-300',
                    isCompleted && 'bg-wl-success-500 scale-100',
                    isCurrent && 'bg-wl-primary-500 scale-110 shadow-lg',
                    isPending && 'bg-wl-neutral-700'
                  )}>
                    <Icon className={cn(
                      'w-5 h-5',
                      (isCompleted || isCurrent) && 'text-white',
                      isPending && 'text-wl-text-tertiary'
                    )} />
                  </div>

                  {/* Connector Line (not on last step) */}
                  {index < steps.length - 1 && (
                    <div className={cn(
                      'w-1 h-8 mt-2',
                      steps[index + 1].status === 'pending' ? 'bg-wl-neutral-700' : 'bg-wl-success-500'
                    )} />
                  )}
                </div>

                {/* Step Content */}
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <h3 className={cn(
                      'font-semibold',
                      isCurrent ? 'text-wl-text-primary text-lg' : 'text-wl-text-primary'
                    )}>
                      {metadata.label}
                    </h3>
                    {isCurrent && (
                      <span className="text-xs px-2 py-1 rounded-full bg-wl-primary-500 text-white font-medium">
                        Current
                      </span>
                    )}
                  </div>

                  {step.timestamp && (
                    <p className="text-sm text-wl-text-secondary mt-1">
                      {formatTimestamp(step.timestamp)}
                    </p>
                  )}

                  {step.details && (
                    <p className="text-sm text-wl-text-tertiary mt-1">
                      {step.details}
                    </p>
                  )}
                </div>

                {/* Expand Indicator */}
                {isExpandable && (
                  <ChevronDown className={cn(
                    'w-5 h-5 text-wl-text-tertiary transition-transform',
                    isExpanded && 'rotate-180'
                  )} />
                )}
              </button>

              {/* Expanded Details */}
              {isExpandable && isExpanded && (
                <div className={cn(
                  'px-6 py-4 border-t border-wl-border-subtle',
                  'bg-wl-bg-elevated space-y-3'
                )}>
                  {step.expandedInfo?.driverAssigned && (
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-wl-text-secondary" />
                      <div>
                        <p className="text-xs text-wl-text-secondary">Driver Assigned</p>
                        <p className="text-sm font-medium text-wl-text-primary">
                          {step.expandedInfo.driverAssigned}
                        </p>
                      </div>
                    </div>
                  )}

                  {step.expandedInfo?.estimatedTime && (
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-wl-text-secondary" />
                      <div>
                        <p className="text-xs text-wl-text-secondary">Estimated Arrival</p>
                        <p className="text-sm font-medium text-wl-text-primary">
                          {formatTimestamp(step.expandedInfo.estimatedTime)}
                        </p>
                      </div>
                    </div>
                  )}

                  {step.expandedInfo?.proofOfDelivery && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-wl-text-secondary">Proof of Delivery</p>
                      <div className="space-y-2">
                        {step.expandedInfo.proofOfDelivery.photo && (
                          <div className="rounded-md overflow-hidden bg-wl-bg-surface">
                            <img
                              src={step.expandedInfo.proofOfDelivery.photo}
                              alt="Proof of delivery"
                              className="w-full h-24 object-cover"
                            />
                          </div>
                        )}
                        {step.expandedInfo.proofOfDelivery.signature && (
                          <div className="text-xs text-wl-text-secondary">
                            ✓ Signed by recipient
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
