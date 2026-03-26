"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ChevronDownIcon,
  CalendarIcon,
  IdCardIcon,
  AlertCircleIcon,
} from "lucide-react";

interface Patient {
  id: string;
  name: string;
  mrn: string;
  dateOfBirth: Date;
  age: number;
  gender: "M" | "F" | "Other";
  conditions: string[];
  medicationCount: number;
  lastEncounter: Date;
  riskLevel: "low" | "medium" | "high";
  initials: string;
  phone?: string;
  email?: string;
  address?: string;
}

interface PatientCardProps {
  patient: Patient;
  onViewDetails?: () => void;
  className?: string;
}

// Mock patient data
const mockPatient: Patient = {
  id: "PAT-001",
  name: "Margaret Johnson",
  mrn: "MRN-789456",
  dateOfBirth: new Date("1965-03-15"),
  age: 59,
  gender: "F",
  conditions: ["Hypertension", "Type 2 Diabetes", "COPD"],
  medicationCount: 8,
  lastEncounter: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  riskLevel: "high",
  initials: "MJ",
  phone: "(555) 123-4567",
  email: "margaret.johnson@email.com",
  address: "1234 Oak Street, Springfield, IL 62701",
};

const getRiskColor = (
  level: "low" | "medium" | "high"
): "success" | "warning" | "danger" => {
  switch (level) {
    case "low":
      return "success";
    case "medium":
      return "warning";
    case "high":
      return "danger";
  }
};

const getRiskLabel = (level: "low" | "medium" | "high") => {
  switch (level) {
    case "low":
      return "Low Risk";
    case "medium":
      return "Medium Risk";
    case "high":
      return "High Risk";
  }
};

const PatientCard = ({
  patient = mockPatient,
  onViewDetails,
  className,
}: PatientCardProps) => {
  const [expanded, setExpanded] = useState(false);

  const daysAgo = Math.floor(
    (Date.now() - patient.lastEncounter.getTime()) / (24 * 60 * 60 * 1000)
  );

  return (
    <Card className={cn("w-full p-5", className)}>
      <div className="flex items-start gap-4 mb-4">
        <div
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold",
            "flex-shrink-0",
            patient.riskLevel === "high"
              ? "bg-wl-danger-500/20 text-wl-danger-400"
              : patient.riskLevel === "medium"
                ? "bg-wl-warning-500/20 text-wl-warning-400"
                : "bg-wl-success-500/20 text-wl-success-400"
          )}
        >
          {patient.initials}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-wl-text-primary truncate">
            {patient.name}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-wl-text-tertiary">
              {patient.age} y/o • {patient.gender}
            </span>
            <Badge variant={getRiskColor(patient.riskLevel)}>
              {getRiskLabel(patient.riskLevel)}
            </Badge>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="flex-shrink-0"
        >
          <ChevronDownIcon
            className={cn(
              "w-4 h-4 transition-transform",
              expanded && "rotate-180"
            )}
          />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-start gap-2 text-xs">
          <IdCardIcon className="w-4 h-4 text-wl-text-tertiary flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-wl-text-tertiary uppercase tracking-wide">MRN</p>
            <p className="font-medium text-wl-text-primary break-all">
              {patient.mrn}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 text-xs">
          <CalendarIcon className="w-4 h-4 text-wl-text-tertiary flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-wl-text-tertiary uppercase tracking-wide">DOB</p>
            <p className="font-medium text-wl-text-primary">
              {patient.dateOfBirth.toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wide mb-2">
          Conditions
        </p>
        <div className="flex flex-wrap gap-1">
          {patient.conditions.map((condition, idx) => (
            <Badge key={idx} variant="info" className="text-xs">
              {condition}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-wl-bg-overlay rounded-lg border border-wl-border-default">
        <div>
          <p className="text-xs text-wl-text-tertiary uppercase tracking-wide">
            Medications
          </p>
          <p className="text-lg font-bold text-wl-primary-400">
            {patient.medicationCount}
          </p>
        </div>
        <div>
          <p className="text-xs text-wl-text-tertiary uppercase tracking-wide">
            Last Encounter
          </p>
          <p className="text-sm font-medium text-wl-text-primary">
            {daysAgo === 0 ? "Today" : `${daysAgo}d ago`}
          </p>
        </div>
      </div>

      {expanded && (
        <div className="space-y-3 pt-4 border-t border-wl-border-default">
          {patient.phone && (
            <div>
              <p className="text-xs text-wl-text-tertiary uppercase tracking-wide mb-1">
                Phone
              </p>
              <p className="text-sm text-wl-text-primary">{patient.phone}</p>
            </div>
          )}

          {patient.email && (
            <div>
              <p className="text-xs text-wl-text-tertiary uppercase tracking-wide mb-1">
                Email
              </p>
              <p className="text-sm text-wl-text-primary break-all">
                {patient.email}
              </p>
            </div>
          )}

          {patient.address && (
            <div>
              <p className="text-xs text-wl-text-tertiary uppercase tracking-wide mb-1">
                Address
              </p>
              <p className="text-sm text-wl-text-primary">{patient.address}</p>
            </div>
          )}

          {patient.riskLevel === "high" && (
            <div className="flex gap-2 p-3 bg-wl-danger-500/10 border border-wl-danger-400/20 rounded-lg mt-3">
              <AlertCircleIcon className="w-4 h-4 text-wl-danger-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-wl-danger-400">
                High-risk patient requires closer monitoring
              </p>
            </div>
          )}

          {onViewDetails && (
            <Button
              variant="primary"
              size="sm"
              onClick={onViewDetails}
              className="w-full mt-4"
            >
              View Full Details
            </Button>
          )}
        </div>
      )}
    </Card>
  );
};

export { PatientCard };
export type { Patient, PatientCardProps };
