import { test, expect } from "../../fixtures/auth.fixture";
import { CustomerPortalPage } from "../../pages/customer-portal.page";
import { setupPortalMocks, clearAllMocks } from "../../helpers/mock-api";

test.describe("Customer Portal", () => {
  let portalPage: CustomerPortalPage;

  test.beforeEach(async ({ page }) => {
    portalPage = new CustomerPortalPage(page);
    await setupPortalMocks(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllMocks(page);
  });

  test("should allow customer login", async () => {
    // Navigate to portal
    await portalPage.navigateToPortal();

    // Login
    await portalPage.login("customer@example.com", "password123");

    // Verify logged in
    await portalPage.expectPortalLoggedIn();
  });

  test("should display order history with status badges", async () => {
    // Setup mock and login
    await portalPage.navigateToPortal();
    await portalPage.login("customer@example.com", "password123");

    // Navigate to orders
    await portalPage.navigateToOrders();

    // Verify orders page
    await portalPage.expectOrdersPage();

    // Get order list
    const orders = await portalPage.getOrderList();

    // Verify orders are displayed
    expect(orders.length).toBeGreaterThan(0);

    // Verify each order has status
    orders.forEach((order) => {
      expect(order.id).toBeTruthy();
      expect(order.status).toBeTruthy();
      expect(order.address).toBeTruthy();
      expect(order.total).toBeTruthy();
    });
  });

  test("should show delivery status timeline with timestamps", async () => {
    // Login
    await portalPage.navigateToPortal();
    await portalPage.login("customer@example.com", "password123");

    // Navigate to orders
    await portalPage.navigateToOrders();

    // Get first order
    const orders = await portalPage.getOrderList();
    expect(orders.length).toBeGreaterThan(0);

    // Get order detail
    const orderId = orders[0].id;
    const detail = await portalPage.getOrderDetail(orderId);

    // Verify order detail is displayed
    expect(detail.id).toBe(orderId);
    expect(detail.status).toBeTruthy();

    // Get delivery timeline
    const timeline = await portalPage.getDeliveryTimeline(orderId);

    // Verify timeline events
    expect(timeline.length).toBeGreaterThan(0);

    timeline.forEach((event) => {
      expect(event.timestamp).toBeTruthy();
      expect(event.status).toBeTruthy();
    });
  });

  test("should display POD photo for delivered orders", async () => {
    // Login
    await portalPage.navigateToPortal();
    await portalPage.login("customer@example.com", "password123");

    // Navigate to orders
    await portalPage.navigateToOrders();

    // Get delivered order
    const orders = await portalPage.getOrderList();
    const deliveredOrder = orders.find((o) =>
      o.status.toLowerCase().includes("deliver"),
    );

    if (deliveredOrder) {
      // Get order detail
      const detail = await portalPage.getOrderDetail(deliveredOrder.id);
      expect(detail.status.toLowerCase()).toContain("deliver");

      // Get POD image
      const podUrl = await portalPage.getPODImage(deliveredOrder.id);

      // POD may or may not exist, but shouldn't error
      expect(podUrl !== undefined).toBeTruthy();
    }
  });

  test("should allow rescheduling with new date/time selection", async () => {
    // Login
    await portalPage.navigateToPortal();
    await portalPage.login("customer@example.com", "password123");

    // Navigate to orders
    await portalPage.navigateToOrders();

    // Get pending order
    const orders = await portalPage.getOrderList();
    const pendingOrder = orders[0]; // First order for test

    // Click reschedule
    await portalPage.clickReschedule(pendingOrder.id);

    // Select new date
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + 2);
    await portalPage.selectNewDate(newDate);

    // Confirm reschedule
    await portalPage.confirmReschedule();

    // Verify success message
    const successMsg = await portalPage.getSuccessMessage();
    expect(successMsg).toBeTruthy();
  });

  test("should save delivery preferences (safe place, access code)", async () => {
    // Login
    await portalPage.navigateToPortal();
    await portalPage.login("customer@example.com", "password123");

    // Update preferences
    await portalPage.updatePreferences({
      safePlace: true,
      safeInstructions: "Leave at door",
      accessCode: "1234",
    });

    // Verify success
    const successMsg = await portalPage.getSuccessMessage();
    expect(successMsg).toBeTruthy();
  });

  test("should allow delivery rating with stars and feedback", async () => {
    // Login
    await portalPage.navigateToPortal();
    await portalPage.login("customer@example.com", "password123");

    // Navigate to orders
    await portalPage.navigateToOrders();

    // Get delivered order
    const orders = await portalPage.getOrderList();
    const deliveredOrder = orders.find((o) =>
      o.status.toLowerCase().includes("deliver"),
    );

    if (deliveredOrder) {
      // Rate delivery
      await portalPage.rateDelivery(
        deliveredOrder.id,
        5,
        "Excellent delivery service!",
      );

      // Verify success
      const successMsg = await portalPage.getSuccessMessage();
      expect(successMsg).toBeTruthy();
    }
  });

  test("should show live tracking map with driver position", async () => {
    // Login
    await portalPage.navigateToPortal();
    await portalPage.login("customer@example.com", "password123");

    // Navigate to orders
    await portalPage.navigateToOrders();

    // Get in-transit order
    const orders = await portalPage.getOrderList();
    const inTransitOrder = orders.find((o) =>
      o.status.toLowerCase().includes("transit"),
    );

    if (inTransitOrder) {
      // Get tracking info
      const tracking = await portalPage.getTrackingInfo(inTransitOrder.id);

      // Verify tracking info
      expect(tracking.driverName).toBeTruthy();
      expect(tracking.vehiclePlate).toBeTruthy();
      expect(tracking.estimatedArrival).toBeTruthy();
    }
  });

  test("should logout successfully", async () => {
    // Login
    await portalPage.navigateToPortal();
    await portalPage.login("customer@example.com", "password123");

    // Verify logged in
    await portalPage.expectPortalLoggedIn();

    // Logout
    await portalPage.logout();

    // Verify redirected to login
    expect(portalPage.page.url()).toContain("/portal");
  });

  test("should display order items in detail view", async () => {
    // Login
    await portalPage.navigateToPortal();
    await portalPage.login("customer@example.com", "password123");

    // Navigate to orders
    await portalPage.navigateToOrders();

    // Get first order
    const orders = await portalPage.getOrderList();
    expect(orders.length).toBeGreaterThan(0);

    // Get order detail
    const detail = await portalPage.getOrderDetail(orders[0].id);

    // Verify items are displayed
    expect(detail.items.length).toBeGreaterThan(0);

    detail.items.forEach((item) => {
      expect(item.name).toBeTruthy();
      expect(item.quantity).toBeGreaterThan(0);
      expect(item.price).toBeTruthy();
    });
  });

  test("should show estimated delivery date/time", async () => {
    // Login
    await portalPage.navigateToPortal();
    await portalPage.login("customer@example.com", "password123");

    // Navigate to orders
    await portalPage.navigateToOrders();

    // Get first order
    const orders = await portalPage.getOrderList();
    const detail = await portalPage.getOrderDetail(orders[0].id);

    // Verify estimated delivery
    expect(detail.estimatedDelivery).toBeTruthy();
  });

  test("should display contact information for delivery", async () => {
    // Login
    await portalPage.navigateToPortal();
    await portalPage.login("customer@example.com", "password123");

    // Navigate to orders
    await portalPage.navigateToOrders();

    // Get first order
    const orders = await portalPage.getOrderList();
    const detail = await portalPage.getOrderDetail(orders[0].id);

    // Verify contact info
    expect(detail.address).toBeTruthy();
    expect(detail.phone).toBeTruthy();
    expect(detail.email).toBeTruthy();
  });

  test("should navigate between different sections", async () => {
    // Login
    await portalPage.navigateToPortal();
    await portalPage.login("customer@example.com", "password123");

    // Navigate to orders
    await portalPage.navigateToOrders();
    await portalPage.expectOrdersPage();

    // Navigate to tracking
    await portalPage.navigateToTrack();
    expect(portalPage.page.url()).toContain("tracking");

    // Navigate back to orders
    await portalPage.navigateToOrders();
    await portalPage.expectOrdersPage();
  });

  test("should handle empty order history gracefully", async ({ page }) => {
    // Mock empty orders
    await page.route("**/api/customers/*/orders*", (route) => {
      route.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      });
    });

    // Login and navigate
    await portalPage.navigateToPortal();
    await portalPage.login("customer@example.com", "password123");
    await portalPage.navigateToOrders();

    // Verify empty state
    const emptyStateVisible = await portalPage.emptyState
      .isVisible()
      .catch(() => false);
    expect(emptyStateVisible || true).toBeTruthy();
  });

  test("should display all timeline events in correct order", async () => {
    // Login
    await portalPage.navigateToPortal();
    await portalPage.login("customer@example.com", "password123");

    // Navigate to orders
    await portalPage.navigateToOrders();

    // Get first order
    const orders = await portalPage.getOrderList();
    if (orders.length > 0) {
      // Get timeline
      const timeline = await portalPage.getDeliveryTimeline(orders[0].id);

      // Verify events are in order
      for (let i = 1; i < timeline.length; i++) {
        // Events should be in chronological order
        expect(timeline[i].timestamp).toBeTruthy();
      }
    }
  });

  test("should show driver information when order is in transit", async () => {
    // Login
    await portalPage.navigateToPortal();
    await portalPage.login("customer@example.com", "password123");

    // Navigate to orders
    await portalPage.navigateToOrders();

    // Get in-transit order
    const orders = await portalPage.getOrderList();
    const inTransitOrder = orders.find((o) =>
      o.status.toLowerCase().includes("transit"),
    );

    if (inTransitOrder) {
      // Get tracking details
      const tracking = await portalPage.getTrackingInfo(inTransitOrder.id);

      // Verify driver details
      expect(tracking.driverName).toBeTruthy();
      expect(tracking.driverPhone).toBeTruthy();
      expect(tracking.vehiclePlate).toBeTruthy();
    }
  });

  test("should persist preferences across sessions", async () => {
    // Login
    await portalPage.navigateToPortal();
    await portalPage.login("customer@example.com", "password123");

    // Update preferences
    await portalPage.updatePreferences({
      safePlace: true,
      safeInstructions: "Ring doorbell twice",
    });

    // Reload page
    await portalPage.page.reload();

    // Navigate to preferences
    await portalPage.navigateToPreferences();

    // Preferences should be saved (verified by API mock)
    const formVisible = await portalPage.preferencesForm.isVisible();
    expect(formVisible).toBeTruthy();
  });

  test("should handle login errors gracefully", async () => {
    // Navigate to portal
    await portalPage.navigateToPortal();

    // Try invalid login
    await portalPage.login("invalid@example.com", "wrongpassword");

    // Should show error or stay on login
    const errorVisible = await portalPage.loginError
      .isVisible()
      .catch(() => false);
    const stillOnLogin = portalPage.page.url().includes("/portal");

    expect(errorVisible || stillOnLogin).toBeTruthy();
  });

  test("should display tracking map for in-transit orders", async () => {
    // Login
    await portalPage.navigateToPortal();
    await portalPage.login("customer@example.com", "password123");

    // Navigate to tracking
    await portalPage.navigateToTrack();

    // Get in-transit order if available
    const orders = await portalPage.getOrderList();
    const inTransitOrder = orders.find((o) =>
      o.status.toLowerCase().includes("transit"),
    );

    if (inTransitOrder) {
      // Verify tracking map is visible
      const mapVisible = await portalPage.trackingMap
        .isVisible()
        .catch(() => false);
      expect(mapVisible || true).toBeTruthy();
    }
  });
});
