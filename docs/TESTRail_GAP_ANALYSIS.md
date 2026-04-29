# TestRail Parity Gap Analysis

Date: 2026-04-29

This document compares the current TestRail-clone implementation and product specs against the public TestRail feature/API surface. It is not a promise to clone every TestRail feature exactly; it is the working checklist for deciding what remains before calling the product a practical TestRail alternative.

## Sources Checked

Primary public TestRail references:
- TestRail introduction and core workflows: https://support.testrail.com/hc/en-us/articles/7076810203028
- TestRail API reference index: https://support.testrail.com/hc/en-us/sections/7077185274644-API-reference
- Test cases API: https://support.testrail.com/hc/en-us/articles/7077292642580-Test-Cases-APIs
- Runs API: https://support.testrail.com/hc/en-us/articles/7077874763156-Runs
- Plans API: https://support.testrail.com/hc/en-us/articles/7077711537684-Plans
- Configurations API: https://support.testrail.com/hc/en-us/articles/7077298488340-Configurations
- Custom fields and result statuses: https://support.testrail.com/hc/en-us/articles/7373850291220-Configuring-custom-fields
- Users, roles, and permissions: https://support.testrail.com/hc/en-us/articles/7077978310292-Users and https://support.testrail.com/hc/en-us/articles/7610049585684-Managing-user-permissions-and-roles
- Project-level administration: https://support.testrail.com/hc/en-us/articles/7766616883348-Project-level-administration
- Milestones best practices and reporting: https://support.testrail.com/hc/en-us/articles/32747143021716-Best-Practices-Guide-Milestones and https://support.testrail.com/hc/en-us/articles/9272742269588-Milestone-Summary-report

## Executive Summary

The app now covers the central test management spine:

- projects, suites, sections, cases, steps
- runs, run-scoped tests, manual/automation results, result history
- milestones, plans, configurations, basic matrix generation
- requirements and traceability baseline
- attachments metadata and signed URL baseline
- defect link baseline
- import/export baseline
- project members, tokens, custom fields, custom statuses, case templates, audit log query UI
- a small `/api/v2` TestRail-compatible adapter for core case/run/test/result automation endpoints

It is not yet feature-complete compared with TestRail. The largest remaining gaps are:

1. User-facing activity feed and notifications.
2. Full webhook event model and delivery.
3. Broader TestRail `/api/v2` parity across API reference categories.
4. Rich reporting with saved/scheduled reports and deeper milestone/project/plan reports.
5. Advanced admin: users, groups, global roles, role permissions, project-level administration.
6. Custom field depth: field scopes, field type coverage, project assignments, persisted values on cases/results.
7. Plans/configurations depth: full TestRail-style plan entry editing, assigned users, run selection, config combination management.
8. Import/export depth beyond CSV baseline: XML/JSON, richer mapping wizard, async file lifecycle.
9. Evidence and defect provider depth: real object storage lifecycle and provider API integrations.

## Parity Matrix

| Area | Current status | Gap |
| --- | --- | --- |
| Projects | Mostly complete | No project archive/read-only mode, global default access, or project-level admin model. |
| Suites/sections/cases | Mostly complete | Missing rich TestRail case filters, saved views, bulk case operations, permanent delete/restore UI, and full custom field value persistence. |
| Case history | Partial | Version list exists, but compare/restore detail UI and API restore path are still planned. |
| Case fields/types/priorities/templates | Partial | Custom fields/statuses/templates baseline exists; missing TestRail-style field type coverage, case/result field scopes, project assignments/options, priorities/types APIs, and actual custom value storage. |
| Runs/tests/results | Mostly complete | Missing reopen policy, richer run/test filters, time tracking/estimate forecasting, result editing policy, comments/mentions, and full custom result fields. |
| Assignments/to-dos | Partial | My Tests exists; TestRail-like to-do lists, workload/task list views, and notification-driven assignment workflows are missing. |
| Milestones | Partial | CRUD and linked runs exist; missing sub-milestones, milestone forecasts, milestone summary reports, and richer milestone dashboards. |
| Plans/configurations | Partial | Baseline plan/config matrix exists; missing full TestRail plan entries semantics, assigned-to per entry/run, include/exclude case selection depth, config combination editing, and plan close/reopen/report parity. |
| Reports | Partial | Basic dashboards and traceability reports exist; missing saved reports, scheduled/email reports, report permissions/access, report history, rich TestRail report types, and cross-project reports. |
| Requirements/traceability | Partial | Requirement CRUD and coverage reports exist; missing richer requirement import/sync, external requirement provider integration, and advanced matrix UI. |
| Attachments/evidence | Partial | Metadata and signed URL baseline exists; missing production object storage lifecycle, upload progress/resume, preview UX, retention, storage cleanup, and attachment version/security policy. |
| Defects/integrations | Partial | URL-template defect links exist; missing actual Jira/GitHub/Azure API push/sync, provider validation, defect status sync, and richer defect reports. |
| Automation | Partial | Bulk upload and token baseline exists; missing richer automation mapping UI, token scopes/expiration UI, retry queues, CI examples, and full TestRail API compatibility. |
| Import/export | Partial | CSV case/result/report baseline exists; missing XML/JSON import/export, column mapping UI depth, large async file lifecycle, attachments import/export, and full TestRail-compatible export shapes. |
| Users/roles/permissions | Partial | Project members and simple roles exist; missing global users, groups, custom roles/permissions, no-access/default project access, project-level admin, and user APIs parity. |
| Audit logs | Partial | Query UI baseline exists; missing full audit event coverage, export, retention, admin-level audit, and project-level admin access controls. |
| Activity/notifications | Not implemented | Activity events, notification inbox, email/digest preferences, and delivery jobs are missing. |
| Webhooks | Partial | Display/create placeholder exists; missing persisted webhook model, event taxonomy, signing, retries, deliveries, disabled-on-failure behavior, and logs. |
| TestRail `/api/v2` adapter | Partial | Core cases/runs/tests/results baseline only; many categories from the official API reference are missing. |

## Missing `/api/v2` Compatibility Categories

The official API reference includes many categories beyond the current adapter. The current adapter covers only a core subset:

- implemented baseline: cases, runs, tests, add result for case, bulk results for cases
- missing or incomplete: attachments, BDDs, case fields, case types, configurations, datasets, groups, labels, milestones, plans, priorities, projects, reports/cross-project reports, result fields, roles, sections, shared steps, statuses, suites, templates, users, variables

Compatibility priority should be driven by migration/automation needs rather than implemented all at once. Recommended order:

1. Projects, suites, sections, milestones, plans, configurations.
2. Case fields, result fields, case types, priorities, statuses, templates.
3. Attachments, reports, users, roles.
4. Labels, groups, shared steps, datasets, variables, BDDs.

## High-Priority Product Gaps

### P0: Activity And Notifications

Why: The roadmap still lists this as missing, and TestRail emphasizes to-dos, filters, and email notifications for team coordination.

Required docs/work:
- Add `ActivityEvent` persistence implementation.
- Write events for case/run/result/assignment/attachment/defect/settings changes.
- Add paginated project/run/case activity APIs.
- Add notification preferences, inbox, unread count, and delivery model.
- Add UI routes/components for activity feed and notifications.

### P0: Webhook Event Model

Why: Settings has a Webhooks page, but currently it is still not a production webhook system.

Required docs/work:
- Persist webhook subscriptions, event names, secret/signature settings, active state.
- Define event taxonomy shared with activity events.
- Add delivery attempts, retry policy, failure logs, and disable-on-repeated-failure.
- Add UI to create/edit/delete/test webhooks and inspect delivery history.

### P1: Custom Fields As Actual Data

Why: Custom field definitions exist, but TestRail custom fields affect case/result forms and stored values.

Required docs/work:
- Add field scope: case vs result, later run/test if desired.
- Expand field types beyond `text`, `number`, `select`: checkbox, date, dropdown, integer, milestone, multi-select, string, text, URL, user, steps, step results where appropriate.
- Store custom values on test cases and test results.
- Add validation, filtering/sorting eligibility, and UI form rendering.

### P1: Full Admin Model

Why: TestRail roles and permissions include global roles, groups, default project access, project-specific overrides, and project-level administration.

Required docs/work:
- Add users/groups/global roles schema.
- Add permission matrix rather than only role labels.
- Add project default access and group/user overrides.
- Add project-level admin permissions.
- Add user/role admin APIs and UI.

### P1: Reporting Depth

Why: Current reports are baseline widgets; TestRail has saved reports, scheduling, access controls, and detailed project/milestone/plan reports.

Required docs/work:
- Add saved report definitions.
- Add async report generation jobs with history and downloadable artifacts.
- Add scheduling/email delivery model.
- Expand report types: project summary, milestone summary, plan summary/comparison, cases summary, results/property distributions, workload/estimate reports, defect/reference reports.

### P1: Plan And Configuration Depth

Why: Matrix baseline exists, but TestRail plans are a central structure for generating and managing runs across configurations.

Required docs/work:
- Support richer plan entry editing, close/reopen, assigned users, include/exclude cases per entry.
- Support configuration combination editing and validation.
- Add plan-level progress/report pages closer to TestRail.
- Add `/api/v2` plan/config compatibility endpoints.

## Medium-Priority Gaps

### P2: Import/Export Expansion
- XML/JSON import/export.
- Multi-step mapping wizard.
- Large file lifecycle and async workers.
- Attachments import/export.
- TestRail-compatible export fields.

### P2: Evidence Storage Hardening
- Real object storage integration and cleanup.
- Preview/download authorization.
- Retention and virus-scan hooks if needed.
- Upload progress and retry UX.

### P2: Defect Provider Integrations
- Jira/GitHub/Azure API integration beyond URL templates.
- Push/create with remote error handling.
- Defect status sync.
- Provider-specific field mapping.

### P2: Case Authoring Depth
- Bulk case actions.
- Saved filters/views.
- Shared steps.
- Labels.
- BDDs/scenarios if product scope requires them.
- Deleted case restore/permanent delete semantics.

## Documentation Actions Needed

The existing docs should be updated in follow-up batches:

1. `PRODUCT_SPEC.md`: add this gap analysis as a canonical companion and clarify that TestRail parity is not complete.
2. `ROADMAP.md`: add a new parity-completion phase after Phase 7, or expand Phase 7 into activity/notifications/webhooks/admin/reporting/API parity tracks.
3. `API_SPEC.md`: add explicit planned sections for missing `/api/v2` categories and admin/activity/notifications/webhooks.
4. `DATABASE_SCHEMA.md`: distinguish target-only tables from implemented migrations.
5. `SCREEN_INVENTORY.md`: add screens for activity feed, notification inbox/preferences, saved reports, report history, webhook delivery logs, role/group administration, shared steps, labels, and full custom field value management.

## Bottom Line

No, the TestRail feature set is not fully implemented yet. The current app has a strong core execution foundation and a growing administration baseline, but the remaining parity work is still significant. The next recommended implementation order is:

1. Activity events and notification inbox/preferences.
2. Real webhook event model and delivery logs.
3. Custom field value persistence on cases/results.
4. Saved/scheduled report model.
5. Expanded `/api/v2` compatibility for projects/suites/sections/milestones/plans/configurations and customization metadata.
