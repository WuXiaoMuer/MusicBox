@echo off
setlocal
cd /d "%~dp0"
set PATH=%USERPROFILE%\.cargo\bin;%PATH%

echo.
echo  ============================================
echo   MusicBox - Run Dev Mode
echo  ============================================
echo.
echo  Compiling and launching the dev build...
echo  Press Ctrl+C to stop the dev server.
echo.
call cargo tauri dev
if errorlevel 1 (
  echo.
  echo  [ERROR] Failed to start. See messages above.
  echo.
  pause
  exit /b 1
)
