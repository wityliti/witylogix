/**
 * Customer Detail — Customer profile with orders history and statistics.
 *
 * Features:
 *   - Customer info card: name, email, phone, Shopify ID, addresses
 *   - Stats row: total orders, total spent, average order value, first/last order dates
 *   - Order history table: order number, date, status, total, items count
 *   - Address list (from addresses JSON field)
 *   - Back to customers link
 *   - "View in Shopify" external link button
 *
 * Loader fetches single customer + their orders from API.
 */

import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import {
  Page,
  Layout,
  Card,
  DescriptionList,
  IndexTable,
  Badge,
  Text,
  BlockStack,
  InlineStack,
  InlineGrid,
  Button,
  Box,
  Divider,
} from "@shopify/polaris";
import { createApiClient } from "~/lib/api.server";
import { authenticate } from "~/lib/shopify.server";

// ─── Types ─────────────────────────────────────────────────

interface Address {
  id: string;
  firstName: string | null;
  lastName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  isDefault: boolean;
}

interface CustomerOrder {
  id: string;
  shopifyOrderNumber: string | null;
  createdAt: string;
  status: string;
  totalAmount: number;
  itemsCount: number;
}

interface Customer {
  id: string;
  shopifyCustomerId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  ordersCount: number;
  totalSpent: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  createdAt: string;
  addresses: Address[];
  orders: CustomerOrder[];
}

interface CustomerDetailData {
  customer: Customer;
}
// ─── Loader ────────────────────────────────────────────────

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const client = createApiClient(admin.graphql);

  const customerId = params.id;
  if (!customerId) {
    throw new Error("Customer ID not found");
  }

  try {
    const response = await client.get<{ data: CustomerDetailData }>(
      `/api/v4/customers/${customerId}`
    );

    return response.data;
  } catch (error) {
    console.error("Failed to fetch customer:", error);
    throw new Error("Customer not found");
  }
}

// ─── Component ─────────────────────────────────────────────

export default function CustomerDetail() {
  const { customer } = useLoaderData<CustomerDetailData>();

  const averageOrderValue =
    customer.ordersCount > 0 ? customer.totalSpent / customer.ordersCount : 0;

  const getOrderStatusTone = (status: string): "success" | "info" | "warning" | "critical" | undefined => {
    switch (status.toLowerCase()) {
      case "completed":
        return "success";
      case "processing":
        return "info";
      case "pending":
        return "warning";
      case "cancelled":
        return "critical";
      default:
        return undefined;
    }
  };

  const customerInfoItems = [
    { term: "Email", description: customer.email || "\u2014" },
    { term: "Phone", description: customer.phone || "\u2014" },
    { term: "Shopify ID", description: customer.shopifyCustomerId || "\u2014" },
    {
      term: "Member Since",
      description: customer.createdAt
        ? new Date(customer.createdAt).toLocaleDateString()
        : "\u2014",
    },
  ];

  const orderRows = (customer.orders ?? []).map((order, index) => (
    <IndexTable.Row id={order.id} key={order.id} position={index}>
      <IndexTable.Cell>
        <Link to={`/orders/${order.id}`}>
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {order.shopifyOrderNumber || order.id}
          </Text>
        </Link>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm">
          {order.createdAt
            ? new Date(order.createdAt).toLocaleDateString()
            : "\u2014"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={getOrderStatusTone(order.status)}>{order.status}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm">{order.itemsCount}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" fontWeight="semibold">
          ${order.totalAmount.toFixed(2)}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      backAction={{ content: "Customers", url: "/customers" }}
      title={`${customer.firstName} ${customer.lastName}`}
      primaryAction={
        customer.shopifyCustomerId
          ? {
              content: "View in Shopify",
              url: `https://admin.shopify.com/store/witylogix/customers/${customer.shopifyCustomerId}`,
              external: true,
            }
          : undefined
      }
    >
      <Layout>
        {/* Customer Information */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Customer Information
              </Text>
              <DescriptionList items={customerInfoItems} />
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Statistics */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 2, sm: 3, md: 5 }} gap="400">
            <Card>
              <BlockStack gap="100" inlineAlign="center">
                <Text as="p" variant="headingLg" fontWeight="bold" alignment="center">
                  {customer.ordersCount}
                </Text>
                <Text as="span" variant="bodySm" tone="subdued" alignment="center">
                  Total Orders
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="100" inlineAlign="center">
                <Text as="p" variant="headingLg" fontWeight="bold" alignment="center">
                  ${customer.totalSpent.toFixed(2)}
                </Text>
                <Text as="span" variant="bodySm" tone="subdued" alignment="center">
                  Total Spent
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="100" inlineAlign="center">
                <Text as="p" variant="headingLg" fontWeight="bold" alignment="center">
                  ${averageOrderValue.toFixed(2)}
                </Text>
                <Text as="span" variant="bodySm" tone="subdued" alignment="center">
                  Average Order Value
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="100" inlineAlign="center">
                <Text as="p" variant="headingLg" fontWeight="bold" alignment="center">
                  {customer.firstOrderDate
                    ? new Date(customer.firstOrderDate).toLocaleDateString()
                    : "\u2014"}
                </Text>
                <Text as="span" variant="bodySm" tone="subdued" alignment="center">
                  First Order
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="100" inlineAlign="center">
                <Text as="p" variant="headingLg" fontWeight="bold" alignment="center">
                  {customer.lastOrderDate
                    ? new Date(customer.lastOrderDate).toLocaleDateString()
                    : "\u2014"}
                </Text>
                <Text as="span" variant="bodySm" tone="subdued" alignment="center">
                  Last Order
                </Text>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>

        {/* Addresses */}
        {customer.addresses && customer.addresses.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Addresses
                </Text>
                <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
                  {customer.addresses.map((address) => (
                    <Card key={address.id}>
                      <BlockStack gap="200">
                        {address.isDefault && (
                          <Badge tone="info">Default</Badge>
                        )}
                        <Text as="p" variant="bodyMd">
                          {address.firstName} {address.lastName}
                        </Text>
                        <Text as="p" variant="bodySm">
                          {address.addressLine1}
                        </Text>
                        {address.addressLine2 && (
                          <Text as="p" variant="bodySm">
                            {address.addressLine2}
                          </Text>
                        )}
                        <Text as="p" variant="bodySm">
                          {address.city}, {address.state} {address.postalCode}
                        </Text>
                        <Text as="p" variant="bodySm">
                          {address.country}
                        </Text>
                      </BlockStack>
                    </Card>
                  ))}
                </InlineGrid>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Order History */}
        {customer.orders && customer.orders.length > 0 && (
          <Layout.Section>
            <Card padding="0">
              <Box padding="400" paddingBlockEnd="0">
                <Text as="h2" variant="headingMd">
                  Order History
                </Text>
              </Box>
              <IndexTable
                resourceName={{ singular: "order", plural: "orders" }}
                itemCount={customer.orders.length}
                headings={[
                  { title: "Order Number" },
                  { title: "Date" },
                  { title: "Status" },
                  { title: "Items" },
                  { title: "Total" },
                ]}
                selectable={false}
              >
                {orderRows}
              </IndexTable>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
