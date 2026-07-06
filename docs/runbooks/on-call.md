# On-Call Guide

## Overview

This guide outlines responsibilities, procedures, and resources for engineers on the on-call rotation at Witylogix.

## On-Call Rotation Schedule

### Current Schedule

- **Weekly rotation**: Every Monday-Sunday
- **Business hours** (7 AM - 10 PM UTC): Primary on-call
- **After hours** (10 PM - 7 AM UTC): Secondary on-call
- **Escalation**: If primary unresponsive within 5 min for SEV1

### Access to Schedule

- **PagerDuty**: https://witylogix.pagerduty.com
- **Slack Channel**: #on-call-schedule
- **Calendar**: [Shared Google Calendar]

### Current On-Call

```
Week of March 16-22, 2026:
- Primary (Business): Alice Chen
- Secondary (After-hours): Bob Wilson
- Manager On-Call: Carlos Rodriguez
```

## PagerDuty Integration

### Setup Your Profile

1. Go to PagerDuty settings
2. Add phone number for SMS alerts
3. Add notification rules:
   - SMS for SEV1 (immediate)
   - Push notification for SEV2 (immediate)
   - Email for SEV3/SEV4 (batch)

### Alert Routing

| Severity | Primary Alert      | Escalation            |
| -------- | ------------------ | --------------------- |
| SEV1     | SMS + Push         | Escalate after 5 min  |
| SEV2     | Email + Slack      | Escalate after 15 min |
| SEV3     | Slack              | Next business day     |
| SEV4     | Email daily digest | Next sprint           |

## Escalation Procedures

### Escalation Decision Tree

```
Incident Detected
    ↓
Is it SEV1? → Yes → Immediate escalation to:
    ↓                 - VP Engineering
    No               - Manager On-Call
    ↓                - Incident Commander
Can you resolve in 15 min?
    ↓
    Yes → Resolve and document
    ↓
    No → Escalate to:
         - Engineering Manager
         - Team with expertise
         - VP Eng if critical
```

### Escalation Contacts

**VP Engineering**: [Name]

- Phone: [+1-XXX-XXX-XXXX]
- Email: [vp-eng@witylogix.com]
- PagerDuty: [Link]

**Engineering Manager**: [Name]

- Phone: [+1-XXX-XXX-XXXX]
- Email: [eng-mgr@witylogix.com]

**Incident Commander (on-call)**: See PagerDuty schedule

## Common Alert Playbooks

### Quick Reference: High Error Rate

**Alert**: `APIHighErrorRate` (>5% for 5min)

```bash
# 1. Check current error rate
curl -s "https://prometheus.prod.internal:9090/api/v1/query?query=\
sum(rate(http_requests_total{status=~'5..'}[5m]))/\
sum(rate(http_requests_total[5m]))"

# 2. View errors in logs
kubectl logs -n production -f deployment/api-server | grep ERROR

# 3. Check if related to recent deployment
kubectl rollout history deployment/api-server -n production

# 4. Check dependent services
kubectl get pods -n production

# 5. If recent deploy, rollback
kubectl rollout undo deployment/api-server -n production

# 6. Monitor error rate decrease
# Grafana: API Overview > Error Rate
```

### Quick Reference: High Latency

**Alert**: `APIHighLatency` (P95 >2s for 5min)

```bash
# 1. Check latency percentiles
kubectl exec -n production -it svc/prometheus -- \
  promtool query instant \
  'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))'

# 2. Check database query time
psql -h witylogix-db-prod -d witylogix << EOF
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;
EOF

# 3. Check API CPU/Memory
kubectl top pods -n production | grep api

# 4. If resource constrained, scale
kubectl scale deployment api-server -n production --replicas=10

# 5. Monitor latency improvement
# Refresh Grafana dashboard every 30 seconds
```

### Quick Reference: Database Connection Pool

**Alert**: `InfraHighPostgreSQLConnections` (>80% for 5min)

```bash
# 1. Check connection count
psql -h witylogix-db-prod -d witylogix \
  -c "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"

# 2. Check long-running queries
psql -h witylogix-db-prod -d witylogix << EOF
SELECT pid, query_start, state, query
FROM pg_stat_activity
WHERE state != 'idle' AND query_start < NOW() - INTERVAL '5 minutes'
ORDER BY query_start;
EOF

# 3. Kill idle connections if needed
psql -h witylogix-db-prod -d witylogix << EOF
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'witylogix' AND state = 'idle';
EOF

# 4. Increase connection pool
kubectl set env deployment/api-server -n production DB_POOL_SIZE=60

# 5. Increase database max_connections
# Requires RDS restart - coordinate with DBA
```

### Quick Reference: Webhook Delivery Backlog

**Alert**: `BusinessWebhookDeliveryBacklog` (DLQ size >1000)

```bash
# 1. Check DLQ size
psql -h witylogix-db-prod -d witylogix \
  -c "SELECT COUNT(*) FROM webhook_dlq;"

# 2. Check webhook processor logs
kubectl logs -n production deployment/webhook-processor --tail=100

# 3. Restart webhook processor
kubectl rollout restart deployment/webhook-processor -n production

# 4. Monitor DLQ drain rate
watch -n 10 'psql -h witylogix-db-prod -d witylogix \
  -c "SELECT COUNT(*) FROM webhook_dlq;"'

# 5. If stuck, manually reprocess
kubectl port-forward svc/webhook-processor 8080:8080 -n production
curl -X POST http://localhost:8080/admin/replay-dlq
```

## Handoff Procedures

### Start of Shift (7 AM UTC)

1. **Read the brief**: Check Slack #incidents for overnight summary
2. **Verify connectivity**: Test access to production systems
3. **Check status page**: witylogix.statuspage.io
4. **Review ongoing incidents**: Check PagerDuty for active incidents
5. **Check alert spam**: Review triggered alerts and silence if needed
6. **Notify team**: Post in #on-call-schedule

```
🚀 On-call shift starting
Previous on-call summary:
- 2 SEV3 incidents resolved
- 1 ongoing investigation (low priority)
- All systems healthy

Status: READY
```

### End of Shift (7 AM UTC next day)

1. **Handoff notes**: Write summary for incoming on-call
2. **Active incidents**: Brief incoming on-call on status
3. **System health**: Confirm all systems are stable
4. **Pending actions**: List any follow-ups needed

```
📋 Handoff Report
Shift duration: 24 hours
Incidents: 1 SEV2, 2 SEV3
Resolution time: All <2 hours
Current status: All green

Pending:
- Post-mortem for SEV2 incident (scheduled Tuesday)
- Database connection pool scaling (in progress)

Incoming on-call: [Name]
Ready for handoff? ✓
```

## Resources & Tools

### Access & Credentials

- **Kubernetes**: `kubectl config use-context witylogix-prod`
- **AWS Console**: [SSO Link]
- **Databases**: SSH through bastion host
- **Logs**: [ELK Stack](https://logs.witylogix.internal)
- **Metrics**: [Grafana](https://grafana.witylogix.internal)
- **Alerts**: [Prometheus AlertManager](https://alertmanager.witylogix.internal)

### Useful Commands

```bash
# System status
kubectl cluster-info
kubectl top nodes
kubectl top pods -n production

# Get pod logs
kubectl logs -n production -f deployment/api-server
kubectl logs -n production -p deployment/api-server  # previous pod

# Execute commands in pod
kubectl exec -it -n production svc/api-server -- /bin/bash

# Port forward for debugging
kubectl port-forward -n production svc/api-server 8080:8080

# Get recent events
kubectl get events -n production --sort-by='.lastTimestamp'
```

### Runbooks

- [Incident Response](/docs/runbooks/incident-response.md)
- [Scaling](/docs/runbooks/scaling.md)
- [Backup & Recovery](/docs/runbooks/backup-recovery.md)

## Self-Care & Sustainability

### Rest & Availability

- **Dedicated rest period**: 2 hours minimum per shift
- **Emergency only**: Only respond to P1/critical incidents during rest
- **Next day coverage**: Coordinate with manager for day off after night shift
- **Burnout prevention**: Rotate secondary role every 4 weeks

### Shift Support

- **Manager on-call**: Available for escalation and guidance
- **Peer support**: Slack #on-call-support for questions
- **Post-shift debrief**: Optional, but recommended after incidents

### Time Off

- **Blackout days**: Mark unavailable days in PagerDuty
- **Handoff to cover**: Find coverage before marking off
- **Minimum notice**: 2 weeks for scheduled time off

## Contact & Support

**Questions?** Message #on-call-support or your engineering manager
**Urgent help?** Page manager on-call through PagerDuty
**Documentation issues?** Open issue in internal wiki
