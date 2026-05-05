# 문서 운영 규칙

기능 구현·수정 PR마다 아래를 수행한다.

1. `docs/FEATURE_CHECKLIST.md`의 `[x]` / `[ ]`를 실제 API·UI 기준으로 갱신한다.
2. 범위가 큰 배치(다중 도메인)면 `docs/ROADMAP.md`의 상태 요약을 짧게 맞춘다.
3. 공개 API 경로·요청/응답 형태가 바뀌면 `docs/API_SPEC.md`를 동기화한다.

파일 기반 감사 스냅샷은 `docs/FILE_BASED_AUDIT_YYYY-MM-DD.md` 형식으로 보관하고, 대규모 리팩터·기능 묶음 이후 새 날짜로 다시 작성한다.
