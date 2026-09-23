# Database Schema

Updated: 2026-09-23. 현재 worktree의 Prisma schema와 migration 파일을 기준으로 대조했다. 운영 DB 접속·migration 적용 여부를 확인했다는 의미는 아니다.

## 기준과 실제 명명

- [schema.prisma](../apps/server/prisma/schema.prisma)가 필드·관계·기본값·index의 원장이다. 이 문서는 주요 계약과 모델 탐색을 제공하며 schema 전체를 복제하지 않는다.
- PostgreSQL datasource, `DATABASE_URL`과 migration용 `DIRECT_URL`, `prisma-client-js` generator를 사용한다.
- 현재 schema에는 `@map`/`@@map`이 없다. 모델/테이블은 `TestCase` 같은 PascalCase, 필드는 `projectId` 같은 camelCase다. 과거 문서의 `test_cases`, `project_id`를 실제 SQL 이름으로 사용하면 안 된다.
- PK는 모델별 선언을 확인한다. 감사 필드·soft delete는 모든 모델에 일괄 존재하는 규칙이 아니다. JSON·배열은 Prisma의 실제 `Json`/`String[]` 선언을 따른다.
- schema의 enum은 `TestStatus` 하나다. role/run status/source 등은 다수 String 필드와 애플리케이션 검증으로 관리한다. 별도 PostgreSQL enum이 있다고 가정하지 않는다.

## 핵심 관계와 제약

- Project→TestSuite→Section→TestCase. Section은 `parentSectionId`로 계층을 형성한다. TestCase는 project/suite/section을 모두 참조하고 `archivedAt`과 `deletedAt`을 구별한다.
- TestCase의 현재 revision은 `lockVersion`. `version` 컬럼은 없다. authored history는 TestCaseVersion의 `versionNo`, `stepsSnapshot`, `customValuesSnapshot`, `attachmentSnapshots`로 분리된다.
- TestCase의 `(projectId, automationKey)`와 `(projectId, externalId)`는 unique다. TestCaseVersion은 `(caseId, versionNo)` unique다. TestCase refs는 nullable String, labels는 String[], customValues는 Json이다.
- TestRun은 project/suite와 선택적 milestone/plan을 참조한다. `includeAll` DB 기본값 false와 생성 API 기본값 true는 서로 다른 계층의 기본값이다. 구성 정책 정보에는 `metadata`를 사용한다.
- TestInstance는 run/case와 title/priority/type/estimate/automation/external ID snapshot, `caseLockVersionAtRun`, 현재 status와 `latestResultId`를 가진다. `caseVersionId` FK나 지침 전체 snapshot 컬럼이 있다고 가정하지 않는다.
- TestResult는 test instance의 결과 기록, TestResultStep/TestResultScenario는 하위 결과다. append-only는 서비스/HTTP 정책이며 DB의 모든 UPDATE/DELETE를 막는 trigger가 schema에 선언된 것은 아니다.
- TestPlanEntry는 plan과 선택적 suite/run/assignee, configuration 관계를 가진다. TestRun.planId와 entry.runId의 연결을 함께 유지해야 한다.
- Attachment는 DB에 metadata/storagePath를 저장한다. `entityType/entityId`는 다형 대상이며 모두에게 FK가 걸린 것은 아니다. 명시적 resultId 관계는 별도 존재한다. 실제 bytes는 외부 저장 경로에 있다.
- ApiToken은 tokenHash unique와 scopes/expiry/revocation을 저장한다. 원문 토큰 저장 컬럼으로 사용하지 않는다.
- onDelete는 관계별 Cascade/Restrict/SetNull이 다르다. 기능 변경 시 모델 이름만 보고 삭제 전파를 추정하지 않는다.

## 모델·unique/index 탐색

아래 목록은 schema에서 추출한 실제 선언이다. 자세한 필드/nullable/관계는 링크의 해당 모델을 읽는다. `—`는 모델 수준 unique/index 선언이 없다는 뜻이며 field-level `@unique` 부재를 뜻하지 않는다.

| 모델 | PK 선언 | 모델 수준 unique/index |
| --- | --- | --- |
| [User](../apps/server/prisma/schema.prisma#L20) | `id         BigInt    @id @default(autoincrement())` | — |
| [UserGroup](../apps/server/prisma/schema.prisma#L53) | `id          BigInt    @id @default(autoincrement())` | @@index([deletedAt]) |
| [UserGroupMember](../apps/server/prisma/schema.prisma#L68) | `id        BigInt   @id @default(autoincrement())` | @@unique([groupId, userId]); @@index([userId]) |
| [Project](../apps/server/prisma/schema.prisma#L81) | `id          BigInt    @id @default(autoincrement())` | @@index([deletedAt]) |
| [CustomRole](../apps/server/prisma/schema.prisma#L131) | `id          BigInt    @id @default(autoincrement())` | @@unique([projectId, systemName]); @@index([projectId]) |
| [ProjectMember](../apps/server/prisma/schema.prisma#L149) | `id           BigInt    @id @default(autoincrement())` | @@unique([projectId, userId]); @@index([projectId]); @@index([userId]); @@index([customRoleId]) |
| [TestSuite](../apps/server/prisma/schema.prisma#L171) | `id            BigInt    @id @default(autoincrement())` | @@index([projectId]); @@index([projectId, isMaster]); @@index([projectId, isBaseline]); @@index([parentSuiteId]); @@index([deletedAt]) |
| [Section](../apps/server/prisma/schema.prisma#L200) | `id              BigInt    @id @default(autoincrement())` | @@index([suiteId]); @@index([parentSectionId]); @@index([suiteId, parentSectionId, displayOrder, id]) |
| [TestCase](../apps/server/prisma/schema.prisma#L222) | `id             BigInt    @id @default(autoincrement())` | @@unique([projectId, automationKey]); @@unique([projectId, externalId]); @@index([projectId]); @@index([sectionId]); @@index([sectionId, displayOrder, id]); @@index([projectId, sectionId, deletedAt]); @@index([projectId, archivedAt, deletedAt]); @@index([automationKey]); @@index([externalId]); @@index([caseTemplateId]) |
| [Requirement](../apps/server/prisma/schema.prisma#L274) | `id          BigInt    @id @default(autoincrement())` | @@unique([projectId, key]); @@index([projectId, status]) |
| [CaseRequirement](../apps/server/prisma/schema.prisma#L293) | `id            BigInt   @id @default(autoincrement())` | @@unique([caseId, requirementId]); @@index([requirementId, caseId]) |
| [TestCaseVersion](../apps/server/prisma/schema.prisma#L306) | `id             BigInt   @id @default(autoincrement())` | @@unique([caseId, versionNo]); @@index([caseId, createdAt]) |
| [SharedStep](../apps/server/prisma/schema.prisma#L326) | `id        BigInt    @id @default(autoincrement())` | @@index([projectId]); @@index([projectId, deletedAt]) |
| [SharedStepEntry](../apps/server/prisma/schema.prisma#L344) | `id             BigInt    @id @default(autoincrement())` | @@unique([sharedStepId, stepOrder]); @@index([sharedStepId]) |
| [TestCaseStep](../apps/server/prisma/schema.prisma#L361) | `id                BigInt    @id @default(autoincrement())` | @@unique([caseId, stepOrder]); @@index([caseId]); @@index([sharedStepId]); @@index([sharedStepEntryId]) |
| [TestCaseScenario](../apps/server/prisma/schema.prisma#L385) | `id            BigInt    @id @default(autoincrement())` | @@unique([caseId, scenarioOrder]); @@index([caseId]) |
| [Milestone](../apps/server/prisma/schema.prisma#L402) | `id                BigInt    @id @default(autoincrement())` | @@index([projectId]); @@index([parentMilestoneId]) |
| [TestPlan](../apps/server/prisma/schema.prisma#L427) | `id          BigInt    @id @default(autoincrement())` | @@index([projectId]); @@index([milestoneId]); @@index([assignedTo]) |
| [TestRun](../apps/server/prisma/schema.prisma#L455) | `id          BigInt    @id @default(autoincrement())` | @@index([projectId]); @@index([suiteId]); @@index([milestoneId]); @@index([status]); @@index([projectId, status, createdAt]) |
| [TestInstance](../apps/server/prisma/schema.prisma#L493) | `id                    BigInt      @id @default(autoincrement())` | @@unique([runId, caseId]); @@index([runId]); @@index([runId, status]); @@index([caseId]); @@index([status]); @@index([assignedTo]); @@index([automationKeySnapshot]); @@index([externalIdSnapshot]) |
| [TestResult](../apps/server/prisma/schema.prisma#L530) | `id             BigInt     @id @default(autoincrement())` | @@index([testInstanceId, createdAt]); @@index([status]); @@index([source]); @@index([status, createdAt]); @@index([source, createdAt]) |
| [ResultDefectLink](../apps/server/prisma/schema.prisma#L563) | `id                   BigInt    @id @default(autoincrement())` | @@unique([resultId, defectKey]); @@index([resultId, createdAt]) |
| [DefectIntegrationSetting](../apps/server/prisma/schema.prisma#L584) | `id                BigInt   @id @default(autoincrement())` | @@index([projectId]) |
| [TestResultStep](../apps/server/prisma/schema.prisma#L603) | `id           BigInt     @id @default(autoincrement())` | @@unique([resultId, stepOrder]); @@index([resultId]) |
| [TestResultScenario](../apps/server/prisma/schema.prisma#L618) | `id             BigInt     @id @default(autoincrement())` | @@unique([resultId, caseScenarioId]); @@index([resultId]); @@index([caseScenarioId]) |
| [ExecutionComment](../apps/server/prisma/schema.prisma#L634) | `id         BigInt    @id @default(autoincrement())` | @@index([projectId, entityType, entityId, createdAt]); @@index([parentId]) |
| [TestPlanEntry](../apps/server/prisma/schema.prisma#L655) | `id             BigInt    @id @default(autoincrement())` | @@index([planId]); @@index([runId]); @@index([assignedTo]) |
| [ConfigurationGroup](../apps/server/prisma/schema.prisma#L687) | `id           BigInt   @id @default(autoincrement())` | @@unique([projectId, name]); @@index([projectId, displayOrder]) |
| [Configuration](../apps/server/prisma/schema.prisma#L703) | `id           BigInt   @id @default(autoincrement())` | @@unique([groupId, name]); @@index([groupId, displayOrder]) |
| [TestPlanEntryConfiguration](../apps/server/prisma/schema.prisma#L720) | `id              BigInt @id @default(autoincrement())` | @@unique([planEntryId, configurationId]) |
| [Attachment](../apps/server/prisma/schema.prisma#L731) | `id          BigInt    @id @default(autoincrement())` | @@index([projectId]); @@index([entityType, entityId]) |
| [ApiToken](../apps/server/prisma/schema.prisma#L754) | `id         BigInt    @id @default(autoincrement())` | @@index([userId]); @@index([projectId]); @@index([revokedAt]) |
| [AuditLog](../apps/server/prisma/schema.prisma#L774) | `id          BigInt   @id @default(autoincrement())` | @@index([projectId, createdAt]); @@index([entityType, entityId]); @@index([actorUserId]) |
| [ActivityEvent](../apps/server/prisma/schema.prisma#L793) | `id          BigInt   @id @default(autoincrement())` | @@index([projectId, createdAt]); @@index([projectId, entityType, entityId, createdAt]); @@index([actorUserId, createdAt]) |
| [WebhookSubscription](../apps/server/prisma/schema.prisma#L815) | `id        BigInt   @id @default(autoincrement())` | @@index([scope, isActive, event]); @@index([projectId, isActive, event]); @@index([projectId, deletedAt]) |
| [TestSubscription](../apps/server/prisma/schema.prisma#L840) | `id        BigInt   @id @default(autoincrement())` | @@unique([userId, testId]); @@index([testId]); @@index([projectId, userId]) |
| [WebhookDeliveryAttempt](../apps/server/prisma/schema.prisma#L856) | `id              BigInt    @id @default(autoincrement())` | @@index([projectId, status, createdAt]); @@index([webhookId, createdAt]); @@index([activityEventId]) |
| [NotificationPreference](../apps/server/prisma/schema.prisma#L884) | `id                  BigInt    @id @default(autoincrement())` | @@unique([userId, projectId]); @@index([projectId]) |
| [UserProjectPreference](../apps/server/prisma/schema.prisma#L903) | `id                  BigInt   @id @default(autoincrement())` | @@unique([userId, projectId]); @@index([projectId]) |
| [EmailOutbox](../apps/server/prisma/schema.prisma#L919) | `id              BigInt    @id @default(autoincrement())` | @@index([status, nextRetryAt, createdAt]); @@index([userId, projectId, kind, createdAt]) |
| [Notification](../apps/server/prisma/schema.prisma#L943) | `id              BigInt    @id @default(autoincrement())` | @@index([userId, projectId, readAt, createdAt]); @@index([userId, projectId, snoozedUntil]); @@index([projectId, createdAt]); @@index([activityEventId]) |
| [CustomField](../apps/server/prisma/schema.prisma#L965) | `id           BigInt    @id @default(autoincrement())` | @@unique([projectId, systemName]); @@index([projectId, scope, isActive, displayOrder]); @@index([projectId, isActive, displayOrder]); @@index([projectId, deletedAt]) |
| [CustomStatus](../apps/server/prisma/schema.prisma#L991) | `id              BigInt    @id @default(autoincrement())` | @@unique([projectId, systemName]); @@index([projectId, isActive, displayOrder]); @@index([projectId, deletedAt]) |
| [CaseTemplate](../apps/server/prisma/schema.prisma#L1016) | `id           BigInt    @id @default(autoincrement())` | @@unique([projectId, name]); @@unique([projectId, systemKey]); @@index([projectId, isActive, displayOrder]); @@index([projectId, deletedAt]) |
| [ImportJob](../apps/server/prisma/schema.prisma#L1041) | `id        BigInt   @id @default(autoincrement())` | @@index([projectId, createdAt]); @@index([status]) |
| [ExportJob](../apps/server/prisma/schema.prisma#L1059) | `id        BigInt   @id @default(autoincrement())` | @@index([projectId, createdAt]); @@index([status]) |
| [SavedReport](../apps/server/prisma/schema.prisma#L1076) | `id          BigInt    @id @default(autoincrement())` | @@index([projectId, deletedAt, updatedAt]); @@index([projectId, reportType]) |
| [InstanceAccessDefaults](../apps/server/prisma/schema.prisma#L1094) | `id                       Int      @id @default(1)` | — |
| [ScheduledReport](../apps/server/prisma/schema.prisma#L1104) | `id               BigInt    @id @default(autoincrement())` | @@index([projectId, deletedAt, enabled, nextRunAt]); @@index([savedReportId]) |

현재 모델 49개, enum 1개. migration 디렉터리 51개, 이름 정렬상 마지막은 `20260525000000_plan_entry_semantics`다. 이는 배포 완료 기록이 아니다.

## 변경 시 갱신

필드·타입·nullability·기본값·관계·unique/index·삭제 정책을 변경하면 schema와 migration, 이 문서의 해당 계약/목록을 같은 작업에서 갱신한다. API payload나 도메인 의미가 바뀌면 API_SPEC/DOMAIN_MODEL도 함께 갱신한다. Prisma generate/validate와 관련 회귀를 실행하고 migration 적용은 대상 환경 권한과 데이터 영향을 별도 확인한다. 문서 정합성 작업만으로 운영 migration을 실행하지 않는다.
