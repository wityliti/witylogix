import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { OrderCard } from "../order-card";
import type { Order, OrderStatus } from "@/types";

function createOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    orderNumber: "WL-2024-001",
    status: "pending",
    createdAt: new Date("2024-06-01"),
    scheduledDeliveryDate: new Date("2024-06-05"),
    items: [
      { id: "item-1", name: "Widget A", quantity: 1, price: 25.0 },
      { id: "item-2", name: "Widget B", quantity: 2, price: 15.5 },
    ],
    deliveryAddress: {
      street: "123 Main St",
      city: "Springfield",
      state: "IL",
      zipCode: "62701",
      country: "US",
    },
    totalPrice: 56.0,
    ...overrides,
  };
}

describe("OrderCard", () => {
  it("renders order number with mono class", () => {
    const order = createOrder({ orderNumber: "WL-2024-001" });
    render(<OrderCard order={order} />);

    const orderNumber = screen.getByText("WL-2024-001");
    expect(orderNumber).toBeInTheDocument();
    expect(orderNumber).toHaveClass("mono");
  });

  it("shows item count for multiple items", () => {
    const order = createOrder({
      items: [
        { id: "1", name: "A", quantity: 1, price: 10 },
        { id: "2", name: "B", quantity: 1, price: 20 },
        { id: "3", name: "C", quantity: 1, price: 30 },
      ],
    });
    render(<OrderCard order={order} />);
    expect(screen.getByText("3 items")).toBeInTheDocument();
  });

  it("shows singular item for single item", () => {
    const order = createOrder({
      items: [{ id: "1", name: "A", quantity: 1, price: 10 }],
    });
    render(<OrderCard order={order} />);
    expect(screen.getByText("1 item")).toBeInTheDocument();
  });

  it("shows total price with mono class", () => {
    const order = createOrder({ totalPrice: 123.45 });
    render(<OrderCard order={order} />);

    const price = screen.getByText("$123.45");
    expect(price).toBeInTheDocument();
    expect(price).toHaveClass("mono");
  });

  it("shows ETA when estimatedDelivery is present", () => {
    const order = createOrder({ estimatedDelivery: "2:30 PM" });
    render(<OrderCard order={order} />);
    expect(screen.getByText("ETA: 2:30 PM")).toBeInTheDocument();
  });

  it("does not show ETA when estimatedDelivery is absent", () => {
    const order = createOrder({ estimatedDelivery: undefined });
    render(<OrderCard order={order} />);
    expect(screen.queryByText(/ETA:/)).not.toBeInTheDocument();
  });

  it("links to order detail page", () => {
    const order = createOrder({ id: "abc-123" });
    render(<OrderCard order={order} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/orders/abc-123");
  });

  describe.each<[OrderStatus, string, string]>([
    ["pending", "Pending", "card-accent-pending"],
    ["confirmed", "Confirmed", "card-accent-confirmed"],
    ["out-for-delivery", "Out for Delivery", "card-accent-active"],
    ["delivered", "Delivered", "card-accent-delivered"],
    ["cancelled", "Cancelled", "card-accent-cancelled"],
  ])("status: %s", (status, label, accentClass) => {
    it(`shows "${label}" status badge`, () => {
      const order = createOrder({
        status,
        ...(status === "delivered"
          ? { actualDeliveryDate: new Date("2024-06-04") }
          : {}),
      });
      render(<OrderCard order={order} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });

    it(`has correct accent class ${accentClass}`, () => {
      const order = createOrder({
        status,
        ...(status === "delivered"
          ? { actualDeliveryDate: new Date("2024-06-04") }
          : {}),
      });
      const { container } = render(<OrderCard order={order} />);

      const card = container.querySelector(".card-accent");
      expect(card).toHaveClass(accentClass);
    });
  });

  it("shows actual delivery date for delivered orders", () => {
    const order = createOrder({
      status: "delivered",
      actualDeliveryDate: new Date("2024-06-04"),
    });
    render(<OrderCard order={order} />);
    expect(screen.getByText("Delivered Jun 4")).toBeInTheDocument();
  });

  it("shows scheduled delivery date for non-delivered orders", () => {
    const order = createOrder({
      status: "pending",
      scheduledDeliveryDate: new Date("2024-06-05"),
    });
    render(<OrderCard order={order} />);
    expect(screen.getByText("Delivery Jun 5")).toBeInTheDocument();
  });
});
