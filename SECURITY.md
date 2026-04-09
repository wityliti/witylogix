# Security Policy

## Supported Versions

| Version | Status                | Support Level          |
| ------- | --------------------- | ---------------------- |
| 4.x     | Current release       | Full support           |
| 3.x     | Previous release      | Security fixes only    |
| 2.x     | End of life           | No support             |
| 1.x     | End of life           | No support             |

Only the latest patch release within each supported major version receives updates. We strongly recommend upgrading to the latest 4.x release.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Send vulnerability reports to **security@wityliti.io**. Encrypt sensitive reports using our PGP key if one is published on our website.

### What to Include

- A clear description of the vulnerability
- Steps to reproduce the issue (proof of concept, sample payloads, or screenshots)
- Impact assessment (data exposure, privilege escalation, denial of service, etc.)
- Affected versions and components (API, dashboard, customer portal, Shopify app, etc.)
- Any suggested fix or mitigation, if you have one

### What to Expect

We will never take legal action against researchers who report vulnerabilities responsibly and in good faith.

## Response Timeline

| Stage                  | Timeframe              |
| ---------------------- | ---------------------- |
| Acknowledgement        | Within 48 hours        |
| Triage and assessment  | Within 5 business days |
| Fix for critical       | Within 30 days         |
| Fix for non-critical   | Within 90 days         |

You will receive status updates at each stage. If we need more time, we will communicate the reason and revised timeline.

## Disclosure Policy

We follow a **coordinated disclosure** process:

1. The reporter notifies us privately at security@wityliti.io.
2. We acknowledge receipt and begin investigation.
3. We work on a fix and coordinate a release timeline with the reporter.
4. After the fix is released (or after 90 days from the initial report, whichever comes first), the vulnerability may be publicly disclosed.
5. We credit the reporter in the release notes and this document (unless anonymity is requested).

We ask that reporters refrain from publicly disclosing the vulnerability until the coordinated disclosure date.

## Security Best Practices for Deployers

Witylogix handles sensitive logistics data including customer addresses, driver locations, and payment information. Follow these practices when deploying the platform.

### Secrets and Environment Variables

- Store all secrets (database credentials, JWT signing keys, API keys) in environment variables or a secrets manager. Never hardcode them in source files or configuration checked into version control.
- Use a `.env` file for local development only. Never commit `.env` files to the repository.
- Rotate JWT signing secrets on a regular schedule (at minimum every 90 days) and immediately after any suspected compromise.

### Database Security

- **Enable PostgreSQL Row-Level Security (RLS)** on all tenant-scoped tables. The platform is designed for multi-tenant isolation via RLS, and disabling it removes a critical security boundary.
- Use dedicated database roles with least-privilege access. The application should not connect as a superuser.
- Enable SSL/TLS for all database connections.
- Run regular backups and test your restore process.

### Transport Security

- Serve all traffic over **HTTPS**. Terminate TLS at your load balancer or reverse proxy.
- Enable HSTS headers to prevent protocol downgrade attacks.
- Use TLS 1.2 or later; disable older protocols.

### Authentication and Authorization

- Use strong, unique JWT secrets for each environment (development, staging, production).
- Set reasonable token expiration times (e.g., 15 minutes for access tokens, 7 days for refresh tokens).
- Enforce role-based access control (RBAC) for all API endpoints.

### Dependency Management

- Run `pnpm audit` regularly to check for known vulnerabilities in dependencies.
- Keep all dependencies updated, especially security-critical packages.
- Pin dependency versions in production to prevent unexpected changes.

## Security-Related Configuration

### CORS (Cross-Origin Resource Sharing)

Configure allowed origins explicitly. Do not use wildcard (`*`) origins in production.

```bash
CORS_ORIGIN=https://app.yourdomain.com,https://portal.yourdomain.com
```

### Rate Limiting

The API includes rate limiting middleware. Configure limits appropriate to your traffic patterns:

```bash
RATE_LIMIT_WINDOW_MS=900000    # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100     # requests per window
```

Apply stricter limits to authentication endpoints to prevent brute-force attacks.

### Helmet Headers

The API uses [Helmet](https://helmetjs.github.io/) to set security-related HTTP headers. Ensure Helmet middleware is enabled in production. Key headers include:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy`
- `X-XSS-Protection`

Review and customize the Content-Security-Policy header for your deployment.

### CSRF Protection

Enable CSRF protection for all state-changing requests in the dashboard and customer portal. The platform supports token-based CSRF mitigation. Ensure CSRF tokens are validated on the server for every POST, PUT, PATCH, and DELETE request originating from browser clients.

## Bug Bounty

We do not currently operate a formal bug bounty program. However, we value the security research community and will:

- Credit responsible disclosures in our release notes and security advisories (unless anonymity is requested)
- Provide a letter of acknowledgement upon request
- Consider monetary rewards on a case-by-case basis for high-impact findings

If we launch a formal program in the future, we will announce it here.

## License Considerations

Witylogix is licensed under AGPL-3.0. If you deploy a modified version, you are required to make your source code available to users who interact with it over a network. This transparency requirement supports the security of the ecosystem by enabling community review of modifications.

## Contact

- Security reports: security@wityliti.io
- General inquiries: Use GitHub Discussions or Issues (for non-security topics only)
