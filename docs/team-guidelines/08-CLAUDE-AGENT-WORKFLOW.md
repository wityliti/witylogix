# 08 — Claude Agent Workflow

This document explains how to use Claude agents effectively for Witylogix development. This is the playbook that has been refined across 25+ sprints.

## The Agent Model

Each sprint launches up to 10 agents — one per team member. Agents are Claude sub-processes that run in parallel, each with their own context and tools. They can read files, write files, and run commands.

## Agent Prompt Template

Every agent prompt must include:

```
You are [INITIALS] ([ROLE]) at Witylogix. [TASK DESCRIPTION].

Working directory: /sessions/wizardly-great-planck/mnt/Witylogix/witylogix-platform

FIRST: Read [SKILL FILE] for best practices.

THEN: [DETAILED INSTRUCTIONS]

[LIST OF EXACT FILES TO MODIFY]

RULES:
- 'use client'; at top of all dashboard pages
- Tailwind CSS v3.4, dark theme
- Button variants: "primary" | "secondary" | "ghost" | "danger" — NO "outline"
- Badge variants: "default" | "success" | "warning" | "danger" | "info" | "primary"
- NAMED imports only
- cn() from @/lib/utils
- All Prisma access: (prisma as any).modelName

Only write code. Do not ask questions.
```

## Key Principles

### 1. Always Specify the Skill
Each agent must read the relevant ECC skill before starting:
```
FIRST: Read /sessions/wizardly-great-planck/mnt/.skills/skills/frontend-design/SKILL.md
```

Common skills:
- Frontend work → `frontend-design/SKILL.md` or `frontend-patterns` ECC skill
- Backend work → `backend-patterns` or `api-design` ECC skill
- Testing → `tdd-workflow` ECC skill
- Database → `postgres-patterns` ECC skill
- Deployment → `deployment-patterns` ECC skill

### 2. Be Extremely Specific
Bad: "Fix the dashboard pages"
Good: "Rewrite apps/dashboard/src/app/(dashboard)/orders/page.tsx. Remove the MOCK_ORDERS array on line 15-45. Replace with useApiList('/api/v4/orders'). Add LoadingSkeleton for loading state, ErrorState for errors. Keep all existing UI layout."

### 3. Include All Rules in Every Prompt
Agents don't share context. Every agent needs the full coding standards in its prompt. The rules section at the bottom of the template is mandatory.

### 4. Launch in Parallel When Possible
If tasks are independent (different files), launch all agents simultaneously:
- 3 agents modifying different pages → parallel
- 1 agent creates a hook, another uses it → sequential

### 5. Verify After Every Agent Run
Agents sometimes:
- Change files they shouldn't (package.json, unrelated configs)
- Use wrong variant names ("outline" instead "secondary")
- Create files outside `(dashboard)` route group
- Break the validators test import path
- Leave `.bak` files behind

Always run the verification checklist from Sprint Process (02-SPRINT-PROCESS.md).

## Common Agent Patterns

### Mass Page Conversion
When converting many pages to API hooks (Sprint 9.4 did 134 pages):
```
For EVERY page below, apply this pattern:
1. Find and remove ALL hardcoded mock arrays
2. Add hook import
3. Add loading/error guards
4. Wire data into existing UI

PAGES TO CONVERT:
1. analytics/page.tsx → useApiQuery('/api/v4/analytics')
2. analytics/reports/page.tsx → useApiList('/api/v4/analytics?view=reports')
...
```

### Design Redesign
When redesigning pages (Sprint 9.5 redesigned 6 pages):
```
FIRST: Read the frontend-design skill.
THEN: Read the current page.
THEN: Completely rewrite with:
1. [Specific sections to include]
2. [Layout requirements]
3. [Data sources to use]

DESIGN REQUIREMENTS:
- Dark theme: bg-zinc-950/900/800
- [Full design spec]
```

### Infrastructure/Backend
When building backend features:
```
FIRST: Read apps/api/src/server.ts to see existing patterns.
THEN: Create [file] following the pattern of [existing file].
Register in server.ts with prefix "/api/v4/[endpoint]".
```

## What Agents Can't Do

- Push to git (sandbox limitation)
- Access the internet (no npm install of new packages)
- Run the full application (no Docker, no database)
- See each other's changes (parallel agents are isolated)

## Handling Agent Failures

If an agent produces bad output:
1. `git checkout -- [affected files]` to revert
2. Re-run with a more specific prompt
3. Or manually fix the issues and commit

If an agent modifies files outside its scope:
```bash
git checkout -- packages/framework/package.json packages/validators/package.json
```
