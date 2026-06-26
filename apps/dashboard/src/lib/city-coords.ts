/**
 * City name → [lng, lat] lookup for approximate map centering.
 * Used by partner-coverage-layer and live-tracking-layer.
 * Coordinates are city centroids — not precise delivery points.
 */
export const CITY_COORDS: Record<string, [number, number]> = {
  "New York":      [-74.0060, 40.7128],
  "New York City": [-74.0060, 40.7128],
  "NYC":           [-74.0060, 40.7128],
  "Los Angeles":   [-118.2437, 34.0522],
  "Chicago":       [-87.6298, 41.8781],
  "Houston":       [-95.3698, 29.7604],
  "Phoenix":       [-112.0740, 33.4484],
  "Philadelphia":  [-75.1652, 39.9526],
  "San Antonio":   [-98.4936, 29.4241],
  "San Diego":     [-117.1611, 32.7157],
  "Dallas":        [-96.7970, 32.7767],
  "San Francisco": [-122.4194, 37.7749],
  "Austin":        [-97.7431, 30.2672],
  "Seattle":       [-122.3321, 47.6062],
  "Denver":        [-104.9903, 39.7392],
  "Boston":        [-71.0589, 42.3601],
  "Nashville":     [-86.7816, 36.1627],
  "Miami":         [-80.1918, 25.7617],
  "Atlanta":       [-84.3880, 33.7490],
  "Minneapolis":   [-93.2650, 44.9778],
  "London":        [-0.1278, 51.5074],
  "Manchester":    [-2.2426, 53.4808],
  "Birmingham":    [-1.8904, 52.4862],
  "Glasgow":       [-4.2518, 55.8642],
  "Leeds":         [-1.5491, 53.8008],
  "Liverpool":     [-2.9916, 53.4084],
  "Bristol":       [-2.5879, 51.4545],
  "Edinburgh":     [-3.1883, 55.9533],
  "Sheffield":     [-1.4659, 53.3811],
  "Toronto":       [-79.3832, 43.6532],
  "Vancouver":     [-123.1207, 49.2827],
  "Montreal":      [-73.5673, 45.5017],
  "Calgary":       [-114.0719, 51.0447],
  "Ottawa":        [-75.6972, 45.4215],
  "Sydney":        [151.2093, -33.8688],
  "Melbourne":     [144.9631, -37.8136],
  "Brisbane":      [153.0251, -27.4698],
  "Perth":         [115.8605, -31.9505],
  "Adelaide":      [138.6007, -34.9285],
  "Dublin":        [-6.2603, 53.3498],
  "Auckland":      [174.7633, -36.8485],
  "Singapore":     [103.8198, 1.3521],
  "Dubai":         [55.2708, 25.2048],
  "Abu Dhabi":     [54.3773, 24.4539],
  "Paris":         [2.3522, 48.8566],
  "Berlin":        [13.4050, 52.5200],
  "Amsterdam":     [4.9041, 52.3676],
  "Madrid":        [-3.7038, 40.4168],
  "Rome":          [12.4964, 41.9028],
  "Milan":         [9.1900, 45.4654],
  "Barcelona":     [2.1734, 41.3851],
  "Vienna":        [16.3738, 48.2082],
  "Brussels":      [4.3517, 50.8503],
  "Zurich":        [8.5417, 47.3769],
  "Johannesburg":  [28.0473, -26.2041],
  "Cape Town":     [18.4241, -33.9249],
  "Lagos":         [3.3792, 6.5244],
  "Nairobi":       [36.8219, -1.2921],
  "Cairo":         [31.2357, 30.0444],
  "Mumbai":        [72.8777, 19.0760],
  "Delhi":         [77.2090, 28.6139],
  "Bangalore":     [77.5946, 12.9716],
  "Chennai":       [80.2707, 13.0827],
  "Hyderabad":     [78.4867, 17.3850],
  "Kolkata":       [88.3639, 22.5726],
  "Tokyo":         [139.6503, 35.6762],
  "Seoul":         [126.9780, 37.5665],
  "Shanghai":      [121.4737, 31.2304],
  "Beijing":       [116.4074, 39.9042],
  "Hong Kong":     [114.1694, 22.3193],
  "Taipei":        [121.5654, 25.0330],
  "Bangkok":       [100.5018, 13.7563],
  "Jakarta":       [106.8456, -6.2088],
  "Kuala Lumpur":  [101.6869, 3.1390],
  "Manila":        [120.9842, 14.5995],
  "São Paulo":     [-46.6333, -23.5505],
  "Rio de Janeiro":[-43.1729, -22.9068],
  "Mexico City":   [-99.1332, 19.4326],
  "Buenos Aires":  [-58.3816, -34.6037],
  "Bogotá":        [-74.0721, 4.7110],
  "Lima":          [-77.0428, -12.0464],
  "Santiago":      [-70.6693, -33.4489],
};

/** Resolve a city name to [lng, lat], case-insensitive. Returns null if not found. */
export function lookupCity(name: string): [number, number] | null {
  const exact = CITY_COORDS[name];
  if (exact) return exact;
  const lower = name.toLowerCase().trim();
  for (const [k, v] of Object.entries(CITY_COORDS)) {
    if (
      k.toLowerCase() === lower ||
      k.toLowerCase().startsWith(lower) ||
      lower.startsWith(k.toLowerCase())
    ) {
      return v;
    }
  }
  return null;
}
