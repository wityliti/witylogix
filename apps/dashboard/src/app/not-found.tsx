"use client";

import { useEffect, useState } from "react";
import { Search, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Custom 404 Not Found page with animated illustration
 * Displayed when no route matches the requested URL
 */
export default function NotFound() {
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    setIsAnimated(true);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-wl-bg-root px-4 py-12">
      <div className="w-full max-w-md">
        <div
          className={cn(
            "mb-8 flex justify-center transition-all duration-700",
            isAnimated ? "opacity-100 scale-100" : "opacity-0 scale-95",
          )}
        >
          {/* Animated Lost Truck SVG */}
          <svg
            width="200"
            height="200"
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-lg"
          >
            {/* Truck body */}
            <rect
              x="40"
              y="80"
              width="80"
              height="40"
              rx="4"
              fill="var(--wl-primary-500)"
              opacity="0.9"
            />
            {/* Truck cabin */}
            <rect
              x="110"
              y="75"
              width="35"
              height="35"
              rx="3"
              fill="var(--wl-primary-600)"
            />
            {/* Cabin window */}
            <rect
              x="117"
              y="82"
              width="15"
              height="12"
              rx="2"
              fill="var(--wl-primary-400)"
              opacity="0.5"
            />
            {/* Wheels */}
            <circle cx="60" cy="125" r="8" fill="var(--wl-text-primary)" />
            <circle cx="100" cy="125" r="8" fill="var(--wl-text-primary)" />
            {/* Wheel rims */}
            <circle cx="60" cy="125" r="5" fill="var(--wl-bg-root)" />
            <circle cx="100" cy="125" r="5" fill="var(--wl-bg-root)" />
            {/* Question mark above truck */}
            <text
              x="100"
              y="45"
              textAnchor="middle"
              fontSize="32"
              fontWeight="bold"
              fill="var(--wl-warning-400)"
              className={cn(
                "transition-all duration-500",
                isAnimated ? "animate-bounce" : "",
              )}
            >
              ?
            </text>
          </svg>
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
          <h1 className="mb-2 text-4xl font-bold text-wl-text-primary">404</h1>
          <h2 className="mb-2 text-xl font-semibold text-wl-text-primary">
            Page Not Found
          </h2>
          <p className="mb-6 text-wl-text-secondary">
            The page you're looking for doesn't exist or has been moved. Try
            searching or return to the dashboard to continue.
          </p>

          {/* Search suggestion */}
          <div className="mb-8 rounded-lg border border-wl-border-subtle bg-wl-bg-surface p-4">
            <div className="mb-3 flex items-center gap-2 text-wl-text-secondary">
              <Search className="h-4 w-4" />
              <span className="text-sm font-medium">
                Looking for something?
              </span>
            </div>
            <p className="text-xs text-wl-text-tertiary">
              Try using the search or command palette to find what you need.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={() => (window.location.href = "/")}
              className="w-full"
            >
              <Home className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => window.history.back()}
              className="w-full"
            >
              Go Back
            </Button>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-xs text-wl-text-tertiary">
          Need help? Contact{" "}
          <a
            href="mailto:support@witylogix.com"
            className="text-wl-primary-500 transition-colors hover:text-wl-primary-400"
          >
            support
          </a>
        </div>
      </div>
    </div>
  );
}
