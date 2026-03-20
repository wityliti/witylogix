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

const recordTypeVariants: Record<string, string> = {
  PROGRESS_NOTE: "info",
  LAB_RESULT: "success",
  IMAGING_REPORT: "warning",
  PRESCRIPTION: "primary",
  DISCHARGE_SUMMARY: "default",
  CONSULTATION_NOTE: "default",
};

function FHIRResourceBrowser({ resources }: { resources: any[] }) {
  const [selectedResource, setSelectedResource] = useState<any>(null);
  const [expandedResource, setExpandedResource] = useState<string | null>(null);

  return (
    <>
      <Card className={cn("bg-wl-bg-elevated border-wl-border-subtle")}>
        <CardHeader className={cn("border-b border-wl-border-subtle")}>
          <CardTitle className={cn("text-base")}>FHIR Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn("space-y-2")}>
            {resources.map((res) => (
              <div
                key={res.id}
                className={cn(
                  "border border-wl-border-subtle rounded hover:border-wl-border-active transition-colors"
                )}
              >
                <button
                  onClick={() =>
                    setExpandedResource(
                      expandedResource === res.id ? null : res.id
                    )
                  }
                  className={cn(
                    "w-full p-3 flex items-center justify-between hover:bg-wl-bg-overlay transition-colors text-left"
                  )}
                >
                  <div className={cn("flex-1")}>
                    <p className={cn("text-sm font-medium text-wl-text-primary")}>
                      {res.resourceType}
                    </p>
                    <p className={cn("text-xs text-wl-text-secondary mt-1")}>
                      ID: {res.id}
                    </p>
                  </div>
                  <Icon
                    d={expandedResource === res.id ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"}
                    size={18}
                  />
                </button>

                {expandedResource === res.id && (
                  <div
                    className={cn(
                      "p-3 border-t border-wl-border-subtle bg-wl-bg-overlay"
                    )}
                  >
                    <div className={cn("space-y-2 text-xs")}>
                      {res.meta && (
                        <div>
                          <p className={cn("font-semibold text-wl-text-secondary mb-1")}>
                            Metadata
                          </p>
                          <div
                            className={cn(
                              "pl-2 border-l border-wl-border-subtle text-wl-text-secondary"
                            )}
                          >
                            <p>
                              Version: {res.meta.versionId}
                            </p>
                            <p>
                              Updated:{" "}
                              {new Date(
                                res.meta.lastUpdated
                              ).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      )}
                      <div>
                        <p className={cn("font-semibold text-wl-text-secondary mb-1")}>
                          Data
                        </p>
                        <pre
                          className={cn(
                            "p-2 bg-wl-bg-root rounded overflow-x-auto",
                            "font-mono text-wl-text-secondary"
                          )}
                        >
                          {JSON.stringify(res.data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

interface Record {
  id: string;
  type: string;
  title: string;
  patientName: string;
  author: string;
  date: string;
  summary: string;
  isSigned: boolean;
}

export default function RecordsPage() {
  const { items: apiRecords, loading, error, refetch } = useApiList<Record>('/api/v4/orders?type=healthcare&view=records');
  const [recordTypeFilter, setRecordTypeFilter] = useState<string>('ALL');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  // Use API records or mock data as fallback
  const mockRecords: Record[] = apiRecords.length > 0 ? apiRecords : [
    {
      id: "rec-001",
      type: "PROGRESS_NOTE",
      title: "Follow-up Visit - Hypertension Management",
      patientName: "Robert Johnson",
      author: "Dr. Sarah Johnson",
      date: "2026-03-10T14:30:00Z",
      summary: "Patient reports good compliance with antihypertensive medications. Blood pressure readings stable at home.",
      isSigned: true,
    },
    {
      id: "rec-002",
      type: "LAB_RESULT",
      title: "Complete Blood Count (CBC)",
      patientName: "Sarah Williams",
      author: "Lab - A. Williams",
      date: "2026-03-09T08:45:00Z",
      summary: "All values within normal range. No abnormalities detected.",
      isSigned: true,
    },
    {
      id: "rec-003",
      type: "IMAGING_REPORT",
      title: "Chest X-Ray - PA and Lateral",
      patientName: "Michael Brown",
      author: "Dr. John Martinez",
      date: "2026-03-08T11:20:00Z",
      summary: "Frontal and lateral chest radiographs show normal cardiopulmonary silhouette.",
      isSigned: true,
    },
    {
      id: "rec-004",
      type: "PRESCRIPTION",
      title: "Prescription - Lisinopril",
      patientName: "Emily Davis",
      author: "Dr. Sarah Johnson",
      date: "2026-03-07T09:30:00Z",
      summary: "Lisinopril 10mg, one tablet daily, for hypertension management.",
      isSigned: false,
    },
    {
      id: "rec-005",
      type: "DISCHARGE_SUMMARY",
      title: "Hospital Discharge Summary",
      patientName: "James Miller",
      author: "Dr. Michael Chen",
      date: "2026-03-05T15:00:00Z",
      summary: "Patient discharged in stable condition with follow-up appointments scheduled.",
      isSigned: true,
    },
  ];

  const recordTypes = ['ALL', 'PROGRESS_NOTE', 'LAB_RESULT', 'IMAGING_REPORT', 'PRESCRIPTION', 'DISCHARGE_SUMMARY'];
  const filteredRecords =
    recordTypeFilter === 'ALL'
      ? mockRecords
      : mockRecords.filter((r) => r.type === recordTypeFilter);

  const selectedRecord = mockRecords.find((r) => r.id === selectedRecordId);

  return (
    <div className={cn("p-6 space-y-6")}>
      {/* Header */}
      <div className={cn("flex items-center justify-between")}>
        <div>
          <h1 className={cn("text-2xl font-bold text-wl-text-primary")}>
            Clinical Records
          </h1>
          <p className={cn("text-sm text-wl-text-secondary mt-1")}>
            View FHIR resources and clinical documents
          </p>
        </div>
        <div className={cn("flex gap-2")}>
          <Button variant="secondary">Export</Button>
          <Button variant="primary">Import Records</Button>
        </div>
      </div>

      {/* Controls */}
      <Card className={cn("bg-wl-bg-elevated border-wl-border-subtle")}>
        <CardContent className={cn("pt-6")}>
          <div className={cn("flex items-center justify-between gap-4")}>
            <div className={cn("flex items-center gap-4")}>
              <label className={cn("text-sm font-medium text-wl-text-secondary")}>
                Filter by Type:
              </label>
              <div className={cn("flex gap-2 flex-wrap")}>
                {recordTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => setRecordTypeFilter(type)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                      recordTypeFilter === type
                        ? "bg-wl-brand text-white"
                        : "bg-wl-bg-overlay text-wl-text-secondary hover:text-wl-text-primary"
                    )}
                  >
                    {type.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Records Table */}
      <Card className={cn("bg-wl-bg-elevated border-wl-border-subtle")}>
        <CardHeader className={cn("border-b border-wl-border-subtle")}>
          <CardTitle className={cn("text-base")}>
            Clinical Records ({filteredRecords.length})
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
                    Title
                  </th>
                  <th
                    className={cn(
                      "text-left py-3 px-4 font-medium text-wl-text-secondary"
                    )}
                  >
                    Type
                  </th>
                  <th
                    className={cn(
                      "text-left py-3 px-4 font-medium text-wl-text-secondary"
                    )}
                  >
                    Patient
                  </th>
                  <th
                    className={cn(
                      "text-left py-3 px-4 font-medium text-wl-text-secondary"
                    )}
                  >
                    Author
                  </th>
                  <th
                    className={cn(
                      "text-left py-3 px-4 font-medium text-wl-text-secondary"
                    )}
                  >
                    Date
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
                {filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className={cn(
                      "border-b border-wl-border-subtle hover:bg-wl-bg-overlay transition-colors"
                    )}
                  >
                    <td className={cn("py-3 px-4 text-wl-text-primary font-medium")}>
                      <button
                        onClick={() => setSelectedRecordId(record.id)}
                        className={cn("hover:underline text-wl-brand")}
                      >
                        {record.title}
                      </button>
                    </td>
                    <td className={cn("py-3 px-4")}>
                      <Badge variant={recordTypeVariants[record.type] as any}>
                        {record.type.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className={cn("py-3 px-4 text-wl-text-secondary")}>
                      {record.patientName}
                    </td>
                    <td className={cn("py-3 px-4 text-wl-text-secondary text-xs")}>
                      {record.author}
                    </td>
                    <td className={cn("py-3 px-4 text-wl-text-secondary text-xs")}>
                      {new Date(record.date).toLocaleDateString()}
                    </td>
                    <td className={cn("py-3 px-4")}>
                      <Badge variant={record.isSigned ? "success" : "warning"}>
                        {record.isSigned ? "Signed" : "Unsigned"}
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

      {/* FHIR Resource Browser */}
      <div>
        <h2 className={cn("text-lg font-semibold text-wl-text-primary mb-4")}>
          FHIR Resource Browser
        </h2>
        <FHIRResourceBrowser resources={resources} />
      </div>

      {/* Record Detail View */}
      {selectedRecord && (
        <Card className={cn("bg-wl-bg-elevated border-wl-border-subtle")}>
          <CardHeader className={cn("border-b border-wl-border-subtle flex flex-row items-center justify-between")}>
            <div>
              <CardTitle className={cn("text-base")}>
                {selectedRecord.title}
              </CardTitle>
              <p className={cn("text-xs text-wl-text-secondary mt-1")}>
                ID: {selectedRecord.id}
              </p>
            </div>
            <button
              onClick={() => setSelectedRecordId(null)}
              className={cn("text-wl-text-secondary hover:text-wl-text-primary")}
            >
              ✕
            </button>
          </CardHeader>
          <CardContent className={cn("pt-6")}>
            <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-6")}>
              <div className={cn("lg:col-span-2 space-y-4")}>
                <div>
                  <h3 className={cn("text-sm font-semibold text-wl-text-secondary mb-2")}>
                    Content
                  </h3>
                  <div
                    className={cn(
                      "p-4 bg-wl-bg-overlay rounded border border-wl-border-subtle"
                    )}
                  >
                    <p className={cn("text-sm text-wl-text-secondary leading-relaxed")}>
                      {selectedRecord.summary}
                    </p>
                    <p className={cn("text-xs text-wl-text-secondary mt-4 italic")}>
                      [Full clinical note content would be displayed here]
                    </p>
                  </div>
                </div>

                {/* HL7 Message Viewer */}
                <div>
                  <h3 className={cn("text-sm font-semibold text-wl-text-secondary mb-2")}>
                    HL7 Message
                  </h3>
                  <pre
                    className={cn(
                      "p-3 bg-wl-bg-root border border-wl-border-subtle rounded",
                      "font-mono text-xs text-wl-text-secondary overflow-x-auto"
                    )}
                  >
{`MSH|^~\\&|EHR|FACILITY|LAB|REMOTE|202603101430||ORM^O01|20260310143000|P|2.3
PID|||${selectedRecord.id}||PATIENT^NAME||19650315|M|||123 MAIN STREET^^SPRINGFIELD^IL^62701
ORC|NW|${selectedRecord.id}|LAB001||CM|
OBR||${selectedRecord.id}|LAB001|85025^CBC|||202603101430|||||||202603101430|`}
                  </pre>
                </div>
              </div>

              <div className={cn("space-y-4")}>
                <div>
                  <h3 className={cn("text-sm font-semibold text-wl-text-secondary mb-3")}>
                    Details
                  </h3>
                  <div className={cn("space-y-3 text-sm")}>
                    <div>
                      <p className={cn("text-wl-text-secondary text-xs mb-1")}>
                        Type
                      </p>
                      <Badge variant={recordTypeVariants[selectedRecord.type] as any}>
                        {selectedRecord.type.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div>
                      <p className={cn("text-wl-text-secondary text-xs mb-1")}>
                        Patient
                      </p>
                      <p className={cn("text-wl-text-primary font-medium")}>
                        {selectedRecord.patientName}
                      </p>
                    </div>
                    <div>
                      <p className={cn("text-wl-text-secondary text-xs mb-1")}>
                        Author
                      </p>
                      <p className={cn("text-wl-text-primary font-medium")}>
                        {selectedRecord.author}
                      </p>
                    </div>
                    <div>
                      <p className={cn("text-wl-text-secondary text-xs mb-1")}>
                        Date
                      </p>
                      <p className={cn("text-wl-text-primary font-medium")}>
                        {new Date(selectedRecord.date).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className={cn("text-wl-text-secondary text-xs mb-1")}>
                        Signature Status
                      </p>
                      <Badge variant={selectedRecord.isSigned ? "success" : "warning"}>
                        {selectedRecord.isSigned ? "Signed" : "Unsigned"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className={cn("flex flex-col gap-2")}>
                  <Button variant="secondary" className={cn("w-full")}>
                    Download
                  </Button>
                  <Button variant="secondary" className={cn("w-full")}>
                    Print
                  </Button>
                  <Button variant="primary" className={cn("w-full")}>
                    Sign Document
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import/Export Info */}
      <Card className={cn("bg-wl-status-info/10 border border-wl-status-info")}>
        <CardContent className={cn("pt-6")}>
          <p className={cn("text-sm font-medium text-wl-status-info mb-2")}>
            Data Format Support
          </p>
          <p className={cn("text-sm text-wl-text-secondary")}>
            This system supports FHIR R4 and HL7 v2.3+ formats for clinical data interchange.
            Use the Import function to load external records, or Export to share with other systems.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
