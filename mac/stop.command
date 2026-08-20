#!/bin/bash
cd "$(dirname "$0")" || exit 1
# shellcheck disable=SC1091
source "./_lib.sh"

echo "Останавливаю процессы на портах 8000 и 5173…"
for port in 8000 5173; do
  pids="$(lsof -nP -iTCP:${port} -sTCP:LISTEN -t 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
  fi
done
sleep 1
for port in 8000 5173; do
  pids="$(lsof -nP -iTCP:${port} -sTCP:LISTEN -t 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  fi
done
echo "Готово."
sleep 1
