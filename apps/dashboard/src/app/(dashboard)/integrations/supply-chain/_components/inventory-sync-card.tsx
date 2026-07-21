'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface InventorySync {
  id: string;
  warehouse: string;
  mode: "REAL_TIME" | "BATCH" | "SCHEDULED";
  interval?: string;
  status: "ACTIVE" | "PAUSED";
  itemsTracked: number;
  lastUpdate: string;
  successRate: number;
}

interface InventorySyncCardProps {
  sync: InventorySync;
}

export function InventorySyncCard({ sync }: InventorySyncCardProps) {
  return (
    <Card className="bg-wl-bg-elevated">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-wl-text-primary">{sync.warehouse}</h3>
            <p className="text-xs text-wl-text-tertiary mt-1">
              {sync.mode} sync
              {sync.interval && ` • ${sync.interval}`}
            </p>
          </div>
          <Badge variant={sync.status === "ACTIVE" ? "success" : "default"} className={cn(sync.status === "ACTIVE" && "bg-wl-success-500/20 text-wl-success-400")}>
            {sync.status}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs font-medium text-wl-text-tertiary uppercase">Items Tracked</p>
            <p className="text-lg font-bold text-white mt-1">{sync.itemsTracked.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-wl-text-tertiary uppercase">Success Rate</p>
            <p className="text-lg font-bold text-white mt-1">{sync.successRate}%</p>
          </div>
        </div>

        <div className="pt-4 border-t border-wl-border-default">
          <p className="text-xs font-medium text-wl-text-tertiary uppercase">Last Update</p>
          <p className="text-xs text-wl-text-secondary mt-1">{sync.lastUpdate}</p>
        </div>
      </CardContent>
    </Card>
  );
}
