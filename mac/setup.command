#!/bin/bash
# Double-click in Finder, or:  ./setup.command
cd "$(dirname "$0")" || exit 1
# shellcheck disable=SC1091
source "./_lib.sh"
cd "$ROOT" || exit 1

echo
echo "=== PulseForge: создание окружения (macOS) ==="
echo "Папка проекта: $ROOT"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "[Ошибка] Не найден Node.js."
  echo "Поставь LTS: https://nodejs.org/  или  brew install node"
  pf_wait
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "[Ошибка] Не найден python3."
  echo "Поставь с python.org или:  brew install python"
  pf_wait
  exit 1
fi

echo "[1/5] Виртуальное окружение .venv"
if [ ! -x "$PY" ]; then
  python3 -m venv "$VENV" || { echo "[Ошибка] venv"; pf_wait; exit 1; }
fi

echo "[2/5] Python-зависимости"
"$PY" -m pip install --upgrade pip >/dev/null
"$PY" -m pip install -r "$ROOT/backend/requirements.txt" || { echo "[Ошибка] pip"; pf_wait; exit 1; }

echo "[3/5] Frontend npm install"
(
  cd "$ROOT/frontend" || exit 1
  npm install
) || { echo "[Ошибка] npm install"; pf_wait; exit 1; }

echo "[4/5] Файл .env и папки хранения"
[ -f "$ROOT/.env" ] || cp "$ROOT/.env.example" "$ROOT/.env"
mkdir -p "$ROOT/storage/audio"

echo "[5/5] Демо-петля WAV"
"$PY" "$ROOT/scripts/seed_demo.py" || echo "[Предупреждение] Демо-wav не собран — загрузи свой трек."

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo
  echo "[Подсказка] ffmpeg не в PATH. WAV/FLAC/OGG работают."
  echo "Для MP3:  brew install ffmpeg"
fi

echo
echo "Готово. Дальше запусти  start.command"
echo "Демо-файл: storage/audio/demo-loop.wav"
pf_wait
