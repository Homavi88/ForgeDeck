#!/bin/bash
cd "$(dirname "$0")" || exit 1
# shellcheck disable=SC1091
source "./_lib.sh"
cd "$ROOT" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Не найден Node.js. https://nodejs.org/  или  brew install node"
  pf_wait
  exit 1
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "Ставлю npm-зависимости…"
  (cd "$ROOT/frontend" && npm install) || { pf_wait; exit 1; }
fi

echo "ForgeDeck UI  http://127.0.0.1:5173"
echo "Не закрывай это окно, пока работает студия."
echo
cd "$ROOT/frontend" || exit 1
npm run dev -- --host 127.0.0.1 --port 5173
echo
echo "UI остановлен."
pf_wait
