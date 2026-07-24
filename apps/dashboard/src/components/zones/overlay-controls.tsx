"use client";
import { useEffect } from "react";

export interface OverlayState {
  heatmap: boolean;
  sla: boolean;
  openOrders: boolean;
  hubs: boolean;
  window: "1h" | "24h" | "7d";
}

export interface OverlayControlsProps {
  value: OverlayState;
  onChange: (v: OverlayState) => void;
}

const STORAGE_KEY = "wl.zones.overlays";

export function OverlayControls({ value, onChange }: OverlayControlsProps) {
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw)
        onChange({ ...value, ...(JSON.parse(raw) as Partial<OverlayState>) });
    } catch {
      // ignore parse failures; fall back to props.
    }
    // Read-once hydration from localStorage on mount; value/onChange intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch: Partial<OverlayState>) => {
    const next = { ...value, ...patch };
    onChange(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota/SecurityError.
    }
  };

  const Check = ({ k, label }: { k: keyof OverlayState; label: string }) => (
    <label className="flex items-center gap-2 text-xs py-1">
      <input
        type="checkbox"
        aria-label={label}
        checked={Boolean(value[k])}
        onChange={(e) =>
          update({ [k]: e.target.checked } as Partial<OverlayState>)
        }
        className="accent-[var(--wl-primary-500)]"
      />
      <span style={{ color: "var(--wl-neutral-200)" }}>{label}</span>
    </label>
  );

  return (
    <div
      className="rounded-md border p-3 min-w-[180px] space-y-0.5"
      style={{
        background: "var(--wl-bg-elevated)",
        borderColor: "var(--wl-neutral-800)",
      }}
    >
      <div
        className="text-[10px] uppercase tracking-wide mb-2"
        style={{ color: "var(--wl-neutral-500)" }}
      >
        Overlays
      </div>
      <Check k="heatmap" label="Heatmap" />
      <Check k="sla" label="SLA tint" />
      <Check k="openOrders" label="Open orders" />
      <Check k="hubs" label="Hubs" />
      <div className="mt-3 flex gap-1">
        {(["1h", "24h", "7d"] as const).map((w) => (
          <button
            key={w}
            onClick={() => update({ window: w })}
            className="px-2 py-0.5 rounded text-[11px]"
            style={{
              background:
                value.window === w
                  ? "var(--wl-primary-700)"
                  : "var(--wl-bg-overlay)",
              color:
                value.window === w
                  ? "var(--wl-neutral-50)"
                  : "var(--wl-neutral-300)",
            }}
          >
            {w}
          </button>
        ))}
      </div>
    </div>
  );
}
