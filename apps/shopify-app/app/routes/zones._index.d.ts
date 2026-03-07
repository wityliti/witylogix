/**
 * Zones List — Delivery zones management.
 *
 * Features:
 *   - Table view: Name, Base Rate, Per Km Rate, Min Order, Free Above, Priority, Order Count
 *   - Create Zone modal with form
 *   - Pagination
 *   - Row click → zone detail
 *
 * Zone management for delivery service coverage and pricing.
 */
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
export declare function loader({ request }: LoaderFunctionArgs): Promise<{
    zones: any;
    meta: any;
}>;
export declare function action({ request }: ActionFunctionArgs): Promise<Response | null>;
export default function ZonesList(): import("react").JSX.Element;
//# sourceMappingURL=zones._index.d.ts.map