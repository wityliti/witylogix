import { ColumnDef } from "./data-table";

interface ExportOptions {
  filename?: string;
  dateFormat?: (date: Date) => string;
}

/**
 * Escape CSV field values
 */
function escapeCSVField(value: any): string {
  if (value === null || value === undefined) return "";

  const stringValue = String(value);
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Generate CSV content from data
 */
export function generateCSV<T extends { id?: string | number }>(
  data: T[],
  columns: ColumnDef<T>[],
  options: ExportOptions = {}
): string {
  if (data.length === 0) return "";

  const { dateFormat = (d) => d.toISOString() } = options;

  // Header row
  const headers = columns.map((col) => escapeCSVField(col.header)).join(",");

  // Data rows
  const rows = data.map((row) =>
    columns
      .map((col) => {
        let value: any = col.accessorKey ? row[col.accessorKey] : "";

        if (value instanceof Date) {
          value = dateFormat(value);
        }

        return escapeCSVField(value);
      })
      .join(",")
  );

  return [headers, ...rows].join("\n");
}

/**
 * Generate JSON content from data
 */
export function generateJSON<T extends { id?: string | number }>(
  data: T[],
  columns: ColumnDef<T>[],
  options: ExportOptions = {}
): string {
  const { dateFormat = (d) => d.toISOString() } = options;

  const formatted = data.map((row) => {
    const obj: Record<string, any> = {};

    columns.forEach((col) => {
      const key = col.id;
      let value: any = col.accessorKey ? row[col.accessorKey] : "";

      if (value instanceof Date) {
        value = dateFormat(value);
      }

      obj[key] = value;
    });

    return obj;
  });

  return JSON.stringify(formatted, null, 2);
}

/**
 * Export data as CSV file download
 */
export function exportAsCSV<T extends { id?: string | number }>(
  data: T[],
  columns: ColumnDef<T>[],
  options: ExportOptions = {}
): void {
  const { filename = "export.csv" } = options;
  const csv = generateCSV(data, columns, options);
  downloadFile(csv, filename, "text/csv");
}

/**
 * Export data as JSON file download
 */
export function exportAsJSON<T extends { id?: string | number }>(
  data: T[],
  columns: ColumnDef<T>[],
  options: ExportOptions = {}
): void {
  const { filename = "export.json" } = options;
  const json = generateJSON(data, columns, options);
  downloadFile(json, filename, "application/json");
}

/**
 * Copy data to clipboard as formatted text
 */
export async function copyToClipboard<T extends { id?: string | number }>(
  data: T[],
  columns: ColumnDef<T>[],
  format: "csv" | "json" = "csv"
): Promise<boolean> {
  try {
    const content =
      format === "csv"
        ? generateCSV(data, columns)
        : generateJSON(data, columns);

    await navigator.clipboard.writeText(content);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}

/**
 * Helper to download file
 */
function downloadFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export selected rows
 */
export function exportSelectedRows<T extends { id?: string | number }>(
  data: T[],
  selectedIds: (string | number)[],
  columns: ColumnDef<T>[],
  format: "csv" | "json",
  options: ExportOptions = {}
): void {
  const selectedData = data.filter((row) =>
    selectedIds.includes(row.id!)
  );

  if (format === "csv") {
    exportAsCSV(selectedData, columns, options);
  } else {
    exportAsJSON(selectedData, columns, options);
  }
}

/**
 * Build column header mapping for export
 */
export function buildColumnHeaderMap<T extends { id?: string | number }>(
  columns: ColumnDef<T>[]
): Record<string, string> {
  const map: Record<string, string> = {};
  columns.forEach((col) => {
    if (col.accessorKey) {
      map[String(col.accessorKey)] = col.header;
    }
  });
  return map;
}
