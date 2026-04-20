import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useZonesGeoJson } from '../use-zones-geojson';
import { useZoneOverlays } from '../use-zone-overlays';

const fetchJson = (body: unknown) =>
  Promise.resolve({ ok: true, json: async () => body } as Response);

describe('zones data hooks', () => {
  it('useZonesGeoJson fetches /api/v4/zones?format=geojson', async () => {
    vi.stubGlobal('fetch', vi.fn(() => fetchJson({ type: 'FeatureCollection', features: [] })));
    const { result } = renderHook(() => useZonesGeoJson());
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain('format=geojson');
  });

  it('useZoneOverlays fetches /api/v4/zones/overlays and refetches on window focus', async () => {
    const fetchMock = vi.fn(() => fetchJson({ zones: [], heatmap: [], hubs: [] }));
    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => useZoneOverlays('24h'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
