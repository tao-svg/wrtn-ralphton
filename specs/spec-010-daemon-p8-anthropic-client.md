# Spec: daemon — P8 Vision · Anthropic SDK 클라이언트 + 프롬프트 + 응답 파싱

## 메타
- **ID**: spec-010-daemon-p8-anthropic-client
- **Wave**: 2 (track A — daemon)
- **의존성**: spec-001-shared, spec-002-daemon-skeleton, spec-009-daemon-p8-capture
- **예상 작업 시간**: 4h
- **패키지 경로**: `packages/daemon/`

## 목표
캡처 buffer + step 컨텍스트를 입력으로 Claude 3.5 Sonnet Vision API를 호출하고, 응답 텍스트에서 `message`/`highlight_region`/`status` 등을 zod로 파싱해 구조화된 결과를 반환한다.

## 입력 (시작 시점에 존재해야 하는 것)
- spec-009 머지 (`captureScreen()` 사용 가능)
- 환경 변수 `ANTHROPIC_API_KEY` (개발 시 dotenv, 배포 시 OS keychain 위임은 Phase 2)
- `@onboarding/shared`의 `VisionGuideResult`, `VisionVerifyResult`, `HighlightRegion`

## 출력 (완료 시점에 존재해야 하는 것)
- `packages/daemon/src/p8-vision/anthropic-client.ts`
  - `callGuide({ buffer, item, step }): Promise<VisionGuideResult>`
  - `callVerify({ buffer, item, step }): Promise<VisionVerifyResult>`
  - 모델: `claude-3-5-sonnet-latest` (PRD §6.3)
  - timeout 30초, max_tokens 1024
  - 이미지: base64 인라인, media_type=image/png
  - 응답: `<json>...</json>` 블록 추출 → zod parse
  - SDK error → 분기:
    - 4xx auth/quota → throw `AnthropicAuthError` (라우터 503 매핑)
    - timeout → throw `AnthropicTimeoutError` (503)
    - 5xx → throw `AnthropicServerError` (503)
- `packages/daemon/src/p8-vision/prompts/`
  - `guide.ts` — system 프롬프트 + step.intent/success_criteria/common_mistakes 템플릿
    - 출력 형식 강제: `{ "message": "...", "highlight_region": {x,y,width,height} | null, "confidence": "high"|"medium"|"low" }`
  - `verify.ts` — system 프롬프트 + success_criteria 기반 PASS/FAIL/UNCLEAR 판정
    - 출력 형식: `{ "status": "pass"|"fail"|"unclear", "reasoning": "...", "next_action_hint": "..." }`
- `packages/daemon/tests/p8-anthropic-client.test.ts`
  - msw로 Anthropic API 응답 모킹
  - 정상 guide 응답 파싱
  - 정상 verify pass/fail/unclear 파싱
  - 응답에 JSON 블록 없음 → throw `VisionResponseFormatError`
  - 401 응답 → AnthropicAuthError
  - 504 timeout → AnthropicTimeoutError
  - 500 응답 → AnthropicServerError

## Acceptance Criteria
- [ ] **AC-VIS-08 부분 충족**: 호출 함수가 latency 측정 (반환 객체에 `latency_ms` 포함)
- [ ] PRD §11 step 객체의 intent/success_criteria/common_mistakes를 프롬프트에 포함
- [ ] guide 응답에 `highlight_region` 좌표 zod 검증 (x≥0, y≥0, width>0, height>0)
- [ ] verify 응답 status는 정확히 `pass`/`fail`/`unclear` 셋 중 하나
- [ ] msw 모킹으로 5가지 시나리오 테스트 (정상 guide, 정상 verify, 포맷 오류, auth 오류, timeout)
- [ ] 호출 후 입력 buffer는 호출자가 dispose 책임 (본 함수는 Buffer 내부 보관 안 함)
- [ ] `pnpm test` 통과
- [ ] `pnpm build` 통과
- [ ] `pnpm lint` 에러 0
- [ ] 테스트 커버리지 ≥ 80%
- [ ] BOUNDARIES.md 준수
- [ ] 신규 의존성은 PRD §12 (`@anthropic-ai/sdk`, `msw`)만 추가

## 참고
- PRD §3.1 P8
- PRD §7.7 F-P8-02, F-P8-03, F-P8-09 (API 실패 폴백)
- PRD §10 AC-VIS-01, AC-VIS-08
- PRD §6.3 (Claude 3.5 Sonnet)
- PRD §9.1.3, §9.1.4 (응답 형태 — 본 모듈은 SDK 호출까지만, HTTP 응답은 SPEC-012)
- PRD §11 step 객체 (프롬프트 입력)

## 비범위 (이 spec에서 하지 않는 것)
- HTTP 라우터 (SPEC-012)
- 캐시 (SPEC-011)
- rate limit / debounce (SPEC-011)
- vision_calls 테이블 기록 (SPEC-012에서 라우터가 통합)
- 프롬프트 튜닝 (Pilot 단계)
- API 키 keychain 보관 (Phase 2)

## 완료 신호
구현이 완료되고 모든 AC가 통과하면 다음 신호를 출력한다.

<promise>SPEC_010_DAEMON_P8_ANTHROPIC_CLIENT_IMPL_DONE</promise>
