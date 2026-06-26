'use client';
import { useMemo, useState } from 'react';
import { WLMap } from '@/components/map/wl-map';
import { PartnerCoverageLayer, type CoveragePartner } from '@/components/map/partner-coverage-layer';
import { lookupCity } from '@/lib/city-coords';

interface PartnersMapViewProps {
  partners: CoveragePartner[];
  onPartnerClick?: (id: string) => void;
}

const DEFAULT_CENTER: [number, number] = [0, 20];

const STATUS_LABEL: Record<string, string> = {
  active:   'Active',
  pending:  'Pending',
  inactive: 'Inactive',
};
const STATUS_COLOR: Record<string, string> = {
  active:   '#10b981',
  pending:  '#f59e0b',
  inactive: '#6b7280',
};

export default function PartnersMapView({ partners, onPartnerClick }: PartnersMapViewProps) {
  const [selectedPartner, setSelectedPartner] = useState<{ name: string; city: string } | null>(null);

  const hasAnyCoords = useMemo(
    () => partners.some((p) => p.serviceAreas.some((c) => lookupCity(c) !== null)),
    [partners]
  );

  const totalCities = useMemo(
    () =>
      partners.reduce(
        (sum, p) => sum + p.serviceAreas.filter((c) => lookupCity(c) !== null).length,
        0
      ),
    [partners]
  );

  if (!hasAnyCoords) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-wl-bg-surface">
        <p className="text-wl-text-secondary text-sm">
          No service areas with recognisable city names found.
        </p>
        <p className="text-wl-text-tertiary text-xs">
          Configure service areas for your partners to see them on the map.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <WLMap center={DEFAULT_CENTER} zoom={2} className="w-full h-full">
        <PartnerCoverageLayer
          partners={partners}
          onCityClick={(p, city) => {
            setSelectedPartner({ name: p.name, city });
            if (onPartnerClick) onPartnerClick(p.id);
          }}
        />
      </WLMap>

      {/* Legend */}
      <div className="absolute top-3 left-3 bg-wl-bg-elevated/90 border border-wl-border-default rounded-lg p-3 text-xs flex flex-col gap-1.5 backdrop-blur-sm">
        <p className="font-semibold text-wl-text-secondary uppercase tracking-wider mb-1">Coverage</p>
        {Object.entries(STATUS_LABEL).map(([k, label]) => (
          <div key={k} className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ background: STATUS_COLOR[k] }}
            />
            <span className="text-wl-text-primary">{label}</span>
          </div>
        ))}
      </div>

      {/* Stats badge */}
      <div className="absolute top-3 right-3 bg-wl-bg-elevated/90 border border-wl-border-default rounded-lg px-3 py-2 text-xs backdrop-blur-sm">
        <span className="text-wl-text-secondary">{partners.length} partners · </span>
        <span className="text-wl-text-primary font-semibold">{totalCities} cities</span>
      </div>

      {/* Click tooltip */}
      {selectedPartner && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-wl-bg-elevated border border-wl-border-default rounded-lg px-4 py-2 text-sm">
          <span className="text-wl-text-primary font-semibold">{selectedPartner.name}</span>
          <span className="text-wl-text-secondary"> · {selectedPartner.city}</span>
          <button
            onClick={() => setSelectedPartner(null)}
            className="ml-3 text-wl-text-tertiary hover:text-white"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
