import type { CRMPlatform } from "./types";

export const CRM_PLATFORMS: CRMPlatform[] = [
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Connect to Salesforce CRM for contact and deal management",
    logo: "salesforce",
    isConnected: false,
  },
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Sync with HubSpot for marketing and sales automation",
    logo: "hubspot",
    isConnected: false,
  },
  {
    id: "zoho",
    name: "Zoho CRM",
    description: "Integrate with Zoho for comprehensive CRM operations",
    logo: "zoho",
    isConnected: false,
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    description: "Connect Pipedrive for sales pipeline management",
    logo: "pipedrive",
    isConnected: false,
  },
  {
    id: "ms-dynamics",
    name: "Dynamics 365",
    description: "Integrate Microsoft Dynamics 365 for enterprise CRM",
    logo: "dynamics",
    isConnected: false,
  },
];

export const SYNC_OBJECT_TYPES = ["contacts", "deals", "companies"];

export const DEFAULT_SYNC_CONFIG = {
  direction: "bidirectional" as const,
  objectTypes: SYNC_OBJECT_TYPES,
};

export const DEFAULT_SYNC_SCHEDULE = "hourly";
