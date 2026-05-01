# testrail-clone

TestRail-like test management platform for managing test cases, test runs, execution results, automation uploads, requirements traceability, reports, and project administration.

This repository is a TypeScript monorepo with a React web app and a Fastify API server backed by Prisma/PostgreSQL.

## Current Shape

- Project, suite, section, case, and case-step management.
- Run creation, run-scoped test instances, manual and bulk result entry, result history, and close-run protection.
- Requirements, traceability, coverage gap, defect coverage, milestones, plans, configurations, and report export baselines.
- Automation upload and a small TestRail-compatible `/api/v2` adapter for core case/run/test/result workflows.
- Project settings for members, API tokens, custom fields, custom statuses, case templates, defect integration, webhooks baseline, and audit logs.

The app is not a complete TestRail clone yet. Current implementation priorities are tracked in [docs/NEXT_ACTIONS.md](./docs/NEXT_ACTIONS.md), and broader parity gaps are tracked in [docs/ROADMAP.md](./docs/ROADMAP.md).

## Tech Stack

- Frontend: React + TypeScript + Vite + TanStack Query + TanStack Table + Tailwind CSS
- Backend: Node.js + TypeScript + Fastify + Prisma
- Database: PostgreSQL, Supabase-compatible
- Tests: Vitest for server tests

## Workspace

```text
testrail-clone/
  apps/
    web/          React frontend
    server/       Fastify API server and Prisma schema
  packages/
    shared/       Shared constants/types
    api-client/   Typed API client package placeholder
  docs/           Product, architecture, API, roadmap, and task documents
```

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Set `DATABASE_URL` in `.env` to a PostgreSQL database.

Generate Prisma client:

```bash
npm run prisma:generate -w apps/server
```

Run the API server:

```bash
npm run dev:server
```

Run the web app in a second terminal:

```bash
npm run dev:web
```

Default local URLs:

- Web: `http://localhost:5173`
- API health: `http://localhost:4000/api/health`

## Useful Commands

```bash
npm run build
npm run test
npm run lint
npm run prisma:migrate -w apps/server
npm run prisma:seed -w apps/server
```

## Documentation

Start with [docs/README.md](./docs/README.md) for the document index.

High-signal docs:

- [docs/PRODUCT_SPEC.md](./docs/PRODUCT_SPEC.md): product behavior and required capabilities
- [docs/ROADMAP.md](./docs/ROADMAP.md): current status, delivery phases, and TestRail parity gaps
- [docs/NEXT_ACTIONS.md](./docs/NEXT_ACTIONS.md): immediate implementation queue
- [docs/API_SPEC.md](./docs/API_SPEC.md): REST API and compatibility contract
- [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md): persistence model
- [docs/DOMAIN_MODEL.md](./docs/DOMAIN_MODEL.md): domain terms and invariants

## Development Notes

- Preserve the core model: `Project -> Suite -> Section -> TestCase -> TestRun -> TestInstance -> TestResult`.
- `TestResult` history is append-only; test case edits must not rewrite historical run snapshots.
- Prefer project-scoped, paginated, filterable APIs for large lists.
- Keep implementation docs in `docs/NEXT_ACTIONS.md` and phase-level roadmap status in `docs/ROADMAP.md`.
