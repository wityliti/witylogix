# Backup & Disaster Recovery Runbook

## Overview

This runbook defines backup strategies and disaster recovery procedures for the Witylogix platform.

## Backup Schedule

### Daily Full Backup

**Time**: 2:00 AM UTC
**Retention**: 30 days
**Storage**: S3 (primary), S3 (secondary region)
**RPO**: 24 hours

```bash
# Trigger manual backup
pg_basebackup -h witylogix-db-prod -D /backups/full_$(date +%Y%m%d) -Ft -z
```

### Hourly WAL Archiving

**Schedule**: Every hour at :00 UTC
**Retention**: 7 days
**Storage**: S3 with encryption

```bash
# WAL archive location
AWS S3 bucket: witylogix-wal-archives
Path: s3://witylogix-wal-archives/production/wals/
```

### Application Data

For non-database application state:

- **Redis**: Snapshots every 6 hours, 7-day retention
- **Elasticsearch**: Daily snapshots, 30-day retention
- **Message queues**: Transient, no backup needed

## Backup Verification

### Weekly Verification

Every Friday at 6:00 PM UTC:

```bash
#!/bin/bash

# Test full backup integrity
pg_verify_backup -D /backups/latest_full \
  --progress \
  --verbose

# Test restore from WAL
mkdir -p /tmp/test_restore
pg_basebackup -D /tmp/test_restore -h witylogix-db-prod -R
pg_wal_replay_checkpoint /tmp/test_restore

# Verify database consistency
psql -d /tmp/test_restore -c "SELECT COUNT(*) FROM orders;"
psql -d /tmp/test_restore -c "ANALYZE;"

# Cleanup
rm -rf /tmp/test_restore
```

### Automated Backup Validation

```yaml
# Kubernetes CronJob for backup verification
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup-verification
  namespace: production
spec:
  schedule: "0 18 * * FRI"  # Friday 6 PM UTC
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: verify
            image: postgres:15
            command:
            - /scripts/verify-backup.sh
            volumeMounts:
            - name: backup-scripts
              mountPath: /scripts
          volumes:
          - name: backup-scripts
            configMap:
              name: backup-scripts
          restartPolicy: OnFailure
```

## Point-in-Time Recovery (PITR)

### Prerequisites

- Latest full backup available
- WAL archives available up to target time
- Sufficient disk space for recovery

### Recovery Procedure

```bash
# 1. Stop application
kubectl scale deployment api-server -n production --replicas=0
kubectl scale deployment dashboard -n production --replicas=0

# 2. Extract full backup
mkdir -p /recovery/data
cd /tmp/backups
tar -xzf base_$(date +%Y%m%d).tar.gz -C /recovery/data

# 3. Prepare recovery config
cat > /recovery/data/recovery.conf << EOF
restore_command = 'aws s3 cp s3://witylogix-wal-archives/production/wals/%f %p'
recovery_target_time = '2024-03-16 14:30:00+00'
recovery_target_timeline = 'latest'
recovery_target_inclusive = true
EOF

# 4. Start database in recovery mode
pg_ctl -D /recovery/data -l recovery.log start

# 5. Monitor recovery progress
tail -f recovery.log | grep -E "(REDO|archive_recovery|database system)"

# 6. When recovery completes
psql -h localhost -c "SELECT now() as current_time, pg_last_wal_receive_lsn();"

# 7. Validate data
psql -h localhost -d witylogix -c "SELECT COUNT(*) FROM orders WHERE created_at > '2024-03-16 14:00:00';"

# 8. Restart application
kubectl scale deployment api-server -n production --replicas=3
kubectl scale deployment dashboard -n production --replicas=2
```

### Using RDS Recovery

For AWS RDS databases:

```bash
# List available backup windows
aws rds describe-db-instances \
  --db-instance-identifier witylogix-db-prod \
  --query 'DBInstances[0].[LatestRestorableTime,PreferredBackupWindow]'

# Restore to point in time
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier witylogix-db-prod \
  --target-db-instance-identifier witylogix-db-recovery \
  --restore-time '2024-03-16T14:30:00Z' \
  --use-latest-restorable-time \
  --db-instance-class db.r5.xlarge

# Monitor restore progress
aws rds describe-db-instances \
  --db-instance-identifier witylogix-db-recovery \
  --query 'DBInstances[0].[DBInstanceStatus,PercentProgress]'

# Validate recovered database
psql -h witylogix-db-recovery.*.rds.amazonaws.com \
  -U postgres -d witylogix \
  -c "SELECT COUNT(*) as order_count FROM orders;"

# Promote recovered database (update connection strings)
kubectl set env deployment/api-server \
  -n production \
  DB_HOST=witylogix-db-recovery.*.rds.amazonaws.com

# Cleanup old database after validation
aws rds delete-db-instance \
  --db-instance-identifier witylogix-db-prod \
  --skip-final-snapshot
```

## Cross-Region Backup

### Replication Setup

```bash
# Create standby in secondary region (us-west-2)
aws rds create-db-instance-read-replica \
  --db-instance-identifier witylogix-db-standby-west \
  --source-db-instance-identifier arn:aws:rds:us-east-1:ACCOUNT:db:witylogix-db-prod \
  --source-region us-east-1 \
  --db-instance-class db.r5.xlarge \
  --region us-west-2 \
  --multi-az

# Monitor replication lag
watch -n 5 'aws rds describe-db-instances \
  --db-instance-identifier witylogix-db-standby-west \
  --query "DBInstances[0].StatusInfos[0]" \
  --region us-west-2'
```

### Failover to Secondary Region

```bash
# Promote read replica to standalone database
aws rds promote-read-replica \
  --db-instance-identifier witylogix-db-standby-west \
  --region us-west-2

# Update DNS/connection strings to point to standby
# Monitor replication lag until it reaches zero
# Restart application instances with new endpoint

kubectl set env deployment/api-server \
  -n production \
  DB_HOST=witylogix-db-standby-west.*.rds.amazonaws.com \
  DB_REGION=us-west-2
```

## Recovery Time Objectives (RTO/RPO)

| Component | RTO | RPO | Strategy |
|-----------|-----|-----|----------|
| Database | 15 min | 1 hour | Full backup + WAL replay |
| Redis Cache | 5 min | 6 hours | Snapshot restore |
| Application State | 5 min | 0 | Stateless, redeploy |
| Elasticsearch | 30 min | 1 hour | Snapshot restore |

## Disaster Recovery Checklist

### Daily Checklist (5 min)
- [ ] Backup completion status in CloudWatch
- [ ] Backup storage quota check
- [ ] Replication lag <1 minute

### Weekly Checklist (Friday)
- [ ] Test backup integrity
- [ ] Test PITR with dummy database
- [ ] Verify S3 cross-region replication
- [ ] Check backup documentation is current

### Monthly Checklist
- [ ] Full DR drill with recovery
- [ ] Update runbook based on findings
- [ ] Review backup costs
- [ ] Test failover to secondary region

### Quarterly Checklist
- [ ] Full system DR simulation
- [ ] Load test recovered environment
- [ ] Train new team members on procedure
- [ ] Review and update RTO/RPO targets

## Emergency Contacts

**Database Team Lead**: [Name, Phone, Email]
**Infrastructure Team Lead**: [Name, Phone, Email]
**VP Engineering**: [Name, Phone, Email]
**AWS Support**: [Support Case #, Phone]

## Related Documentation

- [Incident Response Runbook](/docs/runbooks/incident-response.md)
- [AWS RDS Recovery Guide](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIT.html)
- [PostgreSQL WAL Documentation](https://www.postgresql.org/docs/15/wal-intro.html)
