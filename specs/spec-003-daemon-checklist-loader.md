# Spec: daemon — checklist.yaml 로더 + 체크리스트 API

## 메타
- **ID**: spec-003-daemon-checklist-loader
- **Wave**: 2 (track A — daemon)
- **의존성**: spec-001-shared, spec-002-daemon-skeleton
- **예상 작업 시간**: 4h
- **패키지 경로**: `packages/daemon/`

## 목표
daemon에 번들된 `checklist.yaml`을 zod로 검증해 로드하고, 체크리스트 조회와 항목 시작 API를 제공해 입사자 진행 흐름의 시작점을 만든다.

## 입력 (시작 시점에 존재해야 하는 것)
- spec-002 머지 완료 (Express 서버 + SQLite 마이그레이션 동작)
- `@onboarding/shared`의 `ChecklistItem`, `ItemState`, API zod 스키마 사용 가능

## 출력 (완료 시점에 존재해야 하는 것)
- `packages/daemon/content/checklist.yaml` — PRD §11의 5개 항목 완전 복사 (install-homebrew ~ setup-gmail-signature)
- `packages/daemon/src/checklist/loader.ts` — 빌드 시 `content/checklist.yaml` 동봉, 기동 시 1회 파싱 + zod 검증, 메모리 캐시
- `packages/daemon/src/checklist/repository.ts` — `item_states` upsert/query 헬퍼
- `packages/daemon/src/routes/checklist.ts`
  - `GET /api/checklist` — 항목 + 현재 상태 머지 응답 (PRD §9.1.1)
  - `POST /api/items/:itemId/start` — `item_states.status = in_progress`, `started_at = now`, attempt_count++ (PRD §9.1.2)
- `packages/daemon/src/routes/index.ts` — checklist 라우터 등록
- `packages/daemon/tests/checklist-loader.test.ts` — 정상 yaml 파싱, 잘못된 yaml은 zod error
- `packages/daemon/tests/checklist-routes.test.ts` — supertest로 GET/POST 시나리오 (pending → in_progress 전이)

## Acceptance Criteria
- [ ] `GET /api/checklist`가 PRD §9.1.1 응답 형태(`items[]` 배열, 각 항목에 `item_id`, `title`, `status`, `current_step` 포함) 반환
- [ ] 첫 호출 시 SQLite에 항목별 row 없으면 `status: "pending"`으로 자동 채워서 응답
- [ ] `POST /api/items/install-homebrew/start` → `item_states` row가 `in_progress`로 갱신, `started_at` 채워짐, `attempt_count` 1 증가
- [ ] 존재하지 않는 `:itemId` → 404 `{ "error": "item_not_found" }`
- [ ] 잘못된 yaml(필수 필드 누락 등) 부팅 시 명시적 에러 → 서버 기동 실패
- [ ] PRD §11 5개 항목 모두 zod 통과
- [ ] `pnpm test` 통과
- [ ] `pnpm build` 통과
- [ ] `pnpm lint` 에러 0
- [ ] 테스트 커버리지 ≥ 80%
- [ ] BOUNDARIES.md 준수 (shared/daemon 외 미수정)
- [ ] 신규 의존성은 PRD §12 (`yaml`)만 추가

## 참고
- PRD §9.1.1, §9.1.2 (API 계약)
- PRD §11 (콘텐츠 yaml 5개 항목 — 그대로 복사)
- PRD §8.1 item_states (DB 테이블)
- PRD §10 (AC 정의 — 본 spec은 기반만 제공)

## 비범위 (이 spec에서 하지 않는 것)
- P1 자동 완료 처리 (SPEC-005)
- P2 클립보드 트리거 (SPEC-006)
- P4 검증 실행 (SPEC-007)
- 항목 진행 중 step 전이 (Vision 응답 후 — SPEC-012)
- yaml 핫리로드 / GitLab webhook (Phase 2)

## 완료 신호
구현이 완료되고 모든 AC가 통과하면 다음 신호를 출력한다.

<promise>SPEC_003_DAEMON_CHECKLIST_LOADER_IMPL_DONE</promise>
