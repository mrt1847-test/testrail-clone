# TestRail Run 실행 화면 대비 갭 및 좁히기 계획

Last updated: 2026-05-18

**기준 스냅샷:** 실제 TestRail 7.x 런 상세 페이지 HTML (`runs/view/63307`, 프로젝트 222, 플랜 `Tracking Test`, 구성 `APP (iOS)`, 25 tests, `display=subtree`).

**관련 문서:** [UX_GAP_ANALYSIS.md](../../UX_GAP_ANALYSIS.md), [RUNS_OVERVIEW_VIEW_PARITY.md](./RUNS_OVERVIEW_VIEW_PARITY.md) (런·플랜 **목록** `runs/overview`), [CASE_REPOSITORY_VIEW_PARITY.md](./CASE_REPOSITORY_VIEW_PARITY.md), [PROJECT_OVERVIEW_VIEW_PARITY.md](./PROJECT_OVERVIEW_VIEW_PARITY.md), [SCREEN_INVENTORY.md](../../SCREEN_INVENTORY.md) § Run execution, [NEXT_ACTIONS.md](../../NEXT_ACTIONS.md), [COMPONENT_MAP.md](../../COMPONENT_MAP.md), [FEATURE_CHECKLIST.md](../../FEATURE_CHECKLIST.md) § TR-Core Run execution.

> **구분:** `runs/overview` (어떤 런을 열지)는 [RUNS_OVERVIEW_VIEW_PARITY.md](./RUNS_OVERVIEW_VIEW_PARITY.md). 이 문서는 `runs/view/{id}` **실행 워크벤치** 전용이다.

---

## 1. TestRail이 이 화면에서 하는 일

테스터의 **일일 작업 벤치**다. 한 런 안에서:

1. 진행률을 한눈에 본다 (파이·바·passed %).
2. 섹션/그룹으로 테스트 목록을 탐색한다.
3. 행에서 빠르게 상태를 찍거나, 상세 패널에서 결과·스텝·첨부·결함을 기록한다.
4. 필터·정렬·컬럼·대량 할당/결과로 묶음 작업을 한다.
5. 목록 컨텍스트를 잃지 않은 채 다음 테스트로 이동한다.

---

## 2. TestRail 레이아웃 (HTML 기준)

```mermaid
flowchart TB
  subgraph header["content-header"]
    H1["Run ID · 제목 · 구성"]
    H2["Reports / Defects / Print / Export / Subscribe"]
    H3["플랜 breadcrumb"]
  end
  subgraph stats["statsContainer"]
    PIE["Highcharts 파이 + 범례"]
    PCT["passed % · untested 문구"]
    BAR["하단 progress bar"]
  end
  subgraph body["body-container (3열)"]
    subgraph main["content (가운데·넓음)"]
      TB["Columns · Assign · Add Results · Sort · Filter"]
      GC["groupContainer: 섹션 그룹 테이블"]
    end
    subgraph qpane["qpane (선택 시)"]
      QP["Results & Comments · History · Defects 탭"]
    end
    subgraph side["sidebar (우측)"]
      SM["Tests&Results / Activity / Progress 탭"]
      GT["groupTreeContainer: 섹션 트리"]
      DISP["Display: subtree / tree / compact"]
    end
  end
  header --> stats --> body
```

---

## 3. 클론 현재 구현 매핑

**라우트:** `/projects/:projectId/runs/:runId` → `RunDetailPage.tsx`

| TestRail 영역 | 클론 컴포넌트 / 동작 | 일치도 |
|---------------|---------------------|--------|
| content-header | `RunHeader`, `RunPlanBreadcrumb`, `RunDetailHeaderSecondaryActions` | 부분 |
| statsContainer (파이) | `RunProgressChart`, `RunExecutionStatsBar`, `RunStatusSidebar` | 있음 |
| sidebar 섹션 트리 | `RunSectionTree` (실행 그리드 **왼쪽**) | 있음 |
| sidebar Tests/Activity/Progress/Defects | Status·Activity·Progress·**Defects** 탭 | 부분 |
| groupContainer (섹션 그룹 테이블) | `instances/grouped` API + `TestInstanceTable` 그룹 헤더 | 있음 |
| Sort / Group | `RunInstancesToolbar` Sort·Group 메뉴 + API `sortBy`/`groupBy` | 부분 |
| Filter bubble | `RunInstancesToolbar` 패널 + API `priority`/`caseType`/`caseChanged` | 부분 |
| Columns | `RunColumnsDialog` + localStorage (`run-column-prefs`) | 부분 |
| Assign To | 행 할당 + `useRunBulkActions` | 부분 |
| Add Results (대량) | `RunActionsPanel` + bulk mutation | 있음 |
| statusDropdown (인라인) | grouped 모드 `<select>` 인라인 상태 | 있음 |
| addResultDialog | `ResultEntryPanel` (QPane Results 탭) | 부분 |
| qpane 탭 | `RunQPanePanel`: Results \| History \| Defects | 부분 |
| Pass & Next / rel dropdown | `RunExecutionToolbar`, `jumpToNext` localStorage | 있음 |
| Subscribe run/test | 행 Watch + Subscribe 드롭다운 | 부분 |
| Export XML/CSV/Excel | **Tests CSV**, **Results CSV**, Print; Excel 미구현 | 부분 |
| display=subtree | `RunSectionTree` + `display` URL (`subtree`/`tree`/`compact`) | 있음 |

---

## 4. 기능별 상세 갭 (잔여)

| 항목 | 상태 | 잔여 |
|------|------|------|
| QPane Q 키 토글 | 미구현 | 빈 패널 유지 + Q 단축키 |
| 컬럼 서버 preference API | localStorage만 | `PATCH /users/me/preferences` |
| Export Excel / XML | 미구현 | TestRail export 다이얼로그 수준 |
| Assign To (view/all/selected) 드롭다운 | 부분 | TestRail `assignTo` 버블 |
| Add Result 전용 모달 (스텝 케이스) | 인라인 QPane | 모달 분리 |
| Working On / inProgress | 없음 | My Tests 연동 |
| Run-wide Subscribe | 행 Watch만 | 런 전체 구독 API |

---

## 5. 좁히기 로드맵

### Wave A — 실행 벤치 골격 (P0) ✅

`RunSectionTree`, grouped API, 3열 레이아웃, URL `sectionId`/`groupBy`/`testId`, 인라인 status.

### Wave B — 실행 속도 (P0) ✅

Pass & Next, Next untested, J/K/F/B/U/P, `jumpToNext` localStorage.

### Wave C — 진행률·헤더 (P1) ✅

`RunProgressChart`, sticky `RunExecutionStatsBar`, plan breadcrumb, Export/Subscribe 골격.

### Wave D — 테이블 운영 (P1) ✅

Columns (localStorage), Group/Sort, Filter bubble → API (`priority`, `caseType`, `caseChanged`, `sortBy`, `sortDir`).

### Wave E — QPane·사이드바 심화 (P2) ✅ (핵심)

1. `RunQPanePanel` 탭: Results \| History \| Defects.
2. `GET /cases/:caseId/execution-history` + `CaseExecutionTrendChart`.
3. Sidebar Defects 탭 + Export tests/results CSV.

---

## 6. API·데이터

| capability | 상태 |
|------------|------|
| 섹션별·그룹 테스트 목록 | `GET .../runs/:runId/instances/grouped` |
| 섹션 counts | `sectionCounts` in grouped response |
| 인스턴스 필터·정렬 | `runInstanceListQuery` + query params |
| Cross-run history | `GET .../cases/:caseId/execution-history` |
| Export tests | `GET .../runs/:runId/instances/export/csv` |
| Export results | `GET .../runs/:runId/results/export/csv` (기존) |
| 사용자 컬럼 설정 (서버) | 미구현 |

---

## 7. 의도적으로 맞추지 않을 것

jQuery/Highcharts 번들, Enterprise 배너, Assembla CSS, CSRF HTML 패턴. **업무 흐름·밀도·키보드·URL 상태**를 맞춘다.

---

## 8. 체크리스트 (실행 화면 “TestRail-like” 게이트)

- [x] 섹션 트리에서 구역 선택 시 테이블이 해당 subtree로 제한된다. (`sectionId` + grouped API)
- [x] 테이블이 섹션(또는 선택 groupBy) 헤더로 묶인다. (`groupBy=section_id|priority|type`)
- [x] 행에서 1클릭 상태 변경이 가능하다. (grouped 모드 인라인 `<select>`)
- [x] QPane이 열린 채로 Pass & Next로 5건 이상 처리 가능하다. (`advanceOnPass` + `jumpToNext`)
- [x] failed/blocked/untested 점프가 필터와 함께 동작한다. (`RunExecutionToolbar` + `useRunTestNavigation`)
- [x] 상태 칩/차트 클릭 시 테이블 필터가 연동된다. (`RunProgressChart` / sidebar → `statusFilter`)
- [x] `testId` 및 `sectionId`가 URL에 남는다. (`useRunUrlState`)
- [x] 새로고침 후에도 선택·필터가 복원된다. (URL 동기화 + column localStorage)

---

## 9. 코드 앵커 (클론)

| 역할 | 파일 |
|------|------|
| 페이지 조립 | `apps/web/src/features/runs/components/RunDetailPage.tsx` |
| 섹션 트리 | `RunSectionTree.tsx` |
| 테이블·툴바 | `RunInstancesSection.tsx`, `RunInstancesToolbar.tsx`, `TestInstanceTable.tsx` |
| QPane 탭 | `RunQPanePanel.tsx`, `ResultEntryPanel.tsx`, `ResultHistoryList.tsx`, `CaseCrossRunHistoryList.tsx`, `RunDefectsPanel.tsx` |
| 진행률 | `RunProgressChart.tsx`, `RunExecutionStatsBar.tsx`, `RunDetailSidebar.tsx` |
| URL·컬럼 | `hooks/useRunUrlState.ts`, `hooks/useRunColumnPreferences.ts` |
| API 필터 | `apps/server/src/domain/runInstanceListQuery.ts` |
| Cross-run history | `apps/server/src/modules/runs/caseExecutionHistory.service.ts` |
| 네비게이션 | `hooks/useRunTestNavigation.ts`, `hooks/useRunKeyboardShortcuts.ts` |

---

## 10. 다음 액션

1. QPane **Q** 키 토글 + 빈 QPane 유지 (선택 해제 시).
2. Run-wide Subscribe API.
3. Export Excel + 컬럼 서버 preference.
4. [FEATURE_CHECKLIST.md](../../FEATURE_CHECKLIST.md) TR-Core Run execution 항목 스크린샷 게이트 검수.

이 문서는 TestRail HTML 스냅샷 구조 분해 기준이며, Enterprise 전용 메뉴는 포함하지 않는다.
