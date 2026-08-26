@echo off
setlocal
cd /d "%~dp0"
set PATH=%USERPROFILE%\.cargo\bin;%PATH%

echo.
echo  ============================================
echo   MusicBox - Build Installer (release)
echo  ============================================
echo.
echo  Compiling and creating installer package...
echo  This may take a few minutes.
echo.
call cargo tauri build
if errorlevel 1 (
  echo.
  echo  [ERROR] Build failed. See messages above.
  echo.
  pause
  exit /b 1
)
echo.
echo  [DONE] Installer is in:
echo  %cd%\src-tauri\target\release\bundle\
echo.
pause
