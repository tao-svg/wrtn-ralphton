#!/bin/bash
# Ralph: GitHub 사전 셋업 (라벨 생성)
# 사용법:
#   1) gh auth login
#   2) ./scripts/ralph-setup-github.sh
#
# orchestrator가 PR/이슈 생성 시 사용하는 라벨을 미리 만든다.
# 이미 존재하는 라벨은 --force로 덮어쓰며 색만 갱신된다.

set -euo pipefail

if ! gh auth status >/dev/null 2>&1; then
  echo "✗ gh가 인증되지 않았습니다. 먼저 'gh auth login'을 실행하세요." >&2
  exit 1
fi

declare -a LABELS=(
  "ralph-generated|c5def5|Ralph가 생성한 PR"
  "ralph-verified|0e8a16|Review Ralph가 검증 통과"
  "review-passed|0e8a16|모든 리뷰 항목 PASS"
  "ralph-failed|d93f0b|Ralph가 3회 시도 후 실패"
  "needs-human|fbca04|사람 개입 필요"
)

for entry in "${LABELS[@]}"; do
  IFS='|' read -r name color desc <<< "$entry"
  echo "→ creating/updating label: $name"
  gh label create "$name" --color "$color" --description "$desc" --force
done

echo
echo "✓ 라벨 셋업 완료"
gh label list | head -20
