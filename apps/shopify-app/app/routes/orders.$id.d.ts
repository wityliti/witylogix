/**
 * Order Detail — Full order view with status timeline and driver assignment.
 *
 * Layout:
 *   Left column (60%): Customer info, line items, delivery details
 *   Right column (40%): Status timeline, driver assignment, actions
 *
 * Actions:
 *   - Assign/reassign driver (modal with driver search)
 *   - Update status (dropdown)
 *   - Cancel order
 *   - View on Shopify (external link)
 *   - Print label
 *
 * Data loaded server-side. Status updates via action (form submission).
 */
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
export declare function loader({ request, params }: LoaderFunctionArgs): Promise<{
    order: any;
    timeline: any;
    availableDrivers: any;
}>;
export declare function action({ request, params }: ActionFunctionArgs): Promise<Response>;
export default function OrderDetailPage(): import("react").JSX.Element;
//# sourceMappingURL=orders.$id.d.ts.map