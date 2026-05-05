# Feature Checklist

Last aligned: 2026-05-05

This is the working checklist for implemented and planned product capabilities. It is intentionally stricter than the roadmap: if a workflow is only partially usable, it stays open until the missing user-facing pieces are complete.

Legend:
- `[x]` implemented baseline is available from API and/or UI.
- `[ ]` not complete or only partially implemented.
- `P0` blocks the core daily TestRail-like workflow.
- `P1` is high-value parity or team workflow depth.
- `P2` is advanced parity, scale, or administrative depth.

## 점검 목적과 판정 기준

이 문서는 "TestRail-like 테스트 관리 도구"로서의 실제 사용 가능성을 기준으로 관리한다.  
요청된 점검 관점은 아래 4가지를 기본으로 한다.

1. 기능 구현 현황을 체크리스트로 정리한다.
2. 현재 코드베이스 기준으로 이미 구현된 기능이 `[x]`에 정확히 반영됐는지 확인한다.
3. TestRail 유사 도구로 운영하기 위해 필요한 필수 기능이 누락 없이 정리됐는지 확인한다.
4. 미구현 기능의 우선순위가 일일 사용 흐름(케이스 작성 -> 런 구성 -> 실행/결과 -> 리스크 리뷰 -> 알림) 기준으로 타당한지 확인한다.

판정 규칙:
- `[x]`는 "사용 가능한 API 또는 UI 기준선"이 있을 때만 체크한다. (내부 모델/스키마만 존재하면 미완료로 유지)
- "부분 구현"은 `[ ]`로 유지하고, 누락된 사용자 동작(예: drilldown, background worker, safeguards)을 명시한다.
- 우선순위는 기술 난이도보다 "일일 운영 차단 여부"를 우선한다.

## 현재 구현 점검 요약 (2026-05-04)

검토 결과:
- 2026-05-04 배치: 런 생성 섹션 스코프, 오픈 런 케이스 추가·제거(결과 보존 플래그), 런 재개, 결과 이력 페이징, 리포트 서브라우트, DB 모드 웹훅 전송 워커·test-send, `/api/v2/get_projects`가 반영되었다.
- 남은 우선 과제: 대규모 실행 화면 분해, 활동/알림 이벤트·이메일 전달, `/api/v2` 비핵심 카테고리 확장 등은 아래 미체크 항목과 Top 10을 따른다.
- 문서 운영 규칙은 [DOC_MAINTENANCE.md](./DOC_MAINTENANCE.md), 파일 기반 감사 스냅샷은 [FILE_BASED_AUDIT_2026-05-04.md](./FILE_BASED_AUDIT_2026-05-04.md)를 참고한다.

## 미구현 우선순위 재정렬 (실행 기준 Top 10)

아래 순서는 "테스트 팀이 매일 쓰는 흐름" 기준의 권장 구현 순서다.

1. P0 Run composition 완성: ~~섹션 API·생성 후 add/remove·결과 보호·섹션 트리 그룹 선택 UX~~ (2026-05-05 기준선 완료) → 남음: 벌크 피드백·대규모 실행 UX 정리.
2. P0 Run execution 안정화: ~~결과 이력 페이징·일부 캐시 무효화~~ (2026-05-04) → 남음: 대규모 실행용 헤더/요약/필터/테이블 분리.
3. P0 Case repository 생산성: bulk move/update/archive, 저장된 필터/뷰, 실무 필터 강화.
4. P0 Report drilldown 페이지: ~~서브라우트·테이블형 상세~~ (2026-05-04) → 남음: 통일 필터 바·차트/요약 스트립 고도화.
5. P0 Activity/Notification 전달력: 핵심 이벤트 커버리지 + 대상자 라우팅 + drilldown 링크.
6. P0 Webhook delivery worker: ~~백그라운드 전송·backoff·응답 기록·test-send~~ (2026-05-04, DB 모드).
7. P1 Result custom field 확장: boolean 이후 타입/검증/필터 고도화.
8. P1 첨부/증거 운영 강화: 객체 스토리지 수명주기, 업로드 진행률/재시도, 미리보기.
9. P1 리포트 운영성: 저장/스케줄/히스토리, 마일스톤/플랜 리포트.
10. P1/P2 `/api/v2` 호환 확장: 마이그레이션/자동화 영향이 큰 카테고리부터 단계적 확대.

## TestRail-Like Delivery Order

Use this order when choosing the next implementation batch:

1. P0 run composition: create and maintain runs from suites, sections, selected cases, and exclusions.
2. P0 execution workspace: make daily test execution fast, stable, and safe for large runs.
3. P0 case repository productivity: bulk move/update/archive, saved views, and rich filters.
4. P0 report drilldowns: turn existing report APIs into usable risk-review pages.
5. P0 activity/notifications: notify people from case, run, result, assignment, defect, and report workflow events.
6. P1/P2 administration, compatibility, migration, integrations, and UI system depth.

## Product Foundation

- [x] Projects CRUD baseline.
- [x] Suites CRUD baseline.
- [x] Sections CRUD baseline.
- [x] Auth/current-user/login/logout baseline.
- [x] Project membership role guards for mutations.
- [x] Project member management baseline with add, role update, remove, and last-owner protection.
- [ ] P1 Project archive/read-only mode.
- [ ] P1 Global default access model.
- [ ] P1 Full users, groups, global roles, custom roles, and permission matrix.
- [ ] P2 Settings/admin sidebar organization as project tabs grow.

## Test Case Management

- [x] Case CRUD baseline.
- [x] Case-step CRUD baseline.
- [x] Case custom field value persistence and case detail form rendering baseline.
- [x] Case version persistence baseline.
- [x] Case version timeline and basic compare/restore UI baseline.
- [x] Optimistic locking baseline via `lockVersion`, `expectedVersion`, and `If-Match`.
- [x] Bulk case delete baseline with multi-select list UX and per-case API feedback.
- [x] Bulk case move baseline with section reassignment, multi-select list UX, and per-case API feedback.
- [x] Bulk case field update baseline with shared priority/type changes and per-case API feedback.
- [x] Saved case filters/views baseline with reusable per-user/project section + query/priority/type/automation/archive-state views.
- [x] Case custom value CSV import/export columns and active-field import validation baseline.
- [x] P0 Bulk case archive semantics with active-vs-archived repository views, archived run-composition exclusion, and bulk restore feedback.
- [x] P1 Rich case filter baseline with saved `q`/priority/type/automation/archive-state/refs/labels/estimate views and faster collapsed-row metadata chips.
- [x] P1 Case custom value list chip baseline for visible custom values in collapsed rows.
- [x] P1 Deeper case list filters and optional list column visibility baseline.
- [x] P1 Required-field UI validation and template-aware case authoring form ordering.
- [ ] P1 Rich visual diffs for case version comparison.
- [ ] P1 Restore conflict messaging in UI.
- [ ] P1 Attachment context in case version snapshots.
- [ ] P1 Dedicated case version detail drawer.
- [ ] P2 Case/case-step image attachments.
- [ ] P2 Shared steps.
- [ ] P2 Labels as first-class entities.
- [ ] P2 Deleted case restore and permanent delete semantics.
- [ ] P2 BDD/scenario support.

## Run Composition And Execution

- [x] Run creation with include-all suite cases baseline.
- [x] Run creation with flat selected `caseIds` baseline.
- [x] Test instance snapshots during run creation.
- [x] Manual result entry baseline.
- [x] Result history baseline.
- [x] Run summary baseline.
- [x] Close-run workflow baseline.
- [x] Closed-run write protection baseline for result writes.
- [x] Run instance server-side pagination/filter baseline.
- [x] Run detail selected test, status filter, assignee filter, search, and page state in URL query params.
- [x] Rerun by selected statuses baseline.
- [x] Bulk manual result entry API baseline.
- [x] Section-level include/exclude during run creation (suite subtree roots via `includedSectionIds` / `excludedSectionIds`; run create + Run create UI).
- [x] Include-all-with-case-exclusions baseline for large suites.
- [x] P0 Add cases to an existing open run.
- [x] P0 Remove cases from an existing open run.
- [x] P0 Existing-result safeguards when removing cases from a run (`confirmDataLoss` + CASCADE delete of results on confirm).
- [x] P0 Closed-run restrictions for composition changes (API returns `RUN_CLOSED` for mutations).
- [x] P0 Grouped run creation selection UX by section with selected/excluded counts.
- [ ] P1 Run header/summary/filter/table component split.
- [x] P1 Result history pagination per selected test.
- [x] P1 Scoped cache invalidation after run/result mutations (results query prefix + bulk result predicate invalidation).
- [x] P1 Reopen policy (reopen endpoint + UI; closed run cannot accept new composition/results).
- [ ] P1 Time tracking beyond elapsed entry.
- [ ] P1 Comments/mentions on execution workflow.

## Results And Custom Fields

- [x] Result custom field scope separation from case fields.
- [x] Result custom value persistence for manual/API/bulk result entry.
- [x] Result custom values render in result entry, history, and result explorer.
- [x] Result entry elapsed parser/normalizer.
- [x] Result entry timer controls.
- [x] Defect key chips in result entry.
- [x] Case-step-aware multi-step result editing.
- [x] Field-level client validation messaging.
- [x] Result entry component split into focused subcomponents.
- [x] Result custom values exported as `custom_{systemName}` in run result CSV and result explorer CSV.
- [x] Result explorer active custom field exact-match filters.
- [x] Boolean custom field type baseline for definitions, validation, forms, import parsing, exports, and filtering.
- [ ] P1 Richer custom field types beyond text/number/select/boolean.
- [ ] P1 Advanced result custom field filtering semantics.
- [ ] P1 Full custom result field parity.
- [ ] P2 Result editing or correction policy, if product decides to support it.

## Assignments And To-Do

- [x] Run assignment baseline.
- [x] Test assignment baseline.
- [x] My Tests page baseline.
- [x] Notification inbox baseline can surface assignment-related workflow.
- [ ] P1 `assigned-to-me` filters by project, run, status, due date, and milestone.
- [ ] P1 True to-do view with status counts, aging, and execution shortcuts.
- [ ] P1 Notification-driven assignment workflow polish.

## Requirements And Traceability

- [x] Requirement CRUD baseline.
- [x] Case-requirement link API baseline.
- [x] Traceability report baseline.
- [x] Coverage-gap report baseline.
- [x] Defect coverage report baseline.
- [ ] P1 Requirement import/sync.
- [ ] P1 External requirement provider integration.
- [ ] P1 Advanced traceability matrix UI.
- [ ] P1 Coverage reports filtered by milestone, run, and plan.
- [ ] P1 Source links from reports back to requirements, cases, runs, tests, results, defects, and evidence.

## Reports

- [x] Overview widgets baseline.
- [x] Run summary report API/export baseline.
- [x] Result explorer report API/export baseline.
- [x] Result explorer page baseline with filters and source run links.
- [x] Traceability, coverage gap, and defect coverage CSV export baseline.
- [x] Report export job/download baseline.
- [x] P0 Report detail pages for run summary, results, traceability, coverage gap, and defect coverage (nested routes under `/projects/:id/reports/*`).
- [ ] P1 Standard report filter bars, summary strips, chart/table bodies, and drilldown links.
- [ ] P1 Saved report definitions.
- [ ] P1 Scheduled/email reports.
- [ ] P1 Report history/download UI.
- [ ] P1 Milestone summary reports.
- [ ] P1 Plan summary reports.
- [ ] P1 Cross-project reports.

## Milestones, Plans, And Configurations

- [x] Milestone CRUD baseline.
- [x] Plan CRUD baseline.
- [x] Configuration group/value CRUD baseline.
- [x] Plan matrix preview baseline.
- [x] Run-by-configuration baseline.
- [x] Plan rollup by configuration baseline.
- [x] Plan detail matrix/rollup web binding baseline.
- [x] Plan detail entry-configuration mapping read baseline.
- [ ] P1 Sub-milestones.
- [ ] P1 Milestone forecasts and richer dashboards.
- [ ] P1 Full plan-entry semantics.
- [ ] P1 Assigned users per plan entry.
- [ ] P1 Include/exclude cases in plan entries.
- [ ] P1 Combination editing and configuration management depth.
- [ ] P1 Plan report parity.
- [ ] P2 `/api/v2` compatibility for plans/configurations depth.

## Evidence, Attachments, And Defects

- [x] Result attachment metadata baseline.
- [x] Attachment signed upload/download URL baseline.
- [x] Run detail attachment presign upload web binding.
- [x] Run detail attachment open/delete web binding.
- [x] Defect link baseline.
- [x] Defect integration settings baseline.
- [x] URL-template defect push baseline.
- [x] Run detail defect push provider/feedback UX baseline.
- [x] Run detail defect unlink baseline.
- [ ] P1 Production object storage lifecycle and authorization hardening.
- [ ] P1 Attachment preview drawer.
- [ ] P1 Upload progress and retry.
- [ ] P1 Retention and cleanup policy.
- [ ] P1 Provider validation/test connection.
- [ ] P1 Provider-native Jira/GitHub/Azure issue create/sync.
- [ ] P1 Provider response metadata and remote status snapshots.
- [ ] P1 Defect integration field mapping and template preview.
- [ ] P2 Attachment import/export.

## Automation And API Tokens

- [x] API token baseline.
- [x] Automation upload baseline.
- [x] Automation upload history/detail and failed-item retry baseline.
- [x] Automation mapping summary/list API baseline.
- [x] Bulk automation result API baseline.
- [x] TestRail-compatible `/api/v2` baseline for core cases, runs, tests, add result for case, bulk results for cases, and `GET /api/v2/get_projects`.
- [ ] P1 Token scopes and expiration enforcement.
- [ ] P1 Clearer token creation UX.
- [ ] P1 Automation mapping UI and mapping health beyond the API/list baseline.
- [ ] P1 Upload retry queue semantics beyond manual failed-item retry.
- [ ] P1 Row-level automation failure guidance.
- [ ] P2 CI examples and compatibility examples.
- [ ] P2 Expanded `/api/v2` categories: projects, suites, sections, milestones, plans, configurations, fields, statuses, templates, users, roles, reports, attachments, labels, groups, shared steps, datasets, variables, and BDDs.

## Import And Export

- [x] Case CSV import dry-run/commit API baseline.
- [x] Case CSV import job history baseline.
- [x] Case CSV export baseline.
- [x] Case custom values included in case CSV import/export baseline.
- [x] Run result CSV export baseline.
- [x] Import/export project tab web binding baseline.
- [x] Report CSV export job baseline.
- [x] Active result custom values included in result exports.
- [ ] P1 Mapping-driven case import/export UX and richer validation guidance.
- [ ] P1 XML/JSON import/export.
- [ ] P1 Mapping wizard.
- [ ] P1 Large async file lifecycle.
- [ ] P2 TestRail-compatible export shapes beyond current CSV baselines.

## Activity, Notifications, Audit, And Webhooks

- [x] ActivityEvent persistence baseline.
- [x] Activity writer helper baseline.
- [x] Project activity API/UI baseline.
- [x] Notification and notification preference persistence baseline.
- [x] Notification inbox API/UI baseline with unread count and preference toggles.
- [x] Audit log query UI with server-side filters and pagination baseline.
- [x] Webhook subscription persistence with event filters and secrets.
- [x] Activity events enqueue signed webhook delivery attempts.
- [x] Webhook settings UI for create/toggle/delete/inspect/retry state baseline.
- [x] Activity/notification drilldown baseline links from Activity/Notifications UI to run/case/report sources (payload-driven where available).
- [x] Assignment and failed-result notification routing baseline targets explicit assignee when payload includes assignee context.
- [x] Case CSV import/export and report export workflows emit activity events for validate/request/complete/download milestones.
- [x] Project create/update/delete mutations emit project-level activity events.
- [x] Settings mutations (`custom_fields`, `custom_statuses`, `case_templates`, `project_members`) emit activity events for create/update/delete lifecycle.
- [ ] P0 Broader activity event coverage across all major mutations.
- [ ] P0 Notification targeting and activity drilldown links.
- [ ] P0 Email/digest notification delivery jobs.
- [x] P0 Webhook background HTTP delivery worker (DB-backed server; in-memory 모드에서는 미기동).
- [x] P0 Webhook exponential backoff and response capture.
- [x] P0 Manual webhook test-send.
- [ ] P1 Richer webhook and audit filters.
- [ ] P1 Disable-on-failure policy.
- [ ] P1 Full audit event coverage, export, retention, and admin audit.

## UI System And Frontend Architecture

- [x] Operational project shell and tab navigation baseline.
- [x] Shared loading/error/empty states baseline.
- [x] Initial query invalidation and polling policy.
- [ ] P1 Shared `Button`, `IconButton`, `StatusBadge`, `DataTable`, `FilterBar`, `PageHeader`, `Panel`, `Drawer`, and `Toast`.
- [ ] P1 Dense, scannable table-oriented screens for large lists.
- [ ] P1 Centralized query keys per feature.
- [ ] P1 Notification/inbox entry in shell/header.
- [ ] P2 Settings sidebar for lower-frequency admin categories.

## Deferred Or Explicitly Not Baseline

- [ ] P2 Full users/groups/global roles administration.
- [ ] P2 Provider-native defect creation beyond URL-template push baseline.
- [ ] P2 Shared steps, labels, BDD/scenario support, and advanced TestRail migration categories.
- [ ] P2 Large async import/export lifecycle beyond current baseline.
