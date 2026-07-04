# ERP Integration Guide

ERP systems are the source of truth for orders, inventory, and financial data. Witylogix supports 11 major ERP platforms, enabling seamless order-to-delivery workflows and real-time inventory synchronization.

## Supported ERP Systems

| ERP                   | Focus               | Best For                      | Complexity |
| --------------------- | ------------------- | ----------------------------- | ---------- |
| **SAP**               | Enterprise          | Large enterprises             | High       |
| **NetSuite**          | Cloud ERP           | Mid-market to enterprise      | High       |
| **Dynamics 365**      | Microsoft ecosystem | Microsoft-centric enterprises | High       |
| **Sage Intacct**      | Financial focus     | Mid-market                    | Medium     |
| **Odoo**              | Open-source         | SMB + custom needs            | Medium     |
| **QuickBooks Online** | SMB accounting      | Small businesses              | Low        |
| **Infor**             | Industry-specific   | Manufacturing/distribution    | High       |
| **Epicor**            | Manufacturing       | Makers and distributors       | High       |
| **FreshBooks**        | Accounting          | Freelance/small business      | Low        |
| **Wave**              | Free accounting     | Micro-business                | Low        |
| **Xero**              | Cloud accounting    | SMB                           | Low        |

## Integration Patterns

### Order Sync (ERP → Witylogix)

```
ERP creates order
    ↓
Webhook fired
    ↓
Witylogix creates shipment
    ↓
Order management updated with tracking
```

### Inventory Sync (Bidirectional)

```
Witylogix ships item
    ↓
Update inventory in ERP
    ↓
ERP reorder trigger
    ↓
Replenishment order created
```

## Setup by System

### SAP

**Best for**: Large enterprises with complex supply chains.

#### 1. Configure Connection

```javascript
const erp = await client.integrations.create({
  provider: "sap",
  credentials: {
    systemId: "SID",
    clientId: "100",
    username: "WITYLOGIX_USER",
    password: "***",
    language: "EN",
    router: "sap-router.example.com",
  },
  config: {
    modules: ["orders", "inventory", "materials"],
    syncFrequency: 300, // seconds
  },
});
```

#### 2. Field Mapping

```javascript
const mapping = {
  order: {
    sap: "VBAK/VBAP",
    witylogix: "shipment",
    fields: {
      "VBAK-VBELN": "externalOrderId",
      "VBAK-KUNNR": "customerId",
      "VBAP-ARKTX": "itemDescription",
      "VBAP-KWMENG": "quantity",
    },
  },
  inventory: {
    sap: "MARD",
    witylogix: "inventory",
    fields: {
      MATNR: "sku",
      LABST: "availableQuantity",
      UMLMC: "inTransitQuantity",
    },
  },
};
```

### NetSuite

**Best for**: Mid-market to enterprise cloud-native companies.

#### 1. Create Integration User

- NetSuite → Setup → Integration
- Create new **Integration Record**
- Note: ConsumerKey, ConsumerSecret
- Create **Token ID & Secret**

#### 2. Configure OAuth

```javascript
const erp = await client.integrations.create({
  provider: "netsuite",
  credentials: {
    accountId: "YOUR_ACCOUNT_ID",
    consumerKey: "YOUR_CONSUMER_KEY",
    consumerSecret: "YOUR_CONSUMER_SECRET",
    tokenId: "YOUR_TOKEN_ID",
    tokenSecret: "YOUR_TOKEN_SECRET",
  },
  config: {
    realm: "PRODUCTION", // or SANDBOX
    version: "2.1",
    syncEntities: ["orders", "inventory", "customers"],
  },
});
```

#### 3. SuiteQL for Sync

```javascript
// Query orders for sync
const orders = await client.integrations.query({
  id: "netsuite-prod",
  query: `
    SELECT id, entity, trandate, subtotal
    FROM transaction
    WHERE type='salesorder'
    AND lastmodifieddate > ?
  `,
  params: [lastSyncTime],
});
```

### Dynamics 365

**Best for**: Microsoft ecosystem integrations.

#### 1. Register Azure AD Application

- Azure Portal → App registrations
- Create new application
- Copy ClientId & TenantId
- Create client secret

#### 2. Configure in Witylogix

```javascript
const erp = await client.integrations.create({
  provider: "dynamics365",
  credentials: {
    tenantId: "YOUR_TENANT_ID",
    clientId: "YOUR_CLIENT_ID",
    clientSecret: "YOUR_CLIENT_SECRET",
    organizationUrl: "https://org.crm.dynamics.com",
  },
  config: {
    environment: "production",
    entities: ["orders", "inventory", "accounts"],
    apiVersion: "v9.2",
  },
});
```

### Sage Intacct

**Best for**: Financial accuracy and compliance-focused orgs.

#### 1. Get API Credentials

- Sage Intacct → Admin → API Approvals
- Create new API user
- Generate **SessionID** or use **Sender ID**

#### 2. Configure in Witylogix

```javascript
const erp = await client.integrations.create({
  provider: "sage",
  credentials: {
    senderId: "YOUR_SENDER_ID",
    senderPassword: "***",
    username: "WITYLOGIX_USER",
    userPassword: "***",
    entityId: "PARENT_ENTITY",
  },
  config: {
    encoding: "UTF-8",
    dtdVersion: "ia.dtd",
  },
});
```

### Odoo

**Best for**: Open-source flexibility, custom workflows.

#### 1. Create API User

- Odoo → Settings → Users & Companies
- Create new user with API token
- Note the token and database name

#### 2. Configure in Witylogix

```javascript
const erp = await client.integrations.create({
  provider: "odoo",
  credentials: {
    url: "https://your-odoo-instance.com",
    database: "your_database",
    username: "witylogix_user",
    apiToken: "YOUR_API_TOKEN",
  },
  config: {
    models: ["sale.order", "stock.move", "product.product"],
    webhookSecret: "YOUR_WEBHOOK_SECRET",
  },
});
```

### QuickBooks Online

**Best for**: Small businesses, accounting-focused.

#### 1. OAuth Setup

- Create app at [developer.intuit.com](https://developer.intuit.com)
- Get ClientID, ClientSecret
- Authorize Witylogix

#### 2. Configure in Witylogix

```javascript
const erp = await client.integrations.create({
  provider: "quickbooks",
  credentials: {
    clientId: "YOUR_CLIENT_ID",
    clientSecret: "YOUR_CLIENT_SECRET",
    realmId: "YOUR_REALM_ID", // QuickBooks Company ID
    accessToken: "OAUTH_ACCESS_TOKEN",
    refreshToken: "OAUTH_REFRESH_TOKEN",
  },
  config: {
    entityType: "SalesOrder",
    syncAccounts: false,
  },
});
```

### Xero, FreshBooks, Wave

**Similar setup pattern:**

```javascript
// Generic cloud accounting template
const erp = await client.integrations.create({
  provider: "xero|freshbooks|wave",
  credentials: {
    clientId: "YOUR_CLIENT_ID",
    clientSecret: "YOUR_CLIENT_SECRET",
    accessToken: "OAUTH_TOKEN",
    tenantId: "YOUR_TENANT_ID", // if applicable
  },
  config: {
    syncFrequency: 3600, // hourly
    entities: ["invoices", "contacts"],
  },
});
```

## Sync Patterns

### Order Syncing

#### Pull (Polling)

```javascript
// Check ERP for new orders every N seconds
const sync = setInterval(async () => {
  const orders = await client.integrations.query({
    id: "erp-prod",
    query: "SELECT * FROM Orders WHERE synced=0",
  });

  for (const order of orders) {
    await client.shipments.create({
      externalOrderId: order.id,
      pickupLocation: order.warehouse,
      dropoffLocation: order.destination,
      items: order.lineItems,
    });

    await client.integrations.markSynced({
      id: "erp-prod",
      orderId: order.id,
    });
  }
}, 300000); // 5 minutes
```

#### Push (Webhooks)

```javascript
// ERP sends webhook when order changes
app.post("/webhooks/erp", async (req, res) => {
  const { orderId, action } = req.body;

  if (action === "created") {
    const order = await fetchOrderFromERP(orderId);
    const shipment = await client.shipments.create({
      externalOrderId: orderId,
      ...mapOrder(order),
    });
  }

  res.json({ synced: true });
});
```

### Inventory Syncing

#### Real-time Updates

```javascript
// After delivery, update inventory in ERP
const webhook = await client.webhooks.create({
  events: ["shipment.completed"],
  handler: async (event) => {
    for (const item of event.shipment.items) {
      await client.integrations.updateInventory({
        id: "erp-prod",
        sku: item.sku,
        quantityDelivered: item.quantity,
      });
    }
  },
});
```

#### Scheduled Reconciliation

```javascript
// Daily inventory reconciliation
const job = schedule.scheduleJob("0 2 * * *", async () => {
  const local = await client.inventory.list();
  const remote = await client.integrations.getInventory({
    id: "erp-prod",
  });

  const discrepancies = findDifferences(local, remote);
  await notifyAdmin(discrepancies);
});
```

## Field Mapping

### Order Mapping Template

```javascript
const orderMapping = {
  externalOrderId: "erp.order_number",
  customerId: "erp.customer_id",
  customerName: "erp.bill_to.name",
  customerEmail: "erp.bill_to.email",
  customerPhone: "erp.bill_to.phone",

  pickupAddress: {
    street: "erp.warehouse.address1",
    city: "erp.warehouse.city",
    state: "erp.warehouse.state",
    zip: "erp.warehouse.zip",
    country: "erp.warehouse.country",
  },

  dropoffAddress: {
    street: "erp.customer.address1",
    city: "erp.customer.city",
    state: "erp.customer.state",
    zip: "erp.customer.zip",
    country: "erp.customer.country",
  },

  items: [
    {
      sku: "erp.line_item.product_code",
      quantity: "erp.line_item.qty_ordered",
      weight: "erp.line_item.weight",
      dimensions: {
        length: "erp.line_item.length",
        width: "erp.line_item.width",
        height: "erp.line_item.height",
      },
    },
  ],

  specialInstructions: "erp.notes",
  requiredDeliveryDate: "erp.promise_date",
  value: "erp.total",
};
```

### Inventory Mapping Template

```javascript
const inventoryMapping = {
  sku: "erp.product_code",
  description: "erp.product_name",
  quantityOnHand: "erp.available_qty",
  quantityReserved: "erp.reserved_qty",
  quantityInTransit: "erp.in_transit_qty",
  reorderPoint: "erp.reorder_level",
  lastCountDate: "erp.last_count_date",
  warehouseLocation: "erp.location_code",
};
```

## Error Handling

### Sync Failures

```javascript
const syncErrors = [
  {
    errorCode: "MAPPING_ERROR",
    message: "Required field missing",
    resolution: "Update field mapping configuration",
  },
  {
    errorCode: "DUPLICATE_ORDER",
    message: "Order already synced",
    resolution: "Implement deduplication logic",
  },
  {
    errorCode: "API_QUOTA",
    message: "ERP API rate limit exceeded",
    resolution: "Implement exponential backoff",
  },
];
```

### Retry Strategy

```javascript
const retryConfig = {
  maxRetries: 3,
  backoffMultiplier: 2,
  initialDelay: 1000, // ms
  maxDelay: 60000,
  onRetry: (error, attempt) => {
    console.log(`Retrying sync (attempt ${attempt})`, error.message);
  },
};
```

## Monitoring Sync Health

```javascript
const health = await client.integrations.health({
  id: "erp-prod",
});

// {
//   status: "healthy",
//   lastSuccessfulSync: "2024-03-16T14:30:00Z",
//   syncDelay: 45, // seconds
//   recordsSynced: 1243,
//   recordsFailed: 2,
//   errorRate: 0.16%, // 2/1245
// }
```

## Best Practices

1. **Map all critical fields**
   - Order ID, customer info, addresses
   - Item details, quantities, pricing
   - Dates (order, promise, actual delivery)

2. **Implement idempotency**
   - Use external order ID as unique key
   - Prevent duplicate syncs
   - Handle retries safely

3. **Monitor sync delays**
   - Alert if sync > 5 minutes late
   - Escalate if > 1 hour
   - Investigate ERP API issues

4. **Test in sandbox first**
   - Use ERP test environment
   - Validate mappings with real data
   - Run full sync dry-run

5. **Implement fallback logic**
   - Queue failed syncs for retry
   - Notify ops team of persistent failures
   - Manual sync trigger option

## Troubleshooting

| Issue               | Cause                        | Solution                            |
| ------------------- | ---------------------------- | ----------------------------------- |
| Orders not syncing  | Webhook not configured       | Enable webhooks in ERP              |
| Wrong field mapping | Mapping configuration        | Review and update field mapping     |
| Duplicate orders    | No idempotency key           | Add order ID uniqueness check       |
| Missing data        | Insufficient ERP permissions | Grant user all required permissions |
| Slow sync           | Large dataset                | Implement pagination or delta sync  |

## Next Steps

- [Configure integrations](/docs/integrations/OVERVIEW)
- [Setup CRM](/docs/integrations/guides/crm)
- [View all integrations](/docs/integrations/catalog)
