/**
 * Routes List — Delivery routes management.
 *
 * Features:
 *   - Table view: Name, Driver, Stops count, Status, Distance, Duration, Date
 *   - Status filter: DRAFT | OPTIMIZING | READY | IN_PROGRESS | COMPLETED
 *   - Date filter
 *   - Create Route button
 *   - Optimize selected routes action
 *   - Pagination
 *
 * Status colors and route management for delivery logistics.
 */
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
export declare function loader({ request }: LoaderFunctionArgs): Promise<{
    routes: any;
    meta: any;
}>;
export declare function action({ request }: ActionFunctionArgs): Promise<Response | null>;
export default function RoutesList(): import("react").JSX.Element;
//# sourceMappingURL=routes._index.d.ts.map