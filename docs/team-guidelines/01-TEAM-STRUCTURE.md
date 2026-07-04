# 01 — Team Structure & Roles

Witylogix operates as a simulated 10-person startup. Each team member is an AI agent with a defined specialty, responsibility scope, and skill set. When planning sprints, every task is assigned to one team member, and each member gets exactly 1 task per sprint.

## The Team

| Initials | Name | Role          | Primary Focus                                                  | Skills Applied                                       |
| -------- | ---- | ------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| **AR**   | —    | CTO           | Architecture decisions, critical infrastructure, schema design | postgres-patterns, backend-patterns, system-design   |
| **NK**   | —    | Frontend Lead | Dashboard architecture, layout systems, design quality         | frontend-patterns, frontend-design, coding-standards |
| **DM**   | —    | Frontend      | Page implementation, UI wiring, visual polish                  | frontend-patterns, frontend-design                   |
| **RG**   | —    | Backend Lead  | API routes, service layer, database queries                    | api-design, backend-patterns                         |
| **SP**   | —    | Full-stack    | Cross-cutting features that touch both frontend and backend    | frontend-patterns, backend-patterns                  |
| **VS**   | —    | Component Dev | Reusable UI components, design system, component library       | frontend-patterns, frontend-design                   |
| **PK**   | —    | Sr. Backend   | Core packages, integrations, heavy backend work                | backend-patterns, api-design, security-review        |
| **AM**   | —    | Integration   | Third-party integrations, CI/CD, deployment                    | deployment-patterns, coding-standards                |
| **KS**   | —    | QA Lead       | Testing, quality gates, bug triage, validation                 | tdd-workflow, verification-loop                      |
| **ZR**   | —    | AI Engineer   | AI/ML features, documentation, sprint planning support         | coding-standards, ai-first-engineering               |

## How Assignments Work

Each sprint has exactly 10 tasks — one per team member. Tasks are assigned based on:

1. **Domain expertise** — Backend tasks go to RG/PK, frontend to NK/DM/VS
2. **Continuity** — If someone built a feature, they maintain it
3. **Load balancing** — Heavy sprints distribute across the team
4. **Skill application** — Each task specifies which ECC skill to apply (tracked in the sprint tracker's "Skill Applied" column since Sprint 8.4)

## Sprint Tracker

All assignments are tracked in `witylogix-sprint-tracker.xlsx` at the repo root. Columns:

| Column           | Content                                              |
| ---------------- | ---------------------------------------------------- |
| Sprint           | Version number (e.g., 9.5)                           |
| Assignee         | Team member initials                                 |
| Role             | Their role title                                     |
| Task Description | What they're building                                |
| Skill Applied    | Which ECC/anthropic skill the agent should read      |
| Status           | Done / In Progress                                   |
| Output           | What was delivered (files, line counts, key details) |
