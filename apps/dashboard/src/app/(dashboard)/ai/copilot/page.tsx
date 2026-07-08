"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────

type EntityType = "delivery" | "order" | "driver";

interface FilterChip {
  label: string;
  value: string;
}

interface CopilotResult {
  filters: {
    entity?: string;
    status?: string;
    dateRange?: { range: string };
    amount?: {
      gt?: number;
      gte?: number;
      lt?: number;
      lte?: number;
      eq?: number;
    };
    location?: { keyword: string };
    tags?: string[];
    fullTextFallback?: boolean;
    rawQuery?: string;
  };
  results: Record<string, unknown>[];
  total: number;
}

// ─── Constants ───────────────────────────────────────────────

const EXAMPLE_QUERIES: { query: string; entityType: EntityType }[] = [
  { query: "late deliveries in zone 3 today", entityType: "delivery" },
  { query: "top performing drivers this week", entityType: "driver" },
  { query: "pending orders from last week", entityType: "order" },
  { query: "overdue orders over $500", entityType: "order" },
  { query: "active drivers near downtown", entityType: "driver" },
];

const ENTITY_LABELS: Record<EntityType, string> = {
  delivery: "Deliveries",
  order: "Orders",
  driver: "Drivers",
};

// ─── Helpers ─────────────────────────────────────────────────

function extractFilterChips(filters: CopilotResult["filters"]): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.entity) chips.push({ label: "Entity", value: filters.entity });
  if (filters.status) chips.push({ label: "Status", value: filters.status });
  if (filters.dateRange?.range)
    chips.push({
      label: "Date",
      value: filters.dateRange.range.replace("_", " "),
    });
  if (filters.location?.keyword)
    chips.push({ label: "Location", value: filters.location.keyword });
  if (filters.amount) {
    const a = filters.amount;
    if (a.gt !== undefined)
      chips.push({ label: "Amount", value: `> $${a.gt}` });
    else if (a.gte !== undefined)
      chips.push({ label: "Amount", value: `≥ $${a.gte}` });
    else if (a.lt !== undefined)
      chips.push({ label: "Amount", value: `< $${a.lt}` });
    else if (a.lte !== undefined)
      chips.push({ label: "Amount", value: `≤ $${a.lte}` });
    else if (a.eq !== undefined)
      chips.push({ label: "Amount", value: `= $${a.eq}` });
  }
  if (filters.tags && filters.tags.length > 0) {
    chips.push({ label: "Tags", value: filters.tags.join(", ") });
  }
  return chips;
}

function getResultColumns(entityType: EntityType): string[] {
  switch (entityType) {
    case "delivery":
      return [
        "id",
        "shipmentNumber",
        "status",
        "recipientName",
        "city",
        "createdAt",
      ];
    case "order":
      return [
        "id",
        "externalOrderNumber",
        "status",
        "customerName",
        "city",
        "createdAt",
      ];
    case "driver":
      return ["id", "name", "status", "email", "phone"];
  }
}

// ─── Page Component ──────────────────────────────────────────

export default function AICopilotPage() {
  const [query, setQuery] = useState("");
  const [entityType, setEntityType] = useState<EntityType>("delivery");
  const [result, setResult] = useState<CopilotResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await api.post<CopilotResult>("/api/v4/ai/copilot/query", {
        query: query.trim(),
        entityType,
      });
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleExample(example: { query: string; entityType: EntityType }) {
    setQuery(example.query);
    setEntityType(example.entityType);
    setResult(null);
    setError(null);
  }

  const chips = result ? extractFilterChips(result.filters) : [];
  const columns = getResultColumns(entityType);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-wl-text-primary">
          AI Co-pilot
        </h1>
        <p className="mt-1 text-sm text-wl-text-secondary">
          Ask anything about your deliveries, orders, or drivers in plain
          English.
        </p>
      </div>

      {/* Query Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-3">
          {/* Entity selector */}
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as EntityType)}
            className={cn(
              "rounded-lg border border-white/[0.08] bg-wl-bg-overlay",
              "px-3 py-2 text-sm text-wl-text-primary",
              "focus:outline-none focus:ring-2 focus:ring-wl-accent/50",
            )}
          >
            {(Object.keys(ENTITY_LABELS) as EntityType[]).map((et) => (
              <option key={et} value={et}>
                {ENTITY_LABELS[et]}
              </option>
            ))}
          </select>

          {/* Query input */}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything about your deliveries..."
            maxLength={500}
            className={cn(
              "flex-1 rounded-lg border border-white/[0.08] bg-wl-bg-overlay",
              "px-4 py-2 text-sm text-wl-text-primary placeholder:text-wl-text-tertiary",
              "focus:outline-none focus:ring-2 focus:ring-wl-accent/50",
            )}
          />

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className={cn(
              "rounded-lg px-5 py-2 text-sm font-medium",
              "bg-wl-accent text-white",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "hover:bg-wl-accent/90 transition-colors",
            )}
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>

        {/* Example queries */}
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.map((ex) => (
            <button
              key={ex.query}
              type="button"
              onClick={() => handleExample(ex)}
              className={cn(
                "rounded-full px-3 py-1 text-xs",
                "border border-white/[0.08] text-wl-text-secondary",
                "hover:bg-wl-bg-overlay hover:text-wl-text-primary transition-colors",
              )}
            >
              {ex.query}
            </button>
          ))}
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Applied filters chip bar */}
      {result && chips.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-wl-text-tertiary">
            Filters extracted:
          </span>
          {chips.map((chip) => (
            <span
              key={`${chip.label}-${chip.value}`}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                "bg-wl-accent/15 text-wl-accent border border-wl-accent/20",
              )}
            >
              {chip.label}: {chip.value}
            </span>
          ))}
        </div>
      )}

      {/* Results table */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-wl-text-secondary">
              <span className="font-medium text-wl-text-primary">
                {result.total}
              </span>{" "}
              result
              {result.total !== 1 ? "s" : ""} found
              {result.total > result.results.length
                ? ` (showing ${result.results.length})`
                : ""}
            </p>
          </div>

          {result.results.length === 0 ? (
            <div className="rounded-lg border border-white/[0.06] bg-wl-bg-overlay px-6 py-12 text-center">
              <p className="text-sm text-wl-text-secondary">
                No results matched your query.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-xs font-medium text-wl-text-tertiary uppercase tracking-wider"
                      >
                        {col.replace(/([A-Z])/g, " $1").trim()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {result.results.map((row, idx) => (
                    <tr
                      key={(row["id"] as string) ?? idx}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      {columns.map((col) => {
                        const val = row[col];
                        const displayVal =
                          val instanceof Date
                            ? (val instanceof Date
                                ? val
                                : new Date(val as string)
                              ).toLocaleDateString()
                            : val !== null && val !== undefined
                              ? String(val)
                              : "—";
                        return (
                          <td
                            key={col}
                            className="px-4 py-3 text-wl-text-secondary truncate max-w-[200px]"
                          >
                            {col === "status" ? (
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-xs font-medium",
                                  displayVal === "PENDING" &&
                                    "bg-yellow-500/10 text-yellow-400",
                                  displayVal === "COMPLETED" &&
                                    "bg-green-500/10 text-green-400",
                                  displayVal === "ACTIVE" &&
                                    "bg-blue-500/10 text-blue-400",
                                  displayVal === "FAILED" &&
                                    "bg-red-500/10 text-red-400",
                                  ![
                                    "PENDING",
                                    "COMPLETED",
                                    "ACTIVE",
                                    "FAILED",
                                  ].includes(displayVal) &&
                                    "bg-white/[0.06] text-wl-text-secondary",
                                )}
                              >
                                {displayVal}
                              </span>
                            ) : (
                              displayVal
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
