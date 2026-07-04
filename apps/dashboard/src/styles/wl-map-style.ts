import type { StyleSpecification } from "maplibre-gl";

export interface BuildMapStyleOpts {
  /**
   * MapTiler API key. Optional — when absent (no `NEXT_PUBLIC_MAPTILER_KEY`),
   * the map falls back to free, keyless CARTO raster basemaps so the map still
   * renders out of the box. Drop in a MapTiler key for higher-quality vector tiles.
   */
  maptilerKey?: string;
  basemap?: "dark" | "backdrop";
}

/**
 * Free, keyless raster basemaps (CARTO). Used when no MapTiler key is configured.
 * CARTO basemaps are free for reasonable use and require attribution (kept below).
 */
function cartoBasemapTiles(basemap: "dark" | "backdrop"): string[] {
  // 'backdrop' = lighter/neutral, 'dark' = dark dashboard theme.
  const theme = basemap === "backdrop" ? "light_all" : "dark_all";
  return ["a", "b", "c", "d"].map(
    (s) => `https://${s}.basemaps.cartocdn.com/${theme}/{z}/{x}/{y}{r}.png`,
  );
}

const CARTO_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>';

export function buildMapStyle({
  maptilerKey,
  basemap = "dark",
}: BuildMapStyleOpts = {}): StyleSpecification {
  const hasKey =
    typeof maptilerKey === "string" && maptilerKey.trim().length > 0;

  const basemapSource: StyleSpecification["sources"][string] = hasKey
    ? {
        type: "raster",
        url: `https://api.maptiler.com/maps/${
          basemap === "backdrop" ? "backdrop-dark" : "dataviz-dark"
        }/tiles.json?key=${maptilerKey}`,
        tileSize: 256,
      }
    : {
        type: "raster",
        tiles: cartoBasemapTiles(basemap),
        tileSize: 256,
        attribution: CARTO_ATTRIBUTION,
      };

  return {
    version: 8,
    sources: {
      basemap: basemapSource,
      zones: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
      heatmap: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
      pins: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
      hubs: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
    },
    layers: [
      {
        id: "basemap",
        type: "raster",
        source: "basemap",
      },
    ],
  };
}
