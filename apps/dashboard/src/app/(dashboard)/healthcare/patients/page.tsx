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

function PatientTable({ patients }: { patients: any[] }) {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);
  const { encounters } = useEncounters(selectedPatientId || "");
  const { medications, conditions, allergies } = useClinicalRecords(
    selectedPatientId || ""
  );

  const filteredPatients = patients.filter(
    (p) =>
      p.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.mrn.includes(searchTerm)
  );

  const getAge = (dob: string) => {
    return new Date().getFullYear() - new Date(dob).getFullYear();
  };

  return (
    <>
      {/* Search Box */}
      <Card className={cn("bg-wl-bg-elevated border-wl-border-subtle mb-6")}>
        <CardContent className={cn("pt-6")}>
          <div className={cn("relative")}>
            <Icon
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              size={18}
            />
            <input
              type="text"
              placeholder="Search by name or MRN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                "w-full pl-10 pr-4 py-2 rounded-md",
                "border border-wl-border-subtle bg-wl-bg-root",
                "text-wl-text-primary placeholder-wl-text-secondary",
                "focus:outline-none focus:ring-2 focus:ring-wl-brand"
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Patients Table */}
      <Card className={cn("bg-wl-bg-elevated border-wl-border-subtle")}>
        <CardHeader className={cn("border-b border-wl-border-subtle")}>
          <CardTitle className={cn("text-base")}>
            Patients ({filteredPatients.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn("overflow-x-auto")}>
            <table className={cn("w-full text-sm")}>
              <thead>
                <tr className={cn("border-b border-wl-border-subtle")}>
                  <th
                    className={cn(
                      "text-left py-3 px-4 font-medium text-wl-text-secondary"
                    )}
                  >
                    Name
                  </th>
                  <th
                    className={cn(
                      "text-left py-3 px-4 font-medium text-wl-text-secondary"
                    )}
                  >
                    MRN
                  </th>
                  <th
                    className={cn(
                      "text-left py-3 px-4 font-medium text-wl-text-secondary"
                    )}
                  >
                    Age
                  </th>
                  <th
                    className={cn(
                      "text-left py-3 px-4 font-medium text-wl-text-secondary"
                    )}
                  >
                    Contact
                  </th>
                  <th
                    className={cn(
                      "text-left py-3 px-4 font-medium text-wl-text-secondary"
                    )}
                  >
                    Conditions
                  </th>
                  <th
                    className={cn(
                      "text-left py-3 px-4 font-medium text-wl-text-secondary"
                    )}
                  >
                    Medications
                  </th>
                  <th
                    className={cn(
                      "text-left py-3 px-4 font-medium text-wl-text-secondary"
                    )}
                  >
                    Status
                  </th>
                  <th className={cn("w-10")}></th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map((patient) => (
                  <tr
                    key={patient.id}
                    className={cn(
                      "border-b border-wl-border-subtle hover:bg-wl-bg-overlay transition-colors"
                    )}
                  >
                    <td className={cn("py-3 px-4 text-wl-text-primary font-medium")}>
                      <button
                        onClick={() => setSelectedPatientId(patient.id)}
                        className={cn("hover:underline text-wl-brand")}
                      >
                        {patient.firstName} {patient.lastName}
                      </button>
                    </td>
                    <td className={cn("py-3 px-4 text-wl-text-secondary font-mono text-xs")}>
                      {patient.mrn}
                    </td>
                    <td className={cn("py-3 px-4 text-wl-text-secondary")}>
                      {getAge(patient.dateOfBirth)}
                    </td>
                    <td className={cn("py-3 px-4 text-wl-text-secondary text-xs")}>
                      {patient.phone}
                    </td>
                    <td className={cn("py-3 px-4")}>
                      {patient.activeConditionsCount > 0 ? (
                        <Badge variant="warning">
                          {patient.activeConditionsCount}
                        </Badge>
                      ) : (
                        <span className={cn("text-wl-text-secondary")}>—</span>
                      )}
                    </td>
                    <td className={cn("py-3 px-4")}>
                      {patient.medicationsCount > 0 ? (
                        <Badge variant="info">
                          {patient.medicationsCount}
                        </Badge>
                      ) : (
                        <span className={cn("text-wl-text-secondary")}>—</span>
                      )}
                    </td>
                    <td className={cn("py-3 px-4")}>
                      <Badge variant={patient.status === "ACTIVE" ? "success" : "default"}>
                        {patient.status}
                      </Badge>
                    </td>
                    <td className={cn("py-3 px-4")}>
                      <button className={cn("text-wl-text-secondary hover:text-wl-text-primary")}>
                        <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Patient Detail Drawer */}
      {selectedPatient && (
        <Card className={cn("mt-6 bg-wl-bg-elevated border-wl-border-subtle")}>
          <CardHeader className={cn("border-b border-wl-border-subtle flex flex-row items-center justify-between")}>
            <div>
              <CardTitle className={cn("text-base")}>
                {selectedPatient.firstName} {selectedPatient.lastName}
              </CardTitle>
              <p className={cn("text-xs text-wl-text-secondary mt-1")}>
                MRN: {selectedPatient.mrn}
              </p>
            </div>
            <button
              onClick={() => setSelectedPatientId(null)}
              className={cn("text-wl-text-secondary hover:text-wl-text-primary")}
            >
              ✕
            </button>
          </CardHeader>
          <CardContent className={cn("pt-6")}>
            <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-6")}>
              {/* Demographics */}
              <div className={cn("space-y-4")}>
                <div>
                  <h3 className={cn("text-sm font-semibold text-wl-text-secondary mb-3")}>
                    Demographics
                  </h3>
                  <div className={cn("space-y-2 text-sm")}>
                    <div className={cn("flex justify-between")}>
                      <span className={cn("text-wl-text-secondary")}>Age:</span>
                      <span className={cn("text-wl-text-primary font-medium")}>
                        {getAge(selectedPatient.dateOfBirth)}
                      </span>
                    </div>
                    <div className={cn("flex justify-between")}>
                      <span className={cn("text-wl-text-secondary")}>Gender:</span>
                      <span className={cn("text-wl-text-primary font-medium")}>
                        {selectedPatient.gender}
                      </span>
                    </div>
                    <div className={cn("flex justify-between")}>
                      <span className={cn("text-wl-text-secondary")}>DOB:</span>
                      <span className={cn("text-wl-text-primary font-medium")}>
                        {new Date(selectedPatient.dateOfBirth).toLocaleDateString()}
                      </span>
                    </div>
                    <div className={cn("flex justify-between")}>
                      <span className={cn("text-wl-text-secondary")}>Email:</span>
                      <span className={cn("text-wl-text-primary font-medium text-xs")}>
                        {selectedPatient.email}
                      </span>
                    </div>
                    <div className={cn("flex justify-between")}>
                      <span className={cn("text-wl-text-secondary")}>Phone:</span>
                      <span className={cn("text-wl-text-primary font-medium")}>
                        {selectedPatient.phone}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className={cn("text-sm font-semibold text-wl-text-secondary mb-3")}>
                    Address
                  </h3>
                  <div className={cn("text-sm text-wl-text-secondary space-y-1")}>
                    <p>{selectedPatient.address.street}</p>
                    <p>
                      {selectedPatient.address.city}, {selectedPatient.address.state}{" "}
                      {selectedPatient.address.postalCode}
                    </p>
                    <p>{selectedPatient.address.country}</p>
                  </div>
                </div>

                {selectedPatient.insurance && (
                  <div>
                    <h3 className={cn("text-sm font-semibold text-wl-text-secondary mb-3")}>
                      Insurance
                    </h3>
                    <div className={cn("text-sm space-y-1")}>
                      <p className={cn("text-wl-text-primary")}>
                        {selectedPatient.insurance.provider}
                      </p>
                      <p className={cn("text-wl-text-secondary text-xs")}>
                        Plan: {selectedPatient.insurance.planName}
                      </p>
                      <p className={cn("text-wl-text-secondary text-xs")}>
                        ID: {selectedPatient.insurance.memberId}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Clinical Info */}
              <div className={cn("space-y-4")}>
                {/* Conditions */}
                {conditions.length > 0 && (
                  <div>
                    <h3 className={cn("text-sm font-semibold text-wl-text-secondary mb-3")}>
                      Active Conditions ({conditions.length})
                    </h3>
                    <div className={cn("space-y-2")}>
                      {conditions.map((cond) => (
                        <div
                          key={cond.id}
                          className={cn(
                            "p-2 bg-wl-bg-overlay rounded text-sm"
                          )}
                        >
                          <div className={cn("flex items-start justify-between mb-1")}>
                            <p className={cn("font-medium text-wl-text-primary")}>
                              {cond.name}
                            </p>
                            <Badge
                              variant={
                                cond.severity === "HIGH" ||
                                cond.severity === "CRITICAL"
                                  ? "danger"
                                  : "warning"
                              }
                            >
                              {cond.severity}
                            </Badge>
                          </div>
                          <p className={cn("text-xs text-wl-text-secondary")}>
                            Since {new Date(cond.onsetDate).getFullYear()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Medications */}
                {medications.length > 0 && (
                  <div>
                    <h3 className={cn("text-sm font-semibold text-wl-text-secondary mb-3")}>
                      Medications ({medications.length})
                    </h3>
                    <div className={cn("space-y-2")}>
                      {medications.map((med) => (
                        <div
                          key={med.id}
                          className={cn(
                            "p-2 bg-wl-bg-overlay rounded text-sm"
                          )}
                        >
                          <div className={cn("flex items-start justify-between mb-1")}>
                            <p className={cn("font-medium text-wl-text-primary")}>
                              {med.name} {med.strength}
                            </p>
                            <Badge variant={med.status === "ACTIVE" ? "success" : "default"}>
                              {med.status}
                            </Badge>
                          </div>
                          <p className={cn("text-xs text-wl-text-secondary")}>
                            {med.dosage} {med.frequency}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Allergies */}
                {allergies.length > 0 && (
                  <div>
                    <h3 className={cn("text-sm font-semibold text-wl-text-secondary mb-3")}>
                      Allergies ⚠️
                    </h3>
                    <div className={cn("space-y-2")}>
                      {allergies.map((allergy) => (
                        <div
                          key={allergy.id}
                          className={cn(
                            "p-2 bg-wl-status-warning/10 border border-wl-status-warning rounded text-sm"
                          )}
                        >
                          <div className={cn("flex items-start justify-between mb-1")}>
                            <p className={cn("font-medium text-wl-status-warning")}>
                              {allergy.allergen}
                            </p>
                            <Badge variant="danger">
                              {allergy.severity}
                            </Badge>
                          </div>
                          <p className={cn("text-xs text-wl-text-secondary")}>
                            Reaction: {allergy.reaction}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Encounters Timeline */}
            {encounters.length > 0 && (
              <div className={cn("mt-6 pt-6 border-t border-wl-border-subtle")}>
                <h3 className={cn("text-sm font-semibold text-wl-text-secondary mb-3")}>
                  Recent Encounters
                </h3>
                <div className={cn("space-y-2")}>
                  {encounters.slice(0, 3).map((enc) => (
                    <div
                      key={enc.id}
                      className={cn(
                        "p-3 bg-wl-bg-overlay rounded border border-wl-border-subtle"
                      )}
                    >
                      <div className={cn("flex items-start justify-between mb-1")}>
                        <p className={cn("text-sm font-medium text-wl-text-primary")}>
                          {enc.type}
                        </p>
                        <Badge variant="info">{enc.status}</Badge>
                      </div>
                      <p className={cn("text-xs text-wl-text-secondary")}>
                        {enc.provider.name} • {enc.department}
                      </p>
                      <p className={cn("text-xs text-wl-text-secondary mt-1")}>
                        {new Date(enc.startTime).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
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

export default function PatientsPage() {
  const { items: patients, loading, error, refetch } = useApiList<Patient>('/api/v4/customers?type=patient');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className={cn("p-6 space-y-6")}>
      {/* Header */}
      <div className={cn("flex items-center justify-between")}>
        <div>
          <h1 className={cn("text-2xl font-bold text-wl-text-primary")}>
            Patient Registry
          </h1>
          <p className={cn("text-sm text-wl-text-secondary mt-1")}>
            Manage and view patient records
          </p>
        </div>
        <Button variant="primary">
          Add Patient
        </Button>
      </div>

      {/* Patient Table */}
      <PatientTable patients={patients} />

      {/* Stats Footer */}
      <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4")}>
        <Card className={cn("bg-wl-bg-elevated border-wl-border-subtle")}>
          <CardContent className={cn("pt-6")}>
            <p className={cn("text-sm font-medium text-wl-text-secondary mb-2")}>
              Total Patients
            </p>
            <p className={cn("text-2xl font-bold text-wl-text-primary")}>
              {patients.length}
            </p>
            <p className={cn("text-xs text-wl-text-secondary mt-2")}>
              {patients.filter((p) => p.status === "ACTIVE").length} active
            </p>
          </CardContent>
        </Card>
        <Card className={cn("bg-wl-bg-elevated border-wl-border-subtle")}>
          <CardContent className={cn("pt-6")}>
            <p className={cn("text-sm font-medium text-wl-text-secondary mb-2")}>
              Avg. Conditions
            </p>
            <p className={cn("text-2xl font-bold text-wl-text-primary")}>
              {(
                patients.reduce((sum, p) => sum + p.activeConditionsCount, 0) /
                patients.length
              ).toFixed(1)}
            </p>
            <p className={cn("text-xs text-wl-text-secondary mt-2")}>
              Per patient
            </p>
          </CardContent>
        </Card>
        <Card className={cn("bg-wl-bg-elevated border-wl-border-subtle")}>
          <CardContent className={cn("pt-6")}>
            <p className={cn("text-sm font-medium text-wl-text-secondary mb-2")}>
              Avg. Medications
            </p>
            <p className={cn("text-2xl font-bold text-wl-text-primary")}>
              {(
                patients.reduce((sum, p) => sum + p.medicationsCount, 0) /
                patients.length
              ).toFixed(1)}
            </p>
            <p className={cn("text-xs text-wl-text-secondary mt-2")}>
              Per patient
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
