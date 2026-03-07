/**
 * Orders List — Full-width resource list with filters and bulk actions.
 *
 * Features:
 *   - Multi-select status filter (persistent URL params)
 *   - Date range filter
 *   - Driver and Zone dropdowns
 *   - Search by order number, customer name, address
 *   - Pagination (server-side)
 *   - Bulk actions: assign driver, assign route, print labels, cancel
 *   - Row click → order detail
 *
 * All data is loaded server-side via React Router v7 loader.
 * Filters are stored as URL search params for shareability and back/forward nav.
 */
import type { LoaderFunctionArgs } from "react-router";
export declare function loader({ request }: LoaderFunctionArgs): Promise<{
    orders: any;
    meta: any;
}>;
export default function OrdersList(): import("react").JSX.Element;
//# sourceMappingURL=orders._index.d.ts.map