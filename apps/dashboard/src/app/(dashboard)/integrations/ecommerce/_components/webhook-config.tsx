"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

interface PlatformConnection {
  id: string;
  name: string;
  webhooks: {
    id: string;
    event: string;
    status: "active" | "failed";
    lastTriggered: string;
  }[];
}

interface WebhookConfigProps {
  platforms: PlatformConnection[];
}

export function WebhookConfig({ platforms }: WebhookConfigProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Webhook Configuration</h2>

      <Card className="bg-wl-bg-elevated border-wl-border-default">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {platforms
              .filter((p) => p.webhooks.length > 0)
              .map((platform) => (
                <div
                  key={platform.id}
                  className="border border-wl-border-default rounded-lg p-4"
                >
                  <h3 className="font-semibold text-white mb-3">
                    {platform.name} Webhooks
                  </h3>
                  <div className="space-y-2">
                    {platform.webhooks.map((hook) => (
                      <div
                        key={hook.id}
                        className="flex items-center justify-between p-3 bg-wl-bg-surface rounded"
                      >
                        <div>
                          <div className="text-sm font-medium text-white">
                            {hook.event}
                          </div>
                          <div className="text-xs text-wl-text-tertiary mt-1">
                            Last triggered:{" "}
                            {new Date(hook.lastTriggered).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              hook.status === "active" ? "success" : "danger"
                            }
                            dot
                          >
                            {hook.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-wl-text-tertiary"
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
