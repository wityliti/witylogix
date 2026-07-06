"use client";
import { useMemo, useState } from "react";

export interface SearchableZone {
  id: string;
  name: string;
}

export interface ZoneSearchProps {
  zones: SearchableZone[];
  onSelect: (id: string) => void;
}

export function ZoneSearch({ zones, onSelect }: ZoneSearchProps) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    if (!q) return [];
    const needle = q.toLowerCase();
    return zones
      .filter((z) => z.name.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [q, zones]);

  return (
    <div className="relative">
      <input
        role="combobox"
        aria-expanded={matches.length > 0}
        placeholder="Search zones…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-64 rounded-md px-3 py-1.5 text-sm border outline-none"
        style={{
          background: "var(--wl-bg-elevated)",
          borderColor: "var(--wl-neutral-800)",
          color: "var(--wl-neutral-100)",
        }}
      />
      {matches.length > 0 && (
        <ul
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 rounded-md border max-h-60 overflow-auto"
          style={{
            background: "var(--wl-bg-overlay)",
            borderColor: "var(--wl-neutral-800)",
          }}
        >
          {matches.map((m) => (
            <li
              key={m.id}
              role="option"
              aria-selected={false}
              onClick={() => {
                onSelect(m.id);
                setQ("");
              }}
            >
              <button
                type="button"
                tabIndex={-1}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--wl-bg-elevated)]"
                style={{ color: "var(--wl-neutral-100)" }}
              >
                {m.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
