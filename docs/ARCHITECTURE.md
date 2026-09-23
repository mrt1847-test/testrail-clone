# Architecture

Updated: 2026-09-23. 현재 worktree의 entrypoint·의존성·repository 연결 기준. 설계 권고와 실제 구현을 구분한다.

## 실행 구조

- React 18/TypeScript/Vite 프런트와 Fastify 5/TypeScript 서버의 monorepo다. PostgreSQL은 Prisma 6를 통해 접근한다. 버전의 정확한 허용 범위는 각 package.json, 설치 버전은 lockfile이 원장이다.
- [app.ts](../apps/server/src/app.ts)의 `buildApp()`가 Fastify, 공통 error handler/CORS, 서비스/repository와 라우트를 조립한다. [server.ts](../apps/server/src/server.ts)가 listen 및 background worker 시작을 담당한다. 단일 API 프로세스 안의 모듈형 구조다.
- [env.ts](../apps/server/src/config/env.ts)의 `USE_IN_MEMORY_REPOSITORY !== "false"` 때문에 기본은 메모리 모드다. Prisma 모드에서는 DB client singleton을 사용한다. 두 모드가 같은 권한·영속화·외부 저장소 능력을 제공한다고 가정하지 않는다.
- Prisma 모드에서 webhook delivery, email delivery, scheduled report, attachment storage worker를 시작한다. 개별 worker의 동작/주기는 해당 설정과 구현을 따른다. 별도 queue 서비스가 필수인 구조라고 문서화하지 않는다.

## 책임과 코드 위치

| 영역 | 구현 위치·책임 |
| --- | --- |
| API 등록 | `apps/server/src/app.ts`, `modules/*/*.routes.ts`; settings 등은 하위 등록 함수로 분할 |
| 요청 검증 | feature `*.schema.ts`의 Zod 및 route 내부 schema |
| 도메인 정책 | `domain/`, feature service, permissions/projectAccess.service |
| 영속화 | projects의 memory/Prisma repository, runs의 memory/Prisma repository를 조립해 cases/results 등에서 재사용 |
| DB | `apps/server/prisma/schema.prisma`, migrations, `src/db/prisma.ts` |
| 브라우저 route | `apps/web/src/App.tsx`; ProjectLayout이 프로젝트 shell/outlet 소유 |
| 화면·상태 | `apps/web/src/features/{auth,cases,projects,runs}` 및 shared; hooks가 query/mutation/URL 상태 조율 |
| HTTP | `apps/web/src/shared/api/http.ts`의 apiFetch와 feature API 모듈; Bearer token은 localStorage의 testrail.accessToken |
| 공유 패키지 | packages/shared의 타입·상태·응답 계약, packages/api-client의 별도 클라이언트. 전체 웹이 api-client로 통합된 상태는 아님 |

route→schema→service→repository 분리는 목표 책임 구조다. 모든 feature가 동일한 파일 세트를 갖추거나 route에서 Prisma를 직접 사용하지 않는다고 주장하지 않는다. 기존 직접 접근이 있는 모듈은 관련 변경 범위에서 책임을 확인한다.

## 데이터 흐름과 보존 정책

- case는 작성 원본, instance는 Run 소속 실행 대상, result는 결과 이력이다. authored 변경과 과거 결과를 섞지 않는다. 실제 snapshot 필드와 연결은 DATABASE_SCHEMA를 따른다.
- RunsService/ResultsService가 repository를 통해 생성·기록을 수행한다. 결과 생성·최신 상태 갱신은 transaction 경계를 사용하며 bulk의 atomic 옵션을 구별한다.
- Prisma 모드에서는 RunCompositionSyncService를 RunsService에 연결한다. All/Dynamic 구성 동기화와 Selected 고정 집합의 의미는 해당 서비스/정책을 따른다.
- TanStack Query로 서버 상태를 관리하고 관련 Run/test/case 범위만 invalidate한다. 목록 pagination/filter와 상세 지연 조회를 사용한다. 모든 화면이 실시간 subscription을 갖췄다는 의미는 아니다.
- 초안·선택·복귀 문맥은 프런트 책임, 저장 권한·닫힌 Run·결과 불변식은 서버 책임이다. UI 보호만으로 서버 정책을 대체하지 않는다.

## 인증·외부 의존의 실제 경계

- AuthService는 이메일 기반 사용자 조회/생성과 자체 HMAC 서명 `v1` 토큰을 사용한다. 표준 JWT/session/password 인증 구현으로 설명하지 않는다. 현재 login의 password 필드는 서비스 검증에 사용되지 않고 logout은 서버 token revoke를 수행하지 않는다.
- 권한은 route별 authorization/permission helper로 적용한다. 전역 인증 hook이 모든 route를 일괄 보호하는 구조는 아니다. 메모리 모드에는 DB-backed 권한 검사를 생략하는 경로가 있으므로 운영 권한 수용 검증에 대체 사용하지 않는다.
- CORS는 plugins/cors, 설정은 env가 소유한다. 실제 .env 비밀값은 문서에 쓰지 않는다.
- 첨부 metadata는 PostgreSQL, bytes와 signed URL은 domain/attachmentStorage 및 저장소 연동이 담당한다. presign 실패/미설정과 결과 저장 성공을 분리한다.
- webhook/email/report/attachment worker의 재시도·외부 오류는 각 모듈의 책임이다. 메모리 성공을 실제 전달·bytes 보존 증거로 간주하지 않는다.

## 변경 시 문서 책임

모듈/entrypoint/worker/통신·상태 소유권/환경 모드가 바뀌면 이 문서를 갱신한다. wire contract는 API_SPEC, persistence는 DATABASE_SCHEMA, 도메인 의미는 DOMAIN_MODEL, 사용자 동작은 PRODUCT_SPEC에 기록한다. 변경 없는 문서를 전부 읽거나 날짜만 갱신하지 않는다.
