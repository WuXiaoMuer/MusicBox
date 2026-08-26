@echo off
setlocal
cd /d "%~dp0"
set PATH=%USERPROFILE%\.cargo\bin;%PATH%

echo.
echo  ============================================
echo   MusicBox - Clean Build Cache
echo  ============================================
echo.
echo  This removes the src-tauri\target folder
echo  (usually 8GB+ of build artifacts).
echo  NOTE: the next build will be slower.
echo.
choice /c YN /m "Are you sure"
if errorlevel 2 (
  echo  Cancelled.
  exit /b 0
)
echo.
call cargo clean
if errorlevel 1 (
  echo.
  echo  [ERROR] Clean failed.
  echo.
  pause
  exit /b 1
)
echo.
echo  [DONE] Build cache cleaned.
echo.
pause
