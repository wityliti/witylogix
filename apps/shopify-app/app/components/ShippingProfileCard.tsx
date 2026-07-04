/**
 * ShippingProfileCard — Card component for displaying shipping profile information.
 *
 * Displays shipping profile details including delivery method, rate type,
 * base rate, linked locations, active status, and action buttons.
 *
 * Uses Polaris v13 components for layout and typography.
 */

import {
  Badge,
  BlockStack,
  Button,
  Card,
  InlineGrid,
  InlineStack,
  Text,
} from "@shopify/polaris";
import type { BadgeProps } from "@shopify/polaris";

interface ShippingProfile {
  id: string;
  name: string;
  deliveryMethod: string;
  rateType: string;
  baseRate: number;
  currency: string;
  linkedLocations: number;
  isActive: boolean;
}

interface ShippingProfileCardProps {
  profile: ShippingProfile;
  onEdit?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

const DELIVERY_METHOD_CONFIG: Record<
  string,
  { label: string; tone?: BadgeProps["tone"] }
> = {
  STANDARD: { label: "Standard", tone: "info" },
  EXPRESS: { label: "Express", tone: "info" },
  OVERNIGHT: { label: "Overnight", tone: "attention" },
  GROUND: { label: "Ground", tone: "success" },
};

const RATE_TYPE_CONFIG: Record<
  string,
  { label: string; tone?: BadgeProps["tone"] }
> = {
  FIXED: { label: "Fixed Rate", tone: "attention" },
  PERCENTAGE: { label: "Percentage", tone: "success" },
  WEIGHT_BASED: { label: "Weight Based" },
};

export function ShippingProfileCard({
  profile,
  onEdit,
  onDuplicate,
}: ShippingProfileCardProps) {
  const deliveryMethodConfig = DELIVERY_METHOD_CONFIG[
    profile.deliveryMethod
  ] ?? {
    label: profile.deliveryMethod,
  };

  const rateTypeConfig = RATE_TYPE_CONFIG[profile.rateType] ?? {
    label: profile.rateType,
  };

  const formatRate = (rate: number, currency: string): string => {
    return `${currency} ${rate.toFixed(2)}`;
  };

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="start">
          <BlockStack gap="200">
            <Text as="h3" variant="headingMd">
              {profile.name}
            </Text>
            <InlineStack gap="200">
              <Badge tone={deliveryMethodConfig.tone} size="small">
                {deliveryMethodConfig.label}
              </Badge>
              <Badge tone={rateTypeConfig.tone} size="small">
                {rateTypeConfig.label}
              </Badge>
            </InlineStack>
          </BlockStack>
          <Badge tone={profile.isActive ? "success" : undefined} size="small">
            {profile.isActive ? "Active" : "Inactive"}
          </Badge>
        </InlineStack>

        <InlineGrid columns={2} gap="300">
          <BlockStack gap="050">
            <Text as="p" variant="bodySm" tone="subdued">
              Base Rate
            </Text>
            <Text as="p" variant="bodyMd" fontWeight="medium">
              {formatRate(profile.baseRate, profile.currency)}
            </Text>
          </BlockStack>
          <BlockStack gap="050">
            <Text as="p" variant="bodySm" tone="subdued">
              Linked Locations
            </Text>
            <Text as="p" variant="bodyMd" fontWeight="medium">
              {String(profile.linkedLocations)}
            </Text>
          </BlockStack>
        </InlineGrid>

        <InlineStack align="end" gap="200">
          {onDuplicate && (
            <Button onClick={() => onDuplicate(profile.id)}>Duplicate</Button>
          )}
          {onEdit && (
            <Button variant="primary" onClick={() => onEdit(profile.id)}>
              Edit
            </Button>
          )}
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
