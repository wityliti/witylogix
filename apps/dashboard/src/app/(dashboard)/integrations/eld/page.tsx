'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft, Activity, Truck, Zap } from 'lucide-react';
import { ELDProviderCard } from './_components/eld-provider-card';
import { DriverStatusCard } from './_components/driver-status-card';
import { DVIRReportCard } from './_components/dvir-report-card';
import { ComplianceMetricCard } from './_components/compliance-metric-card';
import { ViolationAlertCard } from './_components/violation-alert-card';

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

interface DVIRIssue {
  id: string;
  category: string;
  severity: "critical" | "warning" | "info";
  description: string;
  resolved: boolean;
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
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] to-[#12121a]">
      <Header
        title="ELD Integrations"
        subtitle="Manage electronic logging devices, HOS compliance, and vehicle inspection reports"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link href="/integrations">
          <Button variant="ghost" className="mb-8 text-gray-400 hover:text-white">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Integrations
          </Button>
        </Link>

        {/* ELD Providers */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("providers")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">ELD Providers</h2>
              <Badge variant="primary" className="bg-blue-500/30 text-blue-500">
                {providers.filter((p) => p.status === "connected").length} connected
              </Badge>
            </div>
            <ChevronLeft className={cn("w-5 h-5 text-gray-400 transition-transform", expandedSections.providers ? "rotate-90" : "")} />
          </div>
          {expandedSections.providers && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {providers.map((provider) => (
                <ELDProviderCard key={provider.id} provider={provider} />
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
              <h2 className="text-2xl font-bold text-white">Driver Status Board</h2>
              <Badge variant="warning" className="bg-yellow-500/20 text-yellow-400">
                {totalViolations} violations
              </Badge>
            </div>
            <ChevronLeft className={cn("w-5 h-5 text-gray-400 transition-transform", expandedSections.drivers ? "rotate-90" : "")} />
          </div>
          {expandedSections.drivers && (
            <div className="space-y-4">
              {drivers.map((driver) => (
                <DriverStatusCard key={driver.id} driver={driver} />
              ))}
            </div>
          )}
        </div>

        {/* DVIR Reports */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("dvir")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">DVIR Reports</h2>
              <Badge variant="danger" className="bg-red-500/20 text-red-400">
                {dvirReports.filter((r) => r.status === "fail").length} failures
              </Badge>
            </div>
            <ChevronLeft className={cn("w-5 h-5 text-gray-400 transition-transform", expandedSections.dvir ? "rotate-90" : "")} />
          </div>
          {expandedSections.dvir && (
            <div className="space-y-4">
              {dvirReports.map((report) => (
                <DVIRReportCard key={report.id} report={report} />
              ))}
            </div>
          )}
        </div>

        {/* Compliance Metrics */}
        <div className="mb-8">
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("compliance")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">Compliance Metrics</h2>
              <Badge variant="success" className="bg-green-500/20 text-green-400">
                Fleet average: 96%
              </Badge>
            </div>
            <ChevronLeft className={cn("w-5 h-5 text-gray-400 transition-transform", expandedSections.compliance ? "rotate-90" : "")} />
          </div>
          {expandedSections.compliance && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {complianceMetrics.map((metric) => (
                <ComplianceMetricCard key={metric.metric} metric={metric} />
              ))}
            </div>
          )}
        </div>

        {/* Violation Alerts */}
        <div>
          <div
            className="flex items-center justify-between mb-6 cursor-pointer"
            onClick={() => toggleSection("violations")}
          >
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">Violation Alerts</h2>
              <Badge variant="danger" className="bg-red-500/20 text-red-400">
                {violationAlerts.filter((a) => a.severity === "critical").length} critical
              </Badge>
            </div>
            <ChevronLeft className={cn("w-5 h-5 text-gray-400 transition-transform", expandedSections.violations ? "rotate-90" : "")} />
          </div>
          {expandedSections.violations && (
            <div className="space-y-4">
              {violationAlerts.map((alert) => (
                <ViolationAlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
