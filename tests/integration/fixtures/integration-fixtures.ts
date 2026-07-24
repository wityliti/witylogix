/**
 * Integration Fixtures - Mock HTTP Response Factories
 * Provides factory functions for mocking HTTP responses from all external providers
 * Used across routing, messaging, ERP, email, and maps adapters
 * ~500 lines total
 */

// ─────────────────────────────────────────────────────────────────────────────
// ROUTING PROVIDER FIXTURES (Valhalla, VROOM, Routific, OptimoRoute)
// ─────────────────────────────────────────────────────────────────────────────

export const mockValhallaRouteResponse = {
  confidence_score: 0.95,
  edges: [
    {
      id: "edge_1",
      way_names: ["Main Street"],
      distance: 1200,
      time: 85,
    },
    {
      id: "edge_2",
      way_names: ["Park Avenue"],
      distance: 800,
      time: 60,
    },
  ],
  shape: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
  summary: {
    has_toll: false,
    length: 2000,
    time: 145,
  },
  info: {
    warnings: [],
    license: "ODbL",
    copyright: "openstreetmap",
  },
};

export const mockValhallaIsochroneResponse = {
  properties: [
    {
      time: 300,
      contours: [
        {
          rings: [
            [
              [-73.9876, 40.7306],
              [-73.9866, 40.7316],
              [-73.9876, 40.7306],
            ],
          ],
          properties: {
            fill: "#ff0000",
            fill_opacity: 0.33,
          },
        },
      ],
    },
  ],
};

export const mockVROOMSolveResponse = {
  code: 0,
  message: "Solution found.",
  summary: {
    cost: 3850,
    unassigned: 0,
    amount: 14500,
    duration: 4321,
    waiting_time: 0,
    service: 600,
    delivery: 12500,
    pickup: 1479,
    distance: 45600,
  },
  unassigned: [],
  routes: [
    {
      vehicle: 0,
      steps: [
        {
          type: "start",
          arrival: 0,
          duration: 0,
          location: [2.3522, 48.8566],
          job: -1,
        },
        {
          type: "job",
          arrival: 856,
          duration: 600,
          location: [2.2945, 48.8582],
          job: 0,
        },
        {
          type: "end",
          arrival: 1712,
          duration: 0,
          location: [2.3522, 48.8566],
        },
      ],
      distance: 15600,
      duration: 1712,
      waiting_time: 0,
    },
  ],
};

export const mockRoutificResponse = {
  status: "success",
  optimization_problem_id: "abc123def456",
  created_at: "2024-03-12T10:30:00Z",
  completion_time: 2.5,
  solution: {
    unserved: [],
    routes: [
      {
        id: "route_1",
        vehicle_id: "vehicle_001",
        stops: [
          {
            id: "stop_1",
            location: {
              address: "123 Main St, Boston, MA",
              lat: 42.3601,
              lng: -71.0589,
            },
            arrival_time: 1710247800,
            departure_time: 1710247860,
            sequence: 1,
          },
          {
            id: "stop_2",
            location: {
              address: "456 Oak Ave, Boston, MA",
              lat: 42.3581,
              lng: -71.0599,
            },
            arrival_time: 1710248100,
            departure_time: 1710248160,
            sequence: 2,
          },
        ],
        distance_km: 2.5,
        travel_time_ms: 360000,
        stops_count: 2,
        vehicle_route_priority_rank: 1,
      },
    ],
  },
};

export const mockOptimoRouteResponse = {
  code: "OK",
  message: "Plan created successfully",
  data: {
    id: "plan_12345",
    date: "2024-03-12",
    total_distance: 45000,
    total_time: 7200,
    total_cost: 125.5,
    num_routes: 3,
    num_orders: 15,
    routes: [
      {
        id: "route_001",
        sequence: 1,
        distance: 15000,
        time: 2400,
        orders: ["order_1", "order_2", "order_3"],
      },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGING PROVIDER FIXTURES (Vonage, TextMagic, OneSignal, Sendbird)
// ─────────────────────────────────────────────────────────────────────────────

export const mockVonageSendSMSResponse = {
  message_count: 1,
  messages: [
    {
      message_id: "msg_1710247800000",
      to: "14155552671",
      status: "0",
      remaining_balance: 14.95,
      message_price: 0.05,
      network: "US-CARRIER",
    },
  ],
};

export const mockVonageVerifyResponse = {
  request_id: "verify_req_123456",
  status: "0",
};

export const mockVonageVerifyCheckResponse = {
  request_id: "verify_req_123456",
  event_id: "verify_event_456",
  status: "0",
  price: 0.1,
  currency: "EUR",
};

export const mockTextMagicSendResponse = {
  success: true,
  result: {
    id: 134951975,
    status: "accepted",
    created_at: "2024-03-12T10:30:00Z",
    recipients: [
      {
        phone: "14155552671",
        status: "accepted",
        message_id: 134951975,
      },
    ],
  },
};

export const mockTextMagicBulkSendResponse = {
  success: true,
  result: {
    session_id: 123456,
    batch_size: 100,
    status: "processing",
  },
};

export const mockOneSignalPushResponse = {
  body: {
    id: "notification_123abc",
    recipients: 5000,
  },
};

export const mockOneSignalSegmentResponse = {
  success: true,
  segment: {
    id: "segment_vip_users",
    name: "VIP Users",
    filters: [
      {
        field: "tag",
        value: "vip",
        operator: "=",
      },
    ],
  },
};

export const mockSendBirdUserResponse = {
  user_id: "user_12345",
  nickname: "John Doe",
  profile_url: "https://example.com/profile.jpg",
  created_at: 1710247800,
  is_active: true,
};

export const mockSendBirdChannelResponse = {
  channel_url: "general_channel_123",
  name: "General",
  channel_type: "open_channels",
  is_public: true,
  operator_ids: ["user_admin"],
  member_count: 150,
  created_at: 1710000000,
};

export const mockSendBirdMessageResponse = {
  message_id: 123456789,
  user_id: "user_12345",
  message: "Hello, this is a test message",
  data: "",
  custom_type: "",
  created_at: 1710247800,
  updated_at: 1710247800,
  channel_url: "general_channel_123",
  channel_type: "open_channels",
};

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL PROVIDER FIXTURES (Mailgun, Amazon SES, Gmail, Outlook)
// ─────────────────────────────────────────────────────────────────────────────

export const mockMailgunSendResponse = {
  id: "<20240312.123456.mail@sandbox.mailgun.org>",
  message: "Queued. Thank you.",
};

export const mockMailgunValidateResponse = {
  result: "valid",
  domain: "sandbox.mailgun.org",
  mailbox_verification: "true",
};

export const mockMailgunEventsResponse = {
  items: [
    {
      timestamp: 1710247800,
      event: "delivered",
      delivery_status: {
        attempt_no: 1,
        description: "success",
        certificate_verified: true,
      },
      message: {
        headers: {
          "message-id": "<msg123@sandbox.mailgun.org>",
          from: "sender@sandbox.mailgun.org",
          to: "recipient@example.com",
          subject: "Test Email",
        },
      },
    },
  ],
  paging: {
    first: "",
    last: "",
    next: "",
    previous: "",
  },
};

export const mockSesSendResponse = {
  MessageId: "message_12345-67890-abcdef",
};

export const mockSesTemplateResponse = {
  TemplateName: "OrderConfirmation",
  TemplateArn: "arn:aws:ses:us-east-1:123456789012:template/OrderConfirmation",
  SubjectPart: "Order {{order_id}} Confirmation",
  TextPart: "Your order {{order_id}} has been confirmed.",
  HtmlPart: "<p>Your order {{order_id}} has been confirmed.</p>",
  CreationTime: new Date().toISOString(),
};

export const mockGmailSendResponse = {
  id: "gmail_message_abc123",
  threadId: "gmail_thread_xyz789",
  labelIds: ["SENT"],
};

export const mockGmailListResponse = {
  messages: [
    {
      id: "gmail_msg_123",
      threadId: "gmail_thread_001",
      labelIds: ["INBOX"],
    },
  ],
  resultSizeEstimate: 100,
};

export const mockOutlookSendResponse = {
  id: "AAMkAGVmMDEzNTM4LTZjY2QtNDQzOC04MjQzLTYzOTBmM2QwNzZhMgBGAAAAAAAiN_5wAAAA",
};

export const mockOutlookListResponse = {
  value: [
    {
      id: "outlook_msg_123",
      subject: "Meeting request",
      from: {
        emailAddress: {
          address: "sender@outlook.com",
          name: "John Smith",
        },
      },
      toRecipients: [
        {
          emailAddress: {
            address: "recipient@example.com",
            name: "Jane Doe",
          },
        },
      ],
      receivedDateTime: "2024-03-12T10:30:00Z",
      isRead: false,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ERP PROVIDER FIXTURES (SAP, NetSuite, Dynamics 365, Sage)
// ─────────────────────────────────────────────────────────────────────────────

export const mockSAPBusinessPartnerResponse = {
  d: {
    results: [
      {
        BusinessPartner: "1000001",
        BusinessPartnerName: "Acme Corp",
        CustomerOrVendor: "C",
        City: "New York",
        Country: "US",
        PhoneNumber: "+1-555-0100",
        EmailAddress: "contact@acme.com",
      },
    ],
  },
};

export const mockSAPSalesOrderResponse = {
  d: {
    results: [
      {
        SalesOrder: "1000001",
        SalesOrderDate: "/Date(1710247800000)/",
        SoldToParty: "1000001",
        TotalNetAmount: "10000.00",
        TransactionCurrency: "USD",
        SalesOrderStatus: "A",
        Items: {
          results: [
            {
              SalesOrder: "1000001",
              SalesOrderItem: "10",
              Material: "MAT-001",
              OrderQuantity: "10",
              NetAmount: "1000.00",
            },
          ],
        },
      },
    ],
  },
};

export const mockNetSuiteRecordResponse = {
  response: {
    platformCore: {
      recordRef: {
        internalId: "123456",
        externalId: "EXT-123456",
        type: "customer",
      },
    },
  },
};

export const mockNetSuiteSalesOrderResponse = {
  response: {
    platformCore: {
      recordRef: {
        internalId: "789012",
        type: "salesOrder",
      },
    },
    platformCommon: {
      entityId: "CUST-001",
      tranDate: "2024-03-12T00:00:00",
      total: "15000.00",
      itemList: {
        item: [
          {
            lineNumber: "1",
            item: {
              internalId: "SKU-001",
            },
            quantity: "5",
            amount: "2500.00",
          },
        ],
      },
    },
  },
};

export const mockDynamics365CustomerResponse = {
  value: [
    {
      accountid: "abc123def456",
      name: "Contoso Ltd",
      telephone1: "+1-555-0100",
      emailaddress1: "contact@contoso.com",
      address1_city: "Seattle",
      address1_country: "US",
      _transactioncurrencyid_value: "usd",
    },
  ],
};

export const mockDynamics365SalesOrderResponse = {
  value: [
    {
      salesorderid: "xyz789abc123",
      ordernumber: "SO-001",
      createdon: "2024-03-12T10:30:00Z",
      totalamount: 25000.0,
      statecode: 0,
      statuscode: 1,
      orderdetails: {
        value: [
          {
            salesorderdetailid: "detail_001",
            productid: "prod_001",
            quantity: 10,
            extendedamount: 5000.0,
          },
        ],
      },
    },
  ],
};

export const mockSageContactResponse = {
  id: "contact_123456",
  name: "John Smith",
  email: "john@example.com",
  phone: "+1-555-0100",
  address: {
    street: "123 Business Ave",
    city: "London",
    postcode: "SW1A 1AA",
    country: "GB",
  },
};

export const mockSageInvoiceResponse = {
  id: "invoice_789012",
  reference: "INV-001",
  contact_id: "contact_123456",
  invoice_date: "2024-03-12",
  due_date: "2024-04-12",
  total: 5000.0,
  status: "draft",
  line_items: [
    {
      id: "item_001",
      description: "Consulting Services",
      quantity: 10,
      unit_price: 500.0,
      amount: 5000.0,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// MAPS PROVIDER FIXTURES (HERE Maps, Route4Me)
// ─────────────────────────────────────────────────────────────────────────────

export const mockHEREGeocodeResponse = {
  items: [
    {
      title: "123 Main Street, Boston, MA 02101, United States",
      id: "here:af:streetsection:123main456",
      resultType: "streetAddress",
      address: {
        label: "123 Main Street, Boston, MA 02101, United States",
        countryCode: "USA",
        countryName: "United States",
        state: "MA",
        county: "Suffolk",
        city: "Boston",
        street: "Main Street",
        postalCode: "02101",
        houseNumber: "123",
      },
      position: {
        lat: 42.3601,
        lng: -71.0589,
      },
      access: [
        {
          lat: 42.3601,
          lng: -71.0589,
        },
      ],
      distance: 0,
      mapView: {
        west: -71.0694,
        south: 42.35,
        east: -71.0484,
        north: 42.3702,
      },
    },
  ],
};

export const mockHEEReverseGeocodeResponse = {
  items: [
    {
      title: "123 Main Street, Boston, MA 02101, United States",
      id: "here:af:streetsection:123main456",
      resultType: "streetAddress",
      address: {
        label: "123 Main Street, Boston, MA 02101, United States",
        countryCode: "USA",
        countryName: "United States",
        state: "MA",
        city: "Boston",
        street: "Main Street",
        houseNumber: "123",
      },
      position: {
        lat: 42.3601,
        lng: -71.0589,
      },
      distance: 15,
    },
  ],
};

export const mockHEEAutoSuggestResponse = {
  items: [
    {
      title: "123 Main Street, Boston, MA, United States",
      id: "here:af:streetsection:123main456",
      address: {
        label: "123 Main Street, Boston, MA, United States",
        countryCode: "USA",
        state: "MA",
        city: "Boston",
        street: "Main Street",
        houseNumber: "123",
      },
      position: {
        lat: 42.3601,
        lng: -71.0589,
      },
    },
  ],
};

export const mockRoute4MeOptimizeResponse = {
  optimization_problem_id: "abc123def456ghi",
  state: 5,
  total_route_distance: 52.0,
  total_route_time: 7200,
  total_route_cost: 125.0,
  routes: [
    {
      route_id: "route_001",
      route_name: "Route 1",
      route_distance: 52.0,
      route_time: 7200,
      directions: [
        {
          direction: "Drive 1.2 miles",
          distance: 1.2,
          time: 120,
          turn: "right",
        },
      ],
      addresses: [
        {
          address_id: 123456,
          address: "123 Main St, Boston, MA",
          lat: 42.3601,
          lng: -71.0589,
          sequence_no: 1,
          is_depot: true,
          time_window_start: 0,
          time_window_end: 86400,
        },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// WEBHOOK PAYLOAD GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

export function generateWebhookPayload(
  provider: string,
  eventType: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const timestamp = new Date().toISOString();

  switch (provider) {
    case "vonage":
      return {
        msisdn: data.phone || "14155552671",
        to: data.to || "14155552671",
        message_id: data.message_id || "msg_123",
        status: data.status || "delivered",
        err_code: data.err_code || "0",
        message_timestamp: data.timestamp || timestamp,
      };

    case "sendbird":
      return {
        type: eventType,
        ts: Date.now(),
        data: {
          channel_url: data.channel_url || "general_123",
          user_id: data.user_id || "user_123",
          message: data.message || "Test",
          custom_type: data.custom_type || "",
        },
      };

    case "mailgun":
      return {
        signature: {
          timestamp: Math.floor(Date.now() / 1000).toString(),
          token: "token_123",
          signature: "sig_123",
        },
        "event-data": {
          event: eventType,
          timestamp: Math.floor(Date.now() / 1000),
          id: data.id || "event_123",
          message: {
            headers: {
              to: data.to || "recipient@example.com",
              from: data.from || "sender@mailgun.org",
              subject: data.subject || "Test",
            },
          },
          delivery: {
            status: eventType,
          },
        },
      };

    default:
      return {
        type: eventType,
        timestamp,
        data,
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR RESPONSE FACTORIES
// ─────────────────────────────────────────────────────────────────────────────

export function createErrorResponse(
  statusCode: number,
  provider: string,
  errorCode?: string,
): Record<string, unknown> {
  const errors: Record<number, Record<string, unknown>> = {
    401: {
      error: "Unauthorized",
      message: "Invalid API credentials",
      provider,
      code: errorCode || "AUTH_FAILED",
    },
    403: {
      error: "Forbidden",
      message: "Access denied",
      provider,
      code: errorCode || "ACCESS_DENIED",
    },
    429: {
      error: "Too Many Requests",
      message: "Rate limit exceeded",
      provider,
      code: errorCode || "RATE_LIMIT",
      retry_after: 60,
    },
    500: {
      error: "Internal Server Error",
      message: "Provider service error",
      provider,
      code: errorCode || "PROVIDER_ERROR",
    },
    503: {
      error: "Service Unavailable",
      message: "Provider service temporarily unavailable",
      provider,
      code: errorCode || "SERVICE_UNAVAILABLE",
    },
  };

  return errors[statusCode] || errors[500];
}

export function createTimeoutError(provider: string): Record<string, unknown> {
  return {
    error: "Request Timeout",
    message: `Request to ${provider} timed out`,
    code: "TIMEOUT",
    provider,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK DATA FIXTURES
// ─────────────────────────────────────────────────────────────────────────────

export function generateBulkOrders(
  count: number,
): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_, i) => ({
    order_id: `order_${String(i + 1).padStart(6, "0")}`,
    customer: `Customer ${i + 1}`,
    total: (Math.random() * 10000).toFixed(2),
    status: ["pending", "confirmed", "shipped", "delivered"][
      Math.floor(Math.random() * 4)
    ],
    created_at: new Date(Date.now() - Math.random() * 86400000).toISOString(),
  }));
}

export function generateBulkCustomers(
  count: number,
): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_, i) => ({
    customer_id: `cust_${String(i + 1).padStart(6, "0")}`,
    name: `Customer ${i + 1}`,
    email: `customer${i + 1}@example.com`,
    phone: `+1-555-${String(i).padStart(4, "0")}`,
    city: ["Boston", "New York", "Chicago", "Seattle"][
      Math.floor(Math.random() * 4)
    ],
    status: ["active", "inactive", "suspended"][Math.floor(Math.random() * 3)],
  }));
}

export function generateBulkProducts(
  count: number,
): Array<Record<string, unknown>> {
  return Array.from({ length: count }, (_, i) => ({
    sku: `SKU-${String(i + 1).padStart(6, "0")}`,
    name: `Product ${i + 1}`,
    price: (Math.random() * 5000).toFixed(2),
    quantity: Math.floor(Math.random() * 1000),
    category: ["Electronics", "Clothing", "Books", "Home"][
      Math.floor(Math.random() * 4)
    ],
  }));
}
