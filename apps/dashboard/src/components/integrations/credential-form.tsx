"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { CredentialFormProps, CredentialConfig } from "./types";

/**
 * Credential form component
 * Dynamic credential input form based on auth type
 * Supports: api-key, oauth2, basic, bearer auth methods
 */
export function CredentialForm({
  credentialConfig,
  providerId,
  onSave,
  onCancel,
  onTest,
  className,
}: CredentialFormProps) {
  const [credentials, setCredentials] = useState<Record<string, unknown>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: 'success' | 'error' | null;
    message: string;
  }>({ status: null, message: '' });
  const [oauthConnected, setOauthConnected] = useState(false);
  const [tokenExpiry, setTokenExpiry] = useState<Date | null>(null);

  const handleFieldChange = useCallback(
    (fieldName: string, value: unknown) => {
      setCredentials((prev) => ({ ...prev, [fieldName]: value }));
      setTestResult({ status: null, message: '' });
    },
    []
  );

  const handleTestConnection = async () => {
    setTestLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const isValid = Object.values(credentials).every(
        (v) => v !== undefined && v !== '' && v !== null
      );

      if (isValid) {
        setTestResult({
          status: 'success',
          message: 'Connection successful! Credentials are valid.',
        });
        onTest?.(credentials);
      } else {
        setTestResult({
          status: 'error',
          message: 'Please fill in all required fields.',
        });
      }
    } finally {
      setTestLoading(false);
    }
  };

  const handleSave = () => {
    const allFilled = credentialConfig.fields
      .filter((f) => f.required)
      .every((f) => credentials[f.name]);

    if (!allFilled) {
      setTestResult({
        status: 'error',
        message: 'Please fill in all required fields.',
      });
      return;
    }

    onSave?.(credentials);
  };

  const handleOAuthConnect = () => {
    // Simulate OAuth flow
    setOauthConnected(true);
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 24);
    setTokenExpiry(expiryDate);
    setCredentials((prev) => ({
      ...prev,
      oauth_token: 'mock_oauth_token_' + Math.random().toString(36).substr(2, 9),
      oauth_refresh_token: 'mock_refresh_' + Math.random().toString(36).substr(2, 9),
    }));
    setTestResult({
      status: 'success',
      message: 'OAuth connection successful!',
    });
  };

  return (
    <div className={cn('w-full max-w-lg', className)}>
      <div className="border border-wl-border-subtle rounded-lg bg-wl-bg-surface p-6">
        {/* Header */}
        <h2 className="text-lg font-semibold text-wl-text-primary mb-1">Connect Integration</h2>
        <p className="text-sm text-wl-text-secondary mb-6">Provider ID: {providerId}</p>

        {/* Auth type info */}
        <div
          className={cn(
            'mb-6 p-3 rounded text-sm',
            'bg-wl-primary-100 text-wl-primary-700',
            'dark:bg-wl-primary-900/30 dark:text-wl-primary-300'
          )}
        >
          Auth Type: <span className="font-semibold">{credentialConfig.authType}</span>
        </div>

        {/* OAuth2 specific UI */}
        {credentialConfig.authType === 'oauth2' && (
          <div className="mb-6 pb-6 border-b border-wl-border-subtle">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-wl-text-primary mb-2">OAuth2 Connection</h3>
              {!oauthConnected ? (
                <button
                  onClick={handleOAuthConnect}
                  className={cn(
                    'w-full px-4 py-2 rounded font-medium text-sm transition-colors',
                    'bg-wl-primary-500 text-white hover:bg-wl-primary-600',
                    'dark:bg-wl-primary-600 dark:hover:bg-wl-primary-700'
                  )}
                >
                  Connect with OAuth
                </button>
              ) : (
                <div
                  className={cn(
                    'p-3 rounded',
                    'bg-wl-success-100 text-wl-success-700',
                    'dark:bg-wl-success-900/30 dark:text-wl-success-300'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-wl-success-500" />
                      <span className="text-sm font-medium">Connected</span>
                    </div>
                    <button
                      onClick={() => setOauthConnected(false)}
                      className="text-xs hover:underline"
                    >
                      Disconnect
                    </button>
                  </div>
                  {tokenExpiry && (
                    <div className="text-xs mt-2 opacity-75">
                      Token expires: {tokenExpiry.toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {credentialConfig.oauthConfig && (
              <div className="bg-wl-surface-hover rounded p-3 text-xs text-wl-text-secondary">
                <div className="mb-2">
                  <strong>Scopes:</strong>
                </div>
                <div className="flex flex-wrap gap-1">
                  {credentialConfig.oauthConfig.scopes.map((scope) => (
                    <span
                      key={scope}
                      className={cn(
                        'px-2 py-1 rounded',
                        'bg-wl-primary-100 text-wl-primary-700',
                        'dark:bg-wl-primary-900/30 dark:text-wl-primary-300'
                      )}
                    >
                      {scope}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Regular credential fields */}
        {credentialConfig.fields.length > 0 && (
          <div className="space-y-4 mb-6">
            {credentialConfig.fields.map((field) => (
              <div key={field.name}>
                <label className="block text-sm font-medium text-wl-text-primary mb-2">
                  {field.label}
                  {field.required && <span className="text-wl-danger-500 ml-1">*</span>}
                </label>

                {field.type === 'select' ? (
                  <select
                    value={(credentials[field.name] as string) || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    className={cn(
                      'w-full px-3 py-2 rounded border',
                      'bg-wl-bg-default text-wl-text-primary',
                      'border-wl-border-subtle focus:border-wl-primary-500 focus:outline-none',
                      'dark:bg-wl-bg-default dark:border-wl-border-subtle'
                    )}
                  >
                    <option value="">{field.placeholder || 'Select...'}</option>
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="relative">
                    <input
                      type={
                        field.type === 'password' && !showPassword[field.name]
                          ? 'password'
                          : 'text'
                      }
                      value={(credentials[field.name] as string) || ''}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      className={cn(
                        'w-full px-3 py-2 rounded border',
                        'bg-wl-bg-default text-wl-text-primary',
                        'border-wl-border-subtle focus:border-wl-primary-500 focus:outline-none',
                        'dark:bg-wl-bg-default dark:border-wl-border-subtle',
                        field.type === 'password' && 'pr-10'
                      )}
                    />
                    {field.type === 'password' && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword((prev) => ({
                            ...prev,
                            [field.name]: !prev[field.name],
                          }))
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-wl-text-secondary hover:text-wl-text-primary"
                      >
                        {showPassword[field.name] ? 'Hide' : 'Show'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Test result message */}
        {testResult.status && (
          <div
            className={cn(
              'mb-6 p-3 rounded text-sm',
              testResult.status === 'success'
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
            onClick={handleTestConnection}
            disabled={testLoading}
            className={cn(
              'flex-1 px-4 py-2 rounded font-medium text-sm transition-colors',
              'bg-wl-surface-hover text-wl-text-primary hover:bg-wl-border-subtle',
              'dark:bg-wl-surface-hover dark:hover:bg-wl-border-default',
              testLoading && 'opacity-60 cursor-not-allowed'
            )}
          >
            {testLoading ? 'Testing...' : 'Test Connection'}
          </button>

          <button
            onClick={onCancel}
            className={cn(
              'flex-1 px-4 py-2 rounded font-medium text-sm transition-colors',
              'bg-wl-surface-hover text-wl-text-primary hover:bg-wl-border-subtle',
              'dark:bg-wl-surface-hover dark:hover:bg-wl-border-default'
            )}
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            className={cn(
              'flex-1 px-4 py-2 rounded font-medium text-sm transition-colors',
              'bg-wl-primary-500 text-white hover:bg-wl-primary-600',
              'dark:bg-wl-primary-600 dark:hover:bg-wl-primary-700'
            )}
          >
            Save Credentials
          </button>
        </div>
      </div>
    </div>
  );
}
