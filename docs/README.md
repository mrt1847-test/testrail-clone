# Documentation

현재 방향: TestRail 공식 UI/UX 기준의 페이지 전체 조화와 테스터 업무 흐름. 기본 입력은 NEXT_ACTIONS와 활성 계획의 Current 절뿐이다.

| 문서 | 단일 책임 |
| --- | --- |
| [PRODUCT_SPEC](./PRODUCT_SPEC.md) | 제품 기능·페이지 UI/UX·동작/수용 계약 |
| [DOMAIN_MODEL](./DOMAIN_MODEL.md) | case/run/test/result 구분과 도메인 불변식 |
| [API_SPEC](./API_SPEC.md) | 외부 API 계약 |
| [DATABASE_SCHEMA](./DATABASE_SCHEMA.md) | 저장 구조와 일관성 정책 |
| [ARCHITECTURE](./ARCHITECTURE.md) | 서버/프런트 책임과 데이터 흐름 |
| [FEATURE_CHECKLIST](./FEATURE_CHECKLIST.md) | 기능 납품 상태. 현재 사용성 인증 아님 |
| [ROADMAP](./ROADMAP.md) | 현재 방향·우선순위·보류 범위 |
| [NEXT_ACTIONS](./NEXT_ACTIONS.md) | Current와 유일한 실행 순서 |
| [활성 계획](./superpowers/plans/2026-09-23-testrail-page-ux.md) | 현재 UI/PX 단위별 범위·체크·완료 기준 |
| [CI 예제](./CI_AND_COMPATIBILITY_EXAMPLES.md) | 기존 지원 API를 사용하는 운영 예제; 연동 작업 때만 읽기 |

`ux-evidence`에는 현재 제품 스펙이 직접 참조하는 before 화면만 유지한다. 새 작업의 검증 증거는 해당 ID로 기록하되 과거 캡처를 현재 완료 증거로 사용하지 않는다.

제품 요구/API/상태가 바뀔 때 해당 소유 문서만 갱신한다. 별도 문서 관리 규칙·감사·검토·완료 wave 문서를 반복 생성하지 않는다. 코드 경로/컴포넌트 목록은 소스에서 확인한다. 완료 작업을 현재 계획에 재편성하거나 문서 정리를 제품 재검증으로 해석하지 않는다.

API·DB·구조·도메인 계약 변경은 해당 코드 작업 안에서 소유 스펙을 함께 갱신한다. 활성 실행 계획의 문서 동기화 표가 완료 조건이며, 변경 없는 문서의 날짜 갱신이나 별도 감사 문서 생성은 하지 않는다.
