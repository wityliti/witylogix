# Bootstrap & onboarding implementation tracker

Use this checklist in your **virtual office** / standups: copy rows to Linear/GitHub Issues as needed.

**Design spec:** [2026-04-19-witylogix-bootstrap-setup-design.md](./2026-04-19-witylogix-bootstrap-setup-design.md)

## Phase A — Onboarding API wiring (in progress)

| # | Task | Status | Notes |
|---|------|--------|--------|
| A1 | Wire `verify-email.tsx` → `POST /api/v4/onboarding/verify-email` | Done | Bearer token; surface API `message` on error |
| A2 | Wire resend → `POST /api/v4/onboarding/resend-verification` | Done | 60s cooldown UI; rate limit from API |
| A3 | Debounced `PUT /onboarding/progress` on step/data change | Done | After initial GET hydrate |
| A4 | Merge JSON on verify-email in API (no wipe of `progress.data`) | Done | `onboarding.ts` |
| A5 | Hydrate `data.email` from `useAuth().user` when empty | Done | `onboarding/page.tsx` |

## Phase B — First-run setup UI (not started)

| # | Task | Status |
|---|------|--------|
| B1 | `SETUP_COMPLETE` (or equiv) + gated `/setup` routes | |
| B2 | Bootstrap token for public `/setup` | |
| B3 | Runtime public config for `NEXT_PUBLIC_API_URL` | |
| B4 | Connection tests (DB/Redis/email) from setup API | |

## Phase C — Golden path (DevOps)

| # | Task | Status |
|---|------|--------|
| C1 | Blessed `docker compose` + README | |
| C2 | Railway template / documented deploy | |

## Verification

```bash
pnpm lint && pnpm typecheck && pnpm test:run
```

Manual: register → onboarding verify step → enter code from email/logs → advance to deployment.
