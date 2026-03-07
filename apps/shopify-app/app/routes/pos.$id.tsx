/**
 * POS Order Detail Page
 *
 * Features:
 *   - Back button to POS list
 *   - Order info card: customer name, phone, order number, delivery type
 *   - Items card: Table of line items with name, qty, price, total
 *   - Delivery info card: address (if delivery), scheduled time, notes
 *   - Status timeline showing order progression
 *   - Action buttons based on status: Confirm, Mark Ready, Mark Picked Up, Mark Delivered, Cancel
 *
 * All data is mock (no real API calls)
 */

import { useState } from "react";
import { useParams } from "react-router";
import {
  Page,
  Card,
  Button,
  Badge,
  BlockStack,
  InlineStack,
  Text,
  Frame,
  Modal,
  TextField,
  Banner,
  Toast, Link as PolarisLink, } from "@shopify/polaris";
import { Link } from "react-router";

// ─── Types ─────────────────────────────────────────────────

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
}

interface DeliveryInfo {
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  scheduledTime?: string;
  notes?: string;
  driverName?: string;
  driverId?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

interface OrderStatus {
  status: "PENDING" | "CONFIRMED" | "READY" | "PICKED_UP" | "DELIVERED";
  timestamp: string;
  message?: string;
}

interface POSOrderDetail {
  id: string;
  orderNumber: string;
  type: "LOCAL_DELIVERY" | "IN_STORE_PICKUP" | "CURBSIDE";
  customer: {
    name: string;
    phone: string;
    email: string;
  };
  items: OrderItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  status: "PENDING" | "CONFIRMED" | "READY" | "PICKED_UP" | "DELIVERED";
  createdAt: string;
  deliveryInfo?: DeliveryInfo;
  timeline: OrderStatus[];
}

// ─── Mock Data ─────────────────────────────────────────────

const MOCK_ORDERS: Record<string, POSOrderDetail> = {
  "order-001": {
    id: "order-001",
    orderNumber: "POS-001",
    type: "LOCAL_DELIVERY",
    customer: {
      name: "John Smith",
      phone: "(555) 123-4567",
      email: "john.smith@email.com",
    },
    items: [
      { id: "item-1", name: "Burger Deluxe", quantity: 1, price: 12.99, total: 12.99 },
      { id: "item-2", name: "Fries (Large)", quantity: 2, price: 5.99, total: 11.98 },
      { id: "item-3", name: "Soft Drink", quantity: 1, price: 3.50, total: 3.50 },
    ],
    subtotal: 28.47,
    tax: 2.14,
    deliveryFee: 5.00,
    total: 35.61,
    status: "DELIVERED",
    createdAt: "2026-03-07T10:30:00Z",
    deliveryInfo: {
      address: {
        street: "123 Main Street, Apt 4B",
        city: "New York",
        state: "NY",
        zipCode: "10001",
        country: "USA",
      },
      scheduledTime: "2026-03-07T11:30:00Z",
      notes: "Leave at front desk",
      driverName: "Mike Johnson",
      driverId: "driver-001",
      coordinates: { lat: 40.7128, lng: -74.006 },
    },
    timeline: [
      {
        status: "PENDING",
        timestamp: "2026-03-07T10:30:00Z",
        message: "Order received",
      },
      {
        status: "CONFIRMED",
        timestamp: "2026-03-07T10:35:00Z",
        message: "Order confirmed",
      },
      {
        status: "READY",
        timestamp: "2026-03-07T11:00:00Z",
        message: "Ready for pickup",
      },
      {
        status: "PICKED_UP",
        timestamp: "2026-03-07T11:05:00Z",
        message: "Driver picked up order",
      },
      {
        status: "DELIVERED",
        timestamp: "2026-03-07T11:45:00Z",
        message: "Delivered to customer",
      },
    ],
  },
  "order-002": {
    id: "order-002",
    orderNumber: "POS-002",
    type: "IN_STORE_PICKUP",
    customer: {
      name: "Sarah Johnson",
      phone: "(555) 234-5678",
      email: "sarah.j@email.com",
    },
    items: [
      { id: "item-1", name: "Pizza (Large)", quantity: 1, price: 18.99, total: 18.99 },
      { id: "item-2", name: "Caesar Salad", quantity: 1, price: 9.99, total: 9.99 },
    ],
    subtotal: 28.98,
    tax: 2.32,
    deliveryFee: 0,
    total: 31.30,
    status: "READY",
    createdAt: "2026-03-07T09:45:00Z",
    timeline: [
      {
        status: "PENDING",
        timestamp: "2026-03-07T09:45:00Z",
        message: "Order received",
      },
      {
        status: "CONFIRMED",
        timestamp: "2026-03-07T09:50:00Z",
        message: "Order confirmed",
      },
      {
        status: "READY",
        timestamp: "2026-03-07T10:15:00Z",
        message: "Ready for pickup",
      },
    ],
  },
  "order-003": {
    id: "order-003",
    orderNumber: "POS-003",
    type: "CURBSIDE",
    customer: {
      name: "Michael Brown",
      phone: "(555) 345-6789",
      email: "mbrown@email.com",
    },
    items: [
      { id: "item-1", name: "Coffee (Espresso)", quantity: 3, price: 4.50, total: 13.50 },
      { id: "item-2", name: "Croissant", quantity: 2, price: 3.99, total: 7.98 },
      { id: "item-3", name: "Muffin (Blueberry)", quantity: 3, price: 2.99, total: 8.97 },
    ],
    subtotal: 30.45,
    tax: 2.44,
    deliveryFee: 0,
    total: 32.89,
    status: "PICKED_UP",
    createdAt: "2026-03-07T08:15:00Z",
    timeline: [
      {
        status: "PENDING",
        timestamp: "2026-03-07T08:15:00Z",
        message: "Order received",
      },
      {
        status: "CONFIRMED",
        timestamp: "2026-03-07T08:20:00Z",
        message: "Order confirmed",
      },
      {
        status: "READY",
        timestamp: "2026-03-07T08:35:00Z",
        message: "Ready for curbside pickup",
      },
      {
        status: "PICKED_UP",
        timestamp: "2026-03-07T08:50:00Z",
        message: "Customer picked up order",
      },
    ],
  },
  "order-004": {
    id: "order-004",
    orderNumber: "POS-004",
    type: "LOCAL_DELIVERY",
    customer: {
      name: "Emily Davis",
      phone: "(555) 456-7890",
      email: "emily.davis@email.com",
    },
    items: [
      { id: "item-1", name: "Sandwich (Turkey)", quantity: 1, price: 9.99, total: 9.99 },
    ],
    subtotal: 9.99,
    tax: 0.80,
    deliveryFee: 5.00,
    total: 15.79,
    status: "PENDING",
    createdAt: "2026-03-07T14:20:00Z",
    deliveryInfo: {
      address: {
        street: "456 Oak Avenue",
        city: "Brooklyn",
        state: "NY",
        zipCode: "11201",
        country: "USA",
      },
      scheduledTime: "2026-03-07T15:30:00Z",
      notes: "Ring doorbell twice",
    },
    timeline: [
      {
        status: "PENDING",
        timestamp: "2026-03-07T14:20:00Z",
        message: "Order received",
      },
    ],
  },
};

// ─── Component ─────────────────────────────────────────────

export default function POSOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<POSOrderDetail | null>(
    (id && MOCK_ORDERS[id]) || null
  );
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionNotes, setActionNotes] = useState("");
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!order) {
    return (
      <Frame>
        <Page title="Order Not Found">
          <Card>
            <BlockStack gap="400">
              <Text as="span">The order you're looking for does not exist.</Text>
              <Link to="/pos">
                <Button>Back to POS Orders</Button>
              </Link>
            </BlockStack>
          </Card>
        </Page>
      </Frame>
    );
  }

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastActive(true);
  };

  const handleStatusAction = async (newStatus: POSOrderDetail["status"]) => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 800));

    setOrder((prev) => {
      if (!prev) return prev;
      const newTimeline: OrderStatus[] = [
        ...prev.timeline,
        {
          status: newStatus,
          timestamp: new Date().toISOString(),
          message: actionNotes || getStatusMessage(newStatus),
        },
      ];
      return { ...prev, status: newStatus, timeline: newTimeline };
    });

    showToast(`Order marked as ${newStatus}!`);
    setIsLoading(false);
    setIsActionModalOpen(false);
    setActionNotes("");
  };

  const getStatusMessage = (status: string): string => {
    const messages: Record<string, string> = {
      CONFIRMED: "Order confirmed",
      READY: "Order ready for pickup",
      PICKED_UP: "Customer picked up order",
      DELIVERED: "Order delivered",
    };
    return messages[status] || "";
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

  const getTypeLabel = (
    type: "LOCAL_DELIVERY" | "IN_STORE_PICKUP" | "CURBSIDE"
  ) => {
    switch (type) {
      case "LOCAL_DELIVERY":
        return "Local Delivery";
      case "IN_STORE_PICKUP":
        return "In-Store Pickup";
      case "CURBSIDE":
        return "Curbside Pickup";
      default:
        return type;
    }
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

  const getAvailableActions = (): Array<{
    label: string;
    status: POSOrderDetail["status"];
  }> => {
    const actions: Array<{ label: string; status: POSOrderDetail["status"] }> = [];
    switch (order.status) {
      case "PENDING":
        actions.push({ label: "Confirm Order", status: "CONFIRMED" });
        actions.push({ label: "Cancel Order", status: "PENDING" });
        break;
      case "CONFIRMED":
        actions.push({ label: "Mark Ready", status: "READY" });
        break;
      case "READY":
        if (order.type === "LOCAL_DELIVERY") {
          actions.push({ label: "Mark Picked Up", status: "PICKED_UP" });
        } else {
          actions.push({ label: "Mark Picked Up", status: "PICKED_UP" });
        }
        break;
      case "PICKED_UP":
        if (order.type === "LOCAL_DELIVERY") {
          actions.push({ label: "Mark Delivered", status: "DELIVERED" });
        }
        break;
      default:
        break;
    }
    return actions;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTimeOnly = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      
    });
  };

  const availableActions = getAvailableActions();

  return (
    <Frame>
      <Page
        title={`Order ${order.orderNumber}`}
        backAction={{ content: "Orders", url: "/pos" }}
      >
        <BlockStack gap="400">
          {/* Order Header */}
          <InlineStack align="space-between">
            <BlockStack gap="100">
              <InlineStack gap="200" align="start">
                <Text as="h2" variant="bodyMd" fontWeight="bold">
                  {order.customer.name}
                </Text>
                <Badge tone={getStatusTone(order.status)}>
                  {order.status}
                </Badge>
                <Badge tone={getTypeColor(order.type)}>
                  {getTypeLabel(order.type)}
                </Badge>
              </InlineStack>
              <Text as="span" variant="bodySm" tone="subdued">
                Created {formatDate(order.createdAt)}
              </Text>
            </BlockStack>
            {availableActions.length > 0 && (
              <Button
                onClick={() => setIsActionModalOpen(true)}
                variant="primary"
              >
                Update Status
              </Button>
            )}
          </InlineStack>

          {/* Order Info Card */}
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="bodyMd" fontWeight="bold">
                Order Information
              </Text>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "16px",
                }}
              >
                <div>
                  <Text as="span" variant="bodySm" tone="subdued">
                    Order Number
                  </Text>
                  <Text as="p" variant="bodySm">
                    {order.orderNumber}
                  </Text>
                </div>
                <div>
                  <Text as="span" variant="bodySm" tone="subdued">
                    Customer Email
                  </Text>
                  <Text as="p" variant="bodySm">
                    {order.customer.email}
                  </Text>
                </div>
                <div>
                  <Text as="span" variant="bodySm" tone="subdued">
                    Customer Phone
                  </Text>
                  <Text as="p" variant="bodySm">
                    {order.customer.phone}
                  </Text>
                </div>
                <div>
                  <Text as="span" variant="bodySm" tone="subdued">
                    Order Type
                  </Text>
                  <Text as="p" variant="bodySm">
                    {getTypeLabel(order.type)}
                  </Text>
                </div>
              </div>
            </BlockStack>
          </Card>

          {/* Items Card */}
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="bodyMd" fontWeight="bold">
                Items
              </Text>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid var(--p-color-border)" }}>Item</th>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid var(--p-color-border)" }}>Quantity</th>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid var(--p-color-border)" }}>Price</th>
                  <th style={{ textAlign: "left", padding: "8px", borderBottom: "1px solid var(--p-color-border)" }}>Total</th>
                </tr>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ padding: "8px", borderBottom: "1px solid var(--p-color-border)" }}>{item.name}</td>
                    <td style={{ padding: "8px", borderBottom: "1px solid var(--p-color-border)" }}>{item.quantity}</td>
                    <td style={{ padding: "8px", borderBottom: "1px solid var(--p-color-border)" }}>${item.price.toFixed(2)}</td>
                    <td style={{ padding: "8px", borderBottom: "1px solid var(--p-color-border)" }}>${item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </table>

              <div
                style={{
                  borderTop: "1px solid var(--p-color-border)",
                  paddingTop: "12px",
                  marginTop: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <Text as="span" variant="bodySm">Subtotal:</Text>
                  <Text as="span" variant="bodySm">${order.subtotal.toFixed(2)}</Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <Text as="span" variant="bodySm">Tax:</Text>
                  <Text as="span" variant="bodySm">${order.tax.toFixed(2)}</Text>
                </div>
                {order.deliveryFee > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <Text as="span" variant="bodySm">Delivery Fee:</Text>
                    <Text as="span" variant="bodySm">${order.deliveryFee.toFixed(2)}</Text>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: "bold",
                    fontSize: "14px",
                  }}
                >
                  <span>Total:</span>
                  <span>${order.total.toFixed(2)}</span>
                </div>
              </div>
            </BlockStack>
          </Card>

          {/* Delivery Info Card */}
          {order.deliveryInfo && (
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="bodyMd" fontWeight="bold">
                  Delivery Information
                </Text>
                <BlockStack gap="200">
                  <div>
                    <Text as="span" variant="bodySm" tone="subdued">
                      Delivery Address
                    </Text>
                    <Text as="p" variant="bodySm">
                      {order.deliveryInfo.address.street}
                      <br />
                      {order.deliveryInfo.address.city},{" "}
                      {order.deliveryInfo.address.state}{" "}
                      {order.deliveryInfo.address.zipCode}
                    </Text>
                  </div>
                  {order.deliveryInfo.scheduledTime && (
                    <div>
                      <Text as="span" variant="bodySm" tone="subdued">
                        Scheduled Delivery Time
                      </Text>
                      <Text as="p" variant="bodySm">
                        {formatDate(order.deliveryInfo.scheduledTime)}
                      </Text>
                    </div>
                  )}
                  {order.deliveryInfo.notes && (
                    <div>
                      <Text as="span" variant="bodySm" tone="subdued">
                        Delivery Notes
                      </Text>
                      <Text as="p" variant="bodySm">
                        {order.deliveryInfo.notes}
                      </Text>
                    </div>
                  )}
                  {order.deliveryInfo.driverName && (
                    <div>
                      <Text as="span" variant="bodySm" tone="subdued">
                        Assigned Driver
                      </Text>
                      <Text as="p" variant="bodySm">
                        {order.deliveryInfo.driverName}
                      </Text>
                    </div>
                  )}
                </BlockStack>
              </BlockStack>
            </Card>
          )}

          {/* Status Timeline */}
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="bodyMd" fontWeight="bold">
                Order Timeline
              </Text>
              <div style={{ paddingLeft: "12px", borderLeft: "2px solid var(--p-color-border)" }}>
                <BlockStack gap="300">
                  {order.timeline.map((event, index) => (
                    <div key={index}>
                      <InlineStack gap="200" align="start">
                        <div
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            backgroundColor: "var(--p-color-bg-fill-success, #22c55e)",
                            marginTop: "6px",
                            marginLeft: "-15px",
                          }}
                        />
                        <BlockStack gap="050">
                          <Text as="span" variant="bodySm" fontWeight="bold">
                            {event.status}
                          </Text>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {formatDate(event.timestamp)}
                          </Text>
                          {event.message && (
                            <Text as="span" variant="bodySm">{event.message}</Text>
                          )}
                        </BlockStack>
                      </InlineStack>
                    </div>
                  ))}
                </BlockStack>
              </div>
            </BlockStack>
          </Card>
        </BlockStack>
      </Page>

      {/* Status Update Modal */}
      <Modal
        open={isActionModalOpen}
        onClose={() => {
          setIsActionModalOpen(false);
          setActionNotes("");
        }}
        title="Update Order Status"
        primaryAction={{
          content: `Update to ${
            availableActions[0]?.label || "Update"
          }`,
          onAction: () => handleStatusAction(availableActions[0]?.status || "CONFIRMED"),
          loading: isLoading,
          disabled: availableActions.length === 0,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => {
              setIsActionModalOpen(false);
              setActionNotes("");
            },
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {availableActions.length > 0 && (
              <>
                <Text as="span" variant="bodySm" tone="subdued">
                  Available actions:
                </Text>
                <InlineStack gap="200" wrap>
                  {availableActions.map((action) => (
                    <Button
                      key={action.status}
                      onClick={() => handleStatusAction(action.status)}
                      loading={isLoading}
                      variant="secondary"
                    >
                      {action.label}
                    </Button>
                  ))}
                </InlineStack>
              </>
            )}
            <TextField
              label="Optional Notes"
              value={actionNotes}
              onChange={(value) => setActionNotes(value)}
              placeholder="Add a note for this status change"
              multiline={3}
              autoComplete="off"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      {toastActive && (
        <Toast
          content={toastMessage}
          onDismiss={() => setToastActive(false)}
        />
      )}
    </Frame>
  );
}
