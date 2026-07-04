# Publish images workflow

`publish-images.yml` — builds one Docker image per Witylogix app and pushes to GHCR.

## When it runs

| Event                        | Image tags produced                            |
| ---------------------------- | ---------------------------------------------- |
| `push` to `main`             | `:main-<sha>`, `:latest`                       |
| `push` of tag `v1.2.3`       | `:1.2.3`, `:1.2`, `:1`, `:latest`              |
| `workflow_dispatch` (manual) | `:manual-<sha>` (+ optional `extra_tag` input) |

## Images produced

One per service — matches what `@witylogix/bench-provider-docker-compose` generates in compose files:

- `ghcr.io/wityliti/witylogix-api`
- `ghcr.io/wityliti/witylogix-dashboard`
- `ghcr.io/wityliti/witylogix-customer-portal`
- `ghcr.io/wityliti/witylogix-tracking-page`
- `ghcr.io/wityliti/witylogix-docs`

## How to cut a release

```bash
# From main, after merging the release PR
git tag v4.1.0
git push origin v4.1.0
```

The workflow runs automatically on the tag push and publishes `:4.1.0`, `:4.1`, `:4`, and updates `:latest`. `bench deploy` in downstream installations picks the new `:latest` on next `docker compose up`.

## How to do a preview build

```
gh workflow run publish-images.yml --ref feature-branch --field extra_tag=preview-acme
```

Publishes `:manual-<sha>` plus `:preview-acme` for the services. Reference from a throwaway `bench.config.yaml` via `witylogix.version: preview-acme`.

## Layer caching

Each service has its own `scope=<service>` GitHub Actions cache. Cold build ~8 min per service in parallel; warm rebuild ~1–2 min.

## Permissions

The workflow uses `GITHUB_TOKEN` with `packages: write` — no extra secrets required. GHCR package visibility defaults to private; public read requires an owner toggle in the package settings after first publish.

## Troubleshooting

- **`denied: permission_denied: write_package`** — the GitHub Actions token doesn't have package-write permission. Usually fixed by setting `permissions: packages: write` in the workflow (already done).
- **Build OOM** — Docker Buildx occasionally OOMs on large monorepo images. Workaround: temporarily increase runner to `ubuntu-latest-4-cores` via `runs-on`.
- **`witylogix-docs` fails but others succeed** — the docs image uses `infra/docker/Dockerfile.docs` instead of `apps/docs/Dockerfile`. Verify the infra Dockerfile's build context still resolves from repo root.
