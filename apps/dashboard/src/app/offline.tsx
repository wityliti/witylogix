"use client";

import { useEffect, useState } from "react";
import { Cloud, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Offline fallback page displayed when network connection is lost
 * Shows reconnection status and cached content access hints
 */
export default function OfflinePage() {
  const [isAnimated, setIsAnimated] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsAnimated(true);
    setIsOnline(navigator.onLine);
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Countdown timer for auto-reconnect
  useEffect(() => {
    if (!isOnline && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, countdown]);

  // Auto-refresh when coming back online
  useEffect(() => {
    if (isOnline && !countdown) {
      window.location.reload();
    }
  }, [isOnline, countdown]);

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-wl-bg-root px-4 py-12">
      <div className="w-full max-w-md">
        {/* Animated Cloud/Disconnect SVG */}
        <div
          className={cn(
            "mb-8 flex justify-center transition-all duration-700",
            isAnimated ? "opacity-100 scale-100" : "opacity-0 scale-95",
          )}
        >
          <div className="relative w-40 h-40">
            {/* Cloud shape */}
            <svg
              className="w-full h-full"
              viewBox="0 0 200 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M60 140C40 140 25 125 25 105C25 90 35 77 48 73C50 55 65 42 82 42C95 42 106 50 112 61C130 65 145 80 145 99C145 120 130 140 110 140"
                fill="var(--wl-bg-surface)"
                stroke="var(--wl-border-default)"
                strokeWidth="2"
              />
            </svg>

            {/* Disconnect X */}
            <div
              className={cn(
                "absolute inset-0 flex items-center justify-center transition-opacity duration-500",
                isAnimated ? "opacity-100" : "opacity-0",
              )}
            >
              <div className="flex items-center justify-center w-20 h-20 rounded-full bg-wl-danger-bg/20">
                <Wifi
                  className="w-10 h-10 text-wl-danger-400"
                  strokeWidth={1.5}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div
          className={cn(
            "text-center transition-all duration-700 delay-200",
            isAnimated
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4",
          )}
        >
          <h1 className="mb-2 text-2xl font-bold text-wl-text-primary">
            {isOnline ? "Reconnecting..." : "You're Offline"}
          </h1>
          <p className="mb-6 text-wl-text-secondary">
            {isOnline
              ? "Restoring your connection and syncing data."
              : "Your internet connection appears to be lost. Some features may be limited."}
          </p>

          {/* Status indicator */}
          <div className="mb-8 rounded-lg border border-wl-border-subtle bg-wl-bg-surface p-4">
            <div className="mb-2 flex items-center justify-center gap-2">
              <div
                className={cn(
                  "w-3 h-3 rounded-full transition-all duration-500",
                  isOnline
                    ? "bg-wl-success-400 animate-pulse"
                    : "bg-wl-danger-400",
                )}
              />
              <span className="text-sm font-medium text-wl-text-secondary">
                {isOnline ? "Online" : "Offline"}
              </span>
            </div>

            {!isOnline && countdown > 0 && (
              <p className="text-xs text-wl-text-tertiary">
                Auto-reconnecting in {countdown}s...
              </p>
            )}

            {!isOnline && (
              <p className="mt-3 text-xs text-wl-text-tertiary">
                💡 Tip: You can still access cached data while offline.
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={handleRetry}
              className="w-full"
            >
              {isOnline ? "Continue" : "Retry Connection"}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => (window.location.href = "/")}
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-wl-text-tertiary">
          Having persistent issues?{" "}
          <a
            href="mailto:support@witylogix.com"
            className="text-wl-primary-500 transition-colors hover:text-wl-primary-400"
          >
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}
