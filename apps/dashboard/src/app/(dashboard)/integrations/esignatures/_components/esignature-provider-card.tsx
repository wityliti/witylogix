'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, Clock, Settings, Power, Plus } from 'lucide-react';

interface ESignatureProvider {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: "connected" | "disconnected" | "error";
  connectedAt?: string;
  lastSync?: string;
  templates?: number;
  envelopes?: number;
}

interface ESignatureProviderCardProps {
  provider: ESignatureProvider;
}

export function ESignatureProviderCard({ provider }: ESignatureProviderCardProps) {
  return (
    <Card className="hover:border-blue-500/50">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="text-blue-500 text-2xl">{provider.icon}</div>
            <div>
              <h3 className="text-lg font-semibold text-white">{provider.name}</h3>
              <p className="text-xs text-wl-text-tertiary mt-1">
                {provider.status === "connected" && `Connected on ${provider.connectedAt}`}
                {provider.status === "disconnected" && "Not connected"}
                {provider.status === "error" && "Connection error"}
              </p>
            </div>
          </div>
          <Badge
            variant={provider.status === "connected" ? "success" : provider.status === "error" ? "danger" : "default"}
            className={cn(
              provider.status === "connected" && "bg-green-500/20 text-green-400 border border-green-500/50",
              provider.status === "error" && "bg-red-500/20 text-red-400 border border-red-500/50"
            )}
          >
            {provider.status === "connected" && (
              <><CheckCircle2 className="w-3 h-3 mr-1" />Connected</>
            )}
            {provider.status === "disconnected" && "Disconnected"}
            {provider.status === "error" && (
              <><AlertCircle className="w-3 h-3 mr-1" />Error</>
            )}
          </Badge>
        </div>

        {provider.status === "connected" && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-wl-border-default">
              <div>
                <p className="text-xs font-medium text-wl-text-tertiary uppercase">Templates</p>
                <p className="text-2xl font-bold text-white mt-1">{provider.templates}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-wl-text-tertiary uppercase">Envelopes</p>
                <p className="text-2xl font-bold text-white mt-1">{provider.envelopes?.toLocaleString()}</p>
              </div>
            </div>
            <div className="mb-6">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase">Last Sync</p>
              <p className="text-sm text-white mt-1 flex items-center gap-2">
                <Clock className="w-3 h-3 text-green-500" />
                {provider.lastSync}
              </p>
            </div>
          </>
        )}

        <div className="flex gap-2">
          {provider.status === "connected" ? (
            <>
              <Button variant="secondary" size="sm" className="flex-1 bg-wl-bg-surface hover:bg-wl-bg-elevated">
                <Settings className="w-4 h-4 mr-2" />Settings
              </Button>
              <Button variant="danger" size="sm" className="flex-1 bg-red-500/10 text-red-400 hover:bg-red-500/20">
                <Power className="w-4 h-4 mr-2" />Disconnect
              </Button>
            </>
          ) : provider.status === "error" ? (
            <Button variant="primary" size="sm" className="flex-1 bg-blue-500 hover:bg-blue-500/90">
              <AlertCircle className="w-4 h-4 mr-2" />Reconnect
            </Button>
          ) : (
            <Button variant="primary" size="sm" className="flex-1 bg-blue-500 hover:bg-blue-500/90">
              <Plus className="w-4 h-4 mr-2" />Connect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
