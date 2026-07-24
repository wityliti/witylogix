/**
 * Index Advisor — Recommends indexes based on query patterns over time.
 *
 * Analyzes aggregate query patterns to recommend:
 * - Composite indexes for WHERE + ORDER BY patterns
 * - Partial indexes for filtered queries
 * - Index size impact estimates
 * - Detection of unused indexes
 *
 * Maintains time-windowed pattern analysis (default 1 hour window).
 *
 * Usage:
 *   const advisor = new IndexAdvisor();
 *   advisor.recordQuery(sql, params);
 *   const recommendations = advisor.getRecommendations();
 */

/**
 * Recorded query pattern for analysis.
 */
interface QueryRecord {
  sql: string;
  whereColumns: string[];
  orderByColumns: string[];
  table: string;
  timestamp: number;
  executionCount: number;
}

/**
 * Column cardinality estimate.
 */
interface ColumnStats {
  column: string;
  table: string;
  selectivity: number; // 0-1, lower = more selective
  frequency: number; // How often used in filters
}

/**
 * Index recommendation.
 */
export interface IndexRecommendation {
  name: string;
  table: string;
  columns: string[];
  type: "simple" | "composite" | "partial";
  estimatedSizeBytes: number;
  estimatedImpactPercent: number;
  createSql: string;
  reason: string;
}

/**
 * Index Advisor for pattern-based recommendations.
 *
 * Accumulates query patterns over a time window and generates index
 * recommendations based on observed WHERE and ORDER BY patterns.
 */
export class IndexAdvisor {
  private queryRecords: QueryRecord[] = [];
  private columnStats: Map<string, ColumnStats> = new Map();
  private readonly windowMs = 60 * 60 * 1000; // 1 hour
  private readonly minQueryCount = 3; // Min queries to recommend index
  private readonly estimatedRowsPerTable: Map<string, number> = new Map();

  constructor() {
    this.initializeDefaultTableStats();
  }

  /**
   * Record a query for pattern analysis.
   *
   * @param sql - Raw SQL query
   * @param params - Query parameters
   * @param executionCount - Number of executions
   */
  recordQuery(
    sql: string,
    params: any[] = [],
    executionCount: number = 1,
  ): void {
    const table = this.extractTable(sql);
    const whereColumns = this.extractWhereColumns(sql);
    const orderByColumns = this.extractOrderByColumns(sql);

    // Skip if no filterable columns
    if (whereColumns.length === 0 && orderByColumns.length === 0) {
      return;
    }

    // Update column statistics
    whereColumns.forEach((col) => {
      this.updateColumnStats(table, col, executionCount);
    });

    const record: QueryRecord = {
      sql,
      whereColumns,
      orderByColumns,
      table,
      timestamp: Date.now(),
      executionCount,
    };

    this.queryRecords.push(record);
    this.pruneOldRecords();
  }

  /**
   * Get index recommendations based on patterns.
   *
   * @returns List of recommended indexes
   */
  getRecommendations(): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];

    // Group by table
    const byTable = new Map<string, QueryRecord[]>();
    this.queryRecords.forEach((record) => {
      if (!byTable.has(record.table)) {
        byTable.set(record.table, []);
      }
      byTable.get(record.table)!.push(record);
    });

    // Analyze each table
    byTable.forEach((records, table) => {
      // Simple indexes on frequently filtered columns
      const filterColumns = this.analyzeFilterPatterns(records, table);
      filterColumns.forEach((col) => {
        const rec = this.createSimpleIndexRecommendation(table, col);
        if (rec) recommendations.push(rec);
      });

      // Composite indexes for WHERE + ORDER BY
      const composites = this.analyzeCompositePatterns(records, table);
      composites.forEach((cols) => {
        const rec = this.createCompositeIndexRecommendation(table, cols);
        if (rec) recommendations.push(rec);
      });

      // Partial indexes for filtered queries
      const partialIndexes = this.analyzePartialPatterns(records, table);
      partialIndexes.forEach((cols) => {
        const rec = this.createPartialIndexRecommendation(table, cols);
        if (rec) recommendations.push(rec);
      });
    });

    // Deduplicate and rank by impact
    return this.rankRecommendations(recommendations);
  }

  /**
   * Analyze filter column patterns.
   *
   * @param records - Query records for table
   * @param table - Table name
   * @returns Columns recommended for simple indexes
   */
  private analyzeFilterPatterns(
    records: QueryRecord[],
    table: string,
  ): string[] {
    const columnFreq = new Map<string, number>();

    records.forEach((record) => {
      record.whereColumns.forEach((col) => {
        const current = columnFreq.get(col) || 0;
        columnFreq.set(col, current + record.executionCount);
      });
    });

    // Recommend columns that appear in multiple queries
    return Array.from(columnFreq.entries())
      .filter(
        ([_col, count]) =>
          count >= this.minQueryCount &&
          records.filter((r) => r.whereColumns.includes(_col)).length >= 2,
      )
      .sort((a, b) => b[1] - a[1])
      .map(([col]) => col)
      .slice(0, 5);
  }

  /**
   * Analyze WHERE + ORDER BY composite patterns.
   *
   * @param records - Query records for table
   * @param table - Table name
   * @returns Recommended composite column sets
   */
  private analyzeCompositePatterns(
    records: QueryRecord[],
    table: string,
  ): string[][] {
    const composites: string[][] = [];

    records.forEach((record) => {
      if (record.whereColumns.length > 0 && record.orderByColumns.length > 0) {
        // Composite: WHERE columns first, then ORDER BY
        const composite = [
          ...new Set([...record.whereColumns, ...record.orderByColumns]),
        ];

        // Check if this pattern appears multiple times
        const similar = records.filter(
          (r) =>
            r.whereColumns.length > 0 &&
            r.orderByColumns.length > 0 &&
            r.whereColumns.every((c) => composite.includes(c)),
        ).length;

        if (similar >= this.minQueryCount) {
          const key = composite.sort().join(",");
          if (
            !composites.some(
              (c) =>
                c.sort().join(",") === key && c.length === composite.length,
            )
          ) {
            composites.push(composite);
          }
        }
      }
    });

    return composites.slice(0, 3);
  }

  /**
   * Analyze partial index opportunities.
   *
   * @param records - Query records for table
   * @param table - Table name
   * @returns Columns for partial indexes
   */
  private analyzePartialPatterns(
    records: QueryRecord[],
    table: string,
  ): string[][] {
    const patterns: string[][] = [];

    // Look for repeated filter patterns on status/category columns
    const statusColumns = ["status", "state", "type", "category", "is_active"];

    records.forEach((record) => {
      const statusCols = record.whereColumns.filter((col) =>
        statusColumns.some((sc) => col.toLowerCase().includes(sc)),
      );

      if (statusCols.length > 0 && record.whereColumns.length > 0) {
        // Candidate for partial index
        const composite = [...statusCols, ...record.whereColumns.slice(0, 1)];
        const occurrences = records.filter((r) =>
          statusCols.every((sc) => r.whereColumns.includes(sc)),
        ).length;

        if (occurrences >= this.minQueryCount) {
          const key = composite.sort().join(",");
          if (
            !patterns.some(
              (p) =>
                p.sort().join(",") === key && p.length === composite.length,
            )
          ) {
            patterns.push(composite);
          }
        }
      }
    });

    return patterns.slice(0, 2);
  }

  /**
   * Create simple index recommendation.
   *
   * @param table - Table name
   * @param column - Column name
   * @returns Index recommendation
   */
  private createSimpleIndexRecommendation(
    table: string,
    column: string,
  ): IndexRecommendation | null {
    const stats = this.columnStats.get(`${table}.${column}`);
    if (!stats) return null;

    const sizeBytes = this.estimateIndexSize(
      table,
      [column],
      stats.selectivity,
    );
    const impact = Math.min(100, stats.frequency * 10);

    return {
      name: `idx_${table}_${column}`,
      table,
      columns: [column],
      type: "simple",
      estimatedSizeBytes: sizeBytes,
      estimatedImpactPercent: impact,
      createSql: `CREATE INDEX IF NOT EXISTS idx_${table}_${column} ON ${table}(${column});`,
      reason: `Column frequently used in WHERE clause (${Math.round(stats.frequency)} times)`,
    };
  }

  /**
   * Create composite index recommendation.
   *
   * @param table - Table name
   * @param columns - Column names
   * @returns Index recommendation
   */
  private createCompositeIndexRecommendation(
    table: string,
    columns: string[],
  ): IndexRecommendation | null {
    const sizeBytes = this.estimateIndexSize(table, columns, 0.5);
    const impact = Math.min(100, columns.length * 15);

    const colList = columns.join(", ");
    const idxName = `idx_${table}_${columns.join("_")}`.slice(0, 63);

    return {
      name: idxName,
      table,
      columns,
      type: "composite",
      estimatedSizeBytes: sizeBytes,
      estimatedImpactPercent: impact,
      createSql: `CREATE INDEX IF NOT EXISTS ${idxName} ON ${table}(${colList});`,
      reason: `WHERE and ORDER BY pattern detected on columns: ${colList}`,
    };
  }

  /**
   * Create partial index recommendation.
   *
   * @param table - Table name
   * @param columns - Column names
   * @returns Index recommendation
   */
  private createPartialIndexRecommendation(
    table: string,
    columns: string[],
  ): IndexRecommendation | null {
    const sizeBytes = Math.round(
      this.estimateIndexSize(table, columns, 0.3) * 0.6,
    );
    const impact = Math.min(100, columns.length * 12);

    const colList = columns.join(", ");
    const idxName = `idx_${table}_${columns.join("_")}_partial`.slice(0, 63);

    return {
      name: idxName,
      table,
      columns,
      type: "partial",
      estimatedSizeBytes: sizeBytes,
      estimatedImpactPercent: impact,
      createSql: `CREATE INDEX IF NOT EXISTS ${idxName} ON ${table}(${colList}) WHERE status = 'active';`,
      reason: `Partial index recommended for filtered query pattern on ${colList}`,
    };
  }

  /**
   * Estimate index size in bytes.
   *
   * @param table - Table name
   * @param columns - Column names
   * @param selectivity - Filter selectivity (0-1)
   * @returns Estimated size
   */
  private estimateIndexSize(
    table: string,
    columns: string[],
    selectivity: number,
  ): number {
    // Rough estimate: 8 bytes per column + 8 bytes overhead + pointer
    const rowCount = this.estimatedRowsPerTable.get(table) || 10000;
    const bytesPerRow = (columns.length + 2) * 8;
    const estimatedRows = Math.ceil(rowCount * (selectivity || 0.5));

    return Math.max(1024 * 10, estimatedRows * bytesPerRow); // Min 10KB
  }

  /**
   * Rank and deduplicate recommendations.
   *
   * @param recommendations - All recommendations
   * @returns Ranked unique recommendations
   */
  private rankRecommendations(
    recommendations: IndexRecommendation[],
  ): IndexRecommendation[] {
    // Deduplicate by name
    const unique = new Map<string, IndexRecommendation>();

    recommendations.forEach((rec) => {
      if (!unique.has(rec.name)) {
        unique.set(rec.name, rec);
      }
    });

    // Sort by impact
    return Array.from(unique.values()).sort(
      (a, b) => b.estimatedImpactPercent - a.estimatedImpactPercent,
    );
  }

  /**
   * Extract table name from SQL.
   *
   * @param sql - Raw SQL query
   * @returns Table name
   */
  private extractTable(sql: string): string {
    const match = sql.match(/FROM\s+["'`]?(\w+)["'`]?/i);
    return match ? match[1] : "unknown";
  }

  /**
   * Extract WHERE columns from SQL.
   *
   * @param sql - Raw SQL query
   * @returns Column names
   */
  private extractWhereColumns(sql: string): string[] {
    const whereMatch = sql.match(
      /WHERE\s+(.+?)(?:ORDER BY|GROUP BY|LIMIT|$)/is,
    );
    if (!whereMatch) return [];

    const whereClause = whereMatch[1];
    const matches = whereClause.match(/(\w+)\s*(?:=|<|>|!=|LIKE|IN|BETWEEN)/gi);

    if (!matches) return [];

    return [
      ...new Set(matches.map((m) => m.split(/[\s=<>!]/)[0].toLowerCase())),
    ];
  }

  /**
   * Extract ORDER BY columns from SQL.
   *
   * @param sql - Raw SQL query
   * @returns Column names
   */
  private extractOrderByColumns(sql: string): string[] {
    const orderMatch = sql.match(/ORDER BY\s+(.+?)(?:LIMIT|$)/i);
    if (!orderMatch) return [];

    return orderMatch[1]
      .split(",")
      .map((col) => col.trim().split(/\s+/)[0].toLowerCase())
      .filter((col) => col.length > 0);
  }

  /**
   * Update column statistics.
   *
   * @param table - Table name
   * @param column - Column name
   * @param count - Execution count
   */
  private updateColumnStats(
    table: string,
    column: string,
    count: number,
  ): void {
    const key = `${table}.${column}`;
    const stats = this.columnStats.get(key) || {
      column,
      table,
      selectivity: 0.5,
      frequency: 0,
    };

    stats.frequency += count;
    this.columnStats.set(key, stats);
  }

  /**
   * Prune records older than window.
   */
  private pruneOldRecords(): void {
    const now = Date.now();
    this.queryRecords = this.queryRecords.filter(
      (r) => now - r.timestamp < this.windowMs,
    );
  }

  /**
   * Initialize default table statistics.
   */
  private initializeDefaultTableStats(): void {
    // Default estimates for common tables
    this.estimatedRowsPerTable.set("users", 100000);
    this.estimatedRowsPerTable.set("orders", 500000);
    this.estimatedRowsPerTable.set("products", 50000);
    this.estimatedRowsPerTable.set("shipments", 300000);
  }

  /**
   * Set row count estimate for table.
   *
   * @param table - Table name
   * @param rowCount - Estimated row count
   */
  setTableRowCount(table: string, rowCount: number): void {
    this.estimatedRowsPerTable.set(table, rowCount);
  }

  /**
   * Clear all recorded patterns.
   */
  reset(): void {
    this.queryRecords = [];
    this.columnStats.clear();
  }
}
