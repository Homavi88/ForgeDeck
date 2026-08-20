ForgeDeck — запуск на macOS
============================

Нужно один раз:
  Python 3.11+   (python.org или: brew install python)
  Node.js LTS    (https://nodejs.org/ — macOS Installer, или: brew install node)

setup.command из Finder не читает ~/.zshrc. Если Node уже стоит через Homebrew/nvm —
скрипт подхватит его сам; если нет и есть brew, поставит Node автоматически.

Двойной клик по файлам в этой папке (откроется Terminal):

  1) setup.command    создаёт .venv, копирует .env, ставит pip + npm,
                      пишет demo-loop.wav
  2) start.command    поднимает API и UI в двух окнах и открывает браузер
                      (если setup ещё не делали — сделает сам)

Студия:   http://127.0.0.1:5173
API:      http://127.0.0.1:8000/docs

Демо-трек после setup:
  ../storage/audio/demo-loop.wav
  → в студии Library → Upload → кнопки A / B → клик по экрану → Play

Остановить: кнопка «Выключить» в приложении, либо закрой окна
  API/UI/launcher, либо stop.command

Docker Desktop: start-docker.command

Если macOS пишет «не удаётся открыть, потому что не удалось проверить
разработчика» — правый клик по .command → Открыть → Открыть.
Если «permission denied»: в Terminal выполни
  chmod +x mac/*.command
