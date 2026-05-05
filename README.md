# testrail-clone

TestRail-inspired test management platform built as a TypeScript monorepo.

The repository already contains a working React frontend and Fastify API for managing projects, test cases, runs, execution results, automation uploads, reporting, and project administration. This README reflects the codebase as implemented in source, not just the planning documents in `docs/`.

## What is implemented

- Project, suite, and section management
- Test case CRUD, step editing, bulk delete, and case version history with restore
- Test run creation, run instances, assignees, rerun flows, and close-run workflow
- Manual and bulk result entry, step results, attachments, defect links, and result history
- Project overview, activity feed, notifications, reports, and result explorer
- Milestones, plans, configuration matrix management, and rollup reporting
- Custom fields, custom statuses, case templates, members, tokens, audit logs, webhooks, and defect integration settings
- Automation upload and ingestion endpoints
- CSV import/export flows and a lightweight TestRail-compatible `/api/v2` adapter

## Repository layout

```text
testrail-clone/
  apps/
    server/        Fastify API, domain modules, Prisma schema, Vitest tests
    web/           React app, route pages, feature hooks, shared UI
  packages/
    shared/        Shared statuses, roles, API helpers, error codes, common types
    api-client/    Small API client package placeholder
  docs/            Product, architecture, API, roadmap, and task documents
```

## Architecture

### Frontend

`apps/web` is a React + Vite application using React Router and TanStack Query.

Current route groups include:

- Login and auth bootstrap
- Project list and project overview
- Cases workspace
- Runs, run detail, result entry, and "My Tests"
- Reports, activity, and notifications
- Automation and upload detail
- Import/export
- Milestones and plans
- Project settings for tokens, members, custom fields, statuses, templates, webhooks, defect integration, and audit logs

### Backend

`apps/server` is a Fastify API with module-oriented route registration.

Key server modules include:

- `auth`
- `projects`, `suites`, `sections`
- `cases`
- `runs`
- `results`
- `reports`
- `activity`
- `requirements`
- `automation`
- `integrations`
- `importExport`
- `milestones`
- `plans`
- `settings`
- `tokens`
- `testrail`

The core domain model in code is:

`Project -> Suite -> Section -> TestCase -> TestRun -> TestInstance -> TestResult`

## Persistence modes

The server supports two storage modes:

### 1. In-memory mode

This is the default behavior today.

- No database setup is required
- Data resets when the server restarts
- Good for UI work, API exploration, and running most server tests

The default comes from `apps/server/src/config/env.ts`, where `USE_IN_MEMORY_REPOSITORY` is treated as enabled unless it is explicitly set to `false`.

### 2. Prisma + PostgreSQL mode

Use this when you want persistent data and the full Prisma-backed workflow.

- Set `DATABASE_URL`
- Set `DIRECT_URL` when using a pooled production database connection
- Set `USE_IN_MEMORY_REPOSITORY=false`
- Generate Prisma client
- Run migrations
- Optionally seed demo data

## Getting started

### Quick start

```bash
npm install
cp .env.example .env
npm run dev:server
npm run dev:web
```

Default local URLs:

- Web: `http://localhost:5173`
- API health: `http://localhost:4000/api/health`

### Running with PostgreSQL

1. Copy `.env.example` to `.env`
2. Set `DATABASE_URL`
3. Set `DIRECT_URL` if `DATABASE_URL` points at a connection pooler
4. Add `USE_IN_MEMORY_REPOSITORY=false`
5. Run:

```bash
npm run prisma:generate -w apps/server
npm run prisma:migrate -w apps/server
npm run prisma:seed -w apps/server
npm run dev:server
npm run dev:web
```

## Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | Server runtime mode |
| `PORT` | `4000` | Fastify server port |
| `WEB_ORIGIN` | `http://localhost:5173` | Allowed web origin for the API |
| `DATABASE_URL` | empty unless set | Required for Prisma/PostgreSQL mode |
| `DIRECT_URL` | empty unless set | Direct/session database URL used by Prisma migrations when `DATABASE_URL` uses a pooler |
| `USE_IN_MEMORY_REPOSITORY` | `true` unless explicitly `false` | Switches between in-memory and Prisma repositories |

## Useful commands

```bash
npm run dev:web
npm run dev:server
npm run build
npm run test
npm run lint
npm run prisma:generate -w apps/server
npm run prisma:migrate -w apps/server
npm run prisma:deploy -w apps/server
npm run prisma:seed -w apps/server
```

### Render server deployment without Pre-Deploy Command

If your Render plan does not expose a Pre-Deploy Command, run production migrations during the build step.

Use these Render settings for the API service:

```bash
# Build Command
npm ci --include=dev && npm run render:build:server

# Start Command
npm run start -w apps/server
```

Required Render environment variables:

```bash
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require"
DIRECT_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require"
USE_IN_MEMORY_REPOSITORY=false
WEB_ORIGIN="https://your-vercel-app.vercel.app"
```

## Testing

Server tests live in `apps/server/src/__tests__` and currently cover:

- Health checks
- Project, suite, section, and case CRUD flows
- Custom fields, custom statuses, templates, and audit log flows
- Run creation, result entry, assignment, summaries, and close workflow
- Lower-level run and result service behavior

`npm run test` currently runs the server test suite only.

## Notable implementation details

- Authentication is currently development-oriented and issues a session token from the login endpoint without a full password validation system.
- `packages/api-client` exists but is still a small placeholder package.
- Requirements features are implemented against the Prisma-backed repository and are more limited in in-memory mode.
- The Prisma schema already models users, memberships, cases, versions, runs, results, milestones, plans, configurations, notifications, custom fields, tokens, audit logs, import/export jobs, and webhook delivery data.

## Documentation

The `docs/` directory is still useful for product intent and roadmap context, but the source code is the best reference for current behavior.

Good starting points:

- [docs/README.md](./docs/README.md)
- [docs/PRODUCT_SPEC.md](./docs/PRODUCT_SPEC.md)
- [docs/API_SPEC.md](./docs/API_SPEC.md)
- [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md)
- [docs/ROADMAP.md](./docs/ROADMAP.md)
- [docs/NEXT_ACTIONS.md](./docs/NEXT_ACTIONS.md)
