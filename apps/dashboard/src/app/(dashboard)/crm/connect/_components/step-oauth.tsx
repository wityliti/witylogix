"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { WizardStep } from "./wizard";
import type { CRMPlatform } from "./types";

interface StepOAuthProps {
  platforms: CRMPlatform[];
  selectedPlatform: string | null;
  onStartOAuth: () => void;
  onBack: () => void;
}

export function StepOAuth({
  platforms,
  selectedPlatform,
  onStartOAuth,
  onBack,
}: StepOAuthProps) {
  const platformName =
    platforms.find((p) => p.id === selectedPlatform)?.name || "";

  if (!selectedPlatform) return null;

  return (
    <WizardStep stepId={2} title="OAuth Authorization">
      <div className={cn("space-y-6 max-w-2xl")}>
        <Card>
          <CardHeader>
            <CardTitle>Connect to {platformName}</CardTitle>
          </CardHeader>
          <CardContent className={cn("space-y-4")}>
            <p className={cn("text-gray-300")}>
              You'll be redirected to {platformName} to authorize access. We'll
              never store your credentials.
            </p>

            <div
              className={cn(
                "bg-blue-500/10 border border-blue-500/30",
                "rounded-md p-4",
              )}
            >
              <p className={cn("text-sm text-blue-400", "m-0")}>
                We're requesting access to manage contacts, deals, and company
                records.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className={cn("flex justify-between gap-3 pt-6")}>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onStartOAuth}>Authorize with {platformName}</Button>
        </div>
      </div>
    </WizardStep>
  );
}
