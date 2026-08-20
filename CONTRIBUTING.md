# Contributing

Код и продукт: **ForgeDeck**. Realtime-звук только в браузере.

1. Прочитай [docs/README.md](docs/README.md) и [docs/conventions.md](docs/conventions.md).
2. Ветка от `main`. Для агентов: `cursor/<short-name>-c63c`.
3. Тесты: `cd backend && PYTHONPATH=..:. pytest -q` и `cd frontend && npm run build`.
4. После фичи — пункт в `CHANGELOG.md` (Unreleased) и правка `docs/*`, если менялся поток.
5. Не коммить `.env`, `storage/audio/**`, `frontend/public/worklets/rubberband-processor.js`.

PR: что сломается без этой правки, как проверить руками (дека / bounce / stems / collab).
