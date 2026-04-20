'use client';

export function LegacyNotice() {
  return (
    <div className="p-8 text-sm" style={{ color: 'var(--wl-neutral-300)' }}>
      The new zones experience is behind a feature flag.
      <br />
      Set <code>NEXT_PUBLIC_FEATURE_ZONES_MAP=1</code> in your <code>.env.local</code> to enable it.
    </div>
  );
}
