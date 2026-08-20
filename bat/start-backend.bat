@echo off
setlocal EnableExtensions
chcp 65001 >nul
title PulseForge API
call "%~dp0_env.bat"

if not exist "%PY%" (
  echo Сначала запусти setup.bat — нет .venv
  pause
  exit /b 1
)
if not exist "%ROOT%\.env" copy /Y "%ROOT%\.env.example" "%ROOT%\.env" >nul

echo PulseForge API  http://127.0.0.1:8000/docs
echo Не закрывай это окно, пока работает студия.
echo.
cd /d "%ROOT%\backend"
"%PY%" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
echo.
echo API остановлен.
pause
endlocal
