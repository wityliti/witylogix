export default function InstallationsPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold mb-1">Installations</h1>
      <p className="text-gray-500 text-sm mb-8">
        Managed + dedicated Witylogix installations this control plane operates.
      </p>
      <div className="bg-[#14141f] border border-gray-800 rounded p-6 text-sm text-gray-500">
        <div className="font-semibold text-gray-300 mb-2">Not yet implemented</div>
        <p>
          Phase 2 populates this from an installations registry (SQLite or
          Postgres table local to the control plane). Each row drills into
          live status, recent deploys, logs, and backups — driven by a
          per-installation <code>BENCH_SERVICE_TOKEN</code>.
        </p>
      </div>
    </div>
  );
}
