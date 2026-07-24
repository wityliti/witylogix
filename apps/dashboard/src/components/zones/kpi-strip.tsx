"use client";

export interface KpiStats {
  zones: number;
  driversOnline: number;
  openOrders: number;
  slipping: number;
}

export interface KpiStripProps {
  stats: KpiStats;
  onClickSlipping: () => void;
}

export function KpiStrip({ stats, onClickSlipping }: KpiStripProps) {
  return (
    <div
      className="inline-flex items-center gap-4 rounded-md border px-4 py-1.5 text-xs"
      style={{
        background: "var(--wl-bg-elevated)",
        borderColor: "var(--wl-neutral-800)",
        color: "var(--wl-neutral-200)",
      }}
    >
      <span>{stats.zones} zones</span>
      <span style={{ color: "var(--wl-neutral-600)" }}>|</span>
      <span>{stats.driversOnline} drivers online</span>
      <span style={{ color: "var(--wl-neutral-600)" }}>|</span>
      <span>{stats.openOrders} open orders</span>
      {stats.slipping > 0 && (
        <>
          <span style={{ color: "var(--wl-neutral-600)" }}>|</span>
          <button
            onClick={onClickSlipping}
            className="rounded px-2 py-0.5"
            style={{
              background: "var(--wl-warning-bg)",
              color: "var(--wl-warning-500)",
            }}
          >
            {stats.slipping} slipping
          </button>
        </>
      )}
    </div>
  );
}
