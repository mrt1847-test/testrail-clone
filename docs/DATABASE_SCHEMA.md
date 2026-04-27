# Database Schema Design (Supabase PostgreSQL)

## Global Conventions
- Primary keys: `bigint` identity.
- Audit metadata on mutable tables:
  - `created_at`, `updated_at`, `deleted_at`
  - `created_by`, `updated_by`
- JSON-heavy fields use `jsonb`.

## Enum Model
- `project_role`: `owner`, `manager`, `tester`, `viewer`
- `run_status`: `open`, `closed`
- `result_source`: `manual`, `automation`, `api`
- `test_status`: `untested`, `passed`, `failed`, `blocked`, `retest`

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
- `automation_key`, `external_id`, audit fields
- `priority`/`case_type` are text initially and can evolve into custom fields later

## test_case_steps
- `id`, `case_id`, `step_order`, `content`, `expected_result`, audit fields
- unique(`case_id`, `step_order`)

## test_runs
- `id`, `project_id`, `suite_id`, `milestone_id`, `plan_id`
- `name`, `description`, `include_all`
- `status` run_status default `open`
- `assigned_to`
- `environment` string (current implementation), `environment` jsonb (target option)
- `metadata` jsonb nullable (CI/build context)
- `started_at`, `closed_at`, audit fields

## test_instances
- `id`, `run_id`, `case_id`, `status(test_status)`
- snapshots: `title_snapshot`, `priority_snapshot`, `type_snapshot`, `estimate_snapshot`, `automation_key_snapshot`, `external_id_snapshot`
- `latest_result_id` nullable (current implementation, optional optimization pointer)
- audit fields
- unique(`run_id`, `case_id`)
- Initial recommendation: do not depend on `latest_result_id` in MVP

## test_results
- `id`, `test_instance_id`, `status(test_status)`, `comment`, `elapsed`, `version`, `defects`
- `source` result_source default `manual`
- `metadata` jsonb nullable (CI uploader context)
- `created_by`, `created_at`

## test_result_steps
- `id`, `result_id`, `step_order`, `status(test_status)`, `actual_result`, `comment`, `created_at`
- unique(`result_id`, `step_order`)

## test_plans
- `id`, `project_id`, `name`, `description`, `milestone_id`
- `status` run_status default `open`
- audit fields

## test_plan_entries
- `id`, `plan_id`, `name`, `environment` string (current implementation), `suite_id`, `run_id`, audit fields

## milestones
- `id`, `project_id`, `name`, `description`, `start_date`, `due_date`, `is_completed`, audit fields

## attachments
- `id`, `project_id`, `entity_type`, `entity_id`, `file_name`, `content_type`, `storage_path`, `file_size`, audit fields

## api_tokens
- `id`, `user_id`, `project_id`, `name`, `token_hash`, `last_used_at`, `expires_at`, `revoked_at`, `created_at`
- unique(`token_hash`)

## audit_logs
- `id`, `project_id`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `changes(jsonb)`, `request_id`, `created_at`

## requirements
- `id`, `project_id`, `key`, `title`, `url`, `created_at`, `updated_at`
- 목적: case/reference traceability anchor

## case_requirements
- `id`, `case_id`, `requirement_id`, `created_at`
- unique(`case_id`, `requirement_id`)

## result_defects
- `id`, `result_id`, `provider`, `defect_key`, `defect_url`, `status_snapshot`, `created_at`
- 목적: result-defect 링크 및 defect coverage 계산

## notification_preferences
- `id`, `user_id`, `project_id`, `assignment_enabled`, `failed_result_enabled`, `mention_enabled`, `digest_enabled`, `updated_at`

## activity_events
- `id`, `project_id`, `actor_user_id`, `entity_type`, `entity_id`, `event_type`, `payload(jsonb)`, `created_at`
- 목적: 사용자 친화 timeline feed

## Partial Unique Index Policy
- Prisma schema alone may not fully express all partial unique indexes for active records.
- Use raw SQL migration for constraints like:
  - unique(`project_id`, `automation_key`) where `automation_key is not null and deleted_at is null`
  - unique(`project_id`, `external_id`) where `external_id is not null and deleted_at is null`

## Snapshot and Latest Result Policy
- Snapshot fields in `test_instances` are immutable after creation.
- `test_results` remains append-only.
- Initial implementation caches only `test_instances.status`.
- Latest result is read by `created_at desc`.
- `latest_result_id` exists in current schema but is treated as optional optimization; business logic must not depend on it in MVP.

## Current Implementation Gap Notes
- This document includes both **target model** and **current implementation** where they differ.
- Canonical behavior priority:
  1) append-only result history
  2) snapshot immutability
  3) status cache correctness on `test_instances`
- Type normalization (`refs`, `environment`) is tracked as incremental migration, not blocking MVP workflows.
