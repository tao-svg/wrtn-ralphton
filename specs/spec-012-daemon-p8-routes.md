# Spec: daemon — P8 Vision · /api/vision/guide + /api/vision/verify 라우터 통합

## 메타
- **ID**: spec-012-daemon-p8-routes
- **Wave**: 2 (track A — daemon)
- **의존성**: spec-001-shared, spec-002-daemon-skeleton, spec-003-daemon-checklist-loader, spec-004-daemon-consents, spec-009-daemon-p8-capture, spec-010-daemon-p8-anthropic-client, spec-011-daemon-p8-cache-rate-limit
- **예상 작업 시간**: 4h
- **패키지 경로**: `packages/daemon/`

## 목표
캡처 + Anthropic 호출 + 캐시 + 가드레일 + 동의 미들웨어 + vision_calls 기록을 묶어 PRD §9.1.3, §9.1.4 라우터 두 개를 완성한다.

## 입력 (시작 시점에 존재해야 하는 것)
- spec-009 (capture), spec-010 (anthropic client), spec-011 (cache + rate limit), spec-004 (consents middleware) 모두 머지

## 출력 (완료 시점에 존재해야 하는 것)
- `packages/daemon/src/p8-vision/orchestrator.ts`
  - `runGuide({ itemId, stepId }): VisionGuideResponse`
  - `runVerify({ itemId, stepId }): VisionVerifyResponse`
  - 흐름:
    1. yaml에서 item/step 로드 (404 분기)
    2. debounce check (429 throttled)
    3. rate-limit check (429 paused)
    4. capture screen → buffer + hash
    5. cache key 조회 → hit이면 즉시 반환 (`cached: true`, latency_ms 측정)
    6. miss이면 anthropic-client 호출
    7. 응답 cache.set + vision_calls insert (call_id, item, step, request_type, image_hash, prompt_tokens, output_tokens, latency_ms, cache_hit, result_summary)
    8. buffer dispose
    9. verify의 status가 `pass`이면 item_states.completed 갱신
- `packages/daemon/src/routes/vision.ts`
  - `POST /api/vision/guide` — requireConsent('screen_recording', 'anthropic_transmission') + body zod
  - `POST /api/vision/verify` — 동일 미들웨어
  - 에러 매핑:
    - ScreenRecordingDenied → 401 `screen_recording_permission_required`
    - ConsentRequired → 403 `consent_required`
    - DebounceError → 429 `rate_limit_exceeded` state=throttled
    - RateLimitPaused → 429 `rate_limit_exceeded` state=paused + reset_at
    - AnthropicTimeout/Server/Auth → 503 `vision_api_timeout` (또는 `vision_api_error`)
    - VisionResponseFormatError → 503 `vision_response_invalid`
- `packages/daemon/tests/p8-routes.test.ts` — supertest로 PRD §10 AC 시나리오:
  - AC-VIS-01: guide 정상 응답 (mocked Anthropic via msw, real cache/rate-limit, mocked capture)
  - AC-VIS-02: verify pass → item completed
  - AC-VIS-03: verify fail → in_progress 유지 + next_action_hint
  - AC-VIS-04: 두 번째 호출 cached=true
  - AC-VIS-05: 200회 누적 후 paused
  - AC-VIS-06: anthropic timeout → 503 + 클라이언트가 retry 가능

## Acceptance Criteria
- [ ] **AC-VIS-01 충족**: 정상 흐름 응답 5초 이내(P95 SLA), `message`+`highlight_region` 포함, vision_calls row 생성, 디스크/메모리에 이미지 잔존 없음
- [ ] **AC-VIS-02 충족**: verify pass 응답 → item_states 자동 completed
- [ ] **AC-VIS-03 충족**: verify fail 응답 → status in_progress 유지 + next_action_hint 제공
- [ ] **AC-VIS-04 충족**: 동일 화면 재호출 cached=true, latency < 100ms
- [ ] **AC-VIS-05 충족**: 201번째 호출 429 + state=paused
- [ ] **AC-VIS-06 충족**: API 실패 시 503 (Floating Hint가 [🔄 재시도] 표시는 SPEC-015 책임)
- [ ] vision_calls 테이블에 base64/binary 데이터 0개 (AC-VIS-07 일부 — capture 책임은 SPEC-009)
- [ ] 동의 미부여 시 401 또는 403 정확히 분기
- [ ] `pnpm test` 통과
- [ ] `pnpm build` 통과
- [ ] `pnpm lint` 에러 0
- [ ] 테스트 커버리지 ≥ 80%
- [ ] BOUNDARIES.md 준수
- [ ] 신규 의존성 없음

## 참고
- PRD §9.1.3, §9.1.4 (API 계약)
- PRD §10 AC-VIS-01 ~ AC-VIS-06 (모두 본 spec이 책임)
- PRD §8.1 vision_calls
- PRD §7.7 F-P8-04 (highlight_region), F-P8-05 (verify status)

## 비범위 (이 spec에서 하지 않는 것)
- 프롬프트 자체 작성 (SPEC-010)
- 캐시/rate-limit 알고리즘 (SPEC-011)
- 캡처 메커니즘 (SPEC-009)
- Floating Hint에서 빨간 박스 렌더링 (SPEC-016)
- vision_calls 30일 retention 정리 (Phase 2)

## 완료 신호
구현이 완료되고 모든 AC가 통과하면 다음 신호를 출력한다.

<promise>SPEC_012_DAEMON_P8_ROUTES_IMPL_DONE</promise>
