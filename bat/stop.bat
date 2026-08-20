@echo off
setlocal EnableExtensions
chcp 65001 >nul
title ForgeDeck stop

echo Останавливаю окна ForgeDeck API / UI...
taskkill /FI "WINDOWTITLE eq ForgeDeck API*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq ForgeDeck UI*" /T /F >nul 2>&1

for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr /R /C:":8000.*LISTENING"') do (
  taskkill /F /PID %%p >nul 2>&1
)
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr /R /C:":5173.*LISTENING"') do (
  taskkill /F /PID %%p >nul 2>&1
)

echo Готово.
timeout /t 2 /nobreak >nul
endlocal
