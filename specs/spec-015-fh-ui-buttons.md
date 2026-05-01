# Spec: floating-hint — 두 버튼 UI + AI 응답 표시 + 진행률 + 재시도

## 메타
- **ID**: spec-015-fh-ui-buttons
- **Wave**: 2 (track B — floating-hint)
- **의존성**: spec-001-shared, spec-014-fh-skeleton
- **예상 작업 시간**: 4h
- **패키지 경로**: `packages/floating-hint/`

## 목표
Floating Hint Window에 [📋 안내 요청] / [✓ 진행 확인] 두 버튼, AI 응답 텍스트 영역, 단계 진행률 미니 표시, 에러 시 [🔄 재시도] 버튼을 구현하여 운영 중 메인 UI를 완성한다.

## 입력 (시작 시점에 존재해야 하는 것)
- spec-014 머지 (Electron 윈도우 부팅, daemon-client preload 노출)
- daemon API는 dev 단계에서 mock 또는 실제 SPEC-012 머지 후 통합

## 출력 (완료 시점에 존재해야 하는 것)
- `packages/floating-hint/src/renderer/components/`
  - `HintWindow.tsx` — 최상위 컴포넌트, 현재 item/step 컨텍스트 + 응답 상태 머신 (idle/loading/showing-guide/showing-verify/error)
  - `ProgressBadge.tsx` — "단계 2/3" 표시 (F-P5PP-06)
  - `ActionButtons.tsx` — `[📋 안내 요청]` / `[✓ 진행 확인]` 버튼 (F-P5PP-02)
  - `ResponsePanel.tsx` — AI 메시지 텍스트 + confidence 라벨 (F-P5PP-03)
  - `RetryBanner.tsx` — 503/429-throttled 상황에서 [🔄 재시도] 표시 (F-P5PP-05, AC-VIS-06)
  - `RatePausedBanner.tsx` — 429-paused 시 "다음 시간대까지 정지" + reset_at 카운트다운
  - `ConsentBlocker.tsx` — 403 consent_required / 401 screen_recording 시 안내 + 설정 진입 버튼
- `packages/floating-hint/src/renderer/state/store.ts` — Zustand 또는 React useReducer (단순 store)
  - 현재 item/step poll: 5초마다 `GET /api/checklist`로 sync
- `packages/floating-hint/src/renderer/api.ts` — preload exposed daemon-client wrapping
  - `requestGuide()`, `requestVerify()`, `getRateLimit()`, `getConsents()`
- `packages/floating-hint/tests/components/*.test.tsx` — 각 컴포넌트 단위 테스트 (vitest + @testing-library/react)
- `packages/floating-hint/tests/state.test.ts` — 응답 상태 머신 전이 (idle → loading → showing-guide / error)

## Acceptance Criteria
- [ ] **F-P5PP-02 충족**: 두 버튼 가시성 + 클릭 시 각각 `/api/vision/guide`, `/api/vision/verify` POST
- [ ] **F-P5PP-03 충족**: 응답 message 텍스트가 윈도우에 표시 (긴 텍스트는 스크롤)
- [ ] **F-P5PP-05 충족**: 503 응답 시 [🔄 재시도] 버튼 노출, 클릭 시 동일 요청 재전송
- [ ] **F-P5PP-06 충족**: 현재 step의 인덱스/총 개수 미니 표시 (예: "단계 2/3")
- [ ] **AC-VIS-06 충족 (UI 측)**: API 실패 503 → RetryBanner 즉시 표시
- [ ] 429-paused → RatePausedBanner + reset_at 카운트다운 (1초 단위 갱신)
- [ ] 403 consent_required → ConsentBlocker + 설정 진입 버튼 (CLI 위저드 재실행 안내)
- [ ] verify 응답이 pass면 자동으로 다음 step/item으로 컨텍스트 갱신, fail이면 next_action_hint를 ResponsePanel에 표시
- [ ] 로딩 중 버튼 disabled + 스피너
- [ ] `pnpm test` 통과
- [ ] `pnpm build` 통과
- [ ] `pnpm lint` 에러 0
- [ ] 테스트 커버리지 ≥ 80%
- [ ] BOUNDARIES.md 준수
- [ ] 신규 의존성은 PRD §12 카탈로그 + React 생태계 합의 범위 (`react`, `react-dom`, `zustand` — PRD §12에 React 명시 없음, **추가 전 PRD 개정 필요**)
  - **결정**: PRD §12에는 React 미등재. 본 spec은 vanilla TS + lit-html 또는 순수 DOM으로 구현하여 카탈로그 무위반 (Phase 2 React 도입 제안)

## 참고
- PRD §6.2 C
- PRD §7.6 F-P5PP-02 ~ F-P5PP-06
- PRD §10 AC-VIS-01 (UI가 어떻게 표시?), AC-VIS-06 (재시도)
- PRD §9.1.3, §9.1.4 (요청/응답 형태)
- PRD §12 (카탈로그 — React 미포함, 신중)
- PRD §14 (오픈 이슈)

## 비범위 (이 spec에서 하지 않는 것)
- 빨간 박스 오버레이 (SPEC-016)
- 캡처/Anthropic 호출 자체 (daemon — SPEC-009~012)
- 동의 위저드 자체 (CLI — SPEC-013)
- 음성 / 키보드 단축키
- 다국어 (한국어 단일 PRD §4)

## 완료 신호
구현이 완료되고 모든 AC가 통과하면 다음 신호를 출력한다.

<promise>SPEC_015_FH_UI_BUTTONS_IMPL_DONE</promise>
