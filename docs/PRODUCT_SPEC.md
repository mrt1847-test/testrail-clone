# Product Spec

Last aligned: 2026-09-23 (UI/UX direction and document consolidation; no implementation certification)

This is the canonical entry point for the TestRail-like product specification.
Roadmaps describe delivery order; this document and the linked spec files describe what the product must do.

## Canonical Spec Documents

- Domain model and invariants: [DOMAIN_MODEL.md](./DOMAIN_MODEL.md)
- API contracts and endpoint behavior: [API_SPEC.md](./API_SPEC.md)
- Database schema and storage policies: [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)
- High-level architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Roadmap and TestRail parity gaps: [ROADMAP.md](./ROADMAP.md)
- Immediate implementation queue: [NEXT_ACTIONS.md](./NEXT_ACTIONS.md)

## Product Shape

The app is a test management system, not a generic CRUD tracker. The core product flow is:

```text
Project -> Suite -> Section -> Test Case -> Test Run -> Test Instance -> Test Result history
```

The product must preserve these boundaries:

- `TestCase` is the authored source specification.
- `TestCaseVersion` preserves immutable authored history.
- `TestRun` is a time-bound execution container.
- `TestInstance` is the run-scoped executable snapshot of a case.
- `TestResult` is append-only execution evidence.

## Required TestRail-like Capabilities

### Authoring and Change Safety
- Project, suite, section, and case management.
- Case steps with stable ordering.
- Case version history.
- Optimistic locking for authored records so concurrent edits cannot silently overwrite each other.

### Execution
- Run creation from all cases or selected cases.
- Run-scoped test instances with immutable snapshots.
- Manual result entry and bulk result entry.
- Step-level result entry.
- Append-only result history.
- Run closing/reopen policy.
- Assignment and "My Tests" workflow.
- Rerun workflow from failed/blocked/retest/all subsets.

### Automation
- Project-scoped API tokens.
- Bulk automation result upload.
- Mapping by case id, automation key, and external id.
- CI metadata storage.
- Upload history, failed item visibility, and retry policy.
- TestRail-compatible API adapter baseline under `/api/v2`.

### Planning
- Milestones.
- Test plans.
- Plan entries.
- Configuration groups and values.
- Matrix-based run generation for browser/device/OS/environment combinations.

### Evidence and Integrations
- Result attachments using object storage and signed URLs.
- Normalized result-to-defect links.
- Defect integration settings for Jira/GitHub/Azure-style providers.
- Import/export jobs for cases, results, and reports.

### Reporting and Traceability
- Project overview and operational dashboards.
- Run summary and status distribution.
- Recent failures and recent results.
- Requirement records.
- Case-to-requirement links.
- Requirement coverage, coverage gaps, traceability matrix, and defect coverage reports.

### Collaboration and Administration
- Project members and roles: `owner`, `manager`, `tester`, `viewer`.
- Activity timeline.
- Notification inbox and preferences.
- Custom fields, custom statuses, and case templates.
- Audit logs and webhook events.

## Performance and Freshness Rules

- Case/run/result lists must be paginated and filterable.
- Expensive children such as steps, attachments, result history, and defect links load on detail expansion.
- Result entry updates the active test instance optimistically and revalidates only the active run context.
- Realtime events should invalidate scoped queries. They must not trigger full project reloads.
- Summary counters may be cached or materialized, but canonical detail must remain reconstructable from append-only source tables.

## Implementation Status Source

Current delivery order and progress live in [ROADMAP.md](./ROADMAP.md). If roadmap text conflicts with this product spec, update the spec first and then adjust the roadmap.

The current app is not yet a full TestRail feature clone. Use [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md) for capability status and [ROADMAP.md](./ROADMAP.md) for direction; neither substitutes for current UI/UX acceptance.

For near-term execution, use [NEXT_ACTIONS.md](./NEXT_ACTIONS.md). It narrows the broad parity list into the main workflows: test case management, execution/result entry, reports/traceability, and UI/UX integration.

<a id="uiux-contract"></a>
## 현재 UI/UX 계약

TestRail 공식 문서·스크린샷을 페이지 전체 구성의 기준으로 삼는다. 평가 단위는 기능 버튼이 아니라 페이지 목적, 탐색/본문/보조 영역의 관계, 공간 비율, 정보 위계, 시선 흐름과 페이지 간 일관성이다. 공식 이미지의 시기·crop·화면 상태가 다르면 동일 버전/동일 viewport 비교로 주장하지 않는다.

| 페이지 | 목표 | 공식 참조 |
| --- | --- | --- |
| Cases | 트리와 본문이 같은 부모/자식 계층을 표현. 전체 범위와 트리 포커스 구별. 전체 작성과 섹션 빠른 추가의 역할 분리 | [Sections](https://support.testrail.com/hc/en-us/articles/14985199889812-Sections) |
| 작성·읽기 | 제목/짧은 메타 묶음/지침/저장이 연속된 흐름. 반복 메타·빈 첨부가 지침보다 강조되지 않음. 모바일 상세는 활성 작업 영역 | [작성](https://support.testrail.com/hc/en-us/articles/14438119644692-Adding-test-cases) |
| Run | 요약·목록·선택 상세의 비율을 함께 조정. 지침은 주요 작업 영역, 목록 도구와 단일/일괄 결과 대상은 구별 | [결과 수행](https://support.testrail.com/hc/en-us/articles/15813183376148-Submitting-test-results) |
| 결과창 | 넓은 주 입력·좁은 보조 입력·안정된 footer. 정상/실패/부분 성공에도 대상→기록→완료 흐름 유지 | 위 결과 수행 문서 |
| Plan·Overview·Milestone | 실행/설정, 요약/작업 진입 구별. 차트가 앞에 있다는 이유만으로 결함 판정하지 않음. 공식 동일 상태 전체 화면 확인 후 수정 | [공식 소개](https://support.testrail.com/hc/en-us/articles/7076810203028-Introduction-to-TestRail) |

### 보존할 동작과 데이터 의미

- Cases Section 그룹은 조회 결과의 조상을 포함해 트리 순서·표시 루트 기준 상대 깊이로 표현하고 제목/행/빠른 추가를 함께 들여쓴다. 좁은 화면의 들여쓰기는 화면 폭 6%·80px 상한을 적용한다. 조상 표시로 케이스 소속이나 조회 건수를 바꾸지 않는다. all의 트리 위치는 추가 대상이며 조회 선택과 구별한다. 그룹 건수와 본문 접기는 직접 소속 케이스만 대상으로 하고 빈 조상에는 접기 버튼을 표시하지 않는다. 상단 Add Test Case는 전체 작성, 섹션 끝 Add Case는 제목만 빠른 추가다. 검증: [PX-01](./ux-evidence/PX-01.md).

- 결과창은 동시에 하나. 열 때 project/run/test와 복귀 포커스를 고정하며 비동기 선택 변경이 저장 대상을 바꾸지 않는다. 행 Status와 상세 Add Result는 같은 창을 사용하고 열기/취소만으로 결과를 쓰지 않는다. 같은 상태도 새 기록으로 추가 가능하다.
- 일반 저장은 현재 테스트 유지. 명시적 Save & Next/Pass & Next만 이동하며 마지막에서 임의 순환하지 않는다. 빠른 성공도 필수 입력이 있으면 입력창으로 연결한다. 닫힌 Run/읽기 권한에서는 쓰지 않는다. 결과 이력을 덮어쓰거나 Untested로 되돌리지 않는다.
- 초안이 있으면 이탈 확인, Keep은 값/대상 유지, Discard는 의도한 이동 한 번. 변경 없음/정상 저장 후 불필요 경고 없음. 저장 실패는 초안 유지. 부분 성공은 성공 ID를 재사용하고 실패 단계만 재시도한다. 첨부 재시도는 결과나 성공 파일을 중복 생성하지 않는다.
- Tab/Shift+Tab/Escape·포커스 복귀·배경 비활성화를 실제 키 입력으로 검증한다. 배경 클릭으로 초안을 폐기하지 않는다. 대상 로딩 실패를 빈 내용으로 위장하지 않는다.
- Run 통계의 분모는 조회 페이지/선택/필터가 아닌 Run 전체. 통과율은 Passed/전체, 미실행은 Untested, 기록률은 통과율/완료와 다르다. 0건은 NaN 없이 표현하고 상태명은 색 없이 읽는다. 통계 클릭은 조회 필터이며 결과 기록이 아니다. 영구 왼쪽 통계 열로 되돌리지 않는다.
- 페이지별 loading/empty/error/readonly 상태에서 대상과 다음 행동을 구별한다. 취소는 쓰기 없음, 중복 제출 방지, 충돌은 명시적으로 표시한다. 목록의 필터/정렬/선택/복귀 문맥을 보존한다.

### 검증 기준과 현재 화면 근거

1440×1000 / 1280×720 / 390×844의 전체 페이지 before/after, 실제 키보드, 저장 대상 재조회로 검증한다. 기능 테스트·overflow 0만으로 UI/UX 완료를 주장하지 않는다. 독립 사용자 수용과 전문가 평가는 구분한다. 아래 캡처는 2026-09-21 관찰이며 수정 완료 증거가 아니다.

- [attachment-partial](./ux-evidence/e2e-0921-attachment-partial.png)
- [bulk-select](./ux-evidence/e2e-0921-bulk-select.png)
- [context-after](./ux-evidence/e2e-0921-context-after.png)
- [context-before](./ux-evidence/e2e-0921-context-before.png)
- [result-dialog-panel](./ux-evidence/e2e-0921-result-dialog-panel.png)
- [run-1280](./ux-evidence/e2e-0921-run-1280.png)
- [scope-all](./ux-evidence/e2e-0921-scope-all.png)
- [steps-form](./ux-evidence/e2e-0921-steps-form.png)
