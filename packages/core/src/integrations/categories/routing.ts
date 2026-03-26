/**
 * Routing category — re-registers all 6 routing providers
 * from the existing PROVIDER_REGISTRY into the unified IntegrationAppMeta format.
 */

import type { IntegrationAppMeta } from "../types.js";

export const ROUTING_INTEGRATIONS: readonly IntegrationAppMeta[] = [
  {
    slug: "mapbox",
    name: "Mapbox",
    description:
      "Production-ready routing, geocoding, and distance matrices. 25-point matrix limit per request. Pay-per-use.",
    category: "ROUTING",
    websiteUrl: "https://www.mapbox.com",
    docsUrl: "https://docs.mapbox.com",
    authType: "API_KEY",
    credentialFields: [
      {
        key: "apiKey",
        label: "Access Token",
        placeholder: "pk.eyJ1IjoibXl1c2VyIiwiYSI6...",
        type: "password",
        required: true,
        helpUrl: "https://account.mapbox.com/access-tokens/",
        pattern: "^[ps]k\\.\\w+",
      },
    ],
    capabilities: ["routing", "matrix", "geocoding", "eta"],
    status: "AVAILABLE",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "osrm",
    name: "OSRM (Self-Hosted)",
    description:
      "Open-source routing engine. Zero per-request cost, unlimited matrix size. Requires self-hosting. No geocoding.",
    category: "ROUTING",
    websiteUrl: "https://project-osrm.org",
    docsUrl: "http://project-osrm.org/docs/v5.24.0/api/",
    authType: "NONE",
    credentialFields: [
      {
        key: "baseUrl",
        label: "Server URL",
        placeholder: "http://osrm.example.com:5000",
        type: "url",
        required: true,
      },
    ],
    capabilities: ["routing", "matrix", "eta"],
    status: "AVAILABLE",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "google_maps",
    name: "Google Maps",
    description:
      "Google Routes API with real-time traffic, geocoding, and distance matrices. Broad global coverage. Pay-per-use.",
    category: "ROUTING",
    websiteUrl: "https://developers.google.com/maps",
    docsUrl: "https://developers.google.com/maps/documentation/routes",
    authType: "API_KEY",
    credentialFields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "AIzaSy...",
        type: "password",
        required: true,
        helpUrl: "https://console.cloud.google.com/apis/credentials",
        pattern: "^AIza[0-9A-Za-z_-]{35}$",
      },
    ],
    capabilities: ["routing", "matrix", "geocoding", "eta", "traffic"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "here",
    name: "HERE",
    description:
      "HERE Routing and Geocoding APIs with fleet management features, truck routing, and isoline calculations.",
    category: "ROUTING",
    websiteUrl: "https://www.here.com",
    docsUrl: "https://developer.here.com/documentation",
    authType: "API_KEY",
    credentialFields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "your-here-api-key",
        type: "password",
        required: true,
        helpUrl: "https://platform.here.com/admin/apps",
      },
    ],
    capabilities: ["routing", "matrix", "geocoding", "eta", "truck_routing"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "graphhopper",
    name: "GraphHopper",
    description:
      "Open-source routing engine with hosted and self-hosted options. Built-in vehicle routing problem (VRP) solver.",
    category: "ROUTING",
    websiteUrl: "https://www.graphhopper.com",
    docsUrl: "https://docs.graphhopper.com",
    authType: "API_KEY",
    credentialFields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "your-graphhopper-key",
        type: "password",
        required: true,
        helpUrl: "https://www.graphhopper.com/dashboard/#/api-keys",
      },
    ],
    capabilities: ["routing", "matrix", "geocoding", "eta", "vrp_solver"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
  {
    slug: "tomtom",
    name: "TomTom",
    description:
      "TomTom Routing and Geocoding APIs with real-time traffic and commercial vehicle routing profiles.",
    category: "ROUTING",
    websiteUrl: "https://www.tomtom.com",
    docsUrl: "https://developer.tomtom.com",
    authType: "API_KEY",
    credentialFields: [
      {
        key: "apiKey",
        label: "API Key",
        placeholder: "your-tomtom-key",
        type: "password",
        required: true,
        helpUrl: "https://developer.tomtom.com/user/me/apps",
      },
    ],
    capabilities: ["routing", "matrix", "geocoding", "eta", "traffic"],
    status: "COMING_SOON",
    isBuiltIn: true,
    version: "1.0.0",
  },
];
