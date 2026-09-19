# 완료 UI 항목의 완성도 재검토

검토일: 2026-09-19

대상: [원본 체크리스트](./USABILITY_REALIGNMENT_2026-09-18.md)의 완료 항목 UI-001–UI-019. 실행 순서는 [NEXT_ACTIONS.md](./NEXT_ACTIONS.md)가 관리한다.

## 1. 결론

공통 헤더·툴바·버튼 도입, 파일 트리 형태, 케이스 빠른 입력 등은 의미 있는 개선이다. 그러나 **완료 체크 19개를 실제 사용 흐름 전체의 완성으로 해석하면 안 된다.** 정상 경로와 작은 데이터셋에서는 개선됐지만, 실패 복구·선택 범위·모바일 정보 식별에 빈틈이 있다. 화면도 빈 상태나 보조 작업에서 여전히 불필요한 조작을 먼저 보여준다.

다음 작업은 새 기능을 더 노출하는 것이 아니라 다음 순서로 진행한다.

1. 결과·첨부·선택 대상을 믿을 수 있게 만든다: UI-030, UI-031, UI-032.
2. 이동 대화상자와 섹션별 탐색을 단순하고 예측 가능하게 만든다: UI-025, UI-022–UI-024.
3. 키보드·반응형·중복 조작을 보완하고 Settings 공통화와 통합 검증을 마친다.

UI-001–UI-019의 체크는 과거 납품 이력으로 보존한다. 아래 결함이 해결됐다는 의미는 아니며, 보완은 기존 UI-022–UI-029와 신규 UI-030–UI-036의 **미완료 항목**으로 추적한다. 원본 UX-* 성과 조건은 별도로 충족해야 한다.

## 2. 근거와 한계

- 현재 작업 트리의 관련 컴포넌트·상태 처리·API와 `ux-evidence/UI-001.md`–`UI-019.md`를 대조했다. 기존 사용자 변경사항을 포함한 현재 코드 기준이며, 특정 배포 버전의 인증은 아니다.
- 기존 이동 대화상자, 모바일 케이스 빈 화면, Run 데스크톱/모바일, My Tests 모바일, Plans 빈 허브, Reports 화면 캡처를 재검토했다. **2026-09-18의 역사적 캡처이며 오늘 새로 실행한 브라우저 검증이 아니다.**
- 이번 검토에서 관련 Vitest 16개 파일 / 51개 테스트와 `npm.cmd run lint -w apps/web`가 통과했다. 후자는 웹 TypeScript 검사다. 테스트는 주로 메뉴 모델·선택/피드백 보조 함수이며, 아래 실패 시나리오를 마운트된 화면에서 검증한 것은 아니다.
- 제품 코드와 데이터를 수정하지 않았다. 문서 검토 범위이므로 새 빌드·브라우저 실패 주입·첨부 다운로드 왕복 검증은 수행하지 않았다. 아래 정적 분석 위험은 구현 작업의 첫 회귀 테스트로 재현해야 한다.
- 확인한 테스트: `caseAuthoringDraft`, `sectionTreeModel`, `sectionTreeQuickAdd`, `runExecutionHeaderMenu`, `runSelectionActionBarModel`, `runSelectedTestState`, `resultComposerModel`, `resultSaveFeedback`, `runExecutionDensity`, `runListHeaderMenu`, `myTestsHeaderMenu`, `myTestsQueue`, `milestoneHeaderMenu`, `planHeaderMenu`, `reportHeaderMenu`, `uiDensity`의 `.test.ts`.

## 3. 완료 항목별 판단

‘범위 내 근거 있음’도 모든 환경에서 새로 합격시켰다는 의미는 아니다. 각 근거 링크에는 당시의 검증 조건이 있다.

| 항목 | 유지할 개선 / 기존 근거 | 남은 문제와 완성도 판단 | 후속 |
| --- | --- | --- | --- |
| [UI-001](./ux-evidence/UI-001.md) | 케이스 헤더의 Add Case와 유틸리티 분리 | **보완 필요.** 빈 목록에서는 헤더와 본문에 생성 CTA가 반복된다. 공통 프로젝트 헤더도 작업 영역을 밀어낸다. | UI-027, UI-028 |
| [UI-002](./ux-evidence/UI-002.md) | 검색·Filter/View 정리, 무선택 시 bulk 감춤 | **보완 필요.** 선택 후 edit 경로가 중복되고, View의 표시 방식이 포함 TC 범위까지 바꾼다. | UI-022, UI-024, UI-028 |
| [UI-003](./ux-evidence/UI-003.md) | 제목 최소 폭과 선택적 메타데이터 숨김 | **범위 내 근거 있음.** 긴 제목·실제 섹션 블록 조합까지 통합 회귀로 유지할 것. | UI-021, UI-023 |
| [UI-004](./ux-evidence/UI-004.md) | 좁은 폭 drawer / 넓은 폭 inline, 폭 저장·제한 | **범위 내 근거 있음.** 헤더 유틸리티 밀도와 닫기 후 포커스는 별도 보완 대상. | UI-029, UI-021 |
| [UI-005](./ux-evidence/UI-005.md) | Enter 연속 입력과 재포커스 | **범위 내 근거 있음.** 저장 실패·섹션 변경 중 입력 보존의 통합 회귀는 별도 확인 필요. | UI-021 |
| [UI-006](./ux-evidence/UI-006.md) | 편집기 sticky 저장, dirty 확인, 필드 검증 | **범위 내 근거 있음.** 서버 실패 후 재시도·좁은 화면 긴 내용은 통합 검증에 포함. | UI-021 |
| [UI-007](./ux-evidence/UI-007.md) | 테두리 없는 파일 트리, 상황별 메뉴 | **보완 필요.** 이동 대화상자를 배경 Search/View가 덮는 캡처가 남아 있고, tree 역할에 맞는 방향키·포커스 동작과 root label 연결이 부족하다. | UI-025, UI-026 |
| [UI-008](./ux-evidence/UI-008.md) | Run 헤더 병합, 당시 시작 높이 약 323px 기록 | **증거 보강 필요.** 해당 작업의 캡처가 보존되지 않았다. 기본 섹션 트리·상세 패널 동시 표시에서 다시 측정할 것. | UI-033, UI-021 |
| [UI-009](./ux-evidence/UI-009.md) | 선택 직후 가까운 결과 bar, 2건 bulk 성공 | **보완 필요.** 그룹 목록과 bulk 대상 lookup이 다르며, 전체 선택은 선택 섹션을 전달하지 않는다. 보이는 개수와 실제 대상의 일치가 미보장이다. | UI-032 |
| [UI-010](./ux-evidence/UI-010.md) | Pass & Next 5회 이동, 증거가 필요한 상태는 composer | **통합 회귀 필요.** 6건·groupBy=none 정상 경로 근거는 있으나 필터/그룹·부분 실패 후 이동 조합은 부족하다. | UI-030, UI-021 |
| [UI-011](./ux-evidence/UI-011.md) | 상태·comment·actual·defect·첨부를 한 composer로 통합 | **보완 필요.** History에 파일명이 보인 것이 파일 내용 저장·다운로드의 증거는 아니다. 부분 저장 시 현재 결과와 실패한 파일을 구분해야 한다. | UI-030, UI-031 |
| [UI-012](./ux-evidence/UI-012.md) | 행/패널에 Saving·Saved·Failed·Retry 표시 | **보완 필요.** 재시도가 전역 실패 결과 ID를 재사용하며 새 제출 대상과의 소유권을 확인하지 않는다. 피드백이 실제 저장 범위를 잘못 전달할 수 있다. | UI-030 |
| [UI-013](./ux-evidence/UI-013.md) | 파일별 대기·진행·제거·재시도 | **보완 필요.** 선택 이동 때 업로드 상태가 초기화되고 제거/취소한 파일과 부모 retry payload의 동기화가 부족하다. 로컬 fallback은 바이트 업로드 없이 성공할 수 있다. | UI-030, UI-031 |
| [UI-014](./ux-evidence/UI-014.md) | compact에서 다수 행, 선택의 비색상 표현 | **보완 필요.** 기존 캡처는 상태가 잘리거나 모바일 가로 스크롤 밖에 있다. 행 수가 많아도 결과를 읽기 어려우면 완료 기준으로 부족하다. | UI-033 |
| [UI-015](./ux-evidence/UI-015.md) | Run 목록의 공통 헤더·툴바·단일 Add Run | **범위 내 근거 있음.** 생성·실패·빈 상태와 필터 조합은 통합 회귀 필요. | UI-021 |
| [UI-016](./ux-evidence/UI-016.md) | My Tests 표와 Run 결과 화면 연결 | **보완 필요.** 모바일에서 Run이 사라져 동일 케이스를 구별하기 어렵다. 여러 개 선택 후 Add result는 첫 건만 연다. | UI-034 |
| [UI-017](./ux-evidence/UI-017.md) | Milestones 공통 헤더, 이름 붙은 drawer 필드 | **범위 내 근거 있음.** 정상 생성/취소 중심 근거이므로 서버 실패·재시도와 포커스 복귀는 게이트에서 확인. | UI-021 |
| [UI-018](./ux-evidence/UI-018.md) | Plans 목록/허브의 공통 조작과 단일 생성 | **보완 필요.** entry가 없는 허브에도 Configuration matrix와 사용할 수 없는 저장/생성 명령이 노출된다. | UI-036 |
| [UI-019](./ux-evidence/UI-019.md) | Reports의 긴 링크 띠 제거, export/print 숨김 | **보완 필요.** 같은 이름의 More actions가 서로 다른 역할로 반복된다. 실제 데이터로 저장 뷰 재개·출력 검증도 부족하다. | UI-035 |

## 4. 우선 해결할 흐름의 결함

### P0 / UI-030: 실패한 첨부의 재시도 대상이 현재 테스트와 분리돼 있지 않다

근거: [RunDetailPage.tsx](../apps/web/src/features/runs/components/RunDetailPage.tsx)의 `submitRunResult`(약 554행), `retryStagedAttachment`, 선택 변경 effect와 [ResultEntryPanel.tsx](../apps/web/src/features/runs/components/ResultEntryPanel.tsx)의 제거/취소 처리.

- `failed + createdResultId + stagedItems`이면 기존 결과에 첨부하는 분기로 들어간다. 이 조건에 실패 소유자의 `testId === testId` 검사가 없다.
- 코드 경로상 A 결과 생성 후 첨부 실패 → B로 이동 → B를 파일과 함께 저장하면 A의 결과 ID에 B 파일을 연결하고, B의 새 결과 생성은 건너뛸 수 있다. **실제 브라우저 실패 주입으로 재현한 결과가 아니라 정적 제어 흐름 분석이다.**
- 동일 테스트라도 부분 성공 이후 바꾼 상태/comment를 제출하면 첨부만 재시도하고 변경한 결과 필드를 저장하지 않는 경로가 있다.
- 파일 제거·취소는 composer 로컬 상태를 바꾸지만 부모에 남은 retry payload까지 명시적으로 해제하지 않는다. 선택 이동은 업로드 완료 캐시를 비워 중복 재시도 위험도 만든다.

사용자에게 필요한 것은 새 버튼이 아니라 ‘어느 테스트의 결과는 저장됐고, 어느 파일만 실패했는지’다. 결과 저장과 첨부 재시도를 구분하고, 작업 소유권·폐기·이동 경계를 검증한다. UI에 전역 Saved 한 단어만 보이는 것으로 완료하지 않는다.

### P0 / UI-031: 첨부의 파일명 표시를 실제 파일 저장 성공으로 취급한다

근거: [runApi.ts](../apps/web/src/features/runs/api/runApi.ts)의 `associateResultAttachment`(약 794행), [resultComposerModel.ts](../apps/web/src/features/runs/utils/resultComposerModel.ts)의 `isResultAttachmentPresignUnavailable`, [results.routes.ts](../apps/server/src/modules/results/results.routes.ts)의 presign/attachment fallback.

presign/upload 처리의 404를 광범위하게 잡아 진행률 100%와 `local://results/...` 메타데이터를 만든다. 이 fallback에는 실제 파일 바이트 업로드가 없다. 메모리 모드에서는 presign이 404이고, 다운로드 쪽도 원본 파일 내용을 보존했다는 근거가 없다. 따라서 기존 History 파일명 캡처는 증거파일 보존의 합격 근거가 아니다. 정상 저장소의 presign 경로 전체가 고장났다고 단정하는 것은 아니다.

기존 저장소를 통한 업로드→새로고침→다운로드 내용 일치를 검증한다. 지원하지 않는 환경은 ‘첨부 사용 불가’를 정직하게 알리고, 실제 없는 결과의 404를 성공으로 바꾸지 않는다. 새 저장소 제품 도입은 범위 밖이다.

### P0 / UI-032: 선택한 행과 일괄 결과의 대상 집합이 다를 수 있다

근거: [RunDetailPage.tsx](../apps/web/src/features/runs/components/RunDetailPage.tsx)의 `instanceLookup`, `selectAllMatchingFilter`, `groupedTableQuery`; [useRunBulkActions.ts](../apps/web/src/features/runs/hooks/useRunBulkActions.ts)의 `mutationFn`(약 97행).

표는 그룹 query의 행을 사용할 수 있지만 lookup은 별도 pagedInstances를 누적한다. bulk 제출은 lookup에 없는 선택 ID를 조용히 제거한다. 또한 전체 선택 query에는 sectionId가 없고, 선택 초기화 조건에도 섹션이 빠져 있다. 기본 50건을 넘는 그룹이나 형제 섹션에서 ‘N개 선택’과 실제 저장 대상이 어긋날 위험이다. 기존 2건 테스트는 이를 검증하지 않는다.

60건 이상·형제 섹션 2개 fixture로 개별/페이지/필터 전체 선택과 섹션 전환을 검증한다. 화면의 선택 개수, 제출 ID, 실제 변경 ID가 같아야 한다. 누락 ID는 무시하지 말고 사용자가 복구할 수 있는 상태로 처리한다.

## 5. 단순함 관점에서 남은 화면 문제

| 사용자에게 보이는 문제 | 근거 | 다음 조치 |
| --- | --- | --- |
| 이동할 위치를 읽으려는데 배경 검색창이 대화상자를 덮음 | [기존 이동 화면](./ux-evidence/ui-007-move-1280x720.png), 현재 MoveCopyChooserDialog | UI-025: 공통 modal 계층·포커스 계약 적용 |
| 섹션을 선택했는데 어떤 TC가 포함되는지 예측하기 어려움 | CaseListPane의 `suiteFetchSectionId`가 display와 결합, [이전 분석](./UI_UX_SIMPLICITY_REVIEW_2026-09-18.md) | UI-022/023/024: 조회 범위 → 소유 섹션 블록 → View 정리 순서 |
| Run에서 많은 행은 보이지만 핵심 상태를 바로 읽기 어려움 | [1280 캡처](./ux-evidence/ui-014-after-1280x720.png), [390 캡처](./ux-evidence/ui-014-after-390x844.png) | UI-033: 제목/상태를 보조 메타데이터보다 먼저 보존 |
| My Tests 모바일에서 같은 제목의 테스트 두 개를 구분하기 어려움 | [기존 모바일 표](./ux-evidence/ui-016-after-390x844-table.png), MyTestsPage의 Run 열 숨김 | UI-034: 제목 아래 짧은 Run 문맥, 선택 동작을 실제 기능과 맞춤 |
| Plans가 비어 있는데 설정·생성 명령부터 보임 | [기존 빈 허브](./ux-evidence/ui-018-hub-1280x720.png), PlanDetailPage matrix 상시 렌더 | UI-036: entry 선택 이후에만 설정 조작 노출 |
| Reports에서 같은 More actions 중 어느 쪽을 열어야 할지 모름 | [기존 보고서 화면](./ux-evidence/ui-019-after-1440x1000.png), ReportChrome의 헤더/toolbar 메뉴 | UI-035: 탐색과 현재 보고서 작업의 이름·역할 구분 |

모든 화면에 카드·설명문·툴바를 추가하는 방식으로 해결하지 않는다. 필요한 문맥은 짧은 텍스트로, 드문 기능은 메뉴로, 선택/설정 조작은 대상이 생겼을 때만 보여준다. 파일 트리와 섹션 블록도 테두리 중첩보다 들여쓰기·경로·여백으로 구분한다.

## 6. 다음 실행과 완료 판단

- **Current batch = UI-030 하나.** UI-031 등 인접 결함을 발견해도 한 번에 묶어 구현하지 않는다.
- 기존 UI-020 미진행 원인은 문서의 실행 큐가 UI-019 다음에서 종료되고 ‘No unit is scheduled’로 명시됐기 때문이다. 문서상 기술적 차단이 기록된 상태는 아니었다. 이번 재정렬에서 UI-020도 명시적 후보에 복구한다.
- UI-025와 UI-022–UI-029는 이전에는 ‘검토만, 미예약’이었다. 이번 사용자 요청에 따라 다음 후보로 편성했지만, 이 검토 자체에서는 구현하지 않았다.
- 신규 작업은 원본의 UI-030–UI-036에 각각 범위·완료 조건을 기록했다. 완료 체크는 실패 재현 회귀 테스트, 필요한 화면/네트워크 근거, 범위에 맞는 타입 검사·빌드까지 충족한 후에만 한다.
- UI-021은 마지막 통합 게이트이며 개별 작업의 검증을 나중으로 미루는 이유가 아니다. Test Cases/Run의 세 화면 크기뿐 아니라 공통화한 목록 화면, empty/loading/error/populated 상태, 실제 결과/첨부 보존까지 확인해야 한다.
