'use client';
import { useMemo } from 'react';
import { PinLayer } from './pin-layer';
import { useFitBounds } from './use-fit-bounds';
import { useWLMap } from './wl-map-context';
import type { TerminalLocation } from '@/hooks/use-pos';

const STATUS_TO_PIN = {
  online: 'in_transit',   // green
  offline: 'open',        // blue/info — neutral
  error: 'delayed',       // red
} as const;

export function PosTerminalLayer({ terminals }: { terminals: TerminalLocation[] }) {
  const map = useWLMap();

  const pins = useMemo(
    () =>
      terminals.map((t) => ({
        id: t.id,
        lng: t.lng,
        lat: t.lat,
        status: STATUS_TO_PIN[t.status] ?? 'open',
        label: t.name,
      })),
    [terminals],
  );

  useFitBounds(map, terminals, 80);

  return <PinLayer pins={pins} />;
}
