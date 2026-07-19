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

      <Card className="bg-wl-bg-elevated border-wl-border-default">
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
                  className="border border-wl-border-default rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-white">
                      {metric.template}
                    </h4>
                    <span className="text-sm text-wl-text-tertiary">
                      {metric.sent.toLocaleString()} sent
                    </span>
                  </div>

                  {/* Stacked Bar Chart */}
                  <div className="flex h-8 rounded-lg overflow-hidden bg-wl-bg-surface">
                    <div
                      className="bg-wl-success-500 flex items-center justify-center text-xs font-bold text-white"
                      style={{
                        width: `${delivered}%`,
                      }}
                      title={`Delivered: ${metric.delivered}`}
                    >
                      {Number(delivered) > 15 && `${delivered}%`}
                    </div>
                    <div
                      className="bg-wl-info-500 flex items-center justify-center text-xs font-bold text-white"
                      style={{
                        width: `${(metric.opened / metric.sent) * 100}%`,
                      }}
                      title={`Opened: ${metric.opened}`}
                    >
                      {(metric.opened / metric.sent) * 100 > 10 &&
                        `${((metric.opened / metric.sent) * 100).toFixed(0)}%`}
                    </div>
                    <div
                      className="bg-wl-info-500 flex items-center justify-center text-xs font-bold text-white"
                      style={{
                        width: `${(metric.clicked / metric.sent) * 100}%`,
                      }}
                      title={`Clicked: ${metric.clicked}`}
                    >
                      {(metric.clicked / metric.sent) * 100 > 5 &&
                        `${((metric.clicked / metric.sent) * 100).toFixed(0)}%`}
                    </div>
                    <div
                      className="bg-wl-danger-500 flex items-center justify-center text-xs font-bold text-white"
                      style={{
                        width: `${bounced}%`,
                      }}
                      title={`Bounced: ${metric.bounced}`}
                    >
                      {Number(bounced) > 5 && `${bounced}%`}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
                    <div>
                      <span className="inline-block w-2 h-2 bg-wl-success-500 rounded-full mr-1" />
                      <span className="text-wl-text-tertiary">
                        Delivered: {metric.delivered}
                      </span>
                    </div>
                    <div>
                      <span className="inline-block w-2 h-2 bg-wl-info-500 rounded-full mr-1" />
                      <span className="text-wl-text-tertiary">
                        Opened: {metric.opened}
                      </span>
                    </div>
                    <div>
                      <span className="inline-block w-2 h-2 bg-wl-info-500 rounded-full mr-1" />
                      <span className="text-wl-text-tertiary">
                        Clicked: {metric.clicked}
                      </span>
                    </div>
                    <div>
                      <span className="inline-block w-2 h-2 bg-wl-danger-500 rounded-full mr-1" />
                      <span className="text-wl-text-tertiary">
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
