#!/bin/bash
set -e

# Ralph Orchestrator (v0.10 MVP-Slim)
# 사용법:
#   ./scripts/ralph-orchestrator.sh --spec spec-001-shared
#   ./scripts/ralph-orchestrator.sh --wave 1
#   ./scripts/ralph-orchestrator.sh --all

REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)
WORKTREE_BASE=$(dirname "$REPO_ROOT")
MAX_RETRIES=3

# ---- 단일 spec 처리 ----
process_spec() {
  local SPEC_ID=$1
  local SPEC_ID_UPPER=$(echo "$SPEC_ID" | tr 'a-z-' 'A-Z_')
  local IMPL_WT="$WORKTREE_BASE/wt-${SPEC_ID#spec-}"
  local REVIEW_WT="$WORKTREE_BASE/wt-${SPEC_ID#spec-}-review"
  local BRANCH="feature/$SPEC_ID"
  local ATTEMPT=0

  echo "=== Processing $SPEC_ID ==="

  while [ $ATTEMPT -lt $MAX_RETRIES ]; do
    ATTEMPT=$((ATTEMPT + 1))
    echo "--- Attempt $ATTEMPT/$MAX_RETRIES ---"

    # 1. Impl Ralph
    if [ ! -d "$IMPL_WT" ]; then
      cd "$REPO_ROOT"
      git worktree add "$IMPL_WT" -b "$BRANCH" origin/main
    fi

    cd "$IMPL_WT"
    cp "$REPO_ROOT/.claude" "$IMPL_WT/.claude" -r 2>/dev/null || mkdir -p "$IMPL_WT/.claude"

    # stop hook 설정
    cat > .claude/settings.json <<JSON
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

    # iteration counter 리셋
    rm -f .ralph-iteration-count

    pnpm install

    # Impl Ralph 실행 (Ralph 루프)
    SPEC_ID="$SPEC_ID" SPEC_ID_UPPER="$SPEC_ID_UPPER" \
      claude --dangerously-skip-permissions \
        --append-system-prompt "$(envsubst < "$REPO_ROOT/scripts/ralph-impl-prompt.md")" \
        "specs/$SPEC_ID.md를 구현하세요. plan을 세우고 차근차근 진행하세요."

    # 결과 푸시
    git push origin "$BRANCH"

    # 2. Review Ralph
    if [ ! -d "$REVIEW_WT" ]; then
      cd "$REPO_ROOT"
      git worktree add "$REVIEW_WT" "$BRANCH"
    else
      cd "$REVIEW_WT"
      git pull origin "$BRANCH"
    fi

    cd "$REVIEW_WT"
    mkdir -p .claude reports

    # Review용 권한 제한
    cat > .claude/settings.json <<JSON
{
  "permissions": {
    "deny": [
      "Edit(packages/**)",
      "Edit(specs/**)",
      "Edit(docs/**)",
      "Edit(BOUNDARIES.md)",
      "Bash(git push:*)",
      "Bash(git commit:*)"
    ],
    "allow": [
      "Edit(reports/**)",
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
    REVIEW_RESULT=$(SPEC_ID="$SPEC_ID" SPEC_ID_UPPER="$SPEC_ID_UPPER" \
      claude --dangerously-skip-permissions \
        --append-system-prompt "$(envsubst < "$REPO_ROOT/scripts/ralph-review-prompt.md")" \
        "spec-$SPEC_ID의 코드 리뷰를 수행하세요" 2>&1 | tee /tmp/review-output.log)

    # 결과 파싱
    if echo "$REVIEW_RESULT" | grep -q "<promise>${SPEC_ID_UPPER}_REVIEW_PASS"; then
      echo "✅ Review PASSED for $SPEC_ID"

      # MR 자동 생성
      cd "$IMPL_WT"
      glab mr create \
        --title "[Ralph] $SPEC_ID" \
        --description "$(cat "$REVIEW_WT/reports/review-$SPEC_ID.md")" \
        --label "ralph-generated,ralph-verified,review-passed" \
        --target-branch main \
        --source-branch "$BRANCH" \
        || echo "MR creation failed, please create manually"

      echo "✅ MR created for $SPEC_ID"
      return 0

    elif echo "$REVIEW_RESULT" | grep -q "<promise>${SPEC_ID_UPPER}_REVIEW_FAIL"; then
      echo "❌ Review FAILED for $SPEC_ID (attempt $ATTEMPT)"

      # 다음 시도용 피드백 주입
      cp "$REVIEW_WT/reports/review-$SPEC_ID.md" "$IMPL_WT/.ralph-feedback.md"
      continue
    else
      echo "⚠️ Review result unclear, treating as FAIL"
      continue
    fi
  done

  # 3회 실패
  echo "🚨 $SPEC_ID failed after $MAX_RETRIES attempts"
  glab issue create \
    --title "[Ralph] $SPEC_ID 자동 처리 실패" \
    --label "ralph-failed,needs-human" \
    --description "Spec $SPEC_ID에 대해 Impl/Review를 ${MAX_RETRIES}회 시도했으나 통과하지 못함." \
    || echo "Issue creation failed"
  return 1
}

# ---- 인자 파싱 ----
case "$1" in
  --spec)
    process_spec "$2"
    ;;
  --wave)
    WAVE_NUM="$2"
    SPECS=$(grep "Wave: $WAVE_NUM" specs/*.md | cut -d: -f1 | xargs -n1 basename | sed 's/.md//')
    for SPEC in $SPECS; do
      process_spec "$SPEC"
    done
    ;;
  --all)
    for WAVE in 1 2; do
      bash "$0" --wave "$WAVE"
    done
    ;;
  *)
    echo "Usage: $0 --spec <spec-id> | --wave <num> | --all"
    exit 1
    ;;
esac
