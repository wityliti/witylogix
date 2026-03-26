# Error Reference

This document lists all error codes returned by the Witylogix API, along with their meanings and suggested actions.

## Error Response Format

All error responses follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context"
    },
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

- **code**: Machine-readable error identifier
- **message**: Human-friendly description
- **details**: Additional context (varies by error)
- **requestId**: Unique request ID for debugging

## HTTP Status Codes

| Status | Meaning | Error Category |
|--------|---------|-----------------|
| 400 | Bad Request | Validation errors |
| 401 | Unauthorized | Authentication failures |
| 403 | Forbidden | Authorization/permission failures |
| 404 | Not Found | Resource not found |
| 409 | Conflict | State/business logic conflicts |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server errors |
| 503 | Service Unavailable | Service temporarily unavailable |

## Authentication Errors (401)

### AUTH_UNAUTHORIZED
```json
{
  "error": {
    "code": "AUTH_UNAUTHORIZED",
    "message": "Invalid email or password",
    "requestId": "..."
  }
}
```
- **Status**: 401
- **Cause**: Invalid credentials provided
- **Solution**: Verify email and password are correct

### AUTH_TOKEN_EXPIRED
```json
{
  "error": {
    "code": "AUTH_TOKEN_EXPIRED",
    "message": "Access token has expired",
    "details": {
      "expiresAt": "2025-03-16T10:30:00Z"
    },
    "requestId": "..."
  }
}
```
- **Status**: 401
- **Cause**: Access token lifetime exceeded (1 hour)
- **Solution**: Use refresh token to obtain new access token

```bash
curl -X POST https://api.witylogix.com/api/v4/auth/refresh \
  -d '{"refreshToken": "..."}'
```

### AUTH_INVALID_TOKEN
```json
{
  "error": {
    "code": "AUTH_INVALID_TOKEN",
    "message": "Token is invalid or malformed"
  }
}
```
- **Status**: 401
- **Cause**: Token format is invalid or corrupted
- **Solution**: Obtain new token by logging in again

### AUTH_MISSING_TOKEN
```json
{
  "error": {
    "code": "AUTH_MISSING_TOKEN",
    "message": "Authorization header required"
  }
}
```
- **Status**: 401
- **Cause**: No Authorization header provided
- **Solution**: Add `Authorization: Bearer {token}` header

### AUTH_INVALID_API_KEY
```json
{
  "error": {
    "code": "AUTH_INVALID_API_KEY",
    "message": "Invalid or revoked API key"
  }
}
```
- **Status**: 401
- **Cause**: API key is invalid, expired, or revoked
- **Solution**: Verify API key or create a new one

### AUTH_MFA_REQUIRED
```json
{
  "error": {
    "code": "AUTH_MFA_REQUIRED",
    "message": "Multi-factor authentication required",
    "details": {
      "challengeId": "mfa_challenge_123",
      "expiresAt": "2025-03-16T10:35:00Z"
    }
  }
}
```
- **Status**: 401
- **Cause**: MFA is enabled but not verified
- **Solution**: Complete MFA verification with TOTP code

```bash
curl -X POST https://api.witylogix.com/api/v4/auth/mfa/verify-login \
  -d '{
    "challengeId": "mfa_challenge_123",
    "code": "123456"
  }'
```

### AUTH_MFA_INVALID
```json
{
  "error": {
    "code": "AUTH_MFA_INVALID",
    "message": "Invalid or expired MFA code"
  }
}
```
- **Status**: 401
- **Cause**: TOTP code is incorrect or expired (30 seconds)
- **Solution**: Verify correct code from authenticator app

### AUTH_SESSION_EXPIRED
```json
{
  "error": {
    "code": "AUTH_SESSION_EXPIRED",
    "message": "Your session has expired"
  }
}
```
- **Status**: 401
- **Cause**: Refresh token expired (30 days)
- **Solution**: Log in again

## Authorization Errors (403)

### AUTH_INSUFFICIENT_PERMISSIONS
```json
{
  "error": {
    "code": "AUTH_INSUFFICIENT_PERMISSIONS",
    "message": "You do not have permission to perform this action",
    "details": {
      "requiredRole": "ADMIN",
      "currentRole": "DISPATCHER"
    }
  }
}
```
- **Status**: 403
- **Cause**: User role lacks required permissions
- **Solution**: Request higher permission level or contact admin

### AUTH_TENANT_MISMATCH
```json
{
  "error": {
    "code": "AUTH_TENANT_MISMATCH",
    "message": "Resource belongs to different tenant"
  }
}
```
- **Status**: 403
- **Cause**: Attempting to access resource from different shop/org
- **Solution**: Ensure you're accessing resources within your tenant

## Validation Errors (400)

### VALIDATION_ERROR
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "email": "Must be a valid email address",
      "password": "Must be at least 8 characters",
      "phone": "Must be a valid phone number"
    }
  }
}
```
- **Status**: 400
- **Cause**: Request body contains invalid data
- **Solution**: Fix validation errors and retry

### VALIDATION_REQUIRED_FIELD
```json
{
  "error": {
    "code": "VALIDATION_REQUIRED_FIELD",
    "message": "Required field missing",
    "details": {
      "field": "customerName"
    }
  }
}
```
- **Status**: 400
- **Cause**: Required request field is missing
- **Solution**: Provide the required field

### VALIDATION_INVALID_FORMAT
```json
{
  "error": {
    "code": "VALIDATION_INVALID_FORMAT",
    "message": "Field has invalid format",
    "details": {
      "field": "email",
      "expectedFormat": "email"
    }
  }
}
```
- **Status**: 400
- **Cause**: Field value doesn't match expected format
- **Solution**: Use correct format (e.g., RFC 5322 for emails)

### VALIDATION_INVALID_ENUM
```json
{
  "error": {
    "code": "VALIDATION_INVALID_ENUM",
    "message": "Field value is not allowed",
    "details": {
      "field": "status",
      "allowedValues": ["PENDING", "ACCEPTED", "ASSIGNED"]
    }
  }
}
```
- **Status**: 400
- **Cause**: Field value is not in allowed set
- **Solution**: Use one of the allowed values

## Resource Errors (404)

### RESOURCE_NOT_FOUND
```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Resource not found",
    "details": {
      "resourceType": "Order",
      "resourceId": "550e8400-e29b-41d4-a716-446655440000"
    }
  }
}
```
- **Status**: 404
- **Cause**: Requested resource doesn't exist or is deleted
- **Solution**: Verify resource ID is correct

### RESOURCE_DELETED
```json
{
  "error": {
    "code": "RESOURCE_DELETED",
    "message": "Resource has been deleted"
  }
}
```
- **Status**: 404
- **Cause**: Resource was soft-deleted
- **Solution**: Cannot recover deleted resource

### SHOP_NOT_FOUND
```json
{
  "error": {
    "code": "SHOP_NOT_FOUND",
    "message": "Shop not found",
    "details": {
      "shopDomain": "invalid-shop.myshopify.com"
    }
  }
}
```
- **Status**: 404
- **Cause**: Shop doesn't exist or isn't connected
- **Solution**: Verify shop domain is correct

## Conflict Errors (409)

### STATE_CONFLICT
```json
{
  "error": {
    "code": "STATE_CONFLICT",
    "message": "Invalid state transition",
    "details": {
      "currentStatus": "DELIVERED",
      "attemptedStatus": "PENDING",
      "validTransitions": ["RETURNED"]
    }
  }
}
```
- **Status**: 409
- **Cause**: Requested status transition is invalid
- **Solution**: Use one of the valid status transitions

### RESOURCE_ALREADY_EXISTS
```json
{
  "error": {
    "code": "RESOURCE_ALREADY_EXISTS",
    "message": "Resource already exists",
    "details": {
      "field": "email",
      "existingResourceId": "550e8400-e29b-41d4-a716-446655440000"
    }
  }
}
```
- **Status**: 409
- **Cause**: Attempting to create duplicate resource
- **Solution**: Use existing resource or modify creation parameters

### CONCURRENT_MODIFICATION
```json
{
  "error": {
    "code": "CONCURRENT_MODIFICATION",
    "message": "Resource was modified by another request",
    "details": {
      "resourceVersion": 1,
      "latestVersion": 2
    }
  }
}
```
- **Status**: 409
- **Cause**: Resource was updated after you retrieved it
- **Solution**: Fetch latest version and retry

### BUSINESS_LOGIC_ERROR
```json
{
  "error": {
    "code": "BUSINESS_LOGIC_ERROR",
    "message": "Operation violates business rules",
    "details": {
      "reason": "Cannot assign order without delivery date"
    }
  }
}
```
- **Status**: 409
- **Cause**: Operation doesn't comply with business logic
- **Solution**: Ensure all prerequisites are met

## Rate Limit Errors (429)

### RATE_LIMIT_EXCEEDED
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "details": {
      "limit": 1000,
      "window": "1m",
      "retryAfter": 18
    }
  }
}
```
- **Status**: 429
- **Cause**: Too many requests in time window
- **Solution**: Wait before retrying (see `retryAfter` seconds)

**Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1647514260
X-RateLimit-Retry-After: 18
```

## Integration Errors (5xx)

### INTEGRATION_ERROR
```json
{
  "error": {
    "code": "INTEGRATION_ERROR",
    "message": "Integration with external service failed",
    "details": {
      "service": "Shopify",
      "reason": "API rate limit exceeded"
    }
  }
}
```
- **Status**: 502/503
- **Cause**: External service error
- **Solution**: Retry after a delay

### WEBHOOK_DELIVERY_FAILED
```json
{
  "error": {
    "code": "WEBHOOK_DELIVERY_FAILED",
    "message": "Webhook delivery failed",
    "details": {
      "endpointUrl": "https://example.com/webhook",
      "statusCode": 500,
      "error": "Internal Server Error"
    }
  }
}
```
- **Status**: 500
- **Cause**: Webhook endpoint returned error
- **Solution**: Fix endpoint and retry delivery via DLQ

## Server Errors (5xx)

### INTERNAL_SERVER_ERROR
```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```
- **Status**: 500
- **Cause**: Unexpected server error
- **Solution**: Retry request. If persists, contact support with requestId

### SERVICE_UNAVAILABLE
```json
{
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Service temporarily unavailable",
    "details": {
      "retryAfter": 60
    }
  }
}
```
- **Status**: 503
- **Cause**: Server maintenance or overload
- **Solution**: Retry after specified delay

### DATABASE_ERROR
```json
{
  "error": {
    "code": "DATABASE_ERROR",
    "message": "Database operation failed"
  }
}
```
- **Status**: 500
- **Cause**: Database connectivity or query error
- **Solution**: Retry request with exponential backoff

## Debugging Errors

### Use Request ID

Every error includes a unique `requestId`. Use it to track issues:

```bash
# See the request ID in response
curl https://api.witylogix.com/api/v4/invalid-endpoint \
  -H "Authorization: Bearer {token}"

# Response
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}

# Share this ID with support for debugging
```

### Enable Debug Logging

Set `X-Debug-Trace` header for detailed error information:

```bash
curl https://api.witylogix.com/api/v4/orders \
  -H "Authorization: Bearer {token}" \
  -H "X-Debug-Trace: true"

# Response includes stack trace in development
```

## Common Issues & Solutions

### Issue: `AUTH_INVALID_TOKEN`
**Cause**: Token has been corrupted or tampered with
**Solution**:
1. Log out completely
2. Clear any cached tokens
3. Log in again to get fresh token

### Issue: `STATE_CONFLICT` on order status update
**Cause**: Invalid status transition attempted
**Solution**: Check valid transitions for current status:
```
PENDING → ACCEPTED, CANCELLED
ACCEPTED → ASSIGNED, CANCELLED
ASSIGNED → PICKED_UP, CANCELLED
PICKED_UP → OUT_FOR_DELIVERY
...
```

### Issue: `RATE_LIMIT_EXCEEDED`
**Cause**: Making too many requests
**Solution**:
1. Implement exponential backoff retry logic
2. Use batch endpoints when available
3. Consider upgrading plan
4. Cache responses locally

### Issue: `TENANT_MISMATCH`
**Cause**: Accessing resource from wrong shop/organization
**Solution**:
1. Verify you're using the correct Authorization header
2. Check that resource belongs to your tenant
3. If accessing multiple shops, re-authenticate with correct token

## Error Recovery Strategies

### Exponential Backoff

```typescript
async function callWithRetry(
  fn: () => Promise<Response>,
  maxRetries = 3
) {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries - 1) {
        const delayMs = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}
```

### Circuit Breaker

```typescript
class CircuitBreaker {
  private failureCount = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private lastFailureTime?: number;

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - (this.lastFailureTime || 0) > 60000) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failureCount = 0;
      }
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      if (this.failureCount >= 3) {
        this.state = 'OPEN';
      }
      throw error;
    }
  }
}
```

## Contact Support

For errors not listed here or persistent issues:

1. **Include the requestId** — Found in error response
2. **Describe the operation** — What were you trying to do?
3. **Provide recent logs** — Include relevant API calls
4. **Share error message** — Full error response JSON

Email: support@witylogix.com
