# File-Based Audit (2026-05-04)

이 문서는 `testrail-clone` 저장소를 **문서 설명이 아닌 실제 파일/코드 구성 기준**으로 다시 점검한 결과다.

**보정 (코드 대조)**: 런 **생성 시점**에는 이미 `includeAll`, `caseIds`, `excludedCaseIds` 조합으로 케이스 부분 선택이 가능하다(`apps/server/src/modules/runs/runs.schema.ts`). P0로 남는 것은 **섹션 트리 기준 스코프**, **오픈 런에서의 테스트 추가/제거**, **결과 보존과 연계된 정책** 등 심화 영역이다.

## 1) 점검 범위와 방법

- 서버: `apps/server/src`의 모듈 라우트/서비스/활동 로직 확인
- 웹: `apps/web/src`의 라우트/페이지/훅 구성 확인
- 스펙 일치성: `docs/API_SPEC.md`, `docs/FEATURE_CHECKLIST.md`, `docs/ROADMAP.md`와 코드 대응 확인

핵심 확인 포인트:

1. TestRail-like 핵심 흐름(케이스 -> 런 -> 결과 -> 리포트 -> 알림) 실제 파일 존재 여부
2. 문서상 "구현됨" 항목의 코드 근거 존재 여부
3. 문서상 P0 공백이 실제 코드에서도 공백인지 여부

## 2) 실제 파일 구성 확인 결과

### 2.1 서버 모듈 구성 (실제 존재)

`apps/server/src/app.ts`에서 아래 모듈들이 등록되어 있으며, 도메인 분리가 이루어져 있다.

- `projects`, `suites`, `sections`, `cases`, `runs`, `results`
- `requirements`, `reports`, `milestones`, `plans`
- `automation`, `importExport`, `integrations`
- `settings`(분리 라우트), `activity`, `testrail`, `tokens`, `auth`

### 2.2 웹 라우트 구성 (실제 존재)

`apps/web/src/App.tsx` 기준으로 프로젝트 하위 라우트가 실제 존재한다.

- 실행/결과: `runs`, `runs/new`, `runs/:runId`, `results`, `my-tests`
- 케이스: `cases`
- 리포트/운영: `reports`, `activity`, `notifications`, `automation`, `import-export`
- 계획/설정: `milestones`, `plans`, `settings/*`

### 2.3 Activity/Notification/Webhook 실코드 존재

- `apps/server/src/modules/activity/activity.routes.ts`
- `apps/server/src/modules/activity/activity.service.ts`
- `apps/web/src/features/projects/components/NotificationsPage.tsx`
- `apps/web/src/features/projects/components/WebhooksPage.tsx`

## 3) 문서-코드 일치성 재검증

### 3.1 문서상 "구현됨"과 코드가 일치하는 부분

- 섹션 CRUD 라우트 존재: `apps/server/src/modules/sections/sections.routes.ts`
- 활동/알림 API 존재: `apps/server/src/modules/activity/activity.routes.ts`
- 웹 알림/웹훅 페이지 존재
- `/api/v2` 호환 어댑터 모듈 존재: `apps/server/src/modules/testrail/testrail.routes.ts`

### 3.2 문서상 "미완료"가 코드에서도 미완료로 보이던 부분 (후속 구현 대상)

1. Run composition 심화
2. Report drilldown 화면
3. Webhook 비동기 delivery worker
4. `/api/v2` 확장 범위

이후 배치에서 위 항목들이 보강되면 본 문서는 새 날짜로 재작성하는 것을 권장한다.

## 4) 현재 상태 판정 (파일 기준)

판정: **"베이스라인 운영 가능 + 핵심 고도화 필요"**

## 5) 수정/보완 권장사항 (우선순위)

P0-1 Run composition 심화 · P0-2 실행 워크스페이스 · P0-3 리포트 drilldown · P0-4 알림/웹훅 전달력 · P1 `/api/v2` 확장 — 상세는 `docs/FEATURE_CHECKLIST.md` 및 `docs/ROADMAP.md` 참고.

## 6) 문서 운영 규칙

`docs/DOC_MAINTENANCE.md` 참고.
