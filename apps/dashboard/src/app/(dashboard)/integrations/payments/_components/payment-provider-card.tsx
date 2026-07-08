'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, AlertCircle, CheckCircle } from 'lucide-react';

export interface PaymentProvider {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: "connected" | "disconnected" | "error";
  connectedAt?: string;
  transactions?: number;
  volume?: string;
  fees?: string;
  lastSync?: string;
}

interface PaymentProviderCardProps {
  provider: PaymentProvider;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

const statusConfig = {
  connected: {
    badge: 'success',
    icon: <CheckCircle className="w-4 h-4" />,
    label: 'Connected',
  },
  disconnected: {
    badge: 'default',
    icon: <CreditCard className="w-4 h-4" />,
    label: 'Not Connected',
  },
  error: {
    badge: 'danger',
    icon: <AlertCircle className="w-4 h-4" />,
    label: 'Error',
  },
} as const;

export function PaymentProviderCard({
  provider,
  onConnect,
  onDisconnect,
}: PaymentProviderCardProps) {
  const config = statusConfig[provider.status];

  return (
    <div className="border border-wl-border-default rounded-lg p-4 bg-wl-bg-surface hover:bg-wl-bg-elevated transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">{provider.icon}</div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">{provider.name}</h3>
            <Badge variant={config.badge as any} className="mt-2">
              {config.icon}
              <span className="ml-2">{config.label}</span>
            </Badge>
          </div>
        </div>
      </div>

      {provider.status === 'connected' && (
        <div className="space-y-2 mb-4 text-xs">
          <div className="flex justify-between">
            <span className="text-wl-text-secondary">Transactions:</span>
            <span className="text-white font-medium">{provider.transactions}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-wl-text-secondary">Volume:</span>
            <span className="text-white font-medium">{provider.volume}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-wl-text-secondary">Fees:</span>
            <span className="text-white font-medium">{provider.fees}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-wl-text-secondary">Last Sync:</span>
            <span className="text-white font-medium">{provider.lastSync}</span>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {provider.status === 'connected' && onDisconnect && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDisconnect}
            className="flex-1"
          >
            Disconnect
          </Button>
        )}
        {provider.status !== 'connected' && onConnect && (
          <Button
            variant="primary"
            size="sm"
            onClick={onConnect}
            className="flex-1"
          >
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}
