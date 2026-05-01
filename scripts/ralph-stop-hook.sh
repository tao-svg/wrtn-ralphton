#!/bin/bash
# Ralph stop hook
# Claude Code가 종료 시 호출됨
# stdin으로 transcript_path가 전달됨

INPUT=$(cat)
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path')

# 마지막 응답에 <promise>...IMPL_DONE</promise> 있으면 종료 허용
if grep -q "<promise>SPEC_.*_IMPL_DONE</promise>" "$TRANSCRIPT_PATH"; then
  echo '{"decision": "approve", "reason": "Spec completion promise found"}'
  exit 0
fi

# 안전장치: 50회 이상 반복하면 강제 종료
ITER_FILE=".ralph-iteration-count"
COUNT=$(cat $ITER_FILE 2>/dev/null || echo 0)
COUNT=$((COUNT + 1))
echo $COUNT > $ITER_FILE

if [ $COUNT -gt 50 ]; then
  echo '{"decision": "approve", "reason": "Max iterations (50) reached - forcing exit"}'
  exit 0
fi

# 그 외에는 재실행 (block 신호)
echo '{"decision": "block", "reason": "Continue working until <promise>SPEC_..._IMPL_DONE</promise>"}'
exit 0
