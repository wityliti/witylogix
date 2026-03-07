/**
 * Zone mapping and lookup utilities for rate calculation
 * Handles both US domestic zones and international zone assignment
 */

// US Zone lookup table based on first 3 digits of postal code
// Maps ranges of postal codes to zones 1-8
const US_ZIP_ZONES: Map<number, number> = new Map();

// Initialize zone mappings
function initializeUSZones(): void {
  // Zone 1: 001-002 (zones 10-19)
  for (let i = 1; i <= 2; i++) US_ZIP_ZONES.set(i, 1);
  // Zone 2: 003-049 (zones 20-49)
  for (let i = 3; i <= 49; i++) US_ZIP_ZONES.set(i, 2);
  // Zone 3: 050-149 (zones 50-149)
  for (let i = 50; i <= 149; i++) US_ZIP_ZONES.set(i, 3);
  // Zone 4: 150-199 (zones 150-199)
  for (let i = 150; i <= 199; i++) US_ZIP_ZONES.set(i, 4);
  // Zone 5: 200-299 (zones 200-299)
  for (let i = 200; i <= 299; i++) US_ZIP_ZONES.set(i, 5);
  // Zone 6: 300-399 (zones 300-399)
  for (let i = 300; i <= 399; i++) US_ZIP_ZONES.set(i, 6);
  // Zone 7: 400-499 (zones 400-499)
  for (let i = 400; i <= 499; i++) US_ZIP_ZONES.set(i, 7);
  // Zone 8: 500-999 (zones 500-999)
  for (let i = 500; i <= 999; i++) US_ZIP_ZONES.set(i, 8);
}

initializeUSZones();

// Remote area postal code prefixes (US)
const REMOTE_AREAS_US: Set<string> = new Set([
  "996", // Alaska
  "997", // Alaska
  "998", // Alaska
  "999", // Alaska
  "968", // Guam
  "969", // Mariana Islands
  "967", // Palau
]);

// International zone mapping
const INTERNATIONAL_ZONES: Map<string, number> = new Map([
  // Zone 1: Canada
  ["CA", 1],
  // Zone 2: Mexico, Central America
  ["MX", 2],
  ["GT", 2],
  ["BZ", 2],
  // Zone 3: Caribbean
  ["PR", 3],
  ["VI", 3],
  ["DO", 3],
  ["CU", 3],
  // Zone 4: South America
  ["CO", 4],
  ["VE", 4],
  ["EC", 4],
  ["PE", 4],
  ["BR", 4],
  ["BO", 4],
  ["CL", 4],
  ["AR", 4],
  ["UY", 4],
  ["PY", 4],
  // Zone 5: Western Europe
  ["GB", 5],
  ["FR", 5],
  ["DE", 5],
  ["IT", 5],
  ["ES", 5],
  ["PT", 5],
  ["BE", 5],
  ["NL", 5],
  ["CH", 5],
  ["AT", 5],
  ["SE", 5],
  ["NO", 5],
  // Zone 6: Eastern Europe, Russia
  ["RU", 6],
  ["PL", 6],
  ["CZ", 6],
  ["SK", 6],
  ["HU", 6],
  ["RO", 6],
  ["UA", 6],
  // Zone 7: Middle East, Africa
  ["AE", 7],
  ["SA", 7],
  ["KSA", 7],
  ["EG", 7],
  ["ZA", 7],
  // Zone 8: Asia Pacific
  ["CN", 8],
  ["JP", 8],
  ["KR", 8],
  ["IN", 8],
  ["TH", 8],
  ["SG", 8],
  ["HK", 8],
  ["AU", 8],
  ["NZ", 8],
  ["MY", 8],
  ["ID", 8],
  ["PH", 8],
  ["VN", 8],
  ["TW", 8],
]);

/**
 * Get zone number from origin and destination postal codes
 * For US domestic shipments, calculates zone based on destination zip code
 * For international, uses country code mapping
 */
export function getZone(originPostal: string, destPostal: string, destCountry: string): number {
  // For US domestic shipments
  if (destCountry === "US") {
    const destZipPrefix = parseInt(destPostal.substring(0, 3), 10);
    return US_ZIP_ZONES.get(destZipPrefix) || 8;
  }

  // For international shipments
  const internationalZone = INTERNATIONAL_ZONES.get(destCountry);
  return internationalZone || 8; // Default to zone 8 for unknown countries
}

/**
 * Check if a postal code is in a remote area
 * Remote areas typically have surcharges
 */
export function isRemoteArea(postalCode: string, country: string): boolean {
  if (country === "US") {
    const prefix = postalCode.substring(0, 3);
    return REMOTE_AREAS_US.has(prefix);
  }

  // For other countries, expand as needed
  // Remote areas in other countries would be handled similarly

  return false;
}

/**
 * Get zone-based rate multiplier
 * Closer zones (1) have lower multipliers, distant zones (8) have higher
 */
export function getZoneMultiplier(zone: number): number {
  const multipliers: Record<number, number> = {
    1: 1.0,
    2: 1.15,
    3: 1.3,
    4: 1.5,
    5: 1.75,
    6: 2.0,
    7: 2.3,
    8: 2.6,
  };

  return multipliers[zone] || 2.6;
}

/**
 * Get remote area surcharge percentage
 */
export function getRemoteAreaSurcharge(zone: number): number {
  // Remote areas have higher surcharge for distant zones
  const surcharges: Record<number, number> = {
    1: 0.0,
    2: 0.05,
    3: 0.08,
    4: 0.12,
    5: 0.15,
    6: 0.18,
    7: 0.22,
    8: 0.25,
  };

  return surcharges[zone] || 0.25;
}

/**
 * Calculate estimated delivery days based on zone
 * Used for transit time estimation
 */
export function getEstimatedDays(zone: number, serviceLevel: string): number {
  const baseDays: Record<string, Record<number, number>> = {
    same_day: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2, 6: 2, 7: 2, 8: 3 },
    overnight: { 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2, 7: 3, 8: 3 },
    express: { 1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 4, 7: 4, 8: 5 },
    ground: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8 },
    economy: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 10 },
  };

  const serviceDays = baseDays[serviceLevel] || baseDays.ground;
  return serviceDays[zone] || 8;
}
