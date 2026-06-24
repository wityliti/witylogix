'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import { FileText, Download, Upload, Filter } from 'lucide-react';

interface HealthRecord {
  id: string;
  type: string;
  title: string;
  patientName: string;
  author: string;
  date: string;
  summary: string;
  isSigned: boolean;
}

const recordTypeVariants: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'primary' | 'default'> = {
  PROGRESS_NOTE: "info",
  LAB_RESULT: "success",
  IMAGING_REPORT: "warning",
  PRESCRIPTION: "primary",
  DISCHARGE_SUMMARY: "default",
  CONSULTATION_NOTE: "default",
};

export default function RecordsPage() {
  const { items: records, loading, error, refetch } = useApiList<HealthRecord>('/api/v4/healthcare/records');
  const [recordTypeFilter, setRecordTypeFilter] = useState<string>('ALL');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const records = apiRecords;

  const recordTypes = ['ALL', 'PROGRESS_NOTE', 'LAB_RESULT', 'IMAGING_REPORT', 'PRESCRIPTION', 'DISCHARGE_SUMMARY'];
  const filteredRecords = recordTypeFilter === 'ALL' ? records : records.filter((r) => r.type === recordTypeFilter);
  const selectedRecord = records.find((r) => r.id === selectedRecordId);

  return (
    <div className="min-h-screen bg-wl-bg-root p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Clinical Records</h1>
            <p className="text-gray-400">View and manage clinical documents</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex items-center gap-2">
              <Download size={16} /> Export
            </Button>
            <Button variant="primary" className="flex items-center gap-2">
              <Upload size={16} /> Import Records
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Total Records</span>
              <FileText className="text-blue-500" size={20} />
            </div>
            <p className="text-3xl font-bold text-white">{records.length}</p>
            <p className="text-gray-400 text-xs mt-2">All documents</p>
          </CardContent>
        </Card>

        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Signed Records</span>
              <div className="w-5 h-5 rounded-full bg-emerald-500"></div>
            </div>
            <p className="text-3xl font-bold text-white">{records.filter(r => r.isSigned).length}</p>
            <p className="text-gray-400 text-xs mt-2">Completed</p>
          </CardContent>
        </Card>

        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400 text-sm font-medium">Unsigned</span>
              <div className="w-5 h-5 rounded-full bg-amber-500"></div>
            </div>
            <p className="text-3xl font-bold text-white">{records.filter(r => !r.isSigned).length}</p>
            <p className="text-gray-400 text-xs mt-2">Pending review</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-wl-bg-surface border-wl-border-default mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <Filter size={16} /> Filter by Type:
            </label>
            <div className="flex gap-2 flex-wrap">
              {recordTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setRecordTypeFilter(type)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                    recordTypeFilter === type
                      ? "bg-blue-500 text-white"
                      : "bg-wl-bg-elevated text-gray-400 hover:text-white"
                  )}
                >
                  {type.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Records Table */}
      <Card className="bg-wl-bg-surface border-wl-border-default mb-6">
        <CardHeader className="border-b border-wl-border-default">
          <CardTitle className="text-base text-white">
            Clinical Records ({filteredRecords.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="text-gray-600 mb-4" size={40} />
              <p className="text-gray-400 font-medium mb-1">No clinical records found</p>
              <p className="text-gray-500 text-sm">Import records or adjust your filter to see results.</p>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-wl-border-default">
                  <th className="text-left py-3 px-4 font-medium text-gray-400">Title</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-400">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-400">Patient</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-400">Author</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-400">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400 text-sm">
                      No clinical records found
                    </td>
                  </tr>
                )}
                {filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="border-b border-wl-border-default hover:bg-wl-bg-elevated transition-colors cursor-pointer"
                    onClick={() => setSelectedRecordId(record.id)}
                  >
                    <td className="py-3 px-4 text-white font-medium">
                      <button className="hover:underline text-blue-500">{record.title}</button>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={recordTypeVariants[record.type] || 'default'}>
                        {record.type.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-gray-400">{record.patientName}</td>
                    <td className="py-3 px-4 text-gray-400 text-xs">{record.author}</td>
                    <td className="py-3 px-4 text-gray-400 text-xs">
                      {new Date(record.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={record.isSigned ? "success" : "warning"}>
                        {record.isSigned ? "Signed" : "Unsigned"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </CardContent>
      </Card>

      {/* Record Detail View */}
      {selectedRecord && (
        <Card className="bg-wl-bg-surface border-wl-border-default">
          <CardHeader className="border-b border-wl-border-default flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base text-white">{selectedRecord.title}</CardTitle>
              <p className="text-xs text-gray-400 mt-1">ID: {selectedRecord.id}</p>
            </div>
            <button
              onClick={() => setSelectedRecordId(null)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Content */}
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Summary</h3>
                  <div className="p-4 bg-wl-bg-elevated rounded-lg border border-wl-border-default">
                    <p className="text-sm text-gray-300 leading-relaxed">{selectedRecord.summary}</p>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">HL7 Message</h3>
                  <pre className="p-3 bg-wl-bg-root border border-wl-border-default rounded font-mono text-xs text-gray-400 overflow-x-auto">
{`MSH|^~\\&|EHR|FACILITY|LAB|REMOTE|202603101430||ORM^O01|20260310143000|P|2.3
PID|||${selectedRecord.id}||PATIENT^NAME||19650315|M|||123 MAIN STREET^^SPRINGFIELD^IL^62701
ORC|NW|${selectedRecord.id}|LAB001||CM|
OBR||${selectedRecord.id}|LAB001|85025^CBC|||202603101430|||||||202603101430|`}
                  </pre>
                </div>
              </div>

              {/* Details Sidebar */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">Details</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Type</p>
                      <Badge variant={recordTypeVariants[selectedRecord.type] || 'default'}>
                        {selectedRecord.type.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Patient</p>
                      <p className="text-white font-medium">{selectedRecord.patientName}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Author</p>
                      <p className="text-white font-medium">{selectedRecord.author}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Date</p>
                      <p className="text-white font-medium">
                        {new Date(selectedRecord.date).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-1">Status</p>
                      <Badge variant={selectedRecord.isSigned ? "success" : "warning"}>
                        {selectedRecord.isSigned ? "Signed" : "Unsigned"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button variant="secondary" className="w-full text-xs">
                    Download
                  </Button>
                  <Button variant="secondary" className="w-full text-xs">
                    Print
                  </Button>
                  <Button variant="primary" className="w-full text-xs">
                    Sign Document
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
