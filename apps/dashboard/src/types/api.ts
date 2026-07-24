/**
 * API type declarations for dashboard.
 * Shared types for API responses and entities.
 */

export interface CRMConnection {
  id: string;
  platform: string;
  status: "connected" | "disconnected" | "error" | "pending";
  name: string;
  createdAt: string;
  updatedAt: string;
  config?: Record<string, unknown>;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}
