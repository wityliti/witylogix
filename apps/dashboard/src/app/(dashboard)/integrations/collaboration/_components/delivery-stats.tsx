'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface DeliveryStats {
  provider: string;
  sent: number;
  delivered: number;
  failed: number;
  avgLatency: string;
}

interface DeliveryStatsProps {
  stats: DeliveryStats[];
}

export function DeliveryStats({ stats }: DeliveryStatsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {stats.map((stat) => {
        const successRate = ((stat.delivered / stat.sent) * 100).toFixed(1);
        return (
          <Card key={stat.provider} className="bg-wl-bg-elevated">
            <CardHeader>
              <CardTitle className="text-base">{stat.provider}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">
                      Sent
                    </p>
                    <p className="text-xl font-bold text-white mt-1">
                      {stat.sent.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">
                      Delivered
                    </p>
                    <p className="text-xl font-bold text-green-400 mt-1">
                      {stat.delivered.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">
                      Failed
                    </p>
                    <p className="text-xl font-bold text-red-400 mt-1">
                      {stat.failed}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-wl-border-default">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-500 uppercase">
                      Success Rate
                    </p>
                    <p className="text-sm font-bold text-green-400">
                      {successRate}%
                    </p>
                  </div>
                  <div className="w-full h-2 bg-wl-bg-surface rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-green-400"
                      style={{ width: `${successRate}%` }}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-wl-border-default">
                  <p className="text-xs font-medium text-gray-500 uppercase">
                    Avg Latency
                  </p>
                  <p className="text-lg font-bold text-white mt-1">
                    {stat.avgLatency}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
