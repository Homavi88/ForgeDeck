@echo off
REM Shared paths. Call from other scripts:  call "%~dp0_env.bat"
cd /d "%~dp0.."
set "ROOT=%CD%"
set "VENV=%ROOT%\.venv"
set "PY=%VENV%\Scripts\python.exe"
set "PIP=%VENV%\Scripts\pip.exe"
set "PYTHONPATH=%ROOT%;%ROOT%\backend"
if exist "%ROOT%\.env" (
  REM keep existing env
) else (
  if exist "%ROOT%\.env.example" copy /Y "%ROOT%\.env.example" "%ROOT%\.env" >nul
)
if not exist "%ROOT%\storage\audio" mkdir "%ROOT%\storage\audio"
