"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Settings } from "lucide-react";

export type FreightProviderStatus = "CONNECTED" | "ERROR" | "DISCONNECTED";

export interface FreightProvider {
  id: string;
  provider: string;
  name: string;
  status: FreightProviderStatus;
  loadsAvailable: number;
  loadsBooked: number;
  avgRate: number;
  lastSync: string;
}

interface FreightProviderStatusProps {
  provider: FreightProvider;
  onSync?: () => void;
  onSettings?: () => void;
}

const statusVariant = (status: FreightProviderStatus) => {
  switch (status) {
    case "CONNECTED":
      return "success";
    case "ERROR":
      return "danger";
    case "DISCONNECTED":
      return "default";
    default:
      return "default";
  }
};

export function FreightProviderStatusCard({
  provider,
  onSync,
  onSettings,
}: FreightProviderStatusProps) {
  return (
    <Card className="bg-wl-bg-surface border-wl-border-default">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold">{provider.name}</CardTitle>
        <Badge variant={statusVariant(provider.status) as any}>
          {provider.status}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Loads Available:</span>
            <span className="text-white font-medium">
              {provider.loadsAvailable}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Booked:</span>
            <span className="text-white font-medium">
              {provider.loadsBooked}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Avg Rate:</span>
            <span className="text-white font-medium">
              ${provider.avgRate.toFixed(2)}/mile
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Last Sync:</span>
            <span className="text-gray-300">{provider.lastSync}</span>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          {onSync && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSync}
              className="flex-1"
            >
              <RefreshCw className="w-3 h-3 mr-1" /> Sync
            </Button>
          )}
          {onSettings && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSettings}
              className="flex-1"
            >
              <Settings className="w-3 h-3 mr-1" /> Settings
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
