/**
 * Example Usage of i18n Module
 *
 * This file demonstrates how to use the i18n utility in the dashboard application.
 * It covers initialization, basic translations, parameter interpolation, and locale switching.
 */

import {
  initializeI18n,
  loadLocaleData,
  setLocale,
  getLocale,
  t,
  hasKey,
  isRTL,
  getDirection,
  dynamicLoadLocale,
} from "./index";

// ============================================================================
// 1. INITIALIZATION (Typically in app startup)
// ============================================================================

export function setupI18n() {
  // Initialize configuration
  initializeI18n({
    defaultLocale: "en",
    fallbackLocale: "en",
    supportedLocales: ["en", "es", "fr", "ar"],
  });

  // Dynamically import and load translations
  // (In real app, you might want to code-split these)
  import("./locales/en.json").then((module) => {
    loadLocaleData("en", module.default);
  });

  import("./locales/es.json").then((module) => {
    loadLocaleData("es", module.default);
  });

  import("./locales/fr.json").then((module) => {
    loadLocaleData("fr", module.default);
  });

  import("./locales/ar.json").then((module) => {
    loadLocaleData("ar", module.default);
  });
}

// ============================================================================
// 2. BASIC TRANSLATIONS
// ============================================================================

export function exampleBasicTranslations() {
  // Simple top-level keys
  console.log(t("common.save")); // "Save"
  console.log(t("common.cancel")); // "Cancel"
  console.log(t("common.delete")); // "Delete"

  // Navigation keys
  console.log(t("navigation.orders")); // "Orders"
  console.log(t("navigation.drivers")); // "Drivers"
  console.log(t("navigation.dashboard")); // "Dashboard"
}

// ============================================================================
// 3. NESTED KEY TRANSLATIONS
// ============================================================================

export function exampleNestedKeys() {
  // Order statuses
  const orderStatuses = {
    pending: t("orders.status.pending"), // "Pending"
    confirmed: t("orders.status.confirmed"), // "Confirmed"
    assigned: t("orders.status.assigned"), // "Assigned"
    picked_up: t("orders.status.picked_up"), // "Picked Up"
    in_transit: t("orders.status.in_transit"), // "In Transit"
    delivered: t("orders.status.delivered"), // "Delivered"
    failed: t("orders.status.failed"), // "Failed"
    cancelled: t("orders.status.cancelled"), // "Cancelled"
  };

  // Driver statuses
  const driverStatuses = {
    online: t("drivers.status.online"), // "Online"
    offline: t("drivers.status.offline"), // "Offline"
    on_break: t("drivers.status.on_break"), // "On Break"
    busy: t("drivers.status.busy"), // "Busy"
  };

  return { orderStatuses, driverStatuses };
}

// ============================================================================
// 4. PARAMETER INTERPOLATION
// ============================================================================

export function exampleParameterInterpolation() {
  // Single parameter
  const assignMessage = t("orders.assigned", { driver: "John Smith" });
  console.log(assignMessage); // "Order assigned to John Smith"

  // Multiple parameters
  const orderCreated = t("notifications.order_created", { order_id: "12345" });
  console.log(orderCreated); // "Order 12345 has been created"

  // Numeric parameters
  const paginationMessage = t("pagination.showing", {
    from: 1,
    to: 10,
    total: 245,
  });
  console.log(paginationMessage); // "Showing 1 to 10 of 245 results"

  // Complex scenario
  const deliveryNotification = t("notifications.delivery_completed", {
    order_id: "ORD-2024-001",
  });
  console.log(deliveryNotification); // "Order ORD-2024-001 delivered successfully"
}

// ============================================================================
// 5. LOCALE SWITCHING
// ============================================================================

export function exampleLocaleSwitch() {
  // Start in English
  setLocale("en");
  console.log(t("common.save")); // "Save"
  console.log(getLocale()); // "en"

  // Switch to Spanish
  setLocale("es");
  console.log(t("common.save")); // "Guardar"
  console.log(getLocale()); // "es"

  // Switch to French
  setLocale("fr");
  console.log(t("common.save")); // "Enregistrer"

  // Switch to Arabic
  setLocale("ar");
  console.log(t("common.save")); // "حفظ"
}

// ============================================================================
// 6. RTL SUPPORT
// ============================================================================

export function exampleRTLSupport() {
  // English - LTR
  setLocale("en");
  console.log(isRTL()); // false
  console.log(getDirection()); // "ltr"

  // Spanish - LTR
  setLocale("es");
  console.log(isRTL()); // false
  console.log(getDirection()); // "ltr"

  // French - LTR
  setLocale("fr");
  console.log(isRTL()); // false

  // Arabic - RTL
  setLocale("ar");
  console.log(isRTL()); // true
  console.log(getDirection()); // "rtl"

  // Use in HTML
  document.documentElement.dir = getDirection();
  document.documentElement.lang = "ar";
}

// ============================================================================
// 7. CHECKING KEY EXISTENCE
// ============================================================================

export function exampleKeyExistence() {
  // Check if translation exists
  if (hasKey("orders.status.pending")) {
    console.log(t("orders.status.pending"));
  }

  // Use hasKey to avoid warnings for optional keys
  if (hasKey("experimental.new_feature")) {
    console.log(t("experimental.new_feature"));
  } else {
    console.log("Feature not translated");
  }
}

// ============================================================================
// 8. DYNAMIC LOCALE LOADING
// ============================================================================

export async function exampleDynamicLoading() {
  // Load locale on demand (useful for code splitting)
  await dynamicLoadLocale("fr", () => import("./locales/fr.json"));

  // Now use it
  setLocale("fr");
  console.log(t("common.save")); // "Enregistrer"
}

// ============================================================================
// 9. REAL-WORLD DASHBOARD SCENARIO
// ============================================================================

export function exampleDashboardUsage() {
  // User loads dashboard in English
  setLocale("en");

  // Display header
  const pageTitle = t("navigation.orders");
  const saveButtonText = t("common.save");
  const cancelButtonText = t("common.cancel");

  console.log(`Page: ${pageTitle}`); // "Page: Orders"

  // Display table with orders
  const orders = [
    {
      id: "ORD-001",
      status: t("orders.status.pending"), // "Pending"
      customer: "John Doe",
    },
    {
      id: "ORD-002",
      status: t("orders.status.in_transit"), // "In Transit"
      customer: "Jane Smith",
    },
    {
      id: "ORD-003",
      status: t("orders.status.delivered"), // "Delivered"
      customer: "Bob Wilson",
    },
  ];

  console.log("Orders:", orders);

  // Show notification
  const notification = t("notifications.order_assigned", {
    order_id: "ORD-001",
    driver_name: "Carlos Rodriguez",
  });
  console.log("Notification:", notification);
  // "Order ORD-001 assigned to Carlos Rodriguez"

  // User switches to Spanish
  setLocale("es");

  // Everything updates automatically
  const pageTitle_es = t("navigation.orders"); // "Pedidos"
  const notification_es = t("notifications.order_assigned", {
    order_id: "ORD-001",
    driver_name: "Carlos Rodriguez",
  });
  // "Pedido ORD-001 asignado a Carlos Rodriguez"

  console.log(`Página: ${pageTitle_es}`);
  console.log("Notificación:", notification_es);

  // User selects Arabic for RTL support
  setLocale("ar");
  document.documentElement.dir = getDirection(); // "rtl"
  document.documentElement.lang = "ar";

  const pageTitle_ar = t("navigation.orders"); // "الطلبات"
  console.log(`الصفحة: ${pageTitle_ar}`);
}

// ============================================================================
// 10. FORM VALIDATION MESSAGES
// ============================================================================

export function exampleFormValidation() {
  // Validation messages
  const validationErrors = {
    required: t("validation.required_field"),
    email: t("validation.invalid_email"),
    phone: t("validation.invalid_phone"),
    password: t("validation.password_too_short"),
    match: t("validation.passwords_dont_match"),
  };

  // Error display
  function displayValidationError(field: string, type: "email" | "required") {
    const message = validationErrors[type];
    console.error(`${field}: ${message}`);
  }

  displayValidationError("email", "email");
  // "email: Invalid email address"
}

// ============================================================================
// 11. TIME-BASED MESSAGES
// ============================================================================

export function exampleTimeMessages() {
  const timeMessages = {
    justNow: t("time.just_now"),
    minutesAgo: t("time.minutes_ago", { count: 5 }),
    hoursAgo: t("time.hour_ago", { count: 2 }),
    daysAgo: t("time.day_ago", { count: 1 }),
    weeksAgo: t("time.week_ago", { count: 2 }),
  };

  console.log("Time messages:", timeMessages);
  // "just_now": "Just now"
  // "minutesAgo": "5 minute ago"
  // "hoursAgo": "2 hour ago"
}

// ============================================================================
// 12. ERROR MESSAGES
// ============================================================================

export function exampleErrorMessages() {
  const errors = {
    notFound: t("errors.not_found"),
    unauthorized: t("errors.unauthorized"),
    forbidden: t("errors.forbidden"),
    validation: t("errors.validation_failed"),
    server: t("errors.server_error"),
    rateLimit: t("errors.rate_limited"),
    network: t("errors.network_error"),
  };

  console.log("Error messages:", errors);
}

// ============================================================================
// EXPORT FOR SETUP
// ============================================================================

// Call setupI18n() in your app initialization
export default setupI18n;
