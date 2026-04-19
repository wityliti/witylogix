export default function AuditPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold mb-1">Audit log</h1>
      <p className="text-gray-500 text-sm mb-8">
        Every bench action with actor, IP, and before/after diff.
      </p>
      <div className="bg-[#14141f] border border-gray-800 rounded p-6 text-sm text-gray-500">
        <div className="font-semibold text-gray-300 mb-2">Not yet implemented</div>
        <p>
          Phase 2 tails <code>bench.audit.log</code> from each installation
          and surfaces it here. Each installation streams its audit JSONL
          into a central Redis stream which this page queries via an SSE
          endpoint.
        </p>
      </div>
    </div>
  );
}
