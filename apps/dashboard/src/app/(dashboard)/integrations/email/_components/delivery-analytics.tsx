'use client';

import { Card, CardContent } from '@/components/ui/card';

interface DeliveryMetrics {
  template: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
}

interface DeliveryAnalyticsProps {
  metrics: DeliveryMetrics[];
}

export function DeliveryAnalytics({ metrics }: DeliveryAnalyticsProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">
        Delivery Analytics (24h)
      </h2>

      <Card className="bg-[#1a1a2e] border-[#1e1e2e]">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {metrics.map((metric) => {
              const delivered = (
                (metric.delivered / metric.sent) *
                100
              ).toFixed(0);
              const opened = (
                (metric.opened / metric.delivered) *
                100
              ).toFixed(0);
              const clicked = (
                (metric.clicked / metric.delivered) *
                100
              ).toFixed(0);
              const bounced = ((metric.bounced / metric.sent) * 100).toFixed(0);

              return (
                <div
                  key={metric.template}
                  className="border border-[#1e1e2e] rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-white">
                      {metric.template}
                    </h4>
                    <span className="text-sm text-gray-500">
                      {metric.sent.toLocaleString()} sent
                    </span>
                  </div>

                  {/* Stacked Bar Chart */}
                  <div className="flex h-8 rounded-lg overflow-hidden bg-[#12121a]">
                    <div
                      className="bg-emerald-500 flex items-center justify-center text-xs font-bold text-white"
                      style={{
                        width: `${delivered}%`,
                      }}
                      title={`Delivered: ${metric.delivered}`}
                    >
                      {delivered > 15 && `${delivered}%`}
                    </div>
                    <div
                      className="bg-cyan-500 flex items-center justify-center text-xs font-bold text-white"
                      style={{
                        width: `${(metric.opened / metric.sent) * 100}%`,
                      }}
                      title={`Opened: ${metric.opened}`}
                    >
                      {(metric.opened / metric.sent) * 100 > 10 &&
                        `${((metric.opened / metric.sent) * 100).toFixed(0)}%`}
                    </div>
                    <div
                      className="bg-blue-500 flex items-center justify-center text-xs font-bold text-white"
                      style={{
                        width: `${(metric.clicked / metric.sent) * 100}%`,
                      }}
                      title={`Clicked: ${metric.clicked}`}
                    >
                      {(metric.clicked / metric.sent) * 100 > 5 &&
                        `${((metric.clicked / metric.sent) * 100).toFixed(0)}%`}
                    </div>
                    <div
                      className="bg-red-500 flex items-center justify-center text-xs font-bold text-white"
                      style={{
                        width: `${bounced}%`,
                      }}
                      title={`Bounced: ${metric.bounced}`}
                    >
                      {bounced > 5 && `${bounced}%`}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
                    <div>
                      <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full mr-1" />
                      <span className="text-gray-500">
                        Delivered: {metric.delivered}
                      </span>
                    </div>
                    <div>
                      <span className="inline-block w-2 h-2 bg-cyan-500 rounded-full mr-1" />
                      <span className="text-gray-500">
                        Opened: {metric.opened}
                      </span>
                    </div>
                    <div>
                      <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-1" />
                      <span className="text-gray-500">
                        Clicked: {metric.clicked}
                      </span>
                    </div>
                    <div>
                      <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1" />
                      <span className="text-gray-500">
                        Bounced: {metric.bounced}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
