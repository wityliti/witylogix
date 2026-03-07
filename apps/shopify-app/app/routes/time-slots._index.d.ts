/**
 * Time Slots List — Delivery time slots management.
 *
 * Features:
 *   - Table view: Label, Start Time, End Time, Max Orders, Active status toggle
 *   - Create Time Slot modal with form
 *   - Pagination
 *   - Toggle active/inactive status
 *
 * Time slot management for delivery window availability.
 */
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
export declare function loader({ request }: LoaderFunctionArgs): Promise<{
    timeSlots: any;
    meta: any;
}>;
export declare function action({ request }: ActionFunctionArgs): Promise<Response | null>;
export default function TimeSlotsList(): import("react").JSX.Element;
//# sourceMappingURL=time-slots._index.d.ts.map