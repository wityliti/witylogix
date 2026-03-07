/**
 * EmptyState — Empty state component for lists and tables.
 *
 * BFS certification requires every list to have an empty state with CTA.
 * This component provides a consistent empty state pattern across the app.
 */
interface EmptyStateProps {
    title: string;
    description?: string;
    actionLabel?: string;
    actionUrl?: string;
    onAction?: () => void;
    image?: "orders" | "drivers" | "routes" | "zones" | "users" | "generic";
}
export declare function EmptyState({ title, description, actionLabel, actionUrl, onAction, }: EmptyStateProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=EmptyState.d.ts.map