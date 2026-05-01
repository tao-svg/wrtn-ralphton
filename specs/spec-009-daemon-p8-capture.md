# Spec: daemon — P8 Vision · 화면 캡처 + 즉시 파기

## 메타
- **ID**: spec-009-daemon-p8-capture
- **Wave**: 2 (track A — daemon)
- **의존성**: spec-001-shared, spec-002-daemon-skeleton, spec-004-daemon-consents
- **예상 작업 시간**: 3h
- **패키지 경로**: `packages/daemon/`

## 목표
macOS `screencapture -x`로 비프음·UI 없이 화면을 캡처해 메모리 Buffer로 보관하고, 사용 후 즉시 파기 + 디스크에 어떤 흔적도 남기지 않도록 한다.

## 입력 (시작 시점에 존재해야 하는 것)
- spec-004 머지 (Screen Recording 권한 체크 헬퍼 사용 가능)
- sharp 라이브러리 도입 가능 (PRD §12)

## 출력 (완료 시점에 존재해야 하는 것)
- `packages/daemon/src/p8-vision/capture.ts`
  - `captureScreen(): Promise<{ buffer: Buffer; hash: string; width: number; height: number }>`
  - 흐름:
    1. Screen Recording 권한 미부여 시 → throw `screen_recording_permission_required` (HTTP 401 매핑)
    2. `os.tmpdir()`에 unique 파일 (`onboarding-capture-<uuid>.png`) 생성
    3. `execa('screencapture', ['-x', '-t', 'png', tmpPath])` 실행
    4. 파일 read → Buffer
    5. `fs.unlink(tmpPath)` (try/finally로 보장)
    6. sharp로 long-edge 1568px 이내 리사이즈 (Anthropic 권장)
    7. SHA256 hash 계산 (캐시 키 용도)
- `packages/daemon/src/p8-vision/dispose.ts` — `disposeBuffer(buf: Buffer)` (Buffer.fill(0) + reference null)
- `packages/daemon/tests/p8-capture.test.ts`
  - macOS에서 실제 캡처 시도 (CI는 skip 마커, 로컬은 실행)
  - 가짜 PNG로 sharp 리사이즈 동작 단언
  - tmp 파일이 함수 반환 시점에 unlink됐는지 단언 (`fs.access` ENOENT)
  - 권한 미부여 시뮬레이션 → throw

## Acceptance Criteria
- [ ] **AC-VIS-07 충족**: 캡처 함수 반환 후 `os.tmpdir()`에 `onboarding-capture-*.png` 0개 (테스트로 단언)
- [ ] sharp 리사이즈 후 long-edge ≤ 1568px (Anthropic Vision 가이드 준수)
- [ ] hash는 16진수 64자 SHA256 (캐시 키로 사용)
- [ ] 권한 미부여 시 `ScreenRecordingDenied` 커스텀 에러 throw → 라우터에서 401 매핑
- [ ] screencapture 명령 timeout 5초
- [ ] disposeBuffer 호출 후 같은 메모리 영역 재사용 시 zero-fill 확인 (단순 단언)
- [ ] `pnpm test` 통과
- [ ] `pnpm build` 통과
- [ ] `pnpm lint` 에러 0
- [ ] 테스트 커버리지 ≥ 80%
- [ ] BOUNDARIES.md 준수
- [ ] 신규 의존성은 PRD §12 (`sharp`)만 추가

## 참고
- PRD §3.1 P8 (MVP 핵심)
- PRD §7.7 F-P8-01 (screencapture), F-P8-07 (즉시 파기), F-P8-08 (동의 미부여 차단)
- PRD §10 AC-VIS-07 (이미지 데이터 파기)
- PRD §8.2 데이터 보존 정책 (메모리만, /tmp 수 초)
- PRD §14.1 (Anthropic 사내 정책 리스크)

## 비범위 (이 spec에서 하지 않는 것)
- Anthropic API 호출 (SPEC-010)
- 캐시 (SPEC-011)
- HTTP 라우터 (SPEC-012)
- macOS Native node addon으로 권한 다이얼로그 트리거 (CLI 안내로 대체 — SPEC-013)

## 완료 신호
구현이 완료되고 모든 AC가 통과하면 다음 신호를 출력한다.

<promise>SPEC_009_DAEMON_P8_CAPTURE_IMPL_DONE</promise>
