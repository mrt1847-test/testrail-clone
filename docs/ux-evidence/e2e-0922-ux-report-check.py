from pathlib import Path
import re,json
p=Path('docs/E2E_FUNCTIONAL_EVIDENCE_2026-09-21.md');t=p.read_text(encoding='utf-8');t=t.replace('# 테스트 관리 도구 E2E 사용성 검토 — 2026-09-21','# E2E 기능·저장·복구 검증 보조 기록 — 2026-09-21',1);t=t.replace('실제 검증: 2026-09-21 KST.','이 문서는 최초 기능 중심 검토의 증거를 보존한 보조 기록이다. **최종 UI/UX 판단과 우선순위는 [UI/UX 검토 본문](./E2E_USABILITY_REVIEW_2026-09-21.md)을 따른다.** 아래 기능 pass를 사용성 합격으로 해석하지 않는다.\n\n실제 검증: 2026-09-21 KST.',1);p.write_text(t,encoding='utf-8')
checks=[]
for p in [Path('docs/E2E_USABILITY_REVIEW_2026-09-21.md'),Path('docs/E2E_FUNCTIONAL_EVIDENCE_2026-09-21.md')]:
 t=p.read_text(encoding='utf-8-sig');bad=[x for x in re.findall(r'\]\(([^)]+)\)',t) if not x.startswith(('http:','https:','#')) and not (p.parent/x).exists()];checks.append({'file':str(p),'lines':len(t.splitlines()),'missingLinks':bad});assert not bad
print(json.dumps(checks,indent=2));Path('docs/ux-evidence/e2e-0922-ux-report-check.json').write_text(json.dumps(checks,indent=2))
