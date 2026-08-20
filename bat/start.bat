@echo off
setlocal EnableExtensions
chcp 65001 >nul
title ForgeDeck launcher
call "%~dp0_env.bat"
set "PF_NOPAUSE=1"

echo === ForgeDeck: запуск ===
echo.

if not exist "%PY%" (
  echo Первый запуск — создаю окружение...
  call "%~dp0setup.bat"
  if errorlevel 1 exit /b 1
  call "%~dp0_env.bat"
)
if not exist "%ROOT%\frontend\node_modules" (
  echo Ставлю frontend...
  call "%~dp0setup.bat"
  if errorlevel 1 exit /b 1
  call "%~dp0_env.bat"
)
if not exist "%ROOT%\.env" copy /Y "%ROOT%\.env.example" "%ROOT%\.env" >nul
if not exist "%ROOT%\storage\audio\demo-loop.wav" (
  "%PY%" "%ROOT%\scripts\seed_demo.py" 2>nul
)

echo Открываю API и UI в отдельных окнах...
start "ForgeDeck API" cmd /k "%~dp0start-backend.bat"
timeout /t 2 /nobreak >nul
start "ForgeDeck UI" cmd /k "%~dp0start-frontend.bat"
timeout /t 5 /nobreak >nul
start "" http://127.0.0.1:5173

echo.
echo Студия:     http://127.0.0.1:5173
echo API docs:   http://127.0.0.1:8000/docs
echo Демо-wav:   %ROOT%\storage\audio\demo-loop.wav
echo.
echo Создай проект → кликни по студии ^(звук^) → Library Upload → A / B → Play.
echo Остановить: закрой окна API/UI или запусти stop.bat
echo.
pause
endlocal
