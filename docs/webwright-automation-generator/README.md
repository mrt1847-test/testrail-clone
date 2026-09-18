# Webwright Automation Generator Docs

Last aligned: 2026-05-30

이 디렉터리는 별도 프로젝트로 만들 `webwright-automation-generator`의 제품/기술 설계 문서입니다. `testrail-clone`은 테스트 관리 시스템으로 남고, generator는 Webwright를 이용해 별도의 테스트 자동화 프로젝트를 생성·갱신하는 도구로 설계합니다.

## 핵심 방향

```text
testrail-clone
  -> case export / API
webwright-automation-generator
  -> raw Webwright run
  -> action extraction
  -> normalized flow/script
  -> generated automation project
generated automation project
  -> CI execution
  -> POST /api/automation/results/bulk
testrail-clone
  -> result / coverage / report
```

중요한 결정:

- `testrail-clone`은 자동화 코드를 직접 소유하거나 실행하지 않는다.
- `webwright-automation-generator`는 자동화 프로젝트를 만들어주는 개발 도구다.
- `generated automation project`가 실제 테스트 코드, helper, fixture, CI 실행을 소유한다.
- `testrail-clone`과의 연결은 API token, `automationKey`, bulk result upload로 제한한다.
- Webwright raw `final_script.py`는 최종 산출물이 아니라 구조화의 재료다.

## 문서 목록

- [PRODUCT_SPEC.md](./PRODUCT_SPEC.md): 목표, 사용자, 범위, 워크플로, 산출물.
- [ARCHITECTURE.md](./ARCHITECTURE.md): 시스템 경계, 모듈 구조, 생성 파이프라인, generated project 구조.
- [API_SPEC.md](./API_SPEC.md): CLI/API 계약, 설정 파일, testrail-clone 연동, artifact schema.
- [UX_DESIGN.md](./UX_DESIGN.md): CLI UX, review UX, 생성된 프로젝트의 개발자 경험.

## 용어

| 용어 | 의미 |
|------|------|
| `testrail-clone` | TestCase, TestRun, TestResult, automation API를 제공하는 테스트 관리 앱 |
| `webwright-automation-generator` | TC/natural language를 입력받아 자동화 프로젝트를 생성·갱신하는 별도 도구 |
| `generated automation project` | generator가 만든 실제 테스트 코드 repo/project |
| raw script | Webwright가 만든 자유형 `final_script.py` |
| action list | raw script/trajectory에서 추출한 `goto`, `click`, `fill`, `assert` 등 행동 목록 |
| normalized flow | action list를 공통 helper와 도메인 단계로 정규화한 DSL |
| structured script | normalized flow에서 생성된 유지보수 가능한 테스트 코드 |
