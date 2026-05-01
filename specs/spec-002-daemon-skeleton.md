# Spec: daemon 스켈레톤 (Express + SQLite + 마이그레이션 + 로깅)

## 메타
- **ID**: spec-002-daemon-skeleton
- **Wave**: 2 (track A — daemon)
- **의존성**: spec-001-shared
- **예상 작업 시간**: 4h
- **패키지 경로**: `packages/daemon/`

## 목표
localhost:7777 Express 서버 + better-sqlite3 + 마이그레이션 + pino 로깅을 갖춘 빈 스켈레톤을 구축하여 후속 daemon spec들이 라우터·DB만 추가하면 동작하도록 한다.

## 입력 (시작 시점에 존재해야 하는 것)
- spec-001-shared 머지 완료 (`@onboarding/shared` 사용 가능)
- pnpm workspaces 활성화

## 출력 (완료 시점에 존재해야 하는 것)
- `packages/daemon/package.json` (name: `@onboarding/daemon`, bin 미등록 — SPEC-013에서 추가)
- `packages/daemon/tsconfig.json`
- `packages/daemon/src/server.ts` — Express 앱 팩토리, 라우터 등록 지점, 에러 핸들러 (zod 검증 실패 → 400, unknown → 500)
- `packages/daemon/src/db/index.ts` — better-sqlite3 인스턴스 (`~/.onboarding/agent.db`), `pragma journal_mode=WAL`
- `packages/daemon/src/db/migrations/001_init.sql` — PRD §8.1 전체 스키마 (profile, item_states, vision_calls, rate_limit_buckets, vision_cache, consents + 인덱스)
- `packages/daemon/src/db/migrate.ts` — 마이그레이션 러너 (`schema_migrations` 테이블 사용, 기동 시 1회 실행)
- `packages/daemon/src/logger.ts` — pino 인스턴스 (level: env `LOG_LEVEL` || 'info')
- `packages/daemon/src/index.ts` — 부트스트랩 (마이그레이션 → 서버 시작 → graceful shutdown)
- `packages/daemon/src/routes/health.ts` — `GET /healthz` 200 OK
- `packages/daemon/tests/server.test.ts` — supertest로 `/healthz` 통과 + 미등록 라우트 404
- `packages/daemon/tests/migrate.test.ts` — 임시 DB 파일에 마이그레이션 적용 후 모든 테이블 존재

## Acceptance Criteria
- [ ] `pnpm --filter @onboarding/daemon dev`로 서버 기동 후 `curl localhost:7777/healthz` → 200
- [ ] 같은 DB로 마이그레이션 2회 실행해도 idempotent (중복 적용 없음)
- [ ] `~/.onboarding/agent.db` 디렉토리 자동 생성
- [ ] zod 검증 실패는 일관된 `{ "error": "validation_error", "details": [...] }` 400 응답
- [ ] graceful shutdown: SIGTERM/SIGINT 수신 시 서버 close + DB close
- [ ] `pnpm test` 통과
- [ ] `pnpm build` 통과
- [ ] `pnpm lint` 에러 0
- [ ] 테스트 커버리지 ≥ 80%
- [ ] BOUNDARIES.md 준수 (shared 외 패키지 미수정)
- [ ] 신규 의존성은 PRD §12 카탈로그(`express`, `better-sqlite3`, `pino`, `zod`, `vitest`, `supertest`)만 사용

## 참고
- PRD §6.1 (아키텍처 다이어그램), §6.3 (기술 스택)
- PRD §8.1 (SQLite 스키마 — 마이그레이션 SQL 원본)
- PRD §9 (API 계약 — 라우터 placeholder는 후속 spec에서 등록)
- PRD §12 (라이브러리)

## 비범위 (이 spec에서 하지 않는 것)
- 비즈니스 라우터 구현 (`/api/checklist`, `/api/vision/*` 등 — SPEC-003 이후)
- CLI 진입점 (SPEC-013)
- Anthropic SDK 통합 (SPEC-010)
- Floating Hint 통신 (HTTP만 사용, 별도 IPC 없음)

## 완료 신호
구현이 완료되고 모든 AC가 통과하면 다음 신호를 출력한다.

<promise>SPEC_002_DAEMON_SKELETON_IMPL_DONE</promise>
