"use client";

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
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface TestStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

interface TestCategory {
  name: string;
  count: number;
  passed: number;
  coverage: number;
}

interface PackageCoverage {
  name: string;
  tests: number;
  coverage: number;
  lastRun: string;
  status: "success" | "warning" | "error";
}

interface FlakyTest {
  name: string;
  file: string;
  flakiness: number;
  lastPassed: string;
  lastFailed: string;
  suggestion: string;
}

interface TestRun {
  id: string;
  timestamp: string;
  duration: number;
  totalTests: number;
  passed: number;
  failed: number;
  coverage: number;
}

interface TestDashboardData {
  stats: TestStats;
  categories: TestCategory[];
  packages: PackageCoverage[];
  flakyTests: FlakyTest[];
  recentRuns: TestRun[];
}

const getPassRate = (passed: number, total: number): number =>
  total > 0 ? Math.round((passed / total) * 100) : 0;

export default function TestDashboardPage() {
  const { data, loading, error, refetch } = useApiQuery<TestDashboardData>('/api/v4/admin/test-results');
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const stats = data?.stats;
  const categories = data?.categories ?? [];
  const packages = data?.packages ?? [];
  const flakyTests = data?.flakyTests ?? [];
  const recentRuns = data?.recentRuns ?? [];

  const passRate = stats ? getPassRate(stats.passed, stats.total) : 0;
  const failRate = stats ? getPassRate(stats.failed, stats.total) : 0;
  const avgCoverage = categories.filter(c => c.coverage > 0).length > 0
    ? Math.round(
        categories.filter(c => c.coverage > 0).reduce((sum, c) => sum + c.coverage, 0) /
        categories.filter(c => c.coverage > 0).length
      )
    : 0;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <Header title="Test Results Dashboard" />
        <div className="container mx-auto px-4 py-16 max-w-7xl flex flex-col items-center justify-center text-center">
          <BarChart3 className="w-16 h-16 text-gray-500 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">No test data available</h2>
          <p className="text-gray-400 text-sm mb-6">Connect your CI pipeline to start tracking test results.</p>
          <Button variant="secondary" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Header title="Test Results Dashboard" />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Summary Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Total Tests</p>
                    <p className="text-3xl font-bold text-white">{stats.total}</p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-blue-500 opacity-60" />
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
                  <CheckCircle2 className="w-8 h-8 text-green-500 opacity-60" />
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
                  <AlertCircle className="w-8 h-8 text-red-500 opacity-60" />
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
                  <TrendingUp className="w-8 h-8 text-blue-500 opacity-60" />
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
                  <Zap className="w-8 h-8 text-yellow-500 opacity-60" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tests by Category + Package Coverage */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card>
            <div className="p-6 border-b border-[#1e1e2e]">
              <h3 className="text-base font-semibold text-white">Tests by Category</h3>
            </div>
            <CardContent className="pt-4">
              {categories.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No category data</p>
              ) : (
                <div className="space-y-4">
                  {categories.map((category) => {
                    const pr = getPassRate(category.passed, category.count);
                    return (
                      <div key={category.name}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="capitalize font-medium text-white">{category.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400">{category.count} tests</span>
                            {category.coverage > 0 && (
                              <Badge variant={category.coverage >= 80 ? "success" : category.coverage >= 60 ? "warning" : "danger"}>
                                {category.coverage}%
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="w-full bg-[#1a1a2e] rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${pr}%` }} />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{category.passed}/{category.count} passed ({pr}%)</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <div className="p-6 border-b border-[#1e1e2e]">
              <h3 className="text-base font-semibold text-white">Package Coverage</h3>
            </div>
            <CardContent className="pt-4">
              {packages.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No package data</p>
              ) : (
                <div className="space-y-3">
                  {packages.map((pkg) => (
                    <div key={pkg.name} className="flex items-center justify-between p-3 bg-[#1a1a2e] rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-white capitalize">{pkg.name}</p>
                        <p className="text-xs text-gray-400">{pkg.tests} tests • {pkg.lastRun}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-[#0a0a0f] rounded-full h-1.5">
                            <div
                              className={cn("h-1.5 rounded-full transition-all", pkg.coverage >= 80 ? "bg-green-500" : pkg.coverage >= 60 ? "bg-yellow-500" : "bg-red-500")}
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
            <div className="p-6 border-b border-[#1e1e2e]">
              <h3 className="text-base font-semibold text-white">Flaky Tests</h3>
            </div>
            <CardContent className="pt-4">
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
                      <div className="bg-white/5 rounded p-2">
                        <p className="text-xs font-medium mb-1 text-gray-400">Suggestion:</p>
                        <p className="text-xs text-gray-400">{test.suggestion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Test Runs */}
        <div className="mb-8">
          <Card>
            <div className="p-6 border-b border-[#1e1e2e] flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Recent Test Runs</h3>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                Refresh
              </button>
            </div>
            <CardContent className="pt-0">
              {recentRuns.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">No recent runs</p>
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
                        <tr key={run.id} className="border-b border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors">
                          <td className="py-3 px-4 text-white">{run.timestamp}</td>
                          <td className="py-3 px-4 text-gray-400">{run.totalTests}</td>
                          <td className="py-3 px-4 text-green-600 font-medium">{run.passed}</td>
                          <td className="py-3 px-4">
                            <span className={cn("font-medium", run.failed > 0 ? "text-red-600" : "text-green-600")}>{run.failed}</span>
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
      </div>
    </div>
  );
}
