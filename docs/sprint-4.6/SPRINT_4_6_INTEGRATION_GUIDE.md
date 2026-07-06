# Sprint 4.6 Integration Guide

## Quick Start Integration

### Step 1: Update Settings Layout Navigation

**File**: `/apps/dashboard/src/app/(dashboard)/settings/layout.tsx`

Add the notification link to `SIDEBAR_LINKS`:

```tsx
{
  href: "/settings/notifications",
  label: "Notifications",
  icon: <Bell className="w-4 h-4" />,
  description: "Manage notification preferences",
},
```

### Step 2: Register API Routes

**File**: `/apps/api/src/index.ts` (or main server file)

```typescript
import notificationPreferencesRouter from "./routes/notification-preferences";

// Register routes
app.use("/api", notificationPreferencesRouter);
```

### Step 3: Update Environment Variables

Add to `.env.local`:

```env
# Email Provider
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your_key_here
SMTP_HOST=smtp.example.com
SMTP_PORT=587

# SMS Provider
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token

# WhatsApp
WHATSAPP_BUSINESS_ACCOUNT_ID=your_account_id
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
WHATSAPP_ACCESS_TOKEN=your_token

# Push Notifications
FCM_PROJECT_ID=your_project
FCM_PRIVATE_KEY=your_key
```

### Step 4: Database Migration

Run migration to create the `notification_preferences` table:

```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customerId VARCHAR(255) UNIQUE NOT NULL,
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT true,
  whatsapp_enabled BOOLEAN DEFAULT false,
  push_enabled BOOLEAN DEFAULT true,
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start VARCHAR(5),
  quiet_hours_end VARCHAR(5),
  quiet_hours_timezone VARCHAR(50) DEFAULT 'UTC',
  preferred_channel VARCHAR(20) DEFAULT 'email',
  marketing_consent BOOLEAN DEFAULT false,
  event_preferences JSONB,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_prefs_customer_id
  ON notification_preferences(customerId);
```

Or using Prisma:

```bash
npx prisma migrate dev --name add_notification_preferences
```

### Step 5: Add Widget to Dashboard

**File**: `/apps/dashboard/src/app/page.tsx`

```typescript
import { NotificationStatsWidget } from "@/components/notifications/notification-stats-widget";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Existing content */}

      {/* Add notification widget */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Notification Summary</h2>
        <NotificationStatsWidget />
      </section>
    </div>
  );
}
```

### Step 6: Run Tests

```bash
# Run preference manager tests
npm test -- preference-manager.test.ts

# Run all notification tests
npm test -- notification

# With coverage
npm test -- --coverage notification
```

### Step 7: Start Development Server

```bash
# Install dependencies if needed
npm install

# Start development server
npm run dev

# The application will be available at http://localhost:3000
```

---

## Verification Checklist

### ✅ Settings Integration

- [ ] Notification link appears in settings sidebar
- [ ] Settings page loads without errors
- [ ] Channel configuration forms work
- [ ] Rate limit inputs accept values
- [ ] Credentials can be saved/retrieved

### ✅ Template System

- [ ] Templates page loads with sample data
- [ ] Filtering by event type works
- [ ] Template editor opens correctly
- [ ] Variables insert correctly into templates
- [ ] Preview updates in real-time
- [ ] Test send button works

### ✅ WhatsApp Manager

- [ ] WhatsApp page loads
- [ ] Templates display with status
- [ ] New template modal opens
- [ ] Meta sync button works
- [ ] Component builder functions

### ✅ Notification Log

- [ ] Log page displays notifications
- [ ] Filtering works (channel, status, date)
- [ ] Detail modal opens
- [ ] Export CSV button works
- [ ] Statistics update correctly

### ✅ API Integration

- [ ] GET /notifications/preferences/:customerId returns data
- [ ] PUT /notifications/preferences/:customerId updates
- [ ] POST /notifications/preferences/unsubscribe works
- [ ] GET /notifications/preferences/:customerId/check validates
- [ ] Error handling returns proper status codes

### ✅ Widget Integration

- [ ] NotificationStatsWidget renders on dashboard
- [ ] Statistics display correct values
- [ ] Charts visualize properly
- [ ] No console errors

---

## File Structure Reference

```
witylogix-platform/
├── apps/
│   ├── api/
│   │   └── src/routes/
│   │       └── notification-preferences.ts [NEW]
│   └── dashboard/
│       └── src/
│           ├── app/(dashboard)/
│           │   ├── notifications/
│           │   │   └── log/
│           │   │       └── page.tsx [NEW]
│           │   └── settings/
│           │       ├── notifications/
│           │       │   ├── page.tsx [NEW]
│           │       │   ├── templates/
│           │       │   │   ├── page.tsx [NEW]
│           │       │   │   └── [id]/
│           │       │   │       └── page.tsx [NEW]
│           │       │   └── whatsapp/
│           │       │       └── page.tsx [NEW]
│           │       └── layout.tsx [UPDATED]
│           └── components/
│               └── notifications/
│                   └── notification-stats-widget.tsx [NEW]
├── packages/
│   └── core/
│       └── src/notifications-v2/
│           └── __tests__/
│               └── preference-manager.test.ts [NEW]
├── SPRINT_4_6_NOTIFICATION_IMPLEMENTATION.md [NEW]
├── SPRINT_4_6_SUMMARY.md [NEW]
└── SPRINT_4_6_INTEGRATION_GUIDE.md [NEW]
```

---

## API Testing Guide

### Test With cURL

**Get preferences:**

```bash
curl http://localhost:3000/api/notifications/preferences/customer-123
```

**Update preferences:**

```bash
curl -X PUT http://localhost:3000/api/notifications/preferences/customer-123 \
  -H "Content-Type: application/json" \
  -d '{
    "email_enabled": true,
    "sms_enabled": false,
    "quiet_hours_enabled": true,
    "quiet_hours_start": "22:00",
    "quiet_hours_end": "08:00"
  }'
```

**Check if should send:**

```bash
curl "http://localhost:3000/api/notifications/preferences/customer-123/check?channel=email&eventType=order_confirmed"
```

**Unsubscribe:**

```bash
curl -X POST http://localhost:3000/api/notifications/preferences/unsubscribe \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer-123",
    "channel": "email",
    "token": "unsubscribe-token-12345"
  }'
```

### Test With Postman

1. Import the API endpoints into Postman
2. Set up environment variables:
   - `api_url`: http://localhost:3000/api
   - `customerId`: customer-123
3. Create requests for each endpoint
4. Test various payloads

---

## Common Issues & Solutions

### Issue: Database connection error

**Solution**: Verify DATABASE_URL in .env and database is running

```bash
npm run db:push  # Sync Prisma schema
```

### Issue: API route not found (404)

**Solution**: Ensure route is registered in main server file

```typescript
// Check if route is imported and used
import notificationPreferencesRouter from "./routes/notification-preferences";
app.use("/api", notificationPreferencesRouter);
```

### Issue: Settings page blank/not loading

**Solution**: Check browser console for errors, verify imports

```bash
# Clear build cache
npm run clean
npm run build
npm run dev
```

### Issue: Credentials not masking properly

**Solution**: Check the reveal toggle logic

```tsx
// In page.tsx, look for revealedCredentials state
const isRevealed = revealedCredentials[credKey];
```

### Issue: Template variables not inserting

**Solution**: Verify variable name format and insertion handler

```tsx
// Variables should be in format: {{variable_name}}
const variable = `{{${variableName}}}`;
```

---

## Performance Optimization Tips

1. **API Caching**: Add Redis caching for preferences (TTL: 15 minutes)

   ```typescript
   const cached = await redis.get(`prefs:${customerId}`);
   ```

2. **Database Indexing**: Ensure indexes exist

   ```sql
   CREATE INDEX idx_prefs_customer ON notification_preferences(customerId);
   ```

3. **Lazy Loading**: Templates table uses pagination

   ```tsx
   // Implement infinite scroll or cursor pagination
   const [page, setPage] = useState(1);
   ```

4. **Component Memoization**: Prevent unnecessary re-renders
   ```tsx
   const ChannelCard = memo(ChannelConfigCard);
   ```

---

## Monitoring & Logging

### Add Logging to API

```typescript
import logger from "winston";

router.get("/notifications/preferences/:customerId", (req, res) => {
  logger.info(`Fetching preferences for ${customerId}`);
  // ... endpoint logic
});
```

### Monitor WhatsApp Sync

```typescript
async function syncWhatsAppTemplates(orgId: string) {
  logger.info(`Starting WhatsApp sync for org ${orgId}`);
  try {
    const results = await metaAPI.getTemplates();
    logger.info(`Synced ${results.length} templates`);
  } catch (error) {
    logger.error(`WhatsApp sync failed: ${error}`);
  }
}
```

### Track Preference Updates

```typescript
// Add to database update
const audit = {
  customerId,
  action: "UPDATE_PREFERENCES",
  changes: { email_enabled: true },
  timestamp: new Date(),
  userId: req.user.id,
};
await db.auditLog.create(audit);
```

---

## Troubleshooting Guide

### Settings page loads but forms don't work

- Check that Switch, Input, Button components are imported
- Verify CSS classes are valid (--wl-\* variables exist)
- Check browser console for JavaScript errors

### API returns 400 validation error

- Validate JSON payload matches Zod schema
- Check for required fields: customerId, channel, etc.
- Use Postman to test payload before integrating

### WhatsApp template sync fails

- Verify Meta Business Account ID is correct
- Check access token hasn't expired
- Ensure phone number ID is correct
- Test Meta API directly

### Notification log shows no data

- Verify notification records exist in database
- Check date range filter isn't too restrictive
- Clear browser cache and reload
- Check API is returning data

---

## Next Steps

1. **Complete Integration**: Follow steps 1-7 above
2. **Run Tests**: Execute test suite to verify
3. **Manual Testing**: Test each feature using checklist
4. **API Testing**: Test endpoints with cURL/Postman
5. **Performance Testing**: Load test API endpoints
6. **User Acceptance Testing**: Have users test UI flows
7. **Documentation**: Update team documentation
8. **Deployment**: Deploy to staging then production

---

## Support Resources

- **Implementation Docs**: See `SPRINT_4_6_NOTIFICATION_IMPLEMENTATION.md`
- **Feature Overview**: See `SPRINT_4_6_SUMMARY.md`
- **Code Comments**: Inline JSDoc comments in source files
- **Test Examples**: See `preference-manager.test.ts` for usage patterns

---

## Questions & Support

For questions or issues:

1. Check documentation files first
2. Review inline code comments
3. Run test suite to isolate issues
4. Check browser/server console logs
5. Verify database schema is correct

---

## Deployment to Production

### Pre-deployment

- [ ] All tests passing
- [ ] Code review completed
- [ ] Environment variables configured
- [ ] Database migration verified
- [ ] Backup existing database

### Deployment

```bash
# 1. Run migrations
npx prisma migrate deploy

# 2. Build application
npm run build

# 3. Start server
npm start

# 4. Verify API endpoints
curl http://api.example.com/api/notifications/preferences/test-customer
```

### Post-deployment

- [ ] Monitor error logs
- [ ] Test all features
- [ ] Verify database queries
- [ ] Check API response times
- [ ] Monitor user feedback

---

End of Integration Guide ✅
