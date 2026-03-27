/**
 * EmptyState — Empty state component for lists and tables.
 *
 * BFS certification requires every list to have an empty state with CTA.
 * This component provides a consistent empty state pattern across the app.
 *
 * Uses Polaris v13 EmptyState component internally.
 */

import { EmptyState as PolarisEmptyState } from "@shopify/polaris";

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  actionUrl?: string;
  onAction?: () => void;
  image?: "orders" | "drivers" | "routes" | "zones" | "users" | "generic";
}

export function EmptyState({
  title,
  description,
  actionLabel,
  actionUrl,
  onAction,
}: EmptyStateProps) {
  const action =
    actionLabel && (actionUrl || onAction)
      ? {
          content: actionLabel,
          url: actionUrl,
          onAction,
        }
      : undefined;

  return (
    <PolarisEmptyState
      heading={title}
      action={action}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      {description && <p>{description}</p>}
    </PolarisEmptyState>
  );
}
