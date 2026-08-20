#!/bin/bash
cd "$(dirname "$0")" || exit 1
# shellcheck disable=SC1091
source "./_lib.sh"
pf_set_window_title "ForgeDeck launcher"
export PF_NOPAUSE=1
cd "$ROOT" || exit 1

echo "=== ForgeDeck: запуск (macOS) ==="
echo

if [ ! -x "$PY" ] || [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "Первый запуск — создаю окружение…"
  bash "$ROOT/mac/setup.command" || exit 1
  # shellcheck disable=SC1091
  source "$ROOT/mac/_lib.sh"
fi
[ -f "$ROOT/.env" ] || cp "$ROOT/.env.example" "$ROOT/.env"
if [ ! -f "$ROOT/storage/audio/demo-loop.wav" ] && [ -x "$PY" ]; then
  "$PY" "$ROOT/scripts/seed_demo.py" >/dev/null 2>&1 || true
fi

echo "Открываю API и UI в отдельных окнах…"
pf_open_terminal "$ROOT/mac/start-backend.command" || {
  echo "[Ошибка] Не удалось открыть Terminal. Запусти start-backend.command вручную."
  unset PF_NOPAUSE
  pf_wait
  exit 1
}
sleep 2
pf_open_terminal "$ROOT/mac/start-frontend.command" || true
sleep 4
open "http://127.0.0.1:5173" >/dev/null 2>&1 || true

unset PF_NOPAUSE
echo
echo "Студия:     http://127.0.0.1:5173"
echo "API docs:   http://127.0.0.1:8000/docs"
echo "Демо-wav:   $ROOT/storage/audio/demo-loop.wav"
echo
echo "Создай проект → кликни по студии (звук) → Library Upload → A / B → Play."
echo "Остановить: кнопка «Выключить» в приложении, закрыть окна или stop.command"
pf_wait
