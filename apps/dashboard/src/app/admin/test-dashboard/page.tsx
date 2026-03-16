"use client";

import { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

interface TestStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

interface TestCategory {
  name: "unit" | "integration" | "e2e" | "load" | "performance";
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

interface TestRun {
  id: string;
  timestamp: string;
  duration: number;
  totalTests: number;
  passed: number;
  failed: number;
  coverage: number;
}

interface FlakyTest {
  name: string;
  file: string;
  flakiness: number;
  lastPassed: string;
  lastFailed: string;
  suggestion: string;
}

const mockTestStats: TestStats = {
  total: 1247,
  passed: 1220,
  failed: 12,
  skipped: 15,
  duration: 187,
};

const mockCategories: TestCategory[] = [
  { name: "unit", count: 745, passed: 740, coverage: 87 },
  { name: "integration", count: 385, passed: 365, coverage: 64 },
  { name: "e2e", count: 92, passed: 92, coverage: 52 },
  { name: "load", count: 15, passed: 15, coverage: 0 },
  { name: "performance", count: 10, passed: 8, coverage: 0 },
];

const mockPackages: PackageCoverage[] = [
  {
    name: "api",
    tests: 385,
    coverage: 82,
    lastRun: "2 mins ago",
    status: "success",
  },
  {
    name: "core",
    tests: 287,
    coverage: 88,
    lastRun: "2 mins ago",
    status: "success",
  },
  {
    name: "db",
    tests: 156,
    coverage: 72,
    lastRun: "5 mins ago",
    status: "warning",
  },
  {
    name: "sdk",
    tests: 234,
    coverage: 79,
    lastRun: "2 mins ago",
    status: "success",
  },
  {
    name: "validators",
    tests: 95,
    coverage: 91,
    lastRun: "2 mins ago",
    status: "success",
  },
];

const mockFlakyTests: FlakyTest[] = [
  {
    name: "Should handle async database operations",
    file: "tests/integration/database/operations.test.ts",
    flakiness: 35,
    lastPassed: "2026-03-15 14:32:00",
    lastFailed: "2026-03-14 10:15:00",
    suggestion: "Increase timeout or mock database connection",
  },
  {
    name: "Should process webhook events",
    file: "tests/integration/webhooks/processing.test.ts",
    flakiness: 28,
    lastPassed: "2026-03-15 14:25:00",
    lastFailed: "2026-03-14 22:40:00",
    suggestion: "Mock external service calls",
  },
];

const mockTestRuns: TestRun[] = [
  {
    id: "run-10",
    timestamp: "2026-03-16 14:30",
    duration: 187,
    totalTests: 1247,
    passed: 1220,
    failed: 12,
    coverage: 79,
  },
  {
    id: "run-9",
    timestamp: "2026-03-16 12:15",
    duration: 195,
    totalTests: 1245,
    passed: 1218,
    failed: 14,
    coverage: 78,
  },
  {
    id: "run-8",
    timestamp: "2026-03-16 10:00",
    duration: 182,
    totalTests: 1240,
    passed: 1225,
    failed: 8,
    coverage: 79,
  },
  {
    id: "run-7",
    timestamp: "2026-03-15 18:45",
    duration: 198,
    totalTests: 1235,
    passed: 1210,
    failed: 18,
    coverage: 77,
  },
  {
    id: "run-6",
    timestamp: "2026-03-15 16:20",
    duration: 176,
    totalTests: 1233,
    passed: 1220,
    failed: 10,
    coverage: 79,
  },
];

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
  const [isRefreshing, setIsRefreshing] = useState(false);

  const passRate = getPassRate(mockTestStats.passed, mockTestStats.total);
  const failRate = getPassRate(mockTestStats.failed, mockTestStats.total);
  const avgCoverage = Math.round(
    mockCategories
      .filter((c) => c.coverage > 0)
      .reduce((sum, c) => sum + c.coverage, 0) /
      mockCategories.filter((c) => c.coverage > 0).length
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-wl-bg">
      <Header title="Test Results Dashboard" />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          {/* Total Tests */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-wl-text-secondary mb-2">
                    Total Tests
                  </p>
                  <p className="text-3xl font-bold text-wl-text-primary">
                    {mockTestStats.total}
                  </p>
                </div>
                <BarChart3 className="w-8 h-8 text-blue-500 opacity-60" />
              </div>
            </CardContent>
          </Card>

          {/* Passed */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-wl-text-secondary mb-2">Passed</p>
                  <p className="text-3xl font-bold text-green-600">
                    {mockTestStats.passed}
                  </p>
                  <p className="text-xs text-wl-text-secondary mt-1">
                    {passRate}% pass rate
                  </p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-green-500 opacity-60" />
              </div>
            </CardContent>
          </Card>

          {/* Failed */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-wl-text-secondary mb-2">Failed</p>
                  <p className="text-3xl font-bold text-red-600">
                    {mockTestStats.failed}
                  </p>
                  <p className="text-xs text-wl-text-secondary mt-1">
                    {failRate}% fail rate
                  </p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-500 opacity-60" />
              </div>
            </CardContent>
          </Card>

          {/* Coverage */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-wl-text-secondary mb-2">
                    Avg Coverage
                  </p>
                  <p className="text-3xl font-bold text-wl-text-primary">
                    {avgCoverage}%
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-500 opacity-60" />
              </div>
            </CardContent>
          </Card>

          {/* Duration */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-wl-text-secondary mb-2">
                    Duration
                  </p>
                  <p className="text-3xl font-bold text-wl-text-primary">
                    {mockTestStats.duration}s
                  </p>
                </div>
                <Zap className="w-8 h-8 text-yellow-500 opacity-60" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tests by Category */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Tests by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockCategories.map((category) => {
                  const passRate = getPassRate(category.passed, category.count);
                  return (
                    <div key={category.name}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="capitalize font-medium text-wl-text-primary">
                          {category.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-wl-text-secondary">
                            {category.count} tests
                          </span>
                          {category.coverage > 0 && (
                            <Badge
                              variant={
                                category.coverage >= 80
                                  ? "success"
                                  : category.coverage >= 60
                                    ? "warning"
                                    : "error"
                              }
                            >
                              {category.coverage}%
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-wl-bg-subtle rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${passRate}%` }}
                        />
                      </div>
                      <p className="text-xs text-wl-text-secondary mt-1">
                        {category.passed}/{category.count} passed ({passRate}%)
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Package Coverage */}
          <Card>
            <CardHeader>
              <CardTitle>Package Coverage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockPackages.map((pkg) => (
                  <div
                    key={pkg.name}
                    className="flex items-center justify-between p-3 bg-wl-bg-subtle rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-wl-text-primary capitalize">
                        {pkg.name}
                      </p>
                      <p className="text-xs text-wl-text-secondary">
                        {pkg.tests} tests • {pkg.lastRun}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-wl-bg-elevated rounded-full h-1.5">
                          <div
                            className={cn(
                              "h-1.5 rounded-full transition-all",
                              pkg.coverage >= 80
                                ? "bg-green-500"
                                : pkg.coverage >= 60
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                            )}
                            style={{ width: `${pkg.coverage}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-wl-text-primary w-10 text-right">
                          {pkg.coverage}%
                        </span>
                      </div>
                      {pkg.status === "success" && (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                      {pkg.status === "warning" && (
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Flaky Tests */}
        <div className="grid grid-cols-1 gap-8 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Flaky Tests</CardTitle>
            </CardHeader>
            <CardContent>
              {mockFlakyTests.length === 0 ? (
                <p className="text-sm text-wl-text-secondary text-center py-4">
                  No flaky tests detected
                </p>
              ) : (
                <div className="space-y-4">
                  {mockFlakyTests.map((test, idx) => (
                    <div
                      key={idx}
                      className="p-4 border border-yellow-500/20 bg-yellow-500/5 rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-wl-text-primary">
                          {test.name}
                        </h4>
                        <Badge variant="warning">{test.flakiness}% flaky</Badge>
                      </div>
                      <p className="text-xs text-wl-text-secondary mb-2">
                        {test.file}
                      </p>
                      <p className="text-sm text-wl-text-secondary mb-3">
                        Last Passed: {test.lastPassed} • Last Failed:{" "}
                        {test.lastFailed}
                      </p>
                      <div className="bg-white/5 rounded p-2">
                        <p className="text-xs font-medium mb-1 text-wl-text-secondary">
                          Suggestion:
                        </p>
                        <p className="text-xs text-wl-text-secondary">
                          {test.suggestion}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Test Runs */}
        <div className="grid grid-cols-1 gap-8 mb-8">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Recent Test Runs</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={cn(
                    "w-4 h-4 mr-2",
                    isRefreshing && "animate-spin"
                  )}
                />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-wl-border-subtle">
                      <th className="text-left py-3 px-4 font-medium text-wl-text-secondary">
                        Timestamp
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-wl-text-secondary">
                        Total
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-wl-text-secondary">
                        Passed
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-wl-text-secondary">
                        Failed
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-wl-text-secondary">
                        Coverage
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-wl-text-secondary">
                        Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockTestRuns.map((run) => (
                      <tr
                        key={run.id}
                        className="border-b border-wl-border-subtle hover:bg-wl-bg-subtle transition-colors"
                      >
                        <td className="py-3 px-4 text-wl-text-primary">
                          {run.timestamp}
                        </td>
                        <td className="py-3 px-4 text-wl-text-secondary">
                          {run.totalTests}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-green-600 font-medium">
                            {run.passed}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              "font-medium",
                              run.failed > 0
                                ? "text-red-600"
                                : "text-green-600"
                            )}
                          >
                            {run.failed}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              run.coverage >= 80
                                ? "success"
                                : run.coverage >= 60
                                  ? "warning"
                                  : "error"
                            }
                          >
                            {run.coverage}%
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-wl-text-secondary">
                          {run.duration}s
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Test Trend Chart */}
        <div className="grid grid-cols-1 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Test Trend (Last 10 Runs)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end gap-2">
                {mockTestRuns.map((run, idx) => {
                  const passRate = Math.round(
                    (run.passed / run.totalTests) * 100
                  );
                  const height = (passRate / 100) * 240;

                  return (
                    <div
                      key={run.id}
                      className="flex-1 flex flex-col items-center"
                    >
                      <div
                        className="w-full rounded-t transition-all hover:bg-blue-500/30 bg-blue-500/20"
                        style={{ height: `${height}px` }}
                        title={`${passRate}% pass rate`}
                      />
                      <p className="text-xs text-wl-text-secondary mt-2">
                        {run.timestamp.split(" ")[1]}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 p-4 bg-wl-bg-subtle rounded-lg">
                <p className="text-sm text-wl-text-secondary">
                  Average Pass Rate:{" "}
                  <span className="font-semibold text-wl-text-primary">
                    {Math.round(
                      mockTestRuns.reduce(
                        (sum, run) => sum + (run.passed / run.totalTests) * 100,
                        0
                      ) / mockTestRuns.length
                    )}
                    %
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
