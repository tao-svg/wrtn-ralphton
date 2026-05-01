# Spec: daemon — `onboarding` CLI + install.sh + 권한 가이드

## 메타
- **ID**: spec-013-daemon-cli-install
- **Wave**: 2 (track A — daemon)
- **의존성**: spec-001-shared, spec-002-daemon-skeleton, spec-003-daemon-checklist-loader, spec-004-daemon-consents
- **예상 작업 시간**: 4h
- **패키지 경로**: `packages/daemon/`

## 목표
`curl ... | sh` 한 줄 설치 + `onboarding {start|status|stop|reset}` CLI를 제공해 입사자가 명령 한 번으로 데몬을 기동하고 권한·동의 가이드를 받도록 한다.

## 입력 (시작 시점에 존재해야 하는 것)
- spec-002 (Express 서버), spec-004 (consents API) 머지
- daemon HTTP API 동작 확인 가능

## 출력 (완료 시점에 존재해야 하는 것)
- `packages/daemon/src/cli/index.ts` — commander 진입점
  - `onboarding start` — 데몬 데몬화(detached spawn) + Floating Hint 자동 기동(SPEC-014가 머지된 후 동작) + 첫 실행 시 권한/동의 위저드
  - `onboarding status` — `GET /api/checklist`, `GET /api/consents`, `GET /api/vision/rate-limit` 호출해 ora 스피너 + picocolors로 출력
  - `onboarding stop` — pidfile(`~/.onboarding/daemon.pid`) 기반으로 SIGTERM
  - `onboarding reset` — 확인 프롬프트 후 SQLite 파일 삭제 + consents 재요청
- `packages/daemon/src/cli/wizard.ts` — 첫 실행 위저드
  - @inquirer/prompts: 이름/이메일/직무/전화 입력 → SQLite profile에 저장
  - Anthropic 전송 동의 확인 (POST /api/consents)
  - Screen Recording 권한 안내: macOS 설정 패널 자동 진입 (SPEC-008 활용) + 사용자 ENTER 대기 후 권한 재확인
- `packages/daemon/package.json` — `bin: { "onboarding": "./dist/cli/index.js" }`
- `scripts/install.sh` (모노레포 루트)
  - Node 22 설치 확인 (없으면 안내)
  - 최신 release tarball 다운로드 → `~/.onboarding/`에 압축 해제
  - 심볼릭 링크 `/usr/local/bin/onboarding` 생성 (sudo 안내)
  - 마지막에 `onboarding start` 자동 실행 안내
- `packages/daemon/tests/cli-status.test.ts`
  - mock fetch로 daemon API 응답 → status 출력 단언
- `packages/daemon/tests/cli-wizard.test.ts`
  - inquirer 모킹 → consents/profile API 호출 단언

## Acceptance Criteria
- [ ] **AC-CORE-01 충족**: `curl ... | sh` 후 `onboarding start` → 데몬 + (가능 시) Floating Hint 기동, Screen Recording 가이드 표시
- [ ] **AC-CORE-02 충족**: 첫 실행 위저드에서 동의 클릭 → SQLite consents 기록, 다음 실행 시 위저드 스킵
- [ ] `onboarding stop` 후 같은 명령 재실행 시 "데몬이 실행 중이지 않음" 명시
- [ ] `onboarding reset`은 `--yes` 플래그 없으면 confirm 프롬프트 강제
- [ ] install.sh는 macOS 외 OS에서 명시적 에러 + 종료 코드 1
- [ ] CLI 출력 한국어 (PRD §4 한국어 단일)
- [ ] `pnpm test` 통과
- [ ] `pnpm build` 통과 (cli도 dist에 emit)
- [ ] `pnpm lint` 에러 0
- [ ] 테스트 커버리지 ≥ 80%
- [ ] BOUNDARIES.md 준수
- [ ] 신규 의존성은 PRD §12 (`commander`, `@inquirer/prompts`, `picocolors`, `ora`)만 추가

## 참고
- PRD §6.2 A (CLI 컴포넌트)
- PRD §7.1 F-CORE-01, F-CORE-02, F-CORE-05
- PRD §10 AC-CORE-01, AC-CORE-02
- PRD §5.1 김하나 시나리오 10:00~10:05 (curl 한 줄 + 위저드)
- PRD §12 (commander, inquirer 등)

## 비범위 (이 spec에서 하지 않는 것)
- Node SEA 단일 바이너리 빌드 (Phase 2 — install.sh tarball로 충분)
- Floating Hint 자동 기동 구현 자체 (SPEC-014/015가 노출하는 entry point를 호출만, 미머지 시 스킵 + 안내)
- AppleScript Accessibility 자동화 (Out of Scope)
- 자동 업데이트 메커니즘 (Phase 2)

## 완료 신호
구현이 완료되고 모든 AC가 통과하면 다음 신호를 출력한다.

<promise>SPEC_013_DAEMON_CLI_INSTALL_IMPL_DONE</promise>
