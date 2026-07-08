"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AuthErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AuthError({ error, reset }: AuthErrorProps) {
  useEffect(() => {
    // Log error for monitoring/reporting
    console.error("Auth error boundary caught:", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated gradient background elements */}
      <div
        className="absolute -top-1/2 -right-1/5 w-96 h-96 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(245, 166, 35, 0.08) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />
      <div
        className="absolute -bottom-2/5 -left-1/4 w-96 h-96 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(59, 130, 246, 0.06) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      {/* Error card container */}
      <div className="relative z-10 w-full max-w-sm">
        {/* Logo and branding */}
        <div
          className="flex flex-col items-center mb-8"
          style={{
            animation: "wl-fade-in 600ms var(--wl-ease-default) both",
            animationDelay: "100ms",
          }}
        >
          <div
            className="flex items-center justify-center w-14 h-14 rounded-lg mb-4"
            style={{
              background:
                "linear-gradient(135deg, var(--wl-primary-500) 0%, var(--wl-primary-600) 100%)",
              boxShadow: "0 8px 24px rgba(245, 166, 35, 0.2)",
            }}
          >
            <span className="text-2xl font-bold text-wl-text-inverse">W</span>
          </div>
          <h1 className="text-3xl font-bold text-wl-text-primary mb-1 tracking-tight">
            Witylogix
          </h1>
          <p className="text-sm text-wl-text-tertiary">
            Delivery logistics command center
          </p>
        </div>

        {/* Error card */}
        <div
          className="rounded-lg border border-wl-border-subtle p-8 backdrop-blur-lg"
          style={{
            background: "rgba(17, 17, 20, 0.8)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
            animation: "wl-fade-in 600ms var(--wl-ease-default) both",
            animationDelay: "200ms",
          }}
        >
          {/* Error header */}
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-wl-danger-400 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-wl-text-primary mb-1">
                Authentication Error
              </h2>
              <p className="text-sm text-wl-text-secondary">
                Something went wrong during the authentication process.
              </p>
            </div>
          </div>

          {/* Error details */}
          <div
            className={cn(
              "p-3 rounded-md mb-6",
              "bg-wl-danger-bg border border-wl-danger-400/30",
            )}
          >
            <p className="text-xs text-wl-danger-400 font-mono break-all">
              {error.message || "Unknown error"}
            </p>
            {error.digest && (
              <p className="text-xs text-wl-danger-300/60 font-mono mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => reset()}
              variant="primary"
              size="md"
              className="w-full"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </Button>
            <Button
              onClick={() => (window.location.href = "/login")}
              variant="ghost"
              size="md"
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div
          className="mt-8 text-center text-xs text-wl-text-tertiary"
          style={{
            animation: "wl-fade-in 600ms var(--wl-ease-default) both",
            animationDelay: "300ms",
          }}
        >
          © 2026 Witylogix. All rights reserved.
        </div>
      </div>
    </div>
  );
}
