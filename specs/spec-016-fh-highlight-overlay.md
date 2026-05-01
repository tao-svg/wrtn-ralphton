# Spec: floating-hint — 빨간 박스 오버레이 (별도 투명 윈도우)

## 메타
- **ID**: spec-016-fh-highlight-overlay
- **Wave**: 2 (track B — floating-hint)
- **의존성**: spec-001-shared, spec-014-fh-skeleton, spec-015-fh-ui-buttons
- **예상 작업 시간**: 3h
- **패키지 경로**: `packages/floating-hint/`

## 목표
guide 응답의 `highlight_region` 좌표에 맞춰 화면 전체를 덮는 별도 투명/클릭-스루 윈도우에 빨간 박스를 그려 사용자가 어디를 클릭할지 직관적으로 인지하게 한다.

## 입력 (시작 시점에 존재해야 하는 것)
- spec-014 (윈도우 부팅), spec-015 (guide 응답 수신) 머지
- shared의 `HighlightRegion` 타입 사용 가능

## 출력 (완료 시점에 존재해야 하는 것)
- `packages/floating-hint/src/main/overlay-window.ts`
  - 별도 `BrowserWindow` 생성 헬퍼 `createOverlayWindow()`
  - 옵션:
    - `transparent: true`, `frame: false`, `alwaysOnTop: true` (`level: 'screen-saver'`)
    - `focusable: false`, `setIgnoreMouseEvents(true, { forward: true })` (클릭 스루)
    - `width/height` = primary display work area
    - `hasShadow: false`
  - main process IPC: `overlay:show(region)`, `overlay:hide()`
- `packages/floating-hint/src/renderer/overlay/index.html` — full-viewport canvas/SVG
- `packages/floating-hint/src/renderer/overlay/index.tsx`
  - `region` 좌표를 받아 빨간 박스 (border 3px solid #ff3b30, border-radius 4px, 옅은 그림자)
  - 4초 후 자동 페이드아웃 또는 다음 응답 도착 시 갱신
  - 단순 애니메이션: 등장 시 0.95 → 1.0 scale, opacity 0 → 1 (200ms)
- `packages/floating-hint/src/renderer/overlay/coords.ts` — Anthropic 응답 좌표 ↔ 실제 픽셀 변환
  - 캡처는 sharp로 long-edge 1568px 리사이즈된 이미지 좌표
  - 실제 화면은 사용자 display 해상도 → 비율 환산 헬퍼
  - DPI scale factor는 `screen.getPrimaryDisplay().scaleFactor` 사용
- `packages/floating-hint/src/renderer/state/store.ts` 갱신 — guide 응답에 region 포함되면 자동 `overlay:show` 호출, 다음 step 진입 또는 verify 호출 시 `overlay:hide`
- `packages/floating-hint/tests/overlay/coords.test.ts` — 1568px 좌표 → 2880x1800 Retina 화면 픽셀 환산 단언
- `packages/floating-hint/tests/overlay/window.test.ts` — IPC handler 단언 (mocked BrowserWindow)

## Acceptance Criteria
- [ ] **F-P5PP-04 충족**: guide 응답의 highlight_region이 실제 화면 위에 빨간 박스로 표시됨
- [ ] **AC-VIS-09 충족(오버레이 측)**: 오버레이 윈도우가 떠 있어도 사용자 클릭/타이핑이 그 아래 앱에 정상 전달 (`setIgnoreMouseEvents(true, {forward:true})`)
- [ ] 좌표 환산: 캡처 시점의 리사이즈 비율 + display scaleFactor 둘 다 보정 (오차 ≤ 5px)
- [ ] highlight_region이 null이거나 좌표가 음수/0인 경우 박스 미표시 (zod로 SPEC-001에서 거름, 본 spec은 추가 안전장치)
- [ ] 4초 후 자동 fade-out, 새 응답 도착 시 즉시 갱신
- [ ] 다중 모니터 환경에서 primary display에만 표시 (Phase 2: 캡처 모니터 추적)
- [ ] `pnpm test` 통과
- [ ] `pnpm build` 통과
- [ ] `pnpm lint` 에러 0
- [ ] 테스트 커버리지 ≥ 80%
- [ ] BOUNDARIES.md 준수
- [ ] 신규 의존성 없음

## 참고
- PRD §6.1 (아키텍처: 빨간 박스 오버레이)
- PRD §7.6 F-P5PP-04 (별도 투명 윈도우)
- PRD §10 AC-VIS-09 (비간섭)
- PRD §9.1.3 (highlight_region 응답)
- PRD §5 김하나 시나리오 (빨간 박스 안내 흐름)

## 비범위 (이 spec에서 하지 않는 것)
- 다중 박스 / 화살표 / 레이블 (Phase 2)
- 다중 모니터 캡처 모니터 추적 (Phase 2)
- 키보드로 박스 dismiss (Phase 2)
- 좌표 정확도 자동 보정 (프롬프트 튜닝 — Pilot 단계)

## 완료 신호
구현이 완료되고 모든 AC가 통과하면 다음 신호를 출력한다.

<promise>SPEC_016_FH_HIGHLIGHT_OVERLAY_IMPL_DONE</promise>
