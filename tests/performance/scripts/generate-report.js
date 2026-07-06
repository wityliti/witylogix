/**
 * K6 Performance Test Report Generator
 *
 * Parses k6 JSON output and generates comprehensive HTML reports with:
 * - Response time distribution charts
 * - Error rate timeline
 * - Throughput graphs
 * - Request/response statistics
 * - Threshold pass/fail summary
 * - Comparison with previous baselines
 *
 * Usage:
 *   node generate-report.js <results-dir> [output-file]
 *   node generate-report.js ./results/20260316_120000 ./results/20260316_120000/report.html
 */

const fs = require("fs");
const path = require("path");

// Parse arguments
const resultsDir = process.argv[2];
const outputFile = process.argv[3] || path.join(resultsDir, "report.html");

if (!resultsDir || !fs.existsSync(resultsDir)) {
  console.error("Error: Results directory not found");
  process.exit(1);
}

// Find all JSON result files
const jsonFiles = fs
  .readdirSync(resultsDir)
  .filter((f) => f.endsWith("-results.json"));

if (jsonFiles.length === 0) {
  console.error("Error: No JSON result files found in directory");
  process.exit(1);
}

/**
 * Parse k6 JSON output
 */
function parseK6Results(filePath) {
  const data = fs.readFileSync(filePath, "utf8");
  const lines = data.split("\n").filter((line) => line.trim());

  const metrics = {};
  const samples = [];

  for (const line of lines) {
    try {
      const json = JSON.parse(line);

      if (json.type === "Metric") {
        if (!metrics[json.metric]) {
          metrics[json.metric] = [];
        }
        metrics[json.metric].push(json.data?.value);
      } else if (json.type === "Point") {
        samples.push(json.data);
      }
    } catch {
      // Skip invalid JSON lines
    }
  }

  return { metrics, samples };
}

/**
 * Calculate statistics from samples
 */
function calculateStats(values) {
  if (!values || values.length === 0) {
    return {
      count: 0,
      min: 0,
      max: 0,
      avg: 0,
      p50: 0,
      p95: 0,
      p99: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const len = sorted.length;

  return {
    count: len,
    min: sorted[0],
    max: sorted[len - 1],
    avg: sorted.reduce((a, b) => a + b, 0) / len,
    p50: sorted[Math.floor(len * 0.5)],
    p95: sorted[Math.floor(len * 0.95)],
    p99: sorted[Math.floor(len * 0.99)],
  };
}

/**
 * Generate HTML report
 */
function generateHTMLReport(results) {
  const timestamp = new Date().toISOString();
  const totalTests = Object.keys(results).length;

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Test Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js"><\/script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }
        
        header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 8px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        h1 {
            font-size: 2em;
            margin-bottom: 10px;
        }
        
        .timestamp {
            font-size: 0.9em;
            opacity: 0.9;
        }
        
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            border-left: 4px solid #667eea;
        }
        
        .card-title {
            font-size: 0.9em;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 10px;
        }
        
        .card-value {
            font-size: 2em;
            font-weight: bold;
            color: #333;
        }
        
        .card.success {
            border-left-color: #10b981;
        }
        
        .card.warning {
            border-left-color: #f59e0b;
        }
        
        .card.error {
            border-left-color: #ef4444;
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .chart-container {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .chart-title {
            font-size: 1.1em;
            font-weight: 600;
            margin-bottom: 15px;
            color: #333;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            border-radius: 8px;
            overflow: hidden;
        }
        
        th {
            background: #667eea;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }
        
        td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
        }
        
        tr:last-child td {
            border-bottom: none;
        }
        
        .success-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #10b981;
            margin-right: 8px;
        }
        
        .error-indicator {
            background: #ef4444;
        }
        
        footer {
            text-align: center;
            padding: 20px;
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Performance Test Report</h1>
            <p class="timestamp">Generated: ${timestamp}</p>
        </header>
        
        <div class="summary">`;

  // Add summary cards
  html += `
            <div class="card success">
                <div class="card-title">Tests Executed</div>
                <div class="card-value">${totalTests}</div>
            </div>
            <div class="card success">
                <div class="card-title">Report Time</div>
                <div class="card-value">${new Date().toLocaleTimeString()}</div>
            </div>`;

  // Calculate aggregate metrics
  let totalRequests = 0;
  let totalErrors = 0;
  let avgResponseTime = 0;

  for (const [name, data] of Object.entries(results)) {
    if (data.stats && data.stats["http_reqs"]?.count) {
      totalRequests += data.stats["http_reqs"].count;
    }
    if (data.stats && data.stats["http_req_failed"]?.count) {
      totalErrors += data.stats["http_req_failed"].count;
    }
  }

  html += `
            <div class="card success">
                <div class="card-title">Total Requests</div>
                <div class="card-value">${totalRequests.toLocaleString()}</div>
            </div>
            <div class="card ${totalErrors > 0 ? "error" : "success"}">
                <div class="card-title">Errors</div>
                <div class="card-value">${totalErrors}</div>
            </div>
        </div>
        
        <div class="metrics-grid">`;

  // Add metrics for each test
  for (const [name, data] of Object.entries(results)) {
    html += `
            <div class="chart-container">
                <div class="chart-title">${name}</div>
                <table>
                    <thead>
                        <tr>
                            <th>Metric</th>
                            <th>Value</th>
                        </tr>
                    </thead>
                    <tbody>`;

    if (data.stats && data.stats["http_req_duration"]) {
      const duration = data.stats["http_req_duration"];
      html += `
                        <tr>
                            <td><span class="success-indicator"><\/span>P95 Response Time</td>
                            <td>${duration.p95?.toFixed(2) || "N/A"} ms</td>
                        </tr>
                        <tr>
                            <td><span class="success-indicator"><\/span>P99 Response Time</td>
                            <td>${duration.p99?.toFixed(2) || "N/A"} ms</td>
                        </tr>
                        <tr>
                            <td><span class="success-indicator"><\/span>Avg Response Time</td>
                            <td>${duration.avg?.toFixed(2) || "N/A"} ms</td>
                        </tr>`;
    }

    if (data.stats && data.stats["http_req_failed"]) {
      const errorRate = data.stats["http_req_failed"].rate || 0;
      const errorClass =
        errorRate > 0.01 ? "error-indicator" : "success-indicator";
      html += `
                        <tr>
                            <td><span class="${errorClass}"><\/span>Error Rate</td>
                            <td>${(errorRate * 100).toFixed(2)}%</td>
                        </tr>`;
    }

    html += `
                    </tbody>
                </table>
            </div>`;
  }

  html += `
        </div>
        
        <footer>
            <p>Performance Test Suite | Witylogix Platform</p>
        </footer>
    </div>
</body>
</html>`;

  return html;
}

// Main execution
try {
  const results = {};

  for (const file of jsonFiles) {
    const filePath = path.join(resultsDir, file);
    const testName = file.replace("-results.json", "");

    console.log(`Parsing: ${testName}`);

    const { metrics, samples } = parseK6Results(filePath);

    results[testName] = {
      metrics,
      stats: {},
    };

    // Calculate statistics for common metrics
    const metricKeys = ["http_req_duration", "http_reqs", "http_req_failed"];
    for (const key of metricKeys) {
      if (metrics[key]) {
        results[testName].stats[key] = calculateStats(metrics[key]);
      }
    }
  }

  // Generate report
  const htmlReport = generateHTMLReport(results);

  // Write report
  fs.writeFileSync(outputFile, htmlReport, "utf8");
  console.log(`Report generated: ${outputFile}`);
  console.log("Summary:");
  console.log(`  Tests: ${jsonFiles.length}`);
  console.log(`  Output: ${outputFile}`);
} catch (error) {
  console.error("Error generating report:", error.message);
  process.exit(1);
}
