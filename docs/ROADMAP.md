# TestRail Clone Product Roadmap

## Product Direction
- Goal: Build a test management platform with stable domain boundaries rather than a simple CRUD app.
- Core data flow priority: `Test Case (source spec) -> Test Run -> Test Instance -> Test Result history`.
- API strategy: REST-first internal API, with compatibility adapters added later.
- Integration strategy: Support CI/CLI automation uploads from Playwright, pytest, pytest-bdd, and Appium.
- Frontend stack direction: React + TypeScript, with Tailwind CSS, shadcn/ui, TanStack Query, TanStack Table, and Recharts.
- Backend stack direction: Node.js + TypeScript + Prisma + Supabase PostgreSQL, with Fastify as default API framework.

## MVP Baseline Clarification
- MVP includes authentication and membership context:
  - Login / logout / current user
  - Project membership-aware authorization
  - Role-based UI/API behavior (`owner`, `manager`, `tester`, `viewer`)

## Phase 0: Project Foundation
### Goals
- Establish architecture and repository structure for long-term expansion.
- Define product-level scope and delivery sequence before implementation.

### Scope
- Analyze repository and decide baseline structure (greenfield in current state).
- Create core design documents:
  - `docs/ROADMAP.md`
  - `docs/DOMAIN_MODEL.md`
  - `docs/API_SPEC.md`
  - `docs/DATABASE_SCHEMA.md`
  - `docs/IMPLEMENTATION_PLAN.md`
- Set up monorepo skeleton for React(TypeScript) frontend + Node.js(TypeScript) backend + Supabase(PostgreSQL).

### Exit Criteria
- Documents exist and align on shared vocabulary.
- Layered backend skeleton is created (`API -> service -> repository/db`).
- Phase 1 implementation tasks are clearly broken down.

## Phase 1: Core Domain Model & Database
### Goals
- Implement foundational domain entities and persistence model.
- Lock the separation between `TestCase`, `TestInstance`, and `TestResult`.

### Scope
- Create base schema/migrations/tables for:
  - users, projects, project_members
  - test_suites, sections, test_cases, test_case_steps
  - test_runs, test_instances, test_results, test_result_steps
  - test_plans, test_plan_entries, milestones
  - attachments, api_tokens, audit_logs
- Add standard metadata:
  - `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`
- Add snapshot fields in `test_instances`:
  - `title_snapshot`, `priority_snapshot`, `type_snapshot` (and related fields where needed)
- Add initial seed data for local development.

### Exit Criteria
- Migration applies cleanly.
- Seed data inserts without FK violations.
- Domain invariants are represented in schema and model constraints.

## Phase 2: Project / Suite / Section / Case Management
### Goals
- Provide stable authoring workflows for test case specifications.

### Scope
- Projects CRUD
- Suites CRUD by project
- Section tree CRUD (nested sections via `parent_section_id`)
- Test Case CRUD and step CRUD
- Case list query/filter/search

### Exit Criteria
- Users can create and organize cases in section hierarchy.
- Case details and case step ordering are persisted correctly.
- API responses follow common error and pagination format.

## Phase 3: Runs / Instances / Results
### Goals
- Build execution workflow with immutable history and current status tracking.

### Scope
- Test Run CRUD and close workflow
- Run creation modes:
  - include all cases
  - selected case IDs
- Generate `test_instances` from selected cases with snapshot data
- Result entry APIs:
  - single result per test instance
  - run-level result posting
- Keep `test_results` append-only and sync latest status to `test_instances`
- Compute run progress/status counts

### Exit Criteria
- Run generation works with both include-all and selected-cases flow.
- Posting a new result updates instance latest status and preserves history.
- Run detail surfaces status distribution and completion progress.

## Phase 4: Automation Upload API
### Goals
- Open the system to automation pipelines and make CI-driven result ingestion a first-class capability.

### Scope
- API tokens for machine authentication
- Bulk result upload endpoints
- Mapping by `case_id`, `automation_key`, and `external_id`
- Store `comment`, `elapsed`, `version`, `defects`, and step results
- Support CI metadata (`external_run_id`, `ci_provider`, `ci_build_id`, `job_url`, `commit_sha`, `branch`, `attempt`)
- Execution productivity inside run workflow:
  - test assignment (`run-level`, `instance-level`)
  - `My Tests` / `Assigned to me` query views
  - rerun workflow (`failed`/`blocked`/`retest`/`all` filters)
  - bulk result entry path for fast triage
  - result attachments and defect linking from result entry panel

### Exit Criteria
- CI tools can upload results reliably via token-auth APIs.
- Bulk upload supports partial failures with consistent error format.
- Atomic and non-atomic bulk upload modes are both validated.
- Teams can assign/reassign execution work and rerun selected subsets without manual run recreation.

### Deliverables (Must-have)
- `run assignment + my tests` API/UI path
- `rerun` API with status filters
- `bulk result entry` path in run detail
- `result attachment + defect link` from execution context

## Phase 5: Dashboard & Reports
### Goals
- Provide operational visibility for QA and release teams.

### Scope
- Project dashboard (case count, active runs, recent failures, automation coverage)
- Run summary and failed case views
- Status trend and recent result reports
- Milestone progress views
- Traceability and coverage analytics:
  - requirement/reference links
  - requirement coverage report
  - defect coverage report
  - traceability matrix (requirement -> case -> run/result)
- Collaboration views:
  - activity timeline (case/run/result)
  - comments/mentions in execution context
  - notification feed + notification preference model

### Exit Criteria
- Core report widgets load from domain-level aggregation queries.
- Teams can identify quality risk and release readiness quickly.
- Teams can answer "what is untested, what failed, and what requirement is at risk" from dashboards/reports.

### Deliverables (Must-have)
- traceability matrix report
- requirement coverage and coverage gap report
- recent failures/results and run summary widgets
- activity timeline read view

## Phase 6: Milestones / Plans / Environment Matrix
### Goals
- Support release-level planning across environments/devices.

### Scope
- Milestone CRUD
- Test Plan CRUD
- Plan entries for environment combinations (Chrome/Safari/Android/iOS, etc.)
- Generate and track linked runs per plan entry
- Promote configurations to first-class domain:
  - `configuration_groups`
  - `configurations`
  - `plan_entry_configurations`
- Plan-level rerun and entry-level run generation workflow
- Import/export for planning and execution operations:
  - cases CSV import/export
  - runs/results export
  - report export (CSV/PDF in later iteration)

### Exit Criteria
- Users can manage release plans with environment-specific runs.
- Plan detail provides per-run and rolled-up status summary.
- Configuration matrix is reusable and does not depend on free-text environment strings.

### Deliverables (Must-have)
- configuration group/value management
- plan-entry configuration mapping
- run generation by plan entry configuration
- import/export baseline (cases CSV, results CSV)

## Phase 7: Advanced Platform Features
### Goals
- Reach production-grade governance and extensibility.

### Scope
- Custom fields
- Custom result statuses
- Case templates
- Attachments (result evidence files)
- Project/member permission model hardening
- Webhook events
- Audit log query and compliance support
- Defect integration UX and provider adapters:
  - project integration settings
  - defect URL templates
  - push/create defect actions from result context
- Notification delivery:
  - assignment notifications
  - failed-result notifications
  - scheduled summary reports
- TestRail-like API adapter completion and compatibility expansion

### Exit Criteria
- Auditability and access controls meet team governance needs.
- Integration surface is stable enough for external ecosystem onboarding.
- Admins can configure fields/statuses/templates/integrations without schema migration for each project.

### Deliverables (Must-have)
- custom field/status/template admin
- defect integration settings + push action baseline
- notification preferences + assignment/failure notification delivery
