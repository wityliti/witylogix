// @ts-nocheck
/**
 * Point of Sale (POS) Management Page
 *
 * Features:
 *   - Tabbed layout: Orders | Terminals | Custom Forms
 *   - Orders tab:
 *     - IndexTable with columns: ID, Customer, Type, Items, Total, Status, Date, Actions
 *     - 10 mock POS orders with mix of LOCAL_DELIVERY, IN_STORE_PICKUP, CURBSIDE
 *     - Status badges: PENDING=attention, CONFIRMED=info, READY=success, PICKED_UP=magic, DELIVERED=success
 *     - Bulk actions: Mark Ready, Mark Delivered
 *   - Terminals tab:
 *     - Card-based layout of 3 mock terminals (2 Shopify POS, 1 Square)
 *     - Shows terminal ID, provider, last sync, status
 *     - Add Terminal button
 *   - Custom Forms tab:
 *     - Card for each of 2 mock forms (Delivery Checkout, Curbside Pickup)
 *     - Shows field count, last modified, default badge
 *     - Edit/Delete actions
 *
 * All data is mock (no real API calls)
 */

import { useState } from "react";
import {
  Page,
  Card,
  Button,
  Badge,
  Tabs, IndexTable,
  BlockStack,
  InlineStack,
  Text,
  Frame,
  Modal,
  TextField,
  Banner,
  Toast,
  Select,
  Checkbox, } from "@shopify/polaris";
import { Link } from "react-router";

// ─── Types ─────────────────────────────────────────────────

interface POSOrder {
  id: string;
  orderNumber: string;
  customer: {
    name: string;
    phone: string;
  };
  type: "LOCAL_DELIVERY" | "IN_STORE_PICKUP" | "CURBSIDE";
  itemsCount: number;
  total: number;
  status: "PENDING" | "CONFIRMED" | "READY" | "PICKED_UP" | "DELIVERED";
  createdAt: string;
}

interface Terminal {
  id: string;
  terminalId: string;
  provider: "SHOPIFY_POS" | "SQUARE";
  location: string;
  lastSync: string;
  status: "ACTIVE" | "INACTIVE" | "ERROR";
}

interface CustomForm {
  id: string;
  name: string;
  fieldCount: number;
  lastModified: string;
  isDefault: boolean;
}

// ─── Mock Data ─────────────────────────────────────────────

const MOCK_ORDERS: POSOrder[] = [
  {
    id: "order-001",
    orderNumber: "POS-001",
    customer: { name: "John Smith", phone: "(555) 123-4567" },
    type: "LOCAL_DELIVERY",
    itemsCount: 3,
    total: 156.99,
    status: "DELIVERED",
    createdAt: "2026-03-07T10:30:00Z",
  },
  {
    id: "order-002",
    orderNumber: "POS-002",
    customer: { name: "Sarah Johnson", phone: "(555) 234-5678" },
    type: "IN_STORE_PICKUP",
    itemsCount: 2,
    total: 89.50,
    status: "READY",
    createdAt: "2026-03-07T09:45:00Z",
  },
  {
    id: "order-003",
    orderNumber: "POS-003",
    customer: { name: "Michael Brown", phone: "(555) 345-6789" },
    type: "CURBSIDE",
    itemsCount: 5,
    total: 234.75,
    status: "PICKED_UP",
    createdAt: "2026-03-07T08:15:00Z",
  },
  {
    id: "order-004",
    orderNumber: "POS-004",
    customer: { name: "Emily Davis", phone: "(555) 456-7890" },
    type: "LOCAL_DELIVERY",
    itemsCount: 1,
    total: 45.00,
    status: "PENDING",
    createdAt: "2026-03-07T14:20:00Z",
  },
  {
    id: "order-005",
    orderNumber: "POS-005",
    customer: { name: "David Wilson", phone: "(555) 567-8901" },
    type: "IN_STORE_PICKUP",
    itemsCount: 4,
    total: 167.25,
    status: "CONFIRMED",
    createdAt: "2026-03-06T16:30:00Z",
  },
  {
    id: "order-006",
    orderNumber: "POS-006",
    customer: { name: "Jessica Martinez", phone: "(555) 678-9012" },
    type: "CURBSIDE",
    itemsCount: 2,
    total: 78.99,
    status: "READY",
    createdAt: "2026-03-06T13:00:00Z",
  },
  {
    id: "order-007",
    orderNumber: "POS-007",
    customer: { name: "Robert Taylor", phone: "(555) 789-0123" },
    type: "LOCAL_DELIVERY",
    itemsCount: 3,
    total: 124.50,
    status: "DELIVERED",
    createdAt: "2026-03-06T11:45:00Z",
  },
  {
    id: "order-008",
    orderNumber: "POS-008",
    customer: { name: "Amanda Anderson", phone: "(555) 890-1234" },
    type: "IN_STORE_PICKUP",
    itemsCount: 6,
    total: 298.75,
    status: "PENDING",
    createdAt: "2026-03-07T15:10:00Z",
  },
  {
    id: "order-009",
    orderNumber: "POS-009",
    customer: { name: "James Thomas", phone: "(555) 901-2345" },
    type: "CURBSIDE",
    itemsCount: 2,
    total: 95.25,
    status: "CONFIRMED",
    createdAt: "2026-03-07T12:30:00Z",
  },
  {
    id: "order-010",
    orderNumber: "POS-010",
    customer: { name: "Lisa White", phone: "(555) 012-3456" },
    type: "LOCAL_DELIVERY",
    itemsCount: 4,
    total: 189.99,
    status: "READY",
    createdAt: "2026-03-05T10:00:00Z",
  },
];

const MOCK_TERMINALS: Terminal[] = [
  {
    id: "terminal-001",
    terminalId: "TERM-SP-001",
    provider: "SHOPIFY_POS",
    location: "Main Store",
    lastSync: "2026-03-07T14:30:00Z",
    status: "ACTIVE",
  },
  {
    id: "terminal-002",
    terminalId: "TERM-SP-002",
    provider: "SHOPIFY_POS",
    location: "Downtown Store",
    lastSync: "2026-03-07T14:28:00Z",
    status: "ACTIVE",
  },
  {
    id: "terminal-003",
    terminalId: "TERM-SQ-001",
    provider: "SQUARE",
    location: "Pop-up Store",
    lastSync: "2026-03-07T12:15:00Z",
    status: "INACTIVE",
  },
];

const MOCK_FORMS: CustomForm[] = [
  {
    id: "form-001",
    name: "Delivery Checkout",
    fieldCount: 7,
    lastModified: "2026-03-05T10:30:00Z",
    isDefault: true,
  },
  {
    id: "form-002",
    name: "Curbside Pickup",
    fieldCount: 5,
    lastModified: "2026-03-04T14:15:00Z",
    isDefault: false,
  },
];

// ─── Component ─────────────────────────────────────────────

export default function POSIndex() {
  const [activeTab, setActiveTab] = useState(0);
  const [orders, setOrders] = useState<POSOrder[]>(MOCK_ORDERS);
  const [terminals, setTerminals] = useState<Terminal[]>(MOCK_TERMINALS);
  const [forms, setForms] = useState<CustomForm[]>(MOCK_FORMS);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [isTerminalModalOpen, setIsTerminalModalOpen] = useState(false);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastError, setToastError] = useState(false);

  const showToast = (message: string, isError = false) => {
    setToastMessage(message);
    setToastError(isError);
    setToastActive(true);
  };

  const handleOrderStatusChange = (orderId: string, newStatus: POSOrder["status"]) => {
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId ? { ...order, status: newStatus } : order
      )
    );
  };

  const handleMarkReady = () => {
    selectedOrders.forEach((orderId) => {
      handleOrderStatusChange(orderId, "READY");
    });
    showToast(`${selectedOrders.length} order(s) marked as ready!`);
    setSelectedOrders([]);
  };

  const handleMarkDelivered = () => {
    selectedOrders.forEach((orderId) => {
      handleOrderStatusChange(orderId, "DELIVERED");
    });
    showToast(`${selectedOrders.length} order(s) marked as delivered!`);
    setSelectedOrders([]);
  };

  const getTypeColor = (
    type: "LOCAL_DELIVERY" | "IN_STORE_PICKUP" | "CURBSIDE"
  ) => {
    switch (type) {
      case "LOCAL_DELIVERY":
        return "info";
      case "IN_STORE_PICKUP":
        return "enabled";
      case "CURBSIDE":
        return "warning";
      default:
        return "read-only";
    }
  };

  const getTypeLabel = (
    type: "LOCAL_DELIVERY" | "IN_STORE_PICKUP" | "CURBSIDE"
  ) => {
    switch (type) {
      case "LOCAL_DELIVERY":
        return "Delivery";
      case "IN_STORE_PICKUP":
        return "Pickup";
      case "CURBSIDE":
        return "Curbside";
      default:
        return type;
    }
  };

  const getStatusTone = (
    status: "PENDING" | "CONFIRMED" | "READY" | "PICKED_UP" | "DELIVERED"
  ) => {
    switch (status) {
      case "PENDING":
        return "attention";
      case "CONFIRMED":
        return "info";
      case "READY":
        return "success";
      case "PICKED_UP":
        return "magic";
      case "DELIVERED":
        return "success";
      default:
        return "read-only";
    }
  };

  const getTerminalStatusColor = (status: "ACTIVE" | "INACTIVE" | "ERROR") => {
    switch (status) {
      case "ACTIVE":
        return "var(--p-color-bg-fill-success, #22c55e)";
      case "INACTIVE":
        return "var(--p-color-bg-fill-warning, #f59e0b)";
      case "ERROR":
        return "var(--p-color-bg-fill-critical, #ef4444)";
      default:
        return "#8c9196";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateOnly = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // ─── Orders Tab ─────────────────────────────────────────

  const ordersRows = orders.map((order, index) => (
    <IndexTable.Row
      id={order.id}
      key={order.id}
      position={index}
      selected={selectedOrders.includes(order.id)}
      onSelectionChange={(selected: boolean) => {
        setSelectedOrders((prev) =>
          selected
            ? [...prev, order.id]
            : prev.filter((id) => id !== order.id)
        );
      }}
    >
        <IndexTable.Cell>{order.orderNumber}</IndexTable.Cell>
        <IndexTable.Cell>{order.customer.name}</IndexTable.Cell>
        <IndexTable.Cell>
        <Badge tone={getTypeColor(order.type)}>
          {getTypeLabel(order.type)}
        </Badge>
      </IndexTable.Cell>
        <IndexTable.Cell>{order.itemsCount}</IndexTable.Cell>
        <IndexTable.Cell>${order.total.toFixed(2)}</IndexTable.Cell>
        <IndexTable.Cell>
        <Badge tone={getStatusTone(order.status)}>
          {order.status}
        </Badge>
      </IndexTable.Cell>
        <IndexTable.Cell>{formatDate(order.createdAt)}</IndexTable.Cell>
        <IndexTable.Cell>
        <Link to={`/pos/${order.id}`} style={{ textDecoration: "none" }}>
          <Button variant="plain">View</Button>
        </Link>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  const ordersContent = (
    <BlockStack gap="400">
      {selectedOrders.length > 0 && (
        <InlineStack gap="200">
          <Button onClick={handleMarkReady} variant="secondary">
            Mark Ready ({selectedOrders.length})
          </Button>
          <Button onClick={handleMarkDelivered} variant="secondary">
            Mark Delivered ({selectedOrders.length})
          </Button>
        </InlineStack>
      )}
      <Card>        <IndexTable
          resourceName={{ singular: "order", plural: "orders" }}
          itemCount={orders.length}
          selectedItemsCount={selectedOrders.length === orders.length ? "All" : selectedOrders.length}
          onSelectAll={() =>
            setSelectedOrders(selectedOrders.length === orders.length ? [] : orders.map((o) => o.id))
          }
          headings={[
            { title: "Order ID" },
            { title: "Customer" },
            { title: "Type" },
            { title: "Items" },
            { title: "Total" },
            { title: "Status" },
            { title: "Date" },
            { title: "Actions" },
          ]}
        >
          {ordersRows}
        </IndexTable>
      </Card>
    </BlockStack>
  );

  // ─── Terminals Tab ─────────────────────────────────────

  const terminalsContent = (
    <BlockStack gap="400">
      <Button onClick={() => setIsTerminalModalOpen(true)} variant="primary">
        Add Terminal
      </Button>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "16px",
        }}
      >
        {terminals.map((terminal) => (
          <Card key={terminal.id}>
            <BlockStack gap="300">
              <InlineStack align="space-between">
                <Text as="h3" variant="bodyMd" fontWeight="bold">
                  {terminal.location}
                </Text>
                <Badge
                  tone={
                    terminal.status === "ACTIVE"
                      ? "success"
                      : terminal.status === "INACTIVE"
                        ? "attention"
                        : "critical"
                  }
                >
                  {terminal.status}
                </Badge>
              </InlineStack>

              <BlockStack gap="200">
                <div>
                  <Text as="span" variant="bodySm" tone="subdued">
                    Terminal ID
                  </Text>
                  <Text as="p" variant="bodySm">
                    {terminal.terminalId}
                  </Text>
                </div>
                <div>
                  <Text as="span" variant="bodySm" tone="subdued">
                    Provider
                  </Text>
                  <Text as="p" variant="bodySm">
                    {terminal.provider === "SHOPIFY_POS"
                      ? "Shopify POS"
                      : "Square"}
                  </Text>
                </div>
                <div>
                  <Text as="span" variant="bodySm" tone="subdued">
                    Last Sync
                  </Text>
                  <Text as="p" variant="bodySm">
                    {formatDate(terminal.lastSync)}
                  </Text>
                </div>
              </BlockStack>

              <InlineStack gap="200">
                <Button variant="secondary" size="slim">
                  Configure
                </Button>
                <Button variant="secondary" size="slim" tone="critical">
                  Remove
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        ))}
      </div>
    </BlockStack>
  );

  // ─── Custom Forms Tab ────────────────────────────────────

  const formsContent = (
    <BlockStack gap="400">
      <Button variant="primary">Create Form</Button>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "16px",
        }}
      >
        {forms.map((form) => (
          <Card key={form.id}>
            <BlockStack gap="300">
              <InlineStack align="space-between">
                <Text as="h3" variant="bodyMd" fontWeight="bold">
                  {form.name}
                </Text>
                {form.isDefault && (
                  <Badge tone="new">Default</Badge>
                )}
              </InlineStack>

              <BlockStack gap="200">
                <div>
                  <Text as="span" variant="bodySm" tone="subdued">
                    Fields
                  </Text>
                  <Text as="p" variant="bodySm">
                    {form.fieldCount} fields
                  </Text>
                </div>
                <div>
                  <Text as="span" variant="bodySm" tone="subdued">
                    Last Modified
                  </Text>
                  <Text as="p" variant="bodySm">
                    {formatDateOnly(form.lastModified)}
                  </Text>
                </div>
              </BlockStack>

              <InlineStack gap="200">
                <Button variant="secondary" size="slim">
                  Edit
                </Button>
                <Button variant="secondary" size="slim" tone="critical">
                  Delete
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        ))}
      </div>
    </BlockStack>
  );

  const tabs = [
    {
      id: "orders",
      content: "Orders",
      accessibilityLabel: "POS Orders",
      panelID: "orders-panel",
    },
    {
      id: "terminals",
      content: "Terminals",
      accessibilityLabel: "POS Terminals",
      panelID: "terminals-panel",
    },
    {
      id: "forms",
      content: "Custom Forms",
      accessibilityLabel: "Custom Forms",
      panelID: "forms-panel",
    },
  ];

  return (
    <Frame>
      <Page title="Point of Sale">
        <BlockStack gap="400">
          <Tabs tabs={tabs} selected={activeTab} onSelect={setActiveTab} />
          {activeTab === 0 && ordersContent}
          {activeTab === 1 && terminalsContent}
          {activeTab === 2 && formsContent}
        </BlockStack>
      </Page>

      <Modal
        open={isTerminalModalOpen}
        onClose={() => setIsTerminalModalOpen(false)}
        title="Add New Terminal"
        primaryAction={{
          content: "Add Terminal",
          onAction: () => {
            showToast("Terminal added successfully!");
            setIsTerminalModalOpen(false);
          },
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setIsTerminalModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Select
              label="Terminal Provider"
              options={[
                { label: "Shopify POS", value: "shopify_pos" },
                { label: "Square", value: "square" },
              ]}
              value="shopify_pos"
              onChange={() => {}}
            />
            <TextField autoComplete="off"
              label="Location Name"
              placeholder="e.g., Main Store"
              value=""
              onChange={() => {}}
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      {toastActive && (
        <Toast
          content={toastMessage}
          onDismiss={() => setToastActive(false)}
          error={toastError}
        />
      )}
    </Frame>
  );
}
