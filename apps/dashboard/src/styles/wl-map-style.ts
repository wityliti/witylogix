import type { StyleSpecification } from 'maplibre-gl';

export interface BuildMapStyleOpts {
  maptilerKey: string;
  basemap?: 'dark' | 'backdrop';
}

export function buildMapStyle({ maptilerKey, basemap = 'dark' }: BuildMapStyleOpts): StyleSpecification {
  const basemapUrl =
    basemap === 'backdrop'
      ? `https://api.maptiler.com/maps/backdrop-dark/style.json?key=${maptilerKey}`
      : `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${maptilerKey}`;

  return {
    version: 8,
    sources: {
      basemap: { type: 'raster', url: basemapUrl, tileSize: 256 } as unknown as StyleSpecification['sources'][string],
      zones: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      heatmap: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      pins: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      hubs: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    },
    layers: [
      {
        id: 'basemap',
        type: 'raster',
        source: 'basemap',
      } as unknown as StyleSpecification['layers'][number],
    ],
  } as StyleSpecification;
}
