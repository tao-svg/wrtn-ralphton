# BOUNDARIES — Ralph 작업 경계

> **상태**: v1.0 (2026-05-01)
> **대상**: Ralph (자동 구현 에이전트) 및 모든 자동/수동 기여자
> **권위 문서**: [docs/PRD-MVP-SLIM.md](docs/PRD-MVP-SLIM.md) v0.10

이 문서는 Ralph가 spec을 실행할 때 **절대 넘지 말아야 할 경계**를 정의한다. PRD가 "무엇을 만들지"라면, 이 문서는 "무엇을 건드리지 말지"이다.

---

## 0. 매 iteration 시작 시 필수 절차

Ralph는 spec 한 건을 시작할 때마다 **가장 먼저 이 파일을 읽어야 한다**. 이는 선택이 아니다.

읽는 시점:
1. spec 파일을 열기 직전
2. 코드 변경을 시작하기 전
3. 의존성(`package.json`)을 수정하기 직전 (재확인)

읽지 않고 진행한 변경은 **무효**이며 되돌려야 한다. 매 iteration마다 컨텍스트가 초기화되므로 "지난번에 읽었다"는 핑계는 성립하지 않는다.

---

## 1. 수정 금지 파일/디렉토리 (Read-Only)

다음 경로는 Ralph가 **어떤 이유로도 수정·삭제·이동할 수 없다**. 읽기는 자유.

| 경로 | 사유 |
|------|------|
| `docs/PRD.md`, `docs/PRD-MVP-SLIM.md` | 모든 spec의 권위 원천. 변경은 사람(Tao)의 PRD 개정 절차로만. |
| `docs/archive/` | v0.9.1 풀 버전 등 역사 기록. 불변. |
| `BOUNDARIES.md` (이 파일) | 자기 수정 금지. 경계는 사람만 갱신. |
| `spec-template.md` | spec 작성 표준. 작업 중 변형 금지. |
| `specs/spec-templete.md` | (오타 포함 그대로) 위와 동일 사유. |
| `.git/` | 버전 관리 메타데이터. 손대면 히스토리 손상. |
| `specs/spec-NNN-*.md` (자기 spec 외) | 다른 spec의 정의 변경 금지. |

위 경로 중 하나라도 변경이 필요하다고 판단되면 즉시 작업을 멈추고 사람에게 보고한다.

---

## 2. spec 외 패키지 경로 수정 금지

각 spec은 **하나의 패키지 경로**(`packages/<package>/`)를 명시한다(`spec-template.md` 메타 §"패키지 경로"). Ralph는 그 경로 내부만 수정한다.

허용 행위:
- 자기 spec의 `packages/<package>/src/**`, `packages/<package>/tests/**` 작성·수정
- 자기 spec의 `packages/<package>/package.json` 의존성 추가 — 단 §3 카탈로그 한정
- 루트 워크스페이스 설정(`pnpm-workspace.yaml`, 루트 `package.json`)은 **읽기만**, 변경은 spec이 명시할 때만

금지 행위:
- 다른 패키지 디렉토리(`packages/<other>/`) 수정
- 다른 spec이 만든 파일 수정 (선행 spec 산출물은 인터페이스 사용만, 내부 구현 변경 금지)
- 패키지 외부 공통 설정(`tsconfig.base.json`, `.eslintrc`, CI 워크플로 등) 변경 — spec이 명시적으로 허용한 경우 제외

타 패키지에 결함이 있으면 새 spec을 요청해야지 임의로 고치지 않는다.

---

## 3. 신규 외부 의존성 사전 허용 목록

다음 표 외의 npm/pip/brew 의존성은 **추가 금지**이다. PRD §12를 그대로 옮긴 화이트리스트:

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

규칙:
- **메이저 버전 변경 금지**. `^` 범위 내 마이너/패치 업그레이드는 가능하나 가급적 spec이 요구할 때만.
- **신규 라이브러리는 PRD §12 개정 후에만 추가**. 표에 없는 패키지가 필요하면 작업을 멈추고 사람에게 PRD 갱신을 요청한다.
- 표준 라이브러리(`node:fs`, `node:crypto`, `node:child_process` 등)는 자유롭게 사용.
- transitive dependency는 위 패키지가 끌고 오는 한 허용. 단 직접 `import`하지 않는다.

---

## 4. Breaking Change 금지 — API 계약 보호

PRD **§9 API 계약**(Daemon `http://localhost:7777` 라우트, 요청/응답 스키마, 에러 코드)은 모든 패키지가 의존하는 인터페이스다. Ralph는 다음을 변경할 수 없다.

금지 항목:
- 라우트 경로 추가·변경·삭제 (`/api/checklist`, `/api/items/:itemId/start`, `/api/vision/guide`, `/api/vision/verify`, `/api/vision/rate-limit`, `/api/consents`, `/api/clipboard`, `/api/verify/run`)
- 요청/응답 JSON 필드의 이름·타입·필수 여부 변경
- HTTP 상태 코드 의미 변경 (200/401/403/429/503 매핑)
- SQLite 스키마(PRD §8.1)의 컬럼 추가·변경·삭제 — 마이그레이션은 별도 spec으로
- 데이터 보존 정책(PRD §8.2)의 기간·위치 변경
- `shared` 패키지 export된 타입·zod 스키마의 호환성 깨는 변경

허용:
- API 내부 구현(핸들러 코드, DB 쿼리)의 자유 리팩터
- 응답 시간 단축, 에러 메시지 개선 등 관찰 가능한 계약을 깨지 않는 변경

계약 변경이 필요해 보이면 **PRD §9 개정이 선행**되어야 한다. Ralph는 PRD를 못 고치므로 작업을 멈추고 사람에게 보고한다.

---

## 5. 시크릿 하드코딩 금지

다음 값은 **소스 코드·테스트·yaml·문서 어디에도** 평문으로 남기지 않는다.

| 항목 | 출처 | 코드에서의 접근 |
|------|------|----------------|
| Anthropic API 키 | 사용자가 첫 실행 시 입력 → OS keychain 또는 환경변수 | `process.env.ANTHROPIC_API_KEY` 등 명시적 환경변수 |
| 사용자 개인정보(이메일, 이름, 전화) | 런타임 입력 → SQLite `profile` 테이블 | DB 조회 |
| 사내 URL 중 비공개(`vpn.wrtn.ax/profile`, `security.wrtn.io/download`) | yaml 콘텐츠 | yaml은 OK이나 코드 상수 박제 금지 |
| 내부 인증 토큰·세션 쿠키 | 발생 시 메모리만, 즉시 파기 | — |
| 캡처 이미지 raw / base64 | 메모리 → API 응답 후 즉시 파기 (PRD AC-VIS-07) | 디스크/DB 저장 금지 |

규칙:
- `.env`, `.env.local`은 git ignore. 예시 값은 `.env.example`로만.
- 테스트 픽스처에 실키 형태(`sk-ant-...`)의 더미라도 금지. `test-key-placeholder`처럼 명백히 가짜인 문자열을 사용.
- 로그(pino)에 키·토큰·이메일·캡처 binary가 흘러가지 않도록 redact 설정.
- 커밋 직전 `git diff`로 점검. 의심되면 커밋하지 않는다.

---

## 6. 위반 시 행동

Ralph가 이 경계 중 하나라도 어길 위험을 감지하면:

1. 해당 변경을 **적용하지 않는다**.
2. 작업 로그에 어느 §를 어겼는지 기록한다.
3. 사람의 판정을 기다린다 (자동 재시도 금지).

`<promise>SPEC_NNN_*_IMPL_DONE</promise>` 신호는 BOUNDARIES.md를 모두 만족한 경우에만 출력한다.

---

## 7. 참조

- 권위 PRD: [docs/PRD-MVP-SLIM.md](docs/PRD-MVP-SLIM.md) §8(데이터), §9(API), §12(라이브러리)
- spec 구조: [spec-template.md](spec-template.md)
- 현재 spec 목록: [specs/INDEX.md](specs/INDEX.md)
