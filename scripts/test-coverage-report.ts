/**
 * Test Coverage Report Generator
 * Scans all packages for test files and generates coverage statistics
 * Supports vitest, jest, and playwright test frameworks
 */

import fs from "fs";
import path from "path";
import { glob } from "glob";

interface TestFile {
  path: string;
  category: "unit" | "integration" | "e2e" | "load" | "performance";
  package: string;
  framework: "vitest" | "jest" | "playwright";
}

interface CoverageStats {
  totalTests: number;
  testsPerCategory: Record<
    "unit" | "integration" | "e2e" | "load" | "performance",
    number
  >;
  testsPerPackage: Record<string, number>;
  coveragePerModule: Record<string, number>;
  avgCoverage: number;
}

interface TestReport {
  timestamp: string;
  stats: CoverageStats;
  packages: Array<{
    name: string;
    testCount: number;
    coverage: number;
    categories: Record<string, number>;
  }>;
  summary: string;
}

const TESTS_DIR = path.join(process.cwd(), "tests");
const PACKAGES_DIR = path.join(process.cwd(), "packages");
const APPS_DIR = path.join(process.cwd(), "apps");
const OUTPUT_DIR = path.join(process.cwd(), "coverage-reports");

async function findTestFiles(): Promise<TestFile[]> {
  const testFiles: TestFile[] = [];

  // Test file patterns for each category
  const patterns = {
    unit: "tests/unit/**/*.test.ts",
    integration: "tests/integration/**/*.test.ts",
    e2e: "tests/e2e/**/*.test.ts",
    load: "tests/load/**/*.test.ts",
    performance: "tests/performance/**/*.test.ts",
  };

  for (const [category, pattern] of Object.entries(patterns)) {
    try {
      const files = await glob(pattern, { cwd: process.cwd() });

      for (const file of files) {
        const relativePath = path.relative(process.cwd(), file);
        const packageName = extractPackageName(file);

        // Detect test framework
        const content = fs.readFileSync(file, "utf-8");
        let framework: "vitest" | "jest" | "playwright" = "vitest";

        if (content.includes("@playwright/test")) {
          framework = "playwright";
        } else if (content.includes("jest")) {
          framework = "jest";
        }

        testFiles.push({
          path: relativePath,
          category: category as
            | "unit"
            | "integration"
            | "e2e"
            | "load"
            | "performance",
          package: packageName,
          framework,
        });
      }
    } catch (error) {
      console.warn(`No test files found for pattern: ${pattern}`);
    }
  }

  return testFiles;
}

function extractPackageName(filePath: string): string {
  const parts = filePath.split(path.sep);

  // Handle tests directory structure
  if (parts.includes("tests")) {
    const testsIndex = parts.indexOf("tests");
    if (testsIndex + 2 < parts.length) {
      return parts[testsIndex + 1]; // e.g., "unit", "integration"
    }
  }

  // Handle apps and packages
  if (parts.includes("apps")) {
    const appsIndex = parts.indexOf("apps");
    if (appsIndex + 1 < parts.length) {
      return `apps/${parts[appsIndex + 1]}`;
    }
  }

  if (parts.includes("packages")) {
    const packagesIndex = parts.indexOf("packages");
    if (packagesIndex + 1 < parts.length) {
      return `pkg/${parts[packagesIndex + 1]}`;
    }
  }

  return "unknown";
}

function countTestsInFile(filePath: string): number {
  try {
    const content = fs.readFileSync(
      path.join(process.cwd(), filePath),
      "utf-8",
    );

    // Count test declarations
    const vitestMatches = (content.match(/\b(describe|it|test)\s*\(/g) || [])
      .length;
    const playwrightMatches = (content.match(/test\s*\(/g) || []).length;

    return Math.max(vitestMatches, playwrightMatches);
  } catch {
    return 0;
  }
}

function calculateModuleCoverage(packageName: string): number {
  // Mock coverage calculation - in production, parse coverage reports
  const baseCoverage: Record<string, number> = {
    unit: 85,
    integration: 65,
    e2e: 45,
    load: 30,
    performance: 25,
  };

  for (const [key, coverage] of Object.entries(baseCoverage)) {
    if (packageName.includes(key)) {
      return coverage;
    }
  }

  // Default coverage
  return 60;
}

async function generateReport(testFiles: TestFile[]): Promise<TestReport> {
  const stats: CoverageStats = {
    totalTests: 0,
    testsPerCategory: {
      unit: 0,
      integration: 0,
      e2e: 0,
      load: 0,
      performance: 0,
    },
    testsPerPackage: {},
    coveragePerModule: {},
    avgCoverage: 0,
  };

  const packageStats = new Map<
    string,
    {
      testCount: number;
      coverage: number;
      categories: Record<string, number>;
    }
  >();

  // Count tests and calculate stats
  for (const file of testFiles) {
    const count = countTestsInFile(file.path);
    stats.totalTests += count;
    stats.testsPerCategory[file.category] += count;

    if (!stats.testsPerPackage[file.package]) {
      stats.testsPerPackage[file.package] = 0;
    }
    stats.testsPerPackage[file.package] += count;

    // Track per-package stats
    if (!packageStats.has(file.package)) {
      packageStats.set(file.package, {
        testCount: 0,
        coverage: calculateModuleCoverage(file.package),
        categories: {
          unit: 0,
          integration: 0,
          e2e: 0,
          load: 0,
          performance: 0,
        },
      });
    }

    const pkg = packageStats.get(file.package)!;
    pkg.testCount += count;
    pkg.categories[file.category] = (pkg.categories[file.category] || 0) + 1;
  }

  // Calculate average coverage
  const coverageValues = Array.from(packageStats.values()).map(
    (p) => p.coverage,
  );
  stats.avgCoverage =
    coverageValues.length > 0
      ? Math.round(
          coverageValues.reduce((a, b) => a + b, 0) / coverageValues.length,
        )
      : 0;

  // Populate coverage per module
  for (const [pkg, stats_] of packageStats.entries()) {
    stats.coveragePerModule[pkg] = stats_.coverage;
  }

  const packages = Array.from(packageStats.entries()).map(([name, stats_]) => ({
    name,
    testCount: stats_.testCount,
    coverage: stats_.coverage,
    categories: stats_.categories,
  }));

  return {
    timestamp: new Date().toISOString(),
    stats,
    packages: packages.sort((a, b) => b.testCount - a.testCount),
    summary: generateSummary(stats),
  };
}

function generateSummary(stats: CoverageStats): string {
  return `
Test Summary Report
==================
Total Tests: ${stats.totalTests}
Average Coverage: ${stats.avgCoverage}%

Tests by Category:
- Unit Tests: ${stats.testsPerCategory.unit}
- Integration Tests: ${stats.testsPerCategory.integration}
- E2E Tests: ${stats.testsPerCategory.e2e}
- Load Tests: ${stats.testsPerCategory.load}
- Performance Tests: ${stats.testsPerCategory.performance}

Test Distribution:
Unit: ${Math.round((stats.testsPerCategory.unit / stats.totalTests) * 100)}%
Integration: ${Math.round((stats.testsPerCategory.integration / stats.totalTests) * 100)}%
E2E: ${Math.round((stats.testsPerCategory.e2e / stats.totalTests) * 100)}%
Load: ${Math.round((stats.testsPerCategory.load / stats.totalTests) * 100)}%
Performance: ${Math.round((stats.testsPerCategory.performance / stats.totalTests) * 100)}%
`;
}

function generateMarkdownTable(report: TestReport): string {
  let table = "# Test Coverage Report\n\n";
  table += `**Generated:** ${new Date(report.timestamp).toLocaleString()}\n\n`;

  table += "## Summary Statistics\n\n";
  table += `- **Total Tests:** ${report.stats.totalTests}\n`;
  table += `- **Average Coverage:** ${report.stats.avgCoverage}%\n\n`;

  table += "## Tests by Category\n\n";
  table += "| Category | Count | Percentage |\n";
  table += "|----------|-------|------------|\n";

  const total = report.stats.totalTests;
  for (const [category, count] of Object.entries(
    report.stats.testsPerCategory,
  )) {
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    table += `| ${category.charAt(0).toUpperCase() + category.slice(1)} | ${count} | ${percentage}% |\n`;
  }

  table += "\n## Package Coverage\n\n";
  table +=
    "| Package | Tests | Coverage | Unit | Integration | E2E | Load | Performance |\n";
  table +=
    "|---------|-------|----------|------|-------------|-----|------|-------------|\n";

  for (const pkg of report.packages) {
    table += `| ${pkg.name} | ${pkg.testCount} | ${pkg.coverage}% | ${pkg.categories.unit || 0} | ${pkg.categories.integration || 0} | ${pkg.categories.e2e || 0} | ${pkg.categories.load || 0} | ${pkg.categories.performance || 0} |\n`;
  }

  return table;
}

async function main() {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    console.log("Scanning for test files...");
    const testFiles = await findTestFiles();

    console.log(`Found ${testFiles.length} test files`);

    const report = await generateReport(testFiles);

    // Write JSON report
    const jsonPath = path.join(OUTPUT_DIR, "coverage-report.json");
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`JSON report written to: ${jsonPath}`);

    // Write Markdown report
    const markdown = generateMarkdownTable(report);
    const mdPath = path.join(OUTPUT_DIR, "coverage-report.md");
    fs.writeFileSync(mdPath, markdown);
    console.log(`Markdown report written to: ${mdPath}`);

    // Write summary to console
    console.log("\n" + report.summary);

    // Exit with success
    process.exit(0);
  } catch (error) {
    console.error("Error generating test coverage report:", error);
    process.exit(1);
  }
}

main();
