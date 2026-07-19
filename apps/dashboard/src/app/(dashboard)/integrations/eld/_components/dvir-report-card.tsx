'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Eye,
  Download,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface DVIRIssue {
  id: string;
  category: string;
  severity: "critical" | "warning" | "info";
  description: string;
  resolved: boolean;
}

interface DVIRReport {
  id: string;
  driverId: string;
  driverName: string;
  vehicleId: string;
  vehicle: string;
  date: string;
  status: "pass" | "fail" | "pending";
  issues: DVIRIssue[];
}

interface DVIRReportCardProps {
  report: DVIRReport;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "pass":
      return "bg-wl-success-500/20 text-wl-success-400 border-wl-success-500/50";
    case "fail":
      return "bg-wl-danger-500/20 text-wl-danger-400 border-wl-danger-500/50";
    case "pending":
      return "bg-wl-neutral-500/20 text-wl-text-secondary border-wl-neutral-500/50";
    default:
      return "";
  }
};

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

export function DVIRReportCard({ report }: DVIRReportCardProps) {
  return (
    <Card className="bg-wl-bg-elevated">
      <CardContent className="pt-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-white">
              {report.vehicle}
            </h3>
            <p className="text-xs text-wl-text-tertiary mt-1">
              {report.driverName} • {report.date}
            </p>
          </div>
          <Badge
            variant={report.status === "pass" ? "success" : report.status === "fail" ? "danger" : "default"}
            className={cn(
              "capitalize",
              getStatusColor(report.status)
            )}
          >
            {report.status === "pass" && <CheckCircle2 className="w-3 h-3 mr-1" />}
            {report.status === "fail" && <AlertCircle className="w-3 h-3 mr-1" />}
            {report.status}
          </Badge>
        </div>

        {/* Issues */}
        {report.issues.length > 0 && (
          <div className="mb-4 pb-4 border-b border-wl-border-default">
            <p className="text-xs font-medium text-wl-text-tertiary uppercase mb-3">
              Reported Issues
            </p>
            <div className="space-y-2">
              {report.issues.map((issue) => (
                <div key={issue.id} className="flex items-start gap-3 p-3 bg-wl-bg-surface rounded-lg">
                  <div className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                    issue.severity === "critical" ? "bg-wl-danger-500" : issue.severity === "warning" ? "bg-wl-warning-500" : "bg-wl-info-500"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm text-white">
                        {issue.category}
                      </p>
                      <Badge variant="default" className={cn("text-xs capitalize", getSeverityColor(issue.severity))}>
                        {issue.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-wl-text-tertiary">
                      {issue.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 bg-wl-bg-surface hover:bg-wl-bg-elevated"
          >
            <Eye className="w-4 h-4 mr-2" />
            View Report
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 bg-wl-bg-surface hover:bg-wl-bg-elevated"
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
