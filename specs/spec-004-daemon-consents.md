# Spec: daemon — 동의 관리 (Screen Recording / Anthropic 전송)

## 메타
- **ID**: spec-004-daemon-consents
- **Wave**: 2 (track A — daemon)
- **의존성**: spec-001-shared, spec-002-daemon-skeleton
- **예상 작업 시간**: 3h
- **패키지 경로**: `packages/daemon/`

## 목표
입사자가 Vision API를 사용하기 전 두 가지 동의(Screen Recording / Anthropic 외부 전송)를 등록·조회하는 API와 미들웨어를 제공해 P8 호출이 동의 없이 발생하지 않도록 한다.

## 입력 (시작 시점에 존재해야 하는 것)
- spec-002 머지 (consents 테이블 마이그레이션 적용)
- `@onboarding/shared`의 `ConsentType`, `ConsentRecord` 사용 가능

## 출력 (완료 시점에 존재해야 하는 것)
- `packages/daemon/src/consents/repository.ts` — `getAll()`, `upsert(type, granted)` (granted 시 `granted_at = now`, false 시 `revoked_at = now`)
- `packages/daemon/src/consents/middleware.ts` — `requireConsent(...types)` Express 미들웨어
  - 둘 다 granted=true가 아니면 `403 { "error": "consent_required", "missing": ["..."] }` 반환 (PRD §9.1.3 403 사양)
  - Screen Recording 미부여 시 `401 { "error": "screen_recording_permission_required" }`로 분기
- `packages/daemon/src/routes/consents.ts`
  - `POST /api/consents` (PRD §9.1.6) — body: `{ consent_type, granted }`
  - `GET /api/consents` (PRD §9.1.6) — `{ screen_recording: {...}, anthropic_transmission: {...} }`
- `packages/daemon/src/system/screen-recording.ts` — macOS Screen Recording 권한 체크 헬퍼 (CGPreflightScreenCaptureAccess wrapper, 실제 호출은 SPEC-009에서 사용)
- `packages/daemon/tests/consents-repo.test.ts` — upsert idempotent, revoke 시 granted_at 보존 + revoked_at 설정
- `packages/daemon/tests/consents-routes.test.ts` — POST → GET round-trip
- `packages/daemon/tests/consents-middleware.test.ts` — 동의 없을 때 403/401 분기

## Acceptance Criteria
- [ ] **AC-CORE-02 충족**: 첫 실행 시 POST 동의 → SQLite consents에 기록, 이후 GET이 그 값 반환
- [ ] `consent_type` 허용값은 `screen_recording`, `anthropic_transmission` 둘뿐 (zod CHECK)
- [ ] 미들웨어가 두 동의 모두 검사하여 누락된 항목 명시 (`missing` 배열)
- [ ] 같은 type으로 granted=true 두 번 호출 시 row 1개 유지 (PK consent_type)
- [ ] Screen Recording 권한 체크는 macOS API 호출 가능 + 비-macOS에서는 `unsupported_platform` 명시
- [ ] `pnpm test` 통과
- [ ] `pnpm build` 통과
- [ ] `pnpm lint` 에러 0
- [ ] 테스트 커버리지 ≥ 80%
- [ ] BOUNDARIES.md 준수
- [ ] 신규 의존성 없음 (Node native bindings는 spec-009에서 도입)

## 참고
- PRD §9.1.6 (consents API)
- PRD §10 AC-CORE-02
- PRD §8.1 consents 테이블
- PRD §7.7 F-P8-08 (동의 미부여 시 차단)
- PRD §14.1 (Anthropic 사내 정책 사전 승인 리스크)

## 비범위 (이 spec에서 하지 않는 것)
- 실제 macOS 권한 다이얼로그 트리거 (CLI/Floating Hint에서 안내 — SPEC-013, SPEC-015)
- Vision API 호출 흐름 (SPEC-009~012)
- 동의 텍스트 UI 컴포넌트 (Floating Hint 측)

## 완료 신호
구현이 완료되고 모든 AC가 통과하면 다음 신호를 출력한다.

<promise>SPEC_004_DAEMON_CONSENTS_IMPL_DONE</promise>
