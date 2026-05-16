# Next Actions

Last aligned: 2026-05-16

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
- [ ] **TR-Pro** P1 `/api/v2` list endpoint pagination (`limit`/`offset`, response envelope) on high-traffic list routes (cases, runs, tests, results).
```

### Scope (only what closes the line above)

1. Inventory list-style `/api/v2` routes that still return unpaginated full arrays.
2. Add TestRail-style `limit`/`offset` (or agreed envelope) + document in `API_SPEC.md` / `testrail.supported.ts`.
3. Contract tests for at least cases and runs (and tests/results if in scope of the line).

### Out of scope for this batch

- Token scopes, new v2 resources, UI work — other checklist lines.
- Bumping the large “Expanded `/api/v2`” line except removing pagination from its remaining partial note after this line ships.

---

## Next batch candidates

다음 **Current batch**는 아래에서 **`[ ]` 한 줄만** 고른다 (복사해서 Current batch에 붙인다).

| Suggested order | Section | Checklist line |
|-----------------|---------|----------------|
| 1 | Product Foundation | `- [ ] **TR-Core** P1 Global default access model.` |
| 2 | Test Case Management | `- [ ] **TR-Core** P1 **References** field: comma-separated external IDs, View Reference URLs, autocomplete issue picker when integration active ([Reference integrations](https://support.testrail.com/hc/en-us/articles/7747333895700)).` |
| 3 | Run Composition And Execution | `- [ ] **TR-Core** P1 Run **start date** and **end date** (optional, editable while active, milestone inheritance, plan/milestone warnings, manual complete — not auto-close on date). (partial: …)` — *finish remaining partial only; then `[x]`.* |
| 4 | Import And Export | `- [ ] **TR-Core** P1 Mapping-driven import/export UX and richer validation guidance.` |
| 5 | Automation And API Compatibility | `- [ ] **TR-Core** P1 Token scopes and expiration enforcement.` |

항목이 한 PR에 넘치면 **FEATURE_CHECKLIST에서 `[ ]`를 먼저 쪼갠다**. 쪼개기 전에는 NEXT_ACTIONS에 임의 주제를 쓰지 않는다.
