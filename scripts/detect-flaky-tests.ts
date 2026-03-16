/**
 * Flaky Test Detector
 * Analyzes test results to identify flaky tests and patterns
 * Tracks pass/fail history and generates recommendations
 */

import fs from "fs";
import path from "path";

interface TestResult {
  name: string;
  file: string;
  passed: boolean;
  duration: number;
  error?: string;
  timestamp: string;
}

interface FlakyTestData {
  name: string;
  file: string;
  passCount: number;
  failCount: number;
  flakiness: number;
  lastPassed?: string;
  lastFailed?: string;
  suggestions: string[];
}

interface FlakyTestReport {
  timestamp: string;
  totalTests: number;
  flakyTests: FlakyTestData[];
  summary: string;
}

const RESULTS_DIR = path.join(process.cwd(), "test-results");
const REPORT_DIR = path.join(process.cwd(), "coverage-reports");
const FLAKY_HISTORY_FILE = path.join(REPORT_DIR, "flaky-history.json");

interface FlakyHistory {
  [testName: string]: {
    file: string;
    results: Array<{
      passed: boolean;
      timestamp: string;
    }>;
  };
}

function loadTestResults(): TestResult[] {
  const results: TestResult[] = [];

  // Mock loading of test results from multiple sources
  // In production, this would parse actual test result files
  const mockResults: TestResult[] = [
    {
      name: "Should calculate shipping cost",
      file: "tests/unit/shipping/rate-calculator.test.ts",
      passed: true,
      duration: 45,
      timestamp: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      name: "Should handle async database operations",
      file: "tests/integration/database/operations.test.ts",
      passed: true,
      duration: 120,
      timestamp: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      name: "Should handle async database operations",
      file: "tests/integration/database/operations.test.ts",
      passed: false,
      duration: 15000,
      error: "Timeout: Test exceeded 10000ms",
      timestamp: new Date(Date.now() - 43200000).toISOString(),
    },
    {
      name: "Should validate payment method",
      file: "tests/unit/payment/validator.test.ts",
      passed: true,
      duration: 78,
      timestamp: new Date(Date.now() - 43200000).toISOString(),
    },
    {
      name: "Should handle async database operations",
      file: "tests/integration/database/operations.test.ts",
      passed: true,
      duration: 125,
      timestamp: new Date().toISOString(),
    },
    {
      name: "Should process webhook events",
      file: "tests/integration/webhooks/processing.test.ts",
      passed: false,
      duration: 5000,
      error: "Random connection refused",
      timestamp: new Date().toISOString(),
    },
    {
      name: "Should process webhook events",
      file: "tests/integration/webhooks/processing.test.ts",
      passed: true,
      duration: 95,
      timestamp: new Date().toISOString(),
    },
  ];

  return mockResults;
}

function loadFlakyHistory(): FlakyHistory {
  if (fs.existsSync(FLAKY_HISTORY_FILE)) {
    try {
      const content = fs.readFileSync(FLAKY_HISTORY_FILE, "utf-8");
      return JSON.parse(content);
    } catch {
      return {};
    }
  }
  return {};
}

function saveFlakyHistory(history: FlakyHistory): void {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
  fs.writeFileSync(FLAKY_HISTORY_FILE, JSON.stringify(history, null, 2));
}

function updateFlakyHistory(
  history: FlakyHistory,
  results: TestResult[]
): FlakyHistory {
  for (const result of results) {
    const testKey = result.name;

    if (!history[testKey]) {
      history[testKey] = {
        file: result.file,
        results: [],
      };
    }

    history[testKey].results.push({
      passed: result.passed,
      timestamp: result.timestamp,
    });

    // Keep only last 100 results per test
    if (history[testKey].results.length > 100) {
      history[testKey].results = history[testKey].results.slice(-100);
    }
  }

  return history;
}

function detectFlakyTests(history: FlakyHistory): FlakyTestData[] {
  const flakyTests: FlakyTestData[] = [];

  for (const [testName, data] of Object.entries(history)) {
    const passCount = data.results.filter((r) => r.passed).length;
    const failCount = data.results.filter((r) => !r.passed).length;
    const totalRuns = data.results.length;

    // Test is flaky if it has mixed pass/fail history (flakiness > 20% and < 80%)
    const flakiness = failCount / totalRuns;
    const isFlaky = flakiness > 0.2 && flakiness < 0.8;

    if (isFlaky && totalRuns >= 5) {
      const lastPassed = data.results
        .reverse()
        .find((r) => r.passed)?.timestamp;
      const lastFailed = data.results.find((r) => !r.passed)?.timestamp;
      data.results.reverse();

      const suggestions = generateSuggestions(testName, data, flakiness);

      flakyTests.push({
        name: testName,
        file: data.file,
        passCount,
        failCount,
        flakiness: Math.round(flakiness * 100),
        lastPassed,
        lastFailed,
        suggestions,
      });
    }
  }

  return flakyTests.sort((a, b) => b.flakiness - a.flakiness);
}

function generateSuggestions(
  testName: string,
  data: { file: string; results: Array<{ passed: boolean; timestamp: string }> },
  flakiness: number
): string[] {
  const suggestions: string[] = [];

  // Check for timeout patterns
  if (testName.toLowerCase().includes("async") || testName.toLowerCase().includes("database")) {
    suggestions.push("Increase test timeout or add explicit wait conditions");
    suggestions.push(
      "Review async operations for race conditions or timing issues"
    );
  }

  // Check for external service calls
  if (
    testName.toLowerCase().includes("webhook") ||
    testName.toLowerCase().includes("api") ||
    testName.toLowerCase().includes("network")
  ) {
    suggestions.push(
      "Add network error handling and retry logic to test setup"
    );
    suggestions.push("Mock external service calls to eliminate dependencies");
  }

  // Check for data-dependent issues
  if (
    testName.toLowerCase().includes("data") ||
    testName.toLowerCase().includes("order") ||
    testName.toLowerCase().includes("state")
  ) {
    suggestions.push("Ensure test data is properly isolated and cleaned up");
    suggestions.push("Check for database transaction or state pollution issues");
  }

  // High flakiness
  if (flakiness > 0.5) {
    suggestions.push("CRITICAL: Test is failing more than it passes");
    suggestions.push("Consider marking test as @skip until issues are fixed");
  }

  // Add generic suggestion if none specific
  if (suggestions.length === 0) {
    suggestions.push("Review test for timing-sensitive operations");
    suggestions.push("Check for uncontrolled randomness in test data");
  }

  return suggestions;
}

function generateReport(flakyTests: FlakyTestData[]): FlakyTestReport {
  const totalTests = 0; // Would be loaded from coverage report
  let summary = `# Flaky Test Report\n\n`;

  if (flakyTests.length === 0) {
    summary += "No flaky tests detected. Great job!\n";
  } else {
    summary += `Found ${flakyTests.length} flaky test(s):\n\n`;

    for (const test of flakyTests) {
      summary += `## ${test.name}\n`;
      summary += `- **File:** ${test.file}\n`;
      summary += `- **Flakiness:** ${test.flakiness}%\n`;
      summary += `- **Pass Count:** ${test.passCount}\n`;
      summary += `- **Fail Count:** ${test.failCount}\n`;
      summary += `- **Last Passed:** ${test.lastPassed || "Never"}\n`;
      summary += `- **Last Failed:** ${test.lastFailed || "Never"}\n\n`;

      summary += `### Suggestions:\n`;
      for (const suggestion of test.suggestions) {
        summary += `- ${suggestion}\n`;
      }
      summary += "\n";
    }
  }

  return {
    timestamp: new Date().toISOString(),
    totalTests,
    flakyTests,
    summary,
  };
}

async function main() {
  try {
    console.log("Loading test results...");
    const results = loadTestResults();
    console.log(`Loaded ${results.length} test results`);

    console.log("Updating flaky test history...");
    let history = loadFlakyHistory();
    history = updateFlakyHistory(history, results);
    saveFlakyHistory(history);

    console.log("Detecting flaky tests...");
    const flakyTests = detectFlakyTests(history);

    const report = generateReport(flakyTests);

    // Write JSON report
    if (!fs.existsSync(REPORT_DIR)) {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
    }

    const jsonPath = path.join(REPORT_DIR, "flaky-tests-report.json");
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`JSON report written to: ${jsonPath}`);

    // Write markdown report
    const mdPath = path.join(REPORT_DIR, "flaky-tests-report.md");
    fs.writeFileSync(mdPath, report.summary);
    console.log(`Markdown report written to: ${mdPath}`);

    console.log("\n" + report.summary);

    process.exit(0);
  } catch (error) {
    console.error("Error detecting flaky tests:", error);
    process.exit(1);
  }
}

main();
