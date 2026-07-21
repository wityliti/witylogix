'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ViolationAlert {
  id: string;
  driverId: string;
  driverName: string;
  type: string;
  severity: "critical" | "warning" | "info";
  timestamp: string;
  details: string;
}

interface ViolationAlertCardProps {
  alert: ViolationAlert;
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "critical":
      return "bg-wl-danger-500/20 text-wl-danger-400 border-wl-danger-500/50";
    case "warning":
      return "bg-wl-warning-bg text-wl-warning-400 border-wl-warning-500/50";
    case "info":
      return "bg-wl-info-500/20 text-wl-info-400 border-wl-info-500/50";
    default:
      return "";
  }
};

export function ViolationAlertCard({ alert }: ViolationAlertCardProps) {
  return (
    <Card className={cn(
      "bg-wl-bg-elevated",
      alert.severity === "critical" && "border-wl-danger-500/50"
    )}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3 flex-1">
            <div className={cn(
              "w-2 h-2 rounded-full mt-2 flex-shrink-0",
              alert.severity === "critical" ? "bg-wl-danger-500" : alert.severity === "warning" ? "bg-wl-warning-500" : "bg-wl-info-500"
            )} />
            <div className="flex-1">
              <h4 className="font-semibold text-wl-text-primary">
                {alert.type}
              </h4>
              <p className="text-sm text-wl-text-tertiary mt-1">
                {alert.driverName} • {alert.timestamp}
              </p>
            </div>
          </div>
          <Badge
            variant={alert.severity === "critical" ? "danger" : alert.severity === "warning" ? "warning" : "info"}
            className={cn(
              "capitalize",
              getSeverityColor(alert.severity)
            )}
          >
            {alert.severity}
          </Badge>
        </div>

        <p className="text-sm text-white mb-4 p-3 bg-wl-bg-surface rounded">
          {alert.details}
        </p>

        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            className={cn(
              "flex-1",
              alert.severity === "critical"
                ? "bg-wl-danger-500/20 text-wl-danger-400 hover:bg-wl-danger-500/30"
                : "bg-wl-info-500 hover:bg-wl-info-500"
            )}
          >
            {alert.severity === "critical" ? "Take Action" : "Review"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-wl-text-secondary hover:text-white"
          >
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
