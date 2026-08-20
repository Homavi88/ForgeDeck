#!/bin/bash
cd "$(dirname "$0")" || exit 1
# shellcheck disable=SC1091
source "./_lib.sh"
cd "$ROOT" || exit 1

if [ ! -x "$PY" ]; then
  echo "Сначала запусти setup.command — нет .venv"
  pf_wait
  exit 1
fi
[ -f "$ROOT/.env" ] || cp "$ROOT/.env.example" "$ROOT/.env"

echo "PulseForge API  http://127.0.0.1:8000/docs"
echo "Не закрывай это окно, пока работает студия."
echo
cd "$ROOT/backend" || exit 1
"$PY" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
echo
echo "API остановлен."
pf_wait
