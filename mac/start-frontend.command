#!/bin/bash
cd "$(dirname "$0")" || exit 1
# shellcheck disable=SC1091
source "./_lib.sh"
pf_set_window_title "ForgeDeck UI"
cd "$ROOT" || exit 1

if ! pf_ensure_node; then
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
