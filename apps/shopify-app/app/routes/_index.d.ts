/**
 * Dashboard (Home) — Landing page for the Shopify embedded admin app.
 *
 * Displays:
 *   - KPI summary cards (4-column grid): Orders Today, Active Deliveries,
 *     Drivers Online, Delivery Success Rate
 *   - Quick action buttons: Create Order, Build Route, View Unassigned
 *   - Real-time activity timeline (Socket.io powered)
 *
 * Data is loaded server-side via the loader. Activity timeline
 * updates are pushed client-side via WebSocket.
 */
import type { LoaderFunctionArgs } from "react-router";
interface DashboardStats {
    ordersToday: number;
    ordersDelta: number;
    activeDeliveries: number;
    driversOnline: number;
    driversTotal: number;
    successRate: number;
    successRateDelta: number;
    unassignedCount: number;
}
interface ActivityEvent {
    id: string;
    status: string;
    message: string;
    actor?: string;
    timestamp: string;
}
export declare function loader({ request }: LoaderFunctionArgs): Promise<{
    stats: DashboardStats;
    recentActivity: ActivityEvent[];
}>;
export default function Dashboard(): import("react").JSX.Element;
export {};
//# sourceMappingURL=_index.d.ts.map