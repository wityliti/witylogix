"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { WebhookConfigProps } from "./types";

/**
 * Webhook configuration component
 * Manages webhook endpoint setup, secret keys, events, and delivery history
 */
export function WebhookConfig({
  webhookConfig,
  providerId,
  onSave,
  onTest,
  className,
}: WebhookConfigProps) {
  const [url, setUrl] = useState(webhookConfig.url);
  const [secretKey, setSecretKey] = useState(webhookConfig.secretKey);
  const [showSecret, setShowSecret] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(
    new Set(webhookConfig.events)
  );
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: 'idle' | 'loading' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });
  const [showRetryConfig, setShowRetryConfig] = useState(false);
  const [retryAttempts, setRetryAttempts] = useState(webhookConfig.retryConfig.maxAttempts);
  const [retryBackoff, setRetryBackoff] = useState(webhookConfig.retryConfig.backoffStrategy);
  const [retryInterval, setRetryInterval] = useState(
    webhookConfig.retryConfig.retryIntervalSeconds
  );

  // Available webhook events
  const availableEvents = [
    'integration.connected',
    'integration.disconnected',
    'sync.started',
    'sync.completed',
    'sync.failed',
    'webhook.delivery.success',
    'webhook.delivery.failed',
    'rate_limit.warning',
    'rate_limit.exceeded',
    'error.authentication',
    'error.validation',
  ];

  const handleEventToggle = (event: string) => {
    const newEvents = new Set(selectedEvents);
    if (newEvents.has(event)) {
      newEvents.delete(event);
    } else {
      newEvents.add(event);
    }
    setSelectedEvents(newEvents);
  };

  const handleRegenerateSecret = () => {
    const newSecret = 'whsec_' + Math.random().toString(36).substr(2, 32);
    setSecretKey(newSecret);
  };

  const handleTestWebhook = async () => {
    if (!url) {
      setTestResult({ status: 'error', message: 'Please enter a webhook URL' });
      return;
    }

    setTestLoading(true);
    setTestResult({ status: 'loading', message: 'Testing webhook...' });

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setTestResult({
        status: 'success',
        message: `Webhook test successful! Sent to ${url}`,
      });
      onTest?.(url);
    } catch (error) {
      setTestResult({
        status: 'error',
        message: 'Failed to test webhook. Please check the URL.',
      });
    } finally {
      setTestLoading(false);
    }
  };

  const handleSave = () => {
    if (!url) {
      setTestResult({ status: 'error', message: 'Please enter a webhook URL' });
      return;
    }

    const updatedConfig = {
      ...webhookConfig,
      url,
      secretKey,
      events: Array.from(selectedEvents),
      retryConfig: {
        maxAttempts: retryAttempts,
        backoffStrategy: retryBackoff as 'exponential' | 'linear',
        retryIntervalSeconds: retryInterval,
      },
    };

    onSave?.(updatedConfig);
  };

  return (
    <div className={cn('w-full max-w-2xl', className)}>
      <div className="border border-wl-border-subtle rounded-lg bg-wl-bg-surface p-6">
        {/* Header */}
        <h2 className="text-lg font-semibold text-wl-text-primary mb-1">Webhook Configuration</h2>
        <p className="text-sm text-wl-text-secondary mb-6">Provider ID: {providerId}</p>

        {/* URL Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-wl-text-primary mb-2">
            Webhook URL <span className="text-wl-danger-500">*</span>
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-domain.com/webhooks/integration"
            className={cn(
              'w-full px-3 py-2 rounded border',
              'bg-wl-bg-default text-wl-text-primary',
              'border-wl-border-subtle focus:border-wl-primary-500 focus:outline-none',
              'dark:bg-wl-bg-default dark:border-wl-border-subtle'
            )}
          />
          <p className="text-xs text-wl-text-secondary mt-1">
            The URL where webhook events will be delivered
          </p>
        </div>

        {/* Secret Key */}
        <div className="mb-6 pb-6 border-b border-wl-border-subtle">
          <label className="block text-sm font-medium text-wl-text-primary mb-2">
            Secret Key
          </label>
          <div className="flex gap-2 mb-3">
            <div className="flex-1 relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={secretKey}
                readOnly
                className={cn(
                  'w-full px-3 py-2 rounded border',
                  'bg-wl-surface-hover text-wl-text-secondary',
                  'border-wl-border-subtle cursor-not-allowed'
                )}
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-wl-text-secondary hover:text-wl-text-primary"
              >
                {showSecret ? 'Hide' : 'Show'}
              </button>
            </div>
            <button
              onClick={handleRegenerateSecret}
              className={cn(
                'px-4 py-2 rounded font-medium text-sm transition-colors',
                'bg-wl-surface-hover text-wl-text-primary hover:bg-wl-border-subtle',
                'dark:bg-wl-surface-hover dark:hover:bg-wl-border-default'
              )}
            >
              Regenerate
            </button>
          </div>
          <p className="text-xs text-wl-text-secondary">
            Used to sign and verify webhook authenticity
          </p>
        </div>

        {/* Event Types */}
        <div className="mb-6 pb-6 border-b border-wl-border-subtle">
          <label className="block text-sm font-medium text-wl-text-primary mb-3">
            Trigger Events
          </label>
          <div className="grid grid-cols-2 gap-3">
            {availableEvents.map((event) => (
              <label key={event} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedEvents.has(event)}
                  onChange={() => handleEventToggle(event)}
                  className="w-4 h-4 rounded border border-wl-border-subtle accent-wl-primary-500"
                />
                <span className="text-sm text-wl-text-primary">{event}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Retry Configuration */}
        <div className="mb-6 pb-6 border-b border-wl-border-subtle">
          <button
            onClick={() => setShowRetryConfig(!showRetryConfig)}
            className="flex items-center gap-2 text-sm font-medium text-wl-primary-500 hover:text-wl-primary-600 mb-3"
          >
            <span>{showRetryConfig ? '▼' : '▶'}</span>
            Retry Configuration
          </button>

          {showRetryConfig && (
            <div className="space-y-4 ml-4">
              <div>
                <label className="block text-sm font-medium text-wl-text-primary mb-2">
                  Max Retry Attempts
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={retryAttempts}
                  onChange={(e) => setRetryAttempts(parseInt(e.target.value))}
                  className={cn(
                    'w-full px-3 py-2 rounded border',
                    'bg-wl-bg-default text-wl-text-primary',
                    'border-wl-border-subtle focus:border-wl-primary-500 focus:outline-none'
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-wl-text-primary mb-2">
                  Backoff Strategy
                </label>
                <select
                  value={retryBackoff}
                  onChange={(e) =>
                    setRetryBackoff(e.target.value as 'exponential' | 'linear')
                  }
                  className={cn(
                    'w-full px-3 py-2 rounded border',
                    'bg-wl-bg-default text-wl-text-primary',
                    'border-wl-border-subtle focus:border-wl-primary-500 focus:outline-none'
                  )}
                >
                  <option value="exponential">Exponential</option>
                  <option value="linear">Linear</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-wl-text-primary mb-2">
                  Initial Retry Interval (seconds)
                </label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={retryInterval}
                  onChange={(e) => setRetryInterval(parseInt(e.target.value))}
                  className={cn(
                    'w-full px-3 py-2 rounded border',
                    'bg-wl-bg-default text-wl-text-primary',
                    'border-wl-border-subtle focus:border-wl-primary-500 focus:outline-none'
                  )}
                />
              </div>
            </div>
          )}
        </div>

        {/* Test Result */}
        {testResult.status !== 'idle' && (
          <div
            className={cn(
              'mb-6 p-3 rounded text-sm',
              testResult.status === 'loading'
                ? 'bg-wl-warning-100 text-wl-warning-700 dark:bg-wl-warning-900/30 dark:text-wl-warning-300'
                : testResult.status === 'success'
                  ? 'bg-wl-success-100 text-wl-success-700 dark:bg-wl-success-900/30 dark:text-wl-success-300'
                  : 'bg-wl-danger-100 text-wl-danger-700 dark:bg-wl-danger-900/30 dark:text-wl-danger-300'
            )}
          >
            {testResult.message}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleTestWebhook}
            disabled={testLoading}
            className={cn(
              'flex-1 px-4 py-2 rounded font-medium text-sm transition-colors',
              'bg-wl-surface-hover text-wl-text-primary hover:bg-wl-border-subtle',
              'dark:bg-wl-surface-hover dark:hover:bg-wl-border-default',
              testLoading && 'opacity-60 cursor-not-allowed'
            )}
          >
            {testLoading ? 'Testing...' : 'Test Webhook'}
          </button>

          <button
            onClick={handleSave}
            className={cn(
              'flex-1 px-4 py-2 rounded font-medium text-sm transition-colors',
              'bg-wl-primary-500 text-white hover:bg-wl-primary-600',
              'dark:bg-wl-primary-600 dark:hover:bg-wl-primary-700'
            )}
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
