import type { StyleSpecification } from 'maplibre-gl';

export interface BuildMapStyleOpts {
  maptilerKey: string;
  basemap?: 'dark' | 'backdrop';
}

export function buildMapStyle({ maptilerKey, basemap = 'dark' }: BuildMapStyleOpts): StyleSpecification {
  const mapId = basemap === 'backdrop' ? 'backdrop-dark' : 'dataviz-dark';
  const basemapUrl = `https://api.maptiler.com/maps/${mapId}/tiles.json?key=${maptilerKey}`;

  return {
    version: 8,
    sources: {
      basemap: { type: 'raster', url: basemapUrl, tileSize: 256 },
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
      },
    ],
  };
}
