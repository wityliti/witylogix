'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Settings } from 'lucide-react';

interface WarehouseConnection {
  id: string;
  provider: string;
  name: string;
  warehouseCount: number;
  syncStatus: "SYNCING" | "SYNCED" | "FAILED" | "PENDING";
  lastSync: string;
  nextSync: string;
  errorCount: number;
}

interface WarehouseConnectionCardProps {
  warehouse: WarehouseConnection;
}

const getSyncStatusColor = (status: string) => {
  switch (status) {
    case "SYNCED":
      return "bg-green-500/20 text-green-400 border-green-500/50";
    case "SYNCING":
      return "bg-blue-500/20 text-blue-400 border-blue-500/50";
    case "FAILED":
      return "bg-red-500/20 text-red-400 border-red-500/50";
    case "PENDING":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
    default:
      return "";
  }
};

export function WarehouseConnectionCard({ warehouse }: WarehouseConnectionCardProps) {
  return (
    <Card className="bg-wl-bg-elevated">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-white">{warehouse.name}</h3>
            <p className="text-xs text-wl-text-tertiary mt-1">{warehouse.warehouseCount} warehouses</p>
          </div>
          <Badge className={cn("capitalize border", getSyncStatusColor(warehouse.syncStatus))}>
            {warehouse.syncStatus}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-wl-border-default">
          <div>
            <p className="text-xs font-medium text-wl-text-tertiary uppercase">Last Sync</p>
            <p className="text-sm font-semibold text-white mt-1">{warehouse.lastSync}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-wl-text-tertiary uppercase">Next Sync</p>
            <p className="text-sm font-semibold text-white mt-1">{warehouse.nextSync}</p>
          </div>
        </div>

        {warehouse.errorCount > 0 && (
          <div className="mb-4 p-3 bg-red-500/10 rounded-lg border border-red-500/30 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400">{warehouse.errorCount} sync error{warehouse.errorCount > 1 ? "s" : ""}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="secondary" size="sm" className="flex-1 bg-wl-bg-surface hover:bg-wl-bg-elevated">
            <RefreshCw className="w-4 h-4 mr-2" />Sync Now
          </Button>
          <Button variant="secondary" size="sm" className="flex-1 bg-wl-bg-surface hover:bg-wl-bg-elevated">
            <Settings className="w-4 h-4 mr-2" />Configure
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
