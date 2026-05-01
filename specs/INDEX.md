# Specs Index — Onboarding Agent MVP-Slim

> **PRD**: [docs/PRD-MVP-SLIM.md](../docs/PRD-MVP-SLIM.md) (v0.10, 2026-05-01)
> **Template**: [spec/spec-templete.md](../spec/spec-templete.md)
> **상태**: Draft (검토 대기)

---

## 1. 분류 원칙

PRD §6 패키지 구조에 따라 3개 패키지로 분류:

| 패키지 | 책임 | 패턴 |
|--------|------|------|
| `shared` | 공통 TypeScript 타입 + zod 스키마 | — |
| `daemon` | HTTP 서버 (localhost:7777) + SQLite + CLI | P1, P2, P4, P5+, P8 |
| `floating-hint` | Electron always-on-top 윈도우 (메인 UI) | P5++ |

각 spec은 **4시간 이내** 작업 단위. 완료 신호: `<promise>SPEC_NNN_NAME_IMPL_DONE</promise>`.

---

## 2. Wave 분류

```
Wave 1 (단독, 직렬)
└── SPEC-001 (shared)
       │
       └─────────────────┬─────────────────┐
                         ▼                 ▼
Wave 2 (병렬 가능 — daemon ⫽ floating-hint)
   ┌── daemon ──────────────────────┐    ┌── floating-hint ──┐
   │ SPEC-002 daemon-skeleton       │    │ SPEC-014 fh-skeleton│
   │  ├─ SPEC-003 checklist-loader  │    │  ├─ SPEC-015 fh-ui  │
   │  ├─ SPEC-004 consents          │    │  └─ SPEC-016 fh-overlay
   │  ├─ SPEC-005 p1-state-probe    │    └─────────────────────┘
   │  ├─ SPEC-006 p2-clipboard      │
   │  ├─ SPEC-007 p4-verify         │
   │  ├─ SPEC-008 p5-system-panel   │
   │  ├─ SPEC-009 p8-capture        │
   │  ├─ SPEC-010 p8-anthropic      │
   │  ├─ SPEC-011 p8-cache-rate     │
   │  ├─ SPEC-012 p8-routes         │
   │  └─ SPEC-013 cli-install       │
   └────────────────────────────────┘
```

**병렬 실행 단위**:
- Wave 1: SPEC-001 단독
- Wave 2-A (daemon track): SPEC-002 → SPEC-003..013 (daemon 내부는 부분 병렬)
- Wave 2-B (floating-hint track): SPEC-014 → SPEC-015, SPEC-016
- Wave 2-A 와 Wave 2-B는 **상호 독립** (floating-hint는 daemon API를 모킹하여 개발)

---

## 3. 의존성 그래프

```
SPEC-001 shared
  ├─▶ SPEC-002 daemon-skeleton
  │     ├─▶ SPEC-003 checklist-loader
  │     ├─▶ SPEC-004 consents
  │     ├─▶ SPEC-005 p1-state-probe ──── (uses SPEC-003)
  │     ├─▶ SPEC-006 p2-clipboard
  │     ├─▶ SPEC-007 p4-verify
  │     ├─▶ SPEC-008 p5-system-panel
  │     ├─▶ SPEC-009 p8-capture
  │     │     └─▶ SPEC-010 p8-anthropic-client
  │     ├─▶ SPEC-011 p8-cache-rate-limit
  │     ├─▶ SPEC-012 p8-routes ──── (uses SPEC-004, 009, 010, 011)
  │     └─▶ SPEC-013 cli-install ──── (uses SPEC-002, 003)
  │
  └─▶ SPEC-014 fh-skeleton
        ├─▶ SPEC-015 fh-ui
        └─▶ SPEC-016 fh-overlay
```

---

## 4. Spec 목록

### Wave 1 — shared (1개)

| ID | 제목 | 시간 | 책임 AC (PRD §10) |
|----|------|------|---------------------|
| SPEC-001 | shared-types-schemas | 3h | (전 spec의 토대) |

### Wave 2-A — daemon (12개)

| ID | 제목 | 시간 | 패턴 | 책임 AC |
|----|------|------|------|---------|
| SPEC-002 | daemon-skeleton | 4h | — | F-CORE-04, 빈 HTTP 서버 |
| SPEC-003 | daemon-checklist-loader | 4h | — | F-CORE-03 (yaml + 항목 시작) |
| SPEC-004 | daemon-consents | 3h | — | AC-CORE-02, F-CORE-02 |
| SPEC-005 | daemon-p1-state-probe | 3h | P1 | AC-P1-01 |
| SPEC-006 | daemon-p2-clipboard | 2h | P2 | AC-P2-01 |
| SPEC-007 | daemon-p4-verify | 3h | P4 | AC-P4-01 |
| SPEC-008 | daemon-p5-system-panel | 2h | P5+ | AC-P5P-01 |
| SPEC-009 | daemon-p8-capture | 3h | P8 | AC-VIS-07 (이미지 파기) |
| SPEC-010 | daemon-p8-anthropic-client | 4h | P8 | F-P8-02/03/09, AC-VIS-08 |
| SPEC-011 | daemon-p8-cache-rate-limit | 4h | P8 | AC-VIS-04, AC-VIS-05 |
| SPEC-012 | daemon-p8-routes | 4h | P8 | AC-VIS-01, AC-VIS-02, AC-VIS-03, AC-VIS-06 |
| SPEC-013 | daemon-cli-install | 4h | — | AC-CORE-01, F-CORE-01/05 |

### Wave 2-B — floating-hint (3개)

| ID | 제목 | 시간 | 패턴 | 책임 AC |
|----|------|------|------|---------|
| SPEC-014 | fh-skeleton | 3h | P5++ | F-P5PP-01, AC-VIS-09 |
| SPEC-015 | fh-ui-buttons | 4h | P5++ | F-P5PP-02/03/05/06 |
| SPEC-016 | fh-highlight-overlay | 3h | P5++ | F-P5PP-04 |

**합계**: 16 spec, 누적 ~53h. PRD §13 6주 일정에 부합.

---

## 5. 통합 시나리오 (AC-INT-01)

`AC-INT-01: 5개 항목 E2E`는 모든 spec 머지 후 통합 테스트 단계에서 검증 (별도 spec 아님).

---

## 6. 변경 이력

- v0.1 (2026-05-01): 초안 작성 — 검토 대기
