# Scaling Runbook

## Overview

This runbook provides procedures for scaling infrastructure to handle increased load across the Witylogix platform.

## Horizontal Scaling: API Instances

### When to Scale

Scale when:

- API CPU utilization >80% for >5 minutes
- API memory >85% for >5 minutes
- P95 latency >2 seconds
- Request rate >3x baseline

### Automatic Scaling

Kubernetes HPA is configured to auto-scale API pods:

```bash
# View current HPA status
kubectl get hpa -n production api-server

# Current config:
# - Min replicas: 3
# - Max replicas: 20
# - Target CPU: 70%
# - Target memory: 80%
```

### Manual Scaling

If automatic scaling is disabled or not sufficient:

```bash
# Scale to specific number of replicas
kubectl scale deployment api-server -n production --replicas=10

# Monitor scaling progress
kubectl get pods -n production -w

# Wait for pods to be Ready
kubectl wait --for=condition=Ready pod -l app=api-server -n production --timeout=5m
```

### Verification After Scaling

```bash
# Check pod distribution across nodes
kubectl get pods -n production -o wide | grep api-server

# Verify metrics are healthy
kubectl top pod -n production | grep api-server

# Check request latency improvement in Grafana
# Dashboard: API Overview > P95/P99 Latencies
```

## Vertical Scaling: Increase Resources

### When to Scale Vertically

- Single container is CPU-bound but can't be parallelized
- Batch processing jobs need more memory
- Database queries need more RAM

### Procedure

```bash
# Update resource requests/limits in deployment
kubectl edit deployment api-server -n production

# Modify resources section:
# resources:
#   requests:
#     cpu: 2000m        # increase from 1000m
#     memory: 2Gi       # increase from 1Gi
#   limits:
#     cpu: 4000m
#     memory: 4Gi

# Trigger rolling restart
kubectl rollout restart deployment/api-server -n production

# Monitor rollout
kubectl rollout status deployment/api-server -n production
```

## Database Scaling

### Read Replicas

For read-heavy workloads, add read replicas:

```bash
# Create read replica in AWS RDS
aws rds create-db-instance-read-replica \
  --db-instance-identifier witylogix-db-read-1 \
  --source-db-instance-identifier witylogix-db-prod \
  --db-instance-class db.r5.2xlarge \
  --region us-east-1

# Update application connection pool to include read replica
# Update REPLICA_ENDPOINTS in secrets
kubectl set env deployment/api-server \
  -n production \
  REPLICA_ENDPOINTS="witylogix-db-read-1.endpoint:5432"
```

### Connection Pool Scaling

Increase connection pool limits:

```bash
# Check current max connections
psql -h witylogix-db-prod.123456789.us-east-1.rds.amazonaws.com \
  -U postgres -d witylogix \
  -c "SHOW max_connections;"

# Increase max connections (requires restart)
aws rds modify-db-parameter-group \
  --db-parameter-group-name witylogix-prod \
  --parameters ParameterName=max_connections,ParameterValue=500,ApplyMethod=immediate

# Restart database to apply changes
aws rds reboot-db-instance \
  --db-instance-identifier witylogix-db-prod

# Increase application pool size
kubectl set env deployment/api-server \
  -n production \
  DB_POOL_SIZE=50
```

### Query Optimization

```bash
# Identify slow queries
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

# Add indexes for frequently scanned columns
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_deliveries_status ON deliveries(status);

# Monitor index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC
LIMIT 20;  -- unused indexes
```

## Redis Scaling

### Enable Cluster Mode

For high throughput caching, enable Redis Cluster:

```bash
# Create Redis cluster in Elasticache
aws elasticache create-replication-group \
  --replication-group-description "witylogix-cache-cluster" \
  --engine redis \
  --cache-node-type cache.r5.xlarge \
  --num-cache-clusters 3 \
  --automatic-failover-enabled \
  --multi-az-enabled \
  --engine-version 7.0

# Update Redis endpoints in application config
kubectl set env deployment/api-server \
  -n production \
  REDIS_CLUSTER_ENDPOINTS="node1:6379,node2:6379,node3:6379"

# Verify cluster status
aws elasticache describe-replication-groups \
  --replication-group-id witylogix-cache-cluster
```

### Memory Scaling

```bash
# Check current memory usage
redis-cli INFO memory | grep used_memory_human

# Increase node type (requires downtime)
aws elasticache modify-cache-cluster \
  --cache-cluster-id witylogix-cache-1 \
  --cache-node-type cache.r6g.2xlarge \
  --apply-immediately

# Monitor memory after scaling
# Grafana Dashboard: Infrastructure > Redis Memory
```

## CDN Configuration

### CloudFront Distribution Setup

```bash
# Create CloudFront distribution for static assets
aws cloudfront create-distribution \
  --distribution-config file://cloudfront-config.json

# Invalidate cache after deployments
aws cloudfront create-invalidation \
  --distribution-id E123EXAMPLE \
  --paths "/*"

# Monitor cache hit ratio
# CloudWatch > CloudFront > Cache Statistics
```

### Cache Behavior Rules

```json
{
  "PathPatterns": ["images/*", "static/*", "assets/*"],
  "TTL": 31536000,
  "Compress": true,
  "FieldLevelEncryptionId": null
}
```

## Auto-Scaling Rules

### Current Configuration

```yaml
# API Server Auto-Scaling
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-server
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 300
```

## Monitoring Scaling Events

```bash
# Watch scaling in real-time
kubectl get hpa -n production -w

# View scaling history
kubectl describe hpa api-server -n production

# Check events
kubectl get events -n production --sort-by='.lastTimestamp' | grep api-server
```

## Capacity Planning

### Load Testing

Before peak seasons, run load tests:

```bash
# Using Apache JMeter
jmeter -n -t load-test.jmx \
  -l results.jtl \
  -j jmeter.log \
  -Gthreads=1000 \
  -Grampup=60 \
  -Gduration=600

# Monitor metrics during load test
# Grafana: API Overview dashboard
```

### Baseline Metrics

Current baseline (steady state):

- API requests: 5,000 req/s
- P95 latency: 200ms
- Error rate: 0.1%
- API CPU usage: 30% per pod
- Database connections: 100/500 max

Peak load expectations:

- Black Friday: 50x baseline
- Marketing campaign: 10x baseline
- New feature launch: 5x baseline
