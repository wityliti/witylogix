/**
 * OrderStatusBadge — Consistent status badge for order statuses.
 *
 * Maps order status values to Polaris-compatible color tokens.
 * Used in order tables, order detail pages, and activity timelines.
 */
interface OrderStatusBadgeProps {
    status: string;
    size?: "small" | "medium";
}
export declare function OrderStatusBadge({ status, size, }: OrderStatusBadgeProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=OrderStatusBadge.d.ts.map