# Разработка

## Требования

- Python 3.12
- Node.js LTS
- Опционально: Docker, Redis, CUDA/MPS + `backend/requirements-stems.txt`

## Локально (SQLite)

```bash
cp .env.example .env
# scripts/ensure_secret.py вызывается из bat/mac setup

python3 -m pip install -r backend/requirements.txt
cd backend && PYTHONPATH=..:. uvicorn app.main:app --reload --port 8000

# другой терминал
cd frontend && npm install && npm run dev
```

UI: http://localhost:5173  
API docs: http://localhost:8000/docs  
Demo: `producer@forgedeck.local` / `demo`

Или `make backend` / `make frontend` из корня. Windows: `bat/setup.bat` затем `bat/start.bat`. macOS: `mac/setup.command` / `mac/start.command`.

Остановка из UI: кнопка **Выключить** (`POST /api/shutdown`, только с этой машины). То же делают `bat/stop.bat` / `mac/stop.command`. Окна лаунчера называются `ForgeDeck API` / `ForgeDeck UI` / `ForgeDeck launcher`.

Кликни по UI один раз — браузер разблокирует `AudioContext`. Первый проект кладёт демо-петлю на Deck A.

## Docker

```bash
cp .env.example .env
docker compose up --build
```

Postgres + Redis + backend `:8000` + Celery worker + frontend `:5173` (nginx). Compose задаёт `USE_CELERY=true` и `DATABASE_URL` на Postgres.

Смена имени БД (`forgedeck`) после ренейма с PulseForge: старый volume Postgres нужно дропнуть (`docker compose down -v`), иначе user/db не совпадут.

## Переменные

Шаблон: [`.env.example`](../.env.example). Важное:

| Переменная | Зачем |
| --- | --- |
| `SECRET_KEY` | JWT; setup-скрипты меняют placeholder |
| `REQUIRE_AUTH` | `false` = demo user без логина |
| `USE_CELERY` | иначе анализ в thread |
| `STEMS_DEVICE` | `auto` / `cuda` / `mps` / `cpu` |
| `AI_PROVIDER` | `mock` / `openai` / `anthropic` |
| `MAX_UPLOAD_MB` / `QUOTA_MB` | 250 / 2048 по умолчанию |
| `VITE_API_URL` / `VITE_WS_URL` | фронт → API |

`get_settings()` читает `.env` из `backend/` или корня. После смены env в том же процессе нужен рестарт (lru_cache).

## Тесты

```bash
cd backend && PYTHONPATH=..:. pytest -q
cd frontend && npm run build          # tsc --noEmit && vite build
cd frontend && npx playwright test    # нужен dev/preview; см. playwright.config.ts
```

Backend тесты: auth, projects, audio, analysis, stems (GPU путь мокается), share/quota, ownership, AI, demo loop, shutdown (мок `schedule_shutdown`), style packs (`GET /api/presets/styles`), extra mixer lane persist.

Vite на `buildStart` копирует `rubberband-web` worklet в `public/worklets/rubberband-processor.js` (файл в `.gitignore`).

## macOS: «Не найден Node.js» у setup.command

Двойной клик по `.command` в Finder запускает bash **без** `~/.zshrc`. Homebrew/nvm часто «есть в Terminal», но не в этом окне.

`mac/_lib.sh` добавляет `/opt/homebrew/bin`, nvm, fnm, volta, asdf, mise. Если Node всё равно нет и установлен Homebrew — `setup.command` делает `brew install node`.

Иначе: поставить LTS с https://nodejs.org/ (macOS Installer), закрыть окно и снова `setup.command`. ZIP `ForgeDeck-main` в Downloads — нормально, скрипты идут из `mac/`.

## Windows: «Не найден Node.js» у setup.bat / start.bat

Двойной клик может получить PATH без инструментов, которые настроены только в пользовательском shell. `bat/_node.bat` ищет Node в обычной установке, nvm, fnm, Volta, Scoop и Chocolatey, добавляя найденную папку в PATH текущего окна.

Если Node действительно не установлен, `setup.bat` сначала запускает `winget install --id OpenJS.NodeJS.LTS --exact --source winget` (чтобы не опрашивать `msstore` с проблемным сертификатом), затем `choco install nodejs-lts -y` при наличии Chocolatey. Если оба не помогли, `bat/install-node-portable.ps1` получает актуальную LTS-версию из `nodejs.org/dist/index.json`, скачивает ZIP, сверяет SHA-256 с `SHASUMS256.txt` и распаковывает его в `%LOCALAPPDATA%\ForgeDeck\node\current`. Это per-user install без UAC/admin-пароля. После установки helper повторно ищет portable Node в PATH, поэтому перезапуск Windows или нового cmd не требуется. Только если PowerShell/сеть недоступны, скрипт показывает ручную команду и ссылку на LTS installer.

## PYTHONPATH

Uvicorn и pytest запускай из `backend/` с `PYTHONPATH=..:.`, чтобы импортировались `app`, `ai_agents`, `workers`.

## Alembic

```bash
cd backend && PYTHONPATH=..:. alembic upgrade head
```

На старте API ещё вызывает `Base.metadata.create_all` и `ensure_schema()` — для SQLite dev это закрывает мелкие дыры без миграции. Новые колонки в проде — только Alembic.
