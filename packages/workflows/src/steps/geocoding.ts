/**
 * Geocoding Step
 * Geocodes pickup and delivery addresses to lat/lng coordinates
 * Uses a mock geocoding service (would integrate with Google Maps, Mapbox, etc.)
 * Compensation: no-op (read-only operation)
 */

import type { WorkflowStep, StepResult, WorkflowContext } from "../types.js";

export interface GeocodingInput {
  pickupAddress: {
    line1: string;
    line2?: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
  deliveryAddress: {
    line1: string;
    line2?: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
}

export interface GeocodedLocation {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  accuracy?: "ROOFTOP" | "RANGE_INTERPOLATED" | "GEOMETRIC_CENTER" | "APPROXIMATE";
  placeId?: string;
}

export interface GeocodingOutput {
  pickupLocation: GeocodedLocation;
  deliveryLocation: GeocodedLocation;
  distanceKm: number;
  routeDurationMinutes: number;
}

/**
 * Geocodes both pickup and delivery addresses
 * Calculates distance and estimated travel time between them
 */
export const geocodeAddressStep: WorkflowStep<GeocodingInput, GeocodingOutput> = {
  name: "geocodeAddress",
  description: "Geocode pickup and delivery addresses to lat/lng",

  async invoke(
    input: GeocodingInput,
    context: WorkflowContext
  ): Promise<StepResult<GeocodingOutput>> {
    const logger = context.logger;
    logger?.info("Starting address geocoding");

    try {
      // ─── Mock Geocoding Service ────────────────────────────────────
      // In production, integrate with Google Maps Geocoding API or Mapbox

      const mockGeocodeAddress = async (address: {
        line1: string;
        line2?: string;
        city: string;
        province: string;
        postalCode: string;
        country: string;
      }): Promise<GeocodedLocation> => {
        // Simulate API call delay
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Mock data: different addresses get different coordinates
        // In production: call real geocoding API here
        const addressStr = `${address.line1} ${address.city}`;
        const hash = addressStr
          .split("")
          .reduce((acc, char) => acc + char.charCodeAt(0), 0);

        // Generate deterministic but varied coordinates
        const baseLat = 40.7128 + (hash % 100) / 100; // ~40.7128 (New York)
        const baseLng = -74.006 + (hash % 100) / 100; // ~-74.006 (New York)

        // Add small variation based on postal code
        const postalHash = address.postalCode
          .split("")
          .reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const lat = baseLat + (postalHash % 1000) / 10000;
        const lng = baseLng - (postalHash % 1000) / 10000;

        return {
          latitude: lat,
          longitude: lng,
          formattedAddress: `${address.line1}, ${address.city}, ${address.province} ${address.postalCode}, ${address.country}`,
          accuracy: "GEOMETRIC_CENTER",
          placeId: `place_${hash}`,
        };
      };

      logger?.debug("Geocoding pickup address", {
        address: input.pickupAddress,
      });

      const pickupLocation = await mockGeocodeAddress(
        input.pickupAddress
      );

      logger?.debug("Geocoding delivery address", {
        address: input.deliveryAddress,
      });

      const deliveryLocation = await mockGeocodeAddress(
        input.deliveryAddress
      );

      // ─── Calculate Distance ────────────────────────────────────────
      // Using Haversine formula for great-circle distance
      const distanceKm = calculateDistance(
        pickupLocation.latitude,
        pickupLocation.longitude,
        deliveryLocation.latitude,
        deliveryLocation.longitude
      );

      // ─── Estimate Travel Time ──────────────────────────────────────
      // Simple heuristic: average speed 40 km/h in urban, 80 km/h on highway
      const estimatedSpeed = distanceKm > 20 ? 80 : 40;
      const routeDurationMinutes = Math.ceil((distanceKm / estimatedSpeed) * 60);

      logger?.info("Address geocoding completed", {
        pickupLat: pickupLocation.latitude,
        pickupLng: pickupLocation.longitude,
        deliveryLat: deliveryLocation.latitude,
        deliveryLng: deliveryLocation.longitude,
        distanceKm: distanceKm.toFixed(2),
        durationMinutes: routeDurationMinutes,
      });

      return {
        success: true,
        data: {
          pickupLocation,
          deliveryLocation,
          distanceKm,
          routeDurationMinutes,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger?.error("Geocoding failed", { error: errorMsg });
      return {
        success: false,
        error: `Geocoding failed: ${errorMsg}`,
        code: "GEOCODING_ERROR",
      };
    }
  },

  // No compensation needed — geocoding is a read-only operation
};

/**
 * Haversine formula to calculate distance between two lat/lng points
 * Returns distance in kilometers
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
