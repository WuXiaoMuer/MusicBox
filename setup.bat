@echo off
setlocal
cd /d "%~dp0"
set PATH=%USERPROFILE%\.cargo\bin;%PATH%

echo.
echo  ============================================
echo   MusicBox - Environment Setup Check
echo  ============================================
echo.

where cargo >nul 2>nul
if errorlevel 1 (
  echo  [MISSING] Rust is not installed!
  echo  Please install it from https://rustup.rs and re-run this script.
  echo.
  pause
  exit /b 1
)
echo  [OK] Rust toolchain: 
call cargo --version

cargo tauri --version >nul 2>nul
if errorlevel 1 (
  echo  [INFO] Tauri CLI not found, installing...
  call cargo install tauri-cli --version "2.0.0" --locked
  if errorlevel 1 (
    echo.
    echo  [ERROR] Tauri CLI install failed. Check network and retry.
    echo.
    pause
    exit /b 1
  )
  echo  [OK] Tauri CLI installed.
) else (
  echo  [OK] Tauri CLI: 
  call cargo tauri --version
)

echo.
echo  ============================================
echo   Ready! Useful scripts:
echo     run.bat          Run dev mode
echo     build.bat        Build installer package
echo     build-min.bat    Build EXE only (faster)
echo     run-release.bat  Run the compiled build
echo     clean.bat        Clean build cache
echo  ============================================
echo.
pause
