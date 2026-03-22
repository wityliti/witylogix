// CRM Connection Types

export interface SyncConfig {
  direction: "in" | "out" | "bidirectional";
  objectTypes: string[];
}

export interface CRMPlatform {
  id: string;
  name: string;
  description: string;
  logo: string;
  isConnected: boolean;
}
