# Next Actions

Last aligned: 2026-05-16

**역할:** 다음 1–2 PR 분량만 적는다. 방향은 [ROADMAP.md](./ROADMAP.md), 전체 상태는 [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md), UI 웨이브는 [UX_BACKLOG.md](./UX_BACKLOG.md).

**루프:** 여기서 꺼내 구현 → checklist `[x]` 갱신 → 이 파일을 **다음 배치로 교체**.

---

## Current batch

Run detail sidebar modes (Status / Activity / Progress)

1. Run detail right rail: status filter chips aligned with TestRail sidebar counts.
2. Activity tab: project/run-scoped events with deep links.
3. Progress tab: run metrics strip (passed/failed/blocked/untested) wired to live instance data.

끝나면 checklist Runs § execution UI 갱신 후, 아래 후보 중 하나로 이 섹션을 통째로 바꾼다.

---

## Next batch candidates (pick one after current)

- Untested-after-result policy in UI copy + bulk entry.
- Case refs CSV export column polish + import round-trip test expansion.
- Product Foundation: project archive/read-only mode (see FEATURE_CHECKLIST §37).
