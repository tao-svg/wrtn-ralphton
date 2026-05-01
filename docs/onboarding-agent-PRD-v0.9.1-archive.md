# PRD: 온보딩 에이전트 시스템 (Onboarding Agent)

> **상태**: Draft v0.9.1
> **작성일**: 2026-04-30
> **작성자**: Tao
> **타겟 릴리즈**: MVP
>
> **변경 이력**
> - v0.9.1: **자체 점검 후 정합성 보강** — §7 P8 비기능 요구사항(응답시간/캐시/비용/가용성), §10.1 Anthropic 용도에 P8 명시, §10.3 screencapture + Screen Recording 권한, §10.4 P8 라이브러리(@anthropic-ai/sdk, sharp), §13.1 P8 영역 추가, §13.4 핵심 UX 5가지로 갱신, §13.5 Vision 리스크 6건, §15 P8 KPI 6건, §16 v0.9 리스크 5건/오픈이슈 4건 추가
> - v0.9: **방향 전환 — AI 비전 기반 동적 가이드 시스템(P8 AI Vision Coach)**. 정적 가이드(P5/P5++) 보조 역할로 격하, 콘텐츠 작성 도구(P6/P7+) 폐기. 작성자가 자연어 intent만 입력하면 AI가 화면 분석 후 동적 안내. Floating Hint Window가 운영 중 메인 UI로 격상.
> - v0.8: §2 목적에 콘텐츠 작성자 관점 추가 / §6.3에 P5/P5+/P5++/P6/P7/P7+/P7++ 패턴 추가 / §13.3.1 macOS Accessibility 명시적 제외 근거 / §14 MVP 스코프 확장 / §17 마일스톤 7.5주 / §18.10 Wave 5 추가 / §19.20~26 라이브러리 추가
> - v0.7: 라이브러리 카탈로그(19절) 추가 — 12개 영역의 라이브러리 결정사항 명시
> - v0.6: 통합 검증(18.14) 추가 — Wave 종료 시점 Integration Ralph, Mock 서비스 관리
> - v0.5: 개발 작업 방식(18절) 추가 — Plan/Impl/Review 3단계 모델, Worktree 기반 병렬 Ralph, 인적 작업 분리
> - v0.4: Ralph 자동 개발 대비 보강 — 기술 스택, 디렉토리 구조, Acceptance Criteria, 데이터 모델, API 계약, 외부 의존성 섹션 추가
> - v0.3: POC 테스트 케이스(Gmail 서명 등록) 추가, Guided Browser 시나리오 상세화
> - v0.2: 자동화 실현 가능성 분석 및 자동화 패턴 섹션 추가, Chrome Extension 옵션 반영
> - v0.1: 초안 작성

---

## 목차

1. 배경 (Background)
2. 목표 (Goals)
3. 사용자 (Users & Personas)
4. 핵심 사용 시나리오 (User Flow)
5. 시스템 구성 (System Architecture)
   - 5.1 컴포넌트 설명
   - 5.2 기술 스택 결정사항 ⭐
   - 5.3 디렉토리 구조 ⭐
   - 5.4 컴포넌트와 코드 매핑 ⭐
6. 기능 요구사항 (Functional Requirements)
7. 비기능 요구사항 (Non-Functional Requirements)
8. 데이터 모델 (Data Model) ⭐
9. API 계약 (API Contracts) ⭐
10. 외부 의존성 (External Dependencies) ⭐
11. Acceptance Criteria (검증 시나리오) ⭐
12. 콘텐츠 정의 예시 (Content Schema)
13. 자동화 실현 가능성 분석 (Automation Feasibility)
14. MVP 스코프
15. 성공 지표 (Success Metrics)
16. 리스크 & 오픈 이슈
17. 마일스톤 (Tentative)
18. 개발 작업 방식 (Development Workflow) ⭐
19. 라이브러리 카탈로그 (Library Catalog) ⭐
- 부록 A. 용어 정의

> ⭐ = v0.4/v0.5/v0.6/v0.7에서 신규/대폭 보강된 섹션 (Ralph 자동 개발용)

---

## 1. 배경 (Background)

### 1.1 문제 정의

현재 사내 신규 입사자 온보딩 프로세스는 다음과 같은 문제를 가지고 있다.

- 온보딩 자료(문서, 가이드)는 제공되지만, 신규 입사자가 실제로 그 내용을 따라 진행했는지 **검증할 수 없다**.
- 진행 여부 확인을 위해 매번 **사람(사수, 팀장, 인사담당)이 옆에 붙어 일일이 체크**해야 한다.
- 입사자는 어디까지 진행했는지, 무엇이 남았는지 스스로 추적하기 어렵다.
- 개발 환경 셋업, 보안 프로그램 설치, 팀 도구 가입 등 단계가 많고 산발적이다.
- 결과적으로 입사 후 **첫 작업 가능 상태(Ready-to-Work)** 까지 도달하는 시간이 들쭉날쭉하고, 누락된 항목이 뒤늦게 발견되는 경우가 잦다.

### 1.2 해결 방향

신규 입사자가 **로컬 머신에서 단일 명령어로 실행할 수 있는 에이전트 시스템**을 제공하여,

- 체크리스트 기반으로 온보딩을 자가 진행하고,
- 각 항목을 에이전트가 자동/반자동으로 도와주며,
- 진행 상황이 관리자(인사팀/팀장)에게 실시간 가시화되도록 한다.

---

## 2. 목표 (Goals)

### 2.1 Primary Goals

본 시스템은 두 그룹의 사용자가 동시에 만족해야 한다.

**입사자 관점**

1. **자가 진행 가능한 온보딩**: 신규 입사자가 사람의 개입 없이 80% 이상의 온보딩 항목을 스스로 완료할 수 있다.
2. **명확한 Ready-to-Work 정의**: 모든 필수 체크리스트가 완료된 시점을 시스템이 객관적으로 판정한다.
3. **낮은 설치 허들**: 단일 curl 명령어 한 줄로 시스템을 가져올 수 있다.

**관리자/콘텐츠 작성자 관점**

4. **관리자 가시성**: 인사팀/팀장이 별도 어드민 대시보드에서 입사자별 진행률을 실시간 확인할 수 있다.
5. **콘텐츠 작성/유지보수 효율성**: 콘텐츠 작성자가 가이드를 만들고 갱신하는 부담을 최소화한다.
   - 신규 항목의 시각 가이드 작성 시간 30분 이내
   - 외부 사이트 UI 변경 감지를 시스템이 보조
   - 입사자 데이터 기반 우선순위 자동 식별

### 2.2 Non-Goals (이번 범위에서 제외)

- HRIS(인사 시스템)와의 직접 연동 (입사자 계정 자동 생성 등)
- 워크스테이션 권한이 필요한 작업의 자동 실행 (SSH 키 등록, sudo 설치 등은 **명령어 안내만** 제공하고 사용자가 직접 실행)
- **macOS Accessibility API를 활용한 자동 클릭/입력 자동화** (권한 허들 + 코드 서명 부담 + 유지보수 비용으로 명시적 제외 — §13.3 참조)
- 모바일 앱 형태의 클라이언트
- Windows / Linux 클라이언트 지원 (MVP는 macOS 한정)

---

## 3. 사용자 (Users & Personas)

### 3.1 Primary User: 신규 입사자

- macOS(주로 MacBook) 사용
- 개발자 또는 개발 인접 직군 (DevOps, PM 등)
- 사내 도구(GitLab, Infisical, Windmill, Slack 등) 첫 사용
- CLI 사용에 거부감이 적음

### 3.2 Secondary User: 인사팀 / 팀장 / 사수

- 입사자별 진행 상황을 모니터링하는 입장
- 어디서 막혔는지, 도움이 필요한 시점은 언제인지 알고 싶음
- 온보딩 콘텐츠를 직접 작성/수정하는 주체이기도 함 (GitLab 레포에 마크다운 PR)

---

## 4. 핵심 사용 시나리오 (User Flow)

### 4.1 신규 입사자 시나리오

1. 입사 첫날, 인사팀이 사내 위키 또는 환영 메일로 단일 설치 명령어 전달
   ```bash
   curl -fsSL https://onboarding.wrtn.ax/install.sh | sh
   ```
2. 설치 완료 후 터미널에 `onboarding` 입력 → 로컬에서 에이전트 데몬이 기동되고 자동으로 브라우저가 `http://localhost:PORT` 로 열림
3. 첫 진입 시 사번/이메일 인증 → 직군별 체크리스트 로드 (예: "프론트엔드 개발자 - 신입")
4. 체크리스트 항목을 순서대로 또는 자유롭게 진행
   - 각 항목 클릭 시 상세 가이드, 자동화 버튼, 챗 도움말이 우측 패널에 표시
   - 권한 필요 작업은 **복사 가능한 명령어**로 안내
   - 웹 기반 작업(예: Infisical 가입, GitLab SSH 키 등록)은 Playwright 플러그인이 브라우저를 자동 조작하며 단계별 안내
5. 막히는 부분은 우측 챗창의 **온보딩메이트**에게 질문 (GitLab 레포 마크다운 문서를 RAG 베이스로 답변)
6. 모든 필수 항목 완료 시 "Ready-to-Work" 상태로 전환되고 인사팀에 알림 발송

### 4.2 관리자 시나리오

1. 어드민 대시보드(`https://onboarding-admin.wrtn.ax`)에 SSO로 접속
2. 현재 온보딩 진행 중인 입사자 목록과 항목별 진행률 확인
3. 특정 입사자가 오래 멈춰있는 항목 알림 수신 → 개입 시점 판단
4. 온보딩 콘텐츠 수정이 필요하면 GitLab 레포에 PR

### 4.3 v0.9 시나리오: 신규 입사자 김하나의 보안 에이전트 설치 (P8 활용)

본 시나리오는 v0.9의 **AI Vision Coach (P8)** 를 활용한 가장 대표적인 사용자 경험을 보여준다.

**배경**
- 김하나, 입사 1일차 프론트엔드 신입
- 보안 에이전트 설치는 이전에 헤맸던 항목 (P7++ Bottleneck Top 1)
- 작성자(인사팀)는 자연어 intent만 작성한 상태 (스크린샷 미준비)

#### 📅 10:30 — 보안 에이전트 항목 진입

하나는 frontend(localhost:7777)에서 "사내 보안 에이전트 설치" 항목 시작 클릭. 데몬이 데이터 보내고:

```
Frontend 화면:
"이 항목은 시스템 환경설정 작업이 포함됩니다.
 화면 위에 가이드 윈도우가 나타나서 도와드릴게요.
 [시작하기]"
```

[시작하기] 클릭하자 **Floating Hint Window**가 화면 우측 상단에 떠오른다.

```
┌────────────────────────────────────────┐
│ 🤖 보안 에이전트 설치                    │
│ 단계 1/3: 다운로드                       │
│                                          │
│ "security.wrtn.io에서 .pkg 파일을        │
│  다운로드해주세요"                       │
│                                          │
│ ⓘ 이 단계는 직접 진행하시면 됩니다       │
│                                          │
│ [📋 안내 요청] [✓ 진행 확인]             │
└────────────────────────────────────────┘
                                  ↑ always-on-top, 반투명
```

frontend는 이제 백그라운드 탭으로 가도 된다. **Floating Hint Window가 메인 UI**.

#### 📅 10:31 — 첫 번째 안내 요청

하나가 Chrome을 열고 security.wrtn.io에 접속했지만, 메인 페이지에 다운로드 버튼이 보이지 않아 헤맨다. [📋 안내 요청] 클릭.

```
[데몬 동작 - 사용자에게 보이지 않음]

1. macOS screencapture로 현재 화면 캡처 (메모리에만)
2. 1024px로 리사이즈 (sharp)
3. 이미지 hash 계산 → 캐시 미스
4. 가드레일 체크: 시간당 호출 12회 → 정상
5. Claude 3.5 Sonnet Vision API 호출
   프롬프트: "사용자가 '사내 보안 에이전트 설치 - 다운로드' 단계.
              의도: security.wrtn.io에서 .pkg 다운로드.
              현재 화면에서 다음 행동을 알려주세요. 클릭 영역 좌표 포함."
6. 응답 (~2.8초): JSON 형식
7. 캡처 이미지 메모리 파기
8. SQLite vision_calls에 메타데이터 기록
9. Floating Hint Window 갱신
```

3초 후 Floating Hint Window가 갱신된다:

```
┌────────────────────────────────────────┐
│ 🤖 보안 에이전트 설치                    │
│ 단계 1/3: 다운로드                       │
│                                          │
│ 💡 우측 상단 [Downloads] 메뉴를 클릭     │
│    하시면 다운로드 페이지로 이동됩니다.  │
│                                          │
│ [📋 안내 요청] [✓ 진행 확인]             │
└────────────────────────────────────────┘

+ 화면 위에 빨간 박스 오버레이:
  Chrome의 [Downloads] 메뉴 위치 (1284, 84) 영역에
  ╔══════════════╗
  ║ Downloads ▼  ║  ← 빨간 박스 깜빡임
  ╚══════════════╝
```

하나는 빨간 박스 보고 클릭. 다운로드 페이지 진입. 다운로드 진행.

#### 📅 10:33 — 진행 확인

다운로드 완료. 하나가 [✓ 진행 확인] 클릭.

```
[데몬 동작]
- 화면 캡처
- Vision API 호출, 검증 프롬프트:
  "사용자가 'security.wrtn.io에서 .pkg 다운로드' 단계 완료했나?
   PASS/FAIL/UNCLEAR + 근거"
- 응답: { "status": "pass",
          "reasoning": "Chrome 우측 상단에 SecurityAgent-2.4.pkg 다운로드 완료 알림이 표시됨" }
```

```
┌────────────────────────────────────────┐
│ ✅ 단계 1/3 완료!                        │
│                                          │
│ 단계 2/3: 설치 마법사                    │
│                                          │
│ "다운로드된 .pkg 파일을 더블클릭하여     │
│  설치 마법사를 진행하세요.               │
│  관리자 비밀번호 입력이 필요합니다."     │
│                                          │
│ [📋 안내 요청] [✓ 진행 확인]             │
└────────────────────────────────────────┘
```

#### 📅 10:35 — 설치 진행 중 헤맴

하나가 .pkg 더블클릭. 마법사가 떴는데 "설치 위치 선택" 화면에서 어떻게 해야 할지 모름. [📋 안내 요청] 클릭.

```
응답: "이 화면은 설치 위치 선택 단계입니다.
       [이 컴퓨터의 모든 사용자용으로 설치] 옵션을 선택하고
       [계속] 버튼을 클릭하세요. 회사 정책상 모든 사용자에게 적용되어야 합니다."
+ 좌표: 라디오 버튼 (320, 240, 280x40)
```

Floating Hint Window 갱신, 빨간 박스 표시. 하나가 안내대로 진행.

#### 📅 10:38 — 권한 부여 단계 (P5+ 자동 진입 + P8 안내)

마지막 단계: 시스템 환경설정에서 권한 부여. 데몬이 자동으로 시스템 환경설정 패널을 연다 (P5+).

```bash
# 데몬이 실행:
open "x-apple.systempreferences:com.apple.preference.security"
```

시스템 환경설정의 보안 패널이 자동으로 열림. Floating Hint Window:

```
┌────────────────────────────────────────┐
│ 🤖 단계 3/3: 권한 부여                   │
│                                          │
│ "시스템 환경설정 보안 패널을 열어드렸어요.│
│  SecurityAgent에 디스크 접근 권한을      │
│  부여해주세요."                          │
│                                          │
│ [📋 안내 요청] [✓ 진행 확인]             │
└────────────────────────────────────────┘
```

하나가 [📋 안내 요청] 클릭.

```
응답: "현재 보안 패널이 열려 있습니다.
       1) 좌측 사이드바에서 [Privacy & Security]를 선택
       2) 우측에서 [Full Disk Access] 항목을 찾아 클릭
       3) 좌측 하단 잠금 아이콘을 클릭하여 잠금 해제 (관리자 비밀번호)
       4) [+] 버튼을 눌러 SecurityAgent를 추가
       
       먼저 좌측 사이드바의 [Privacy & Security] 클릭하세요."

+ 좌표: 사이드바 항목 (40, 280, 200x32)
```

빨간 박스가 사이드바에 표시. 하나가 클릭, 단계별로 진행.

#### 📅 10:42 — 잠시 막힘, 추가 안내 요청

하나가 잠금 해제 후 [+] 버튼을 눌렀는데 SecurityAgent가 목록에 안 보임. [📋 안내 요청] 다시 클릭.

```
응답: "현재 화면은 앱 추가 다이얼로그입니다.
       SecurityAgent는 일반적인 Applications 폴더가 아닌
       /Library/PrivilegedHelperTools 경로에 있을 수 있어요.
       Cmd+Shift+G를 눌러 경로 직접 입력 창을 열고
       /Library/PrivilegedHelperTools를 입력하세요."
```

(common_mistakes에 작성자가 "PrivilegedHelperTools 경로 모름"을 미리 적어둔 덕분에 AI가 정확히 알려줌)

#### 📅 10:45 — 완료

하나가 SecurityAgent 추가 + 체크박스 활성화. [✓ 진행 확인] 클릭.

```
응답: { "status": "pass",
        "reasoning": "Full Disk Access 목록에 SecurityAgent가 추가되어 있고,
                      체크박스가 활성화 상태입니다." }
```

```
┌────────────────────────────────────────┐
│ 🎉 사내 보안 에이전트 설치 완료!         │
│                                          │
│ 소요 시간: 15분                          │
│ Vision API 호출: 6회 (~$0.15)            │
│                                          │
│ [닫기] [다음 항목으로]                   │
└────────────────────────────────────────┘
```

데몬이 P4 자동 검증도 병행 실행: `pgrep SecurityAgent` → PID 반환. 항목 상태 `completed`로 자동 전환.

#### 시나리오 핵심 요약

| 측면 | 결과 |
|------|------|
| 작성자 작업 | 자연어 intent 5분 작성 (v0.8 대비 1/12) |
| 입사자 소요 시간 | 15분 (기존 30~45분 대비 절반) |
| 비용 | 입사자당 ~$0.15 (호출 6회) |
| 사람(사수) 개입 | 0회 |
| AI가 잡아낸 것 | 다운로드 위치, 마법사 옵션, 시스템 환경설정 진입, 잠금 해제, 잘못된 폴더 힌트 |
| 결정론 자동화로 처리 | 시스템 환경설정 패널 자동 진입 (P5+), 결과 검증 (P4) |

**v0.9의 진정한 가치**: 사람이 옆에서 "여기 클릭, 다음은 저기" 알려주는 경험을, **AI가 화면을 보고 동적으로** 제공한다. 작성자는 자연어로만 의도 적으면 되고, UI 변경에도 자동 적응한다.

---

## 5. 시스템 구성 (System Architecture)

```
┌─────────────────────────────────────────────────────────────────┐
│  신규 입사자 MacBook                                             │
│                                                                  │
│  ┌──────────────┐      ┌─────────────────────────────────────┐  │
│  │ onboarding   │─────▶│ Local Agent Daemon                  │  │
│  │ CLI          │      │  - HTTP Server (localhost:7777)     │  │
│  └──────────────┘      │  - Checklist State (SQLite)         │  │
│                        │  - P1 State Probe                   │  │
│                        │  - P2 Clipboard Inject              │  │
│                        │  - P3 Browser orchestrator          │  │
│                        │  - P4 Auto Verify                   │  │
│                        │  - P5+ AppleScript launcher         │  │
│                        │  - P8 AI Vision Coach ⭐ v0.9        │  │
│                        │     ↳ Claude Vision API client      │  │
│                        │     ↳ Screen capture (screencapture) │  │
│                        │     ↳ Cache + Rate limit guard       │  │
│                        └───────┬─────────────────────────────┘  │
│                                │                                 │
│  ┌──────────────────┐  ┌──────▼──────────────────┐  ┌────────┐ │
│  │ Chrome Extension │  │ Floating Hint Window     │  │ Web    │ │
│  │ (P3 Guided       │  │ ⭐ v0.9 메인 운영 UI     │  │ Front  │ │
│  │  Browser)        │  │  - always-on-top         │  │ end    │ │
│  │                  │  │  - 두 버튼:              │  │ (시작/ │ │
│  │                  │  │    [📋 안내 요청]        │  │ 관리   │ │
│  │                  │  │    [✓ 진행 확인]         │  │ 허브)  │ │
│  │                  │  │  - AI 응답 표시          │  │        │ │
│  │                  │  │  - 빨간 박스 오버레이    │  │        │ │
│  │                  │  │  - 에러 + 재시도         │  │        │ │
│  └──────────────────┘  └──────────────────────────┘  └────────┘ │
└─────────────────┬───────────────────────────┬───────────────────┘
                  │ Vision API 호출           │ HTTPS (진행상황 동기화)
                  ▼                           ▼
       ┌─────────────────────┐   ┌─────────────────────────────┐
       │ Anthropic API       │   │  Backend (K8s / wrtn.ax)     │
       │ Claude 3.5 Sonnet   │   │                              │
       │ Vision              │   │  ┌──────────────────────┐    │
       │                     │   │  │ Progress API         │    │
       │ ⚠️ 사내 화면 전송    │   │  │ Content Sync         │    │
       │ ⚠️ 응답 후 즉시 파기 │   │  │ Admin UI             │    │
       └─────────────────────┘   │  │ Bottleneck Stats     │    │
                                 │  └─────────┬────────────┘    │
                                 │            │                 │
                                 │            ▼                 │
                                 │  ┌──────────────────────┐    │
                                 │  │ PostgreSQL           │    │
                                 │  │ (진행상황, 메타,      │    │
                                 │  │  Vision 호출 통계)    │    │
                                 │  └──────────────────────┘    │
                                 └──────────────────────────────┘
                                              ▲
                                              │ Webhook
                                              │
                                  ┌───────────┴────────────┐
                                  │ GitLab Repo            │
                                  │ (onboarding-content)   │
                                  │  - checklist.yaml      │
                                  │    (자연어 intent ⭐)  │
                                  │  - guides/*.md (선택)  │
                                  └────────────────────────┘
```

### 5.1 컴포넌트 설명

**A. CLI Installer & Launcher**
- `install.sh`: curl로 받아 실행하면 바이너리를 `/usr/local/bin/onboarding`에 설치
- `onboarding` 명령: 로컬 에이전트 데몬 + Floating Hint Window 기동, frontend 자동 오픈
- 첫 실행 시 Screen Recording 권한 부여 가이드 + Anthropic 전송 동의 절차

**B. Local Agent Daemon (확장됨)**
- 입사자 머신에서 동작하는 로컬 HTTP 서버 (localhost:7777)
- 체크리스트 상태 로컬 SQLite 저장
- 자동화 패턴 실행 모듈 8종 통합 (P1~P5++, P8)
- 백엔드와 주기적 진행상황 동기화

**B-1. P8 AI Vision Coach 모듈** ⭐ v0.9 신규
- 데몬 내부 모듈 (또는 별도 패키지)
- 사용자 트리거 시 화면 캡처 → Claude Vision API → 응답 파싱
- 캐시 (이미지 hash, 30초 TTL)
- 시스템 가드레일 (debounce, 시간당 호출 임계값)
- 캡처 이미지 메모리에서만 처리, 즉시 파기

**C. Floating Hint Window** ⭐ v0.9 격상
- always-on-top 반투명 윈도우 (Electron 기반)
- **운영 중 메인 UI** — 입사자가 외부 앱(시스템 환경설정 등) 작업 시 항상 시야에
- 두 버튼: [📋 안내 요청] / [✓ 진행 확인]
- AI 응답 표시 영역 (텍스트 + 좌표 기반 빨간 박스 오버레이)
- 에러 + 재시도 버튼
- 단계 진행률 mini display
- 사용자 입력에 일절 개입하지 않음 (focusable: false)

**D. Web Frontend (localhost)** — v0.9에서 역할 축소
- **시작/관리 허브** 역할로 변경 (운영 중 메인 UI는 Floating Hint Window)
- 체크리스트 표시, 항목 시작/종료, 진행률
- 운영 중에는 백그라운드 탭으로 가도 됨 (Floating Hint Window가 메인)

**E. Chrome Extension (P3 Guided Browser)**
- 사내 도구(GitLab, Infisical, Windmill) 자동화
- 결정론적 자동화 (AI Vision보다 빠르고 정확)
- 데몬과 폴링 통신

**F. Backend Services**
- Progress API: 입사자별 진행 상태
- Content Sync: GitLab 레포 webhook
- Admin UI: 관리자 대시보드 + Bottleneck Analyzer (P7++)
- Vision 호출 통계 수집 (어드민에서 비용/패턴 모니터링)

**G. Content Repository (GitLab)** — v0.9에서 형식 변경
- `checklist.yaml`: **자연어 intent 기반** (스크린샷 좌표 불필요)
- `guides/*.md`: 선택사항 (Vision API 폴백 시 텍스트 가이드용)
- v0.8 대비 콘텐츠 작성 부담 1/4 수준

**H. 외부 의존**
- **Anthropic Claude 3.5 Sonnet Vision API**: P8 메인 백엔드
- 사내 IdP, GitLab API, Gmail Settings API 등 (§10 참조)

### 5.2 기술 스택 결정사항 (Tech Stack Decisions)

다음 기술 스택은 **확정**이며 구현 시 임의 변경 금지. Ralph 자동 개발 시에도 본 결정사항을 따른다.

> 📚 **각 영역의 구체적인 라이브러리/플러그인은 §19 라이브러리 카탈로그를 참조.** 본 §5.2는 큰 그림 결정사항만 다루고, 세부 라이브러리 선정과 근거는 §19에 정리되어 있다.

#### 5.2.1 Local Daemon

| 항목 | 결정 | 근거 |
|------|------|------|
| 언어 | TypeScript (Node.js 22 LTS) | 프론트엔드와 언어 통일, Node SEA 지원, 풍부한 생태계 |
| HTTP 서버 | Express 4.x | 가볍고 안정적, 학습 곡선 낮음 |
| 상태 저장 | better-sqlite3 (동기 SQLite) | 단일 프로세스 로컬 데몬에 적합 |
| YAML 파싱 | yaml (eemeli/yaml) | TypeScript 친화 |
| 프로세스 관리 | macOS LaunchAgent + plist | native, 추가 런타임 의존성 없음 (PM2 X) |
| 빌드 도구 | tsx (개발), tsc (배포) | esbuild 기반 빠른 빌드 |
| 테스트 | Vitest | 빠르고 모던 |
| 패키저 | Node SEA + postject | Node 22 공식 기능, 단일 바이너리 (pkg deprecated) |

#### 5.2.2 Chrome Extension

| 항목 | 결정 | 근거 |
|------|------|------|
| 매니페스트 | Manifest V3 | 2024년 이후 V2 deprecated |
| 언어 | TypeScript | 데몬과 통일 |
| 빌드 | esbuild + 자체 매니페스트 카피 스크립트 | 단순함 우선 |
| 통신 방식 | HTTP 폴링 (data:7777) | Native Messaging은 MVP 이후 검토 |
| DOM 조작 | Vanilla DOM API | 의존성 최소화 |

#### 5.2.3 Local Frontend

| 항목 | 결정 | 근거 |
|------|------|------|
| 형식 | 단일 HTML + Vanilla JS | 의존성 없이 즉시 실행 |
| 스타일 | 인라인 CSS 또는 단일 CSS 파일 | 빌드 단계 제거 |
| 상태 관리 | 폴링 기반 + 단순 DOM 조작 | 복잡도 최소화 |
| 라이브러리 | 사용 안 함 (React/Vue 등 없음) | MVP에서는 불필요 |

> 비고: MVP 이후 기능이 늘어나면 Vite + React 도입 검토. 단, **MVP는 의도적으로 단순함**.

#### 5.2.4 Backend

| 항목 | 결정 | 근거 |
|------|------|------|
| 언어 | TypeScript (Node.js 22 LTS) | 데몬과 통일 |
| 프레임워크 | NestJS | 모듈화 + 데코레이터 기반 + 사내 표준 |
| DB | PostgreSQL 15 + Prisma | 사내 표준 |
| 인증 | OIDC SSO (사내 IdP) | 사내 정책 |
| 배포 | Kubernetes Helm Chart | 사내 ax-aicc 환경과 동일 |

#### 5.2.5 Admin Frontend

| 항목 | 결정 | 근거 |
|------|------|------|
| 프레임워크 | Vite + React 18 + TypeScript | 사내 프론트 표준 |
| UI 라이브러리 | shadcn/ui + Tailwind CSS | 빠른 구축 |
| 상태 관리 | TanStack Query | API 캐싱 |
| 차트 | Recharts | 진행률 시각화 |

#### 5.2.6 CI/CD

| 항목 | 결정 |
|------|------|
| 저장소 | GitLab (사내) |
| CI | GitLab CI |
| 모노레포 도구 | pnpm workspaces |
| 배포 트리거 | main 브랜치 머지 시 자동 |

### 5.3 디렉토리 구조 (Repository Layout)

본 프로젝트는 **모노레포** 형태로 단일 GitLab 저장소(`onboarding-agent`)에 다음 구조로 구성한다.

```
onboarding-agent/
├── README.md
├── package.json                       # 워크스페이스 루트
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .gitlab-ci.yml
│
├── packages/
│   ├── daemon/                        # 5.1.B: Local Agent Daemon
│   │   ├── src/
│   │   │   ├── server.ts              # Express HTTP 서버 진입점
│   │   │   ├── routes/                # 라우트 핸들러
│   │   │   │   ├── checklist.ts       # GET /api/checklist
│   │   │   │   ├── automation.ts      # /api/automation/*
│   │   │   │   └── progress.ts        # /api/progress/*
│   │   │   ├── services/              # 비즈니스 로직
│   │   │   │   ├── state-probe.ts     # P1
│   │   │   │   ├── verifier.ts        # P4
│   │   │   │   └── content-loader.ts  # checklist.yaml 로더
│   │   │   ├── db/                    # SQLite
│   │   │   │   ├── schema.sql
│   │   │   │   └── migrations/
│   │   │   ├── plugins/               # OS 플러그인
│   │   │   │   └── macos.ts
│   │   │   └── types.ts
│   │   ├── tests/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── extension/                     # 5.1.B: Chrome Extension (P3)
│   │   ├── src/
│   │   │   ├── manifest.json
│   │   │   ├── background.ts
│   │   │   ├── content.ts
│   │   │   └── overlay.css
│   │   ├── scripts/
│   │   │   └── build.ts               # esbuild 빌드 스크립트
│   │   ├── tests/
│   │   ├── dist/                      # 빌드 산출물 (gitignore)
│   │   └── package.json
│   │
│   ├── frontend/                      # 5.1.C: Local Web Frontend
│   │   ├── public/
│   │   │   └── index.html             # 단일 HTML
│   │   ├── src/
│   │   │   └── app.js                 # Vanilla JS
│   │   └── package.json
│   │
│   ├── cli/                           # 5.1.A: CLI Installer & Launcher
│   │   ├── src/
│   │   │   ├── index.ts               # `onboarding` 명령 진입점
│   │   │   ├── commands/
│   │   │   │   ├── start.ts
│   │   │   │   ├── stop.ts
│   │   │   │   ├── status.ts
│   │   │   │   └── update.ts
│   │   │   └── installer.ts
│   │   ├── install.sh                 # curl로 다운받는 설치 스크립트
│   │   └── package.json
│   │
│   ├── backend/                       # 5.1.D: Backend Services
│   │   ├── src/
│   │   │   ├── main.ts                # NestJS bootstrap
│   │   │   ├── modules/
│   │   │   │   ├── progress/
│   │   │   │   ├── content-sync/
│   │   │   │   └── admin/
│   │   │   ├── prisma/
│   │   │   │   └── schema.prisma
│   │   │   └── auth/
│   │   ├── tests/
│   │   ├── helm/                      # Kubernetes Helm Chart
│   │   └── package.json
│   │
│   ├── admin-frontend/                # 5.1.D: Admin UI
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── pages/
│   │   │   └── components/
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   └── shared/                        # 공통 타입/유틸
│       ├── src/
│       │   ├── types/                 # 공통 TypeScript 타입
│       │   │   ├── checklist.ts
│       │   │   ├── automation.ts
│       │   │   └── progress.ts
│       │   └── schemas/               # zod 스키마
│       └── package.json
│
├── tests/
│   └── integration/                   # Wave별 통합 테스트
│       ├── wave-1/
│       ├── wave-2/
│       ├── wave-3/
│       └── wave-4/
│
├── reports/                           # Ralph 산출물 (Review/Integration 리포트)
│   ├── review-spec-001.md
│   ├── integration-wave-1.md
│   └── ...
│
├── specs/                             # Plan 단계 산출물
│   ├── INDEX.md                       # 의존성 그래프 + Wave 분류
│   ├── 001-shared.md
│   ├── 002-daemon.md
│   ├── ...
│   └── integration/                   # Wave별 통합 시나리오
│       ├── wave-1-integration.md
│       ├── wave-2-integration.md
│       ├── wave-3-integration.md
│       └── wave-4-integration.md
│
├── scripts/
│   ├── ralph-orchestrator.sh
│   ├── ralph-stop-hook.sh
│   └── review-runner.sh
│
├── BOUNDARIES.md                      # Ralph 안전장치
├── spec-template.md                   # spec 작성 표준 형식
│
└── docs/
    ├── PRD.md                         # 본 문서
    ├── ARCHITECTURE.md                # 본 문서 5절 별도 파일 버전 (선택)
    └── runbook.md
```

> **별도 저장소**: 콘텐츠는 `onboarding-content` 저장소로 분리. `checklist.yaml`, `guides/*.md`, `templates/*.html`, `automations/*.ts` 포함.

#### `packages/test-fixtures` 패키지

Mock 서비스를 한 곳에 모아 관리하는 패키지. Integration Ralph가 추가/수정 가능.

```
packages/test-fixtures/
├── src/
│   ├── mock-gmail/              # Gmail Settings API 모의
│   ├── mock-gitlab/             # GitLab API 모의
│   ├── mock-extension/          # Chrome Extension behavior 모의
│   ├── mock-postgres/           # testcontainers 래퍼
│   └── mock-idp/                # SSO IdP 모의
├── tests/
└── package.json
```

### 5.4 컴포넌트와 코드 매핑

| 시스템 구성 (5.1) | 코드 위치 | 주요 의존성 |
|-------------------|----------|------------|
| A. CLI Installer & Launcher | `packages/cli` | commander |
| B. Local Agent Daemon (HTTP 서버) | `packages/daemon/src/server.ts` | express, cors |
| B. Local Agent Daemon (상태 저장) | `packages/daemon/src/db` | better-sqlite3 |
| B. Local Agent Daemon (P1 State Probe) | `packages/daemon/src/services/state-probe.ts` | child_process, fs |
| B. Local Agent Daemon (P3 Browser 자동화 - Extension 측) | `packages/extension/src/content.ts` | (Chrome API) |
| B. Local Agent Daemon (P3 Browser 자동화 - Playwright fallback) | `packages/daemon/src/services/playwright-fallback.ts` | playwright |
| B. Local Agent Daemon (P4 Auto Verify) | `packages/daemon/src/services/verifier.ts` | undici (fetch) |
| C. Web Frontend | `packages/frontend/public/index.html` + `src/app.js` | (없음) |
| D. Backend Progress API | `packages/backend/src/modules/progress` | nestjs, prisma |
| D. Backend Content Sync | `packages/backend/src/modules/content-sync` | gitlab webhook |
| D. Backend Admin UI 라우트 | `packages/backend/src/modules/admin` | nestjs |
| D. Admin Frontend | `packages/admin-frontend` | vite, react |
| 공통 타입 | `packages/shared/src/types` | zod |

---

## 6. 기능 요구사항 (Functional Requirements)

### 6.1 CLI / Installation (P0)

| ID | 요구사항 |
|----|----------|
| F-CLI-01 | `curl -fsSL https://onboarding.wrtn.ax/install.sh \| sh` 한 줄로 설치 완료 |
| F-CLI-02 | 설치 시 macOS 버전, 사용자 권한 등 사전 점검 |
| F-CLI-03 | `onboarding` 명령어로 데몬 실행 및 브라우저 자동 오픈 |
| F-CLI-04 | `onboarding stop`, `onboarding status`, `onboarding update` 서브커맨드 |
| F-CLI-05 | 설치 시 외부 의존성(Node, Python 등)은 번들 또는 자동 설치 |

### 6.2 체크리스트 시스템 (P0)

| ID | 요구사항 |
|----|----------|
| F-CHK-01 | GitLab 레포의 `checklist.yaml` 기반으로 직군별 체크리스트 동적 로드 |
| F-CHK-02 | 항목별 상태: `pending` / `in_progress` / `completed` / `skipped` / `blocked` |
| F-CHK-03 | 항목별 의존성 정의 가능 (예: A 완료 후 B 진행 가능) |
| F-CHK-04 | 자동 검증 가능 항목은 시스템이 자동 체크 (예: `git --version` 실행 결과) |
| F-CHK-05 | 수동 확인 항목은 사용자가 "완료" 버튼으로 체크 |
| F-CHK-06 | 모든 P0 항목 완료 시 "Ready-to-Work" 상태로 전환 |

### 6.3 자동화 플러그인 (P0)

자동화는 **"4가지 핵심 패턴"** 의 조합으로 구현한다. 각 체크리스트 항목은 1개 이상의 패턴을 사용한다.

#### 6.3.1 자동화 핵심 패턴

**v0.9 핵심 변경**: P8 AI Vision Coach가 사용자 가이드의 **메인 메커니즘**이 된다. 기존 P5 시리즈는 **보조 역할로 격하**되며, P6/P7+ 콘텐츠 작성 도구는 폐기된다 (AI가 동적 분석하므로 사전 작성 불필요).

**입사자가 사용하는 패턴 (P1~P5++, P8)**

| 패턴 | 설명 | v0.9에서의 역할 |
|------|------|----------------|
| **P1. 자동 상태 점검 (State Probe)** | 시작 시점 및 항목 진입 시 머신 상태 자동 스캔 | 유지 — 머신 상태 검증 (브라우저 자동화로 못 하는 영역) |
| **P2. 명령어 클립보드 자동 복사 (Clipboard Inject)** | 항목 진입 시 명령어를 클립보드에 자동 주입 | 유지 — 터미널 작업 시나리오 |
| **P3. 가이드 모드 브라우저 자동화 (Guided Browser)** | Chrome Extension/Playwright로 페이지 이동 + 입력 | 유지 — 웹 작업의 결정론적 자동화 (AI Vision보다 빠르고 정확) |
| **P4. 자동 검증 (Auto Verify)** | 사용자 행동 후 결과를 시스템이 자동 확인 | 유지 — 객관적 검증 (예: 프로세스 실행 여부) |
| **P5. 시각 가이드 (Visual Guide)** | 미리 캡처된 이미지/동영상 정적 표시 | **격하** — AI Vision 보조용 (선택적) |
| **P5+. 시스템 패널 자동 진입 (System Panel Launch)** | macOS URL 스킴/AppleScript로 시스템 환경설정 진입 | 유지 — AI 안내 전 패널 진입 자동화 |
| **P5++. 보조 가이드 윈도우 (Floating Hint Window)** | always-on-top 반투명 윈도우 | **격상** — 운영 중 메인 UI. P8 결과 표시 + "안내 요청"/"진행 확인" 버튼 위치 |
| **P8. AI Vision Coach** ⭐ | Screen Recording으로 화면 캡처 → Claude Sonnet Vision 호출 → Floating Hint Window에 안내 표시 | **신규 메인 메커니즘** |

**작성자가 사용하는 패턴 (P7, P7++)**

v0.9에서 작성자 부담이 극단적으로 줄어든다. 작성자는 자연어로 의도(intent)만 입력하면 된다.

| 패턴 | 설명 | v0.9에서의 역할 |
|------|------|----------------|
| **P6. 작성자 캡처 모드 (Author Capture)** | 단축키 캡처 + 마크업 | **폐기** — AI Vision이 동적 인식하므로 사전 캡처 불필요 |
| **P7. AI 텍스트 초안 (AI Draft)** | Claude API로 가이드 텍스트 초안 생성 | **변형 유지** — 작성자가 단계 intent 자연어 작성을 도움 |
| **P7+. 변경 감지 (Change Detector)** | 가이드 페이지의 시각적 diff 자동 감지 | **폐기** — AI Vision이 매번 동적 분석하므로 외부 변경에 자동 적응 |
| **P7++. 정체 분석 (Bottleneck Analyzer)** | 항목별 정체율 + 보강 우선순위 자동 식별 | 유지 — 어드민 대시보드 통계 |

#### 6.3.1.1 P8 AI Vision Coach 상세 설계

**전제**:
- Screen Recording 권한 부여 필수
- 사내 화면이 Anthropic Claude API로 전송됨 (사내 정책 사전 검토 필요)
- Claude 3.5 Sonnet Vision 모델 단독 사용

**트리거 메커니즘**: 명시 트리거 (사용자 버튼 클릭 시에만 분석)

| 버튼 | 역할 | AI 호출 프롬프트 |
|------|------|-----------------|
| **📋 안내 요청** | "현재 화면에서 뭐 해야 하지?" | "사용자가 단계 X에 있다. 이 화면에서 다음 행동을 알려달라. 클릭할 영역의 좌표 포함" |
| **✓ 진행 확인** | "이 단계 끝났는지 확인해줘" | "사용자가 단계 X를 완료했는가? 화면 근거와 함께 답변" |

**버튼 위치**: Floating Hint Window 내부 (항상 화면 위에 떠 있음)

**호출 제한**:
- 사용자 차원 제한 없음 (필요한 만큼 누름)
- 시스템 가드레일:
  - 1초 내 연속 호출 → debounce (1번만 처리)
  - 동일 화면(이미지 hash 같음) 30초 내 재호출 → 캐시 응답
  - 시간당 100회 초과 → 사용자 알림 ("혹시 문제 있나요?")
  - 시간당 200회 초과 → 일시 정지 + 관리자 알림

**검증 방식**: AI Vision이 직접 검증 (사용자가 [✓ 진행 확인] 누르면 화면 보고 PASS/FAIL 판정)
- 작성자가 자연어 success_criteria만 작성하면 됨
- 별도 명령어 검증(P4) 작성 불필요

**common_mistakes**: 선택 입력
- 작성자가 미리 정의하면 AI가 더 정확한 교정 가능
- 미입력 시 AI가 자체 판단

**작성자 스크린샷**: 미사용
- AI가 자체 화면 분석으로 판단
- 작성자는 reference 이미지 첨부 불필요

**프라이버시 처리**: 신뢰 기반 + 명시 고지
- 첫 실행 시 "Screen Recording 권한 부여 + Anthropic으로 화면 전송됨" 명시 고지
- 사용자 동의 후 진행
- 별도 자동 마스킹/필터링 없음 (옵트아웃 옵션도 미제공)
- 사용자가 민감 화면(비밀번호 입력 등)에서는 버튼을 누르지 않으면 됨

**Vision API 폴백**:
- 응답 실패 시 에러 메시지 + 재시도 버튼만 제공
- 정적 가이드(P5) 폴백 없음
- 사람 호출 자동 트리거 없음 (사용자가 필요 시 직접 사수에게 연락)

**캡처 이미지 수명주기**:
- 캡처 → Claude API 전송 → 응답 수신 → **즉시 메모리에서 파기**
- 디스크에 저장하지 않음
- 로그에도 이미지 자체는 남기지 않음 (메타데이터만: 단계 ID, 응답 요약)

**비용 추정**:
- 호출당: ~$0.025 (Claude 3.5 Sonnet 평균)
- 입사자당: ~$1~3 (정상 사용)
- 입사자당 최대: ~$10 (가드레일 작동 전까지)
- 1년 100명: ~$200~300

#### 6.3.2 기능 요구사항

| ID | 요구사항 |
|----|----------|
| F-AUT-01 | **State Probe (P1)**: macOS에서 다음을 자동 점검 가능해야 함 — 설치된 GUI 앱, Homebrew 패키지, 실행 중 프로세스, `~/.ssh/` 키 존재, `git config` 설정, 네트워크/VPN 상태 |
| F-AUT-02 | **Clipboard Inject (P2)**: 항목별로 정의된 명령어를 사용자 머신 클립보드에 자동 복사하고, "터미널에서 붙여넣기" UI 안내 표시 |
| F-AUT-03 | **Guided Browser (P3) - Chrome Extension 모드**: 사용자의 일반 Chrome에 익스텐션 설치 시 사내 도메인(GitLab, Infisical, Windmill)에서 가이드 오버레이 동작 (기본 옵션) |
| F-AUT-04 | **Guided Browser (P3) - Playwright 모드**: 익스텐션 미설치 시 별도 브라우저 창으로 fallback 제공 |
| F-AUT-05 | **Auto Verify (P4)**: 항목별 검증 방식 정의 — `command`(CLI 출력 확인), `process_check`(프로세스 실행 확인), `file_exists`(파일 존재), `http_check`(엔드포인트 응답), `manual`(사용자 확인) |
| F-AUT-06 | 권한이 필요한 작업(sudo, SSH 키 생성, .pkg 설치 등)은 자동 실행하지 않음. 대신 **준비(P2)와 검증(P4)만 자동화**하여 사용자 부담 최소화 |
| F-AUT-07 | Playwright/Extension 자동화 실패 시 명령어/스크린샷 기반 안내로 자동 fallback |
| F-AUT-08 | 봇 탐지(Cloudflare, reCAPTCHA) 감지 시 자동 조작 중단하고 사용자 직접 입력 모드로 전환 |
| F-AUT-09 | OAuth 로그인 페이지에서는 보안상 자동 입력하지 않음 (페이지 안내까지만) |
| F-AUT-10 | 머신 상태 점검 시 수집되는 정보는 사용자에게 사전 고지 및 동의 필요 |
| F-AUT-11 | **P5 Visual Guide**: 항목별로 정의된 이미지/동영상을 frontend의 단계별 캐러셀로 표시. 이미지에는 화살표/동그라미가 미리 그려져 있음 |
| F-AUT-12 | **P5+ System Panel Launch**: 항목 진입 시 macOS 시스템 환경설정 등 특정 패널을 자동으로 열기 (`open "x-apple.systempreferences:..."` 또는 osascript 기반). Accessibility 권한 불필요 |
| F-AUT-13 | **P5++ Floating Hint Window**: 시스템 환경설정 등 외부 앱 위에 always-on-top 반투명 윈도우로 시각 힌트 제공. 사용자 입력에 일절 개입하지 않으며 정보 표시만 함 |
| F-AUT-14 | **P5++의 위치 정확성 한계**: 보조 가이드 윈도우는 정적 좌표 기반이므로 외부 앱 윈도우 이동 시 어긋날 수 있음. 사용자가 외부 앱을 이동하면 frontend에서 "재정렬" 버튼 제공 |
| F-AUT-15 | **(폐기)** P6 Author Capture는 v0.9에서 폐기 — AI Vision이 동적 인식하므로 작성자 캡처 불필요 |
| F-AUT-16 | **P7 AI Draft (변형 유지)**: 작성자가 단계 의도 한 줄 입력 시 Claude API로 자연어 intent 정제 |
| F-AUT-17 | **(폐기)** P7+ Change Detector는 v0.9에서 폐기 — AI Vision이 매번 동적 분석하므로 외부 변경 자동 적응 |
| F-AUT-18 | **P7++ Bottleneck Analyzer**: 어드민 대시보드에 항목별 평균 소요 시간 + 정체율 표 표시. 정체율 상위 항목에 "보강 권장" 라벨 자동 부여 |
| F-AUT-19 | **P8 AI Vision Coach - Screen Capture**: 사용자가 버튼 클릭 시 macOS `screencapture` 또는 `ScreenCaptureKit`으로 현재 화면 캡처 |
| F-AUT-20 | **P8 - Vision API 호출**: Claude 3.5 Sonnet Vision API로 캡처 이미지 + 단계 컨텍스트 전송 |
| F-AUT-21 | **P8 - 두 버튼 (안내 요청 / 진행 확인)**: Floating Hint Window 내 두 버튼 배치. 각 버튼은 다른 프롬프트로 Vision API 호출 |
| F-AUT-22 | **P8 - 결과 표시**: AI 응답을 Floating Hint Window에 표시. 좌표 정보 있으면 화면 위에 빨간 박스 오버레이 |
| F-AUT-23 | **P8 - 검증**: [✓ 진행 확인] 버튼은 AI Vision이 직접 단계 완료 여부 판정 (별도 P4 검증 명령 불필요) |
| F-AUT-24 | **P8 - 가드레일**: 1초 내 연속 호출 debounce / 동일 화면 30초 내 캐시 / 시간당 100회 알림 / 200회 일시 정지 |
| F-AUT-25 | **P8 - 이미지 수명**: 캡처 이미지는 응답 수신 후 즉시 메모리 파기, 디스크/로그 저장 안 함 |
| F-AUT-26 | **P8 - 사용자 동의**: 첫 실행 시 "Screen Recording 권한 + Anthropic으로 화면 전송" 명시 고지 + 동의 |
| F-AUT-27 | **P8 - 폴백**: API 실패 시 에러 메시지 + 재시도 버튼만. 정적 가이드 폴백 없음 |

### 6.4 온보딩메이트 챗 (P1)

| ID | 요구사항 |
|----|----------|
| F-CHT-01 | 우측 패널에 상시 채팅창 제공 |
| F-CHT-02 | GitLab 레포의 마크다운 문서를 임베딩한 RAG 기반 응답 |
| F-CHT-03 | 현재 진행 중인 체크리스트 항목 컨텍스트를 자동 포함 |
| F-CHT-04 | 답변 출처(어떤 문서의 어느 섹션) 표시 |
| F-CHT-05 | 답변할 수 없을 때 사람(담당자) 호출 옵션 제공 |

### 6.5 관리자 대시보드 (P1)

| ID | 요구사항 |
|----|----------|
| F-ADM-01 | 입사자 목록 및 직군별 필터 |
| F-ADM-02 | 입사자별 체크리스트 진행률 (% 및 항목별 상태) |
| F-ADM-03 | 항목별 평균 소요 시간, 막힘 빈도 통계 |
| F-ADM-04 | 특정 항목에서 N시간 이상 정체 시 알림 (Slack) |
| F-ADM-05 | Ready-to-Work 달성 시 인사팀/팀장에게 알림 |
| F-ADM-06 | SSO 인증 (사내 IdP) |

### 6.6 콘텐츠 관리 (P1)

| ID | 요구사항 |
|----|----------|
| F-CNT-01 | GitLab 레포 구조: `checklist.yaml` + `guides/*.md` + `automations/*.ts` |
| F-CNT-02 | PR merge 시 webhook으로 백엔드 콘텐츠 캐시 갱신 |
| F-CNT-03 | YAML 스키마 검증 (CI에서) |
| F-CNT-04 | 직군별/팀별 체크리스트 분기 가능 |

---

## 7. 비기능 요구사항 (Non-Functional Requirements)

| 항목 | 요구사항 |
|------|----------|
| 보안 | 사번/이메일 기반 인증, 진행상황 데이터는 사내망에서만 접근 |
| 개인정보 | 입사자 머신 정보(설치된 프로그램 등)는 체크리스트 검증 목적으로만 사용, 명시적 동의 필요 |
| 성능 (로컬 UI) | 로컬 UI 응답 < 200ms, 챗 응답 < 5s |
| 성능 (P8 Vision API) ⭐ | 안내 요청 응답 P50 ≤ 3초, P95 ≤ 5초, P99 ≤ 8초 (캐시 hit 제외) |
| Vision 캐시 적중률 ⭐ | 30초 TTL 기준 적중률 ≥ 15% (반복 화면 분석 절감) |
| Vision 비용 상한 ⭐ | 입사자당 정상 사용 시 ≤ $3, 가드레일 작동 후 절대 상한 ≤ $10 |
| Vision 좌표 정확도 ⭐ | `highlight_region` 좌표 정확도 ≥ 80% (10개 표준 시나리오 수동 검증) |
| 가용성 (자체 서비스) | 백엔드 SLA 99% (오프라인 시 로컬 진행은 계속 가능, 동기화는 복구 후) |
| 가용성 (Anthropic API) ⭐ | Anthropic API 다운 시 P8 차단되나 P1~P5++ 결정론 자동화는 정상 동작. 에러 메시지 + 재시도 버튼 표시 |
| 호환성 | macOS 13(Ventura) 이상, MacBook (Apple Silicon + Intel) |
| 보안 검토 | install.sh 스크립트 및 바이너리 서명, HTTPS 강제 |
| 데이터 보존 ⭐ | 캡처 이미지는 메모리에서만 처리, API 응답 후 즉시 파기. 디스크/로그에 저장 금지 (§8.1.1 참조) |

> ⭐ = v0.9에서 P8 AI Vision Coach 도입에 따른 신규 비기능 요구사항

---

## 8. 데이터 모델 (Data Model)

### 8.1 로컬 데몬 SQLite 스키마

```sql
-- 자동화 요청 큐 (Extension/Playwright 실행 대상)
CREATE TABLE automation_requests (
  request_id      TEXT PRIMARY KEY,
  item_id         TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN (
                    'queued', 'in_progress', 'awaiting_user',
                    'verifying', 'completed', 'failed'
                  )),
  url             TEXT NOT NULL,
  steps_json      TEXT NOT NULL,        -- JSON array
  user_inputs     TEXT NOT NULL,        -- JSON object
  picked_up       INTEGER DEFAULT 0,    -- 0/1 boolean
  error           TEXT,
  created_at      INTEGER NOT NULL,     -- unix epoch ms
  updated_at      INTEGER NOT NULL
);

-- 항목별 진행 상태
CREATE TABLE item_states (
  item_id         TEXT PRIMARY KEY,
  status          TEXT NOT NULL CHECK (status IN (
                    'pending', 'in_progress', 'completed',
                    'skipped', 'blocked'
                  )),
  user_inputs     TEXT,                 -- JSON object
  completed_at    INTEGER,
  last_error      TEXT,
  updated_at      INTEGER NOT NULL
);

-- 스텝 진행 로그 (디버깅 및 통계)
CREATE TABLE step_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id      TEXT NOT NULL,
  step_id         TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
  error           TEXT,
  duration_ms     INTEGER,
  created_at      INTEGER NOT NULL,
  FOREIGN KEY (request_id) REFERENCES automation_requests(request_id)
);

-- 사용자 프로필 (단일 레코드)
CREATE TABLE user_profile (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  employee_id     TEXT NOT NULL,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  role_id         TEXT NOT NULL,
  consented_at    INTEGER,              -- 머신 정보 수집 동의 시각
  oauth_tokens    TEXT,                 -- JSON, 암호화 권장
  created_at      INTEGER NOT NULL
);

CREATE INDEX idx_automation_requests_status ON automation_requests(status);
CREATE INDEX idx_item_states_status ON item_states(status);
CREATE INDEX idx_step_logs_request_id ON step_logs(request_id);

-- ============================================================
-- v0.9 신규: P8 AI Vision Coach 테이블
-- ============================================================

-- Vision API 호출 로그 (이미지는 저장 안 함, 메타데이터만)
CREATE TABLE vision_calls (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id         TEXT NOT NULL UNIQUE,           -- UUID
  item_id         TEXT NOT NULL,
  step_id         TEXT NOT NULL,
  request_type    TEXT NOT NULL CHECK (request_type IN ('guide', 'verify')),
  image_hash      TEXT NOT NULL,                  -- SHA-256, 캐시 키
  image_size_kb   INTEGER NOT NULL,               -- 캡처 이미지 크기 (메타)
  prompt_tokens   INTEGER,                        -- API 응답에서 추출
  output_tokens   INTEGER,
  latency_ms      INTEGER NOT NULL,               -- API 응답 지연
  cache_hit       INTEGER DEFAULT 0,              -- 0/1, 캐시 응답 여부
  result_summary  TEXT,                           -- 응답 요약 (전체 응답 X)
  error           TEXT,                           -- 실패 시 에러 메시지
  created_at      INTEGER NOT NULL                -- unix epoch ms
);

-- 가드레일 상태 (rate limit 추적)
CREATE TABLE rate_limit_buckets (
  bucket_id       TEXT PRIMARY KEY,               -- 'hourly:2026-04-30T13'
  call_count      INTEGER NOT NULL DEFAULT 0,
  alert_sent      INTEGER DEFAULT 0,              -- 100회 알림 발송 여부
  paused          INTEGER DEFAULT 0,              -- 200회 일시 정지 상태
  reset_at        INTEGER NOT NULL                -- 버킷 만료 시각
);

-- Vision API 응답 캐시 (이미지 hash 기반)
CREATE TABLE vision_cache (
  cache_key       TEXT PRIMARY KEY,               -- 'item:step:type:hash'
  response_json   TEXT NOT NULL,                  -- AI 응답 그대로 저장 (텍스트 한정)
  ttl_at          INTEGER NOT NULL                -- 만료 시각 (30초 후)
);

-- 사용자 동의 기록 (Screen Recording + Anthropic 전송)
CREATE TABLE consents (
  consent_type    TEXT PRIMARY KEY CHECK (consent_type IN (
                    'screen_recording', 'anthropic_transmission', 'machine_info'
                  )),
  granted         INTEGER NOT NULL,               -- 0/1
  granted_at      INTEGER,                        -- 동의 시각
  revoked_at      INTEGER                         -- 철회 시각 (있으면)
);

CREATE INDEX idx_vision_calls_item ON vision_calls(item_id, step_id);
CREATE INDEX idx_vision_calls_created ON vision_calls(created_at);
CREATE INDEX idx_vision_cache_ttl ON vision_cache(ttl_at);
```

### 8.1.1 데이터 보존 정책 (v0.9 핵심)

이미지 데이터의 라이프사이클을 명확히 정의한다 (개인정보 보호 + 정책 컴플라이언스).

| 데이터 | 위치 | 보존 기간 | 비고 |
|--------|------|----------|------|
| 캡처 이미지 (raw) | 메모리만 | API 응답 후 즉시 파기 | 디스크 X, 로그 X |
| 임시 캡처 파일 (`/tmp/onboarding-capture-*.png`) | 디스크 | 캡처 ~ Vision API 응답 (수 초) | 응답 후 즉시 `rm` |
| Vision API 호출 메타데이터 | SQLite `vision_calls` | 30일 | 비용/패턴 분석용 |
| API 응답 텍스트 | SQLite `vision_cache` | 30초 (TTL) | 캐시 |
| 응답 요약 (텍스트만) | SQLite `vision_calls.result_summary` | 30일 | 디버깅용 |
| 사용자 동의 기록 | SQLite `consents` | 영구 | 컴플라이언스 |

> **정책 위반 사례**: 캡처 이미지를 디스크에 영구 저장하거나, 응답 후 파기하지 않으면 컴플라이언스 위반. CI에서 자동 검증 (정적 분석).

```

### 8.2 백엔드 PostgreSQL 스키마 (Prisma)

```prisma
// packages/backend/src/prisma/schema.prisma

model Onboardee {
  id              String       @id @default(cuid())
  employeeId      String       @unique
  email           String       @unique
  name            String
  roleId          String
  startDate       DateTime
  status          OnboardeeStatus @default(IN_PROGRESS)
  itemProgresses  ItemProgress[]
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([status])
}

enum OnboardeeStatus {
  NOT_STARTED
  IN_PROGRESS
  READY_TO_WORK
  ABANDONED
}

model ItemProgress {
  id              String       @id @default(cuid())
  onboardeeId     String
  onboardee       Onboardee    @relation(fields: [onboardeeId], references: [id])
  itemId          String
  status          ItemStatus
  startedAt       DateTime?
  completedAt     DateTime?
  blockedReason   String?
  attemptCount    Int          @default(0)
  updatedAt       DateTime     @updatedAt

  @@unique([onboardeeId, itemId])
  @@index([status])
}

enum ItemStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  SKIPPED
  BLOCKED
}

model ContentVersion {
  id              String       @id @default(cuid())
  gitCommitSha    String       @unique
  checklistYaml   String       @db.Text
  syncedAt        DateTime     @default(now())
}

model AdminUser {
  id              String       @id @default(cuid())
  email           String       @unique
  role            AdminRole
  createdAt       DateTime     @default(now())
}

enum AdminRole {
  HR
  TEAM_LEAD
  ADMIN
}

// ============================================================
// v0.9 신규: P8 AI Vision 통계 (서버 집계용)
// ============================================================

model VisionCallStat {
  id              String       @id @default(cuid())
  onboardeeId     String
  itemId          String
  stepId          String
  requestType     VisionRequestType
  latencyMs       Int
  cacheHit        Boolean      @default(false)
  promptTokens    Int?
  outputTokens    Int?
  estimatedCostUsd Decimal?    @db.Decimal(10, 6)
  errorType       String?      // 'timeout', 'rate_limit', 'api_error'
  createdAt       DateTime     @default(now())

  @@index([onboardeeId, createdAt])
  @@index([itemId, stepId])
  @@index([createdAt])
}

enum VisionRequestType {
  GUIDE
  VERIFY
}

// 항목별 정체율 통계 (P7++ Bottleneck Analyzer용)
// View로 구현하거나 주기적 집계 (선택)
model BottleneckStat {
  itemId              String       @id
  totalAttempts       Int
  avgDurationSec      Int
  bottleneckRate      Float        // 평균 시간을 초과한 사용자 비율
  needsReinforcement  Boolean      @default(false)
  updatedAt           DateTime     @updatedAt
}
```

### 8.3 공통 TypeScript 타입 (`packages/shared/src/types`)

```typescript
// checklist.ts
export type ChecklistVersion = 1;

export interface Checklist {
  version: ChecklistVersion;
  roles: Role[];
}

export interface Role {
  id: string;
  name: string;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  title: string;
  category: 'dev-environment' | 'team-tools' | 'security' | 'documentation';
  priority: 'P0' | 'P1' | 'P2';
  estimated_minutes?: number;
  depends_on?: string[];
  inputs?: ItemInput[];
  state_probe?: StateProbe[];
  clipboard_inject?: ClipboardInject;
  guided_browser?: GuidedBrowser;
  verification?: Verification;
  guide?: string;          // 마크다운 파일 경로
}

export interface ItemInput {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  pattern?: string;        // RegExp 문자열
}

export type StateProbe =
  | { type: 'command'; command: string; expected_exit_code?: number }
  | { type: 'file_exists'; path: string; on_found?: 'skip_to_next_step' | 'mark_completed' }
  | { type: 'process_check'; process_name: string; on_found?: 'mark_completed' }
  | { type: 'app_installed'; bundle_id: string };

export interface ClipboardInject {
  command?: string;
  command_output?: string; // shell command를 실행하고 그 출력값을 클립보드에 넣음
  ui_hint?: string;
}

export interface GuidedBrowser {
  type: 'extension' | 'playwright';
  fallback?: 'extension' | 'playwright';
  url: string;
  steps: GuidedBrowserStep[];
}

export interface GuidedBrowserStep {
  id: string;
  action: 'scroll_to' | 'click' | 'type' | 'type_in_dialog'
        | 'inject_html' | 'select_dropdown' | 'highlight'
        | 'highlight_only' | 'wait_for_navigation';
  selector?: string;
  fallback_selectors?: string[];
  value?: string;                    // 변수 치환 후 값
  template_path?: string;            // HTML 템플릿 파일 경로
  template_html?: string;            // 치환 완료된 HTML (런타임 주입)
  variables?: Record<string, string>;
  tooltip?: string;
  highlight?: boolean;
  wait_after_ms?: number;
  require_user_action?: boolean;
}

export type Verification =
  | { type: 'command'; command: string; poll_interval_sec?: number; timeout_sec?: number }
  | { type: 'process_check'; process_name: string; poll_interval_sec?: number; timeout_sec?: number }
  | { type: 'file_exists'; path: string }
  | { type: 'http_check';
      method?: 'GET' | 'POST';
      url: string;
      auth?: 'oauth_user_token' | 'sso_token';
      expect: HttpCheckExpect;
      poll_interval_sec?: number;
      timeout_sec?: number;
    }
  | { type: 'manual' };

export interface HttpCheckExpect {
  status?: number;
  jsonpath?: string;
  contains?: string;
  contains_all?: string[];
  expect_count_gte?: number;
}

// progress.ts
export interface AutomationRequestState {
  request_id: string;
  item_id: string;
  status: 'queued' | 'in_progress' | 'awaiting_user' | 'verifying' | 'completed' | 'failed';
  url: string;
  steps: GuidedBrowserStep[];
  user_inputs: Record<string, string>;
  completed_step_ids: string[];
  picked_up: boolean;
  error?: string;
  created_at: number;
}

export interface ItemProgressDTO {
  item_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked';
  started_at?: number;
  completed_at?: number;
  attempt_count: number;
}

// ============================================================
// v0.9 신규: P8 AI Vision Coach 타입
// ============================================================

// vision.ts
export type VisionRequestType = 'guide' | 'verify';

export interface VisionGuideRequest {
  item_id: string;
  step_id: string;
}

export interface VisionVerifyRequest {
  item_id: string;
  step_id: string;
}

export interface VisionResponse {
  call_id: string;
  request_type: VisionRequestType;
  cached: boolean;
  latency_ms: number;
  result: VisionGuideResult | VisionVerifyResult;
  error?: string;
}

export interface VisionGuideResult {
  type: 'guide';
  message: string;            // 사용자에게 보여줄 안내 텍스트
  highlight_region?: {        // 클릭할 영역 (있으면 빨간 박스로 오버레이)
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: 'high' | 'medium' | 'low';
}

export interface VisionVerifyResult {
  type: 'verify';
  status: 'pass' | 'fail' | 'unclear';
  reasoning: string;          // 판단 근거
  next_action_hint?: string;  // FAIL/UNCLEAR 시 어떻게 해야 하는지
}

// AI Coaching 콘텐츠 스키마 (v0.9에서 새로 도입)
export interface AICoachingDefinition {
  overall_goal: string;
  steps: AICoachingStep[];
}

export interface AICoachingStep {
  id: string;
  intent: string;               // 자연어: 이 단계에서 사용자가 해야 할 것
  success_criteria: string;     // 자연어: 완료 판정 기준
  common_mistakes?: string;     // 자연어: 자주 하는 실수 (선택)
  fallback_text?: string;       // Vision API 실패 시 표시할 텍스트 (선택)
}

// 가드레일 상태
export interface RateLimitStatus {
  current_hour_calls: number;
  alert_threshold: number;      // 100
  pause_threshold: number;      // 200
  state: 'normal' | 'alert' | 'paused';
  reset_at: number;
}
```

---

## 9. API 계약 (API Contracts)

### 9.1 Local Daemon API (`http://localhost:7777`)

#### 9.1.1 체크리스트 조회

```
GET /api/checklist
Response 200:
{
  "version": 1,
  "user_role": "frontend-engineer",
  "items": ChecklistItem[]
}
```

#### 9.1.2 자동화 시작 (프론트엔드 → 데몬)

```
POST /api/automation/start
Request:
{
  "item_id": "setup-gmail-signature",
  "user_inputs": { "job_title": "프론트엔드 엔지니어", "phone": "010-1234-5678" }
}
Response 200:
{ "request_id": "req_1714461234567" }
Response 404: { "error": "Item not found" }
Response 400: { "error": "Missing required input: phone" }
```

#### 9.1.3 자동화 상태 조회 (프론트엔드 폴링)

```
GET /api/automation/:request_id/status
Response 200:
{
  "status": "in_progress" | "awaiting_user" | "verifying" | "completed" | "failed",
  "completed_step_ids": ["scroll-to-signature", "click-create-new"],
  "total_steps": 8,
  "error": null
}
Response 404: { "error": "Not found" }
```

#### 9.1.4 대기 자동화 요청 가져오기 (Extension 폴링)

```
GET /api/automation/pending
Response 200 (요청 있음):
{
  "request_id": "req_1714461234567",
  "url": "https://mail.google.com/...",
  "steps": GuidedBrowserStep[]
}
Response 200 (요청 없음): null
```

#### 9.1.5 스텝 진행 보고 (Extension → 데몬)

```
POST /api/automation/progress
Request:
{ "request_id": "req_...", "step_id": "click-create-new" }
Response 200: { "ok": true }
```

#### 9.1.6 자동화 결과 보고 (Extension → 데몬)

```
POST /api/automation/result
Request:
{
  "request_id": "req_...",
  "success": true,
  "completed_steps": ["..."],
  "error": null
}
Response 200: { "ok": true }
```

#### 9.1.7 항목 진행률 조회

```
GET /api/progress
Response 200:
{
  "items": ItemProgressDTO[],
  "ready_to_work": false,
  "completion_rate": 0.45
}
```

#### 9.1.8 사용자 프로필 등록/조회

```
POST /api/profile
Request: { "employee_id", "email", "name", "role_id" }
Response 200: { "ok": true }

GET /api/profile
Response 200: { "employee_id", "email", "name", "role_id", "consented_at" }
```

#### 9.1.9 P8 AI Vision Coach - 안내 요청 (v0.9 신규) ⭐

사용자가 Floating Hint Window의 [📋 안내 요청] 버튼 클릭 시 호출.

```
POST /api/vision/guide
Request:
{
  "item_id": "install-security-agent",
  "step_id": "grant_permission"
}

Response 200 (성공):
{
  "call_id": "vc_1714461234567",
  "request_type": "guide",
  "cached": false,
  "latency_ms": 2840,
  "result": {
    "type": "guide",
    "message": "현재 시스템 환경설정의 보안 패널에 있습니다. 좌측 하단의 잠금 아이콘을 먼저 클릭하여 잠금을 해제해주세요.",
    "highlight_region": {
      "x": 24,
      "y": 480,
      "width": 32,
      "height": 32
    },
    "confidence": "high"
  }
}

Response 503 (Vision API 실패):
{
  "call_id": "vc_...",
  "request_type": "guide",
  "error": "vision_api_timeout",
  "result": null
}

Response 429 (가드레일 작동):
{
  "error": "rate_limit_exceeded",
  "state": "paused",
  "reset_at": 1714465200000,
  "message": "시간당 200회 호출 한도 초과. 다음 시간에 다시 시도해주세요."
}
```

**동작**:
1. Screen Recording 권한 확인 (없으면 401)
2. 가드레일 체크 (호출 카운트, 일시 정지 상태)
3. macOS `screencapture`로 캡처 (메모리 처리)
4. 이미지 hash 계산 → 캐시 체크 (30초 TTL)
5. Claude 3.5 Sonnet Vision API 호출
6. 응답 파싱 (좌표 추출 + 메시지)
7. SQLite `vision_calls`에 메타데이터 기록
8. 캡처 이미지 즉시 메모리 파기

#### 9.1.10 P8 AI Vision Coach - 진행 확인 (v0.9 신규) ⭐

사용자가 Floating Hint Window의 [✓ 진행 확인] 버튼 클릭 시 호출.

```
POST /api/vision/verify
Request:
{
  "item_id": "install-security-agent",
  "step_id": "grant_permission"
}

Response 200 (PASS - 단계 완료):
{
  "call_id": "vc_...",
  "request_type": "verify",
  "cached": false,
  "latency_ms": 3120,
  "result": {
    "type": "verify",
    "status": "pass",
    "reasoning": "보안 에이전트가 권한 부여된 앱 목록에 표시되어 있고, 체크박스가 활성화되어 있습니다.",
    "next_action_hint": null
  }
}

Response 200 (FAIL - 아직 미완료):
{
  "call_id": "vc_...",
  "result": {
    "type": "verify",
    "status": "fail",
    "reasoning": "보안 에이전트가 앱 목록에 보이지 않습니다.",
    "next_action_hint": "[+] 버튼을 클릭하고 SecurityAgent를 추가해주세요."
  }
}

Response 200 (UNCLEAR - 판단 불가):
{
  "call_id": "vc_...",
  "result": {
    "type": "verify",
    "status": "unclear",
    "reasoning": "현재 화면이 보안 패널이 아니어서 판단할 수 없습니다.",
    "next_action_hint": "시스템 환경설정의 보안 및 개인정보 보호 패널을 열어주세요."
  }
}
```

**동작**: 9.1.9와 동일하나 프롬프트가 검증용으로 다름. PASS 시 단계 자동 완료 처리.

#### 9.1.11 가드레일 상태 조회 (v0.9 신규)

```
GET /api/vision/rate-limit
Response 200:
{
  "current_hour_calls": 47,
  "alert_threshold": 100,
  "pause_threshold": 200,
  "state": "normal",
  "reset_at": 1714465200000
}
```

#### 9.1.12 사용자 동의 등록/조회 (v0.9 신규)

```
POST /api/consents
Request:
{
  "consent_type": "anthropic_transmission",
  "granted": true
}
Response 200: { "ok": true, "granted_at": 1714461234567 }

GET /api/consents
Response 200:
{
  "screen_recording": { "granted": true, "granted_at": 1714461200000 },
  "anthropic_transmission": { "granted": true, "granted_at": 1714461234567 },
  "machine_info": { "granted": true, "granted_at": 1714461100000 }
}
```

### 9.2 Backend API (`https://onboarding.wrtn.ax`)

#### 9.2.1 진행상황 동기화 (데몬 → 백엔드)

```
POST /api/v1/sync
Headers: Authorization: Bearer <user_sso_token>
Request:
{
  "employee_id": "...",
  "items": ItemProgressDTO[],
  "client_timestamp": 1714461234567
}
Response 200: { "ok": true, "server_timestamp": 1714461234600 }
```

#### 9.2.2 콘텐츠 동기화 (GitLab webhook → 백엔드)

```
POST /api/v1/content/webhook
Headers: X-Gitlab-Token: <secret>
Request: GitLab Push event payload
Response 200: { "ok": true, "version_id": "..." }
```

#### 9.2.3 Admin: 입사자 목록

```
GET /api/v1/admin/onboardees?status=IN_PROGRESS&role=frontend-engineer
Headers: Authorization: Bearer <admin_sso_token>
Response 200: { "onboardees": [...] }
```

#### 9.2.4 Admin: 입사자 상세

```
GET /api/v1/admin/onboardees/:id
Response 200: { "onboardee": {...}, "items": ItemProgressDTO[] }
```

#### 9.2.5 Admin: 통계

```
GET /api/v1/admin/stats
Response 200:
{
  "avg_time_to_ready_hours": 16.2,
  "items_top_blockers": [{ "item_id": "...", "block_count": 12 }],
  "completion_rate_by_role": {...}
}
```

#### 9.2.6 Admin: Vision 호출 통계 (v0.9 신규)

```
GET /api/v1/admin/vision-stats?period=7d
Response 200:
{
  "period": "7d",
  "total_calls": 1247,
  "total_cost_usd": 28.50,
  "avg_latency_ms": 2840,
  "cache_hit_rate": 0.18,
  "calls_by_type": {
    "guide": 720,
    "verify": 527
  },
  "top_items_by_calls": [
    { "item_id": "install-vpn", "calls": 142, "avg_latency_ms": 3120 },
    { "item_id": "install-security-agent", "calls": 98, "avg_latency_ms": 2900 }
  ],
  "rate_limit_triggers": [
    { "onboardee_id": "...", "trigger_at": "2026-04-30T13:00:00Z", "state": "alert" }
  ]
}
```

#### 9.2.7 Admin: Bottleneck 분석 (P7++)

```
GET /api/v1/admin/bottlenecks
Response 200:
{
  "items": [
    {
      "item_id": "install-vpn",
      "total_attempts": 23,
      "avg_duration_sec": 1380,
      "bottleneck_rate": 0.45,
      "needs_reinforcement": true
    },
    ...
  ]
}
```

### 9.3 Extension ↔ Daemon 통신

| 방향 | 방식 | 빈도 | 비고 |
|------|------|------|------|
| Extension → Daemon | HTTP 폴링 (`GET /api/automation/pending`) | 2초마다 | background.ts |
| Extension → Daemon | HTTP POST (진행 보고) | 스텝별 | content.ts via background.ts |
| Daemon → Extension | 폴링 응답 본문 | 위와 동일 | - |

> **주의**: 폴링 방식은 MVP 단순함을 위한 선택. Phase 2에서 Native Messaging 또는 WebSocket으로 전환 검토.

---

## 10. 외부 의존성 (External Dependencies)

### 10.1 외부 API 및 서비스

| 서비스 | 사용 목적 | 인증 방식 | 필요 스코프 | Rate Limit | 라이브러리 |
|--------|----------|-----------|-------------|------------|-----------|
| Google Gmail API | 서명 등록 검증 | OAuth 2.0 (Loopback) | `gmail.settings.basic` | 250 quota/user/sec | `googleapis` (Node) |
| GitLab API | 콘텐츠 동기화, SSH 키 검증 | Personal Access Token (백엔드용) | `read_api`, `read_repository` | 600 req/min | `@gitbeaker/node` |
| 사내 IdP (OIDC) | SSO 인증 | OIDC Authorization Code Flow | `openid email profile` | - | `openid-client` |
| Slack (사내) | 정체 알림 (Phase 2) | Bot Token | `chat:write` | tier 2 | `@slack/web-api` |
| Anthropic Claude API | **(P8 메인)** AI Vision Coach 화면 분석 — Claude 3.5 Sonnet Vision / **(P7 보조)** 콘텐츠 작성자의 자연어 intent 정제 | API Key | - | tier 1 (Sonnet 기준 분당 1000 RPM) | `@anthropic-ai/sdk` |
| Infisical | 워크스페이스 가입 검증 | API Token | `workspace:read` | - | (REST 직접) |
| Windmill | 가입 검증 | API Token | `workspace:read` | - | (REST 직접) |

### 10.2 OAuth 토큰 보관

| 항목 | 위치 | 암호화 |
|------|------|-------|
| Google OAuth 토큰 | `~/.onboarding/tokens/google.json` | macOS Keychain 권장 |
| 사내 SSO 토큰 | 메모리 (재시작 시 재로그인) | - |

### 10.3 OS 의존성 (macOS 13+)

| 명령/API | 사용 위치 | 용도 |
|---------|----------|------|
| `pbcopy` | daemon `clipboard.ts` | P2 클립보드 주입 |
| `pgrep`, `ps` | daemon `state-probe.ts` | 프로세스 확인 |
| `mdfind` | daemon `state-probe.ts` | 앱 설치 확인 |
| `osascript` | daemon `notification.ts`, `system-panel.ts` | 시스템 알림 / P5+ 시스템 환경설정 진입 |
| `open` | daemon `browser.ts`, `system-panel.ts` | URL 열기 / P5+ macOS URL 스킴 (`x-apple.systempreferences:`) |
| **`screencapture`** ⭐ | daemon `vision-coach.ts` | P8 화면 캡처 (`-x` 비대화식 모드) |
| Homebrew (`brew`) | 사용자 환경 | CLI 도구 설치 (사용자 직접) |
| Node.js 22 LTS | 시스템 또는 번들 | 데몬 실행 환경 (Node SEA 지원) |

#### 10.3.1 macOS 권한 (사용자 부여 필요)

| 권한 | 용도 | 부여 시점 | 거부 시 영향 |
|------|------|----------|-------------|
| Screen Recording ⭐ | P8 AI Vision Coach 화면 캡처 | 첫 P8 호출 시 | P8 사용 불가 (P1~P5++ 결정론 자동화는 정상) |
| 알림 표시 (선택) | 백그라운드 진행 알림 | CLI 실행 시 | 알림 누락만 발생 |

> ⭐ = v0.9 신규. 사용자가 시스템 환경설정 → 개인정보 보호 및 보안 → Screen Recording에서 onboarding 데몬에 권한 부여 필요. Accessibility 권한과 달리 부여 절차가 비교적 단순 (체크 1번).

### 10.4 NPM 패키지 (확정)

```json
// daemon/package.json (주요)
{
  "dependencies": {
    "express": "^4.19.0",
    "cors": "^2.8.5",
    "yaml": "^2.4.0",
    "better-sqlite3": "^11.0.0",
    "zod": "^3.23.0",
    "undici": "^6.0.0",
    "googleapis": "^144.0.0",
    "playwright": "^1.45.0",
    "execa": "^9.0.0",
    "@anthropic-ai/sdk": "^0.30.0",
    "sharp": "^0.33.0",
    "pino": "^9.0.0",
    "@napi-rs/keyring": "^1.1.0"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "supertest": "^7.0.0",
    "msw": "^2.4.0"
  }
}
```

> v0.9 추가: `@anthropic-ai/sdk` (P8 Vision API), `sharp` (이미지 리사이즈/hash), 기타 §19 카탈로그 라이브러리. `msw`는 통합 테스트에서 Anthropic API 모킹용.

---

## 11. Acceptance Criteria (검증 시나리오)

각 기능 요구사항에 대해 객관적 검증 가능한 Given-When-Then 시나리오를 정의한다. Ralph 자동 개발 시 이 시나리오들이 통과하는지가 완료 판단 기준이다.

### 11.1 CLI / Installation (F-CLI-*)

**AC-CLI-01**: 단일 명령 설치 (F-CLI-01)
- **Given**: 깨끗한 macOS 환경, `which onboarding`이 not found 반환
- **When**: `curl -fsSL https://onboarding.wrtn.ax/install.sh | sh` 실행
- **Then**: 명령 종료 시 exit code 0, `which onboarding`이 `/usr/local/bin/onboarding` 반환

**AC-CLI-02**: 데몬 기동 및 브라우저 자동 오픈 (F-CLI-03)
- **Given**: `onboarding`이 PATH에 존재
- **When**: `onboarding` 실행
- **Then**: localhost:7777에서 HTTP 200 응답, 시스템 기본 브라우저에서 해당 URL 자동 오픈

**AC-CLI-03**: 데몬 종료 (F-CLI-04)
- **Given**: 데몬이 실행 중 (`onboarding status`가 running 출력)
- **When**: `onboarding stop` 실행
- **Then**: localhost:7777에 더 이상 응답 없음, `onboarding status`가 stopped 출력

### 11.2 체크리스트 시스템 (F-CHK-*)

**AC-CHK-01**: 동적 콘텐츠 로드 (F-CHK-01)
- **Given**: `~/.onboarding/content/checklist.yaml`에 frontend-engineer 직군 정의
- **When**: `GET /api/checklist` 호출
- **Then**: `items` 배열에 yaml에 정의된 모든 P0 항목 포함, 각 항목은 `ChecklistItem` 타입과 일치 (zod 검증)

**AC-CHK-02**: 의존성 기반 진행 (F-CHK-03)
- **Given**: 항목 B가 `depends_on: [A]` 설정, A는 pending 상태
- **When**: 프론트엔드에서 B 항목 시작 시도
- **Then**: 400 응답 + `{ "error": "Dependency not met: A" }`

**AC-CHK-03**: Ready-to-Work 자동 판정 (F-CHK-06)
- **Given**: 모든 P0 항목이 completed 상태
- **When**: `GET /api/progress` 호출
- **Then**: 응답에 `"ready_to_work": true` 포함

### 11.3 자동화 - 4가지 패턴 (F-AUT-*)

**AC-AUT-01**: P1 State Probe - 명령 기반 (F-AUT-01)
- **Given**: 시스템에 `git`이 설치됨
- **When**: state_probe `{ type: 'command', command: 'git --version' }` 실행
- **Then**: probe 결과 `{ ok: true, output: 'git version ...' }`

**AC-AUT-02**: P1 State Probe - 프로세스 확인 (F-AUT-01)
- **Given**: `Mock SecurityAgent` 프로세스 실행 중
- **When**: state_probe `{ type: 'process_check', process_name: 'Mock SecurityAgent' }`
- **Then**: probe 결과 `{ ok: true }`

**AC-AUT-03**: P2 Clipboard Inject (F-AUT-02)
- **Given**: 클립보드가 비어있음
- **When**: `clipboard_inject` 실행
- **Then**: `pbpaste`로 확인 시 정의된 명령어가 클립보드에 존재

**AC-AUT-04**: P3 Guided Browser - Extension 모드 (F-AUT-03)
- **Given**: Chrome Extension 설치됨, 데몬 실행 중
- **When**: 데몬에 `POST /api/automation/start` 호출 (Gmail 항목)
- **Then**: 60초 이내 Extension이 요청 픽업, content script가 Gmail 페이지에서 정의된 step 시퀀스 실행, 진행 보고 수신

**AC-AUT-05**: P3 fallback (F-AUT-04, F-AUT-07)
- **Given**: Extension 미설치 상태
- **When**: 자동화 시작
- **Then**: 데몬이 Playwright 헤드드 모드로 자동 fallback, 동일 step 실행

**AC-AUT-06**: P4 Auto Verify - command (F-AUT-05)
- **Given**: 항목의 verification이 `{ type: 'command', command: 'brew --version' }`
- **When**: brew 설치 후 verifier 실행
- **Then**: 항목 상태가 자동으로 `completed`로 전환

**AC-AUT-07**: P4 Auto Verify - http_check (F-AUT-05)
- **Given**: Mock HTTP 서버가 `{ "signature": "Tao - Engineer" }` 응답
- **When**: verification `{ type: 'http_check', expect: { jsonpath: '$.signature', contains: 'Tao' } }`
- **Then**: verifier가 true 반환

**AC-AUT-08**: 권한 작업 자동 실행 금지 (F-AUT-06)
- **Given**: 항목에 `clipboard_inject.command: 'sudo rm -rf /tmp/test'`
- **When**: 데몬이 해당 항목 실행
- **Then**: 데몬이 sudo 명령을 직접 실행하지 않음, 클립보드에만 주입

**AC-AUT-09**: 봇 탐지 fallback (F-AUT-08)
- **Given**: 페이지에 reCAPTCHA iframe 감지됨
- **When**: Extension 자동화 진행 중
- **Then**: 자동 조작 즉시 중단, 사용자 직접 입력 모드 UI 표시

### 11.4 콘텐츠 관리 (F-CNT-*)

**AC-CNT-01**: YAML 스키마 검증 (F-CNT-03)
- **Given**: `checklist.yaml`에 type 누락된 verification
- **When**: 백엔드 content-sync가 webhook으로 수신
- **Then**: 동기화 실패 + 에러 로그 + 이전 버전 유지

**AC-CNT-02**: GitLab webhook 동기화 (F-CNT-02)
- **Given**: `onboarding-content` 레포 main 브랜치에 push 발생
- **When**: GitLab이 webhook 발사
- **Then**: 60초 이내 백엔드 `ContentVersion` 테이블에 새 버전 기록, 데몬이 다음 폴링에서 새 콘텐츠 수신

### 11.5 통합 시나리오 (Gmail 서명 등록)

**AC-INT-01**: Gmail 서명 등록 E2E
- **Given**: 사용자가 Gmail에 로그인된 Chrome, 데몬 실행, Extension 설치
- **When**: 프론트엔드에서 직무/전화번호 입력 후 "자동 등록 시작" 클릭
- **Then**:
  1. 5초 이내 Gmail 설정 페이지로 이동
  2. 30초 이내 step 시퀀스 모두 실행 (저장 버튼 제외)
  3. 저장 버튼에 빨간 펄스 + 툴팁 표시
  4. 사용자가 저장 클릭 후 60초 이내 Gmail API 검증 통과
  5. 항목 상태가 `completed`로 전환
  6. 프론트엔드에 ✅ 표시

### 11.5.1 P8 AI Vision Coach AC (v0.9 신규) ⭐

**AC-VIS-01**: Screen Recording 권한 미부여 시 거부
- **Given**: 사용자가 Screen Recording 권한을 부여하지 않음
- **When**: `POST /api/vision/guide` 호출
- **Then**: HTTP 401 + `{ "error": "screen_recording_permission_required" }` + Floating Hint Window에 권한 부여 안내 표시

**AC-VIS-02**: Anthropic 전송 동의 미부여 시 거부
- **Given**: 사용자가 `anthropic_transmission` 동의를 거부함
- **When**: `POST /api/vision/guide` 호출
- **Then**: HTTP 403 + `{ "error": "consent_required" }` + 동의 화면 표시

**AC-VIS-03**: 안내 요청 정상 흐름
- **Given**: 사용자가 시스템 환경설정의 보안 패널을 보고 있음 + 모든 권한/동의 OK
- **When**: [📋 안내 요청] 버튼 클릭
- **Then**:
  1. 5초 이내 응답 도착 (P95)
  2. 응답에 `message` 필드 포함
  3. `highlight_region`이 있으면 좌표가 화면 범위 내 (0 ≤ x,y, x+width ≤ screen_width)
  4. `confidence`가 'high' 또는 'medium'
  5. SQLite `vision_calls` 테이블에 메타데이터 기록
  6. 캡처 이미지가 메모리/디스크에 남아있지 않음

**AC-VIS-04**: 진행 확인 - PASS 판정
- **Given**: 사용자가 단계 X를 완료한 상태의 화면
- **When**: [✓ 진행 확인] 버튼 클릭
- **Then**:
  1. AI 응답 `status: "pass"` + 근거 텍스트
  2. 항목 상태가 `completed`로 자동 전환
  3. 프론트엔드/Floating Window에 ✅ 표시 + 다음 단계로 진행

**AC-VIS-05**: 진행 확인 - FAIL 판정
- **Given**: 사용자가 아직 단계 X를 완료하지 않은 화면
- **When**: [✓ 진행 확인] 버튼 클릭
- **Then**:
  1. AI 응답 `status: "fail"` + 근거 + `next_action_hint`
  2. 항목 상태 `in_progress` 유지
  3. Floating Hint Window에 다음 행동 안내

**AC-VIS-06**: 캐시 동작
- **Given**: 동일 단계에서 동일 화면 캡처 후 30초 내 재호출
- **When**: 두 번째 호출
- **Then**:
  1. `cached: true` 응답
  2. `latency_ms` 100ms 미만
  3. SQLite `vision_calls.cache_hit = 1` 기록
  4. Anthropic API 실제 호출 안 됨

**AC-VIS-07**: 가드레일 - debounce
- **Given**: 시스템 정상 상태
- **When**: 1초 내 같은 엔드포인트로 5회 호출
- **Then**: 첫 호출만 처리, 나머지 4회는 동일 응답 즉시 반환

**AC-VIS-08**: 가드레일 - 시간당 알림 (100회)
- **Given**: 시간당 99회 호출 누적
- **When**: 100번째 호출
- **Then**:
  1. 호출은 정상 처리
  2. Floating Hint Window에 알림 표시 ("호출 횟수가 평소보다 많습니다, 혹시 문제가 있나요?")
  3. 백엔드 admin에게 이벤트 기록

**AC-VIS-09**: 가드레일 - 시간당 일시 정지 (200회)
- **Given**: 시간당 200회 호출 누적
- **When**: 201번째 호출
- **Then**:
  1. HTTP 429 응답 + `state: "paused"` + `reset_at` 포함
  2. 다음 시간대 시작까지 모든 Vision 호출 거부
  3. 관리자 Slack 알림 발송

**AC-VIS-10**: API 실패 시 폴백
- **Given**: Anthropic API 응답 실패 (timeout 또는 5xx)
- **When**: 호출 시도
- **Then**:
  1. HTTP 503 + `error: "vision_api_timeout"` 또는 `vision_api_error`
  2. Floating Hint Window에 에러 메시지 + [🔄 재시도] 버튼 표시
  3. SQLite `vision_calls.error` 필드에 기록

**AC-VIS-11**: 이미지 데이터 파기
- **Given**: 임의의 Vision API 호출 완료
- **When**: 데몬 프로세스 검사
- **Then**:
  1. `/tmp/onboarding-capture-*.png` 파일 0개 (응답 후 즉시 삭제)
  2. SQLite `vision_calls` 어디에도 이미지 binary 또는 base64 없음
  3. 메모리 dump 검사 시 이미지 buffer 미존재 (1초 이내)

**AC-VIS-12**: 응답 지연 P95
- **Given**: 100회 안내 요청 호출 (캐시 제외)
- **When**: 응답 시간 분포 측정
- **Then**: P50 ≤ 3초, P95 ≤ 5초, P99 ≤ 8초

**AC-VIS-13**: 좌표 정확도 (수동 검증)
- **Given**: 10개 표준 시나리오 (시스템 환경설정, Gmail 등)
- **When**: 안내 요청 시 응답의 `highlight_region`을 실제 화면에 오버레이
- **Then**: 8개 이상에서 사용자가 클릭해야 할 영역에 박스가 정확히 위치 (80% 이상 정확도)

> AC-VIS-13은 사람 검증이 필요한 정성적 평가. Pilot 단계에서 측정.

**AC-VIS-14**: Floating Hint Window 동작
- **Given**: Floating Hint Window가 떠 있는 상태
- **When**: 사용자가 시스템 환경설정에서 클릭/타이핑
- **Then**:
  1. Floating Hint Window는 사용자 입력에 일절 개입하지 않음 (포커스 빼앗지 않음)
  2. 사용자 입력이 시스템 환경설정에 정상 전달됨
  3. Floating Hint Window는 always-on-top 유지

### 11.6 Acceptance Criteria 실행 환경

각 AC는 다음 환경에서 자동 실행 가능해야 한다.

| 카테고리 | 도구 | 위치 |
|---------|------|------|
| 단위 테스트 | Vitest | `packages/*/tests/unit/` |
| 통합 테스트 (데몬 API) | Vitest + supertest | `packages/daemon/tests/integration/` |
| E2E (Extension + Mock Gmail) | Playwright | `packages/extension/tests/e2e/` |
| E2E (CLI 설치) | Bash + Docker | `packages/cli/tests/e2e/` |
| 통합 시나리오 | Playwright + Mock 서버 | `tests/integration/` (루트) |
| **P8 Vision AC (Mock)** | Vitest + msw로 Anthropic API 모킹 | `packages/daemon/tests/vision/` |
| **P8 Vision AC (실제)** | 실제 API + 표준 시나리오 화면 | `tests/manual/vision-quality.md` |

> AC-VIS-13 같은 정성적 평가는 매 Pilot 단계에서 사람이 검증.

---

## 12. 콘텐츠 정의 예시 (Content Schema)

### 12.1 `checklist.yaml` 예시 (v0.9)

v0.9에서 콘텐츠 스키마는 **자연어 intent 기반**으로 단순화되었다. 작성자는 단계별 의도와 성공 기준만 자연어로 작성하면 된다. 스크린샷, 좌표, 마크업 모두 불필요.

#### 12.1.1 v0.9 핵심 형식 (P8 AI Vision Coach 활용)

```yaml
version: 2                     # v0.9에서 스키마 버전 2로 상향
schema: ai-coaching            # AI 코칭 모드

roles:
  - id: frontend-engineer
    name: 프론트엔드 엔지니어
    items:

      # 예시 1: AI Vision 단독 (가장 단순한 케이스)
      - id: install-security-agent
        title: 사내 보안 에이전트 설치
        category: security
        priority: P0
        estimated_minutes: 5

        ai_coaching:
          overall_goal: |
            사용자가 사내 보안 에이전트(.pkg)를 다운로드하고 설치한 뒤,
            시스템 환경설정에서 권한을 부여하고 백그라운드 프로세스가
            실행되도록 한다.

          steps:
            - id: download
              intent: |
                security.wrtn.io/download 페이지에서
                .pkg 파일을 다운로드한다.
              success_criteria: |
                ~/Downloads 폴더에 SecurityAgent-*.pkg 파일이 존재한다.
              common_mistakes: |
                - 다른 페이지에서 다운로드하려는 경우
                - .dmg 파일과 혼동하는 경우

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
                P5+ 패턴으로 데몬이 패널을 자동으로 열어준다.
              system_panel_url: x-apple.systempreferences:com.apple.preference.security
              success_criteria: |
                pgrep SecurityAgent 결과가 PID를 반환한다.
              common_mistakes: |
                - 잠금 해제 안 한 채 클릭 시도
                - 다른 앱과 혼동

      # 예시 2: AI Vision + 결정론적 자동화 (P3 Guided Browser) 조합
      - id: setup-gmail-signature
        title: Gmail 회사 표준 서명 등록
        category: team-tools
        priority: P0
        estimated_minutes: 1

        # 사용자 입력 (이 항목은 동적 입력 필요)
        inputs:
          - key: job_title
            label: 직무
            placeholder: 예) 프론트엔드 엔지니어
            required: true
          - key: phone
            label: 전화번호
            placeholder: 예) 010-1234-5678
            required: true

        # 결정론적 부분: 페이지 진입 + 서명 자동 입력 (P3)
        guided_browser:
          type: extension
          url: https://mail.google.com/mail/u/0/#settings/general
          steps:
            - action: scroll_to
              selector: 'div[aria-label="서명"]'
            - action: click
              selector: 'button[aria-label="새로 만들기"]'
            - action: inject_html
              selector: 'div[aria-label="서명 텍스트 영역"]'
              template_path: templates/gmail-signature.html
              variables:
                user_name: "{{user_profile.name}}"
                job_title: "{{inputs.job_title}}"
                phone: "{{inputs.phone}}"
            - action: highlight_only
              selector: 'button[aria-label="변경사항 저장"]'
              tooltip: "최종 확인 후 저장 버튼을 직접 클릭하세요"

        # AI Vision 부분: 사용자가 헤매면 보조
        ai_coaching:
          overall_goal: "Gmail에 회사 표준 서명을 등록"
          steps:
            - id: confirm_signature_set
              intent: "서명이 표시되고 기본 서명으로 지정되었는지 확인"
              success_criteria: "Gmail 설정 페이지에 서명 미리보기가 보이고, 기본 서명 드롭다운이 활성화됨"

        # 결정론적 검증 (P4) - AI 검증과 병행 가능
        verification:
          type: http_check
          method: GET
          url: https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs
          auth: oauth_user_token
          expect:
            jsonpath: $.sendAs[0].signature
            contains: "{{user_profile.name}}"

      # 예시 3: 결정론 100% (CLI 설치) - P8 미사용
      - id: install-homebrew
        title: Homebrew 설치
        category: dev-environment
        priority: P0

        clipboard_inject:
          command: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
          ui_hint: "터미널을 열고 ⌘V로 붙여넣어 실행하세요"

        verification:
          type: command
          command: brew --version
          poll_interval_sec: 5
        # ai_coaching 필드 없음 - AI Vision 불필요
```

#### 12.1.2 v0.9 스키마 핵심 규칙

| 규칙 | 설명 |
|------|------|
| `ai_coaching` 필드는 **선택** | CLI 설치 같이 화면 분석 불필요한 항목은 생략 |
| `guided_browser`와 `ai_coaching` 공존 가능 | 결정론 자동화 + AI 보조 조합 (예시 2) |
| `verification` 우선순위 | HTTP/command/process 검증이 있으면 그게 우선, 없으면 AI Vision의 `success_criteria`로 검증 |
| `system_panel_url` | macOS URL 스킴 (P5+ 자동 진입) |
| `common_mistakes` 선택 입력 | AI에게 추가 컨텍스트 제공, 미입력 시 AI 자체 판단 |
| `fallback_text` 선택 입력 | Vision API 실패 시 표시할 정적 텍스트 (옵션, 미입력 시 intent 그대로 표시) |

#### 12.1.3 v0.8 스키마와의 호환성

v0.8에서 만든 항목(`visual_guide` 필드 사용)은 v0.9 데몬에서 그대로 동작한다 (역호환). 단, 새 항목은 v0.9 형식 권장.

```yaml
# v0.8 예시 (호환성 유지용, 신규 작성은 권장 안 함)
version: 1
schema: visual-guide
items:
  - id: legacy-item
    visual_guide:
      steps:
        - media: guides/legacy/step1.png
          annotations:
            - type: arrow
              x: 320
              y: 180
```

### 12.2 자동화 타입별 구현 매핑

| 타입 | 구현 방식 | 비고 |
|------|----------|------|
| `state_probe.command` | shell exec → exit code & stdout 파싱 | 동기 실행 |
| `state_probe.file_exists` | Node.js `fs.existsSync` 또는 glob | 빠름 |
| `state_probe.process_check` | macOS `pgrep`, `ps` | 폴링 기반 가능 |
| `state_probe.app_installed` | `mdfind` 또는 `/Applications` 스캔 | macOS 한정 |
| `clipboard_inject` | macOS `pbcopy` 또는 Node.js clipboardy | 즉시 동작 |
| `guided_browser.extension` | Chrome Extension + Native Messaging | 사용자 세션 활용 |
| `guided_browser.playwright` | Playwright headed 모드 | 별도 브라우저 |
| `verification.command` | shell exec | exit code 기반 |
| `verification.http_check` | fetch + 상태/응답 검증 | 인증 토큰 필요 시 사용자 입력 |
| `system_panel_url` ⭐ | `open <URL>` 또는 osascript | macOS 시스템 환경설정 자동 진입 (P5+) |
| `ai_coaching.steps[].intent` ⭐ | Claude Vision API 프롬프트에 컨텍스트로 주입 | P8 |
| `ai_coaching.steps[].success_criteria` ⭐ | Claude Vision 검증 프롬프트에 주입 | P8 [✓ 진행 확인] 시 |
| `ai_coaching.steps[].common_mistakes` ⭐ | Claude Vision 안내 프롬프트에 주입 | P8 [📋 안내 요청] 시 (선택) |

### 12.3 POC 테스트 케이스: Gmail 서명 등록

MVP 검증을 위한 첫 번째 POC 시나리오로 **Gmail 회사 표준 서명 등록**을 선정한다.

**선정 이유**
- 자동화 4가지 패턴 중 P3(Guided Browser)와 P4(Auto Verify)를 동시에 검증 가능
- 외부 권한 요청 / sudo 필요 없음 → 안전하게 검증
- 사용자별 동적 입력값(직무, 이름, 전화번호)이 있어 폼 자동 채움 강점이 드러남
- 모든 사내 입사자에게 공통 적용되는 항목 → 실용성 높음

**원래 사용자가 거쳐야 하는 단계**
1. Gmail 우측 상단 설정(톱니바퀴) → "모든 설정 보기" → "서명" 메뉴 진입
2. 새 서명 생성 → 회사 표준 양식 붙여넣기 (뤼튼 로고 포함)
3. 본인 정보로 변경 (직무, 이름, 전화번호)
4. 기본 서명으로 지정 (새 메일 / 답장 모두)
5. 하단 "변경사항 저장" 클릭

**자동화 후 사용자 경험**
1. 온보딩 UI에서 "Gmail 서명 등록" 항목 진입
2. 직무/전화번호 입력 폼 (이름과 이메일은 사용자 프로필에서 자동 채움)
3. "시작하기" 클릭 시 Chrome Extension이 Gmail 설정 페이지로 자동 이동
4. 서명 메뉴까지 자동 스크롤 + 강조 표시
5. 서명 본문 영역에 회사 표준 HTML이 자동 입력됨 (사용자 정보 치환 완료)
6. "기본 서명" 드롭다운 자동 선택
7. 사용자는 최종 검토 후 "변경사항 저장" 버튼만 클릭
8. 시스템이 Gmail Settings API로 서명 등록 여부 자동 검증 → 체크리스트 자동 완료

**테스트 케이스 정의 (`checklist.yaml`)**

```yaml
- id: setup-gmail-signature
  title: Gmail 회사 표준 서명 등록
  category: team-tools
  priority: P0

  # 사용자에게 받을 입력값
  inputs:
    - key: job_title
      label: 직무
      placeholder: 예) 프론트엔드 엔지니어
      required: true
    - key: phone
      label: 전화번호
      placeholder: 예) 010-1234-5678
      required: true

  # P3: Guided Browser
  guided_browser:
    type: extension
    fallback: playwright
    url: https://mail.google.com/mail/u/0/#settings/general

    steps:
      - action: scroll_to
        selector: 'div[aria-label="서명"]'
        tooltip: "여기가 서명 설정 영역입니다"

      - action: click
        selector: 'button[aria-label="새로 만들기"]'
        wait_after: 500

      - action: type
        selector: 'input[aria-label="서명 이름"]'
        value: "기본 서명"

      - action: click
        selector: 'button[aria-label="만들기"]'

      - action: inject_html
        selector: 'div[aria-label="서명 텍스트 영역"]'
        template: templates/gmail-signature.html
        # 템플릿 내 {{user.name}}, {{job_title}}, {{phone}} 자동 치환

      - action: select_dropdown
        selector: 'select[aria-label="새 메일에 사용"]'
        value: "기본 서명"

      - action: select_dropdown
        selector: 'select[aria-label="답장/전달에 사용"]'
        value: "기본 서명"

      - action: highlight
        selector: 'button[aria-label="변경사항 저장"]'
        tooltip: "최종 확인 후 저장 버튼을 직접 클릭하세요"
        # 저장 버튼은 의도적으로 자동 클릭하지 않음 (사용자 최종 확인)

  # P4: Auto Verify
  verification:
    type: http_check
    method: GET
    url: https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs
    auth: oauth_user_token  # 사용자 OAuth 토큰 사용
    expect:
      jsonpath: $.sendAs[0].signature
      contains: "{{user.name}}"
    poll_interval_sec: 3
    timeout_sec: 60

  guide: guides/gmail-signature.md
```

**검증 가능 여부**

| 항목 | 자동화 가능 | 비고 |
|------|------------|------|
| 페이지 자동 이동 | O | URL 직접 진입 가능 |
| 서명 메뉴 위치 안내 | O | aria-label 셀렉터 안정적 |
| 회사 표준 양식 자동 입력 | O | HTML 템플릿 + 사용자 정보 치환 |
| 본인 정보 자동 채움 | O | inputs로 받은 값 사용 |
| "기본 서명" 자동 선택 | O | 드롭다운 조작 |
| **저장 버튼 클릭** | X (의도적) | 사용자 최종 확인 후 직접 클릭 |
| 등록 결과 검증 | O | Gmail API `sendAs` 엔드포인트 |

**예상 효과**
- 기존: 평균 5~7분 소요 (양식 찾기, 복사/붙여넣기, 정보 수정)
- 자동화 후: 30초 이내 (저장 버튼만 누르면 됨)

---

## 13. 자동화 실현 가능성 분석 (Automation Feasibility)

> 본 섹션은 PRD에 기술된 자동화 패턴이 현실적으로 구현 가능한지에 대한 검토 결과를 정리한다.
> **핵심 결론**: 완전 자동화가 불가능한 영역(권한 작업)이 일부 존재하지만, **준비(P2) + 검증(P4) + 가이드(P3)** 의 조합으로 사용자 체감 부담을 70% 이상 줄일 수 있다.

### 13.1 영역별 가능성 평가

| 영역 | 가능성 | 적용 패턴 | 비고 |
|------|--------|----------|------|
| 사내 웹 도구 가입 안내 (GitLab, Infisical, Windmill) | 높음 | P3 (Extension 우선) | OAuth 페이지는 자동 입력 제외 |
| Homebrew 기반 CLI 도구 설치 | 매우 높음 | P2 + P4 | 단일 명령어로 종결 |
| 설치 완료 검증 | 매우 높음 | P4 (`command`, `process_check`) | 시스템이 자동 판정 |
| SSH 키 생성 안내 | 높음 | P2 + P4 | 명령어 복사 + 결과 검증 |
| GitLab/Bitbucket에 SSH 키 등록 | 높음 | P2 + P3 + P4 | 공개키 클립보드 자동 복사 + 페이지 가이드 |
| Git 글로벌 설정 (`user.name`, `user.email`) | 매우 높음 | P2 + P4 | 사용자 정보 기반 명령어 자동 생성 |
| 보안 에이전트 설치 | **높음** ⬆ | P5+ + P8 + P4 | v0.9에서 AI Vision으로 동적 안내 가능 (v0.8 중간) |
| **macOS 시스템 환경설정 진입 (보안/네트워크/접근성)** ⭐ | 높음 | P5+ (`open` URL 스킴) | v0.9 신규. AppleScript 또는 macOS URL 스킴으로 패널 자동 진입 |
| **시스템 환경설정 내 권한 부여 안내** ⭐ | 중간 | P8 (AI Vision) + P5++ (Hint Window) | v0.9 신규. AI가 화면 분석 후 동적 안내 |
| **macOS 네이티브 앱 설치 마법사 안내** ⭐ | 중간 | P8 + P5++ | v0.9 신규. 마법사 단계별 AI 안내. 단, 클릭은 사용자 직접 |
| 사내망 VPN 설정 | 중간 | P2 + P5+ + P4 | 프로파일 다운로드 자동, 인증서 신뢰는 사용자 |
| 키체인 접근 / 패스워드 입력 | 낮음 | 안내만 | 보안상 자동화 금지 |

> ⭐ = v0.9 신규 영역. P8 AI Vision Coach 도입으로 macOS 시스템 작업의 자동 안내가 가능해짐.

### 13.2 Chrome Extension vs Playwright 비교

| 항목 | Chrome Extension | Playwright |
|------|------------------|-----------|
| 사용자 기존 세션 활용 | O (자연스러운 UX) | X (재로그인 필요) |
| 설치 단계 | 필요 (1회성) | 불필요 |
| UI 오버레이 자연스러움 | 높음 | 보통 (별도 창) |
| 사이트 UI 변경 영향 | 동일하게 영향 받음 | 동일하게 영향 받음 |
| 봇 탐지 우회 | 자연스럽게 회피 | 자주 차단됨 |
| 권장 용도 | 사내 도구 (GitLab, Infisical 등) | Extension 미설치자 fallback |

**결정**: **Chrome Extension을 기본 옵션으로, Playwright를 fallback으로** 채택. 익스텐션은 onboarding CLI 첫 실행 시 설치 가이드를 함께 제공.

### 13.3 자동화하지 않는 영역 (의도적 제외)

다음 작업은 보안/신뢰 관점에서 자동화하지 않는다.

- **OAuth 로그인 페이지 입력**: 계정 탈취 위험으로 보일 수 있음, 사용자가 직접 입력
- **sudo 권한 명령**: 비밀번호 입력은 항상 사용자 직접
- **시스템 키체인 접근**: 사용자 동의 단위로 처리 불가
- **타사 SaaS 결제/계약 페이지**: 자동 클릭 금지

이 영역들은 **명령어 안내(P2) + 결과 자동 검증(P4)** 으로 처리하여 사용자 부담을 최소화한다.

#### 13.3.1 macOS Accessibility API 직접 자동화의 명시적 제외

검토 결과 **macOS Accessibility API를 활용한 자동 클릭/입력은 채택하지 않는다**. 시연용으로는 매력적이나 운영 비용이 효익을 초과한다.

**제외 사유 (6가지)**:

1. **권한 부여가 사용자 경험을 깨뜨림**: "온보딩을 쉽게 하기 위한 시스템"이 시작부터 사용자가 가장 헤매는 권한 부여 절차(시스템 환경설정 → 개인정보 보호 → 손쉬운 사용 → 잠금 해제 → 비밀번호 → 체크 → 데몬 재시작)를 강요. 첫 5분에 사용자가 포기할 위험.
2. **코드 서명 + 노타리제이션 의무**: Apple Developer Program ($99/년) + Developer ID 인증서 + 빌드 시 codesign + Apple notarization 필수. 일반 Node SEA 바이너리에 별도 적용 필요.
3. **Node에서 직접 호출 불가**: Accessibility API는 Swift/Objective-C 전용. Node 프로젝트에 Swift 헬퍼 추가 시 Xcode 환경, Universal Binary 빌드, macOS 버전별 API 차이 대응으로 30~50시간 추가.
4. **UI 요소 식별의 불안정성**: 한국어/영어/일본어 라벨 분기, AXIdentifier 노출 여부에 의존. 좌표 기반은 fragile.
5. **실패 디버깅 어려움**: 권한/요소/좌표/UI 변경 중 어디가 문제인지 사용자 머신에서 원격 진단 거의 불가.
6. **유지보수 폭탄**: 매년 macOS 메이저 업데이트 시 (Ventura에서 시스템 환경설정 UI 전면 개편 사례) 거의 모든 spec 재구현 필요.

**대안: P5 + P5+ + P5++ 조합 (v0.8) → P8 AI Vision Coach (v0.9)**

진짜 Accessibility 자동화는 안 하지만, 사용자 경험상 비슷한 임팩트를 다음 조합으로 달성:

- **v0.8 접근**: P5 정적 이미지 + P5+ AppleScript 패널 진입 + P5++ Floating Hint Window
- **v0.9 접근 (현재)**: P8 AI Vision Coach가 메인. P5+/P5++ 보조. 화면을 동적으로 분석하여 안내.

v0.9는 Screen Recording 권한이 필요하지만, Accessibility보다는 허들이 낮고 (권한 부여 1회), AI가 화면을 보고 동적으로 안내하므로 **사용자 입장에서는 "사람이 옆에서 봐주는" 진짜 경험**을 제공한다. 단, Vision API 비용과 응답 지연(2~4초)을 감수해야 한다.

### 13.4 핵심 사용자 경험 시나리오

다음 5가지가 자동화의 체감 임팩트가 가장 큰 패턴이다.

1. **명령어 자동 복사 (P2)** — 항목 진입 시 클립보드에 명령어가 이미 들어가 있어, 사용자는 터미널에서 ⌘V만 누르면 됨
2. **자동 검증 (P4)** — "완료" 버튼을 누르지 않아도 시스템이 알아서 확인하고 다음 항목으로 진행
3. **Guided Browser (P3)** — "GitLab SSH 키 등록 페이지로 이동했습니다" → 정확한 입력란 하이라이트 + 입력값 자동 채움
4. **시작 시 일괄 상태 점검 (P1)** — 입사자 머신에서 이미 설치된 것 / 부족한 것을 한 번에 스캔하여 첫 화면에 표시
5. **AI 비전 코칭 (P8) ⭐ v0.9 신규** — 시스템 환경설정 같은 외부 앱에서 헤매면 [📋 안내 요청] 버튼 → AI가 화면 보고 "여기 클릭하세요" 빨간 박스로 안내. 사람이 옆에서 봐주는 느낌

### 13.5 알려진 리스크 및 대응

| 리스크 | 대응 |
|--------|------|
| 외부 사이트 UI 변경으로 셀렉터 깨짐 | 자동화 실패 시 P2(명령어/스크린샷) 안내로 자동 fallback (F-AUT-07) |
| Cloudflare/CAPTCHA 차단 | 봇 탐지 감지 시 자동 조작 중단, 사용자 직접 입력 모드 (F-AUT-08) |
| 머신 정보 수집에 대한 거부감 | 설치 시 사용자 동의 절차 + 수집 항목 명시 (F-AUT-10) |
| Extension 설치를 꺼리는 사용자 | Playwright fallback 제공 (F-AUT-04) |
| **Anthropic Vision API 다운** ⭐ | P8 차단되나 P1~P5++는 정상 동작. Floating Hint Window에 에러 + 재시도 버튼 (F-AUT-27) |
| **Vision API 응답 지연 (2~5초)** ⭐ | UX 차원 처리: 로딩 인디케이터, 캐시 적용, 응답 P95 ≤ 5초 SLA (§7) |
| **Vision API 비용 폭증** ⭐ | 시간당 100회 알림 / 200회 일시 정지 가드레일 (F-AUT-24). 입사자당 최대 ~$10 |
| **Vision 분석 정확도 한계** ⭐ | confidence 'low' 시 사용자에게 명시. 좌표 정확도 80% 목표 (AC-VIS-13) |
| **사내 화면 외부 전송 정책 검토** ⭐ | Pilot 전 보안팀/법무팀 승인 필수. 동의 없이는 P8 차단 (AC-VIS-02) |
| **Screen Recording 권한 거부** ⭐ | P8 사용 불가, 정적 가이드(P5) 또는 텍스트 안내로 자동 폴백 |

> ⭐ = v0.9 신규 리스크. P8 AI Vision Coach 도입에 따른 신규 위험 요인.

---

## 14. MVP 스코프

### 14.1 MVP 포함

**입사자용 자동화 (P1~P5++, P8)**

- macOS용 CLI 설치 스크립트 (curl 한 줄) 및 로컬 데몬
- 체크리스트 UI (로컬 웹, localhost) — 시작/관리 허브
- **결정론적 자동화 4종 (P1~P4)**
  - P1 State Probe: 머신 상태 일괄 점검
  - P2 Clipboard Inject: 명령어 자동 복사
  - P3 Guided Browser: Chrome Extension + Playwright fallback
  - P4 Auto Verify: command, process_check, file_exists, http_check
- **시각 가이드 보조 (P5+, P5++)**
  - P5+ System Panel Launch: AppleScript 기반 시스템 환경설정 패널 자동 진입
  - P5++ Floating Hint Window: 운영 중 메인 UI (always-on-top 반투명 윈도우)
- **AI Vision Coach (P8) ⭐ v0.9 핵심**
  - Screen Recording 권한 기반 화면 캡처
  - Claude 3.5 Sonnet Vision API 호출
  - 두 버튼 ("안내 요청" / "진행 확인") via Floating Hint Window
  - 빨간 박스 오버레이로 클릭 영역 표시
  - 시스템 가드레일 (debounce, 캐시, 알림 임계값)
  - 캡처 이미지 즉시 파기

**작성자용 도구 (간소화됨)**

v0.9에서는 작성자 부담이 극단적으로 줄어든다.

- **자연어 intent 입력만**: 단계별 의도, 성공 기준, common_mistakes(선택)을 자연어로 작성
- **P7 AI Draft (변형 유지)**: 작성자가 한 줄 입력 시 자연어 intent 정제
- **P7++ Bottleneck Analyzer**: 어드민 대시보드 정체율 표

> v0.8에서 계획했던 P6 Author Capture, P7+ Change Detector는 **폐기**. AI Vision이 동적 인식하므로 사전 캡처/변경 감지 불필요.

**백엔드/관리자**

- 백엔드 진행상황 API + 어드민 대시보드 (기본 뷰 + 정체 분석)
- GitLab 레포 기반 콘텐츠 관리 (자연어 intent yaml)

### 14.2 MVP 이후 (Phase 2+)

- 온보딩메이트 RAG 챗 (Phase 2)
- 정체 알림 / Slack 통합 (Phase 2)
- 직군별 분기 / 팀별 커스터마이징 고도화 (Phase 2)
- Guided Browser 확장 (사외 SaaS 도구) (Phase 2)
- Vision API 비용 최적화: Haiku 우선 + Sonnet 폴백 하이브리드 (Phase 2)
- 자동 트리거 (사용자 30초 정체 시 자동 분석) (Phase 2)
- 프라이버시 강화: 비밀번호 입력 화면 자동 마스킹 (Phase 2)
- 통계 분석 및 콘텐츠 개선 추천 ML (Phase 3)
- Windows/Linux 지원 (Phase 3)

---

## 15. 성공 지표 (Success Metrics)

| 지표 | 측정 방법 | 목표 |
|------|----------|------|
| Time-to-Ready | 입사일~Ready-to-Work까지 시간 | 기존 대비 50% 단축 |
| 자가 완료율 | 사람 개입 없이 완료한 항목 비율 | 80% 이상 |
| 만족도 | 입사자 NPS 설문 | 8/10 이상 |
| 누락률 | Ready-to-Work 후 발견된 누락 항목 수 | 평균 0.5건 이하 / 입사자 |
| 사수 시간 절감 | 사수가 온보딩에 쓰는 시간 | 기존 대비 60% 절감 |
| **P8 정확도** ⭐ | [✓ 진행 확인] PASS 후 사용자 수동 정정 비율 | 10% 이하 |
| **P8 좌표 정확도** ⭐ | `highlight_region`이 실제 클릭 영역에 위치한 비율 (수동 검증) | 80% 이상 |
| **P8 응답 지연 P95** ⭐ | Vision API 호출~응답 (캐시 hit 제외) | 5초 이하 |
| **P8 비용 효율** ⭐ | 입사자당 평균 Vision API 비용 | $3 이하 |
| **P8 가드레일 작동률** ⭐ | 시간당 200회 일시 정지 트리거 빈도 | 0.1% 이하 (1000명당 1건) |
| **콘텐츠 작성 부담** ⭐ | 신규 항목 자연어 intent 작성 시간 | 30분 이하 |

> ⭐ = v0.9 P8 도입에 따른 신규 KPI. Pilot 단계에서 측정.

---

## 16. 리스크 & 오픈 이슈

### 16.1 리스크

| 리스크 | 영향 | 완화 방안 |
|--------|------|----------|
| 입사자가 보안상 로컬 데몬 실행을 꺼림 | 도입 저항 | 오픈소스화 또는 코드 투명성 확보, 사내 보안팀 사전 검토 |
| Chrome Extension 설치 거부감 | UX 저하 | Playwright fallback 제공, 익스텐션 코드 공개 |
| GitLab 레포 콘텐츠가 최신화되지 않으면 가이드가 오래됨 | 잘못된 안내 | 콘텐츠 오너십 명확화, 분기별 검토 프로세스 |
| 권한 필요 작업이 너무 많아 자동화 효익이 낮음 | UX 저하 | "준비(P2) + 검증(P4)" 패턴으로 양 끝만 자동화하여 부담 최소화 |
| **Anthropic API 외부 전송에 대한 사내 정책 거부** ⭐ | P8 도입 자체가 무산될 위험 | Pilot 전 보안팀/법무팀 사전 승인 필수. 거부 시 v0.8(정적 가이드)로 폴백 가능 |
| **Vision API 비용이 예상보다 큼** ⭐ | 운영비 증가 | 가드레일 + 캐시로 1차 보호. 데이터 모이면 Haiku 폴백 하이브리드로 전환 (Phase 2) |
| **AI 응답 지연으로 사용자 답답함** ⭐ | UX 저하 | 로딩 인디케이터 명확 표시, 30초 캐시로 동일 화면 즉시 응답, 응답 시간 SLA 모니터링 |
| **AI 잘못된 안내로 사용자 헛수고** ⭐ | 신뢰도 하락 | confidence 'low' 시 사용자에게 명시. 결정론 검증(P4)이 가능한 항목은 P4 우선 적용 |
| **Screen Recording 권한 거부 사용자** ⭐ | P8 사용 불가 | P1~P5++ 결정론 자동화는 정상 작동. P5(정적 이미지) 폴백 가이드 제공 가능 |
| 자동화 관련 추가 리스크 | - | 13.5절 참조 |

> ⭐ = v0.9 신규 리스크.

### 16.2 오픈 이슈 (논의 필요)

1. 입사자 인증 방식: 사번? 이메일? SSO 토큰? → 사내 IdP 연동 가능 여부 확인 필요
2. 챗 LLM 선택 및 비용 모델: Claude API? 사내 모델? → Phase 2 결정
3. 어드민 대시보드 권한 모델: 인사팀 전체? 팀장 한정 본인 팀? → 인사팀과 협의
4. 입사자 머신에서 수집하는 정보의 범위와 동의 절차 → 정보보안팀 검토 필요
5. 온보딩 미완료자에 대한 에스컬레이션 정책 → 인사팀과 협의
6. Chrome Extension 사내 배포 방식: Chrome Web Store? 사내 정책 배포? → IT팀 협의
7. **(v0.9) 사내 화면 데이터 Anthropic 전송 정책** ⭐ → 보안팀/법무팀 사전 승인 필요. ZDR(Zero Data Retention) 옵션 활용 가능 여부 확인
8. **(v0.9) Anthropic API 키 발급 및 비용 청구 주체** ⭐ → IT팀과 청구/결제 흐름 협의
9. **(v0.9) Vision 좌표 정확도 측정 프로토콜** ⭐ → Pilot 단계에서 10개 표준 시나리오 정의 + 수동 검증 절차 설계
10. **(v0.9) AI 잘못된 안내로 사고 발생 시 책임 소재** ⭐ → 법무팀 검토. 사용자 동의 시 면책 조항 포함 여부

> ⭐ = v0.9 신규 오픈 이슈.

---

## 17. 마일스톤 (Tentative)

| 단계 | 기간 | 산출물 |
|------|------|--------|
| Discovery | 2주 | 인터뷰, 기존 온보딩 자료 분석, 콘텐츠 목록화 |
| Design | 2주 | UI 와이어프레임, 콘텐츠 스키마(자연어 intent 형식) 확정, AI 프롬프트 설계 |
| MVP 개발 | 12주 | CLI, 데몬, 웹 UI, 백엔드, P8 AI Vision Coach, Floating Hint Window, 시각 가이드 보조 |
| Pilot | 2주 | 1~2명 실제 입사자 대상 파일럿, 피드백, AI 정확도 측정 |
| GA | 2주 | 안정화, 프롬프트 튜닝, 전사 롤아웃 |

> **MVP 개발 12주 산출 근거**:
> - 기본 백엔드/프론트/CLI/데몬 6주
> - P8 AI Vision Coach 통합 3주 (Vision API + 프롬프트 엔지니어링 + 결과 파싱 + 좌표 오버레이)
> - Floating Hint Window 메인 UI 1주
> - 가드레일 + 동의 UX 1주
> - 통합 테스트 + 프롬프트 튜닝 1주
>
> v0.8 7.5주 → v0.9 12주로 4.5주 추가. AI Vision 시스템의 복잡도 반영.

---

## 18. 개발 작업 방식 (Development Workflow)

본 섹션은 PRD 내용을 실제 코드로 구현하기 위한 작업 방식을 정의한다. **Plan / Implementation / Review 3단계 모델**과 **Worktree 기반 병렬 Ralph 루프**를 채택한다.

### 18.1 3단계 작업 모델 개요

| 단계 | 실행 위치 | 주체 | 자동화 정도 | 산출물 |
|------|----------|------|-----------|-------|
| **Plan** | 메인 클론 | 사람 + Claude (페어) | 반자동 | `specs/*.md` |
| **Implementation** | Impl worktree (병렬) | Ralph 루프 | 자동 | 코드 + 테스트 |
| **Review** | Review worktree (단발) | Ralph (read-only) | 자동 | `reports/review-*.md` |
| **MR 생성** | Review worktree | Orchestrator | 자동 | GitLab MR |
| **사람 게이트** | GitLab 웹 | 담당 개발자 | 수동 | Approve / 코멘트 |
| **Integration** ⭐ | Integration worktree | Integration Ralph | 자동 (사람 검토 생략) | 통합 테스트 + `reports/integration-*.md` |

> ⭐ Wave 종료 시점에 자동 트리거. 다음 Wave 시작 차단 게이트 역할. 상세는 §18.14 참조.

### 18.2 전체 흐름

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 0: 인프라 1회 셋업 (사람, 1주)                       │
│  - GitLab 레포 생성, IdP 등록, 도메인 셋업, K8s 준비        │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: Plan (사람 + Claude, 메인 클론)                   │
│  - PRD 기반 specs/*.md 자동 생성                           │
│  - 사람이 spec 검토/조정                                    │
│  - 의존성 그래프 작성                                       │
│  - MR: plan/initial-specs → main 머지                       │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 2: Implementation + Review + Integration (Ralph)     │
│                                                             │
│  Wave별 실행:                                              │
│   ┌─ Impl Ralph (각 spec, 병렬) → MR                       │
│   ├─ Review Ralph → MR에 결과 첨부                         │
│   ├─ 사람 머지 (각 MR)                                     │
│   ├─ Integration Ralph (Wave 종료 후) ⭐                   │
│   │   - 통합 테스트 작성/실행                              │
│   │   - PASS → 자동 머지 + 다음 Wave 시작                 │
│   │   - FAIL → 사람 호출 + Wave 차단                      │
│   └─ 다음 Wave로 진행                                      │
│                                                             │
│  Wave 1: shared                                             │
│  Wave 2: daemon, backend (병렬)                            │
│  Wave 3: extension, frontend, cli (병렬)                   │
│  Wave 4: admin-frontend                                    │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 3: 인프라 작업 (사람, 4~6시간)                       │
│  - Chrome Web Store 게시 (또는 사내 정책 배포)              │
│  - install.sh 호스팅, K8s 배포                              │
└────────────────────────┬────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 4: 알파 테스트 → GA                                  │
└─────────────────────────────────────────────────────────────┘
```

### 18.3 Plan 단계

**위치**: 메인 클론 (`~/work/onboarding-agent`)
**자동화**: 반자동 (Claude Code 인터랙티브 + 사람 검토)

**산출물**: `specs/*.md` 파일 다수

**spec 파일 표준 형식**:

```markdown
# Spec: [작업명]

## 메타
- ID: spec-002-daemon
- Wave: 2
- 의존성: spec-001-shared
- 예상 작업 시간: 3시간
- 패키지 경로: packages/daemon/

## 목표
[한 문장으로 무엇을 만드는지]

## 입력 (시작 시점에 존재해야 하는 것)
- specs/001-shared.md 머지 완료
- packages/shared 패키지 사용 가능

## 출력 (완료 시점에 존재해야 하는 것)
- packages/daemon/src/server.ts (Express 서버)
- packages/daemon/src/routes/*.ts
- packages/daemon/src/db/schema.sql
- packages/daemon/tests/**/*.test.ts (커버리지 80%+)

## Acceptance Criteria
- [ ] AC-CHK-01: GET /api/checklist 응답이 zod 스키마와 일치
- [ ] AC-AUT-06: P4 verifier가 command 타입 검증 수행
- [ ] AC-AUT-08: sudo 명령을 직접 실행하지 않음
- [ ] npm test, npm run build, npm run lint 모두 통과

## 참고
- PRD 5.2 (기술 스택), 6.3 (자동화), 8.1 (SQLite 스키마), 9.1 (API)
- BOUNDARIES.md 준수

## 완료 신호
<promise>SPEC_002_IMPL_DONE</promise>
```

**Plan 진행 절차**:

1. 메인 클론에서 Claude Code 인터랙티브 시작
2. 다음 프롬프트 입력:
   ```
   PRD.md 전체를 읽고 specs/ 디렉토리에 작업 단위별 spec 파일을
   spec-template.md 형식으로 자동 생성해줘.
   각 spec은 4시간 이내 작업 단위, 의존성을 명시.
   완료 시 specs/INDEX.md에 의존성 그래프와 Wave 분류를 정리.
   ```
3. 사람이 생성된 specs/ 검토 후 수정
4. `git checkout -b plan/initial-specs && git push`
5. MR 생성 → 동료 리뷰 → main 머지

### 18.4 Implementation 단계

**위치**: Impl worktree (예: `~/work/wt-002-daemon`)
**자동화**: 자동 (Ralph 루프)

**Ralph 루프 구성**:
- stop hook이 Claude Code 종료를 차단하고 동일 프롬프트 재주입
- 종료 조건: 모든 AC 통과 + `<promise>SPEC_NNN_IMPL_DONE</promise>` 출력
- 최대 iteration: 50회 (안전장치)

**Impl Ralph 프롬프트 템플릿**:

```
당신은 코드를 작성하는 엔지니어입니다.

## 작업
specs/${SPEC_ID}.md를 읽고 구현하세요.

## 작업 흐름
1. spec의 Acceptance Criteria를 테스트로 먼저 작성
2. 테스트가 실패하는 것 확인
3. 구현 코드 작성 (PRD 5.2 기술 스택 준수)
4. npm test, npm run build, npm run lint 실행
5. 모두 통과할 때까지 수정

## 규칙
- spec에 명시된 패키지 경로 외에는 수정하지 않는다
- BOUNDARIES.md를 따른다
- 새 의존성은 사전 허용 목록에 있는 것만 사용
- TypeScript strict 모드 준수
- 커밋 메시지: "feat(${SPEC_ID}): <변경 요약>"

## 완료 조건
- 모든 테스트 통과
- 빌드 성공
- 린트 에러 0
- 테스트 커버리지 80% 이상

## 완료 신호
완료 시 다음 출력: <promise>${SPEC_ID}_IMPL_DONE</promise>

## 피드백 (재시도 시)
${REVIEW_FEEDBACK_FILE}이 존재하면 그 내용을 읽고 지적된 문제를 수정하세요.
```

**Worktree 관리**:
```bash
# 시작
git worktree add ../wt-002-daemon -b feature/spec-002-daemon origin/main

# Impl 종료 후 푸시
git -C ../wt-002-daemon push origin feature/spec-002-daemon

# Impl worktree는 Review가 끝날 때까지 유지
# (재시도 시 같은 worktree에서 Impl Ralph 재실행)
```

### 18.5 Review 단계

**위치**: 별도 Review worktree (예: `~/work/wt-002-daemon-review`)
**자동화**: 자동 (Ralph 단발 실행, 루프 아님)
**권한**: **Read-only** — `reports/*` 외 파일 쓰기 금지

**Review worktree 분리 이유**:
- Impl worktree는 Ralph가 자유롭게 만든 빌드 산출물, 임시 파일 등 노이즈 존재
- Review는 깨끗한 main + Impl 브랜치만 체크아웃하여 객관적으로 검증
- `feature/spec-002-daemon` 브랜치를 그대로 사용 (별도 브랜치 안 만듦)

```bash
git worktree add ../wt-002-daemon-review feature/spec-002-daemon
```

**Review Ralph 프롬프트 템플릿**:

```
당신은 코드 리뷰어입니다. 절대 코드를 수정하지 마세요.
reports/ 디렉토리 외 파일을 쓰는 시도는 금지됩니다.

## 검증 대상
- Spec: specs/${SPEC_ID}.md
- 브랜치: feature/${SPEC_ID}
- Diff: main과의 차이

## 검증 항목 (8가지)

### 1. AC 정합성 (PRD §11)
- spec과 연관된 AC가 모두 충족되었는가?
- 각 AC를 코드 또는 테스트의 어느 부분에서 충족했는지 식별

### 2. PRD 정합성
- 코드가 PRD 의도와 일치하는가?
- spec 외 PRD 영역까지 침범하지 않았는가?

### 3. 데이터 모델 정합성 (PRD §8)
- 사용된 타입/스키마가 PRD §8.3과 일치하는가?
- 임의 타입 추가 시 정당화 근거가 있는가?

### 4. API 계약 정합성 (PRD §9)
- 엔드포인트 경로/메서드/요청-응답 형식이 PRD §9와 일치하는가?
- Breaking change가 있는가?

### 5. 보안 점검
- 시크릿 하드코딩 여부
- SQL 인젝션 가능성 (prepared statement 사용?)
- XSS/CSRF 처리
- OAuth 토큰 보관 위치 (PRD §10.2 준수?)

### 6. 코드 품질
- 함수당 50줄 미만
- 순환 복잡도 ≤ 10
- 테스트 커버리지 ≥ 80%

### 7. BOUNDARIES.md 준수
- 허용된 파일/패키지 외 수정 없음

### 8. 의존성 체크
- package.json 신규 의존성이 허용 목록에 있는가?
- 라이선스 호환성

## 출력
reports/review-${SPEC_ID}.md에 검증 결과 작성.
각 항목에 대해 PASS / FAIL / WARN 판정.

## 완료 신호
- 모든 항목 PASS: <promise>${SPEC_ID}_REVIEW_PASS</promise>
- WARN만 있음: <promise>${SPEC_ID}_REVIEW_PASS_WITH_WARN</promise>
- 하나라도 FAIL: <promise>${SPEC_ID}_REVIEW_FAIL</promise>
```

**Review 리포트 표준 형식**: 본 PRD §18.7 참조

### 18.6 재시도 정책

Review가 FAIL 판정한 경우:

```
[Impl 1차] → DONE
   ↓
[Review 1차] → FAIL
   ↓
[피드백 주입] reports/review-${SPEC_ID}.md를 ${IMPL_WT}/.ralph-feedback.md로 복사
   ↓
[Impl 2차] → DONE (피드백 반영)
   ↓
[Review 2차] → ?

PASS:        → MR 생성 → 종료
FAIL:        → 3차 재시도 (최대 N=3)
3차도 FAIL: → 사람 호출 (GitLab Issue 자동 생성)
```

**N=3 후 사람 호출**:

```bash
gitlab issue create \
  --title "[Ralph] Spec ${SPEC_ID} 자동 처리 실패 - 사람 개입 필요" \
  --label "ralph-failed,needs-human" \
  --description "
## 상황
Spec ${SPEC_ID}에 대해 Impl/Review를 3회 시도했으나 통과하지 못함.

## 첨부
- 마지막 Impl 브랜치: feature/${SPEC_ID}
- Review 리포트들:
  - reports/review-${SPEC_ID}-attempt-1.md
  - reports/review-${SPEC_ID}-attempt-2.md
  - reports/review-${SPEC_ID}-attempt-3.md

## 권장 조치
1. spec 자체에 모호함이 있는지 검토 (specs/${SPEC_ID}.md)
2. AC가 너무 엄격하거나 측정 불가능한지 점검
3. 사람이 직접 구현하거나 spec을 더 작은 단위로 분할
"
```

### 18.7 Review 리포트 표준 형식

```markdown
# Review Report: ${SPEC_ID} (시도 ${ATTEMPT}회차)

**Spec**: specs/${SPEC_ID}.md
**Branch**: feature/${SPEC_ID}
**Commit**: ${COMMIT_SHA}
**Reviewer**: Claude (Ralph Review v1)
**Date**: ${ISO_DATE}

## 결과: ✅ PASS / ⚠️ PASS_WITH_WARN / ❌ FAIL

## 1. AC 정합성

| AC | 상태 | 검증 위치 | 비고 |
|----|------|----------|------|
| AC-CHK-01 | ✅ | tests/checklist.test.ts:42 | 통과 |
| AC-AUT-06 | ✅ | tests/verifier.test.ts:88 | 통과 |
| AC-AUT-08 | ❌ | (검증 위치 없음) | sudo 직접 실행 방지 코드 누락 |

## 2. PRD 정합성
[코드와 PRD 의도 비교 결과]

## 3. 데이터 모델 정합성
[타입/스키마 비교 결과]

## 4. API 계약 정합성
[엔드포인트 비교 결과]

## 5. 보안 점검
- ✅ 시크릿 하드코딩 없음
- ⚠️ WARN: tokens.json 파일 권한 0644 (0600 권장)

## 6. 코드 품질
- ✅ 함수 길이 모두 50줄 미만
- ✅ 테스트 커버리지 87%

## 7. BOUNDARIES.md 준수
- ✅ packages/daemon/ 외 수정 없음

## 8. 의존성 체크
- 신규: better-sqlite3 (허용 목록 ✅)

## 종합 판정
[FAIL인 경우 다음 Impl 시 수정해야 할 항목 명확히]

## 사람 리뷰 시 참고 포인트 (PASS 시만)
1. tokens.json 파일 권한 (보안 WARN) → fix 필요
2. config-loader.ts의 에러 메시지 영어 → i18n 정책 확인
3. SQLite 마이그레이션 전략 → 스키마 v2 대비 검토
```

### 18.8 MR 자동 생성 규칙

**생성 시점**: Review가 PASS 또는 PASS_WITH_WARN인 경우에만

**MR 본문 템플릿**:

```markdown
## 📋 Spec
- **ID**: ${SPEC_ID}
- **파일**: [specs/${SPEC_ID}.md](../-/blob/main/specs/${SPEC_ID}.md)
- **목표**: ${SPEC_GOAL}

## 🤖 Ralph 실행 정보
- Impl 시도 횟수: ${IMPL_ATTEMPTS}회
- Review 시도 횟수: ${REVIEW_ATTEMPTS}회
- 최종 판정: ${REVIEW_RESULT}
- 총 소요 시간: ${TOTAL_DURATION}
- 모델: claude-opus-4-7

## ✅ Acceptance Criteria 결과
${AC_TABLE}

## 🧪 테스트 결과
\`\`\`
${TEST_OUTPUT}
\`\`\`

## 📁 변경된 파일
${CHANGED_FILES}

## 🔍 Review Report
${REVIEW_REPORT_SUMMARY}

상세 리포트: [reports/review-${SPEC_ID}.md](../-/blob/feature/${SPEC_ID}/reports/review-${SPEC_ID}.md)

## ⚠️ 사람 리뷰 시 참고 포인트
${REVIEW_WARN_ITEMS}

## 라벨
- ralph-generated
- ralph-verified
- review-passed${WARN_SUFFIX}

## 리뷰어 (자동 할당)
@${REVIEWER}
```

**라벨 체계**:
| 라벨 | 의미 |
|------|------|
| `ralph-generated` | Ralph가 생성한 MR |
| `ralph-verified` | Review Ralph 통과 |
| `ralph-failed` | 3회 시도 후 실패 (Issue로 표시, MR 아님) |
| `review-passed` | Review PASS |
| `review-warn` | Review PASS_WITH_WARN |
| `needs-human` | 사람 개입 필요 |

### 18.9 Worktree 관리 규칙

**디렉토리 명명 규칙**:
- Impl: `~/work/wt-${SPEC_ID}` (예: `wt-002-daemon`)
- Review: `~/work/wt-${SPEC_ID}-review` (예: `wt-002-daemon-review`)

**브랜치 명명 규칙**:
- Impl: `feature/${SPEC_ID}` (Review도 같은 브랜치 사용)
- Plan: `plan/initial-specs`, `plan/wave-2-specs` 등

**정리 정책**:
- MR 머지 후 Impl/Review worktree 모두 자동 삭제
- 재시도 횟수 초과로 실패 시 worktree 보존 (디버깅용)
- 1주일 이상 미사용 worktree는 cron으로 자동 정리

```bash
# Orchestrator 종료 시 정리
git worktree remove ../wt-002-daemon
git worktree remove ../wt-002-daemon-review
git branch -d feature/spec-002-daemon  # 머지된 브랜치만
```

### 18.10 의존성 그래프와 Wave 실행

**Wave 정의**:
| Wave | 패키지 | 병렬 가능 | 의존 |
|------|--------|----------|------|
| 1 | shared | - | 없음 |
| 2 | daemon, backend | ✅ 동시 | shared |
| 3 | extension, frontend, cli | ✅ 동시 | daemon |
| 4 | admin-frontend, floating-hint, vision-coach | ✅ 동시 | backend, daemon |
| 5 | author-tools (간소화: P7만) | - | cli, daemon |

> Wave 4의 `floating-hint`는 P5++ 보조 가이드 윈도우 패키지 (Electron 기반).
> Wave 4의 `vision-coach`는 P8 AI Vision Coach 모듈 (daemon 내부 또는 별도 패키지). v0.9 핵심.
> Wave 5의 `author-tools`는 v0.9에서 간소화. P7 AI Draft만 포함 (P6/P7+ 폐기).

**Wave 트리거 정책**:
- Wave N의 모든 MR이 main에 머지된 후에 Wave N+1 시작
- 같은 Wave 내 spec들은 동시에 worktree 생성하여 병렬 실행
- 머신 부담을 위해 동시 실행 최대 4개로 제한

### 18.11 Orchestrator 스크립트

**위치**: `scripts/ralph-orchestrator.sh`

**주요 기능**:
1. specs/INDEX.md에서 Wave별 spec 목록 읽기
2. 각 spec에 대해 Impl → Review → 재시도 → MR 생성 흐름 실행
3. 동시 실행 제한 (4개)
4. 실패 처리 및 사람 호출

스크립트 본체는 별도 파일로 관리하며, MVP 진입 전 Phase 1 마지막 단계에서 작성한다.

### 18.12 인적 작업 (Ralph 불가능 영역)

다음은 Ralph 자동 개발로 처리할 수 없으며, 사람이 직접 수행해야 한다.

#### 18.12.1 1회성 인프라 셋업 (Phase 0)
- [ ] Chrome Web Store 개발자 계정 등록 (IT팀)
- [ ] Google Workspace 자동 배포 정책 설정 (IT팀, MVP 이후)
- [ ] 사내 IdP OAuth 클라이언트 등록 (보안팀)
- [ ] Google Cloud Console에서 Gmail API OAuth 클라이언트 등록 (개발자)
- [ ] install.sh 호스팅 도메인 셋업 (DevOps)
- [ ] Kubernetes 클러스터 백엔드 배포 환경 준비 (DevOps)
- [ ] GitLab 콘텐츠 레포 webhook 등록 (콘텐츠 오너)

#### 18.12.2 매 릴리즈 작업
- [ ] 새 Extension 버전 Chrome Web Store에 게시 (또는 사내 정책 업데이트)
- [ ] CLI 바이너리 코드 서명 (macOS notarization)
- [ ] install.sh 업데이트 및 호스팅
- [ ] 백엔드 K8s 배포 (Helm chart upgrade)

#### 18.12.3 매 입사자 작업 (사용자 본인)
- [ ] Chrome Extension 자동 설치 후 활성화 토글 (1클릭, MVP 이후 자동화)
- [ ] 사내 SSO 로그인 1회
- [ ] Google OAuth 동의 화면 승인 1회
- [ ] sudo 비밀번호 입력 (보안 에이전트 설치 시)
- [ ] 최종 저장 버튼 클릭 (Gmail 서명 등 권한 작업)

### 18.13 BOUNDARIES.md 의무

레포 루트에 `BOUNDARIES.md`를 두어 Ralph가 절대 건드리면 안 되는 영역을 명시한다. Ralph는 매 iteration 시작 시 이 파일을 읽고 준수해야 한다.

**BOUNDARIES.md 표준 항목**:
- Ralph가 수정 금지인 파일/디렉토리 (예: `docs/PRD.md`, `BOUNDARIES.md` 자체)
- spec 외 패키지 경로 수정 금지
- 신규 외부 의존성 사전 허용 목록
- Breaking API 변경 금지 (PRD §9 위반 금지)
- 시크릿 키, 토큰 하드코딩 금지

### 18.14 통합 검증 (Integration Verification)

각 spec은 독립적으로 통과해도 **여러 패키지를 합쳤을 때만 드러나는 문제**가 존재한다. 인터페이스 불일치, 타이밍 이슈, 상태 표기 차이, 회귀 등이 그것이다. 이를 잡기 위해 **Wave 종료 시점에 Integration Ralph를 자동 실행**한다.

#### 18.14.1 실행 시점

각 Wave의 모든 spec MR이 main에 머지된 직후 자동 트리거. **PASS 전까지 다음 Wave 시작 차단**.

```
Wave 1 spec MR 모두 머지
   ↓
[Integration Ralph - Wave 1] 자동 실행
   ↓
PASS → 통합 테스트 코드 자동 머지 → Wave 2 시작
FAIL → 사람 호출 + Wave 2 차단
```

#### 18.14.2 Integration Ralph의 권한 범위

Review Ralph가 read-only인 것과 달리, Integration Ralph는 **테스트 코드 작성**이 주 업무이므로 제한된 쓰기 권한을 가진다.

| 동작 | 허용 여부 |
|------|----------|
| `tests/integration/wave-N/**` 작성/수정 | ✅ |
| `packages/test-fixtures/**` 작성/수정 | ✅ |
| `reports/integration-wave-N.md` 작성 | ✅ |
| `packages/*/src/**` 수정 | ❌ 절대 금지 (구현 코드 불변) |
| `specs/**` 수정 | ❌ 절대 금지 |
| `docs/PRD.md` 수정 | ❌ 절대 금지 |

위반 시 자동 rollback. BOUNDARIES.md에 명시.

#### 18.14.3 Worktree 분리

Integration Ralph도 별도 worktree에서 실행한다. 깨끗한 main 체크아웃 상태에서 객관적 검증.

```bash
git worktree add ../wt-integration-wave-N main
cd ../wt-integration-wave-N

# 모든 패키지 설치 및 빌드
pnpm install
pnpm -r build

# Integration Ralph 실행
```

#### 18.14.4 Wave별 통합 시나리오 정의

`specs/integration/wave-N-integration.md` 파일에 정의. 일반 spec과 형식 유사하나, AC가 **여러 패키지를 동시에 사용**하는 시나리오로 구성.

```
specs/
├── 001-shared.md              # 일반 spec
├── 002-daemon.md
├── ...
└── integration/
    ├── wave-1-integration.md  # Wave 1 통합 시나리오
    ├── wave-2-integration.md
    ├── wave-3-integration.md
    └── wave-4-integration.md
```

#### 18.14.5 Wave별 표준 시나리오

| Wave | 검증 초점 | 핵심 시나리오 |
|------|----------|--------------|
| **Wave 1** (shared) | 빌드 가능성 + 타입 export | shared/dist 생성, zod 스키마 ↔ TS 타입 정합 |
| **Wave 2** (daemon, backend) | API 계약 정합성 + 서비스 간 통신 | daemon → backend sync, PRD §9 엔드포인트 형식 준수 |
| **Wave 3** (extension, frontend, cli) | 사용자 시나리오 E2E (Mock 환경) | CLI 시작 → daemon 기동 → frontend → extension → 결과 반영 |
| **Wave 4** (admin-frontend) | Admin 기능 E2E | backend 데이터 → admin UI 차트 렌더링 |

각 Wave의 통합 테스트는 **누적**된다. Wave 3 통합 테스트 실행 시 Wave 1, 2 테스트도 함께 실행되어 회귀 방지.

#### 18.14.6 Wave 3의 핵심 시나리오 (PRD AC-INT-01 연동)

PRD §11.5에서 정의한 Gmail 서명 등록 E2E를 Wave 3 통합 테스트의 핵심 케이스로 구현.

```
1. Mock Gmail 서버 기동 (packages/test-fixtures/mock-gmail)
2. CLI로 daemon 기동 → frontend 자동 오픈
3. frontend에 직무/전화번호 입력 → "자동화 시작" 클릭
4. daemon이 자동화 요청 큐잉
5. Headless Chrome + Mock Extension이 폴링 → step 시퀀스 실행
6. Mock Gmail에 서명 HTML 저장 확인
7. daemon의 verifier가 Mock Gmail API 폴링 → 검증 통과
8. frontend 화면에 ✅ 표시 확인
```

#### 18.14.7 Mock 서비스 관리 (`packages/test-fixtures`)

외부 서비스 의존을 제거하기 위해 별도 패키지로 Mock을 관리.

```
packages/test-fixtures/
├── src/
│   ├── mock-gmail/           # Gmail Settings API 모의
│   │   ├── server.ts
│   │   └── fixtures.ts
│   ├── mock-gitlab/          # GitLab API 모의
│   │   ├── server.ts
│   │   └── fixtures.ts
│   ├── mock-extension/       # Chrome Extension behavior 모의
│   │   └── runner.ts         # Playwright로 extension 동작 시뮬레이션
│   ├── mock-postgres/        # testcontainers 래퍼
│   │   └── setup.ts
│   └── mock-idp/             # SSO IdP 모의
│       └── server.ts
├── tests/
└── package.json
```

Mock 서비스는 **간단한 건 자체 구현, 복잡한 건 외부 도구 활용** 원칙.

| Mock | 구현 방식 |
|------|----------|
| Mock Gmail API | 자체 (Express 기반 200줄 미만) |
| Mock GitLab API | 자체 (Express + 사전 정의 fixtures) |
| Mock IdP | 자체 (OIDC discovery + token 발급만) |
| Mock Postgres | testcontainers (외부 도구) |
| Headless Chrome | Playwright (외부 도구) |
| Mock Extension | Playwright + 자체 runner (Extension behavior 시뮬레이션) |

#### 18.14.8 Integration Ralph 프롬프트 템플릿

```
당신은 통합 검증 엔지니어입니다.

## 작업
specs/integration/wave-${WAVE}-integration.md를 읽고
Wave ${WAVE}의 통합 테스트를 작성/실행하세요.

## 권한
- 작성 가능: tests/integration/wave-${WAVE}/**, packages/test-fixtures/**, reports/integration-wave-${WAVE}.md
- 수정 금지: packages/*/src/**, specs/**, docs/**

## 작업 흐름
1. 깨끗한 main 브랜치에서 pnpm install && pnpm -r build 성공 확인
2. spec의 AC를 통합 테스트 코드로 작성 (Vitest + Playwright)
3. Mock 서비스 필요 시 packages/test-fixtures에 추가
4. 모든 통합 테스트 실행
5. 누적 테스트 (Wave 1~N-1) 함께 실행하여 회귀 검증
6. 결과를 reports/integration-wave-${WAVE}.md에 기록

## 완료 조건
- spec의 모든 AC 통과
- 누적 통합 테스트 통과 (회귀 없음)

## 완료 신호
PASS: <promise>WAVE_${WAVE}_INTEGRATION_PASS</promise>
FAIL: <promise>WAVE_${WAVE}_INTEGRATION_FAIL</promise>
```

#### 18.14.9 자동 머지 정책 (사람 검토 생략)

Integration Ralph가 PASS인 경우 통합 테스트 코드는 **사람 검토 없이 자동으로 main에 머지**한다.

이유:
- 통합 테스트 코드는 production 동작에 영향을 주지 않음 (`tests/`, `packages/test-fixtures/`만 변경)
- BOUNDARIES.md로 권한 범위가 엄격히 제한됨 (구현 코드 수정 불가)
- Wave 진행 속도를 위해 추가 게이트 불필요

```bash
# Integration Ralph 종료 시 자동 실행
git checkout -b integration/wave-${WAVE}
git add tests/ packages/test-fixtures/ reports/
git commit -m "test(wave-${WAVE}): integration tests"
git push origin integration/wave-${WAVE}

# Fast-forward 머지 (CI 통과 조건만 확인)
gitlab mr create \
  --source-branch integration/wave-${WAVE} \
  --target-branch main \
  --merge-when-pipeline-succeeds \
  --remove-source-branch \
  --label "integration-auto-merge"
```

#### 18.14.10 실패 처리

Integration Ralph가 FAIL일 경우:

1. `reports/integration-wave-${WAVE}.md`에 실패 원인 분석 결과 작성
2. 어느 spec의 어느 부분이 문제인지 식별 시도
3. GitLab Issue 자동 생성 (라벨: `integration-failed`, `needs-human`)
4. 다음 Wave 시작 차단 (Orchestrator가 lock 파일 체크)
5. 사람이 핫픽스 PR 또는 spec 재작업으로 해결
6. 해결 후 사람이 수동으로 Integration Ralph 재실행 트리거

```
[Integration Ralph FAIL]
   ↓
GitLab Issue 자동 생성:
"[Integration] Wave 3 통합 검증 실패 - 사람 개입 필요"
   ├─ 라벨: integration-failed, needs-human
   ├─ 본문: reports/integration-wave-3.md 요약
   ├─ 영향받는 spec 추정 목록
   └─ 권장 조치
```

#### 18.14.11 인프라 의존 (testcontainers)

PostgreSQL, Redis 등 실제 인프라가 필요한 통합 테스트는 testcontainers로 격리된 컨테이너에서 실행한다.

- 개발자 머신: Docker 필요
- CI: GitLab CI runner에 Docker-in-Docker 필요

이 의존성은 PRD §10에 추가 명시.

---

## 19. 라이브러리 카탈로그 (Library Catalog)

본 섹션은 구현 시 사용할 라이브러리/플러그인을 영역별로 정리한다. **본 카탈로그에 명시되지 않은 라이브러리를 신규 도입하려면 PRD 개정이 필요**하며, Ralph는 임의로 추가할 수 없다 (BOUNDARIES.md 위반).

각 항목은 다음 형식으로 정의:
- **선정 이유**: 왜 이걸 선택했는지 (Ralph가 임의 변경 방지)
- **버전**: 메이저 버전 고정 (Caret 방식)
- **사용 위치**: 어느 패키지에서 쓰는지

### 19.1 P1 State Probe (머신 상태 점검)

| 라이브러리 | 버전 | 사용 위치 | 선정 이유 |
|-----------|------|----------|----------|
| **execa** | ^9.0.0 | `daemon`, `cli` | shell 명령 실행 표준. cross-platform, 에러 핸들링, stream 처리 우수. `node:child_process` 직접 사용보다 안전 |
| **fast-glob** | ^3.3.0 | `daemon` | 파일 패턴 매칭 (`~/.ssh/id_*.pub` 등). `node:fs/promises`만으로는 글롭 패턴 처리 어려움 |

**대안 평가**:
- `node:child_process`: native지만 에러 핸들링 코드량 폭증. 채택 안 함
- `shelljs`: deprecated 경향, 채택 안 함

### 19.2 P2 Clipboard Inject (클립보드 주입)

| 라이브러리 | 버전 | 사용 위치 | 선정 이유 |
|-----------|------|----------|----------|
| **@napi-rs/clipboard** | ^0.0.4 | `daemon` | Node native 바인딩, 현재 maintained. macOS/Windows/Linux 호환 |

**대안 평가**:
- `clipboardy`: 가장 유명하지만 ESM-only + 일부 환경 이슈. 채택 안 함
- `pbcopy` 직접 호출: macOS만 지원, MVP 범위에는 적합하나 cross-platform 확장 시 재작업 필요. 채택 안 함

### 19.3 P3 Guided Browser (Chrome Extension)

| 라이브러리 | 버전 | 사용 위치 | 선정 이유 |
|-----------|------|----------|----------|
| **@crxjs/vite-plugin** | ^2.0.0 | `extension` | Chrome Extension Manifest V3 표준 빌더. Vite 기반 HMR 지원 → 개발 생산성 |
| **vite** | ^5.4.0 | `extension`, `frontend`, `admin-frontend` | crxjs와 호환, 사내 표준 |
| **@types/chrome** | ^0.0.270 | `extension` | Chrome API TypeScript 타입 |

**대안 평가**:
- `esbuild` 직접 + 자체 manifest 카피: 단순하지만 Manifest V3 처리, content script와 background 분리 빌드를 직접 구현해야 함. 채택 안 함
- `webextension-polyfill`: Firefox 호환용. MVP는 Chrome만이라 불필요

### 19.4 P3 Guided Browser (Playwright Fallback)

| 라이브러리 | 버전 | 사용 위치 | 선정 이유 |
|-----------|------|----------|----------|
| **playwright** | ^1.45.0 | `daemon` (fallback), `test-fixtures` | Extension 미설치 시 headed 브라우저로 자동화. 통합 테스트 E2E도 동일 도구 |

### 19.5 P4 Auto Verify (HTTP 검증)

| 라이브러리 | 버전 | 사용 위치 | 선정 이유 |
|-----------|------|----------|----------|
| **undici** | ^6.0.0 | `daemon`, `backend` | Node 내장 fetch보다 빠르고 retry 옵션 풍부 |
| **jsonpath-plus** | ^10.0.0 | `daemon` | PRD §11 AC의 `jsonpath` 검증용. `$.sendAs[0].signature` 같은 표현 지원 |
| **zod** | ^3.23.0 | `daemon`, `backend`, `shared` | 응답 스키마 런타임 검증. PRD §8.3 공통 타입과 1:1 대응 |

### 19.6 OAuth 및 시크릿 보관

| 라이브러리 | 버전 | 사용 위치 | 선정 이유 |
|-----------|------|----------|----------|
| **googleapis** | ^144.0.0 | `daemon` | Google OAuth 2.0 Loopback flow + Gmail Settings API 통합 SDK |
| **@badgateway/oauth2-client** | ^2.4.0 | `daemon`, `backend` | 사내 IdP (OIDC) 표준 OAuth 클라이언트 |
| **openid-client** | ^5.6.0 | `backend` | NestJS Passport 통합용 OIDC 라이브러리 |
| **@napi-rs/keyring** | ^1.1.0 | `daemon` | macOS Keychain 접근 (OAuth 토큰 안전 보관) |

**대안 평가**:
- `keytar`: deprecated. 채택 안 함
- 파일 시스템 평문 저장: 보안 위험. 채택 안 함

### 19.7 CLI 패키징

| 도구 | 버전 | 사용 위치 | 선정 이유 |
|-----------|------|----------|----------|
| **Node SEA (Single Executable Applications)** | Node 22 LTS | `cli` | Node 21+ 공식 기능. 외부 도구 의존 없이 단일 바이너리 생성 |
| **postject** | ^1.0.0 | `cli` (빌드 시) | SEA 바이너리에 blob 주입용 (Node 공식 권장) |

**대안 평가**:
- `pkg`: Vercel이 2024년 deprecated. 채택 안 함
- `@yao-pkg/pkg`: pkg 포크지만 장기 유지 불확실. 채택 안 함
- `Bun compile`: Bun 런타임 의존성 추가. Node 통일 원칙 위배. 채택 안 함

> **주의**: Node SEA는 Node 22 LTS 이상 필요. PRD §5.2 Node.js 20 → **Node.js 22 LTS로 상향**.

### 19.8 macOS LaunchAgent 통합

| 라이브러리 | 버전 | 사용 위치 | 선정 이유 |
|-----------|------|----------|----------|
| **plist** | ^3.1.0 | `cli` (installer) | LaunchAgent용 plist 파일 생성 (`~/Library/LaunchAgents/com.wrtn.onboarding.plist`) |

**자체 구현 영역**:
- LaunchAgent 등록: `launchctl load ~/Library/LaunchAgents/...` shell 명령으로 직접 처리 (execa 활용)
- 자동 시작: plist에 `RunAtLoad: true` 명시

**대안 평가**:
- `auto-launch`: cross-platform이지만 macOS 처리가 깔끔하지 않음. 채택 안 함
- `PM2`: 무거움, 추가 런타임 필요. 채택 안 함

### 19.9 로깅

| 라이브러리 | 버전 | 사용 위치 | 선정 이유 |
|-----------|------|----------|----------|
| **pino** | ^9.0.0 | `daemon`, `backend` | 가장 빠른 Node 로거. JSON 구조화 로깅 표준 |
| **pino-pretty** | ^11.0.0 | `daemon`, `backend` (개발) | 개발 환경에서 사람이 읽기 좋은 출력 |

**로그 위치**:
- `daemon`: `~/Library/Logs/Onboarding/daemon.log`
- `cli`: stdout (사용자에게 직접 표시)
- `backend`: stdout → K8s 로그 수집기

**대안 평가**:
- `winston`: 기능 많지만 무거움. 데몬에 부담. 채택 안 함
- `debug`: 가벼우나 production 로깅에 부족. 채택 안 함

### 19.10 CLI UX

| 라이브러리 | 버전 | 사용 위치 | 선정 이유 |
|-----------|------|----------|----------|
| **commander** | ^12.0.0 | `cli` | CLI 프레임워크 표준. 서브커맨드 (`onboarding stop|status|update`) 처리 |
| **@inquirer/prompts** | ^5.0.0 | `cli` | 인터랙티브 프롬프트 (선택지, 입력) |
| **ora** | ^8.0.0 | `cli` | 스피너 (다운로드 진행 등) |
| **picocolors** | ^1.0.0 | `cli` | 색상 출력. chalk보다 14배 가벼움 |
| **boxen** | ^7.1.0 | `cli` | "Ready-to-Work 달성!" 같은 박스 메시지 |

**대안 평가**:
- `chalk`: 무거움 (color util만 14kb). picocolors가 동일 기능 1kb로 제공. 채택 안 함
- `inquirer` (구버전): @inquirer/prompts가 모던 후속작

### 19.11 백엔드 (NestJS 생태계)

| 라이브러리 | 버전 | 사용 위치 | 선정 이유 |
|-----------|------|----------|----------|
| **@nestjs/core** | ^10.0.0 | `backend` | 사내 백엔드 표준 |
| **@nestjs/passport** + **passport-openidconnect** | ^10.0.0 | `backend` | 사내 IdP SSO 통합 |
| **@prisma/client** | ^5.18.0 | `backend` | PostgreSQL ORM. `schema.prisma`로 PRD §8.2 데이터 모델 표현 |
| **@nestjs/swagger** | ^7.4.0 | `backend` | API 문서 자동 생성 (PRD §9 검증용) |
| **@gitbeaker/rest** | ^40.0.0 | `backend` | GitLab webhook + content sync |

### 19.12 Admin Frontend

| 라이브러리 | 버전 | 사용 위치 | 선정 이유 |
|-----------|------|----------|----------|
| **react** | ^18.3.0 | `admin-frontend` | 사내 표준 |
| **vite** | ^5.4.0 | `admin-frontend` | 사내 표준 |
| **@tanstack/react-query** | ^5.50.0 | `admin-frontend` | 백엔드 API 캐싱/동기화 |
| **shadcn/ui** | (설치형) | `admin-frontend` | UI 컴포넌트 |
| **tailwindcss** | ^3.4.0 | `admin-frontend` | shadcn 의존 |
| **recharts** | ^2.12.0 | `admin-frontend` | 진행률 차트 |
| **react-router-dom** | ^6.26.0 | `admin-frontend` | 라우팅 |

### 19.13 통합 테스트 도구

| 라이브러리 | 버전 | 사용 위치 | 선정 이유 |
|-----------|------|----------|----------|
| **vitest** | ^2.0.0 | 모든 패키지 | 단위/통합 테스트 표준 |
| **supertest** | ^7.0.0 | `daemon`, `backend`, `tests/integration` | HTTP API 테스트 |
| **testcontainers** | ^10.0.0 | `tests/integration`, `test-fixtures` | PostgreSQL 격리 컨테이너 |
| **msw (Mock Service Worker)** | ^2.4.0 | `test-fixtures` | Mock Gmail/GitLab/IdP 의 백본. HTTP request 인터셉트 |
| **@playwright/test** | ^1.45.0 | `tests/integration` | E2E 테스트 (Wave 3 사용자 시나리오) |
| **@testing-library/react** | ^16.0.0 | `admin-frontend` | React 컴포넌트 테스트 |

**msw 채택 이유**:
- Mock Gmail/GitLab을 직접 Express로 구현하는 것보다 선언적
- HTTP request 인터셉트 방식이라 테스트와 production 코드 분리 깔끔
- PRD §18.14.7의 Mock 서비스 패키지 표준화에 가장 적합

### 19.14 Ralph 자동화 도구

| 라이브러리/도구 | 버전 | 사용 위치 | 선정 이유 |
|-----------|------|----------|----------|
| **zx** | ^8.0.0 | `scripts/` | Bash 대신 TypeScript로 셸 스크립트. Google 표준 |
| **@gitbeaker/rest** | ^40.0.0 | `scripts/` | GitLab MR 자동 생성, Issue 자동 생성 |
| **simple-git** | ^3.25.0 | `scripts/` | git worktree 관리 (`add`, `remove`, `list`) |

**Orchestrator 스크립트 작성 방향**:
- `scripts/ralph-orchestrator.ts` (Bash 대신 TypeScript)
- zx가 셸 명령을 우아하게 처리
- simple-git으로 worktree 라이프사이클 관리
- @gitbeaker/rest로 GitLab API 호출

### 19.15 빌드 및 모노레포 도구

| 도구 | 버전 | 사용 위치 | 선정 이유 |
|-----------|------|----------|----------|
| **pnpm** | ^9.0.0 | 워크스페이스 루트 | 모노레포 관리 표준, npm 대비 빠름 |
| **typescript** | ^5.5.0 | 모든 패키지 | 사내 표준 |
| **tsx** | ^4.0.0 | `daemon`, `cli` (개발) | TypeScript 직접 실행. 개발 시 빠른 iteration |
| **esbuild** | ^0.23.0 | (vite 내부 사용) | 빠른 빌드 |

### 19.16 코드 품질

| 도구 | 버전 | 사용 위치 | 선정 이유 |
|-----------|------|----------|----------|
| **eslint** | ^9.0.0 | 모든 패키지 | 사내 표준 |
| **typescript-eslint** | ^8.0.0 | 모든 패키지 | TS 린트 |
| **prettier** | ^3.3.0 | 모든 패키지 | 포매터 |
| **husky** + **lint-staged** | ^9.0.0 / ^15.0.0 | 워크스페이스 루트 | Pre-commit 훅 |

### 19.17 PRD §5.2 변경 사항 요약

본 19절 추가에 따른 §5.2 변경:
- **Node.js 20 LTS → Node.js 22 LTS** (Node SEA 요구사항)
- **PM2 (선택) → 자체 LaunchAgent + plist** (의존성 최소화)
- **pkg 또는 Bun compile → Node SEA + postject** (deprecated 도구 회피)

### 19.18 라이브러리 추가/변경 정책

본 카탈로그는 **단일 진실 소스 (Single Source of Truth)**.

- Ralph는 본 카탈로그에 없는 라이브러리를 추가할 수 없음 (BOUNDARIES.md 위반)
- Wave별로 새로운 라이브러리가 필요해지면 spec에 명시하고 PRD §19를 먼저 개정한 뒤 Ralph 진행
- 메이저 버전 업데이트는 사람 결정 (보안 패치는 dependabot 자동)

### 19.19 의존성 검증 자동화

CI에서 다음을 자동 체크:

```bash
# package.json의 모든 의존성이 PRD §19 카탈로그에 있는지 검증
node scripts/verify-dependencies.ts

# 결과:
# ✅ All 32 dependencies are listed in PRD §19
# ❌ Found 1 unlisted dependency: lodash
#    → Add to PRD §19 or remove from package.json
```

이 검증은 Review Ralph의 §18.5 검증 항목 8(의존성 체크)과 동일한 로직.

### 19.20 P5 Visual Guide (시각 가이드 표시)

| 라이브러리 | 버전 | 사용 위치 | 선정 이유 |
|-----------|------|----------|----------|
| **react-image-gallery** 또는 자체 구현 | (자체 권장) | `frontend` | 단계별 캐러셀. 의존성 단순화를 위해 vanilla JS로 직접 구현 권장 |
| **HTML5 video** | (네이티브) | `frontend` | 동영상 재생. 외부 라이브러리 불필요 (mp4 H.264 표준 재생) |

**자체 구현 영역**:
- 단계 네비게이션 (이전/다음 버튼) → vanilla JS 30줄
- SVG 화살표 오버레이 (런타임 렌더링) → vanilla SVG
- 미디어 lazy load → `loading="lazy"` 속성

### 19.21 P5+ System Panel Launch (시스템 패널 자동 진입)

| 도구 | 사용 위치 | 선정 이유 |
|-----------|----------|----------|
| **macOS URL 스킴** (`open` 명령) | `daemon` | `x-apple.systempreferences:com.apple.preference.security` 같은 URL을 `open`으로 실행. 의존성 0 |
| **execa** (이미 §19.1) | `daemon` | osascript 호출용 |

**라이브러리 추가 없음** — 기존 execa로 충분.

```typescript
// 시스템 환경설정의 보안 패널 자동 진입
import { execa } from 'execa';
await execa('open', ['x-apple.systempreferences:com.apple.preference.security']);
```

### 19.22 P5++ Floating Hint Window (보조 가이드 윈도우)

| 라이브러리 | 버전 | 사용 위치 | 선정 이유 |
|-----------|------|----------|----------|
| **electron** | ^32.0.0 | `daemon` (선택 모듈로 분리) | always-on-top 반투명 윈도우 표시. macOS BrowserWindow 옵션 활용 |

**대안 평가**:
- 자체 Swift 윈도우: 코드 서명 필요 → 채택 안 함
- AppleScript display dialog: 동그라미/화살표 같은 그래픽 표시 불가 → 채택 안 함
- Electron: 데몬에 포함 시 번들 크기가 ~150MB 증가하지만, 시각 효과 제한 없음

> **번들 크기 우려**: Electron이 무거우므로 `daemon`과 분리된 `floating-hint` 별도 패키지로 구성. 시각 가이드가 필요한 항목 진입 시에만 spawn.

```typescript
// 윈도우 옵션 예시
new BrowserWindow({
  alwaysOnTop: true,
  transparent: true,
  frame: false,
  hasShadow: false,
  focusable: false,  // 사용자 입력 가로채지 않음
  webPreferences: { nodeIntegration: false }
});
```

### 19.23 (폐기) P6 Author Capture

> **v0.9에서 폐기**. AI Vision이 동적 인식하므로 작성자가 사전 캡처할 필요 없음.
> 관련 라이브러리(node-global-key-listener)는 의존성에서 제거.

### 19.24 P7 AI Draft (AI 텍스트 초안 - 변형 유지)

| 라이브러리 | 버전 | 사용 위치 | 선정 이유 |
|-----------|------|----------|----------|
| **@anthropic-ai/sdk** | ^0.30.0 | `daemon` (author 모드 + P8 Vision) | Claude API 공식 SDK. P7과 P8 모두에서 사용 |

**v0.9에서의 역할 변화**:
- 작성자가 한 줄 입력 → 자연어 intent 정제 (기존)
- + P8 AI Vision Coach의 메인 API 클라이언트 (신규)

### 19.25 (폐기) P7+ Change Detector

> **v0.9에서 폐기**. AI Vision이 매번 동적 분석하므로 외부 변경에 자동 적응. 시각 diff 불필요.

### 19.26 P7++ Bottleneck Analyzer (정체 분석)

**라이브러리 추가 없음** — 기존 인프라 활용.

- Backend: Prisma의 `groupBy`, `aggregate` 쿼리 (`§19.11`)
- Admin Frontend: Recharts의 BarChart, Table (`§19.12`)
- 통계 계산 로직: SQL aggregate만으로 처리 (별도 통계 라이브러리 불필요)

### 19.27 P8 AI Vision Coach (v0.9 핵심 신규)

| 라이브러리 | 버전 | 사용 위치 | 선정 이유 |
|-----------|------|----------|----------|
| **@anthropic-ai/sdk** | ^0.30.0 | `daemon` (vision 모듈) | Claude 3.5 Sonnet Vision API 공식 SDK. §19.24에서 이미 도입 |
| **macOS `screencapture`** | (네이티브) | `daemon` | 화면 캡처. `screencapture -x /tmp/capture.png` 비대화식 실행. 외부 라이브러리 불필요 |
| **sharp** | ^0.33.0 | `daemon` | 캡처 이미지 리사이즈 (Vision API 비용 절감 위해 1024px 이하로) + 이미지 hash (캐시용) |
| **electron** | ^32.0.0 | `floating-hint` 패키지 (이미 §19.22) | Floating Hint Window. AI 응답 표시 + 빨간 박스 오버레이 + 두 버튼 |

**전체 흐름**:

```typescript
// daemon/src/services/vision-coach.ts

import { execa } from 'execa';
import sharp from 'sharp';
import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'crypto';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const cache = new Map<string, { response: string; timestamp: number }>();

async function analyzeScreen(stepContext: StepContext, requestType: 'guide' | 'verify') {
  // 1. 화면 캡처 (메모리에만, 디스크 안 거침)
  const tmpPath = `/tmp/onboarding-capture-${Date.now()}.png`;
  await execa('screencapture', ['-x', tmpPath]);
  const imageBuffer = await sharp(tmpPath).resize(1024).png().toBuffer();
  await execa('rm', [tmpPath]);  // 즉시 삭제

  // 2. 캐시 체크 (동일 화면 30초 내 재호출 방지)
  const imageHash = createHash('sha256').update(imageBuffer).digest('hex');
  const cacheKey = `${stepContext.itemId}:${stepContext.stepId}:${requestType}:${imageHash}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 30_000) {
    return cached.response;
  }

  // 3. 가드레일: 시간당 호출 횟수 체크
  if (await isRateLimitExceeded()) {
    throw new Error('Rate limit guard triggered');
  }

  // 4. Vision API 호출
  const prompt = requestType === 'guide'
    ? buildGuidePrompt(stepContext)
    : buildVerifyPrompt(stepContext);

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBuffer.toString('base64') }},
        { type: 'text', text: prompt }
      ]
    }]
  });

  // 5. 이미지 메모리 즉시 파기
  // (imageBuffer 변수는 함수 종료 시 GC 대상)

  // 6. 캐시 저장 + 응답 반환
  const result = response.content[0].text;
  cache.set(cacheKey, { response: result, timestamp: Date.now() });
  return result;
}
```

**프롬프트 설계 원칙**:
- **안내 요청**: "사용자가 단계 X에 있고 의도는 Y. 현재 화면 보고 다음 행동 안내. 클릭 영역 좌표 포함"
- **진행 확인**: "사용자가 단계 X 완료했는가? PASS/FAIL/UNCLEAR + 근거"
- 응답 형식: JSON (좌표, 텍스트, 판정 결과)

**가드레일 구현**:
- debounce: 1초 내 동일 호출 무시
- 캐시: 이미지 hash로 30초 TTL
- 호출 카운터: SQLite에 시간당 누적, 100/200 임계값 처크

**대안 평가**:
- **screencapture vs ScreenCaptureKit (Swift)**: ScreenCaptureKit이 더 빠르지만 Swift 빌드 환경 필요. MVP는 screencapture로 충분
- **이미지 압축**: PNG 그대로 vs JPEG 75%. JPEG가 토큰 절감되지만 텍스트 인식 품질 저하 → PNG 유지
- **resize 크기**: 1024px (Claude 권장) vs 원본. 1024px가 비용/품질 균형

---

## 부록 A. 용어 정의

- **Ready-to-Work**: 신규 입사자가 실질적인 업무를 시작할 수 있는 상태. 모든 P0 체크리스트 항목 완료를 의미.
- **온보딩메이트**: 시스템 내 AI 챗봇의 명칭.
- **자동 검증 항목**: 시스템이 사용자 머신/계정 상태를 직접 확인하여 완료 여부를 판단할 수 있는 항목.
- **명령어 안내형 항목**: 권한이 필요해 시스템이 직접 실행하지 않고 사용자에게 복사 가능한 명령어를 제공하는 항목.
- **State Probe (P1)**: 머신 상태(설치된 앱, CLI, 프로세스 등)를 자동 점검하는 자동화 패턴.
- **Clipboard Inject (P2)**: 실행해야 할 명령어를 사용자 클립보드에 자동 복사하는 자동화 패턴.
- **Guided Browser (P3)**: 브라우저에서 페이지 이동 + UI 하이라이트 + 입력 자동화를 수행하는 패턴 (Chrome Extension 또는 Playwright).
- **Auto Verify (P4)**: 사용자 행동 후 결과를 시스템이 자동 확인하여 체크리스트 상태를 갱신하는 패턴.
- **Visual Guide (P5)**: 미리 캡처된 이미지/짧은 동영상에 화살표 마크업이 추가된 정적 가이드. v0.9에서 보조 역할로 격하.
- **System Panel Launch (P5+)**: macOS URL 스킴 또는 AppleScript로 시스템 환경설정 등 특정 패널을 자동 진입.
- **Floating Hint Window (P5++)**: always-on-top 반투명 윈도우로 외부 앱 위에 시각 힌트 표시. v0.9에서 운영 중 메인 UI로 격상 — P8 결과 표시 + 두 버튼.
- **(폐기) Author Capture (P6)**: v0.9에서 폐기. AI Vision 동적 인식이 사전 캡처를 대체.
- **AI Draft (P7)**: Claude API로 자연어 intent 정제. v0.9에서도 유지.
- **(폐기) Change Detector (P7+)**: v0.9에서 폐기. AI Vision이 동적 적응.
- **Bottleneck Analyzer (P7++)**: 입사자 정체율 데이터로 가이드 보강 우선순위 자동 식별.
- **AI Vision Coach (P8)** ⭐: v0.9 핵심 패턴. Screen Recording으로 화면 캡처 → Claude 3.5 Sonnet Vision API → Floating Hint Window에 동적 안내. 명시 트리거 ("안내 요청"/"진행 확인" 두 버튼).
- **Ralph 루프**: stop hook으로 Claude Code 종료를 차단하고 동일 프롬프트를 재주입하여 종료 조건을 만족할 때까지 반복하는 자동 개발 패턴.
- **Impl Ralph**: 코드를 작성하는 Ralph 루프. AC 통과까지 반복.
- **Review Ralph**: 코드를 검증하는 Ralph (단발 실행, 루프 아님). Read-only 권한.
- **Integration Ralph**: Wave 종료 시점에 통합 테스트를 작성/실행하는 Ralph. 제한된 쓰기 권한 (테스트 코드와 Mock만).
- **Completion Promise**: Ralph 루프의 종료 신호. `<promise>SPEC_NNN_DONE</promise>` 형식.
- **BOUNDARIES.md**: Ralph가 수정/생성 금지인 영역을 명시한 파일.
- **Wave**: 의존성 그래프 기반의 동시 실행 가능한 spec 묶음.
- **Worktree**: Git의 worktree 기능을 활용해 같은 레포의 여러 브랜치를 동시에 다른 디렉토리에서 작업하는 메커니즘.
- **누적 통합 테스트**: Wave N의 통합 테스트 실행 시 Wave 1~N-1 테스트도 함께 실행하여 회귀를 방지하는 정책.
- **Mock 서비스**: 외부 의존(Gmail API, GitLab API 등)을 격리하기 위한 모의 구현체. `packages/test-fixtures`에서 관리.
