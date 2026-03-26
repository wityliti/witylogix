# Authentication Guide

The Witylogix API supports multiple authentication methods for different use cases:

- **JWT Bearer Tokens** — For dashboard users, drivers, and client applications
- **API Keys** — For server-to-server integration and background jobs
- **OAuth2/SSO** — For partner integrations and delegated access

## JWT Authentication

### Overview

JWT (JSON Web Tokens) is the primary authentication method for the API. Tokens are issued by the login endpoints and must be included in the `Authorization` header of subsequent requests.

- **Access Token**: Short-lived (1 hour), used for API requests
- **Refresh Token**: Long-lived (30 days), used to obtain new access tokens

### Login Flow

#### 1. Dashboard User Login

```bash
curl -X POST https://api.witylogix.com/api/v4/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "secure_password_123",
    "shopDomain": "mystore.myshopify.com"
  }'
```

**Response:**
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "f8d7e9c2a1b5d4c3e9f0a1b2c3d4e5f6g7h8i9j0",
    "expiresIn": 3600,
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "admin@example.com",
      "name": "Admin User",
      "role": "ADMIN"
    }
  }
}
```

#### 2. Driver Login

Driver authentication uses phone number instead of email:

```bash
curl -X POST https://api.witylogix.com/api/v4/auth/driver/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+14155552671",
    "password": "driver_password_123",
    "shopDomain": "mystore.myshopify.com"
  }'
```

### Using Access Tokens

Include the access token in the `Authorization` header with `Bearer` scheme:

```bash
curl https://api.witylogix.com/api/v4/orders \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### TypeScript/JavaScript Example

```typescript
import fetch from 'node-fetch';

async function loginAndFetchOrders() {
  // Step 1: Login
  const loginResponse = await fetch(
    'https://api.witylogix.com/api/v4/auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'password',
        shopDomain: 'mystore.myshopify.com',
      }),
    }
  );

  const { data: auth } = await loginResponse.json();
  const { accessToken, refreshToken } = auth;

  // Step 2: Use access token
  const ordersResponse = await fetch(
    'https://api.witylogix.com/api/v4/orders',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const { data: orders } = await ordersResponse.json();
  return orders;
}
```

### Token Refresh

Access tokens expire after 1 hour. Use the refresh token to obtain a new pair:

```bash
curl -X POST https://api.witylogix.com/api/v4/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "f8d7e9c2a1b5d4c3e9f0a1b2c3d4e5f6g7h8i9j0"
  }'
```

**Response:**
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
    "expiresIn": 3600
  }
}
```

**Important:** Refresh tokens are rotated on each refresh. Always update stored tokens.

### Logout

Invalidate the refresh token and end the session:

```bash
curl -X POST https://api.witylogix.com/api/v4/auth/logout \
  -H "Authorization: Bearer {accessToken}"
```

## API Key Authentication

### Overview

API Keys are for server-to-server communication and should be kept secure. Keys are prefixed to indicate their environment:

- `wl_live_` — Production keys
- `wl_test_` — Sandbox/testing keys

### Creating an API Key

```bash
curl -X POST https://api.witylogix.com/api/v4/api-keys \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Backend Integration",
    "type": "LIVE",
    "scopes": [
      "orders.read",
      "orders.write",
      "drivers.read",
      "routes.read"
    ]
  }'
```

**Response:**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "key": "wl_live_sk_1234567890abcdef",
    "name": "Backend Integration",
    "type": "LIVE",
    "scopes": ["orders.read", "orders.write", "drivers.read", "routes.read"],
    "createdAt": "2025-03-16T10:30:00Z"
  }
}
```

⚠️ **Warning:** The key is only displayed once. Store it securely (e.g., environment variable).

### Using API Keys

Include the key in the `X-API-Key` header:

```bash
curl https://api.witylogix.com/api/v4/orders \
  -H "X-API-Key: wl_live_sk_1234567890abcdef"
```

### API Key Scopes

Available scopes:

| Scope | Description |
|-------|-------------|
| `orders.read` | Read orders and delivery data |
| `orders.write` | Create and update orders |
| `drivers.read` | Read driver information |
| `drivers.write` | Update driver status and assignments |
| `routes.read` | View route plans |
| `routes.write` | Create and optimize routes |
| `deliveries.read` | View delivery status |
| `webhooks.manage` | Create and manage webhooks |
| `admin.read` | Read admin data (users, orgs) |

### Revoking API Keys

```bash
curl -X DELETE https://api.witylogix.com/api/v4/api-keys/{keyId} \
  -H "Authorization: Bearer {accessToken}"
```

## Multi-Factor Authentication (MFA)

### Setup TOTP

Initialize multi-factor authentication for your account:

```bash
curl -X POST https://api.witylogix.com/api/v4/auth/mfa/setup \
  -H "Authorization: Bearer {accessToken}"
```

**Response:**
```json
{
  "data": {
    "secret": "JBSWY3DPEBLW64TMMQ======",
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA...",
    "backupCodes": [
      "12345678",
      "87654321",
      ...
    ]
  }
}
```

### Verify TOTP Code

Scan the QR code with an authenticator app (Google Authenticator, Authy, etc.) and verify:

```bash
curl -X POST https://api.witylogix.com/api/v4/auth/mfa/verify \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "123456",
    "deviceId": "my-device-id"
  }'
```

**Response:**
```json
{
  "data": {
    "message": "MFA enabled successfully",
    "backupCodes": [
      "12345678",
      "87654321",
      ...
    ]
  }
}
```

💡 **Tip:** Store backup codes in a secure location. Use them if you lose access to your authenticator app.

### Using MFA at Login

If MFA is enabled, the login response includes a challenge:

```json
{
  "data": {
    "challenge": {
      "id": "mfa_challenge_123",
      "expiresAt": "2025-03-16T10:35:00Z"
    }
  }
}
```

Complete the challenge by verifying the TOTP code:

```bash
curl -X POST https://api.witylogix.com/api/v4/auth/mfa/verify-login \
  -H "Content-Type: application/json" \
  -d '{
    "challengeId": "mfa_challenge_123",
    "code": "123456"
  }'
```

## Password Management

### Request Password Reset

```bash
curl -X POST https://api.witylogix.com/api/v4/auth/password/reset \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "shopDomain": "mystore.myshopify.com"
  }'
```

An email with a reset link will be sent. The link contains a time-limited token (valid for 1 hour).

### Confirm Password Reset

```bash
curl -X POST https://api.witylogix.com/api/v4/auth/password/reset-confirm \
  -H "Content-Type: application/json" \
  -d '{
    "token": "reset_token_from_email",
    "password": "new_secure_password_123"
  }'
```

**Response:**
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "f8d7e9c2a1b5d4c3e9f0a1b2c3d4e5f6g7h8i9j0",
    "expiresIn": 3600
  }
}
```

## Rate Limiting by Auth Method

Different rate limits apply based on authentication method and plan:

| Plan | JWT (User) | JWT (Driver) | API Key |
|------|-----------|-------------|---------|
| FREE | 100/min | 50/min | 100/min |
| PRO | 1000/min | 500/min | 1000/min |
| ENTERPRISE | 10000/min | 5000/min | 10000/min |

Rate limit information is returned in response headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1647514260
```

When rate limit is exceeded, requests return `429 Too Many Requests`.

## OAuth2/SSO (Partner Integrations)

### Authorization Code Flow

For third-party integrations, use OAuth2:

1. **Redirect to authorization endpoint:**
   ```
   https://api.witylogix.com/oauth2/authorize?
     client_id=your_client_id&
     redirect_uri=https://yourapp.com/callback&
     response_type=code&
     scope=orders.read%20drivers.read&
     state=random_state_value
   ```

2. **User grants permission**

3. **Exchange code for token:**
   ```bash
   curl -X POST https://api.witylogix.com/oauth2/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d '{
       "grant_type": "authorization_code",
       "code": "auth_code",
       "client_id": "your_client_id",
       "client_secret": "your_client_secret",
       "redirect_uri": "https://yourapp.com/callback"
     }'
   ```

4. **Use access token:**
   ```bash
   curl https://api.witylogix.com/api/v4/orders \
     -H "Authorization: Bearer {accessToken}"
   ```

## Security Best Practices

1. **Never commit credentials** — Use environment variables
2. **Use HTTPS only** — Never send tokens over HTTP
3. **Rotate refresh tokens** — Update stored tokens after refresh
4. **Enable MFA** — Especially for admin accounts
5. **Use API Key scopes** — Limit permissions to necessary operations
6. **Revoke unused keys** — Clean up old API keys regularly
7. **Monitor login activity** — Check for unauthorized access
8. **Use short expiration** — Keep token lifetimes minimal

## Error Codes

Common authentication errors:

| Code | Description | Solution |
|------|-------------|----------|
| `AUTH_UNAUTHORIZED` | Invalid credentials | Verify email and password |
| `AUTH_TOKEN_EXPIRED` | Access token expired | Use refresh token to get new token |
| `AUTH_INVALID_TOKEN` | Token format invalid | Ensure proper JWT format |
| `AUTH_MFA_REQUIRED` | MFA challenge required | Complete MFA verification |
| `AUTH_MFA_INVALID` | Invalid TOTP code | Verify correct code from authenticator |
| `AUTH_RATE_LIMITED` | Too many login attempts | Wait before retrying |
| `RESOURCE_NOT_FOUND` | Shop domain not found | Verify shopDomain parameter |

## Troubleshooting

**Q: How do I refresh an expired token?**
A: Use the `POST /api/v4/auth/refresh` endpoint with your refresh token. Store the new tokens returned.

**Q: My API key keeps getting rejected?**
A: Ensure the key is in the `X-API-Key` header (not `Authorization`). Check that the key hasn't been revoked.

**Q: How often should I rotate API keys?**
A: For production keys, rotate every 90 days. For development, use test keys instead.

**Q: Can I use the same token across multiple shops?**
A: No, tokens are shop-scoped. You need separate logins for different shops.
