# API Specification

Updated: 2026-09-23. 현재 worktree의 route/schema/service를 대조한 계약과 등록 목록이다. 운영 배포나 모든 endpoint의 live 성공을 인증하지 않는다. 필요한 feature 절만 읽고 전체 목록을 기본 입력으로 로드하지 않는다.

## 공통 계약과 예외

- `/api`가 기본, `/api/v2`는 TestRail adapter다. 실제 path/method는 아래 등록 목록을 따른다. 모든 route를 project-scoped 형태로 임의 재작성하지 않는다.
- JSON ID는 `toJsonSafe` 사용 시 BigInt가 십진 문자열로 직렬화된다. Date는 JSON ISO 표현이다. 클라이언트에서 큰 ID를 안전한 Number라고 가정하지 않는다.
- `ok(data)`는 `{data}`, 공통 paged 응답은 `{data,page,pageSize,total,totalPages}`다. 모든 route가 이 envelope를 쓰지는 않는다(auth와 v2 등). 응답 shape는 해당 handler를 확인한다.
- 공통 pagination은 page=1, pageSize=20, 최대100이며 page_size alias를 허용한다. v2 pagination은 별도 adapter 규칙이다. alias는 실제 schema에 있는 것만 허용되며 모든 camelCase에 snake_case alias가 있다고 가정하지 않는다.
- 공통 AppError는 `{error:{code,message,details?}}`, Zod는 400 VALIDATION_ERROR와 path/message 목록, 미처리 오류는 500 INTERNAL_ERROR다. auth/me의 직접 401 `{code,message}` 등 예외가 있으므로 전역 단일 shape로 단정하지 않는다.

## 인증과 권한

`POST /api/auth/login`은 email과 선택적 password를 받지만 현재 서비스는 email만 사용해 사용자 조회/생성 후 `{token,user}`를 반환한다. 토큰은 표준 JWT가 아닌 HMAC 서명 `v1.<payload>.<signature>`이며 유효기간은 7일이다. `Authorization: Bearer …`로 보낸다. `/api/auth/me`는 user/memberships, logout은 204이며 서버 측 revoke는 하지 않는다. 이는 현재 구현의 설명이지 강한 운영 인증이 갖춰졌다는 의미가 아니다.

프로젝트 권한은 route의 helper를 확인한다. 메모리 모드는 동일 관리자 사용자와 일부 권한 생략 경로가 있어 실제 viewer 권한 검증을 대신하지 못한다. automation token은 별도 project/scopes/hash/만료·revocation 계약이며 로그인 토큰과 혼용하지 않는다. [CI 예제](./CI_AND_COMPATIBILITY_EXAMPLES.md)의 실제 header/endpoint를 함께 확인한다.

## 케이스 작성·동시 수정

요청 원장: [cases.schema.ts](../apps/server/src/modules/cases/cases.schema.ts), handler: [cases.routes.ts](../apps/server/src/modules/cases/cases.routes.ts).

- 생성은 sectionId와 비어 있지 않은 title이 필수다. priority/caseType/estimate/preconditions/expectedResult, template, refs/labels/customValues와 exploratory/AI 필드는 해당 schema의 optional/nullable을 따른다.
- 본문 생성/수정과 step 추가/수정/삭제는 별도 endpoint다. 하나의 저장 버튼이 본문+Steps 전체를 서버에서 원자 처리한다고 가정하지 않는다. 부분 성공은 생성 ID와 실패 초안을 유지해 복구한다.
- PATCH의 expectedVersion은 선택적이며 If-Match 파싱값을 fallback으로 사용한다. 실제 DB 비교는 lockVersion이다. expectedUpdatedAt은 schema에서 받지만 service가 legacy 값으로 제외하므로 실제 revision 검증 대안이 아니다.
- 충돌 응답은 409 `CONFLICT`다. 기존 문서의 필수 revision/`VERSION_CONFLICT` 계약은 실제 구현과 달라 수정했다. 클라이언트는 stale overwrite 방지를 위해 expectedVersion을 전송해야 한다.
- sectionScope는 direct/subtree이며 화면의 all은 section 제한 없는 조회로 표현한다. display(tree/subtree/compact)와 조회 scope는 구별한다. 일반 목록과 suite 그룹 목록의 query 필드는 각각 schema를 따른다.
- bulk caseIds 작업은 해당 schema에서 1~200개를 받는다. Case version 복원/첨부/BDD scenario/shared step은 아래 별도 route를 사용한다.

## Run 구성·결과 기록

요청 원장: [runs.schema.ts](../apps/server/src/modules/runs/runs.schema.ts), [results.schema.ts](../apps/server/src/modules/results/results.schema.ts).

- Run 생성은 projectId(경로형에서는 path), suiteId, name과 includeAll(default true), caseIds/excludedCaseIds, 포함/제외 section root, compositionMode/filterDefinition, 일정/환경을 받는다. 실제 mode/필터 규칙은 runComposition.ts와 서비스가 검증한다.
- `POST /api/tests/:testId/results`는 test 대상, `/api/runs/:runId/results`는 testId 또는 caseId, `/by-case`는 caseId를 받는다. case_id/test_id alias는 해당 result 정규화 경로에서만 지원한다.
- 결과는 status와 선택적 comment/elapsed/version/defects(string 배열)/customValues/stepResults/scenarioResults/AI 필드다. 상태 enum은 untested/passed/failed/blocked/retest지만 이미 결과가 있는 test의 untested 기록은 service에서 400 UNTESTED_NOT_ALLOWED로 거절한다.
- 닫힌 Run은 409 RUN_CLOSED. 기존 result의 PATCH/PUT/DELETE는 등록되어 있어도 405 RESULT_IMMUTABLE로 거절하는 경로다. 정정은 새 결과 추가이며 첨부/defect link는 별도 후속 동작이다.
- bulk는 `{atomic?,results:[{caseId,status,...}]}`; atomic 기본 false. 응답은 runId/atomic/total/saved/failed/items를 포함한다. atomic=true는 transaction 및 검증 실패 시 전체 거절, false는 항목별 성공/실패다.
- 결과 쓰기와 첨부 bytes 업로드는 별도 과정이다. presign/metadata 등록만으로 실제 bytes 저장을 성공 처리하지 않는다. 실패 파일 재시도는 기존 resultId를 재사용한다.

## 모델과 서비스의 제한

메모리/Prisma 분기, 501 미지원 경로, 권한 및 외부 공급자 설정은 개별 handler가 결정한다. 등록 목록이 기능의 완전 지원을 뜻하지 않는다. 첨부·보고·email·webhook 전달은 외부 환경이 필요하다. 결과 입력 후 다음 테스트로 이동하는 것은 UI 의도이며 API의 자동 이동 계약이 아니다.

## 등록 endpoint 목록

다음은 app.ts 및 *.routes.ts의 literal `app.get/post/put/patch/delete/options/head` 선언을 코드에서 추출한 목록이다. 동적 등록·플러그인 자동 OPTIONS 등을 포괄하는 runtime/OpenAPI 목록은 아니다. 각 그룹의 source 링크에서 검증 schema·권한·응답·지원 모드를 확인한다. 기존 route를 지우거나 바꿀 때 이 목록과 해당 계약을 같은 작업에서 갱신한다.

### activity

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/api/projects/:projectId/activity` | [source](../apps/server/src/modules/activity/activity.routes.ts#L60) |
| GET | `/api/projects/:projectId/notifications` | [source](../apps/server/src/modules/activity/activity.routes.ts#L123) |
| PATCH | `/api/projects/:projectId/notifications/:notificationId/read` | [source](../apps/server/src/modules/activity/activity.routes.ts#L195) |
| PATCH | `/api/projects/:projectId/notifications/:notificationId/snooze` | [source](../apps/server/src/modules/activity/activity.routes.ts#L207) |
| POST | `/api/projects/:projectId/notifications/read-all` | [source](../apps/server/src/modules/activity/activity.routes.ts#L224) |
| GET | `/api/projects/:projectId/notification-preferences` | [source](../apps/server/src/modules/activity/activity.routes.ts#L235) |
| PATCH | `/api/projects/:projectId/notification-preferences` | [source](../apps/server/src/modules/activity/activity.routes.ts#L245) |

### admin

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/api/admin/access-defaults` | [source](../apps/server/src/modules/admin/accessDefaults.routes.ts#L16) |
| PATCH | `/api/admin/access-defaults` | [source](../apps/server/src/modules/admin/accessDefaults.routes.ts#L22) |
| GET | `/api/admin/permission-matrix` | [source](../apps/server/src/modules/admin/users.routes.ts#L65) |
| GET | `/api/admin/users` | [source](../apps/server/src/modules/admin/users.routes.ts#L70) |
| PATCH | `/api/admin/users/:userId` | [source](../apps/server/src/modules/admin/users.routes.ts#L111) |
| GET | `/api/admin/groups` | [source](../apps/server/src/modules/admin/users.routes.ts#L138) |
| POST | `/api/admin/groups` | [source](../apps/server/src/modules/admin/users.routes.ts#L170) |
| PATCH | `/api/admin/groups/:groupId` | [source](../apps/server/src/modules/admin/users.routes.ts#L193) |
| POST | `/api/admin/groups/:groupId/members` | [source](../apps/server/src/modules/admin/users.routes.ts#L214) |
| DELETE | `/api/admin/groups/:groupId/members/:userId` | [source](../apps/server/src/modules/admin/users.routes.ts#L232) |

### auth

| Method | Path | Handler |
| --- | --- | --- |
| POST | `/api/auth/login` | [source](../apps/server/src/modules/auth/auth.routes.ts#L20) |
| GET | `/api/auth/me` | [source](../apps/server/src/modules/auth/auth.routes.ts#L26) |
| POST | `/api/auth/logout` | [source](../apps/server/src/modules/auth/auth.routes.ts#L34) |

### automation

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/api/projects/:projectId/automation/summary` | [source](../apps/server/src/modules/automation/automation.routes.ts#L334) |
| GET | `/api/projects/:projectId/automation/mappings` | [source](../apps/server/src/modules/automation/automation.routes.ts#L346) |
| PATCH | `/api/projects/:projectId/automation/mappings/:caseId` | [source](../apps/server/src/modules/automation/automation.routes.ts#L398) |
| GET | `/api/projects/:projectId/automation/retry-queue` | [source](../apps/server/src/modules/automation/automation.routes.ts#L472) |
| GET | `/api/projects/:projectId/automation/uploads` | [source](../apps/server/src/modules/automation/automation.routes.ts#L519) |
| GET | `/api/projects/:projectId/automation/uploads/:uploadId` | [source](../apps/server/src/modules/automation/automation.routes.ts#L555) |
| POST | `/api/projects/:projectId/automation/uploads/:uploadId/retry-failed` | [source](../apps/server/src/modules/automation/automation.routes.ts#L619) |
| POST | `/api/automation/runs` | [source](../apps/server/src/modules/automation/automation.routes.ts#L627) |
| POST | `/api/automation/runs/:runId/results` | [source](../apps/server/src/modules/automation/automation.routes.ts#L643) |
| POST | `/api/automation/results/bulk` | [source](../apps/server/src/modules/automation/automation.routes.ts#L662) |
| POST | `/api/automation/uploads/:uploadId/retry` | [source](../apps/server/src/modules/automation/automation.routes.ts#L696) |

### bdd

| Method | Path | Handler |
| --- | --- | --- |
| POST | `/api/projects/:projectId/bdd/features/import` | [source](../apps/server/src/modules/bdd/bdd.routes.ts#L59) |
| GET | `/api/projects/:projectId/bdd/features/export` | [source](../apps/server/src/modules/bdd/bdd.routes.ts#L131) |
| GET | `/api/projects/:projectId/bdd/summary` | [source](../apps/server/src/modules/bdd/bdd.routes.ts#L163) |

### cases

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/api/projects/:projectId/cases` | [source](../apps/server/src/modules/cases/cases.routes.ts#L342) |
| GET | `/api/sections/:sectionId/cases` | [source](../apps/server/src/modules/cases/cases.routes.ts#L371) |
| POST | `/api/sections/:sectionId/cases` | [source](../apps/server/src/modules/cases/cases.routes.ts#L399) |
| GET | `/api/cases/:caseId` | [source](../apps/server/src/modules/cases/cases.routes.ts#L467) |
| POST | `/api/cases/:caseId/duplicate` | [source](../apps/server/src/modules/cases/cases.routes.ts#L476) |
| GET | `/api/cases/:caseId/attachments` | [source](../apps/server/src/modules/cases/cases.routes.ts#L528) |
| POST | `/api/cases/:caseId/attachments` | [source](../apps/server/src/modules/cases/cases.routes.ts#L534) |
| POST | `/api/cases/:caseId/attachments/presign` | [source](../apps/server/src/modules/cases/cases.routes.ts#L551) |
| POST | `/api/projects/:projectId/cases/bulk-delete` | [source](../apps/server/src/modules/cases/cases.routes.ts#L571) |
| POST | `/api/projects/:projectId/cases/bulk-move` | [source](../apps/server/src/modules/cases/cases.routes.ts#L601) |
| POST | `/api/projects/:projectId/cases/bulk-copy` | [source](../apps/server/src/modules/cases/cases.routes.ts#L642) |
| POST | `/api/projects/:projectId/cases/bulk-update` | [source](../apps/server/src/modules/cases/cases.routes.ts#L686) |
| POST | `/api/projects/:projectId/cases/bulk-archive` | [source](../apps/server/src/modules/cases/cases.routes.ts#L719) |
| POST | `/api/projects/:projectId/cases/reorder` | [source](../apps/server/src/modules/cases/cases.routes.ts#L754) |
| POST | `/api/projects/:projectId/cases/position` | [source](../apps/server/src/modules/cases/cases.routes.ts#L776) |
| GET | `/api/cases/:caseId/versions` | [source](../apps/server/src/modules/cases/cases.routes.ts#L801) |
| GET | `/api/cases/:caseId/versions/:versionId` | [source](../apps/server/src/modules/cases/cases.routes.ts#L808) |
| GET | `/api/cases/:caseId/versions/:versionNo/attachments/:attachmentId/download` | [source](../apps/server/src/modules/cases/cases.routes.ts#L814) |
| POST | `/api/cases/:caseId/versions/:versionId/restore` | [source](../apps/server/src/modules/cases/cases.routes.ts#L821) |
| PATCH | `/api/cases/:caseId` | [source](../apps/server/src/modules/cases/cases.routes.ts#L843) |
| DELETE | `/api/cases/:caseId` | [source](../apps/server/src/modules/cases/cases.routes.ts#L916) |
| POST | `/api/cases/:caseId/steps` | [source](../apps/server/src/modules/cases/cases.routes.ts#L938) |
| GET | `/api/case-steps/:stepId/attachments` | [source](../apps/server/src/modules/cases/cases.routes.ts#L964) |
| POST | `/api/case-steps/:stepId/attachments` | [source](../apps/server/src/modules/cases/cases.routes.ts#L970) |
| POST | `/api/case-steps/:stepId/attachments/presign` | [source](../apps/server/src/modules/cases/cases.routes.ts#L987) |
| PATCH | `/api/case-steps/:stepId` | [source](../apps/server/src/modules/cases/cases.routes.ts#L1007) |
| DELETE | `/api/case-steps/:stepId` | [source](../apps/server/src/modules/cases/cases.routes.ts#L1036) |
| GET | `/api/cases/:caseId/scenarios` | [source](../apps/server/src/modules/cases/cases.routes.ts#L1064) |
| POST | `/api/cases/:caseId/scenarios` | [source](../apps/server/src/modules/cases/cases.routes.ts#L1070) |
| PUT | `/api/cases/:caseId/scenarios` | [source](../apps/server/src/modules/cases/cases.routes.ts#L1078) |
| PATCH | `/api/case-scenarios/:scenarioId` | [source](../apps/server/src/modules/cases/cases.routes.ts#L1086) |
| DELETE | `/api/case-scenarios/:scenarioId` | [source](../apps/server/src/modules/cases/cases.routes.ts#L1094) |

### executionComments

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/api/tests/:testId/execution-comments` | [source](../apps/server/src/modules/executionComments/executionComments.routes.ts#L37) |
| POST | `/api/tests/:testId/execution-comments` | [source](../apps/server/src/modules/executionComments/executionComments.routes.ts#L51) |
| GET | `/api/runs/:runId/execution-comments` | [source](../apps/server/src/modules/executionComments/executionComments.routes.ts#L81) |
| POST | `/api/runs/:runId/execution-comments` | [source](../apps/server/src/modules/executionComments/executionComments.routes.ts#L95) |

### health

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/api/health` | [source](../apps/server/src/app.ts#L69) |

### importExport

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/api/projects/:projectId/cases/import/csv/profile` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L2541) |
| POST | `/api/projects/:projectId/cases/import/csv/suggest-mapping` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L2555) |
| POST | `/api/projects/:projectId/cases/import/csv` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L2587) |
| POST | `/api/projects/:projectId/cases/import/csv/async` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L2600) |
| POST | `/api/projects/:projectId/cases/import/json` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L2637) |
| POST | `/api/projects/:projectId/cases/import/xml` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L2656) |
| GET | `/api/projects/:projectId/import-jobs` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L2675) |
| GET | `/api/projects/:projectId/import-jobs/:jobId` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L2683) |
| GET | `/api/projects/:projectId/export-jobs` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L2705) |
| GET | `/api/projects/:projectId/export-jobs/:jobId` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L2717) |
| POST | `/api/projects/:projectId/cases/export/async` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L2740) |
| GET | `/api/projects/:projectId/attachments/export` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L2787) |
| POST | `/api/projects/:projectId/attachments/export/async` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L2806) |
| POST | `/api/projects/:projectId/attachments/import` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L2843) |
| POST | `/api/projects/:projectId/runs/results/export/csv/async` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L2872) |
| GET | `/api/projects/:projectId/reports/export-jobs` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L2899) |
| POST | `/api/projects/:projectId/reports/export` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L2907) |
| GET | `/api/projects/:projectId/reports/export` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L2937) |
| GET | `/api/projects/:projectId/export-jobs/:jobId/download` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L2965) |
| GET | `/api/projects/:projectId/cases/export/csv` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L2989) |
| GET | `/api/projects/:projectId/cases/export/json` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L2999) |
| GET | `/api/projects/:projectId/cases/export/testrail` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L3009) |
| GET | `/api/projects/:projectId/cases/export/xml` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L3019) |
| GET | `/api/projects/:projectId/runs/:runId/results/export/csv` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L3029) |
| GET | `/api/projects/:projectId/runs/:runId/results/export/testrail` | [source](../apps/server/src/modules/importExport/importExport.routes.ts#L3040) |

### integrations

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/api/projects/:projectId/integrations/defects` | [source](../apps/server/src/modules/integrations/integrations.routes.ts#L126) |
| PATCH | `/api/projects/:projectId/integrations/defects` | [source](../apps/server/src/modules/integrations/integrations.routes.ts#L133) |
| GET | `/api/projects/:projectId/integrations/defects/template-preview` | [source](../apps/server/src/modules/integrations/integrations.routes.ts#L185) |
| GET | `/api/projects/:projectId/integrations/defects/reference-urls` | [source](../apps/server/src/modules/integrations/integrations.routes.ts#L206) |
| GET | `/api/projects/:projectId/integrations/defects/push-fields` | [source](../apps/server/src/modules/integrations/integrations.routes.ts#L216) |
| POST | `/api/projects/:projectId/integrations/defects/test-connection` | [source](../apps/server/src/modules/integrations/integrations.routes.ts#L242) |
| GET | `/api/projects/:projectId/integrations/defects/issues/search` | [source](../apps/server/src/modules/integrations/integrations.routes.ts#L254) |
| GET | `/api/projects/:projectId/integrations/defects/recent` | [source](../apps/server/src/modules/integrations/integrations.routes.ts#L263) |

### milestones

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/api/projects/:projectId/milestones` | [source](../apps/server/src/modules/milestones/milestones.routes.ts#L62) |
| POST | `/api/projects/:projectId/milestones` | [source](../apps/server/src/modules/milestones/milestones.routes.ts#L75) |
| PATCH | `/api/projects/:projectId/milestones/:milestoneId` | [source](../apps/server/src/modules/milestones/milestones.routes.ts#L128) |
| DELETE | `/api/projects/:projectId/milestones/:milestoneId` | [source](../apps/server/src/modules/milestones/milestones.routes.ts#L217) |
| GET | `/api/projects/:projectId/milestones/:milestoneId` | [source](../apps/server/src/modules/milestones/milestones.routes.ts#L265) |
| GET | `/api/projects/:projectId/milestones/:milestoneId/runs` | [source](../apps/server/src/modules/milestones/milestones.routes.ts#L305) |

### plans

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/api/projects/:projectId/plans` | [source](../apps/server/src/modules/plans/plans.routes.ts#L115) |
| POST | `/api/projects/:projectId/plans` | [source](../apps/server/src/modules/plans/plans.routes.ts#L136) |
| PATCH | `/api/projects/:projectId/plans/:planId` | [source](../apps/server/src/modules/plans/plans.routes.ts#L171) |
| DELETE | `/api/projects/:projectId/plans/:planId` | [source](../apps/server/src/modules/plans/plans.routes.ts#L227) |
| GET | `/api/projects/:projectId/plans/:planId` | [source](../apps/server/src/modules/plans/plans.routes.ts#L265) |
| GET | `/api/projects/:projectId/plans/:planId/entries` | [source](../apps/server/src/modules/plans/plans.routes.ts#L285) |
| POST | `/api/projects/:projectId/plans/:planId/entries` | [source](../apps/server/src/modules/plans/plans.routes.ts#L319) |
| PATCH | `/api/projects/:projectId/plans/:planId/entries/:entryId` | [source](../apps/server/src/modules/plans/plans.routes.ts#L391) |
| PUT | `/api/projects/:projectId/plans/:planId/entries/:entryId/configurations` | [source](../apps/server/src/modules/plans/plans.routes.ts#L487) |
| DELETE | `/api/projects/:projectId/plans/:planId/entries/:entryId` | [source](../apps/server/src/modules/plans/plans.routes.ts#L535) |
| POST | `/api/projects/:projectId/plans/:planId/runs` | [source](../apps/server/src/modules/plans/plans.routes.ts#L585) |
| POST | `/api/projects/:projectId/plans/:planId/matrix` | [source](../apps/server/src/modules/plans/plans.routes.ts#L703) |
| POST | `/api/projects/:projectId/plans/:planId/runs/by-configuration` | [source](../apps/server/src/modules/plans/plans.routes.ts#L787) |
| GET | `/api/projects/:projectId/plans/:planId/entries/:entryId/configurations` | [source](../apps/server/src/modules/plans/plans.routes.ts#L916) |
| GET | `/api/projects/:projectId/plans/:planId/rollup-by-configuration` | [source](../apps/server/src/modules/plans/plans.routes.ts#L976) |
| GET | `/api/projects/:projectId/configuration-groups` | [source](../apps/server/src/modules/plans/plans.routes.ts#L1140) |
| POST | `/api/projects/:projectId/configuration-groups` | [source](../apps/server/src/modules/plans/plans.routes.ts#L1187) |
| PATCH | `/api/configuration-groups/:groupId` | [source](../apps/server/src/modules/plans/plans.routes.ts#L1226) |
| DELETE | `/api/configuration-groups/:groupId` | [source](../apps/server/src/modules/plans/plans.routes.ts#L1268) |
| POST | `/api/configuration-groups/:groupId/configurations` | [source](../apps/server/src/modules/plans/plans.routes.ts#L1310) |
| PATCH | `/api/configurations/:configurationId` | [source](../apps/server/src/modules/plans/plans.routes.ts#L1359) |
| DELETE | `/api/configurations/:configurationId` | [source](../apps/server/src/modules/plans/plans.routes.ts#L1414) |

### print

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/api/projects/:projectId/reports/print` | [source](../apps/server/src/modules/print/print.routes.ts#L106) |
| GET | `/api/cases/:caseId/print` | [source](../apps/server/src/modules/print/print.routes.ts#L124) |
| GET | `/api/projects/:projectId/cases/print` | [source](../apps/server/src/modules/print/print.routes.ts#L137) |
| POST | `/api/projects/:projectId/cases/print` | [source](../apps/server/src/modules/print/print.routes.ts#L154) |
| GET | `/api/projects/:projectId/runs/:runId/print` | [source](../apps/server/src/modules/print/print.routes.ts#L168) |
| GET | `/api/projects/:projectId/plans/:planId/print` | [source](../apps/server/src/modules/print/print.routes.ts#L182) |
| GET | `/api/projects/:projectId/milestones/:milestoneId/print` | [source](../apps/server/src/modules/print/print.routes.ts#L195) |

### projects

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/api/search` | [source](../apps/server/src/modules/projects/projects.routes.ts#L30) |
| GET | `/api/projects` | [source](../apps/server/src/modules/projects/projects.routes.ts#L41) |
| POST | `/api/projects` | [source](../apps/server/src/modules/projects/projects.routes.ts#L66) |
| GET | `/api/projects/:projectId/search` | [source](../apps/server/src/modules/projects/projects.routes.ts#L104) |
| GET | `/api/projects/:projectId` | [source](../apps/server/src/modules/projects/projects.routes.ts#L125) |
| POST | `/api/projects/:projectId/archive` | [source](../apps/server/src/modules/projects/projects.routes.ts#L140) |
| POST | `/api/projects/:projectId/restore` | [source](../apps/server/src/modules/projects/projects.routes.ts#L157) |
| PATCH | `/api/projects/:projectId` | [source](../apps/server/src/modules/projects/projects.routes.ts#L174) |
| DELETE | `/api/projects/:projectId` | [source](../apps/server/src/modules/projects/projects.routes.ts#L192) |

### reports

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/api/projects/:projectId/overview` | [source](../apps/server/src/modules/reports/reports.routes.ts#L653) |
| GET | `/api/projects/:projectId/activity-series` | [source](../apps/server/src/modules/reports/reports.routes.ts#L684) |
| GET | `/api/projects/:projectId/reports/status-distribution` | [source](../apps/server/src/modules/reports/reports.routes.ts#L727) |
| GET | `/api/projects/:projectId/reports/failure-trend` | [source](../apps/server/src/modules/reports/reports.routes.ts#L743) |
| GET | `/api/projects/:projectId/reports/automation-coverage` | [source](../apps/server/src/modules/reports/reports.routes.ts#L763) |
| GET | `/api/projects/:projectId/reports/recent-failures` | [source](../apps/server/src/modules/reports/reports.routes.ts#L768) |
| GET | `/api/projects/:projectId/reports/recent-results` | [source](../apps/server/src/modules/reports/reports.routes.ts#L795) |
| GET | `/api/projects/:projectId/reports/results-explorer` | [source](../apps/server/src/modules/reports/reports.routes.ts#L820) |
| GET | `/api/projects/:projectId/reports/run-summary` | [source](../apps/server/src/modules/reports/reports.routes.ts#L940) |
| GET | `/api/projects/:projectId/reports/traceability` | [source](../apps/server/src/modules/reports/reports.routes.ts#L966) |
| GET | `/api/projects/:projectId/reports/refs-traceability` | [source](../apps/server/src/modules/reports/reports.routes.ts#L972) |
| GET | `/api/projects/:projectId/reports/coverage-gap` | [source](../apps/server/src/modules/reports/reports.routes.ts#L985) |
| GET | `/api/projects/:projectId/reports/defect-coverage` | [source](../apps/server/src/modules/reports/reports.routes.ts#L991) |
| GET | `/api/projects/:projectId/reports/milestone-summary` | [source](../apps/server/src/modules/reports/reports.routes.ts#L997) |
| GET | `/api/projects/:projectId/milestones/:milestoneId/forecast` | [source](../apps/server/src/modules/reports/reports.routes.ts#L1003) |
| GET | `/api/projects/:projectId/reports/plan-summary` | [source](../apps/server/src/modules/reports/reports.routes.ts#L1017) |
| GET | `/api/projects/:projectId/reports/case-activity-summary` | [source](../apps/server/src/modules/reports/reports.routes.ts#L1023) |
| GET | `/api/projects/:projectId/reports/cases-property-distribution` | [source](../apps/server/src/modules/reports/reports.routes.ts#L1030) |
| GET | `/api/projects/:projectId/reports/status-tops` | [source](../apps/server/src/modules/reports/reports.routes.ts#L1037) |
| GET | `/api/projects/:projectId/reports/defect-summary` | [source](../apps/server/src/modules/reports/reports.routes.ts#L1043) |
| GET | `/api/projects/:projectId/reports/results-case-comparison` | [source](../apps/server/src/modules/reports/reports.routes.ts#L1050) |
| GET | `/api/projects/:projectId/reports/results-property-distribution` | [source](../apps/server/src/modules/reports/reports.routes.ts#L1057) |
| GET | `/api/projects/:projectId/reports/refs-coverage` | [source](../apps/server/src/modules/reports/reports.routes.ts#L1064) |
| GET | `/api/projects/:projectId/reports/refs-comparison` | [source](../apps/server/src/modules/reports/reports.routes.ts#L1070) |
| GET | `/api/projects/:projectId/reports/refs-defect-summary` | [source](../apps/server/src/modules/reports/reports.routes.ts#L1077) |
| GET | `/api/projects/:projectId/reports/project-summary` | [source](../apps/server/src/modules/reports/reports.routes.ts#L1083) |
| GET | `/api/projects/:projectId/reports/users-workload-summary` | [source](../apps/server/src/modules/reports/reports.routes.ts#L1089) |
| GET | `/api/projects/:projectId/saved-reports` | [source](../apps/server/src/modules/reports/savedReports.routes.ts#L92) |
| POST | `/api/projects/:projectId/saved-reports` | [source](../apps/server/src/modules/reports/savedReports.routes.ts#L120) |
| PATCH | `/api/projects/:projectId/saved-reports/:savedReportId` | [source](../apps/server/src/modules/reports/savedReports.routes.ts#L182) |
| DELETE | `/api/projects/:projectId/saved-reports/:savedReportId` | [source](../apps/server/src/modules/reports/savedReports.routes.ts#L242) |
| GET | `/api/projects/:projectId/scheduled-reports` | [source](../apps/server/src/modules/reports/scheduledReports.routes.ts#L46) |
| POST | `/api/projects/:projectId/scheduled-reports` | [source](../apps/server/src/modules/reports/scheduledReports.routes.ts#L73) |
| PATCH | `/api/projects/:projectId/scheduled-reports/:scheduledReportId` | [source](../apps/server/src/modules/reports/scheduledReports.routes.ts#L130) |
| DELETE | `/api/projects/:projectId/scheduled-reports/:scheduledReportId` | [source](../apps/server/src/modules/reports/scheduledReports.routes.ts#L184) |
| POST | `/api/projects/:projectId/scheduled-reports/:scheduledReportId/run` | [source](../apps/server/src/modules/reports/scheduledReports.routes.ts#L227) |

### requirements

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/api/projects/:projectId/requirements` | [source](../apps/server/src/modules/requirements/requirements.routes.ts#L47) |
| POST | `/api/projects/:projectId/requirements` | [source](../apps/server/src/modules/requirements/requirements.routes.ts#L87) |
| PATCH | `/api/requirements/:requirementId` | [source](../apps/server/src/modules/requirements/requirements.routes.ts#L121) |
| DELETE | `/api/requirements/:requirementId` | [source](../apps/server/src/modules/requirements/requirements.routes.ts#L159) |
| POST | `/api/cases/:caseId/requirements/:requirementId` | [source](../apps/server/src/modules/requirements/requirements.routes.ts#L189) |
| DELETE | `/api/cases/:caseId/requirements/:requirementId` | [source](../apps/server/src/modules/requirements/requirements.routes.ts#L234) |

### results

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/api/projects/:projectId/result-correction-policy` | [source](../apps/server/src/modules/results/results.routes.ts#L178) |
| PATCH | `/api/results/:resultId` (405 immutable) | [source](../apps/server/src/modules/results/results.routes.ts#L187) |
| PUT | `/api/results/:resultId` (405 immutable) | [source](../apps/server/src/modules/results/results.routes.ts#L188) |
| DELETE | `/api/results/:resultId` (405 immutable) | [source](../apps/server/src/modules/results/results.routes.ts#L189) |
| POST | `/api/attachments` | [source](../apps/server/src/modules/results/results.routes.ts#L191) |
| POST | `/api/tests/:testId/results` | [source](../apps/server/src/modules/results/results.routes.ts#L272) |
| GET | `/api/tests/:testId/results` | [source](../apps/server/src/modules/results/results.routes.ts#L302) |
| GET | `/api/results/:resultId/steps` | [source](../apps/server/src/modules/results/results.routes.ts#L337) |
| GET | `/api/results/:resultId/scenarios` | [source](../apps/server/src/modules/results/results.routes.ts#L343) |
| GET | `/api/results/:resultId/attachments` | [source](../apps/server/src/modules/results/results.routes.ts#L349) |
| POST | `/api/results/:resultId/attachments` | [source](../apps/server/src/modules/results/results.routes.ts#L389) |
| POST | `/api/results/:resultId/attachments/presign` | [source](../apps/server/src/modules/results/results.routes.ts#L466) |
| GET | `/api/attachments/:attachmentId` | [source](../apps/server/src/modules/results/results.routes.ts#L500) |
| DELETE | `/api/attachments/:attachmentId` | [source](../apps/server/src/modules/results/results.routes.ts#L537) |
| POST | `/api/attachments/:attachmentId/download-url` | [source](../apps/server/src/modules/results/results.routes.ts#L557) |
| GET | `/api/results/:resultId/defects` | [source](../apps/server/src/modules/results/results.routes.ts#L591) |
| POST | `/api/results/:resultId/defects` | [source](../apps/server/src/modules/results/results.routes.ts#L611) |
| DELETE | `/api/results/:resultId/defects/:defectLinkId` | [source](../apps/server/src/modules/results/results.routes.ts#L703) |
| POST | `/api/results/:resultId/defects/push` | [source](../apps/server/src/modules/results/results.routes.ts#L773) |
| POST | `/api/results/:resultId/defects/:defectLinkId/sync` | [source](../apps/server/src/modules/results/results.routes.ts#L956) |

### runs

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/api/projects/:projectId/runs-overview` | [source](../apps/server/src/modules/runs/runs.routes.ts#L108) |
| GET | `/api/projects/:projectId/runs` | [source](../apps/server/src/modules/runs/runs.routes.ts#L123) |
| GET | `/api/runs/:runId` | [source](../apps/server/src/modules/runs/runs.routes.ts#L142) |
| GET | `/api/projects/:projectId/runs/:runId` | [source](../apps/server/src/modules/runs/runs.routes.ts#L152) |
| GET | `/api/projects/:projectId/runs/:runId/instances` | [source](../apps/server/src/modules/runs/runs.routes.ts#L176) |
| GET | `/api/projects/:projectId/runs/:runId/instances/grouped` | [source](../apps/server/src/modules/runs/runs.routes.ts#L210) |
| GET | `/api/projects/:projectId/cases/:caseId/execution-history` | [source](../apps/server/src/modules/runs/runs.routes.ts#L253) |
| GET | `/api/projects/:projectId/runs/:runId/instances/export/csv` | [source](../apps/server/src/modules/runs/runs.routes.ts#L274) |
| POST | `/api/projects/:projectId/runs` | [source](../apps/server/src/modules/runs/runs.routes.ts#L289) |
| PATCH | `/api/runs/:runId` | [source](../apps/server/src/modules/runs/runs.routes.ts#L338) |
| PATCH | `/api/runs/:runId/assignee` | [source](../apps/server/src/modules/runs/runs.routes.ts#L396) |
| POST | `/api/runs/:runId/results/by-case` | [source](../apps/server/src/modules/runs/runs.routes.ts#L420) |
| POST | `/api/runs/:runId/results/bulk` | [source](../apps/server/src/modules/runs/runs.routes.ts#L438) |
| POST | `/api/runs/:runId/results` | [source](../apps/server/src/modules/runs/runs.routes.ts#L477) |
| POST | `/api/runs/:runId/close` | [source](../apps/server/src/modules/runs/runs.routes.ts#L512) |
| POST | `/api/projects/:projectId/runs/:runId/sync-composition` | [source](../apps/server/src/modules/runs/runs.routes.ts#L529) |
| PATCH | `/api/projects/:projectId/runs/:runId/composition` | [source](../apps/server/src/modules/runs/runs.routes.ts#L558) |
| POST | `/api/runs/:runId/reopen` | [source](../apps/server/src/modules/runs/runs.routes.ts#L587) |
| POST | `/api/runs/:runId/tests` | [source](../apps/server/src/modules/runs/runs.routes.ts#L604) |
| POST | `/api/runs/:runId/remove-test` | [source](../apps/server/src/modules/runs/runs.routes.ts#L641) |
| GET | `/api/runs/:runId/summary` | [source](../apps/server/src/modules/runs/runs.routes.ts#L669) |
| POST | `/api/runs/:runId/rerun` | [source](../apps/server/src/modules/runs/runs.routes.ts#L675) |
| POST | `/api/runs/:runId/duplicate` | [source](../apps/server/src/modules/runs/runs.routes.ts#L694) |
| PATCH | `/api/tests/:testId/assignee` | [source](../apps/server/src/modules/runs/runs.routes.ts#L718) |
| GET | `/api/projects/:projectId/tests/assigned-to-me` | [source](../apps/server/src/modules/runs/runs.routes.ts#L757) |
| GET | `/api/projects/:projectId/tests/team-todo` | [source](../apps/server/src/modules/runs/runs.routes.ts#L766) |
| GET | `/api/runs/:runId/test-subscriptions` | [source](../apps/server/src/modules/runs/runs.routes.ts#L789) |
| PUT | `/api/tests/:testId/subscription` | [source](../apps/server/src/modules/runs/runs.routes.ts#L799) |

### sections

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/api/suites/:suiteId/sections` | [source](../apps/server/src/modules/sections/sections.routes.ts#L23) |
| POST | `/api/suites/:suiteId/sections` | [source](../apps/server/src/modules/sections/sections.routes.ts#L30) |
| POST | `/api/suites/:suiteId/sections/reorder` | [source](../apps/server/src/modules/sections/sections.routes.ts#L67) |
| PATCH | `/api/sections/:sectionId` | [source](../apps/server/src/modules/sections/sections.routes.ts#L98) |
| POST | `/api/sections/:sectionId/copy` | [source](../apps/server/src/modules/sections/sections.routes.ts#L148) |
| DELETE | `/api/sections/:sectionId` | [source](../apps/server/src/modules/sections/sections.routes.ts#L189) |

### settings

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/api/projects/:projectId/settings/attachments/retention-policy` | [source](../apps/server/src/modules/settings/attachmentRetention.routes.ts#L17) |
| POST | `/api/projects/:projectId/settings/attachments/retention-prune` | [source](../apps/server/src/modules/settings/attachmentRetention.routes.ts#L23) |
| GET | `/api/projects/:projectId/settings/audit-logs` | [source](../apps/server/src/modules/settings/audit.routes.ts#L70) |
| GET | `/api/projects/:projectId/settings/audit-logs/export.csv` | [source](../apps/server/src/modules/settings/audit.routes.ts#L163) |
| POST | `/api/projects/:projectId/settings/audit-logs/retention-prune` | [source](../apps/server/src/modules/settings/audit.routes.ts#L205) |
| GET | `/api/projects/:projectId/settings/audit-log-filters` | [source](../apps/server/src/modules/settings/audit.routes.ts#L237) |
| GET | `/api/projects/:projectId/settings/custom-fields` | [source](../apps/server/src/modules/settings/customFields.routes.ts#L45) |
| POST | `/api/projects/:projectId/settings/custom-fields` | [source](../apps/server/src/modules/settings/customFields.routes.ts#L102) |
| PATCH | `/api/projects/:projectId/settings/custom-fields/:fieldId` | [source](../apps/server/src/modules/settings/customFields.routes.ts#L180) |
| DELETE | `/api/projects/:projectId/settings/custom-fields/:fieldId` | [source](../apps/server/src/modules/settings/customFields.routes.ts#L285) |
| GET | `/api/projects/:projectId/settings/custom-roles` | [source](../apps/server/src/modules/settings/customRoles.routes.ts#L50) |
| POST | `/api/projects/:projectId/settings/custom-roles` | [source](../apps/server/src/modules/settings/customRoles.routes.ts#L72) |
| PATCH | `/api/projects/:projectId/settings/custom-roles/:roleId` | [source](../apps/server/src/modules/settings/customRoles.routes.ts#L110) |
| DELETE | `/api/projects/:projectId/settings/custom-roles/:roleId` | [source](../apps/server/src/modules/settings/customRoles.routes.ts#L138) |
| GET | `/api/projects/:projectId/settings/email-outbox` | [source](../apps/server/src/modules/settings/emailOutbox.routes.ts#L68) |
| POST | `/api/projects/:projectId/settings/email-outbox/:outboxId/retry` | [source](../apps/server/src/modules/settings/emailOutbox.routes.ts#L118) |
| GET | `/api/projects/:projectId/settings/email-outbox/digest-preview` | [source](../apps/server/src/modules/settings/emailOutbox.routes.ts#L147) |
| GET | `/api/projects/:projectId/settings/members` | [source](../apps/server/src/modules/settings/members.routes.ts#L19) |
| POST | `/api/projects/:projectId/settings/members` | [source](../apps/server/src/modules/settings/members.routes.ts#L55) |
| PATCH | `/api/projects/:projectId/settings/members/:memberId` | [source](../apps/server/src/modules/settings/members.routes.ts#L125) |
| DELETE | `/api/projects/:projectId/settings/members/:memberId` | [source](../apps/server/src/modules/settings/members.routes.ts#L214) |
| GET | `/api/projects/:projectId/settings` | [source](../apps/server/src/modules/settings/settings.routes.ts#L18) |
| GET | `/api/projects/:projectId/statuses` | [source](../apps/server/src/modules/settings/statuses.routes.ts#L25) |
| GET | `/api/projects/:projectId/settings/statuses` | [source](../apps/server/src/modules/settings/statuses.routes.ts#L40) |
| POST | `/api/projects/:projectId/settings/statuses` | [source](../apps/server/src/modules/settings/statuses.routes.ts#L54) |
| PATCH | `/api/projects/:projectId/settings/statuses/:statusId` | [source](../apps/server/src/modules/settings/statuses.routes.ts#L152) |
| DELETE | `/api/projects/:projectId/settings/statuses/:statusId` | [source](../apps/server/src/modules/settings/statuses.routes.ts#L257) |
| GET | `/api/projects/:projectId/settings/templates` | [source](../apps/server/src/modules/settings/templates.routes.ts#L25) |
| POST | `/api/projects/:projectId/settings/templates` | [source](../apps/server/src/modules/settings/templates.routes.ts#L39) |
| PATCH | `/api/projects/:projectId/settings/templates/:templateId` | [source](../apps/server/src/modules/settings/templates.routes.ts#L119) |
| DELETE | `/api/projects/:projectId/settings/templates/:templateId` | [source](../apps/server/src/modules/settings/templates.routes.ts#L206) |
| GET | `/api/projects/:projectId/settings/webhooks` | [source](../apps/server/src/modules/settings/webhooks.routes.ts#L49) |
| GET | `/api/projects/:projectId/settings/webhook-events` | [source](../apps/server/src/modules/settings/webhooks.routes.ts#L88) |
| GET | `/api/projects/:projectId/settings/webhook-event-catalog` | [source](../apps/server/src/modules/settings/webhooks.routes.ts#L93) |
| GET | `/api/projects/:projectId/settings/webhook-delivery-policy` | [source](../apps/server/src/modules/settings/webhooks.routes.ts#L98) |
| PATCH | `/api/projects/:projectId/settings/webhook-delivery-policy` | [source](../apps/server/src/modules/settings/webhooks.routes.ts#L111) |
| GET | `/api/projects/:projectId/settings/webhook-attempts` | [source](../apps/server/src/modules/settings/webhooks.routes.ts#L150) |
| GET | `/api/projects/:projectId/settings/webhook-attempts/:attemptId` | [source](../apps/server/src/modules/settings/webhooks.routes.ts#L204) |
| POST | `/api/projects/:projectId/settings/webhooks` | [source](../apps/server/src/modules/settings/webhooks.routes.ts#L236) |
| PATCH | `/api/projects/:projectId/settings/webhooks/:webhookId` | [source](../apps/server/src/modules/settings/webhooks.routes.ts#L287) |
| DELETE | `/api/projects/:projectId/settings/webhooks/:webhookId` | [source](../apps/server/src/modules/settings/webhooks.routes.ts#L337) |
| POST | `/api/projects/:projectId/settings/webhook-attempts/:attemptId/retry` | [source](../apps/server/src/modules/settings/webhooks.routes.ts#L368) |
| POST | `/api/projects/:projectId/settings/webhooks/:webhookId/test-send` | [source](../apps/server/src/modules/settings/webhooks.routes.ts#L397) |
| GET | `/api/projects/:projectId/workspace-preferences` | [source](../apps/server/src/modules/settings/workspacePreferences.routes.ts#L16) |
| PATCH | `/api/projects/:projectId/workspace-preferences` | [source](../apps/server/src/modules/settings/workspacePreferences.routes.ts#L23) |

### sharedSteps

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/api/projects/:projectId/shared-steps` | [source](../apps/server/src/modules/sharedSteps/sharedSteps.routes.ts#L49) |
| GET | `/api/projects/:projectId/shared-steps/:sharedStepId` | [source](../apps/server/src/modules/sharedSteps/sharedSteps.routes.ts#L57) |
| POST | `/api/projects/:projectId/shared-steps` | [source](../apps/server/src/modules/sharedSteps/sharedSteps.routes.ts#L67) |
| PATCH | `/api/projects/:projectId/shared-steps/:sharedStepId` | [source](../apps/server/src/modules/sharedSteps/sharedSteps.routes.ts#L92) |
| DELETE | `/api/projects/:projectId/shared-steps/:sharedStepId` | [source](../apps/server/src/modules/sharedSteps/sharedSteps.routes.ts#L120) |
| POST | `/api/cases/:caseId/shared-steps/:sharedStepId` | [source](../apps/server/src/modules/sharedSteps/sharedSteps.routes.ts#L140) |

### suites

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/api/projects/:projectId/suites` | [source](../apps/server/src/modules/suites/suites.routes.ts#L30) |
| POST | `/api/projects/:projectId/suites` | [source](../apps/server/src/modules/suites/suites.routes.ts#L37) |
| POST | `/api/projects/:projectId/suites/baselines` | [source](../apps/server/src/modules/suites/suites.routes.ts#L74) |
| GET | `/api/projects/:projectId/suites/:suiteId/summary` | [source](../apps/server/src/modules/suites/suites.routes.ts#L104) |
| GET | `/api/projects/:projectId/suites/:suiteId/cases` | [source](../apps/server/src/modules/suites/suites.routes.ts#L113) |
| GET | `/api/suites/:suiteId` | [source](../apps/server/src/modules/suites/suites.routes.ts#L138) |
| PATCH | `/api/suites/:suiteId` | [source](../apps/server/src/modules/suites/suites.routes.ts#L143) |
| DELETE | `/api/suites/:suiteId` | [source](../apps/server/src/modules/suites/suites.routes.ts#L169) |

### testrail

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/api/v2` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L404) |
| GET | `/api/v2/openapi.json` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L419) |
| GET | `/api/v2/postman-collection.json` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L427) |
| GET | `/api/v2/get_projects` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L435) |
| GET | `/api/v2/get_project/:projectId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L440) |
| GET | `/api/v2/get_suite/:suiteId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L447) |
| GET | `/api/v2/get_section/:sectionId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L454) |
| GET | `/api/v2/get_milestone/:milestoneId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L462) |
| GET | `/api/v2/get_plan/:planId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L472) |
| GET | `/api/v2/get_case_types` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L482) |
| GET | `/api/v2/get_priorities` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L486) |
| GET | `/api/v2/get_case/:caseId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L490) |
| GET | `/api/v2/get_scenarios/:caseId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L496) |
| GET | `/api/v2/get_bdd_scenarios/:caseId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L502) |
| POST | `/api/v2/add_scenario/:caseId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L508) |
| POST | `/api/v2/add_bdd_scenario/:caseId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L520) |
| POST | `/api/v2/update_scenario/:scenarioId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L532) |
| POST | `/api/v2/update_bdd_scenario/:scenarioId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L544) |
| POST | `/api/v2/delete_scenario/:scenarioId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L556) |
| POST | `/api/v2/delete_bdd_scenario/:scenarioId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L562) |
| GET | `/api/v2/get_bdd_result_scenarios/:resultId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L568) |
| GET | `/api/v2/get_suites/:projectId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L574) |
| GET | `/api/v2/get_sections/:projectId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L580) |
| GET | `/api/v2/get_milestones/:projectId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L595) |
| GET | `/api/v2/get_plans/:projectId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L608) |
| GET | `/api/v2/get_statuses` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L621) |
| GET | `/api/v2/get_case_statuses` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L637) |
| GET | `/api/v2/get_datasets/:projectId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L641) |
| GET | `/api/v2/get_variables/:projectId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L646) |
| GET | `/api/v2/get_configs/:projectId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L651) |
| POST | `/api/v2/add_milestone/:projectId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L667) |
| POST | `/api/v2/update_milestone/:milestoneId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L691) |
| POST | `/api/v2/add_plan/:projectId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L728) |
| POST | `/api/v2/update_plan/:planId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L749) |
| POST | `/api/v2/add_config_group/:projectId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L779) |
| POST | `/api/v2/update_config_group/:configGroupId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L790) |
| POST | `/api/v2/add_config/:configGroupId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L806) |
| POST | `/api/v2/update_config/:configurationId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L821) |
| GET | `/api/v2/get_case_fields/:projectId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L837) |
| GET | `/api/v2/get_result_fields/:projectId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L847) |
| GET | `/api/v2/get_templates/:projectId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L857) |
| GET | `/api/v2/get_users` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L867) |
| GET | `/api/v2/get_users/:projectId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L877) |
| GET | `/api/v2/get_reports/:projectId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L889) |
| GET | `/api/v2/get_reports` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L900) |
| GET | `/api/v2/get_roles` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L925) |
| GET | `/api/v2/get_labels/:projectId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L929) |
| GET | `/api/v2/get_groups` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L935) |
| GET | `/api/v2/get_shared_steps/:projectId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L939) |
| GET | `/api/v2/get_attachments_for_case/:caseId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L947) |
| GET | `/api/v2/get_attachments_for_result/:resultId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L958) |
| POST | `/api/v2/run_report/:reportId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L969) |
| GET | `/api/v2/get_cases/:projectId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L1004) |
| GET | `/api/v2/get_runs/:projectId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L1022) |
| POST | `/api/v2/add_case/:sectionId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L1033) |
| POST | `/api/v2/update_case/:caseId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L1048) |
| GET | `/api/v2/get_run/:runId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L1061) |
| POST | `/api/v2/add_suite/:projectId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L1068) |
| POST | `/api/v2/update_suite/:suiteId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L1080) |
| POST | `/api/v2/add_section/:projectId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L1091) |
| POST | `/api/v2/update_section/:sectionId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L1113) |
| POST | `/api/v2/delete_section/:sectionId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L1127) |
| POST | `/api/v2/add_run/:projectId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L1134) |
| GET | `/api/v2/get_tests/:runId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L1155) |
| GET | `/api/v2/get_results/:testId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L1166) |
| GET | `/api/v2/get_results_for_case/:runId/:caseId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L1177) |
| GET | `/api/v2/get_results_for_run/:runId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L1195) |
| POST | `/api/v2/close_run/:runId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L1214) |
| POST | `/api/v2/update_run/:runId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L1221) |
| POST | `/api/v2/add_result_for_case/:runId/:caseId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L1251) |
| POST | `/api/v2/add_results_for_cases/:runId` | [source](../apps/server/src/modules/testrail/testrail.routes.ts#L1271) |

### tokens

| Method | Path | Handler |
| --- | --- | --- |
| GET | `/api/projects/:projectId/tokens/scopes` | [source](../apps/server/src/modules/tokens/tokens.routes.ts#L179) |
| GET | `/api/projects/:projectId/tokens` | [source](../apps/server/src/modules/tokens/tokens.routes.ts#L190) |
| POST | `/api/projects/:projectId/tokens` | [source](../apps/server/src/modules/tokens/tokens.routes.ts#L197) |
| DELETE | `/api/projects/:projectId/tokens/:tokenId` | [source](../apps/server/src/modules/tokens/tokens.routes.ts#L206) |
| GET | `/api/tokens` | [source](../apps/server/src/modules/tokens/tokens.routes.ts#L214) |
| POST | `/api/tokens` | [source](../apps/server/src/modules/tokens/tokens.routes.ts#L221) |
| DELETE | `/api/tokens/:tokenId` | [source](../apps/server/src/modules/tokens/tokens.routes.ts#L241) |

## 변경 시 갱신

path/method, request/response, required/nullable/default, auth/permission, status/error, pagination/alias, bulk/transaction, 지원 모드가 바뀌면 해당 계약과 등록 목록을 함께 수정한다. 관련 handler/schema 테스트에서 응답을 확인하며 문서 변경만으로 전체 API가 검증됐다고 주장하지 않는다.
