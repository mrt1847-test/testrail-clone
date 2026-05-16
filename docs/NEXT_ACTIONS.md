# Next Actions

Last aligned: 2026-05-17

**역할:** 다음 1–2 PR 분량. 방향은 [ROADMAP.md](./ROADMAP.md). **진행률은 [FEATURE_CHECKLIST.md](./FEATURE_CHECKLIST.md)의 `[ ]` → `[x]` 한 줄**로만 잰다.

**루프**

1. 아래 **Current batch**의 체크리스트 **한 줄**만 구현한다.
2. 그 줄만 `[x]`로 바꾸고 `(…)`에 이번에 실은 범위를 적는다.
3. **새 체크리스트 줄을 만들지 않는다** (이미 `[x]`인 덩어리에 대한 폴리시는 해당 줄 괄호 보강 또는, 먼저 checklist에서 `[ ]`로 쪼갠 뒤 배치).
4. **Next batch candidates**에서 다음 `[ ]` 한 줄을 골라 **Current batch**를 통째로 교체한다.

---

## Current batch

**Section:** Automation And API Compatibility

**Checklist line (exact — done when this is `[x]`):**

```text
- [ ] **TR-Pro** P2 BDD/Gherkin scenarios, scenario-level execution, `.feature` import/export and BDD API ([BDD](https://support.testrail.com/hc/en-us/articles/7827238336916-Behavior-Driven-Development-BDD)).
```

### Scope (only what closes the line above)

1. BDD/Gherkin scenario fields on cases and scenario-level execution in runs.
2. `.feature` import/export and BDD-oriented API surface aligned with TestRail BDD docs.

### Out of scope for this batch

- Full TestRail BDD Cloud parity (datasets, variables, cross-project BDD reports).
- Unrelated case template or automation mapping changes.

---

## Next batch candidates

다음 **Current batch**는 아래에서 **`[ ]` 한 줄만** 고른다 (복사해서 Current batch에 붙인다).

| Suggested order | Section | Checklist line |
|-----------------|---------|----------------|
| 1 | Test Case Management | `- [ ] **TR-Core** P1 Baseline branches (copy from master suite without affecting master).` |

항목이 한 PR에 넘치면 **FEATURE_CHECKLIST에서 `[ ]`를 먼저 쪼갠다**. 쪼개기 전에는 NEXT_ACTIONS에 임의 주제를 쓰지 않는다.
