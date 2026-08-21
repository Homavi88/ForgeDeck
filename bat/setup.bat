@echo off
setlocal EnableExtensions
chcp 65001 >nul
title ForgeDeck setup
call "%~dp0_env.bat"

echo.
echo === ForgeDeck: создание окружения ===
echo Папка проекта: %ROOT%
echo.

call "%~dp0_node.bat"
if not defined NODE_EXE (
  echo [Node] Не найден в PATH этого окна. Ищу или ставлю Node.js LTS...
  where winget >nul 2>&1
  if not errorlevel 1 (
    echo [Node] Установка через Windows Package Manager ^(winget^)...
    REM Avoid a broken Microsoft Store certificate; Node LTS is published in
    REM the community winget source, so do not query msstore at all.
    winget install --id OpenJS.NodeJS.LTS --exact --source winget --accept-package-agreements --accept-source-agreements
    call "%~dp0_node.bat"
  )
)
if not defined NODE_EXE (
  where choco >nul 2>&1
  if not errorlevel 1 (
    echo [Node] Установка через Chocolatey...
    choco install nodejs-lts -y
    call "%~dp0_node.bat"
  )
)
if not defined NODE_EXE (
  echo.
  echo [Ошибка] Не найден Node.js LTS.
  echo Поставь его с https://nodejs.org/ ^(выбери LTS^) или выполни:
  echo   winget install --id OpenJS.NodeJS.LTS --exact --source winget
  echo Затем запусти setup.bat снова.
  echo.
  if not defined PF_NOPAUSE pause
  exit /b 1
)
echo Node "%NODE_EXE%"

set "PYLAUNCH="
py -3 --version >nul 2>&1
if not errorlevel 1 set "PYLAUNCH=py -3"
if not defined PYLAUNCH (
  python --version >nul 2>&1
  if not errorlevel 1 set "PYLAUNCH=python"
)
if not defined PYLAUNCH (
  echo [Ошибка] Не найден Python 3. Установи с https://www.python.org/downloads/
  echo и на первом экране включи "Add python.exe to PATH".
  pause
  exit /b 1
)

echo [1/5] Виртуальное окружение .venv
if not exist "%PY%" (
  %PYLAUNCH% -m venv "%VENV%"
  if errorlevel 1 (
    echo [Ошибка] Не удалось создать .venv
    pause
    exit /b 1
  )
)

echo [2/5] Python-зависимости
"%PY%" -m pip install --upgrade pip >nul
"%PY%" -m pip install -r "%ROOT%\backend\requirements.txt"
if errorlevel 1 (
  echo [Ошибка] pip install не прошёл
  pause
  exit /b 1
)

echo [3/5] Frontend npm install
pushd "%ROOT%\frontend"
call npm install
if errorlevel 1 (
  popd
  echo [Ошибка] npm install не прошёл
  pause
  exit /b 1
)
popd

echo [4/5] Файл .env и папки хранения
if not exist "%ROOT%\.env" copy /Y "%ROOT%\.env.example" "%ROOT%\.env" >nul
if not exist "%ROOT%\storage\audio" mkdir "%ROOT%\storage\audio"

echo [5/5] Демо-петля WAV для первой загрузки в Library
"%PY%" "%ROOT%\scripts\seed_demo.py"
if errorlevel 1 echo [Предупреждение] Демо-wav не собран — можно загрузить свой трек.

where ffmpeg >nul 2>&1
if errorlevel 1 (
  echo.
  echo [Подсказка] ffmpeg не в PATH. WAV/FLAC/OGG работают.
  echo Для MP3 поставь ffmpeg: https://www.gyan.dev/ffmpeg/builds/
)

echo.
echo Готово. Дальше запусти  start.bat
echo Демо-файл: storage\audio\demo-loop.wav
echo.
if not defined PF_NOPAUSE pause
endlocal
