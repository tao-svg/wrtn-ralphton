# Spec: <작업명>

## 메타
- **ID**: spec-NNN-<slug>
- **Wave**: <1 | 2 | 3 | 4 | 5>
- **의존성**: <spec-NNN, ... 또는 "없음">
- **예상 작업 시간**: <N>h (4h 이내)
- **패키지 경로**: packages/<package>/

## 목표
한 문장으로 이 spec이 만드는 것을 기술한다.

## 입력 (시작 시점에 존재해야 하는 것)
- 선행 spec 머지 완료 (예: spec-001-shared-core-types)
- 사용 가능한 패키지/타입/스키마
- 필요한 환경 변수 / 외부 API 키

## 출력 (완료 시점에 존재해야 하는 것)
- `packages/<package>/src/...` (구현 파일)
- `packages/<package>/tests/...` (테스트 파일, 커버리지 80%+)
- 필요 시 `packages/<package>/package.json` 의존성 추가 (PRD §19 카탈로그 한정)

## Acceptance Criteria
PRD §11에 정의된 시나리오 중 본 spec이 책임지는 항목을 체크박스로 나열.

- [ ] AC-XXX-NN: Given-When-Then 시나리오 충족 (검증 위치 명시)
- [ ] `pnpm test` 통과
- [ ] `pnpm build` 통과
- [ ] `pnpm lint` 에러 0
- [ ] 테스트 커버리지 ≥ 80%
- [ ] BOUNDARIES.md 준수 (spec 외 패키지 미수정)
- [ ] 신규 의존성은 PRD §19 카탈로그 내에서만 사용

## 참고
- PRD §X.Y (관련 섹션 제목)
- 데이터 모델: PRD §8
- API 계약: PRD §9
- 라이브러리: PRD §19.X
- BOUNDARIES.md

## 비범위 (이 spec에서 하지 않는 것)
- 다른 spec이 책임지는 영역 (명시적으로 나열)

## 완료 신호
구현이 완료되고 모든 AC가 통과하면 다음 신호를 출력한다.

<promise>SPEC_NNN_IMPL_DONE</promise>
