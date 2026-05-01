# Spec: daemon — P5+ System Panel Launch (URL 스킴)

## 메타
- **ID**: spec-008-daemon-p5-system-panel
- **Wave**: 2 (track A — daemon)
- **의존성**: spec-001-shared, spec-002-daemon-skeleton, spec-003-daemon-checklist-loader
- **예상 작업 시간**: 2h
- **패키지 경로**: `packages/daemon/`

## 목표
yaml의 `system_panel_url` 필드에 정의된 URL 스킴을 macOS `open`으로 실행하여 사용자가 시스템 환경설정 패널까지 자동으로 진입하게 한다.

## 입력 (시작 시점에 존재해야 하는 것)
- spec-003 머지 (yaml에서 step 객체에 `system_panel_url` 접근 가능)
- execa 사용 가능 (spec-005에서 도입)

## 출력 (완료 시점에 존재해야 하는 것)
- `packages/daemon/src/p5-system-panel/index.ts` — `launchSystemPanel(url: string)`
  - 허용 prefix만 통과: `x-apple.systempreferences:`, `https://`, `file://` (보안: 임의 URL 실행 방지)
  - macOS: `execa('open', [url])`
  - 비-macOS: throw `unsupported_platform`
- `packages/daemon/src/routes/system-panel.ts`
  - `POST /api/system-panel/launch` — body: `{ url }` 또는 `{ item_id, step_id }` (yaml 조회)
  - zod 검증: 둘 중 하나는 반드시 제공
- `packages/daemon/tests/p5-system-panel.test.ts`
  - mock execa: x-apple.systempreferences URL → open 호출 단언
  - 허용되지 않는 prefix(`file:///etc/passwd`는 허용, `javascript:` 등 차단) → 400
  - yaml step 조회 형태로 호출 시 system_panel_url 자동 사용

## Acceptance Criteria
- [ ] **AC-P5P-01 충족**: `system_panel_url: "x-apple.systempreferences:com.apple.preference.security"` 호출 → 시스템 환경설정 보안 패널 자동 오픈 (수동 + execa 단언)
- [ ] PRD §11 install-security-agent의 grant_permission, setup-vpn의 install_profile step에서 사용 가능
- [ ] URL allowlist: `x-apple.systempreferences:`, `https://`, `file://` 만 허용
- [ ] yaml에 system_panel_url 없는 step에 대한 호출 → 400 `panel_url_not_defined`
- [ ] `pnpm test` 통과
- [ ] `pnpm build` 통과
- [ ] `pnpm lint` 에러 0
- [ ] 테스트 커버리지 ≥ 80%
- [ ] BOUNDARIES.md 준수
- [ ] 신규 의존성 없음

## 참고
- PRD §3.1 P5+
- PRD §7.5 F-P5P-01, F-P5P-02
- PRD §10 AC-P5P-01
- PRD §11 install-security-agent.grant_permission (URL 스킴 예시)
- PRD §14 (보안: 임의 URL 차단)

## 비범위 (이 spec에서 하지 않는 것)
- 패널 진입 후 사용자 행동 안내 (P8 Vision Coach — SPEC-012)
- macOS Accessibility API 직접 클릭 자동화 (PRD §4 Out of Scope)
- 패널 진입 검증 (P4 process_check 등으로 별도 검증)

## 완료 신호
구현이 완료되고 모든 AC가 통과하면 다음 신호를 출력한다.

<promise>SPEC_008_DAEMON_P5_SYSTEM_PANEL_IMPL_DONE</promise>
