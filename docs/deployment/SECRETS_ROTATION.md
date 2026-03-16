# Secrets Rotation Guide

This document describes the procedures for rotating secrets and sensitive credentials in the Witylogix platform without downtime.

## Overview

Proper secrets rotation is critical for security. Each secret type has specific requirements:

- **JWT secrets**: Can use dual-key validation period for zero-downtime rotation
- **Database passwords**: Require coordination with database provider
- **API keys**: May require temporary dual-key validation
- **Webhook secrets**: Require old/new key validation during rotation
- **SSL certificates**: Should be renewed before expiry

All rotations should be planned in advance and tested in staging before production.

## 1. JWT Secret Rotation

JWT secrets are used to sign and verify access tokens. The rotation procedure allows for a transition period where both old and new secrets are accepted.

### Procedure

1. **Generate new secret**
   ```bash
   # Generate a strong random secret (min 32 characters)
   openssl rand -base64 32
   # or
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

2. **Update configuration**
   - Set `JWT_SECRET` to the new value in your deployment environment
   - Keep the old secret available (e.g., in `JWT_SECRET_OLD`)

3. **Deploy with dual-key support**
   ```typescript
   // In your JWT verification middleware
   function verifyToken(token: string): DecodedToken {
     try {
       // Try with new secret first
       return jwt.verify(token, process.env.JWT_SECRET);
     } catch (error) {
       if (process.env.JWT_SECRET_OLD) {
         // Fall back to old secret during transition
         return jwt.verify(token, process.env.JWT_SECRET_OLD);
       }
       throw error;
     }
   }

   // New tokens are signed with new secret
   const token = jwt.sign(payload, process.env.JWT_SECRET, {
     expiresIn: process.env.JWT_ACCESS_EXPIRY
   });
   ```

4. **Transition period**
   - Deploy the dual-key validation
   - Monitor token verification success/failure rates
   - All new tokens will use the new secret
   - Old tokens (pre-rotation) will fall back to old secret

5. **Remove old secret**
   - Once all old tokens have expired, remove `JWT_SECRET_OLD`
   - Update code to remove fallback validation
   - Deploy the cleanup

### Timeline

- **Phase 1**: Deploy dual-key validation (all systems working)
- **Phase 2**: Wait for longest token lifetime (default 7 days for refresh tokens)
- **Phase 3**: Remove old secret from code and environment

## 2. Database Password Rotation

Database password rotation requires coordination with your database provider.

### PostgreSQL Rotation

1. **Create new user with temporary password**
   ```sql
   -- Connect as superuser
   CREATE USER witylogix_new WITH PASSWORD 'new-temporary-password';
   GRANT ALL PRIVILEGES ON DATABASE witylogix TO witylogix_new;
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO witylogix_new;
   GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO witylogix_new;
   ```

2. **Update application configuration**
   - Set `DATABASE_URL` to use new credentials
   - Deploy to staging first to verify

3. **Monitor for issues**
   - Check application logs for connection errors
   - Verify database operations are working

4. **Clean up old user**
   ```sql
   -- After rotation successful, drop old user
   DROP USER witylogix;
   -- Optionally rename new user
   ALTER USER witylogix_new RENAME TO witylogix;
   ```

### RDS (AWS) Rotation

1. **Use AWS Secrets Manager** for automatic rotation:
   - AWS can rotate passwords automatically
   - Application uses temporary credentials via IAM roles
   - Zero downtime rotation

2. **Manual rotation steps**:
   ```bash
   # Update password in RDS console
   # Test connection before updating app config
   # Update DATABASE_URL in deployment
   # Monitor application logs
   ```

## 3. API Key Rotation

Different external services have different rotation procedures.

### Stripe Key Rotation

1. **Generate new restricted API key**
   - Go to Stripe Dashboard → Settings → API Keys
   - Create new restricted key with necessary scopes
   - Keep old key enabled during transition

2. **Update configuration**
   - Set `STRIPE_SECRET_KEY` to new value
   - Deploy to staging for testing

3. **Monitor**
   - Check that payment operations work
   - Monitor error logs for API key issues

4. **Revoke old key**
   - Once confident, disable and delete old key
   - Keep record of when rotation occurred

### Twilio Key Rotation

1. **Generate new API credentials**
   - Twilio Console → Account → Settings → API Keys
   - Create new key, keep old key for transition

2. **Update `TWILIO_AUTH_TOKEN`**
   - Deploy to staging first
   - Verify SMS sending works

3. **Test thoroughly**
   - Send test SMS messages
   - Verify delivery notifications work

4. **Revoke old key**
   - Delete old key once confirmed working

### Mapbox Token Rotation

1. **Generate new access token**
   - mapbox.com account → Tokens
   - Create new token with same scopes

2. **Update `MAPBOX_TOKEN`**
   - Deploy to production
   - Can use dual-key validation if needed

3. **Monitor**
   - Check geolocation queries work
   - Verify route optimization functions

4. **Revoke old token**
   - Delete old token

## 4. Webhook Secret Rotation

Webhook secrets are used to verify webhook signatures.

### Procedure

1. **Generate new secret**
   ```bash
   openssl rand -base64 32
   ```

2. **Update provider configuration**
   - Most providers (Stripe, GitHub, etc.) allow multiple active secrets
   - Add new secret while keeping old one active

3. **Update application**
   ```typescript
   // Verify webhook with multiple secrets
   function verifyWebhookSignature(body: string, signature: string): boolean {
     const currentSecret = process.env.STRIPE_WEBHOOK_SECRET;
     const previousSecret = process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS;

     return (
       verifySignature(body, signature, currentSecret) ||
       verifySignature(body, signature, previousSecret)
     );
   }
   ```

4. **Monitor webhook deliveries**
   - Ensure providers are using new secret
   - Check webhook processing logs

5. **Clean up old secret**
   - Remove old secret from provider after transition
   - Remove fallback validation from code

## 5. SSL Certificate Renewal

SSL certificates should be renewed before expiry (typically 30 days before).

### Using Let's Encrypt with Auto-Renewal

1. **Set up auto-renewal**
   ```bash
   # On Linux with certbot
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot certonly --nginx -d example.com

   # Auto-renewal via cron
   sudo certbot renew --quiet --no-eff-email
   ```

2. **Configure auto-renewal**
   ```bash
   # Test renewal process
   sudo certbot renew --dry-run

   # Crontab entry (runs twice daily)
   0 0,12 * * * /opt/certbot/bin/python -m certbot renew --quiet
   ```

### Manual Certificate Replacement

1. **Generate new certificate**
   - From certificate provider or using certbot
   - Ensure it covers all required domains

2. **Test new certificate**
   ```bash
   # Verify certificate validity
   openssl x509 -in certificate.crt -text -noout

   # Check certificate matches private key
   openssl md5 certificate.crt
   openssl md5 private.key
   ```

3. **Update server configuration**
   - Update web server config to use new certificate
   - Perform rolling restart of servers

4. **Monitor**
   - Check HTTPS connectivity
   - Verify certificate in browser
   - Monitor SSL certificate logs

## 6. Deployment Checklist

Before rotating any secret in production:

- [ ] Planned maintenance window identified
- [ ] Staging environment test completed successfully
- [ ] Rollback plan documented
- [ ] Monitoring/alerts are active
- [ ] On-call engineer is available
- [ ] Backup of current secrets taken (encrypted)
- [ ] Audit trail configured to log rotation
- [ ] Communication to stakeholders sent

## 7. Monitoring and Alerting

Set up alerts to catch rotation issues:

```typescript
// Alert on token verification failures
if (jwtVerificationFailures > threshold) {
  sendAlert('JWT verification failure rate elevated');
}

// Alert on database connection failures
if (dbConnectionErrors > threshold) {
  sendAlert('Database connection errors elevated');
}

// Alert on external API failures
if (stripeApiErrors > threshold) {
  sendAlert('Stripe API errors elevated');
}
```

## 8. Audit Trail

Log all secret rotations for compliance:

```typescript
interface SecretRotationAudit {
  timestamp: Date;
  secretType: string; // JWT_SECRET, DATABASE_PASSWORD, etc.
  environment: string; // development, staging, production
  performedBy: string; // User ID or service
  status: 'success' | 'partial' | 'failed';
  duration: number; // Milliseconds
  details: Record<string, unknown>;
}

// Store in audit log
await auditLog.record({
  secretType: 'JWT_SECRET',
  environment: 'production',
  performedBy: 'devops@example.com',
  status: 'success',
  duration: 5000,
});
```

## 9. Emergency Rotation

If a secret is compromised:

1. **Rotate immediately** without waiting for scheduled maintenance
2. **Review audit logs** to see if secret was misused
3. **Increase monitoring** for unusual activity
4. **Notify relevant parties** (security team, customers if needed)
5. **Force re-authentication** if relevant (e.g., for API keys)

## 10. Testing and Validation

After each rotation:

```bash
# Test database connection
npm run test:database-connection

# Test external services
npm run test:external-services

# Full integration test
npm run test:integration

# Smoke tests on production (after deployment)
npm run test:smoke --environment=production
```

## References

- [OWASP Secrets Management](https://owasp.org/www-community/Secrets_Management)
- [CWE-798: Hard-coded Credentials](https://cwe.mitre.org/data/definitions/798.html)
- [Stripe API Key Security](https://stripe.com/docs/keys)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/sql-createrole.html)
