/**
 * Address Management Module
 * 
 * Implements address parsing, normalization, and validation.
 * Note: Geocoding stub returns null - actual geocoding requires external service.
 */

import type { Coordinates, NormalizedAddress } from './types';

/**
 * Validate geographic coordinates
 * 
 * @param lat Latitude (-90 to 90)
 * @param lng Longitude (-180 to 180)
 * @returns True if coordinates are valid
 */
export function validateCoordinates(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !isNaN(lat) &&
    !isNaN(lng)
  );
}

/**
 * Convert coordinates to string format "lat,lng"
 * 
 * @param coords Coordinates to convert
 * @returns String representation
 */
export function coordinatesToString(coords: Coordinates): string {
  return `${coords.lat},${coords.lng}`;
}

/**
 * Parse address string into components
 * Uses simple pattern matching for common address formats
 * 
 * @param address Full address string
 * @returns Parsed address components
 */
export function parseAddressComponents(address: string): Partial<NormalizedAddress> {
  const result: Partial<NormalizedAddress> = {
    formatted: address.trim(),
  };

  if (!address || address.trim().length === 0) {
    return result;
  }

  // Split by comma for main components
  const parts = address.split(',').map((p) => p.trim());

  // Try to extract components from parts
  // Common formats:
  // "Street, City, State ZIP, Country"
  // "Street, City, State, Country"
  // "Street, City, State"

  if (parts.length >= 1) {
    result.street = parts[0];
  }

  if (parts.length >= 2) {
    result.city = parts[1];
  }

  if (parts.length >= 3) {
    // Try to parse state and zip from combined string
    const stateZip = parts[2];
    const stateZipMatch = stateZip.match(/^([A-Z]{2})\s*(\d{5}(?:-\d{4})?)$/);

    if (stateZipMatch) {
      result.state = stateZipMatch[1];
      result.zip = stateZipMatch[2];
    } else {
      // Try just state
      const stateMatch = stateZip.match(/^([A-Z]{2})$/);
      if (stateMatch) {
        result.state = stateMatch[1];
      } else {
        result.state = stateZip;
      }
    }
  }

  if (parts.length >= 4) {
    result.country = parts[3];
  }

  return result;
}

/**
 * Normalize address by cleaning and standardizing components
 * 
 * @param rawAddress Raw address input
 * @returns Normalized address with all components
 */
export function normalizeAddress(rawAddress: string): NormalizedAddress {
  if (!rawAddress || rawAddress.trim().length === 0) {
    return {
      formatted: '',
    };
  }

  const trimmed = rawAddress.trim();
  const components = parseAddressComponents(trimmed);

  // Standardize state abbreviations (basic validation)
  if (components.state) {
    components.state = components.state.toUpperCase().slice(0, 2);
  }

  // Standardize country
  if (components.country) {
    components.country = components.country.trim();
  }

  // Standardize zip code format (basic cleaning)
  if (components.zip) {
    components.zip = components.zip.replace(/\s+/g, '');
  }

  return {
    street: components.street || '',
    city: components.city || '',
    state: components.state || '',
    zip: components.zip || '',
    country: components.country || '',
    formatted: formatAddress(
      {
        street: components.street || '',
        city: components.city || '',
        state: components.state || '',
        zip: components.zip || '',
        country: components.country || '',
        formatted: trimmed,
      },
      'full'
    ),
  };
}

/**
 * Format address from components
 * 
 * @param components Address components
 * @param format Format style: 'short' or 'full'
 * @returns Formatted address string
 */
export function formatAddress(
  components: NormalizedAddress,
  format: 'short' | 'full' = 'full'
): string {
  if (format === 'short') {
    // Short format: "City, State ZIP"
    const parts: string[] = [];

    if (components.city) parts.push(components.city);
    if (components.state || components.zip) {
      const stateZip = [components.state, components.zip].filter(Boolean).join(' ');
      parts.push(stateZip);
    }

    return parts.join(', ') || components.formatted || '';
  }

  // Full format: "Street, City, State ZIP, Country"
  const parts: string[] = [];

  if (components.street) parts.push(components.street);
  if (components.city) parts.push(components.city);

  if (components.state || components.zip) {
    const stateZip = [components.state, components.zip].filter(Boolean).join(' ');
    parts.push(stateZip);
  }

  if (components.country) parts.push(components.country);

  return parts.join(', ') || components.formatted || '';
}

/**
 * Estimate geocoding results from address string
 * 
 * STUB FUNCTION: Always returns null
 * In production, this would integrate with a geocoding service like Google Maps,
 * Mapbox, or Open Street Map.
 * 
 * @param address Address string to geocode
 * @returns Coordinates or null if geocoding fails or is not available
 */
export function estimateGeocode(address: string): Coordinates | null {
  // This is a stub implementation
  // In production, this would call an external geocoding API
  // Example implementation would be:
  // 
  // const response = await fetch('https://api.geocoder.com/geocode', {
  //   params: { address }
  // });
  // const data = await response.json();
  // return { lat: data.lat, lng: data.lng };
  //
  // For now, we return null to indicate geocoding is not available

  if (!address || address.trim().length === 0) {
    return null;
  }

  // Could implement mock geocoding for known addresses in tests
  // For production use, integrate with actual geocoding service
  return null;
}

/**
 * Validate address has required components
 * 
 * @param address Address to validate
 * @returns True if address has minimum required fields
 */
export function isValidAddress(address: NormalizedAddress): boolean {
  return !!(address.street && address.city && (address.state || address.zip));
}

/**
 * Check if two addresses represent the same location
 * Uses fuzzy matching on normalized components
 * 
 * @param address1 First address
 * @param address2 Second address
 * @returns True if addresses likely represent same location
 */
export function addressesMatch(address1: NormalizedAddress, address2: NormalizedAddress): boolean {
  // Exact match on key components
  const street1 = (address1.street || '').toLowerCase().trim();
  const street2 = (address2.street || '').toLowerCase().trim();

  const city1 = (address1.city || '').toLowerCase().trim();
  const city2 = (address2.city || '').toLowerCase().trim();

  const state1 = (address1.state || '').toUpperCase().trim();
  const state2 = (address2.state || '').toUpperCase().trim();

  const zip1 = (address1.zip || '').trim();
  const zip2 = (address2.zip || '').trim();

  // Check if street and city match, and either state or zip matches
  return (
    street1 === street2 &&
    city1 === city2 &&
    ((state1 && state1 === state2) || (zip1 && zip1 === zip2))
  );
}

/**
 * Extract postal code from address string
 * Looks for common postal code patterns
 * 
 * @param address Address string
 * @returns Postal code if found, null otherwise
 */
export function extractPostalCode(address: string): string | null {
  if (!address) return null;

  // US ZIP code (5 or 9 digits)
  const usZipMatch = address.match(/\b\d{5}(?:-\d{4})?\b/);
  if (usZipMatch) {
    return usZipMatch[0];
  }

  // Canadian postal code
  const caPostalMatch = address.match(/\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i);
  if (caPostalMatch) {
    return caPostalMatch[0];
  }

  // UK postcode
  const ukPostcodeMatch = address.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i);
  if (ukPostcodeMatch) {
    return ukPostcodeMatch[0];
  }

  return null;
}
