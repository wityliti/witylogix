# Incident Response Runbook

## Overview

This runbook defines the process and procedures for responding to operational incidents across the Witylogix platform.

## Severity Levels

### SEV1 - Critical
**Definition**: Service is completely unavailable or core functionality is severely degraded, affecting all or most users.

- **Impact**: Major business impact, widespread user impact
- **Response Time**: Immediate (within 5 minutes)
- **Escalation**: VP Engineering, CEO notification
- **Communication**: Every 15 minutes
- **Examples**:
  - API service completely down
  - Database completely unavailable
  - All webhooks failing
  - Authentication system down

### SEV2 - High
**Definition**: Significant service degradation or feature unavailability affecting a large portion of users.

- **Impact**: Significant business impact, many users affected
- **Response Time**: Within 15 minutes
- **Escalation**: Engineering Manager, Product Manager
- **Communication**: Every 30 minutes
- **Examples**:
  - API error rate >10%
  - P95 latency >5 seconds
  - Delivery SLA breached
  - Integration provider down

### SEV3 - Medium
**Definition**: Service is impaired but workarounds exist, or limited user impact.

- **Impact**: Moderate business impact, limited users affected
- **Response Time**: Within 1 hour
- **Escalation**: Team Lead
- **Communication**: Every 1 hour
- **Examples**:
  - API error rate 5-10%
  - Single region degradation
  - Non-critical feature unavailable

### SEV4 - Low
**Definition**: Minor issues with minimal user impact or no immediate fix required.

- **Impact**: Minimal business impact
- **Response Time**: Within 4 hours
- **Escalation**: Team members
- **Communication**: Daily
- **Examples**:
  - Metrics collection issues
  - Non-critical alerts
  - Documentation issues

## Response Time SLAs

| Severity | Detection | Initial Response | Update Frequency | Resolution |
|----------|-----------|------------------|-----------------|------------|
| SEV1     | Automated | 5 min            | Every 15 min    | 1 hour     |
| SEV2     | Automated | 15 min           | Every 30 min    | 4 hours    |
| SEV3     | Manual    | 1 hour           | Every 1 hour    | 24 hours   |
| SEV4     | Manual    | 4 hours          | Daily           | 7 days     |

## Escalation Paths

### SEV1 Escalation
1. On-call engineer responds immediately
2. Notify VP Engineering
3. Activate SEV1 war room (Zoom/Slack)
4. Notify CEO and COO
5. Begin customer communication

### SEV2 Escalation
1. On-call engineer responds within 15 minutes
2. Notify Engineering Manager
3. Notify Product Manager
4. If not resolved in 30 min, escalate to VP Engineering

### SEV3 Escalation
1. On-call engineer responds within 1 hour
2. Notify Team Lead
3. If not resolved in 4 hours, escalate to Engineering Manager

## Incident Commander Checklist

When declared SEV1:

- [ ] **Initiate**: Declare SEV1, create war room
- [ ] **Assess**: Gather initial information on scope and impact
- [ ] **Communicate**: Send initial incident notification to stakeholders
- [ ] **Mobilize**: Assemble incident response team
- [ ] **Document**: Create incident tracking ticket (Jira)
- [ ] **Timeline**: Log all actions with timestamps
- [ ] **Updates**: Send status updates every 15 minutes
- [ ] **Recovery**: Establish recovery strategy
- [ ] **Testing**: Validate fixes before full rollback
- [ ] **Resolution**: Confirm all systems are healthy
- [ ] **Handoff**: Document for post-mortem
- [ ] **Closeout**: Close incident and schedule post-mortem

## Communication Templates

### Initial Incident Notification
```
INCIDENT: [Service Name] Degradation
Severity: [SEV1/SEV2/SEV3/SEV4]
Start Time: [UTC Time]
Status: INVESTIGATING

Impact: [Description of impact]
Affected Users: [Estimate]
Current Investigation: [What we know so far]

Updates will be provided every [15/30 minutes].
```

### Status Update
```
INCIDENT UPDATE #[N]
Time: [UTC Time]
Status: [INVESTIGATING/IN PROGRESS/MONITORING/RESOLVED]
Duration: [Time since start]

Progress:
- [Action taken]
- [Finding]
- [Current focus]

ETA: [Estimated time to resolution]
```

### Resolution Notification
```
INCIDENT RESOLVED
Time: [UTC Time]
Duration: [Total incident time]

Root Cause: [Brief description]
Resolution: [What was done to fix it]

A post-mortem will be scheduled for [date/time].
Thank you for your patience.
```

## Common Incident Scenarios

### API Service Down
1. Check API pod status: `kubectl get pods -n production | grep api`
2. Check API logs: `kubectl logs -n production deployment/api-server --tail=500`
3. Check load balancer health: `aws elbv2 describe-target-health`
4. Restart API pods if healthy: `kubectl rollout restart deployment/api-server -n production`
5. If issue persists, check database connectivity

### Database Connection Failures
1. Check PostgreSQL status: `pg_isready -h postgres.prod.internal`
2. Check connection pool: `SELECT count(*) FROM pg_stat_activity;`
3. Check RDS CPU/memory metrics in CloudWatch
4. Increase connection pool if nearing limits
5. If replication lag >10s, failover to read replica

### Webhook Delivery Backlog
1. Check DLQ size: `SELECT COUNT(*) FROM webhook_dlq;`
2. Verify webhook processor pod: `kubectl get pods -n production | grep webhook`
3. Restart webhook processor: `kubectl rollout restart deployment/webhook-processor`
4. Monitor DLQ drain rate
5. If >5000 items, consider manual replay

### Memory Leak Detection
1. Check pod memory usage: `kubectl top pod -n production`
2. Check memory trend over time in Grafana
3. Restart affected pod: `kubectl delete pod -n production <pod-name>`
4. Monitor for recurrence
5. Create ticket for investigation

## Post-Mortem Template

```markdown
# Post-Mortem: [Service] [Date]

## Summary
Brief 1-2 sentence summary of incident

## Timeline
- HH:MM: Event occurred
- HH:MM: Alert triggered
- HH:MM: Investigation started
- HH:MM: Root cause identified
- HH:MM: Fix deployed
- HH:MM: Service recovered

## Root Cause
Detailed explanation of what caused the incident

## Impact
- Duration: X minutes
- Users affected: X%
- Revenue impact: $X

## Contributing Factors
- Factor 1
- Factor 2
- Factor 3

## Resolution
Step-by-step what was done to fix

## Follow-up Actions
- [ ] Action 1: Owner, Due date
- [ ] Action 2: Owner, Due date
- [ ] Action 3: Owner, Due date

## Lessons Learned
- What went well
- What could be improved
- Prevention for next time
```

## Resources

- **War Room**: [Zoom Link]
- **Incident Tracking**: [Jira Project]
- **Status Page**: [Status.witylogix.com]
- **Runbooks Directory**: `/docs/runbooks/`
- **On-Call Schedule**: [PagerDuty]
