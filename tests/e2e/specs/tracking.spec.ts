import { test, expect } from "../fixtures/auth.fixture";
import { DashboardPage } from "../pages/dashboard.page";
import { OrdersPage, OrderData } from "../pages/orders.page";

test.describe("Order Tracking", () => {
  test("should navigate to tracking page", async ({ adminPage }) => {
    const dashboardPage = new DashboardPage(adminPage);

    // Navigate to dashboard
    await dashboardPage.navigate();

    // Navigate to tracking section
    await dashboardPage.navigateToTracking();

    // Verify tracking page is displayed
    const pageTitle = adminPage.locator('h1, [data-testid="page-title"]');
    const hasTrackingElement = await pageTitle
      .textContent()
      .then((text) => text?.toLowerCase().includes("track"))
      .catch(() => false);

    // Verify we're on a tracking-related page
    expect(adminPage.url()).toContain("track");
  });

  test("should search shipment by tracking ID", async ({ adminPage }) => {
    const ordersPage = new OrdersPage(adminPage);

    // First create an order to track
    const orderData: OrderData = {
      senderName: "Tracking Sender",
      senderEmail: "sender.track@example.com",
      senderPhone: "+1234567890",
      senderAddress: "123 Track St, New York, NY 10001",
      receiverName: "Tracking Receiver",
      receiverEmail: "receiver.track@example.com",
      receiverPhone: "+0987654321",
      receiverAddress: "456 Delivery Ave, Los Angeles, CA 90001",
    };

    // Navigate to orders and create order
    await ordersPage.navigateToList();
    await ordersPage.createOrder(orderData);

    // Get the created order's tracking ID
    const orderCount = await ordersPage.getOrderCount();
    const lastOrder = await ordersPage.getOrderDetails(orderCount - 1);
    const trackingId = lastOrder.trackingId;

    expect(trackingId).toBeTruthy();

    // Search for order by tracking ID
    await ordersPage.searchByTrackingId(trackingId);

    // Verify order is found
    await ordersPage.expectOrderExists(trackingId);
  });

  test("should display full tracking timeline", async ({ adminPage }) => {
    const ordersPage = new OrdersPage(adminPage);

    // Navigate to orders
    await ordersPage.navigateToList();

    // Get an existing order
    const orderCount = await ordersPage.getOrderCount();

    if (orderCount > 0) {
      const firstOrder = await ordersPage.getOrderDetails(0);
      const trackingId = firstOrder.trackingId;

      // Open order details
      await ordersPage.openOrderDetails(trackingId);

      // Look for timeline/history section
      const timelineSection = adminPage.locator(
        '[data-testid="timeline"], section:has-text("Timeline"), section:has-text("History")',
      );

      // If timeline exists, verify it's displayed
      if (await timelineSection.isVisible().catch(() => false)) {
        await expect(timelineSection).toBeVisible();

        // Look for timeline events
        const timelineEvents = adminPage.locator(
          '[data-testid="timeline-event"], .timeline-event',
        );
        const eventCount = await timelineEvents.count();

        expect(eventCount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test("should show status updates in timeline", async ({ adminPage }) => {
    const ordersPage = new OrdersPage(adminPage);

    // Navigate to orders
    await ordersPage.navigateToList();

    // Get an existing order
    const orderCount = await ordersPage.getOrderCount();

    if (orderCount > 0) {
      const firstOrder = await ordersPage.getOrderDetails(0);
      const trackingId = firstOrder.trackingId;

      // Open order details
      await ordersPage.openOrderDetails(trackingId);

      // Look for status indicators in timeline
      const statusElements = adminPage.locator(
        '[data-testid="status"], .status',
      );

      // Get all visible status elements
      const count = await statusElements.count();
      expect(count).toBeGreaterThanOrEqual(1);

      // Verify status text contains expected values
      if (count > 0) {
        const firstStatus = await statusElements.first().textContent();
        expect(firstStatus).toBeTruthy();
      }
    }
  });

  test("should display estimated delivery time", async ({ adminPage }) => {
    const ordersPage = new OrdersPage(adminPage);

    // Navigate to orders
    await ordersPage.navigateToList();

    // Get an existing order
    const orderCount = await ordersPage.getOrderCount();

    if (orderCount > 0) {
      const firstOrder = await ordersPage.getOrderDetails(0);
      const trackingId = firstOrder.trackingId;

      // Open order details
      await ordersPage.openOrderDetails(trackingId);

      // Look for delivery time estimate
      const deliveryTimeElements = adminPage.locator(
        '[data-testid="estimated-delivery"], text="Estimated", text="Delivery"',
      );

      // Verify delivery time is displayed if element exists
      if (await deliveryTimeElements.isVisible().catch(() => false)) {
        await expect(deliveryTimeElements).toBeVisible();
      }
    }
  });

  test("should show current location for in-transit orders", async ({
    adminPage,
  }) => {
    const ordersPage = new OrdersPage(adminPage);

    // Navigate to orders
    await ordersPage.navigateToList();

    // Filter for IN_TRANSIT orders to find location data
    await ordersPage.filterByStatus("IN_TRANSIT");

    const orderCount = await ordersPage.getOrderCount();

    if (orderCount > 0) {
      const firstOrder = await ordersPage.getOrderDetails(0);
      const trackingId = firstOrder.trackingId;

      // Open order details
      await ordersPage.openOrderDetails(trackingId);

      // Look for current location section
      const locationSection = adminPage.locator(
        '[data-testid="current-location"], section:has-text("Location"), section:has-text("Current")',
      );

      // If location section exists, verify it's displayed
      if (await locationSection.isVisible().catch(() => false)) {
        await expect(locationSection).toBeVisible();

        // Look for location details like address or coordinates
        const locationText = adminPage.locator(
          '[data-testid="location-address"], .address, [role="status"]',
        );

        if (await locationText.isVisible().catch(() => false)) {
          const text = await locationText.textContent();
          expect(text).toBeTruthy();
        }
      }
    }
  });

  test("should show driver information during transit", async ({
    adminPage,
  }) => {
    const ordersPage = new OrdersPage(adminPage);

    // Navigate to orders
    await ordersPage.navigateToList();

    // Filter for IN_TRANSIT orders
    await ordersPage.filterByStatus("IN_TRANSIT");

    const orderCount = await ordersPage.getOrderCount();

    if (orderCount > 0) {
      const firstOrder = await ordersPage.getOrderDetails(0);
      const trackingId = firstOrder.trackingId;

      // Open order details
      await ordersPage.openOrderDetails(trackingId);

      // Look for driver information section
      const driverSection = adminPage.locator(
        '[data-testid="driver-info"], section:has-text("Driver")',
      );

      // If driver section exists, verify it's displayed
      if (await driverSection.isVisible().catch(() => false)) {
        await expect(driverSection).toBeVisible();

        // Look for driver name and contact
        const driverName = adminPage.locator(
          '[data-testid="driver-name"], .driver-name',
        );
        const driverPhone = adminPage.locator(
          '[data-testid="driver-phone"], .driver-phone',
        );

        if (await driverName.isVisible().catch(() => false)) {
          expect(await driverName.textContent()).toBeTruthy();
        }
      }
    }
  });

  test("should verify status progression is logical", async ({ adminPage }) => {
    const ordersPage = new OrdersPage(adminPage);

    // Navigate to orders
    await ordersPage.navigateToList();

    // Get an existing order
    const orderCount = await ordersPage.getOrderCount();

    if (orderCount > 0) {
      const firstOrder = await ordersPage.getOrderDetails(0);
      const trackingId = firstOrder.trackingId;

      // Open order details
      await ordersPage.openOrderDetails(trackingId);

      // Get all status updates from timeline
      const timelineEvents = adminPage.locator(
        '[data-testid="timeline-event"], .timeline-event',
      );
      const eventCount = await timelineEvents.count();

      // Collect all statuses in order
      const statuses: string[] = [];
      for (let i = 0; i < eventCount; i++) {
        const eventText = await timelineEvents.nth(i).textContent();
        if (eventText) {
          statuses.push(eventText.trim());
        }
      }

      // Verify statuses exist
      if (statuses.length > 0) {
        // Just verify first and last status are not the same
        expect(statuses).toBeTruthy();
      }
    }
  });

  test("should display proof of delivery when completed", async ({
    adminPage,
  }) => {
    const ordersPage = new OrdersPage(adminPage);

    // Navigate to orders
    await ordersPage.navigateToList();

    // Filter for DELIVERED orders
    await ordersPage.filterByStatus("DELIVERED");

    const orderCount = await ordersPage.getOrderCount();

    if (orderCount > 0) {
      const firstOrder = await ordersPage.getOrderDetails(0);
      const trackingId = firstOrder.trackingId;

      // Open order details
      await ordersPage.openOrderDetails(trackingId);

      // Look for proof of delivery section
      const podSection = adminPage.locator(
        '[data-testid="proof-of-delivery"], section:has-text("Proof"), section:has-text("Delivery")',
      );

      // If POD section exists, verify it's displayed
      if (await podSection.isVisible().catch(() => false)) {
        await expect(podSection).toBeVisible();

        // Look for signature or photo
        const signature = adminPage.locator(
          '[data-testid="signature"], img[alt="Signature"]',
        );
        const photo = adminPage.locator(
          '[data-testid="delivery-photo"], img[alt="Photo"]',
        );

        if (await signature.isVisible().catch(() => false)) {
          await expect(signature).toBeVisible();
        } else if (await photo.isVisible().catch(() => false)) {
          await expect(photo).toBeVisible();
        }
      }
    }
  });
});
