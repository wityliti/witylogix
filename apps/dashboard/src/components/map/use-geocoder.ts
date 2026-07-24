"use client";

import { useState, useEffect, useRef } from "react";

export interface GeoResult {
  lat: number;
  lng: number;
  displayName?: string;
}

// In-memory session cache to avoid redundant Nominatim calls
const geoCache = new Map<string, GeoResult | null>();
let nominatimQueue: Array<{
  key: string;
  resolve: (r: GeoResult | null) => void;
}> = [];
let nominatimTimer: ReturnType<typeof setTimeout> | null = null;

function geocodeKey(city: string, country: string): string {
  return `${city}|${country}`.toLowerCase().trim();
}

function flushQueue() {
  nominatimTimer = null;
  if (nominatimQueue.length === 0) return;

  const batch = nominatimQueue.splice(0, 1); // Nominatim ToS: 1 req/sec
  const { key, resolve } = batch[0];

  const [city, country] = key.split("|");
  const url = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}&format=json&limit=1`;

  fetch(url, {
    headers: {
      "Accept-Language": "en",
      "User-Agent": "Witylogix-Dashboard/1.0",
    },
  })
    .then((r) => r.json())
    .then((data: Array<{ lat: string; lon: string; display_name: string }>) => {
      if (data?.[0]) {
        const result: GeoResult = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          displayName: data[0].display_name,
        };
        geoCache.set(key, result);
        resolve(result);
      } else {
        geoCache.set(key, null);
        resolve(null);
      }
    })
    .catch(() => {
      geoCache.set(key, null);
      resolve(null);
    })
    .finally(() => {
      // Schedule next item
      if (nominatimQueue.length > 0) {
        nominatimTimer = setTimeout(flushQueue, 1100); // 1.1s to stay within ToS
      }
    });
}

function enqueueGeocode(
  city: string,
  country: string,
): Promise<GeoResult | null> {
  const key = geocodeKey(city, country);
  if (geoCache.has(key)) return Promise.resolve(geoCache.get(key) ?? null);

  return new Promise((resolve) => {
    nominatimQueue.push({ key, resolve });
    if (!nominatimTimer) {
      nominatimTimer = setTimeout(flushQueue, 100);
    }
  });
}

export interface AddressInput {
  id: string;
  city: string;
  country?: string;
  lat?: number | null;
  lng?: number | null;
}

export interface GeocodedAddress extends AddressInput {
  geoLat: number | null;
  geoLng: number | null;
  geocoded: boolean;
}

/**
 * Hook that geocodes a list of addresses using Nominatim (free, no key).
 * Uses stored lat/lng when available; falls back to city-level geocoding.
 */
export function useGeocoder(addresses: AddressInput[]): {
  results: GeocodedAddress[];
  loading: boolean;
} {
  const [results, setResults] = useState<GeocodedAddress[]>(() =>
    addresses.map((a) => ({
      ...a,
      geoLat: typeof a.lat === "number" ? a.lat : null,
      geoLng: typeof a.lng === "number" ? a.lng : null,
      geocoded: typeof a.lat === "number" && typeof a.lng === "number",
    })),
  );
  const [loading, setLoading] = useState(false);
  const prevIdsRef = useRef<string>("");

  useEffect(() => {
    const ids = addresses.map((a) => a.id).join(",");
    if (ids === prevIdsRef.current) return;
    prevIdsRef.current = ids;

    // Identify which need geocoding (no precise coords stored)
    const needGeo = addresses.filter(
      (a) => (typeof a.lat !== "number" || typeof a.lng !== "number") && a.city,
    );

    if (needGeo.length === 0) {
      setResults(
        addresses.map((a) => ({
          ...a,
          geoLat: typeof a.lat === "number" ? a.lat : null,
          geoLng: typeof a.lng === "number" ? a.lng : null,
          geocoded: true,
        })),
      );
      return;
    }

    setLoading(true);

    Promise.all(
      needGeo.map((a) => enqueueGeocode(a.city, a.country ?? "US")),
    ).then((geoResults) => {
      const geoMap = new Map<string, GeoResult | null>();
      needGeo.forEach((a, i) => geoMap.set(a.id, geoResults[i]));

      setResults(
        addresses.map((a) => {
          if (typeof a.lat === "number" && typeof a.lng === "number") {
            return { ...a, geoLat: a.lat, geoLng: a.lng, geocoded: true };
          }
          const geo = geoMap.get(a.id);
          return {
            ...a,
            geoLat: geo?.lat ?? null,
            geoLng: geo?.lng ?? null,
            geocoded: !!geo,
          };
        }),
      );
      setLoading(false);
    });
  }, [addresses]);

  return { results, loading };
}
