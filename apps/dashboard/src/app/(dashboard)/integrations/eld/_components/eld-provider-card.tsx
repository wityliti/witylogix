'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Settings,
  Power,
  Plus,
} from 'lucide-react';

interface ELDProvider {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: "connected" | "disconnected" | "error";
  connectedAt?: string;
  drivers?: number;
  vehicles?: number;
  lastSync?: string;
}

interface ELDProviderCardProps {
  provider: ELDProvider;
}

export function ELDProviderCard({ provider }: ELDProviderCardProps) {
  return (
    <Card className="hover:border-wl-info-500/50">
      <CardContent className="pt-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="text-wl-info-500 text-2xl">{provider.icon}</div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {provider.name}
              </h3>
            </div>
          </div>
          <Badge
            variant={provider.status === "connected" ? "success" : provider.status === "error" ? "danger" : "default"}
            className={cn(
              provider.status === "connected" && "bg-wl-success-500/20 text-wl-success-400 border border-green-500/50",
              provider.status === "error" && "bg-wl-danger-500/20 text-wl-danger-400 border border-wl-danger-500/50"
            )}
          >
            {provider.status === "connected" && (
              <>
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Connected
              </>
            )}
            {provider.status === "disconnected" && "Disconnected"}
            {provider.status === "error" && (
              <>
                <AlertCircle className="w-3 h-3 mr-1" />
                Error
              </>
            )}
          </Badge>
        </div>

        {provider.status === "connected" && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-wl-border-default">
              <div>
                <p className="text-xs font-medium text-wl-text-tertiary uppercase">
                  Drivers
                </p>
                <p className="text-2xl font-bold text-white mt-1">
                  {provider.drivers}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-wl-text-tertiary uppercase">
                  Vehicles
                </p>
                <p className="text-2xl font-bold text-white mt-1">
                  {provider.vehicles}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase">
                Last Sync
              </p>
              <p className="text-sm text-white mt-1 flex items-center gap-2">
                <Clock className="w-3 h-3 text-wl-success-500" />
                {provider.lastSync}
              </p>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {provider.status === "connected" ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 bg-wl-bg-surface hover:bg-wl-bg-elevated"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="flex-1 bg-wl-danger-500/10 text-wl-danger-400 hover:bg-wl-danger-500/20"
              >
                <Power className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              className="flex-1 bg-blue-500 hover:bg-blue-500/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Connect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
