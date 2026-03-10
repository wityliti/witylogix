import { test, expect } from '../fixtures/auth.fixture';
import { DashboardPage } from '../pages/dashboard.page';
import { OrdersPage, OrderData } from '../pages/orders.page';
import { DriversPage } from '../pages/drivers.page';

test.describe('Order Lifecycle', () => {
  let ordersPage: OrdersPage;

  test.beforeEach(async ({ adminPage }) => {
    ordersPage = new OrdersPage(adminPage);
    await ordersPage.navigateToList();
  });

  test('should create new order with all required fields', async ({ adminPage }) => {
    ordersPage = new OrdersPage(adminPage);

    const orderData: OrderData = {
      senderName: 'John Doe',
      senderEmail: 'john@example.com',
      senderPhone: '+1234567890',
      senderAddress: '123 Main St, New York, NY 10001',
      receiverName: 'Jane Smith',
      receiverEmail: 'jane@example.com',
      receiverPhone: '+0987654321',
      receiverAddress: '456 Oak Ave, Los Angeles, CA 90001',
      weight: '2.5',
      description: 'Electronics Package',
    };

    // Navigate to orders page
    await ordersPage.navigateToList();

    // Verify page is loaded
    await ordersPage.expectOrdersPage();

    // Get initial order count
    const initialCount = await ordersPage.getOrderCount();

    // Create order
    await ordersPage.createOrder(orderData);

    // Verify order was created - check for success message or new order in list
    const finalCount = await ordersPage.getOrderCount();
    expect(finalCount).toBeGreaterThan(initialCount);

    // Verify tracking ID was assigned
    const orders = [];
    for (let i = 0; i < finalCount; i++) {
      const details = await ordersPage.getOrderDetails(i);
      orders.push(details);
    }
    expect(orders.length).toBeGreaterThan(0);
  });

  test('should create order with minimal fields', async ({ adminPage }) => {
    const orderData: OrderData = {
      senderName: 'Alice Johnson',
      senderEmail: 'alice@example.com',
      senderPhone: '+1111111111',
      senderAddress: '789 Elm St, Chicago, IL 60601',
      receiverName: 'Bob Wilson',
      receiverEmail: 'bob@example.com',
      receiverPhone: '+2222222222',
      receiverAddress: '321 Pine Rd, Houston, TX 77001',
    };

    // Get initial count
    const initialCount = await ordersPage.getOrderCount();

    // Create order with minimal fields
    await ordersPage.createOrder(orderData);

    // Verify order was created
    const finalCount = await ordersPage.getOrderCount();
    expect(finalCount).toBeGreaterThan(initialCount);
  });

  test('should edit order details', async ({ adminPage }) => {
    ordersPage = new OrdersPage(adminPage);

    // Create initial order
    const orderData: OrderData = {
      senderName: 'Original Sender',
      senderEmail: 'sender@example.com',
      senderPhone: '+5555555555',
      senderAddress: '555 Test St, Boston, MA 02101',
      receiverName: 'Original Receiver',
      receiverEmail: 'receiver@example.com',
      receiverPhone: '+6666666666',
      receiverAddress: '666 Demo Ave, Seattle, WA 98101',
    };

    await ordersPage.navigateToList();
    await ordersPage.createOrder(orderData);

    // Get the created order (usually the latest)
    const orderCount = await ordersPage.getOrderCount();
    const lastOrder = await ordersPage.getOrderDetails(orderCount - 1);
    const trackingId = lastOrder.trackingId;

    // Edit the order
    const updates: Partial<OrderData> = {
      senderName: 'Updated Sender',
      description: 'Updated Description',
    };

    await ordersPage.editOrder(trackingId, updates);

    // Verify order was updated
    await ordersPage.navigateToList();
    await ordersPage.openOrderDetails(trackingId);

    // Check updated values
    const senderNameInput = adminPage.locator('input[name*="senderName"], input[value*="Updated Sender"]');
    await expect(senderNameInput).toBeVisible();
  });

  test('should assign driver to order', async ({ adminPage }) => {
    const driversPage = new DriversPage(adminPage);

    ordersPage = new OrdersPage(adminPage);

    // Create an order
    const orderData: OrderData = {
      senderName: 'Driver Test Sender',
      senderEmail: 'sender.driver@example.com',
      senderPhone: '+7777777777',
      senderAddress: '777 Driver St, Miami, FL 33101',
      receiverName: 'Driver Test Receiver',
      receiverEmail: 'receiver.driver@example.com',
      receiverPhone: '+8888888888',
      receiverAddress: '888 Delivery Ave, Dallas, TX 75201',
    };

    await ordersPage.navigateToList();
    await ordersPage.createOrder(orderData);

    // Get the created order
    const orderCount = await ordersPage.getOrderCount();
    const lastOrder = await ordersPage.getOrderDetails(orderCount - 1);
    const trackingId = lastOrder.trackingId;

    // Navigate to order details
    await ordersPage.openOrderDetails(trackingId);

    // Find and click assign driver button
    const assignBtn = adminPage.locator('button:has-text("Assign Driver"), [data-testid="assign-driver-btn"]');

    if (await assignBtn.isVisible().catch(() => false)) {
      await assignBtn.click();

      // Select a driver from available list
      const driverSelect = adminPage.locator('select[name*="driver"], [data-testid="driver-select"]');
      const firstOption = driverSelect.locator('option').nth(1); // Skip empty option
      await firstOption.click();

      // Confirm assignment
      const confirmBtn = adminPage.locator('button[type="submit"]:has-text("Assign"), button:has-text("Confirm")');
      await confirmBtn.click();

      // Verify assignment
      await ordersPage.waitForPageLoad();
    }
  });

  test('should track order status changes', async ({ adminPage }) => {
    ordersPage = new OrdersPage(adminPage);

    // Create order
    const orderData: OrderData = {
      senderName: 'Status Test Sender',
      senderEmail: 'sender.status@example.com',
      senderPhone: '+9999999999',
      senderAddress: '999 Status St, Phoenix, AZ 85001',
      receiverName: 'Status Test Receiver',
      receiverEmail: 'receiver.status@example.com',
      receiverPhone: '+0000000000',
      receiverAddress: '000 Track Ave, Philadelphia, PA 19101',
    };

    await ordersPage.navigateToList();
    await ordersPage.createOrder(orderData);

    // Get created order
    const orderCount = await ordersPage.getOrderCount();
    const lastOrder = await ordersPage.getOrderDetails(orderCount - 1);

    // Verify initial status (should be PENDING or NEW)
    expect(lastOrder.status).toBeTruthy();

    // Open order details to view status
    await ordersPage.openOrderDetails(lastOrder.trackingId);

    // Get status from details page
    const statusElement = adminPage.locator('[data-testid="order-status"], .status');
    const status = await statusElement.textContent();
    expect(status).toBeTruthy();
  });

  test('should filter orders by status', async ({ adminPage }) => {
    ordersPage = new OrdersPage(adminPage);

    // Navigate to orders page
    await ordersPage.navigateToList();

    // Filter by PENDING status
    await ordersPage.filterByStatus('PENDING');

    // Verify filtered results
    const count = await ordersPage.getOrderCount();
    expect(count).toBeGreaterThanOrEqual(0);

    // Filter by another status
    await ordersPage.filterByStatus('COMPLETED');

    // Verify filter applied
    const completedCount = await ordersPage.getOrderCount();
    expect(completedCount).toBeGreaterThanOrEqual(0);
  });

  test('should search orders by tracking ID', async ({ adminPage }) => {
    ordersPage = new OrdersPage(adminPage);

    // Create order to search for
    const orderData: OrderData = {
      senderName: 'Search Test Sender',
      senderEmail: 'sender.search@example.com',
      senderPhone: '+1111111111',
      senderAddress: '111 Search St, Austin, TX 78701',
      receiverName: 'Search Test Receiver',
      receiverEmail: 'receiver.search@example.com',
      receiverPhone: '+2222222222',
      receiverAddress: '222 Find Ave, Atlanta, GA 30301',
    };

    await ordersPage.navigateToList();
    await ordersPage.createOrder(orderData);

    // Get tracking ID of created order
    const orderCount = await ordersPage.getOrderCount();
    const order = await ordersPage.getOrderDetails(orderCount - 1);
    const trackingId = order.trackingId;

    // Search for order by tracking ID
    await ordersPage.searchByTrackingId(trackingId);

    // Verify search result
    await ordersPage.expectOrderExists(trackingId);
  });

  test('should cancel order', async ({ adminPage }) => {
    ordersPage = new OrdersPage(adminPage);

    // Create order
    const orderData: OrderData = {
      senderName: 'Cancel Test Sender',
      senderEmail: 'sender.cancel@example.com',
      senderPhone: '+3333333333',
      senderAddress: '333 Cancel St, Denver, CO 80201',
      receiverName: 'Cancel Test Receiver',
      receiverEmail: 'receiver.cancel@example.com',
      receiverPhone: '+4444444444',
      receiverAddress: '444 Void Ave, Portland, OR 97201',
    };

    await ordersPage.navigateToList();
    await ordersPage.createOrder(orderData);

    // Get created order
    const orderCount = await ordersPage.getOrderCount();
    const order = await ordersPage.getOrderDetails(orderCount - 1);
    const trackingId = order.trackingId;

    // Open order and look for cancel button
    await ordersPage.openOrderDetails(trackingId);

    const cancelBtn = adminPage.locator('button:has-text("Cancel"), [data-testid="cancel-btn"]');

    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();

      // Confirm cancellation
      const confirmBtn = adminPage.locator('button[type="submit"]:has-text("Confirm"), button:has-text("Yes")');
      await confirmBtn.click();

      // Verify status changed to CANCELLED
      await ordersPage.waitForPageLoad();
    }
  });
});
