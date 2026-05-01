# Onboarding Agent — MVP-Slim PRD

> **상태**: Draft v0.10 (MVP-Slim)
> **작성일**: 2026-05-01
> **작성자**: Tao
> **타겟 릴리즈**: MVP (가설 검증)
> **분량**: ~1000줄 (v0.9.1 풀 버전 3677줄 → 다이어트)
>
> **변경 이력**
> - v0.10 (현재): MVP-Slim 신규 작성. 단일 가설 검증에 집중. Extension/Backend/Admin/작성자도구 모두 Out of Scope. Frontend 최소화. 6주 일정.
> - v0.9.1 이전: archive/PRD-v0.9.1.md 참조 (풀 버전, Phase 2 이후 활용)

---

## 0. 이 문서의 사용법

본 PRD는 **MVP의 단 한 가지 가설을 검증**하기 위한 최소 시스템을 정의한다.

검증할 가설:
> **AI가 화면을 보고 능동적으로 코칭하면, 사람이 옆에 붙어 설명하는 것 같은 경험을 제공하여, 신규 입사자가 사람의 개입 없이 시스템 작업을 자가 진행할 수 있다.**

이 가설이 검증되지 않으면 추가 기능(Backend, Admin Dashboard, Chrome Extension, 작성자 도구 등)을 만들 의미가 없다. 따라서 MVP는 **가설 검증에 직접 기여하지 않는 모든 기능을 의도적으로 제외**한다.

Phase 2 이후 추가될 기능은 archive/PRD-v0.9.1.md에 풀 버전으로 보관되어 있다.

---

## 목차

1. [배경](#1-배경)
2. [목표 (가설 검증)](#2-목표-가설-검증)
3. [MVP 스코프](#3-mvp-스코프)
4. [Out of Scope (명시적 제외)](#4-out-of-scope-명시적-제외)
5. [사용자 시나리오](#5-사용자-시나리오)
6. [시스템 구성](#6-시스템-구성)
7. [기능 요구사항](#7-기능-요구사항)
8. [데이터 모델](#8-데이터-모델)
9. [API 계약](#9-api-계약)
10. [Acceptance Criteria](#10-acceptance-criteria)
11. [콘텐츠 스키마](#11-콘텐츠-스키마)
12. [라이브러리 (확정)](#12-라이브러리-확정)
13. [마일스톤](#13-마일스톤)
14. [리스크 & 오픈 이슈](#14-리스크--오픈-이슈)
- [부록 A. 용어](#부록-a-용어)
- [부록 B. v0.9.1과의 차이](#부록-b-v091과의-차이)

---

## 1. 배경

신규 입사자는 첫 1~2일을 환경 설정에 소비한다. 사내 보안 에이전트 설치, VPN 설정, Git 환경 구성, 사내 도구 가입 등 14개 내외 항목을 처리해야 하는데, 매번 사수에게 물어보거나 흩어진 위키 문서를 뒤져야 한다.

기존 솔루션:
- 위키 문서 → 정적이라 헤매면 도움 안 됨
- 사수 멘토링 → 사수 시간 부담
- 자동 셋업 스크립트 → 권한 작업은 자동화 불가

**가설**: AI가 화면을 보고 동적으로 안내하면, 사람이 옆에 있는 것처럼 자가 진행 가능할 것이다.

---

## 2. 목표 (가설 검증)

### 2.1 MVP의 단일 목표

> **사람의 개입 없이 입사자가 5개 핵심 항목을 P8 AI Vision Coach만으로 완료할 수 있는가?**

5개 핵심 항목 (Pilot 검증 대상):
1. Homebrew 설치 (P2 + P4)
2. Git 글로벌 설정 (P2 + P4)
3. **사내 보안 에이전트 설치** (P5+ + P8 + P4) ← 핵심 시연 항목
4. VPN 프로파일 설정 (P5+ + P8 + P4)
5. Gmail 회사 표준 서명 등록 (P2 + P8)

### 2.2 검증 지표

| 지표 | 측정 방법 | 목표 |
|------|----------|------|
| 자가 완료율 | 5개 항목 모두 사람 개입 없이 완료한 입사자 비율 | 80% 이상 (Pilot 5명 중 4명) |
| AI 안내 정확도 | [📋 안내 요청] 응답이 실제 다음 행동을 정확히 안내한 비율 | 80% 이상 (수동 평가) |
| 단계 검증 정확도 | [✓ 진행 확인] 판정이 실제 단계 완료 여부와 일치한 비율 | 90% 이상 |
| 입사자 만족도 | 5점 척도 설문 | 평균 4점 이상 |
| 입사자당 비용 | Vision API 비용 | $5 이하 |

이 5가지가 모두 만족되면 가설 검증 성공 → Phase 2 진행.
하나라도 실패하면 시스템 재설계 또는 가설 수정.

---

## 3. MVP 스코프

### 3.1 포함 (5가지 자동화 패턴)

| 패턴 | 역할 | 비고 |
|------|------|------|
| **P1 State Probe** | 시작 시점 1회 머신 상태 점검 | 이미 완료된 항목 자동 체크 |
| **P2 Clipboard Inject** | 명령어 클립보드 자동 복사 | 터미널 작업 |
| **P4 Auto Verify** | 결정론적 검증 (command, process_check) | 객관적 판정 |
| **P5+ System Panel Launch** | macOS 시스템 환경설정 패널 자동 진입 | AppleScript / URL 스킴 |
| **P5++ Floating Hint Window** | 운영 중 메인 UI (always-on-top 윈도우) | P8 결과 표시 + 두 버튼 |
| **P8 AI Vision Coach** ⭐ | Claude 3.5 Sonnet Vision으로 화면 분석 + 동적 안내 | MVP 핵심 |

### 3.2 컴포넌트 (3개 패키지만)

```
packages/
├── shared/         # 공통 타입/스키마
├── daemon/         # HTTP 서버 + Vision Coach + State Probe + Clipboard
└── floating-hint/  # Electron 기반 always-on-top 윈도우
```

### 3.3 단일 입사자 단일 머신

MVP는 백엔드 없이 **로컬 단독** 동작. 다른 머신과 동기화 없음. 어드민 없음.

---

## 4. Out of Scope (명시적 제외)

다음은 v0.10에서 의도적으로 제외하며 Phase 2에서 검토한다. 제외 사유 명시.

| 영역 | 제외 사유 |
|------|----------|
| **Chrome Extension (P3 Guided Browser)** | MVP 가설(AI 코칭)과 무관. 사내 도구 자동화는 P2+P8로 대체 가능 |
| **Backend (NestJS, PostgreSQL)** | 단일 머신 검증에 불필요. 다른 머신 동기화/Admin은 Phase 2 |
| **Admin Dashboard** | Pilot 5명은 GitLab Issue로 진행상황 수동 추적 가능 |
| **콘텐츠 작성자 도구 (P6, P7, P7+, P7++)** | 작성자(Tao 본인)가 직접 yaml 편집. AI 텍스트 초안은 ChatGPT/Claude.ai에서 생성 |
| **정적 가이드 (P5 Visual Guide)** | P8이 동적 분석하므로 사전 캡처 불필요 |
| **Web Frontend (체크리스트 UI)** | CLI에서 진행상황 출력 + Floating Hint Window가 메인 UI |
| **온보딩메이트 RAG 챗** | Phase 2 |
| **Slack 알림** | Phase 2 |
| **Windows/Linux 지원** | macOS 전용 |
| **macOS Accessibility API 직접 자동화** | 권한 부여 UX 파괴 + 코드 서명 부담 (archive PRD §13.3.1 6가지 사유 참조) |
| **HRIS 연동, 자동 계정 생성** | Phase 3 |
| **다국어 지원** | 한국어 단일 |

---

## 5. 사용자 시나리오

### 5.1 신규 입사자 시나리오 (단일 시나리오)

**김하나** — 입사 1일차 프론트엔드 신입.

**10:00** 사수가 보낸 메일:
```
안녕하세요. 입사 첫날 환경 설정을 자동화 도구로 진행해주세요.

1. 터미널 열고 다음 한 줄 실행:
   curl -fsSL https://onboarding.wrtn.io/install.sh | sh

2. 설치 완료되면 자동으로 가이드가 시작됩니다.
```

**10:05** 하나가 명령어 실행. 데몬 설치 + Floating Hint Window 등장:

```
┌─────────────────────────────────────┐
│ 🤖 onboarding-agent                  │
│                                      │
│ 환영합니다! 입사 첫날 5가지 항목을    │
│ 함께 진행할게요.                     │
│                                      │
│ ① Homebrew 설치                     │
│ ② Git 설정                          │
│ ③ 사내 보안 에이전트 설치            │
│ ④ VPN 설정                          │
│ ⑤ Gmail 서명 등록                   │
│                                      │
│ [시작하기]                           │
└─────────────────────────────────────┘
```

**10:06 — 항목 ①, ②: P2 + P4** (5분)
- 데몬이 명령어를 클립보드 자동 복사
- 하나가 터미널에서 ⌘V → 실행
- 데몬이 `brew --version`으로 자동 검증 → ✅

**10:11 — 항목 ③ 사내 보안 에이전트 설치 (P5+ + P8)** (15분)

상세 흐름은 archive/PRD-v0.9.1.md §4.3 김하나 시나리오 참조 (15분 타임라인 전체).

핵심: 하나가 헤맬 때마다 [📋 안내 요청] 클릭 → AI가 화면 보고 "여기 클릭하세요" 빨간 박스로 안내.

**10:26 — 항목 ④ VPN 설정** (10분)
- P5+로 시스템 환경설정 → 네트워크 패널 자동 진입
- P8로 단계별 안내
- P4로 `scutil --nc list`로 검증

**10:36 — 항목 ⑤ Gmail 서명** (5분)
- 데몬이 https://mail.google.com 페이지 자동 오픈
- P2로 서명 텍스트(이름/직무/전화) 클립보드 복사
- P8로 "여기 입력란에 ⌘V" 안내
- 사용자가 [저장] 클릭 후 [✓ 진행 확인]
- AI가 화면 보고 "저장 완료됐습니다" 판정

**10:41 — 완료**

```
┌─────────────────────────────────────┐
│ 🎉 모든 항목 완료!                   │
│                                      │
│ 소요 시간: 41분                      │
│ AI 호출: 14회 (~$0.35)               │
│ 사람 개입: 0회                       │
│                                      │
│ Ready to Work 상태로 전환됩니다.      │
└─────────────────────────────────────┘
```

---

## 6. 시스템 구성

### 6.1 아키텍처 (단순)

```
┌──────────────────────────────────────────────────────────┐
│  신규 입사자 MacBook                                       │
│                                                            │
│  ┌──────────────┐   ┌────────────────────────────────┐   │
│  │ onboarding   │──▶│ Local Agent Daemon              │   │
│  │ CLI          │   │  - HTTP server (localhost:7777) │   │
│  └──────────────┘   │  - SQLite                        │   │
│                     │  - P1 State Probe               │   │
│                     │  - P2 Clipboard                 │   │
│                     │  - P4 Auto Verify               │   │
│                     │  - P5+ AppleScript / URL 스킴    │   │
│                     │  - P8 Vision Coach              │   │
│                     │     ↳ Anthropic API client      │   │
│                     │     ↳ screencapture             │   │
│                     │     ↳ Cache + Rate guard        │   │
│                     └─────┬──────────────────────────┘   │
│                           │                              │
│                  ┌────────▼─────────────────┐            │
│                  │ Floating Hint Window     │            │
│                  │ (Electron, always-on-top)│            │
│                  │  [📋 안내 요청]          │            │
│                  │  [✓ 진행 확인]           │            │
│                  │  AI 응답 표시             │            │
│                  │  빨간 박스 오버레이       │            │
│                  └──────────────────────────┘            │
└──────────────────────┬───────────────────────────────────┘
                       │ Claude Vision API 호출
                       ▼
            ┌────────────────────┐
            │ Anthropic API      │
            │ Claude 3.5 Sonnet  │
            │ (사내 화면 전송)    │
            │ 응답 후 즉시 파기   │
            └────────────────────┘

콘텐츠는 데몬에 번들되어 배포 (별도 GitLab webhook 없음, MVP 단순화)
```

### 6.2 컴포넌트 설명

**A. CLI**
- `install.sh`로 curl 한 줄 설치
- `onboarding` 명령으로 데몬 + Floating Hint Window 기동
- 첫 실행 시 Screen Recording 권한 부여 + Anthropic 전송 동의 가이드

**B. Daemon (`packages/daemon`)**
- HTTP 서버 (localhost:7777)
- 모듈: state-probe, clipboard, verify, system-panel, vision-coach
- SQLite로 진행상황, vision 호출 메타데이터, 캐시 관리

**C. Floating Hint Window (`packages/floating-hint`)**
- Electron 기반 always-on-top 반투명 윈도우
- 운영 중 메인 UI
- 데몬 API와 IPC 통신

**D. Shared (`packages/shared`)**
- 공통 TypeScript 타입
- zod 스키마

### 6.3 기술 스택

| 항목 | 선택 |
|------|------|
| 언어 | TypeScript (Node.js 22 LTS) |
| Daemon | Express + better-sqlite3 + zod |
| Floating Hint | Electron 32 |
| Vision | @anthropic-ai/sdk (Claude 3.5 Sonnet) |
| 이미지 처리 | sharp |
| Shell 실행 | execa |
| 빌드/모노레포 | pnpm workspaces |
| 패키저 | Node SEA (Node 22 공식) |
| 테스트 | Vitest + supertest + msw |

---

## 7. 기능 요구사항

### 7.1 기본 동작

| ID | 요구사항 |
|----|---------|
| F-CORE-01 | `curl ... | sh`로 데몬과 Floating Hint Window 자동 설치 |
| F-CORE-02 | 데몬 기동 시 첫 실행이면 Screen Recording 권한 + Anthropic 전송 동의 절차 |
| F-CORE-03 | 콘텐츠는 데몬에 번들된 yaml 사용 (외부 동기화 없음) |
| F-CORE-04 | 진행상황은 SQLite에 로컬 저장 |
| F-CORE-05 | CLI 명령: `onboarding start | status | stop | reset` |

### 7.2 P1 State Probe

| ID | 요구사항 |
|----|---------|
| F-P1-01 | 시작 시 1회 머신 상태 점검 (`brew`, `git`, `node`, `~/.gitconfig` 등) |
| F-P1-02 | 점검 결과를 yaml 항목과 매칭하여 자동 완료 처리 |

### 7.3 P2 Clipboard Inject

| ID | 요구사항 |
|----|---------|
| F-P2-01 | 항목 진입 시 정의된 명령어를 macOS 클립보드에 자동 복사 |
| F-P2-02 | 사용자에게 "터미널에서 ⌘V" 안내 표시 |

### 7.4 P4 Auto Verify

| ID | 요구사항 |
|----|---------|
| F-P4-01 | `command` 검증: shell 명령 실행 → exit code 0이면 PASS |
| F-P4-02 | `process_check` 검증: `pgrep` 결과 PID 반환이면 PASS |
| F-P4-03 | 검증 실패 시 명시적 에러 메시지 |

### 7.5 P5+ System Panel Launch

| ID | 요구사항 |
|----|---------|
| F-P5P-01 | `system_panel_url` 필드 정의 시 데몬이 `open <URL>` 실행 |
| F-P5P-02 | URL 스킴 예시: `x-apple.systempreferences:com.apple.preference.security` |

### 7.6 P5++ Floating Hint Window

| ID | 요구사항 |
|----|---------|
| F-P5PP-01 | always-on-top, 반투명, focusable: false (사용자 입력에 개입 안 함) |
| F-P5PP-02 | 두 버튼: [📋 안내 요청] / [✓ 진행 확인] |
| F-P5PP-03 | AI 응답 텍스트 표시 영역 |
| F-P5PP-04 | 빨간 박스 오버레이 (좌표 기반, 별도 투명 윈도우) |
| F-P5PP-05 | 에러 발생 시 [🔄 재시도] 버튼 |
| F-P5PP-06 | 단계 진행률 (예: "단계 2/3") 미니 표시 |

### 7.7 P8 AI Vision Coach (MVP 핵심)

| ID | 요구사항 |
|----|---------|
| F-P8-01 | macOS `screencapture -x`로 화면 캡처 (메모리 처리) |
| F-P8-02 | Claude 3.5 Sonnet Vision API 호출 |
| F-P8-03 | 두 버튼: 안내 요청 / 진행 확인 (별도 프롬프트 사용) |
| F-P8-04 | 응답에 `highlight_region` 좌표 포함 시 화면에 빨간 박스 |
| F-P8-05 | 검증: AI Vision이 PASS/FAIL/UNCLEAR 직접 판정 |
| F-P8-06 | 가드레일: 1초 debounce / 30초 캐시 / 시간당 100회 알림 / 200회 일시 정지 |
| F-P8-07 | 캡처 이미지: 응답 후 즉시 메모리 파기, 디스크 저장 안 함 |
| F-P8-08 | 동의 미부여 시 차단 + 동의 화면 |
| F-P8-09 | API 실패 시 에러 메시지 + 재시도 버튼 (정적 폴백 없음) |

---

## 8. 데이터 모델

SQLite 단독 (백엔드 PostgreSQL 없음).

### 8.1 SQLite 스키마

```sql
-- 사용자 프로필 (단일)
CREATE TABLE profile (
  employee_id   TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  name          TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);

-- 체크리스트 항목 진행상황
CREATE TABLE item_states (
  item_id       TEXT PRIMARY KEY,
  status        TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'blocked')),
  current_step  TEXT,
  started_at    INTEGER,
  completed_at  INTEGER,
  attempt_count INTEGER DEFAULT 0
);

-- Vision API 호출 로그 (이미지 저장 안 함, 메타데이터만)
CREATE TABLE vision_calls (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id         TEXT NOT NULL UNIQUE,
  item_id         TEXT NOT NULL,
  step_id         TEXT NOT NULL,
  request_type    TEXT NOT NULL CHECK (request_type IN ('guide', 'verify')),
  image_hash      TEXT NOT NULL,
  prompt_tokens   INTEGER,
  output_tokens   INTEGER,
  latency_ms      INTEGER NOT NULL,
  cache_hit       INTEGER DEFAULT 0,
  result_summary  TEXT,
  error           TEXT,
  created_at      INTEGER NOT NULL
);

-- 가드레일 상태
CREATE TABLE rate_limit_buckets (
  bucket_id       TEXT PRIMARY KEY,
  call_count      INTEGER NOT NULL DEFAULT 0,
  alert_sent      INTEGER DEFAULT 0,
  paused          INTEGER DEFAULT 0,
  reset_at        INTEGER NOT NULL
);

-- Vision 응답 캐시 (30초 TTL)
CREATE TABLE vision_cache (
  cache_key       TEXT PRIMARY KEY,
  response_json   TEXT NOT NULL,
  ttl_at          INTEGER NOT NULL
);

-- 사용자 동의 기록
CREATE TABLE consents (
  consent_type    TEXT PRIMARY KEY CHECK (consent_type IN (
                    'screen_recording', 'anthropic_transmission'
                  )),
  granted         INTEGER NOT NULL,
  granted_at      INTEGER,
  revoked_at      INTEGER
);

CREATE INDEX idx_vision_calls_item ON vision_calls(item_id, step_id);
CREATE INDEX idx_vision_calls_created ON vision_calls(created_at);
CREATE INDEX idx_vision_cache_ttl ON vision_cache(ttl_at);
```

### 8.2 데이터 보존 정책 (필수)

| 데이터 | 위치 | 보존 기간 |
|--------|------|----------|
| 캡처 이미지 (raw) | 메모리만 | API 응답 후 즉시 파기 |
| 임시 캡처 파일 | 디스크 (`/tmp/`) | 캡처 ~ API 응답 (수 초) |
| Vision API 메타데이터 | SQLite | 30일 |
| API 응답 텍스트 | SQLite (캐시) | 30초 (TTL) |
| 사용자 동의 | SQLite | 영구 |

---

## 9. API 계약

### 9.1 Daemon API (`http://localhost:7777`)

#### 9.1.1 체크리스트 조회

```
GET /api/checklist
Response 200:
{
  "items": [
    { "item_id": "install-homebrew", "status": "pending", ... }
  ]
}
```

#### 9.1.2 항목 시작

```
POST /api/items/:itemId/start
Response 200: { "ok": true }
```

#### 9.1.3 P8 Vision Coach - 안내 요청 (MVP 핵심)

```
POST /api/vision/guide
Request: { "item_id": "...", "step_id": "..." }

Response 200:
{
  "call_id": "vc_...",
  "cached": false,
  "latency_ms": 2840,
  "result": {
    "type": "guide",
    "message": "화면 좌측 잠금 아이콘을 클릭하세요",
    "highlight_region": { "x": 24, "y": 480, "width": 32, "height": 32 },
    "confidence": "high"
  }
}

Response 401: { "error": "screen_recording_permission_required" }
Response 403: { "error": "consent_required" }
Response 429: { "error": "rate_limit_exceeded", "state": "paused", "reset_at": ... }
Response 503: { "error": "vision_api_timeout" }
```

#### 9.1.4 P8 Vision Coach - 진행 확인

```
POST /api/vision/verify
Request: { "item_id": "...", "step_id": "..." }

Response 200:
{
  "call_id": "vc_...",
  "result": {
    "type": "verify",
    "status": "pass" | "fail" | "unclear",
    "reasoning": "...",
    "next_action_hint": "..."
  }
}
```

#### 9.1.5 가드레일 상태

```
GET /api/vision/rate-limit
Response 200: { "current_hour_calls": 47, "state": "normal", "reset_at": ... }
```

#### 9.1.6 동의 등록/조회

```
POST /api/consents
Request: { "consent_type": "anthropic_transmission", "granted": true }

GET /api/consents
Response: { "screen_recording": {...}, "anthropic_transmission": {...} }
```

#### 9.1.7 P2 Clipboard

```
POST /api/clipboard
Request: { "command": "..." }
Response 200: { "ok": true }
```

#### 9.1.8 P4 Verify

```
POST /api/verify/run
Request: { "item_id": "...", "verification": {...} }
Response 200: { "status": "pass" | "fail", "details": "..." }
```

---

## 10. Acceptance Criteria

### 10.1 핵심 기능 AC

**AC-CORE-01**: 설치 → 첫 실행
- **Given**: 사용자가 `curl ... | sh` 실행
- **When**: 설치 완료 후 `onboarding` 명령
- **Then**: 데몬 + Floating Hint Window 기동, Screen Recording 권한 가이드 표시

**AC-CORE-02**: 동의 절차
- **Given**: 첫 실행
- **When**: 사용자가 Anthropic 전송 동의 버튼 클릭
- **Then**: SQLite consents 테이블에 기록, 다음부터 안 물음

### 10.2 P8 AI Vision AC (MVP 핵심)

**AC-VIS-01**: 안내 요청 정상 흐름
- **Given**: Screen Recording 권한 + Anthropic 동의 모두 부여됨
- **When**: [📋 안내 요청] 버튼 클릭
- **Then**:
  1. 5초 이내 응답 (P95)
  2. `message` 텍스트 + `highlight_region` 좌표 포함
  3. SQLite vision_calls에 메타데이터 기록
  4. 캡처 이미지가 디스크/메모리에 남지 않음

**AC-VIS-02**: 진행 확인 - PASS
- **Given**: 사용자가 단계 X를 완료한 화면
- **When**: [✓ 진행 확인] 클릭
- **Then**: AI 응답 `status: "pass"` + 항목 자동 completed 전환

**AC-VIS-03**: 진행 확인 - FAIL
- **Given**: 사용자가 단계 미완료 화면
- **When**: [✓ 진행 확인] 클릭
- **Then**: AI 응답 `status: "fail"` + `next_action_hint` 제공 + 항목 in_progress 유지

**AC-VIS-04**: 캐시 동작
- **Given**: 동일 화면 30초 내 재호출
- **When**: 두 번째 호출
- **Then**: `cached: true`, latency 100ms 미만, Anthropic API 미호출

**AC-VIS-05**: 가드레일 일시 정지
- **Given**: 시간당 200회 호출 누적
- **When**: 201번째 호출
- **Then**: HTTP 429 + `state: "paused"`, 다음 시간대까지 모든 Vision 호출 거부

**AC-VIS-06**: API 실패 폴백
- **Given**: Anthropic API 타임아웃
- **When**: 호출 시도
- **Then**: HTTP 503 + Floating Hint Window에 [🔄 재시도] 버튼 표시

**AC-VIS-07**: 이미지 데이터 파기
- **Given**: 임의 Vision API 호출 완료 후 1초 경과
- **When**: 디스크/메모리 검사
- **Then**: `/tmp/onboarding-capture-*.png` 0개, vision_calls에 binary/base64 없음

**AC-VIS-08**: 응답 지연 P95
- **Given**: 100회 호출 (캐시 제외)
- **When**: 응답 시간 측정
- **Then**: P50 ≤ 3초, P95 ≤ 5초

**AC-VIS-09**: Floating Hint Window 비간섭
- **Given**: Floating Hint Window가 떠 있음
- **When**: 사용자가 시스템 환경설정에서 클릭/타이핑
- **Then**: 사용자 입력이 외부 앱에 정상 전달, Hint Window는 포커스 빼앗지 않음

### 10.3 결정론 자동화 AC

**AC-P1-01**: 머신 상태 점검
- **Given**: brew, git이 이미 설치됨
- **When**: 시작 시 P1 실행
- **Then**: 두 항목 자동으로 completed 처리

**AC-P2-01**: 클립보드 주입
- **Given**: 항목 진입
- **When**: 사용자가 ⌘V
- **Then**: 정의된 명령어가 붙여넣어짐

**AC-P4-01**: command 검증
- **Given**: `verification.command: "brew --version"`
- **When**: 사용자가 brew 설치 후 verify 호출
- **Then**: exit code 0 → PASS, 0이 아니면 FAIL

**AC-P5P-01**: 시스템 패널 자동 진입
- **Given**: `system_panel_url: "x-apple.systempreferences:com.apple.preference.security"`
- **When**: 항목 진입
- **Then**: 시스템 환경설정의 보안 패널이 자동으로 열림

### 10.4 통합 시나리오 AC

**AC-INT-01**: 5개 항목 E2E (Pilot 검증 핵심)
- **Given**: 신규 입사자가 깨끗한 macOS에서 시작
- **When**: 5개 항목을 순서대로 진행
- **Then**:
  1. 사람 개입 없이 모두 completed
  2. 총 비용 $5 이하
  3. 총 소요 시간 60분 이하

---

## 11. 콘텐츠 스키마

`packages/daemon/content/checklist.yaml` (번들).

```yaml
version: 2
schema: ai-coaching

items:
  # 항목 1: P2 + P4
  - id: install-homebrew
    title: Homebrew 설치
    estimated_minutes: 3

    clipboard_inject:
      command: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
      ui_hint: "터미널을 열고 ⌘V로 붙여넣어 실행하세요"

    verification:
      type: command
      command: brew --version
      poll_interval_sec: 5

  # 항목 2: P2 + P4
  - id: configure-git
    title: Git 글로벌 설정
    estimated_minutes: 1

    inputs:
      - key: git_name
        label: Git 사용자 이름
        required: true
      - key: git_email
        label: Git 이메일
        required: true

    clipboard_inject:
      command: |
        git config --global user.name "{{inputs.git_name}}" && \
        git config --global user.email "{{inputs.git_email}}"

    verification:
      type: command
      command: git config --global user.email
      expect_contains: "{{inputs.git_email}}"

  # 항목 3: P5+ + P8 + P4 (MVP 핵심 시연)
  - id: install-security-agent
    title: 사내 보안 에이전트 설치
    estimated_minutes: 15

    ai_coaching:
      overall_goal: |
        사용자가 사내 보안 에이전트(.pkg)를 다운로드하고 설치한 뒤,
        시스템 환경설정에서 권한을 부여하고 백그라운드 프로세스가 실행되도록 한다.

      steps:
        - id: download
          intent: |
            security.wrtn.io/download 페이지에서 .pkg 파일을 다운로드한다.
          success_criteria: |
            ~/Downloads 폴더에 SecurityAgent-*.pkg 파일이 존재한다.

        - id: install
          intent: |
            .pkg 파일을 더블클릭해서 설치 마법사를 진행한다.
            관리자 비밀번호 입력이 필요하다.
          success_criteria: |
            /Applications/SecurityAgent.app 디렉토리가 존재한다.

        - id: grant_permission
          intent: |
            시스템 환경설정 → 개인정보 보호 및 보안에서
            SecurityAgent에 디스크 접근 권한을 부여한다.
          system_panel_url: x-apple.systempreferences:com.apple.preference.security
          success_criteria: |
            pgrep SecurityAgent 결과가 PID를 반환한다.
          common_mistakes: |
            - 잠금 해제 안 한 채 클릭 시도
            - SecurityAgent가 PrivilegedHelperTools 폴더에 있어 일반 Applications 폴더에서 못 찾음

    verification:
      type: process_check
      process_name: SecurityAgent
      poll_interval_sec: 5

  # 항목 4: P5+ + P8 + P4
  - id: setup-vpn
    title: 사내망 VPN 설정
    estimated_minutes: 10

    clipboard_inject:
      command: 'open https://vpn.wrtn.ax/profile'
      ui_hint: "VPN 프로파일 다운로드 페이지가 열립니다"

    ai_coaching:
      overall_goal: "VPN 프로파일을 macOS에 등록하고 연결 가능 상태로"
      steps:
        - id: download_profile
          intent: ".mobileconfig 파일 다운로드"
          success_criteria: "~/Downloads에 wrtn-vpn.mobileconfig 존재"

        - id: install_profile
          intent: "다운로드된 파일을 더블클릭하여 시스템 환경설정으로 가져오기"
          system_panel_url: x-apple.systempreferences:com.apple.preferences.configurationprofiles
          success_criteria: "프로파일 목록에 WRTN VPN 표시"

    verification:
      type: command
      command: scutil --nc list
      expect_contains: "WRTN VPN"

  # 항목 5: P2 + P8 (Gmail 서명)
  - id: setup-gmail-signature
    title: Gmail 회사 표준 서명 등록
    estimated_minutes: 5

    inputs:
      - key: job_title
        label: 직무
        required: true
      - key: phone
        label: 전화번호
        required: true

    clipboard_inject:
      command: 'open https://mail.google.com/mail/u/0/#settings/general'
      ui_hint: "Gmail 설정 페이지가 열립니다"

    template:
      content: |
        {{user_profile.name}}
        {{inputs.job_title}}
        Wrtn Technologies
        Tel: {{inputs.phone}}
      paste_target: "Gmail 서명 입력란에 ⌘V로 붙여넣기"

    ai_coaching:
      overall_goal: "Gmail 설정의 서명 영역에 회사 표준 서명을 등록"
      steps:
        - id: navigate_to_signature
          intent: "Gmail 설정에서 '서명' 영역까지 스크롤"
          success_criteria: "화면에 '서명' 헤더와 [+ 새로 만들기] 버튼이 보임"

        - id: input_signature
          intent: "[+ 새로 만들기]로 서명 추가, 클립보드 내용 붙여넣기, 기본 서명으로 지정"
          success_criteria: "서명 미리보기에 사용자 이름이 표시되고 기본 서명 드롭다운에 선택됨"

        - id: save
          intent: "페이지 하단 [변경사항 저장] 버튼 클릭"
          success_criteria: "변경사항 저장 알림 표시"
```

---

## 12. 라이브러리 (확정)

작은 패키지 셋이라 단일 표로 정리.

| 라이브러리 | 버전 | 사용 위치 | 용도 |
|-----------|------|----------|------|
| express | ^4.19 | daemon | HTTP 서버 |
| better-sqlite3 | ^11.0 | daemon | 로컬 DB |
| zod | ^3.23 | shared, daemon | 스키마 검증 |
| @anthropic-ai/sdk | ^0.30 | daemon | Claude Vision API |
| sharp | ^0.33 | daemon | 이미지 리사이즈/hash |
| execa | ^9.0 | daemon, cli | shell 명령 |
| yaml | ^2.4 | daemon | checklist.yaml 파싱 |
| pino | ^9.0 | daemon | 로깅 |
| commander | ^12.0 | cli | CLI 프레임워크 |
| @inquirer/prompts | ^5.0 | cli | 인터랙티브 입력 |
| picocolors | ^1.0 | cli | 색상 출력 |
| ora | ^8.0 | cli | 스피너 |
| electron | ^32.0 | floating-hint | always-on-top 윈도우 |
| vitest | ^2.0 | 모든 패키지 | 테스트 |
| supertest | ^7.0 | daemon | API 테스트 |
| msw | ^2.4 | daemon (테스트) | Anthropic API 모킹 |
| typescript | ^5.5 | 모든 패키지 | 언어 |
| pnpm | ^9.0 | 워크스페이스 | 모노레포 |
| Node SEA + postject | Node 22 LTS | cli (빌드) | 단일 바이너리 |

신규 라이브러리 추가는 PRD 개정 필요 (BOUNDARIES.md 참조).

---

## 13. 마일스톤

**MVP 6주 전체 일정**:

| 주차 | 산출물 |
|------|-------|
| W1 | 기본 구조 (shared 패키지, daemon 스켈레톤, CLI 스켈레톤) |
| W2 | P1 State Probe + P2 Clipboard + P4 Verify (결정론 자동화 3종) |
| W3 | P5+ System Panel + Floating Hint Window 기본 구조 |
| W4 | P8 AI Vision Coach 통합 (Vision API + 좌표 파싱 + 캐시) |
| W5 | 가드레일 + 동의 UX + 콘텐츠 yaml 5개 항목 작성 |
| W6 | 통합 테스트 + 프롬프트 튜닝 + Pilot 준비 |

**Pilot (별도)**: 2주
**GA**: 2주

---

## 14. 리스크 & 오픈 이슈

### 14.1 핵심 리스크

| 리스크 | 영향 | 완화 |
|--------|------|------|
| Anthropic 사내 정책 거부 | MVP 무산 | Pilot 전 보안팀/법무팀 사전 승인 필수 |
| AI 응답 지연 사용자 답답함 | UX 저하 | 로딩 인디케이터 + 30초 캐시 + P95 5초 SLA |
| AI 좌표 정확도 80% 미만 | 가설 검증 실패 | 프롬프트 튜닝, Pilot 후 데이터 분석 |
| Screen Recording 권한 거부 | P8 사용 불가 | P1+P2+P4 결정론 자동화는 정상, 사용자에게 명시 |
| Vision API 비용 초과 | 운영비 부담 | 가드레일 (200회/시간 정지) + 가설 실패 시 시스템 자체 재고 |

### 14.2 오픈 이슈 (Pilot 전 해결)

1. **Anthropic API 외부 전송 사내 정책 사전 승인** — 보안팀/법무팀
2. **Anthropic API 키 발급 및 비용 청구 주체** — IT팀
3. **AI 잘못된 안내로 사고 발생 시 책임** — 법무팀
4. **Pilot 입사자 5명 모집** — 인사팀
5. **첫 5개 항목 yaml 작성 (Tao 본인 + 보안팀 검수)**

---

## 부록 A. 용어

- **P1 State Probe**: 머신 상태 자동 점검
- **P2 Clipboard Inject**: 명령어 클립보드 주입
- **P4 Auto Verify**: 결정론적 자동 검증
- **P5+ System Panel Launch**: macOS 시스템 환경설정 패널 자동 진입
- **P5++ Floating Hint Window**: always-on-top 반투명 가이드 윈도우
- **P8 AI Vision Coach**: Claude Vision으로 화면 분석 + 동적 안내 (MVP 핵심)
- **Floating Hint Window**: 운영 중 메인 UI. 두 버튼([📋 안내 요청] / [✓ 진행 확인])과 AI 응답을 표시
- **명시 트리거**: 사용자가 버튼 클릭 시에만 Vision API 호출 (자동 폴링 없음)
- **가드레일**: debounce, 캐시, 시간당 호출 임계값으로 비용 폭증 방지
- **MVP-Slim**: 가설 검증 최소 시스템. Phase 2에서 Backend, Admin, Extension, 작성자 도구 등 추가

---

## 부록 B. v0.9.1과의 차이

archive/PRD-v0.9.1.md (3677줄, 풀 버전)에서 다음을 제외하여 v0.10 (이 문서, ~1000줄)을 만들었다.

| 영역 | v0.9.1 | v0.10 |
|------|--------|-------|
| Chrome Extension (P3) | 있음 | 제외 |
| Backend (NestJS+PostgreSQL) | 있음 | 제외 |
| Admin Dashboard | 있음 | 제외 |
| Web Frontend (체크리스트 UI) | 있음 | 제외 (Floating Hint가 메인 UI) |
| 작성자 도구 (P6, P7, P7+, P7++) | 있음 | 제외 |
| 정적 가이드 (P5 Visual Guide) | 있음 | 제외 |
| 콘텐츠 GitLab Webhook | 있음 | 제외 (yaml 번들) |
| Ralph 작업 방식 (§18) | 311줄 | 별도 RALPH.md (선택) |
| 라이브러리 카탈로그 (§19) | 264줄 | §12 단일 표로 압축 |
| 통합 검증 (§18.14) | 있음 | 제외 (단일 패키지 셋이라 불필요) |
| 자동화 패턴 | 8가지 | 5가지 |
| 패키지 수 | 7개 | 3개 |
| Wave 수 | 5 | N/A (단일 흐름) |
| 개발 일정 | 12주 | 6주 |

가설 검증 후 Phase 2에서 archive 풀 버전을 다시 꺼내 추가 기능을 통합한다.

---

**END of PRD v0.10 MVP-Slim**
