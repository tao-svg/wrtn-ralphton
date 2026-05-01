# Spec: shared 패키지 — 공통 타입 + zod 스키마

## 메타
- **ID**: spec-001-shared
- **Wave**: 1
- **의존성**: 없음
- **예상 작업 시간**: 3h
- **패키지 경로**: `packages/shared/`

## 목표
daemon · floating-hint 양쪽이 import할 도메인 타입과 API 요청/응답 zod 스키마를 단일 소스로 정의한다.

## 입력 (시작 시점에 존재해야 하는 것)
- 비어 있는 monorepo 루트 (pnpm workspaces 미설정 가능)
- PRD §8 (데이터 모델), §9 (API 계약), §11 (콘텐츠 스키마) 확정 상태

## 출력 (완료 시점에 존재해야 하는 것)
- `packages/shared/package.json` (name: `@onboarding/shared`, exports map 정의)
- `packages/shared/tsconfig.json`
- `packages/shared/src/index.ts` (배럴 export)
- `packages/shared/src/types/`
  - `item.ts` — `ItemId`, `ItemStatus`, `ItemState` (PRD §8 item_states)
  - `vision.ts` — `VisionGuideResult`, `VisionVerifyResult`, `HighlightRegion`, `VisionConfidence`
  - `consent.ts` — `ConsentType`, `ConsentRecord`
  - `checklist.ts` — `ChecklistItem`, `ChecklistStep`, `Verification`, `ClipboardInject` (PRD §11)
- `packages/shared/src/schemas/`
  - `api.ts` — daemon API 요청/응답 zod 스키마 (PRD §9.1.1~9.1.8)
  - `checklist.ts` — checklist.yaml zod 스키마
- `packages/shared/tests/` — 각 스키마 round-trip 검증 (커버리지 80%+)
- 루트 `pnpm-workspace.yaml` (packages/* 글로브 등록, 다른 spec과 병합 안전)

## Acceptance Criteria
- [ ] PRD §9의 모든 엔드포인트(체크리스트, 항목 시작, vision/guide, vision/verify, rate-limit, consents, clipboard, verify) 요청·응답 타입 정의
- [ ] PRD §8 item_states/consents 등 SQLite 컬럼이 TS 타입으로 1:1 매핑
- [ ] PRD §11 yaml 스키마(items, clipboard_inject, verification, ai_coaching, system_panel_url, template) zod 정의
- [ ] `HighlightRegion`은 `{x,y,width,height}` 4필드 number, 음수/0 검증
- [ ] 모든 zod 스키마에 round-trip 테스트 (parse → 재직렬화 → 동일)
- [ ] `pnpm --filter @onboarding/shared test` 통과
- [ ] `pnpm --filter @onboarding/shared build` 통과 (tsc emit)
- [ ] `pnpm --filter @onboarding/shared lint` 에러 0
- [ ] 테스트 커버리지 ≥ 80%
- [ ] 신규 의존성은 PRD §12 카탈로그(`zod`, `typescript`, `vitest`)만 사용

## 참고
- PRD §6.2 D (Shared 패키지 책임)
- PRD §8 (SQLite 데이터 모델 → TS 타입)
- PRD §9 (Daemon API 계약)
- PRD §10 AC (전 spec의 검증 대상)
- PRD §11 (콘텐츠 yaml 스키마)
- PRD §12 (라이브러리 카탈로그)

## 비범위 (이 spec에서 하지 않는 것)
- daemon HTTP 서버 구현 (SPEC-002)
- floating-hint 윈도우 (SPEC-014)
- yaml 파일 로드/디스크 IO (SPEC-003)
- 실제 Anthropic SDK 연동 타입 wrapping (SPEC-010)
- BOUNDARIES.md 작성 (별도)

## 완료 신호
구현이 완료되고 모든 AC가 통과하면 다음 신호를 출력한다.

<promise>SPEC_001_SHARED_IMPL_DONE</promise>
