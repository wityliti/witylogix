/**
 * Query Analyzer — EXPLAIN ANALYZE wrapper for query performance analysis.
 *
 * Analyzes Prisma query execution plans to identify:
 * - Sequential scans on large tables (>10k rows)
 * - Missing indexes
 * - Expensive joins
 * - Query cost estimation
 *
 * Provides actionable suggestions for query optimization and index creation.
 *
 * Usage:
 *   const analyzer = new QueryAnalyzer(prisma);
 *   const analysis = await analyzer.analyzeQuery(sql, params);
 *   if (analysis.isProblematic) console.log(analysis.suggestions);
 */

/**
 * Query plan node from EXPLAIN output.
 */
interface PlanNode {
  "Node Type": string;
  "Relation Name"?: string;
  "Filter"?: string;
  "Rows": number;
  "Actual Rows"?: number;
  "Total Cost": number;
  "Plans"?: PlanNode[];
  [key: string]: any;
}

/**
 * Index information extracted from query plan.
 */
export interface IndexIssue {
  type: "missing" | "unused" | "partial_index_applicable";
  table: string;
  columns?: string[];
  reason: string;
  cost: number;
  suggestion: string;
}

/**
 * Join analysis result.
 */
export interface JoinAnalysis {
  type: string;
  tables: string[];
  cost: number;
  isExpensive: boolean;
  suggestion?: string;
}

/**
 * Query analysis result.
 */
export interface QueryAnalysis {
  query: string;
  totalCost: number;
  rowsEstimated: number;
  rowsActual?: number;
  hasSequentialScan: boolean;
  isProblematic: boolean;
  severity: "low" | "medium" | "high";
  issues: IndexIssue[];
  joins: JoinAnalysis[];
  suggestions: string[];
}

/**
 * Query Analyzer for EXPLAIN ANALYZE insights.
 *
 * Wraps Prisma query execution with EXPLAIN to identify performance issues
 * and suggest optimizations.
 */
export class QueryAnalyzer {
  private prismaClient: any;
  private largeTableThreshold = 10000;
  private costThreshold = 1000;

  constructor(prismaClient: any) {
    this.prismaClient = prismaClient;
  }

  /**
   * Analyze a SQL query for performance issues.
   *
   * @param sql - Raw SQL query
   * @param params - Query parameters
   * @returns Analysis result
   */
  async analyzeQuery(sql: string, params: any[] = []): Promise<QueryAnalysis> {
    try {
      // Get EXPLAIN plan (PostgreSQL syntax)
      const explainSql = `EXPLAIN (FORMAT JSON, ANALYZE) ${sql}`;

      let plan: PlanNode[] = [];
      try {
        // Execute with raw query for analysis
        const result = await this.prismaClient.$queryRawUnsafe(
          explainSql,
          ...params
        );
        plan = result[0].Plan;
      } catch {
        // Fallback if EXPLAIN not available
        return this.createFallbackAnalysis(sql, params);
      }

      // Extract issues
      const issues = this.analyzeIndexes(plan);
      const joins = this.analyzeJoins(plan);
      const hasSequentialScan = this.hasSequentialScan(plan);

      const totalCost = plan["Total Cost"] || 0;
      const severity = this.calculateSeverity(totalCost, hasSequentialScan);

      return {
        query: sql,
        totalCost,
        rowsEstimated: plan["Rows"] || plan.rows || 0,
        rowsActual: plan["Actual Rows"] || plan.actualRows,
        hasSequentialScan,
        isProblematic: severity !== "low" || issues.length > 0,
        severity,
        issues,
        joins,
        suggestions: this.generateSuggestions(
          issues,
          joins,
          hasSequentialScan,
          totalCost
        ),
      };
    } catch (error) {
      // Return safe fallback on error
      return this.createFallbackAnalysis(sql, params);
    }
  }

  /**
   * Analyze index usage in query plan.
   *
   * @param plan - Query plan root node
   * @returns List of index issues
   */
  private analyzeIndexes(plan: PlanNode): IndexIssue[] {
    const issues: IndexIssue[] = [];

    // Check for sequential scans
    this.walkPlan(plan, (node) => {
      if (node["Node Type"] === "Seq Scan" && node.rows > this.largeTableThreshold) {
        const table = node["Relation Name"] || "unknown";
        const filter = node.Filter || "";

        issues.push({
          type: "missing",
          table,
          columns: this.extractFilterColumns(filter),
          reason: `Sequential scan on large table (${node.rows} rows)`,
          cost: node["Total Cost"],
          suggestion: `Create index on ${table}(${this.extractFilterColumns(filter).join(", ")})`,
        });
      }

      // Bitmap scans indicate index usage
      if (
        node["Node Type"] === "Bitmap Index Scan" &&
        node["Total Cost"] > this.costThreshold
      ) {
        const table = node["Relation Name"] || "unknown";
        issues.push({
          type: "partial_index_applicable",
          table,
          reason: "High-cost bitmap scan - consider partial index",
          cost: node["Total Cost"],
          suggestion: `Create partial index for frequently filtered values on ${table}`,
        });
      }
    });

    return issues;
  }

  /**
   * Analyze joins in query plan.
   *
   * @param plan - Query plan root node
   * @returns List of join operations
   */
  private analyzeJoins(plan: PlanNode): JoinAnalysis[] {
    const joins: JoinAnalysis[] = [];

    this.walkPlan(plan, (node) => {
      const joinTypes = ["Nested Loop", "Hash Join", "Merge Join"];

      if (joinTypes.includes(node["Node Type"])) {
        const cost = node["Total Cost"];
        const isExpensive = cost > this.costThreshold;

        joins.push({
          type: node["Node Type"],
          tables: this.extractTableNamesFromNode(node),
          cost,
          isExpensive,
          suggestion: isExpensive
            ? `${node["Node Type"]} is expensive; consider adding indexes on join columns`
            : undefined,
        });
      }
    });

    return joins;
  }

  /**
   * Check if plan contains sequential scans.
   *
   * @param plan - Query plan root node
   * @returns Whether sequential scan found
   */
  private hasSequentialScan(plan: PlanNode): boolean {
    let found = false;

    this.walkPlan(plan, (node) => {
      if (node["Node Type"] === "Seq Scan") {
        found = true;
      }
    });

    return found;
  }

  /**
   * Recursively walk query plan tree.
   *
   * @param node - Current plan node
   * @param callback - Process function
   */
  private walkPlan(
    node: PlanNode,
    callback: (node: PlanNode) => void
  ): void {
    callback(node);

    if (node.Plans && Array.isArray(node.Plans)) {
      node.Plans.forEach((child) => this.walkPlan(child, callback));
    }
  }

  /**
   * Extract column names from filter clause.
   *
   * @param filter - Filter string
   * @returns Column names
   */
  private extractFilterColumns(filter: string): string[] {
    if (!filter) return [];

    // Simple extraction: find identifiers before operators
    const matches = filter.match(/(\w+)\s*(?:=|<|>|!=)/g);
    if (!matches) return [];

    return matches
      .map((m) => m.replace(/\s*(?:=|<|>|!=)$/, ""))
      .filter((col) => !["AND", "OR", "NOT", "IN"].includes(col.toUpperCase()));
  }

  /**
   * Extract table names from plan node.
   *
   * @param node - Plan node
   * @returns Table names
   */
  private extractTableNamesFromNode(node: PlanNode): string[] {
    const tables: string[] = [];

    if (node["Relation Name"]) {
      tables.push(node["Relation Name"]);
    }

    // Also check nested plans for additional tables
    if (node.Plans && Array.isArray(node.Plans)) {
      node.Plans.forEach((child) => {
        if (child["Relation Name"]) {
          tables.push(child["Relation Name"]);
        }
      });
    }

    return tables;
  }

  /**
   * Calculate severity level.
   *
   * @param cost - Query cost
   * @param hasSequentialScan - Whether sequential scan present
   * @returns Severity level
   */
  private calculateSeverity(
    cost: number,
    hasSequentialScan: boolean
  ): "low" | "medium" | "high" {
    if (hasSequentialScan && cost > this.costThreshold) {
      return "high";
    }

    if (cost > this.costThreshold || hasSequentialScan) {
      return "medium";
    }

    return "low";
  }

  /**
   * Generate optimization suggestions.
   *
   * @param issues - Index issues
   * @param joins - Join operations
   * @param hasSequentialScan - Sequential scan present
   * @param cost - Total query cost
   * @returns Suggestion list
   */
  private generateSuggestions(
    issues: IndexIssue[],
    joins: JoinAnalysis[],
    hasSequentialScan: boolean,
    cost: number
  ): string[] {
    const suggestions: string[] = [];

    if (hasSequentialScan && cost > this.costThreshold) {
      suggestions.push("Add indexes to eliminate sequential scans");
    }

    issues.forEach((issue) => {
      suggestions.push(issue.suggestion);
    });

    const expensiveJoins = joins.filter((j) => j.isExpensive);
    if (expensiveJoins.length > 0) {
      suggestions.push("Review join conditions and add missing indexes on join columns");
    }

    if (suggestions.length === 0) {
      suggestions.push("Query plan looks optimized");
    }

    return suggestions;
  }

  /**
   * Create fallback analysis when EXPLAIN unavailable.
   *
   * @param sql - Raw SQL query
   * @param params - Query parameters
   * @returns Basic analysis
   */
  private createFallbackAnalysis(
    sql: string,
    params: any[]
  ): QueryAnalysis {
    return {
      query: sql,
      totalCost: 0,
      rowsEstimated: 0,
      hasSequentialScan: false,
      isProblematic: false,
      severity: "low",
      issues: [],
      joins: [],
      suggestions: ["EXPLAIN not available; review query manually"],
    };
  }

  /**
   * Set threshold for large table detection.
   *
   * @param threshold - Row count threshold
   */
  setLargeTableThreshold(threshold: number): void {
    this.largeTableThreshold = threshold;
  }

  /**
   * Set threshold for expensive operation detection.
   *
   * @param threshold - Cost threshold
   */
  setCostThreshold(threshold: number): void {
    this.costThreshold = threshold;
  }
}
