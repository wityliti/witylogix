# 02 — Sprint Process

This is how we plan and execute every sprint using Claude agents. Follow this process exactly.

## Sprint Lifecycle

```
Research → Plan → Branch → Execute (10 agents) → Verify → Commit → Document
```

### Phase 1: Research (5 min)

Before planning, audit what exists:
- `git status` — clean working tree?
- Count API vs mock pages: `git ls-files ... | grep page.tsx | while read f; do ...`
- Check registered routes: `grep 'prefix.*"/api/v4' apps/api/src/server.ts`
- Review tech debt from previous sprint summary
- Study Fleetbase repo at `/sessions/wizardly-great-planck/mnt/Witylogix/fleetbase` for best practices

### Phase 2: Plan (5 min)

1. Create `docs/sprint-X.X/SPRINT_X.X_PLAN.md` with:
   - Sprint number, date, branch name, theme
   - 10 deliverables (one per team member)
   - Each deliverable: assignee, role, task description, skill to apply
   - Success criteria checklist
2. Create the sprint branch: `git checkout -b sprint-X.X-descriptive-name`
3. **NO voting, NO options** — just plan and ship

### Phase 3: Execute (10-30 min)

Launch Claude agents for each task. Rules:
- Launch agents in parallel when tasks are independent
- Each agent prompt MUST specify:
  - Working directory
  - Which skill to read first
  - Exact files to modify
  - Coding standards to follow (see 04-CODING-STANDARDS)
  - "Only write code. Do not ask questions."
- Monitor agent output for completion

### Phase 4: Verify (5 min)

After all agents complete:
1. **Count check**: `git ls-files ... | grep page.tsx | ... | uniq -c` (API vs mock)
2. **Escaped directory check**: `ls -d apps/dashboard/src/app/\\\\*` (should find nothing)
3. **Secrets scan**: `git diff HEAD --no-color | grep -iE 'sk_live|sk_test|secret_key|...'`
4. **Validators test import**: `head -15 packages/validators/src/__tests__/schemas.test.ts | grep import` (must be `../index`)
5. **Clean .bak files**: `git ls-files --others --exclude-standard | grep '\.bak$' | xargs rm -f`
6. **Checkout tsbuildinfo**: `git checkout -- apps/dashboard/tsconfig.tsbuildinfo`

### Phase 5: Commit

```bash
git add [specific files]
git commit -m "$(cat <<'EOF'
feat(sprint-X.X): descriptive title

- bullet point 1
- bullet point 2

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

Rules:
- Use Conventional Commits: `feat`, `fix`, `chore`, `docs`
- Git identity: `user.email=connect@wityliti.io`, `user.name=youthocrat`
- NEVER use `git add .` or `git add -A` — add specific files
- NEVER amend previous commits — always create new ones
- Git push fails in sandbox — user pushes manually

### Phase 6: Document

1. Create `docs/sprint-X.X/SPRINT_X.X_SUMMARY.md`
2. Update `witylogix-sprint-tracker.xlsx` with 10 rows
3. Update README if significant features were added
4. Update CHANGELOG

## Sprint Naming Convention

```
sprint-X.X-descriptive-kebab-case-name
```

Examples:
- `sprint-9.1-returns-driver-scoring-dispatch`
- `sprint-9.3-tech-debt-blitz`
- `sprint-9.4-mass-page-rewiring-design`

## What Makes a Good Sprint

- **Focused theme** — Don't mix 5 unrelated things. Each sprint has a clear 1-line theme.
- **Big features** — The user wants visible progress, not invisible refactors. Each sprint should ship something you can see.
- **Measurable output** — "Converted 134 pages" not "worked on dashboard."
- **Clean commit** — One commit per sprint, descriptive message, no secrets.
