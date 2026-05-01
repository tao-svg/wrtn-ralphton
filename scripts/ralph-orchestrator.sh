#!/bin/bash
# Ralph Orchestrator (v0.10 MVP-Slim)
# 사용법:
#   ./scripts/ralph-orchestrator.sh --spec spec-001-shared
#   ./scripts/ralph-orchestrator.sh --wave 1
#   ./scripts/ralph-orchestrator.sh --all
#
# 주의: -e는 의도적으로 빼두었다 — retry 루프가 일시적 실패(pnpm install 등)를
# 흡수해 다음 attempt로 넘기도록 설계됐기 때문이다. 대신 critical step은
# 명시적 if-검사 또는 || 처리한다.
set -uo pipefail

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
WORKTREE_BASE="$REPO_ROOT/.worktrees"
MAX_RETRIES=3

mkdir -p "$WORKTREE_BASE"

# ---- 헬퍼: spec 파일에서 Wave 번호 매칭 ----
# spec 파일의 메타 필드는 `- **Wave**: N` 형태이므로 별표를 정확히 매치한다.
specs_in_wave() {
  local WAVE_NUM=$1
  grep -lE "^\s*-?\s*\*\*Wave\*\*:\s*${WAVE_NUM}\b" "$REPO_ROOT/specs/"spec-*.md 2>/dev/null \
    | xargs -n1 basename \
    | sed 's/\.md$//'
}

# ---- 헬퍼: 모든 wave 번호 추출 ----
all_waves() {
  grep -hE "^\s*-?\s*\*\*Wave\*\*:" "$REPO_ROOT/specs/"spec-*.md 2>/dev/null \
    | grep -oE "[0-9]+" \
    | sort -un
}

# ---- 단일 spec 처리 ----
process_spec() {
  local SPEC_ID=$1
  local SPEC_ID_UPPER
  SPEC_ID_UPPER=$(echo "$SPEC_ID" | tr 'a-z-' 'A-Z_')
  local IMPL_WT="$WORKTREE_BASE/wt-${SPEC_ID#spec-}"
  local REVIEW_WT="$WORKTREE_BASE/wt-${SPEC_ID#spec-}-review"
  local BRANCH="feature/$SPEC_ID"
  local ATTEMPT=0
  local REVIEW_LOG="/tmp/ralph-review-${SPEC_ID}.log"

  echo "=== Processing $SPEC_ID ==="

  # 직전 spec이 머지되었을 수 있으므로 origin/main 캐시 갱신
  (cd "$REPO_ROOT" && git fetch origin main >/dev/null 2>&1) || true

  while [ $ATTEMPT -lt $MAX_RETRIES ]; do
    ATTEMPT=$((ATTEMPT + 1))
    echo "--- Attempt $ATTEMPT/$MAX_RETRIES ---"

    # 1. Impl 워크트리 준비 — 브랜치 존재 여부에 따라 분기
    if [ ! -d "$IMPL_WT" ]; then
      cd "$REPO_ROOT"
      if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
        git worktree add "$IMPL_WT" "$BRANCH"
      elif git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
        git fetch origin "$BRANCH":"$BRANCH"
        git worktree add "$IMPL_WT" "$BRANCH"
      else
        git worktree add "$IMPL_WT" -b "$BRANCH" origin/main
      fi
    fi

    cd "$IMPL_WT"

    # CC 설정 디렉토리 준비 — BSD/macOS cp는 옵션이 인자보다 앞에 와야 함
    if [ -d "$REPO_ROOT/.claude" ]; then
      mkdir -p "$IMPL_WT/.claude"
      cp -R "$REPO_ROOT/.claude/." "$IMPL_WT/.claude/" 2>/dev/null || true
    else
      mkdir -p "$IMPL_WT/.claude"
    fi

    # stop hook 설정 — settings.local.json에 작성하여 프로젝트 settings.json 보존
    cat > .claude/settings.local.json <<JSON
{
  "hooks": {
    "Stop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "$REPO_ROOT/scripts/ralph-stop-hook.sh"
      }]
    }]
  }
}
JSON

    rm -f .ralph-iteration-count

    if ! pnpm install; then
      echo "⚠️ pnpm install failed (attempt $ATTEMPT) — retrying"
      continue
    fi

    # Impl Ralph 실행 — claude 종료 코드는 무시하고 출력 전체로 판정
    # NOTE: envsubst는 자식 프로세스이므로 env 변수 prefix 방식이 필요 (local 변수는 못 봄)
    IMPL_PROMPT=$(SPEC_ID="$SPEC_ID" SPEC_ID_UPPER="$SPEC_ID_UPPER" \
                    envsubst < "$REPO_ROOT/scripts/ralph-impl-prompt.md")
    claude --dangerously-skip-permissions \
        --append-system-prompt "$IMPL_PROMPT" \
        "specs/$SPEC_ID.md를 구현하세요. plan을 세우고 차근차근 진행하세요." \
        || echo "(impl claude exited non-zero, continuing)"

    if ! git push origin "$BRANCH"; then
      echo "⚠️ git push failed (attempt $ATTEMPT) — retrying"
      continue
    fi

    # 2. Review 워크트리 준비 — impl 워크트리가 같은 브랜치를 점유 중이므로
    # --detach로 commit 자체에 새 worktree를 만들어 충돌 회피.
    if [ ! -d "$REVIEW_WT" ]; then
      cd "$REPO_ROOT"
      if ! git worktree add --detach "$REVIEW_WT" "$BRANCH"; then
        echo "⚠️ review worktree 생성 실패 (attempt $ATTEMPT) — retrying"
        continue
      fi
    else
      cd "$REVIEW_WT" || { echo "⚠️ cd 실패 — retrying"; continue; }
      git fetch origin "$BRANCH"
      git reset --hard "origin/$BRANCH"
    fi

    cd "$REVIEW_WT" || { echo "⚠️ cd 실패 — retrying"; continue; }
    mkdir -p .claude reports

    # Review용 권한 제한 — Edit/Write/MultiEdit/NotebookEdit 모두 막아야
    # 리뷰어가 우회할 수 없다. BOUNDARIES.md의 read-only 경로를 그대로 반영.
    cat > .claude/settings.local.json <<JSON
{
  "permissions": {
    "deny": [
      "Edit(packages/**)",
      "Edit(specs/**)",
      "Edit(docs/**)",
      "Edit(BOUNDARIES.md)",
      "Edit(spec-template.md)",
      "Write(packages/**)",
      "Write(specs/**)",
      "Write(docs/**)",
      "Write(BOUNDARIES.md)",
      "Write(spec-template.md)",
      "MultiEdit(packages/**)",
      "MultiEdit(specs/**)",
      "MultiEdit(docs/**)",
      "MultiEdit(BOUNDARIES.md)",
      "MultiEdit(spec-template.md)",
      "NotebookEdit(**)",
      "Bash(git push:*)",
      "Bash(git commit:*)"
    ],
    "allow": [
      "Edit(reports/**)",
      "Write(reports/**)",
      "MultiEdit(reports/**)",
      "Read(**)",
      "Bash(pnpm test:*)",
      "Bash(pnpm build:*)",
      "Bash(pnpm lint:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)"
    ]
  }
}
JSON

    # Review Ralph 실행 (단발, stop hook 없이)
    REVIEW_PROMPT=$(SPEC_ID="$SPEC_ID" SPEC_ID_UPPER="$SPEC_ID_UPPER" \
                      envsubst < "$REPO_ROOT/scripts/ralph-review-prompt.md")
    REVIEW_RESULT=$(claude --dangerously-skip-permissions \
        --append-system-prompt "$REVIEW_PROMPT" \
        "$SPEC_ID 코드 리뷰를 수행하세요" 2>&1 | tee "$REVIEW_LOG")

    # 결과 파싱
    if echo "$REVIEW_RESULT" | grep -q "<promise>${SPEC_ID_UPPER}_REVIEW_PASS"; then
      echo "✅ Review PASSED for $SPEC_ID"

      cd "$IMPL_WT"
      if ! gh pr create \
        --title "[Ralph] $SPEC_ID" \
        --body-file "$REVIEW_WT/reports/review-$SPEC_ID.md" \
        --label "ralph-generated,ralph-verified,review-passed" \
        --base main \
        --head "$BRANCH"; then
        echo "🚨 PR creation failed despite review pass — escalating to needs-human"
        gh issue create \
          --title "[Ralph] $SPEC_ID PR 생성 실패" \
          --label "ralph-failed,needs-human" \
          --body "Review가 PASS했으나 'gh pr create'가 실패. 브랜치: $BRANCH" \
          || echo "Issue creation also failed"
        return 1
      fi
      echo "✅ PR created for $SPEC_ID"

      # 자동 머지 — 사람 개입 0회 보장. 보호 룰이 있으면 --admin으로 재시도.
      if gh pr merge "$BRANCH" --squash --delete-branch; then
        echo "✅ PR merged for $SPEC_ID"
      elif gh pr merge "$BRANCH" --squash --delete-branch --admin; then
        echo "✅ PR merged (admin) for $SPEC_ID"
      else
        echo "🚨 auto-merge failed — escalating to needs-human"
        gh issue create \
          --title "[Ralph] $SPEC_ID PR 자동 머지 실패" \
          --label "ralph-failed,needs-human" \
          --body "PR은 생성됐으나 'gh pr merge --squash'가 실패. 브랜치 보호 룰 확인 필요. 브랜치: $BRANCH" \
          || echo "Issue creation also failed"
        return 1
      fi

      # 머지 성공 → 워크트리 정리 + main 캐시 갱신
      cd "$REPO_ROOT"
      git worktree remove "$IMPL_WT" --force 2>/dev/null || rm -rf "$IMPL_WT"
      git worktree remove "$REVIEW_WT" --force 2>/dev/null || rm -rf "$REVIEW_WT"
      git worktree prune
      git branch -D "$BRANCH" 2>/dev/null || true
      git fetch origin main >/dev/null 2>&1 || true

      return 0

    elif echo "$REVIEW_RESULT" | grep -q "<promise>${SPEC_ID_UPPER}_REVIEW_FAIL"; then
      echo "❌ Review FAILED for $SPEC_ID (attempt $ATTEMPT)"
      cp "$REVIEW_WT/reports/review-$SPEC_ID.md" "$IMPL_WT/.ralph-feedback.md"
      continue

    else
      echo "⚠️ Review result unclear, treating as FAIL"
      # 리뷰 보고서가 있으면 그걸 피드백으로, 없으면 안내문 작성
      if [ -f "$REVIEW_WT/reports/review-$SPEC_ID.md" ]; then
        cp "$REVIEW_WT/reports/review-$SPEC_ID.md" "$IMPL_WT/.ralph-feedback.md"
      else
        cat > "$IMPL_WT/.ralph-feedback.md" <<EOF
# 리뷰 결과 불명 (attempt $ATTEMPT)

리뷰 Ralph가 PASS/FAIL 판정 promise를 출력하지 않았습니다.
가능한 원인: 리뷰 도중 실패, 프롬프트 미준수, 리포트 미작성.

다음 시도에서 spec의 모든 AC를 다시 점검하고 누락된 부분을 보완하세요.
리뷰 로그: $REVIEW_LOG
EOF
      fi
      continue
    fi
  done

  # 3회 실패
  echo "🚨 $SPEC_ID failed after $MAX_RETRIES attempts"
  gh issue create \
    --title "[Ralph] $SPEC_ID 자동 처리 실패" \
    --label "ralph-failed,needs-human" \
    --body "Spec $SPEC_ID에 대해 Impl/Review를 ${MAX_RETRIES}회 시도했으나 통과하지 못함." \
    || echo "Issue creation failed"
  return 1
}

# ---- 인자 파싱 ----
case "${1:-}" in
  --spec)
    process_spec "${2:-}"
    ;;
  --wave)
    WAVE_NUM="${2:-}"
    if [ -z "$WAVE_NUM" ]; then
      echo "Usage: $0 --wave <num>"
      exit 1
    fi
    SPECS=$(specs_in_wave "$WAVE_NUM")
    if [ -z "$SPECS" ]; then
      echo "No specs found for Wave $WAVE_NUM"
      exit 1
    fi
    for SPEC in $SPECS; do
      process_spec "$SPEC"
    done
    ;;
  --all)
    # 전체 spec을 번호 순으로 직렬 실행. wave 추상화를 우회하고
    # spec 파일을 사전 순(== 번호 순)으로 한 건씩 처리한다.
    # spec-templete.md(템플릿) 같은 비-번호 파일은 spec-[0-9]* 글로브로 제외.
    SPECS=$(ls "$REPO_ROOT/specs/"spec-[0-9]*-*.md 2>/dev/null \
            | xargs -n1 basename \
            | sed 's/\.md$//' \
            | sort)
    if [ -z "$SPECS" ]; then
      echo "No specs found in specs/"
      exit 1
    fi
    echo "=== Running all specs sequentially ==="
    echo "$SPECS" | sed 's/^/  - /'
    echo
    for SPEC in $SPECS; do
      process_spec "$SPEC" || echo "⚠️ $SPEC failed; continuing to next spec"
    done
    ;;
  *)
    echo "Usage: $0 --spec <spec-id> | --wave <num> | --all"
    exit 1
    ;;
esac
