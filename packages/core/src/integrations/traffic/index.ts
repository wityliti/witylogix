/**
 * Traffic Integration Module
 *
 * Exports all traffic integration components:
 * - Type definitions
 * - Google Directions API client
 * - TomTom Traffic API client
 * - Traffic response normalizer
 * - Traffic provider service (orchestration layer)
 */

export * from "./types.js";
export { GoogleDirectionsClient } from "./google-directions-client.js";
export { TomTomTrafficClient } from "./tomtom-traffic-client.js";
export { TrafficNormalizer } from "./traffic-normalizer.js";
export { TrafficProvider } from "./traffic-provider.js";
