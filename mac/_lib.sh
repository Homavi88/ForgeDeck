# Shared by mac/*.command (source this file, do not double-click it).
# Finder-launched apps have a tiny PATH — Homebrew/nvm must be injected.

pf_macos_path() {
  export PATH="/opt/homebrew/bin:/usr/local/bin:${HOME}/.local/bin:/usr/bin:/bin:${PATH}"
  if [ -x /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
  if [ -s "${HOME}/.nvm/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "${HOME}/.nvm/nvm.sh"
  fi
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
