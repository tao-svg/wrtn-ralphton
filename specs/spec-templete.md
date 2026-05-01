# Spec: [작업명]

## 메타
- ID: spec-NNN-name
- Wave: 1 또는 2
- 의존성: 다른 spec ID (있으면)
- 예상 작업 시간: N시간
- 패키지 경로: packages/[name]/

## 목표
[한 문장으로 무엇을 만드는지]

## 입력 (시작 시점에 존재해야 하는 것)
- 어떤 spec이 머지된 상태여야 하는지
- 어떤 라이브러리가 사용 가능해야 하는지

## 출력 (완료 시점에 존재해야 하는 것)
- 생성될 파일 경로 목록
- 통과해야 할 테스트

## Acceptance Criteria
- [ ] AC-XXX-NN: PRD 어느 AC와 매핑되는지
- [ ] pnpm test, pnpm build, pnpm lint 모두 통과

## 참고
- PRD docs/PRD.md §X (관련 섹션)
- BOUNDARIES.md 준수

## 완료 신호
<promise>SPEC_NNN_NAME_IMPL_DONE</promise>