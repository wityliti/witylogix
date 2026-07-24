"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root error boundary component
 * Catches render errors and displays user-friendly error UI with retry options
 * Must be a client component
 */
export default function RootError({ error, reset }: ErrorProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Log error for monitoring/reporting
    console.error("Root error boundary caught:", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  if (!isClient) {
    return null;
  }

  const isDev = process.env.NODE_ENV === "development";

  return (
    <html lang="en">
      <body className="wl-noise">
        <div className={cn("flex min-h-screen bg-wl-bg-root")}>
          <main className={cn("flex-1 min-h-screen")}>
            <div className="flex items-center justify-center min-h-screen p-4">
              <Card className={cn("w-full max-w-md")}>
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle className="w-6 h-6 text-wl-danger-400" />
                    <CardTitle className="m-0">Something went wrong</CardTitle>
                  </div>
                  <CardDescription>
                    An unexpected error occurred while loading this page.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Error details - collapsible in dev mode */}
                  {isDev && (
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowDetails(!showDetails)}
                        className={cn(
                          "w-full flex items-center justify-between",
                          "px-3 py-2 rounded-md",
                          "text-sm font-medium text-wl-text-secondary",
                          "bg-wl-bg-surface hover:bg-wl-bg-overlay",
                          "transition-colors duration-fast ease-default",
                          "border border-wl-border-subtle",
                        )}
                      >
                        <span>Error Details</span>
                        <ChevronDown
                          className={cn(
                            "w-4 h-4 transition-transform duration-300",
                            showDetails && "rotate-180",
                          )}
                        />
                      </button>

                      {showDetails && (
                        <div
                          className={cn(
                            "p-3 rounded-md",
                            "bg-wl-danger-bg border border-wl-danger-400/30",
                            "max-h-48 overflow-auto",
                          )}
                        >
                          <p className="text-xs text-wl-danger-400 font-mono break-all mb-2">
                            {error.message || "Unknown error"}
                          </p>
                          {error.digest && (
                            <p className="text-xs text-wl-danger-300/60 font-mono mb-2">
                              Error ID: {error.digest}
                            </p>
                          )}
                          {error.stack && (
                            <details className="text-xs text-wl-danger-300/50 font-mono whitespace-pre-wrap break-words">
                              <summary className="cursor-pointer text-wl-danger-300/70 mb-2">
                                Stack trace
                              </summary>
                              <code>{error.stack}</code>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {!isDev && (
                    <div
                      className={cn(
                        "p-3 rounded-md",
                        "bg-wl-danger-bg border border-wl-danger-400/30",
                      )}
                    >
                      <p className="text-xs text-wl-danger-400">
                        Error ID: {error.digest || "unknown"}
                      </p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-col gap-2 pt-2">
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
                      onClick={() => (window.location.href = "/")}
                      variant="ghost"
                      size="md"
                      className="w-full"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to home
                    </Button>
                  </div>

                  {/* Report issue link */}
                  <div className="pt-2 border-t border-wl-border-subtle">
                    <a
                      href={`mailto:support@witylogix.com?subject=Error Report&body=Error ID: ${
                        error.digest || "unknown"
                      }%0A%0AError: ${encodeURIComponent(error.message || "Unknown")}`}
                      className={cn(
                        "inline-flex items-center gap-2 text-xs text-wl-primary-500",
                        "hover:text-wl-primary-400 transition-colors duration-fast",
                      )}
                    >
                      📧 Report this issue
                    </a>
                  </div>

                  {/* Help text */}
                  <p className="text-xs text-wl-text-tertiary text-center mt-2">
                    If the problem persists, please contact support.
                  </p>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
