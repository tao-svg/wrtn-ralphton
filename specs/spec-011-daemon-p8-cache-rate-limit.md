# Spec: daemon — P8 Vision · 30초 캐시 + 시간당 가드레일 + debounce

## 메타
- **ID**: spec-011-daemon-p8-cache-rate-limit
- **Wave**: 2 (track A — daemon)
- **의존성**: spec-001-shared, spec-002-daemon-skeleton
- **예상 작업 시간**: 4h
- **패키지 경로**: `packages/daemon/`

## 목표
Vision API 비용 폭증을 막기 위한 4중 가드레일(1초 debounce / 30초 응답 캐시 / 시간당 100회 알림 / 시간당 200회 일시 정지)을 구현한다.

## 입력 (시작 시점에 존재해야 하는 것)
- spec-002 머지 (`vision_cache`, `rate_limit_buckets` 마이그레이션 적용)
- shared의 VisionGuideResult/VerifyResult 사용 가능

## 출력 (완료 시점에 존재해야 하는 것)
- `packages/daemon/src/p8-vision/cache.ts`
  - `getCached(key: string): VisionResult | null` (TTL 만료 시 null + row 삭제)
  - `setCached(key: string, result: VisionResult)` (TTL = now + 30s)
  - 키 포맷: `${requestType}:${itemId}:${stepId}:${imageHash}`
  - 백그라운드 정리: 호출 시점에 만료 row lazy 삭제 (별도 timer 없음)
- `packages/daemon/src/p8-vision/rate-limit.ts`
  - `checkAndIncrement(): { allowed: boolean; state: 'normal'|'alert'|'paused'; current_hour_calls; reset_at }`
  - bucket_id = 현재 hour-of-epoch
  - 100회 도달 시 `alert_sent=1` (1회만), 200회 도달 시 `paused=1`
  - `paused` 상태에서는 `allowed=false` 반환 + 호출 미증가
  - 다음 시간대 자동 리셋 (새 bucket_id)
  - `GET /api/vision/rate-limit` 라우터 (PRD §9.1.5)
- `packages/daemon/src/p8-vision/debounce.ts`
  - in-process Map<key, timestamp> (DB 불필요 — 1초 단위)
  - 같은 key 1초 내 재호출 시 `DebounceError` throw → 라우터 429 매핑 (state: throttled)
- `packages/daemon/src/routes/rate-limit.ts` — `GET /api/vision/rate-limit`
- `packages/daemon/tests/p8-cache.test.ts`
  - set → get round-trip
  - TTL 경과 후 get → null + row 삭제
  - 다른 imageHash → 다른 key
- `packages/daemon/tests/p8-rate-limit.test.ts`
  - 99회 → normal, 100회 → alert, 200회 → paused
  - paused 상태에서 호출 → allowed=false
  - hour 경계 시뮬레이션 → 새 bucket
- `packages/daemon/tests/p8-debounce.test.ts`
  - 같은 key 0.5초 내 재호출 → throw
  - 1.1초 후 재호출 → ok

## Acceptance Criteria
- [ ] **AC-VIS-04 충족**: 동일 (item, step, imageHash) 30초 내 두 번째 호출 → `cached: true`, latency < 100ms, Anthropic API 미호출 (라우터 통합은 SPEC-012에서, 본 모듈은 캐시 hit/miss 단언)
- [ ] **AC-VIS-05 충족**: 시간당 200회 호출 누적 → 201번째 `allowed=false`, state=`paused`, `reset_at` 다음 hour
- [ ] 100회 알림 1회만 발사 (alert_sent flag idempotent)
- [ ] 1초 debounce는 동일 key 한정 — 다른 step은 영향 없음
- [ ] cache TTL row가 SQLite idx_vision_cache_ttl 인덱스로 효율적 cleanup
- [ ] `pnpm test` 통과
- [ ] `pnpm build` 통과
- [ ] `pnpm lint` 에러 0
- [ ] 테스트 커버리지 ≥ 80%
- [ ] BOUNDARIES.md 준수
- [ ] 신규 의존성 없음

## 참고
- PRD §3.1 P8
- PRD §7.7 F-P8-06 (가드레일 4종)
- PRD §10 AC-VIS-04 (캐시), AC-VIS-05 (가드레일 일시 정지)
- PRD §9.1.5 (rate-limit API)
- PRD §8.1 vision_cache, rate_limit_buckets
- PRD §14.1 (Vision API 비용 초과 리스크 완화)

## 비범위 (이 spec에서 하지 않는 것)
- 라우터에서 가드레일 적용 (SPEC-012에서 미들웨어로 통합)
- vision_calls 메타데이터 기록 (SPEC-012)
- 캐시 응답에 ai-coaching message 포함 (SPEC-012 통합)
- Floating Hint UI에서 paused 상태 표시 (SPEC-015)

## 완료 신호
구현이 완료되고 모든 AC가 통과하면 다음 신호를 출력한다.

<promise>SPEC_011_DAEMON_P8_CACHE_RATE_LIMIT_IMPL_DONE</promise>
