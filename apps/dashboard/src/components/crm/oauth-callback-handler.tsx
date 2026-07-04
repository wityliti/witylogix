"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface OAuthCallbackHandlerProps {
  onSuccess?: (data: { platformId: string; connectionId: string }) => void;
  onError?: (error: string) => void;
}

export function OAuthCallbackHandler({
  onSuccess,
  onError,
}: OAuthCallbackHandlerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"processing" | "success" | "error">(
    "processing"
  );
  const [message, setMessage] = useState("Processing OAuth callback...");

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Extract OAuth parameters
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        // Handle error response
        if (error) {
          const errorMsg = errorDescription || error;
          setMessage(`OAuth Error: ${errorMsg}`);
          setStatus("error");
          onError?.(errorMsg);
          return;
        }

        // Validate required parameters
        if (!code || !state) {
          const errorMsg = "Missing OAuth callback parameters";
          setMessage(errorMsg);
          setStatus("error");
          onError?.(errorMsg);
          return;
        }

        // Get stored state for CSRF validation
        const storedState = sessionStorage.getItem("oauth_state");
        const platformId = sessionStorage.getItem("oauth_platform");

        if (!storedState || storedState !== state) {
          const errorMsg = "OAuth state validation failed";
          setMessage(errorMsg);
          setStatus("error");
          onError?.(errorMsg);
          return;
        }

        if (!platformId) {
          const errorMsg = "Platform ID not found in session";
          setMessage(errorMsg);
          setStatus("error");
          onError?.(errorMsg);
          return;
        }

        // Exchange authorization code for access token
        setMessage("Exchanging authorization code...");
        const { connectionId } = await (await import("@/lib/api")).api.post<{ connectionId: string }>(
          "/api/v4/integrations/crm/oauth/callback",
          { code, state, platformId }
        );

        // Clean up session storage
        sessionStorage.removeItem("oauth_state");
        sessionStorage.removeItem("oauth_platform");

        setStatus("success");
        setMessage("Successfully connected!");

        onSuccess?.({
          platformId,
          connectionId,
        });

        // Redirect to next step after brief delay
        setTimeout(() => {
          router.push(`/dashboard/crm/connect?step=3&connection=${connectionId}`);
        }, 1500);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "OAuth callback failed";
        setMessage(errorMsg);
        setStatus("error");
        onError?.(errorMsg);
      }
    };

    processCallback();
  }, [searchParams, router, onSuccess, onError]);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center",
        "min-h-screen",
        "bg-wl-bg-root"
      )}
    >
      <div className={cn("text-center", "space-y-6")}>
        {status === "processing" && (
          <>
            <LoadingSpinner size="lg" />
            <p className={cn("text-wl-text-secondary", "text-base")}>
              {message}
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div
              className={cn(
                "w-16 h-16 mx-auto",
                "bg-wl-success-500/20 rounded-full",
                "flex items-center justify-center"
              )}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-wl-success-400"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <p className={cn("text-wl-text-secondary", "text-base")}>
              {message}
            </p>
            <p className={cn("text-wl-text-tertiary", "text-sm")}>
              Redirecting to next step...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div
              className={cn(
                "w-16 h-16 mx-auto",
                "bg-wl-danger-500/20 rounded-full",
                "flex items-center justify-center"
              )}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-wl-danger-400"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            </div>
            <p className={cn("text-wl-danger-400", "text-base")}>
              {message}
            </p>
            <button
              onClick={() => window.history.back()}
              className={cn(
                "mt-6",
                "px-4 py-2 rounded-md",
                "bg-wl-primary-500 hover:bg-wl-primary-600",
                "text-white font-medium",
                "transition-colors duration-fast"
              )}
            >
              Go Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
