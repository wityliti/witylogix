"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Zap,
  BarChart3,
  RefreshCw,
  Info,
} from "lucide-react";
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiQuery } from '@/hooks/use-api';

interface TestStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

interface TestFile {
  file: string;
  status: string;
  duration: number;
  tests: number;
  passed: number;
  failed: number;
}

interface TestStatsData {
  stats: TestStats;
  testResults: TestFile[];
  hasCoverage: boolean;
  generatedAt: string;
}

interface TestStatsResponse {
  data: TestStatsData | null;
}

const getPassRate = (passed: number, total: number): number =>
  total === 0 ? 0 : Math.round((passed / total) * 100);

export default function TestDashboardPage() {
  const { data: response, loading, error, refetch } = useApiQuery<TestStatsResponse>(
    '/api/v4/admin/test-stats'
  );

  const testData = response?.data ?? null;

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  if (!testData) {
    return (
      <div className="min-h-screen bg-wl-bg-root">
        <Header
          title="Test Results Dashboard"
          actions={
            <Button variant="secondary" size="md" onClick={refetch} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              Refresh
            </Button>
          }
        />
        <div className="container mx-auto px-4 py-16 max-w-2xl text-center">
          <Info className="w-12 h-12 text-blue-500 mx-auto mb-4 opacity-60" />
          <h2 className="text-lg font-semibold text-white mb-2">No Test Results Available</h2>
          <p className="text-sm text-gray-400 mb-4">
            Test results are generated during CI runs. To populate this dashboard, run:
          </p>
          <pre className="bg-wl-bg-elevated border border-wl-border-default rounded-lg p-4 text-xs text-gray-400 text-left mb-4">
            pnpm test:run --reporter=json {'>'} test-results.json
          </pre>
          <p className="text-xs text-gray-500">
            The report file is read from the monorepo root. Commit it or write it as part of your CI pipeline.
          </p>
        </div>
      </div>
    );
  }

  const { stats, testResults, generatedAt } = testData;
  const passRate = getPassRate(stats.passed, stats.total);
  const failRate = getPassRate(stats.failed, stats.total);
  const failedFiles = testResults.filter(f => f.failed > 0);
  const passingFiles = testResults.filter(f => f.failed === 0);

  if (!data) {
    return (
      <div className="min-h-screen bg-wl-bg-root">
        <Header
          title="Test Results Dashboard"
          actions={
            <Button variant="secondary" size="md" onClick={refetch} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              Refresh
            </Button>
          }
        />
        <div className="container mx-auto px-4 py-16 max-w-2xl text-center">
          <Info className="w-12 h-12 text-blue-500 mx-auto mb-4 opacity-60" />
          <h2 className="text-lg font-semibold text-white mb-2">No Test Results Available</h2>
          <p className="text-sm text-gray-400 mb-4">
            Test results are generated during CI runs. To populate this dashboard, run:
          </p>
          <pre className="bg-wl-bg-elevated border border-wl-border-default rounded-lg p-4 text-xs text-gray-400 text-left mb-4">
            pnpm test:run --reporter=json {'>'} test-results.json
          </pre>
          <p className="text-xs text-gray-500">
            The report file is read from the monorepo root. Commit it or write it as part of your CI pipeline.
          </p>
        </div>
      </div>
    );
  }

  const { stats, testResults, generatedAt } = testData;
  const passRate = getPassRate(stats.passed, stats.total);
  const failRate = getPassRate(stats.failed, stats.total);
  const failedFiles = testResults.filter(f => f.failed > 0);
  const passingFiles = testResults.filter(f => f.failed === 0);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const stats = testData?.stats ?? null;
  const categories = testData?.categories ?? [];
  const packages = testData?.packages ?? [];
  const flakyTests = testData?.flakyTests ?? [];
  const recentRuns = testData?.recentRuns ?? [];

  if (!stats) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <Header title="Test Results Dashboard" />
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Card>
            <CardContent className="pt-6 py-16 text-center">
              <BarChart3 className="w-12 h-12 mx-auto text-gray-400 mb-4 opacity-50" />
              <p className="text-white font-semibold mb-2">No test results available</p>
              <p className="text-gray-400 text-sm">
                Run tests to populate this dashboard.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const passRate = getPassRate(stats.passed, stats.total);
  const failRate = getPassRate(stats.failed, stats.total);
  const coveredCategories = categories.filter((c) => c.coverage > 0);
  const avgCoverage = coveredCategories.length > 0
    ? Math.round(coveredCategories.reduce((sum, c) => sum + c.coverage, 0) / coveredCategories.length)
    : 0;

  return (
    <div className="min-h-screen bg-wl-bg-root">
      <Header
        title="Test Results Dashboard"
        subtitle={`Generated ${new Date(generatedAt).toLocaleString()}`}
        actions={
          <Button variant="secondary" size="md" onClick={refetch} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-2">Total Tests</p>
                  <p className="text-3xl font-bold text-white">{stats.total}</p>
                </div>
              </CardContent>
            </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-2">Passed</p>
                  <p className="text-3xl font-bold text-green-600">{stats.passed}</p>
                  <p className="text-xs text-gray-400 mt-1">{passRate}% pass rate</p>
                </div>
              </CardContent>
            </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-2">Failed</p>
                  <p className="text-3xl font-bold text-red-600">{stats.failed}</p>
                  <p className="text-xs text-gray-400 mt-1">{failRate}% fail rate</p>
                </div>
              </CardContent>
            </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-2">Skipped</p>
                  <p className="text-3xl font-bold text-amber-500">{stats.skipped}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-amber-500 opacity-60" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-2">Duration</p>
                  <p className="text-3xl font-bold text-white">{stats.duration}s</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Failing Files */}
        {failedFiles.length > 0 && (
          <Card className="mb-8 border border-red-600/30 bg-red-600/5">
            <CardHeader>
              <CardTitle>Failing Test Files ({failedFiles.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {failedFiles.map((file, idx) => (
                  <div key={idx} className="p-3 bg-red-600/10 rounded-lg border border-red-500/20 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white font-mono">
                        {file.file.replace(process.env.NEXT_PUBLIC_APP_URL ?? '', '')}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {file.passed} passed / {file.failed} failed · {file.duration}s
                      </p>
                    </div>
                    <Badge variant="danger">{file.failed} failed</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Test Files */}
        <Card>
          <CardHeader>
            <CardTitle>All Test Files ({testResults.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {testResults.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No test files in results.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-wl-border-default">
                      <th className="text-left py-3 px-4 font-medium text-gray-400">File</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-400">Tests</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-400">Passed</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-400">Failed</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-400">Duration</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testResults.map((file, idx) => (
                      <tr key={idx} className="border-b border-wl-border-default hover:bg-wl-bg-elevated transition-colors">
                        <td className="py-3 px-4 text-white font-mono text-xs max-w-sm truncate">
                          {file.file.split('/').slice(-2).join('/')}
                        </td>
                        <td className="py-3 px-4 text-gray-400">{file.tests}</td>
                        <td className="py-3 px-4 text-green-600 font-medium">{file.passed}</td>
                        <td className="py-3 px-4">
                          <span className={cn("font-medium", file.failed > 0 ? "text-red-600" : "text-green-600")}>
                            {file.failed}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-400">{file.duration}s</td>
                        <td className="py-3 px-4">
                          <Badge variant={file.failed === 0 ? "success" : "danger"}>
                            {file.failed === 0 ? "pass" : "fail"}
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

        {stats.failed === 0 && stats.total > 0 && (
          <Card className="mt-6 border border-emerald-600/30 bg-emerald-600/5">
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <p className="text-sm font-semibold text-emerald-500">
                  All {stats.total} tests passing
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
