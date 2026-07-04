"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, Send, Plus, Trash2 } from "lucide-react";

interface MessageRoute {
  id: string;
  source: string;
  target: string;
  conditions: string[];
  enabled: boolean;
}

interface MessageRoutesProps {
  routes: MessageRoute[];
  onAddRoute?: () => void;
}

export function MessageRoutes({ routes, onAddRoute }: MessageRoutesProps) {
  return (
    <div className="space-y-4">
      {routes.map((route) => (
        <Card key={route.id} className="bg-wl-bg-elevated">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="text-right min-w-max">
                  <p className="text-sm font-semibold text-white">
                    {route.source}
                  </p>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="flex-1 h-px bg-wl-bg-elevated" />
                  <Send className="w-4 h-4 text-blue-500 mx-3" />
                  <div className="flex-1 h-px bg-wl-bg-elevated" />
                </div>
                <div className="text-left min-w-max">
                  <p className="text-sm font-semibold text-white">
                    {route.target}
                  </p>
                </div>
              </div>
              <div>
                <input
                  type="checkbox"
                  checked={route.enabled}
                  onChange={() => {}}
                  className="w-5 h-5 rounded cursor-pointer"
                />
              </div>
            </div>

            <div className="mb-4 pb-4 border-b border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase mb-2">
                Conditions
              </p>
              <div className="flex flex-wrap gap-2">
                {route.conditions.map((condition, idx) => (
                  <Badge
                    key={idx}
                    variant="default"
                    className="bg-wl-bg-surface text-white font-mono text-xs"
                  >
                    {condition}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 bg-wl-bg-surface hover:bg-wl-bg-elevated"
              >
                <Settings className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-red-500 hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {onAddRoute && (
        <Button
          variant="primary"
          className="w-full bg-blue-500 hover:bg-blue-500/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create New Routing Rule
        </Button>
      )}
    </div>
  );
}
