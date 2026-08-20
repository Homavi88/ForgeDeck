ForgeDeck — запуск на Windows
==============================

Нужно один раз:
  Python 3.11+  (галочка "Add python.exe to PATH")
  Node.js LTS   (https://nodejs.org/)

Двойной клик по файлам в этой папке:

  1) setup.bat     создаёт .venv, копирует .env, ставит pip + npm,
                   пишет demo-loop.wav
  2) start.bat     поднимает API и UI в двух окнах и открывает браузер
                   (если setup ещё не делали — сделает сам)

Студия:   http://127.0.0.1:5173
API:      http://127.0.0.1:8000/docs

Демо-трек после setup:
  ..\storage\audio\demo-loop.wav
  → в студии Library → Upload → кнопки A / B → клик по экрану → Play

Остановить: закрой окна "ForgeDeck API" и "ForgeDeck UI", либо stop.bat

Docker (если установлен Docker Desktop): start-docker.bat
