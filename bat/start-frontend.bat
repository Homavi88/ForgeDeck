@echo off
setlocal EnableExtensions
chcp 65001 >nul
title ForgeDeck UI
call "%~dp0_env.bat"

where node >nul 2>&1
if errorlevel 1 (
  echo Не найден Node.js. Установи LTS с https://nodejs.org/
  pause
  exit /b 1
)

if not exist "%ROOT%\frontend\node_modules" (
  echo Ставлю npm-зависимости...
  pushd "%ROOT%\frontend"
  call npm install
  if errorlevel 1 (
    popd
    pause
    exit /b 1
  )
  popd
)

echo ForgeDeck UI  http://127.0.0.1:5173
echo Не закрывай это окно, пока работает студия.
echo.
cd /d "%ROOT%\frontend"
call npm run dev -- --host 127.0.0.1 --port 5173
echo.
echo UI остановлен.
pause
endlocal
