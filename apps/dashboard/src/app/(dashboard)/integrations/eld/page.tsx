"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ChevronLeft,
  Plus,
  Settings,
  Power,
  CheckCircle2,
  AlertCircle,
  Clock,
  Activity,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Eye,
  Download,
  Truck,
  Zap,
} from "lucide-react";

interface ELDProvider {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: "connected" | "disconnected" | "error";
  connectedAt?: string;
  drivers?: number;
  vehicles?: number;
  lastSync?: string;
}

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

interface DVIRIssue {
  id: string;
  category: string;
  severity: "critical" | "warning" | "info";
  description: string;
  resolved: boolean;
}

interface ComplianceMetric {
  metric: string;
  value: number;
  target: number;
  status: "compliant" | "warning" | "violation";
}

interface ViolationAlert {
  id: string;
  driverId: string;
  driverName: string;
  type: string;
  severity: "critical" | "warning" | "info";
  timestamp: string;
  details: string;
}

const providers: ELDProvider[] = [
  {
    id: "motive",
    name: "Motive",
    icon: <Truck className="w-5 h-5" />,
    status: "connected",
    connectedAt: "2025-11-01",
    drivers: 42,
    vehicles: 35,
    lastSync: "2026-03-12 14:32",
  },
  {
    id: "omnitracs",
    name: "Omnitracs ELD",
    icon: <Activity className="w-5 h-5" />,
    status: "connected",
    connectedAt: "2025-10-15",
    drivers: 28,
    vehicles: 22,
    lastSync: "2026-03-12 14:28",
  },
  {
    id: "azuga",
    name: "Azuga ELD",
    icon: <Zap className="w-5 h-5" />,
    status: "disconnected",
    drivers: 0,
    vehicles: 0,
  },
];

const drivers: Driver[] = [
  {
    id: "drv-001",
    name: "James Murphy",
    driverId: "DRV-00156",
    status: "driving",
    currentHOS: { driving: 6, onDuty: 2, sleeper: 10, offDuty: 6 },
    hosViolations: 0,
    nextBreak: "2:30 PM",
    vehicle: "TRK-001",
    location: "I-95 North, GA",
    lastUpdate: "now",
  },
  {
    id: "drv-002",
    name: "Sarah Davis",
    driverId: "DRV-00234",
    status: "on-duty",
    currentHOS: { driving: 0, onDuty: 3, sleeper: 10, offDuty: 11 },
    hosViolations: 0,
    nextBreak: "Break taken",
    vehicle: "TRK-002",
    location: "Loading dock, FL",
    lastUpdate: "1m ago",
  },
  {
    id: "drv-003",
    name: "Mike Thompson",
    driverId: "DRV-00189",
    status: "sleeper",
    currentHOS: { driving: 0, onDuty: 0, sleeper: 7, offDuty: 17 },
    hosViolations: 1,
    nextBreak: "Rest period active",
    vehicle: "TRK-003",
    location: "Rest area, SC",
    lastUpdate: "5m ago",
  },
  {
    id: "drv-004",
    name: "Emma Wilson",
    driverId: "DRV-00412",
    status: "off-duty",
    currentHOS: { driving: 0, onDuty: 0, sleeper: 10, offDuty: 14 },
    hosViolations: 0,
    nextBreak: "Off duty",
    vehicle: "TRK-004",
    location: "Distribution center, NC",
    lastUpdate: "22m ago",
  },
  {
    id: "drv-005",
    name: "Robert Garcia",
    driverId: "DRV-00567",
    status: "driving",
    currentHOS: { driving: 8, onDuty: 1, sleeper: 9, offDuty: 6 },
    hosViolations: 2,
    nextBreak: "URGENT: 30min break required",
    vehicle: "TRK-005",
    location: "I-10 East, TX",
    lastUpdate: "now",
  },
];

const dvirReports: DVIRReport[] = [
  {
    id: "dvir-001",
    driverId: "drv-001",
    driverName: "James Murphy",
    vehicleId: "VEH-001",
    vehicle: "TRK-001 (2023 Volvo VNL)",
    date: "2026-03-12",
    status: "pass",
    issues: [],
  },
  {
    id: "dvir-002",
    driverId: "drv-002",
    driverName: "Sarah Davis",
    vehicleId: "VEH-002",
    vehicle: "TRK-002 (2022 Freightliner Cascadia)",
    date: "2026-03-12",
    status: "fail",
    issues: [
      {
        id: "issue-001",
        category: "Brakes",
        severity: "critical",
        description: "Air pressure low - requires maintenance",
        resolved: false,
      },
      {
        id: "issue-002",
        category: "Lights",
        severity: "warning",
        description: "Right marker light not functioning",
        resolved: false,
      },
    ],
  },
  {
    id: "dvir-003",
    driverId: "drv-003",
    driverName: "Mike Thompson",
    vehicleId: "VEH-003",
    vehicle: "TRK-003 (2023 Peterbilt 389)",
    date: "2026-03-11",
    status: "pass",
    issues: [],
  },
  {
    id: "dvir-004",
    driverId: "drv-005",
    driverName: "Robert Garcia",
    vehicleId: "VEH-005",
    vehicle: "TRK-005 (2021 Mack Granite)",
    date: "2026-03-12",
    status: "pending",
    issues: [
      {
        id: "issue-003",
        category: "Tires",
        severity: "warning",
        description: "Tread wear on rear axle tires observed",
        resolved: false,
      },
    ],
  },
];

const complianceMetrics: ComplianceMetric[] = [
  { metric: "HOS Compliance", value: 98, target: 95, status: "compliant" },
  { metric: "DVIR Completion", value: 96, target: 100, status: "warning" },
  { metric: "Pre-Inspection Pass Rate", value: 94, target: 95, status: "warning" },
  { metric: "On-Time Maintenance", value: 91, target: 90, status: "compliant" },
  { metric: "Record Accuracy", value: 99, target: 95, status: "compliant" },
];

const violationAlerts: ViolationAlert[] = [
  {
    id: "alert-001",
    driverId: "drv-005",
    driverName: "Robert Garcia",
    type: "Hours of Service Violation",
    severity: "critical",
    timestamp: "2026-03-12 14:15",
    details: "Driver has exceeded maximum driving hours. 30-minute break required immediately.",
  },
  {
    id: "alert-002",
    driverId: "drv-003",
    driverName: "Mike Thompson",
    type: "Minor HOS Violation",
    severity: "warning",
    timestamp: "2026-03-12 09:32",
    details: "Potential violation detected. Driver status change may be needed.",
  },
  {
    id: "alert-003",
    driverId: "drv-002",
    driverName: "Sarah Davis",
    type: "DVIR Defect Severity",
    severity: "critical",
    timestamp: "2026-03-12 13:45",
    details: "Critical brake system defect reported. Vehicle must not operate until repaired.",
  },
  {
    id: "alert-004",
    driverId: "drv-001",
    driverName: "James Murphy",
    type: "Maintenance Due",
    severity: "info",
    timestamp: "2026-03-11 08:00",
    details: "Scheduled maintenance due in 500 miles.",
  },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "driving":
      return "bg-blue-500/20 text-blue-400 border-blue-500/50";
    case "on-duty":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
    case "sleeper":
      return "bg-purple-500/20 text-purple-400 border-purple-500/50";
    case "off-duty":
      return "bg-green-500/20 text-green-400 border-green-500/50";
    case "pass":
      return "bg-green-500/20 text-green-400 border-green-500/50";
    case "fail":
      return "bg-red-500/20 text-red-400 border-red-500/50";
    case "pending":
      return "bg-gray-500/20 text-gray-400 border-gray-500/50";
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

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "critical":
      return "bg-red-500/20 text-red-400 border-red-500/50";
    case "warning":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/50";
    case "info":
      return "bg-blue-500/20 text-blue-400 border-blue-500/50";
    default:
      return "";
  }
};

export default function ELDPage() {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    providers: true,
    drivers: true,
    dvir: true,
    compliance: true,
    violations: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const totalViolations = drivers.reduce((sum, d) => sum + d.hosViolations, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--wl-bg-primary)] to-[var(--wl-bg-secondary)]">
      <Header
        title="ELD Integrations"
        subtitle="Manage electronic logging devices, HOS compliance, and vehicle inspection reports"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <Link href="/integrations">
          <Button
            variant="ghost"
            className="mb-8 text-[var(--wl-text-secondary)] hover:text-[var(--wl-text-primary)]"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Integrations
          </Button>
        </Link>

        {/* Providers Section */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("providers")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-[var(--wl-text-primary)]">
                ELD Providers
              </h2>
              <Badge variant="primary" className="bg-[var(--wl-primary)]/30 text-[var(--wl-primary)]">
                {providers.filter((p) => p.status === "connected").length} connected
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-[var(--wl-text-secondary)] transition-transform",
                expandedSections.providers ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.providers && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {providers.map((provider) => (
                <Card key={provider.id} className="hover:border-[var(--wl-primary)]/50">
                  <CardContent className="pt-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="text-[var(--wl-primary)] text-2xl">{provider.icon}</div>
                        <div>
                          <h3 className="text-lg font-semibold text-[var(--wl-text-primary)]">
                            {provider.name}
                          </h3>
                        </div>
                      </div>
                      <Badge
                        variant={provider.status === "connected" ? "success" : provider.status === "error" ? "danger" : "default"}
                        className={cn(
                          provider.status === "connected" && "bg-green-500/20 text-green-400 border border-green-500/50",
                          provider.status === "error" && "bg-red-500/20 text-red-400 border border-red-500/50"
                        )}
                      >
                        {provider.status === "connected" && (
                          <>
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Connected
                          </>
                        )}
                        {provider.status === "disconnected" && "Disconnected"}
                        {provider.status === "error" && (
                          <>
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Error
                          </>
                        )}
                      </Badge>
                    </div>

                    {provider.status === "connected" && (
                      <>
                        <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-[var(--wl-border)]">
                          <div>
                            <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                              Drivers
                            </p>
                            <p className="text-2xl font-bold text-[var(--wl-text-primary)] mt-1">
                              {provider.drivers}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                              Vehicles
                            </p>
                            <p className="text-2xl font-bold text-[var(--wl-text-primary)] mt-1">
                              {provider.vehicles}
                            </p>
                          </div>
                        </div>

                        <div className="mb-6">
                          <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                            Last Sync
                          </p>
                          <p className="text-sm text-[var(--wl-text-primary)] mt-1 flex items-center gap-2">
                            <Clock className="w-3 h-3 text-green-500" />
                            {provider.lastSync}
                          </p>
                        </div>
                      </>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      {provider.status === "connected" ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1 bg-[var(--wl-bg-secondary)] hover:bg-[var(--wl-bg-tertiary)]"
                          >
                            <Settings className="w-4 h-4 mr-2" />
                            Settings
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            className="flex-1 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                          >
                            <Power className="w-4 h-4 mr-2" />
                            Disconnect
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          className="flex-1 bg-[var(--wl-primary)] hover:bg-[var(--wl-primary)]/90"
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
          )}
        </div>

        {/* Driver Status Board */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("drivers")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-[var(--wl-text-primary)]">
                Driver Status Board
              </h2>
              <Badge variant="warning" className="bg-yellow-500/20 text-yellow-400">
                {totalViolations} violations
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-[var(--wl-text-secondary)] transition-transform",
                expandedSections.drivers ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.drivers && (
            <div className="space-y-4">
              {drivers.map((driver) => (
                <Card key={driver.id} className="bg-[var(--wl-bg-tertiary)]">
                  <CardContent className="pt-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-[var(--wl-text-primary)]">
                            {driver.name}
                          </h3>
                          <Badge variant="default" className="font-mono text-xs">
                            {driver.driverId}
                          </Badge>
                        </div>
                        <p className="text-xs text-[var(--wl-text-tertiary)]">
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
                    <div className="grid grid-cols-4 gap-3 mb-6 pb-6 border-b border-[var(--wl-border)]">
                      <div className="text-center">
                        <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                          Driving
                        </p>
                        <p className="text-lg font-bold text-blue-400 mt-1">
                          {driver.currentHOS.driving}h
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                          On-Duty
                        </p>
                        <p className="text-lg font-bold text-yellow-400 mt-1">
                          {driver.currentHOS.onDuty}h
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                          Sleeper
                        </p>
                        <p className="text-lg font-bold text-purple-400 mt-1">
                          {driver.currentHOS.sleeper}h
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                          Off-Duty
                        </p>
                        <p className="text-lg font-bold text-green-400 mt-1">
                          {driver.currentHOS.offDuty}h
                        </p>
                      </div>
                    </div>

                    {/* Break Status */}
                    <div className="mb-4 pb-4 border-b border-[var(--wl-border)]">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase">
                          Break Status
                        </p>
                        <p className={cn("text-sm font-semibold",
                          driver.nextBreak?.includes("URGENT") ? "text-red-400" : "text-green-400"
                        )}>
                          {driver.nextBreak}
                        </p>
                      </div>
                    </div>

                    {/* Violations & Actions */}
                    <div className="flex items-center justify-between">
                      {driver.hosViolations > 0 && (
                        <Badge variant="danger" className="bg-red-500/20 text-red-400">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {driver.hosViolations} violation{driver.hosViolations > 1 ? "s" : ""}
                        </Badge>
                      )}
                      <div className="flex gap-2 ml-auto">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="bg-[var(--wl-bg-secondary)] hover:bg-[var(--wl-bg-tertiary)]"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* DVIR Reports Section */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("dvir")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-[var(--wl-text-primary)]">
                DVIR Reports
              </h2>
              <Badge variant="danger" className="bg-red-500/20 text-red-400">
                {dvirReports.filter((r) => r.status === "fail").length} failures
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-[var(--wl-text-secondary)] transition-transform",
                expandedSections.dvir ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.dvir && (
            <div className="space-y-4">
              {dvirReports.map((report) => (
                <Card key={report.id} className="bg-[var(--wl-bg-tertiary)]">
                  <CardContent className="pt-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-[var(--wl-text-primary)]">
                          {report.vehicle}
                        </h3>
                        <p className="text-xs text-[var(--wl-text-tertiary)] mt-1">
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
                      <div className="mb-4 pb-4 border-b border-[var(--wl-border)]">
                        <p className="text-xs font-medium text-[var(--wl-text-tertiary)] uppercase mb-3">
                          Reported Issues
                        </p>
                        <div className="space-y-2">
                          {report.issues.map((issue) => (
                            <div key={issue.id} className="flex items-start gap-3 p-3 bg-[var(--wl-bg-secondary)] rounded-lg">
                              <div className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                                issue.severity === "critical" ? "bg-red-500" : issue.severity === "warning" ? "bg-yellow-500" : "bg-blue-500"
                              )} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold text-sm text-[var(--wl-text-primary)]">
                                    {issue.category}
                                  </p>
                                  <Badge variant="secondary" className={cn("text-xs capitalize", getSeverityColor(issue.severity))}>
                                    {issue.severity}
                                  </Badge>
                                </div>
                                <p className="text-xs text-[var(--wl-text-tertiary)]">
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
                        variant="secondary"
                        size="sm"
                        className="flex-1 bg-[var(--wl-bg-secondary)] hover:bg-[var(--wl-bg-tertiary)]"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Report
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 bg-[var(--wl-bg-secondary)] hover:bg-[var(--wl-bg-tertiary)]"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Compliance Score Section */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("compliance")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-[var(--wl-text-primary)]">
                Compliance Metrics
              </h2>
              <Badge variant="success" className="bg-green-500/20 text-green-400">
                Fleet average: 96%
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-[var(--wl-text-secondary)] transition-transform",
                expandedSections.compliance ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.compliance && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {complianceMetrics.map((metric) => {
                const difference = metric.value - metric.target;
                const percentage = (metric.value / 100) * 100;
                return (
                  <Card key={metric.metric} className="bg-[var(--wl-bg-tertiary)]">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="text-base font-semibold text-[var(--wl-text-primary)]">
                          {metric.metric}
                        </h3>
                        <Badge
                          variant={metric.status === "compliant" ? "success" : "warning"}
                          className={cn(
                            metric.status === "compliant" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                          )}
                        >
                          {metric.status}
                        </Badge>
                      </div>

                      <div className="flex items-end gap-4 mb-4">
                        <div>
                          <p className="text-3xl font-bold text-[var(--wl-text-primary)]">
                            {metric.value}%
                          </p>
                          <p className="text-xs text-[var(--wl-text-tertiary)] mt-1">
                            Target: {metric.target}%
                          </p>
                        </div>
                        {difference >= 0 ? (
                          <div className="flex items-center gap-1 text-green-400 text-sm font-semibold">
                            <TrendingUp className="w-4 h-4" />
                            +{difference}%
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-red-400 text-sm font-semibold">
                            <TrendingUp className="w-4 h-4 rotate-180" />
                            {difference}%
                          </div>
                        )}
                      </div>

                      <div className="w-full h-2 bg-[var(--wl-bg-secondary)] rounded-full overflow-hidden">
                        <div
                          className={cn("h-full transition-all",
                            metric.status === "compliant" ? "bg-gradient-to-r from-green-500 to-green-400" : "bg-gradient-to-r from-yellow-500 to-yellow-400"
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Violation Alerts Section */}
        <div>
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("violations")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-[var(--wl-text-primary)]">
                Violation Alerts
              </h2>
              <Badge variant="danger" className="bg-red-500/20 text-red-400">
                {violationAlerts.filter((a) => a.severity === "critical").length} critical
              </Badge>
            </div>
            <ChevronLeft
              className={cn(
                "w-5 h-5 text-[var(--wl-text-secondary)] transition-transform",
                expandedSections.violations ? "rotate-90" : ""
              )}
            />
          </div>

          {expandedSections.violations && (
            <div className="space-y-4">
              {violationAlerts.map((alert) => (
                <Card key={alert.id} className={cn(
                  "bg-[var(--wl-bg-tertiary)]",
                  alert.severity === "critical" && "border-red-500/50"
                )}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={cn(
                          "w-2 h-2 rounded-full mt-2 flex-shrink-0",
                          alert.severity === "critical" ? "bg-red-500" : alert.severity === "warning" ? "bg-yellow-500" : "bg-blue-500"
                        )} />
                        <div className="flex-1">
                          <h4 className="font-semibold text-[var(--wl-text-primary)]">
                            {alert.type}
                          </h4>
                          <p className="text-sm text-[var(--wl-text-tertiary)] mt-1">
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

                    <p className="text-sm text-[var(--wl-text-primary)] mb-4 p-3 bg-[var(--wl-bg-secondary)] rounded">
                      {alert.details}
                    </p>

                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        className={cn(
                          "flex-1",
                          alert.severity === "critical"
                            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                            : "bg-[var(--wl-primary)] hover:bg-[var(--wl-primary)]/90"
                        )}
                      >
                        {alert.severity === "critical" ? "Take Action" : "Review"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[var(--wl-text-secondary)] hover:text-[var(--wl-text-primary)]"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
