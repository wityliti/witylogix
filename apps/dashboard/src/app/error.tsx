"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error for monitoring/reporting
    console.error("Root error boundary caught:", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

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
                  {/* Error details */}
                  <div
                    className={cn(
                      "p-3 rounded-md",
                      "bg-wl-danger-bg border border-wl-danger-400/30"
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
                      onClick={() => window.location.href = "/"}
                      variant="ghost"
                      size="md"
                      className="w-full"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to home
                    </Button>
                  </div>

                  {/* Help text */}
                  <p className="text-xs text-wl-text-tertiary text-center mt-4">
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
