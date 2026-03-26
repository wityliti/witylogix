# Contributing to Witylogix

Thank you for considering contributing to Witylogix! This document outlines the process for contributing to the project.

## Getting started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/witylogix-platform.git`
3. Follow the [Getting Started](#getting-started) section in the README
4. Create a feature branch: `git checkout -b feature/my-feature`

## Development setup

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

## Pull request process

1. Ensure your code passes all checks: `pnpm lint && pnpm typecheck && pnpm test`
2. Write or update tests for your changes
3. Use [Conventional Commits](https://www.conventionalcommits.org) for commit messages
4. Include a DCO sign-off on all commits: `git commit -s -m "feat: my change"`
5. Open a pull request against the `main` branch
6. Fill out the PR template with a description of your changes

## Commit messages

We follow the Conventional Commits specification:

```
feat(scope): add new feature
fix(scope): fix a bug
docs: update documentation
refactor(scope): restructure code
test(scope): add or update tests
chore: update build configuration
```

Scope examples: `api`, `shopify-app`, `driver-app`, `tracking`, `db`, `core`, `routing`, `carriers`

## Architecture Decision Records

For changes that affect the system's architecture, create an ADR in `docs/adr/` following the template in `ADR-001`. This includes changes to the database schema, new service integrations, technology choices, and significant API design decisions.

## Developer Certificate of Origin

By contributing to this project, you certify that your contribution was created in whole or in part by you and that you have the right to submit it under the AGPL-3.0 license. Add the following to your commit messages:

```
Signed-off-by: Your Name <your@email.com>
```

Use `git commit -s` to add this automatically.

## Code of conduct

Please be respectful and constructive in all interactions. We are committed to providing a welcoming and inclusive experience for everyone.

## Questions?

Open a [GitHub Discussion](https://github.com/witylogix/witylogix-platform/discussions) or ask in our [Discord](https://discord.gg/witylogix).
