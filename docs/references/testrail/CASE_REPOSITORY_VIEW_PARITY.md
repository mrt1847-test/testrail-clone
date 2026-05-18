# TestRail Test Cases(Repository) 화면 대비 갭 및 좁히기 계획

Last updated: 2026-05-18

**기준 스냅샷:** TestRail 7.x Test Cases HTML (`suites/view/3588`, suite `Gemini Ph 2_Search(추천 모듈 전환)`, 16 sections / 140 cases, `display=subtree`, `group_by=cases:section_id`).

**관련 문서:** [UX_GAP_ANALYSIS.md](../../UX_GAP_ANALYSIS.md) § Test Case Repository, [RUN_EXECUTION_VIEW_PARITY.md](./RUN_EXECUTION_VIEW_PARITY.md), [PROJECT_OVERVIEW_VIEW_PARITY.md](./PROJECT_OVERVIEW_VIEW_PARITY.md), [FEATURE_CHECKLIST.md](../../FEATURE_CHECKLIST.md).

---

## 1. TestRail이 이 화면에서 하는 일

**케이스 저장소(workbench)** 다. 한 suite 안에서:

1. **섹션 트리**로 구조를 탐색하고, 선택한 범위의 케이스를 **섹션 헤더가 있는 하나의 큰 테이블**로 본다.
2. 행·섹션 단위로 **선택·정렬·필터·컬럼**을 바꾸고, **QPane**에서 케이스 상세를 본다.
3. **Run Test**, Import/Export, Copy/Move, Shared Steps 등 저장소 운영 작업을 헤더에서 시작한다.
4. 드래그앤드롭으로 섹션·케이스를 이동/복사한다.
5. 삭제는 **Mark as Deleted** vs **Delete Permanently** 두 단계다.

런 실행 화면과 달리, 여기서는 “한 번에 많은 케이스를 구조와 함께 스캔”하는 것이 핵심이다.

---

## 2. TestRail 레이아웃 (HTML 기준)

TestRail은 **섹션 트리가 오른쪽 사이드바**, **케이스 그리드가 가운데**, **QPane이 선택 시 분할**된다.

```mermaid
flowchart LR
  subgraph content["content (넓음)"]
    HDR["content-header: Run Test · Reports · Defects · Shared Steps · Print/Export/Import/Copy"]
    TB["contentToolbar: Columns · Delete · Edit · Add Case · Display Deleted"]
    GC["#groupContainer: 섹션 그룹 + 케이스 테이블"]
    QP["#qpane: 선택 케이스 상세"]
  end
  subgraph sidebar["sidebar 435px (우측)"]
    ADD["Add Test Case"]
    META["16 sections · 140 cases · estimates"]
    ST["#groupTreeContainer jstree"]
    DISP["Display: Subgroups"]
  end
  content --- sidebar
```

**DOM 앵커:**

| 영역 | TestRail ID/클래스 | 역할 |
|------|-------------------|------|
| 헤더 툴바 | `content-header-toolbar` | Run Test, Reports, Defects, Shared Test Steps |
| 헤더 아이콘 | print, `#exportDropdown`, `#importDropdown`, copy cases | 저장소 I/O |
| Defects | `#defectDropdown` | 외부 Jira 등 **Add Defect** (새 탭) |
| 메인 툴바 | `#contentToolbar` | Columns, Delete, Edit▼, Add Case, Display Deleted |
| Sort/Filter | `#orderDropdown`, `#filterCasesBubble` | groupBy (기본 Section), 복합 필터 |
| 케이스 그리드 | `#groupContainer` / `#groups` | AJAX `App.Suites.showInitial()`, **전 suite·섹션 그룹 테이블** |
| QPane | `#qpane`, `App.Suites.applyQPane` | 선택 행 상세 (토글 Q) |
| 사이드바 트리 | `#groupTreeContainer`, `#groupTree` | jstree 섹션 트리 |
| 표시 모드 | `#displayDropdown` | tree / subtree / compact |
| Suite 메타 | `#sidebarInfo` | 섹션·케이스 수, forecast bubble |
| DnD | `#casesDndDropdown`, `#sectionsDndDropdown` | Move/Copy here |
| 삭제 | `#casesDeletionDialog` | Mark as Deleted \| Delete Permanently |

**스크립트 상태 (스냅샷):** `suite_id=3588`, `display=subtree`, `group_id=111274`, `group_by=cases:section_id`, `displayDeletedCases=0`.

---

## 3. 클론 현재 구현 매핑

**라우트:** `/projects/:projectId/cases` → `TestCaseWorkspacePage` → `TestCaseWorkspace.tsx`

```mermaid
flowchart LR
  subgraph clone["TestCaseWorkspace (현재)"]
    SW["SuiteSwitcherBar"]
    TREE["SectionTreePane (왼쪽)"]
    LIST["CaseListPane (가운데, 선택 섹션만)"]
    DET["CaseDetailSidePanel (오른쪽, 선택 시)"]
  end
```

| TestRail 영역 | 클론 | 일치도 |
|---------------|------|--------|
| 3-pane workbench | 트리 \| 목록 \| 상세 패널 | **있음** (트리 위치만 좌↔우 반대) |
| 가운데 **전체 suite 그룹 테이블** | **선택 섹션 `direct` 케이스만** (`sectionScope: "direct"` 고정) | **없음** (구조적 갭) |
| display subtree/compact | subtree API 있으나 UI 미노출 | 없음 |
| content-header (Run Test 등) | `ProjectLayout` 탭만; 케이스 전용 헤더 없음 | 없음 |
| Reports/Defects 드롭다운 | Reports 별도 탭; Defects 외부 연동 일부 | 부분 |
| Shared Test Steps | 미구현 ([FEATURE_CHECKLIST](../../FEATURE_CHECKLIST.md) P2) | 없음 |
| Import/Export/Copy in header | `ImportExportPage` 별도 라우트 | 부분 |
| Columns / Sort groupBy | `CaseListToolbar` 컬럼·필터·saved views | 부분 |
| Display Deleted toggle | `state: active \| archived` 필터 | 부분 |
| Edit selected / view / filter | bulk edit, archive, delete | 부분 |
| QPane | `CaseDetailSidePanel` + `CaseDetailPage` 라우트 | 부분 |
| Section tree + Add Section | `SectionTreePane` (왼쪽) | 있음 |
| Suite stats / estimates | 없음 (트리 상단 메타 약함) | 없음 |
| DnD cases/sections | `useCaseListDnD`, section reorder | 부분 |
| Mark deleted vs permanent | bulk delete / archive 정책 확인 필요 | 부분 |
| 키보드 C/S/R/Q/J/K | 일부만 | 부분 |

---

## 4. 기능별 상세 갭

### 4.1 정보 구조 (P0)

| 항목 | TestRail | 클론 | 좁히기 |
|------|----------|------|--------|
| 메인 그리드 범위 | 선택 섹션 **+ 하위 섹션** 케이스를 **한 테이블**에 섹션 헤더로 표시 (`subtree`) | 트리에서 고른 **한 섹션**의 direct 케이스만 | `CaseListPane`에 **SuiteGroupedCaseTable**: `groupBy=section`, `display=subtree\|tree\|compact` |
| 트리 위치 | **우측** sidebar | **좌측** `SectionTreePane` | 선택: TR과 동일하게 **우측 트리**로 옮기거나, 좌측 유지 시 문서화·사용자 설정 |
| URL 상태 | `group_id`, filter, display | section + case panel (부분) | `?sectionId=&caseId=&display=&groupBy=` |
| QPane | 목록 유지 + 우측 분할 | `xl:grid-cols` 패널 | Q 토글, 스플리터 너비 저장 |

**핵심:** 클론은 3-pane 골격은 갖췄지만, TestRail의 “**가운데가 전체 저장소 테이블**”인 점이 아직 다르다. 이 차이가 P0다.

### 4.2 헤더·저장소 운영 (P1)

| 항목 | TestRail | 클론 | 좁히기 |
|------|----------|------|--------|
| Run Test | `runs/add/3588/2` | 런 생성 라우트만 | `CaseRepositoryHeader`: Run Test → run create w/ suite |
| Reports | suite-scoped `add_job` 메뉴 | 프로젝트 Reports | 헤더 Reports 드롭다운 → 기존 report 라우트 + suite 쿼리 |
| Defects | Jira CreateIssue URL | defect integration 설정 | `DefectsDropdown` (외부 URL from settings) |
| Shared Steps | `shared_steps/overview/222` | 없음 | 별도 epic; 헤더 링크 placeholder |
| Print | `suites/plot/3588` | `CasesPrintPage` | 헤더 Print 링크 |
| Export XML/CSV/Excel | `#exportDropdown` | Import/Export 페이지 + jobs | 헤더 Export + 다이얼로그 |
| Import XML/CSV | 4-step CSV wizard | wizard on Import/Export | 헤더 Import 동일 플로우 진입 |
| Copy/Move cases | `#selectCasesDialog` cross-project | `MoveCopyChooserDialog` 섹션 간 | cross-suite/project 복사 UI |

### 4.3 툴바·테이블 (P1)

| 항목 | TestRail | 클론 | 좁히기 |
|------|----------|------|--------|
| Columns | per-user width `selectColumnsDialog` | `CaseListColumn[]` 토글 | user column prefs API |
| Sort/Group | 15+ `setCaseGrouping` | 없음 (섹션 트리 선택으로 대체) | groupBy 드롭다운 + API |
| Filter bubble | `filterCasesBubble` | toolbar 필터 필드 | 고급 필터 패널 |
| Display Deleted | toolbar toggle | archived filter | 동일 토글 + deleted 상태 |
| Bulk Edit | edit selected / view / all in filter | bulk update | 동일 3-scope 메뉴 |
| Inline title edit | `#editCaseDialog` | drawer / detail | 행 인라인 제목 편집 |

### 4.4 사이드바·메타 (P2)

| 항목 | TestRail | 클론 | 좁히기 |
|------|----------|------|--------|
| Section/case counts | `Contains 16 sections and 140 cases` | 없음 | `GET /suites/:id/stats` |
| Estimates bubble | `App.Suites.applyEstimates` | 없음 | estimate/forecast 요약 |
| Edit suite description | `editDescription` | suite settings? | 사이드바 링크 |
| Add Test Case (sidebar) | 큰 버튼 | 트리/툴바 Add | 사이드바 primary CTA |

### 4.5 삭제·버전·편집 (P1)

| 항목 | TestRail | 클론 | 좁히기 |
|------|----------|------|--------|
| Mark as Deleted | soft delete, 복구 가능 | archive? | `is_deleted` + restore from history |
| Delete Permanently | tests/results 제거 | hard delete API 여부 확인 | 2단계 confirm dialog TR 문구 정합 |
| Case history / versions | QPane·history | version API + `ExpandableCaseDetail` | QPane History 탭 |

### 4.6 키보드 (P2)

| 키 | TestRail | 클론 |
|----|----------|------|
| Q | QPane toggle | 패널 열기 (부분) |
| J/K | next/prev case | 미구현 |
| C | add case | Add (부분) |
| S | add section | SectionTree (부분) |
| R | run test | 미구현 |
| E | edit suite description | 미구현 |
| D | push defect | 미구현 |

---

## 5. 좁히기 로드맵 (권장 순서)

### Wave A — 가운데 “저장소 테이블” (P0, 1~2 PR)

1. `SuiteCaseGrid` (또는 `CaseListPane` 리팩터): suite 전체 로드 + **섹션 헤더 행** + 케이스 행.
2. `display` 모드: `tree` \| `subtree` \| `compact` (트리 선택과 연동).
3. `sectionScope: subtree` 기본값; 트리 클릭 시 `group_id` 필터만 변경.
4. URL: `sectionId`, `caseId`, `display`.

**완료 기준:** 트리에서 부모 섹션 선택 시 가운데에 **하위 섹션 포함** 케이스가 섹션별로 묶여 보이고, 행 클릭 시 우측 패널이 열린 채 다음 케이스로 이동 가능.

### Wave B — TestRail식 헤더 (P1, 1 PR)

1. `CaseRepositoryHeader`: Run Test, Reports, Defects, Shared Steps(disabled), Print, Export▼, Import▼, Copy/Move.
2. Defects → 프로젝트 defect plugin URL (`Add Defect` 새 탭).

### Wave C — 툴바 정합 (P1, 1 PR)

1. Columns dialog + width (optional v1: column set only).
2. groupBy / Sort dropdown.
3. Display Deleted toggle.
4. Edit▼ (selected / current view / all in filter).

### Wave D — 사이드바·레이아웃 (P2)

1. 트리를 **우측**으로 이동 (TR parity) 또는 설정으로 좌/우 선택.
2. Suite stats + estimates bubble.
3. Sidebar Add Test Case.

### Wave E — 삭제·키보드·Shared Steps (P2+)

1. Mark deleted / permanent 2단계.
2. J/K/Q/R 단축키.
3. Shared Steps 모듈.

---

## 6. API·데이터 선행

| capability | 제안 |
|------------|------|
| Suite grouped cases | `GET /api/suites/:suiteId/cases?display=subtree&sectionId=&groupBy=section_id` |
| Suite stats | `GET /api/suites/:suiteId/summary` → sectionCount, caseCount, forecast |
| User columns | `preferences.caseColumns[suiteId]` |
| Soft delete | `PATCH cases/:id { isDeleted }` + `displayDeleted` query |

---

## 7. Run execution / Project Overview와의 관계

| 화면 | 중심 질문 | 테이블 형태 |
|------|-----------|-------------|
| **Cases (이 문서)** | 어떤 케이스가 정의돼 있나? | **Suite-wide**, section-grouped |
| [Run execution](./RUN_EXECUTION_VIEW_PARITY.md) | 이번 런에서 뭘 실행했나? | Run tests, section-grouped |
| [Project Overview](./PROJECT_OVERVIEW_VIEW_PARITY.md) | 프로젝트가 최근 어떻게 움직였나? | 차트 + milestones/runs |

Run 생성·케이스 피커는 **이 저장소 워크벤치와 동일한 그리드/트리**를 재사용해야 한다 ([UX_GAP_ANALYSIS](../../UX_GAP_ANALYSIS.md) Run Creation).

---

## 8. 완료 게이트 (Case Repository “TestRail-like”)

- [ ] 가운데 그리드가 **선택 섹션의 subtree(또는 전체 tree)** 를 섹션 헤더와 함께 보여준다.
- [ ] 트리·필터·선택 케이스가 URL에 남는다.
- [ ] 헤더에서 Run Test, Export, Import, Defects(Add)에 도달할 수 있다.
- [ ] Columns / groupBy / Display Deleted가 TestRail과 동등하게 동작한다.
- [ ] QPane(상세 패널)을 닫지 않고 5건 이상 케이스를 열람·편집할 수 있다.
- [ ] 섹션·케이스 DnD가 가능하다.
- [ ] 삭제가 soft(표시)와 permanent로 구분된다.

---

## 9. 클론 코드 앵커

| 역할 | 파일 |
|------|------|
| 워크스페이스 | `apps/web/src/features/cases/components/TestCaseWorkspace.tsx` |
| 섹션 트리 | `SectionTreePane.tsx` |
| 케이스 목록 | `CaseListPane.tsx`, `CaseRow.tsx` |
| 툴바 | `CaseListToolbar.tsx` |
| 상세 패널 | `CaseDetailSidePanel.tsx`, `ExpandableCaseDetail.tsx` |
| 편집 | `CaseEditDrawer.tsx`, `CaseAuthoringForm.tsx` |
| DnD | `hooks/useCaseListDnD.ts` |
| Import/Export | `features/projects/components/ImportExportPage.tsx` |
| 인쇄 | `features/print/.../CasesPrintPage` |

---

## 10. 다음 액션

1. [NEXT_ACTIONS.md](../../NEXT_ACTIONS.md)에 **Case Repository Wave A (suite-grouped grid + display modes)** 를 P0로 추가.
2. [RUN_EXECUTION_VIEW_PARITY.md](./RUN_EXECUTION_VIEW_PARITY.md) Wave A(런 섹션 테이블)와 **공통 `GroupedTestTable` 추출** 검토.
3. Wave A 착수 전 `CaseListPane`의 `sectionScope: "direct"` 하드코딩 제거가 첫 커밋 단위가 되도록 한다.

이 문서는 제공된 HTML 및 `App.Suites.*` 초기화 스크립트를 기준으로 한다.
