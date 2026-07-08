# CRM Integration Guide

CRM systems manage customer relationships, sales pipelines, and support interactions. Witylogix integrates with 8 major CRM platforms to provide delivery visibility and customer experience enhancements.

## Supported CRM Systems

| CRM              | Best For          | Focus               |
| ---------------- | ----------------- | ------------------- |
| **Salesforce**   | Enterprise        | All-in-one CRM      |
| **HubSpot**      | Inbound marketing | Sales + Marketing   |
| **Pipedrive**    | Sales-focused     | Pipeline management |
| **Dynamics CRM** | Microsoft shops   | Enterprise CRM      |
| **Zoho CRM**     | SMB/mid-market    | Affordable CRM      |
| **Freshsales**   | Growing teams     | Modern CRM          |
| **Capsule CRM**  | Small teams       | Lightweight CRM     |
| **Insightly**    | Project-centric   | CRM + Projects      |

## Use Cases

### 1. Delivery Visibility in CRM

Add shipment tracking details directly in customer records:

```javascript
// Show tracking info in customer profile
const customer = await client.integrations.get({
  id: "salesforce-prod",
  entity: "Account",
  externalId: customerId,
});

customer.shipments = await client.shipments.list({
  customerId: customer.id,
  limit: 5,
});

// Update CRM with delivery info
await client.integrations.update({
  id: "salesforce-prod",
  entity: "Account",
  externalId: customerId,
  data: {
    LastDeliveryDate: latestShipment.completedAt,
    TrackingUrl: latestShipment.trackingUrl,
  },
});
```

### 2. Activity Timeline

Log delivery events as CRM activities:

```javascript
// Create activity when delivery completes
const activity = await client.integrations.create({
  id: "salesforce-prod",
  entity: "Task",
  data: {
    Subject: `Delivery Completed - Order #${shipment.orderId}`,
    Description: shipment.proofOfDelivery,
    ActivityDate: shipment.completedAt,
    WhoId: customerId,
    Status: "Completed",
  },
});
```

### 3. Lead/Contact Enrichment

Update contact information from delivery data:

```javascript
// Sync delivery addresses to CRM
const contact = await client.integrations.update({
  id: "hubspot-prod",
  entity: "Contact",
  externalId: contactId,
  data: {
    delivery_address: shipment.dropoffLocation.address,
    delivery_city: shipment.dropoffLocation.city,
    delivery_phone: shipment.dropoffLocation.phone,
    last_delivery: shipment.completedAt,
  },
});
```

## Setup by Platform

### Salesforce

**Best for**: Enterprise organizations with complex CRM needs.

#### 1. Create Connected App

- Salesforce Setup → Apps → App Manager
- Create → Connected App
- Enable OAuth, set Redirect URL
- Copy Consumer Key & Secret

#### 2. Configure in Witylogix

```javascript
const crm = await client.integrations.create({
  provider: "salesforce",
  credentials: {
    consumerKey: "YOUR_CONSUMER_KEY",
    consumerSecret: "YOUR_CONSUMER_SECRET",
    instanceUrl: "https://your-instance.salesforce.com",
    username: "api-user@company.com",
    password: "***",
    securityToken: "YOUR_SECURITY_TOKEN", // if required
  },
  config: {
    syncObjects: ["Account", "Opportunity", "Activity"],
    eventSubscription: true,
  },
});
```

#### 3. Create Custom Fields

```apex
// In Salesforce, create custom fields for delivery data
Account.DeliveryTrackingUrl__c (URL)
Account.LastDeliveryDate__c (Date)
Account.OnTimeDeliveryRate__c (Percent)
```

### HubSpot

**Best for**: Inbound marketing, sales automation.

#### 1. Get API Key

- HubSpot Settings → Integrations → API Key
- Create new API key with required scopes
- Copy the key

#### 2. Configure in Witylogix

```javascript
const crm = await client.integrations.create({
  provider: "hubspot",
  credentials: {
    apiKey: "YOUR_HUBSPOT_API_KEY",
  },
  config: {
    syncObjects: ["contacts", "companies", "deals"],
    eventWebhook: {
      url: "https://your-api.com/webhooks/hubspot",
      events: ["contact.creation", "deal.creation"],
    },
  },
});
```

#### 3. Create Custom Properties

```javascript
// Create custom properties in HubSpot
const properties = [
  {
    name: "delivery_tracking_url",
    label: "Delivery Tracking URL",
    type: "string",
    fieldType: "url",
  },
  {
    name: "last_delivery_date",
    label: "Last Delivery Date",
    type: "string",
    fieldType: "date",
  },
  {
    name: "on_time_rate",
    label: "On-Time Delivery Rate",
    type: "number",
    fieldType: "number",
  },
];
```

### Pipedrive

**Best for**: Sales-focused teams.

#### 1. Get API Token

- Pipedrive Settings → Personal Preferences → API
- Copy your API token

#### 2. Configure in Witylogix

```javascript
const crm = await client.integrations.create({
  provider: "pipedrive",
  credentials: {
    apiToken: "YOUR_PIPEDRIVE_API_TOKEN",
  },
  config: {
    syncObjects: ["persons", "deals", "activities"],
  },
});
```

### Dynamics CRM

**Best for**: Microsoft-centric enterprises.

#### 1. Create App Registration

- Azure AD → App Registrations
- Create new app
- Copy Application ID, Directory ID
- Create client secret

#### 2. Configure in Witylogix

```javascript
const crm = await client.integrations.create({
  provider: "dynamicsCRM",
  credentials: {
    tenantId: "YOUR_TENANT_ID",
    clientId: "YOUR_CLIENT_ID",
    clientSecret: "YOUR_CLIENT_SECRET",
    organizationUrl: "https://org.crm.dynamics.com",
  },
  config: {
    apiVersion: "v9.2",
    syncObjects: ["accounts", "contacts", "opportunities"],
  },
});
```

### Zoho CRM, Freshsales, Others

**Similar OAuth pattern:**

```javascript
const crm = await client.integrations.create({
  provider: "zoho|freshsales|capsule|insightly",
  credentials: {
    clientId: "YOUR_CLIENT_ID",
    clientSecret: "YOUR_CLIENT_SECRET",
    accessToken: "OAUTH_ACCESS_TOKEN",
    refreshToken: "OAUTH_REFRESH_TOKEN",
  },
  config: {
    syncObjects: ["contacts", "companies"],
  },
});
```

## Data Sync Patterns

### Pull (Polling)

```javascript
// Sync customers from CRM periodically
const syncCustomers = async () => {
  const customers = await client.integrations.list({
    id: "salesforce-prod",
    entity: "Account",
    filter: { LastModifiedDate: { after: lastSyncTime } },
  });

  for (const customer of customers) {
    await client.customers.upsert({
      externalId: customer.Id,
      name: customer.Name,
      email: customer.BillingStreet,
      addresses: extractAddresses(customer),
    });
  }
};
```

### Push (Webhooks)

```javascript
// CRM fires webhook on customer/deal changes
app.post("/webhooks/crm", async (req, res) => {
  const { entity, action, data } = req.body;

  if (entity === "Account" && action === "updated") {
    await client.customers.update({
      externalId: data.Id,
      ...mapCustomer(data),
    });
  }

  res.json({ processed: true });
});
```

## Field Mapping

### Account/Company Mapping

```javascript
const mapping = {
  externalId: "crm.accountId",
  name: "crm.name",
  industry: "crm.industry",
  email: "crm.billingEmail",
  phone: "crm.billingPhone",
  address: {
    street: "crm.billingStreet",
    city: "crm.billingCity",
    state: "crm.billingState",
    zip: "crm.billingPostalCode",
  },
  metadata: {
    annualRevenue: "crm.annualRevenue",
    employees: "crm.numberOfEmployees",
    website: "crm.website",
  },
};
```

### Contact/Person Mapping

```javascript
const contactMapping = {
  externalId: "crm.contactId",
  firstName: "crm.firstName",
  lastName: "crm.lastName",
  email: "crm.email",
  phone: "crm.mobilePhone",
  title: "crm.jobTitle",
  companyId: "crm.accountId",
  addresses: [
    {
      type: "billing",
      street: "crm.mailingStreet",
      city: "crm.mailingCity",
      zip: "crm.mailingPostalCode",
    },
  ],
};
```

### Activity Mapping

```javascript
const activityMapping = {
  externalId: "crm.taskId",
  type: "delivery_event", // custom activity type
  title: `Delivery Completed - Order #${shipment.orderId}`,
  description: shipment.proofOfDelivery,
  date: shipment.completedAt,
  customerId: shipment.customerId,
  metadata: {
    trackingUrl: shipment.trackingUrl,
    signature: shipment.signature,
    location: shipment.actualDeliveryLocation,
  },
};
```

## Event Subscriptions

### Shipment Events → CRM Activities

```javascript
const webhook = await client.webhooks.create({
  integration: "salesforce",
  events: [
    "shipment.created",
    "shipment.updated",
    "shipment.completed",
    "shipment.failed",
  ],
  handler: async (event) => {
    const activity = {
      entity: "Task",
      Subject: event.title,
      Description: event.details,
      WhoId: event.customerId,
      ActivityDate: event.timestamp,
    };

    await client.integrations.create({
      id: "salesforce-prod",
      entity: "Task",
      data: activity,
    });
  },
});
```

## Sync Frequency

```javascript
const syncConfig = {
  customerData: {
    frequency: "every-6-hours", // Contact changes less frequently
    priority: "normal",
  },
  deliveryActivity: {
    frequency: "real-time", // Delivery events logged immediately
    priority: "high",
  },
  opportunityData: {
    frequency: "every-hour", // Order status changes
    priority: "high",
  },
};
```

## Monitoring

```javascript
const syncHealth = await client.integrations.health({
  id: "salesforce-prod",
});

// {
//   status: "healthy",
//   lastSync: "2024-03-16T14:30:00Z",
//   recordsSynced: 523,
//   errorRate: 0%,
//   fieldMappingIssues: 0,
// }
```

## Best Practices

1. **Map customer IDs consistently**
   - Use external ID as primary key
   - Prevent duplicates

2. **Log delivery events as activities**
   - Creates audit trail
   - Improves customer communication
   - Helps with disputes

3. **Keep contact data current**
   - Sync delivery addresses
   - Update phone/email from delivery
   - Use latest info for future orders

4. **Respect CRM API limits**
   - Batch updates where possible
   - Use scheduling over real-time
   - Monitor API usage

5. **Test in sandbox**
   - Validate field mappings
   - Run full sync dry-run
   - Check for data loss

## Troubleshooting

| Issue                 | Cause                      | Solution                  |
| --------------------- | -------------------------- | ------------------------- |
| Sync failing          | Invalid credentials        | Revalidate API key/token  |
| Missing custom fields | Field not created in CRM   | Create field in CRM first |
| Duplicate records     | No external ID mapping     | Add external ID mapping   |
| Data loss             | Overwriting active records | Implement merge logic     |
| Rate limited          | Too many API calls         | Implement batching/delays |

## Next Steps

- [Configure integrations](/docs/integrations/OVERVIEW)
- [Setup ERP](/docs/integrations/guides/erp)
- [Setup messaging](/docs/integrations/guides/messaging)
