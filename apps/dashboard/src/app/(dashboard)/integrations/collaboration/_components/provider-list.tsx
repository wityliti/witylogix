'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Settings,
  Power,
  Plus,
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
} from 'lucide-react';

interface Provider {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
  connectedAt?: string;
  config: {
    channels?: string[];
    webhookUrl?: string;
    apiKey?: string;
  };
}

interface ProviderListProps {
  providers: Provider[];
  selectedProvider: string | null;
  onSelectProvider: (id: string | null) => void;
}

export function ProviderList({
  providers,
  selectedProvider,
  onSelectProvider,
}: ProviderListProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {providers.map((provider) => (
        <Card
          key={provider.id}
          className={cn(
            'cursor-pointer transition-all hover:border-wl-info-500/50',
            selectedProvider === provider.id && 'border-wl-info-500/80 bg-wl-bg-elevated'
          )}
          onClick={() =>
            onSelectProvider(
              selectedProvider === provider.id ? null : provider.id
            )
          }
        >
          <CardContent className="pt-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="text-wl-info-500 text-2xl">{provider.icon}</div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {provider.name}
                  </h3>
                  <p className="text-xs text-wl-text-tertiary mt-1">
                    {provider.status === 'connected' &&
                      `Connected on ${provider.connectedAt}`}
                    {provider.status === 'disconnected' && 'Not connected'}
                    {provider.status === 'error' && 'Connection error'}
                  </p>
                </div>
              </div>
              <Badge
                variant={
                  provider.status === 'connected'
                    ? 'success'
                    : provider.status === 'error'
                      ? 'danger'
                      : 'default'
                }
                className={cn(
                  provider.status === 'connected' &&
                    'bg-wl-success-500/20 text-wl-success-400 border border-green-500/50',
                  provider.status === 'error' &&
                    'bg-wl-danger-500/20 text-wl-danger-400 border border-wl-danger-500/50',
                  provider.status === 'disconnected' &&
                    'bg-wl-neutral-500/20 text-wl-text-secondary'
                )}
              >
                {provider.status === 'connected' && (
                  <>
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Connected
                  </>
                )}
                {provider.status === 'disconnected' && 'Disconnected'}
                {provider.status === 'error' && (
                  <>
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Error
                  </>
                )}
              </Badge>
            </div>

            {/* Status & Sync Info */}
            {provider.status === 'connected' && (
              <div className="flex items-center gap-4 mb-6 pb-6 border-b border-wl-border-default">
                <div className="flex-1">
                  <p className="text-xs font-medium text-wl-text-tertiary uppercase">
                    Last Sync
                  </p>
                  <p className="text-sm text-white mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-wl-success-500" />
                    {provider.lastSync}
                  </p>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-wl-text-tertiary uppercase">
                    Channels
                  </p>
                  <p className="text-sm text-white mt-1">
                    {provider.config.channels?.length || 0} channels
                  </p>
                </div>
              </div>
            )}

            {/* Config Details (Expanded) */}
            {selectedProvider === provider.id && provider.status === 'connected' && (
              <div className="space-y-4 mb-6 pb-6 border-b border-wl-border-default">
                {provider.config.channels && provider.config.channels.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-wl-text-tertiary uppercase mb-2">
                      Connected Channels
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {provider.config.channels.map((channel) => (
                        <Badge
                          key={channel}
                          variant="default"
                          className="bg-wl-bg-surface text-white"
                        >
                          {channel}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {provider.config.webhookUrl && (
                  <div>
                    <p className="text-xs font-medium text-wl-text-tertiary uppercase mb-2">
                      Webhook URL
                    </p>
                    <div className="bg-wl-bg-surface rounded-lg p-3 flex items-center justify-between font-mono text-xs">
                      <span className="text-wl-text-tertiary truncate">
                        {provider.config.webhookUrl.substring(0, 50)}...
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-wl-info-500 hover:bg-wl-bg-elevated"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {provider.status === 'connected' ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 bg-wl-bg-surface hover:bg-wl-bg-elevated"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Configure
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
              ) : provider.status === 'error' ? (
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1 bg-blue-500 hover:bg-blue-500/90"
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Reconnect
                </Button>
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
      ))}
    </div>
  );
}
