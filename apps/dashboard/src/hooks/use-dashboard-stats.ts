'use client';

/**
 * Dashboard statistics API hooks for main dashboard page
 */

import { useApiQuery, UseApiQueryResult } from './use-api';

/**
 * Dashboard statistics — matches GET /api/v4/dashboard/stats response
 */
export interface DashboardStats {
  totalOrders: number;
  totalDrivers: number;
  totalCustomers: number;
  pendingOrders: number;
  activeDrivers: number;
  deliveredToday: number;
  revenue: number;
}

/**
 * Recent order summary
 */
export interface RecentOrder {
  id: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  driverName?: string;
}

/**
 * Heatmap data point for delivery analytics
 */
export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  intensity: number;
  count: number;
}

/**
 * Delivery heatmap data
 */
export interface DeliveryHeatmap {
  points: HeatmapPoint[];
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

/**
 * Hook to fetch aggregated dashboard statistics
 * Includes total orders today, active drivers, pending deliveries, and revenue
 * @returns Dashboard statistics
 */
export function useDashboardStats(): UseApiQueryResult<DashboardStats> {
  return useApiQuery<DashboardStats>('/api/v4/dashboard/stats');
}

/**
 * Hook to fetch recent orders for dashboard timeline/list
 * @param limit - Maximum number of orders to fetch (default: 5)
 * @returns Array of recent orders sorted by creation date (newest first)
 */
export function useRecentOrders(
  limit: number = 5,
): UseApiQueryResult<RecentOrder[]> {
  return useApiQuery<RecentOrder[]>(
    `/orders?limit=${limit}&sort=-createdAt`,
  );
}

/**
 * Hook to fetch delivery heatmap data for map visualization
 * Shows concentration of deliveries by geographic location
 * @returns Heatmap data with points and geographic bounds
 * @note Heatmap endpoint returns empty points if not yet implemented
 */
export function useDeliveryHeatmap(): UseApiQueryResult<DeliveryHeatmap> {
  // TODO: Implement GET /api/v4/analytics/heatmap endpoint when analytics heatmap becomes available
  // For now, this hook gracefully handles the missing endpoint by returning empty data
  const result = useApiQuery<DeliveryHeatmap>('/api/v4/analytics/heatmap');

  // If the endpoint doesn't exist (404), return empty heatmap data instead of showing error
  if (result.error && (result.error as any).status === 404) {
    return {
      data: {
        points: [],
        bounds: {
          north: 40.7128,
          south: 40.7128,
          east: -74.0060,
          west: -74.0060,
        },
      },
      loading: false,
      error: null,
      refetch: result.refetch,
    };
  }

  return result;
}
