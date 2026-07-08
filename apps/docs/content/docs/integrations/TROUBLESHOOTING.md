# Integration Troubleshooting Guide

Common integration issues and solutions.

## Connection & Authentication

### "Invalid Credentials" / "Authentication Failed"

**Causes:**

- Expired API key or token
- Wrong credentials entered
- Provider account disabled
- IP whitelist restriction

**Solutions:**

1. **Verify credentials in provider account**

   ```
   Settings → API Keys/Tokens → Copy fresh key
   ```

2. **Check credential expiration**
   - Some providers (OAuth) have refresh tokens that expire
   - Rotate credentials quarterly

3. **Validate whitelist settings**
   - Ask provider: "Is our IP whitelisted?"
   - Some enterprise providers restrict by IP

4. **Test credentials with provider's CLI**

   ```bash
   # Mapbox
   curl https://api.mapbox.com/geocoding/v5/mapbox.places/Los%20Angeles.json?access_token=YOUR_TOKEN

   # AWS
   aws ec2 describe-instances --region us-east-1
   ```

5. **Re-authenticate OAuth integrations**
   - Dashboard → Integration → Disconnect & Reconnect
   - Grant permissions again

---

### "Connection Timeout" / Provider Unreachable

**Causes:**

- Provider API down
- Network connectivity issue
- Firewall blocking requests
- SSL/TLS certificate error

**Solutions:**

1. **Check provider status page**

   ```
   Mapbox: status.mapbox.com
   Stripe: status.stripe.com
   Salesforce: trust.salesforce.com
   ```

2. **Verify network connectivity**

   ```bash
   # Test DNS
   nslookup api.mapbox.com

   # Test connection
   ping api.mapbox.com

   # Test HTTPS
   curl -v https://api.mapbox.com/status
   ```

3. **Check firewall rules**
   - Whitelist provider API IP ranges
   - Check VPN/proxy logs
   - Temporarily disable firewall to test

4. **Enable fallback provider**
   ```javascript
   // Configure automatic fallback
   const integration = await client.integrations.create({
     provider: "mapbox",
     fallback: {
       enabled: true,
       providers: ["here", "graphhopper"],
     },
   });
   ```

---

## Data Sync Issues

### "Records Not Syncing" / Webhook Not Working

**Causes:**

- Webhook not configured in provider
- Webhook endpoint unreachable
- Sync disabled or paused
- Payload format mismatch

**Solutions:**

1. **Verify webhook is configured**
   - ERP: Settings → API → Webhooks
   - Check webhook URL matches exactly
   - Verify SSL/TLS certificate valid

2. **Test webhook endpoint**

   ```bash
   # Send test payload
   curl -X POST https://your-api.com/webhooks/erp \
     -H "Content-Type: application/json" \
     -d '{"test": true}'

   # Check response
   # Should return 200 OK
   ```

3. **Check webhook logs**

   ```
   Dashboard → Integrations → [Provider] → Logs
   Look for failed webhook attempts
   ```

4. **Verify SSL certificate**

   ```bash
   # Check certificate expiration
   openssl s_client -connect your-api.com:443 -servername your-api.com
   ```

5. **Manually trigger sync**
   ```javascript
   // Force sync immediately
   const sync = await client.integrations.sync({
     id: "netsuite-prod",
     force: true,
   });
   ```

---

### "Sync Running But No Data Updates"

**Causes:**

- Field mapping incorrect
- Schema mismatch between systems
- Data filtering too restrictive
- Sync paused or disabled

**Solutions:**

1. **Review field mapping**

   ```
   Dashboard → [Integration] → Configuration
   Check all required fields are mapped
   ```

2. **Test mapping with sample data**

   ```javascript
   // Validate mapping
   const testData = {
     sourceField: "value",
     ...
   };

   const mapped = mapFields(testData);
   console.log(mapped); // Should have all required fields
   ```

3. **Check sync schedule**

   ```
   Dashboard → [Integration] → Sync Settings
   Verify schedule is active and not paused
   View "Last Sync" timestamp
   ```

4. **Review sync logs**

   ```
   Dashboard → [Integration] → Logs
   Look for errors in most recent sync
   ```

5. **Test with simpler data**
   - Create test record in source system
   - Run manual sync
   - Check if test record appears

---

### "Duplicate Records Created"

**Causes:**

- No idempotency key/external ID
- Sync retry without deduplication
- Multiple integrations syncing same data
- Webhook fired multiple times

**Solutions:**

1. **Implement external ID mapping**

   ```javascript
   // Use source system ID as unique key
   const shipment = await client.shipments.create({
     externalOrderId: order.id, // Use ERP order ID
     ...
   });

   // On retry, system recognizes existing record
   const existing = await client.shipments.getByExternalId(
     order.id
   );
   ```

2. **Add deduplication logic**

   ```javascript
   // Check before creating
   const existing = await client.shipments.list({
     externalOrderId: order.id,
   });

   if (existing.length > 0) {
     // Update instead of create
     await existing[0].update({...});
   } else {
     // Create new
     await client.shipments.create({...});
   }
   ```

3. **Disable duplicate webhooks**
   - Check provider isn't firing webhook multiple times
   - Review webhook logs for duplicates
   - Contact provider support if issue persists

---

## API Rate Limiting

### "Rate Limited" / "Quota Exceeded"

**Causes:**

- Too many requests to provider API
- Batch sync too large
- Retry loops creating storm

**Solutions:**

1. **Understand provider limits**

   ```
   Mapbox: 600 req/min for most tiers
   Stripe: 100 req/sec for production
   Salesforce: 15,000 API calls/24 hours
   ```

2. **Implement rate limiting on Witylogix side**

   ```javascript
   // Add delays between requests
   const delay = (ms) => new Promise((r) => setTimeout(r, ms));

   for (const item of items) {
     await processItem(item);
     await delay(100); // 100ms between requests
   }
   ```

3. **Use batch APIs when available**

   ```javascript
   // Bad: Individual requests
   for (const order of orders) {
     await createShipment(order);
   }

   // Good: Batch request
   await createShipmentsInBatch(orders);
   ```

4. **Enable fallback billing**

   ```javascript
   // Use Witylogix credits when provider quota exhausted
   const integration = await client.integrations.update({
     id: "mapbox-prod",
     fallback: {
       enabled: true,
       maxCost: 500, // dollars/month
     },
   });
   ```

5. **Upgrade provider plan**
   - Increase API quota in provider account
   - Move to higher tier if needed
   - Contact sales for volume discounts

---

## Data Quality Issues

### "Wrong/Corrupted Data in Destination System"

**Causes:**

- Field mapping error
- Type mismatch (string vs number)
- Required field missing
- Special characters causing encoding issues

**Solutions:**

1. **Validate before sync**

   ```javascript
   // Add validation schema
   const schema = {
     orderId: { type: "string", required: true },
     qty: { type: "number", required: true },
     address: { type: "string", required: true },
   };

   // Check against schema
   const errors = validate(data, schema);
   if (errors) {
     console.log("Validation failed:", errors);
     // Skip sync or notify
   }
   ```

2. **Add field type casting**

   ```javascript
   // Convert string to number
   const quantity = parseInt(data.quantity, 10);

   // Convert to ISO date
   const date = new Date(data.deliveryDate).toISOString();
   ```

3. **Handle special characters**

   ```javascript
   // Escape quotes, newlines, etc.
   const sanitized = data.replace(/"/g, '\\"').replace(/\n/g, "\\n");
   ```

4. **Test with real data**
   - Export sample data from source
   - Run through mapping
   - Verify output matches expectation

---

### "Missing Data / Null Values"

**Causes:**

- Source system field is empty
- Field not included in sync
- Conditional field not met
- API response incomplete

**Solutions:**

1. **Check source data first**

   ```
   Verify field exists and has value in source system
   Don't assume provider returns all fields
   ```

2. **Make fields optional in mapping**

   ```javascript
   const mapping = {
     orderId: "required",
     phone: "optional", // Can be null
     instructions: "optional",
   };
   ```

3. **Provide defaults**

   ```javascript
   const dropoffPhone = order.phone || customer.phone || "";
   ```

4. **Review provider API docs**
   - Check if field is conditionally returned
   - Verify your API key has permission to read field
   - Check if field requires special scope

---

## Performance Issues

### "Sync Running Slowly" / High Latency

**Causes:**

- Large dataset size
- Network latency
- Provider API slow
- Local processing bottleneck

**Solutions:**

1. **Use pagination for large syncs**

   ```javascript
   const pageSize = 100;
   let page = 1;
   let hasMore = true;

   while (hasMore) {
     const results = await client.integrations.list({
       id: "erp-prod",
       limit: pageSize,
       offset: (page - 1) * pageSize,
     });

     // Process results
     page++;
     hasMore = results.length === pageSize;
   }
   ```

2. **Implement delta sync (only changes)**

   ```javascript
   // Query only records modified since last sync
   const orders = await client.integrations.list({
     filter: {
       lastModified: { after: lastSyncTime },
     },
   });
   ```

3. **Reduce polling frequency if acceptable**

   ```javascript
   // Instead of every 5 min, sync every 30 min
   const syncConfig = {
     frequency: 1800, // 30 minutes
   };
   ```

4. **Check network latency**

   ```bash
   # Test latency to provider
   ping api.mapbox.com

   # Test API response time
   time curl https://api.mapbox.com/status
   ```

---

## Health Check Failures

### "Integration Status: Failed" / Health Check Failing

**Causes:**

- Connection issue
- Credentials expired
- API endpoint changed
- Provider outage

**Solutions:**

1. **Check health status details**

   ```
   Dashboard → [Integration] → Health
   Review error message and timestamp
   ```

2. **Verify credentials again**

   ```javascript
   // Re-enter credentials
   const updated = await client.integrations.update({
     id: "mapbox-prod",
     credentials: {
       apiKey: "pk_NEW_KEY", // New key
     },
   });
   ```

3. **Check provider API status**

   ```
   https://status.mapbox.com
   https://status.stripe.com
   https://status.twilio.com
   ```

4. **Manually test connection**

   ```bash
   # Replace with your provider API
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://api.provider.com/v1/health
   ```

5. **Reconnect if OAuth**
   - Dashboard → [Integration] → Disconnect
   - Click "Connect" and re-authorize
   - Refresh OAuth token

---

## Webhook Signature Verification

### "Webhook Signature Invalid" / Signature Verification Failing

**Causes:**

- Wrong secret key
- Payload modified in transit
- Encoding mismatch
- Timestamp validation too strict

**Solutions:**

1. **Verify secret key**

   ```
   Dashboard → [Integration] → Webhooks → Secret Key
   Copy exact secret (no spaces/characters)
   ```

2. **Check signature algorithm**

   ```javascript
   // Most use HMAC-SHA256
   const crypto = require("crypto");

   const signature = crypto
     .createHmac("sha256", secret)
     .update(payload)
     .digest("hex");
   ```

3. **Use raw request body**

   ```javascript
   // Use raw bytes, not parsed JSON
   const rawBody = req.rawBody; // Must be raw bytes

   // Bad:
   const signature = sign(JSON.stringify(req.body));

   // Good:
   const signature = sign(req.rawBody);
   ```

4. **Relax timestamp validation**

   ```javascript
   // Allow 5 min clock skew
   const allowedClockSkew = 300; // seconds

   if (Math.abs(Date.now() - signatureTime) > allowedClockSkew) {
     // Reject
   }
   ```

---

## Getting Help

### When to Contact Support

1. **Provider connectivity issues**
   - Provider API down
   - IP whitelist issues
   - SSL certificate problems

2. **Complex field mapping**
   - Unusual schema
   - Custom fields
   - Complex business logic

3. **Performance tuning**
   - Very high volume syncs
   - Complex integrations
   - Custom optimization

### Information to Provide

When contacting support, include:

```
1. Integration: [Provider Name]
2. Error: [Full error message]
3. Timestamp: [When issue occurred]
4. Environment: [Sandbox/Production]
5. Last successful sync: [Date/time]
6. Affected records: [Sample data]
7. Steps to reproduce: [How to trigger error]
8. Screenshots: [Error messages, logs]
```

### Useful Logs to Collect

```
Dashboard → [Integration] → Logs
Copy entire error log entry
Include timestamps and error codes
```

---

## Quick Reference

| Issue          | First Check          | Quick Fix            |
| -------------- | -------------------- | -------------------- |
| Auth failed    | Credentials expired? | Re-enter API key     |
| Timeout        | Provider down?       | Check status page    |
| No data synced | Webhook configured?  | Enable in provider   |
| Duplicates     | External ID mapped?  | Add dedup logic      |
| Rate limited   | Sync frequency?      | Reduce polling       |
| Wrong data     | Field mapping?       | Review & fix mapping |
| Slow sync      | Large dataset?       | Use pagination       |
| Health failing | Credentials valid?   | Refresh/reconnect    |

## Next Steps

- [View integrations documentation](/docs/integrations/OVERVIEW)
- [Browse integration catalog](/docs/integrations/catalog)
- [Contact support](mailto:support@witylogix.com)
