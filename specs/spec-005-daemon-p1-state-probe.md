# Spec: daemon — P1 State Probe (머신 상태 점검 + 자동 완료)

## 메타
- **ID**: spec-005-daemon-p1-state-probe
- **Wave**: 2 (track A — daemon)
- **의존성**: spec-001-shared, spec-002-daemon-skeleton, spec-003-daemon-checklist-loader
- **예상 작업 시간**: 3h
- **패키지 경로**: `packages/daemon/`

## 목표
서버 기동 시 1회 머신 상태를 점검하여 이미 완료된 항목(brew/git 설치 등)을 yaml과 매칭해 자동으로 `completed`로 표시한다.

## 입력 (시작 시점에 존재해야 하는 것)
- spec-003 머지 (checklist 로더 동작 + item_states 갱신 가능)
- execa 사용 가능
- yaml의 `verification` 블록이 zod로 파싱된 상태

## 출력 (완료 시점에 존재해야 하는 것)
- `packages/daemon/src/p1-state-probe/index.ts` — `runStateProbe()` export
  - 부팅 시 (또는 `POST /api/state-probe/run` 트리거 시) 모든 항목의 `verification`을 한 번씩 시도
  - 결과가 PASS인 항목은 `item_states.status = 'completed'`, `completed_at = now`로 갱신
  - 실패/UNCLEAR 항목은 상태 변경 없음
- `packages/daemon/src/p1-state-probe/probes.ts`
  - `command` 타입: execa로 명령 실행, exit 0이면 PASS
  - `process_check` 타입: `pgrep <process_name>` PID 반환이면 PASS
- `packages/daemon/src/index.ts` — 부팅 시 `runStateProbe()` 한 번 호출 (마이그레이션 후, 서버 listen 전)
- `packages/daemon/src/routes/state-probe.ts` — `POST /api/state-probe/run` (재실행 트리거)
- `packages/daemon/tests/p1-state-probe.test.ts`
  - mock execa로 brew 설치된 상태 → install-homebrew 자동 completed
  - mock execa exit 1 → 상태 변경 없음
  - 한 번 completed된 항목은 다시 probe 안 함 (idempotent)

## Acceptance Criteria
- [ ] **AC-P1-01 충족**: brew, git 이미 설치 시 두 항목 자동 completed
- [ ] State probe는 daemon 부팅 시 1회 자동 실행 + API로 수동 재실행 가능
- [ ] 이미 `completed`로 표시된 항목은 probe에서 제외 (DB 부하 최소화)
- [ ] AI 동의 여부와 무관하게 동작 (P1은 결정론적 자동화이므로 외부 전송 없음)
- [ ] command/process_check 두 가지 verification 타입만 지원 (Vision verify는 P8 별도)
- [ ] `pnpm test` 통과
- [ ] `pnpm build` 통과
- [ ] `pnpm lint` 에러 0
- [ ] 테스트 커버리지 ≥ 80%
- [ ] BOUNDARIES.md 준수
- [ ] 신규 의존성은 PRD §12 (`execa`)만 추가

## 참고
- PRD §3.1 P1 정의
- PRD §7.2 F-P1-01, F-P1-02
- PRD §10 AC-P1-01
- PRD §11 yaml verification 블록 (install-homebrew, configure-git 예시)

## 비범위 (이 spec에서 하지 않는 것)
- 진행 중 항목 검증 (P4 — SPEC-007과 코드 공유 가능하나 트리거가 다름)
- AI Vision 기반 verify (SPEC-012)
- 항목 시작 후 polling (PRD `poll_interval_sec` — Phase 2)

## 완료 신호
구현이 완료되고 모든 AC가 통과하면 다음 신호를 출력한다.

<promise>SPEC_005_DAEMON_P1_STATE_PROBE_IMPL_DONE</promise>
