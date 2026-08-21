ForgeDeck — запуск на Windows
==============================

Нужно один раз:
  Python 3.11+  (галочка "Add python.exe to PATH")
  Node.js LTS   (setup.bat ищет обычные установки, nvm/fnm/Volta/Scoop
                 и при отсутствии ставит portable-версию только для текущего
                 пользователя — без admin-пароля и без системной установки)

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

Остановить: кнопка «Выключить» в приложении, либо закрой окна
  "ForgeDeck API" / "ForgeDeck UI" / "ForgeDeck launcher", либо stop.bat

Docker (если установлен Docker Desktop): start-docker.bat

Если Node.js всё ещё не найден:
  1) убедись, что есть интернет и доступен Python 3: py -3 --version
  2) снова запусти setup.bat — portable Node будет помещён в:
     %LOCALAPPDATA%\ForgeDeck\node\current
  Системная установка необязательна. Если она всё же нужна всем пользователям:
     winget install --id OpenJS.NodeJS.LTS --exact --source winget
