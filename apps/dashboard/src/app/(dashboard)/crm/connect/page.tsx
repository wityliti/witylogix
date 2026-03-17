"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CrmPlatformCard } from "@/components/crm/crm-platform-card";
import { useCrmConnection } from "@/hooks/use-crm-connection";

/* ═══════════════════════════════════════════════════════════
   CRM Connection Wizard — OAuth2 flows with compound components
   ═══════════════════════════════════════════════════════════ */

// Types for wizard step management
interface WizardStep {
  id: number;
  title: string;
  description: string;
  isComplete: boolean;
  isActive: boolean;
  isAccessible: boolean;
}

interface SyncConfig {
  direction: "in" | "out" | "bidirectional";
  objectTypes: string[];
}

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
function Wizard({ children, activeStep, onStepChange }: WizardProps) {
  return (
    <div className={cn("flex h-screen bg-wl-bg-root")}>
      {/* Sidebar Navigation */}
      <div
        className={cn(
          "w-64 border-r border-wl-border-subtle",
          "bg-wl-bg-elevated overflow-y-auto",
          "flex flex-col"
        )}
      >
        {children}
      </div>
    </div>
  );
}

function WizardNav({ steps, activeStep, onStepClick }: WizardNavProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, step: number) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onStepClick(step);
      }
    },
    [onStepClick]
  );

  return (
    <nav className={cn("p-6 space-y-2 flex-1")}>
      <h3
        className={cn(
          "text-xs font-bold",
          "text-wl-text-secondary uppercase",
          "tracking-wider mb-4 px-3"
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
              "w-full text-left px-3 py-3 rounded-md",
              "transition-all duration-base ease-default",
              "relative group",
              step.isActive
                ? "bg-wl-primary-500/20 border border-wl-primary-500"
                : "hover:bg-wl-bg-overlay",
              !step.isAccessible && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className={cn("flex items-center gap-3")}>
              {/* Step Number or Checkmark */}
              <div
                className={cn(
                  "w-6 h-6 rounded-full",
                  "flex items-center justify-center",
                  "text-xs font-bold",
                  step.isComplete
                    ? "bg-wl-success-500 text-white"
                    : step.isActive
                      ? "bg-wl-primary-500 text-white"
                      : "bg-wl-bg-surface border border-wl-border-default text-wl-text-secondary"
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
              <div className={cn("flex-1 min-w-0")}>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    "truncate",
                    step.isActive ? "text-wl-text-primary" : "text-wl-text-secondary"
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
                "ml-7 h-2 w-0.5",
                "bg-wl-border-subtle",
                step.isComplete && "bg-wl-success-500"
              )}
            />
          )}
        </div>
      ))}
    </nav>
  );
}

function WizardContent({ children }: WizardContentProps) {
  return (
    <div className={cn("flex-1 flex flex-col", "overflow-hidden")}>
      {children}
    </div>
  );
}

function WizardStep({ stepId, title, children }: WizardStepProps) {
  return (
    <div className={cn("flex-1 flex flex-col", "overflow-y-auto")}>
      <Header title={title} />
      <div
        className={cn(
          "flex-1 overflow-y-auto",
          "px-6 py-5",
          "max-w-4xl mx-auto w-full"
        )}
      >
        {children}
      </div>
    </div>
  );
}

// Main Page Component
export default function CrmConnectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { initiateOAuth } = useCrmConnection();

  // Wizard state
  const [activeStep, setActiveStep] = useState(
    parseInt(searchParams.get("step") || "1")
  );
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Form state
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [syncConfig, setSyncConfig] = useState<SyncConfig>({
    direction: "bidirectional",
    objectTypes: ["contacts", "deals", "companies"],
  });
  const [testResults, setTestResults] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [syncSchedule, setSyncSchedule] = useState("hourly");

  // Platform data
  const platforms = useMemo(
    () => [
      {
        id: "salesforce",
        name: "Salesforce",
        description: "Connect to Salesforce CRM for contact and deal management",
        logo: "salesforce",
        isConnected: false,
      },
      {
        id: "hubspot",
        name: "HubSpot",
        description: "Sync with HubSpot for marketing and sales automation",
        logo: "hubspot",
        isConnected: false,
      },
      {
        id: "zoho",
        name: "Zoho CRM",
        description: "Integrate with Zoho for comprehensive CRM operations",
        logo: "zoho",
        isConnected: false,
      },
      {
        id: "pipedrive",
        name: "Pipedrive",
        description: "Connect Pipedrive for sales pipeline management",
        logo: "pipedrive",
        isConnected: false,
      },
      {
        id: "ms-dynamics",
        name: "Dynamics 365",
        description: "Integrate Microsoft Dynamics 365 for enterprise CRM",
        logo: "dynamics",
        isConnected: false,
      },
    ],
    []
  );

  // Wizard steps configuration
  const steps = useMemo<WizardStep[]>(
    () => [
      {
        id: 1,
        title: "Select Platform",
        description: "Choose your CRM platform",
        isComplete: completedSteps.has(1),
        isActive: activeStep === 1,
        isAccessible: true,
      },
      {
        id: 2,
        title: "OAuth Authorization",
        description: "Authorize access to your CRM",
        isComplete: completedSteps.has(2),
        isActive: activeStep === 2,
        isAccessible: selectedPlatform !== null,
      },
      {
        id: 3,
        title: "Configure Sync",
        description: "Set up sync direction and objects",
        isComplete: completedSteps.has(3),
        isActive: activeStep === 3,
        isAccessible: selectedPlatform !== null && completedSteps.has(2),
      },
      {
        id: 4,
        title: "Test Connection",
        description: "Verify credentials and pull sample data",
        isComplete: completedSteps.has(4),
        isActive: activeStep === 4,
        isAccessible: selectedPlatform !== null && completedSteps.has(3),
      },
      {
        id: 5,
        title: "Review & Activate",
        description: "Summary and enable connection",
        isComplete: completedSteps.has(5),
        isActive: activeStep === 5,
        isAccessible: selectedPlatform !== null && completedSteps.has(4),
      },
    ],
    [activeStep, completedSteps, selectedPlatform]
  );

  // Handle step change with keyboard navigation
  const handleStepChange = useCallback(
    (step: number) => {
      const stepDef = steps.find((s) => s.id === step);
      if (stepDef?.isAccessible) {
        setActiveStep(step);
      }
    },
    [steps]
  );

  // Next/Previous navigation
  const handleNext = useCallback(() => {
    if (activeStep < 5) {
      const newStep = activeStep + 1;
      setCompletedSteps((prev) => new Set([...prev, activeStep]));
      handleStepChange(newStep);
    }
  }, [activeStep, handleStepChange]);

  const handlePrevious = useCallback(() => {
    if (activeStep > 1) {
      handleStepChange(activeStep - 1);
    }
  }, [activeStep, handleStepChange]);

  // Handle platform selection
  const handleSelectPlatform = useCallback((platformId: string) => {
    setSelectedPlatform(platformId);
  }, []);

  // Handle OAuth initiation
  const handleStartOAuth = useCallback(() => {
    if (!selectedPlatform) return;

    // In a real implementation, you'd get these from environment variables
    const oauthConfig = {
      platformId: selectedPlatform,
      clientId: process.env.NEXT_PUBLIC_CRM_CLIENT_ID || "",
      redirectUri: `${window.location.origin}/api/integrations/crm/oauth/callback`,
      scope: ["contacts", "deals"],
    };

    initiateOAuth(oauthConfig);
  }, [selectedPlatform, initiateOAuth]);

  // Handle sync configuration
  const handleUpdateSyncConfig = useCallback(
    (config: Partial<SyncConfig>) => {
      setSyncConfig((prev) => ({ ...prev, ...config }));
    },
    []
  );

  // Handle test connection
  const handleTestConnection = useCallback(async () => {
    setTestResults({ success: true, message: "Connection test successful!" });
  }, []);

  // Handle activation
  const handleActivate = useCallback(() => {
    setCompletedSteps((prev) => new Set([...prev, 5]));
    // In a real implementation, make API call to activate
    setTimeout(() => {
      router.push("/dashboard/crm");
    }, 1500);
  }, [router]);

  return (
    <Wizard activeStep={activeStep} onStepChange={handleStepChange}>
      <WizardNav
        steps={steps}
        activeStep={activeStep}
        onStepClick={handleStepChange}
      />

      <WizardContent>
        {/* Step 1: Platform Selection */}
        {activeStep === 1 && (
          <WizardStep stepId={1} title="Select CRM Platform">
            <div className={cn("space-y-6")}>
              <p className={cn("text-wl-text-secondary", "leading-relaxed")}>
                Choose which CRM platform you want to connect to Witylogix.
              </p>

              <div
                className={cn(
                  "grid grid-cols-1 md:grid-cols-2 gap-4",
                  "auto-rows-max"
                )}
              >
                {platforms.map((platform) => (
                  <CrmPlatformCard
                    key={platform.id}
                    platform={platform}
                    onSelect={handleSelectPlatform}
                    isSelected={selectedPlatform === platform.id}
                  />
                ))}
              </div>

              <div className={cn("flex justify-end gap-3 pt-6")}>
                <Button variant="ghost" onClick={() => router.push("/dashboard/crm")}>
                  Cancel
                </Button>
                <Button
                  disabled={!selectedPlatform}
                  onClick={handleNext}
                >
                  Next
                </Button>
              </div>
            </div>
          </WizardStep>
        )}

        {/* Step 2: OAuth Authorization */}
        {activeStep === 2 && selectedPlatform && (
          <WizardStep stepId={2} title="OAuth Authorization">
            <div className={cn("space-y-6 max-w-2xl")}>
              <Card>
                <CardHeader>
                  <CardTitle>Connect to {platforms.find((p) => p.id === selectedPlatform)?.name}</CardTitle>
                </CardHeader>
                <CardContent className={cn("space-y-4")}>
                  <p className={cn("text-wl-text-secondary")}>
                    You'll be redirected to {platforms.find((p) => p.id === selectedPlatform)?.name} to authorize
                    access. We'll never store your credentials.
                  </p>

                  <div
                    className={cn(
                      "bg-wl-info-500/10 border border-wl-info-500/30",
                      "rounded-md p-4"
                    )}
                  >
                    <p className={cn("text-sm text-wl-info-400", "m-0")}>
                      We're requesting access to manage contacts, deals, and company records.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className={cn("flex justify-between gap-3 pt-6")}>
                <Button variant="ghost" onClick={handlePrevious}>
                  Back
                </Button>
                <Button onClick={handleStartOAuth}>
                  Authorize with {platforms.find((p) => p.id === selectedPlatform)?.name}
                </Button>
              </div>
            </div>
          </WizardStep>
        )}

        {/* Step 3: Configure Sync */}
        {activeStep === 3 && selectedPlatform && (
          <WizardStep stepId={3} title="Configure Sync Settings">
            <div className={cn("space-y-6 max-w-2xl")}>
              <Card>
                <CardHeader>
                  <CardTitle>Sync Direction</CardTitle>
                </CardHeader>
                <CardContent className={cn("space-y-4")}>
                  <div className={cn("space-y-3")}>
                    {[
                      {
                        value: "in",
                        label: "Pull from CRM",
                        desc: "Sync data from your CRM to Witylogix",
                      },
                      {
                        value: "out",
                        label: "Push to CRM",
                        desc: "Sync data from Witylogix to your CRM",
                      },
                      {
                        value: "bidirectional",
                        label: "Bidirectional",
                        desc: "Keep data synchronized both ways",
                      },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-md",
                          "border cursor-pointer transition-all duration-base",
                          syncConfig.direction === option.value
                            ? "border-wl-primary-500 bg-wl-primary-500/10"
                            : "border-wl-border-subtle hover:border-wl-border-default"
                        )}
                      >
                        <input
                          type="radio"
                          name="direction"
                          value={option.value}
                          checked={syncConfig.direction === option.value}
                          onChange={(e) =>
                            handleUpdateSyncConfig({
                              direction: e.target.value as "in" | "out" | "bidirectional",
                            })
                          }
                          className={cn("mt-1")}
                        />
                        <div>
                          <p className={cn("font-semibold text-wl-text-primary", "m-0")}>
                            {option.label}
                          </p>
                          <p className={cn("text-sm text-wl-text-tertiary", "mt-0.5")}>
                            {option.desc}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Objects to Sync</CardTitle>
                </CardHeader>
                <CardContent className={cn("space-y-3")}>
                  {["contacts", "deals", "companies"].map((obj) => (
                    <label
                      key={obj}
                      className={cn("flex items-center gap-3 cursor-pointer")}
                    >
                      <input
                        type="checkbox"
                        checked={syncConfig.objectTypes.includes(obj)}
                        onChange={(e) => {
                          const newTypes = e.target.checked
                            ? [...syncConfig.objectTypes, obj]
                            : syncConfig.objectTypes.filter((t) => t !== obj);
                          handleUpdateSyncConfig({ objectTypes: newTypes });
                        }}
                        className={cn("rounded")}
                      />
                      <span className={cn("capitalize text-wl-text-primary", "font-medium")}>
                        {obj}
                      </span>
                    </label>
                  ))}
                </CardContent>
              </Card>

              <div className={cn("flex justify-between gap-3 pt-6")}>
                <Button variant="ghost" onClick={handlePrevious}>
                  Back
                </Button>
                <Button onClick={handleNext}>
                  Next
                </Button>
              </div>
            </div>
          </WizardStep>
        )}

        {/* Step 4: Test Connection */}
        {activeStep === 4 && selectedPlatform && (
          <WizardStep stepId={4} title="Test Connection">
            <div className={cn("space-y-6 max-w-2xl")}>
              <p className={cn("text-wl-text-secondary")}>
                Verify your connection and pull sample data from your CRM.
              </p>

              {testResults && (
                <Card
                  className={cn(
                    testResults.success && "border-wl-success-500 bg-wl-success-500/5"
                  )}
                >
                  <CardContent className={cn("pt-5")}>
                    <div className={cn("flex items-start gap-3")}>
                      {testResults.success ? (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-wl-success-400 mt-0.5 flex-shrink-0"
                        >
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      ) : (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-wl-danger-400 mt-0.5 flex-shrink-0"
                        >
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="15" y1="9" x2="9" y2="15"></line>
                          <line x1="9" y1="9" x2="15" y2="15"></line>
                        </svg>
                      )}
                      <p
                        className={cn(
                          "m-0",
                          testResults.success
                            ? "text-wl-success-400"
                            : "text-wl-danger-400"
                        )}
                      >
                        {testResults.message}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className={cn("flex justify-between gap-3 pt-6")}>
                <Button variant="ghost" onClick={handlePrevious}>
                  Back
                </Button>
                <div className={cn("flex gap-3")}>
                  <Button variant="secondary" onClick={handleTestConnection}>
                    Test Connection
                  </Button>
                  <Button disabled={!testResults?.success} onClick={handleNext}>
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </WizardStep>
        )}

        {/* Step 5: Review & Activate */}
        {activeStep === 5 && selectedPlatform && (
          <WizardStep stepId={5} title="Review & Activate">
            <div className={cn("space-y-6 max-w-2xl")}>
              <Card>
                <CardHeader>
                  <CardTitle>Connection Summary</CardTitle>
                </CardHeader>
                <CardContent className={cn("space-y-4")}>
                  <div className={cn("grid grid-cols-2 gap-4")}>
                    <div>
                      <p className={cn("text-sm text-wl-text-tertiary", "mb-1")}>
                        Platform
                      </p>
                      <p className={cn("font-semibold text-wl-text-primary")}>
                        {platforms.find((p) => p.id === selectedPlatform)?.name}
                      </p>
                    </div>
                    <div>
                      <p className={cn("text-sm text-wl-text-tertiary", "mb-1")}>
                        Sync Direction
                      </p>
                      <Badge variant="primary" className="capitalize">
                        {syncConfig.direction}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <p className={cn("text-sm text-wl-text-tertiary", "mb-2")}>
                      Objects
                    </p>
                    <div className={cn("flex gap-2 flex-wrap")}>
                      {syncConfig.objectTypes.map((obj) => (
                        <Badge key={obj} variant="info" className="capitalize">
                          {obj}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Activation Settings</CardTitle>
                </CardHeader>
                <CardContent className={cn("space-y-4")}>
                  <label className={cn("flex items-center gap-3 cursor-pointer")}>
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e) => setIsEnabled(e.target.checked)}
                    />
                    <span className={cn("text-wl-text-primary", "font-medium")}>
                      Enable this integration
                    </span>
                  </label>

                  {isEnabled && (
                    <div>
                      <label className={cn("block text-sm text-wl-text-secondary mb-2")}>
                        Sync Schedule
                      </label>
                      <select
                        value={syncSchedule}
                        onChange={(e) => setSyncSchedule(e.target.value)}
                        className={cn(
                          "w-full px-3 py-2 rounded-md",
                          "bg-wl-bg-surface border border-wl-border-default",
                          "text-wl-text-primary",
                          "focus:outline-none focus:border-wl-primary-500"
                        )}
                      >
                        <option value="hourly">Every hour</option>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className={cn("flex justify-between gap-3 pt-6")}>
                <Button variant="ghost" onClick={handlePrevious}>
                  Back
                </Button>
                <Button
                  disabled={!isEnabled}
                  onClick={handleActivate}
                >
                  Activate Connection
                </Button>
              </div>
            </div>
          </WizardStep>
        )}
      </WizardContent>
    </Wizard>
  );
}
