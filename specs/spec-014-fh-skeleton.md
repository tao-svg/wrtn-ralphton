# Spec: floating-hint — Electron 스켈레톤 (always-on-top 반투명 윈도우)

## 메타
- **ID**: spec-014-fh-skeleton
- **Wave**: 2 (track B — floating-hint, daemon track과 병렬)
- **의존성**: spec-001-shared
- **예상 작업 시간**: 3h
- **패키지 경로**: `packages/floating-hint/`

## 목표
운영 중 메인 UI인 Electron always-on-top 반투명 윈도우의 빈 스켈레톤을 만들어 후속 spec이 UI/오버레이만 추가하면 동작하도록 한다.

## 입력 (시작 시점에 존재해야 하는 것)
- spec-001 머지 (`@onboarding/shared` 사용 가능)
- pnpm workspaces 활성

## 출력 (완료 시점에 존재해야 하는 것)
- `packages/floating-hint/package.json` (name: `@onboarding/floating-hint`, main: `dist/main/index.js`)
- `packages/floating-hint/tsconfig.json` (main + renderer 분리 빌드)
- `packages/floating-hint/src/main/index.ts` — Electron app entry
  - `BrowserWindow` 옵션:
    - `alwaysOnTop: true` (with level `'floating'`)
    - `frame: false`, `transparent: true`, `backgroundColor: '#00000000'`
    - `focusable: false` (입력 비탈취) — F-P5PP-01
    - `width: 360`, `height: 200` (PRD §5 시나리오 박스 크기 기준)
    - 우측 하단 위치 (디스플레이 working area 기준 16px 마진)
- `packages/floating-hint/src/main/daemon-client.ts` — daemon HTTP API 호출 wrapper (fetch 기반, baseUrl `http://localhost:7777`)
- `packages/floating-hint/src/renderer/index.html` — 빈 컨테이너 + CSS 반투명 배경(rgba(20,20,30,0.85)) + 둥근 모서리
- `packages/floating-hint/src/renderer/index.tsx` — 최소 React 마운트 ("Hint Window 준비됨" placeholder)
- `packages/floating-hint/src/preload/index.ts` — contextBridge로 daemon-client 노출
- 빌드 스크립트: `pnpm --filter @onboarding/floating-hint dev` (electron .)
- `packages/floating-hint/tests/main.smoke.test.ts` — Electron app 부팅 후 윈도우 생성 단언 (electron mock 또는 spectron 대체)

## Acceptance Criteria
- [ ] **F-P5PP-01 충족**: 윈도우가 always-on-top, 반투명, focusable=false
- [ ] **AC-VIS-09 부분 충족**: 윈도우 떠 있어도 외부 앱(시스템 환경설정 등) 클릭/타이핑이 정상 전달 (수동 검증 + focusable=false 단언)
- [ ] 우측 하단 16px 마진에 자동 배치, 다중 모니터 시 primary display 기준
- [ ] preload는 contextBridge로만 daemon-client 노출 (nodeIntegration: false, contextIsolation: true)
- [ ] 비-macOS에서 부팅 시 명시적 안내 + 종료 코드 1
- [ ] `pnpm --filter @onboarding/floating-hint test` 통과
- [ ] `pnpm --filter @onboarding/floating-hint build` 통과 (main + renderer 둘 다 dist 생성)
- [ ] `pnpm --filter @onboarding/floating-hint lint` 에러 0
- [ ] 테스트 커버리지 ≥ 80% (main process 헬퍼 함수 한정 — Electron 부팅 단언은 smoke로 대체)
- [ ] BOUNDARIES.md 준수
- [ ] 신규 의존성은 PRD §12 (`electron`, `vitest`)만 추가

## 참고
- PRD §6.2 C (Floating Hint Window)
- PRD §7.6 F-P5PP-01
- PRD §10 AC-VIS-09
- PRD §3.1 P5++
- PRD §5 김하나 시나리오 (윈도우 외형)

## 비범위 (이 spec에서 하지 않는 것)
- 두 버튼 + AI 응답 표시 (SPEC-015)
- 빨간 박스 오버레이 (SPEC-016)
- daemon API 실제 호출 흐름 (SPEC-015에서 통합)
- 자동 기동 (CLI에서 트리거 — SPEC-013)
- 코드 서명 / notarization (Phase 2)

## 완료 신호
구현이 완료되고 모든 AC가 통과하면 다음 신호를 출력한다.

<promise>SPEC_014_FH_SKELETON_IMPL_DONE</promise>
