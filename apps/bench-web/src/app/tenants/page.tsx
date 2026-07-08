export default function TenantsPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold mb-1">Tenants</h1>
      <p className="text-gray-500 text-sm mb-8">
        List of all tenants across every installation.
      </p>
      <div className="bg-[#14141f] border border-gray-800 rounded p-6 text-sm text-gray-500">
        <div className="font-semibold text-gray-300 mb-2">
          Not yet implemented
        </div>
        <p>
          Phase 2 adds a <code>/internal/bench/tenants</code> list endpoint plus
          cross-installation aggregation. This page will render them with plan,
          installation, owner, and health status.
        </p>
      </div>
    </div>
  );
}
