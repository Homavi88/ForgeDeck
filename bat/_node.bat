@echo off
REM Finds Node.js for double-clicked .bat files, whose PATH may not include
REM the user's login-shell setup. Call this before using node or npm.

set "NODE_EXE="
call :from_path
if defined NODE_EXE goto :ready

call :from_dir "%ProgramFiles%\nodejs"
call :from_dir "%ProgramW6432%\nodejs"
call :from_dir "%ProgramFiles(x86)%\nodejs"
call :from_dir "%NVM_SYMLINK%"
call :from_dir "%NVM_HOME%"
call :from_dir "%APPDATA%\nvm"
call :from_dir "%LOCALAPPDATA%\Volta\bin"
call :from_dir "%USERPROFILE%\.volta\bin"
call :from_dir "%USERPROFILE%\scoop\apps\nodejs\current"
call :from_dir "%USERPROFILE%\scoop\apps\nodejs-lts\current"
call :from_dir "%ProgramData%\chocolatey\bin"
call :from_dir "%USERPROFILE%\.nvs\default"
call :from_dir "%LOCALAPPDATA%\ForgeDeck\node\current"

REM fnm puts the active Node under a generated multishell directory.
for /d %%D in ("%LOCALAPPDATA%\fnm_multishells\*") do call :from_dir "%%~D"
for /d %%D in ("%USERPROFILE%\.fnm\node-versions\*\installation") do call :from_dir "%%~D"

:ready
if defined NODE_EXE (
  for %%I in ("%NODE_EXE%") do set "NODE_DIR=%%~dpI"
  set "PATH=%NODE_DIR%;%PATH%"
)
exit /b 0

:from_path
for /f "delims=" %%I in ('where node.exe 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%I"
exit /b 0

:from_dir
if not defined NODE_EXE if exist "%~1\node.exe" set "NODE_EXE=%~1\node.exe"
exit /b 0
