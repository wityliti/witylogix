import { benchApi } from "@/lib/bench-api";

export const dynamic = "force-dynamic";

async function fetchHealth() {
  try {
    return { ok: true as const, data: await benchApi.health() };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export default async function OverviewPage() {
  const h = await fetchHealth();

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold mb-1">Overview</h1>
      <p className="text-gray-500 mb-8 text-sm">
        Live status from the Witylogix admin API (<code className="font-mono">/internal/bench/health</code>).
      </p>

      {h.ok ? (
        <div className="grid grid-cols-2 gap-4">
          <Stat label="API version" value={h.data.apiVersion} />
          <Stat label="Witylogix version" value={h.data.witylogixVersion} />
          <Stat
            label="Migrations applied"
            value={String(h.data.prismaMigrations.applied)}
          />
          <Stat
            label="Uptime"
            value={`${Math.floor(h.data.uptimeSec / 60)} min`}
          />
          <Stat
            label="Drained"
            value={h.data.drained ? (h.data.drainMode ?? "yes") : "no"}
            tone={h.data.drained ? "warn" : "ok"}
          />
        </div>
      ) : (
        <div className="bg-red-950/40 border border-red-900 rounded p-4 text-sm">
          <div className="font-semibold text-red-400 mb-1">
            Admin API unreachable
          </div>
          <div className="font-mono text-xs text-red-300/80">{h.error}</div>
          <div className="text-xs text-gray-500 mt-3">
            Check <code>BENCH_API_BASE_URL</code> and{" "}
            <code>BENCH_SERVICE_TOKEN</code> env vars.
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "ok",
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "bad";
}) {
  const toneClass =
    tone === "warn"
      ? "text-yellow-400"
      : tone === "bad"
        ? "text-red-400"
        : "text-white";
  return (
    <div className="bg-[#14141f] border border-gray-800 rounded p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
        {label}
      </div>
      <div className={`text-2xl font-semibold font-mono ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}
