# Contributing

Код и продукт: **ForgeDeck**. Realtime-звук только в браузере.

1. Прочитай [`.cursor/docs/README.md`](.cursor/docs/README.md) и [`.cursor/docs/conventions.md`](.cursor/docs/conventions.md).
2. Ветка от `main`. Для агентов: `cursor/<short-name>-c63c`.
3. Тесты: `cd backend && PYTHONPATH=..:. pytest -q` и `cd frontend && npm run build`.
4. Документы **обязательны в том же PR**, что и код. Правило для агентов: [`.cursor/rules/docs-sync.mdc`](.cursor/rules/docs-sync.mdc). Минимум: `CHANGELOG.md` (Unreleased) + нужный файл в `.cursor/docs/`. Публичный `README.md` — лендинг продукта, внутренние docs туда не линкуем.
5. Не коммить `.env`, `storage/audio/**`, `frontend/public/worklets/rubberband-processor.js`.

PR: что сломается без этой правки, как проверить руками (дека / bounce / stems / collab).
