# Witylogix — Agent PR & Review Policy

This file supplements `CLAUDE.md` with mandatory PR review requirements.
Coding agents MUST follow these rules in addition to the Git Workflow in `CLAUDE.md`.

---

## Pull Request Requirements

### Every PR must:

1. Be created with `gh pr create --base staging` (never merge directly to staging or main)
2. Have a clear title following conventional commits: `feat(WIT-XX): description`
3. Have a description that includes: what changed, why, and how to test it
4. Pass all CI checks before requesting review (lint, typecheck, tests)

### Review requirements by PR size:

| PR size (lines changed)   | Required reviewers    |
| ------------------------- | --------------------- |
| < 200 lines               | 1 reviewer            |
| 200–400 lines             | 1 reviewer            |
| > 400 lines (large PR)    | 2 reviewers           |
| > 1000 lines (very large) | 2 reviewers + CTO tag |

> **Preferred approach:** Break large PRs into smaller, focused PRs whenever possible.
> If a PR grows past 400 lines, split it into multiple PRs before submitting.

### How to request reviews:

When creating a PR, request reviewers based on the area of change:

| Changed area                      | Primary reviewer                | Secondary reviewer (for large PRs)     |
| --------------------------------- | ------------------------------- | -------------------------------------- |
| `apps/api` (backend)              | Rahul Gupta (`rahul-gupta`)     | Priya Krishnan (`priya-krishnan`)      |
| `apps/dashboard`                  | Nisha Kapoor (`nisha-kapoor`)   | Dev Malhotra (`dev-malhotra`)          |
| `apps/shopify-app`                | Aryan Mehta (`aryan-mehta`)     | Rahul Gupta (`rahul-gupta`)            |
| `apps/customer-portal`            | Dev Malhotra (`dev-malhotra`)   | Nisha Kapoor (`nisha-kapoor`)          |
| `packages/db` (Prisma/schema)     | Rahul Gupta (`rahul-gupta`)     | Arjun Rao/CTO for any schema migration |
| `infra` / Docker / Railway config | Amir Merchant (`amir-merchant`) | Rohan Desai (`rohan-desai`)            |
| `tests` / `vitest`                | Kavya Sharma (`kavya-sharma`)   | Area lead                              |
| Cross-cutting (multiple areas)    | Arjun Rao/CTO + relevant lead   | —                                      |

### Tagging in PR descriptions:

Use Paperclip issue links and @-mention the reviewer agent name in the PR body.

Example PR body:

```
## Summary
- Implements Shopify webhook handler for order/create events
- Wires through to order service and emits socket event
- Ref: [WIT-54](/WIT/issues/WIT-54)

## Test plan
- [ ] pnpm test:run passes
- [ ] /health returns 200 on staging
- [ ] Shopify webhook fires and order appears in dashboard

Reviewers: @aryan-mehta (primary), @rahul-gupta (large PR — secondary)
```

### What NOT to do:

- Do NOT merge your own PR without a review
- Do NOT merge PRs with failing CI checks
- Do NOT create PRs >1000 lines if avoidable — split the work
- Do NOT request review until lint/typecheck/tests pass locally

---

## PR Audit Checklist (for reviewers)

When reviewing a PR:

- [ ] Does the code match the ticket requirements?
- [ ] Are there tests for the new behavior?
- [ ] No secrets or credentials in the diff?
- [ ] No direct commits to staging or main?
- [ ] CI is passing?
- [ ] DB schema changes have a migration file?
