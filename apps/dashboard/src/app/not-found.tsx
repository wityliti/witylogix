"use client";

import Link from "next/link";
import { Search, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <html lang="en">
      <body className="wl-noise">
        <div className={cn("flex min-h-screen bg-wl-bg-root")}>
          <main className={cn("flex-1 min-h-screen")}>
            <div className="flex items-center justify-center min-h-screen p-4">
              <Card className={cn("w-full max-w-md")}>
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <Search className="w-6 h-6 text-wl-text-tertiary" />
                    <CardTitle className="m-0">Page not found</CardTitle>
                  </div>
                  <CardDescription>
                    The page you're looking for doesn't exist or has been moved.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* 404 display */}
                  <div className="text-center py-6">
                    <p className="text-5xl font-bold text-wl-text-tertiary/40 mb-2">
                      404
                    </p>
                    <p className="text-sm text-wl-text-secondary">
                      Not found
                    </p>
                  </div>

                  {/* Navigation buttons */}
                  <div className="flex flex-col gap-2 pt-2">
                    <Link href="/" className="block">
                      <Button
                        variant="primary"
                        size="md"
                        className="w-full"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Back to home
                      </Button>
                    </Link>
                    <Link href="/dashboard" className="block">
                      <Button
                        variant="ghost"
                        size="md"
                        className="w-full"
                      >
                        Go to dashboard
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
