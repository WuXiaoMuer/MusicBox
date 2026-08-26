@echo off
setlocal
cd /d "%~dp0"
set PATH=%USERPROFILE%\.cargo\bin;%PATH%

echo.
echo  ============================================
echo   MusicBox - Build EXE Only (no installer)
echo  ============================================
echo.
echo  Compiling the release executable...
echo.
call cargo tauri build --no-bundle
if errorlevel 1 (
  echo.
  echo  [ERROR] Build failed. See messages above.
  echo.
  pause
  exit /b 1
)
echo.
echo  [DONE] Executable is in:
echo  %cd%\src-tauri\target\release\musicbox.exe
echo.
pause
