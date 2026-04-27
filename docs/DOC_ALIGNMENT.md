# Documentation Alignment Notes

이 문서는 구현 단계에서 문서 간 경계를 맞추기 위한 기준 메모다.

## Canonical Documents
- 제품 범위(phase/우선순위): `docs/ROADMAP.md`
- 현재 구현 상태 기반 실행 로드맵: `docs/INTEGRATED_ROADMAP.md`
- 도메인 용어/불변식: `docs/DOMAIN_MODEL.md`
- API 계약/경로/응답 규약: `docs/API_SPEC.md`
- DB 구조/정책: `docs/DATABASE_SCHEMA.md`
- 화면/라우트/행동 기준: `docs/SCREEN_INVENTORY.md`

보조 문서(`UI_ROADMAP`, `UI_FLOW`, `COMPONENT_MAP`, `FRONTEND_ARCHITECTURE`, `ROUTE_MAP`)는 canonical 문서와 상충할 수 없다.

## Duplication Rules
- API endpoint 목록과 요청/응답 계약은 `API_SPEC.md`에 둔다.
- 화면별 required API, loading/empty/error 요구사항은 `SCREEN_INVENTORY.md`에 둔다.
- 프론트엔드 route hierarchy와 query/navigation rule은 `ROUTE_MAP.md`에 둔다.
- 컴포넌트 책임, 구현 상태, 교체 가능성은 `COMPONENT_MAP.md`에 둔다.
- UI phase, delivery tier, phase exit criteria는 `UI_ROADMAP.md`에 둔다.
- 현재 진행도, 다음 batch 순서, 단기 completion target은 `INTEGRATED_ROADMAP.md`에 둔다.
- 실제 구현 task, 파일 단위 작업, phase dependency는 `IMPLEMENTATION_PLAN.md`에 둔다.
- 보조 문서에서 canonical 정보를 다시 써야 할 때는 전체 목록을 복사하지 말고 해당 canonical 문서를 링크한다.
- 같은 route/API/component 목록이 두 문서 이상에 필요해 보이면 먼저 어느 문서가 source of truth인지 정한 뒤 나머지는 요약/링크만 남긴다.

## Canonical Boundaries
- `TestCase`: 설계 시점 명세
- `TestInstance`: run 생성 시 materialize 되는 실행 단위
- `TestResult`: append-only 결과 이력

## API Path Convention
- 프로젝트 스코프: `/api/projects/:projectId/*`
- run 생성 표준: `POST /api/projects/:projectId/runs`
- 런 상세 조회(권장): `/api/projects/:projectId/runs/:runId`
- 런 상세 조회(호환): `/api/runs/:runId`
- 결과 등록/조회: `/api/runs/:runId/results*`, `/api/tests/:testId/results`
- 토큰/설정 API는 프로젝트 스코프 우선: `/api/projects/:projectId/tokens`, `/api/projects/:projectId/settings/*`

## Naming Convention
- API camelCase 우선: `pageSize`, `caseId`, `testId`
- 하위 호환 alias 허용: `page_size`, `case_id`, `test_id`
- 문서 예시는 canonical(`camelCase`)을 우선 사용하고, alias는 호환 설명에서만 사용한다.

## Schema Baseline
- Audit 필드: `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`
- `test_instances` snapshot 불변
- `test_results` append-only
- attachments는 `entity_type + entity_id`로 다형 참조
- 구현/문서 불일치가 있으면 `DATABASE_SCHEMA.md`에 `Current Implementation` 섹션으로 명시한다.
- `docs/DB_SCHEMA.md`는 `docs/DATABASE_SCHEMA.md`를 가리키는 alias 문서로만 유지한다(내용 원본 작성 금지).
