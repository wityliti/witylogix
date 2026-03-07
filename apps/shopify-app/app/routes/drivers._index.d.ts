/**
 * Drivers List — Resource list with table/map toggle view.
 *
 * Features:
 *   - Table view: name, phone, vehicle, status, active orders, last seen
 *   - Map view: driver markers on Mapbox map (client-side rendered)
 *   - Status filter: ALL | AVAILABLE | ON_DELIVERY | OFFLINE
 *   - Search by name or phone
 *   - Add Driver button → modal or /drivers/new
 *   - Row click → driver detail
 *
 * The map view uses a client-only component to avoid SSR issues with Mapbox GL.
 */
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
export declare function loader({ request }: LoaderFunctionArgs): Promise<{
    drivers: any;
    meta: any;
}>;
export declare function action({ request }: ActionFunctionArgs): Promise<Response | null>;
export default function DriversList(): import("react").JSX.Element;
//# sourceMappingURL=drivers._index.d.ts.map