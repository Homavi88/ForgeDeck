@echo off
setlocal EnableExtensions
chcp 65001 >nul
title ForgeDeck setup
call "%~dp0_env.bat"

echo.
echo === ForgeDeck: создание окружения ===
echo Папка проекта: %ROOT%
echo.

call :find_python
if not defined PYLAUNCH (
  echo [Ошибка] Не найден Python 3. Установи с https://www.python.org/downloads/
  echo и на первом экране включи "Add python.exe to PATH".
  if not defined PF_NOPAUSE pause
  exit /b 1
)

call "%~dp0_node.bat"
if not defined NODE_EXE call :install_portable_node
if not defined NODE_EXE (
  echo.
  echo [Ошибка] Не удалось поставить portable Node.js LTS для текущего пользователя.
  echo Проверь интернет и Python 3, затем запусти setup.bat снова.
  echo Системная установка ^(только если нужна всем пользователям, может запросить admin^):
  echo   winget install --id OpenJS.NodeJS.LTS --exact --source winget
  echo.
  if not defined PF_NOPAUSE pause
  exit /b 1
)
echo Node "%NODE_EXE%"

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
exit /b 0

:install_portable_node
REM Default automatic path: unpack a verified Node LTS ZIP in the current
REM user's LocalAppData with Python. Do not invoke PowerShell, UAC, or installers.
set "NODE_ARCH=x64"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "NODE_ARCH=arm64"
if /I "%PROCESSOR_ARCHITEW6432%"=="ARM64" set "NODE_ARCH=arm64"
if /I "%PROCESSOR_ARCHITECTURE%"=="x86" if not defined PROCESSOR_ARCHITEW6432 set "NODE_ARCH=x86"

echo [Node] Ставлю Node.js LTS только для текущего пользователя ^(без admin^)...
call %PYLAUNCH% "%~dp0install-node-portable.py" --arch "%NODE_ARCH%"
if errorlevel 1 exit /b 1

call "%~dp0_node.bat"
if defined NODE_EXE exit /b 0
exit /b 1

:find_python
set "PYLAUNCH="
py -3 --version >nul 2>&1
if not errorlevel 1 set "PYLAUNCH=py -3"
if not defined PYLAUNCH (
  python --version >nul 2>&1
  if not errorlevel 1 set "PYLAUNCH=python"
)
exit /b 0
