@echo off
cd /d "%~dp0"

:: === Check .env files ===
if not exist "Music\server\.env" (
    echo   Missing Music\server\.env, please create it first
    pause
    exit /b 1
)
if not exist "workbench\server\.env" (
    echo   Missing workbench\server\.env, please create it first
    pause
    exit /b 1
)

:: === Check Netease Cookie (for VIP songs) ===
findstr /C:"NETEASE_COOKIE=" "Music\server\.env" >nul 2>&1
if %errorlevel% neq 0 (
    echo   NETEASE_COOKIE not configured - VIP songs will only play 30s
    echo   Run: npm run login
    echo   to scan QR code and auto-save the cookie.
    echo.
)

:: === Install deps if first run ===
if not exist "node_modules\electron" (
    call npm install
    if %errorlevel% neq 0 exit /b 1
)

:: === Start ===
npm run dev
