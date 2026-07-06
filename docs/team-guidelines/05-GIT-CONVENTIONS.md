# 05 — Git & Commit Conventions

## Identity

```bash
git config user.email "connect@wityliti.io"
git config user.name "youthocrat"
```

## Branching

One branch per sprint:

```
sprint-X.X-descriptive-kebab-case
```

Create from the latest sprint branch:

```bash
git checkout -b sprint-9.6-feature-name
```

## Commit Messages

Use Conventional Commits. Always include the co-author line.

```bash
git commit -m "$(cat <<'EOF'
feat(sprint-9.5): Prisma type safety, 6-page design polish, WebSocket infrastructure

- Fix Prisma schema root with prismaSchemaFolder preview feature
- Redesign 6 key dashboard pages with professional dark theme UI
- Build WebSocket plugin with channel subscriptions
- Build SSE fallback for browser compatibility

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

### Prefixes

| Prefix              | When                      |
| ------------------- | ------------------------- |
| `feat(sprint-X.X):` | New features in a sprint  |
| `fix(component):`   | Bug fixes                 |
| `chore(scope):`     | Maintenance, config, deps |
| `docs(scope):`      | Documentation changes     |

## Staging Rules

- **NEVER** use `git add .` or `git add -A` — these can include secrets or `.env` files
- **ALWAYS** add specific files by path
- **ALWAYS** checkout `tsconfig.tsbuildinfo` before committing: `git checkout -- apps/dashboard/tsconfig.tsbuildinfo`
- **ALWAYS** clean `.bak` files: `git ls-files --others | grep '\.bak$' | xargs rm -f`

## Secrets Scanning

Run before EVERY commit:

```bash
git diff HEAD --no-color | grep -iE '^[+].*(?:sk_live|sk_test|secret_key|PRIVATE.KEY|password\s*=)' | head -5
```

If anything shows up with a `+` prefix (added line), DO NOT commit. Fix it first.

## Push

Git push fails in the sandbox environment. The user pushes manually after each sprint:

```bash
git push origin sprint-X.X-branch-name
```

## Never Do

- `git push --force` — Never
- `git reset --hard` — Never without explicit user request
- `git commit --amend` — Creates new commits instead
- `git add -A` — Stage files explicitly
- `--no-verify` — Never skip hooks
- Commit `.env`, `credentials.json`, or files with real secrets
