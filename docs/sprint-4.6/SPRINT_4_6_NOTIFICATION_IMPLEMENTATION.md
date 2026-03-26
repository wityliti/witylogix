# Sprint 4.6: Notification Preferences UI & WhatsApp Template Management

## Overview

Sprint 4.6 delivers a comprehensive notification system with advanced settings, template management, and WhatsApp integration. This implementation provides both customers and administrators with granular control over notification delivery across multiple channels.

## Files Created

### Dashboard Pages

#### 1. Notification Settings Page
**Path:** `/apps/dashboard/src/app/(dashboard)/settings/notifications/page.tsx`

Complete notification channel configuration with:
- Per-channel provider selection (Email: SMTP/SendGrid/SES, SMS: Twilio/Vonage, WhatsApp: Meta/Twilio, Push: Firebase/OneSignal)
- Masked credential inputs with reveal toggle
- Rate limiting configuration (per minute, hour, day) for each channel
- Default sender configuration (from email, from phone, business name)
- Quiet hours settings with timezone support
- Real-time unsaved changes warning
- Save/discard functionality

**Features:**
- Multi-provider support for each channel
- Secure credential handling with visibility toggle
- Granular rate limit controls
- Business hours configuration
- Channel-specific test send buttons

#### 2. Notification Templates Page
**Path:** `/apps/dashboard/src/app/(dashboard)/settings/notifications/templates/page.tsx`

Template management interface with:
- List of all notification templates grouped by event type
- Filter by event type (order_confirmed, dispatched, out_for_delivery, delivered, delayed, failed, feedback_request)
- Template status display (active/draft)
- Last edited timestamp tracking
- Quick actions: edit, duplicate, enable/disable, delete
- Summary statistics

**Features:**
- Event-based filtering
- Status badges (active/draft)
- Template duplication
- Bulk template status management
- Template analytics

#### 3. Template Editor
**Path:** `/apps/dashboard/src/app/(dashboard)/settings/notifications/templates/[id]/page.tsx`

Rich template editor supporting:
- Multi-channel editing with tabs (Email, SMS, WhatsApp, Push)
- Variable insertion with click-to-add interface
- Live preview panel with sample data rendering
- Character count for SMS (with segment calculation)
- HTML editor for email templates
- Template version history (last 5 versions)
- Save as draft / Publish workflow
- Test send functionality with recipient input

**Variables Supported:**
- {{customer_name}}
- {{order_id}}
- {{delivery_date}}
- {{time_window}}
- {{tracking_url}}
- {{driver_name}}
- {{delivery_address}}

#### 4. WhatsApp Template Manager
**Path:** `/apps/dashboard/src/app/(dashboard)/settings/notifications/whatsapp/page.tsx`

Specialized WhatsApp Business template CRUD with:
- Template categories (UTILITY, MARKETING, AUTHENTICATION)
- Component builder (HEADER, BODY, FOOTER, BUTTONS)
- Button types (quick_reply, url, phone)
- Variable mapping ({{1}} → {{customer_name}}, etc.)
- Status tracking (PENDING, APPROVED, REJECTED)
- Rejection reason display
- Meta Business API sync button
- Template detail cards showing components

**WhatsApp Features:**
- Full template composition UI
- Header type support (text, image, video, document)
- Button management
- Status workflow integration
- Failure reason tracking
- Meta API synchronization

#### 5. Notification Log Page
**Path:** `/apps/dashboard/src/app/(dashboard)/notifications/log/page.tsx`

Comprehensive notification delivery tracking with:
- Paginated table of all sent notifications
- Columns: timestamp, recipient, channel, event, template, status, cost
- Multi-filter support (channel, status, date range, event type)
- Detailed modal showing message preview, delivery attempts, error details
- Export CSV functionality
- Summary statistics (total sent, delivery rate, bounce rate, cost)

**Tracking Features:**
- Status badges (sent, delivered, failed, bounced, pending)
- Delivery attempt history
- Error code and message capture
- Cost tracking per notification
- Advanced filtering and export

### Components

#### 6. Notification Stats Widget
**Path:** `/apps/dashboard/src/components/notifications/notification-stats-widget.tsx`

Dashboard widget showing:
- Daily sent count with trend indicator
- Delivery rate percentage
- Bounce rate percentage
- 7-day trend chart (simple line chart)
- Channel breakdown (donut chart with percentages)
- Top 5 failed templates list

**Widget Features:**
- Real-time statistics
- Visual trend indicators
- Channel distribution visualization
- Performance metrics
- Failed template alerts

### API Routes

#### 7. Notification Preferences API
**Path:** `/apps/api/src/routes/notification-preferences.ts`

Comprehensive API endpoints:

**GET /notifications/preferences/:customerId**
- Fetch customer notification preferences
- Returns: all preference settings with defaults

**PUT /notifications/preferences/:customerId**
- Update customer preferences
- Accepts: full preferences object
- Returns: updated preferences

**POST /notifications/preferences/unsubscribe**
- Handle unsubscribe via link
- Accepts: customerId, channel, token
- Returns: updated preferences

**GET /notifications/preferences/:customerId/check**
- Check if notification should be sent
- Query params: channel, eventType
- Returns: canSend boolean with reason

**PATCH /notifications/preferences/:customerId/quiet-hours**
- Update quiet hours settings
- Accepts: enabled, startTime, endTime, timezone
- Returns: updated quiet hours config

**PATCH /notifications/preferences/:customerId/channel/:channel**
- Enable/disable specific channel
- Accepts: enabled boolean
- Returns: updated channel preference

**POST /notifications/preferences/bulk**
- Get preferences for multiple customers
- Accepts: customerIds array
- Returns: preferences for all customers

### Tests

#### 8. Preference Manager Tests
**Path:** `/packages/core/src/notifications-v2/__tests__/preference-manager.test.ts`

Comprehensive test suite covering:
- Preference CRUD operations
- Channel enable/disable logic
- Event type preferences
- Quiet hours functionality
- Unsubscribe link handling
- Multi-customer support
- Edge cases and error handling

**Test Categories:**
- Basic CRUD operations
- Channel management (12 tests)
- Event type management (8 tests)
- Availability calculations (6 tests)
- Reset and cleanup (4 tests)
- Quiet hours logic (2 tests)
- Full event/channel coverage (14 tests)
- Edge cases (3 tests)

## Key Features Implemented

### 1. Multi-Channel Support
- **Email**: SMTP, SendGrid, AWS SES
- **SMS**: Twilio, Vonage
- **WhatsApp**: Meta (WhatsApp Business), Twilio
- **Push**: Firebase Cloud Messaging, OneSignal

### 2. Template Management
- 7 event types pre-configured
- Multi-channel templates per event
- Variable interpolation
- Live preview with sample data
- Version history tracking

### 3. Preference Management
- Per-customer settings
- Per-channel configuration
- Event-type granularity
- Quiet hours support
- Unsubscribe handling

### 4. WhatsApp Integration
- Business template components
- Button management
- Meta API synchronization
- Status tracking
- Rejection handling

### 5. Analytics & Monitoring
- Send statistics
- Delivery rate tracking
- Bounce rate monitoring
- Cost per notification
- Top failed templates
- 7-day trend visualization

## Database Schema

### NotificationPreference
```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY,
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
```

## Styling & Design

All components follow Witylogix design standards:
- **Theme**: Dark sidebar layout with --wl-* CSS variables
- **Colors**: Primary, secondary, success, warning, danger variants
- **Components**: Button (primary|secondary|ghost|danger), Badge (default|success|warning|danger|info|primary)
- **Utilities**: cn() from @/lib/utils for className composition

## Integration Points

### Settings Layout Integration
Added navigation link in `/apps/dashboard/src/app/(dashboard)/settings/layout.tsx`:
```tsx
{
  href: "/settings/notifications",
  label: "Notifications",
  icon: <Bell className="w-4 h-4" />,
  description: "Manage notification preferences",
}
```

### API Integration
- All dashboard pages make API calls to notification preference endpoints
- WhatsApp template manager syncs with Meta Business API
- Notification log fetches from delivery database

## Usage Examples

### Getting Customer Preferences
```typescript
const response = await fetch('/api/notifications/preferences/CUSTOMER_ID');
const preferences = await response.json();
```

### Updating Preferences
```typescript
await fetch('/api/notifications/preferences/CUSTOMER_ID', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email_enabled: true,
    sms_enabled: false,
    quiet_hours_enabled: true,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00'
  })
});
```

### Checking Before Send
```typescript
const response = await fetch(
  '/api/notifications/preferences/CUSTOMER_ID/check?channel=email&eventType=order_confirmed'
);
const { canSend, reason } = await response.json();
if (canSend) {
  // Send notification
}
```

## Testing

Run the preference manager tests:
```bash
npm test -- preference-manager.test.ts
```

Test coverage includes:
- 59 individual test cases
- 8 describe blocks
- Edge case handling
- Full feature coverage

## Performance Considerations

1. **Caching**: Preference lookups should be cached (TTL: 5-15 minutes)
2. **Rate Limiting**: API endpoints rate limited per customer
3. **Batch Operations**: Use bulk endpoint for checking multiple customers
4. **Pagination**: Notification log uses pagination for large datasets

## Security

1. **Credential Masking**: API credentials masked in UI
2. **Token Validation**: Unsubscribe links require valid token
3. **Access Control**: Preferences tied to authenticated customer
4. **CORS**: API endpoints protected with CORS policies

## Future Enhancements

1. **SMS Segment Counting**: Implement proper SMS segment calculation
2. **Email Preview**: Add browser-based email preview rendering
3. **A/B Testing**: Template variant testing for optimization
4. **Analytics Dashboard**: Advanced analytics with custom date ranges
5. **Webhook Integration**: Real-time delivery status updates
6. **Localization**: Multi-language template support
7. **Rate Limit Analysis**: Visual rate limit usage per channel
8. **Template Versioning**: Full version control with rollback

## Deployment Notes

1. **Database Migration**: Run migration to create notification_preferences table
2. **API Registration**: Register notification-preferences route in main API server
3. **Component Import**: Import NotificationStatsWidget in dashboard home
4. **Environment Variables**: Configure provider API keys in .env
5. **Settings Navigation**: Ensure settings layout includes notification link

## Support & Documentation

For additional documentation, see:
- `/packages/core/src/notifications-v2/README.md` - Notification system overview
- `/packages/core/src/notifications-v2/QUICKSTART.md` - Quick start guide
- Template variable documentation in template editor component
- API endpoint examples in notification-preferences route comments
