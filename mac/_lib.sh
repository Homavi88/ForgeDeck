# Shared by mac/*.command (source this file, do not double-click it).
# Finder-launched .command files get a tiny PATH (no ~/.zshrc) — inject Homebrew
# and common Node version managers, then optionally brew-install Node.

pf_macos_path() {
  export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:${HOME}/.local/bin:/usr/bin:/bin:${PATH}"
  if [ -x /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi

  export NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
  if [ -s "${NVM_DIR}/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "${NVM_DIR}/nvm.sh"
  fi

  export VOLTA_HOME="${VOLTA_HOME:-${HOME}/.volta}"
  export PATH="${VOLTA_HOME}/bin:${PATH}"

  if [ -d "${HOME}/.fnm" ]; then
    export PATH="${HOME}/.fnm:${PATH}"
  fi
  if [ -d "${HOME}/.local/share/fnm" ]; then
    export PATH="${HOME}/.local/share/fnm:${PATH}"
  fi
  if command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env --shell bash 2>/dev/null)" || true
  fi

  if [ -s "${HOME}/.asdf/asdf.sh" ]; then
    # shellcheck disable=SC1091
    . "${HOME}/.asdf/asdf.sh"
  fi
  if command -v mise >/dev/null 2>&1; then
    eval "$(mise activate bash 2>/dev/null)" || true
  fi

  # Official nodejs.org pkg sometimes lands here even if brew is missing.
  for extra in /usr/local/bin /opt/homebrew/bin "${HOME}/.nodenv/shims" "${HOME}/.n/bin"; do
    export PATH="${extra}:${PATH}"
  done
}

# Finder double-click often reports "node not found" when Node is only on a
# login-shell PATH. After pf_macos_path, install via Homebrew if possible.
pf_ensure_node() {
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    echo "Node $(node -v) · npm $(npm -v)"
    return 0
  fi
  if command -v brew >/dev/null 2>&1; then
    echo "[Node] не в PATH этого окна. Ставлю Node.js LTS через Homebrew (нужен интернет)…"
    if brew install node; then
      hash -r 2>/dev/null || true
      if command -v node >/dev/null 2>&1; then
        echo "Node $(node -v) · npm $(npm -v)"
        return 0
      fi
    fi
  fi
  echo
  echo "[Ошибка] Не найден Node.js (нужен для UI)."
  echo "Скрипт из Finder не читает ~/.zshrc — если Node уже ставили, закрой окно"
  echo "и запусти setup.command ещё раз после установки."
  echo
  echo "  1) Проще всего: https://nodejs.org/  → macOS Installer (LTS)"
  echo "  2) Или в Terminal:  brew install node"
  echo
  echo "PATH сейчас: $PATH"
  return 1
}

pf_root() {
  local here
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  ROOT="$(cd "${here}/.." && pwd)"
  VENV="${ROOT}/.venv"
  PY="${VENV}/bin/python"
  export PYTHONPATH="${ROOT}:${ROOT}/backend"
  mkdir -p "${ROOT}/storage/audio"
  if [ ! -f "${ROOT}/.env" ] && [ -f "${ROOT}/.env.example" ]; then
    cp "${ROOT}/.env.example" "${ROOT}/.env"
  fi
  if [ -x "${PY}" ]; then
    "${PY}" "${ROOT}/scripts/ensure_secret.py" >/dev/null 2>&1 || true
  elif command -v python3 >/dev/null 2>&1; then
    python3 "${ROOT}/scripts/ensure_secret.py" >/dev/null 2>&1 || true
  fi
}

# Open a new Terminal or iTerm window running the given script path.
pf_open_terminal() {
  local script="$1"
  local quoted
  if command -v python3 >/dev/null 2>&1; then
    quoted="$(python3 -c 'import json,sys; print(json.dumps("exec bash " + json.dumps(sys.argv[1])))' "${script}")"
  else
    quoted="\"exec bash '${script}'\""
  fi
  if [ -d "/Applications/iTerm.app" ]; then
    osascript <<APPLESCRIPT
tell application "iTerm"
  activate
  create window with default profile
  tell current session of current window
    write text ${quoted}
  end tell
end tell
APPLESCRIPT
    return $?
  fi
  osascript <<APPLESCRIPT
tell application "Terminal"
  activate
  do script ${quoted}
end tell
APPLESCRIPT
}

pf_wait() {
  if [ -z "${PF_NOPAUSE:-}" ]; then
    echo
    read -r -p "Нажми Enter, чтобы закрыть это окно… "
  fi
}

pf_macos_path
pf_root
