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

export interface WizardStep {
  id: number;
  title: string;
  description: string;
  isComplete: boolean;
  isActive: boolean;
  isAccessible: boolean;
}

export interface OAuthConfig {
  platformId: string;
  clientId: string;
  redirectUri: string;
  scope: string[];
}

export interface TestResults {
  success: boolean;
  message: string;
}
