#!/usr/bin/env bash
# Onboarding Agent installer (PRD-MVP-SLIM v0.10 §6.2 A, AC-CORE-01)
# Usage:  curl -fsSL https://onboarding.wrtn.io/install.sh | sh
set -euo pipefail

readonly INSTALL_ROOT="${ONBOARDING_HOME:-$HOME/.onboarding}"
readonly BIN_LINK="${ONBOARDING_BIN_LINK:-/usr/local/bin/onboarding}"
readonly RELEASE_TARBALL_URL="${ONBOARDING_RELEASE_URL:-https://onboarding.wrtn.io/releases/latest/onboarding.tar.gz}"

red()    { printf '\033[31m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
bold()   { printf '\033[1m%s\033[0m\n' "$*"; }

require_macos() {
  case "$(uname -s)" in
    Darwin) ;;
    *)
      red "지원하지 않는 OS입니다: $(uname -s)."
      red "Onboarding Agent는 macOS에서만 동작합니다 (PRD-MVP-SLIM §6.2)."
      exit 1
      ;;
  esac
}

require_node22() {
  if ! command -v node >/dev/null 2>&1; then
    red "Node.js가 설치되어 있지 않습니다."
    yellow "다음 명령으로 설치한 뒤 다시 시도하세요:"
    echo  "  brew install node@22"
    exit 1
  fi
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "${major:-0}" -lt 22 ]; then
    red "Node.js 22 LTS 이상이 필요합니다 (현재: $(node -v))."
    yellow "다음 명령으로 업그레이드하세요:"
    echo  "  brew install node@22"
    exit 1
  fi
}

download_and_extract() {
  bold "1) 최신 릴리즈 다운로드: ${RELEASE_TARBALL_URL}"
  mkdir -p "${INSTALL_ROOT}"
  local tmp
  tmp="$(mktemp -d)"
  trap 'rm -rf "${tmp}"' EXIT
  if ! curl -fsSL "${RELEASE_TARBALL_URL}" -o "${tmp}/onboarding.tar.gz"; then
    red "릴리즈 tarball을 다운로드하지 못했습니다."
    exit 1
  fi
  bold "2) ${INSTALL_ROOT}에 압축을 해제합니다."
  tar -xzf "${tmp}/onboarding.tar.gz" -C "${INSTALL_ROOT}"
}

create_symlink() {
  local target="${INSTALL_ROOT}/dist/cli/index.js"
  if [ ! -f "${target}" ]; then
    red "CLI 진입점을 찾지 못했습니다: ${target}"
    exit 1
  fi
  chmod +x "${target}"
  bold "3) /usr/local/bin/onboarding 심볼릭 링크를 만듭니다 (sudo 필요할 수 있음)."
  if ln -sfn "${target}" "${BIN_LINK}" 2>/dev/null; then
    green "  ✓ ${BIN_LINK} → ${target}"
  else
    yellow "  관리자 권한이 필요합니다. 다음 명령을 실행하세요:"
    echo  "    sudo ln -sfn \"${target}\" \"${BIN_LINK}\""
  fi
}

main() {
  bold "Onboarding Agent 설치를 시작합니다."
  require_macos
  require_node22
  download_and_extract
  create_symlink
  green "설치가 완료되었습니다!"
  echo ""
  bold "다음 명령으로 데몬을 기동하세요:"
  echo  "  onboarding start"
  echo ""
  echo  "처음 실행하면 사용자 정보 입력과 권한/동의 위저드가 진행됩니다."
}

main "$@"
