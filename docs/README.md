# Документация ForgeDeck

Как устроен код: слои, API, Web Audio, UX. Публичный лендинг продукта остаётся в корневом [`README.md`](../README.md) — этот каталог `docs/` не дублирует его.

| Файл | Когда открывать |
| --- | --- |
| [architecture.md](architecture.md) | Нужно понять поток звука vs Python, где что лежит |
| [development.md](development.md) | Запуск, `.env`, тесты, Docker, типичные поломки |
| [conventions.md](conventions.md) | Куда класть правку, чего не делать |
| [backend.md](backend.md) | FastAPI, модели, REST, WS, workers |
| [frontend.md](frontend.md) | React, Zustand, маршруты, коллаб |
| [audio-engine.md](audio-engine.md) | Web Audio: деки, микшер, FX, key lock, bounce |
| [ai.md](ai.md) | AI Producer: провайдеры, tools, apply |
| [studio.md](studio.md) | Режимы UI глазами пользователя (для правок UX) |
| [roadmap.md](roadmap.md) | Удобства и следующие шаги, ещё не в коде |

Корень репозитория:

- [`README.md`](../README.md) — что это и быстрый старт (публичный лендинг)
- [`CHANGELOG.md`](../CHANGELOG.md) — что уже влито в `main`
- [`TODO.md`](../TODO.md) — чеклист сделанного продукта
- [`CONTRIBUTING.md`](../CONTRIBUTING.md) — как коммитить и обновлять эти файлы
- [`AGENTS.md`](../AGENTS.md) — агент обязан обновлять docs вместе с кодом

