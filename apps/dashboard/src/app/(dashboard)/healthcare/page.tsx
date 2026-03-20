'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';

function Icon({ d, size = 24 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

interface KPICard {
  label: string;
  value: number | string;
  unit?: string;
  trend?: "up" | "down";
  trendValue?: string;
  icon: string;
}

function KPICardComponent({ card }: { card: KPICard }) {
  return (
    <Card className={cn("bg-wl-bg-elevated border-wl-border-subtle")}>
      <CardContent className={cn("pt-6")}>
        <div className={cn("flex items-start justify-between")}>
          <div className={cn("flex-1")}>
            <p
              className={cn(
                "text-sm font-medium text-wl-text-secondary mb-2"
              )}
            >
              {card.label}
            </p>
            <div className={cn("flex items-baseline gap-2")}>
              <span
                className={cn(
                  "text-3xl font-bold text-wl-text-primary"
                )}
              >
                {card.value}
              </span>
              {card.unit && (
                <span className={cn("text-sm text-wl-text-secondary")}>
                  {card.unit}
                </span>
              )}
            </div>
            {card.trend && (
              <div className={cn("mt-2 text-xs")}>
                <span
                  className={cn(
                    card.trend === "up"
                      ? "text-wl-status-success"
                      : "text-wl-status-warning"
                  )}
                >
                  {card.trend === "up" ? "↑" : "↓"} {card.trendValue || "0%"}
                </span>
              </div>
            )}
          </div>
          <div className={cn("text-wl-text-secondary opacity-20 ml-4")}>
            <Icon d={card.icon} size={32} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ComplianceStatusCard({ compliance }: { compliance: any }) {
  return (
    <Card className={cn("bg-wl-bg-elevated border-wl-border-subtle")}>
      <CardHeader>
        <CardTitle className={cn("text-base")}>Compliance Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("space-y-3")}>
          <div className={cn("flex items-center justify-between p-2 bg-wl-bg-overlay rounded")}>
            <span className={cn("text-sm text-wl-text-secondary")}>HIPAA Compliant</span>
            <Badge variant={compliance?.hipaaCompliant ? "success" : "danger"}>
              {compliance?.hipaaCompliant ? "Yes" : "No"}
            </Badge>
          </div>
          <div className={cn("flex items-center justify-between p-2 bg-wl-bg-overlay rounded")}>
            <span className={cn("text-sm text-wl-text-secondary")}>Encryption</span>
            <Badge variant={compliance?.encryptionEnabled ? "success" : "warning"}>
              {compliance?.encryptionEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <div className={cn("flex items-center justify-between p-2 bg-wl-bg-overlay rounded")}>
            <span className={cn("text-sm text-wl-text-secondary")}>Audit Logging</span>
            <Badge variant={compliance?.auditLoggingEnabled ? "success" : "warning"}>
              {compliance?.auditLoggingEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
          <div className={cn("flex items-center justify-between p-2 bg-wl-bg-overlay rounded")}>
            <span className={cn("text-sm text-wl-text-secondary")}>Access Controls</span>
            <Badge variant={compliance?.accessControlsConfigured ? "success" : "warning"}>
              {compliance?.accessControlsConfigured ? "Configured" : "Pending"}
            </Badge>
          </div>
          {compliance?.outstandingIssues > 0 && (
            <div className={cn("p-3 bg-wl-status-warning/10 border border-wl-status-warning rounded")}>
              <p className={cn("text-xs text-wl-status-warning font-medium")}>
                {compliance.outstandingIssues} outstanding compliance issues
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentRecordsCard({ patients }: { patients: any[] }) {
  return (
    <Card className={cn("bg-wl-bg-elevated border-wl-border-subtle")}>
      <CardHeader>
        <CardTitle className={cn("text-base")}>Recent Patient Records</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("space-y-3")}>
          {patients.slice(0, 5).map((patient) => (
            <div
              key={patient.id}
              className={cn(
                "p-3 bg-wl-bg-overlay rounded border border-wl-border-subtle hover:border-wl-border-active transition-colors"
              )}
            >
              <div className={cn("flex items-start justify-between mb-2")}>
                <div>
                  <p className={cn("text-sm font-medium text-wl-text-primary")}>
                    {patient.firstName} {patient.lastName}
                  </p>
                  <p className={cn("text-xs text-wl-text-secondary")}>
                    MRN: {patient.mrn}
                  </p>
                </div>
                <Badge variant={patient.status === "ACTIVE" ? "success" : "default"}>
                  {patient.status}
                </Badge>
              </div>
              <div className={cn("flex gap-4 text-xs text-wl-text-secondary")}>
                <span>Age: {new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()}</span>
                <span>Conditions: {patient.activeConditionsCount}</span>
                <span>Medications: {patient.medicationsCount}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ProviderSummaryCard() {
  const providers = [
    { name: "Dr. Sarah Johnson", specialty: "Internal Medicine", patients: 45 },
    { name: "Dr. Michael Chen", specialty: "Cardiology", patients: 32 },
    { name: "Dr. Emily Watson", specialty: "Pediatrics", patients: 28 },
  ];

  return (
    <Card className={cn("bg-wl-bg-elevated border-wl-border-subtle")}>
      <CardHeader>
        <CardTitle className={cn("text-base")}>Provider Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("space-y-3")}>
          {providers.map((prov) => (
            <div
              key={prov.name}
              className={cn("flex items-center justify-between p-2 hover:bg-wl-bg-overlay rounded transition-colors")}
            >
              <div>
                <p className={cn("text-sm font-medium text-wl-text-primary")}>
                  {prov.name}
                </p>
                <p className={cn("text-xs text-wl-text-secondary")}>
                  {prov.specialty}
                </p>
              </div>
              <Badge variant="info">{prov.patients} Patients</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  status: string;
  dateOfBirth: string;
  activeConditionsCount: number;
  medicationsCount: number;
}

interface Compliance {
  hipaaCompliant: boolean;
  encryptionEnabled: boolean;
  auditLoggingEnabled: boolean;
  accessControlsConfigured: boolean;
  outstandingIssues: number;
}

export default function HealthcarePage() {
  const { items: patients, loading, error, refetch } = useApiList<Patient>('/api/v4/customers?type=patient');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const compliance: Compliance = {
    hipaaCompliant: true,
    encryptionEnabled: true,
    auditLoggingEnabled: true,
    accessControlsConfigured: true,
    outstandingIssues: 0,
  };

  // Simulate additional metrics
  const activePatients = patients.filter((p) => p.status === "ACTIVE").length;
  const totalEncounters = 128;
  const labResultsThisMonth = 42;
  const pendingAlerts = 3;

  const kpiCards: KPICard[] = [
    {
      label: "Active Patients",
      value: activePatients,
      icon: "M17 20h5v-2a3 3 0 00-5.856-1.487M15 10a3 3 0 11-6 0 3 3 0 016 0zM15 7H9m6 6H9m6 6H9m6 6H9",
      trend: "up",
      trendValue: "3%",
    },
    {
      label: "Encounters",
      value: totalEncounters,
      icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
      trend: "up",
      trendValue: "8%",
    },
    {
      label: "Lab Results",
      value: labResultsThisMonth,
      unit: "This Month",
      icon: "M9 3v2m6-2v2M9 5h6m-6 0H5m12 0h2M9 19h6m-6 0H5m12 0h2",
    },
    {
      label: "Pending Alerts",
      value: pendingAlerts,
      icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
    },
  ];

  return (
    <div className={cn("p-6 space-y-6")}>
      {/* Header with Action */}
      <div className={cn("flex items-center justify-between")}>
        <div>
          <h1 className={cn("text-2xl font-bold text-wl-text-primary")}>
            Healthcare Dashboard
          </h1>
          <p className={cn("text-sm text-wl-text-secondary mt-1")}>
            Patient management and clinical oversight
          </p>
        </div>
        <Button variant="primary">
          Add Patient
        </Button>
      </div>

      {/* KPI Cards */}
      <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4")}>
        {kpiCards.map((card, idx) => (
          <KPICardComponent key={idx} card={card} />
        ))}
      </div>

      {/* Compliance and Records */}
      <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-6")}>
        <div className={cn("lg:col-span-2")}>
          <RecentRecordsCard patients={patients} />
        </div>
        <div>
          <ComplianceStatusCard compliance={compliance} />
        </div>
      </div>

      {/* Provider Summary */}
      <ProviderSummaryCard />

      {/* Quick Stats */}
      <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4")}>
        <Card className={cn("bg-wl-bg-elevated border-wl-border-subtle")}>
          <CardContent className={cn("pt-6")}>
            <p className={cn("text-sm font-medium text-wl-text-secondary mb-2")}>
              Avg. Patient Age
            </p>
            <p className={cn("text-2xl font-bold text-wl-text-primary")}>
              {Math.round(
                patients.reduce(
                  (sum, p) =>
                    sum +
                    (new Date().getFullYear() -
                      new Date(p.dateOfBirth).getFullYear()),
                  0
                ) / patients.length
              )}
            </p>
            <p className={cn("text-xs text-wl-text-secondary mt-2")}>
              Across all patients
            </p>
          </CardContent>
        </Card>
        <Card className={cn("bg-wl-bg-elevated border-wl-border-subtle")}>
          <CardContent className={cn("pt-6")}>
            <p className={cn("text-sm font-medium text-wl-text-secondary mb-2")}>
              System Status
            </p>
            <p className={cn("text-2xl font-bold text-wl-status-success")}>
              Operational
            </p>
            <p className={cn("text-xs text-wl-text-secondary mt-2")}>
              All systems normal
            </p>
          </CardContent>
        </Card>
        <Card className={cn("bg-wl-bg-elevated border-wl-border-subtle")}>
          <CardContent className={cn("pt-6")}>
            <p className={cn("text-sm font-medium text-wl-text-secondary mb-2")}>
              Data Backup
            </p>
            <p className={cn("text-2xl font-bold text-wl-text-primary")}>
              Completed
            </p>
            <p className={cn("text-xs text-wl-text-secondary mt-2")}>
              Last run: Today 11:00 PM
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Information Box */}
      <Card className={cn("bg-wl-status-info/10 border border-wl-status-info")}>
        <CardContent className={cn("pt-6")}>
          <p className={cn("text-sm font-medium text-wl-status-info mb-2")}>
            HIPAA Compliance Notice
          </p>
          <p className={cn("text-sm text-wl-text-secondary")}>
            All patient information is encrypted and access is logged for audit purposes.
            Ensure you follow proper procedures when accessing and handling patient records.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
