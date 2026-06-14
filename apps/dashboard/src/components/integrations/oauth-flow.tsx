"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * OAuth Flow component
 * Visual OAuth2 authorization flow component with step tracking
 * Features: step indicators, provider branding, token status, refresh/disconnect actions
 */

export type OAuthProvider = 'shopify' | 'stripe' | 'slack' | 'google' | 'github' | 'microsoft';

export type OAuthStep = 'configure' | 'authorize' | 'callback' | 'connected';

export type TokenStatus = 'valid' | 'expiring' | 'expired';

export interface OAuthFlowProps {
  provider: OAuthProvider;
  currentStep: OAuthStep;
  tokenStatus?: TokenStatus;
  expiresAt?: Date;
  onAuthorize?: () => void;
  onRefreshToken?: () => void;
  onDisconnect?: () => void;
  className?: string;
}

const PROVIDER_CONFIG: Record<OAuthProvider, { icon: string; color: string; displayName: string }> = {
  shopify: { icon: '🛍️', color: '#96bf48', displayName: 'Shopify' },
  stripe: { icon: '💳', color: '#635bff', displayName: 'Stripe' },
  slack: { icon: '💬', color: '#36c5f0', displayName: 'Slack' },
  google: { icon: '🔵', color: '#4285f4', displayName: 'Google' },
  github: { icon: '🐙', color: '#333333', displayName: 'GitHub' },
  microsoft: { icon: '⊞', color: '#00a4ef', displayName: 'Microsoft' },
};

export function OAuthFlow({
  provider,
  currentStep,
  tokenStatus,
  expiresAt,
  onAuthorize,
  onRefreshToken,
  onDisconnect,
  className,
}: OAuthFlowProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const config = PROVIDER_CONFIG[provider];

  const steps: OAuthStep[] = ['configure', 'authorize', 'callback', 'connected'];
  const stepLabels: Record<OAuthStep, string> = {
    configure: 'Configure',
    authorize: 'Authorize',
    callback: 'Callback',
    connected: 'Connected',
  };

  const getStepStatus = (step: OAuthStep): 'completed' | 'active' | 'pending' => {
    const currentIndex = steps.indexOf(currentStep);
    const stepIndex = steps.indexOf(step);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  const getStepColor = (status: 'completed' | 'active' | 'pending'): string => {
    switch (status) {
      case 'completed':
        return 'var(--wl-success-500)';
      case 'active':
        return 'var(--wl-primary-500)';
      case 'pending':
        return 'var(--wl-border-subtle)';
    }
  };

  const getTokenStatusColor = (): string => {
    switch (tokenStatus) {
      case 'valid':
        return 'var(--wl-success-500)';
      case 'expiring':
        return 'var(--wl-warning-500)';
      case 'expired':
        return 'var(--wl-danger-500)';
      default:
        return 'var(--wl-border-subtle)';
    }
  };

  const getTokenStatusLabel = (): string => {
    switch (tokenStatus) {
      case 'valid':
        return 'Token Valid';
      case 'expiring':
        return 'Token Expiring Soon';
      case 'expired':
        return 'Token Expired';
      default:
        return 'Unknown';
    }
  };

  const handleAuthorize = async () => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      onAuthorize?.();
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshToken = async () => {
    setIsLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      onRefreshToken?.();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    if (!confirmDisconnect) {
      setConfirmDisconnect(true);
      return;
    }
    setConfirmDisconnect(false);
    onDisconnect?.();
  };

  const timeUntilExpiry = expiresAt ? Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div
      className={cn(
        'border border-wl-border-subtle rounded-lg bg-wl-bg-surface p-6 transition-all duration-200',
        className
      )}
    >
      {/* Provider Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="text-4xl">{config.icon}</div>
          <div>
            <h3 className="text-lg font-semibold text-wl-text-primary">{config.displayName} OAuth</h3>
            <p className="text-sm text-wl-text-secondary">OAuth2 Authorization Flow</p>
          </div>
        </div>
        <div className="text-right">
          {currentStep === 'connected' && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-wl-success-100 dark:bg-wl-success-900/30">
              <div className="w-2 h-2 rounded-full bg-wl-success-500 animate-pulse" />
              <span className="text-xs font-medium text-wl-success-700 dark:text-wl-success-300">
                Connected
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => {
            const status = getStepStatus(step);
            const color = getStepColor(status);

            return (
              <div key={step} className="flex-1 flex items-center">
                {/* Circle */}
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all duration-200 flex-shrink-0',
                    status === 'completed' && 'bg-wl-success-100 dark:bg-wl-success-900/30',
                    status === 'active' && 'bg-wl-primary-100 dark:bg-wl-primary-900/30 ring-2 ring-wl-primary-500/20',
                    status === 'pending' && 'bg-wl-surface-hover'
                  )}
                  style={{
                    color: color,
                  }}
                >
                  {status === 'completed' ? '✓' : index + 1}
                </div>

                {/* Connecting Line */}
                {index < steps.length - 1 && (
                  <div
                    className="flex-1 h-1 mx-2 rounded-full transition-all duration-200"
                    style={{
                      backgroundColor: status === 'completed' ? 'var(--wl-success-500)' : 'var(--wl-border-subtle)',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs text-wl-text-secondary">
          {steps.map((step) => (
            <span key={step} className="flex-1 text-center">
              {stepLabels[step]}
            </span>
          ))}
        </div>
      </div>

      {/* Token Status Display */}
      {currentStep === 'connected' && tokenStatus && (
        <div
          className={cn(
            'mb-6 p-4 rounded-lg border',
            tokenStatus === 'valid' && 'border-wl-success-500/20 bg-wl-success-500/5',
            tokenStatus === 'expiring' && 'border-wl-warning-500/20 bg-wl-warning-500/5',
            tokenStatus === 'expired' && 'border-wl-danger-500/20 bg-wl-danger-500/5'
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: getTokenStatusColor() }}
            />
            <div className="flex-1">
              <div className="font-semibold text-sm" style={{ color: getTokenStatusColor() }}>
                {getTokenStatusLabel()}
              </div>
              {expiresAt && (
                <div className="text-xs text-wl-text-secondary mt-1">
                  Expires in {timeUntilExpiry} days ({expiresAt.toLocaleDateString()})
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Details */}
      <div className="mb-6 p-4 bg-wl-surface-hover rounded-lg border border-wl-border-subtle">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-wl-text-secondary mb-1">Authorization Status</div>
            <div className="text-sm font-medium text-wl-text-primary">
              {currentStep === 'connected' ? 'Authorized' : 'Pending'}
            </div>
          </div>
          <div>
            <div className="text-xs text-wl-text-secondary mb-1">Last Updated</div>
            <div className="text-sm font-medium text-wl-text-primary">
              {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      {/* Scopes Info */}
      <div className="mb-6">
        <div className="text-sm font-semibold text-wl-text-primary mb-3">Requested Scopes</div>
        <div className="grid grid-cols-2 gap-2">
          {['user:read', 'organization:read', 'account:read', 'webhooks:write'].map((scope) => (
            <div key={scope} className="flex items-center gap-2 text-sm text-wl-text-secondary">
              <div className="w-1.5 h-1.5 rounded-full bg-wl-primary-500" />
              {scope}
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {currentStep !== 'connected' && (
          <button
            onClick={handleAuthorize}
            disabled={isLoading}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors',
              'bg-wl-primary-500 text-white hover:bg-wl-primary-600 disabled:opacity-60 disabled:cursor-not-allowed'
            )}
          >
            {isLoading ? 'Authorizing...' : 'Authorize'}
          </button>
        )}

        {currentStep === 'connected' && (
          <>
            <button
              onClick={handleRefreshToken}
              disabled={isLoading || tokenStatus === 'valid'}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors',
                'bg-wl-primary-100 text-wl-primary-700 hover:bg-wl-primary-200',
                'dark:bg-wl-primary-900/30 dark:text-wl-primary-300 dark:hover:bg-wl-primary-900/50',
                'disabled:opacity-60 disabled:cursor-not-allowed'
              )}
            >
              {isLoading ? 'Refreshing...' : 'Refresh Token'}
            </button>

            {confirmDisconnect ? (
              <div className="flex-1 flex gap-2">
                <button
                  onClick={() => setConfirmDisconnect(false)}
                  className={cn(
                    'flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors',
                    'bg-wl-surface-hover text-wl-text-primary hover:bg-wl-border-subtle'
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDisconnect}
                  className={cn(
                    'flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors',
                    'bg-wl-danger-100 text-wl-danger-700 hover:bg-wl-danger-200',
                    'dark:bg-wl-danger-900/30 dark:text-wl-danger-300 dark:hover:bg-wl-danger-900/50'
                  )}
                >
                  Confirm Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={handleDisconnect}
                className={cn(
                  'flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors',
                  'bg-wl-danger-100 text-wl-danger-700 hover:bg-wl-danger-200',
                  'dark:bg-wl-danger-900/30 dark:text-wl-danger-300 dark:hover:bg-wl-danger-900/50'
                )}
              >
                Disconnect
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
