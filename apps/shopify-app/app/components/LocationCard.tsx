/**
 * LocationCard — Card component for displaying location information.
 *
 * Displays location details with type badge, address information,
 * active/inactive status, and action buttons.
 *
 * Uses Polaris v13 components for layout and typography.
 */

import {
  Badge,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Text,
} from "@shopify/polaris";
import type { BadgeProps } from "@shopify/polaris";

interface Location {
  id: string;
  name: string;
  type: string;
  addressLine1: string;
  city: string;
  state: string;
  isActive: boolean;
}

interface LocationCardProps {
  location: Location;
  onEdit?: (id: string) => void;
  onDeactivate?: (id: string) => void;
}

const LOCATION_TYPE_TONE: Record<
  string,
  { label: string; tone?: BadgeProps["tone"] }
> = {
  WAREHOUSE: { label: "Warehouse", tone: "info" },
  STORE: { label: "Store", tone: "success" },
  HUB: { label: "Hub", tone: "attention" },
  DROP_POINT: { label: "Drop Point" },
};

export function LocationCard({
  location,
  onEdit,
  onDeactivate,
}: LocationCardProps) {
  const typeConfig = LOCATION_TYPE_TONE[location.type] ?? {
    label: location.type,
  };

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="start">
          <BlockStack gap="200">
            <Text as="h3" variant="headingMd">
              {location.name}
            </Text>
            <Badge tone={typeConfig.tone} size="small">
              {typeConfig.label}
            </Badge>
          </BlockStack>
          <Badge tone={location.isActive ? "success" : undefined} size="small">
            {location.isActive ? "Active" : "Inactive"}
          </Badge>
        </InlineStack>

        <BlockStack gap="050">
          <Text as="p" variant="bodySm" tone="subdued">
            {location.addressLine1}
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            {location.city}, {location.state}
          </Text>
        </BlockStack>

        <InlineStack align="end" gap="200">
          {onEdit && <Button onClick={() => onEdit(location.id)}>Edit</Button>}
          {onDeactivate && (
            <Button
              onClick={() => onDeactivate(location.id)}
              tone="critical"
              disabled={!location.isActive}
            >
              {location.isActive ? "Deactivate" : "Inactive"}
            </Button>
          )}
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
