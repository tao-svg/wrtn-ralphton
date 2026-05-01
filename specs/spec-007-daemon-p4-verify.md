# Spec: daemon — P4 Auto Verify (command + process_check)

## 메타
- **ID**: spec-007-daemon-p4-verify
- **Wave**: 2 (track A — daemon)
- **의존성**: spec-001-shared, spec-002-daemon-skeleton, spec-003-daemon-checklist-loader
- **예상 작업 시간**: 3h
- **패키지 경로**: `packages/daemon/`

## 목표
yaml에 정의된 결정론적 검증(`command` shell 실행 / `process_check` pgrep)을 사용자 요청 시 실행하여 항목 완료를 객관적으로 판정한다.

## 입력 (시작 시점에 존재해야 하는 것)
- spec-003 머지 (체크리스트 로더 + item_states 관리)
- spec-005 probes.ts 코드 재사용 가능 (P1과 P4는 검증 로직 공유, 트리거만 다름)

## 출력 (완료 시점에 존재해야 하는 것)
- `packages/daemon/src/p4-verify/index.ts` — `runVerify(itemId): Promise<VerifyResult>`
  - yaml의 해당 item.verification 블록 로드
  - `command` 타입: execa exec 후 exit code 0 + (옵션 `expect_contains`) stdout 매칭
  - `process_check` 타입: `pgrep <process_name>` PID 반환이면 PASS
  - 결과: `{ status: 'pass'|'fail', details: string }`
- `packages/daemon/src/routes/verify.ts`
  - `POST /api/verify/run` (PRD §9.1.8) — body: `{ item_id, verification? }`
  - body의 verification이 명시되면 사용, 없으면 yaml 기본값
  - 결과 PASS: `item_states.status = 'completed'`, `completed_at = now`
  - 결과 FAIL: 상태 유지 + `attempt_count` 증가
- `packages/daemon/tests/p4-verify.test.ts`
  - command exit 0 → pass + completed
  - command exit 1 → fail + attempt 증가
  - process_check pgrep 반환 → pass
  - process_check pgrep no match → fail
  - expect_contains 미스매치 → fail with details

## Acceptance Criteria
- [ ] **AC-P4-01 충족**: `verification.command: "brew --version"` exit 0 → PASS, 0이 아니면 FAIL
- [ ] PRD §11의 모든 verification 형태(command + expect_contains, process_check)를 처리
- [ ] FAIL 시 `details`에 stdout 일부(최대 1KB) + exit code 포함하여 디버깅 가능
- [ ] command 실행 timeout 30초 (그 이상은 FAIL with `timeout`)
- [ ] PASS 시 SQLite item_states 자동 갱신, attempt_count도 +1
- [ ] `pnpm test` 통과
- [ ] `pnpm build` 통과
- [ ] `pnpm lint` 에러 0
- [ ] 테스트 커버리지 ≥ 80%
- [ ] BOUNDARIES.md 준수
- [ ] 신규 의존성 없음

## 참고
- PRD §3.1 P4
- PRD §7.4 F-P4-01~03
- PRD §10 AC-P4-01
- PRD §9.1.8 verify API
- PRD §11 verification 블록 (5개 항목 모두 사용)
- spec-005-daemon-p1-state-probe (probes 로직 재사용)

## 비범위 (이 spec에서 하지 않는 것)
- AI Vision 기반 verify (SPEC-012 P8 verify)
- 자동 polling (PRD `poll_interval_sec` — Phase 2)
- 부팅 시 1회 실행 (P1 — SPEC-005)

## 완료 신호
구현이 완료되고 모든 AC가 통과하면 다음 신호를 출력한다.

<promise>SPEC_007_DAEMON_P4_VERIFY_IMPL_DONE</promise>
