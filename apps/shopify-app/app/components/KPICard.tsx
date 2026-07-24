/**
 * KPICard — Key Performance Indicator card component.
 *
 * Displays a metric with title, value, trend delta, and optional
 * description. Used on the Dashboard home page in a 4-column grid.
 *
 * Uses Polaris v13 components for consistent Shopify Admin styling.
 */

import {
  BlockStack,
  Card,
  InlineStack,
  SkeletonBodyText,
  SkeletonDisplayText,
  Text,
} from "@shopify/polaris";

interface KPICardProps {
  title: string;
  value: string | number;
  /** Change vs previous period. Positive = green, negative = red. */
  delta?: number;
  /** Unit for the delta (e.g., "%", "orders"). */
  deltaUnit?: string;
  /** Period comparison label (e.g., "vs yesterday"). */
  deltaPeriod?: string;
  /** Optional secondary text below the value. */
  description?: string;
  /** Loading skeleton state. */
  loading?: boolean;
}

export function KPICard({
  title,
  value,
  delta,
  deltaUnit = "",
  deltaPeriod = "vs yesterday",
  description,
  loading = false,
}: KPICardProps) {
  if (loading) {
    return (
      <Card>
        <BlockStack gap="200">
          <SkeletonBodyText lines={1} />
          <SkeletonDisplayText size="small" />
          <SkeletonBodyText lines={1} />
        </BlockStack>
      </Card>
    );
  }

  const deltaPrefix = delta !== undefined && delta > 0 ? "+" : "";

  const deltaTone: "success" | "critical" | "subdued" =
    delta === undefined || delta === 0
      ? "subdued"
      : delta > 0
        ? "success"
        : "critical";

  return (
    <Card>
      <BlockStack gap="200">
        <Text as="p" variant="bodySm" tone="subdued">
          {title}
        </Text>
        <Text as="p" variant="headingLg" fontWeight="bold">
          {String(value)}
        </Text>
        {delta !== undefined && (
          <InlineStack gap="100" blockAlign="center">
            <Text
              as="span"
              variant="bodySm"
              tone={deltaTone}
              fontWeight="medium"
            >
              {deltaPrefix}
              {delta}
              {deltaUnit}
            </Text>
            <Text as="span" variant="bodySm" tone="subdued">
              {deltaPeriod}
            </Text>
          </InlineStack>
        )}
        {description && (
          <Text as="p" variant="bodySm" tone="subdued">
            {description}
          </Text>
        )}
      </BlockStack>
    </Card>
  );
}
