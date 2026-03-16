"use client";

import { useState, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Copy,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════
   CONNECT INTEGRATION DIALOG COMPONENT
   Multi-step modal for connecting providers with various auth types
   ═══════════════════════════════════════════════════════════ */

type AuthType = "oauth2" | "api_key" | "basic_auth" | "custom";
type Step = "details" | "credentials" | "testing" | "success";
type TestStatus = "pending" | "success" | "error";

export interface ConnectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  provider: {
    name: string;
    description: string;
    authType: AuthType;
    webhookSupported: boolean;
  };
  onConnect?: (credentials: Record<string, string>) => Promise<void>;
}

/**
 * Multi-step dialog for connecting integrations
 * Supports OAuth2, API Key, Basic Auth, and custom auth flows
 */
export function ConnectDialog({
  isOpen,
  onClose,
  provider,
  onConnect,
}: ConnectDialogProps) {
  const [step, setStep] = useState<Step>("details");
  const [isLoading, setIsLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<TestStatus>("pending");
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  const [formData, setFormData] = useState({
    apiKey: "",
    accountSid: "",
    authToken: "",
    username: "",
    password: "",
  });

  const handleClose = () => {
    if (step !== "testing") {
      resetDialog();
      onClose();
    }
  };

  const resetDialog = () => {
    setStep("details");
    setTestStatus("pending");
    setFormData({
      apiKey: "",
      accountSid: "",
      authToken: "",
      username: "",
      password: "",
    });
    setShowPassword(false);
    setShowApiKey(false);
  };

  const handleCredentialsSubmit = async () => {
    setIsLoading(true);
    setStep("testing");

    try {
      if (onConnect) {
        await onConnect(formData);
      } else {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      setTestStatus("success");
    } catch (error) {
      setTestStatus("error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccessClose = () => {
    resetDialog();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Connect ${provider.name}`}
      size="lg"
    >
      {step === "details" && (
        <StepDetails
          provider={provider}
          onNext={() => setStep("credentials")}
          onCancel={handleClose}
        />
      )}

      {step === "credentials" && (
        <StepCredentials
          provider={provider}
          formData={formData}
          onFormDataChange={setFormData}
          showPassword={showPassword}
          onShowPasswordChange={setShowPassword}
          showApiKey={showApiKey}
          onShowApiKeyChange={setShowApiKey}
          isLoading={isLoading}
          onSubmit={handleCredentialsSubmit}
          onBack={() => setStep("details")}
        />
      )}

      {step === "testing" && (
        <StepTesting
          provider={provider}
          testStatus={testStatus}
          onRetry={() => {
            setTestStatus("pending");
            handleCredentialsSubmit();
          }}
          onSuccess={() => setStep("success")}
          onBack={() => {
            setStep("credentials");
            setTestStatus("pending");
          }}
        />
      )}

      {step === "success" && (
        <StepSuccess provider={provider} onClose={handleSuccessClose} />
      )}
    </Modal>
  );
}

/* Step 1: Confirm Details */
interface StepDetailsProps {
  provider: {
    name: string;
    description: string;
    authType: AuthType;
    webhookSupported: boolean;
  };
  onNext: () => void;
  onCancel: () => void;
}

function StepDetails({ provider, onNext, onCancel }: StepDetailsProps) {
  return (
    <div className={cn("space-y-4")}>
      <p className={cn("text-sm text-wl-text-secondary")}>
        Review the integration details before connecting:
      </p>

      <div className={cn("space-y-3 bg-wl-bg-surface p-4 rounded-lg")}>
        <div>
          <div className={cn("text-xs text-wl-text-tertiary uppercase tracking-wide")}>
            Provider
          </div>
          <div className={cn("text-sm font-medium text-wl-text-primary")}>
            {provider.name}
          </div>
        </div>

        <div>
          <div className={cn("text-xs text-wl-text-tertiary uppercase tracking-wide")}>
            Description
          </div>
          <div className={cn("text-sm text-wl-text-secondary")}>
            {provider.description}
          </div>
        </div>

        <div>
          <div className={cn("text-xs text-wl-text-tertiary uppercase tracking-wide")}>
            Authentication Type
          </div>
          <div className={cn("text-sm font-medium text-wl-text-primary")}>
            {provider.authType === "oauth2"
              ? "OAuth 2.0"
              : provider.authType === "api_key"
                ? "API Key"
                : provider.authType === "basic_auth"
                  ? "Basic Authentication"
                  : "Custom"}
          </div>
        </div>

        <div>
          <div className={cn("text-xs text-wl-text-tertiary uppercase tracking-wide")}>
            Permissions Requested
          </div>
          <div className={cn("text-sm text-wl-text-primary space-y-1 mt-1")}>
            <div className={cn("flex items-center gap-2")}>
              <Check className="w-3 h-3 text-wl-success-400" />
              Read access to {provider.name} data
            </div>
            <div className={cn("flex items-center gap-2")}>
              <Check className="w-3 h-3 text-wl-success-400" />
              Write access to selected resources
            </div>
            {provider.webhookSupported && (
              <div className={cn("flex items-center gap-2")}>
                <Check className="w-3 h-3 text-wl-success-400" />
                Webhook configuration
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={cn("flex gap-2 pt-4")}>
        <Button variant="ghost" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" className="flex-1" onClick={onNext}>
          Continue
        </Button>
      </div>
    </div>
  );
}

/* Step 2: Enter Credentials */
interface StepCredentialsProps {
  provider: {
    name: string;
    authType: AuthType;
  };
  formData: Record<string, string>;
  onFormDataChange: (data: Record<string, string>) => void;
  showPassword: boolean;
  onShowPasswordChange: (show: boolean) => void;
  showApiKey: boolean;
  onShowApiKeyChange: (show: boolean) => void;
  isLoading: boolean;
  onSubmit: () => void;
  onBack: () => void;
}

function StepCredentials({
  provider,
  formData,
  onFormDataChange,
  showPassword,
  onShowPasswordChange,
  showApiKey,
  onShowApiKeyChange,
  isLoading,
  onSubmit,
  onBack,
}: StepCredentialsProps) {
  const handleInputChange = (field: string, value: string) => {
    onFormDataChange({ ...formData, [field]: value });
  };

  return (
    <div className={cn("space-y-4")}>
      <p className={cn("text-sm text-wl-text-secondary")}>
        {provider.authType === "oauth2"
          ? `You'll be redirected to ${provider.name} to authorize access`
          : `Enter your ${provider.name} credentials securely:`}
      </p>

      {provider.authType === "oauth2" ? (
        <Button variant="primary" className="w-full" onClick={onSubmit}>
          Authorize with {provider.name}
        </Button>
      ) : provider.authType === "api_key" ? (
        <div className={cn("space-y-3")}>
          <div className={cn("relative")}>
            <label className={cn("text-sm font-semibold text-wl-text-primary block mb-2")}>
              API Key
            </label>
            <div className={cn("relative flex items-center")}>
              <input
                type={showApiKey ? "text" : "password"}
                value={formData.apiKey}
                onChange={(e) => handleInputChange("apiKey", e.target.value)}
                placeholder="Enter your API key"
                className={cn(
                  "w-full pr-10 bg-wl-bg-surface text-wl-text-primary",
                  "border rounded-md outline-none",
                  "px-4 py-2 text-sm",
                  "border-wl-border-default focus:border-wl-primary-500",
                  "transition-all duration-fast"
                )}
              />
              <button
                onClick={() => onShowApiKeyChange(!showApiKey)}
                className="absolute right-3 top-8 text-wl-text-tertiary hover:text-wl-text-primary"
              >
                {showApiKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className={cn("text-xs text-wl-text-tertiary mt-2")}>
              Your API key is encrypted and never shared
            </p>
          </div>
        </div>
      ) : provider.authType === "basic_auth" ? (
        <div className={cn("space-y-3")}>
          <Input
            label="Username"
            value={formData.username}
            onChange={(e) => handleInputChange("username", e.target.value)}
            placeholder="Enter username"
          />
          <div className={cn("relative")}>
            <label className={cn("text-sm font-semibold text-wl-text-primary block mb-2")}>
              Password
            </label>
            <div className={cn("relative flex items-center")}>
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                placeholder="Enter password"
                className={cn(
                  "w-full pr-10 bg-wl-bg-surface text-wl-text-primary",
                  "border rounded-md outline-none",
                  "px-4 py-2 text-sm",
                  "border-wl-border-default focus:border-wl-primary-500",
                  "transition-all duration-fast"
                )}
              />
              <button
                onClick={() => onShowPasswordChange(!showPassword)}
                className="absolute right-3 top-8 text-wl-text-tertiary hover:text-wl-text-primary"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={cn("space-y-3")}>
          <Input
            label="Account SID"
            value={formData.accountSid}
            onChange={(e) => handleInputChange("accountSid", e.target.value)}
            placeholder="Enter Account SID"
          />
          <div className={cn("relative")}>
            <label className={cn("text-sm font-semibold text-wl-text-primary block mb-2")}>
              Auth Token
            </label>
            <div className={cn("relative flex items-center")}>
              <input
                type={showApiKey ? "text" : "password"}
                value={formData.authToken}
                onChange={(e) => handleInputChange("authToken", e.target.value)}
                placeholder="Enter Auth Token"
                className={cn(
                  "w-full pr-10 bg-wl-bg-surface text-wl-text-primary",
                  "border rounded-md outline-none",
                  "px-4 py-2 text-sm",
                  "border-wl-border-default focus:border-wl-primary-500",
                  "transition-all duration-fast"
                )}
              />
              <button
                onClick={() => onShowApiKeyChange(!showApiKey)}
                className="absolute right-3 top-8 text-wl-text-tertiary hover:text-wl-text-primary"
              >
                {showApiKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={cn("flex gap-2 pt-4")}>
        <Button variant="ghost" className="flex-1" onClick={onBack} disabled={isLoading}>
          Back
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          onClick={onSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            "Connect"
          )}
        </Button>
      </div>
    </div>
  );
}

/* Step 3: Testing Connection */
interface StepTestingProps {
  provider: { name: string };
  testStatus: TestStatus;
  onRetry: () => void;
  onSuccess: () => void;
  onBack: () => void;
}

function StepTesting({ provider, testStatus, onRetry, onSuccess, onBack }: StepTestingProps) {
  return (
    <div className={cn("space-y-4 text-center py-6")}>
      {testStatus === "pending" && (
        <>
          <Loader2 className="w-8 h-8 mx-auto text-wl-primary-400 animate-spin" />
          <p className={cn("text-wl-text-primary font-medium")}>
            Testing connection...
          </p>
          <p className={cn("text-sm text-wl-text-tertiary")}>
            Verifying your credentials with {provider.name}
          </p>
        </>
      )}

      {testStatus === "success" && (
        <>
          <CheckCircle className="w-8 h-8 mx-auto text-wl-success-400" />
          <p className={cn("text-wl-text-primary font-medium")}>
            Connection successful!
          </p>
          <p className={cn("text-sm text-wl-text-tertiary")}>
            Your integration is ready to use
          </p>
          <Button
            variant="primary"
            className="w-full mt-4"
            onClick={onSuccess}
          >
            Complete Setup
          </Button>
        </>
      )}

      {testStatus === "error" && (
        <>
          <AlertCircle className="w-8 h-8 mx-auto text-wl-danger-400" />
          <p className={cn("text-wl-text-primary font-medium")}>
            Connection failed
          </p>
          <p className={cn("text-sm text-wl-text-tertiary")}>
            Please check your credentials and try again
          </p>
          <div className={cn("flex gap-2 mt-4")}>
            <Button variant="ghost" className="flex-1" onClick={onBack}>
              Back
            </Button>
            <Button variant="primary" className="flex-1" onClick={onRetry}>
              Try Again
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/* Step 4: Success */
interface StepSuccessProps {
  provider: { name: string };
  onClose: () => void;
}

function StepSuccess({ provider, onClose }: StepSuccessProps) {
  return (
    <div className={cn("space-y-4 text-center py-6")}>
      <div className={cn("flex justify-center")}>
        <CheckCircle className="w-12 h-12 text-wl-success-400" />
      </div>
      <h3 className={cn("text-lg font-semibold text-wl-text-primary")}>
        All set!
      </h3>
      <p className={cn("text-sm text-wl-text-tertiary")}>
        {provider.name} has been successfully connected to your Witylogix
        account. You can now use this integration in your workflows.
      </p>

      <Button variant="primary" className="w-full mt-4" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}

export type { ConnectDialogProps };
