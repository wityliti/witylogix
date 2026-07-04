# Self-Hosting WityLogix on Kubernetes

This guide covers deploying WityLogix to a Kubernetes cluster from scratch using the manifests in `infra/k8s/`.

---

## Prerequisites

| Requirement               | Version             | Notes                                                       |
| ------------------------- | ------------------- | ----------------------------------------------------------- |
| Kubernetes cluster        | ≥ 1.27              | Any distribution (EKS, GKE, k3s, Talos, etc.)               |
| `kubectl`                 | matching cluster    | Configured with cluster access                              |
| `helm`                    | ≥ 3.14              | For values-based install                                    |
| PostgreSQL with PostGIS   | ≥ 15                | **External managed** — do not run inside k8s for production |
| Redis                     | ≥ 7                 | External managed or in-cluster                              |
| Container registry access | —                   | `ghcr.io/wityliti/witylogix` (public)                       |
| Ingress controller        | nginx or Traefik    | Must support `kubernetes.io/ingress.class`                  |
| TLS certificates          | cert-manager ≥ 1.14 | Or manually provisioned secrets                             |

---

## Image Registry

Images are built automatically on every push to `staging` and on every `v*` release tag:

```
ghcr.io/wityliti/witylogix/api:<tag>
ghcr.io/wityliti/witylogix/dashboard:<tag>
ghcr.io/wityliti/witylogix/customer-portal:<tag>
ghcr.io/wityliti/witylogix/tracking-page:<tag>
ghcr.io/wityliti/witylogix/shopify-app:<tag>
```

Available tags:

- `latest` — latest stable release
- `v1.2.3` / `v1.2` / `v1` — pinned semver tags
- `staging` — latest staging build
- `sha-<git-sha>` — immutable commit-pinned tag

---

## Namespace setup

Create namespaces before applying manifests:

```bash
kubectl create namespace witylogix-staging
kubectl create namespace witylogix-prod
```

---

## Secrets

**Never commit real secret values.** All sensitive configuration is injected via Kubernetes Secrets. Create them before deploying:

```bash
# API service secrets (prod example)
kubectl create secret generic witylogix-api-secrets \
  --namespace witylogix-prod \
  --from-literal=DATABASE_URL='postgresql://user:password@db-host:5432/witylogix?sslmode=require' \
  --from-literal=REDIS_URL='redis://:password@redis-host:6379' \
  --from-literal=JWT_SECRET='<random-32-byte-hex>' \
  --from-literal=SESSION_SECRET='<random-32-byte-hex>'

# Dashboard secrets (if Next.js requires server-side env vars)
kubectl create secret generic witylogix-dashboard-secrets \
  --namespace witylogix-prod \
  --from-literal=NEXTAUTH_SECRET='<random-32-byte-hex>'
```

Rotate secrets with `kubectl create secret ... --dry-run=client -o yaml | kubectl apply -f -`.

---

## Fresh Install

### 1. Clone the repository

```bash
git clone https://github.com/wityliti/witylogix.git
cd witylogix
```

### 2. Create your values file

Copy the example values and fill in your environment:

```bash
cp infra/k8s/helm/witylogix/values.yaml infra/k8s/helm/witylogix/values.prod.yaml
```

Key values to configure:

```yaml
# values.prod.yaml

global:
  imageTag: "v1.2.3" # Pin to a release tag
  imagePullPolicy: IfNotPresent

ingress:
  enabled: true
  className: nginx
  host: witylogix.example.com
  tls:
    enabled: true
    secretName: witylogix-tls # Created by cert-manager or manually

api:
  replicaCount: 2
  resources:
    requests:
      cpu: "250m"
      memory: "256Mi"
    limits:
      cpu: "1000m"
      memory: "512Mi"
  hpa:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70

dashboard:
  replicaCount: 2

customerPortal:
  replicaCount: 2

trackingPage:
  replicaCount: 1

shopifyApp:
  enabled: false # Set true only if using the Shopify integration
```

### 3. Apply database migrations

Run migrations as a one-off Job before deploying the application:

```bash
kubectl run witylogix-migrate \
  --namespace witylogix-prod \
  --image ghcr.io/wityliti/witylogix/api:v1.2.3 \
  --env-from secret/witylogix-api-secrets \
  --restart Never \
  --command -- pnpm --filter @witylogix/db db:migrate:deploy
```

Wait for completion:

```bash
kubectl wait pod/witylogix-migrate \
  --namespace witylogix-prod \
  --for condition=Ready \
  --timeout 120s
kubectl logs pod/witylogix-migrate --namespace witylogix-prod
kubectl delete pod/witylogix-migrate --namespace witylogix-prod
```

### 4. Deploy with Helm

```bash
helm upgrade --install witylogix infra/k8s/helm/witylogix \
  --namespace witylogix-prod \
  --values infra/k8s/helm/witylogix/values.prod.yaml \
  --atomic \
  --timeout 5m
```

### 5. Verify

```bash
kubectl get pods --namespace witylogix-prod
kubectl get ingress --namespace witylogix-prod
```

Check that all pods are `Running` and the ingress has an address assigned.

---

## Upgrade Path

1. Pin `global.imageTag` in your values file to the new release tag.
2. Run migrations (step 3 above) for the new version — check the release notes for schema changes.
3. Re-run the Helm upgrade command:

```bash
helm upgrade witylogix infra/k8s/helm/witylogix \
  --namespace witylogix-prod \
  --values infra/k8s/helm/witylogix/values.prod.yaml \
  --atomic \
  --timeout 5m
```

Helm performs a rolling update — existing pods stay live until new pods pass readiness checks.

To roll back to the previous release:

```bash
helm rollback witylogix --namespace witylogix-prod
```

---

## Values Reference

| Key                                      | Default         | Description                         |
| ---------------------------------------- | --------------- | ----------------------------------- |
| `global.imageTag`                        | `latest`        | Image tag for all apps              |
| `global.imagePullPolicy`                 | `IfNotPresent`  | Kubernetes pull policy              |
| `ingress.enabled`                        | `true`          | Whether to create Ingress resources |
| `ingress.className`                      | `nginx`         | Ingress controller class            |
| `ingress.host`                           | _(required)_    | Public hostname                     |
| `ingress.tls.enabled`                    | `true`          | Enable TLS on the Ingress           |
| `ingress.tls.secretName`                 | `witylogix-tls` | Kubernetes TLS secret name          |
| `api.replicaCount`                       | `2`             | Initial replicas for the API        |
| `api.hpa.enabled`                        | `true`          | Enable HPA for the API              |
| `api.hpa.minReplicas`                    | `2`             | HPA minimum replicas                |
| `api.hpa.maxReplicas`                    | `10`            | HPA maximum replicas                |
| `api.hpa.targetCPUUtilizationPercentage` | `70`            | CPU target for HPA                  |
| `dashboard.replicaCount`                 | `2`             | Replicas for the dashboard app      |
| `customerPortal.replicaCount`            | `2`             | Replicas for the customer portal    |
| `trackingPage.replicaCount`              | `1`             | Replicas for the tracking page      |
| `shopifyApp.enabled`                     | `false`         | Deploy the Shopify app              |
| `shopifyApp.replicaCount`                | `1`             | Shopify app replicas                |

---

## Troubleshooting

**Pods stuck in `ImagePullBackOff`**

- Check that the image tag exists: `docker manifest inspect ghcr.io/wityliti/witylogix/api:<tag>`
- Ensure the namespace has pull access (GHCR public images don't require credentials)

**API fails to start with `DATABASE_URL` error**

- Verify the secret exists: `kubectl get secret witylogix-api-secrets -n witylogix-prod`
- Check connection from inside the cluster: `kubectl run pg-test --image postgres:15 --rm -it --restart Never -- psql "$DATABASE_URL" -c '\l'`

**Ingress not getting an address**

- Confirm ingress controller is running: `kubectl get pods -n ingress-nginx`
- Check ingress class annotation matches your controller

**Migration job fails**

- Inspect logs: `kubectl logs pod/witylogix-migrate -n witylogix-prod`
- Common causes: wrong DATABASE_URL, PostGIS extension not installed, network policy blocking DB access

---

## Architecture Notes

- **Stateless apps only**: all WityLogix app containers are stateless. Session data is stored in Redis; persistent data in PostgreSQL.
- **No in-cluster databases**: the manifests do not ship a PostgreSQL or Redis StatefulSet. Use a managed service (RDS, Cloud SQL, Aiven, etc.) for production.
- **Secret injection**: all secrets are mounted via `envFrom: secretRef`, not ConfigMap. Never put `DATABASE_URL` in a ConfigMap.
- **Railway coexistence**: Kubernetes is additive — existing Railway deployments continue to work unchanged. The `infra/k8s/` path is purely for self-hosters.
