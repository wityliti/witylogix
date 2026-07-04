"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useApiList } from "@/hooks/use-api";
import { useCustomerLocations } from "@/hooks/use-customers";
import {
  Users,
  User,
  Heart,
  Pill,
  AlertCircle,
  Plus,
  List,
  Map as MapIcon,
} from "lucide-react";

const CustomersMapView = dynamic(
  () => import("../../customers/components/customers-map-view"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] bg-wl-bg-surface rounded-xl animate-pulse" />
    ),
  },
);

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  mrn: string;
  status: string;
  dateOfBirth: string;
  activeConditionsCount: number;
  medicationsCount: number;
  phone?: string;
  email?: string;
  gender?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  insurance?: {
    provider: string;
    planName: string;
    memberId: string;
  };
}

function PatientTable({ patients }: { patients: Patient[] }) {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    null,
  );
  const [searchTerm, setSearchTerm] = useState("");

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  const filteredPatients = patients.filter(
    (p) =>
      p.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.mrn.includes(searchTerm),
  );

  const getAge = (dob: string) => {
    return new Date().getFullYear() - new Date(dob).getFullYear();
  };

  return (
    <>
      {/* Search Box */}
      <Card className="bg-wl-bg-surface border-wl-border-default mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name or MRN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pl-10 rounded-lg border border-wl-border-default bg-wl-bg-root text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-wl-text-tertiary">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <path d="M21 21l-4.35-4.35"></path>
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Patients Table */}
      <Card className="bg-wl-bg-surface border-wl-border-default">
        <CardHeader className="border-b border-wl-border-default">
          <CardTitle className="text-base text-white">
            Patients ({filteredPatients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-wl-border-default">
                  <th className="text-left py-3 px-4 font-medium text-wl-text-secondary">
                    Name
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-wl-text-secondary">
                    MRN
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-wl-text-secondary">
                    Age
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-wl-text-secondary">
                    Contact
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-wl-text-secondary">
                    Conditions
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-wl-text-secondary">
                    Medications
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-wl-text-secondary">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map((patient) => (
                  <tr
                    key={patient.id}
                    className="border-b border-wl-border-default hover:bg-wl-bg-elevated transition-colors cursor-pointer"
                    onClick={() => setSelectedPatientId(patient.id)}
                  >
                    <td className="py-3 px-4 text-white font-medium">
                      <button className="hover:underline text-blue-500">
                        {patient.firstName} {patient.lastName}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-wl-text-secondary font-mono text-xs">
                      {patient.mrn}
                    </td>
                    <td className="py-3 px-4 text-wl-text-secondary">
                      {getAge(patient.dateOfBirth)}
                    </td>
                    <td className="py-3 px-4 text-wl-text-secondary text-xs">
                      {patient.phone || "—"}
                    </td>
                    <td className="py-3 px-4">
                      {patient.activeConditionsCount > 0 ? (
                        <Badge variant="warning">
                          {patient.activeConditionsCount}
                        </Badge>
                      ) : (
                        <span className="text-wl-text-secondary">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {patient.medicationsCount > 0 ? (
                        <Badge variant="info">{patient.medicationsCount}</Badge>
                      ) : (
                        <span className="text-wl-text-secondary">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          patient.status === "ACTIVE" ? "success" : "default"
                        }
                      >
                        {patient.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Patient Detail Card */}
      {selectedPatient && (
        <Card className="mt-6 bg-wl-bg-surface border-wl-border-default">
          <CardHeader className="border-b border-wl-border-default flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base text-white">
                {selectedPatient.firstName} {selectedPatient.lastName}
              </CardTitle>
              <p className="text-xs text-wl-text-secondary mt-1">
                MRN: {selectedPatient.mrn}
              </p>
            </div>
            <button
              onClick={() => setSelectedPatientId(null)}
              className="text-wl-text-secondary hover:text-white transition-colors"
            >
              ✕
            </button>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Demographics */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-wl-text-secondary mb-3">
                    Demographics
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-wl-text-secondary">Age:</span>
                      <span className="text-white font-medium">
                        {getAge(selectedPatient.dateOfBirth)}
                      </span>
                    </div>
                    {selectedPatient.gender && (
                      <div className="flex justify-between">
                        <span className="text-wl-text-secondary">Gender:</span>
                        <span className="text-white font-medium">
                          {selectedPatient.gender}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-wl-text-secondary">DOB:</span>
                      <span className="text-white font-medium">
                        {new Date(
                          selectedPatient.dateOfBirth,
                        ).toLocaleDateString()}
                      </span>
                    </div>
                    {selectedPatient.email && (
                      <div className="flex justify-between">
                        <span className="text-wl-text-secondary">Email:</span>
                        <span className="text-white font-medium text-xs">
                          {selectedPatient.email}
                        </span>
                      </div>
                    )}
                    {selectedPatient.phone && (
                      <div className="flex justify-between">
                        <span className="text-wl-text-secondary">Phone:</span>
                        <span className="text-white font-medium">
                          {selectedPatient.phone}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {selectedPatient.address && (
                  <div>
                    <h3 className="text-sm font-semibold text-wl-text-secondary mb-3">
                      Address
                    </h3>
                    <div className="text-sm text-wl-text-secondary space-y-1">
                      <p>{selectedPatient.address.street}</p>
                      <p>
                        {selectedPatient.address.city},{" "}
                        {selectedPatient.address.state}{" "}
                        {selectedPatient.address.postalCode}
                      </p>
                      <p>{selectedPatient.address.country}</p>
                    </div>
                  </div>
                )}

                {selectedPatient.insurance && (
                  <div>
                    <h3 className="text-sm font-semibold text-wl-text-secondary mb-3">
                      Insurance
                    </h3>
                    <div className="text-sm space-y-1">
                      <p className="text-white font-medium">
                        {selectedPatient.insurance.provider}
                      </p>
                      <p className="text-wl-text-secondary text-xs">
                        Plan: {selectedPatient.insurance.planName}
                      </p>
                      <p className="text-wl-text-secondary text-xs">
                        ID: {selectedPatient.insurance.memberId}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Clinical Info */}
              <div className="space-y-4">
                <div className="p-4 bg-wl-bg-elevated rounded-lg border border-wl-border-default">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="text-red-500" size={16} />
                    <span className="text-sm font-semibold text-white">
                      Active Conditions
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {selectedPatient.activeConditionsCount}
                  </p>
                  <p className="text-xs text-wl-text-secondary mt-1">
                    Ongoing treatment
                  </p>
                </div>

                <div className="p-4 bg-wl-bg-elevated rounded-lg border border-wl-border-default">
                  <div className="flex items-center gap-2 mb-2">
                    <Pill className="text-emerald-500" size={16} />
                    <span className="text-sm font-semibold text-white">
                      Medications
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {selectedPatient.medicationsCount}
                  </p>
                  <p className="text-xs text-wl-text-secondary mt-1">
                    Current prescriptions
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default function PatientsPage() {
  const {
    items: patients,
    loading,
    error,
    refetch,
  } = useApiList<Patient>("/api/v4/customers?type=patient");
  const { data: locations, loading: locLoading } = useCustomerLocations();
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const locationPins = Array.isArray(locations)
    ? locations
    : ((locations as any)?.data ?? []);

  return (
    <div className="min-h-screen bg-wl-bg-root p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Patient Registry
            </h1>
            <p className="text-wl-text-secondary">
              {viewMode === "map"
                ? `${locationPins.length} patient${locationPins.length !== 1 ? "s" : ""} mapped`
                : "Manage and view patient records"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex rounded-lg border border-wl-border-default overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "list"
                    ? "bg-blue-600 text-white"
                    : "bg-wl-bg-surface text-wl-text-secondary hover:text-white",
                )}
              >
                <List size={13} /> List
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                  viewMode === "map"
                    ? "bg-blue-600 text-white"
                    : "bg-wl-bg-surface text-wl-text-secondary hover:text-white",
                )}
              >
                <MapIcon size={13} /> Map
              </button>
            </div>
            <Button variant="primary" className="flex items-center gap-2">
              <Plus size={16} /> Add Patient
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-wl-text-secondary text-sm font-medium">
                Total Patients
              </span>
              <Users className="text-blue-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-white">{patients.length}</p>
            <p className="text-wl-text-secondary text-xs mt-2">
              {patients.filter((p) => p.status === "ACTIVE").length} active
            </p>
          </CardContent>
        </Card>

        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-wl-text-secondary text-sm font-medium">
                Avg. Conditions
              </span>
              <Heart className="text-red-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-white">
              {patients.length > 0
                ? (
                    patients.reduce(
                      (sum, p) => sum + p.activeConditionsCount,
                      0,
                    ) / patients.length
                  ).toFixed(1)
                : "0"}
            </p>
            <p className="text-wl-text-secondary text-xs mt-2">Per patient</p>
          </CardContent>
        </Card>

        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-wl-text-secondary text-sm font-medium">
                Avg. Medications
              </span>
              <Pill className="text-emerald-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-white">
              {patients.length > 0
                ? (
                    patients.reduce((sum, p) => sum + p.medicationsCount, 0) /
                    patients.length
                  ).toFixed(1)
                : "0"}
            </p>
            <p className="text-wl-text-secondary text-xs mt-2">Per patient</p>
          </CardContent>
        </Card>
      </div>

      {/* Map or List */}
      {viewMode === "map" ? (
        <div
          className="rounded-xl overflow-hidden border border-wl-border-default"
          style={{ height: 520 }}
        >
          {locLoading ? (
            <div className="h-full bg-wl-bg-surface animate-pulse flex items-center justify-center">
              <p className="text-wl-text-tertiary text-sm">
                Loading patient locations…
              </p>
            </div>
          ) : locationPins.length === 0 ? (
            <div className="h-full bg-wl-bg-surface flex flex-col items-center justify-center gap-3">
              <MapIcon className="w-10 h-10 text-wl-text-tertiary opacity-40" />
              <p className="text-wl-text-secondary text-sm">
                No patient locations available
              </p>
              <p className="text-wl-text-tertiary text-xs">
                Add address information to patients to see them on the map
              </p>
            </div>
          ) : (
            <CustomersMapView customers={locationPins} />
          )}
        </div>
      ) : (
        <PatientTable patients={patients} />
      )}
    </div>
  );
}
