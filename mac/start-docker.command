#!/bin/bash
cd "$(dirname "$0")" || exit 1
# shellcheck disable=SC1091
source "./_lib.sh"
cd "$ROOT" || exit 1

if ! command -v docker >/dev/null 2>&1; then
  echo "Не найден Docker. Установи Docker Desktop: https://www.docker.com/products/docker-desktop/"
  pf_wait
  exit 1
fi

[ -f "$ROOT/.env" ] || cp "$ROOT/.env.example" "$ROOT/.env"
mkdir -p "$ROOT/storage/audio"

echo "Собираю и поднимаю postgres + redis + backend + worker + frontend…"
docker compose up --build
pf_wait
