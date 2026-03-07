/**
 * Driver Detail — Full driver profile with tabs: Overview, Orders, History.
 *
 * Overview tab: Profile info, current location, vehicle, stats
 * Orders tab: Active and recent orders assigned to this driver
 * History tab: Delivery history with metrics (completion rate, avg time)
 *
 * Actions: Edit driver, deactivate, assign orders
 */
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
export declare function loader({ request, params }: LoaderFunctionArgs): Promise<{
    driver: any;
    orders: any;
    tab: string;
}>;
export declare function action({ request, params }: ActionFunctionArgs): Promise<Response>;
export default function DriverDetailPage(): import("react").JSX.Element;
//# sourceMappingURL=drivers.$id.d.ts.map