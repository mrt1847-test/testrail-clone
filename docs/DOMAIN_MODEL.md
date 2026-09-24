# Domain Model

Updated: 2026-09-23. 현재 구현의 모델 이름과 데이터 경계를 기준으로 정리했다. 필드/관계 원장은 [DATABASE_SCHEMA](./DATABASE_SCHEMA.md), 동작과 오류는 [API_SPEC](./API_SPEC.md)다.

## 핵심 경계

| 개념 | 책임·관계 |
| --- | --- |
| Project / TestSuite / Section | 프로젝트 범위, 저장소, parentSectionId 기반 섹션 계층 |
| TestCase | 작성 원본. lockVersion으로 동시 수정 비교, archivedAt/deletedAt 구별. 실행 상태를 case에 저장하지 않음 |
| TestCaseStep / TestCaseScenario | 순서 있는 절차와 BDD 시나리오. step/scenario 결과와는 별개 |
| TestCaseVersion | versionNo와 지침·커스텀 값·첨부 snapshot을 가진 작성 이력 |
| SharedStep / SharedStepEntry | 재사용 절차. 미래 미구현 개념이 아니라 현재 schema/route에 존재 |
| TestRun | 실행 묶음. suite, 선택 정책, 일정/환경, 선택적 milestone/plan 관계 |
| TestInstance | Run 소속 case 실행 대상. 일부 snapshot 필드와 caseLockVersionAtRun, 현재 status/latestResultId 보유. API의 test와 같은 개념 |
| TestResult / TestResultStep / TestResultScenario | 실행 결과 이력과 단계/시나리오별 결과. 정정은 기존 행 수정이 아니라 새 결과 |
| ExecutionComment | 실행 문맥의 논의. TestResult의 상태 변경 이력과 혼동하지 않음 |
| Milestone | 상하위 milestone 및 연결 Run/Plan의 릴리스 문맥 |
| TestPlan / TestPlanEntry | 여러 실행 묶음과 구성 선택. entry와 생성된 Run의 소속을 함께 유지 |
| ConfigurationGroup / Configuration / TestPlanEntryConfiguration | 브라우저·환경 등 구성 차원/값/entry 연결 |
| Requirement / CaseRequirement | 요구사항과 케이스 추적성. 자유 문자열 refs와 구별 |
| Attachment | 다형 대상·명시적 result 연결을 가진 metadata. bytes 저장은 외부 경로 |
| ResultDefectLink / DefectIntegrationSetting | 결과에 연결된 결함과 공급자 설정 |
| User / ProjectMember / UserGroup / CustomRole | 사용자·프로젝트 역할·그룹·사용자 정의 권한. 실제 권한은 helper와 project access 정책을 확인 |
| ApiToken | 자동화 접근 scope/expiry/revocation 및 hash 보존 |
| ActivityEvent / AuditLog / Notification | 사용자 활동·감사·알림의 서로 다른 용도 |
| WebhookSubscription / WebhookDeliveryAttempt / EmailOutbox | 외부 전달 설정·시도·대기열; DB 기록과 전달 성공은 다름 |
| SavedReport / ScheduledReport / ImportJob / ExportJob | 저장된 정의·일정·실행 작업/산출물. endpoint 존재와 외부 전달 성공을 구별 |
| CustomField / CustomStatus / CaseTemplate | 프로젝트 확장 정의. 실제 결과 상태의 DB enum을 자동 확장하는 것과는 다름 |
| NotificationPreference / UserProjectPreference / TestSubscription / InstanceAccessDefaults | 알림·workspace·구독·기본 접근 정책 |

## 불변식과 구현 범위

- case 작성과 Run 실행/결과는 별개다. 과거 결과 행의 내용은 유지한다. TestInstance가 지침 전체를 독립 snapshot으로 보관하거나 caseVersionId FK를 갖는다고 가정하지 않는다. 실제 snapshot 범위는 schema에서 확인한다.
- authored 수정의 낙관적 잠금은 lockVersion/expectedVersion이다. 현재 API에서 비교 값이 선택적이므로 클라이언트는 이를 보내야 안전한 동시 수정 계약이 성립한다.
- 결과 쓰기는 최신 상태와 이력의 일치를 유지한다. 기존 결과 PUT/PATCH/DELETE는 정책상 거절한다. 이미 결과가 있는 test에 untested를 재기록하지 않는다. 닫힌 Run에는 결과를 쓰지 않는다.
- All/Dynamic/Selected 구성은 membership 정책이다. 케이스 정의 수정, 열린 Run의 구성 동기화, 과거 결과 보존을 같은 동작으로 취급하지 않는다.
- 고유 case 수와 여러 Run의 test 수를 구별한다. Run 통계는 전체 instance 기준이며 현재 목록 페이지나 선택 수로 계산하지 않는다.
- 첨부 실패로 이미 저장된 결과가 미저장 상태가 되지는 않는다. 실패 파일만 같은 대상에 재시도한다.
- 페이지/상세 지연 조회와 좁은 범위 갱신을 사용한다. 모든 데이터를 클라이언트에 모아 집계하는 것을 계약으로 삼지 않는다.

## 상태와 호환 매핑

TestStatus는 untested/passed/failed/blocked/retest. TestRail 기본 ID는 1 passed, 2 blocked, 3 untested, 4 retest, 5 failed다. CustomStatus catalog와 실제 쓰기 가능 상태는 adapter/service 검증을 함께 확인한다.

도메인 경계·상태 의미·결과 정정·membership·삭제/소속 정책이 바뀌면 해당 작업에서 이 문서와 관련 API/DB 스펙을 함께 갱신한다.
