# File-Based Audit (2026-05-04)

이 문서는 `testrail-clone` 저장소를 **문서 설명이 아닌 실제 파일/코드 구성 기준**으로 다시 점검한 결과다.

<<<<<<< ours
<<<<<<< ours
**보정 (코드 대조)**: 런 **생성 시점**에는 이미 `includeAll`, `caseIds`, `excludedCaseIds` 조합으로 케이스 부분 선택이 가능하다(`apps/server/src/modules/runs/runs.schema.ts`). P0로 남는 것은 **섹션 트리 기준 스코프**, **오픈 런에서의 테스트 추가/제거**, **결과 보존과 연계된 정책** 등 심화 영역이다.

=======
>>>>>>> theirs
=======
>>>>>>> theirs
## 1) 점검 범위와 방법

- 서버: `apps/server/src`의 모듈 라우트/서비스/활동 로직 확인
- 웹: `apps/web/src`의 라우트/페이지/훅 구성 확인
- 스펙 일치성: `docs/API_SPEC.md`, `docs/FEATURE_CHECKLIST.md`, `docs/ROADMAP.md`와 코드 대응 확인

핵심 확인 포인트:
<<<<<<< ours
<<<<<<< ours

=======
>>>>>>> theirs
=======
>>>>>>> theirs
1. TestRail-like 핵심 흐름(케이스 -> 런 -> 결과 -> 리포트 -> 알림) 실제 파일 존재 여부
2. 문서상 "구현됨" 항목의 코드 근거 존재 여부
3. 문서상 P0 공백이 실제 코드에서도 공백인지 여부

<<<<<<< ours
<<<<<<< ours
=======
---

>>>>>>> theirs
=======
---

>>>>>>> theirs
## 2) 실제 파일 구성 확인 결과

### 2.1 서버 모듈 구성 (실제 존재)

`apps/server/src/app.ts`에서 아래 모듈들이 등록되어 있으며, 도메인 분리가 이루어져 있다.

- `projects`, `suites`, `sections`, `cases`, `runs`, `results`
- `requirements`, `reports`, `milestones`, `plans`
- `automation`, `importExport`, `integrations`
- `settings`(분리 라우트), `activity`, `testrail`, `tokens`, `auth`

<<<<<<< ours
<<<<<<< ours
=======
즉, 테스트 관리도구로서 핵심 도메인 모듈 파일은 실제로 갖춰져 있다.

>>>>>>> theirs
=======
즉, 테스트 관리도구로서 핵심 도메인 모듈 파일은 실제로 갖춰져 있다.

>>>>>>> theirs
### 2.2 웹 라우트 구성 (실제 존재)

`apps/web/src/App.tsx` 기준으로 프로젝트 하위 라우트가 실제 존재한다.

- 실행/결과: `runs`, `runs/new`, `runs/:runId`, `results`, `my-tests`
- 케이스: `cases`
- 리포트/운영: `reports`, `activity`, `notifications`, `automation`, `import-export`
- 계획/설정: `milestones`, `plans`, `settings/*`

<<<<<<< ours
<<<<<<< ours
### 2.3 Activity/Notification/Webhook 실코드 존재

- `apps/server/src/modules/activity/activity.routes.ts`
- `apps/server/src/modules/activity/activity.service.ts`
- `apps/web/src/features/projects/components/NotificationsPage.tsx`
- `apps/web/src/features/projects/components/WebhooksPage.tsx`
=======
=======
>>>>>>> theirs
즉, 문서에 언급된 주요 화면 축은 단순 계획이 아니라 실제 페이지 컴포넌트 단위로 연결되어 있다.

### 2.3 Activity/Notification/Webhook 실코드 존재

- `apps/server/src/modules/activity/activity.routes.ts`
  - 알림 목록/읽음 처리/모두 읽음/선호도 API 존재
- `apps/server/src/modules/activity/activity.service.ts`
  - 이벤트 저장 시 알림 fan-out 및 webhook delivery attempt 생성 로직 존재
- `apps/web/src/features/projects/components/NotificationsPage.tsx`
  - 인박스 UI 존재
- `apps/web/src/features/projects/components/WebhooksPage.tsx`
  - 웹훅 설정/시도 조회/재시도 UI 존재

즉, "완전 미구현"이 아니라 baseline은 실제 존재한다.

---
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs

## 3) 문서-코드 일치성 재검증

### 3.1 문서상 "구현됨"과 코드가 일치하는 부분

- 섹션 CRUD 라우트 존재: `apps/server/src/modules/sections/sections.routes.ts`
- 활동/알림 API 존재: `apps/server/src/modules/activity/activity.routes.ts`
<<<<<<< ours
<<<<<<< ours
- 웹 알림/웹훅 페이지 존재
- `/api/v2` 호환 어댑터 모듈 존재: `apps/server/src/modules/testrail/testrail.routes.ts`

### 3.2 문서상 "미완료"가 코드에서도 미완료로 보이던 부분 (후속 구현 대상)

1. Run composition 심화
2. Report drilldown 화면
3. Webhook 비동기 delivery worker
4. `/api/v2` 확장 범위

이후 배치에서 위 항목들이 보강되면 본 문서는 새 날짜로 재작성하는 것을 권장한다.
=======
=======
>>>>>>> theirs
- 웹 알림/웹훅 페이지 존재: `NotificationsPage.tsx`, `WebhooksPage.tsx`
- `/api/v2` 호환 어댑터 모듈 존재: `apps/server/src/modules/testrail/testrail.routes.ts`

=> 체크리스트의 baseline 완료 표시는 대체로 코드 근거가 확인된다.

### 3.2 문서상 "미완료"가 코드에서도 미완료로 보이는 부분

아래는 파일/구조 관점에서 공백으로 판단된다.

1) Run composition 심화
- run 생성/상세 파일은 있으나(section 단위 선택/생성 후 add-remove 전용 흐름) 기능 흔적이 제한적
- 문서의 P0 미완료 진술과 일치

2) Report drilldown 화면
- `ReportsPage.tsx`는 존재하나 리포트 유형별 상세 drilldown 전용 페이지 군은 제한적
- 문서의 P0 미완료 진술과 일치

3) Webhook 비동기 delivery worker
- `activity.service.ts`에서 delivery attempt 생성은 보이나, 별도 백그라운드 HTTP 전송 워커 구조는 현재 기준 명확히 보이지 않음
- 문서의 "follow-up 필요"와 일치

4) `/api/v2` 확장 범위
- 어댑터 모듈은 존재하나 문서가 명시한 광범위 카테고리 전체 구현 상태는 아님
- 문서의 partial 진술과 일치

---
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs

## 4) 현재 상태 판정 (파일 기준)

판정: **"베이스라인 운영 가능 + 핵심 고도화 필요"**

<<<<<<< ours
<<<<<<< ours
## 5) 수정/보완 권장사항 (우선순위)

P0-1 Run composition 심화 · P0-2 실행 워크스페이스 · P0-3 리포트 drilldown · P0-4 알림/웹훅 전달력 · P1 `/api/v2` 확장 — 상세는 `docs/FEATURE_CHECKLIST.md` 및 `docs/ROADMAP.md` 참고.

## 6) 문서 운영 규칙

`docs/DOC_MAINTENANCE.md` 참고.
=======
=======
>>>>>>> theirs
- 가능한 것:
  - 프로젝트/케이스/런/결과 입력/기본 리포트/활동/알림/설정 등 핵심 도메인 플로우의 파일·라우트·화면 골격 보유
- 부족한 것:
  - TestRail-like 실무 운영 강도를 위한 P0 고도화(런 구성 심화, drilldown 리포트, 전달 파이프라인, /api/v2 확장)

즉, "데모/초기 운영 가능" 단계이며, "대규모 팀 실무/마이그레이션 중심" 수준으로 가려면 다음 섹션의 보완이 필요하다.

---

## 5) 수정/보완 권장사항 (우선순위)

### P0-1 Run composition 심화
- section include/exclude 입력 모델
- open run add/remove API + UI
- 기존 결과 보존 규칙/정책 명문화

### P0-2 실행 워크스페이스 안정화
- selected test 결과 이력 pagination
- 스코프 캐시 무효화 규칙 표준화
- close/reopen 정책 경고 UX + 서버 상태 전이 통합

### P0-3 리포트 상세 드릴다운
- run summary/results/traceability/coverage/defect 유형별 상세 페이지 추가
- 필터/요약/테이블/원본 링크 통일

### P0-4 알림/웹훅 전달력
- 이벤트 taxonomy 확장
- 알림 대상 라우팅 규칙 강화
- webhook HTTP delivery worker(재시도/백오프/응답기록/test-send)

### P1 `/api/v2` 확장
- 프로젝트/스위트/섹션/마일스톤/플랜/설정류 우선 확장
- 계약 테스트를 카테고리별로 분리

---

## 6) 문서 운영 규칙 제안

- 기능 구현/수정 PR마다:
  1. `docs/FEATURE_CHECKLIST.md`의 `[x]/[ ]` 업데이트
  2. 범위가 크면 `docs/ROADMAP.md` 상태 요약 갱신
  3. API 변화 시 `docs/API_SPEC.md` 동기화

- 본 문서(`FILE_BASED_AUDIT_2026-05-04.md`)는 파일기반 스냅샷이므로, 다음 대규모 리팩터/기능 배치 후 새 날짜 문서로 재작성 권장.
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
