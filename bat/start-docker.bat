@echo off
setlocal EnableExtensions
chcp 65001 >nul
title ForgeDeck Docker
call "%~dp0_env.bat"

where docker >nul 2>&1
if errorlevel 1 (
  echo Не найден Docker. Установи Docker Desktop: https://www.docker.com/products/docker-desktop/
  pause
  exit /b 1
)

if not exist "%ROOT%\.env" copy /Y "%ROOT%\.env.example" "%ROOT%\.env" >nul
if not exist "%ROOT%\storage\audio" mkdir "%ROOT%\storage\audio"

echo Собираю и поднимаю postgres + redis + backend + worker + frontend...
cd /d "%ROOT%"
docker compose up --build
endlocal
