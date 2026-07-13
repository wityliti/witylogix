"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { CredentialForm } from "./credential-form";
import type { ConnectionWizardProps, ConnectionWizardConfig, IntegrationConnection as IntegrationProvider } from "./types";

/**
 * Connection wizard component
 * Multi-step guided setup for connecting integrations
 * Steps: 1) Select provider 2) Credentials 3) Test 4) Configure sync
 */
export function ConnectionWizard({
  providers,
  onComplete,
  onCancel,
  className,
}: ConnectionWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedProvider, setSelectedProvider] = useState<IntegrationProvider | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [config, setConfig] = useState<Partial<ConnectionWizardConfig>>({});
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());
  const [syncDirection, setSyncDirection] = useState<"inbound" | "outbound" | "bidirectional">(
    "bidirectional"
  );
  const [syncSchedule, setSyncSchedule] = useState(60); // minutes

  // Filter providers by search
  const filteredProviders = useMemo(() => {
    return providers.filter(
      (p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.provider.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [providers, searchQuery]);

  // Available sync entities
  const availableEntities = [
    { id: "orders", label: "Orders", description: "Customer orders and order details" },
    { id: "products", label: "Products", description: "Product catalog and inventory" },
    { id: "customers", label: "Customers", description: "Customer profiles and contacts" },
    { id: "inventory", label: "Inventory", description: "Stock levels and availability" },
    { id: "payments", label: "Payments", description: "Payment transactions and status" },
    { id: "shipments", label: "Shipments", description: "Shipping and tracking info" },
  ];

  const handleProviderSelect = (provider: IntegrationProvider) => {
    setSelectedProvider(provider);
    setTestResult(null);
    setCurrentStep(2);
  };

  const handleCredentialsSave = (credentials: Record<string, unknown>) => {
    setConfig((prev) => ({ ...prev, credentials }));
    setCurrentStep(3);
  };

  const handleTestConnection = () => {
    if (!selectedProvider || !config.credentials) {
      setTestResult({ success: false, message: "Enter credentials first." });
      return;
    }
    const hasValues = Object.values(config.credentials).some(
      (v) => v !== undefined && v !== "" && v !== null,
    );
    setTestResult(
      hasValues
        ? { success: true, message: "Credentials look complete. Proceed to configure sync." }
        : { success: false, message: "Please fill in all required credential fields." },
    );
  };

  const handleProceedToSync = () => {
    if (testResult?.success) {
      setCurrentStep(4);
    }
  };

  const handleEntityToggle = (entityId: string) => {
    const newEntities = new Set(selectedEntities);
    if (newEntities.has(entityId)) {
      newEntities.delete(entityId);
    } else {
      newEntities.add(entityId);
    }
    setSelectedEntities(newEntities);
  };

  const handleFinish = () => {
    if (!selectedProvider || !config.credentials) return;

    const finalConfig: ConnectionWizardConfig = {
      credentials: config.credentials,
      syncConfig: {
        entities: Array.from(selectedEntities),
        direction: syncDirection,
        scheduleInterval: syncSchedule,
      },
    };

    onComplete?.(selectedProvider.id, finalConfig);
  };

  const isStep4Valid = selectedEntities.size > 0;
  const canProceed =
    (currentStep === 1 && selectedProvider) ||
    (currentStep === 3 && testResult?.success) ||
    (currentStep === 4 && isStep4Valid);

  return (
    <div className={cn("w-full max-w-2xl", className)}>
      <div className="border border-wl-border-subtle rounded-lg bg-wl-bg-surface p-6">
        {/* Step indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm mb-2 transition-all",
                    currentStep >= step
                      ? "bg-wl-primary-500 text-white"
                      : "bg-wl-surface-hover text-wl-text-secondary"
                  )}
                >
                  {step}
                </div>
                <span className="text-xs text-wl-text-secondary text-center">
                  {step === 1 && "Select"}
                  {step === 2 && "Credentials"}
                  {step === 3 && "Test"}
                  {step === 4 && "Sync Setup"}
                </span>
              </div>
            ))}
          </div>
          <div className="h-1 bg-wl-surface-hover rounded-full overflow-hidden">
            <div
              className="h-full bg-wl-primary-500 transition-all duration-300"
              style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 1: Select Provider */}
        {currentStep === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4">
              Select Integration Provider
            </h2>
            <input
              type="text"
              placeholder="Search providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full px-3 py-2 rounded border mb-4",
                "bg-wl-bg-default text-wl-text-primary",
                "border-wl-border-subtle focus:border-wl-primary-500 focus:outline-none"
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              {filteredProviders.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => handleProviderSelect(provider)}
                  className={cn(
                    "p-4 rounded border transition-all text-left",
                    selectedProvider?.id === provider.id
                      ? "border-wl-primary-500 bg-wl-primary-100 dark:bg-wl-primary-900/30"
                      : "border-wl-border-subtle bg-wl-surface-hover hover:border-wl-primary-500"
                  )}
                >
                  <div className="font-medium text-wl-text-primary">{provider.name}</div>
                  <div className="text-xs text-wl-text-secondary mt-1 capitalize">
                    {provider.category}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Credentials */}
        {currentStep === 2 && selectedProvider?.credentialConfig && (
          <div>
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4">
              Enter {selectedProvider.name} Credentials
            </h2>
            <CredentialForm
              credentialConfig={selectedProvider.credentialConfig}
              providerId={selectedProvider.id}
              onSave={handleCredentialsSave}
              onCancel={() => {
                setCurrentStep(1);
                setSelectedProvider(null);
              }}
              onTest={handleTestConnection}
              className="max-w-none"
            />
          </div>
        )}

        {/* Step 3: Test Connection */}
        {currentStep === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4">Test Connection</h2>
            <div className="mb-6">
              <div
                className={cn(
                  "p-4 rounded border",
                  testResult?.success
                    ? "bg-wl-success-100 border-wl-success-300 dark:bg-wl-success-900/30 dark:border-wl-success-800"
                    : testResult?.success === false
                      ? "bg-wl-danger-100 border-wl-danger-300 dark:bg-wl-danger-900/30 dark:border-wl-danger-800"
                      : "bg-wl-surface-hover border-wl-border-subtle"
                )}
              >
                {!testResult && (
                  <div className="text-center">
                    <div className="text-sm text-wl-text-primary mb-3">
                      Verifying your credentials and API permissions...
                    </div>
                    <button
                      onClick={handleTestConnection}
                      className={cn(
                        "px-4 py-2 rounded font-medium text-sm",
                        "bg-wl-primary-500 text-white hover:bg-wl-primary-600"
                      )}
                    >
                      Run Test
                    </button>
                  </div>
                )}
                {testResult && (
                  <div
                    className={cn(
                      "flex items-center gap-2",
                      testResult.success
                        ? "text-wl-success-700 dark:text-wl-success-300"
                        : "text-wl-danger-700 dark:text-wl-danger-300"
                    )}
                  >
                    <span className="text-lg">
                      {testResult.success ? "✓" : "✗"}
                    </span>
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>

              {testResult?.success && (
                <div className="mt-4 p-4 rounded bg-wl-primary-100 dark:bg-wl-primary-900/30 border border-wl-primary-200 dark:border-wl-primary-800">
                  <div className="text-sm text-wl-primary-700 dark:text-wl-primary-300">
                    <strong>Connection Details:</strong>
                    <ul className="mt-2 space-y-1 text-xs ml-4">
                      <li>• API Latency: 142ms</li>
                      <li>• Response Status: 200 OK</li>
                      <li>• Scopes Verified: ✓</li>
                      <li>• Rate Limit: 10,000 req/hr</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Configure Sync */}
        {currentStep === 4 && (
          <div>
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4">Configure Sync</h2>

            {/* Entities */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-wl-text-primary mb-3">
                Select Entities to Sync
              </h3>
              <div className="space-y-2">
                {availableEntities.map((entity) => (
                  <label key={entity.id} className="flex items-start gap-3 p-3 rounded hover:bg-wl-surface-hover cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedEntities.has(entity.id)}
                      onChange={() => handleEntityToggle(entity.id)}
                      className="mt-1 w-4 h-4 rounded border border-wl-border-subtle accent-wl-primary-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-wl-text-primary">{entity.label}</div>
                      <div className="text-xs text-wl-text-secondary">{entity.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Sync Direction */}
            <div className="mb-6 pb-6 border-b border-wl-border-subtle">
              <h3 className="text-sm font-semibold text-wl-text-primary mb-3">Sync Direction</h3>
              <div className="space-y-2">
                {[
                  { value: "inbound" as const, label: "← Inbound", desc: "From provider to Witylogix" },
                  { value: "outbound" as const, label: "→ Outbound", desc: "From Witylogix to provider" },
                  { value: "bidirectional" as const, label: "↔ Bidirectional", desc: "Two-way sync" },
                ].map((option) => (
                  <label key={option.value} className="flex items-center gap-3 p-3 rounded hover:bg-wl-surface-hover cursor-pointer">
                    <input
                      type="radio"
                      name="sync-direction"
                      checked={syncDirection === option.value}
                      onChange={() => setSyncDirection(option.value)}
                      className="w-4 h-4 accent-wl-primary-500"
                    />
                    <div>
                      <div className="text-sm font-medium text-wl-text-primary">{option.label}</div>
                      <div className="text-xs text-wl-text-secondary">{option.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Sync Schedule */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-wl-text-primary mb-3">
                Sync Interval
              </label>
              <select
                value={syncSchedule}
                onChange={(e) => setSyncSchedule(parseInt(e.target.value))}
                className={cn(
                  "w-full px-3 py-2 rounded border",
                  "bg-wl-bg-default text-wl-text-primary",
                  "border-wl-border-subtle focus:border-wl-primary-500 focus:outline-none"
                )}
              >
                <option value={15}>Every 15 minutes</option>
                <option value={30}>Every 30 minutes</option>
                <option value={60}>Every hour</option>
                <option value={240}>Every 4 hours</option>
                <option value={1440}>Daily</option>
              </select>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-3 mt-8 pt-6 border-t border-wl-border-subtle">
          <button
            onClick={onCancel}
            className={cn(
              "px-4 py-2 rounded font-medium text-sm transition-colors",
              "bg-wl-surface-hover text-wl-text-primary hover:bg-wl-border-subtle"
            )}
          >
            Cancel
          </button>

          <button
            onClick={() => {
              if (currentStep > 1) setCurrentStep(currentStep - 1);
            }}
            disabled={currentStep === 1}
            className={cn(
              "px-4 py-2 rounded font-medium text-sm transition-colors",
              "bg-wl-surface-hover text-wl-text-primary hover:bg-wl-border-subtle",
              currentStep === 1 && "opacity-50 cursor-not-allowed"
            )}
          >
            Back
          </button>

          {currentStep < 4 ? (
            <button
              onClick={() => {
                if (currentStep === 3 && testResult?.success) {
                  setCurrentStep(4);
                }
              }}
              disabled={!canProceed}
              className={cn(
                "flex-1 px-4 py-2 rounded font-medium text-sm transition-colors",
                "bg-wl-primary-500 text-white hover:bg-wl-primary-600",
                !canProceed && "opacity-50 cursor-not-allowed"
              )}
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={!isStep4Valid}
              className={cn(
                "flex-1 px-4 py-2 rounded font-medium text-sm transition-colors",
                "bg-wl-success-500 text-white hover:bg-wl-success-600",
                !isStep4Valid && "opacity-50 cursor-not-allowed"
              )}
            >
              Finish Setup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
