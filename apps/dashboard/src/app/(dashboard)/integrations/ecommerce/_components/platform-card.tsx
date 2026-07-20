'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronRight,
  RotateCw,
  Settings,
  Trash2,
} from 'lucide-react';

interface PlatformConnection {
  id: string;
  name: string;
  slug: string;
  logo: string;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  lastSync?: string;
  productsSynced: number;
  ordersSynced: number;
  syncSettings: {
    productSync: { enabled: boolean; direction: 'in' | 'out' | 'both' };
    orderSync: { enabled: boolean; direction: 'in' | 'out' | 'both' };
    inventorySync: { enabled: boolean };
    customerSync: { enabled: boolean };
  };
  webhooks: {
    id: string;
    event: string;
    status: 'active' | 'failed';
    lastTriggered: string;
  }[];
}

interface PlatformCardProps {
  platform: PlatformConnection;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'connected':
      return <Badge variant="success">Connected</Badge>;
    case 'error':
      return <Badge variant="danger">Error</Badge>;
    case 'pending':
      return <Badge variant="warning">Pending</Badge>;
    default:
      return <Badge variant="default">Disconnected</Badge>;
  }
}

export function PlatformCard({
  platform,
  isExpanded,
  onToggleExpand,
}: PlatformCardProps) {
  return (
    <Card
      className={cn(
        'bg-wl-bg-elevated border-wl-border-default cursor-pointer transition-all hover:border-wl-info-500/50',
        isExpanded && 'ring-1 ring-wl-primary-500'
      )}
      onClick={() => onToggleExpand(platform.id)}
    >
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-4xl">{platform.logo}</div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">{platform.name}</h3>
              <div className="flex gap-2 mt-1">
                <StatusBadge status={platform.status} />
                {platform.lastSync && (
                  <span className="text-xs text-wl-text-tertiary">
                    Last sync: {new Date(platform.lastSync).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {platform.status === 'connected' && (
              <>
                <Button variant="ghost" size="sm" className="text-wl-text-tertiary">
                  <RotateCw className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-wl-text-tertiary">
                  <Settings className="w-4 h-4" />
                </Button>
              </>
            )}
            <ChevronRight
              className={cn(
                'w-5 h-5 text-wl-text-tertiary transition-transform',
                isExpanded && 'rotate-90'
              )}
            />
          </div>
        </div>

        {isExpanded && (
          <div className="mt-6 pt-6 border-t border-wl-border-default space-y-6">
            {/* Sync Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-wl-text-tertiary">Products Synced</div>
                <div className="text-2xl font-bold text-white mt-1">
                  {platform.productsSynced.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-wl-text-tertiary">Orders Synced</div>
                <div className="text-2xl font-bold text-white mt-1">
                  {platform.ordersSynced.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-sm text-wl-text-tertiary">Product Sync</div>
                <div className="text-sm font-medium text-white mt-1">
                  {platform.syncSettings.productSync.direction.toUpperCase()}
                </div>
              </div>
              <div>
                <div className="text-sm text-wl-text-tertiary">Order Sync</div>
                <div className="text-sm font-medium text-white mt-1">
                  {platform.syncSettings.orderSync.direction.toUpperCase()}
                </div>
              </div>
            </div>

            {/* Sync Settings */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">
                Sync Settings
              </h4>
              <div className="space-y-2">
                {[
                  {
                    label: 'Product Sync',
                    enabled: platform.syncSettings.productSync.enabled,
                  },
                  {
                    label: 'Order Sync',
                    enabled: platform.syncSettings.orderSync.enabled,
                  },
                  {
                    label: 'Inventory Sync',
                    enabled: platform.syncSettings.inventorySync.enabled,
                  },
                  {
                    label: 'Customer Sync',
                    enabled: platform.syncSettings.customerSync.enabled,
                  },
                ].map((setting) => (
                  <div
                    key={setting.label}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-wl-text-secondary">
                      {setting.label}
                    </span>
                    <Badge variant={setting.enabled ? 'success' : 'default'}>
                      {setting.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Webhooks */}
            {platform.webhooks.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-white mb-3">
                  Webhooks ({platform.webhooks.length})
                </h4>
                <div className="space-y-2">
                  {platform.webhooks.map((hook) => (
                    <div
                      key={hook.id}
                      className="flex items-center justify-between p-2 bg-wl-bg-surface rounded text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-wl-text-secondary">{hook.event}</span>
                        <Badge
                          variant={
                            hook.status === 'active' ? 'success' : 'danger'
                          }
                          dot
                        >
                          {hook.status}
                        </Badge>
                      </div>
                      <span className="text-xs text-wl-text-tertiary">
                        {new Date(hook.lastTriggered).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {platform.status === 'connected' && (
              <div className="flex gap-2 pt-4 border-t border-wl-border-default">
                <Button variant="secondary" size="sm">
                  Edit Configuration
                </Button>
                <Button variant="danger" size="sm">
                  <Trash2 className="w-4 h-4 mr-1" />
                  Disconnect
                </Button>
              </div>
            )}
            {platform.status === 'disconnected' && (
              <Button variant="primary" size="sm" className="w-full">
                Connect {platform.name}
              </Button>
            )}
            {platform.status === 'error' && (
              <div className="p-3 bg-wl-danger-bg border border-wl-danger-600/30 rounded text-sm text-wl-danger-400">
                Sync failed. Check webhooks configuration and try again.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
