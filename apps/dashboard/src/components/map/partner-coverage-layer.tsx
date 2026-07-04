"use client";
import { useEffect } from "react";
import type { GeoJSONSource } from "maplibre-gl";
import { useWLMap } from "./wl-map-context";
import { useFitBounds } from "./use-fit-bounds";
import { lookupCity } from "@/lib/city-coords";

export interface CoveragePartner {
  id: string;
  name: string;
  status: "active" | "pending" | "inactive";
  serviceAreas: string[]; // city name strings
}

interface PartnerCoverageLayerProps {
  partners: CoveragePartner[];
  onCityClick?: (partner: CoveragePartner, city: string) => void;
}

const STATUS_COLOR: Record<string, string> = {
  active: "#10b981", // emerald
  pending: "#f59e0b", // amber
  inactive: "#6b7280", // grey
};

interface CityFeature {
  id: string;
  lng: number;
  lat: number;
  partnerName: string;
  city: string;
  status: string;
}

export function PartnerCoverageLayer({
  partners,
  onCityClick,
}: PartnerCoverageLayerProps) {
  const map = useWLMap();

  const features: CityFeature[] = partners.flatMap((p) =>
    p.serviceAreas.flatMap((city): CityFeature[] => {
      const coords = lookupCity(city);
      if (!coords) return [];
      return [
        {
          id: `${p.id}::${city}`,
          lng: coords[0],
          lat: coords[1],
          partnerName: p.name,
          city,
          status: p.status,
        },
      ];
    }),
  );

  useFitBounds(map, features, 60);

  useEffect(() => {
    const SOURCE = "partner-coverage";
    const LAYER_CIRCLE = "partner-coverage-circles";
    const LAYER_LABEL = "partner-coverage-labels";

    if (!map) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: features.map((f) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [f.lng, f.lat] },
        properties: {
          id: f.id,
          partnerName: f.partnerName,
          city: f.city,
          status: f.status,
        },
      })),
    };

    const init = () => {
      if (map.getSource(SOURCE)) {
        (map.getSource(SOURCE) as GeoJSONSource).setData(geojson);
        return;
      }

      map.addSource(SOURCE, { type: "geojson", data: geojson });

      map.addLayer({
        id: LAYER_CIRCLE,
        type: "circle",
        source: SOURCE,
        paint: {
          "circle-radius": 8,
          "circle-color": [
            "match",
            ["get", "status"],
            "active",
            STATUS_COLOR.active,
            "pending",
            STATUS_COLOR.pending,
            "inactive",
            STATUS_COLOR.inactive,
            "#6b7280",
          ],
          "circle-stroke-color": "rgba(255,255,255,0.6)",
          "circle-stroke-width": 2,
          "circle-opacity": 0.85,
        },
      });

      map.addLayer({
        id: LAYER_LABEL,
        type: "symbol",
        source: SOURCE,
        layout: {
          "text-field": ["get", "city"],
          "text-size": 11,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,0.6)",
          "text-halo-width": 1.5,
        },
      });

      if (onCityClick) {
        map.on("click", LAYER_CIRCLE, (e) => {
          const props = e.features?.[0]?.properties;
          if (!props) return;
          const partner = partners.find(
            (p) => p.id === props.id.split("::")[0],
          );
          if (partner) onCityClick(partner, props.city as string);
        });
        map.on("mouseenter", LAYER_CIRCLE, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", LAYER_CIRCLE, () => {
          map.getCanvas().style.cursor = "";
        });
      }
    };

    if (map.isStyleLoaded()) init();
    else map.on("load", init);

    return () => {
      try {
        if (map.getLayer(LAYER_LABEL)) map.removeLayer(LAYER_LABEL);
        if (map.getLayer(LAYER_CIRCLE)) map.removeLayer(LAYER_CIRCLE);
        if (map.getSource(SOURCE)) map.removeSource(SOURCE);
      } catch {
        /* ignore */
      }
    };
  }, [map, features, partners, onCityClick]);

  return null;
}
