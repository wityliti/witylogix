"use client";

export type ZoneMode = "monitor" | "configure";

export interface ModeToggleProps {
  value: ZoneMode;
  onChange: (m: ZoneMode) => void;
}

export function ModeToggle({ value, onChange }: ModeToggleProps) {
  return (
    <div
      role="tablist"
      className="inline-flex rounded-md border text-sm"
      style={{
        background: "var(--wl-bg-elevated)",
        borderColor: "var(--wl-neutral-800)",
      }}
    >
      {(["monitor", "configure"] as const).map((m) => {
        const active = m === value;
        return (
          <button
            key={m}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m)}
            className="px-3 py-1.5 capitalize transition-colors"
            style={{
              color: active ? "var(--wl-neutral-50)" : "var(--wl-neutral-400)",
              background: active ? "var(--wl-primary-700)" : "transparent",
            }}
          >
            {m}
          </button>
        );
      })}
    </div>
  );
}
