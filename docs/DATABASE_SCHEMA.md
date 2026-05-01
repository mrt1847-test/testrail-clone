# Database Schema Design (Supabase PostgreSQL)

## Global Conventions
- Primary keys: `bigint` identity.
- Audit metadata on mutable tables:
  - `created_at`, `updated_at`, `deleted_at`
  - `created_by`, `updated_by`
- JSON-heavy fields use `jsonb`.
- Large list screens must use pagination and narrow projections.
- High-frequency execution writes should be append-only and batch-friendly.

## Enum Model
- `project_role`: `owner`, `manager`, `tester`, `viewer`
- `run_status`: `open`, `closed`
- `result_source`: `manual`, `automation`, `api`
- `test_status`: `untested`, `passed`, `failed`, `blocked`, `retest`
- `requirement_status`: `active`, `changed`, `deprecated`
- `job_status`: `pending`, `running`, `completed`, `failed`, `cancelled`

## Table Definitions

## users
- `id`, `email`, `name`, `is_active`, audit fields
- Initial strategy: app-owned users table
- Future strategy: map `auth.users.id` to app `users` with 1:1 link

## projects
- `id`, `name`, `description`, `is_active`, audit fields

## project_members
- `id`, `project_id`, `user_id`, `role(project_role)`, audit fields
- unique(`project_id`, `user_id`)

## test_suites
- `id`, `project_id`, `name`, `description`, audit fields

## sections
- `id`, `suite_id`, `parent_section_id`, `name`, `display_order`, audit fields

## test_cases
- `id`, `project_id`, `suite_id`, `section_id`, `title`
- `preconditions`, `expected_result`, `priority`, `case_type`, `estimate`
- `refs` text (current implementation), `refs` text[] (target option)
- `labels` text[] default `'{}'`
- `automation_key`, `external_id`
- `custom_values` jsonb not null default `'{}'` (implemented in Prisma as `customValues`)
- `version` integer default `1`
- `lock_version` integer default `1`
- audit fields
- `priority`/`case_type` are text initially and can evolve into custom fields later.
- API updates must send `lock_version` or an equivalent `If-Match` token. Stale updates return conflict instead of overwriting another user's edit.

## test_case_steps
- `id`, `case_id`, `step_order`, `content`, `expected_result`, audit fields
- unique(`case_id`, `step_order`)

## test_case_versions
- `id`, `case_id`, `version`
- snapshot fields: `title`, `preconditions`, `expected_result`, `priority`, `case_type`, `estimate`, `refs`, `labels`, `automation_key`, `external_id`
- `steps_snapshot` jsonb not null default `'[]'`
- `custom_values_snapshot` jsonb not null default `'{}'`
- `change_summary`, `created_by`, `created_at`
- unique(`case_id`, `version`)
- Purpose: immutable authored-case history and reproducible run creation.

## test_runs
- `id`, `project_id`, `suite_id`, `milestone_id`, `plan_id`
- `name`, `description`, `include_all`
- `status` run_status default `open`
- `assigned_to`
- `environment` string (current implementation), `environment` jsonb (target option)
- `metadata` jsonb nullable (CI/build context)
- `started_at`, `closed_at`, audit fields
- `lock_version` integer default `1`

## test_instances
- `id`, `run_id`, `case_id`, `case_version_id`, `status(test_status)`
- snapshots: `title_snapshot`, `priority_snapshot`, `type_snapshot`, `estimate_snapshot`, `automation_key_snapshot`, `external_id_snapshot`
- `latest_result_id` nullable (current implementation, optional optimization pointer)
- audit fields
- unique(`run_id`, `case_id`)
- Initial recommendation: do not depend on `latest_result_id` in MVP.

## test_results
- `id`, `test_instance_id`, `status(test_status)`, `comment`, `elapsed`, `version`, `defects`
- `source` result_source default `manual`
- `custom_values` jsonb not null default `'{}'` (implemented in Prisma as `customValues`)
- `metadata` jsonb nullable (CI uploader context)
- `created_by`, `created_at`
- Append-only. Updates/deletes are not part of normal product behavior.

## test_result_steps
- `id`, `result_id`, `step_order`, `status(test_status)`, `actual_result`, `comment`, `created_at`
- unique(`result_id`, `step_order`)

## test_plans
- `id`, `project_id`, `name`, `description`, `milestone_id`
- `status` run_status default `open`
- audit fields

## test_plan_entries
- `id`, `plan_id`, `name`, `environment` string (current implementation), `suite_id`, `run_id`, audit fields

## configuration_groups
- `id`, `project_id`, `name`, `display_order`, audit fields
- unique(`project_id`, `name`)

## configurations
- `id`, `group_id`, `name`, `display_order`, `is_active`, audit fields
- unique(`group_id`, `name`)

## custom_fields
- `id`, `project_id`, `name`, `system_name`, `field_type`
- `scope` text default `case`; current values are `case` and `result`
- `options` jsonb nullable for select-style choices
- `is_required`, `is_active`, `display_order`, audit fields
- unique(`project_id`, `system_name`)
- Purpose: project-scoped field definitions for case authoring and result entry customization.

## custom_statuses
- `id`, `project_id`, `name`, `system_name`, `canonical_status`
- `color`, `is_system`, `is_active`, `display_order`, audit fields
- unique(`project_id`, `system_name`)
- Purpose: project-scoped result status labels mapped onto the canonical `test_status` enum.

## case_templates
- `id`, `project_id`, `name`, `description`
- `fields` jsonb ordered list of field keys
- `is_default`, `is_active`, `display_order`, audit fields
- unique(`project_id`, `name`)
- Purpose: project-scoped case authoring templates using built-in and custom field keys.

## test_plan_entry_configurations
- `id`, `plan_entry_id`, `configuration_id`
- unique(`plan_entry_id`, `configuration_id`)
- Purpose: normalized configuration matrix for browser/device/OS plan reporting.

## milestones
- `id`, `project_id`, `name`, `description`, `start_date`, `due_date`, `is_completed`, audit fields

## attachments
- `id`, `project_id`, `entity_type`, `entity_id`, `file_name`, `content_type`, `storage_path`, `file_size`, audit fields
- Binary data is stored in object storage, not PostgreSQL.
- `storage_path` must be project-scoped and never expose raw bucket internals directly to clients.
- Downloads/uploads should use signed URLs with short expiration.

## api_tokens
- `id`, `user_id`, `project_id`, `name`, `token_hash`, `last_used_at`, `expires_at`, `revoked_at`, `created_at`
- unique(`token_hash`)

## audit_logs
- `id`, `project_id`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `changes(jsonb)`, `request_id`, `created_at`

## requirements
- `id`, `project_id`, `key`, `title`, `url`, `source`, `status(requirement_status)`, audit fields
- unique(`project_id`, `key`)
- Purpose: requirement/reference traceability anchor.

## case_requirements
- `id`, `case_id`, `requirement_id`, `created_at`
- unique(`case_id`, `requirement_id`)

## defect_integrations
- `id`, `project_id`, `provider`, `base_url`, `url_template`, `settings(jsonb)`, `is_active`, audit fields
- unique(`project_id`, `provider`)
- Purpose: project-level Jira/GitHub/Azure DevOps configuration.

## result_defect_links
- `id`, `result_id`, `provider`, `defect_key`, `defect_url`, `status_snapshot`, `created_by`, `created_at`
- unique(`result_id`, `provider`, `defect_key`)
- Purpose: normalized result-defect link and defect coverage calculation.
- `test_results.defects` may remain as denormalized compatibility text but must not be the source of truth.

## notification_preferences
- `id`, `user_id`, `project_id`, `assignment_enabled`, `failed_result_enabled`, `mention_enabled`, `digest_enabled`, `updated_at`
- Implemented in Prisma as `NotificationPreference`.

## notifications
- `id`, `user_id`, `project_id`, `activity_event_id`, `type`, `title`, `body`, `read_at`, `created_at`
- Index unread notifications by (`user_id`, `project_id`, `read_at`, `created_at desc`).
- Implemented in Prisma as `Notification`.

## activity_events
- `id`, `project_id`, `actor_user_id`, `entity_type`, `entity_id`, `event_type`, `payload(jsonb)`, `created_at`
- Purpose: user-visible timeline feed and notification fan-out source.
- Implemented in Prisma as `ActivityEvent` with `title` and optional `body`.

## import_jobs
- `id`, `project_id`, `type`, `status(job_status)`, `file_attachment_id`, `dry_run`, `summary(jsonb)`, `errors(jsonb)`, audit fields
- Purpose: CSV/XML/JSON import validation and atomic apply tracking.

## export_jobs
- `id`, `project_id`, `type`, `status(job_status)`, `file_attachment_id`, `filters(jsonb)`, `summary(jsonb)`, audit fields
- Purpose: async exports for large case/result/report datasets.

## Partial Unique Index Policy
- Prisma schema alone may not fully express all partial unique indexes for active records.
- Use raw SQL migration for constraints like:
  - unique(`project_id`, `automation_key`) where `automation_key is not null and deleted_at is null`
  - unique(`project_id`, `external_id`) where `external_id is not null and deleted_at is null`

## Required Query Index Policy
- Large TestRail-like screens must be backed by narrow composite indexes:
  - `test_cases(project_id, suite_id, section_id, status, updated_at desc)`
  - `test_runs(project_id, status, milestone_id, updated_at desc)`
  - `test_instances(run_id, status, assigned_to)`
  - `test_results(test_instance_id, created_at desc)`
  - `case_requirements(requirement_id, case_id)`
  - `result_defect_links(provider, defect_key)`
  - `activity_events(project_id, created_at desc)`
- Prefer cursor pagination for result history and activity feeds.
- Avoid loading full step/attachment/comment collections in list endpoints; load them on detail expansion.
- If project-wide result search becomes slow through joins, add a denormalized `project_id` to `test_results` and maintain it transactionally.

## Snapshot and Latest Result Policy
- Snapshot fields in `test_instances` are immutable after creation.
- `case_version_id` is immutable after run creation.
- `test_results` remains append-only.
- Initial implementation caches only `test_instances.status`.
- Latest result is read by `created_at desc`.
- `latest_result_id` exists in current schema but is treated as optional optimization; business logic must not depend on it in MVP.

## Concurrency and Freshness Policy
- Mutating design-time records (`test_cases`, `test_runs`, settings) use optimistic locking through `lock_version` or HTTP `If-Match`.
- High-frequency execution writes (`test_results`) are append-only and can be submitted in batches.
- Realtime subscriptions should invalidate the active run/case/result query only; they should not trigger full project refetches.
- Summary counters may be cached or materialized, but must be repairable from append-only source tables.

## Current Implementation Gap Notes
- This document includes both **target model** and **current implementation** where they differ.
- Canonical behavior priority:
  1. append-only result history
  2. snapshot immutability
  3. status cache correctness on `test_instances`
  4. optimistic locking for authored assets
  5. paginated, indexed project-wide browsing
- Type normalization (`refs`, `environment`) is tracked as incremental migration, not blocking MVP workflows.
- Versioning, traceability, defect links, import/export jobs, activity/notifications, and configuration matrix tables are required for a full TestRail-like product.
