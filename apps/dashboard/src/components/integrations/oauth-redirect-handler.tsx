"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface OAuthRedirectHandlerProps {
  onSuccess?: (code: string, state: string) => void;
  onError?: (error: string, errorDescription?: string) => void;
  redirectPath?: string;
  className?: string;
}

/**
 * OAuth Redirect Handler Component
 * Mounted at /integrations/callback
 * Extracts auth code from URL params and validates CSRF state
 * Displays loading, success, and error states
 * Auto-redirects to dashboard after successful connection
 */
export function OAuthRedirectHandler({
  onSuccess,
  onError,
  redirectPath = "/integrations",
  className,
}: OAuthRedirectHandlerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [errorDescription, setErrorDescription] = useState<string>("");
  const [redirectCountdown, setRedirectCountdown] = useState<number>(3);
  const [providerName, setProviderName] = useState<string>("Provider");

  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Extract URL parameters
      const code = searchParams.get("code");
      const returnedState = searchParams.get("state");
      const error = searchParams.get("error");
      const errorDesc = searchParams.get("error_description");

      // Check for OAuth errors first
      if (error) {
        setErrorMessage(error);
        setErrorDescription(
          errorDesc || "An error occurred during OAuth authentication"
        );
        setState("error");
        onError?.(error, errorDesc || undefined);
        return;
      }

      // Validate required parameters
      if (!code) {
        setErrorMessage("missing_code");
        setErrorDescription("Authorization code not received from provider");
        setState("error");
        onError?.("missing_code", "Authorization code not received");
        return;
      }

      if (!returnedState) {
        setErrorMessage("missing_state");
        setErrorDescription("CSRF state parameter not received");
        setState("error");
        onError?.("missing_state", "CSRF state validation failed");
        return;
      }

      // Validate CSRF state token
      try {
        const storedState = sessionStorage.getItem("oauth_state");
        const storedProvider = sessionStorage.getItem("oauth_provider") || "Provider";

        if (!storedState) {
          setErrorMessage("invalid_state");
          setErrorDescription(
            "CSRF state token not found. Session may have expired."
          );
          setState("error");
          onError?.(
            "invalid_state",
            "CSRF state token validation failed - session expired"
          );
          return;
        }

        if (storedState !== returnedState) {
          setErrorMessage("state_mismatch");
          setErrorDescription("CSRF state token mismatch. Request may be unsafe.");
          setState("error");
          onError?.(
            "state_mismatch",
            "CSRF state token does not match. Request rejected for security."
          );
          return;
        }

        // Clear session storage
        sessionStorage.removeItem("oauth_state");
        sessionStorage.removeItem("oauth_provider");

        // State validation successful
        setProviderName(storedProvider);
        setState("success");
        onSuccess?.(code, returnedState);

        // Auto-redirect after countdown
        const timer = setInterval(() => {
          setRedirectCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              router.push(redirectPath);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        return () => clearInterval(timer);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        setErrorMessage("callback_error");
        setErrorDescription(errorMsg);
        setState("error");
        onError?.("callback_error", errorMsg);
      }
    };

    handleOAuthCallback();
  }, [searchParams, onSuccess, onError, redirectPath, router]);

  return (
    <div
      className={cn(
        "flex items-center justify-center min-h-screen bg-wl-bg-default",
        className
      )}
    >
      <div
        className={cn(
          "w-full max-w-md rounded-lg border p-8",
          "bg-wl-bg-surface border-wl-border-subtle",
          "shadow-lg"
        )}
      >
        {state === "loading" && (
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <div
                className={cn(
                  "w-12 h-12 rounded-full border-4",
                  "border-wl-border-subtle border-t-wl-primary-500",
                  "animate-spin"
                )}
              />
            </div>
            <h2 className="text-xl font-semibold text-wl-text-primary mb-2">
              Connecting Integration
            </h2>
            <p className="text-sm text-wl-text-secondary">
              Please wait while we complete the OAuth flow...
            </p>
          </div>
        )}

        {state === "success" && (
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <div
                className={cn(
                  "w-12 h-12 rounded-full",
                  "bg-wl-success-100 dark:bg-wl-success-900/30",
                  "flex items-center justify-center"
                )}
              >
                <svg
                  className="w-6 h-6 text-wl-success-600 dark:text-wl-success-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-wl-text-primary mb-2">
              Connected to {providerName}
            </h2>
            <p className="text-sm text-wl-text-secondary mb-6">
              Your integration has been successfully connected. Redirecting to dashboard in{" "}
              <span className="font-semibold">{redirectCountdown}s</span>...
            </p>
            <button
              onClick={() => router.push(redirectPath)}
              className={cn(
                "w-full px-4 py-2 rounded font-medium text-sm transition-colors",
                "bg-wl-primary-500 text-white hover:bg-wl-primary-600",
                "dark:bg-wl-primary-600 dark:hover:bg-wl-primary-700"
              )}
            >
              Return to Dashboard Now
            </button>
          </div>
        )}

        {state === "error" && (
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <div
                className={cn(
                  "w-12 h-12 rounded-full",
                  "bg-wl-danger-100 dark:bg-wl-danger-900/30",
                  "flex items-center justify-center"
                )}
              >
                <svg
                  className="w-6 h-6 text-wl-danger-600 dark:text-wl-danger-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-wl-text-primary mb-2">
              Connection Failed
            </h2>
            <div
              className={cn(
                "mb-6 p-3 rounded text-sm text-left",
                "bg-wl-danger-100 text-wl-danger-700",
                "dark:bg-wl-danger-900/30 dark:text-wl-danger-300"
              )}
            >
              <div className="font-semibold mb-1">
                {errorMessage}
              </div>
              <div className="text-xs opacity-90">
                {errorDescription}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => window.history.back()}
                className={cn(
                  "flex-1 px-4 py-2 rounded font-medium text-sm transition-colors",
                  "bg-wl-surface-hover text-wl-text-primary hover:bg-wl-border-subtle",
                  "dark:bg-wl-surface-hover dark:hover:bg-wl-border-default"
                )}
              >
                Go Back
              </button>
              <button
                onClick={() => router.push(redirectPath)}
                className={cn(
                  "flex-1 px-4 py-2 rounded font-medium text-sm transition-colors",
                  "bg-wl-primary-500 text-white hover:bg-wl-primary-600",
                  "dark:bg-wl-primary-600 dark:hover:bg-wl-primary-700"
                )}
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
