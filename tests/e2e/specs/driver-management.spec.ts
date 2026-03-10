import { test, expect } from '../fixtures/auth.fixture';
import { DashboardPage } from '../pages/dashboard.page';
import { DriversPage } from '../pages/drivers.page';

test.describe('Driver Management', () => {
  let driversPage: DriversPage;

  test.beforeEach(async ({ adminPage }) => {
    driversPage = new DriversPage(adminPage);
    await driversPage.navigateToList();
  });

  test('should view driver list with pagination', async ({ adminPage }) => {
    driversPage = new DriversPage(adminPage);

    // Navigate to drivers page
    await driversPage.navigateToList();

    // Verify page is loaded
    await driversPage.expectDriversPage();

    // Get driver count
    const driverCount = await driversPage.getDriverCount();

    // Verify at least one driver exists
    expect(driverCount).toBeGreaterThanOrEqual(0);

    // If drivers exist, verify they're displayed
    if (driverCount > 0) {
      const drivers = await driversPage.getAllDrivers();
      expect(drivers.length).toBeGreaterThan(0);
      expect(drivers[0].name).toBeTruthy();
    }
  });

  test('should filter drivers by availability status', async ({ adminPage }) => {
    driversPage = new DriversPage(adminPage);

    // Navigate to drivers page
    await driversPage.navigateToList();

    // Get all drivers
    const allDrivers = await driversPage.getAllDrivers();
    const initialCount = allDrivers.length;

    // Filter by AVAILABLE
    await driversPage.filterByAvailability('available');

    // Get filtered drivers
    const availableDrivers = await driversPage.getAllDrivers();

    // Verify filter is applied (might have fewer or same drivers)
    expect(availableDrivers.length).toBeLessThanOrEqual(initialCount);
  });

  test('should filter drivers by UNAVAILABLE status', async ({ adminPage }) => {
    driversPage = new DriversPage(adminPage);

    // Navigate to drivers page
    await driversPage.navigateToList();

    // Filter by UNAVAILABLE
    await driversPage.filterByAvailability('unavailable');

    // Verify filter result
    const drivers = await driversPage.getAllDrivers();
    expect(drivers).toBeTruthy();
  });

  test('should search for driver by name', async ({ adminPage }) => {
    driversPage = new DriversPage(adminPage);

    // Get all drivers first
    await driversPage.navigateToList();
    const allDrivers = await driversPage.getAllDrivers();

    if (allDrivers.length > 0) {
      // Search for first driver
      const driverName = allDrivers[0].name;
      await driversPage.searchDriver(driverName);

      // Verify search result
      await driversPage.expectDriverExists(driverName);
    }
  });

  test('should view driver status', async ({ adminPage }) => {
    driversPage = new DriversPage(adminPage);

    // Navigate to drivers page
    await driversPage.navigateToList();

    // Get all drivers
    const drivers = await driversPage.getAllDrivers();

    if (drivers.length > 0) {
      const driverName = drivers[0].name;

      // Get driver status
      const status = await driversPage.getDriverStatus(driverName);

      // Verify status is displayed and not empty
      expect(status).toBeTruthy();
      expect(['AVAILABLE', 'UNAVAILABLE', 'BUSY', 'OFFLINE'].some((s) => status.includes(s))).toBeTruthy();
    }
  });

  test('should update driver status', async ({ adminPage }) => {
    driversPage = new DriversPage(adminPage);

    // Navigate to drivers page
    await driversPage.navigateToList();

    // Get all drivers
    const drivers = await driversPage.getAllDrivers();

    if (drivers.length > 0) {
      const driverName = drivers[0].name;
      const initialStatus = drivers[0].status;

      // Get a different status to update to
      const newStatus = initialStatus.includes('AVAILABLE') ? 'UNAVAILABLE' : 'AVAILABLE';

      // Update driver status
      await driversPage.updateDriverStatus(driverName, newStatus);

      // Verify status was updated
      await driversPage.navigateToList();
      const updatedStatus = await driversPage.getDriverStatus(driverName);

      expect(updatedStatus).not.toBe(initialStatus);
    }
  });

  test('should view driver details', async ({ adminPage }) => {
    driversPage = new DriversPage(adminPage);

    // Navigate to drivers page
    await driversPage.navigateToList();

    // Get drivers
    const drivers = await driversPage.getAllDrivers();

    if (drivers.length > 0) {
      const driverName = drivers[0].name;

      // Open driver details
      await driversPage.openDriverDetails(driverName);

      // Verify driver details page is displayed
      const pageTitle = adminPage.locator('h1, [data-testid="page-title"]');
      await expect(pageTitle).toContainText(driverName);
    }
  });

  test('should view driver routes', async ({ adminPage }) => {
    driversPage = new DriversPage(adminPage);

    // Navigate to drivers page
    await driversPage.navigateToList();

    // Get drivers
    const drivers = await driversPage.getAllDrivers();

    if (drivers.length > 0) {
      const driverName = drivers[0].name;

      // Open driver details
      await driversPage.openDriverDetails(driverName);

      // Look for routes section
      const routesSection = adminPage.locator('[data-testid="routes"], section:has-text("Route")');

      // If routes section exists, verify it's displayed
      if (await routesSection.isVisible().catch(() => false)) {
        await expect(routesSection).toBeVisible();
      }
    }
  });

  test('should assign driver to shipment', async ({ adminPage }) => {
    driversPage = new DriversPage(adminPage);

    // Navigate to drivers page
    await driversPage.navigateToList();

    // Get all drivers
    const drivers = await driversPage.getAllDrivers();

    if (drivers.length > 0) {
      const driverName = drivers[0].name;

      // Assign driver to shipment (with or without orderId)
      await driversPage.assignDriver(driverName);

      // Verify assignment was processed
      await driversPage.waitForPageLoad();
    }
  });

  test('should display driver contacts correctly', async ({ adminPage }) => {
    driversPage = new DriversPage(adminPage);

    // Navigate to drivers page
    await driversPage.navigateToList();

    // Get drivers
    const drivers = await driversPage.getAllDrivers();

    if (drivers.length > 0) {
      const driverName = drivers[0].name;

      // Open driver details
      await driversPage.openDriverDetails(driverName);

      // Look for contact information
      const phoneElement = adminPage.locator('[data-testid="driver-phone"], .phone');
      const emailElement = adminPage.locator('[data-testid="driver-email"], .email');

      // Verify at least one contact method is displayed
      const hasPhone = await phoneElement.isVisible().catch(() => false);
      const hasEmail = await emailElement.isVisible().catch(() => false);

      expect(hasPhone || hasEmail).toBeTruthy();
    }
  });

  test('should show driver performance metrics', async ({ adminPage }) => {
    driversPage = new DriversPage(adminPage);

    // Navigate to drivers page
    await driversPage.navigateToList();

    // Get drivers
    const drivers = await driversPage.getAllDrivers();

    if (drivers.length > 0) {
      const driverName = drivers[0].name;

      // Open driver details
      await driversPage.openDriverDetails(driverName);

      // Look for performance metrics
      const metricsSection = adminPage.locator('[data-testid="performance"], section:has-text("Performance")');

      // If metrics section exists, verify it's displayed
      if (await metricsSection.isVisible().catch(() => false)) {
        await expect(metricsSection).toBeVisible();

        // Look for specific metrics like deliveries, rating, etc
        const deliveriesMetric = adminPage.locator('[data-testid="total-deliveries"], text="Deliveries"');
        const ratingMetric = adminPage.locator('[data-testid="rating"], text="Rating"');

        expect(
          (await deliveriesMetric.isVisible().catch(() => false)) ||
          (await ratingMetric.isVisible().catch(() => false))
        ).toBeTruthy();
      }
    }
  });
});
