'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Eye,
  AlertTriangle,
  Truck,
  Activity,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface Driver {
  id: string;
  name: string;
  driverId: string;
  status: "driving" | "on-duty" | "sleeper" | "off-duty";
  currentHOS: {
    driving: number;
    onDuty: number;
    sleeper: number;
    offDuty: number;
  };
  hosViolations: number;
  nextBreak?: string;
  vehicle?: string;
  location?: string;
  lastUpdate: string;
}

interface DriverStatusCardProps {
  driver: Driver;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "driving":
      return "bg-wl-info-500/20 text-wl-info-400 border-wl-info-500/50";
    case "on-duty":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
    case "sleeper":
      return "bg-purple-500/20 text-purple-400 border-purple-500/50";
    case "off-duty":
      return "bg-wl-success-500/20 text-wl-success-400 border-green-500/50";
    default:
      return "";
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "driving":
      return <Truck className="w-4 h-4" />;
    case "on-duty":
      return <Activity className="w-4 h-4" />;
    case "sleeper":
      return <Clock className="w-4 h-4" />;
    case "off-duty":
      return <CheckCircle2 className="w-4 h-4" />;
    default:
      return null;
  }
};

export function DriverStatusCard({ driver }: DriverStatusCardProps) {
  return (
    <Card className="bg-wl-bg-elevated">
      <CardContent className="pt-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-white">
                {driver.name}
              </h3>
              <Badge variant="default" className="font-mono text-xs">
                {driver.driverId}
              </Badge>
            </div>
            <p className="text-xs text-wl-text-tertiary">
              Vehicle: {driver.vehicle} • {driver.location}
            </p>
          </div>
          <div className={cn(
            "px-3 py-2 rounded-lg border capitalize font-semibold text-sm flex items-center gap-2",
            getStatusColor(driver.status)
          )}>
            {getStatusIcon(driver.status)}
            {driver.status.replace("-", " ")}
          </div>
        </div>

        {/* HOS Stats Grid */}
        <div className="grid grid-cols-4 gap-3 mb-6 pb-6 border-b border-wl-border-default">
          <div className="text-center">
            <p className="text-xs font-medium text-wl-text-tertiary uppercase">
              Driving
            </p>
            <p className="text-lg font-bold text-wl-info-400 mt-1">
              {driver.currentHOS.driving}h
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-wl-text-tertiary uppercase">
              On-Duty
            </p>
            <p className="text-lg font-bold text-yellow-400 mt-1">
              {driver.currentHOS.onDuty}h
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-wl-text-tertiary uppercase">
              Sleeper
            </p>
            <p className="text-lg font-bold text-purple-400 mt-1">
              {driver.currentHOS.sleeper}h
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs font-medium text-wl-text-tertiary uppercase">
              Off-Duty
            </p>
            <p className="text-lg font-bold text-wl-success-400 mt-1">
              {driver.currentHOS.offDuty}h
            </p>
          </div>
        </div>

        {/* Break Status */}
        <div className="mb-4 pb-4 border-b border-wl-border-default">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-wl-text-tertiary uppercase">
              Break Status
            </p>
            <p className={cn("text-sm font-semibold",
              driver.nextBreak?.includes("URGENT") ? "text-wl-danger-400" : "text-wl-success-400"
            )}>
              {driver.nextBreak}
            </p>
          </div>
        </div>

        {/* Violations & Actions */}
        <div className="flex items-center justify-between">
          {driver.hosViolations > 0 && (
            <Badge variant="danger" className="bg-wl-danger-500/20 text-wl-danger-400">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {driver.hosViolations} violation{driver.hosViolations > 1 ? "s" : ""}
            </Badge>
          )}
          <div className="flex gap-2 ml-auto">
            <Button
              variant="secondary"
              size="sm"
              className="bg-wl-bg-surface hover:bg-wl-bg-elevated"
            >
              <Eye className="w-4 h-4 mr-2" />
              Details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
