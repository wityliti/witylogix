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

interface TestResultsData {
  stats: TestStats | null;
  categories: TestCategory[];
  packages: PackageCoverage[];
  flakyTests: FlakyTest[];
  recentRuns: TestRun[];
}

const getCategoryColor = (
  coverage: number
): "bg-green-500/10 text-green-700" | "bg-yellow-500/10 text-yellow-700" | "bg-red-500/10 text-red-700" => {
  if (coverage >= 80) return "bg-green-500/10 text-green-700";
  if (coverage >= 60) return "bg-yellow-500/10 text-yellow-700";
  return "bg-red-500/10 text-red-700";
};

const getPassRate = (passed: number, total: number): number => {
  return Math.round((passed / total) * 100);
};

export default function TestDashboardPage() {
  const { data: testData, loading, error, refetch } = useApiQuery<TestResultsData>('/api/v4/admin/test-results');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

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
                  <p className="text-sm text-gray-400 mb-2">Avg Coverage</p>
                  <p className="text-3xl font-bold text-white">{avgCoverage}%</p>
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

        {/* Tests by Category + Package Coverage */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Tests by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No category data available</p>
              ) : (
                <div className="space-y-4">
                  {categories.map((category) => {
                    const catPassRate = getPassRate(category.passed, category.count);
                    return (
                      <div key={category.name}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="capitalize font-medium text-white">{category.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400">{category.count} tests</span>
                            {category.coverage > 0 && (
                              <Badge
                                variant={
                                  category.coverage >= 80 ? "success" : category.coverage >= 60 ? "warning" : "danger"
                                }
                              >
                                {category.coverage}%
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="w-full bg-[#0a0a0f] rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full transition-all"
                            style={{ width: `${catPassRate}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {category.passed}/{category.count} passed ({catPassRate}%)
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Package Coverage</CardTitle>
            </CardHeader>
            <CardContent>
              {packages.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No package coverage data available</p>
              ) : (
                <div className="space-y-3">
                  {packages.map((pkg) => (
                    <div key={pkg.name} className="flex items-center justify-between p-3 bg-[#0a0a0f] rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-white capitalize">{pkg.name}</p>
                        <p className="text-xs text-gray-400">{pkg.tests} tests • {pkg.lastRun}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-[#1a1a2e] rounded-full h-1.5">
                            <div
                              className={cn(
                                "h-1.5 rounded-full transition-all",
                                pkg.coverage >= 80 ? "bg-green-500" : pkg.coverage >= 60 ? "bg-yellow-500" : "bg-red-500"
                              )}
                              style={{ width: `${pkg.coverage}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-white w-10 text-right">{pkg.coverage}%</span>
                        </div>
                        {pkg.status === "success" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        {pkg.status === "warning" && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Flaky Tests */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Flaky Tests</CardTitle>
            </CardHeader>
            <CardContent>
              {flakyTests.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No flaky tests detected</p>
              ) : (
                <div className="space-y-4">
                  {flakyTests.map((test, idx) => (
                    <div key={idx} className="p-4 border border-yellow-500/20 bg-yellow-500/5 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-white">{test.name}</h4>
                        <Badge variant="warning">{test.flakiness}% flaky</Badge>
                      </div>
                      <p className="text-xs text-gray-400 mb-2">{test.file}</p>
                      <p className="text-sm text-gray-400 mb-3">
                        Last Passed: {test.lastPassed} • Last Failed: {test.lastFailed}
                      </p>
                    </div>
                    <Badge variant="danger">{file.failed} failed</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Test Runs */}
        <div className="mb-8">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Recent Test Runs</CardTitle>
              <Button size="sm" variant="secondary" onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {recentRuns.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No recent test runs</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1e1e2e]">
                        <th className="text-left py-3 px-4 font-medium text-gray-400">Timestamp</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-400">Total</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-400">Passed</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-400">Failed</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-400">Coverage</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-400">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentRuns.map((run) => (
                        <tr key={run.id} className="border-b border-[#1e1e2e] hover:bg-[#0a0a0f] transition-colors">
                          <td className="py-3 px-4 text-white">{run.timestamp}</td>
                          <td className="py-3 px-4 text-gray-400">{run.totalTests}</td>
                          <td className="py-3 px-4">
                            <span className="text-green-600 font-medium">{run.passed}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={cn("font-medium", run.failed > 0 ? "text-red-600" : "text-green-600")}>
                              {run.failed}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={run.coverage >= 80 ? "success" : run.coverage >= 60 ? "warning" : "danger"}>
                              {run.coverage}%
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-gray-400">{run.duration}s</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Test Trend Chart */}
        {recentRuns.length > 0 && (
          <div className="grid grid-cols-1 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Test Trend (Last {recentRuns.length} Runs)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-end gap-2">
                  {recentRuns.map((run) => {
                    const runPassRate = Math.round((run.passed / run.totalTests) * 100);
                    const height = (runPassRate / 100) * 240;
                    return (
                      <div key={run.id} className="flex-1 flex flex-col items-center">
                        <div
                          className="w-full rounded-t transition-all hover:bg-blue-500/30 bg-blue-500/20"
                          style={{ height: `${height}px` }}
                          title={`${runPassRate}% pass rate`}
                        />
                        <p className="text-xs text-gray-400 mt-2">{run.timestamp.split(" ")[1]}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 p-4 bg-[#0a0a0f] rounded-lg">
                  <p className="text-sm text-gray-400">
                    Average Pass Rate:{" "}
                    <span className="font-semibold text-white">
                      {Math.round(
                        recentRuns.reduce((sum, run) => sum + (run.passed / run.totalTests) * 100, 0) / recentRuns.length
                      )}%
                    </span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
