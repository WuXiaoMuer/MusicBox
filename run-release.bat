@echo off
setlocal
cd /d "%~dp0"

echo.
echo  ============================================
echo   MusicBox - Run Compiled Build
echo  ============================================
echo.
set "EXE=src-tauri\target\release\musicbox.exe"
if not exist "%EXE%" (
  set "EXE=src-tauri\target\debug\musicbox.exe"
)
if not exist "%EXE%" (
  echo  [HINT] No build found yet. Run build-min.bat or run.bat first.
  echo.
  pause
  exit /b 1
)
echo  Launching %EXE%
echo.
start "" "%EXE%"
