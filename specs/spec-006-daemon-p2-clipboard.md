# Spec: daemon — P2 Clipboard Inject

## 메타
- **ID**: spec-006-daemon-p2-clipboard
- **Wave**: 2 (track A — daemon)
- **의존성**: spec-001-shared, spec-002-daemon-skeleton
- **예상 작업 시간**: 2h
- **패키지 경로**: `packages/daemon/`

## 목표
체크리스트 항목의 정의된 명령어를 macOS 시스템 클립보드에 복사하여 사용자가 터미널에서 ⌘V 한 번으로 실행하도록 한다.

## 입력 (시작 시점에 존재해야 하는 것)
- spec-002 머지 (Express 서버)
- `@onboarding/shared`의 `ClipboardInject` 타입 + clipboard API 스키마

## 출력 (완료 시점에 존재해야 하는 것)
- `packages/daemon/src/p2-clipboard/index.ts` — `copyToClipboard(text: string): Promise<void>`
  - macOS: execa로 `pbcopy` stdin 주입
  - 비-macOS: throw `unsupported_platform`
- `packages/daemon/src/routes/clipboard.ts`
  - `POST /api/clipboard` (PRD §9.1.7) — body: `{ command: string }`
  - zod 검증: command 비어있지 않은 문자열, 최대 32KB
  - 성공: `{ ok: true }`
- `packages/daemon/src/routes/index.ts` — clipboard 라우터 등록
- `packages/daemon/tests/p2-clipboard.test.ts`
  - mock execa: pbcopy 호출 + stdin payload 검증
  - 빈 문자열 → 400
  - 비-macOS 시뮬레이션 → 500 unsupported_platform

## Acceptance Criteria
- [ ] **AC-P2-01 충족**: `POST /api/clipboard { command: "echo hi" }` 후 사용자가 ⌘V 시 "echo hi" 붙여넣기 가능 (수동 검증 가능 + execa stdin 단언)
- [ ] PRD §11 항목 yaml의 `clipboard_inject.command` 템플릿 변수(`{{inputs.git_email}}` 등)는 호출자가 이미 치환해서 보내는 책임 — 본 spec은 raw text만 처리
- [ ] 응답 시간 < 200ms (pbcopy 자체가 빠름)
- [ ] 32KB 초과 payload → 413 `payload_too_large`
- [ ] `pnpm test` 통과
- [ ] `pnpm build` 통과
- [ ] `pnpm lint` 에러 0
- [ ] 테스트 커버리지 ≥ 80%
- [ ] BOUNDARIES.md 준수
- [ ] 신규 의존성 없음 (execa는 spec-005에서 도입됨)

## 참고
- PRD §3.1 P2
- PRD §7.3 F-P2-01, F-P2-02
- PRD §10 AC-P2-01
- PRD §9.1.7 clipboard API
- PRD §11 clipboard_inject 블록

## 비범위 (이 spec에서 하지 않는 것)
- 템플릿 변수(`{{inputs.git_email}}`) 치환 — 호출자(Floating Hint UI 또는 별도 항목 진입 핸들러)가 처리
- ui_hint 표시 (Floating Hint UI — SPEC-015)
- 클립보드 복원 / 자동 비우기 (보안 강화는 Phase 2)

## 완료 신호
구현이 완료되고 모든 AC가 통과하면 다음 신호를 출력한다.

<promise>SPEC_006_DAEMON_P2_CLIPBOARD_IMPL_DONE</promise>
